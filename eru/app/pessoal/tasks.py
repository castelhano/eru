"""
tasks.py — Tasks assíncronas via Django Q2.
Dispara consolidação de frequência, processamento de folha e carga de escala em background.
O modelo ProcessamentoJob rastreia estado para consumo no dashboard.

Schema padrão de resultado (todo worker deve respeitar):
{
    'processados': int,         # contratos processados com sucesso
    'falhas':      int,         # contratos que geraram exceção
    'periodo':     str | None,  # "dd/mm/YYYY a dd/mm/YYYY"
    'filtro_de':   str | None,
    'filtro_ate':  str | None,
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


# ─── Schema helper ───────────────────────────────────────────────────────────

def _resultado(processados=0, falhas=0, periodo=None, filtro_de=None, filtro_ate=None):
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
    """Atualiza o job ao término — sucesso ou falha fatal."""
    if erro:
        resultado = _resultado()
        resultado['erro'] = erro
    ProcessamentoJob.objects.filter(pk=job_id).update(
        status=ProcessamentoJob.Status.ERRO if erro else ProcessamentoJob.Status.CONCLUIDO,
        concluido_em=now(),
        resultado=resultado,
    )


def _filtrar_contratos(filial_id: int, inicio: date, fim: date,
                       matricula_de: str | None, matricula_ate: str | None):
    """
    Retorna queryset de contratos vigentes da filial no período,
    filtrando por intervalo de matrícula se informado.
    """
    qs = (
        Contrato.objects
        .filter(funcionario__filial_id=filial_id)
        .filter(inicio__lte=fim)
        .filter(Q(fim__gte=inicio) | Q(fim__isnull=True))
        .select_related('funcionario')
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
                falhas += 1
                print(f"[ERRO consolidar] contrato={c.id} matricula={c.funcionario.matricula} erro={e}")
        _fechar_job(job_id, _resultado(
            processados=processados,
            falhas=falhas,
            periodo=_fmt_periodo(inicio, fim),
            filtro_de=matricula_de,
            filtro_ate=matricula_ate,
        ))
    except Exception as e:
        _fechar_job(job_id, {}, erro=str(e))


def _worker_folha(job_id: int, filial_id: int, mes: int, ano: int):
    ProcessamentoJob.objects.filter(pk=job_id).update(
        status=ProcessamentoJob.Status.PROCESSANDO,
        iniciado_em=now(),
    )
    try:
        total  = payroll_run(filial_id, mes, ano)
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
    Para cada contrato vigente, carrega registros de Frequencia baseados no
    TurnoHistorico — apenas para dias sem nenhum registro existente.

    Dias ocupados são resolvidos num único hit antes do loop principal,
    evitando N+1. O contador 'processados' reflete contratos, não registros.
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

        # ── 1. Dias já ocupados — dois hits no banco, normaliza para set ──────
        # Registros com campo 'data' (eventos dia_inteiro / folga)
        ocupados: set[tuple] = {
            (cid, d)
            for cid, d in Frequencia.objects
            .filter(contrato_id__in=contrato_ids, data__range=(inicio, fim))
            .values_list('contrato_id', 'data')
        }
        # Registros com campo 'inicio' (eventos com horário) — converte para date local
        ocupados.update(
            (cid, dt.astimezone(tz).date())
            for cid, dt in Frequencia.objects
            .filter(contrato_id__in=contrato_ids, inicio__date__range=(inicio, fim))
            .values_list('contrato_id', 'inicio')
        )

        # ── 2. Configurações da filial ────────────────────────────────────────
        settings_obj      = PessoalSettings.objects.filter(filial_id=filial_id).first()
        cfg_freq          = settings_obj.config.frequencia if settings_obj else None
        evento_jornada_id = cfg_freq.evento_jornada_id if cfg_freq else None
        evento_folga_id   = cfg_freq.evento_folga_id   if cfg_freq else None

        evento_jornada = EventoFrequencia.objects.filter(pk=evento_jornada_id).first() if evento_jornada_id else None
        evento_folga   = EventoFrequencia.objects.filter(pk=evento_folga_id).first()   if evento_folga_id   else None

        # ── 3. Turnos de todos os contratos ──────────────────────────────────
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

        # ── 4. Loop principal: contrato → dias do período ─────────────────────
        processados = falhas = 0
        bulk_create: list[Frequencia] = []

        for contrato in contratos:
            historico = turnos_por_contrato.get(contrato.id, [])
            if not historico:
                continue

            dias_por_turno = {th.turno_id: list(th.turno.dias.all()) for th in historico}
            contrato_ok    = False

            cur = inicio
            while cur <= fim:
                # fora da vigência do contrato
                if not (contrato.inicio <= cur <= (contrato.fim or date.max)):
                    cur += timedelta(days=1)
                    continue

                # dia já tem registro — pula sem criar
                if (contrato.id, cur) in ocupados:
                    cur += timedelta(days=1)
                    continue

                # turno vigente neste dia (mais recente primeiro)
                turno_hist = next((
                    th for th in reversed(historico)
                    if th.inicio_vigencia <= cur and (
                        th.fim_vigencia is None or th.fim_vigencia >= cur
                    )
                ), None)
                if not turno_hist:
                    cur += timedelta(days=1)
                    continue

                turno     = turno_hist.turno
                pos       = (cur - turno.inicio).days % turno.dias_ciclo if turno.dias_ciclo > 0 else 0
                turno_dia = next(
                    (d for d in dias_por_turno[turno.id] if d.posicao_ciclo == pos), None
                )
                if not turno_dia:
                    cur += timedelta(days=1)
                    continue

                try:
                    if turno_dia.eh_folga:
                        if evento_folga:
                            bulk_create.append(Frequencia(
                                contrato=contrato,
                                evento=evento_folga,
                                data=cur,
                                inicio=None,
                                fim=None,
                                editado=False,
                                observacao='Escala automática',
                            ))
                            contrato_ok = True
                    elif evento_jornada and turno_dia.horarios:
                        for h in turno_dia.horarios:
                            entrada_str = h.get('entrada', '')
                            saida_str   = h.get('saida',   '')
                            if not entrada_str or not saida_str:
                                continue
                            entrada_naive = datetime.strptime(f"{cur} {entrada_str}", '%Y-%m-%d %H:%M')
                            saida_naive   = datetime.strptime(f"{cur} {saida_str}",   '%Y-%m-%d %H:%M')
                            if saida_naive <= entrada_naive:
                                saida_naive += timedelta(days=1)  # virada de meia-noite
                            bulk_create.append(Frequencia(
                                contrato=contrato,
                                evento=evento_jornada,
                                data=cur,
                                inicio=timezone.make_aware(entrada_naive, tz),
                                fim=timezone.make_aware(saida_naive,   tz),
                                editado=False,
                                observacao='Escala automática',
                            ))
                            contrato_ok = True
                except Exception as e:
                    falhas += 1
                    print(f"[ERRO escala] contrato={contrato.id} dia={cur} erro={e}")

                cur += timedelta(days=1)

            if contrato_ok:
                processados += 1

            # flush por contrato — evita acúmulo de objetos em memória
            if bulk_create:
                Frequencia.objects.bulk_create(bulk_create, ignore_conflicts=True)
                bulk_create.clear()

        _fechar_job(job_id, _resultado(
            processados=processados,
            falhas=falhas,
            periodo=_fmt_periodo(inicio, fim),
            filtro_de=matricula_de,
            filtro_ate=matricula_ate,
        ))
    except Exception as e:
        _fechar_job(job_id, {}, erro=str(e))


# ─── API pública ─────────────────────────────────────────────────────────────

def disparar_consolidacao(filial_id: int, competencia: date, inicio: date, fim: date,
                          incluir_intervalo: bool = False,
                          matricula_de: str | None = None,
                          matricula_ate: str | None = None,
                          usuario=None) -> ProcessamentoJob:
    job = _abrir_job(ProcessamentoJob.Tipo.CONSOLIDACAO_FREQ, filial_id, competencia, usuario)
    async_task(
        _worker_consolidar,
        job.id, filial_id,
        competencia.isoformat(), inicio.isoformat(), fim.isoformat(),
        incluir_intervalo, matricula_de, matricula_ate,
        task_name=f"consolidar_freq_{filial_id}_{competencia.isoformat()}_{int(now().timestamp())}",
    )
    return job


def disparar_folha(filial_id: int, competencia: date, usuario=None) -> ProcessamentoJob:
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
    job = _abrir_job(ProcessamentoJob.Tipo.CARGA_ESCALA, filial_id, competencia, usuario)
    async_task(
        _worker_carregar_escala,
        job.id, filial_id,
        competencia.isoformat(), inicio.isoformat(), fim.isoformat(),
        matricula_de, matricula_ate,
        task_name=f"escala_{filial_id}_{competencia.isoformat()}_{int(now().timestamp())}",
    )
    return job