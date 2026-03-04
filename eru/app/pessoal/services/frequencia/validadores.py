from collections import defaultdict
from datetime import datetime
from django.core.exceptions import ValidationError
from pessoal.models import Frequencia, Afastamento
from django.db.models import Q


class FrequenciaValidador:
    """
    Validações de negócio para lançamentos de frequência.

    Responsabilidades:
      - validar_lote:                    formato e overlaps dentro do payload enviado pelo front
      - validar_overlap_com_existentes:  sobreposição com registros já persistidos no banco
      - validar_afastamento:             impede lançamento de categorias não-ausência em dia afastado

    Nota: o clean() do model Frequencia NÃO é chamado automaticamente pelo ORM nos saves
    realizados via service (create/save diretos). Toda a lógica de negócio deve passar por aqui.
    """

    def __init__(self, contrato):
        self.contrato = contrato

    # ─── Validação de lote (payload do front) ────────────────────────────────

    def validar_lote(self, frequencias_data):
        """
        Valida todos os itens do payload antes de qualquer persistência.
        Falha rápido: levanta ValidationError no primeiro problema encontrado.
        """
        for item in frequencias_data:
            self._validar_horarios(item)
        self._validar_overlaps_lote(frequencias_data)

    def _validar_horarios(self, item):
        """Garante que entrada e saída são consistentes para eventos com horário."""
        entrada = item.get('entrada', '')
        saida   = item.get('saida', '')
        if not entrada or not saida:
            return  # eventos dia_inteiro chegam sem horário — ok
        # virada de dia é válida (saida < entrada porque cruza meia-noite)
        if not item.get('virada') and saida <= entrada:
            raise ValidationError(
                f"Horário de saída deve ser maior que entrada no dia {item['dia']}"
            )

    def _validar_overlaps_lote(self, frequencias_data):
        """
        Verifica sobreposição entre itens do mesmo dia dentro do payload.
        Eventos dia_inteiro são ignorados aqui — o service resolve via prioridade.
        """
        por_dia = defaultdict(list)
        for item in frequencias_data:
            if item.get('entrada') and item.get('saida'):
                por_dia[item['dia']].append(item)

        for dia, items in por_dia.items():
            for i, a in enumerate(items):
                for b in items[i + 1:]:
                    if self._horarios_conflitam(a, b):
                        raise ValidationError(
                            f"Registros sobrepostos no dia {dia[-2:]}"
                        )

    def _horarios_conflitam(self, item1, item2):
        """Retorna True se os dois intervalos se sobrepõem (normaliza virada de dia)."""
        def to_min(t):
            h, m = t.split(':')
            return int(h) * 60 + int(m)

        in1  = to_min(item1['entrada'])
        out1 = to_min(item1['saida'])  + (1440 if item1.get('virada') else 0)
        in2  = to_min(item2['entrada'])
        out2 = to_min(item2['saida'])  + (1440 if item2.get('virada') else 0)
        return in1 < out2 and out1 > in2

    # ─── Validação contra banco ───────────────────────────────────────────────

    def validar_overlap_com_existentes(self, entrada_dt, saida_dt, dia_str, excluir_id=None):
        """
        Verifica sobreposição do intervalo [entrada_dt, saida_dt] com registros
        já persistidos no banco para este contrato.
        excluir_id: ID do próprio registro em caso de edição (evita auto-conflito).
        """
        query = Frequencia.objects.filter(
            contrato=self.contrato,
            inicio__lt=saida_dt,
            fim__gt=entrada_dt,
        )
        if excluir_id:
            query = query.exclude(id=excluir_id)
        if query.exists():
            raise ValidationError(
                f"Registro sobrepõe outras entradas existentes. <br>Dia: {dia_str[-2:]}"
            )

    def validar_afastamento(self, dia_date, evento):
        """
        Impede lançamento de eventos que não sejam ausência justificada em dias
        cobertos por afastamento ativo.

        Chamado pelo FrequenciaPersistenciaService antes de persistir cada item,
        já APÓS _aplicar_afastamentos() ter feito a substituição de evento.
        Portanto, em condições normais (cfg configurado), o evento já chegará
        como AUSENCIA_JUST e esta validação passa sem erro.

        Lança ValidationError se:
          - há afastamento ativo no dia E
          - o evento não é de categoria AUSENCIA_JUST
        """
        from pessoal.models import EventoFrequencia  # evita import circular
        if evento.categoria == EventoFrequencia.Categoria.AUSENCIA_JUST:
            return  # evento de afastamento/atestado — permitido

        afastado = Afastamento.objects.filter(
            funcionario=self.contrato.funcionario,
            data_afastamento__lte=dia_date,
        ).filter(
            Q(data_retorno__isnull=True) | Q(data_retorno__gte=dia_date)
        ).exists()

        if afastado:
            raise ValidationError(
                f"Funcionário está afastado em {dia_date} — "
                f"apenas eventos de ausência justificada são permitidos nesta data."
            )