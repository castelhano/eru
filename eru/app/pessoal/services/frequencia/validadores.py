from django.core.exceptions import ValidationError
from pessoal.models import Frequencia


class FrequenciaValidador:

    def __init__(self, contrato):
        self.contrato = contrato

    def validar_lote(self, frequencias_data):
        for item in frequencias_data:
            self._validar_horarios(item)

    def _validar_horarios(self, item):
        entrada = item.get('entrada', '')
        saida = item.get('saida', '')
        if not entrada or not saida:
            return
        if not item.get('virada') and saida <= entrada: # virada de dia é válida, não rejeita
            raise ValidationError(f"Horário de saída deve ser maior que entrada no dia {item['dia']}")

    def _horarios_conflitam(self, item1, item2):
        def to_min(t): h, m = t.split(':'); return int(h) * 60 + int(m)
        in1,  out1 = to_min(item1['entrada']), to_min(item1['saida']) + (1440 if item1.get('virada') else 0)
        in2,  out2 = to_min(item2['entrada']), to_min(item2['saida']) + (1440 if item2.get('virada') else 0) # normaliza virada para comparação correta
        return in1 < out2 and out1 > in2

    def validar_overlap_com_existentes(self, entrada_dt, saida_dt, dia_str, excluir_id=None):
        query = Frequencia.objects.filter(
            contrato=self.contrato,
            inicio__lt=saida_dt,
            fim__gt=entrada_dt
        )
        if excluir_id:
            query = query.exclude(id=excluir_id)
        if query.exists():
            raise ValidationError(f"Registro sobrepõe outras entradas existentes. <br>Dia: {dia_str[-2:]}")