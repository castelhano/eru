import json
from datetime import date
from django.views import View
from django.core.exceptions import PermissionDenied
from django.urls import reverse_lazy, reverse
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.mixins import LoginRequiredMixin, PermissionRequiredMixin
from django.contrib import messages
from django.db.models import Q
from django.http import JsonResponse
from django.utils.translation import gettext_lazy as _
# core
from core.constants import DEFAULT_MESSAGES
from core.mixins import AjaxableListMixin, AjaxableFormMixin, CSVExportMixin
from core.views_base import BaseListView, BaseTemplateView, BaseCreateView, BaseUpdateView, BaseDeleteView
from core.views import asteval_run
from core.models import Empresa, Filial
from core.extras import get_props
# third-party
from rest_framework import viewsets, permissions
from .serializers import FuncionarioSerializer
# local app
from .models import (
    Setor, Cargo, Funcionario, Afastamento, Dependente,
    Evento, GrupoEvento, MotivoReajuste, EventoEmpresa, EventoCargo, EventoFuncionario
)
from .forms import (
    SetorForm, CargoForm, FuncionarioForm, AfastamentoForm, DependenteForm,
    EventoForm, GrupoEventoForm, EventoEmpresaForm, EventoCargoForm, EventoFuncionarioForm, MotivoReajusteForm
)
from .filters import (
    FuncionarioFilter, EventoEmpresaFilter, EventoCargoFilter, EventoFuncionarioFilter
)
from .tables import FuncionarioTable
# ....................
class SetorListView(LoginRequiredMixin, PermissionRequiredMixin, BaseListView):
    model = Setor
    template_name = 'pessoal/setores.html'
    permission_required = 'pessoal.view_setor'
    queryset = Setor.objects.all().order_by('nome')

class CargoListView(LoginRequiredMixin, PermissionRequiredMixin, AjaxableListMixin, BaseListView):
    model = Cargo
    template_name = 'pessoal/cargos.html'
    context_object_name = 'cargos'
    permission_required = 'pessoal.view_cargo'
    def get_queryset(self):
        queryset = Cargo.objects.all().order_by('nome')
        setor_id = self.request.GET.get('cargo__setor') or self.request.GET.get('setor')
        if setor_id:
            queryset = queryset.filter(setor_id=setor_id)
        return queryset



class FuncionarioListView(LoginRequiredMixin, PermissionRequiredMixin, CSVExportMixin, BaseListView):
    model = Funcionario
    template_name = 'pessoal/funcionarios.html'
    permission_required = 'pessoal.view_funcionario'
    table_class = FuncionarioTable
    filterset_class = FuncionarioFilter
    def get(self, request, *args, **kwargs):
        self.filiais_autorizadas = request.user.profile.filiais.all()
        pesquisa = request.GET.get('pesquisa')
        if pesquisa:
            funcionario = Funcionario.objects.filter(
                matricula=pesquisa, 
                filial__in=self.filiais_autorizadas
            ).first()
            if funcionario:
                return redirect('pessoal:funcionario_update', pk=funcionario.id)
        return super().get(request, *args, **kwargs)
    def get_queryset(self):
        return Funcionario.objects.filter(filial__in=self.filiais_autorizadas).select_related('filial__empresa').order_by('matricula')
    def get_context_data(self, **kwargs):
        data = self.request.GET
        queryset = self.get_queryset()
        pesquisa = data.get('pesquisa')
        if not data:
            filtro_qs = queryset.none()
            filtro_obj = self.filterset_class(data, queryset=queryset) # Para renderizar o form vazio
        elif pesquisa:
            query = Q()
            for termo in pesquisa.split():
                query &= Q(nome__icontains=termo)
            filtro_qs = queryset.filter(query)
            filtro_obj = self.filterset_class(data, queryset=filtro_qs)
        else:
            filtro_obj = self.filterset_class(data, queryset=queryset)
            filtro_qs = filtro_obj.qs if filtro_obj.is_valid() else queryset.none()
        if not filtro_qs.exists() and data:
            messages.warning(self.request, "Nenhum registro encontrado.")
        context = super().get_context_data(object_list=filtro_qs, **kwargs)
        table = self.table_class(filtro_qs).config(self.request, filtro_obj)
        context.update({
            'table': table,
            'filter': filtro_obj,
            'form': FuncionarioForm(),
            'setores': Setor.objects.all().order_by('nome'),
            'applied_filters': {k: v for k, v in data.items() if k != 'csrfmiddlewaretoken'}
        })
        return context

# class FuncionarioListView(LoginRequiredMixin, PermissionRequiredMixin, BaseListView):
#     model = Funcionario
#     template_name = 'pessoal/funcionarios.html'
#     context_object_name = 'funcionarios'
#     permission_required = 'pessoal.view_funcionario'
#     def get(self, request, *args, **kwargs):
#         self.filiais_autorizadas = request.user.profile.filiais.all()
#         pesquisa = request.GET.get('pesquisa')
#         if pesquisa:
#             # tenta identificar se existe matricula correspondente
#             funcionario = Funcionario.objects.filter(
#                 matricula=pesquisa, 
#                 filial__in=self.filiais_autorizadas
#             ).first()
#             if funcionario:
#                 return redirect('pessoal:funcionario_update', pk=funcionario.id)
#         return super().get(request, *args, **kwargs)
#     def get_queryset(self):
#         data = self.request.GET
#         self.applied_filters = {k: v[0] if isinstance(v, list) and len(v) == 1 else v for k, v in data.items()}
#         self.applied_filters.pop("csrfmiddlewaretoken", None) # remove token
#         pesquisa = data.get('pesquisa')
#         queryset = Funcionario.objects.filter(filial__in=self.filiais_autorizadas).order_by('matricula')
#         if not data:
#             return queryset.none()
#         # filtro por nome (qualquer ordem) usando reducao de Q objects
#         if pesquisa:
#             query = Q()
#             for termo in pesquisa.split():
#                 query &= Q(nome__icontains=termo)
#             queryset = queryset.filter(query)
#         else:
#             # delega filtragem para django-filter (FuncionarioFilter)
#             filter_set = FuncionarioFilter(data, queryset=queryset)
#             if filter_set.is_valid():
#                 queryset = filter_set.qs
#             else:
#                 messages.warning(self.request, 'Filtros inválidos.')
#         # mensagem de alerta se nada for encontrado
#         if not queryset.exists() and (self.request.GET or self.request.POST):
#             messages.warning(self.request, DEFAULT_MESSAGES.get('emptyQuery'))
#         return queryset
#     def get_context_data(self, **kwargs):
#         context = super().get_context_data(**kwargs)
#         context.update({
#             'form': FuncionarioForm(),
#             'applied_filters': self.applied_filters,
#             'setores': Setor.objects.all().order_by('nome')
#         })
#         return context


class AfastamentoListView(LoginRequiredMixin, PermissionRequiredMixin, BaseListView):
    model = Afastamento
    template_name = 'pessoal/afastamentos.html'
    context_object_name = 'afastamentos'
    permission_required = 'pessoal.view_afastamento'
    def get_queryset(self):
        funcionario_id = self.kwargs.get('pk')
        filiais_pemitidas = self.request.user.profile.filiais.all()
        self.funcionario = get_object_or_404(
            Funcionario, 
            pk=funcionario_id, 
            filial__in=filiais_pemitidas
        )        
        return Afastamento.objects.filter(funcionario=self.funcionario).order_by('data_afastamento')
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['funcionario'] = self.funcionario
        return context


class DependenteListView(LoginRequiredMixin, PermissionRequiredMixin, BaseListView):
    model = Dependente
    template_name = 'pessoal/dependentes.html'
    context_object_name = 'dependentes'
    permission_required = 'pessoal.view_dependente'
    def get_queryset(self):
        funcionario_id = self.kwargs.get('pk')
        filiais_pemitidas = self.request.user.profile.filiais.all()
        self.funcionario = get_object_or_404(
            Funcionario, 
            pk=funcionario_id, 
            filial__in=filiais_pemitidas
        )        
        return Dependente.objects.filter(funcionario=self.funcionario).order_by('nome')
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['funcionario'] = self.funcionario
        return context


class EventoListView(LoginRequiredMixin, PermissionRequiredMixin, BaseListView):
    model = Evento
    template_name = 'pessoal/eventos.html'
    context_object_name = 'eventos'
    permission_required = 'pessoal.view_evento'
    queryset = Evento.objects.all().order_by('nome')

class EventoRelatedListView(LoginRequiredMixin, BaseListView):
    # view polimorfica que opera com modelos EventoEmpresa, EventoCargo, EventoFuncionario
    # espera receber related com modelo a ser utilizado
    template_name = 'pessoal/eventos_related.html'
    context_object_name = 'eventos'
    def dispatch(self, request, *args, **kwargs):
        self.related = kwargs.get('related')
        self.related_id = kwargs.get('id')
        perm_name = f"pessoal.view_evento{self.related}"
        if not request.user.has_perm(perm_name):
            return redirect('handler', code=403)
        if self.related not in ['empresa', 'cargo', 'funcionario']:
            messages.error(request, f"{DEFAULT_MESSAGES['400']} <b>pessoal:eventos_related, invalid related</b>")
            return redirect('index')
        return super().dispatch(request, *args, **kwargs)
    def get_queryset(self):
        user = self.request.user
        filiais_autorizadas = user.profile.filiais.all()
        queryset = None
        if self.related == 'empresa':
            queryset = EventoEmpresa.objects.filter(
                filiais__in=filiais_autorizadas
            ).order_by('evento__nome').distinct()
            self.filter_class = EventoEmpresaFilter
        elif self.related == 'cargo':
            self.related_model_obj = get_object_or_404(Cargo, pk=self.related_id)
            queryset = EventoCargo.objects.filter(
                cargo=self.related_model_obj, 
                filiais__in=filiais_autorizadas
            ).order_by('evento__nome').distinct()
            self.filter_class = EventoCargoFilter
        elif self.related == 'funcionario':
            self.related_model_obj = get_object_or_404(Funcionario, pk=self.related_id, filial__in=filiais_autorizadas)
            queryset = EventoFuncionario.objects.filter(
                funcionario=self.related_model_obj
            ).order_by('evento__nome')
            self.filter_class = EventoFuncionarioFilter
        # filtro padrao: excluir eventos vencidos (fim < hoje) se nao houver filtro de data
        if not self.request.GET.get('fim'):
            queryset = queryset.exclude(fim__lt=date.today())
        if self.request.GET:
            rel_filter = self.filter_class(self.request.GET, queryset=queryset)
            queryset = rel_filter.qs
            if not queryset.exists():
                messages.warning(self.request, DEFAULT_MESSAGES['emptyQuery'])
        return queryset
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['related'] = self.related
        if hasattr(self, 'related_model_obj'):
            context['model'] = self.related_model_obj
        form = EventoCargoForm()
        form.fields['tipo'].required = False
        choices = [('', "---------")] + list(form.fields['tipo'].choices)
        form.fields['tipo'].choices = [c for c in choices if c[0] != ''] # Evita duplicar o vazio se ja existir
        form.fields['tipo'].choices = [('', "---------")] + [c for c in form.fields['tipo'].choices if c[0] != '']
        context['form'] = form
        return context

class GrupoEventoListView(LoginRequiredMixin, PermissionRequiredMixin, AjaxableListMixin, BaseListView):
    model = GrupoEvento
    template_name = 'pessoal/grupos_evento.html'
    context_object_name = 'grupos_evento'
    permission_required = 'pessoal.view_grupoevento'
    queryset = GrupoEvento.objects.all().order_by('nome')


class MotivoReajusteListView(LoginRequiredMixin, PermissionRequiredMixin, BaseListView):
    model = MotivoReajuste
    template_name = 'pessoal/grupos_evento.html'
    context_object_name = 'motivos_reajuste'
    permission_required = 'pessoal.view_motivoreajuste'
    queryset = MotivoReajuste.objects.all().order_by('nome')


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
        # preenche o campo 'funcionario' no formulario automaticamente via GET
        # tambem serve como trava de seguranca por Filial
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
        # injeta o objeto 'funcionario' no contexto para exibicao no template
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
        # preenche o campo 'funcionario' no formulario automaticamente via GET
        # tambem serve como trava de seguranca por Filial
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
        # injeta o objeto 'funcionario' no contexto para exibicao no template
        context = super().get_context_data(**kwargs)
        context['funcionario'] = self.funcionario
        return context


class EventoCreateView(LoginRequiredMixin, PermissionRequiredMixin, BaseCreateView):
    model = Evento
    form_class = EventoForm
    template_name = 'pessoal/evento_add.html'
    success_url = reverse_lazy('pessoal:evento_list')
    permission_required = 'pessoal.add_evento'


# Retorna lista com todas as variaveis utilizadas para composicao de formula em eventos
# busca tanto eventos criados pelo usuario quanto props definidas nos modelos alvo
# adicione True como primeira variavel posicional para retornar um dicionario (1 para valores)
def getEventProps(asDict=False):
    prop_func = get_props(Funcionario)
    props_custom = list(Evento.objects.exclude(rastreio='').values_list('rastreio', flat=True).distinct())
    return dict.fromkeys(prop_func + props_custom, 1) if asDict else prop_func + props_custom


class EventoRelatedCreateView(LoginRequiredMixin, BaseCreateView):
    template_name = 'pessoal/evento_related_add.html'
    def dispatch(self, request, *args, **kwargs):
        self.related = kwargs.get('related')
        self.related_id = kwargs.get('id')
        perm_name = f"pessoal.view_evento{self.related}"
        if not request.user.has_perm(perm_name):
            return redirect('handler', code=403)
        if self.related not in ['empresa', 'cargo', 'funcionario']:
            messages.error(request, f"{DEFAULT_MESSAGES['400']} <b>pessoal:evento_related_add, invalid related</b>")
            return redirect('index')
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
        # empresa e cargo recebem o parametro user
        if self.related in ['empresa', 'cargo']:
            kwargs['user'] = self.request.user
        return kwargs
    def get_context_data(self, **kwargs):
        # prepara contexto para o template
        context = super().get_context_data(**kwargs)
        user = self.request.user
        filiais_autorizadas = user.profile.filiais.all()
        context['related'] = self.related
        context['props'] = getEventProps()
        # busca o objeto relacionado para exibicao no template (funcionario, cargo, empresa (id p empresa eh desconsiderado, sempre usar 0))
        if self.related == 'empresa':
            context['model'] = {'id': 0, 'pk': 0}
        elif self.related == 'cargo':
            context['model'] = get_object_or_404(Cargo, pk=self.related_id)
        elif self.related == 'funcionario':
            # funcionario so sera listado para filiais autorizadas para o utilizador
            context['model'] = get_object_or_404(Funcionario, pk=self.related_id, filial__in=filiais_autorizadas)
        return context
    def get_success_url(self):
        return reverse('pessoal:eventos_related', kwargs={'related': self.related, 'id': self.related_id})
    

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
        if not funcionario.F_ehEditavel:
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

class AfastamentoUpdateView(LoginRequiredMixin, PermissionRequiredMixin, BaseUpdateView):
    model = Afastamento
    form_class = AfastamentoForm
    template_name = 'pessoal/afastamento_id.html'
    context_object_name = 'afastamento'
    permission_required = 'pessoal.change_afastamento'
    def dispatch(self, request, *args, **kwargs):
        # so permite edicao de afastamentos de funcionarios ativos
        afastamento = self.get_object()
        if not afastamento.funcionario.F_ehEditavel:
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
        # so permite edicao de dependentes de funcionarios ativos
        dependente = self.get_object()
        if not dependente.funcionario.F_ehEditavel:
            messages.error(
                request,
                _('Não é possível alterar dados de funcionários desligados')
            )
            return redirect('pessoal:dependente_id', id=dependente.id)
        return super().dispatch(request, *args, **kwargs)
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
        self.related = kwargs.get('related')
        self.related_id = kwargs.get('id')
        perm_name = f"pessoal.change_evento{self.related}"
        if not request.user.has_perm(perm_name):
            return redirect('handler', 403)
        if self.related not in ['empresa', 'cargo', 'funcionario']:
            messages.error(
                request, 
                f"{DEFAULT_MESSAGES['400']} <b>evento_related_update [bad request]</b>"
            )
            return redirect('index') # Ou para uma página de erro apropriada
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
        return reverse('pessoal:eventorelated_update', kwargs={ 'related': self.related, 'id': self.related_id })


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
        self.related = kwargs.get('related')
        perm_name = f"pessoal.delete_evento{self.related}"
        if not request.user.has_perm(perm_name):
            return redirect('handler', 403)
        if self.related not in ['empresa', 'cargo', 'funcionario']:
            messages.error(request, f"{DEFAULT_MESSAGES['400']} <b>evento_related_delete [bad request: invalid related]</b>")
            return redirect('pessoal:eventos')
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
class FormulaValidateView(LoginRequiredMixin, PermissionRequiredMixin, View):
    """
    View para validacao de sintaxe Python/Asteval em formulas
    Processa requisicoes JSON e retorna o resultado da avaliacao segura
    """
    permission_required = "pessoal.view_evento"
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
            result = asteval_run(expression, getEventProps(True))
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