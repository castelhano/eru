import json
import calendar
from datetime import datetime, date, timedelta
from collections import OrderedDict
# Django Core
from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin, PermissionRequiredMixin
from django.core.exceptions import ValidationError, PermissionDenied
from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction
from django.db.models import Q, Count
from django.http import JsonResponse
from django.shortcuts import redirect, get_object_or_404
from django.urls import reverse, reverse_lazy
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from django.views import View

# Third-party
from rest_framework import viewsets, permissions
from django_tables2 import SingleTableView

# Core App
from core.extras import asteval_run
from core.constants import DEFAULT_MESSAGES
from core.mixins import AjaxableListMixin, AjaxableFormMixin, CSVExportMixin
from core.views_base import (BaseListView, BaseTemplateView, BaseCreateView, BaseUpdateView, BaseDeleteView)

# Pessoal App - Models
from .models import (
    PessoalSettings, Setor, Cargo, Funcionario, Contrato, Afastamento, Dependente, Evento, GrupoEvento, MotivoReajuste, EventoEmpresa, 
    EventoCargo, EventoFuncionario, Turno, TurnoDia, TurnoHistorico, Frequencia, EventoFrequencia
)
# Pessoal App
from .forms import (
    PessoalSettingsForm, SetorForm, CargoForm, FuncionarioForm, ContratoForm, AfastamentoForm, DependenteForm, EventoForm, GrupoEventoForm, EventoEmpresaForm, 
    EventoCargoForm, EventoFuncionarioForm, MotivoReajusteForm, EventoFrequenciaForm
)
from .filters import (
    FuncionarioFilter, ContratoFilter, AfastamentoFilter, CargoFilter, EventoFilter, EventoEmpresaFilter, EventoCargoFilter, 
    EventoFuncionarioFilter, MotivoReajusteFilter, EventoFrequenciaFilter
)
from .tables import (
    FuncionarioTable, ContratoTable, SetorTable, CargoTable, AfastamentoTable, DependenteTable, EventoTable, GrupoEventoTable, 
    MotivoReajusteTable, EventoEmpresaTable, EventoCargoTable, EventoFuncionarioTable, EventoFrequenciaTable
)
from .serializers import FuncionarioSerializer
from .folha.collectors import get_event_vars_master
from .schemas import PessoalSettingsSchema

###########################

class PessoalSettingsUpdateView(BaseUpdateView):
    model = PessoalSettings
    form_class = PessoalSettingsForm
    template_name = 'pessoal/settings.html'
    def get_object(self, queryset=None):
        filial_id = self.kwargs.get('filial_id')
        if not filial_id:
            return None
        try:
            filial = self.request.user.profile.filiais.get(id=filial_id)
        except Exception as e:
            raise PermissionDenied
        obj, created = PessoalSettings.objects.get_or_create(filial=filial)
        if self.request.GET.get('reset_default') == 'true':
        # se definido url param ?reset_default=true, reseta das configuracoes para o padrao
            obj.config = {}
            obj.save()
            messages.success(self.request, DEFAULT_MESSAGES.get('reset_default'))
        elif created:
            obj.save() 
        return obj
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        if self.object:
            context['config_json'] = json.dumps(self.object.config.model_dump(), cls=DjangoJSONEncoder)
            schema_dict = PessoalSettingsSchema.model_json_schema()
            context['schema_json'] = json.dumps(schema_dict, cls=DjangoJSONEncoder)
        else:
            context['config_json'] = json.dumps({})
            context['schema_json'] = json.dumps({})
        return context
    def form_valid(self, form):
        self.object = form.save(commit=False)
        self.object.config = form.cleaned_data['config_data']
        self.object.save()
        return super().form_valid(form)
    def get_success_url(self):
        return reverse('pessoal:settings_update', kwargs={'filial_id': self.object.filial.id})


class SetorListView(LoginRequiredMixin, PermissionRequiredMixin, AjaxableListMixin, SingleTableView):
    model = Setor
    login_url = '/handler/403'
    table_class = SetorTable
    template_name = 'pessoal/setores.html'
    permission_required = 'pessoal.view_setor'
    def get_queryset(self):
        hoje = timezone.now().date()
        return Setor.objects.annotate(
            total_ativos=Count(
                'cargo__contrato__funcionario', 
                filter=Q(
                    cargo__contrato__funcionario__status="A",
                    cargo__contrato__inicio__lte=hoje
                ) & (Q(cargo__contrato__fim__gte=hoje) | Q(cargo__contrato__fim__isnull=True)),
                distinct=True
            )
        ).order_by('nome')

class CargoListView(LoginRequiredMixin, PermissionRequiredMixin, AjaxableListMixin, BaseListView):
    model = Cargo
    template_name = 'pessoal/cargos.html'
    permission_required = 'pessoal.view_cargo'
    filterset_class = CargoFilter
    def get_queryset(self):
        return Cargo.objects.all().select_related('setor').order_by('nome')
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        f = self.filterset_class(self.request.GET, queryset=self.get_queryset())
        context['table'] = CargoTable(f.qs).config(self.request, filter_obj=f)
        return context

class FuncionarioListView(LoginRequiredMixin, PermissionRequiredMixin, CSVExportMixin, BaseListView):
    model = Funcionario
    template_name = 'pessoal/funcionarios.html'
    permission_required = 'pessoal.view_funcionario'
    table_class = FuncionarioTable
    filterset_class = FuncionarioFilter
    def get(self, request, *args, **kwargs):
        # atalho: redireciona se a pesquisa for uma matricula exata
        pesquisa = request.GET.get('pesquisa')
        if pesquisa and pesquisa.isdigit():
            funcionario = Funcionario.objects.filter(
                matricula=pesquisa, 
                filial__in=request.user.profile.filiais.all()
            ).first()
            if funcionario:
                return redirect('pessoal:funcionario_update', pk=funcionario.id)
        return super().get(request, *args, **kwargs)
    def get_queryset(self):
        qs = Funcionario.objects.filter(filial__in=self.request.user.profile.filiais.all()).select_related('filial__empresa').prefetch_related('contratos__cargo').order_by('matricula')
        pesquisa = self.request.GET.get('pesquisa')
        if pesquisa:
            query = Q()
            for termo in pesquisa.split():
                query &= Q(nome__icontains=termo)
            qs = qs.filter(query)
        return qs.distinct()
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        queryset_base = self.get_queryset()
        filter_obj = self.filterset_class(self.request.GET, queryset=queryset_base, user=self.request.user)
        table_data = filter_obj.qs if self.request.GET else queryset_base.none() # dados em branco se nao tem filtros
        if self.request.GET and not table_data.exists():
            messages.warning(self.request, _("Nenhum resultado encontrado com os critérios informados"))
        context.update({
            'filter': filter_obj,
            'table': self.table_class(table_data).config(self.request, filter_obj)
        })
        return context


class ContratoManagementView(LoginRequiredMixin, PermissionRequiredMixin, CSVExportMixin, BaseCreateView):
    model = Contrato
    form_class = ContratoForm
    template_name = 'pessoal/contratos.html'
    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        eid = self.request.GET.get('edit')
        func_id = self.kwargs['pk']
        kwargs['instance'] = get_object_or_404(Contrato, id=eid, funcionario_id=func_id) if eid else Contrato(funcionario_id=func_id)
        return kwargs
    def get_permission_required(self):
        if self.request.method == 'POST':
            return ('pessoal.change_contrato',) if self.request.GET.get('edit') else ('pessoal.add_contrato',)
        return ('pessoal.view_contrato',)
    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        func = ctx['form'].instance.funcionario
        qs = Contrato.objects.select_related('cargo__setor').prefetch_related('historico_turnos__turno').filter(funcionario=func).order_by('-inicio')
        f = ContratoFilter(self.request.GET, queryset=qs)
        ctx.update({
            'table': ContratoTable(f.qs).config(self.request, filter_obj=f),
            'funcionario': func,
            'is_update': ctx['form'].instance.pk is not None,
        })
        return ctx
    def get_success_url(self):
        return self.request.path
    def post(self, request, *args, **kwargs):
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return self._handle_turno_ajax(request)
        return super().post(request, *args, **kwargs)
    def _handle_turno_ajax(self, request):
        try:
            data = json.loads(request.body)
            action = data.get('action')            
            if action == 'save_turno':
                th_id = data.get('id') or None
                contrato = get_object_or_404(Contrato, id=data['contrato_id'], funcionario_id=self.kwargs['pk'])                
                if th_id:
                    th = get_object_or_404(TurnoHistorico, id=th_id, contrato=contrato)
                    th.turno_id = data['turno']
                    th.inicio_vigencia = data['inicio_vigencia']
                    th.fim_vigencia = data.get('fim_vigencia') or None
                    th.full_clean()
                    th.save()
                else:
                    th = TurnoHistorico(
                        contrato=contrato,
                        turno_id=data['turno'],
                        inicio_vigencia=data['inicio_vigencia'],
                        fim_vigencia=data.get('fim_vigencia') or None
                    )
                    th.full_clean()
                    th.save()                
                messages.success(request, DEFAULT_MESSAGES.get('updated' if th_id else 'created'))
                return JsonResponse({'status': 'success', 'reload': True})            
            elif action == 'delete_turno':
                th = get_object_or_404(TurnoHistorico, id=data['id'], contrato__funcionario_id=self.kwargs['pk'])
                th.delete()
                messages.success(request, DEFAULT_MESSAGES.get('deleted'))
                return JsonResponse({'status': 'success', 'reload': True})            
            return JsonResponse({'status': 'error', 'message': _('Ação inválida')}, status=400)        
        except ValidationError as e:
            if hasattr(e, 'message_dict'):
                errors = []
                for field, msgs in e.message_dict.items():
                    if field == '__all__':
                        errors.extend(msgs)
                    else:
                        errors.extend([f"{field}: {msg}" for msg in msgs])
                msg = ', '.join(errors)
            elif hasattr(e, 'messages'):
                msg = ', '.join(e.messages)
            else:
                msg = str(e)
            return JsonResponse({'status': 'error', 'message': msg}, status=400)
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=400)


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
            'dias_semana_choices': Turno.DiaSemana.choices,
        })
        if turno_id and turno_id != 'novo':
            self._processar_filtro(context, turno_id)
        elif turno_id == 'novo':
            context.update({
                'turno': None,
                'dias_ciclo': OrderedDict(),
            })        
        return context
    def _processar_filtro(self, context, turno_id):
        # carrega dados do turno selecionado
        try:
            turno = Turno.objects.prefetch_related('dias').get(id=turno_id)
            context.update({
                'turno': turno,
                'dias_ciclo': self._montar_ciclo(turno),
            })
        except Turno.DoesNotExist:
            messages.error(self.request, DEFAULT_MESSAGES.get('filterError'))
    def _montar_ciclo(self, turno):
        # monta estrutura de dias do ciclo com horarios
        dias_ciclo = OrderedDict()        
        for pos in range(turno.dias_ciclo):
            dias_ciclo[pos] = {
                'id': None,
                'eh_folga': False,
                'tolerancia': 10,
                'horarios': []
            }        
        for dia in turno.dias.all():
            dias_ciclo[dia.posicao_ciclo] = {
                'id': dia.id,
                'eh_folga': dia.eh_folga,
                'tolerancia': dia.tolerancia,
                'horarios': self._extrair_horarios(dia)
            }        
        return dias_ciclo
    def _extrair_horarios(self, turno_dia):
        # extrai horarios do JSONField e converte para lista
        if not turno_dia.horarios:
            return [{'entrada': '', 'saida': ''}]        
        if isinstance(turno_dia.horarios, list):
            return turno_dia.horarios        
        if isinstance(turno_dia.horarios, dict) and 'entrada' in turno_dia.horarios:
            return [turno_dia.horarios]        
        return [{'entrada': '', 'saida': ''}]    
    def post(self, request, *args, **kwargs):
        # salva turno e seus dias via AJAX
        try:
            data = json.loads(request.body)
            action = data.get('action')            
            if action == 'save_turno':
                return self._salvar_turno(data)
            elif action == 'delete_turno':
                return self._deletar_turno(data)            
            return JsonResponse({'status': 'error', 'message': _('Ação inválida')}, status=400)            
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=400)    
    def _salvar_turno(self, data):
        # salva/atualiza turno e dias do ciclo
        with transaction.atomic():
            turno_id = data.get('turno_id')            
            if turno_id:
                turno = Turno.objects.get(id=turno_id)
                turno.nome = data.get('nome')
                turno.dias_ciclo = int(data.get('dias_ciclo'))
                turno.inicio = datetime.strptime(data.get('inicio'), '%Y-%m-%d').date()
                turno.inicia_em = data.get('inicia_em')
                turno.save()
            else:
                turno = Turno.objects.create(
                    nome=data.get('nome'),
                    dias_ciclo=int(data.get('dias_ciclo')),
                    inicio=datetime.strptime(data.get('inicio'), '%Y-%m-%d').date(),
                    inicia_em=data.get('inicia_em')
                )            
            dias_data = data.get('dias', [])            
            # validacao de conflitos
            self._validar_conflitos(dias_data)            
            ids_enviados = [d['id'] for d in dias_data if d.get('id')]
            TurnoDia.objects.filter(turno=turno).exclude(id__in=ids_enviados).delete()            
            for dia_item in dias_data:
                TurnoDia.objects.update_or_create(
                    id=dia_item.get('id'),
                    defaults={
                        'turno': turno,
                        'posicao_ciclo': dia_item['posicao_ciclo'],
                        'horarios': self._parse_horarios(dia_item.get('horarios', [])),
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
    def _validar_conflitos(self, dias_data):
        # valida conflito de horarios entre dias
        for dia in dias_data:
            if dia.get('eh_folga'):
                continue            
            posicao = dia['posicao_ciclo']
            horarios = dia.get('horarios', [])            
            # valida conflitos dentro do mesmo dia
            for i, h1 in enumerate(horarios):
                for h2 in horarios[i+1:]:
                    if self._horarios_conflitam(h1, h2):
                        raise ValidationError(f"{DEFAULT_MESSAGES.get('recordOverlap')} <br>{_('Posição')}: {posicao}")
    def _horarios_conflitam(self, h1, h2):
        # verifica se dois horarios se sobrepoem
        return h1['entrada'] < h2['saida'] and h1['saida'] > h2['entrada']    
    def _parse_horarios(self, horarios_list):
        # converte lista de horarios para JSON, removendo entradas vazias
        if not horarios_list:
            return []        
        return [
            {'entrada': h['entrada'], 'saida': h['saida']}
            for h in horarios_list
            if h.get('entrada') and h.get('saida')
        ]    
    def _deletar_turno(self, data):
        # deleta turno (se nao tiver historico vinculado)
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
            return JsonResponse({'status': 'error', 'message': _('Turno não encontrado')}, status=404)


class AfastamentoListView(LoginRequiredMixin, PermissionRequiredMixin, CSVExportMixin, BaseListView):
    model = Afastamento
    template_name = 'pessoal/afastamentos.html'
    permission_required = 'pessoal.view_afastamento'
    filterset_class = AfastamentoFilter
    def get_queryset(self):
        self.funcionario = get_object_or_404(
            Funcionario, 
            pk=self.kwargs.get('pk'), 
            filial__in=self.request.user.profile.filiais.all()
        )
        return Afastamento.objects.filter(funcionario=self.funcionario).order_by('-data_afastamento')
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        f = self.filterset_class(self.request.GET, queryset=self.get_queryset())
        context['table'] = AfastamentoTable(f.qs).config(self.request, filter_obj=f)
        context['funcionario'] = self.funcionario
        return context


class DependenteListView(LoginRequiredMixin, PermissionRequiredMixin, CSVExportMixin, SingleTableView):
    model = Dependente
    template_name = 'pessoal/dependentes.html'
    permission_required = 'pessoal.view_dependente'
    table_class = DependenteTable
    def get_queryset(self):
        funcionario_id = self.kwargs.get('pk')
        filiais_pemitidas = self.request.user.profile.filiais.all()
        self.funcionario = get_object_or_404(
            Funcionario,
            pk=funcionario_id, 
            filial__in=filiais_pemitidas
        )        
        return Dependente.objects.select_related('funcionario').filter(funcionario=self.funcionario).order_by('nome')
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['funcionario'] = self.funcionario
        return context


class EventoListView(LoginRequiredMixin, PermissionRequiredMixin, CSVExportMixin, BaseListView):
    model = Evento
    template_name = 'pessoal/eventos.html'
    permission_required = 'pessoal.view_evento'
    def get_queryset(self):
        return Evento.objects.all().select_related('grupo').order_by('nome')
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        f = EventoFilter(self.request.GET, queryset=self.get_queryset())
        context['table'] = EventoTable(f.qs).config(self.request, filter_obj=f)
        return context


class EventoRelatedListView(LoginRequiredMixin, BaseListView):
    template_name = 'pessoal/eventos_related.html'
    CONFIG_MAP = {
        'empresa': (EventoEmpresa, EventoEmpresaFilter, EventoEmpresaTable, _('Empresa')),
        'cargo': (EventoCargo, EventoCargoFilter, EventoCargoTable, _('Cargo')),
        'funcionario': (EventoFuncionario, EventoFuncionarioFilter, EventoFuncionarioTable, _('Funcionário')),
    }
    def dispatch(self, request, *args, **kwargs):
        self.related = kwargs.get('related', '').lower()
        self.related_id = kwargs.get('pk')
        if self.related not in self.CONFIG_MAP:
            return redirect('index')
        perm = f'pessoal.view_evento{self.related}'
        if not request.user.has_perm(perm):
            raise PermissionDenied
        return super().dispatch(request, *args, **kwargs)
    def get_queryset(self):
        model, _, _, _ = self.CONFIG_MAP[self.related]
        filiais = self.request.user.profile.filiais.all()
        # lookup dinamico: mapeia o filtro de ID e o caminho da filial
        filtros = {
            'empresa':     {'filiais__in': filiais},
            'cargo':       {'cargo_id': self.related_id, 'filiais__in': filiais},
            'funcionario': {'funcionario_id': self.related_id, 'funcionario__filial__in': filiais}
        }
        qs = model.objects.filter(**filtros[self.related]).select_related('evento', 'motivo')
        if hasattr(model, 'filiais'):
            qs = qs.prefetch_related('filiais')
        if not self.request.GET.get('fim'):
            qs = qs.exclude(fim__lt=date.today())
        return qs.distinct().order_by('evento__nome', '-inicio')
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        model_class, filter_class, table_class, related_label = self.CONFIG_MAP[self.related]
        f = filter_class(self.request.GET, queryset=self.get_queryset(), user=self.request.user)
        table = table_class(f.qs, related=self.related, request=self.request)
        context.update({
            'table': table.config(self.request, filter_obj=f),
            'related': self.related,
            'related_id': self.related_id,
            'related_label': related_label,
            'model_obj': self.get_related_object()
        })
        return context
    def get_related_object(self):
        if self.related == 'empresa': return None
        model = Cargo if self.related == 'cargo' else Funcionario
        return get_object_or_404(model, pk=self.related_id)


class GrupoEventoListView(LoginRequiredMixin, PermissionRequiredMixin, AjaxableListMixin, BaseListView):
    model = GrupoEvento
    template_name = 'pessoal/grupos_evento.html'
    permission_required = 'pessoal.view_grupoevento'
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        qs = GrupoEvento.objects.all().order_by('nome')
        context['table'] = GrupoEventoTable(qs).config(self.request)
        return context


class MotivoReajusteListView(LoginRequiredMixin, PermissionRequiredMixin, BaseListView):
    model = MotivoReajuste
    template_name = 'pessoal/motivos_reajuste.html'
    permission_required = 'pessoal.view_motivoreajuste'
    def get_queryset(self):
        return MotivoReajuste.objects.all().order_by('nome')
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        f = MotivoReajusteFilter(self.request.GET, queryset=self.get_queryset())
        context['table'] = MotivoReajusteTable(f.qs).config(self.request, filter_obj=f)
        return context

class EventoFrequenciaListView(LoginRequiredMixin, PermissionRequiredMixin, AjaxableListMixin, CSVExportMixin, BaseListView):
    model = EventoFrequencia
    template_name = 'pessoal/eventos_frequencia.html'
    permission_required = 'pessoal.view_eventofrequencia'
    filterset_class = EventoFrequenciaFilter
    def get_queryset(self):
        return EventoFrequencia.objects.all().order_by('nome')
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        f = self.filterset_class(self.request.GET, queryset=self.get_queryset())
        context['table'] = EventoFrequenciaTable(f.qs, request=self.request).config(self.request, filter_obj=f)
        return context

# Metodos ADD
class SetorCreateView(LoginRequiredMixin, PermissionRequiredMixin, BaseCreateView):
    model = Setor
    form_class = SetorForm
    template_name = 'pessoal/setor_add.html'
    success_url = reverse_lazy('pessoal:setor_create')
    permission_required = 'pessoal.add_setor'


class CargoCreateView(LoginRequiredMixin, PermissionRequiredMixin, BaseCreateView):
    model = Cargo
    form_class = CargoForm
    template_name = 'pessoal/cargo_add.html'
    permission_required = 'pessoal.add_cargo'
    success_url = reverse_lazy('pessoal:cargo_create')

class FuncionarioCreateView(LoginRequiredMixin, PermissionRequiredMixin, BaseCreateView):
    model = Funcionario
    form_class = FuncionarioForm
    template_name = 'pessoal/funcionario_add.html'
    permission_required = 'pessoal.add_funcionario'
    def form_valid(self, form):
        response = super().form_valid(form)
        foto_data = self.request.POST.get('foto_data_url')
        if foto_data:
            self.object.process_and_save_photo(foto_data)
        return response
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['setores'] = Setor.objects.all().order_by('nome')
        return context
    def get_success_url(self):
        if self.request.user.has_perm('pessoal.change_funcionario'):
            return reverse('pessoal:funcionario_update', kwargs={'pk': self.object.id})
        return reverse('pessoal:funcionario_list')


class AfastamentoCreateView(LoginRequiredMixin, PermissionRequiredMixin, BaseCreateView):
    model = Afastamento
    form_class = AfastamentoForm
    template_name = 'pessoal/afastamento_add.html'
    permission_required = 'pessoal.add_afastamento'
    def get_success_url(self):
        return reverse('pessoal:afastamento_list', kwargs={'pk': self.kwargs.get('pk')})
    def get_initial(self):
        initial = super().get_initial()
        filiais_permitidas = self.request.user.profile.filiais.all()
        self.funcionario = get_object_or_404(
            Funcionario, 
            pk=self.kwargs.get('pk'), 
            filial__in=filiais_permitidas
        )
        initial['funcionario'] = self.funcionario
        return initial
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['funcionario'] = self.funcionario
        return context

class DependenteCreateView(LoginRequiredMixin, PermissionRequiredMixin, BaseCreateView):
    model = Dependente
    form_class = DependenteForm
    template_name = 'pessoal/dependente_add.html'
    permission_required = 'pessoal.add_dependente'
    def get_success_url(self):
        return reverse('pessoal:dependente_create', kwargs={'pk': self.kwargs.get('pk')})
    def get_initial(self):
        initial = super().get_initial()
        filiais_permitidas = self.request.user.profile.filiais.all()
        self.funcionario = get_object_or_404(
            Funcionario, 
            pk=self.kwargs.get('pk'), 
            filial__in=filiais_permitidas
        )
        initial['funcionario'] = self.funcionario
        return initial
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['funcionario'] = self.funcionario
        return context


class EventoCreateView(LoginRequiredMixin, PermissionRequiredMixin, BaseCreateView):
    model = Evento
    form_class = EventoForm
    template_name = 'pessoal/evento_add.html'
    success_url = reverse_lazy('pessoal:evento_list')
    permission_required = 'pessoal.add_evento'



class EventoRelatedCreateView(LoginRequiredMixin, BaseCreateView):
    template_name = 'pessoal/evento_related_add.html'
    def dispatch(self, request, *args, **kwargs):
        self.related = kwargs.get('related', '').lower()
        self.related_id = kwargs.get('pk')
        perm_name = f"pessoal.view_evento{self.related}"
        if self.related not in ['empresa', 'cargo', 'funcionario']:
            messages.error(request, f"{DEFAULT_MESSAGES['400']} <b>pessoal:evento_related_add, invalid related</b>")
            return redirect('index')
        if not request.user.has_perm(perm_name):
            return redirect('handler', code=403)
        return super().dispatch(request, *args, **kwargs)
    def get_form_class(self):
        forms_map = {
            'empresa': EventoEmpresaForm,
            'cargo': EventoCargoForm,
            'funcionario': EventoFuncionarioForm,
        }
        return forms_map.get(self.related)
    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        if self.related in ['empresa', 'cargo']:
            kwargs['user'] = self.request.user
        return kwargs
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        user = self.request.user
        filiais_autorizadas = user.profile.filiais.all()
        context['related'] = self.related
        context['props'] = get_event_vars_master()
        if self.related == 'empresa':
            context['model'] = {'id': 0, 'pk': 0}
        elif self.related == 'cargo':
            context['model'] = get_object_or_404(Cargo, pk=self.related_id)
        elif self.related == 'funcionario':
            context['model'] = get_object_or_404(Funcionario, pk=self.related_id, filial__in=filiais_autorizadas)
        return context
    def get_success_url(self):
        return reverse('pessoal:eventorelated_list', kwargs={'related': self.related.upper(), 'pk': self.related_id})
    

class GrupoEventoCreateView(LoginRequiredMixin, PermissionRequiredMixin, AjaxableFormMixin, BaseCreateView):
    model = GrupoEvento
    form_class = GrupoEventoForm
    template_name = 'pessoal/grupo_evento_add.html'
    permission_required = 'pessoal.add_grupoevento'
    success_url = reverse_lazy('pessoal:grupoevento_create')


class MotivoReajusteCreateView(LoginRequiredMixin, PermissionRequiredMixin, AjaxableFormMixin, BaseCreateView):
    model = MotivoReajuste
    form_class = MotivoReajusteForm
    template_name = 'pessoal/motivo_reajuste_add.html'
    permission_required = 'pessoal.add_motivoreajuste'
    success_url = reverse_lazy('pessoal:motivoreajuste_create')

class EventoFrequenciaCreateView(LoginRequiredMixin, PermissionRequiredMixin, BaseCreateView):
    model = EventoFrequencia
    form_class = EventoFrequenciaForm
    template_name = 'pessoal/evento_frequencia_add.html'
    success_url = reverse_lazy('pessoal:eventofrequencia_create')
    permission_required = 'pessoal.add_eventofrequencia'

# Metodos UPDATE
class SetorUpdateView(LoginRequiredMixin, PermissionRequiredMixin, BaseUpdateView):
    model = Setor
    form_class = SetorForm
    template_name = 'pessoal/setor_id.html'
    permission_required = 'pessoal.change_setor'
    def get_success_url(self):
        return reverse('pessoal:setor_update', kwargs={'pk': self.object.id})


class CargoUpdateView(LoginRequiredMixin, PermissionRequiredMixin, BaseUpdateView):
    model = Cargo
    form_class = CargoForm
    template_name = 'pessoal/cargo_id.html'
    permission_required = 'pessoal.change_cargo'
    def get_success_url(self):
        return reverse('pessoal:cargo_update', kwargs={'pk': self.object.id})


class FuncionarioUpdateView(LoginRequiredMixin, PermissionRequiredMixin,  BaseUpdateView):
    model = Funcionario
    form_class = FuncionarioForm
    template_name = 'pessoal/funcionario_id.html'
    permission_required = 'pessoal.view_funcionario' # exige apenas view para carregar usuario (mesmo sem perm de update)
    def dispatch(self, request, *args, **kwargs):
        funcionario = self.get_object()
        if request.method == 'POST' and not request.user.has_perm('pessoal.change_funcionario'):
            return redirect('handler', 403)
        if not funcionario.F_eh_editavel:
            messages.error( request, _("Não é possível alterar dados de funcionários desligados"))
            return redirect('pessoal:funcionario_list', id=funcionario.id)
        return super().dispatch(request, *args, **kwargs)
    def get_form(self, form_class=None):
        form = super().get_form(form_class)
        # se o usuario nao tem permissao update, desabilita os campos
        if not self.request.user.has_perm('pessoal.change_funcionario'):
            self.disabled = True
            for field in form.fields.values():
                field.disabled = True
        return form
    def form_valid(self, form):
        if not self.request.user.has_perm('pessoal.change_funcionario'):
            raise PermissionDenied
        response = super().form_valid(form)
        return response
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['disabled'] = getattr(self, 'disabled', False)
        context['setores'] = Setor.objects.all().order_by('nome')
        return context
    def get_success_url(self):
        return reverse('pessoal:funcionario_update', kwargs={'pk': self.object.id})




class FrequenciaManagementView(LoginRequiredMixin, BaseTemplateView):
    template_name = 'pessoal/frequencia.html'
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        matricula = self.request.GET.get('matricula', '')
        competencia_str = self.request.GET.get('competencia', date.today().strftime('%Y-%m'))
        context.update({
            'filtro_form': {'matricula': matricula, 'competencia': competencia_str},
            'eventos_choices': EventoFrequencia.objects.all(),
            'evento_folga_id': None,  # sobrescrito em _processar_filtro se settings existir
        })
        if matricula and competencia_str:
            self._processar_filtro(context, matricula, competencia_str)
        return context
    def _processar_filtro(self, context, matricula, competencia_str):
        """Carrega dados do mes para o funcionario/competencia informados"""
        try:
            funcionario = Funcionario.objects.get(matricula=matricula)
            competencia = datetime.strptime(competencia_str, '%Y-%m').date()
            ultimo_dia = competencia.replace(day=calendar.monthrange(competencia.year, competencia.month)[1])
            # contrato mais recente vigente no mes (abrange contratos iniciados no meio do mes)
            contrato = funcionario.contratos.filter(
                inicio__lte=ultimo_dia
            ).filter(
                Q(fim__gte=competencia) | Q(fim__isnull=True)
            ).order_by('-inicio').first()

            if not contrato:
                messages.warning(self.request, f"Funcionário {matricula} sem contrato vigente em {competencia_str}")
                return

            # evento de folga configurado na filial do funcionario
            settings_obj = PessoalSettings.objects.filter(filial=funcionario.filial).first()
            evento_folga_id = settings_obj.config.frequencia.evento_folga_id if settings_obj else None

            frequencias = Frequencia.objects.filter(
                contrato=contrato,
                inicio__year=competencia.year,
                inicio__month=competencia.month
            ).select_related('evento').order_by('inicio')

            # todos os contratos vigentes no mes (para calcular dias bloqueados)
            contratos_mes = funcionario.contratos.filter(
                inicio__lte=ultimo_dia
            ).filter(
                Q(fim__gte=competencia) | Q(fim__isnull=True)
            ).order_by('inicio')

            context.update({
                'contrato': contrato,
                'funcionario': funcionario,
                'competencia': competencia,
                'evento_folga_id': evento_folga_id,
                'dias_mes': self._montar_calendario(competencia, frequencias, contrato, contratos_mes),
            })
        except Funcionario.DoesNotExist:
            messages.error(self.request, f"Matrícula {matricula} não encontrada")
        except Exception as e:
            messages.error(self.request, f"Erro ao carregar frequência: {type(e).__name__}")
    def _montar_calendario(self, competencia, frequencias, contrato, contratos_mes):
        """Monta OrderedDict com todos os dias do mes, frequencias existentes e escala do turno"""
        dias_mes = OrderedDict()
        num_dias = calendar.monthrange(competencia.year, competencia.month)[1]
        tz_local = timezone.get_current_timezone()
        ultimo_dia = competencia.replace(day=num_dias)

        # inicializa estrutura de cada dia
        for dia_num in range(1, num_dias + 1):
            data = date(competencia.year, competencia.month, dia_num)
            # dia bloqueado se nao ha contrato vigente nesta data
            tem_contrato = any(c.inicio <= data <= (c.fim or date.max) for c in contratos_mes)
            dias_mes[data] = {
                'horarios': [],
                'escala': None,
                'escala_json': '[]',
                'escala_folga': False,
                'bloqueado': not tem_contrato,
            }

        # preenche com frequencias ja persistidas no banco
        for freq in frequencias:
            inicio_local = freq.inicio.astimezone(tz_local)
            fim_local = freq.fim.astimezone(tz_local) if freq.fim else None
            dia = inicio_local.date()
            if dia in dias_mes:
                dias_mes[dia]['horarios'].append({
                    'id': freq.id,
                    'entrada': inicio_local.strftime('%H:%M'),
                    'saida': fim_local.strftime('%H:%M') if fim_local else '',
                    'evento_id': freq.evento_id,
                    'observacao': freq.observacao or '',
                    'dia_inteiro': freq.evento.dia_inteiro,
                    'origem': self._get_origem(freq),
                })

        # busca todos os turnos vigentes no mes de uma vez (evita N+1)
        turnos_hist = list(
            contrato.historico_turnos.filter(
                inicio_vigencia__lte=ultimo_dia
            ).filter(
                Q(fim_vigencia__gte=competencia) | Q(fim_vigencia__isnull=True)
            ).order_by('inicio_vigencia').select_related('turno').prefetch_related('turno__dias')
        )
        self._preencher_escala(dias_mes, turnos_hist)
        return dias_mes

    def _preencher_escala(self, dias_mes, turnos_hist):
        """Preenche escala planejada de cada dia com base no ciclo do turno vigente"""
        if not turnos_hist:
            return
        # pre-carrega dias de todos os turnos em memoria (zero queries no loop)
        dias_por_turno = {th.turno_id: list(th.turno.dias.all()) for th in turnos_hist}
        for data, info in dias_mes.items():
            # turno vigente para este dia especifico (reversed = mais recente primeiro)
            turno_hist = next((
                th for th in reversed(turnos_hist)
                if th.inicio_vigencia <= data and (th.fim_vigencia is None or th.fim_vigencia >= data)
            ), None)
            if not turno_hist:
                continue
            turno = turno_hist.turno
            dias_turno = dias_por_turno[turno.id]
            pos = (data - turno.inicio).days % turno.dias_ciclo if turno.dias_ciclo > 0 else 0
            turno_dia = next((d for d in dias_turno if d.posicao_ciclo == pos), None)
            if not turno_dia or turno_dia.eh_folga:
                info['escala'] = 'Folga'
                info['escala_folga'] = True
            elif turno_dia.horarios:
                info['escala'] = ' | '.join(f"{h.get('entrada','')}–{h.get('saida','')}" for h in turno_dia.horarios)
                info['escala_json'] = json.dumps(turno_dia.horarios)

    def _get_origem(self, freq):
        """Determina a origem do registro: fonte externa, manual ou sistema"""
        if freq.metadados.get('fonte'):
            return freq.metadados['fonte']
        return 'manual' if freq.editado else 'sistema'

    def post(self, request, *args, **kwargs):
        """Recebe frequencias via AJAX e persiste no banco"""
        try:
            data = json.loads(request.body)
            matricula = data.get('matricula')
            competencia_str = data.get('competencia')
            funcionario = Funcionario.objects.get(matricula=matricula)
            competencia = datetime.strptime(competencia_str, '%Y-%m').date()
            ultimo_dia = competencia.replace(day=calendar.monthrange(competencia.year, competencia.month)[1])
            contrato = funcionario.contratos.filter(
                inicio__lte=ultimo_dia
            ).filter(
                Q(fim__gte=competencia) | Q(fim__isnull=True)
            ).order_by('-inicio').first()
            if not contrato:
                return JsonResponse({'status': 'error', 'message': 'Contrato não encontrado'}, status=400)
            self._salvar_frequencias(data.get('frequencias', []), contrato)
            messages.success(request, DEFAULT_MESSAGES.get('updated_plural'))
            return JsonResponse({'status': 'success'})
        except Funcionario.DoesNotExist:
            return JsonResponse({'status': 'error', 'message': 'Funcionário não encontrado'}, status=404)
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=400)

    def _salvar_frequencias(self, frequencias_data, contrato):
        """Sincroniza frequencias do mes: remove ausentes, upsert presentes"""
        if not frequencias_data:
            return
        ids_enviados = [f['id'] for f in frequencias_data if f.get('id')]
        dt_ref = datetime.strptime(frequencias_data[0]['dia'], '%Y-%m-%d')
        tz = timezone.get_current_timezone()
        with transaction.atomic():
            # remove registros do mes que nao vieram no payload (foram deletados na UI)
            Frequencia.objects.filter(
                contrato=contrato,
                inicio__year=dt_ref.year,
                inicio__month=dt_ref.month
            ).exclude(id__in=ids_enviados).delete()

            for item in frequencias_data:
                evento = EventoFrequencia.objects.get(id=item['evento_id'])
                entrada = self._parse_datetime(item['dia'], '00:00', tz) if evento.dia_inteiro else self._parse_datetime(item['dia'], item['entrada'], tz)
                if evento.dia_inteiro:
                    # fim = inicio do dia seguinte - 1s para cobrir o dia inteiro sem overlap em UTC
                    dia_seguinte = (datetime.strptime(item['dia'], '%Y-%m-%d') + timedelta(days=1)).strftime('%Y-%m-%d')
                    saida = self._parse_datetime(dia_seguinte, '00:00', tz) - timedelta(seconds=1)
                else:
                    saida = self._parse_datetime(item['dia'], item['saida'], tz)

                # validacao de overlap: Inicio A < Fim B AND Fim A > Inicio B
                if Frequencia.objects.filter(
                    contrato=contrato, inicio__lt=saida, fim__gt=entrada
                ).exclude(id=item.get('id')).exists():
                    raise ValidationError(f"Conflito de horários no dia {item['dia']}.")

                Frequencia.objects.update_or_create(
                    id=item.get('id'),
                    defaults={
                        'contrato': contrato, 'evento': evento,
                        'inicio': entrada, 'fim': saida,
                        'observacao': item.get('observacao', ''),
                        'editado': True,
                        # metadados nunca alterado aqui — imutavel apos importacao
                    }
                )

    def _parse_datetime(self, dia_str, hora_str, tz_local):
        """Converte strings de data e hora para datetime aware no timezone local"""
        dt_naive = datetime.strptime(f"{dia_str} {hora_str}", '%Y-%m-%d %H:%M')
        return timezone.make_aware(dt_naive, tz_local)  # make_aware trata DST corretamente



class AfastamentoUpdateView(LoginRequiredMixin, PermissionRequiredMixin, BaseUpdateView):
    model = Afastamento
    form_class = AfastamentoForm
    template_name = 'pessoal/afastamento_id.html'
    permission_required = 'pessoal.change_afastamento'
    def dispatch(self, request, *args, **kwargs):
        # so permite edicao de afastamentos de funcionarios ativos
        afastamento = self.get_object()
        if not afastamento.funcionario.F_eh_editavel:
            messages.error(
                request,
                _('Não é possível alterar dados de funcionários desligados')
            )
            return redirect('pessoal:afastamento_list', pk=afastamento.funcionario.id)
        return super().dispatch(request, *args, **kwargs)
    def get_context_data(self, **kwargs):
        # injeta o objeto 'funcionario' no contexto para exibicao no template
        context = super().get_context_data(**kwargs)
        context['funcionario'] = self.object.funcionario
        return context
    def get_success_url(self):
        return reverse('pessoal:afastamento_update', kwargs={'pk': self.object.id})

class DependenteUpdateView(LoginRequiredMixin, PermissionRequiredMixin, BaseUpdateView):
    model = Dependente
    form_class = DependenteForm
    template_name = 'pessoal/dependente_id.html'
    permission_required = 'pessoal.change_dependente'
    def dispatch(self, request, *args, **kwargs):
        self.object = self.get_object()
        if not self.object.funcionario.F_eh_editavel:
            messages.error(request, _('Não é possível alterar dados de funcionários desligados'))
            return redirect('pessoal:dependente_update', pk=self.object.id)
        return super().dispatch(request, *args, **kwargs)
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['funcionario'] = self.object.funcionario
        return context
    def get_success_url(self):
        return reverse('pessoal:dependente_update', kwargs={'pk': self.object.id})


class EventoUpdateView(LoginRequiredMixin, PermissionRequiredMixin, BaseUpdateView):
    model = Evento
    form_class = EventoForm
    template_name = 'pessoal/evento_id.html'
    permission_required = 'pessoal.change_evento'
    def get_success_url(self):
        return reverse('pessoal:evento_update', kwargs={'pk': self.object.id})


class EventoRelatedUpdateView(LoginRequiredMixin, BaseUpdateView):
    template_name = 'pessoal/evento_related_id.html'
    def dispatch(self, request, *args, **kwargs):
        self.related = kwargs.get('related').lower()
        self.related_id = kwargs.get('pk')
        perm_name = f"pessoal.change_evento{self.related}"
        if self.related not in ['empresa', 'cargo', 'funcionario']:
            messages.error(
                request, 
                f"{DEFAULT_MESSAGES['400']} <b>evento_related_update [bad request]</b>"
            )
            return redirect('index')
        if not request.user.has_perm(perm_name):
            return redirect('handler', 403)
        return super().dispatch(request, *args, **kwargs)
    def get_queryset(self):
        # define o modelo alvo
        if self.related == 'empresa':
            return EventoEmpresa.objects.all()
        elif self.related == 'cargo':
            return EventoCargo.objects.all()
        elif self.related == 'funcionario':
            return EventoFuncionario.objects.all()
        return None
    def get_form_class(self):
        # define o form alvo
        forms_map = {
            'empresa': EventoEmpresaForm,
            'cargo': EventoCargoForm,
            'funcionario': EventoFuncionarioForm,
        }
        return forms_map.get(self.related)
    def get_context_data(self, **kwargs):
        # prepara p contexto para o template
        context = super().get_context_data(**kwargs)
        evento_obj = self.object # O objeto já foi carregado pela UpdateView
        context['related'] = self.related
        context['evento'] = evento_obj
        if self.related == 'empresa':
            context['model'] = {'id': 0, 'pk': 0}
        elif self.related == 'cargo':
            context['model'] = evento_obj.cargo
        elif self.related == 'funcionario':
            context['model'] = evento_obj.funcionario
        return context
    def get_success_url(self):
        return reverse('pessoal:eventorelated_update', kwargs={ 'related': self.related.upper(), 'pk': self.related_id })


class GrupoEventoUpdateView(LoginRequiredMixin, PermissionRequiredMixin, BaseUpdateView):
    model = GrupoEvento
    form_class = GrupoEventoForm
    template_name = 'pessoal/grupo_evento_id.html'
    context_object_name = 'grupo_evento'
    permission_required = 'pessoal.change_grupoevento'
    def get_success_url(self):
        return reverse('pessoal:grupoevento_update', kwargs={'pk': self.object.id})


class MotivoReajusteUpdateView(LoginRequiredMixin, PermissionRequiredMixin, BaseUpdateView):
    model = MotivoReajuste
    form_class = MotivoReajusteForm
    template_name = 'pessoal/motivo_reajuste_id.html'
    context_object_name = 'motivo_reajuste'
    permission_required = 'pessoal.change_motivoreajuste'
    def get_success_url(self):
        return reverse('pessoal:motivoreajuste_update', kwargs={'pk': self.object.id})


class EventoFrequenciaUpdateView(LoginRequiredMixin, PermissionRequiredMixin, BaseUpdateView):
    model = EventoFrequencia
    form_class = EventoFrequenciaForm
    template_name = 'pessoal/evento_frequencia_id.html'
    permission_required = 'pessoal.change_eventofrequencia'
    success_url = reverse_lazy('pessoal:eventofrequencia_list')

# Metodos DELETE
class SetorDeleteView(LoginRequiredMixin, PermissionRequiredMixin, BaseDeleteView):
    model = Setor
    permission_required = 'pessoal.delete_setor'
    success_url = reverse_lazy('pessoal:setor_list')

class CargoDeleteView(LoginRequiredMixin, PermissionRequiredMixin, BaseDeleteView):
    model = Cargo
    permission_required = 'pessoal.delete_cargo'
    success_url = reverse_lazy('pessoal:cargo_list')


class FuncionarioDeleteView(LoginRequiredMixin, PermissionRequiredMixin, BaseDeleteView):
    model = Funcionario
    permission_required = 'pessoal.delete_funcionario'
    success_url = reverse_lazy('pessoal:funcionario_list')


class ContratoDeleteView(LoginRequiredMixin, PermissionRequiredMixin, BaseDeleteView):
    model = Contrato
    permission_required = 'pessoal.delete_contrato'
    def get_queryset(self):
        return self.model.objects.filter(funcionario_id=self.kwargs['pk_func'])
    def get_success_url(self):
        return reverse('pessoal:contrato_list', kwargs={'pk': self.kwargs['pk_func']})

class AfastamentoDeleteView(LoginRequiredMixin, PermissionRequiredMixin, BaseDeleteView):
    model = Afastamento
    permission_required = 'pessoal.delete_afastamento'
    def get_success_url(self):
        return reverse('pessoal:funcionario_update', kwargs={'pk': self.object.funcionario.id})

class DependenteDeleteView(LoginRequiredMixin, PermissionRequiredMixin, BaseDeleteView):
    model = Dependente
    permission_required = 'pessoal.delete_dependente'
    def get_success_url(self):
        return reverse('pessoal:funcionario_update', kwargs={'pk': self.object.funcionario.id})

class EventoDeleteView(LoginRequiredMixin, PermissionRequiredMixin, BaseDeleteView):
    model = Evento
    permission_required = 'pessoal.delete_evento'
    success_url = reverse_lazy('pessoal:evento_list')


class EventoRelatedDeleteView(LoginRequiredMixin, BaseDeleteView):
    success_url = reverse_lazy('pessoal:evento_list')
    def dispatch(self, request, *args, **kwargs):
        self.related = kwargs.get('related', '').lower()
        perm_name = f"pessoal.delete_evento{self.related}"
        if self.related not in ['empresa', 'cargo', 'funcionario']:
            messages.error(request, f"{DEFAULT_MESSAGES['400']} <b>evento_related_delete [bad request: invalid related]</b>")
            return redirect('pessoal:eventos')
        if not request.user.has_perm(perm_name):
            return redirect('handler', 403)
        return super().dispatch(request, *args, **kwargs)
    def get_queryset(self):
        # retorna modelos alvo
        if self.related == 'empresa':
            return EventoEmpresa.objects.all()
        elif self.related == 'cargo':
            return EventoCargo.objects.all()
        elif self.related == 'funcionario':
            return EventoFuncionario.objects.all()
        return None

class GrupoEventoDeleteView(LoginRequiredMixin, PermissionRequiredMixin, BaseDeleteView):
    model = GrupoEvento
    permission_required = 'pessoal.delete_grupoevento'
    success_url = reverse_lazy('pessoal:grupoevento_list')


class MotivoReajusteDeleteView(LoginRequiredMixin, PermissionRequiredMixin, BaseDeleteView):
    model = MotivoReajuste
    permission_required = 'pessoal.delete_motivoreajuste'
    success_url = reverse_lazy('pessoal:motivoreajuste_list')

class EventoFrequenciaDeleteView(LoginRequiredMixin, PermissionRequiredMixin, BaseDeleteView):
    model = EventoFrequencia
    permission_required = 'pessoal.delete_eventofrequencia'
    success_url = reverse_lazy('pessoal:eventofrequencia_list')


# Metodos Ajax
class FormulaValidateView(LoginRequiredMixin, View):
    """
    View para validacao de sintaxe Python/Asteval em formulas
    Processa requisicoes JSON e retorna o resultado da avaliacao segura
    """
    raise_exception = True
    def post(self, request, *args, **kwargs):
        try:
            data = json.loads(request.body)
            expression = data.get('valor', '').strip()
            if not expression:
                return JsonResponse({
                    'status': 'erro', 
                    'type': 'Empty', 
                    'message': 'Expressao vazia'
                }, status=400)
            result = asteval_run(expression, get_event_vars_master(True))
            if not result['status']:
                return JsonResponse({
                    'status': 'erro', 
                    'type': result['type'], 
                    'message': result['message'] 
                }, status=400)
            return JsonResponse({
                'status': 'ok', 
                'result': result['result'], 
                'msg': 'Sintaxe Python/Asteval válida'
            }, status=200)
        except json.JSONDecodeError as e:
            return JsonResponse({'status': 'erro', 'cod': 2, 'msg': 'JSON inválido'}, status=400)
        except Exception as e:
            return JsonResponse({'status': 'erro', 'cod': 3, 'msg': str(e)}, status=500)


# APIs
class FuncionarioViewSet(viewsets.ModelViewSet):
    queryset = Funcionario.objects.filter(status='A').order_by('nome')
    serializer_class = FuncionarioSerializer
    permission_classes = [permissions.DjangoModelPermissions]
    filterset_fields = ['matricula']