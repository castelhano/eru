from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _


class TurnoValidador:
    """Validador centralizado para regras de negócio de turnos"""
    
    @staticmethod
    def validar_dias_ciclo(dias_data):
        """
        Valida lista completa de dias do ciclo
        
        Args:
            dias_data: Lista de dicts [{posicao_ciclo, eh_folga, horarios, ...}, ...]
        
        Raises:
            ValidationError: se houver conflitos ou dados inválidos
        """
        for dia in dias_data:
            if dia.get('eh_folga'):
                continue
            
            posicao = dia['posicao_ciclo']
            horarios = dia.get('horarios', [])
            
            # Valida conflitos dentro do mesmo dia
            TurnoValidador._validar_conflitos_dia(horarios, posicao)
    
    @staticmethod
    def _validar_conflitos_dia(horarios, posicao):
        """Valida que não há overlaps entre horários do mesmo dia"""
        for i, h1 in enumerate(horarios):
            for h2 in horarios[i+1:]:
                if TurnoValidador._horarios_conflitam(h1, h2):
                    raise ValidationError(
                        f"Horários conflitam na posição {posicao}"
                    )
    
    @staticmethod
    def _horarios_conflitam(h1, h2):
        """Verifica se dois horários se sobrepõem"""
        def to_min(t): h, m = t.split(':'); return int(h) * 60 + int(m)
        in1  = to_min(h1['entrada'])
        out1 = to_min(h1['saida']) + (1440 if h1.get('virada') else 0)
        in2  = to_min(h2['entrada'])
        out2 = to_min(h2['saida']) + (1440 if h2.get('virada') else 0)
        return in1 < out2 and out1 > in2

    
    # @staticmethod
    # def validar_horario_individual(entrada, saida, posicao):
    #     """Valida um par entrada/saída individual"""
    #     if not entrada and not saida:
    #         return  # Ambos vazios é válido (será ignorado)
        
    #     if not entrada or not saida:
    #         raise ValidationError(
    #             f"Posição {posicao}: preencha entrada E saída ou deixe ambos vazios"
    #         )
        
    #     if saida <= entrada:
    #         raise ValidationError(
    #             f"Posição {posicao}: saída deve ser maior que entrada"
    #         )