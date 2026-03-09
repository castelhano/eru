import calendar
from datetime import timedelta, date
from django.db import transaction
from .collectors import get_period, get_batch_data, get_event_vars_master
from .engine import get_interpreter, dependence_resolve, engine_run
from .persistence import payroll_memory, db_save
from pessoal.models import FolhaPagamento


# def merge_events(ev_e, ev_c_list, ev_f_list):
# # compila eventos dando precedencia para Funcionario > Cargo > Empresa
#     regras = {e.evento.rastreio: e for e in (ev_e or [])}
#     regras.update({e.evento.rastreio: e for e in (ev_c_list or [])})
#     regras.update({e.evento.rastreio: e for e in (ev_f_list or [])})
#     return regras    

def merge_events(ev_e, ev_c_list, ev_f_list, inicio_comp: date, fim_comp: date):
    """
    Monta {rastreio: [{'evento': obj, 'inicio': date, 'fim': date}]} para o período da competência.
    Precedência por dia: EventoFuncionario > EventoCargo > EventoEmpresa.
    Dias sem cobertura do escopo superior fazem fallback automático para o inferior.
    Exemplos tratados:
      - EventoEmpresa (01–30) + EventoFuncionario (15–30):
          01–14 → empresa, 15–30 → funcionario
      - EventoFuncionario (01–15) com fórmula A + EventoFuncionario (16–30) com fórmula B:
          01–15 → fórmula A, 16–30 → fórmula B (proporcional)
      - Apenas EventoEmpresa (01–30):
          segmento único → caminho quente, sem proporcionalidade
    """  
    def _indexar(eventos):
        # agrupa lista de eventos por rastreio para lookup O(1) no loop diário
        idx = {}
        for e in (eventos or []):
            idx.setdefault(e.evento.rastreio, []).append(e)
        return idx
    def _vigente_em(eventos, data: date):
        # retorna o primeiro evento cuja vigência cobre 'data', ou None
        return next(
            (e for e in eventos
             if e.inicio <= data and (e.fim is None or e.fim >= data)),
            None
        )
    def _fim_segmento(cur: date, idx_f, idx_c, idx_e, evento_atual) -> date:
        # avança dia a dia até encontrar mudança de evento vencedor
        # retorna o último dia em que evento_atual ainda vence
        dia = cur
        while dia < fim_comp:
            prox = dia + timedelta(days=1)
            if (_vigente_em(idx_f, prox) or
                _vigente_em(idx_c, prox) or
                _vigente_em(idx_e, prox)) != evento_atual:
                break
            dia = prox
        return dia
    idx_e = _indexar(ev_e)
    idx_c = _indexar(ev_c_list)
    idx_f = _indexar(ev_f_list)
    resultado = {}
    for rastreio in set(idx_e) | set(idx_c) | set(idx_f):
        segmentos = []
        cur = inicio_comp
        while cur <= fim_comp:
            # elege o evento de maior precedência vigente em 'cur'
            evento_vigente = (
                _vigente_em(idx_f.get(rastreio, []), cur) or
                _vigente_em(idx_c.get(rastreio, []), cur) or
                _vigente_em(idx_e.get(rastreio, []), cur)
            )
            if not evento_vigente:
                # nenhum escopo cobre este dia — avança sem segmento
                cur += timedelta(days=1)
                continue
            fim_seg = _fim_segmento(cur, idx_f.get(rastreio, []),
                                        idx_c.get(rastreio, []),
                                        idx_e.get(rastreio, []),
                                        evento_vigente)
            segmentos.append({'evento': evento_vigente, 'inicio': cur, 'fim': fim_seg})
            cur = fim_seg + timedelta(days=1)
        if segmentos:
            resultado[rastreio] = segmentos
    return resultado



def run_single(contrato, competencia, ev_e, ev_c_list, ev_f_list, freq, aeval):
# processa folha de um funcionario
# >> Chama o coletor para pegar dados e regras
# >> Chama a engine para resolver o grafo
# >> Chama a engine para calcular
    if freq is None: # se nao localizado frequencia no periodo interrompe execucao e retorna erro
        return db_save(contrato, competencia, 
                      {'eventos': [], 'contexto_entrada': {}}, 
                      {'frequencia': 'Frequência não consolidada para esta competência'})    
    _, dias_comp = calendar.monthrange(competencia.year, competencia.month)
    fim_comp = competencia.replace(day=dias_comp)
    vars_dict = get_event_vars_master(
        funcionario=contrato.funcionario, 
        contrato=contrato,
        consolidado=freq
    )
    # 2. Define as regras de variaveis de usuario (U_*) e a ordem de calculo
    regras = merge_events(ev_e, ev_c_list, ev_f_list, competencia, fim_comp)
    
    # dependence_resolve usa um evento representativo por rastreio (primeiro segmento)
    regras_repr = {rastreio: segs[0]['evento'] for rastreio, segs in regras.items()}
    ordem       = dependence_resolve(regras_repr)
    # 3. Executa o motor de calculo
    resultado_vars, erros = engine_run(aeval, vars_dict, ordem, regras, dias_comp)
    # 4. Formata a memoria e persiste no banco
    memoria = payroll_memory(resultado_vars, regras_repr, erros)
    return db_save(contrato, competencia, memoria, erros)



def payroll_run(filial_id, mes, ano, matricula_de=None, matricula_ate=None):
    ini, fim = get_period(mes, ano)
    contratos, ev_e, ev_c, ev_f, freqs = get_batch_data(
        filial_id, ini, fim,
        matricula_de=matricula_de,
        matricula_ate=matricula_ate,
    )
    # impede sobregravar folhas ja pagas
    pagas = set(
        FolhaPagamento.objects.filter(
            contrato__in=contratos,
            competencia=ini,
            status=FolhaPagamento.Status.PAGO,
        ).values_list('contrato_id', flat=True)
    )
    aeval = get_interpreter()
    sucessos, falhas = 0, []
    with transaction.atomic():
        for c in contratos:
            if c.id in pagas:
                falhas.append({'matricula': c.funcionario.matricula, 'erro': 'Folha já paga'})
                continue
            ev_c_list = ev_c.get(c.cargo_id, [])
            ev_f_list = ev_f.get(c.funcionario_id, [])
            freq_obj  = freqs.get(c.id)
            try:
                with transaction.atomic():  # savepoint por contrato
                    run_single(c, ini, ev_e, ev_c_list, ev_f_list, freq_obj, aeval)
                sucessos += 1
            except Exception as e:
                falhas.append({'matricula': c.funcionario.matricula, 'erro': str(e)})
    return {'processados': sucessos, 'falhas': falhas}