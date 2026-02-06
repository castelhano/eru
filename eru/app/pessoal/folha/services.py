

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


def merge_events(ev_e, ev_c, ev_f):
# compila eventos dando precedencia para Funcionario > Cargo > Empresa
    regras = {e.evento.rastreio: e for e in ev_e}
    regras.update({e.evento.rastreio: e for e in (ev_c_list or [])})
    regras.update({e.evento.rastreio: e for e in (ev_f_list or [])})
    return regras    


def run_single(contrato, competencia, ev_e, ev_c_list, ev_f_list, freq):
# processa folha de um funcionario
# >> Chama o coletor para pegar dados e regras
# >> Chama a engine para resolver o grafo
# >> Chama a engine para calcular
    regras = merge_events(ev_e, ev_c_list, ev_f_list)
    vars_dict = {**get_props_dict(contrato.funcionario), **get_props_dict(freq)} # eventos do funcionario
    ordem = dependence_resolve(regras) # engine do grafo, ajustado precedencia
    resultado, erros = engine_run(vars_dict, ordem, regras)
    memoria = payroll_memory(resultado, regras, erros)
    return db_save(contrato, competencia, resultado, memoria, erros)

def run_batch(filial, competencia):
# 1) busca todos os contratos ativos da filial
# 2) busca todos os EventoEmpresa, EventoCargo, EventoFuncionario para a filial 
# 3) entra no loop disparando run_single
    pass