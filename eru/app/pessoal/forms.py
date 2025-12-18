import re
from django import forms
from django.db.models import Q
from .models import Setor, Cargo, Funcionario, FuncaoFixa, Afastamento, Dependente, Evento, GrupoEvento, EventoEmpresa, EventoCargo, EventoFuncionario, MotivoReajuste
from django.contrib.auth.models import User
from datetime import date
from django.conf import settings

RASTREIO_REGEX = re.compile(r'^[a-zA-Z][a-zA-Z0-9_]*$')

class SetorForm(forms.ModelForm):
    class Meta:
        model = Setor
        fields = ['nome']
    nome = forms.CharField(widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' ','autofocus':'autofocus'}))

class GrupoEventoForm(forms.ModelForm):
    class Meta:
        model = GrupoEvento
        fields = ['nome']
    nome = forms.CharField(widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' ','autofocus':'autofocus'}))

class CargoForm(forms.ModelForm):
    class Meta:
        model = Cargo
        fields = ['nome','setor','atividades']
    nome = forms.CharField(widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' ', 'autofocus':'autofocus'}))
    setor = forms.ModelChoiceField(queryset = Setor.objects.all().order_by('nome'), widget=forms.Select(attrs={'class':'form-select'}))
    atividades = forms.CharField(required=False, widget=forms.Textarea(attrs={'class': 'form-control', 'data-i18n':'[placeholder]personal.position.jobResponsibilities', 'placeholder':'Atividades do cargo', 'rows':'15'}))
    funcao_fixa = forms.MultipleChoiceField(required=False, choices=FuncaoFixa.FFIXA_CHOICES, widget=forms.SelectMultiple(attrs={'class':'form-select fw-bold'}))
    
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
    nome = forms.CharField(max_length=200,widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' ', 'autofocus':'autofocus', 'data-i18n': 'common.name'}))
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
    # empresa = forms.ModelChoiceField(queryset = Empresa.objects.all().order_by('nome'), widget=forms.Select(attrs={'class':'form-select'}))
    matricula = forms.CharField(max_length=6,widget=forms.TextInput(attrs={'class': 'form-control fw-bold','placeholder':' ','autofocus':'autofocus', 'data-i18n': 'personal.common.employeeId'}))
    nome = forms.CharField(max_length=200,widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' ', 'data-i18n':'common.name'}))
    apelido = forms.CharField(required=False, max_length=15, widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' ', 'data-i18n': 'personal.common.nickname'}))
    nome_social = forms.CharField(required=False, max_length=200, widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' ', 'data-i18n': 'personal.employee.form.socialName'}))
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
    def __init__(self, *args, **kwargs):
        user = kwargs.pop('user', None)
        super(FuncionarioForm, self).__init__(*args, **kwargs)
        if user:
            self.fields['empresa'].queryset = user.profile.empresas.all()
            self.fields['empresa'].widget.attrs.update({
                'class': 'form-select',
                'autofocus': 'autofocus',
                'placeholder': ' ',
            })

class MotivoReajusteForm(forms.ModelForm):
    class Meta:
        model = MotivoReajuste
        fields = ['nome']
    nome = forms.CharField(max_length=60, widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' ','autofocus':'autofocus'}))

class EventoForm(forms.ModelForm):
    class Meta:
        model = Evento
        fields = ['nome','rastreio','tipo','grupo']
    nome = forms.CharField(max_length=40, widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' ', 'autofocus':'autofocus'}))
    rastreio = forms.CharField(required=False, max_length=20, widget=forms.TextInput(attrs={'class': 'form-control bg-body-tertiary','placeholder':' '}))
    tipo = forms.ChoiceField(required=False, choices=Evento.TIPOS, widget=forms.Select(attrs={'class':'form-select'}))
    grupo = forms.ModelChoiceField(required=False, queryset = GrupoEvento.objects.all().order_by('nome'), widget=forms.Select(attrs={'class':'form-select'}))
    def clean_rastreio(self):
        rastreio_value = self.cleaned_data.get('rastreio')
        # Verifica se o valor corresponde a expressao regular
        if rastreio_value and not RASTREIO_REGEX.match(rastreio_value):
            raise forms.ValidationError(settings.DEFAULT_MESSAGES['notMatchCriteria'])
        return rastreio_value


class EventoMovimentacaoBaseForm(forms.ModelForm):
    inicio = forms.DateField(required=False, initial=date.today(), widget=forms.TextInput(attrs={'class':'form-control','type':'date', 'autofocus':'autofocus'}))
    fim = forms.DateField(required=False, widget=forms.TextInput(attrs={'class':'form-control','type':'date'}))
    class Meta:
        fields = ['evento', 'inicio', 'fim', 'tipo', 'valor', 'motivo']
        widgets = {
            'evento': forms.Select(attrs={'class': 'form-select'}),
            'tipo': forms.Select(attrs={'class': 'form-select'}),
            'valor': forms.Textarea(attrs={'class': 'form-control', 'rows': 4,'placeholder': 'Valor', 'data-i18n': '[placeholder]common.value'}),
            'motivo': forms.Select(attrs={'class': 'form-select'}),
        }
    def get_context_filters(self, cleaned_data):
        """
        Deve ser sobrescrito pelos formularios filhos
        Retorna um dicionario de filtros (Q objects ou kwargs) que definem o 'contexto' do conflito
        Ex: {'empresas__id__in': [1, 2]} ou {'funcionario': obj_funcionario}
        """
        raise NotImplementedError("Subclasses devem implementar 'get_context_filters'.")

    def get_model_class(self):
        """
        Deve ser sobrescrito pelos formularios filhos.
        Retorna a classe do modelo Django associada ao formulario.
        Ex: return EventoCargo
        """
        raise NotImplementedError("Subclasses devem implementar 'get_model_class'.")

    def clean(self):
        # A logica centralizada de validacao de sobreposicao.
        cleaned_data = super().clean()

        inicio = cleaned_data.get('inicio')
        fim = cleaned_data.get('fim')
        evento_pai = cleaned_data.get('evento')

        # Se campos criticos estiverem faltando, paramos aqui (validacao basica falhou)
        if not all([inicio, evento_pai]):
            return cleaned_data

        # Garantir que a data de inicio nao seja posterior a data de fim, se ambas existirem
        if fim and inicio > fim:
            raise forms.ValidationError('<span data-i18n="sys.endDateLowerThanStart"></span>')

        # 1. Obter os filtros de contexto especificos do formulario filho (Cargo, Funcionario, Empresa)
        context_filters = self.get_context_filters(cleaned_data)
        
        # 2. Obter o modelo correto para consultar (EventoCargo, EventoFuncionario, etc.)
        ModelClass = self.get_model_class()

        # Adiciona o filtro base comum a todos: mesmo tipo de evento pai
        base_filters = Q(evento=evento_pai)
        
        # Combina os filtros base com os filtros de contexto fornecidos pelo filho
        full_filters = base_filters & Q(**context_filters) if isinstance(context_filters, dict) else base_filters & context_filters

        # Logica de sobreposicao
        q_aberto = Q(fim__isnull=True) & Q(inicio__lte=fim if fim else date.max)
        q_fechado = Q(
            fim__isnull=False,
            inicio__lte=fim if fim else date.max,
            fim__gte=inicio
        )

        conflitos_possiveis = ModelClass.objects.filter(
            full_filters # Aplica todos os filtros de contexto e evento
        ).exclude(
            pk=self.instance.pk # Exclui o objeto atual se for uma edicao
        ).filter(
            q_aberto | q_fechado # Aplica a logica de sobreposicao combinada
        )

        if conflitos_possiveis.exists():
            raise forms.ValidationError('<span data-i18n="personal.event.form.eventErroDuplicatedPeriod"></span>') 
            
        return cleaned_data

class EventoCargoForm(EventoMovimentacaoBaseForm):
    class Meta(EventoMovimentacaoBaseForm.Meta):
        model = EventoCargo
        fields = EventoMovimentacaoBaseForm.Meta.fields + ['cargo', 'empresas']
        widgets = EventoMovimentacaoBaseForm.Meta.widgets.copy()
    def __init__(self, *args, user=None, **kwargs):
        super().__init__(*args, **kwargs)
        if user:
            self.fields['empresas'].queryset = user.profile.empresas.all()
    def get_model_class(self):
        return EventoCargo
    def get_context_filters(self, cleaned_data):
        # Implementa o filtro especifico para Cargo: checa conflito APENAS nas empresas selecionadas
        empresas_qs = cleaned_data.get('empresas')
        if empresas_qs:
            empresa_ids = empresas_qs.values_list('id', flat=True)
            # Retorna um dicionario de kwargs para o filtro Q(**kwargs)
            return {'empresas__id__in': empresa_ids}
        return {} # Retorna vazio se nao houver empresas (embora 'empresas' deva ser obrigatorio neste contexto)
    

class EventoFuncionarioForm(EventoMovimentacaoBaseForm):
    class Meta(EventoMovimentacaoBaseForm.Meta):
        model = EventoFuncionario
        fields = EventoMovimentacaoBaseForm.Meta.fields + ['funcionario']
        widgets = EventoMovimentacaoBaseForm.Meta.widgets.copy()
    def get_model_class(self):
        return EventoFuncionario
    def get_context_filters(self, cleaned_data):
        # Implementa o filtro especifico para Funcionario: checa conflito APENAS para funcionario alvo
        funcionario = cleaned_data.get('funcionario')
        if funcionario:
            # Retorna um dicionario simples
            return {'funcionario': funcionario}
        return {}

class EventoEmpresaForm(EventoMovimentacaoBaseForm):
    class Meta(EventoMovimentacaoBaseForm.Meta):
        model = EventoEmpresa
        fields = EventoMovimentacaoBaseForm.Meta.fields + ['empresas']
        widgets = EventoMovimentacaoBaseForm.Meta.widgets.copy()
    def __init__(self, *args, user=None, **kwargs):
        super().__init__(*args, **kwargs)
        if user:
            self.fields['empresas'].queryset = user.profile.empresas.all()
    def get_model_class(self):
        return EventoEmpresa
    def get_context_filters(self, cleaned_data):
        # Implementa o filtro especifico para Empresa: checa conflito APENAS nas empresas selecionadas
        empresas_qs = cleaned_data.get('empresas')
        if empresas_qs:
            empresa_ids = empresas_qs.values_list('id', flat=True)
            return {'empresas__id__in': empresa_ids}
        return {}