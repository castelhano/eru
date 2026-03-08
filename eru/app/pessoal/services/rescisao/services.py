"""
services.py — Orquestrador do processo de desligamento.

Dois modos de uso:
  1. processar_desligamento(funcionario_id, job_id)  → chamado pelo qcluster (real)
  2. simular_desligamento(funcionario_id, rescisao_id) → chamado pela view de simulação (dry_run)

Fluxo real:
  consolidar frequência do mês → coletar dados → engine → persistence → sync_status

Fluxo simulação:
  consolidar frequência do mês → coletar dados → engine → retorna dict (sem salvar nada)
"""
from datetime import date
from django.db import transaction
from django.utils import timezone

from pessoal.models import Funcionario, Rescisao, ProcessamentoJob
from pessoal.services.frequencia.engine import consolidar as consolidar_frequencia
from .collectors import get_dados_rescisao
from .engine import calcular_rescisao
from .persistence import salvar_resultado, cancelar_frequencias_orfas


def processar_desligamento(funcionario_id: int, job_id: int) -> dict:
    """
    Chamado pelo qcluster via tasks.disparar_desligamento().
    Atualiza o job com progresso e resultado.
    """
    job = ProcessamentoJob.objects.get(pk=job_id)
    _atualizar_job(job, ProcessamentoJob.Status.PROCESSANDO, progresso=0)

    try:
        funcionario, rescisao, contrato = _get_objetos(funcionario_id)

        # 1. Consolida frequência do mês corrente até a data de desligamento
        _atualizar_job(job, progresso=20)
        _consolidar_mes_desligamento(contrato, rescisao.data_desligamento)

        # 2. Coleta dados para o engine
        _atualizar_job(job, progresso=40)
        dados = get_dados_rescisao(funcionario, contrato, rescisao.data_desligamento)
        dados['rescisao_obj'] = rescisao  # engine precisa do motivo e aviso

        # 3. Calcula verbas (puro, sem side effects)
        _atualizar_job(job, progresso=60)
        resultado = calcular_rescisao(dados)

        # 4. Persiste resultado e trata frequências órfãs
        _atualizar_job(job, progresso=80)
        freq_info = cancelar_frequencias_orfas(contrato, rescisao.data_desligamento)
        resultado['freq_info'] = freq_info

        # Marca job CONCLUIDO ANTES de salvar_resultado — sync_status precisa encontrar
        # o job já concluído no banco para transicionar o funcionário para DESLIGADO.
        _atualizar_job(job, ProcessamentoJob.Status.CONCLUIDO, progresso=100, resultado=resultado)

        with transaction.atomic():
            salvar_resultado(rescisao, resultado)
            # sync_status chamado APÓS job CONCLUIDO no banco → transiciona para DESLIGADO
            rescisao.funcionario.sync_status()

        return resultado

    except Exception as exc:
        _atualizar_job(job, ProcessamentoJob.Status.ERRO, resultado={'erro': str(exc)})
        raise  # propaga para o qcluster registrar o traceback


def simular_desligamento(funcionario_id: int, rescisao_id: int) -> dict:
    """
    Dry-run: calcula tudo sem persistir nada.
    Retorna o mesmo dict de processar_desligamento — a view formata o relatório.
    """
    funcionario, rescisao, contrato = _get_objetos(funcionario_id, rescisao_id)

    # Consolida em memória — consolidar() persiste, mas o resultado que importa é o dict
    # Se já existe consolidado do mês, reutiliza; senão consolida agora.
    _consolidar_mes_desligamento(contrato, rescisao.data_desligamento)

    dados = get_dados_rescisao(funcionario, contrato, rescisao.data_desligamento)
    dados['rescisao_obj'] = rescisao

    return calcular_rescisao(dados)  # sem salvar_resultado → zero side effects


# ─── helpers privados ────────────────────────────────────────────────────────

def _get_objetos(funcionario_id: int, rescisao_id: int | None = None):
    """Carrega funcionário, rescisão e contrato em queries otimizadas."""
    funcionario = (
        Funcionario.objects
        .select_related('filial__empresa', 'rescisao')
        .get(pk=funcionario_id)
    )
    rescisao = (
        Rescisao.objects.select_related('contrato__cargo')
        .get(pk=rescisao_id)
        if rescisao_id
        else funcionario.rescisao
    )
    contrato = rescisao.contrato
    return funcionario, rescisao, contrato


def _consolidar_mes_desligamento(contrato, data_desligamento: date) -> None:
    """
    Garante que a frequência do mês de desligamento está consolidada
    até a data do desligamento (não até o último dia do mês).
    Chama o engine de frequência existente — idempotente via update_or_create.
    """
    inicio_mes = data_desligamento.replace(day=1)
    consolidar_frequencia(contrato, inicio_mes, data_desligamento)


def _atualizar_job(job: ProcessamentoJob, status: str | None = None,
                   progresso: int | None = None, resultado: dict | None = None) -> None:
    """Atualiza campos do job sem sobrescrever o que não foi passado."""
    update_fields = ['update_at'] if hasattr(job, 'update_at') else []
    if status is not None:
        job.status = status
        update_fields.append('status')
        if status == ProcessamentoJob.Status.PROCESSANDO:
            job.iniciado_em = timezone.now()
            update_fields.append('iniciado_em')
        elif status in (ProcessamentoJob.Status.CONCLUIDO, ProcessamentoJob.Status.ERRO):
            job.concluido_em = timezone.now()
            update_fields.append('concluido_em')
    if progresso is not None:
        job.progresso = progresso
        update_fields.append('progresso')
    if resultado is not None:
        job.resultado = resultado
        update_fields.append('resultado')
    if update_fields:
        job.save(update_fields=update_fields)