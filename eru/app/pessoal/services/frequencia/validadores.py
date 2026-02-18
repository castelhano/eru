from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _
from pessoal.models import Frequencia


class FrequenciaValidador:
    """Validador centralizado para regras de negócio de frequência"""
    
    def __init__(self, contrato):
        self.contrato = contrato
    
    def validar_lote(self, frequencias_data):
        """
        Valida lista completa de frequências antes de persistir
        
        Args:
            frequencias_data: Lista de dicts com dados das frequências
        
        Raises:
            ValidationError: se houver conflitos ou dados inválidos
        """
        for item in frequencias_data:
            self._validar_horarios(item)
        
        self._validar_conflitos_internos(frequencias_data)
    
    def _validar_horarios(self, item):
        """Valida que horários de entrada/saída são válidos"""
        dia = item['dia']
        entrada = item.get('entrada', '')
        saida = item.get('saida', '')
        
        # Se evento é dia_inteiro, não valida horários
        # (assumindo que você tem essa info ou busca do evento)
        
        if not entrada or not saida:
            return  # Será tratado na view (campos vazios = ignora linha)
        
        if saida <= entrada:
            raise ValidationError(
                f"Horário de saída deve ser maior que entrada no dia {dia}"
            )
    
    def _validar_conflitos_internos(self, frequencias_data):
        """Valida que não há overlaps entre as frequências do lote"""
        # Agrupa por dia
        por_dia = {}
        for item in frequencias_data:
            dia = item['dia']
            if dia not in por_dia:
                por_dia[dia] = []
            por_dia[dia].append(item)
        
        # Valida cada dia
        for dia, items in por_dia.items():
            for i, item1 in enumerate(items):
                for item2 in items[i+1:]:
                    if self._horarios_conflitam(item1, item2):
                        raise ValidationError(
                            f"Conflito de horários no dia {dia}"
                        )
    
    def _horarios_conflitam(self, item1, item2):
        """Verifica se dois horários se sobrepõem (A.inicio < B.fim AND A.fim > B.inicio)"""
        return (
            item1['entrada'] < item2['saida'] and 
            item1['saida'] > item2['entrada']
        )
    
    def validar_overlap_com_existentes(self, entrada_dt, saida_dt, excluir_id=None):
        """
        Valida se novo horário não sobrepõe registros já salvos no banco
        
        Args:
            entrada_dt: datetime de entrada
            saida_dt: datetime de saída
            excluir_id: ID da frequência sendo editada (para não validar contra si mesma)
        """
        query = Frequencia.objects.filter(
            contrato=self.contrato,
            inicio__lt=saida_dt,
            fim__gt=entrada_dt
        )
        
        if excluir_id:
            query = query.exclude(id=excluir_id)
        
        if query.exists():
            raise ValidationError(
                "Registro sobrepõe outras entradas existentes"
            )