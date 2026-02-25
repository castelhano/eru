import calendar
from datetime import date
from django.db.models import Q, Sum, Count
from pessoal.models import (Funcionario, Contrato, Evento, FolhaPagamento, FrequenciaConsolidada, EventoEmpresa, EventoCargo, EventoFuncionario)


def get_period(mes, ano):
    inicio = date(ano, mes, 1)
    ultimo_dia = calendar.monthrange(ano, mes)[1]
    return inicio, date(ano, mes, ultimo_dia)


def get_event_vars_master(asDict=False, **kwargs):
# Retorna lista com todas as variaveis utilizadas para composicao de formula em eventos
# busca tanto eventos criados pelo usuario quanto @property definidas nos modelos alvo
# 1. get_event_vars_master() -> Lista de strings para Autocomplete
# 2. get_event_vars_master(asDict=True) -> Dicionário {nome: 1} para validacao do asteval
# 3. get_event_vars_master(funcionario=f, contrato=c, freq=h) -> Retorna dict {nome: valor} para calculo do engine
# Atencao!! Adicionar modelos no targets disponibiliza automaticamente as @property no autocomplete, porem eh necessario
# no services.py / run_single adiciona a referencia para este modelo
    is_calc = any(not isinstance(v, type) for v in kwargs.values() if v)
    targets = [
        kwargs.get('funcionario', Funcionario),
        kwargs.get('contrato', Contrato),
        kwargs.get('consolidado', FrequenciaConsolidada),
    ]
    res = {} if (asDict or is_calc) else []
    for obj in targets:
        cls = obj if isinstance(obj, type) else obj.__class__
        props = [n for n, v in cls.__dict__.items() if isinstance(v, property)]
        if isinstance(res, list): res.extend(props)
        else: res.update({p: getattr(obj, p) if is_calc else 1 for p in props})
    freq = kwargs.get('consolidado')
    if freq:
        # se for calculo, pega o dicionario salvo (JSON) na frequecia 'consolidado'
        data_h = freq.consolidado if (is_calc and not isinstance(freq, type)) else {}        
        if isinstance(res, list):
            res.extend(data_h.keys())
        else:
            res.update({k: v if is_calc else 1 for k, v in data_h.items()})
    customs = list(Evento.objects.exclude(rastreio='').values_list('rastreio', flat=True).distinct())
    if isinstance(res, list):
        res.extend(customs)
    else:
        res.update({c: 0 if is_calc else 1 for c in customs})
    return res


def get_batch_data(filial_id, inicio, fim):
# busca otimziada no banco todos os eventos / registros que serao consumidos para
# calculo da folha
    # Filtro base de vigência
    vigencia = Q(inicio__lte=fim) & (Q(fim__gte=inicio) | Q(fim__isnull=True))
    # 1) contratos e frequencias vigentes para filial
    contratos = Contrato.objects.filter(funcionario__filial_id=filial_id).filter(vigencia).select_related('funcionario', 'cargo')
    frequencias = {f.contrato_id: f for f in FrequenciaConsolidada.objects.filter(contrato__in=contratos, competencia=inicio)}
    # 2) eventos (lookups por ID de Cargo ou Funcionário)
    ev_e = list(EventoEmpresa.objects.filter(filiais=filial_id).filter(vigencia).select_related('evento'))
    ev_c = {}
    for e in EventoCargo.objects.filter(filiais=filial_id).filter(vigencia).select_related('evento', 'cargo'):
        ev_c.setdefault(e.cargo_id, []).append(e)
    ev_f = {}
    for e in EventoFuncionario.objects.filter(funcionario__filial_id=filial_id).filter(vigencia).select_related('evento'):
        ev_f.setdefault(e.funcionario_id, []).append(e)
    return contratos, ev_e, ev_c, ev_f, frequencias


def get_filial_summary(filial_id, competence):
# retorna queryset do resumo da folha consolidada de uma filial / competencia
    return FolhaPagamento.objects.filter(
        contrato__funcionario__filial_id=filial_id,
        competencia=competence
    ).aggregate(
        total_bruto=Sum('proventos'),
        total_liq=Sum('liquido'),
        qtd_total=Count('id'),
        qtd_erros=Count('id', filter=Q(total_erros__gt=0))
    )
