"""
tasks.py — Tasks assíncronas via Django Q2.
Dispara consolidação de frequência e processamento de folha em background.
O modelo ProcessamentoJob rastreia estado para consumo no dashboard.
"""
from datetime import date
from django.utils.timezone import now
from django_q.tasks import async_task
from pessoal.models import Contrato, ProcessamentoJob
from pessoal.services.frequencia.engine import consolidar
from pessoal.services.folha.services import payroll_run


# ─── Helpers internos ────────────────────────────────────────────────────────

def _abrir_job(tipo: str, filial_id: int, competencia: date, usuario) -> ProcessamentoJob:
    """Cria ou reabre o registro de job antes de enfileirar a task."""
    obj, _ = ProcessamentoJob.objects.update_or_create(
        tipo=tipo,
        filial_id=filial_id,
        competencia=competencia,
        defaults={
            'status':       ProcessamentoJob.Status.AGUARDANDO,
            'criado_por':   usuario,
            'iniciado_em':  None,
            'concluido_em': None,
            'resultado':    {},
        }
    )
    return obj


def _fechar_job(job_id: int, resultado: dict, erro: str | None = None):
    """Atualiza o job ao término — sucesso ou falha."""
    status = ProcessamentoJob.Status.ERRO if erro else ProcessamentoJob.Status.CONCLUIDO
    ProcessamentoJob.objects.filter(pk=job_id).update(
        status=status,
        concluido_em=now(),
        resultado=resultado if not erro else {'erro': erro},
    )


def _filtrar_contratos(filial_id: int, inicio: date, fim: date,
                       matricula_de: str | None, matricula_ate: str | None):
    """
    Retorna queryset de contratos vigentes da filial no período,
    filtrando por intervalo de matrícula se informado.
    DE preenchido  → a partir dessa matrícula
    ATE preenchido → até essa matrícula
    Ambos          → apenas o intervalo
    Nenhum         → toda a filial
    """
    from django.db.models import Q
    qs = (
        Contrato.objects
        .filter(funcionario__filial_id=filial_id)
        .filter(inicio__lte=fim)
        .filter(Q(fim__gte=inicio) | Q(fim__isnull=True))
        .select_related('funcionario')
        .order_by('funcionario__matricula')  # ordem garante consistência do filtro de range
    )
    if matricula_de:
        qs = qs.filter(funcionario__matricula__gte=matricula_de)
    if matricula_ate:
        qs = qs.filter(funcionario__matricula__lte=matricula_ate)
    return qs


# ─── Workers (executados pelo Django Q2 em segundo plano) ────────────────────

def _worker_consolidar(job_id: int, filial_id: int, competencia_str: str,
                       inicio_str: str, fim_str: str, incluir_intervalo: bool,
                       matricula_de: str | None, matricula_ate: str | None):
    """
    Worker de consolidação de frequência.
    Itera contratos vigentes (respeitando filtro de matrícula) e chama o engine para cada um.
    """
    ProcessamentoJob.objects.filter(pk=job_id).update(
        status=ProcessamentoJob.Status.PROCESSANDO,
        iniciado_em=now(),
    )
    try:
        inicio    = date.fromisoformat(inicio_str)
        fim       = date.fromisoformat(fim_str)
        contratos = _filtrar_contratos(filial_id, inicio, fim, matricula_de, matricula_ate)
        processados, erros_count = 0, 0
        for c in contratos:
            try:
                consolidar(c, inicio, fim, incluir_intervalo)
                processados += 1
            except Exception as e:  # 'as e' obrigatório — usado no print abaixo
                erros_count += 1    # continua os demais mesmo se um falhar
                print(f"[ERRO consolidar] contrato={c.id} funcionario={c.funcionario.matricula} erro={e}")

        _fechar_job(job_id, {
            'processados': processados,
            'erros':       erros_count,
            'periodo':     f"{inicio.strftime('%d/%m/%Y')} a {fim.strftime('%d/%m/%Y')}",
            'filtro_de':   matricula_de,
            'filtro_ate':  matricula_ate,
        })
    except Exception as e:
        _fechar_job(job_id, {}, erro=str(e))


def _worker_folha(job_id: int, filial_id: int, mes: int, ano: int):
    """
    Worker de processamento de folha de pagamento.
    Delega para payroll_run e registra totais no job.
    """
    ProcessamentoJob.objects.filter(pk=job_id).update(
        status=ProcessamentoJob.Status.PROCESSANDO,
        iniciado_em=now(),
    )
    try:
        total = payroll_run(filial_id, mes, ano)
        _fechar_job(job_id, {'processados': total, 'competencia': f"{mes:02d}/{ano}"})
    except Exception as e:
        _fechar_job(job_id, {}, erro=str(e))


# ─── API pública — chamada pelas views / dashboard ───────────────────────────

def disparar_consolidacao(filial_id: int, competencia: date, inicio: date, fim: date,
                          incluir_intervalo: bool = False,
                          matricula_de: str | None = None,
                          matricula_ate: str | None = None,
                          usuario=None) -> ProcessamentoJob:
    """
    Enfileira consolidação de frequência via Django Q2.
    Retorna o ProcessamentoJob criado para rastreamento no dashboard.
    """
    job = _abrir_job(ProcessamentoJob.Tipo.CONSOLIDACAO_FREQ, filial_id, competencia, usuario)
    async_task(
        _worker_consolidar,
        job.id, filial_id,
        competencia.isoformat(), inicio.isoformat(), fim.isoformat(),
        incluir_intervalo, matricula_de, matricula_ate,
        # timestamp no task_name evita deduplicação indevida pelo Django Q2
        # garantindo que reprocessamentos do mesmo mês sempre executem
        task_name=f"consolidar_freq_{filial_id}_{competencia.isoformat()}_{int(now().timestamp())}",
    )
    return job


def disparar_folha(filial_id: int, competencia: date, usuario=None) -> ProcessamentoJob:
    """
    Enfileira processamento de folha via Django Q2.
    Retorna o ProcessamentoJob criado para rastreamento no dashboard.
    """
    job = _abrir_job(ProcessamentoJob.Tipo.FOLHA, filial_id, competencia, usuario)
    async_task(
        _worker_folha,
        job.id, filial_id, competencia.month, competencia.year,
        # timestamp pelo mesmo motivo
        task_name=f"folha_{filial_id}_{competencia.isoformat()}_{int(now().timestamp())}",
    )
    return job