import calendar
from decimal import Decimal
from datetime import date
from django.db.models import Q, Sum, Count
from pessoal.models import (
    Funcionario, Contrato, Evento, FolhaPagamento,
    FrequenciaConsolidada, EventoEmpresa, EventoCargo, EventoFuncionario,
)

# Tipos que podem ser usados em fórmulas e serializados para JSON sem conversão
_TIPOS_PRIMITIVOS = (int, float, str, bool, type(None))

# Nomes da whitelist injetados no symtable do asteval — nunca devem entrar no contexto
_WHITELIST_NOMES  = frozenset({'sqrt', 'sin', 'cos', 'round', 'min', 'max', 'abs', 'True', 'False'})


def _coerce(val):
    """
    Converte o valor de uma @property para tipo utilizável em fórmula.
    Decimal → float. Tipos não primitivos (Cargo, Contrato, date…) → None (descartado).
    """
    if isinstance(val, _TIPOS_PRIMITIVOS):
        return val
    if isinstance(val, Decimal):
        return float(val)
    return None  # objetos Django, date, timedelta, etc. — não são usáveis em fórmulas


def get_period(mes, ano):
    inicio = date(ano, mes, 1)
    return inicio, date(ano, mes, calendar.monthrange(ano, mes)[1])


def get_event_vars_master(asDict=False, **kwargs):
    # Retorna variáveis disponíveis para composição de fórmulas em eventos.
    # 1. get_event_vars_master()                          → lista de strings para autocomplete
    # 2. get_event_vars_master(asDict=True)               → dict {nome: 1} para validação do asteval
    # 3. get_event_vars_master(funcionario=f, contrato=c) → dict {nome: valor} para cálculo
    #
    # Atenção: adicionar modelos em `targets` expõe suas @property automaticamente.
    # Para o modo cálculo (3), lembre de passar a instância em run_single (services.py).
    is_calc = any(not isinstance(v, type) for v in kwargs.values() if v)
    targets = [
        kwargs.get('funcionario', Funcionario),
        kwargs.get('contrato',    Contrato),
        kwargs.get('consolidado', FrequenciaConsolidada),
    ]
    res = {} if (asDict or is_calc) else []

    for obj in targets:
        cls   = obj if isinstance(obj, type) else obj.__class__
        props = [n for n in dir(cls) if isinstance(getattr(cls, n, None), property)]  # respeita MRO
        if isinstance(res, list):
            res.extend(props)
        elif is_calc:
            for p in props:
                val = _coerce(getattr(obj, p))
                if val is not None:              # descarta tipos não utilizáveis em fórmulas
                    res[p] = val
        else:
            res.update({p: 1 for p in props})

    # Valores consolidados de frequência — já são primitivos (int/float) vindos do JSONField
    freq = kwargs.get('consolidado')
    if freq and not isinstance(freq, type):
        data_h = freq.consolidado if is_calc else {}
        if isinstance(res, list):
            res.extend(data_h.keys())
        else:
            res.update({k: v if is_calc else 1 for k, v in data_h.items()})

    # Rastreios de eventos cadastrados pelo usuário (U_*) — valor 0 como neutro no cálculo
    customs = list(Evento.objects.exclude(rastreio='').values_list('rastreio', flat=True).distinct())
    if isinstance(res, list):
        res.extend(customs)
    else:
        res.update({c: 0 if is_calc else 1 for c in customs})

    return res


def get_batch_data(filial_id, inicio, fim):
    # Busca otimizada — um hit por tipo de dado, tudo que o cálculo da folha precisa.
    vigencia  = Q(inicio__lte=fim) & (Q(fim__gte=inicio) | Q(fim__isnull=True))  # filtro reutilizado nos três tipos de evento
    contratos = (
        Contrato.objects
        .filter(funcionario__filial_id=filial_id)
        .filter(vigencia)
        .select_related('funcionario', 'cargo')  # evita N+1 no loop de run_single
    )
    # FrequenciaConsolidada indexada por contrato_id para lookup O(1) em run_single
    frequencias = {
        f.contrato_id: f
        for f in FrequenciaConsolidada.objects.filter(contrato__in=contratos, competencia=inicio)
    }
    # Eventos de empresa — lista plana (aplicados a todos os contratos da filial)
    ev_e = list(EventoEmpresa.objects.filter(filiais=filial_id).filter(vigencia).select_related('evento'))
    # Eventos de cargo e funcionário — indexados por FK para lookup O(1) em run_single
    ev_c = {}
    for e in EventoCargo.objects.filter(filiais=filial_id).filter(vigencia).select_related('evento', 'cargo'):
        ev_c.setdefault(e.cargo_id, []).append(e)
    ev_f = {}
    for e in EventoFuncionario.objects.filter(funcionario__filial_id=filial_id).filter(vigencia).select_related('evento'):
        ev_f.setdefault(e.funcionario_id, []).append(e)
    return contratos, ev_e, ev_c, ev_f, frequencias


def get_filial_summary(filial_id, competence):
    # Resumo agregado da folha de uma filial/competência — consumido pelo dashboard.
    return FolhaPagamento.objects.filter(
        contrato__funcionario__filial_id=filial_id,
        competencia=competence,
    ).aggregate(
        total_bruto=Sum('proventos'),
        total_liq=Sum('liquido'),
        qtd_total=Count('id'),
        qtd_erros=Count('id', filter=Q(total_erros__gt=0)),
    )