"""
engine.py — Motor de consolidação de frequência.
Consome registros de Frequencia do período e produz o dicionário
para FrequenciaConsolidada.consolidado, compatível com o motor de folha.

Hora extra é calculada automaticamente por dia:
    excedente = h_trabalhadas_dia - carga_dia
Se o contrato não tiver carga_diaria definida, o fallback é carga_mensal / 30.
O acumulado H_horas_extras fica disponível no consolidado para consumo
pelo motor de folha via eventos configurados pelo usuário.
"""
from collections import defaultdict
from datetime import date, datetime, timedelta
from django.db.models import Q
from django.utils import timezone
from pessoal.models import Frequencia, FrequenciaConsolidada, EventoFrequencia


# ─── Categorias por comportamento ────────────────────────────────────────────
_CAT = EventoFrequencia.Categoria
_CAT_TRABALHO  = {_CAT.JORNADA}
_CAT_INTERVALO = {_CAT.INTERVALO}
_CAT_AJ        = {_CAT.AUSENCIA_JUST}
_CAT_ANJ       = {_CAT.AUSENCIA_NJUST}
_CAT_FOLGA     = {_CAT.FOLGA}


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


def _carga_dia(contrato) -> float:
    """
    Retorna carga horária diária do contrato.
    carga_diaria preenchida -> metodologia diária (HE calculada dia a dia).
    Apenas carga_mensal -> fallback carga_mensal / 30.
    """
    if contrato.carga_diaria:
        return float(contrato.carga_diaria)
    return round(contrato.carga_mensal / 30, 4)


def _calcular_dia(registros, carga_dia: float, incluir_intervalo: bool) -> dict:
    """
    Processa todos os registros de um único dia e retorna parciais.
    Hora extra é derivada automaticamente: excedente de h_trabalhadas sobre carga_dia.
    Eventos dia_inteiro usam carga_dia como base de horas (ex: atestado, falta).
    """
    r = {
        'h_trabalhadas': 0.0, 'h_extras': 0.0, 'h_intervalo': 0.0,
        'h_aj': 0.0, 'h_anj': 0.0, 'h_atestado': 0.0,
        'dia_trabalhado': False, 'dia_falta_just': False,
        'dia_falta_njust': False, 'dia_folga': False, 'dia_afastamento': False,
    }
    for f in registros:
        cat   = f.evento.categoria
        horas = carga_dia if f.evento.dia_inteiro else _horas(f)

        if cat in _CAT_TRABALHO:
            r['h_trabalhadas'] += horas
            r['dia_trabalhado'] = True
        elif cat in _CAT_INTERVALO and incluir_intervalo:
            r['h_intervalo'] += horas
        elif cat in _CAT_AJ:
            r['h_aj'] += horas
            r['dia_falta_just'] = True
            if f.evento.dia_inteiro:          # atestado = ausência justificada dia inteiro
                r['h_atestado']     += horas
                r['dia_afastamento'] = True
        elif cat in _CAT_ANJ:
            r['h_anj'] += horas
            r['dia_falta_njust'] = True
        elif cat in _CAT_FOLGA:
            r['dia_folga'] = True

    # Hora extra diária — excedente sobre a carga do dia
    excedente = r['h_trabalhadas'] - carga_dia
    if excedente > 0:
        r['h_extras']      = excedente
        r['h_trabalhadas'] = carga_dia  # normaliza — evita dupla contagem no acumulado mensal

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

    # 1. Busca registros do período — eventos dia_inteiro via campo data, demais via inicio
    frequencias = (
        Frequencia.objects
        .filter(contrato=contrato)
        .filter(Q(inicio__date__range=(inicio, fim)) | Q(data__range=(inicio, fim)))
        .select_related('evento')
        .order_by('inicio')
    )

    # 2. Agrupa por dia e resolve carga diária base do contrato
    grupos    = _agrupar_por_dia(frequencias, tz)
    carga_dia = _carga_dia(contrato)  # usado para cálculo de HE e eventos dia_inteiro

    # 3. Acumuladores mensais
    totais = {
        'H_horas_trabalhadas':    0.0, 'H_horas_extras':         0.0,
        'H_intervalos':           0.0, 'H_faltas_justificadas':   0.0,
        'H_faltas_injustificadas': 0.0, 'H_atestados':            0.0,
        'H_dias_trabalhados':     0,   'H_dias_falta_just':       0,
        'H_dias_falta_njust':     0,   'H_dias_folga':            0,
        'H_dias_afastamento':     0,
    }

    # 4. Processa cada dia com registro dentro do range solicitado
    for dia, registros in grupos.items():
        if not (inicio <= dia <= fim):
            continue
        d = _calcular_dia(registros, carga_dia, incluir_intervalo)
        totais['H_horas_trabalhadas']     += d['h_trabalhadas']
        totais['H_horas_extras']          += d['h_extras']
        totais['H_intervalos']            += d['h_intervalo']
        totais['H_faltas_justificadas']   += d['h_aj']
        totais['H_faltas_injustificadas'] += d['h_anj']
        totais['H_atestados']             += d['h_atestado']
        if d['dia_trabalhado']:  totais['H_dias_trabalhados'] += 1
        if d['dia_falta_just']:  totais['H_dias_falta_just']  += 1
        if d['dia_falta_njust']: totais['H_dias_falta_njust'] += 1
        if d['dia_folga']:       totais['H_dias_folga']        += 1
        if d['dia_afastamento']: totais['H_dias_afastamento']  += 1

    # 5. Arredonda floats para 4 casas — evita ruído de ponto flutuante
    for k, v in totais.items():
        if isinstance(v, float):
            totais[k] = round(v, 4)

    # 6. Detecta dias sem registro e define status
    erros  = _detectar_erros(inicio, fim, grupos, contrato)
    status = FrequenciaConsolidada.Status.ABERTO if erros else FrequenciaConsolidada.Status.FECHADO

    # 7. Persiste — idempotente via update_or_create na competência
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
