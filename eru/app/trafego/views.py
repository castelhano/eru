import os
import json
import threading
import csv
from django.urls import reverse
from django.db.models import Count
from pathlib import Path
from django.shortcuts import render, redirect
from django.http import HttpResponse
from core.models import Empresa, Job
from .models import Linha, Localidade, Trajeto, Patamar, Planejamento, Carro, Viagem, Passageiro
from .forms import LinhaForm, LocalidadeForm, TrajetoForm, PlanejamentoForm, PassageiroForm
from django.contrib.auth.decorators import login_required, permission_required
from django.contrib import messages
from django.conf import settings
from datetime import datetime
# from django.core.serializers import serialize
from django.core.exceptions import ObjectDoesNotExist


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
            empresa = request.user.profile.filiais.filter(id=request.GET.get('empresa', None)).get()
        except:
            messages.error(request,'Empresa <b>não encontrada</b> ou <b>não habilitada</b>')
            return redirect('trafego:linhas')
        linhas = linhas.filter(empresa=empresa)
        empresa_display = empresa.nome
    else:
        empresa_display = 'Todas'
        linhas = linhas.filter(empresa__in=request.user.profile.filiais.all())
    metrics = dict(status_display = 'Inativas' if inativa == 'True' else 'Ativas', empresa_display = empresa_display)
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
            return redirect('trafego:planejamento_id', planejamento.id)
        else:
            planejamentos = planejamentos.filter(linha__codigo=request.GET['pesquisa'])
    else:
        planejamentos = planejamentos.filter(pin=True)
    return render(request,'trafego/planejamentos.html', {'planejamentos':planejamentos})

@login_required
@permission_required('trafego.view_passageiro', login_url="/handler/403")
def passageiros(request):
    if request.method == 'POST':
        dados = Passageiro.objects.filter(referencia__range=[request.POST['data_inicio'],request.POST['data_fim']])
        if(request.POST.get('empresa', None)):
            dados = dados.filter(empresa=request.POST['empresa'])
        if(request.POST.get('linha_inicio', None) or request.POST.get('linha_fim', None)):
            linha_inicio = request.POST.get('linha_inicio', None) if request.POST.get('linha_inicio', None) else '0'
            linha_fim = request.POST.get('linha_fim', None) if request.POST.get('linha_fim', None) else 'zzzzzzzz'
            dados = dados.filter(linha__codigo__gte=request.POST['linha_inicio'], linha__codigo__lte=linha_fim)
        if request.POST['layout'] == 'linha_produto':
            dados = dados.values('empresa_id', 'empresa__nome', 'linha_id', 'linha__codigo', 'linha__nome', 'aplicacao', 'tipo').annotate(qtde=Count('linha_id'))
        elif request.POST['layout'] == 'linha_diario':
            dados = dados.values('linha_id', 'linha__codigo', 'linha__nome',).annotate(qtde=Count('linha_id'))
        if len(dados) == 0:
            messages.warning(request, '<b>Atenção:</b> Nenhum registro com os filtros informados')
        return render(request, 'trafego/passageiros.html', {'dados':dados, 'layout':request.POST['layout'], 'empresa': request.POST.get('empresa', None)})
    return render(request, 'trafego/passageiros.html')

# METODOS ADD
@login_required
@permission_required('trafego.add_localidade', login_url="/handler/403")
def localidade_add(request):
    if request.method == 'POST':
        form = LocalidadeForm(request.POST)
        if form.is_valid():
            try:
                registro = form.save()
                messages.success(request,f'Localidade <b>{registro.nome}</b> criada')
                return redirect('trafego:localidade_add')
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
                Patamar.objects.create(**{'linha': registro, 'inicial': 0, 'final': 23, 'ida': 50, 'volta': 50, 'intervalo_ida': 10, 'intervalo_volta': 1}) # Inicia patamares da linha
                messages.success(request,f'Linha <b>{registro.codigo}</b> criada')
                return redirect('trafego:linha_id',registro.id)
            except:
                messages.error(request,'<b>Erro</b> ao salvar linha, comunique ao administrador do sistema')
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
                    viagens.sort(key=lambda x: int(x["carro"]))
                except Exception as e:
                    messages.error(request,'<b>Erro</b> O arquivo anexado não é válido')
                    return render(request,'trafego/planejamento_id.html',{'form':form,'planejamento':planejamento})
                last_carro_seq = None
                last_viagem = None
                carro = None
                for v in viagens:
                    if v['tipo'] == '8':
                        last_viagem.encerrar = True
                        last_viagem.save()
                        continue
                    if not last_carro_seq or last_carro_seq != v['carro']:
                        carro = Carro()
                        carro.planejamento = registro
                        carro.save()
                        last_carro_seq = v['carro']
                    v['carro'] = carro
                    try:
                        last_viagem = Viagem.objects.create(**v)
                    except Exception as e:
                        messages.error(request,f'<b>Erro</b>{e}, algumas viagens NÃO foram importadas')
                        return redirect('trafego:planejamento_add')
            # Se planejamento for marcado como ativo, inativa planejamento atual
            if registro.ativo:
                Planejamento.objects.filter(empresa=registro.empresa,linha=registro.linha,dia_tipo=registro.dia_tipo,ativo=True).exclude(id=registro.id).update(ativo=False)
            messages.success(request,'Planejamento <b>' + registro.codigo + '</b> criado')
            return redirect('trafego:planejamento_id', registro.id)
    else:
        form = PlanejamentoForm()
    return render(request,'trafego/planejamento_add.html',{'form':form})

@login_required
@permission_required('trafego.add_passageiro', login_url="/handler/403")
def passageiros_import(request):
    if request.method == 'POST':
        j = Job()
        j.usuario = request.user
        j.modulo = "trafego.passageiro"
        j.referencia = f"Import passageiro {request.POST['referencia']}"
        j.save()
        options = {'request':request, 'job':j}
        fn = threading.Thread(target=passageiros_import_run, args=(options,))
        fn.setDaemon(True)
        fn.start()
        messages.info(request,'<b>Enviado:</b> Arquivo está sendo processado, verifique na seção de jobs o status do processo.')
    form = PassageiroForm()
    return render(request, 'trafego/passageiros_import.html', {'form':form})

# Funcao thread para processamento do arquivo
def passageiros_import_run(options):
    f = options['request'].FILES['arquivo']
    reader = csv.DictReader(f.read().decode('ISO-8859-1').splitlines(), delimiter=';')
    txtLog = ''
    empresa = Empresa.objects.get(id=options['request'].POST['empresa'])
    linha = None
    rows = list(reader)
    size = len(rows) - 1
    if size > 0:
        for i, row in enumerate(rows):
            try:
                if not linha or linha.codigo != row['LINHA']:
                    linha = Linha.objects.get(codigo=row['LINHA'], empresa=empresa)
                opt = {
                    'empresa': empresa,
                    'embarque': datetime.strptime(row['HORARIO'], '%d/%m/%Y  %H:%M:%S'),
                    'referencia': options['request'].POST['referencia'],
                    'dia_tipo': options['request'].POST['dia_tipo'],
                    'linha': linha,
                    'veiculo': row['VEICULO'],
                    'cartao': row['CARTAO'],
                    'cartao': row['CARTAO'],
                    'aplicacao': row['APLICACAO'],
                    'tipo': row['TIPO'],
                    'tarifa': row['TARIFA'].replace(',','.'),
                }
                Passageiro.objects.create(**opt)
            except ObjectDoesNotExist:
                log = 'Linha %s não localizada para empresa informada' % (row['LINHA'])
                if not log in txtLog:
                    txtLog += '%s - %s\n' % (i, log)
            except Exception as e:
                if not str(e) in txtLog:
                    txtLog += f'{i} - ' + str(e) + '\n'
            print('trafego.passageiro.import: %s de %s  %s%%' % (i, size, round((i / size) * 100, 1)))
    else:
        txtLog = 'Arquivo enviado vazio'
    # Atualiza entrada do job ''
    if txtLog != '':
        file_path = '%s/core/job' % (settings.MEDIA_ROOT)
        file_name = '%s_log_%s.txt' % (options['request'].user.id , options['job'].id)
        if not os.path.exists(file_path):
            Path(file_path).mkdir(parents=True, exist_ok=True)
        with open(f'{file_path}/{file_name}', 'wb') as f:
            f.write(txtLog.encode('ISO-8859-1'))
            f.close()
        options['job'].erros = f'{file_path}/{file_name}'
    options['job'].status = '<span class="text-success">Concluido</span>' if txtLog == '' else '<span class="text-orange">Concluido com Erro</span">'
    options['job'].termino = datetime.now()
    options['job'].save()

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
        messages.success(request,f'Localidade <b>{registro.nome}</b> alterada')
        return redirect('trafego:localidade_id', id)
    else:
        return render(request,'trafego/localidade_id.html',{'form':form,'localidade':localidade})

@login_required
@permission_required('trafego.change_linha', login_url="/handler/403")
def linha_update(request, id):
    linha = Linha.objects.get(pk=id)
    form = LinhaForm(request.POST, instance=linha)
    if form.is_valid():
        registro = form.save()
        messages.success(request,f'Linha <b>{registro.codigo}</b> alterada')
        return redirect('trafego:linha_id', id)
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
                return redirect('trafego:linha_id', linha.id)
            patamar.save()
                
            patamares = Patamar.objects.filter(linha=linha).exclude(id=patamar.id)
            retorno = patamar_tratar_conflitos(patamar, patamares)
            if retorno[0]:
                messages.success(request,'Patamares <b>atualizados</b>')
            else:
                messages.error(request,f'<b>Erro: [PTC 2]</b> {retorno[1]}')
        except Exception as e:
            messages.error(request,f'<b>Erro: [PTU 3]</b> {e}')
    return redirect('trafego:linha_id', linha.id)

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
                viagens.sort(key=lambda x: int(x["carro"]))
            except Exception as e:
                messages.error(request,'<b>Erro</b> O arquivo anexado não é válido')
                return render(request,'trafego/planejamento_id.html',{'form':form,'planejamento':planejamento})
            Carro.objects.filter(planejamento=registro).delete() # Limpa viagens atuais (caso exista)
            last_carro_seq = None
            last_viagem = None
            carro = None
            for v in viagens:
                if v['tipo'] == '8':
                    last_viagem.encerrar = True
                    last_viagem.save()
                    continue
                if not last_carro_seq or last_carro_seq != v['carro']:
                    carro = Carro()
                    carro.planejamento = registro
                    carro.save()
                    last_carro_seq = v['carro']
                v['carro'] = carro
                try:
                    last_viagem = Viagem.objects.create(**v)
                except Exception as e:
                    messages.error(request,f'<b>Erro</b>{e}, algumas viagens NÃO foram importadas')
                    return redirect('trafego:planejamento_id', planejamento.id)
        # Se planejamento for marcado como ativo, inativa planejamento atual
        try:
            if registro.ativo:
                Planejamento.objects.filter(empresa=registro.empresa,linha=registro.linha,dia_tipo=registro.dia_tipo,ativo=True).exclude(id=registro.id).update(ativo=False)
            messages.success(request,'Planejamento <b>' + registro.codigo + '</b> alterado')
            return redirect('trafego:planejamento_id', id)
        except Exception as e:
            messages.error(request,f'<b>Erro</b> ao concluir operação: {e}')
            return redirect('trafego:planejamento_id', planejamento.id)
    else:
        return render(request,'trafego/planejamento_id.html',{'form':form,'planejamento':planejamento})

@login_required
@permission_required('trafego.change_planejamento', login_url="/handler/403")
def planejamento_grid_update(request, id):
    if request.method == 'POST':
        planejamento = Planejamento.objects.get(id=id)
        plan = json.loads(request.POST['planejamento'])
        if 'patamares' in plan:
            planejamento.patamares = json.dumps(plan['patamares'])
            planejamento.save()
        Carro.objects.filter(planejamento=planejamento).delete() # Limpa viagens atuais (caso exista)
        carros = plan['carros']
        for carro in carros:
            car = Carro.objects.create(**{'planejamento': planejamento, 'classificacao': carro['classificacao'], 'escalas':json.dumps(carro['escalas'])})
            for viagem in carro['viagens']:
                del viagem['__id']
                viagem['carro'] = car
                viagem['origem'] = Localidade.objects.get(id=viagem['origem'])
                viagem['destino'] = Localidade.objects.get(id=viagem['destino'])
                Viagem.objects.create(**viagem)
        messages.success(request,f'Planejamento <b>{planejamento.codigo}</b> atualizado')
    return redirect('trafego:planejamento_id', id)

# METODOS DELETE
@login_required
@permission_required('trafego.delete_localidade', login_url="/handler/403")
def localidade_delete(request, id):
    try:
        registro = Localidade.objects.get(pk=id)
        registro.delete()
        messages.warning(request,'Localidade apagada. Essa operação não pode ser desfeita')
        return redirect('trafego:localidades')
    except:
        messages.error(request,'<b>Erro</b> ao apagar localidade.')
        return redirect('trafego:localidade_id', id)

@login_required
@permission_required('trafego.delete_linha', login_url="/handler/403")
def linha_delete(request, id):
    try:
        registro = Linha.objects.get(pk=id)
        registro.delete()
        messages.warning(request,'Linha apagada. Essa operação não pode ser desfeita')
        return redirect('trafego:linhas')
    except:
        messages.error(request,'<b>Erro</b> ao apagar linha')
        return redirect('trafego:linha_id', id)

@login_required
@permission_required('trafego.change_linha', login_url="/handler/403")
def trajeto_delete(request, id):
    try:
        registro = Trajeto.objects.get(pk=id)
        registro.delete()
        for p in Trajeto.objects.filter(linha=registro.linha, sentido=registro.sentido, seq__gte=registro.seq):
            p.seq -= 1
            p.save()        
        return redirect('trafego:trajetos', registro.linha.id)
    except:
        messages.error(request,'<b>Erro</b> ao atualizar trajeto')
        return redirect('trafego:trajetos', registro.linha.id)

@login_required
@permission_required('trafego.delete_planejamento', login_url="/handler/403")
def planejamento_delete(request,id):
    try:
        registro = Planejamento.objects.get(pk=id)
        registro.delete()
        messages.warning(request,'Planejamento apagado. Essa operação não pode ser desfeita')
        return redirect('trafego:planejamentos')
    except:
        messages.error(request,'ERRO ao apagar planejamento')
        return redirect('trafego:planejamento_id', id)

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
                url = reverse('trafego:localidade_id', kwargs={'id': item.id})
                item_dict['cnt'] = f'<a class="btn btn-sm btn-dark float-end" href="{url}"><i class="bi bi-pen-fill"></i></a>'
            itens.append(item_dict)
        dataJSON = json.dumps(itens)
        return HttpResponse(dataJSON)
    except:
        return HttpResponse('[]')