import ast, math
from graphlib import TopologicalSorter, CycleError
from asteval import Interpreter


def get_whitelist():
    return {
        'sqrt': math.sqrt, 'sin': math.sin, 'cos': math.cos,
        'round': round, 'min': min, 'max': max, 'abs': abs,
        'True': True, 'False': False,
    }

def get_interpreter():
    return Interpreter(
        minimal=True,
        user_symbols=get_whitelist(),
        use_numpy=False,
        with_if=True,
        with_ifexp=True,
        builtins_readonly=True,
    )


def extract_deps(formula):
# usa ast.parse para ler a string da formula e retornar uma lista das variaveis de usuario (U_*)
    try:
        tree = ast.parse(str(formula))
        return {node.id for node in ast.walk(tree) if isinstance(node, ast.Name) and node.id.startswith('U_')}
    except: return set()


def dependence_resolve(rules):
# cria um grafo de dependencias e retorna a ordem logica de calculo,
# ex: se U_inss depende de U_salario, U_salario vem primeiro
# TopologicalSorter: py 3.9+ trata eventuais referencias circulares e gera excessao
    grafo = {rastreio: extract_deps(mov.valor) for rastreio, mov in rules.items()}
    try:
        return list(TopologicalSorter(grafo).static_order())
    except Exception as e:
        raise ValueError(f"Ciclo de dependência detectado: {e}")


def engine_run(aeval, context, order_calc, rules_dict, dias_comp: int):
    """
    Executa o motor de cálculo iterando na ordem topológica de dependências.
    rules_dict: {rastreio: [{'evento': obj, 'inicio': date, 'fim': date}]}
      — formato produzido por merge_events().
    Segmento único (caminho quente):
      calcula diretamente, sem proporcionalidade — equivalente ao motor anterior.
    Múltiplos segmentos:
      calcula cada fórmula proporcional aos dias de vigência no mês e soma.
      ex: fórmula A por 14 dias + fórmula B por 16 dias em um mês de 30 dias
          → valor_A * (14/30) + valor_B * (16/30)
    Em caso de erro em qualquer segmento:
      registra o erro em erros[rastreio], atribui 0 ao rastreio e segue o cálculo
      — garante que dependências do rastreio com erro não quebrem o lote inteiro.
    """
    def _fmt_erro(err) -> str:
        tipo = getattr(err, 'exc_name', 'Error')
        msg  = getattr(err, 'msg',      'Erro desconhecido')
        return f"{tipo}: {msg}"
    aeval.symtable.clear()
    aeval.symtable.update(get_whitelist())
    aeval.symtable.update(context)
    aeval.error = []  # limpa erros residuais de execuções anteriores
    erros = {}
    for rastreio in order_calc:
        if rastreio not in rules_dict:
            continue
        segmentos = rules_dict[rastreio]
        if len(segmentos) == 1:
            # ── caminho quente: segmento único, sem proporcionalidade ──────────
            res = aeval(segmentos[0]['evento'].valor)
            if aeval.error:
                erros[rastreio] = _fmt_erro(aeval.error[0])
                aeval.symtable[rastreio] = 0  # neutro para não quebrar dependências
                aeval.error = []
            else:
                aeval.symtable[rastreio] = res
        else:
            # ── múltiplos segmentos: proporcional por dias de vigência ─────────
            total     = 0
            erros_seg = []
            for seg in segmentos:
                dias_seg  = (seg['fim'] - seg['inicio']).days + 1
                proporcao = dias_seg / dias_comp  # fração do mês coberta por este segmento
                res = aeval(seg['evento'].valor)
                if aeval.error:
                    erros_seg.append(
                        f"{seg['inicio']}–{seg['fim']}: {_fmt_erro(aeval.error[0])}"
                    )
                    aeval.error = []
                    # segmento com erro contribui 0 — os demais segmentos seguem
                else:
                    total += (res or 0) * proporcao
            if erros_seg:
                erros[rastreio] = ' | '.join(erros_seg)
            aeval.symtable[rastreio] = total
    return dict(aeval.symtable), erros


# def engine_run(aeval, context, order_calc, rules_dict):
# # recebe um dicionario {event: formula} e uma lista dos eventos ordenados por precedencia
# # ele itera, calcula e insere o resultado no proprio context para o proximo calculo
#     aeval.symtable.clear()
#     aeval.symtable.update(get_whitelist())
#     aeval.symtable.update(context)
#     aeval.error = [] # limpa erros para evitar vazamento inesperado
#     erros = {}
#     for rastreio in order_calc:
#         if rastreio in rules_dict:
#             res = aeval(rules_dict[rastreio].valor)
#             if len(aeval.error) > 0:
#                 err = aeval.error[0]
#                 tipo_erro = getattr(err, 'exc_name', 'Error')
#                 msg_erro = getattr(err, 'msg', 'Erro desconhecido')
#                 erros[rastreio] = f"{tipo_erro}: {msg_erro}"
#                 aeval.symtable[rastreio] = 0 # garante que o calculo siga sem quebrar
#                 aeval.error = [] # limpa os erros do interpretador para a proxima iteracao
#             else:
#                 aeval.symtable[rastreio] = res            
#     return dict(aeval.symtable), erros