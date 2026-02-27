"""
tasks.py — Tasks assíncronas via Django Q2.
Dispara consolidação de frequência, processamento de folha e carga de escala em background.
O modelo ProcessamentoJob rastreia o estado de cada execução para consumo no dashboard.

Schema padrão de resultado (todo worker deve respeitar):
{
    'processados': int,         # contratos processados com sucesso
    'falhas':      int,         # contratos que geraram exceção individual
    'periodo':     str | None,  # "dd/mm/YYYY a dd/mm/YYYY"
    'filtro_de':   str | None,  # matrícula inicial do filtro aplicado
    'filtro_ate':  str | None,  # matrícula final do filtro aplicado
    'erro':        str | None,  # preenchido apenas em falha fatal do job inteiro
}
"""
import calendar
from datetime import date, datetime, timedelta

from django.db.models import Q
from django.utils import timezone
from django.utils.timezone import now
from django_q.tasks import async_task

from pessoal.models import (
    Contrato, EventoFrequencia, Frequencia,
    PessoalSettings, ProcessamentoJob, TurnoHistorico,
)
from pessoal.services.frequencia.engine import consolidar
from pessoal.services.folha.services import payroll_run
from pessoal.services.turno.utils import get_turno_dia, get_turno_dia_ciclo


# ─── Schema helper ───────────────────────────────────────────────────────────

def _resultado(processados=0, falhas=0, periodo=None, filtro_de=None, filtro_ate=None, observacoes=None):
    """Monta o dict de resultado padronizado."""
    return {
        'processados': processados,
        'falhas':      falhas,
        'periodo':     periodo,
        'filtro_de':   filtro_de,
        'filtro_ate':  filtro_ate,
    }


def _fmt_periodo(inicio: date, fim: date) -> str:
    return f"{inicio.strftime('%d/%m/%Y')} a {fim.strftime('%d/%m/%Y')}"


# ─── Helpers internos ────────────────────────────────────────────────────────

def _abrir_job(tipo: str, filial_id: int, competencia: date, usuario) -> ProcessamentoJob:
    """Cria ou reabre o job — idempotente por (tipo, filial, competencia)."""
    obj, _ = ProcessamentoJob.objects.update_or_create(
        tipo=tipo,
        filial_id=filial_id,
        competencia=competencia,
        defaults={
            'status':       ProcessamentoJob.Status.AGUARDANDO,
            'criado_por':   usuario,
            'iniciado_em':  None,   # zerado a cada reabertura
            'concluido_em': None,
            'resultado':    {},
        }
    )
    return obj


def _fechar_job(job_id: int, resultado: dict, erro: str | None = None, observacoes: list | None = None):
    """Grava o resultado final do job — CONCLUIDO ou ERRO."""
    if erro:
        resultado = _resultado()
        resultado['erro'] = erro  # falha fatal substitui qualquer resultado parcial
    ProcessamentoJob.objects.filter(pk=job_id).update(
        status=ProcessamentoJob.Status.ERRO if erro else ProcessamentoJob.Status.CONCLUIDO,
        concluido_em=now(),
        resultado=resultado,
        observacoes=observacoes or []
    )


def _filtrar_contratos(filial_id: int, inicio: date, fim: date,
                       matricula_de: str | None, matricula_ate: str | None):
    """
    Retorna queryset de contratos vigentes da filial no período.
    Vigência: contrato iniciado antes do fim E ainda ativo (sem fim ou fim >= inicio).
    Filtro de matrícula é opcional — usado para reprocessamento parcial.
    """
    qs = (
        Contrato.objects
        .filter(funcionario__filial_id=filial_id)
        .filter(inicio__lte=fim)                          # contrato já iniciou
        .filter(Q(fim__gte=inicio) | Q(fim__isnull=True)) # contrato ainda vigente
        .select_related('funcionario', 'cargo')           # evita N+1 nos loops
        .order_by('funcionario__matricula')
    )
    if matricula_de:
        qs = qs.filter(funcionario__matricula__gte=matricula_de)
    if matricula_ate:
        qs = qs.filter(funcionario__matricula__lte=matricula_ate)
    return qs


# ─── Workers ─────────────────────────────────────────────────────────────────

def _worker_consolidar(job_id: int, filial_id: int, competencia_str: str,
                       inicio_str: str, fim_str: str, incluir_intervalo: bool,
                       matricula_de: str | None, matricula_ate: str | None):
    """
    Consolida frequência de todos os contratos vigentes no período.
    Cada contrato é processado individualmente — falha individual não interrompe o lote.
    """
    ProcessamentoJob.objects.filter(pk=job_id).update(
        status=ProcessamentoJob.Status.PROCESSANDO,
        iniciado_em=now(),
    )
    try:
        inicio    = date.fromisoformat(inicio_str)
        fim       = date.fromisoformat(fim_str)
        contratos = _filtrar_contratos(filial_id, inicio, fim, matricula_de, matricula_ate)
        processados = falhas = 0
        for c in contratos:
            try:
                consolidar(c, inicio, fim, incluir_intervalo)
                processados += 1
            except Exception as e:
                falhas += 1  # registra falha individual e segue para o próximo
        _fechar_job(job_id, _resultado(
            processados=processados,
            falhas=falhas,
            periodo=_fmt_periodo(inicio, fim),
            filtro_de=matricula_de,
            filtro_ate=matricula_ate,
        ))
    except Exception as e:
        _fechar_job(job_id, {}, erro=str(e))  # falha fatal — ex: erro de banco


def _worker_folha(job_id: int, filial_id: int, mes: int, ano: int):
    """Processa folha de pagamento de todos os contratos vigentes na competência."""
    ProcessamentoJob.objects.filter(pk=job_id).update(
        status=ProcessamentoJob.Status.PROCESSANDO,
        iniciado_em=now(),
    )
    try:
        total  = payroll_run(filial_id, mes, ano)   # retorna qtd de contratos processados
        inicio = date(ano, mes, 1)
        fim    = date(ano, mes, calendar.monthrange(ano, mes)[1])
        _fechar_job(job_id, _resultado(
            processados=total,
            periodo=_fmt_periodo(inicio, fim),
        ))
    except Exception as e:
        _fechar_job(job_id, {}, erro=str(e))


def _worker_carregar_escala(job_id: int, filial_id: int, competencia_str: str,
                            inicio_str: str, fim_str: str,
                            matricula_de: str | None, matricula_ate: str | None):
    """
    Para cada contrato vigente, cria registros de Frequencia com base no TurnoHistorico,
    respeitando o ciclo do turno. Dias que já possuem qualquer registro são ignorados.

    Estratégia de performance:
    - Dias ocupados: resolvidos em 2 queries antes do loop (set de (contrato_id, date))
    - Turnos e dias do ciclo: carregados uma única vez via prefetch, antes do loop
    - Inserção: bulk_create com flush por contrato para controlar uso de memória
    """
    ProcessamentoJob.objects.filter(pk=job_id).update(
        status=ProcessamentoJob.Status.PROCESSANDO,
        iniciado_em=now(),
    )
    try:
        inicio       = date.fromisoformat(inicio_str)
        fim          = date.fromisoformat(fim_str)
        tz           = timezone.get_current_timezone()
        contratos    = _filtrar_contratos(filial_id, inicio, fim, matricula_de, matricula_ate)
        contrato_ids = list(contratos.values_list('id', flat=True))

        # ── 1. Dias já ocupados ───────────────────────────────────────────────
        # Eventos dia_inteiro/folga usam campo 'data'; eventos com horário usam 'inicio'.
        # Ambos são normalizados para set de (contrato_id, date) para lookup O(1) no loop.
        ocupados: set[tuple] = {
            (cid, d)
            for cid, d in Frequencia.objects
            .filter(contrato_id__in=contrato_ids, data__range=(inicio, fim))
            .values_list('contrato_id', 'data')
        }
        ocupados.update(                                  # eventos com horário — converte para date local
            (cid, dt.astimezone(tz).date())
            for cid, dt in Frequencia.objects
            .filter(contrato_id__in=contrato_ids, inicio__date__range=(inicio, fim))
            .values_list('contrato_id', 'inicio')
        )

        # ── 2. Configurações de frequência da filial ──────────────────────────
        # Os eventos de jornada e folga são definidos nas settings e reutilizados em todos os registros.
        settings_obj      = PessoalSettings.objects.filter(filial_id=filial_id).first()
        cfg_freq          = settings_obj.config.frequencia if settings_obj else None
        evento_jornada_id = cfg_freq.evento_jornada_id if cfg_freq else None
        evento_folga_id   = cfg_freq.evento_folga_id   if cfg_freq else None

        evento_jornada = EventoFrequencia.objects.filter(pk=evento_jornada_id).first() if evento_jornada_id else None
        evento_folga   = EventoFrequencia.objects.filter(pk=evento_folga_id).first()   if evento_folga_id   else None

        # Avisos de configuração — acumulados durante a execução e gravados no resultado.
        # Não interrompem o job, mas explicam comportamento limitado (ex: 0 processados).
        obs: list[str] = []
        if not evento_jornada:
            obs.append('Evento de jornada não associado nas configurações')
        if not evento_folga:
            obs.append('Evento de folga não associado nas configurações')

        # ── 3. Histórico de turnos de todos os contratos ──────────────────────
        # Uma única query com prefetch dos dias de ciclo — evita N+1 no loop principal.
        turnos_por_contrato: dict[int, list] = {}
        for th in (
            TurnoHistorico.objects
            .filter(contrato_id__in=contrato_ids)
            .filter(inicio_vigencia__lte=fim)
            .filter(Q(fim_vigencia__gte=inicio) | Q(fim_vigencia__isnull=True))
            .select_related('turno')
            .prefetch_related('turno__dias')
            .order_by('contrato_id', 'inicio_vigencia')
        ):
            turnos_por_contrato.setdefault(th.contrato_id, []).append(th)

        if not turnos_por_contrato:
            obs.append('Nenhum contrato com turno associado encontrado no período')

        # ── 3b. Dias do ciclo indexados por turno_id ──────────────────────────
        # Construído uma vez fora do loop — múltiplos contratos podem compartilhar o mesmo turno.
        # O prefetch já resolveu as queries; list() apenas materializa o cache do ORM.
        dias_por_turno: dict[int, list] = {}
        for ths in turnos_por_contrato.values():
            for th in ths:
                if th.turno_id not in dias_por_turno:
                    dias_por_turno[th.turno_id] = list(th.turno.dias.all())

        # ── 4. Loop principal: contrato → dias do período ─────────────────────
        processados = falhas = 0
        bulk_create: list[Frequencia] = []

        for contrato in contratos:
            historico = turnos_por_contrato.get(contrato.id, [])
            if not historico:
                continue  # contrato sem turno cadastrado — nada a carregar

            contrato_ok = False
            cur = inicio

            while cur <= fim:
                if not (contrato.inicio <= cur <= (contrato.fim or date.max)):
                    cur += timedelta(days=1)  # dia fora da vigência do contrato
                    continue

                if (contrato.id, cur) in ocupados:
                    cur += timedelta(days=1)  # dia já possui registro — não sobrescreve
                    continue

                turno_hist = get_turno_dia(historico, cur)  # turno vigente neste dia
                if not turno_hist:
                    cur += timedelta(days=1)
                    continue

                turno_dia = get_turno_dia_ciclo(
                    turno_hist.turno,
                    dias_por_turno[turno_hist.turno.id],
                    cur,
                )  # posição do dia no ciclo do turno
                if not turno_dia:
                    cur += timedelta(days=1)
                    continue
                try:
                    if turno_dia.eh_folga:
                        if evento_folga:
                            bulk_create.append(Frequencia(
                                contrato=contrato,
                                evento=evento_folga,
                                data=cur,       # folga usa campo 'data' (sem horário)
                                inicio=None,
                                fim=None,
                                editado=False,
                                observacao='Escala automática',
                            ))
                            contrato_ok = True
                    elif evento_jornada and turno_dia.horarios:
                        for h in turno_dia.horarios:  # turno pode ter múltiplos períodos no dia
                            entrada_str = h.get('entrada', '')
                            saida_str   = h.get('saida',   '')
                            if not entrada_str or not saida_str:
                                continue  # horário incompleto no cadastro do turno — ignora
                            entrada_naive = datetime.strptime(f"{cur} {entrada_str}", '%Y-%m-%d %H:%M')
                            saida_naive   = datetime.strptime(f"{cur} {saida_str}",   '%Y-%m-%d %H:%M')
                            if saida_naive <= entrada_naive:
                                saida_naive += timedelta(days=1)  # virada de meia-noite
                            bulk_create.append(Frequencia(
                                contrato=contrato,
                                evento=evento_jornada,
                                data=cur,
                                inicio=timezone.make_aware(entrada_naive, tz),
                                fim=timezone.make_aware(saida_naive, tz),
                                editado=False,
                                observacao='Escala automática',
                            ))
                            contrato_ok = True
                except Exception as e:
                    falhas += 1
                cur += timedelta(days=1)
            if contrato_ok:
                processados += 1

            if bulk_create:
                Frequencia.objects.bulk_create(bulk_create, ignore_conflicts=True)  # ignore_conflicts: segurança contra race condition
                bulk_create.clear()  # libera memória a cada contrato processado
        _fechar_job(job_id, _resultado(
            processados=processados,
            falhas=falhas,
            periodo=_fmt_periodo(inicio, fim),
            filtro_de=matricula_de,
            filtro_ate=matricula_ate,
        ),
            observacoes=obs,  # lista vazia se tudo configurado corretamente
        )
    except Exception as e:
        _fechar_job(job_id, {}, erro=str(e))


# ─── API pública ─────────────────────────────────────────────────────────────

def disparar_consolidacao(filial_id: int, competencia: date, inicio: date, fim: date,
                          incluir_intervalo: bool = False,
                          matricula_de: str | None = None,
                          matricula_ate: str | None = None,
                          usuario=None) -> ProcessamentoJob:
    """Enfileira consolidação de frequência e retorna o job criado."""
    job = _abrir_job(ProcessamentoJob.Tipo.CONSOLIDACAO_FREQ, filial_id, competencia, usuario)
    async_task(
        _worker_consolidar,
        job.id, filial_id,
        competencia.isoformat(), inicio.isoformat(), fim.isoformat(),  # datas como string — django-q serializa via JSON
        incluir_intervalo, matricula_de, matricula_ate,
        task_name=f"consolidar_freq_{filial_id}_{competencia.isoformat()}_{int(now().timestamp())}",
    )
    return job


def disparar_folha(filial_id: int, competencia: date, usuario=None) -> ProcessamentoJob:
    """Enfileira processamento de folha e retorna o job criado."""
    job = _abrir_job(ProcessamentoJob.Tipo.FOLHA, filial_id, competencia, usuario)
    async_task(
        _worker_folha,
        job.id, filial_id, competencia.month, competencia.year,
        task_name=f"folha_{filial_id}_{competencia.isoformat()}_{int(now().timestamp())}",
    )
    return job


def disparar_carga_escala(filial_id: int, competencia: date, inicio: date, fim: date,
                          matricula_de: str | None = None,
                          matricula_ate: str | None = None,
                          usuario=None) -> ProcessamentoJob:
    """Enfileira carga de escala e retorna o job criado."""
    job = _abrir_job(ProcessamentoJob.Tipo.CARGA_ESCALA, filial_id, competencia, usuario)
    async_task(
        _worker_carregar_escala,
        job.id, filial_id,
        competencia.isoformat(), inicio.isoformat(), fim.isoformat(),  # datas como string — django-q serializa via JSON
        matricula_de, matricula_ate,
        task_name=f"escala_{filial_id}_{competencia.isoformat()}_{int(now().timestamp())}",
    )
    return job
