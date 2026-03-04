from datetime import datetime, timedelta
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from auditlog.context import disable_auditlog
from pessoal.models import Afastamento, Frequencia, EventoFrequencia
from .validadores import FrequenciaValidador


class FrequenciaPersistenciaService:

    def __init__(self, contrato):
        self.contrato  = contrato
        self.validador = FrequenciaValidador(contrato)
        self.tz        = timezone.get_current_timezone()

    def sincronizar_mes(self, frequencias_data, deletar_ids=None, deletar_related_ids=None, afastamento_cfg=None):
        if not frequencias_data and not deletar_ids and not deletar_related_ids:
            return 0
        if frequencias_data:
            self.validador.validar_lote(frequencias_data)
            # substitui evento_id nos dias cobertos por afastamento antes de persistir
            frequencias_data = self._aplicar_afastamentos(frequencias_data, afastamento_cfg)
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
                    item = {**item, 'evento_id': evento_id}  # substitui evento, preserva restante
            resultado.append(item)
        return resultado

    def _salvar_item(self, item):
        evento   = EventoFrequencia.objects.get(id=item['evento_id'])
        dia_date = datetime.strptime(item['dia'], '%Y-%m-%d').date()
        if evento.dia_inteiro:
            entrada = saida = None  # sem horário evita conflito de overlap
        else:
            dia_saida = (
                (datetime.strptime(item['dia'], '%Y-%m-%d') + timedelta(days=1)).strftime('%Y-%m-%d')
                if item.get('virada') else item['dia']
            )
            entrada = self._parse_datetime(item['dia'],  item['entrada'])
            saida   = self._parse_datetime(dia_saida,    item['saida'])
            self.validador.validar_overlap_com_existentes(entrada, saida, item['dia'], excluir_id=item.get('id'))
        fields = dict(
            evento=evento, data=dia_date,
            inicio=entrada, fim=saida,
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
