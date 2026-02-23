import json
import calendar
from datetime import datetime
from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin
from django.http import JsonResponse
from django.db.models import Q
from core.views import BaseTemplateView
from core.constants import DEFAULT_MESSAGES
from pessoal.models import Funcionario, EventoFrequencia, PessoalSettings
from pessoal.services.frequencia import CalendarioFrequenciaService, FrequenciaPersistenciaService


class FrequenciaManagementView(LoginRequiredMixin, BaseTemplateView):
    template_name = 'pessoal/frequencia.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        matricula      = self.request.GET.get('matricula', '')
        competencia_str = self.request.GET.get('competencia', datetime.today().strftime('%Y-%m'))
        context.update({
            'filtro_form': {'matricula': matricula, 'competencia': competencia_str},
            'eventos_choices': EventoFrequencia.objects.all(),
            'categorias': EventoFrequencia.Categoria.choices,
            'evento_folga_id': None,
        })
        if matricula and competencia_str:
            self._processar_filtro(context, matricula, competencia_str)
        return context

    def _processar_filtro(self, context, matricula, competencia_str):
        try:
            funcionario = Funcionario.objects.get(matricula=matricula)
            competencia, ultimo_dia = self._parse_competencia(competencia_str)
            contrato = self._get_contrato(funcionario, competencia, ultimo_dia)
            if not contrato:
                messages.warning(self.request, f"Funcionário {matricula} sem contrato vigente em {competencia_str}")
                return
            settings_obj = PessoalSettings.objects.filter(filial=funcionario.filial).first()
            evento_folga_id = settings_obj.config.frequencia.evento_folga_id if settings_obj else None
            dias_mes = CalendarioFrequenciaService(competencia, contrato).montar(
                frequencias=self._obter_frequencias(contrato, competencia),
                contratos_mes=self._obter_contratos_mes(funcionario, competencia, ultimo_dia),
                turnos_hist=self._obter_turnos_vigentes(contrato, competencia, ultimo_dia),
            )
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
            messages.error(self.request, f"Erro ao carregar frequência: {type(e).__name__}")

    def post(self, request, *args, **kwargs):
        try:
            data           = json.loads(request.body)
            funcionario    = Funcionario.objects.get(matricula=data.get('matricula'))
            competencia, ultimo_dia = self._parse_competencia(data.get('competencia'))
            contrato = self._get_contrato(funcionario, competencia, ultimo_dia)
            if not contrato:
                return JsonResponse({'status': 'error', 'message': 'Contrato não encontrado'}, status=400)
            FrequenciaPersistenciaService(contrato).sincronizar_mes(
                data.get('frequencias', []), 
                deletar_ids=data.get('deletar_ids', []),
                deletar_related_ids=data.get('deletar_related_ids', []),
            )
            messages.success(request, DEFAULT_MESSAGES.get('updated_plural'))
            return JsonResponse({'status': 'success'})
        except Funcionario.DoesNotExist:
            return JsonResponse({'status': 'error', 'message': 'Funcionário não encontrado'}, status=404)
        except Exception as e:
            msg = e.messages[0] if hasattr(e, 'messages') else str(e)
            return JsonResponse({'status': 'error', 'message': msg}, status=400)

    # helpers reutilizados em get e post
    def _parse_competencia(self, competencia_str):
        competencia = datetime.strptime(competencia_str, '%Y-%m').date()
        ultimo_dia  = competencia.replace(day=calendar.monthrange(competencia.year, competencia.month)[1])
        return competencia, ultimo_dia

    def _get_contrato(self, funcionario, competencia, ultimo_dia):
        return funcionario.contratos.filter(
            inicio__lte=ultimo_dia
        ).filter(
            Q(fim__gte=competencia) | Q(fim__isnull=True)
        ).order_by('-inicio').first()

    def _obter_frequencias(self, contrato, competencia):
        return contrato.frequencias.filter( # inclui eventos dia inteiro (inicio null) via campo data
            Q(inicio__year=competencia.year, inicio__month=competencia.month) |
            Q(data__year=competencia.year,   data__month=competencia.month)
        ).select_related('evento').order_by('inicio')

    def _obter_contratos_mes(self, funcionario, competencia, ultimo_dia):
        return funcionario.contratos.filter(
            inicio__lte=ultimo_dia
        ).filter(
            Q(fim__gte=competencia) | Q(fim__isnull=True)
        ).order_by('inicio')

    def _obter_turnos_vigentes(self, contrato, competencia, ultimo_dia):
        return list(
            contrato.historico_turnos.filter(
                inicio_vigencia__lte=ultimo_dia
            ).filter(
                Q(fim_vigencia__gte=competencia) | Q(fim_vigencia__isnull=True)
            ).order_by('inicio_vigencia').select_related('turno').prefetch_related('turno__dias')
        )
