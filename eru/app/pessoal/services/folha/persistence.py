from decimal import Decimal
from pessoal.models import FolhaPagamento

# Nomes da whitelist injetados pelo asteval — excluídos do contexto persistido
_WHITELIST_NOMES = frozenset({'sqrt', 'sin', 'cos', 'round', 'min', 'max', 'abs', 'True', 'False'})

# Tipos serializáveis pelo JSON do Django sem conversão
_TIPOS_PRIMITIVOS = (int, float, str, bool, type(None))


def payroll_memory(result, original_rules, errors):
    # Monta o JSON de memória da folha: eventos calculados + contexto de entrada.
    # O contexto de entrada registra apenas variáveis primitivas utilizadas nas fórmulas,
    # excluindo funções da whitelist do asteval e objetos não serializáveis.
    eventos_calculados = []
    for rastreio, regra in original_rules.items():
        valor_final = result.get(rastreio, 0)
        eventos_calculados.append({
            'rastreio':  rastreio,
            'nome':      regra.evento.nome,
            'tipo':      regra.evento.tipo,
            'valor':     float(valor_final) if isinstance(valor_final, (Decimal, float)) else valor_final,
            'formula':   regra.valor,
            'origem':    regra.__class__.__name__,
            'origem_id': regra.id,
            'erro':      errors.get(rastreio),  # None se sem erro
        })
    contexto = {
        k: v for k, v in result.items()
        if not k.startswith('U_')           # exclui eventos calculados pelo usuário
        and k not in _WHITELIST_NOMES       # exclui funções matemáticas do asteval
        and isinstance(v, _TIPOS_PRIMITIVOS) # exclui tipos não serializáveis
    }
    return {'eventos': eventos_calculados, 'contexto_entrada': contexto}


def db_save(contract, competence, json_memo, errors):
    # Persiste a folha — update_or_create garante idempotência (reprocessamento seguro).
    proventos = sum(e['valor'] for e in json_memo['eventos'] if e['tipo'] == 'P')
    descontos = sum(e['valor'] for e in json_memo['eventos'] if e['tipo'] == 'D')
    obj, _ = FolhaPagamento.objects.update_or_create(
        contrato=contract,
        competencia=competence,
        defaults={
            'proventos':   proventos,
            'descontos':   descontos,
            'liquido':     proventos - descontos,
            'regras':      json_memo,
            'erros':       errors or None,
            'total_erros': len(errors) if errors else 0,
            'status':      'R',
        }
    )
    return obj