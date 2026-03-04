from datetime import datetime, timedelta
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from auditlog.context import disable_auditlog
from pessoal.models import Afastamento, Frequencia, EventoFrequencia
from .validadores import FrequenciaValidador


class FrequenciaPersistenciaService:
    """
    Serviço responsável por persistir lançamentos de frequência vindos do front.

    Fluxo principal (sincronizar_mes):
      1. validar_lote        → formato e overlaps no payload
      2. _aplicar_afastamentos → substitui evento_id por evento de afastamento nos dias cobertos
      3. _resolver_prioridades → em caso de conflito dia_inteiro vs horário, mantém maior prioridade
      4. Persiste dentro de transaction.atomic()

    Nota sobre afastamentos:
      _aplicar_afastamentos substitui silenciosamente o evento antes de salvar.
      Se cfg não estiver configurado, o item chega ao banco com o evento original
      e validar_afastamento (no validador) levantará erro se a categoria não for AUSENCIA_JUST.
    """

    def __init__(self, contrato):
        self.contrato  = contrato
        self.validador = FrequenciaValidador(contrato)
        self.tz        = timezone.get_current_timezone()

    def sincronizar_mes(self, frequencias_data, deletar_ids=None, deletar_related_ids=None, afastamento_cfg=None):
        # guarda inclui deletar_related_ids — pode chegar sozinho (edição de dia_inteiro)
        if not frequencias_data and not deletar_ids and not deletar_related_ids:
            return 0

        if frequencias_data:
            self.validador.validar_lote(frequencias_data)
            # substitui evento_id nos dias cobertos por afastamento antes de persistir
            frequencias_data = self._aplicar_afastamentos(frequencias_data, afastamento_cfg)
            # resolve conflitos dia_inteiro vs horário pela prioridade do EventoFrequencia
            frequencias_data = self._resolver_prioridades(frequencias_data)

        with transaction.atomic():
            if deletar_ids:
                Frequencia.objects.filter(contrato=self.contrato, id__in=deletar_ids).delete()
            if deletar_related_ids:
                # edição para evento dia_inteiro: exclusões das entradas antigas não entram no auditlog
                with disable_auditlog():
                    Frequencia.objects.filter(contrato=self.contrato, id__in=deletar_related_ids).delete()
            for item in frequencias_data:
                self._salvar_item(item)

        return len(frequencias_data)

    # ─── Afastamentos ────────────────────────────────────────────────────────

    def _aplicar_afastamentos(self, frequencias_data, cfg):
        """
        Para cada item cuja data esteja coberta por afastamento:
          - cfg com evento mapeado: substitui evento_id pelo de afastamento
          - cfg sem mapeamento:     mantém item original (usuário assumiu a decisão)
        Garante que a carga de escala nunca sobreponha silenciosamente um afastamento.
        """
        if not cfg:
            return frequencias_data

        datas    = {item['dia'] for item in frequencias_data}
        data_min = min(datas)
        data_max = max(datas)

        afastamentos = list(
            Afastamento.objects.filter(
                funcionario=self.contrato.funcionario,
                data_afastamento__lte=data_max,
            ).filter(
                Q(data_retorno__isnull=True) | Q(data_retorno__gte=data_min)
            )
        )
        if not afastamentos:
            return frequencias_data

        mapa_motivo = {
            Afastamento.Motivo.DOENCA:            cfg.evento_doenca_id,
            Afastamento.Motivo.ACIDENTE_TRABALHO: cfg.evento_acidente_id,
            Afastamento.Motivo.OUTRO:             cfg.evento_outro_id,
        }

        resultado = []
        for item in frequencias_data:
            data_item   = datetime.strptime(item['dia'], '%Y-%m-%d').date()
            afastamento = next(
                (a for a in afastamentos
                 if a.data_afastamento <= data_item and
                 (a.data_retorno is None or a.data_retorno >= data_item)),
                None
            )
            if afastamento:
                evento_id = mapa_motivo.get(afastamento.motivo)
                if evento_id:
                    item = {**item, 'evento_id': evento_id}
            resultado.append(item)
        return resultado

    # ─── Resolução de prioridades ─────────────────────────────────────────────

    def _resolver_prioridades(self, frequencias_data):
        """
        Resolve conflitos entre eventos do mesmo dia usando o campo `prioridade`
        de EventoFrequencia (maior valor = maior prioridade).

        Regras:
          1. Se há evento dia_inteiro e eventos com horário no mesmo dia:
             - compara prioridades; ganha o de maior valor
             - empate: mantém o evento dia_inteiro (assume intenção explícita)
          2. Se há dois eventos dia_inteiro no mesmo dia:
             - mantém o de maior prioridade; empate mantém o primeiro
          3. Eventos com horário entre si: resolvidos por validar_lote (overlap)

        Os itens perdedores são removidos do payload (não serão salvos nem deletados —
        se tinham ID, o caller deve ter incluído em deletar_ids/deletar_related_ids).
        """
        if not frequencias_data:
            return frequencias_data

        # carrega prioridades de todos os eventos envolvidos em uma query só
        evento_ids = {item['evento_id'] for item in frequencias_data}
        prioridades = dict(
            EventoFrequencia.objects.filter(id__in=evento_ids)
            .values_list('id', 'prioridade')
        )
        dia_inteiro_flags = dict(
            EventoFrequencia.objects.filter(id__in=evento_ids)
            .values_list('id', 'dia_inteiro')
        )

        # agrupa por dia
        from collections import defaultdict
        por_dia = defaultdict(list)
        for item in frequencias_data:
            por_dia[item['dia']].append(item)

        resultado = []
        for dia, items in por_dia.items():
            dia_inteiros = [i for i in items if dia_inteiro_flags.get(i['evento_id'])]
            com_horario  = [i for i in items if not dia_inteiro_flags.get(i['evento_id'])]

            if not dia_inteiros:
                # sem dia_inteiro: todos os itens passam (overlaps já validados)
                resultado.extend(com_horario)
                continue

            # elege o dia_inteiro vencedor (maior prioridade; empate = primeiro)
            vencedor_di = max(
                dia_inteiros,
                key=lambda i: prioridades.get(i['evento_id'], 0)
            )

            if com_horario:
                pri_di      = prioridades.get(vencedor_di['evento_id'], 0)
                pri_horario = max(prioridades.get(i['evento_id'], 0) for i in com_horario)

                if pri_di >= pri_horario:
                    # dia_inteiro ganha: descarta horários
                    resultado.append(vencedor_di)
                else:
                    # horários ganham: descarta dia_inteiro
                    resultado.extend(com_horario)
            else:
                # só dia_inteiros: mantém o vencedor
                resultado.append(vencedor_di)

        return resultado

    # ─── Persistência ─────────────────────────────────────────────────────────

    def _salvar_item(self, item):
        evento   = EventoFrequencia.objects.get(id=item['evento_id'])
        dia_date = datetime.strptime(item['dia'], '%Y-%m-%d').date()

        # valida afastamento: levanta se tentar salvar categoria não-ausência em dia afastado
        self.validador.validar_afastamento(dia_date, evento)

        if evento.dia_inteiro:
            entrada = saida = None  # dia_inteiro não usa horário
        else:
            dia_saida = (
                (datetime.strptime(item['dia'], '%Y-%m-%d') + timedelta(days=1)).strftime('%Y-%m-%d')
                if item.get('virada') else item['dia']
            )
            entrada = self._parse_datetime(item['dia'], item['entrada'])
            saida   = self._parse_datetime(dia_saida,   item['saida'])
            self.validador.validar_overlap_com_existentes(
                entrada, saida, item['dia'], excluir_id=item.get('id')
            )

        fields = dict(
            evento=evento,
            data=dia_date,
            inicio=entrada,
            fim=saida,
            observacao=item.get('observacao', ''),
            editado=True,
        )
        freq_id = item.get('id')
        if freq_id:
            freq = Frequencia.objects.get(id=freq_id, contrato=self.contrato)
            for k, v in fields.items():
                setattr(freq, k, v)
            freq.save()  # save() em vez de update() para disparar signals do auditlog
        else:
            Frequencia.objects.create(contrato=self.contrato, **fields)

    def _parse_datetime(self, dia_str, hora_str):
        dt_naive = datetime.strptime(f"{dia_str} {hora_str}", '%Y-%m-%d %H:%M')
        return timezone.make_aware(dt_naive, self.tz)  # make_aware trata DST corretamente
