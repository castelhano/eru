import json
import calendar
from datetime import datetime
from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin
from django.http import JsonResponse
from django.db.models import Q
from django.utils import timezone
from core.views import BaseTemplateView
from core.constants import DEFAULT_MESSAGES
from pessoal.models import Funcionario, EventoFrequencia, PessoalSettings
from pessoal.services.frequencia import (
    CalendarioFrequenciaService,
    FrequenciaPersistenciaService
)


class FrequenciaManagementView(LoginRequiredMixin, BaseTemplateView):
    template_name = 'pessoal/frequencia.html'
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        
        matricula = self.request.GET.get('matricula', '')
        competencia_str = self.request.GET.get('competencia', datetime.today().strftime('%Y-%m'))
        
        context.update({
            'filtro_form': {
                'matricula': matricula,
                'competencia': competencia_str
            },
            'eventos_choices': EventoFrequencia.objects.all(),
            'evento_folga_id': None,  # Sobrescrito em _processar_filtro se settings existir
        })
        
        if matricula and competencia_str:
            self._processar_filtro(context, matricula, competencia_str)
        
        return context
    
    def _processar_filtro(self, context, matricula, competencia_str):
        """Carrega dados do mês para o funcionário/competência informados"""
        try:
            funcionario = Funcionario.objects.get(matricula=matricula)
            competencia = datetime.strptime(competencia_str, '%Y-%m').date()
            ultimo_dia = competencia.replace(
                day=calendar.monthrange(competencia.year, competencia.month)[1]
            )
            
            # Contrato mais recente vigente no mês
            contrato = funcionario.contratos.filter(
                inicio__lte=ultimo_dia
            ).filter(
                Q(fim__gte=competencia) | Q(fim__isnull=True)
            ).order_by('-inicio').first()
            
            if not contrato:
                messages.warning(
                    self.request,
                    f"Funcionário {matricula} sem contrato vigente em {competencia_str}"
                )
                return
            
            # Evento de folga configurado na filial
            settings_obj = PessoalSettings.objects.filter(filial=funcionario.filial).first()
            evento_folga_id = (
                settings_obj.config.frequencia.evento_folga_id 
                if settings_obj else None
            )
            
            # Busca frequências do mês
            frequencias = self._obter_frequencias(contrato, competencia)
            
            # Todos os contratos vigentes no mês (para calcular dias bloqueados)
            contratos_mes = self._obter_contratos_mes(funcionario, competencia, ultimo_dia)
            
            # Turnos vigentes no mês
            turnos_hist = self._obter_turnos_vigentes(contrato, competencia, ultimo_dia)
            
            # DELEGA para o serviço montar o calendário
            calendario_service = CalendarioFrequenciaService(competencia, contrato)
            dias_mes = calendario_service.montar(frequencias, contratos_mes, turnos_hist)
            
            context.update({
                'contrato': contrato,
                'funcionario': funcionario,
                'competencia': competencia,
                'evento_folga_id': evento_folga_id,
                'dias_mes': dias_mes,
            })
            
        except Funcionario.DoesNotExist:
            messages.error(self.request, f"Matrícula {matricula} não encontrada")
        except Exception as e:
            messages.error(
                self.request,
                f"Erro ao carregar frequência: {type(e).__name__}"
            )
    
    def _obter_frequencias(self, contrato, competencia):
        """Busca frequências do mês"""
        return contrato.frequencias.filter(
            inicio__year=competencia.year,
            inicio__month=competencia.month
        ).select_related('evento').order_by('inicio')
    
    def _obter_contratos_mes(self, funcionario, competencia, ultimo_dia):
        """Busca todos contratos vigentes no mês"""
        return funcionario.contratos.filter(
            inicio__lte=ultimo_dia
        ).filter(
            Q(fim__gte=competencia) | Q(fim__isnull=True)
        ).order_by('inicio')
    
    def _obter_turnos_vigentes(self, contrato, competencia, ultimo_dia):
        """Busca turnos vigentes no mês"""
        return list(
            contrato.historico_turnos.filter(
                inicio_vigencia__lte=ultimo_dia
            ).filter(
                Q(fim_vigencia__gte=competencia) | Q(fim_vigencia__isnull=True)
            ).order_by('inicio_vigencia').select_related('turno').prefetch_related('turno__dias')
        )
    
    def post(self, request, *args, **kwargs):
        """Recebe frequências via AJAX e persiste no banco"""
        try:
            data = json.loads(request.body)
            matricula = data.get('matricula')
            competencia_str = data.get('competencia')
            
            funcionario = Funcionario.objects.get(matricula=matricula)
            competencia = datetime.strptime(competencia_str, '%Y-%m').date()
            ultimo_dia = competencia.replace(
                day=calendar.monthrange(competencia.year, competencia.month)[1]
            )
            
            contrato = funcionario.contratos.filter(
                inicio__lte=ultimo_dia
            ).filter(
                Q(fim__gte=competencia) | Q(fim__isnull=True)
            ).order_by('-inicio').first()
            
            if not contrato:
                return JsonResponse(
                    {'status': 'error', 'message': 'Contrato não encontrado'},
                    status=400
                )
            
            # DELEGA para o serviço persistir
            persistencia = FrequenciaPersistenciaService(contrato)
            persistencia.sincronizar_mes(data.get('frequencias', []))
            
            messages.success(request, DEFAULT_MESSAGES.get('updated_plural'))
            return JsonResponse({'status': 'success'})
            
        except Funcionario.DoesNotExist:
            return JsonResponse(
                {'status': 'error', 'message': 'Funcionário não encontrado'},
                status=404
            )
        except Exception as e:
            return JsonResponse(
                {'status': 'error', 'message': str(e)},
                status=400
            )


class FrequenciaImportView(LoginRequiredMixin, BaseTemplateView):
    """View para importação de frequências (implementar futuramente)"""
    template_name = 'pessoal/frequencia_import.html'
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        # TODO: Implementar lógica de import
        return context