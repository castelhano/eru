import json
from decimal import Decimal
from pessoal.models import FolhaPagamento



def payroll_memory(result, original_rules, errors):
# monta json com resultado e variaveis utilizadas nos calculos, retorna tambem os erros/alertas gerados
    eventos_calculados = []   
    for rastreio, regra in original_rules.items():
        valor_final = result.get(rastreio, 0)
        eventos_calculados.append({
            "rastreio": rastreio,
            "nome": regra.evento.nome,
            "tipo": regra.evento.tipo,
            "valor": float(valor_final) if isinstance(valor_final, (Decimal, float)) else valor_final,
            "formula": regra.valor,
            "origem": regra.__class__.__name__,
            "origem_id": regra.id,
            "erro": errors.get(rastreio) # salva o erro especifico se houver
        })
    return {
        "eventos": eventos_calculados,
        "contexto_entrada": {k: v for k, v in result.items() if not k.startswith('U_')}
    }


# def db_save(contract, competence, json_memo, errors):
#     proventos = sum(e['valor'] for e in json_memo['eventos'] if e['tipo'] == 'P')
#     descontos = sum(e['valor'] for e in json_memo['eventos'] if e['tipo'] == 'D')
#     liquido = proventos - descontos
#     with transaction.atomic():
#         obj, created = FolhaPagamento.objects.update_or_create(
#             contrato=contract,
#             competencia=competence,
#             defaults={
#                 'proventos': proventos,
#                 'descontos': descontos,
#                 'liquido': liquido,
#                 'regras': json_memo,
#                 'erros': erros if erros else None,
#                 'total_erros': len(erros) if erros else 0,
#                 'status': 'rascunho'
#             }
#         )
#     return obj

def db_save(contract, competence, json_memo, errors):
# salva no banco entrada para folha vinculada ao contract e mes de referencia
    proventos = sum(e['valor'] for e in json_memo['eventos'] if e['tipo'] == 'P')
    descontos = sum(e['valor'] for e in json_memo['eventos'] if e['tipo'] == 'D')
    # update_or_create garante idempotencia (pode rodar varias vezes sem duplicar)
    obj, _ = FolhaPagamento.objects.update_or_create(
        contrato=contract,
        competencia=competence,
        defaults={
            'proventos': proventos,
            'descontos': descontos,
            'liquido': proventos - descontos,
            'regras': json_memo,
            'erros': errors or None,
            'total_erros': len(errors) if errors else 0,
            'status': 'R'
        }
    )
    return obj