from django import forms
from .models import Setor, Cargo, Funcionario, FuncaoFixa, Afastamento, Dependente
from django.contrib.auth.models import User
from datetime import date


class SetorForm(forms.ModelForm):
    class Meta:
        model = Setor
        fields = ['nome']
    nome = forms.CharField(error_messages={'required': 'Preencha o nome do setor'},widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' ','autofocus':'autofocus'}))

class CargoForm(forms.ModelForm):
    class Meta:
        model = Cargo
        fields = ['nome','setor','atividades']
    setor = forms.ModelChoiceField(error_messages={'required': 'Selecione um setor'},queryset = Setor.objects.all().order_by('nome'), widget=forms.Select(attrs={'class':'form-select','autofocus':'autofocus'}))
    nome = forms.CharField(error_messages={'required': 'Preencha o nome do cargo'},widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    atividades = forms.CharField(required=False, widget=forms.Textarea(attrs={'class': 'form-control','placeholder':'Atividades do cargo', 'rows':'15'}))

class FuncaoFixaForm(forms.ModelForm):
    class Meta:
        model = FuncaoFixa
        fields = ['nome','cargos']
    nome = forms.ChoiceField(error_messages={'unique': 'Função Fixa para está função já tem associações'},choices=FuncaoFixa.FFIXA_CHOICES, widget=forms.Select(attrs={'class':'form-select fw-bold'}))

class AfastamentoForm(forms.ModelForm):
    class Meta:
        model = Afastamento
        fields = ['funcionario','motivo','origem','data_afastamento', 'data_retorno','remunerado','reabilitado','detalhe']
    motivo = forms.ChoiceField(required=False, choices=Afastamento.MOTIVO_AFASTAMENTO, widget=forms.Select(attrs={'class':'form-select'}))
    origem = forms.ChoiceField(required=False, choices=Afastamento.ORIGEM_CHOICES, widget=forms.Select(attrs={'class':'form-select'}))
    data_afastamento = forms.DateField(required=False, initial=date.today(), widget=forms.TextInput(attrs={'class':'form-control','type':'date', 'autofocus':'autofocus'}))
    data_retorno = forms.DateField(required=False, widget=forms.TextInput(attrs={'class':'form-control bg-body-secondary','type':'date', 'tabindex':'-1'}))
    remunerado = forms.BooleanField(required=False, initial=False, widget=forms.CheckboxInput(attrs={'class': 'form-check-input','role':'switch', 'tabindex':'-1'}))
    reabilitado = forms.BooleanField(required=False, initial=False, widget=forms.CheckboxInput(attrs={'class': 'form-check-input','role':'switch', 'tabindex':'-1'}))
    detalhe = forms.CharField(required=False, widget=forms.Textarea(attrs={'class': 'form-control','placeholder':'Detalhes', 'style':'min-height:300px'}))
    

class DependenteForm(forms.ModelForm):
    class Meta:
        model = Dependente
        fields = ['funcionario','nome','parentesco','sexo','data_nascimento', 'rg','rg_emissao','rg_orgao_expedidor','cpf']
    nome = forms.CharField(error_messages={'required': 'Informe o nome do dependente'}, max_length=200,widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' ', 'autofocus':'autofocus'}))
    parentesco = forms.ChoiceField(required=False,choices=Dependente.PARENTESCO, widget=forms.Select(attrs={'class':'form-select'}))
    sexo = forms.ChoiceField(required=False,choices=Funcionario.SEXO_CHOICES, widget=forms.Select(attrs={'class':'form-select'}))
    data_nascimento = forms.DateField(required=False, widget=forms.TextInput(attrs={'class':'form-control','type':'date'}))
    rg = forms.CharField(required=False, max_length=15, widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    rg_emissao = forms.DateField(required=False, widget=forms.TextInput(attrs={'class':'form-control','type':'date'}))
    rg_orgao_expedidor = forms.CharField(required=False, max_length=8, widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    cpf = forms.CharField(required=False, max_length=15,widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    

class FuncionarioForm(forms.ModelForm):
    class Meta:
        model = Funcionario
        fields = ['empresa','matricula','nome','apelido','nome_social','sexo','cargo','regime','data_admissao','data_nascimento','data_desligamento','motivo_desligamento','rg','rg_emissao','rg_orgao_expedidor','cpf','titulo_eleitor','titulo_zona','titulo_secao','reservista','cnh','cnh_categoria','cnh_primeira_habilitacao','cnh_emissao','cnh_validade','fone1','fone2','email','endereco','bairro','cidade','uf','estado_civil','nome_mae','nome_pai','detalhe','usuario','pne']
    matricula = forms.CharField(error_messages={'required': 'Informe a matricula do funcionario','unique':'Matricula já cadastrada para outro funcionário'},max_length=6,widget=forms.TextInput(attrs={'class': 'form-control fw-bold','placeholder':' ','autofocus':'autofocus'}))
    nome = forms.CharField(error_messages={'required': 'Informe o nome do funcionario'}, max_length=200,widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    apelido = forms.CharField(required=False, max_length=15, widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    nome_social = forms.CharField(required=False, max_length=200, widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    sexo = forms.ChoiceField(required=False,choices=Funcionario.SEXO_CHOICES, widget=forms.Select(attrs={'class':'form-select'}))
    regime = forms.ChoiceField(required=False, choices=Funcionario.REGIME_CHOICES, widget=forms.Select(attrs={'class':'form-select'}))
    data_admissao = forms.DateField(required=False, initial=date.today(), widget=forms.TextInput(attrs={'class':'form-control','type':'date'}))
    data_nascimento = forms.DateField(required=False, widget=forms.TextInput(attrs={'class':'form-control','type':'date'}))
    data_desligamento = forms.DateField(required=False,initial=date.today(), widget=forms.TextInput(attrs={'class':'form-control','type':'date'}))
    motivo_desligamento = forms.ChoiceField(required=False, choices=Funcionario.MOTIVOS_DESLIGAMENTO, widget=forms.Select(attrs={'class':'form-select'}))
    rg = forms.CharField(required=False, max_length=15, widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    rg_emissao = forms.DateField(required=False, widget=forms.TextInput(attrs={'class':'form-control','type':'date'}))
    rg_orgao_expedidor = forms.CharField(required=False, max_length=8, widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    cpf = forms.CharField(required=False, max_length=15,widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    titulo_eleitor = forms.CharField(required=False, max_length=15, widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    titulo_zona = forms.CharField(required=False, max_length=5, widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    titulo_secao = forms.CharField(required=False, max_length=5, widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    reservista = forms.CharField(required=False, max_length=15, widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    cnh = forms.CharField(required=False, max_length=15, widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    cnh_categoria = forms.ChoiceField(required=False, choices=Funcionario.CNH_CATEGORIAS, widget=forms.Select(attrs={'class':'form-select'}))
    cnh_primeira_habilitacao = forms.DateField(required=False, widget=forms.TextInput(attrs={'class':'form-control','type':'date'}))
    cnh_emissao = forms.DateField(required=False, widget=forms.TextInput(attrs={'class':'form-control','type':'date'}))
    cnh_validade = forms.DateField(required=False, widget=forms.TextInput(attrs={'class':'form-control','type':'date'}))
    fone1 = forms.CharField(required=False, widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    fone2 = forms.CharField(required=False, widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    email = forms.CharField(required=False, widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    endereco = forms.CharField(required=False, widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    bairro = forms.CharField(required=False, widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    cidade = forms.CharField(required=False, widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    uf = forms.CharField(required=False, max_length=2,widget=forms.TextInput(attrs={'class': 'form-control text-center','placeholder':' '}))
    estado_civil = forms.ChoiceField(required=False, choices=Funcionario.ESTADO_CIVIL_CHOICES, widget=forms.Select(attrs={'class':'form-select'}))
    nome_mae = forms.CharField(required=False, widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    nome_pai = forms.CharField(required=False, widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    pne = forms.BooleanField(required=False, initial=False, widget=forms.CheckboxInput(attrs={'class': 'form-check-input','role':'switch'}))
    detalhe = forms.CharField(required=False, widget=forms.Textarea(attrs={'class': 'form-control','placeholder':'Detalhes', 'style':'min-height:300px'}))
    status = forms.ChoiceField(required=False, choices=Funcionario.STATUS_CHOICES, widget=forms.Select(attrs={'class':'form-select'}))
    usuario = forms.ModelChoiceField(required=False, queryset = User.objects.filter(is_active=True).order_by('username'), widget=forms.Select(attrs={'class':'form-select'}))