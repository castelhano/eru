from django.shortcuts import render, redirect
# from django.http import HttpResponse
# from json import dumps
# from .models import Setor, Cargo, Funcionario, FuncaoFixa, Afastamento, Dependente
from .forms import SetorForm, CargoForm, FuncionarioForm, FuncaoFixaForm, AfastamentoForm, DependenteForm
from django.contrib.auth.decorators import login_required, permission_required
# from django.contrib import messages
from core.models import Log
# from core.extras import create_image
# from django.conf import settings
# from datetime import datetime



@login_required
@permission_required('pessoal.view_funcionario', login_url="/handler/403")
def funcionarios(request):
    form = FuncionarioForm()
    return render(request,'pessoal/funcionarios.html', {'form':form})
