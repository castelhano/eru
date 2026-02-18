from collections import OrderedDict


class TurnoCicloService:
    """Serviço para operações com ciclos de turno"""
    
    @staticmethod
    def montar_ciclo(turno):
        """
        Monta estrutura OrderedDict com todos os dias do ciclo
        
        Args:
            turno: Instância de Turno com dias prefetched
        
        Returns:
            OrderedDict {posicao: {id, eh_folga, tolerancia, horarios}}
        """
        dias_ciclo = OrderedDict()
        
        # Inicializa todas as posições
        for pos in range(turno.dias_ciclo):
            dias_ciclo[pos] = {
                'id': None,
                'eh_folga': False,
                'tolerancia': 10,
                'horarios': []
            }
        
        # Preenche com dados salvos
        for dia in turno.dias.all():
            dias_ciclo[dia.posicao_ciclo] = {
                'id': dia.id,
                'eh_folga': dia.eh_folga,
                'tolerancia': dia.tolerancia,
                'horarios': TurnoCicloService._extrair_horarios(dia)
            }
        
        return dias_ciclo
    
    @staticmethod
    def _extrair_horarios(turno_dia):
        """Extrai horários do JSONField e converte para lista normalizada"""
        if not turno_dia.horarios:
            return [{'entrada': '', 'saida': ''}]
        
        if isinstance(turno_dia.horarios, list):
            return turno_dia.horarios
        
        if isinstance(turno_dia.horarios, dict) and 'entrada' in turno_dia.horarios:
            return [turno_dia.horarios]
        
        return [{'entrada': '', 'saida': ''}]
    
    @staticmethod
    def calcular_resumo(horarios_list):
        """
        Calcula resumo do dia: horas totais, intrajornada, interjornada
        
        Args:
            horarios_list: Lista de dicts [{entrada: 'HH:MM', saida: 'HH:MM'}, ...]
        
        Returns:
            dict com {horas_totais, intrajornada, interjornada} em formato 'HH:MM'
        """
        horarios = []
        
        for h in horarios_list:
            entrada = h.get('entrada')
            saida = h.get('saida')
            
            if entrada and saida:
                horarios.append({
                    'entrada': TurnoCicloService._time_to_minutes(entrada),
                    'saida': TurnoCicloService._time_to_minutes(saida)
                })
        
        if not horarios:
            return {
                'horas_totais': '--',
                'intrajornada': '--',
                'interjornada': '--'
            }
        
        # Normaliza horários considerando virada de dia
        horarios_norm = TurnoCicloService._normalizar_horarios(horarios)
        
        # Horas Totais
        horas_totais = sum(h['saida'] - h['entrada'] for h in horarios_norm)
        
        # Intrajornada (intervalos entre jornadas)
        intrajornada = 0
        for i in range(len(horarios_norm) - 1):
            intrajornada += (horarios_norm[i + 1]['entrada'] - horarios_norm[i]['saida'])
        
        # Interjornada (tempo até próximo dia)
        primeira_entrada = horarios_norm[0]['entrada']
        ultima_saida = horarios_norm[-1]['saida']
        interjornada = (primeira_entrada + 1440) - ultima_saida
        
        return {
            'horas_totais': TurnoCicloService._minutes_to_time(horas_totais),
            'intrajornada': TurnoCicloService._minutes_to_time(intrajornada),
            'interjornada': TurnoCicloService._minutes_to_time(interjornada)
        }
    
    @staticmethod
    def _normalizar_horarios(horarios):
        """Normaliza horários considerando virada de dia"""
        horarios_norm = []
        
        for i, h in enumerate(horarios):
            entrada = h['entrada']
            saida = h['saida']
            
            if i > 0:
                ultima_saida = horarios_norm[i - 1]['saida']
                
                if entrada < ultima_saida:
                    entrada += 1440
                
                if saida <= entrada:
                    saida += 1440
            else:
                if saida < entrada:
                    saida += 1440
            
            horarios_norm.append({'entrada': entrada, 'saida': saida})
        
        return horarios_norm
    
    @staticmethod
    def _time_to_minutes(time_str):
        """Converte 'HH:MM' para minutos"""
        if not time_str:
            return 0
        h, m = map(int, time_str.split(':'))
        return h * 60 + m
    
    @staticmethod
    def _minutes_to_time(minutes):
        """Converte minutos para 'HH:MM'"""
        h = minutes // 60
        m = minutes % 60
        return f"{str(h).zfill(2)}:{str(m).zfill(2)}"
    
    @staticmethod
    def parse_horarios_json(horarios_list):
        """
        Converte lista de horários para JSON, removendo entradas vazias
        
        Args:
            horarios_list: Lista de dicts com entrada/saida
        
        Returns:
            Lista filtrada apenas com horários válidos
        """
        if not horarios_list:
            return []
        
        return [
            {'entrada': h['entrada'], 'saida': h['saida']}
            for h in horarios_list
            if h.get('entrada') and h.get('saida')
        ]