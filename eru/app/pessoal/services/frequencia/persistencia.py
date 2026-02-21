from datetime import datetime, timedelta
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from pessoal.models import Frequencia, EventoFrequencia
from .validadores import FrequenciaValidador
from auditlog.context import disable_auditlog


class FrequenciaPersistenciaService:

    def __init__(self, contrato):
        self.contrato = contrato
        self.validador = FrequenciaValidador(contrato)
        self.tz = timezone.get_current_timezone()

    def sincronizar_mes(self, frequencias_data, deletar_ids=None, deletar_related_ids=None):
        if not frequencias_data and not deletar_ids:
            return 0
        if frequencias_data:
            self.validador.validar_lote(frequencias_data)
        with transaction.atomic():
            if deletar_ids:
                # contrato no filtro evita deleção cruzada entre contratos
                Frequencia.objects.filter(contrato=self.contrato, id__in=deletar_ids).delete()
            if deletar_related_ids:
                # ao editar uma frequencia para evento de dia inteiro sera realizado um update (registrado no auditlog)
                # e n exclusoes (baseado em quantas entradas existia neste dia) estas exclusoes nao serao registradas no log
                with disable_auditlog():
                    Frequencia.objects.filter(contrato=self.contrato, id__in=deletar_related_ids).delete()
            for item in frequencias_data:
                self._salvar_item(item)
        return len(frequencias_data)
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
            entrada = self._parse_datetime(item['dia'], item['entrada'])
            saida   = self._parse_datetime(dia_saida,   item['saida'])
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
            freq.save()  # save() em vez de update() para disparar signals para o auditlog
        else:
            Frequencia.objects.create(contrato=self.contrato, **fields)
    def _parse_datetime(self, dia_str, hora_str):
        dt_naive = datetime.strptime(f"{dia_str} {hora_str}", '%Y-%m-%d %H:%M')
        return timezone.make_aware(dt_naive, self.tz)  # make_aware trata DST corretamente