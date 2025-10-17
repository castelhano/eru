from django.shortcuts import render, redirect
from django.db.models import Q
from django.http import HttpResponse
# from json import dumps
from django.core import serializers
from .models import Setor, Cargo, Funcionario, FuncaoFixa, Afastamento, Dependente
from .forms import SetorForm, CargoForm, FuncionarioForm, FuncaoFixaForm, AfastamentoForm, DependenteForm
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
@permission_required('pessoal.view_funcionario', login_url="/handler/403")
def funcionarios(request):
    if request.method == 'GET':
        form = FuncionarioForm()
        if request.GET.get('pesquisa'):
            # checa se existe funcionario com matricula informada na consulta, se sim abre form de edicao para funcionario
            if Funcionario.objects.filter(matricula=request.GET['pesquisa'], empresa__in=request.user.profile.empresas.all()).exists():
                funcionario = Funcionario.objects.get(matricula=request.GET['pesquisa'], empresa__in=request.user.profile.empresas.all())
                form = FuncionarioForm(instance=funcionario)
                return render(request,'pessoal/funcionario_id.html', {'form':form, 'funcionario': funcionario})
            else:
                # criterio de consulta nao corresponde a uma matricula, busca avancada por nome / apelido
                criterios = request.GET['pesquisa'].split(' ')
                
                # incia consulta setando somente funcionarios nas empresa autorizadas
                query = Q(empresa__in=request.user.profile.empresas.all())

                # Analise parcialmente cada nome informado buscando correspondencia 
                for nome in criterios:
                    query &= Q(nome__icontains=nome)
                
                # Adiciona na consulta busca pelo apelido
                query |= Q(apelido__icontains=request.GET['pesquisa'])
                
                funcionarios = Funcionario.objects.filter(query)
                if len(funcionarios) == 0:
                    messages.warning(request,'<i class="bi bi-exclamation-triangle-fill me-2"></i><span data-i18n="sys.noResultsFound">Nenhum resultado encontrado com os critérios informados</span>')
                return render(request,'pessoal/funcionarios.html', {'form':form, 'funcionarios': funcionarios})
        else:
            # Se veio por metodo get sem filtro, apenas exibe pagina base para consulta
            return render(request,'pessoal/funcionarios.html', {'form':form})
    else:
        # Request via POST vindo de um form de filtros, cria query e retorna resultados compativeis
        pass



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
                messages.success(request, settings.DEFAULT_MESSAGES['created'])
                return redirect('pessoal_setor_add')
            except:
                messages.error(request, settings.DEFAULT_MESSAGES['error'])
                return redirect('pessoal_setor_add')
    else:
        form = SetorForm()
    return render(request,'pessoal/setor_add.html',{'form':form})

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
                    messages.success(request,'<span data-i18n="common.employee">Funcionário</span> <b>' + registro.matricula + '</b> <span data-i18n="common.registered" data-i18n-transform="lowerCase">cadastrado</span>')
                return redirect('pessoal_funcionario_id', registro.id)
            except:
                messages.error(request,'<span data-i18n="employees.sysMessages.errorCreateEmployee">Erro ao inserir funcionario [INVALID FORM]</span>')
                return redirect('pessoal_funcionario_add')
    else:
        form = FuncionarioForm()
    return render(request,'pessoal/funcionario_add.html', {'form':form})




# Metodos GET
@login_required
@permission_required('pessoal.change_setor', login_url="/handler/403")
def setor_id(request,id):
    setor = Setor.objects.get(pk=id)
    form = SetorForm(instance=setor)
    return render(request,'pessoal/setor_id.html',{'form':form,'setor':setor})

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
        messages.success(request,settings.DEFAULT_MESSAGES['updated'])
        return redirect('pessoal_setor_id', id)
    else:
        return render(request,'pessoal/setor_id.html',{'form':form,'setor':setor})

@login_required
@permission_required('pessoal.change_funcionario', login_url="/handler/403")
def funcionario_update(request,id):
    funcionario = Funcionario.objects.get(pk=id)
    if funcionario.status == 'D':
        messages.error(request,'<b>Erro:</b> Não é possivel movimentar funcionários desligados')
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
                messages.warning(request,'<b>Erro ao salvar foto:</b> ' + result[1])
        registro.save()
        l = Log()
        l.modelo = "pessoal.funcionario"
        l.objeto_id = registro.id
        l.objeto_str = registro.nome[0:48]
        l.usuario = request.user
        l.mensagem = "UPDATE"
        l.save()
        if not has_warnings:
            messages.success(request,'Funcionario <b>' + registro.matricula + '</b> alterado')
        return redirect('pessoal_funcionario_id', id)
    else:
        return render(request,'pessoal/funcionario_id.html',{'form':form,'funcionario':funcionario})


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
        messages.warning(request,f'Setor <b>{registro.nome}</b> apagado. Essa operação não pode ser desfeita')
        return redirect('pessoal_setores')
    except:
        messages.error(request,'ERRO ao apagar setor')
        return redirect('pessoal_setor_id', id)

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
        messages.warning(request,'Funcionario apagado. Essa operação não pode ser desfeita')
        return redirect('pessoal_funcionarios')
    except:
        messages.error(request,'ERRO ao apagar funcionario')
        return redirect('pessoal_funcionario_id', id)


# Metodos ajax (retorna json)
# @login_required
# def get_setores(request):
#     try:
#         setores = Setor.objects.all().order_by('nome')
#         itens = {}
#         for item in setores:
#             itens[item.nome] = item.id
#         dataJSON = dumps(itens)
#         return HttpResponse(dataJSON)
#     except:
#         return HttpResponse('')

@login_required
def get_setores(request):
    setores = Setor.objects.all().order_by('nome')
    obj = serializers.serialize('json', setores)
    return HttpResponse(obj, content_type="application/json")