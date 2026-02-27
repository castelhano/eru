"""
engine.py — Motor de consolidação de frequência.
Consome registros de Frequencia do período e produz o dicionário
para FrequenciaConsolidada.consolidado, compatível com o motor de folha.

Estrutura do consolidado gerado:
  Nível 1 — totalizadores por categoria (H_*):
    H_horas_trabalhadas, H_horas_extras, H_horas_noturnas, H_intervalos,
    H_faltas_justificadas, H_faltas_injustificadas, H_atestados,
    H_dias_trabalhados, H_dias_falta_just, H_dias_falta_njust,
    H_dias_folga, H_dias_afastamento,
    H_dias_mes, H_dias_contrato, H_dias_efetivos

  Nível 2 — totalizadores por EventoFrequencia com rastreio (EF_*):
    Chave 'EF': {rastreio: {horas, dias}}
    Exposto no motor de folha como EF_<rastreio>_horas / EF_<rastreio>_dias.

Hora extra:
  carga_diaria preenchida → calculada dia a dia (excedente sobre carga_diaria).
  carga_diaria ausente    → H_horas_extras = 0, cálculo fica na fórmula do evento
                            de folha usando H_horas_trabalhadas vs C_carga_mensal.

Hora noturna:
  Calculada apenas para registros de categoria JORNADA com horário (não dia_inteiro).
  Intervalo configurável em FrequenciaSchema (padrão 22h–06h).
  Janela cruza meia-noite — interseção calculada em dois segmentos.
"""
import calendar
from collections import defaultdict
from datetime import date, datetime, time, timedelta
from django.db.models import Q
from django.utils import timezone
from pessoal.models import Frequencia, FrequenciaConsolidada, EventoFrequencia, PessoalSettings
from pessoal.schemas import FrequenciaSchema


# ─── Categorias por comportamento ────────────────────────────────────────────
_CAT = EventoFrequencia.Categoria
_CAT_TRABALHO  = {_CAT.JORNADA}
_CAT_INTERVALO = {_CAT.INTERVALO}
_CAT_AJ        = {_CAT.AUSENCIA_JUST}
_CAT_ANJ       = {_CAT.AUSENCIA_NJUST}
_CAT_FOLGA     = {_CAT.FOLGA}
# HORA_EXTRA não é processada como categoria — HE é derivada automaticamente.
# Lançamentos manuais com categoria HORA_EXTRA são acumulados no nível 2 via rastreio.


def _horas(freq) -> float:
    """Retorna duração em horas de um registro com início/fim."""
    if freq.inicio and freq.fim:
        return (freq.fim - freq.inicio).total_seconds() / 3600
    return 0.0


def _agrupar_por_dia(frequencias, tz) -> dict:
    """Agrupa registros de Frequencia por date, resolvendo timezone."""
    grupos = defaultdict(list)
    for f in frequencias:
        dia = f.data if f.data else f.inicio.astimezone(tz).date()
        grupos[dia].append(f)
    return grupos


def _carga_dia(contrato) -> float | None:
    """
    Retorna carga horária diária explícita do contrato, ou None.
    None indica metodologia mensal — HE não é calculada dia a dia pelo engine.
    """
    return float(contrato.carga_diaria) if contrato.carga_diaria else None


def _segmentos_noturnos(dia: date, hn_inicio: time, hn_fim: time) -> list:
    """
    Retorna os segmentos datetime da janela noturna para um dado dia.
    Como a janela cruza meia-noite, são dois segmentos:
      [dia 22h → dia+1 00h] e [dia 00h → dia 06h]
    """
    return [
        (datetime.combine(dia,              hn_inicio),
         datetime.combine(dia + timedelta(days=1), time(0, 0))),   # 22h → meia-noite
        (datetime.combine(dia,              time(0, 0)),
         datetime.combine(dia,              hn_fim)),               # meia-noite → 06h
    ]


def _horas_noturnas(inicio_dt: datetime, fim_dt: datetime,
                    hn_inicio: time, hn_fim: time) -> float:
    """
    Calcula horas dentro da janela noturna para um registro de jornada.
    Trata corretamente turnos que cruzam meia-noite.
    """
    # naive para comparação uniforme — timezone já foi resolvido antes da chamada
    ini = inicio_dt.replace(tzinfo=None)
    fim = fim_dt.replace(tzinfo=None)
    total = 0.0
    for seg_ini, seg_fim in _segmentos_noturnos(ini.date(), hn_inicio, hn_fim):
        sobreposicao_ini = max(ini, seg_ini)
        sobreposicao_fim = min(fim, seg_fim)
        if sobreposicao_fim > sobreposicao_ini:
            total += (sobreposicao_fim - sobreposicao_ini).total_seconds() / 3600
    # verifica também o segmento noturno do dia anterior (turno iniciado antes da meia-noite)
    for seg_ini, seg_fim in _segmentos_noturnos(ini.date() - timedelta(days=1), hn_inicio, hn_fim):
        sobreposicao_ini = max(ini, seg_ini)
        sobreposicao_fim = min(fim, seg_fim)
        if sobreposicao_fim > sobreposicao_ini:
            total += (sobreposicao_fim - sobreposicao_ini).total_seconds() / 3600
    return total


def _calcular_dia(registros, carga_dia: float | None, incluir_intervalo: bool,
                  hn_inicio: time, hn_fim: time) -> dict:
    """
    Processa todos os registros de um único dia e retorna parciais.
    Nível 1: acumula por categoria.
    Nível 2: acumula por rastreio do EventoFrequencia (EF_*).
    Hora extra: calculada apenas se carga_dia está definida (metodologia diária).
    Hora noturna: calculada apenas para JORNADA com horário (não dia_inteiro).
    """
    r = {
        'h_trabalhadas':   0.0,  'h_extras':        0.0,  'h_noturnas':     0.0,
        'h_intervalo':     0.0,  'h_aj':            0.0,  'h_anj':          0.0,
        'h_atestado':      0.0,
        'dia_trabalhado':  False, 'dia_falta_just':  False, 'dia_falta_njust': False,
        'dia_folga':       False, 'dia_afastamento': False, 'desconta_efetivos': False,
        'ef': defaultdict(lambda: {'horas': 0.0, 'dias': 0}),
    }
    carga_ref = carga_dia or 0.0  # base para eventos dia_inteiro quando metodologia mensal

    for f in registros:
        cat   = f.evento.categoria
        horas = carga_ref if f.evento.dia_inteiro else _horas(f)

        # Nível 2 — acumula por rastreio independente da categoria
        if f.evento.rastreio:
            r['ef'][f.evento.rastreio]['horas'] += horas
            if f.evento.dia_inteiro:
                r['ef'][f.evento.rastreio]['dias'] += 1

        # Nível 1 — acumula por categoria
        if cat in _CAT_TRABALHO:
            r['h_trabalhadas'] += horas
            r['dia_trabalhado'] = True
            # horas noturnas — apenas jornada com horário real (não dia_inteiro)
            if not f.evento.dia_inteiro and f.inicio and f.fim:
                r['h_noturnas'] += _horas_noturnas(f.inicio, f.fim, hn_inicio, hn_fim)
        elif cat in _CAT_INTERVALO and incluir_intervalo:
            r['h_intervalo'] += horas
        elif cat in _CAT_AJ:
            r['h_aj']          += horas
            r['dia_falta_just'] = True
            if f.evento.dia_inteiro:
                r['h_atestado']     += horas
                r['dia_afastamento'] = True
        elif cat in _CAT_ANJ:
            r['h_anj']           += horas
            r['dia_falta_njust']  = True
        elif cat in _CAT_FOLGA:
            r['dia_folga'] = True

        if f.evento.desconta_efetivos:
            r['desconta_efetivos'] = True  # basta um evento no dia para descontar

    # Hora extra diária — só se metodologia diária (carga_dia explícita no contrato)
    if carga_dia:
        excedente = r['h_trabalhadas'] - carga_dia
        if excedente > 0:
            r['h_extras']      = excedente
            r['h_trabalhadas'] = carga_dia  # normaliza — evita dupla contagem no mensal

    return r


def _detectar_erros(inicio: date, fim: date, grupos: dict, contrato) -> dict:
    """
    Varre o período e marca dias sem nenhum registro como pendentes.
    Dias fora da vigência do contrato são ignorados.
    Retorna dict {str(data): motivo} para o campo erros do consolidado.
    """
    erros           = {}
    contrato_inicio = contrato.inicio
    contrato_fim    = contrato.fim or date.max
    cur             = inicio
    while cur <= fim:
        if contrato_inicio <= cur <= contrato_fim and cur not in grupos:
            erros[str(cur)] = 'Dia sem registro'
        cur += timedelta(days=1)
    return erros


def consolidar(contrato, inicio: date, fim: date, incluir_intervalo: bool = False) -> FrequenciaConsolidada:
    """
    Ponto de entrada principal do engine.
    Processa o período [inicio, fim] para o contrato e persiste FrequenciaConsolidada.
    Retorna a instância salva.
    """
    tz = timezone.get_current_timezone()

    # 1. Configurações da filial — intervalo noturno com fallback para padrão legal
    settings_obj = PessoalSettings.objects.filter(filial_id=contrato.funcionario.filial_id).first()
    cfg_freq     = settings_obj.config.frequencia if settings_obj else FrequenciaSchema()
    hn_inicio    = cfg_freq.hn_inicio  # time(22, 0) por padrão
    hn_fim       = cfg_freq.hn_fim     # time(6, 0) por padrão

    # 2. Busca registros do período — eventos dia_inteiro via campo data, demais via inicio
    frequencias = (
        Frequencia.objects
        .filter(contrato=contrato)
        .filter(Q(inicio__date__range=(inicio, fim)) | Q(data__range=(inicio, fim)))
        .select_related('evento')
        .order_by('inicio')
    )

    # 3. Agrupa por dia e resolve carga diária do contrato
    grupos    = _agrupar_por_dia(frequencias, tz)
    carga_dia = _carga_dia(contrato)  # None se metodologia mensal

    # 4. Totalizadores nível 1 (H_*)
    totais = {
        'H_horas_trabalhadas':     0.0, 'H_horas_extras':         0.0,
        'H_horas_noturnas':        0.0, 'H_intervalos':           0.0,
        'H_faltas_justificadas':   0.0, 'H_faltas_injustificadas': 0.0,
        'H_atestados':             0.0,
        'H_dias_trabalhados':      0,   'H_dias_falta_just':       0,
        'H_dias_falta_njust':      0,   'H_dias_folga':            0,
        'H_dias_afastamento':      0,
    }

    # Dias de contrato ativo no período — base para H_dias_efetivos
    contrato_fim_dt = contrato.fim or date.max
    H_dias_contrato = sum(
        1 for n in range((fim - inicio).days + 1)
        if contrato.inicio <= (inicio + timedelta(n)) <= contrato_fim_dt
    )
    dias_descontados = 0  # acumulado por dias com evento desconta_efetivos=True

    # Acumulador nível 2 (EF_*)
    ef_acc: dict[str, dict] = defaultdict(lambda: {'horas': 0.0, 'dias': 0})

    # 5. Processa cada dia com registro dentro do range solicitado
    for dia, registros in grupos.items():
        if not (inicio <= dia <= fim):
            continue
        d = _calcular_dia(registros, carga_dia, incluir_intervalo, hn_inicio, hn_fim)

        totais['H_horas_trabalhadas']     += d['h_trabalhadas']
        totais['H_horas_extras']          += d['h_extras']
        totais['H_horas_noturnas']        += d['h_noturnas']
        totais['H_intervalos']            += d['h_intervalo']
        totais['H_faltas_justificadas']   += d['h_aj']
        totais['H_faltas_injustificadas'] += d['h_anj']
        totais['H_atestados']             += d['h_atestado']
        if d['dia_trabalhado']:    totais['H_dias_trabalhados'] += 1
        if d['dia_falta_just']:    totais['H_dias_falta_just']  += 1
        if d['dia_falta_njust']:   totais['H_dias_falta_njust'] += 1
        if d['dia_folga']:         totais['H_dias_folga']        += 1
        if d['dia_afastamento']:   totais['H_dias_afastamento']  += 1
        if d['desconta_efetivos']: dias_descontados              += 1

        for rastreio, vals in d['ef'].items():
            ef_acc[rastreio]['horas'] += vals['horas']
            ef_acc[rastreio]['dias']  += vals['dias']

    # 6. Totalizadores de período
    totais['H_dias_mes']      = calendar.monthrange(inicio.year, inicio.month)[1]
    totais['H_dias_contrato'] = H_dias_contrato
    totais['H_dias_efetivos'] = H_dias_contrato - dias_descontados  # base para proporcional de HE mensal

    # 7. Arredonda floats para 4 casas — evita ruído de ponto flutuante
    for k, v in totais.items():
        if isinstance(v, float):
            totais[k] = round(v, 4)

    # 8. Nível 2: serializa EF_* no consolidado
    # Motor de folha acessa como EF_<rastreio>_horas e EF_<rastreio>_dias via collectors.py
    totais['EF'] = {
        rastreio: {'horas': round(vals['horas'], 4), 'dias': vals['dias']}
        for rastreio, vals in ef_acc.items()
    }

    # 9. Detecta dias sem registro e define status
    erros  = _detectar_erros(inicio, fim, grupos, contrato)
    status = FrequenciaConsolidada.Status.ABERTO if erros else FrequenciaConsolidada.Status.FECHADO

    # 10. Persiste — idempotente via update_or_create na competência
    inicio_dt = datetime.combine(inicio, datetime.min.time())
    fim_dt    = datetime.combine(fim,    datetime.max.time().replace(microsecond=0))

    obj, _ = FrequenciaConsolidada.objects.update_or_create(
        contrato=contrato,
        competencia=inicio.replace(day=1),  # competência = sempre dia 1 do mês
        defaults={
            'inicio':        timezone.make_aware(inicio_dt, tz),
            'fim':           timezone.make_aware(fim_dt,    tz),
            'consolidado':   totais,
            'erros':         erros,
            'bloqueado':     bool(erros),
            'status':        status,
            'processamento': timezone.now(),
        }
    )
    return obj