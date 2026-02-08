from .collectors import get_period, get_batch_data, get_event_vars_master
from .engine import get_interpreter, dependence_resolve, engine_run
from .persistence import payroll_memory, db_save


class FrequenciaFake:
    @property
    def H_faltas(self): return 2
    @property
    def H_extras(self): return 5.0


def merge_events(ev_e, ev_c, ev_f):
# compila eventos dando precedencia para Funcionario > Cargo > Empresa
    regras = {e.evento.rastreio: e for e in ev_e}
    regras.update({e.evento.rastreio: e for e in (ev_c_list or [])})
    regras.update({e.evento.rastreio: e for e in (ev_f_list or [])})
    return regras    


def run_single(contrato, competencia, ev_e, ev_c_list, ev_f_list, freq, aeval):
# processa folha de um funcionario
# >> Chama o coletor para pegar dados e regras
# >> Chama a engine para resolver o grafo
# >> Chama a engine para calcular
    
    vars_dict = get_event_vars_master(
        funcionario=contrato.funcionario, 
        contrato=contrato,
        freq=FrequenciaFake()
    )
    # 2. Define as regras de variaveis de usuario (U_*) e a ordem de calculo
    regras = merge_events(contrato, ev_e, ev_c_list, ev_f_list)
    ordem = dependence_resolve(regras)    
    # 3. Executa o motor de calculo
    resultado_vars, erros = engine_run(aeval, vars_dict, ordem, regras)
    # 4. Formata a memoria e persiste no banco
    memoria = payroll_memory(resultado_vars, regras, erros)
    return db_save(contrato, competencia, memoria, erros)


def payroll_run(filial_id, mes, ano):
# metodo principal, consome todos as demais metodos para processar a folha
    ini, fim = get_period(mes, ano) # datas de início/fim
    contratos, ev_e, ev_c, ev_f, freqs = get_batch_data(filial_id, ini, fim)
    aeval = get_interpreter()
    for c in contratos:
        run_single(c, inicio, ev_e, ev_c.get(c.cargo_id), ev_f.get(c.funcionario_id), freqs.get(c.id), aeval)