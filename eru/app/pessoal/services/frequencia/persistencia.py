from datetime import datetime, timedelta
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from pessoal.models import Frequencia, EventoFrequencia
from .validadores import FrequenciaValidador


class FrequenciaPersistenciaService:

    def __init__(self, contrato):
        self.contrato = contrato
        self.validador = FrequenciaValidador(contrato)
        self.tz = timezone.get_current_timezone()

    def sincronizar_mes(self, frequencias_data):
        if not frequencias_data:
            return 0
        self.validador.validar_lote(frequencias_data)
        ids_enviados = [f['id'] for f in frequencias_data if f.get('id')]
        dt_ref = datetime.strptime(frequencias_data[0]['dia'], '%Y-%m-%d')
        with transaction.atomic():
            Frequencia.objects.filter(
                contrato=self.contrato
            ).filter(
                Q(inicio__year=dt_ref.year, inicio__month=dt_ref.month) | # registros com horário
                Q(data__year=dt_ref.year,   data__month=dt_ref.month)     # registros dia inteiro
            ).exclude(id__in=ids_enviados).delete()
            Frequencia.objects.filter(  # remove registros do mês ausentes no payload
                contrato=self.contrato,
                inicio__year=dt_ref.year,
                inicio__month=dt_ref.month
            ).exclude(id__in=ids_enviados).delete()
            for item in frequencias_data:
                self._salvar_item(item)
        return len(frequencias_data)

    def _salvar_item(self, item):
        evento = EventoFrequencia.objects.get(id=item['evento_id'])
        dia_date = datetime.strptime(item['dia'], '%Y-%m-%d').date()
        if evento.dia_inteiro:
            entrada, saida = None, None # dia inteiro sem horário — evita conflito com outros registros
        else:
            entrada = self._parse_datetime(item['dia'], item['entrada'])
            dia_saida = (
                (datetime.strptime(item['dia'], '%Y-%m-%d') + timedelta(days=1)).strftime('%Y-%m-%d')
                if item.get('virada') else item['dia']
            )
            saida = self._parse_datetime(dia_saida, item['saida'])

        if entrada and saida: # overlap só faz sentido quando há horário definido
            self.validador.validar_overlap_com_existentes(entrada, saida, item['dia'], excluir_id=item.get('id'))
        defaults = {
            'contrato': self.contrato,
            'evento': evento,
            'data': dia_date,
            'inicio': entrada,
            'fim': saida,
            'observacao': item.get('observacao', ''),
            'editado': True,
        }
        freq_id = item.get('id')
        if freq_id: # update
            Frequencia.objects.filter(id=freq_id).update(**defaults)
        else: # create — update_or_create com id=None causa "Cannot use None as query value"
            Frequencia.objects.create(**defaults)
    def _parse_datetime(self, dia_str, hora_str):
        dt_naive = datetime.strptime(f"{dia_str} {hora_str}", '%Y-%m-%d %H:%M')
        return timezone.make_aware(dt_naive, self.tz)  # make_aware trata DST corretamente