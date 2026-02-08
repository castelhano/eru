import json
from datetime import date, datetime, timedelta
from django.views import View
from django.core.exceptions import PermissionDenied
from django.urls import reverse_lazy, reverse
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.mixins import LoginRequiredMixin, PermissionRequiredMixin
from django.contrib import messages
from django.db import transaction
from django.db.models import Q, Count
from django.http import JsonResponse
from django.utils.timezone import now
from django.utils.translation import gettext_lazy as _
from django_tables2 import SingleTableView
# core
from core.constants import DEFAULT_MESSAGES
from core.mixins import AjaxableListMixin, AjaxableFormMixin, CSVExportMixin
from core.views_base import BaseListView, BaseTemplateView, BaseCreateView, BaseUpdateView, BaseDeleteView
from core.extras import asteval_run
from core.models import Empresa, Filial
from pessoal.folha.collectors import get_event_vars_master, get_period
# third-party
from rest_framework import viewsets, permissions
from .serializers import FuncionarioSerializer
# local app
from .models import (
    Setor, Cargo, Funcionario, Contrato, Afastamento, Dependente, Evento, GrupoEvento, MotivoReajuste, EventoEmpresa, 
    EventoCargo, EventoFuncionario, Turno, Frequencia, EventoFrequencia
)
from .forms import (
    SetorForm, CargoForm, FuncionarioForm, ContratoForm, AfastamentoForm, DependenteForm, EventoForm, GrupoEventoForm, 
    EventoEmpresaForm, EventoCargoForm, EventoFuncionarioForm, MotivoReajusteForm, TurnoForm, TurnoDiaFormSet, FrequenciaForm,
    inlineformset_factory, ContratoFrequenciaForm
)
from .filters import (
    FuncionarioFilter, ContratoFilter, AfastamentoFilter, CargoFilter, EventoFilter, EventoEmpresaFilter, EventoCargoFilter, EventoFuncionarioFilter,
    MotivoReajusteFilter
)
from .tables import (
    FuncionarioTable, ContratoTable, SetorTable, CargoTable, AfastamentoTable, DependenteTable, EventoTable, GrupoEventoTable, MotivoReajusteTable, 
    EventoEmpresaTable, EventoCargoTable, EventoFuncionarioTable, TurnoTable
)
# ....................
class SetorListView(LoginRequiredMixin, PermissionRequiredMixin, AjaxableListMixin, SingleTableView):
    model = Setor
    login_url = '/handler/403'
    table_class = SetorTable
    template_name = 'pessoal/setores.html'
    permission_required = 'pessoal.view_setor'
    def get_queryset(self):
        hoje = now().date()
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
    # def get_queryset(self):
    #     queryset = Cargo.objects.all().order_by('nome')
    #     setor_id = self.request.GET.get('cargo__setor') or self.request.GET.get('setor')
    #     if setor_id:
    #         queryset = queryset.filter(setor_id=setor_id)
    #     return queryset

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
        if eid: 
            kwargs['instance'] = get_object_or_404(Contrato, id=eid, funcionario_id=func_id)
        else:
            kwargs['instance'] = Contrato(funcionario_id=func_id)
        return kwargs
    def get_permission_required(self):
        if self.request.method == 'POST':
            return ('pessoal.change_contrato',) if self.request.GET.get('edit') else ('pessoal.add_contrato',)
        return ('pessoal.view_contrato',)
    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        func = ctx['form'].instance.funcionario 
        qs = Contrato.objects.select_related('cargo__setor').filter(funcionario=func).order_by('-inicio')
        f = ContratoFilter(self.request.GET, queryset=qs)
        ctx.update({
            'table': ContratoTable(f.qs).config(self.request, filter_obj=f),
            'funcionario': func,
            'is_update': ctx['form'].instance.pk is not None
        })
        return ctx
    def get_success_url(self):
        return self.request.path


class TurnoManagementView(LoginRequiredMixin, PermissionRequiredMixin, BaseUpdateView):
    model = Turno
    form_class = TurnoForm
    template_name = 'pessoal/turnos.html'
    permission_required = 'pessoal.view_turno'
    def get_object(self, queryset=None):
        pk = self.kwargs.get('pk') or self.request.GET.get('edit')
        return get_object_or_404(Turno, pk=pk) if pk else None
    def get_context_data(self, **kwargs):
        instance = self.get_object()
        self.object = instance 
        kwargs.setdefault('form', self.form_class(instance=instance))
        kwargs['dias_formset'] = TurnoDiaFormSet(
            self.request.POST if self.request.method == 'POST' else None,
            instance=instance, 
            prefix='dias'
        )
        kwargs['table'] = TurnoTable(Turno.objects.all().order_by('nome')).config(self.request)
        kwargs['is_update'] = instance is not None
        return super().get_context_data(**kwargs)
    def form_valid(self, form):
        ctx = self.get_context_data(form=form)
        dias_formset = ctx['dias_formset']
        if form.is_valid() and dias_formset.is_valid():
            self.object = form.save()
            dias_formset.instance = self.object
            dias_formset.save()
            return super().form_valid(form)
        return self.form_invalid(form)
    def get_success_message(self, cleaned_data):
        if self.request.GET.get('edit') or self.kwargs.get('pk'):
            return DEFAULT_MESSAGES.get('updated')
        return DEFAULT_MESSAGES.get('created')
    def get_success_url(self):
        return reverse('pessoal:turno_list')


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
    context_object_name = 'dependentes'
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


# Metodos UPDATE
class SetorUpdateView(LoginRequiredMixin, PermissionRequiredMixin, BaseUpdateView):
    model = Setor
    form_class = SetorForm
    template_name = 'pessoal/setor_id.html' # Mantendo o seu template original
    context_object_name = 'setor'           # Permite usar {{ setor.nome }} no HTML
    permission_required = 'pessoal.change_setor'
    def get_success_url(self):
        return reverse('pessoal:setor_update', kwargs={'pk': self.object.id})


class CargoUpdateView(LoginRequiredMixin, PermissionRequiredMixin, BaseUpdateView):
    model = Cargo
    form_class = CargoForm
    template_name = 'pessoal/cargo_id.html'
    context_object_name = 'cargo'
    permission_required = 'pessoal.change_cargo'
    def get_success_url(self):
        return reverse('pessoal:cargo_update', kwargs={'pk': self.object.id})


class FuncionarioUpdateView(LoginRequiredMixin, PermissionRequiredMixin,  BaseUpdateView):
    model = Funcionario
    form_class = FuncionarioForm
    template_name = 'pessoal/funcionario_id.html'
    context_object_name = 'funcionario'
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

# from django.utils import timezone 
# class FrequenciaManagementView(LoginRequiredMixin, PermissionRequiredMixin, BaseUpdateView):
#     model = Contrato
#     form_class = ContratoFrequenciaForm
#     template_name = 'pessoal/frequencia.html'
#     permission_required = 'pessoal.view_frequencia'

#     def get_object(self, queryset=None):
#         val = self.request.GET.get('contrato') or self.kwargs.get('pk')
#         if not val: return None
#         obj = Contrato.objects.select_related('funcionario__filial', 'cargo').filter(
#             funcionario__matricula=val,
#             funcionario__filial__in=self.request.user.profile.filiais.all()
#         ).first()
#         if val and not obj:
#             messages.warning(self.request, DEFAULT_MESSAGES.get('emptyQuery'))
#         return obj

#     def get_context_data(self, **kwargs):
#         self.object = self.get_object()
#         if not self.object: return super().get_context_data(formset=None, **kwargs)

#         m, a = int(self.request.GET.get('mes', date.today().month)), int(self.request.GET.get('ano', date.today().year))
#         ini, fim = get_period(m, a)
#         qs = Frequencia.objects.filter(contrato=self.object, inicio__date__range=[ini, fim]).select_related('evento')
        
#         initial_data, extra_forms = [], 0
#         if self.request.method == 'GET':
#             datas_mes = [ini + timedelta(days=x) for x in range((fim - ini).days + 1)]
#             datas_no_banco = set(qs.values_list('inicio__date', flat=True))
#             initial_data = [{'data_referencia': d} for d in datas_mes if d not in datas_no_banco]
#             extra_forms = len(initial_data)

#         # Factory dinâmica para suportar a grade de dias vazios
#         fs_class = inlineformset_factory(Contrato, Frequencia, form=FrequenciaForm, extra=extra_forms, can_delete=True)
#         kwargs.update({
#             'formset': fs_class(self.request.POST or None, instance=self.object, queryset=qs, initial=initial_data, prefix='dias'),
#             'mes_ref': m, 'ano_ref': a, 'is_update': True
#         })
#         return super().get_context_data(**kwargs)
#     def form_valid(self, form):
#         self.object = self.get_object()
#         ctx = self.get_context_data(form=form)
#         fs = ctx.get('formset')

#         if fs and fs.is_valid():
#             try:
#                 with transaction.atomic():
#                     ev_padrao = EventoFrequencia.objects.filter(categoria='PRD').first()
                    
#                     for f in fs:
#                         # 1. Trata deleção (se o checkbox DELETE foi marcado)
#                         if fs.can_delete and fs._should_delete_form(f):
#                             if f.instance.pk:
#                                 f.instance.delete()
#                             continue

#                         # 2. Trata salvamento (se a linha mudou)
#                         if f.has_changed():
#                             d = f.cleaned_data.get('data_referencia')
#                             hi = f.cleaned_data.get('inicio_time')
#                             hf = f.cleaned_data.get('fim_time')
#                             # Forçamos o evento padrão caso o usuário não tenha selecionado
#                             evento = f.cleaned_data.get('evento') or ev_padrao

#                             if d and hi:
#                                 f.instance.contrato = self.object
#                                 f.instance.evento = evento # Garante o NOT NULL
                                
#                                 # Datas Aware (Timezone)
#                                 dt_ini = datetime.combine(d, hi)
#                                 f.instance.inicio = timezone.make_aware(dt_ini)
                                
#                                 if hf:
#                                     v_noite = timedelta(1) if hf < hi else timedelta(0)
#                                     dt_fim = datetime.combine(d + v_noite, hf)
#                                     f.instance.fim = timezone.make_aware(dt_fim)
                                
#                                 f.instance.save()

#                 messages.success(self.request, "Espelho de ponto atualizado!")
#                 return redirect(self.request.get_full_path())
                
#             except Exception as e:
#                 messages.error(self.request, f"Erro no banco: {e}")
#                 return self.form_invalid(form)
                
#         return self.form_invalid(form)

from django.utils import timezone
class FrequenciaManagementView(LoginRequiredMixin, PermissionRequiredMixin, BaseUpdateView):
    model = Contrato
    form_class = ContratoFrequenciaForm
    template_name = 'pessoal/frequencia.html'
    permission_required = 'pessoal.view_frequencia'

    def get_object(self, queryset=None):
        val = self.request.GET.get('contrato') or self.kwargs.get('pk')
        if not val: return None
        return Contrato.objects.select_related('funcionario').filter(
            funcionario__matricula=val,
            funcionario__filial__in=self.request.user.profile.filiais.all()
        ).first()

    def get_context_data(self, **kwargs):
        self.object = self.get_object()
        context = super().get_context_data(**kwargs)
        
        if not self.object:
            return context

        # 1. Definição do Período
        m = int(self.request.GET.get('mes', date.today().month))
        a = int(self.request.GET.get('ano', date.today().year))
        ini, fim = get_period(m, a) # Sua função utilitária
        
        # 2. Queryset e Grade de dias faltantes
        qs = Frequencia.objects.filter(contrato=self.object, inicio__date__range=[ini, fim]).select_related('evento')
        
        # Se for GET, preparamos os dias vazios do mês como 'initial'
        initial = []
        if self.request.method == 'GET':
            datas_no_banco = set(qs.values_list('inicio__date', flat=True))
            dias_mes = [ini + timedelta(days=x) for x in range((fim - ini).days + 1)]
            # Passamos a data para o campo 'inicio'. O Widget datetime-local lidará com isso.
            initial = [{'inicio': d} for d in dias_mes if d not in datas_no_banco]

        # 3. Formset (Dinâmico como o do Turno)
        FS = inlineformset_factory(
            Contrato, Frequencia, form=FrequenciaForm, 
            extra=len(initial), can_delete=True
        )
        
        context['formset'] = FS(
            self.request.POST or None, 
            instance=self.object, 
            queryset=qs, 
            initial=initial, 
            prefix='dias'
        )
        context.update({'mes_ref': m, 'ano_ref': a})
        return context

    def form_valid(self, form):
        ctx = self.get_context_data(form=form)
        fs = ctx['formset']
        
        if fs.is_valid():
            try:
                with transaction.atomic():
                    ev_padrao = EventoFrequencia.objects.filter(categoria='PRD').first()
                    
                    # 1. CORREÇÃO: Itera sobre os formulários marcados para deletar
                    for f in fs.deleted_forms:
                        if f.instance.pk:
                            f.instance.delete()
                    
                    # 2. Salva apenas o que mudou (usando o método save customizado do Form)
                    for f in fs.forms:
                        if f.has_changed() and not fs._should_delete_form(f):
                            f.save(self.object, ev_padrao)

                messages.success(self.request, "Folha de frequência atualizada!")
                return redirect(self.request.get_full_path())
            except Exception as e:
                messages.error(self.request, f"Erro ao salvar: {e}")
                
        return self.form_invalid(form)























class AfastamentoUpdateView(LoginRequiredMixin, PermissionRequiredMixin, BaseUpdateView):
    model = Afastamento
    form_class = AfastamentoForm
    template_name = 'pessoal/afastamento_id.html'
    context_object_name = 'afastamento'
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
    context_object_name = 'dependente'
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
    context_object_name = 'evento'
    permission_required = 'pessoal.change_evento'
    def get_success_url(self):
        return reverse('pessoal:evento_update', kwargs={'pk': self.object.id})


class EventoRelatedUpdateView(LoginRequiredMixin, BaseUpdateView):
    template_name = 'pessoal/evento_related_id.html'
    def dispatch(self, request, *args, **kwargs):
        self.related = kwargs.get('related').lower()
        self.related_id = kwargs.get('pk')
        perm_name = f"pessoal.change_evento{self.related}"
        print('UPDATE:perm_name: ', perm_name)
        if self.related not in ['empresa', 'cargo', 'funcionario']:
            messages.error(
                request, 
                f"{DEFAULT_MESSAGES['400']} <b>evento_related_update [bad request]</b>"
            )
            return redirect('index') # Ou para uma página de erro apropriada
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