from datetime import datetime, timedelta
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError
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
        if evento.dia_inteiro:
            entrada = self._parse_datetime(item['dia'], '00:00')
            dia_seguinte = (datetime.strptime(item['dia'], '%Y-%m-%d') + timedelta(days=1)).strftime('%Y-%m-%d')
            saida = self._parse_datetime(dia_seguinte, '00:00') - timedelta(seconds=1)  # cobre dia inteiro sem overlap UTC
        else:
            entrada = self._parse_datetime(item['dia'], item['entrada'])
            dia_saida = item['dia'] if not item.get('virada') else (
                datetime.strptime(item['dia'], '%Y-%m-%d') + timedelta(days=1)
            ).strftime('%Y-%m-%d')  # virada: saida pertence ao dia seguinte
            saida = self._parse_datetime(dia_saida, item['saida'])
        self.validador.validar_overlap_com_existentes(entrada, saida, excluir_id=item.get('id'))
        Frequencia.objects.update_or_create(
            id=item.get('id'),
            defaults={
                'contrato': self.contrato,
                'evento': evento,
                'inicio': entrada,
                'fim': saida,
                'observacao': item.get('observacao', ''),
                'editado': True,  # metadados nunca alterado aqui — imutável após importação
            }
        )

    def _parse_datetime(self, dia_str, hora_str):
        dt_naive = datetime.strptime(f"{dia_str} {hora_str}", '%Y-%m-%d %H:%M')
        return timezone.make_aware(dt_naive, self.tz)  # make_aware trata DST corretamente