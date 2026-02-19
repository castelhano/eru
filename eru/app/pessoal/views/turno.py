import json
from datetime import datetime
from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin
from django.core.exceptions import ValidationError
from django.db import transaction
from django.http import JsonResponse
from django.utils.translation import gettext_lazy as _
from core.views import AjaxableListMixin, BaseTemplateView
from core.constants import DEFAULT_MESSAGES
from pessoal.models import Turno, TurnoDia, TurnoHistorico
from pessoal.services.turno import TurnoCicloService, TurnoValidador


class TurnoManagementView(LoginRequiredMixin, AjaxableListMixin, BaseTemplateView):
    template_name = 'pessoal/turnos.html'
    
    def get_queryset(self):
        return Turno.objects.all().order_by('nome')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        turno_id = self.request.GET.get('turno_id', '')
        
        context.update({
            'filtro_form': {'turno_id': turno_id},
            'turnos_list': Turno.objects.all().order_by('nome'),
        })
        
        if turno_id and turno_id != 'novo':
            self._processar_filtro(context, turno_id)
        elif turno_id == 'novo':
            context.update({
                'turno': None,
                'dias_ciclo': {},
            })
        
        return context
    
    def _processar_filtro(self, context, turno_id):
        """Carrega dados do turno selecionado"""
        try:
            turno = Turno.objects.prefetch_related('dias').get(id=turno_id)
            
            # DELEGA para o serviço montar o ciclo
            ciclo_service = TurnoCicloService()
            dias_ciclo = ciclo_service.montar_ciclo(turno)
            
            context.update({
                'turno': turno,
                'dias_ciclo': dias_ciclo,
            })
        except Turno.DoesNotExist:
            messages.error(self.request, DEFAULT_MESSAGES.get('filterError'))
    
    def post(self, request, *args, **kwargs):
        """Salva turno e seus dias via AJAX"""
        try:
            data = json.loads(request.body)
            action = data.get('action')
            
            if action == 'save_turno':
                return self._salvar_turno(data)
            elif action == 'delete_turno':
                return self._deletar_turno(data)
            
            return JsonResponse(
                {'status': 'error', 'message': _('Ação inválida')},
                status=400
            )
            
        except Exception as e:
            return JsonResponse(
                {'status': 'error', 'message': str(e)},
                status=400
            )
    
    def _salvar_turno(self, data):
        """Salva/atualiza turno e dias do ciclo"""
        turno_id = data.get('turno_id')
        dias_data = data.get('dias', [])
        
        # VALIDA com o serviço antes de persistir
        validador = TurnoValidador()
        validador.validar_dias_ciclo(dias_data)
        
        with transaction.atomic():
            # Salva/atualiza turno
            if turno_id:
                turno = Turno.objects.get(id=turno_id)
                turno.nome = data.get('nome')
                turno.dias_ciclo = int(data.get('dias_ciclo'))
                turno.inicio = datetime.strptime(data.get('inicio'), '%Y-%m-%d').date()
                turno.save()
            else:
                turno = Turno.objects.create(
                    nome=data.get('nome'),
                    dias_ciclo=int(data.get('dias_ciclo')),
                    inicio=datetime.strptime(data.get('inicio'), '%Y-%m-%d').date(),
                )
            
            # Remove dias não enviados (deletados na UI)
            ids_enviados = [d['id'] for d in dias_data if d.get('id')]
            TurnoDia.objects.filter(turno=turno).exclude(id__in=ids_enviados).delete()
            
            # Salva dias do ciclo
            ciclo_service = TurnoCicloService()
            for dia_item in dias_data:
                horarios_json = ciclo_service.parse_horarios_json(
                    dia_item.get('horarios', [])
                )
                
                TurnoDia.objects.update_or_create(
                    id=dia_item.get('id'),
                    defaults={
                        'turno': turno,
                        'posicao_ciclo': dia_item['posicao_ciclo'],
                        'horarios': horarios_json,
                        'tolerancia': dia_item.get('tolerancia', 10),
                        'eh_folga': dia_item.get('eh_folga', False),
                    }
                )
        
        messages.success(self.request, DEFAULT_MESSAGES.get('updated'))
        return JsonResponse({
            'status': 'success',
            'turno_id': turno.id,
            'redirect': f'?turno_id={turno.id}'
        })
    
    def _deletar_turno(self, data):
        """Deleta turno (se não tiver histórico vinculado)"""
        turno_id = data.get('turno_id')
        
        try:
            turno = Turno.objects.get(id=turno_id)
            
            if TurnoHistorico.objects.filter(turno=turno).exists():
                return JsonResponse({
                    'status': 'error',
                    'message': DEFAULT_MESSAGES.get('deleteError')
                }, status=400)
            
            turno.delete()
            messages.success(self.request, DEFAULT_MESSAGES.get('deleted'))
            return JsonResponse({'status': 'success', 'redirect': self.request.path})
            
        except Turno.DoesNotExist:
            return JsonResponse(
                {'status': 'error', 'message': _('Turno não encontrado')},
                status=404
            )