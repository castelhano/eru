import json
from collections import OrderedDict
from datetime import date
import calendar
from django.utils import timezone
from pessoal.services.turno.utils import get_turno_dia, get_turno_dia_ciclo


class CalendarioFrequenciaService:
    """Serviço especializado em montar calendários de frequência"""
    
    def __init__(self, competencia, contrato):
        self.competencia = competencia
        self.contrato = contrato
        self.tz_local = timezone.get_current_timezone()
        self.num_dias = calendar.monthrange(competencia.year, competencia.month)[1]
        self.ultimo_dia = competencia.replace(day=self.num_dias)
    
    def montar(self, frequencias, contratos_mes, turnos_hist):
        """
        Monta estrutura completa do calendário do mês
        
        Args:
            frequencias: QuerySet de Frequencia do mês
            contratos_mes: Lista de contratos vigentes no mês
            turnos_hist: QuerySet de TurnoHistorico vigente no mês
        
        Returns:
            OrderedDict com estrutura {date: {horarios, escala, ...}}
        """
        dias_mes = self._inicializar_dias(contratos_mes)
        self._preencher_frequencias(dias_mes, frequencias)
        self._preencher_escalas(dias_mes, turnos_hist)
        return dias_mes
    
    def _inicializar_dias(self, contratos_mes):
        """Cria estrutura base para cada dia do mês"""
        dias_mes = OrderedDict()
        
        for dia_num in range(1, self.num_dias + 1):
            data = date(self.competencia.year, self.competencia.month, dia_num)
            
            # Dia bloqueado se não há contrato vigente nesta data
            tem_contrato = any(
                c.inicio <= data <= (c.fim or date.max) 
                for c in contratos_mes
            )
            
            dias_mes[data] = {
                'horarios': [],
                'escala': None,
                'escala_json': '[]',
                'escala_folga': False,
                'bloqueado': not tem_contrato,
            }
        
        return dias_mes
    
    def _preencher_frequencias(self, dias_mes, frequencias):
        for freq in frequencias:
            if freq.data:
                dia = freq.data
            else:
                dia = freq.inicio.astimezone(self.tz_local).date()
            if dia not in dias_mes:
                continue
            entrada = freq.inicio.astimezone(self.tz_local).strftime('%H:%M') if freq.inicio else ''
            saida   = freq.fim.astimezone(self.tz_local).strftime('%H:%M') if freq.fim else ''
            dias_mes[dia]['horarios'].append({
                'id':         freq.id,
                'entrada':    entrada,
                'saida':      saida,
                'evento_id':  freq.evento_id,
                'observacao': freq.observacao or '',
                'dia_inteiro': freq.evento.dia_inteiro,
                'origem':     self._get_origem(freq),
            })
    
    def _preencher_escalas(self, dias_mes, turnos_hist):
        """Preenche escala planejada de cada dia com base no ciclo do turno vigente"""
        if not turnos_hist:
            return
        
        # Pre-carrega dias de todos os turnos em memória (evita N+1 queries)
        dias_por_turno = {
            th.turno_id: list(th.turno.dias.all()) 
            for th in turnos_hist
        }
        
        for data, info in dias_mes.items():
            # Turno vigente para este dia específico (reversed = mais recente primeiro)
            turno_hist = get_turno_dia(turnos_hist, data)
            if not turno_hist:
                continue
            turno = turno_hist.turno
            dias_turno = dias_por_turno[turno.id]
            
            # Calcula posição no ciclo
            turno_dia = get_turno_dia_ciclo(turno, dias_turno, data)
            if not turno_dia:
                continue
            
            if turno_dia.eh_folga:
                info['escala'] = 'Folga'
                info['escala_folga'] = True
            elif turno_dia.horarios:
                info['escala'] = ' | '.join(
                    f"{h.get('entrada','')}–{h.get('saida','')}" 
                    for h in turno_dia.horarios
                )                
                info['escala_json'] = json.dumps(turno_dia.horarios)
    
    def _get_origem(self, freq):
        """Determina a origem do registro: fonte externa, manual ou sistema"""
        if freq.metadados.get('fonte'):
            return freq.metadados['fonte']
        return 'manual' if freq.editado else 'sistema'