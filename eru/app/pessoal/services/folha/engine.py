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
    return Interpreter(minimal=True, user_symbols=get_whitelist(), builtins_readonly=True)


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


def engine_run(aeval, context, order_calc, rules_dict):
# recebe um dicionario {event: formula} e uma lista dos eventos ordenados por precedencia
# ele itera, calcula e insere o resultado no proprio context para o proximo calculo
    aeval.symtable.clear()
    aeval.symtable.update(get_whitelist())
    aeval.symtable.update(context)
    erros = {}
    for rastreio in order_calc:
        if rastreio in rules_dict:
            res = aeval(rules_dict[rastreio].valor)
            if len(aeval.error) > 0:
                err = aeval.error[0]
                tipo_erro = getattr(err, 'exc_name', 'Error')
                msg_erro = getattr(err, 'msg', 'Erro desconhecido')
                erros[rastreio] = f"{tipo_erro}: {msg_erro}"
                aeval.symtable[rastreio] = 0 # garante que o calculo siga sem quebrar
                aeval.error = [] # limpa os erros do interpretador para a proxima iteracao
            else:
                aeval.symtable[rastreio] = res            
    return dict(aeval.symtable), erros