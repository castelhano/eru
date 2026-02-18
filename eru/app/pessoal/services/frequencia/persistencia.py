from datetime import datetime, timedelta
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError
from pessoal.models import Frequencia, EventoFrequencia
from .validadores import FrequenciaValidador


class FrequenciaPersistenciaService:
    """Serviço para salvar/atualizar frequências"""
    
    def __init__(self, contrato):
        self.contrato = contrato
        self.validador = FrequenciaValidador(contrato)
        self.tz = timezone.get_current_timezone()
    
    def sincronizar_mes(self, frequencias_data):
        """
        Sincroniza frequências do mês: remove ausentes, upsert presentes
        
        Args:
            frequencias_data: Lista de dicts [{id, dia, entrada, saida, evento_id, observacao}, ...]
        
        Returns:
            int: quantidade de registros processados
        """
        if not frequencias_data:
            return 0
        
        # Valida antes de persistir
        self.validador.validar_lote(frequencias_data)
        
        ids_enviados = [f['id'] for f in frequencias_data if f.get('id')]
        dt_ref = datetime.strptime(frequencias_data[0]['dia'], '%Y-%m-%d')
        
        with transaction.atomic():
            # Remove registros do mês que não vieram no payload (deletados na UI)
            deletados = Frequencia.objects.filter(
                contrato=self.contrato,
                inicio__year=dt_ref.year,
                inicio__month=dt_ref.month
            ).exclude(id__in=ids_enviados).delete()
            
            # Salva/atualiza registros enviados
            for item in frequencias_data:
                self._salvar_item(item)
        
        return len(frequencias_data)
    
    def _salvar_item(self, item):
        """Salva ou atualiza um único registro de frequência"""
        evento = EventoFrequencia.objects.get(id=item['evento_id'])
        
        # Define horários baseado no tipo de evento
        if evento.dia_inteiro:
            entrada = self._parse_datetime(item['dia'], '00:00')
            # Fim = início do dia seguinte - 1s para cobrir o dia inteiro sem overlap em UTC
            dia_seguinte = (
                datetime.strptime(item['dia'], '%Y-%m-%d') + timedelta(days=1)
            ).strftime('%Y-%m-%d')
            saida = self._parse_datetime(dia_seguinte, '00:00') - timedelta(seconds=1)
        else:
            entrada = self._parse_datetime(item['dia'], item['entrada'])
            saida = self._parse_datetime(item['dia'], item['saida'])
        
        # Valida overlap com registros existentes
        self.validador.validar_overlap_com_existentes(
            entrada, saida, excluir_id=item.get('id')
        )
        
        # Update ou Create
        Frequencia.objects.update_or_create(
            id=item.get('id'),
            defaults={
                'contrato': self.contrato,
                'evento': evento,
                'inicio': entrada,
                'fim': saida,
                'observacao': item.get('observacao', ''),
                'editado': True,
                # metadados nunca alterado aqui — imutável após importação
            }
        )
    
    def _parse_datetime(self, dia_str, hora_str):
        """Converte strings de data e hora para datetime aware no timezone local"""
        dt_naive = datetime.strptime(f"{dia_str} {hora_str}", '%Y-%m-%d %H:%M')
        return timezone.make_aware(dt_naive, self.tz)  # make_aware trata DST corretamente