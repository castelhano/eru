from django.views.generic.edit import CreateView
from django.urls import reverse_lazy
from django.contrib.auth.mixins import LoginRequiredMixin, PermissionRequiredMixin
from django.shortcuts import render, redirect, get_object_or_404
from django.db.models import Q
from django.http import HttpResponse, JsonResponse
import json
#--
from rest_framework import viewsets, permissions, status
from .serializers import FuncionarioSerializer
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
#--
from django.core import serializers
from .models import Setor, Cargo, Funcionario, FuncaoFixa, Afastamento, Dependente, Evento, GrupoEvento, MotivoReajuste, EventoCargo, EventoFuncionario
from .forms import SetorForm, CargoForm, FuncionarioForm, AfastamentoForm, DependenteForm, EventoForm, GrupoEventoForm, EventoCargoForm, EventoFuncionarioForm, MotivoReajusteForm
from .filters import FuncionarioFilter, EventoCargoFilter, EventoFuncionarioFilter
from django.contrib.auth.decorators import login_required, permission_required
from django.contrib import messages
from core.extras import create_image, get_props
from django.conf import settings
from datetime import datetime, date


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
                return redirect('pessoal:funcionario_id', funcionario.id)
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
            return redirect('pessoal:funcionarios')
    return render(request, 'pessoal/funcionarios.html', options)

@login_required
@permission_required('pessoal.view_dependente', login_url="/handler/403")
def dependentes(request, id):
    funcionario = Funcionario.objects.get(pk=id)
    dependentes = Dependente.objects.filter(funcionario=funcionario).order_by('nome')
    return render(request,'pessoal/dependentes.html',{'dependentes':dependentes, 'funcionario':funcionario})


@login_required
@permission_required('pessoal.view_evento', login_url="/handler/403")
def eventos(request):
    eventos = Evento.objects.all().order_by('nome')
    return render(request,'pessoal/eventos.html',{'eventos':eventos})

@login_required
def eventos_related(request, related, id):
    if not request.user.has_perm(f"pessoal.view_evento{related}"):
        return redirect('handler', 403)
    options = {"related": related}
    options['form'] = EventoCargoForm() # usa o cargo form apenas para efeito de consulta no template
    # options['form'] = EventoCargoForm({'tipo': ''}) # usa o cargo form apenas para efeito de consulta no template
    options['form'].fields['tipo'].required = False
    empty_choice = [('', "---------")]
    options['form'].fields['tipo'].choices = empty_choice + list(options['form'].fields['tipo'].choices)

    if related == 'cargo':
        options['model'] = Cargo.objects.get(pk=id)
        options['eventos'] = EventoCargo.objects.filter(cargo=options['model'], empresas__in=request.user.profile.empresas.all()).order_by('evento__nome').distinct()
        if not request.GET or not request.GET.get('fim', None):
            options['eventos'] = options['eventos'].exclude(fim__lt=date.today())
        if request.GET:
            rel_filter = EventoCargoFilter(request.GET, queryset=options['eventos'])
            options['eventos'] = rel_filter.qs
            if len(options['eventos']) == 0:
                messages.warning(request, settings.DEFAULT_MESSAGES['emptyQuery'])
    elif related == 'funcionario':
        options['model'] = Funcionario.objects.get(pk=id)
        options['eventos'] = EventoFuncionario.objects.filter(funcionario=options['model']).order_by('evento__nome')
        if not request.GET or not request.GET.get('fim', None):
            options['eventos'] = options['eventos'].exclude(fim__lt=date.today())
        if request.GET:
            rel_filter = EventoFuncionarioFilter(request.POST, queryset=options['eventos'])
            options['eventos'] = rel_filter.qs
            if len(options['eventos']) == 0:
                messages.warning(request, settings.DEFAULT_MESSAGES['emptyQuery'])
    else:
        messages.error(request, settings.DEFAULT_MESSAGES['400'] + ' <b>pessoal:eventos_related, invalid related</b>')
        return redirect('index')
    return render(request,'pessoal/eventos_related.html', options)
    

@login_required
@permission_required('pessoal.view_grupoevento', login_url="/handler/403")
def grupos_evento(request):
    grupos_evento = GrupoEvento.objects.all().order_by('nome')
    return render(request,'pessoal/grupos_evento.html',{'grupos_evento':grupos_evento})

@login_required
@permission_required('pessoal.view_motivoreajuste', login_url="/handler/403")
def motivos_reajuste(request):
    motivos_reajuste = MotivoReajuste.objects.all().order_by('nome')
    return render(request,'pessoal/motivos_reajuste.html',{'motivos_reajuste':motivos_reajuste})


# Metodos ADD
# @login_required
# @permission_required('pessoal.add_setor', login_url="/handler/403")
class setor_add(LoginRequiredMixin, PermissionRequiredMixin, CreateView):
    model = Setor
    form_class = SetorForm
    template_name = 'pessoal/setor_add.html'
    success_url = reverse_lazy('pessoal:setores')
    permission_required = 'pessoal.add_setor'
    login_url = '/handler/403'
    def form_valid(self, form):
        messages.success(self.request, settings.DEFAULT_MESSAGES['created'] + f' <b>{form.cleaned_data['nome']}</b>')
        return super().form_valid(form)

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
                messages.success(request, settings.DEFAULT_MESSAGES['created'] + f' <b>{registro.nome}</b>')
                return redirect('pessoal:cargo_add')
            except:
                messages.error(request, settings.DEFAULT_MESSAGES['saveError'])
                return redirect('pessoal:cargo_add')
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
                if not has_warnings:
                    messages.success(request,settings.DEFAULT_MESSAGES['created'] + f' <b>{registro.matricula}</b>')
                return redirect('pessoal:funcionario_id', registro.id)
            except:
                messages.error(request, settings.DEFAULT_MESSAGES['saveError'] + f' <b>{registro.matricula}</b>')
                return redirect('pessoal:funcionario_add')
    else:
        form = FuncionarioForm()
    return render(request,'pessoal/funcionario_add.html', {'form':form})

@login_required
@permission_required('pessoal.add_dependente', login_url="/handler/403")
def dependente_add(request, id):
    if request.method == 'POST':
        form = DependenteForm(request.POST)
        if form.is_valid():
            try:
                registro = form.save()
                messages.success(request, settings.DEFAULT_MESSAGES['created'])
                return redirect('pessoal:dependente_add')
            except:
                messages.error(request, settings.DEFAULT_MESSAGES['saveError'])
                return redirect('pessoal:dependente_add')
    else:
        funcionario = Funcionario.objects.get(pk=id)
        _new = Dependente()
        _new.funcionario = funcionario
        form = DependenteForm(instance=_new)
    return render(request,'pessoal/dependente_add.html',{'form':form, 'funcionario':funcionario})

@login_required
@permission_required('pessoal.add_evento', login_url="/handler/403")
def evento_add(request):
    if request.method == 'POST':
        form = EventoForm(request.POST)
        if form.is_valid():
            try:
                registro = form.save()
                messages.success(request, settings.DEFAULT_MESSAGES['created'] + f' <b>{registro.nome}</b>')
                return redirect('pessoal:evento_add')
            except:
                messages.error(request, settings.DEFAULT_MESSAGES['saveError'])
                return redirect('pessoal:evento_add')
    else:
        form = EventoForm()
    return render(request,'pessoal/evento_add.html',{'form':form})

@login_required
def evento_related_add(request, related, id):
    if not request.user.has_perm(f"pessoal.view_evento{related}"):
        return redirect('handler', 403)
    if request.method == 'POST':
        if related == 'cargo':
            form = EventoCargoForm(request.POST, user=request.user)
        elif related == 'funcionario':
            form = EventoFuncionarioForm(request.POST)
        if form.is_valid():
            try:
                registro = form.save()
                messages.success(request, settings.DEFAULT_MESSAGES['created'] + f' <b>{registro.evento.nome}</b>')
            except:
                messages.error(request, settings.DEFAULT_MESSAGES['saveError'])
            return redirect('pessoal:eventos_related', related, id)
        else:
            if related == 'cargo':
                model = Cargo.objects.get(pk=id)
            elif related == 'funcionario':
                model = Funcionario.objects.get(pk=id)
            return render(request,'pessoal/evento_related_add.html', {'form':form, 'related':related, 'model':model})
    else:
        prop_func = get_props(Funcionario)
        props_custom = list(Evento.objects.exclude(rastreio='').values_list('rastreio', flat=True).distinct())
        if related == 'cargo':
            form = EventoCargoForm(user=request.user)
            model = Cargo.objects.get(pk=id)
        elif related == 'funcionario':
            form = EventoFuncionarioForm()
            model = Funcionario.objects.get(pk=id)
        return render(request,'pessoal/evento_related_add.html', {'form':form, 'related':related, 'model':model, 'props': prop_func + props_custom})

# Copia um ou mais eventos de um modelo para outro, podendo ser cargo ou funcionario
@login_required
def evento_related_copy(request):
    # if not request.user.has_perm(f"pessoal.add_evento{related}"):
    #     return redirect('handler', 403)
    if request.method == 'POST':
        if related == 'cargo':
            pass
        elif related == 'funcionario':
            pass
        else:
            messages.error(request, settings.DEFAULT_MESSAGES['400'] + f' <b>evento_related_copy [bad request]</b>')
            return redirect('index')
    else:
        return render(request, 'pessoal/evento_related_copy.html')

    

@login_required
@permission_required('pessoal.add_grupoevento', login_url="/handler/403")
def grupo_evento_add(request):
    if request.method == 'POST':
        form = GrupoEventoForm(request.POST)
        if form.is_valid():
            try:
                registro = form.save()
                messages.success(request, settings.DEFAULT_MESSAGES['created'] + f' <b>{registro.nome}</b>')
                return redirect('pessoal:grupo_evento_add')
            except:
                messages.error(request, settings.DEFAULT_MESSAGES['saveError'])
                return redirect('pessoal:grupo_evento_add')
    else:
        form = GrupoEventoForm()
    return render(request,'pessoal/grupo_evento_add.html',{'form':form})

@login_required
@permission_required('pessoal.add_motivoreajuste', login_url="/handler/403")
def motivo_reajuste_add(request):
    if request.method == 'POST':
        form = MotivoReajusteForm(request.POST)
        if form.is_valid():
            try:
                registro = form.save()
                messages.success(request, settings.DEFAULT_MESSAGES['created'] + f' <b>{registro.nome}</b>')
                return redirect('pessoal:motivo_reajuste_add')
            except:
                messages.error(request, settings.DEFAULT_MESSAGES['saveError'])
                return redirect('pessoal:motivo_reajuste_add')
    else:
        form = MotivoReajusteForm()
    return render(request,'pessoal/motivo_reajuste_add.html',{'form':form})


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
        return redirect('pessoal:funcionarios')
    form = FuncionarioForm(instance=funcionario)
    return render(request,'pessoal/funcionario_id.html',{'form':form,'funcionario':funcionario})

@login_required
@permission_required('pessoal.change_dependente', login_url="/handler/403")
def dependente_id(request,id):
    dependente = Dependente.objects.get(pk=id)
    form = DependenteForm(instance=dependente)
    return render(request,'pessoal/dependente_id.html',{'form':form,'dependente':dependente})

@login_required
@permission_required('pessoal.change_evento', login_url="/handler/403")
def evento_id(request,id):
    evento = Evento.objects.get(pk=id)
    form = EventoForm(instance=evento)
    return render(request,'pessoal/evento_id.html',{'form':form,'evento':evento})

@login_required
def evento_related_id(request, related, id):
    if not request.user.has_perm(f"pessoal.view_evento{related}"):
        return redirect('handler', 403)
    options = {'related':related}
    options['props'] = get_props(Funcionario)
    if related == 'cargo':
        options['evento'] = EventoCargo.objects.get(pk=id)
        options['model'] = options['evento'].cargo
        options['form'] = EventoCargoForm(instance=options['evento'])
    elif related == 'funcionario':
        options['evento'] = EventoFuncionario.objects.get(pk=id)
        options['model'] = options['evento'].funcionario
        options['form'] = EventoFuncionarioForm(instance=options['evento'])
    else:
        messages.error(request, settings.DEFAULT_MESSAGES['400'] + f' <b>evento_related_id [bad request]</b>')
        return redirect('pessoal:eventos_related', related, id)
    return render(request,'pessoal/evento_related_id.html', options)

@login_required
@permission_required('pessoal.change_grupoevento', login_url="/handler/403")
def grupo_evento_id(request,id):
    grupo_evento = GrupoEvento.objects.get(pk=id)
    form = GrupoEventoForm(instance=grupo_evento)
    return render(request,'pessoal/grupo_evento_id.html', {'form':form,'grupo_evento':grupo_evento})

@login_required
@permission_required('pessoal.change_motivoreajuste', login_url="/handler/403")
def motivo_reajuste_id(request,id):
    motivo_reajuste = MotivoReajuste.objects.get(pk=id)
    form = GrupoEventoForm(instance=motivo_reajuste)
    return render(request,'pessoal/motivo_reajuste_id.html', {'form':form,'motivo_reajuste':motivo_reajuste})



# Metodos UPDATE
@login_required
@permission_required('pessoal.change_setor', login_url="/handler/403")
def setor_update(request,id):
    setor = Setor.objects.get(pk=id)
    form = SetorForm(request.POST, instance=setor)
    if form.is_valid():
        registro = form.save()
        messages.success(request, settings.DEFAULT_MESSAGES['updated'] + f' <b>{registro.nome}</b>')
        return redirect('pessoal:setor_id', id)
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
        messages.success(request, settings.DEFAULT_MESSAGES['updated'] + f' <b>{registro.nome}</b>')
        return redirect('pessoal:cargo_id', id)
    else:
        return render(request,'pessoal/cargo_id.html',{'form':form,'cargo':cargo})

@login_required
@permission_required('pessoal.change_funcionario', login_url="/handler/403")
def funcionario_update(request,id):
    funcionario = Funcionario.objects.get(pk=id)
    if funcionario.status == 'D':
        messages.error(request,'<span data-i18n="personal.sys.cantMoveDismissEmployee"><b>Erro:</b> Não é possivel movimentar funcionários desligados</span>')
        return redirect('pessoal:funcionario_id', id)
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
        if not has_warnings:
            messages.success(request, settings.DEFAULT_MESSAGES['updated'] + f' mat: <b>{registro.matricula}</b>')
        return redirect('pessoal:funcionario_id', id)
    else:
        return render(request,'pessoal/funcionario_id.html',{'form':form,'funcionario':funcionario})

@login_required
@permission_required('pessoal.change_dependente', login_url="/handler/403")
def dependente_update(request,id):
    dependente = Dependente.objects.get(pk=id)
    form = DependenteForm(request.POST, instance=dependente)
    if form.is_valid():
        registro = form.save()
        messages.success(request, settings.DEFAULT_MESSAGES['updated'])
        return redirect('pessoal:dependente_id', id)
    else:
        return render(request,'pessoal/dependente_id.html',{'form':form,'dependente':dependente})

@login_required
@permission_required('pessoal.change_evento', login_url="/handler/403")
def evento_update(request,id):
    evento = Evento.objects.get(pk=id)
    form = EventoForm(request.POST, instance=evento)
    if form.is_valid():
        registro = form.save()
        messages.success(request, settings.DEFAULT_MESSAGES['updated'] + f' <b>{registro.nome}</b>')
        return redirect('pessoal:evento_id', id)
    else:
        return render(request,'pessoal/evento_id.html',{'form':form,'evento':evento})

@login_required
def evento_related_update(request, related, id):
    if not request.user.has_perm(f"pessoal.change_evento{related}"):
        return redirect('handler', 403)
    if related == 'cargo':
        evento = EventoCargo.objects.get(pk=id)
        form = EventoCargoForm(request.POST, instance=evento)
    elif related == 'funcionario':
        evento = EventoFuncionario.objects.get(pk=id)
        form = EventoFuncionarioForm(request.POST, instance=evento)
    else:
        messages.error(request, settings.DEFAULT_MESSAGES['400'] + f' <b>evento_related_update [bad request]</b>')
        return redirect('pessoal:evento_related_id', related, id)
    if form.is_valid():
        registro = form.save()
        messages.success(request, settings.DEFAULT_MESSAGES['updated'] + f' <b>{registro.evento.nome}</b>')
        return redirect(f'pessoal:evento_related_id', related, id)
    else:
        return render(request,f'pessoal/evento_{related}_id.html',{'form':form, 'evento':evento})

@login_required
@permission_required('pessoal.change_grupoevento', login_url="/handler/403")
def grupo_evento_update(request,id):
    grupo_evento = GrupoEvento.objects.get(pk=id)
    form = GrupoEventoForm(request.POST, instance=grupo_evento)
    if form.is_valid():
        registro = form.save()
        messages.success(request, settings.DEFAULT_MESSAGES['updated'] + f' <b>{registro.nome}</b>')
        return redirect('pessoal:grupo_evento_id', id)
    else:
        return render(request,'pessoal/grupo_evento_id.html',{'form':form,'grupo_evento':grupo_evento})

@login_required
@permission_required('pessoal.change_motivoreajuste', login_url="/handler/403")
def motivo_reajuste_update(request,id):
    motivo_reajuste = MotivoReajuste.objects.get(pk=id)
    form = MotivoReajusteForm(request.POST, instance=motivo_reajuste)
    if form.is_valid():
        registro = form.save()
        messages.success(request, settings.DEFAULT_MESSAGES['updated'] + f' <b>{registro.nome}</b>')
        return redirect('pessoal:motivo_reajuste_id', id)
    else:
        return render(request,'pessoal/motivo_reajuste_id.html',{'form':form,'motivo_reajuste':motivo_reajuste})

# Metodos DELETE
@login_required
@permission_required('pessoal.delete_setor', login_url="/handler/403")
def setor_delete(request,id):
    try:
        registro = Setor.objects.get(pk=id)
        registro.delete()
        messages.warning(request, settings.DEFAULT_MESSAGES['deleted'] + f' <b>{registro.nome}</b>')
        return redirect('pessoal:setores')
    except:
        messages.error(request, settings.DEFAULT_MESSAGES['deleteError'] + f' <b>{registro.nome}</b>')
        return redirect('pessoal:setor_id', id)

@login_required
@permission_required('pessoal.delete_cargo', login_url="/handler/403")
def cargo_delete(request,id):
    try:
        registro = Cargo.objects.get(pk=id)
        registro.delete()
        messages.warning(request, settings.DEFAULT_MESSAGES['deleted'] + f' <b>{registro.nome}</b>')
        return redirect('pessoal:cargos')
    except:
        messages.error(request, settings.DEFAULT_MESSAGES['deleteError'] + f' <b>{registro.nome}</b>')
        return redirect('pessoal:cargo_id', id)

@login_required
@permission_required('pessoal.delete_funcionario', login_url="/handler/403")
def funcionario_delete(request,id):
    try:
        registro = Funcionario.objects.get(pk=id)
        registro.delete()
        messages.warning(request,settings.DEFAULT_MESSAGES['deleted'] + f' <b>{registro.matricula}</b>')
        return redirect('pessoal:funcionarios')
    except:
        messages.error(request,'ERRO ao apagar funcionario')
        return redirect('pessoal:funcionario_id', id)

@login_required
@permission_required('pessoal.delete_dependente', login_url="/handler/403")
def dependente_delete(request,id):
    try:
        registro = Dependente.objects.get(pk=id)
        registro.delete()
        messages.warning(request, settings.DEFAULT_MESSAGES['deleted'] + f' <b>{registro.nome}</b>')
        return redirect('pessoal:dependentes')
    except:
        messages.error(request, settings.DEFAULT_MESSAGES['deleteError'] + f' <b>{registro.nome}</b>')
        return redirect('pessoal:dependente_id', id)

@login_required
@permission_required('pessoal.delete_evento', login_url="/handler/403")
def evento_delete(request,id):
    try:
        registro = Evento.objects.get(pk=id)
        registro.delete()
        messages.warning(request, settings.DEFAULT_MESSAGES['deleted'] + f' <b>{registro.nome}</b>')
        return redirect('pessoal:eventos')
    except:
        messages.error(request, settings.DEFAULT_MESSAGES['deleteError'] + f' <b>{registro.nome}</b>')
        return redirect('pessoal:evento_id', id)

@login_required
def evento_related_delete(request, related, id):
    if not request.user.has_perm(f"pessoal.delete_evento{related}"):
        return redirect('handler', 403)
    try:
        if related == 'cargo':
            registro = EventoCargo.objects.get(pk=id)
        elif related == 'funcionario':
            registro = EventoFuncionario.objects.get(pk=id)
        else:
            messages.error(request, settings.DEFAULT_MESSAGES['400'] + f' <b>evento_related_update [bad request]</b>')
            return redirect('pessoal:evento_related_id', related, id)
        registro.delete()
        messages.warning(request, settings.DEFAULT_MESSAGES['deleted'] + f' <b>{registro.nome}</b>')
        return redirect('pessoal:eventos')
    except:
        messages.error(request, settings.DEFAULT_MESSAGES['deleteError'] + f' <b>{registro.nome}</b>')
        return redirect('pessoal:evento_id', id)

@login_required
@permission_required('pessoal.delete_grupoevento', login_url="/handler/403")
def grupo_evento_delete(request,id):
    try:
        registro = GrupoEvento.objects.get(pk=id)
        registro.delete()
        messages.warning(request, settings.DEFAULT_MESSAGES['deleted'] + f' <b>{registro.nome}</b>')
        return redirect('pessoal:grupos_evento')
    except:
        messages.error(request, settings.DEFAULT_MESSAGES['deleteError'] + f' <b>{registro.nome}</b>')
        return redirect('pessoal:grupo_evento_id', id)

@login_required
@permission_required('pessoal.delete_motivoreajuste', login_url="/handler/403")
def motivo_reajuste_delete(request,id):
    try:
        registro = MotivoReajuste.objects.get(pk=id)
        registro.delete()
        messages.warning(request, settings.DEFAULT_MESSAGES['deleted'] + f' <b>{registro.nome}</b>')
        return redirect('pessoal:motivos_reajuste')
    except:
        messages.error(request, settings.DEFAULT_MESSAGES['deleteError'] + f' <b>{registro.nome}</b>')
        return redirect('pessoal:motivo_reajuste_id', id)

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
def add_motivo_reajuste(request):
    if not request.user.has_perm("pessoal.add_motivoreajuste"):
        return JsonResponse({'status': 'access denied'}, status=401)
    
    if request.method == 'POST':
        data = json.loads(request.body)
        form = MotivoReajusteForm(data)
        if form.is_valid():
            motivo_reajuste = form.save()
            return JsonResponse({'pk': motivo_reajuste.id, 'model': 'pessoal.motivoreajuste', 'fields': {'nome': motivo_reajuste.nome}, 'status': 'success'}, status=200)
        else:
            return JsonResponse({'errors': form.errors, 'status': 'error'}, status=400)
    return JsonResponse({'status': 'invalid request'}, status=400)

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

@login_required
def add_setor(request):
    if not request.user.has_perm("pessoal.add_setor"):
        return JsonResponse({'status': 'access denied'}, status=401)
    
    if request.method == 'POST':
        data = json.loads(request.body)
        form = SetorForm(data)
        if form.is_valid():
            setor = form.save()
            return JsonResponse({'pk': setor.id, 'model': 'pessoal.setor', 'fields': {'nome': setor.nome}, 'status': 'success'}, status=200)
        else:
            return JsonResponse({'errors': form.errors, 'status': 'error'}, status=400)
    return JsonResponse({'status': 'invalid request'}, status=400)

@login_required
def update_grupo_evento(request):
    if not request.user.has_perm("pessoal.change_grupoevento"):
        return JsonResponse({'status': 'access denied'}, status=401)
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            if not data['pk']:
                return JsonResponse({'status': 'field pk expected on request'}, status=400)
            grupo = GrupoEvento.objects.get(pk=data['pk'])
            form = GrupoEventoForm(data, instance=grupo)
            if form.is_valid():
                registro = form.save()
                return JsonResponse({'pk': registro.id, 'model': 'pessoal.grupoevento', 'fields': {'nome': registro.nome}, 'status': 'success'}, status=200)
            return JsonResponse({'errors': form.errors, 'status': 'error'}, status=400)
        except Exception as e:
            return JsonResponse({'error': e, 'status': 'error'}, status=500)
    return JsonResponse({'status': 'invalid request'}, status=400)


@login_required
def delete_grupo_evento(request):
    if not request.user.has_perm("pessoal.delete_grupoevento"):
        return JsonResponse({'status': 'access denied'}, status=401)
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            if not data['pk']:
                return JsonResponse({'status': 'field pk expected on request'}, status=400)
            registro = GrupoEvento.objects.get(pk=data['pk'])
            registro.delete()
            return JsonResponse({'pk': data['pk'], 'model': 'pessoal.grupoevento', 'fields': {'nome': registro.nome}, 'status': 'success'}, status=200)
        except Exception as e:
            return JsonResponse({'error': e, 'status': 'error'}, status=500)
    return JsonResponse({'status': 'invalid request'}, status=400)

# APIs
class FuncionarioViewSet(viewsets.ModelViewSet):
    queryset = Funcionario.objects.filter(status='A').order_by('nome')
    serializer_class = FuncionarioSerializer
    permission_classes = [permissions.DjangoModelPermissions]
    filterset_fields = ['matricula']