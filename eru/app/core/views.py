import re, os, json
from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required, permission_required
from django.contrib.auth.hashers import check_password
from django.contrib import auth, messages
from .models import Empresa, Log, Settings, Job
from .forms import EmpresaForm, UserForm, GroupForm, SettingsForm
from django.contrib.auth.models import User, Group, Permission
from django.contrib.contenttypes.models import ContentType
from .extras import clean_request
from django.conf import settings as ROOT
from django.http import HttpResponse


@login_required
def index(request):
    if request.user.profile.force_password_change == True:
        messages.warning(request,'<b>Atenção.</b> É necessário trocar sua senha')
        return redirect('change_password')
    return render(request,'core/index.html')

@login_required
@permission_required('core.view_empresa', login_url="/handler/403")
def empresas(request):
    empresas = Empresa.objects.all().order_by('nome')
    if request.method == 'POST':
        empresas = empresas.filter(nome__contains=request.POST['pesquisa'])
    return render(request,'core/empresas.html',{'empresas':empresas})

@login_required
@permission_required('auth.view_group', login_url="/handler/403")
def grupos(request):
    grupos = Group.objects.all().order_by('name')
    pesquisa = request.GET.get('pesquisa', None)
    if pesquisa:
        grupos = grupos.filter(name__contains=pesquisa)
    if request.GET.get('_associacoes', None):
        grupos = grupos.filter(user=None)
    return render(request,'core/grupos.html',{'grupos':grupos})

@login_required
@permission_required('auth.view_group', login_url="/handler/403")
def usuarios_grupo(request, id):
    grupo = Group.objects.get(pk=id)
    usuarios = User.objects.filter(groups=grupo)
    return render(request, 'core/usuarios_grupo.html',{'grupo':grupo,'usuarios':usuarios})


@login_required
@permission_required('auth.view_user', login_url="/handler/403")
def usuarios(request):
    usuarios = User.objects.all().order_by('username')
    if request.GET:
        if request.GET.get('pesquisa'):
            usuarios = usuarios.filter(username__contains=request.GET.get('pesquisa'))
        fields = ['email','is_superuser','is_staff','is_active','last_login','last_login__lte']
        try:
            params = clean_request(request.GET, fields)
            usuarios = usuarios.filter(**params)
        except:
            messages.warning(request,'<b>Erro</b> ao filtrar usuário..')
            return redirect('core_usuarios')
    return render(request,'core/usuarios.html',{'usuarios':usuarios})

@login_required
@permission_required('core.view_log', login_url="/handler/403")
def logs(request):
    target_model = request.GET.get('target_model',None)
    mensagem = request.GET.get('mensagem', None)
    related = request.GET.get('related', None)
    logs = Log.objects.filter(modelo=target_model,mensagem=mensagem)
    if related:
        logs = logs.filter(objeto_related=related)
    return render(request,'core/logs.html',{'logs':logs})

@login_required
def jobs(request):
    jobs = Job.objects.filter(usuario=request.user).order_by('-inicio')
    return render(request,'core/jobs.html',{'jobs':jobs})

@login_required
def jobs_download(request, id):
    job = Job.objects.get(pk=id)
    if request.GET['type'] == 'erros':
        file = job.erros
    else:
        file = job.anexo
    filename = file.name.split('/')[-1]
    response = HttpResponse(file.file)
    response['Content-Disposition'] = 'attachment; filename="' + filename + '"'
    return response

@login_required
def jobs_clean(request):
    jobs = Job.objects.filter(usuario=request.user).exclude(termino=None)
    for job in jobs:
        if job.erros:
            os.remove(job.erros.path) # REMOVE ARQUIVO FISICO
        if job.anexo:
            os.remove(job.anexo.path) # REMOVE ARQUIVO FISICO
        job.delete()
    messages.warning(request,'Registros <b>removidos</b> do servidor')
    return redirect('jobs')

@login_required
@permission_required('core.view_settings', login_url="/handler/403")
def settings(request):
    try: # Busca configuracao do app
        settings = Settings.objects.all().get()
    except: # Caso ainda nao configurado, inicia com configuracao basica
        if Settings.objects.all().count() == 0:
            settings = Settings()
            settings.save()
            l = Log()
            l.modelo = "core.settings"
            l.objeto_id = settings.id
            l.objeto_str = 'n/a'
            l.usuario = request.user
            l.mensagem = "AUTO CREATED"
            l.save()
        else:
            settings = None
            messages.error(request,'<b>Erro::</b> Identificado duplicatas nas configurações do sistema, entre em contato com o administrador.')
    form = SettingsForm(instance=settings)
    return render(request,'core/settings.html',{'form':form,'settings':settings})

# METODOS ADD
@login_required
@permission_required('core.add_empresa', login_url="/handler/403")
def empresa_add(request):
    if request.method == 'POST':
        form = EmpresaForm(request.POST, request.FILES)
        if form.is_valid():
            try:
                registro = form.save()
                l = Log()
                l.modelo = "core.empresa"
                l.objeto_id = registro.id
                l.objeto_str = registro.nome[0:48]
                l.usuario = request.user
                l.mensagem = "CREATED"
                l.save()
                messages.success(request,'Empresa <b>' + registro.nome + '</b> criada')
                return redirect('core_empresas')
            except:
                messages.error(request,'Erro ao inserir empresa [INVALID FORM]')
                return redirect('core_empresas')
    else:
        form = EmpresaForm()
    return render(request,'core/empresa_add.html',{'form':form})

@login_required
@permission_required('auth.add_user', login_url="/handler/403")
def usuario_add(request):
    if request.method == 'POST':
        form = UserForm(request.POST)
        if form.is_valid():
            try:
                registro = form.save(commit=False)
                registro.set_password(request.POST['password'])
                registro.save()
                try: # Carrega configuracoes do app
                    settings = Settings.objects.all().get()
                except: # Caso nao gerado configuracoes iniciais carrega definicoes basicas
                    settings = Settings()
                profile = registro.profile
                config = initializeProfileConfig()
                if settings.historico_senhas_nao_repetir > 0:
                    config["history_password"] = [registro.password]
                else:
                    config["history_password"] = []
                profile.config = json.dumps(config)
                profile.save()
                for grupo in request.POST.getlist('grupos'):
                    g = Group.objects.get(id=grupo)
                    g.user_set.add(registro)
                
                for perm in request.POST.getlist('perms'):
                    p = Permission.objects.get(id=perm)
                    p.user_set.add(registro)
                
                for empresa in request.POST.getlist('empresas'):
                    e = Empresa.objects.get(id=empresa)
                    registro.profile.empresas.add(e)
                l = Log()
                l.modelo = "auth.user"
                l.objeto_id = registro.id
                l.objeto_str = registro.username
                l.usuario = request.user
                l.mensagem = "CREATED"
                l.save()
                messages.success(request,'Usuario <b>' + registro.username + '</b> criado')
                return redirect('core_usuario_id', registro.id)
            except:
                messages.error(request,'Erro ao inserir usuario [INVALID FORM]')
                return redirect('core_usuarios')
    else:
        form = UserForm()
    return render(request,'core/usuario_add.html',{'form':form})

@login_required
@permission_required('auth.add_group', login_url="/handler/403")
def grupo_add(request):
    if request.method == 'POST':
        form = GroupForm(request.POST)
        if form.is_valid():
            try:
                registro = form.save()
                l = Log()
                l.modelo = "auth.group"
                l.objeto_id = registro.id
                l.objeto_str = registro.name
                l.usuario = request.user
                l.mensagem = "CREATED"
                l.save()
                messages.success(request,'Grupo <b>' + registro.name + '</b> criado')
                return redirect('core_grupos')
            except:
                messages.error(request,'Erro ao inserir grupo [INVALID FORM]')
                return redirect('core_grupos')
    else:
        form = GroupForm()
    return render(request,'core/grupo_add.html',{'form':form})

# METODOS GET
@login_required
@permission_required('core.change_empresa', login_url="/handler/403")
def empresa_id(request, id):
    empresa = Empresa.objects.get(id=id)
    form = EmpresaForm(instance=empresa)
    return render(request,'core/empresa_id.html',{'form':form,'empresa':empresa})

@login_required
@permission_required('auth.change_user', login_url="/handler/403")
def usuario_id(request, id):
    usuario = User.objects.get(id=id)
    form = UserForm(instance=usuario)
    return render(request,'core/usuario_id.html',{'form':form,'usuario':usuario})

@login_required
@permission_required('auth.change_group', login_url="/handler/403")
def grupo_id(request, id):
    grupo = Group.objects.get(id=id)
    form = GroupForm(instance=grupo)
    return render(request,'core/grupo_id.html',{'form':form,'grupo':grupo})


# METODOS UPDATE
@login_required
@permission_required('core.change_empresa', login_url="/handler/403")
def empresa_update(request, id):
    empresa = Empresa.objects.get(pk=id)
    form = EmpresaForm(request.POST, request.FILES, instance=empresa)
    if form.is_valid():
        registro = form.save()
        l = Log()
        l.modelo = "core.empresa"
        l.objeto_id = registro.id
        l.objeto_str = registro.nome
        l.usuario = request.user
        l.mensagem = "UPDATE"
        l.save()
        messages.success(request,'Empresa <b>' + registro.nome + '</b> alterada')
        return redirect('core_empresa_id',id)
    else:
        return render(request,'core/empresa_id.html',{'form':form,'empresa':empresa})

@login_required
@permission_required('auth.change_user', login_url="/handler/403")
def usuario_update(request, id):
    usuario = User.objects.get(pk=id)
    form = UserForm(request.POST, instance=usuario)
    if form.is_valid():
        registro = form.save(commit=False)
        if 'force_password_change' in request.POST:
            registro.profile.force_password_change = True
        else:
            registro.profile.force_password_change = False
        
        if 'reset_password' in request.POST and request.POST['reset_password'] != '':
            registro.set_password(request.POST['reset_password'])
            registro.profile.force_password_change = True
            
        registro.save()
        registro.groups.clear()
        for grupo in request.POST.getlist('grupos'):
            g = Group.objects.get(id=grupo)
            g.user_set.add(registro)
        
        registro.user_permissions.clear()
        for perm in request.POST.getlist('perms'):
            p = Permission.objects.get(id=perm)
            p.user_set.add(registro)
        
        registro.profile.empresas.clear()
        for empresa in request.POST.getlist('empresas'):
            e = Empresa.objects.get(id=empresa)
            registro.profile.empresas.add(e)
        l = Log()
        l.modelo = "auth.user"
        l.objeto_id = registro.id
        l.objeto_str = registro.username
        l.usuario = request.user
        l.mensagem = "UPDATE"
        l.save()
        messages.success(request,'Usuario <b>' + registro.username + '</b> alterado')
        return redirect('core_usuario_id',id)
    else:
        return render(request,'core/usuario_id.html',{'form':form,'usuario':usuario})

@login_required
@permission_required('auth.change_group', login_url="/handler/403")
def grupo_update(request, id):
    grupo = Group.objects.get(pk=id)
    form = GroupForm(request.POST, instance=grupo)
    if form.is_valid():
        registro = form.save()
        l = Log()
        l.modelo = "auth.group"
        l.objeto_id = registro.id
        l.objeto_str = registro.name
        l.usuario = request.user
        l.mensagem = "UPDATE"
        l.save()
        messages.success(request,'Grupo <b>' + registro.name + '</b> alterado')
        return redirect('core_grupo_id',id)
    else:
        return render(request,'core/grupo_id.html',{'form':form,'grupo':grupo})

@login_required
@permission_required('core.change_settings', login_url="/handler/403")
def settings_update(request, id):
    settings = Settings.objects.get(pk=id)
    form = SettingsForm(request.POST, instance=settings)
    if form.is_valid():
        registro = form.save()
        l = Log()
        l.modelo = "core.settings"
        l.objeto_id = registro.id
        l.objeto_str = 'n/a'
        l.usuario = request.user
        l.mensagem = "UPDATE"
        l.save()
        messages.success(request,'Configurações <b>atualizadas</b> com sucesso')
        return redirect('core_settings')
    else:
        return render(request,'core/settings.html',{'form':form,'settings':settings})

# METODOS DELETE
@login_required
@permission_required('core.delete_empresa', login_url="/handler/403")
def empresa_delete(request, id):
    try:
        registro = Empresa.objects.get(pk=id)
        l = Log()
        l.modelo = "core.empresa"
        l.objeto_id = registro.id
        l.objeto_str = registro.nome
        l.usuario = request.user
        l.mensagem = "DELETE"
        registro.delete()
        l.save()
        messages.warning(request,'Empresa <b>' + registro.nome + '</b> apagada')
        return redirect('core_empresas')
    except:
        messages.error(request,'ERRO ao apagar empresa')
        return redirect('core_empresa_id', id)

@login_required
@permission_required('auth.delete_user', login_url="/handler/403")
def usuario_delete(request, id):
    try:
        registro = User.objects.get(pk=id)
        l = Log()
        l.modelo = "auth.user"
        l.objeto_id = registro.id
        l.objeto_str = registro.username
        l.usuario = request.user
        l.mensagem = "DELETE"
        registro.delete()
        l.save()
        messages.warning(request,'Usuario <b>' + registro.username + '</b> apagado')
        return redirect('core_usuarios')
    except:
        messages.error(request,'ERRO ao apagar usuario')
        return redirect('core_usuario_id', id)

@login_required
@permission_required('auth.delete_group', login_url="/handler/403")
def grupo_delete(request, id):
    try:
        registro = Group.objects.get(pk=id)
        l = Log()
        l.modelo = "auth.group"
        l.objeto_id = registro.id
        l.objeto_str = registro.name
        l.usuario = request.user
        l.mensagem = "DELETE"
        registro.delete()
        l.save()
        messages.warning(request,'Grupo <b>' + registro.name + '</b> apagado')
        return redirect('core_grupos')
    except:
        messages.error(request,'ERRO ao apagar grupo')
        return redirect('core_grupo_id', id)

# AUTENTICACAO E PERMISSAO
def login(request):
    return render(request,'core/login.html')

def authenticate(request):
    if request.method == 'POST':
        username = request.POST['username']
        password = request.POST['password']
        if User.objects.filter(username=username).exists():
            user = auth.authenticate(request, username=username, password=password)
            if user is not None:
                auth.login(request, user)
                profile = request.user.profile
                if request.user.profile.config == '': # Inicializa config do profile caso ainda nao initializado
                    profile.config = json.dumps(initializeProfileConfig())
                else:
                    config = json.loads(profile.config)
                    config["password_errors_count"] = 0                    
                    profile.config = json.dumps(config)
                profile.save()
                if request.POST['next'] != '':
                    return redirect(request.POST['next'])
                return redirect('index')
        try: # Carrega configuracoes do app
            settings = Settings.objects.all().get()
        except: # Caso nao gerado configuracoes iniciais carrega definicoes padrao
            settings = Settings()
        if settings.quantidade_tentantivas_erradas > 0:
            try:
                user = User.objects.get(username=request.POST['username'])
            except User.DoesNotExist:
                user = None
            if user and user.is_active:
                config = json.loads(user.profile.config) if user.profile.config != '' else initializeProfileConfig()
                if config["password_errors_count"] + 1 == settings.quantidade_tentantivas_erradas: # Chegou ao limite de tentativas erradas
                    config["password_errors_count"] = 0
                    user.is_active = False
                    user.save()
                    messages.error(request,'Exedeu limite de tentativas, conta bloqueada, procure o administrador')
                else:
                    config["password_errors_count"] += 1
                    messages.error(request,'Senha inválida, tentativas: <b>%s</b>' %(settings.quantidade_tentantivas_erradas - config["password_errors_count"]))
                profile = user.profile
                profile.config = json.dumps(config)
                profile.save()
            elif user and not user.is_active:
                messages.error(request,'Conta bloqueada')
            else:
                messages.error(request,'Erro, falha na autenticação')
        else:
            messages.error(request,'Erro, falha na autenticação')
    return redirect('login')

@login_required
def change_password(request):
    try: # Carrega configuracoes do app
        settings = Settings.objects.all().get()
    except: # Caso nao gerado configuracoes iniciais carrega definicoes padrao
        settings = Settings()
    if request.method == 'POST':
        password_current = request.POST['password_current']
        password = request.POST['password']
        password_confirm = request.POST['password_confirm']

        if request.user.check_password(password_current):
            if password == password_confirm:
                if password_current != password:
                    if password_valid(request, password):
                        request.user.set_password(password)
                        request.user.profile.force_password_change = False
                        request.user.save()
                        if settings.historico_senhas_nao_repetir > 0: # Atualiza o historico de senhas no profile
                            profile = request.user.profile
                            config = json.loads(profile.config)
                            if len(config["history_password"]) >= settings.historico_senhas_nao_repetir:
                                config["history_password"] = config["history_password"][len(config["history_password"]) - settings.historico_senhas_nao_repetir + 1:] # Remove historico excedente
                                config["history_password"].append(request.user.password) # Carrega novo password
                            else:
                                config["history_password"].append(request.user.password)
                            profile.config = json.dumps(config)
                            profile.save()
                        messages.success(request, 'Senha alterada')
                        return redirect('login')
                    else:
                        messages.error(request,'Senha não atende aos requisitos')
                else:
                    messages.error(request, 'Nova senha não pode ser igual a senha atual')
            else:
                messages.error(request, 'Senhas nova e confirmação não são iguais')
        else:
            messages.error(request, 'Senha atual não confere')
        return render(request,'core/change_password.html', {'settings':settings})
    else:
        return render(request,'core/change_password.html', {'settings':settings})

def logout(request):
    auth.logout(request)
    return redirect('index')

@login_required
def handler(request, code):
    return render(request,f'{code}.html')


def password_valid(request, password):
    try: # Carrega configuracoes do app
        settings = Settings.objects.all().get()
    except: # Caso nao gerado configuracoes iniciais carrega definicoes basicas
        settings = Settings()

    if len(password) < settings.quantidade_caracteres_senha:
        return False
    if settings.senha_exige_numero and re.search('[0-9]',password) is None:
        return False
    if settings.senha_exige_maiuscula and re.search('^(?=.*[a-z])(?=.*[A-Z])',password) is None:
        return False
    elif settings.senha_exige_alpha and re.search('[a-z]',password, re.IGNORECASE) is None:
        return False
    if settings.senha_exige_caractere and re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?]", password) is None:
        return False
    if settings.historico_senhas_nao_repetir > 0:
        profile = request.user.profile
        config = json.loads(profile.config) if profile.config != '' else initializeProfileConfig()
        for pw in config["history_password"]:
            if check_password(password, pw):
                return False
    return True

def initializeProfileConfig():
    return {"history_password":[], "password_errors_count": 0}


# AJAX METODOS

# i18n: Retorna dicionario de dados (json) com linguagem solicitada (se existir)
# --
# @version  1.0
# @since    02/10/2025
# @author   Rafael Gustavo ALves {@email castelhano.rafael@gmail.com }
# @desc     Arquivos json dever ser salvos na pasta o respectivo app/i18n e nome do arquivo deve corresponder ao idioma
#           ex: en.json ou en-US.json
@login_required
def i18n(request):
    data = None
    if request.method == 'GET':
        app = request.GET.get('app')
        lng = request.GET.get('lng')
        try:
            fpath = f'{ROOT.TEMPLATES_DIR}{app}/i18n/{lng}.json'
            if os.path.exists(fpath): # Verifica se arquivo base existe
                f = open(fpath, 'r', encoding='utf-8')
                data = json.load(f)
                f.close()
            elif '-' in lng: # Caso linguagem tenha especificacoa regional ex en-US
                generic_lng = lng.split('-')[0]
                fpath = f'{ROOT.TEMPLATES_DIR}{app}/i18n/{generic_lng}.json'
                if os.path.exists(fpath): # Verifica se existe idioma generico (sem especificacao regional, se sim retorna ele)
                    f = open(fpath, 'r', encoding='utf-8')
                    data = json.load(f)
                    f.close()
            else:
                return HttpResponse(f'Not found correspondent for language "{lng}" in app "{app}"')
        except Exception as e:
            return HttpResponse('Server Error....')
        return HttpResponse(json.dumps(data))
    return HttpResponse('Access denied')

@login_required
def get_empresas(request):
    # Metodo retorna JSON com dados das empresas
    try:
        if request.GET.get('usuario', None) == 'new':
            empresas = Empresa.objects.all().order_by('nome')
        else:
            usuario = request.user if request.GET.get('usuario', None) == None else User.objects.get(id=request.GET.get('usuario', None))
            empresas = usuario.profile.empresas.all().order_by('nome')
        itens = []
        for item in empresas:
            item_dict = vars(item) # Converte objetos em dicionario
            if '_state' in item_dict: del item_dict['_state'] # Remove _state do dict (se existir)
            itens.append(item_dict)
        dataJSON = json.dumps(itens)
        return HttpResponse(dataJSON)
    except:
        return HttpResponse('')

@login_required
def get_grupos(request):
    try:
        if request.GET.get('usuario', None) == 'new':
            grupos = Group.objects.all().order_by('name')
        else:
            usuario = request.user if request.GET.get('usuario', None) == None else User.objects.get(id=request.GET['usuario'])
            grupos = Group.objects.filter(user=usuario).order_by('name')
        itens = []
        for item in grupos:
            item_dict = vars(item) # Converte objeto em dicionario
            if '_state' in item_dict: del item_dict['_state'] # Remove _state do dict (se existir)
            itens.append(item_dict)
        dataJSON = json.dumps(itens)
        return HttpResponse(dataJSON)
    except:
        return HttpResponse('')

@login_required
def get_user_perms(request):
    try:
        exclude_itens = ['sessions','contenttypes','admin']
        if request.GET.get('usuario', None) == 'new':
            perms = Permission.objects.all().exclude(content_type__app_label__in=exclude_itens).order_by('content_type__app_label', 'content_type__model', 'name')
        else:
            usuario = request.user if request.GET.get('usuario', None) == None else User.objects.get(id=request.GET['usuario'])
            perms = Permission.objects.filter(user=usuario).exclude(content_type__app_label__in=exclude_itens).order_by('content_type__app_label', 'content_type__model', 'name')
        itens = []
        for item in perms:
            item_dict = {'id':item.id,'nome':f'{item.content_type.app_label} | {item.content_type.model} | {item.name}'}
            itens.append(item_dict)
        dataJSON = json.dumps(itens)
        return HttpResponse(dataJSON)
    except:
        return HttpResponse('')

@login_required
def get_group_perms(request):
    try:
        tipo = request.GET.get('tipo',None)
        if request.GET.get('grupo',None) != 'new':
            grupo = Group.objects.get(id=request.GET.get('grupo',None))
            if tipo == 'disponiveis':
                perms = Permission.objects.all().exclude(group=grupo).order_by('content_type__app_label', 'content_type__model', 'name')
            elif tipo == 'cadastrados':
                perms = Permission.objects.all().filter(group=grupo).order_by('content_type__app_label', 'content_type__model', 'name')
            else:
                pass
        else:
            exclude_itens = ['admin','contenttypes','sessions']
            perms = Permission.objects.all().exclude(content_type__app_label__in=exclude_itens).order_by('content_type__app_label', 'content_type__model', 'name')
        itens = {}
        for item in perms:
            itens[f'{item.content_type.app_label} | {item.content_type.model} | {item.name}'] = item.id
        dataJSON = json.dumps(itens)
        return HttpResponse(dataJSON)
    except:
        return HttpResponse('')