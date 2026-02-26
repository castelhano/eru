import json
# import calendar
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
from core.models import Filial
from core.extras import asteval_run
from core.constants import DEFAULT_MESSAGES
from core.mixins import AjaxableListMixin, AjaxableFormMixin, CSVExportMixin
from core.views_base import (BaseListView, BaseCreateView, BaseUpdateView, BaseDeleteView)

# Pessoal App - Models
from pessoal.models import (
    PessoalSettings, Setor, Cargo, Funcionario, Contrato, Afastamento, Dependente, Evento, GrupoEvento, MotivoReajuste, EventoEmpresa, 
    EventoCargo, EventoFuncionario, TurnoHistorico, Frequencia, EventoFrequencia, FrequenciaImport
)
# Pessoal App
from pessoal.forms import (
    PessoalSettingsForm, SetorForm, CargoForm, FuncionarioForm, ContratoForm, AfastamentoForm, DependenteForm, EventoForm, GrupoEventoForm, EventoEmpresaForm, 
    EventoCargoForm, EventoFuncionarioForm, MotivoReajusteForm, EventoFrequenciaForm, FrequenciaImportForm
)
from pessoal.filters import (
    FuncionarioFilter, ContratoFilter, AfastamentoFilter, CargoFilter, EventoFilter, EventoEmpresaFilter, EventoCargoFilter, 
    EventoFuncionarioFilter, MotivoReajusteFilter, EventoFrequenciaFilter
)
from pessoal.tables import (
    FuncionarioTable, ContratoTable, SetorTable, CargoTable, AfastamentoTable, DependenteTable, EventoTable, GrupoEventoTable, 
    MotivoReajusteTable, EventoEmpresaTable, EventoCargoTable, EventoFuncionarioTable, EventoFrequenciaTable
)
from pessoal.serializers import FuncionarioSerializer
from pessoal.services.folha.collectors import get_event_vars_master
from pessoal.schemas import PessoalSettingsSchema

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







import csv
import json
from datetime import datetime, timedelta
from django.db import transaction
from django.http import JsonResponse
from django.shortcuts import render
from django.views import View
from django.utils import timezone
from collections import defaultdict
import hashlib
class FrequenciaImportView(LoginRequiredMixin, View):
    """
    View para importação de registros de ponto eletrônico.
    
    Fluxo:
    1. GET: Exibe formulário de upload
    2. POST (step=upload): Processa arquivo e retorna preview dos dados
    3. POST (step=confirm): Persiste os registros validados no banco
    """
    
    template_name = 'pessoal/frequencia_import.html'
    
    def get(self, request):
        """Renderiza formulário inicial"""
        form = FrequenciaImportForm(user=request.user)
        context = {
            'form': form,
            'origens_info': self._get_origens_info(),
        }
        return render(request, self.template_name, context)
    
    def post(self, request):
        """Processa upload ou confirmação de importação"""
        step = request.POST.get('step', 'upload')
        
        if step == 'upload':
            return self._handle_upload(request)
        elif step == 'confirm':
            return self._handle_confirm(request)
        
        return JsonResponse({'error': 'Ação inválida'}, status=400)
    
    def _handle_upload(self, request):
        """
        Processa arquivo enviado e retorna preview dos dados.
        Valida formato, identifica funcionários e agrupa batidas por dia.
        """
        form = FrequenciaImportForm(request.POST, request.FILES, user=request.user)
        
        if not form.is_valid():
            return JsonResponse({
                'error': 'Formulário inválido',
                'errors': form.errors
            }, status=400)
        
        try:
            filial = form.cleaned_data['filial']
            origem = form.cleaned_data['origem']
            arquivo = request.FILES['arquivo']
            
            # Parse do arquivo baseado na origem
            registros, erros = self._parse_arquivo(arquivo, origem, filial)
            
            if not registros:
                erro_msg = 'Nenhum registro válido encontrado no arquivo'
                if erros:
                    erro_msg += f'\n\nDetalhes dos erros:\n' + '\n'.join(erros[:5])
                return JsonResponse({
                    'error': erro_msg
                }, status=400)
            
            # Agrupa e prepara dados para preview
            preview_data = self._preparar_preview(registros, filial)
            
            # Salva dados na sessão para confirmação posterior
            request.session['import_data'] = {
                'filial_id': filial.id,
                'origem': origem,
                'registros': registros,
            }
            request.session.modified = True
            
            return JsonResponse({
                'success': True,
                'preview': preview_data,
                'totais': {
                    'registros': len(registros),
                    'funcionarios': len(preview_data['funcionarios']),
                    'periodo': preview_data['periodo'],
                }
            })
            
        except Exception as e:
            return JsonResponse({
                'error': f'Erro ao processar arquivo: {str(e)}'
            }, status=500)
    
    def _handle_confirm(self, request):
        """
        Persiste registros aprovados no banco de dados.
        Cria FrequenciaImport e gera Frequencia agrupadas.
        """
        import_data = request.session.get('import_data')
        
        if not import_data:
            return JsonResponse({
                'error': 'Dados de importação não encontrados. Por favor, faça upload novamente.'
            }, status=400)
        
        try:
            with transaction.atomic():
                filial = Filial.objects.get(id=import_data['filial_id'])
                origem = import_data['origem']
                registros = import_data['registros']
                
                # Importa registros brutos
                imports_criados = []
                for reg in registros:
                    freq_import = FrequenciaImport.objects.create(
                        contrato_id=reg['contrato_id'],
                        data_hora=reg['data_hora'],
                        origem=origem,
                        nsr=reg.get('nsr'),
                        num_relogio=reg.get('num_relogio'),
                        latitude=reg.get('latitude'),
                        longitude=reg.get('longitude'),
                        hash_verificacao=reg.get('hash'),
                    )
                    imports_criados.append(freq_import)
                
                # Agrupa batidas e cria Frequencia
                frequencias_criadas = self._gerar_frequencias(imports_criados, origem)
                
                # Limpa sessão
                del request.session['import_data']
                request.session.modified = True
                
                messages.success(
                    request,
                    f'Importação concluída: {len(imports_criados)} batidas processadas, '
                    f'{len(frequencias_criadas)} frequências geradas.'
                )
                
                return JsonResponse({
                    'success': True,
                    'redirect': '/pessoal/frequencia/',  # ajustar URL conforme necessário
                    'totais': {
                        'batidas': len(imports_criados),
                        'frequencias': len(frequencias_criadas),
                    }
                })
                
        except Exception as e:
            return JsonResponse({
                'error': f'Erro ao importar: {str(e)}'
            }, status=500)
    
    def _parse_arquivo(self, arquivo, origem, filial):
        """
        Parse do arquivo baseado no tipo de origem.
        Retorna tupla (lista de dicionários com dados normalizados, lista de erros).
        """
        if origem == 'AFD':
            return self._parse_afd(arquivo, filial)
        elif origem == 'CSV':
            return self._parse_csv(arquivo, filial)
        elif origem == 'APP':
            return self._parse_app(arquivo, filial)
        elif origem == 'WEB':
            return self._parse_web(arquivo, filial)
        
        raise ValueError(f'Origem não suportada: {origem}')
    
    def _parse_afd(self, arquivo, filial):
        """
        Parser para arquivo AFD (padrão Portaria 1510/2009 MTE).
        Formato: linha com tipo de registro + campos de tamanho fixo.
        
        Exemplo linha tipo 3 (marcação):
        3XXXXXXXXXXXXNNNNNNNNNNDDMMYYYYHHMMSS
        """
        from django.db.models import Q
        
        registros = []
        erros = []
        
        try:
            conteudo = arquivo.read().decode('latin-1')
            linhas = conteudo.splitlines()
            
            erros.append(f"DEBUG: {len(linhas)} linhas no arquivo AFD")
            
            for idx, linha in enumerate(linhas, start=1):
                linha = linha.strip()
                if not linha:
                    continue
                    
                if linha[0] != '3':  # tipo 3 = marcação de ponto
                    continue
                
                try:
                    # Layout AFD simplificado (adaptar conforme padrão real)
                    if len(linha) < 37:
                        erros.append(f"Linha {idx}: tamanho insuficiente ({len(linha)} caracteres)")
                        continue
                    
                    tipo = linha[0]
                    nsr = linha[1:13].strip()
                    pis = linha[13:25].strip()
                    data_str = linha[25:33]  # DDMMYYYY
                    hora_str = linha[33:37]  # HHMM
                    
                    # Busca funcionário pelo PIS (assumindo que está no CPF ou num campo específico)
                    # Ajuste conforme seu modelo
                    funcionario = Funcionario.objects.filter(
                        Q(cpf=pis) | Q(matricula=pis),
                        filial=filial
                    ).first()
                    
                    if not funcionario:
                        erros.append(f"Linha {idx}: PIS/Matrícula {pis} não encontrado")
                        continue
                    
                    # Monta datetime com timezone
                    try:
                        dt_naive = datetime.strptime(
                            f"{data_str} {hora_str}", 
                            '%d%m%Y %H%M'
                        )
                    except ValueError as e:
                        erros.append(f"Linha {idx}: Data/hora inválida ({data_str} {hora_str})")
                        continue
                    
                    data_hora = timezone.make_aware(
                        dt_naive, 
                        timezone.get_current_timezone()
                    )
                    
                    # Contrato vigente
                    data_marcacao = dt_naive.date()
                    contrato = funcionario.contratos.filter(
                        inicio__lte=data_marcacao
                    ).filter(
                        Q(fim__gte=data_marcacao) | Q(fim__isnull=True)
                    ).order_by('-inicio').first()
                    
                    if not contrato:
                        erros.append(f"Linha {idx}: Funcionário {pis} sem contrato em {data_marcacao}")
                        continue
                    
                    # Hash para integridade
                    hash_str = f"{pis}{data_str}{hora_str}{nsr}"
                    hash_value = hashlib.md5(hash_str.encode()).hexdigest()
                    
                    registros.append({
                        'contrato_id': contrato.id,
                        'funcionario_nome': funcionario.nome,
                        'funcionario_matricula': funcionario.matricula,
                        'data_hora': data_hora.isoformat(),
                        'nsr': nsr,
                        'num_relogio': None,
                        'hash': hash_value,
                    })
                    
                except Exception as e:
                    erros.append(f"Linha {idx}: Erro ao processar - {str(e)}")
                    continue
            
            if registros:
                erros.append(f"DEBUG: {len(registros)} registros AFD processados")
                
        except Exception as e:
            erros.append(f"Erro geral ao processar AFD: {str(e)}")
        
        return registros, erros
    
    def _parse_csv(self, arquivo, filial):
        """
        Parser para CSV genérico.
        Formato esperado: matricula,data,hora[,equipamento]
        """
        from django.db.models import Q
        
        registros = []
        erros = []
        conteudo = arquivo.read().decode('utf-8-sig')
        
        try:
            reader = csv.DictReader(conteudo.splitlines())
            linhas = list(reader)
            
            if not linhas:
                erros.append("Arquivo CSV vazio ou sem dados")
                return registros, erros
            
            # Log das colunas encontradas
            colunas = linhas[0].keys() if linhas else []
            erros.append(f"DEBUG: Colunas encontradas: {', '.join(colunas)}")
            
            for idx, row in enumerate(linhas, start=2):  # linha 2 porque linha 1 é header
                try:
                    # Busca campos com nomes flexíveis
                    matricula = (row.get('matricula') or row.get('Matricula') or 
                                row.get('MATRICULA') or row.get('mat') or '').strip()
                    data_str = (row.get('data') or row.get('Data') or 
                               row.get('DATA') or '').strip()
                    hora_str = (row.get('hora') or row.get('Hora') or 
                               row.get('HORA') or '').strip()
                    
                    if not matricula or not data_str or not hora_str:
                        erros.append(f"Linha {idx}: campos vazios (mat={matricula}, data={data_str}, hora={hora_str})")
                        continue
                    
                    # Busca funcionário
                    funcionario = Funcionario.objects.filter(
                        matricula=matricula,
                        filial=filial
                    ).first()
                    
                    if not funcionario:
                        # Tenta buscar em qualquer filial para dar feedback melhor
                        func_outra_filial = Funcionario.objects.filter(matricula=matricula).first()
                        if func_outra_filial:
                            erros.append(f"Linha {idx}: Funcionário {matricula} existe mas não pertence à filial selecionada")
                        else:
                            erros.append(f"Linha {idx}: Funcionário com matrícula {matricula} não encontrado")
                        continue
                    
                    # Parse data/hora - aceita vários formatos
                    dt_naive = None
                    formatos_data = ['%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y']
                    formatos_hora = ['%H:%M', '%H:%M:%S']
                    
                    for fmt_data in formatos_data:
                        for fmt_hora in formatos_hora:
                            try:
                                dt_naive = datetime.strptime(
                                    f"{data_str} {hora_str}",
                                    f"{fmt_data} {fmt_hora}"
                                )
                                break
                            except ValueError:
                                continue
                        if dt_naive:
                            break
                    
                    if not dt_naive:
                        erros.append(f"Linha {idx}: Formato de data/hora inválido ({data_str} {hora_str})")
                        continue
                    
                    data_hora = timezone.make_aware(
                        dt_naive,
                        timezone.get_current_timezone()
                    )
                    
                    # Contrato vigente
                    contrato = funcionario.contratos.filter(
                        inicio__lte=dt_naive.date()
                    ).filter(
                        Q(fim__gte=dt_naive.date()) | Q(fim__isnull=True)
                    ).order_by('-inicio').first()
                    
                    if not contrato:
                        erros.append(f"Linha {idx}: Funcionário {matricula} sem contrato vigente em {data_str}")
                        continue
                    
                    hash_str = f"{matricula}{data_str}{hora_str}"
                    hash_value = hashlib.md5(hash_str.encode()).hexdigest()
                    
                    registros.append({
                        'contrato_id': contrato.id,
                        'funcionario_nome': funcionario.nome,
                        'funcionario_matricula': funcionario.matricula,
                        'data_hora': data_hora.isoformat(),
                        'nsr': None,
                        'num_relogio': row.get('equipamento', row.get('Equipamento', None)),
                        'hash': hash_value,
                    })
                    
                except Exception as e:
                    erros.append(f"Linha {idx}: Erro ao processar - {str(e)}")
                    continue
            
            if registros:
                erros.append(f"DEBUG: {len(registros)} registros processados com sucesso")
            
        except Exception as e:
            erros.append(f"Erro geral ao processar CSV: {str(e)}")
        
        return registros, erros
    
    def _parse_app(self, arquivo, filial):
        """Parser para JSON do app mobile (com GPS)"""
        from django.db.models import Q
        
        registros = []
        erros = []
        
        try:
            conteudo = arquivo.read().decode('utf-8')
            dados = json.loads(conteudo)
            
            if not isinstance(dados, list):
                erros.append("JSON deve ser uma lista de registros")
                return registros, erros
            
            erros.append(f"DEBUG: {len(dados)} registros encontrados no JSON")
            
            for idx, item in enumerate(dados, start=1):
                try:
                    matricula = item.get('matricula')
                    if not matricula:
                        erros.append(f"Registro {idx}: campo 'matricula' não encontrado")
                        continue
                    
                    funcionario = Funcionario.objects.filter(
                        matricula=matricula,
                        filial=filial
                    ).first()
                    
                    if not funcionario:
                        erros.append(f"Registro {idx}: Funcionário {matricula} não encontrado na filial")
                        continue
                    
                    # Parse timestamp - aceita vários formatos
                    timestamp_str = item.get('timestamp')
                    if not timestamp_str:
                        erros.append(f"Registro {idx}: campo 'timestamp' não encontrado")
                        continue
                    
                    # Tenta parser ISO format primeiro
                    try:
                        dt_naive = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                        if dt_naive.tzinfo:
                            data_hora = dt_naive.astimezone(timezone.get_current_timezone())
                        else:
                            data_hora = timezone.make_aware(dt_naive, timezone.get_current_timezone())
                    except:
                        # Tenta outros formatos
                        for fmt in ['%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M:%S']:
                            try:
                                dt_naive = datetime.strptime(timestamp_str, fmt)
                                data_hora = timezone.make_aware(dt_naive, timezone.get_current_timezone())
                                break
                            except:
                                continue
                        else:
                            erros.append(f"Registro {idx}: formato de timestamp inválido ({timestamp_str})")
                            continue
                    
                    contrato = funcionario.contratos.filter(
                        inicio__lte=data_hora.date()
                    ).filter(
                        Q(fim__gte=data_hora.date()) | Q(fim__isnull=True)
                    ).order_by('-inicio').first()
                    
                    if not contrato:
                        erros.append(f"Registro {idx}: Funcionário {matricula} sem contrato vigente em {data_hora.date()}")
                        continue
                    
                    hash_str = f"{matricula}{timestamp_str}"
                    hash_value = hashlib.md5(hash_str.encode()).hexdigest()
                    
                    registros.append({
                        'contrato_id': contrato.id,
                        'funcionario_nome': funcionario.nome,
                        'funcionario_matricula': funcionario.matricula,
                        'data_hora': data_hora.isoformat(),
                        'latitude': item.get('latitude'),
                        'longitude': item.get('longitude'),
                        'hash': hash_value,
                    })
                    
                except Exception as e:
                    erros.append(f"Registro {idx}: Erro ao processar - {str(e)}")
                    continue
            
            if registros:
                erros.append(f"DEBUG: {len(registros)} registros processados com sucesso")
                
        except json.JSONDecodeError as e:
            erros.append(f"Erro ao decodificar JSON: {str(e)}")
        except Exception as e:
            erros.append(f"Erro geral ao processar JSON: {str(e)}")
        
        return registros, erros
    
    def _parse_web(self, arquivo, filial):
        """Parser para registros do portal web (similar ao APP)"""
        return self._parse_app(arquivo, filial)
    
    def _preparar_preview(self, registros, filial):
        """
        Agrupa registros por funcionário e dia para preview.
        Detecta possíveis problemas (batidas ímpares, horários suspeitos).
        """
        agrupado = defaultdict(lambda: defaultdict(list))
        
        for reg in registros:
            dt = datetime.fromisoformat(reg['data_hora'])
            dia = dt.date()
            agrupado[reg['funcionario_matricula']][dia].append({
                'hora': dt.strftime('%H:%M'),
                'data_hora': reg['data_hora'],
            })
        
        # Ordena batidas
        for matricula in agrupado:
            for dia in agrupado[matricula]:
                agrupado[matricula][dia].sort(key=lambda x: x['hora'])
        
        # Monta estrutura para frontend
        funcionarios = []
        data_min = None
        data_max = None
        
        for matricula, dias in agrupado.items():
            func_reg = next(r for r in registros if r['funcionario_matricula'] == matricula)
            
            dias_lista = []
            for dia, batidas in sorted(dias.items()):
                if data_min is None or dia < data_min:
                    data_min = dia
                if data_max is None or dia > data_max:
                    data_max = dia
                
                # Detecta problemas
                alertas = []
                if len(batidas) % 2 != 0:
                    alertas.append('Número ímpar de batidas')
                
                # Verifica intervalos muito curtos (< 1h)
                for i in range(len(batidas) - 1):
                    h1 = datetime.fromisoformat(batidas[i]['data_hora'])
                    h2 = datetime.fromisoformat(batidas[i+1]['data_hora'])
                    if (h2 - h1).total_seconds() < 3600:
                        alertas.append('Intervalo curto entre batidas')
                        break
                
                dias_lista.append({
                    'data': dia.strftime('%d/%m/%Y'),
                    'batidas': batidas,
                    'total': len(batidas),
                    'alertas': alertas,
                })
            
            funcionarios.append({
                'matricula': matricula,
                'nome': func_reg['funcionario_nome'],
                'dias': dias_lista,
                'total_dias': len(dias_lista),
            })
        
        periodo = f"{data_min.strftime('%d/%m/%Y')} a {data_max.strftime('%d/%m/%Y')}"
        
        return {
            'funcionarios': funcionarios,
            'periodo': periodo,
        }
    
    def _gerar_frequencias(self, imports, origem):
        """
        Agrupa batidas consecutivas em pares entrada/saída e cria Frequencia.
        Batidas ímpares geram registros incompletos (fim=null).
        """
        from django.db.models import Q
        
        # Evento padrão (ajustar conforme necessidade)
        evento_padrao = EventoFrequencia.objects.filter(
            nome__icontains='jornada'
        ).first() or EventoFrequencia.objects.first()
        
        # Agrupa por contrato e dia
        agrupado = defaultdict(list)
        for imp in imports:
            dia = imp.data_hora.date()
            agrupado[(imp.contrato_id, dia)].append(imp)
        
        frequencias = []
        
        for (contrato_id, dia), batidas in agrupado.items():
            # Ordena por horário
            batidas.sort(key=lambda x: x.data_hora)
            
            # Agrupa em pares entrada/saída
            for i in range(0, len(batidas), 2):
                entrada = batidas[i]
                saida = batidas[i+1] if i+1 < len(batidas) else None
                
                freq = Frequencia.objects.create(
                    contrato_id=contrato_id,
                    evento=evento_padrao,
                    inicio=entrada.data_hora,
                    fim=saida.data_hora if saida else None,
                    editado=False,
                    metadados={
                        'fonte': origem,
                        'import_ids': [entrada.id, saida.id if saida else None],
                        'batida_entrada': entrada.data_hora.isoformat(),
                        'batida_saida': saida.data_hora.isoformat() if saida else None,
                    }
                )
                frequencias.append(freq)
        
        return frequencias
    
    def _get_origens_info(self):
        """Retorna informações sobre cada tipo de origem"""
        return {
            'AFD': {
                'nome': 'Arquivo AFD (Relógio Físico)',
                'formato': '.txt',
                'descricao': 'Padrão Portaria 1510/2009 do MTE',
            },
            'CSV': {
                'nome': 'Planilha CSV',
                'formato': '.csv',
                'descricao': 'Colunas: matricula, data, hora',
            },
            'APP': {
                'nome': 'App Móvel (GPS)',
                'formato': '.json',
                'descricao': 'JSON com timestamp e coordenadas',
            },
            'WEB': {
                'nome': 'Portal Web',
                'formato': '.json',
                'descricao': 'Registros do portal do funcionário',
            },
        }




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
        filiais = self.request.user.profile.filiais.all()
        if self.related == 'empresa':
            return EventoEmpresa.objects.filter(filiais__in=filiais).distinct()
        elif self.related == 'cargo':
            return EventoCargo.objects.filter(filiais__in=filiais).distinct()
        elif self.related == 'funcionario':
            return EventoFuncionario.objects.filter(funcionario__filial__in=filiais)
        return None
    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        if self.related in ['empresa', 'cargo']:
            kwargs['user'] = self.request.user
        return kwargs
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