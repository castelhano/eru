from django.shortcuts import render, redirect
from django.db.models import Q
from django.http import HttpResponse, JsonResponse
import json
from django.core import serializers
from .models import Setor, Cargo, Funcionario, FuncaoFixa, Afastamento, Dependente, Evento, GrupoEvento, MotivoReajuste, EventoCargo, EventoFuncionario
from .forms import SetorForm, CargoForm, FuncionarioForm, AfastamentoForm, DependenteForm, EventoForm, GrupoEventoForm
from .filters import FuncionarioFilter
from django.contrib.auth.decorators import login_required, permission_required
from django.contrib import messages
from core.models import Log
from core.extras import create_image
from django.conf import settings
from datetime import datetime


@login_required
@permission_required('pessoal.view_setor', login_url="/handler/403")
def setores(request):
    setores = Setor.objects.all().order_by('nome')
    return render(request,'pessoal/setores.html', {'setores' : setores})

@login_required
@permission_required('pessoal.view_cargo', login_url="/handler/403")
def cargos(request):
    cargos = Cargo.objects.all().order_by('nome')
    return render(request,'pessoal/cargos.html',{'cargos':cargos})

@login_required
@permission_required('pessoal.view_funcionario', login_url="/handler/403")
def funcionarios(request):
    options = {
        "form": FuncionarioForm()
    }
    if request.method == 'GET':
        if request.GET.get('pesquisa'):
            # checa se existe funcionario com matricula informada na consulta, se sim abre form de edicao para funcionario
            if Funcionario.objects.filter(matricula=request.GET['pesquisa'], empresa__in=request.user.profile.empresas.all()).exists():
                funcionario = Funcionario.objects.get(matricula=request.GET['pesquisa'], empresa__in=request.user.profile.empresas.all())
                return redirect('pessoal_funcionario_id', funcionario.id)
            else:
                # criterio de consulta nao corresponde a uma matricula, busca avancada por nome
                criterios = request.GET['pesquisa'].split(' ')
                
                # incia consulta setando somente funcionarios nas empresa autorizadas
                query = Q(empresa__in=request.user.profile.empresas.all())

                # Analise parcialmente cada nome informado buscando correspondencia 
                for nome in criterios:
                    query &= Q(nome__icontains=nome)
                
                options['funcionarios'] = Funcionario.objects.filter(query)
                if len(options['funcionarios']) == 0:
                    messages.warning(request, settings.DEFAULT_MESSAGES['emptyQuery'])
        else:
            if request.GET:
                # Se veio parametros pelo get realiza a consulta
                options['funcionarios'] = Funcionario.objects.filter(empresa__in=request.user.profile.empresas.all()).order_by('matricula')
                try:
                    func_filter = FuncionarioFilter(request.GET, queryset=options['funcionarios'])
                    options['funcionarios'] = func_filter.qs
                    if len(options['funcionarios']) == 0:
                        messages.warning(request, settings.DEFAULT_MESSAGES['emptyQuery'])
                except:
                    messages.warning(request, settings.DEFAULT_MESSAGES['filterError'])
            else:
                # Se veio por metodo get sem filtro, apenas exibe pagina base para consulta
                pass
    else:
        # Request via POST vindo de um form de filtros, cria query e retorna resultados compativeis
        options['funcionarios'] = Funcionario.objects.filter(empresa__in=request.user.profile.empresas.all()).order_by('matricula')
        try:
            func_filter = FuncionarioFilter(request.POST, queryset=options['funcionarios'])
            options['funcionarios'] = func_filter.qs
            if len(options['funcionarios']) == 0:
                messages.warning(request, settings.DEFAULT_MESSAGES['emptyQuery'])
        except:
            messages.warning(request, settings.DEFAULT_MESSAGES['filterError'])
            return redirect('pessoal_funcionarios')
    return render(request, 'pessoal/funcionarios.html', options)

@login_required
@permission_required('pessoal.view_evento', login_url="/handler/403")
def eventos(request):
    eventos = Evento.objects.all().order_by('nome')
    return render(request,'pessoal/eventos.html',{'eventos':eventos})

@login_required
@permission_required('pessoal.view_grupoevento', login_url="/handler/403")
def grupos_evento(request):
    grupos_evento = GrupoEvento.objects.all().order_by('nome')
    return render(request,'pessoal/grupos_evento.html',{'grupos_evento':grupos_evento})

# Metodos ADD
@login_required
@permission_required('pessoal.add_setor', login_url="/handler/403")
def setor_add(request):
    if request.method == 'POST':
        form = SetorForm(request.POST)
        if form.is_valid():
            try:
                registro = form.save()
                l = Log()
                l.modelo = "pessoal.setor"
                l.objeto_id = registro.id
                l.objeto_str = registro.nome[0:48]
                l.usuario = request.user
                l.mensagem = "CREATED"
                l.save()
                messages.success(request, settings.DEFAULT_MESSAGES['created'] + f' <b>{registro.nome}</b>')
                return redirect('pessoal_setor_add')
            except:
                messages.error(request, settings.DEFAULT_MESSAGES['saveError'])
                return redirect('pessoal_setor_add')
    else:
        form = SetorForm()
    return render(request,'pessoal/setor_add.html',{'form':form})

@login_required
@permission_required('pessoal.add_cargo', login_url="/handler/403")
def cargo_add(request):
    if request.method == 'POST':
        form = CargoForm(request.POST)
        if form.is_valid():
            try:
                registro = form.save()
                for ffixa in request.POST.getlist('funcao_fixa'):
                    if FuncaoFixa.objects.filter(nome=ffixa).exists():
                        ff = FuncaoFixa.objects.get(nome=ffixa)
                    else:
                        ff = FuncaoFixa.objects.create(nome=ffixa)
                    ff.cargos.add(registro)
                l = Log()
                l.modelo = "pessoal.cargo"
                l.objeto_id = registro.id
                l.objeto_str = registro.nome[0:48]
                l.usuario = request.user
                l.mensagem = "CREATED"
                l.save()
                messages.success(request, settings.DEFAULT_MESSAGES['created'] + f' <b>{registro.nome}</b>')
                return redirect('pessoal_cargo_add')
            except:
                messages.error(request, settings.DEFAULT_MESSAGES['saveError'])
                return redirect('pessoal_cargo_add')
    else:
        form = CargoForm()
    return render(request,'pessoal/cargo_add.html',{'form':form})

@login_required
@permission_required('pessoal.add_funcionario', login_url="/handler/403")
def funcionario_add(request):
    if request.method == 'POST':
        form = FuncionarioForm(request.POST, request.FILES)
        if form.is_valid():
            try:
                has_warnings = False
                registro = form.save(commit=False)
                if request.POST['foto_data_url'] != '':
                    prefix = f'{registro.empresa.id}_{registro.matricula}'
                    today = datetime.now()
                    timestamp = datetime.timestamp(today)
                    file_name = f'{prefix}_{timestamp}.png'
                    result = create_image(request.POST['foto_data_url'], f'{settings.MEDIA_ROOT}/pessoal/fotos', file_name, f'{prefix}_')
                    if result[0]:
                        registro.foto = f'pessoal/fotos/{file_name}'
                    else:
                        has_warnings = True
                        messages.warning(request,'<b>Erro ao salvar foto:</b> ' + result[1])
                registro.save()
                l = Log()
                l.modelo = "pessoal.funcionario"
                l.objeto_id = registro.id
                l.objeto_str = registro.matricula + ' - ' + registro.nome[0:48]
                l.usuario = request.user
                l.mensagem = "CREATED"
                l.save()
                if not has_warnings:
                    messages.success(request,settings.DEFAULT_MESSAGES['created'] + f' <b>{registro.matricula}</b>')
                return redirect('pessoal_funcionario_id', registro.id)
            except:
                messages.error(request, settings.DEFAULT_MESSAGES['saveError'] + f' <b>{registro.matricula}</b>')
                return redirect('pessoal_funcionario_add')
    else:
        form = FuncionarioForm()
    return render(request,'pessoal/funcionario_add.html', {'form':form})

@login_required
@permission_required('pessoal.add_evento', login_url="/handler/403")
def evento_add(request):
    if request.method == 'POST':
        form = EventoForm(request.POST)
        if form.is_valid():
            try:
                registro = form.save()
                l = Log()
                l.modelo = "pessoal.evento"
                l.objeto_id = registro.id
                l.objeto_str = registro.nome[0:48]
                l.usuario = request.user
                l.mensagem = "CREATED"
                l.save()
                messages.success(request, settings.DEFAULT_MESSAGES['created'] + f' <b>{registro.nome}</b>')
                return redirect('pessoal_evento_add')
            except:
                messages.error(request, settings.DEFAULT_MESSAGES['saveError'])
                return redirect('pessoal_evento_add')
    else:
        form = EventoForm()
    return render(request,'pessoal/evento_add.html',{'form':form})

@login_required
@permission_required('pessoal.add_grupoevento', login_url="/handler/403")
def grupo_evento_add(request):
    if request.method == 'POST':
        form = GrupoEventoForm(request.POST)
        if form.is_valid():
            # try:
            registro = form.save()
            l = Log()
            l.modelo = "pessoal.grupo_evento"
            l.objeto_id = registro.id
            l.objeto_str = registro.nome[0:48]
            l.usuario = request.user
            l.mensagem = "CREATED"
            l.save()
            messages.success(request, settings.DEFAULT_MESSAGES['created'] + f' <b>{registro.nome}</b>')
            return redirect('pessoal_grupo_evento_add')
            # except:
            #     messages.error(request, settings.DEFAULT_MESSAGES['saveError'])
            #     return redirect('pessoal_grupo_evento_add')
    else:
        form = GrupoEventoForm()
    return render(request,'pessoal/grupo_evento_add.html',{'form':form})


# Metodos GET
@login_required
@permission_required('pessoal.change_setor', login_url="/handler/403")
def setor_id(request,id):
    setor = Setor.objects.get(pk=id)
    form = SetorForm(instance=setor)
    return render(request,'pessoal/setor_id.html',{'form':form,'setor':setor})

@login_required
@permission_required('pessoal.change_cargo', login_url="/handler/403")
def cargo_id(request,id):
    cargo = Cargo.objects.get(pk=id)
    form = CargoForm(instance=cargo)
    return render(request,'pessoal/cargo_id.html',{'form':form,'cargo':cargo})

@login_required
@permission_required('pessoal.view_funcionario', login_url="/handler/403")
def funcionario_id(request,id):
    try:
        funcionario = Funcionario.objects.get(pk=id, empresa__in=request.user.profile.empresas.all())
    except Exception as e:
        messages.warning(request,'Funcionário <b>não localizado</b>')
        return redirect('pessoal_funcionarios')
    form = FuncionarioForm(instance=funcionario)
    return render(request,'pessoal/funcionario_id.html',{'form':form,'funcionario':funcionario})

@login_required
@permission_required('pessoal.change_evento', login_url="/handler/403")
def evento_id(request,id):
    evento = Evento.objects.get(pk=id)
    form = EventoForm(instance=evento)
    return render(request,'pessoal/evento_id.html',{'form':form,'evento':evento})

@login_required
@permission_required('pessoal.change_grupoevento', login_url="/handler/403")
def grupo_evento_id(request,id):
    grupo_evento = GrupoEvento.objects.get(pk=id)
    form = GrupoEventoForm(instance=grupo_evento)
    return render(request,'pessoal/grupo_evento_id.html',{'form':form,'grupo_evento':grupo_evento})



# Metodos UPDATE
@login_required
@permission_required('pessoal.change_setor', login_url="/handler/403")
def setor_update(request,id):
    setor = Setor.objects.get(pk=id)
    form = SetorForm(request.POST, instance=setor)
    if form.is_valid():
        registro = form.save()
        l = Log()
        l.modelo = "pessoal.setor"
        l.objeto_id = registro.id
        l.objeto_str = registro.nome[0:48]
        l.usuario = request.user
        l.mensagem = "UPDATE"
        l.save()
        messages.success(request, settings.DEFAULT_MESSAGES['updated'] + f' <b>{registro.nome}</b>')
        return redirect('pessoal_setor_id', id)
    else:
        return render(request,'pessoal/setor_id.html',{'form':form,'setor':setor})

@login_required
@permission_required('pessoal.change_cargo', login_url="/handler/403")
def cargo_update(request,id):
    cargo = Cargo.objects.get(pk=id)
    form = CargoForm(request.POST, instance=cargo)
    if form.is_valid():
        registro = form.save()
        flist = [chave for chave, valor in FuncaoFixa.FFIXA_CHOICES] # inicia lista com as funcoes fixas existentes
        for ffixa in request.POST.getlist('funcao_fixa'):
            if registro.ffixas.filter(nome=ffixa).exists():
                # se funcao fixa ja esta associada a funcao nada precisa ser feito
                flist.remove(ffixa)
            else:
                if FuncaoFixa.objects.filter(nome=ffixa).exists():
                    ff = FuncaoFixa.objects.get(nome=ffixa)
                else:
                    ff = FuncaoFixa.objects.create(nome=ffixa)
                ff.cargos.add(registro)
                flist.remove(ffixa)
        for item in flist:
            if registro.ffixas.filter(nome=item).exists():
                FuncaoFixa.objects.get(nome=item).cargos.remove(registro)
        l = Log()
        l.modelo = "pessoal.cargo"
        l.objeto_id = registro.id
        l.objeto_str = registro.nome[0:48]
        l.usuario = request.user
        l.mensagem = "UPDATE"
        l.save()
        messages.success(request, settings.DEFAULT_MESSAGES['updated'] + f' <b>{registro.nome}</b>')
        return redirect('pessoal_cargo_id', id)
    else:
        return render(request,'pessoal/cargo_id.html',{'form':form,'cargo':cargo})

@login_required
@permission_required('pessoal.change_funcionario', login_url="/handler/403")
def funcionario_update(request,id):
    funcionario = Funcionario.objects.get(pk=id)
    if funcionario.status == 'D':
        messages.error(request,'<span data-i18n="personal.sys.cantMoveDismissEmployee"><b>Erro:</b> Não é possivel movimentar funcionários desligados</span>')
        return redirect('pessoal_funcionario_id', id)
    form = FuncionarioForm(request.POST, request.FILES, instance=funcionario)
    if form.is_valid():
        has_warnings = False
        registro = form.save(commit=False)
        if request.POST['foto_data_url'] != '':
            prefix = f'{registro.empresa.id}_{registro.matricula}'
            today = datetime.now()
            timestamp = datetime.timestamp(today)
            file_name = f'{prefix}_{timestamp}.png'
            result = create_image(request.POST['foto_data_url'], f'{settings.MEDIA_ROOT}/pessoal/fotos', file_name, f'{prefix}_')
            if result[0]:
                registro.foto = f'pessoal/fotos/{file_name}'
            else:
                has_warnings = True
                messages.warning(request, settings.DEFAULT_MESSAGES['saveError'] + f' pic: result[1]')
        registro.save()
        l = Log()
        l.modelo = "pessoal.funcionario"
        l.objeto_id = registro.id
        l.objeto_str = registro.nome[0:48]
        l.usuario = request.user
        l.mensagem = "UPDATE"
        l.save()
        if not has_warnings:
            messages.success(request, settings.DEFAULT_MESSAGES['updated'] + f' mat: <b>{registro.matricula}</b>')
        return redirect('pessoal_funcionario_id', id)
    else:
        return render(request,'pessoal/funcionario_id.html',{'form':form,'funcionario':funcionario})

@login_required
@permission_required('pessoal.change_evento', login_url="/handler/403")
def evento_update(request,id):
    evento = Evento.objects.get(pk=id)
    form = EventoForm(request.POST, instance=evento)
    if form.is_valid():
        registro = form.save()
        l = Log()
        l.modelo = "pessoal.evento"
        l.objeto_id = registro.id
        l.objeto_str = registro.nome[0:48]
        l.usuario = request.user
        l.mensagem = "UPDATE"
        l.save()
        messages.success(request, settings.DEFAULT_MESSAGES['updated'] + f' <b>{registro.nome}</b>')
        return redirect('pessoal_evento_id', id)
    else:
        return render(request,'pessoal/evento_id.html',{'form':form,'evento':evento})

@login_required
@permission_required('pessoal.change_grupoevento', login_url="/handler/403")
def grupo_evento_update(request,id):
    grupo_evento = GrupoEvento.objects.get(pk=id)
    form = GrupoEventoForm(request.POST, instance=grupo_evento)
    if form.is_valid():
        registro = form.save()
        l = Log()
        l.modelo = "pessoal.grupo_evento"
        l.objeto_id = registro.id
        l.objeto_str = registro.nome[0:48]
        l.usuario = request.user
        l.mensagem = "UPDATE"
        l.save()
        messages.success(request, settings.DEFAULT_MESSAGES['updated'] + f' <b>{registro.nome}</b>')
        return redirect('pessoal_grupo_evento_id', id)
    else:
        return render(request,'pessoal/grupo_evento_id.html',{'form':form,'grupo_evento':grupo_evento})

# Metodos DELETE
@login_required
@permission_required('pessoal.delete_setor', login_url="/handler/403")
def setor_delete(request,id):
    try:
        registro = Setor.objects.get(pk=id)
        l = Log()
        l.modelo = "pessoal.setor"
        l.objeto_id = registro.id
        l.objeto_str = registro.nome[0:48]
        l.usuario = request.user
        l.mensagem = "DELETE"
        registro.delete()
        l.save()
        messages.warning(request, settings.DEFAULT_MESSAGES['deleted'] + f' <b>{registro.nome}</b>')
        return redirect('pessoal_setores')
    except:
        messages.error(request, settings.DEFAULT_MESSAGES['deleteError'] + f' <b>{registro.nome}</b>')
        return redirect('pessoal_setor_id', id)

@login_required
@permission_required('pessoal.delete_cargo', login_url="/handler/403")
def cargo_delete(request,id):
    try:
        registro = Cargo.objects.get(pk=id)
        l = Log()
        l.modelo = "pessoal.cargo"
        l.objeto_id = registro.id
        l.objeto_str = registro.nome[0:48]
        l.usuario = request.user
        l.mensagem = "DELETE"
        registro.delete()
        l.save()
        messages.warning(request, settings.DEFAULT_MESSAGES['deleted'] + f' <b>{registro.nome}</b>')
        return redirect('pessoal_cargos')
    except:
        messages.error(request, settings.DEFAULT_MESSAGES['deleteError'] + f' <b>{registro.nome}</b>')
        return redirect('pessoal_cargo_id', id)

@login_required
@permission_required('pessoal.delete_funcionario', login_url="/handler/403")
def funcionario_delete(request,id):
    try:
        registro = Funcionario.objects.get(pk=id)
        l = Log()
        l.modelo = "pessoal.funcionario"
        l.objeto_id = registro.id
        l.objeto_str = registro.nome[0:48]
        l.usuario = request.user
        l.mensagem = "DELETE"
        registro.delete()
        l.save()
        messages.warning(request,settings.DEFAULT_MESSAGES['deleted'] + f' <b>{registro.matricula}</b>')
        return redirect('pessoal_funcionarios')
    except:
        messages.error(request,'ERRO ao apagar funcionario')
        return redirect('pessoal_funcionario_id', id)

@login_required
@permission_required('pessoal.delete_evento', login_url="/handler/403")
def evento_delete(request,id):
    try:
        registro = Evento.objects.get(pk=id)
        l = Log()
        l.modelo = "pessoal.evento"
        l.objeto_id = registro.id
        l.objeto_str = registro.nome[0:48]
        l.usuario = request.user
        l.mensagem = "DELETE"
        registro.delete()
        l.save()
        messages.warning(request, settings.DEFAULT_MESSAGES['deleted'] + f' <b>{registro.nome}</b>')
        return redirect('pessoal_eventos')
    except:
        messages.error(request, settings.DEFAULT_MESSAGES['deleteError'] + f' <b>{registro.nome}</b>')
        return redirect('pessoal_evento_id', id)

@login_required
@permission_required('pessoal.delete_grupoevento', login_url="/handler/403")
def grupo_evento_delete(request,id):
    try:
        registro = GrupoEvento.objects.get(pk=id)
        l = Log()
        l.modelo = "pessoal.grupo_evento"
        l.objeto_id = registro.id
        l.objeto_str = registro.nome[0:48]
        l.usuario = request.user
        l.mensagem = "DELETE"
        registro.delete()
        l.save()
        messages.warning(request, settings.DEFAULT_MESSAGES['deleted'] + f' <b>{registro.nome}</b>')
        return redirect('pessoal_grupo_eventos')
    except:
        messages.error(request, settings.DEFAULT_MESSAGES['deleteError'] + f' <b>{registro.nome}</b>')
        return redirect('pessoal_grupo_evento_id', id)

# Metodos Ajax
@login_required
def get_setores(request):
    setores = Setor.objects.all().order_by('nome')
    obj = serializers.serialize('json', setores)
    return HttpResponse(obj, content_type="application/json")

@login_required
def get_cargos(request):
    try:
        cargos = Cargo.objects.filter(setor__id=request.GET.get('setor',None))
        obj = serializers.serialize('json', cargos)
    except Exception as e:
        obj = []
    return HttpResponse(obj, content_type="application/json")

@login_required
def get_grupos_evento(request):
    if not request.user.has_perm("pessoal.view_grupoevento"):
        return JsonResponse({'status': 'access denied'}, status=401)
    grupos_evento = GrupoEvento.objects.all().order_by('nome')
    obj = serializers.serialize('json', grupos_evento)
    return HttpResponse(obj, content_type="application/json")

@login_required
def add_grupo_evento(request):
    if not request.user.has_perm("pessoal.add_grupoevento"):
        return JsonResponse({'status': 'access denied'}, status=401)
    
    if request.method == 'POST':
        data = json.loads(request.body)
        form = GrupoEventoForm(data)
        if form.is_valid():
            grupo_evento = form.save()
            return JsonResponse({'pk': grupo_evento.id, 'model': 'pessoal.grupoevento', 'fields': {'nome': grupo_evento.nome}, 'status': 'success'}, status=200)
        else:
            return JsonResponse({'errors': form.errors, 'status': 'error'}, status=400)
    return JsonResponse({'status': 'invalid request'}, status=400)

# @login_required
# def update_grupo_evento(request):
#     if not request.user.has_perm("pessoal.change_grupoevento"):
#         return JsonResponse({'status': 'access denied'}, status=401)
#     if request.method == 'POST':
#         try:
#             data = json.loads(request.body)
#             if not data['pk']:
#                 return JsonResponse({'status': 'field pk expected on request'}, status=400)
#             grupo = GrupoEvento.objects.get(pk=data['pk'])
#             form = GrupoEventoForm(data, instance=grupo)
#             if form.is_valid():
#                 registro = form.save()
#                 l = Log()
#                 l.modelo = "pessoal.grupo_evento"
#                 l.objeto_id = registro.id
#                 l.objeto_str = registro.nome[0:48]
#                 l.usuario = request.user
#                 l.mensagem = "UPDATE"
#                 l.save()
#                 return JsonResponse({'pk': registro.id, 'model': 'pessoal.grupoevento', 'fields': {'nome': registro.nome}, 'status': 'success'}, status=200)
#             return JsonResponse({'errors': form.errors, 'status': 'error'}, status=400)
#         except Exception as e:
#             return JsonResponse({'error': e, 'status': 'error'}, status=500)
#     return JsonResponse({'status': 'invalid request'}, status=400)


# @login_required
# def delete_grupo_evento(request):
#     if not request.user.has_perm("pessoal.delete_grupoevento"):
#         return JsonResponse({'status': 'access denied'}, status=401)
#     if request.method == 'POST':
#         try:
#             data = json.loads(request.body)
#             if not data['pk']:
#                 return JsonResponse({'status': 'field pk expected on request'}, status=400)
#             registro = GrupoEvento.objects.get(pk=data['pk'])
#             l = Log()
#             l.modelo = "pessoal.setor"
#             l.objeto_id = registro.id
#             l.objeto_str = registro.nome[0:48]
#             l.usuario = request.user
#             l.mensagem = "DELETE"
#             registro.delete()
#             l.save()
#             return JsonResponse({'pk': data['pk'], 'model': 'pessoal.grupoevento', 'fields': {'nome': registro.nome}, 'status': 'success'}, status=200)
#         except Exception as e:
#             return JsonResponse({'error': e, 'status': 'error'}, status=500)
#     return JsonResponse({'status': 'invalid request'}, status=400)