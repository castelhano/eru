# import os
import json
from django.shortcuts import render, redirect
from django.http import HttpResponse
# from django.db.models import Q
from core.models import Empresa, Log
from .models import Linha, Localidade, Trajeto, Patamar, Planejamento, Carro, Viagem
from .forms import LinhaForm, LocalidadeForm, TrajetoForm, PlanejamentoForm
# from .validators import validate_file_extension
from django.contrib.auth.decorators import login_required, permission_required
from django.contrib import messages
# from datetime import date, datetime


# METODOS SHOW
@login_required
@permission_required('trafego.view_localidade', login_url="/handler/403")
def localidades(request):
    if request.GET.get('showAll', None) == 'true':
        localidades = Localidade.objects.all().order_by('nome')
        return render(request,'trafego/localidades.html', {'localidades':localidades})
    return render(request,'trafego/localidades.html')

@login_required
@permission_required('trafego.view_linha', login_url="/handler/403")
def linhas(request):
    inativa = request.GET.get('inativa', False)
    linhas = Linha.objects.filter(inativa=inativa).order_by('codigo')
    if request.GET.get('empresa', None):
        try:
            empresa = request.user.profile.empresas.filter(id=request.GET.get('empresa', None)).get()
        except:
            messages.error(request,'Empresa <b>não encontrada</b> ou <b>não habilitada</b>')
            return redirect('trafego_linhas')
        linhas = linhas.filter(empresa=empresa)
        empresa_display = empresa.nome
    else:
        empresa_display = 'Todas'
        linhas = linhas.filter(empresa__in=request.user.profile.empresas.all())
    metrics = dict(status_display='Ativas' if inativa == True else 'Inativas', empresa_display = empresa_display)
    return render(request,'trafego/linhas.html', {'linhas' : linhas, 'metrics':metrics})

@login_required
@permission_required('trafego.view_linha', login_url="/handler/403")
def trajetos(request, id_linha):
    metrics = {}
    if request.method == 'POST':
        form = TrajetoForm(request.POST)
        if form.is_valid():
            metrics['sentido'] = request.POST.get('sentido', None)
            try:
                registro = form.save(commit=False)
                if registro.seq == None:
                    registro.seq = Trajeto.objects.filter(linha=registro.linha, sentido=registro.sentido).count() + 1
                else:
                    # Caso informado sequencia que trajeto deva entrar, ajusta sequencias posteriores
                    qtde = Trajeto.objects.filter(linha=registro.linha, sentido=registro.sentido).count()
                    if registro.seq > qtde: # Caso informado sequencia maior que ponto existentes, ajusta para ultima sequencia
                        registro.seq = qtde + 1
                    for p in Trajeto.objects.filter(linha=registro.linha, sentido=registro.sentido, seq__gte=registro.seq):
                        p.seq += 1
                        p.save()
                registro.save()
                l = Log()
                l.modelo = "trafego.linha"
                l.objeto_id = registro.linha.id
                l.objeto_str = registro.linha.codigo
                l.usuario = request.user
                l.mensagem = "UPDATE"
                l.save()
            except Exception as e:
                messages.error(request,f'<b>Erro:</b> {e}')
        else:
            metrics['form'] = form
    try:
        metrics['linha'] = Linha.objects.get(id=id_linha)
        metrics['ida'] = Trajeto.objects.filter(linha=metrics['linha'], sentido='I').order_by('seq')
        metrics['volta'] = Trajeto.objects.filter(linha=metrics['linha'], sentido='V').order_by('seq')
        metrics['unico'] = Trajeto.objects.filter(linha=metrics['linha'], sentido='U').order_by('seq')
    except Exception as e:
        messages.error(request,f'<b>Erro:</b> {e}')
    return render(request, 'trafego/trajetos.html', metrics)

@login_required
@permission_required('trafego.view_planejamento', login_url="/handler/403")
def planejamentos(request):
    planejamentos = Planejamento.objects.all().order_by('linha__codigo', 'data_criacao')
    if request.GET.get('pesquisa', None):
        if Planejamento.objects.filter(codigo=request.GET['pesquisa']).exists():
            planejamento = Planejamento.objects.get(codigo=request.GET['pesquisa'])
            return redirect('trafego_planejamento_id', planejamento.id)
        else:
            planejamentos = planejamentos.filter(linha__codigo=request.GET['pesquisa'])
    else:
        planejamentos = planejamentos.filter(pin=True)
    return render(request,'trafego/planejamentos.html', {'planejamentos':planejamentos})

# METODOS ADD
@login_required
@permission_required('trafego.add_localidade', login_url="/handler/403")
def localidade_add(request):
    if request.method == 'POST':
        form = LocalidadeForm(request.POST)
        if form.is_valid():
            try:
                registro = form.save()
                l = Log()
                l.modelo = "trafego.localidade"
                l.objeto_id = registro.id
                l.objeto_str = registro.nome
                l.usuario = request.user
                l.mensagem = "CREATED"
                l.save()
                messages.success(request,f'Localidade <b>{registro.nome}</b> criada')
                return redirect('trafego_localidade_add')
            except:
                pass
    else:
        form = LocalidadeForm()
    return render(request,'trafego/localidade_add.html',{'form':form})

@login_required
@permission_required('trafego.add_linha', login_url="/handler/403")
def linha_add(request):
    if request.method == 'POST':
        form = LinhaForm(request.POST)
        if form.is_valid():
            try:
                registro = form.save()
                l = Log()
                l.modelo = "trafego.linha"
                l.objeto_id = registro.id
                l.objeto_str = registro.codigo + ' - ' + registro.nome[0:48]
                l.usuario = request.user
                l.mensagem = "CREATED"
                l.save()
                messages.success(request,f'Linha <b>{registro.codigo}</b> criada')
                return redirect('trafego_linha_id',registro.id)
            except:
                pass
    else:
        form = LinhaForm()
    return render(request,'trafego/linha_add.html',{'form':form})

@login_required
@permission_required('trafego.add_planejamento', login_url="/handler/403")
def planejamento_add(request):
    if request.method == 'POST':
        form = PlanejamentoForm(request.POST, request.FILES)
        if form.is_valid():
            registro = form.save(commit=False)
            registro.usuario = request.user
            registro.save()
            # Caso anexado planejamento (preformatado) insere viagens no planejamento
            if request.FILES.get('viagens', None):
                try:
                    viagens = json.load(request.FILES['viagens'])
                    viagens.sort(key=lambda x: x["carro"])
                except Exception as e:
                    messages.error(request,'<b>Erro</b> O arquivo anexado não é válido')
                    return render(request,'trafego/planejamento_id.html',{'form':form,'planejamento':planejamento})
                last_carro_seq = None
                carro = None
                for v in viagens:
                    if not last_carro_seq or last_carro_seq != v['carro']:
                        carro = Carro()
                        carro.planejamento = registro
                        carro.save()
                        last_carro_seq = v['carro']
                    v['carro'] = carro
                    try:
                        Viagem.objects.create(**v)
                    except Exception as e:
                        messages.error(request,f'<b>Erro</b>{e}, algumas viagens NÃO foram importadas')
                        return redirect('trafego_planejamento_add')
            # Se planejamento for marcado como ativo, inativa planejamento atual
            if registro.ativo:
                Planejamento.objects.filter(empresa=registro.empresa,linha=registro.linha,dia_tipo=registro.dia_tipo,ativo=True).exclude(id=registro.id).update(ativo=False)
            l = Log()
            l.modelo = "trafego.planejamento"
            l.objeto_id = registro.id
            l.objeto_str = registro.codigo
            l.usuario = request.user
            l.mensagem = "CREATED"
            l.save()
            messages.success(request,'Planejamento <b>' + registro.codigo + '</b> criado')
            return redirect('trafego_planejamento_id', registro.id)
    else:
        form = PlanejamentoForm()
    return render(request,'trafego/planejamento_add.html',{'form':form})

# METODOS GET
@login_required
@permission_required('trafego.change_localidade', login_url="/handler/403")
def localidade_id(request, id):
    localidade = Localidade.objects.get(id=id)
    form = LocalidadeForm(instance=localidade)
    return render(request,'trafego/localidade_id.html',{'form':form,'localidade':localidade})

@login_required
@permission_required('trafego.view_linha', login_url="/handler/403")
def linha_id(request, id):
    linha = Linha.objects.get(id=id)
    form = LinhaForm(instance=linha)
    return render(request,'trafego/linha_id.html',{'form':form,'linha':linha})

@login_required
@permission_required('trafego.change_planejamento', login_url="/handler/403")
def planejamento_id(request,id):
    planejamento = Planejamento.objects.get(pk=id)
    if not planejamento.ativo:
        try:
            ativo = Planejamento.objects.filter(empresa=planejamento.empresa,linha=planejamento.linha,dia_tipo=planejamento.dia_tipo, ativo=True).get()             
        except:
            ativo = None
    else:
        ativo = None 
    form = PlanejamentoForm(instance=planejamento)
    return render(request,'trafego/planejamento_id.html',{'form':form,'planejamento':planejamento, 'ativo':ativo})

@login_required
@permission_required('trafego.view_planejamento', login_url="/handler/403")
def planejamento_grid(request, id):
    planejamento = Planejamento.objects.get(pk=id)
    return render(request,'trafego/planejamento_grid.html',{'planejamento':planejamento})

@login_required
@permission_required('trafego.view_planejamento', login_url="/handler/403")
def planejamento_horarios(request, id):
    planejamento = Planejamento.objects.get(pk=id)
    return render(request,'trafego/planejamento_horarios.html',{'planejamento':planejamento})

# METODOS UPDATE
@login_required
@permission_required('trafego.change_localidade', login_url="/handler/403")
def localidade_update(request, id):
    localidade = Localidade.objects.get(pk=id)
    form = LocalidadeForm(request.POST, instance=localidade)
    if form.is_valid():
        registro = form.save()
        l = Log()
        l.modelo = "trafego.localidade"
        l.objeto_id = registro.id
        l.objeto_str = registro.nome
        l.usuario = request.user
        l.mensagem = "UPDATE"
        l.save()
        messages.success(request,f'Localidade <b>{registro.nome}</b> alterada')
        return redirect('trafego_localidade_id', id)
    else:
        return render(request,'trafego/localidade_id.html',{'form':form,'localidade':localidade})

@login_required
@permission_required('trafego.change_linha', login_url="/handler/403")
def linha_update(request, id):
    linha = Linha.objects.get(pk=id)
    form = LinhaForm(request.POST, instance=linha)
    if form.is_valid():
        registro = form.save()
        l = Log()
        l.modelo = "trafego.linha"
        l.objeto_id = registro.id
        l.objeto_str = registro.codigo[0:10] + ' - ' + registro.nome[0:38]
        l.usuario = request.user
        l.mensagem = "UPDATE"
        l.save()
        messages.success(request,f'Linha <b>{registro.codigo}</b> alterada')
        return redirect('trafego_linha_id', id)
    else:
        return render(request,'trafego/linha_id.html',{'form':form,'linha':linha})

@login_required
@permission_required('trafego.change_patamar', login_url="/handler/403")
def patamar_update(request):
    # METODO PARA ADD E UPDATE DE PATAMARES
    if request.method == 'POST':
        try:
            linha = Linha.objects.get(id=request.POST['linha'])
            if request.POST['patamar'] != '':
                # PATAMAR EXISTENTE, CARREGA PARA UPDATE
                patamar = Patamar.objects.get(id=request.POST['patamar'])
            else:
                # NOVA INSERCAO
                patamar = Patamar()
                patamar.linha = linha
            patamar.inicial = int(request.POST['inicial'])
            patamar.final = int(request.POST['final'])
            patamar.ida = int(request.POST['ida'])
            patamar.volta = int(request.POST['volta'])
            patamar.intervalo_ida = int(request.POST['intervalo_ida'])
            patamar.intervalo_volta = int(request.POST['intervalo_volta'])
            has_errors = []
            has_errors.append(patamar.inicial > patamar.final)
            has_errors.append(patamar.inicial < 0 or patamar.final < 0)
            has_errors.append(patamar.inicial > 23 or patamar.final > 23)
            has_errors.append(patamar.ida < 1 or patamar.volta < 1)
            has_errors.append(patamar.ida > 540 or patamar.volta > 540) # INICIALMENTE CONSIDERADO VALOR MAXIMO PARA FAIXA DE 7 HORAS DE CICLO
            if True in has_errors:
                messages.error(request,f'<b>Erro: [PTC 1] Valores de patamar inválidos')
                return redirect('trafego_linha_id', linha.id)
            patamar.save()
                
            patamares = Patamar.objects.filter(linha=linha).exclude(id=patamar.id)
            retorno = patamar_tratar_conflitos(patamar, patamares)
            if retorno[0]:
                l = Log()
                l.modelo = "trafego.linha"
                l.objeto_id = linha.id
                l.objeto_str = linha.codigo + ' - ' + linha.nome
                l.usuario = request.user
                l.mensagem = "PATAMAR UPDATE"
                l.save()
                messages.success(request,'Patamares <b>atualizados</b>')
            else:
                messages.error(request,f'<b>Erro: [PTC 2]</b> {retorno[1]}')
        except Exception as e:
            messages.error(request,f'<b>Erro: [PTU 3]</b> {e}')
    return redirect('trafego_linha_id', linha.id)

def patamar_tratar_conflitos(patamar, patamares):
    try:
        for c in patamares:
            changed = False
            if c.inicial >= patamar.inicial and c.inicial <= patamar.final: # TRATA CONFLITO NO PERIODO INCIAL
                c.inicial = patamar.final + 1
                changed = True
            if c.final >= patamar.inicial and c.final <= patamar.final: # TRATA CONCLITO NO PERIODO FINAL
                c.final = patamar.inicial - 1
                changed = True
            if c.inicial <= patamar.inicial and c.final >= patamar.final:
            # TRATA CASO TODO INTERVALO ESTEJA CONFLITANDO, PODE RESULTAR EM DOIS PATAMARES COM OS INTERVALOS EXTERNOS AO NOVO PATAMAR
                n = Patamar()
                n.linha = c.linha
                n.inicial = patamar.final + 1
                n.final = c.final
                n.ida = c.ida
                n.volta = c.volta
                n.intervalo_ida = c.intervalo_ida
                n.intervalo_volta = c.intervalo_volta
                n.save()
                c.final = patamar.inicial - 1
                changed = True
            if changed:
                has_errors = []
                has_errors.append(c.inicial > c.final)
                has_errors.append(c.inicial < 0 or c.final < 0)
                has_errors.append(c.inicial > 23 or c.final > 23)
                if True in has_errors:
                    # VALIDA PATAMAR APOS AJUSTE DE CONFLITO, SE APRESENTAR RANGE INVALIDO (FAIXA NEGATIVA, APOS 23 HORAS, INICIAL MAIOR QUE FINAL, ETC) APAGA PATAMAR INVALIDO
                    c.delete()
                else:
                    # CASO CONTRARIO SALVA AJUSTES
                    c.save()
        return [True]
    except Exception as e:
        return [False, e]

@login_required
@permission_required('trafego.change_planejamento', login_url="/handler/403")
def planejamento_update(request,id):
    planejamento = Planejamento.objects.get(pk=id)
    form = PlanejamentoForm(request.POST, request.FILES, instance=planejamento)
    if form.is_valid():
        registro = form.save()
        # Caso anexado planejamento (preformatado) sobrescreve viagens no planejamento
        if request.FILES.get('viagens', None):
            try:
                viagens = json.load(request.FILES['viagens'])
                viagens.sort(key=lambda x: x["carro"])
            except Exception as e:
                messages.error(request,'<b>Erro</b> O arquivo anexado não é válido')
                return render(request,'trafego/planejamento_id.html',{'form':form,'planejamento':planejamento})
            Carro.objects.filter(planejamento=registro).delete() # Limpa viagens atuais (caso exista)
            last_carro_seq = None
            carro = None
            for v in viagens:
                if not last_carro_seq or last_carro_seq != v['carro']:
                    carro = Carro()
                    carro.planejamento = registro
                    carro.save()
                    last_carro_seq = v['carro']
                v['carro'] = carro
                try:
                    Viagem.objects.create(**v)
                except Exception as e:
                    messages.error(request,f'<b>Erro</b>{e}, algumas viagens NÃO foram importadas')
                    return redirect('trafego_planejamento_id', planejamento.id)
        # Se planejamento for marcado como ativo, inativa planejamento atual
        try:
            if registro.ativo:
                Planejamento.objects.filter(empresa=registro.empresa,linha=registro.linha,dia_tipo=registro.dia_tipo,ativo=True).exclude(id=registro.id).update(ativo=False)
            l = Log()
            l.modelo = "trafego.planejamento"
            l.objeto_id = registro.id
            l.objeto_str = registro.codigo
            l.usuario = request.user
            l.mensagem = "UPDATE"
            l.save()
            messages.success(request,'Planejamento <b>' + registro.codigo + '</b> alterado')
            return redirect('trafego_planejamento_id', id)
        except Exception as e:
            messages.error(request,f'<b>Erro</b> ao concluir operação: {e}')
            return redirect('trafego_planejamento_id', planejamento.id)
    else:
        return render(request,'trafego/planejamento_id.html',{'form':form,'planejamento':planejamento})

# METODOS DELETE
@login_required
@permission_required('trafego.delete_localidade', login_url="/handler/403")
def localidade_delete(request, id):
    try:
        registro = Localidade.objects.get(pk=id)
        l = Log()
        l.modelo = "trafego.localidade"
        l.objeto_id = registro.id
        l.objeto_str = registro.nome
        l.usuario = request.user
        l.mensagem = "DELETE"
        l.save()
        registro.delete()
        messages.warning(request,'Localidade apagada. Essa operação não pode ser desfeita')
        return redirect('trafego_localidades')
    except:
        messages.error(request,'<b>Erro</b> ao apagar localidade.')
        return redirect('trafego_localidade_id', id)

@login_required
@permission_required('trafego.delete_linha', login_url="/handler/403")
def linha_delete(request, id):
    try:
        registro = Linha.objects.get(pk=id)
        l = Log()
        l.modelo = "trafego.linha"
        l.objeto_id = registro.id
        l.objeto_str = registro.codigo + ' -  ' + registro.nome[0:38]
        l.usuario = request.user
        l.mensagem = "DELETE"
        l.save()
        registro.delete()
        messages.warning(request,'Linha apagada. Essa operação não pode ser desfeita')
        return redirect('trafego_linhas')
    except:
        messages.error(request,'<b>Erro</b> ao apagar linha')
        return redirect('trafego_linha_id', id)

@login_required
@permission_required('trafego.change_linha', login_url="/handler/403")
def trajeto_delete(request, id):
    try:
        registro = Trajeto.objects.get(pk=id)
        l = Log()
        l.modelo = "trafego.linha"
        l.objeto_id = registro.linha.id
        l.objeto_str = registro.linha.codigo
        l.usuario = request.user
        l.mensagem = "UPDATE"
        l.save()
        registro.delete()
        for p in Trajeto.objects.filter(linha=registro.linha, sentido=registro.sentido, seq__gte=registro.seq):
            p.seq -= 1
            p.save()        
        return redirect('trafego_trajetos', registro.linha.id)
    except:
        messages.error(request,'<b>Erro</b> ao atualizar trajeto')
        return redirect('trafego_trajetos', registro.linha.id)

@login_required
@permission_required('trafego.delete_planejamento', login_url="/handler/403")
def planejamento_delete(request,id):
    try:
        registro = Planejamento.objects.get(pk=id)
        l = Log()
        l.modelo = "trafego.planejamento"
        l.objeto_id = registro.id
        l.objeto_str = registro.codigo
        l.usuario = request.user
        l.mensagem = "DELETE"
        l.save()
        registro.delete()
        messages.warning(request,'Planejamento apagado. Essa operação não pode ser desfeita')
        return redirect('trafego_planejamentos')
    except:
        messages.error(request,'ERRO ao apagar planejamento')
        return redirect('trafego_planejamento_id', id)

# METODOS AJAX
def get_linha(request):
    try:
        empresa = request.GET.get('empresa',None)
        codigo = request.GET.get('codigo',None)
        incluir_inativos = request.GET.get('incluir_inativos', None)
        multiempresa = request.GET.get('multiempresa', None)
        params  = dict(codigo=codigo)
        if not multiempresa or multiempresa != 'True':
            params['empresa__id'] = empresa
        linha = Linha.objects.get(**params)
        if incluir_inativos != 'True' and linha.inativa == True:
            raise Exception('')
        return HttpResponse(str(linha.id) + ';' + str(linha.nome) + ';' + str(linha.inativa) + ';' + str(linha.empresa.id))
    except:
        return HttpResponse('')

def get_linhas_empresa(request):
    try:
        empresa_id = request.GET.get('empresa',None)
        linhas = Linha.objects.filter(empresa__id=empresa_id,status='A').order_by('codigo')
        itens = {}
        for item in linhas:
            itens[item.codigo] = item.id
        dataJSON = json.dumps(itens)
        return HttpResponse(dataJSON)
    except:
        return HttpResponse('')

def get_localidades(request):
    # Metodo retorna JSON ajustado para (integracao jsTable e component localidade)
    try:
        localidades = Localidade.objects.filter(nome__contains=request.GET['pesquisa']).order_by('nome')
        if request.GET.get('garagem', None) and request.GET['garagem'] == 'True':
            localidades = localidades.filter(eh_garagem=True)
        if request.GET.get('controle', None) and request.GET['controle'] == 'True':
            localidades = localidades.filter(ponto_de_controle=True)
        if request.GET.get('tturno', None) and request.GET['tturno'] == 'True':
            localidades = localidades.filter(troca_turno=True)
        itens = []
        for item in localidades:
            item_dict = {'#':item.id, 'Nome':item.nome, 'GAR': 'GAR' if item.eh_garagem else '', 'T Turno': 'T Turno' if item.troca_turno else '', 'Controle': 'Controle' if item.ponto_de_controle else ''}
            if request.user.has_perm('trafego.change_localidade'):
                item_dict['cnt'] = f'<a class="btn btn-sm btn-dark float-end" href="/trafego_localidade_id/{item.id}"><i class="fas fa-pen"></i></a>'
            itens.append(item_dict)
        dataJSON = json.dumps(itens)
        return HttpResponse(dataJSON)
    except:
        return HttpResponse('')