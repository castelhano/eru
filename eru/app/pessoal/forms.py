import re
from django import forms
from django.db.models import Q
from .models import Setor, Cargo, Funcionario, Afastamento, Dependente, Evento, GrupoEvento, EventoEmpresa, EventoCargo, EventoFuncionario, MotivoReajuste
from django.contrib.auth.models import User
from datetime import date
from core.widgets import I18nSelect, I18nSelectMultiple
from core.mixins import BootstrapI18nMixin
from django.conf import settings

RASTREIO_REGEX = re.compile(r'^[a-zA-Z][a-zA-Z0-9_]*$')


class SetorForm(BootstrapI18nMixin, forms.ModelForm):
    i18n_maps = {
        'nome': 'common.name',
    }
    class Meta:
        model = Setor
        fields = ['nome']
        widgets = {
            'nome': forms.TextInput(attrs={'autofocus': True}),
        }
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.setup_bootstrap_and_i18n() # aplica classes de estilo, e atribui data-i18n aos campos

class GrupoEventoForm(forms.ModelForm):
    class Meta:
        model = GrupoEvento
        fields = ['nome']
    nome = forms.CharField(widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' ','autofocus':'autofocus'}))


class CargoForm(BootstrapI18nMixin, forms.ModelForm):
    i18n_maps = {
        'atividades': '[placeholder]personal.position.jobResponsibilities',
        'funcoes_fixas': Cargo.FuncaoTipo.i18n_map()
    }
    funcoes_fixas = forms.MultipleChoiceField(choices=Cargo.FuncaoTipo.choices, required=False)
    class Meta:
        model = Cargo
        fields = ['nome','setor','atividades', 'funcoes_fixas']
        widgets = {
            'nome': forms.TextInput(attrs={'autofocus': True}),
            'atividades': forms.Textarea(attrs={'rows': 15}),
        }
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.setup_bootstrap_and_i18n()


class AfastamentoForm(BootstrapI18nMixin, forms.ModelForm):
    i18n_maps = {
        'motivo': Afastamento.Motivo.i18n_map(),
        'origem': Afastamento.Origem.i18n_map(),
        'detalhe': '[placeholder]common.detail__plural',
    }
    class Meta:
        model = Afastamento
        fields = '__all__'
        widgets = {
            'data_afastamento': forms.DateInput(format='%Y-%m-%d', attrs={'type':'date','autofocus': True}),
            'data_retorno': forms.DateInput(format='%Y-%m-%d', attrs={'type':'date','class': 'bg-body-tertiary'}),
            'remunerado': forms.CheckboxInput(attrs={'role': 'switch'}),
            'reabilitado': forms.CheckboxInput(attrs={'role': 'switch'}),
            'detalhe': forms.Textarea(attrs={'placeholder': 'Detalhes', 'style': 'min-height:300px'}),
        }
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.setup_bootstrap_and_i18n()


class DependenteForm(forms.ModelForm):
    class Meta:
        model = Dependente
        fields = ['funcionario','nome','parentesco','sexo','data_nascimento', 'rg','rg_emissao','rg_orgao_expedidor','cpf']
    nome = forms.CharField(max_length=200,widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' ', 'autofocus':'autofocus', 'data-i18n': 'common.name'}))
    parentesco = forms.ChoiceField(required=False, widget=I18nSelect(attrs={ 'class': 'form-select' }, data_map=Dependente.Parentesco.i18n_map()))
    sexo = forms.ChoiceField(required=False, widget=I18nSelect(attrs={'class':'form-select'}, data_map=Funcionario.Sexo.i18n_map()))
    data_nascimento = forms.DateField(required=False, widget=forms.TextInput(attrs={'class':'form-control','type':'date'}))
    rg = forms.CharField(required=False, max_length=15, widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    rg_emissao = forms.DateField(required=False, widget=forms.TextInput(attrs={'class':'form-control','type':'date'}))
    rg_orgao_expedidor = forms.CharField(required=False, max_length=8, widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    cpf = forms.CharField(required=False, max_length=15,widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    

class FuncionarioForm(BootstrapI18nMixin, forms.ModelForm):
    i18n_maps = {
        'nome': 'common.name',
        'sexo': Funcionario.Sexo.i18n_map(),
        'status': Funcionario.Status.i18n_map(),
        'estado_civil': Funcionario.EstadoCivil.i18n_map(),
        'motivo_desligamento': Funcionario.MotivoDesligamento.i18n_map(),
    }
    class Meta:
        model = Funcionario
        fields = ['filial','matricula','nome','apelido','nome_social','sexo','data_admissao','data_nascimento','data_desligamento','motivo_desligamento','rg','rg_emissao','rg_orgao_expedidor','cpf','titulo_eleitor','titulo_zona','titulo_secao','reservista','cnh','cnh_categoria','cnh_primeira_habilitacao','cnh_emissao','cnh_validade','fone1','fone2','email','endereco','bairro','cidade','uf','estado_civil','nome_mae','nome_pai','detalhe','usuario','pne','status','foto']
        widgets = {
            # 'data_admissao': forms.DateInput(format='%Y-%m-%d', attrs={'type': 'date'}),
            # 'data_nascimento': forms.DateInput(format='%Y-%m-%d', attrs={'type': 'date'}),
            # 'data_desligamento': forms.DateInput(format='%Y-%m-%d', attrs={'type': 'date'}),
            # 'rg_emissao': forms.DateInput(format='%Y-%m-%d', attrs={'type': 'date'}),
            # 'cnh_primeira_habilitacao': forms.DateInput(format='%Y-%m-%d', attrs={'type': 'date'}),
            # 'cnh_emissao': forms.DateInput(format='%Y-%m-%d', attrs={'type': 'date'}),
            # 'cnh_validade': forms.DateInput(format='%Y-%m-%d', attrs={'type': 'date'}),
            'detalhe': forms.Textarea(attrs={'style': 'min-height:300px'}),
            'pne': forms.CheckboxInput(attrs={'role': 'switch'}),
            'matricula': forms.TextInput(attrs={'class': 'fw-bold', 'autofocus': True}),
        }
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.setup_bootstrap_and_i18n()


class MotivoReajusteForm(forms.ModelForm):
    class Meta:
        model = MotivoReajuste
        fields = ['nome']
    nome = forms.CharField(max_length=60, widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' ','autofocus':'autofocus'}))


class EventoForm(BootstrapI18nMixin, forms.ModelForm):
    i18n_maps = {
        'tipo': Evento.TipoMovimento.i18n_map(),
    }
    class Meta:
        model = Evento
        fields = ['nome','rastreio','tipo','grupo']
        widgets = {
            'nome': forms.TextInput(attrs={'autofocus': True}),
            'rastreio': forms.TextInput(attrs={'class': 'bg-body-tertiary'}),
        }
    # nome = forms.CharField(max_length=40, widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' ', 'autofocus':'autofocus'}))
    # rastreio = forms.CharField(required=False, max_length=20, widget=forms.TextInput(attrs={'class': 'form-control bg-body-tertiary','placeholder':' '}))
    # tipo = forms.ChoiceField(required=False, widget=I18nSelect(attrs={'class':'form-select'}, data_map=Evento.TipoMovimento.i18n_map()))
    # grupo = forms.ModelChoiceField(required=False, queryset = GrupoEvento.objects.all().order_by('nome'), widget=forms.Select(attrs={'class':'form-select'}))
    def clean_rastreio(self):
        rastreio_value = self.cleaned_data.get('rastreio')
        # verifica se o valor corresponde a expressao regular
        if rastreio_value and not RASTREIO_REGEX.match(rastreio_value):
            raise forms.ValidationError(settings.DEFAULT_MESSAGES['notMatchCriteria'])
        return rastreio_value
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.setup_bootstrap_and_i18n()

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
        Ex: {'filiais__id__in': [1, 2]} ou {'funcionario': obj_funcionario}
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
        cleaned_data = super().clean()
        inicio = cleaned_data.get('inicio')
        fim = cleaned_data.get('fim')
        evento_pai = cleaned_data.get('evento')
        # se campos criticos estiverem faltando, paramos aqui (validacao basica falhou)
        if not all([inicio, evento_pai]):
            return cleaned_data
        # garantir que a data de inicio nao seja posterior a data de fim, se ambas existirem
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
        fields = EventoMovimentacaoBaseForm.Meta.fields + ['cargo', 'filiais']
        widgets = EventoMovimentacaoBaseForm.Meta.widgets.copy()
    def __init__(self, *args, user=None, **kwargs):
        super().__init__(*args, **kwargs)
        if user:
            self.fields['filiais'].queryset = user.profile.filiais.all()
    def get_model_class(self):
        return EventoCargo
    def get_context_filters(self, cleaned_data):
        # Implementa o filtro especifico para Cargo: checa conflito APENAS nas filiais selecionadas
        filiais_qs = cleaned_data.get('filiais')
        if filiais_qs:
            filial_ids = filiais_qs.values_list('id', flat=True)
            # Retorna um dicionario de kwargs para o filtro Q(**kwargs)
            return {'filiais__id__in': filial_ids}
        return {} # retorna vazio se nao houver filiais (embora 'filiais' deva ser obrigatorio neste contexto)
    

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
        fields = EventoMovimentacaoBaseForm.Meta.fields + ['filiais']
        widgets = EventoMovimentacaoBaseForm.Meta.widgets.copy()
    def __init__(self, *args, user=None, **kwargs):
        super().__init__(*args, **kwargs)
        if user:
            self.fields['filiais'].queryset = user.profile.filiais.all()
    def get_model_class(self):
        return EventoEmpresa
    def get_context_filters(self, cleaned_data):
        # Implementa o filtro especifico para Filial: checa conflito APENAS nas filiais selecionadas
        filiais_qs = cleaned_data.get('filiais')
        if filiais_qs:
            filial_ids = filiais_qs.values_list('id', flat=True)
            return {'filiais__id__in': filial_ids}
        return {}