import json
from datetime import date
# Django Core
from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin, PermissionRequiredMixin
from django.core.exceptions import ValidationError, PermissionDenied
from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction
from django.db.models import Q, Count
from django.http import JsonResponse
from django.shortcuts import render, redirect, get_object_or_404
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
from core.views_base import (BaseListView, BaseCreateView, BaseUpdateView, BaseDeleteView)
from core.model_base import resolve_refs

# Pessoal App - Models
from pessoal.models import (
    PessoalSettings, Setor, Cargo, Funcionario, Contrato, Afastamento, Dependente, Evento, GrupoEvento, MotivoReajuste, EventoEmpresa, 
    EventoCargo, EventoFuncionario, TurnoHistorico, EventoFrequencia
)
# Pessoal App
from pessoal.forms import (
    PessoalSettingsForm, SetorForm, CargoForm, FuncionarioForm, ContratoForm, AfastamentoForm, DependenteForm, RescisaoForm, EventoForm, GrupoEventoForm, EventoEmpresaForm, 
    EventoCargoForm, EventoFuncionarioForm, MotivoReajusteForm, EventoFrequenciaForm
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
        if not created and self.request.GET.get('reset_default') == 'true':
        # se definido url param ?reset_default=true, reseta das configuracoes para o padrao
            obj.config = {}
            obj.save()
            messages.success(self.request, DEFAULT_MESSAGES.get('reset_default'))
        return obj
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        if self.object:
            from pessoal.schemas import AfastamentoSchema
            print(AfastamentoSchema.model_json_schema())
            schema = resolve_refs(json.loads(json.dumps(
                self.object.get_schema().model_json_schema(mode='serialization'),
                cls=DjangoJSONEncoder
            )))
            context['schema_json'] = json.dumps(schema, cls=DjangoJSONEncoder)
            context['config_json'] = json.dumps(self.object.config.model_dump(), cls=DjangoJSONEncoder)
        else:
            context['schema_json'] = json.dumps({})
            context['config_json'] = json.dumps({})
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
        disabled = not func.F_eh_editavel
        ctx.update({
            'table': ContratoTable(f.qs, disabled=disabled).config(self.request, filter_obj=f),
            'funcionario': func,
            'is_update': ctx['form'].instance.pk is not None,
            'disabled': disabled,
        })
        return ctx
    def get_success_url(self):
        return self.request.path
    def post(self, request, *args, **kwargs):
        self.object = self.get_object()
        if not self.object.funcionario.F_eh_editavel:
            messages.error(request, _("Nao e possivel alterar dados de funcionarios desligados"))
            return redirect(self.get_success_url())
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
            return redirect('core:index')
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
            return redirect('core:index')
        if not request.user.has_perm(perm_name):
            return redirect('core:handler', code=403)
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
        if request.method == 'POST':
            if not request.user.has_perm('pessoal.change_funcionario'):
                return redirect('core:handler', 403)
            if not funcionario.F_eh_editavel:
                messages.error( request, _("Não é possível alterar dados de funcionários desligados"))
                return redirect('pessoal:funcionario_update', pk=funcionario.id)
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
        context['disabled'] = getattr(self, 'disabled', False) or not self.object.F_eh_editavel
        context['setores'] = Setor.objects.all().order_by('nome')
        return context
    def get_success_url(self):
        return reverse('pessoal:funcionario_update', kwargs={'pk': self.object.id})


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
            return redirect('core:index')
        if not request.user.has_perm(perm_name):
            return redirect('core:handler', 403)
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
        context['props'] = get_event_vars_master()
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
    def dispatch(self, request, *args, **kwargs):
        self.related = kwargs.get('related', '').lower()
        perm_name = f"pessoal.delete_evento{self.related}"
        if self.related not in ['empresa', 'cargo', 'funcionario']:
            messages.error(request, f"{DEFAULT_MESSAGES['400']} <b>evento_related_delete [bad request: invalid related]</b>")
            return redirect('pessoal:eventos')
        if not request.user.has_perm(perm_name):
            return redirect('core:handler', 403)
        return super().dispatch(request, *args, **kwargs)
    def get_success_url(self):
        obj = self.get_object()
        related_id = 0
        if self.related != 'empresa':
            related_id = getattr(obj, f"{self.related}_id")
        return reverse_lazy('pessoal:eventorelated_list', kwargs={
            'related': self.related,
            'pk': related_id
        })
    def get_queryset(self):
        mapping = {
            'empresa': EventoEmpresa,
            'cargo': EventoCargo,
            'funcionario': EventoFuncionario
        }
        model = mapping.get(self.related)
        return model.objects.all() if model else None


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