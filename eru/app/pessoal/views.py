from django.shortcuts import render, redirect
# from django.http import HttpResponse
# from json import dumps
# from .models import Setor, Cargo, Funcionario, FuncaoFixa, Afastamento, Dependente
# from .forms import SetorForm, CargoForm, FuncionarioForm, FuncaoFixaForm, AfastamentoForm, DependenteForm
from django.contrib.auth.decorators import login_required, permission_required
# from django.contrib import messages
from core.models import Log
# from core.extras import create_image
# from django.conf import settings
# from datetime import datetime



@login_required
@permission_required('pessoal.view_funcionario', login_url="/handler/403")
def funcionarios(request):
    funcionarios = None
    if request.method == 'POST':
        funcionarios = Funcionario.objects.filter(empresa__in=request.user.profile.empresas.all()).order_by('matricula')
        validado = False #Precisa informar pelo menos um filtro, caso contrario retorna None
        if(request.POST['pesquisa'] != '' and len(request.POST['pesquisa']) > 2):
            if request.POST['pesquisa'][0] == '#':
                try:
                    funcionario = Funcionario.objects.get(matricula=request.POST['pesquisa'][1:])
                    return redirect('pessoal_funcionario_id',funcionario.id)
                except:
                    messages.warning(request,'Funcionario nao localizado')
                    return redirect('pessoal_funcionarios')
            else:
                funcionarios = funcionarios.filter(nome__contains=request.POST['pesquisa'])
                validado = True
        if(request.POST['empresa'] != ''):
                funcionarios = funcionarios.filter(empresa=request.POST['empresa'])
                validado = True
        if(request.POST['regime'] != ''):
            funcionarios = funcionarios.filter(regime=request.POST['regime'])
            validado = True
        if(request.POST['cargo'] != ''):
            funcionarios = funcionarios.filter(cargo=request.POST['cargo'])
            validado = True
        else: # SE JA FILTROU POR CARGO EH DESNECESSARIO FILTRAR POR SETOR
            if(request.POST['setor'] != ''):
                funcionarios = funcionarios.filter(cargo__setor=request.POST['setor'])
                validado = True
        if(request.POST['sexo'] != ''):
            funcionarios = funcionarios.filter(sexo=request.POST['sexo'])
            validado = True
        if(request.POST['status'] != ''):
            funcionarios = funcionarios.filter(status=request.POST['status'])
            validado = True
        if 'pne' in request.POST:
            funcionarios = funcionarios.filter(pne=True)
        if(request.POST['vencimento_cnh'] != ''):
            vencimento_cnh = request.POST['vencimento_cnh']
            funcionarios = funcionarios.filter(cnh_validade__lt=vencimento_cnh).order_by('cnh_validade')
            validado = True
        if not validado:
            funcionarios = None
            messages.warning(request,'Informe um criterio para a pesquisa')
        elif funcionarios.count() == 0:
            messages.warning(request,'Nenhum registro com os filtros informados')
            return render(request,'pessoal/funcionarios.html')
    return render(request,'pessoal/funcionarios.html', {'funcionarios':funcionarios})
