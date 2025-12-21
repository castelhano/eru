import os, json, math
from asteval import Interpreter
from django.shortcuts import redirect, get_object_or_404
from django.urls import reverse, reverse_lazy
from django.views import View
from core.views_base import BaseListView, BaseTemplateView, BaseCreateView, BaseUpdateView, BaseDeleteView
from django.contrib.auth import views as auth_views, update_session_auth_hash
from django.contrib.auth.mixins import LoginRequiredMixin, PermissionRequiredMixin
from django.contrib import auth, messages
from django.db import transaction
from django.contrib.messages.views import SuccessMessageMixin
from auditlog.models import LogEntry
from .models import Empresa, Settings, Profile
from .constants import DEFAULT_MESSAGES
from .forms import EmpresaForm, UserForm, GroupForm, ProfileForm, SettingsForm, CustomPasswordChangeForm
from .filters import UserFilter, LogEntryFilter
from django.contrib.auth.models import User, Group, Permission
from django.contrib.contenttypes.models import ContentType
from django.conf import settings
from django.http import JsonResponse, HttpResponseRedirect

# metodo auxiliar para inicializar campo config em profile
def initialize_profile_config():
    return {"history_password":[], "password_errors_count": 0}

class IndexView(LoginRequiredMixin, BaseTemplateView):
    template_name = 'core/index.html'
    def dispatch(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            return super().dispatch(request, *args, **kwargs)
        profile = getattr(request.user, 'profile', None)
        if profile and profile.force_password_change:
            messages.warning( request, '<b>Atenção.</b> É necessário trocar sua senha para continuar.' )
            return redirect('change_password')
        return super().dispatch(request, *args, **kwargs)

class CustomLoginView(auth_views.LoginView):
    template_name = 'core/login.html'
    redirect_authenticated_user = True # usuario logado ja eh direcionado diretamente para index
    def form_valid(self, form):
        user = form.get_user()
        auth.login(self.request, user)
        profile = user.profile
        config = profile.config if profile.config else initialize_profile_config()
        config["password_errors_count"] = 0
        profile.config = config
        profile.save()
        return super().form_valid(form)
    def form_invalid(self, form):
        username = form.cleaned_data.get('username')
        try:
            settings = Settings.objects.get()
        except Settings.DoesNotExist:
            settings = Settings()
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            user = None
        if user and settings.quantidade_tentantivas_erradas > 0:
            if not user.is_active:
                messages.error(self.request, 'Conta bloqueada. Procure o administrador.')
                return super().form_invalid(form)
            profile = user.profile
            config = profile.config if profile.config else initialize_profile_config()
            config["password_errors_count"] = config.get("password_errors_count", 0) + 1
            if config["password_errors_count"] >= settings.quantidade_tentantivas_erradas:
                user.is_active = False
                user.save()
                config["password_errors_count"] = 0
                messages.error(self.request, 'Excedeu limite de tentativas, conta bloqueada!')
            else:
                tentativas_restantes = settings.quantidade_tentantivas_erradas - config["password_errors_count"]
                messages.error(self.request, f'Senha inválida. Tentativas restantes: <b>{tentativas_restantes}</b>')
            profile.config = config
            profile.save()
        else:
            messages.error(self.request, 'Erro: falha na autenticação.')
        return super().form_invalid(form)

class CustomPasswordChangeView(auth_views.PasswordChangeView):
    form_class = CustomPasswordChangeForm
    template_name = 'core/change_password.html'
    success_url = reverse_lazy('login')
    @transaction.atomic
    def form_valid(self, form):
        response = super().form_valid(form)
        user = self.request.user
        profile = user.profile
        try:
            settings = Settings.objects.get()
        except Settings.DoesNotExist:
            settings = Settings()
        if settings.historico_senhas_nao_repetir > 0:
            config = profile.config if profile.config else initialize_profile_config()
            history = config.get("history_password", [])
            history.append(user.password)
            if len(history) > settings.historico_senhas_nao_repetir:
                history = history[-settings.historico_senhas_nao_repetir:]
            config["history_password"] = history
            profile.config = config
            profile.force_password_change = False
            profile.save()
        messages.success(self.request, 'Senha alterada com sucesso!')
        update_session_auth_hash(self.request, user)
        return response

class HandlerView(LoginRequiredMixin, BaseTemplateView):
    def get_template_names(self):
        code = self.kwargs.get('code')
        template_name = f"{code}.html"
        return [template_name]
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['error_code'] = self.kwargs.get('code')
        return context

class LogAuditListView(LoginRequiredMixin, PermissionRequiredMixin, BaseTemplateView):
    template_name = 'core/logs.html'
    permission_required = 'auditlog.view_logentry'
    def get_grouped_models(self):
        # agrupa permissions por app_label
        target_apps = ['auth', 'core', 'trafego', 'pessoal']
        models = ContentType.objects.filter(app_label__in=target_apps ).order_by('app_label', 'model')
        grouped_models = {}
        for model in models:
            app = model.app_label
            if app not in grouped_models:
                grouped_models[app] = []
            grouped_models[app].append(model)
        return grouped_models
    def get_context_data(self, **kwargs):
        # prepara contexto incial (GET)
        context = super().get_context_data(**kwargs)
        context['grouped_models'] = self.get_grouped_models()
        return context
    def post(self, request, *args, **kwargs):
        # manipula POST aplicando filtros com django-filter
        context = self.get_context_data()
        data = request.POST.copy()
        data['content_type'] = request.POST.getlist('content_type')
        data.pop('csrfmiddlewaretoken', None)
        context['data'] = json.dumps(data)
        queryset = LogEntry.objects.all().order_by('-timestamp')
        log_filter = LogEntryFilter(request.POST, queryset=queryset)
        logs_qs = log_filter.qs
        max_entries = 100
        entries_input = request.POST.get('entries')
        if entries_input and entries_input.isdigit():
            max_entries = int(entries_input)
        context['logs'] = logs_qs[:max_entries]
        return self.render_to_response(context)

# i18n: Retorna dicionario de dados (json) com linguagem solicitada (se existir)
# --
# @version  1.0
# @since    02/10/2025
# @author   Rafael Gustavo ALves {@email castelhano.rafael@gmail.com }
# @desc     Arquivos json dever ser salvos na pasta app/i18n (do respectivo app) e nome do arquivo deve corresponder ao idioma (ex: pt-BR.json)
#           ex: en.json ou en-US.json
class I18nView(LoginRequiredMixin, View):
    def get(self, request, *args, **kwargs):
        app = request.GET.get('app')
        lng = request.GET.get('lng')
        if not app or not lng:
            return JsonResponse({'error': 'Request params app and lng'}, status=400)
        try:
            base_path = os.path.join(settings.TEMPLATES_DIR, app, 'i18n')
            fpath = os.path.join(base_path, f'{lng}.json')
            if not os.path.exists(fpath) and '-' in lng:
                generic_lng = lng.split('-')[0]
                fpath = os.path.join(base_path, f'{generic_lng}.json')
                selected_lng = generic_lng
            else:
                selected_lng = lng
            if os.path.exists(fpath):
                with open(fpath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    data['i18nSelectedLanguage'] = selected_lng
                return JsonResponse(data)
            return JsonResponse({}, status=404)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


class UsuarioListView(LoginRequiredMixin, PermissionRequiredMixin, BaseListView):
    model = User
    template_name = 'core/usuarios.html'
    context_object_name = 'usuarios'
    permission_required = 'auth.view_user'
    def get_queryset(self):
        return User.objects.all().order_by('username')
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        if self.request.GET:
            try:
                user_filter = UserFilter(self.request.GET, queryset=self.get_queryset())
                context['usuarios'] = user_filter.qs
                context['filter'] = user_filter
            except Exception:
                messages.warning(self.request, '<b>Erro</b> ao filtrar usuário. Exibindo lista completa.')
                context['usuarios'] = self.get_queryset()
        return context


class EmpresaListView(LoginRequiredMixin, PermissionRequiredMixin, BaseListView):
    model = Empresa
    template_name = 'core/empresas.html'
    context_object_name = 'empresas'
    permission_required = 'core.view_empresa'
    def get_queryset(self):
        return Empresa.objects.prefetch_related('filiais').all().order_by('nome')

class GrupoListView(LoginRequiredMixin, PermissionRequiredMixin, BaseListView):
    model = Group
    template_name = 'core/grupos.html'
    context_object_name = 'grupos'
    permission_required = 'auth.view_group'
    def get_queryset(self):
        queryset = Group.objects.all().order_by('name')
        users_filter = self.request.GET.get('users')
        if users_filter == 'false':
            queryset = queryset.filter(user__isnull=True)
        return queryset
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['users_filter'] = self.request.GET.get('users')
        return context

class UsuariosPorGrupoListView(LoginRequiredMixin, PermissionRequiredMixin, BaseListView):
    model = User
    template_name = 'core/usuarios_grupo.html'
    context_object_name = 'usuarios'   
    permission_required = 'auth.view_group'
    def get_queryset(self):
        self.grupo = get_object_or_404(Group, pk=self.kwargs.get('id'))        
        return User.objects.filter(groups=self.grupo).order_by('username')
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['grupo'] = self.grupo
        return context

class SettingsUpdateView(LoginRequiredMixin, PermissionRequiredMixin, BaseUpdateView):
    model = Settings
    form_class = SettingsForm
    template_name = 'core/settings.html'
    permission_required = 'core.view_settings'
    success_url = reverse_lazy('core:settings')  # redireciona para mesma pagina ao salvar
    def get_object(self, queryset=None):
        try:
            obj, created = Settings.objects.get_or_create(pk=1)
            return obj
        except Settings.MultipleObjectsReturned:
            messages.error( self.request, '<b>Erro:</b> Identificado duplicatas nas configurações. Contate o administrador.')
            return None
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['settings'] = self.object
        return context
    def form_valid(self, form):
        messages.success(self.request, "Configurações atualizadas com sucesso!")
        return super().form_valid(form)


# METODOS ADD
class EmpresaCreateView(LoginRequiredMixin, PermissionRequiredMixin, SuccessMessageMixin, BaseCreateView):
    model = Empresa
    form_class = EmpresaForm
    template_name = 'core/empresa_add.html'
    success_url = reverse_lazy('empresas')
    permission_required = 'core.add_empresa'


class UsuarioCreateView(BaseCreateView):
    form_class = UserForm
    template_name = 'core/usuario_add.html'
    permission_required = 'auth.add_user'
    def get_success_url(self):
        return reverse('usuario_update', kwargs={'pk': self.object.id})
    @transaction.atomic
    def form_valid(self, form):
        try:
            self.object = form.save(commit=False)
            self.object.set_password(form.cleaned_data['password'])
            self.object.save()
            try:
                settings = Settings.objects.get()
            except Settings.DoesNotExist:
                settings = Settings()
            profile = self.object.profile
            config = initialize_profile_config()
            if settings.historico_senhas_nao_repetir > 0:
                config["history_password"] = [self.object.password]
            else:
                config["history_password"] = []
            profile.config = config
            profile.save()
            grupos = self.request.POST.getlist('grupos')
            if grupos:
                self.object.groups.set(Group.objects.filter(id__in=grupos))
            perms = self.request.POST.getlist('perms')
            if perms:
                self.object.user_permissions.set(Permission.objects.filter(id__in=perms))
            filiais = self.request.POST.getlist('filiais')
            if filiais:
                profile.filiais.set(Filial.objects.filter(id__in=filiais))
            return super().form_valid(form)
        except Exception as e:
            messages.error(self.request, DEFAULT_MESSAGES['saveError'])
            return self.form_invalid(form)

class GrupoCreateView(BaseCreateView):
    form_class = GroupForm
    template_name = 'core/grupo_add.html'
    permission_required = 'auth.add_group'
    success_url = reverse_lazy('grupos')
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        exclude_itens = ['sessions', 'contenttypes', 'admin']
        context['permissions'] = Permission.objects.all().exclude(
            content_type__app_label__in=exclude_itens
        ).select_related('content_type').order_by('content_type__app_label', 'codename')
        return context


# METODOS UPDATE
class EmpresaUpdateView(BaseUpdateView):
    model = Empresa
    form_class = EmpresaForm
    template_name = 'core/empresa_id.html'
    permission_required = 'core.change_empresa'
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['empresa'] = self.object 
        return context
    def get_success_url(self):
        return reverse('empresa_update', kwargs={'pk': self.object.id})

class UsuarioUpdateView(BaseUpdateView):
    model = User
    form_class = UserForm
    template_name = 'core/usuario_id.html'
    permission_required = 'auth.change_user'
    def get_success_url(self):
        return reverse('usuario_update', kwargs={'pk': self.object.id})
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['usuario'] = self.object
        return context
    @transaction.atomic
    def form_valid(self, form):
        profile_instance, _ = Profile.objects.get_or_create(user=self.object)
        profile_form = ProfileForm(self.request.POST, instance=profile_instance)
        if form.is_valid() and profile_form.is_valid():
            try:
                user = form.save(commit=False)
                password = form.cleaned_data.get('password')
                if password:
                    user.set_password(password)
                user.save()
                groups = form.cleaned_data.get('groups')
                if groups is not None:
                    self.object.groups.set(groups)
                permissions = form.cleaned_data.get('user_permissions')
                if permissions is not None:
                    self.object.user_permissions.set(permissions)
                profile_form.save()
                messages.success(self.request, "Usuário atualizado com sucesso!")
                return HttpResponseRedirect(self.get_success_url())
            except Exception as e:
                print('cai elxxxxxeee')
                print(e)
                messages.error(self.request, DEFAULT_MESSAGES.get('saveError'))
                return self.form_invalid(form)
        else:
            print("--- ERROS NO USER FORM ---")
            print(form.errors.as_data())
            
            # Como estamos usando dois forms, o erro pode estar no segundo
            if 'profile_form' in locals() or 'profile_form' in globals():
                print("--- ERROS NO PROFILE FORM ---")
                print(profile_form.errors.as_data())
            return self.form_invalid(form)

class GrupoUpdateView(BaseUpdateView):
    model = Group
    form_class = GroupForm
    template_name = 'core/grupo_id.html'
    permission_required = 'auth.change_group'
    def get_success_url(self):
        return reverse('grupo_update', kwargs={'pk': self.object.id})
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['grupo'] = self.object
        exclude_itens = ['sessions', 'contenttypes', 'admin']
        context['permissions'] = Permission.objects.all().exclude(
            content_type__app_label__in=exclude_itens
        ).select_related('content_type').order_by('content_type__app_label', 'codename')
        return context

class SettingsUpdateView(BaseUpdateView):
    model = Settings
    form_class = SettingsForm
    template_name = 'core/settings.html'
    permission_required = 'core.change_settings'
    success_url = reverse_lazy('settings')
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['settings'] = self.object
        return context


# METODOS DELETE
class EmpresaDeleteView(BaseDeleteView):
    model = Empresa
    permission_required = 'core.delete_empresa'
    success_url = reverse_lazy('empresas')

class UsuarioDeleteView(BaseDeleteView):
    model = User
    permission_required = 'auth.delete_user'
    success_url = reverse_lazy('usuarios')

class GrupoDeleteView(BaseDeleteView):
    model = Group
    permission_required = 'auth.delete_group'
    success_url = reverse_lazy('grupos')








# @login_required
# def get_empresas(request):
#     # Metodo retorna JSON com dados das empresas
#     if request.GET.get('usuario', None) == 'new':
#         empresas = Empresa.objects.all().order_by('nome')
#     else:
#         usuario = request.user if request.GET.get('usuario', None) == None else User.objects.get(id=request.GET.get('usuario', None))
#         empresas = usuario.profile.empresas.all().order_by('nome')
#     obj = serializers.serialize('json', empresas)
#     return HttpResponse(obj, content_type="application/json")

def asteval_run(expression, vars_dict):
    # expression espera uma string com calculo a ser realizado
    whitelist = {
        'sqrt': math.sqrt,
        'sin': math.sin,
        'cos': math.cos,
        'log': math.log,
        'e': math.e,
        'pi': math.pi,
        # Adicione operadores logicos se necessario (and, or, not sao nativos)
        'True': True,
        'False': False,
    }
    aeval = Interpreter(
        minimal=True,
        user_symbols=whitelist,
        use_numpy=False,
        with_if=True,
        with_ifexp=True,
        builtins_readonly=True
    )
    aeval.symtable.update(vars_dict)
    result = aeval(expression)      # tenta interpretar codigo
    if aeval.error:
        error_message = aeval.error[0].get_error()
        return {'status': False, 'type': error_message[0], 'message': error_message[1]}
    return {'status': True, 'result': result }