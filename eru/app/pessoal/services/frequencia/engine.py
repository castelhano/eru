"""
engine.py — Motor de consolidação de frequência.
Consome registros de Frequencia do período e produz o dicionário
para FrequenciaConsolidada.consolidado, compatível com o motor de folha.
"""
from collections import defaultdict
from datetime import date, datetime, timedelta
from django.utils import timezone
from pessoal.models import Frequencia, FrequenciaConsolidada, EventoFrequencia


# ─── Categorias por comportamento ────────────────────────────────────────────
_CAT = EventoFrequencia.Categoria
_CAT_TRABALHO   = {_CAT.JORNADA}
_CAT_EXTRA      = {_CAT.HORA_EXTRA}
_CAT_INTERVALO  = {_CAT.INTERVALO}
_CAT_AJ         = {_CAT.AUSENCIA_JUST}
_CAT_ANJ        = {_CAT.AUSENCIA_NJUST}
_CAT_FOLGA      = {_CAT.FOLGA}


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
    Usa carga_diaria se disponível, fallback para carga_mensal / 30.
    """
    if hasattr(contrato, 'carga_diaria') and contrato.carga_diaria:
        return float(contrato.carga_diaria)
    return round(contrato.carga_mensal / 30, 4)


def _calcular_dia(registros, carga_dia: float, incluir_intervalo: bool) -> dict:
    """
    Processa todos os registros de um único dia e retorna parciais.
    Eventos dia_inteiro usam a carga_dia do contrato como base de horas.
    """
    r = {
        'h_trabalhadas': 0.0, 'h_extras': 0.0, 'h_intervalo': 0.0,
        'h_aj': 0.0, 'h_anj': 0.0, 'h_atestado': 0.0,
        'dia_trabalhado': False, 'dia_falta_just': False,
        'dia_falta_njust': False, 'dia_folga': False, 'dia_afastamento': False,
    }
    for f in registros:
        cat = f.evento.categoria
        horas = carga_dia if f.evento.dia_inteiro else _horas(f)

        if cat in _CAT_TRABALHO:
            r['h_trabalhadas'] += horas
            r['dia_trabalhado'] = True
        elif cat in _CAT_EXTRA:
            r['h_extras'] += horas
        elif cat in _CAT_INTERVALO and incluir_intervalo:
            r['h_intervalo'] += horas
        elif cat in _CAT_AJ:
            r['h_aj'] += horas
            r['dia_falta_just'] = True
            # atestado: ausência justificada com dia_inteiro (ex: evento INSS/doença)
            if f.evento.dia_inteiro:
                r['h_atestado'] += horas
                r['dia_afastamento'] = True
        elif cat in _CAT_ANJ:
            r['h_anj'] += horas
            r['dia_falta_njust'] = True
        elif cat in _CAT_FOLGA:
            r['dia_folga'] = True
    return r


def _detectar_erros(inicio: date, fim: date, grupos: dict, contrato) -> dict:
    """
    Varre o período e marca dias sem nenhum registro como pendentes.
    Retorna dict {str(data): motivo} para o campo erros do consolidado.
    """
    erros = {}
    contrato_inicio = contrato.inicio
    contrato_fim    = contrato.fim or date.max
    cur = inicio
    
    while cur <= fim:
        if contrato_inicio <= cur <= contrato_fim:
            if cur not in grupos:
                erros[str(cur)] = 'Dia sem registro'
        cur += timedelta(days=1)
    return erros


def consolidar(contrato, inicio: date, fim: date, incluir_intervalo: bool = False) -> FrequenciaConsolidada:
    """
    Ponto de entrada principal do engine.
    Processa o período [inicio, fim] para o contrato e persiste FrequenciaConsolidada.
    Retorna a instância salva.
    """
    print(f"[ENGINE] contrato={contrato.id} periodo={inicio} a {fim}")  # debug
    tz = timezone.get_current_timezone()

    # 1. Busca registros do período — inclui dia_inteiro via campo data
    from django.db.models import Q
    frequencias = (
        Frequencia.objects
        .filter(contrato=contrato)
        .filter(
            Q(inicio__date__range=(inicio, fim)) |
            Q(data__range=(inicio, fim))
        )
        .select_related('evento')
        .order_by('inicio')
    )

    # 2. Agrupa por dia e calcula carga diária base
    grupos    = _agrupar_por_dia(frequencias, tz)
    carga_dia = _carga_dia(contrato)

    # 3. Acumuladores totais
    totais = {
        'H_horas_trabalhadas': 0.0, 'H_horas_extras': 0.0,
        'H_intervalos': 0.0, 'H_faltas_justificadas': 0.0,
        'H_faltas_injustificadas': 0.0, 'H_atestados': 0.0,
        'H_dias_trabalhados': 0, 'H_dias_falta_just': 0,
        'H_dias_falta_njust': 0, 'H_dias_folga': 0, 'H_dias_afastamento': 0,
    }

    # 4. Processa cada dia que tem registro
    for dia, registros in grupos.items():
        if not (inicio <= dia <= fim):
            continue  # ignora registros fora do range solicitado
        d = _calcular_dia(registros, carga_dia, incluir_intervalo)
        totais['H_horas_trabalhadas']    += d['h_trabalhadas']
        totais['H_horas_extras']         += d['h_extras']
        totais['H_intervalos']           += d['h_intervalo']
        totais['H_faltas_justificadas']  += d['h_aj']
        totais['H_faltas_injustificadas']+= d['h_anj']
        totais['H_atestados']            += d['h_atestado']
        if d['dia_trabalhado']:  totais['H_dias_trabalhados'] += 1
        if d['dia_falta_just']:  totais['H_dias_falta_just']  += 1
        if d['dia_falta_njust']: totais['H_dias_falta_njust'] += 1
        if d['dia_folga']:       totais['H_dias_folga']        += 1
        if d['dia_afastamento']: totais['H_dias_afastamento']  += 1

    # 5. Arredonda horas para 4 casas (evita float noise)
    for k in totais:
        if isinstance(totais[k], float):
            totais[k] = round(totais[k], 4)

    # 6. Detecta dias pendentes e define status/bloqueado
    erros  = _detectar_erros(inicio, fim, grupos, contrato)
    status = FrequenciaConsolidada.Status.ABERTO if erros else FrequenciaConsolidada.Status.FECHADO

    # 7. Persiste — idempotente via update_or_create na competência
    inicio_dt = datetime.combine(inicio, datetime.min.time())
    fim_dt    = datetime.combine(fim,    datetime.max.time().replace(microsecond=0))
    inicio_tz = timezone.make_aware(inicio_dt, tz)
    fim_tz    = timezone.make_aware(fim_dt,    tz)

    obj, _ = FrequenciaConsolidada.objects.update_or_create(
        contrato=contrato,
        competencia=inicio.replace(day=1),  # competência = sempre dia 1 do mês
        defaults={
            'inicio':        inicio_tz,
            'fim':           fim_tz,
            'consolidado':   totais,
            'erros':         erros,
            'bloqueado':     bool(erros),
            'status':        status,
            'processamento': timezone.now(),
        }
    )
    return obj
