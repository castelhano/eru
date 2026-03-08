"""
persistence.py — Efeitos colaterais do processo de desligamento.

Chamado APENAS quando dry_run=False. Tudo aqui tem side effects:
  - Atualiza Rescisao com resultado do engine
  - Cancela/deleta Frequencias órfãs pós-desligamento
  - Chama sync_status para transicionar para DESLIGADO
"""
from django.db import transaction
from django.utils import timezone
from pessoal.models import Frequencia, Rescisao


@transaction.atomic
def salvar_resultado(rescisao: Rescisao, resultado: dict) -> None:
    """
    Persiste o resultado do engine na instância de Rescisao e transiciona o status.
    Chamado pelo services.py após calcular_rescisao() em modo real.
    """
    # Decimal garante que o DecimalField(decimal_places=2) não rejeite por ruído de float
    from decimal import Decimal
    rescisao.total_bruto   = Decimal(str(resultado['total_bruto']))
    rescisao.total_liquido = Decimal(str(resultado['total_liquido']))
    rescisao.regras        = resultado   # dict completo: contexto + verbas + freq_base + erros
    rescisao.save(update_fields=['total_bruto', 'total_liquido', 'regras'])

    # sync_status NÃO é chamado aqui — o services.py chama após garantir job CONCLUIDO no banco.


@transaction.atomic
def cancelar_frequencias_orfas(contrato, data_desligamento) -> dict:
    """
    Trata registros de Frequencia após a data de desligamento.

    Regra:
      - sem metadados (lançamento manual/sistema) → deleta
      - com metadados (origem externa: AFD, APP, CSV) → marca cancelado=True

    Retorna dict com contagens para o resultado do job.
    """
    qs_orfas = Frequencia.objects.filter(
        contrato=contrato,
        inicio__date__gt=data_desligamento,  # registros com horário após desligamento
        cancelado=False,
    )

    # separa em duas listas — uma query só, sem N+1
    ids_deletar  = []
    ids_cancelar = []
    for freq in qs_orfas.only('id', 'metadados'):
        if freq.metadados and freq.metadados.get('fonte'):
            ids_cancelar.append(freq.id)
        else:
            ids_deletar.append(freq.id)

    deleted = 0
    if ids_deletar:
        deleted, _ = Frequencia.objects.filter(id__in=ids_deletar).delete()

    cancelled = 0
    if ids_cancelar:
        cancelled = Frequencia.objects.filter(id__in=ids_cancelar).update(
            cancelado=True,
            observacao='Cancelado automaticamente — data após desligamento.',
        )

    return {'freq_deletadas': deleted, 'freq_canceladas': cancelled}