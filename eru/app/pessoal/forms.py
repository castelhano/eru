import re
from django import forms
from django.db.models import Q
from django.urls import reverse_lazy
from django.contrib.auth.models import User
from .models import Setor, Cargo, Funcionario, Contrato, Afastamento, Dependente, Evento, GrupoEvento, EventoEmpresa, EventoCargo, EventoFuncionario, MotivoReajuste
from datetime import date
from core.mixins import BootstrapMixin
from django.conf import settings
from django.utils.translation import gettext_lazy as _

RASTREIO_REGEX = re.compile(r'^[a-zA-Z][a-zA-Z0-9_]*$')


class SetorForm(BootstrapMixin, forms.ModelForm):
    class Meta:
        model = Setor
        fields = ['nome']
        widgets = {
            'nome': forms.TextInput(attrs={'autofocus': True}),
        }

class GrupoEventoForm(BootstrapMixin, forms.ModelForm):
    class Meta:
        model = GrupoEvento
        fields = ['nome']
        widgets = {
            'nome': forms.TextInput(attrs={'autofocus': True}),
        }

## RECISAR SE PRECISA funcoes_fixas AQUI !!!!!!!!!!!!!!!
class CargoForm(BootstrapMixin, forms.ModelForm):
    funcoes_fixas = forms.MultipleChoiceField(choices=Cargo.FuncaoTipo.choices, required=False)
    class Meta:
        model = Cargo
        fields = ['nome','setor','atividades', 'funcoes_fixas']
        widgets = {
            'nome': forms.TextInput(attrs={'autofocus': True}),
            'atividades': forms.Textarea(attrs={'rows': 15}),
        }


class AfastamentoForm(BootstrapMixin, forms.ModelForm):
    class Meta:
        model = Afastamento
        fields = ['funcionario', 'motivo', 'origem', 'data_afastamento', 'data_retorno', 'reabilitado', 'remunerado', 'detalhe']
        widgets = {
            'data_afastamento': forms.DateInput(attrs={'autofocus': True}),
            'data_retorno': forms.DateInput(attrs={'class': 'bg-body-tertiary'}),
            'remunerado': forms.CheckboxInput(attrs={'role': 'switch'}),
            'reabilitado': forms.CheckboxInput(attrs={'role': 'switch'}),
            'detalhe': forms.Textarea(attrs={'placeholder': 'Detalhes', 'style': 'min-height:300px'}),
        }

class ContratoForm(BootstrapMixin, forms.ModelForm):
    setor = forms.ModelChoiceField(
        queryset=Setor.objects.all().order_by('nome'),
        label=_('Setor'),
        required=False,
        widget=forms.Select(attrs={'autofocus': 'autofocus'})
    )
    salario = forms.DecimalField(label=_('Salário'), widget=forms.TextInput(), localize=True)
    class Meta:
        model = Contrato
        fields = ['funcionario','setor','cargo', 'regime', 'salario', 'inicio', 'fim']
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        setor_id = self.data.get('setor') or self.initial.get('setor')
        if self.instance.pk and not setor_id and self.instance.cargo:
            setor_id = self.instance.cargo.setor_id
            self.initial['setor'] = setor_id
        if setor_id:
            self.fields['cargo'].queryset = Cargo.objects.filter(setor_id=setor_id).order_by('nome')
        else:
            self.fields['cargo'].queryset = Cargo.objects.none()
        self.fields['cargo'].widget.attrs.update({
            'data-chained-field': 'id_setor',
            'data-url': reverse_lazy('pessoal:cargo_list'),
            'class': 'form-select select-chained'
        })
    # def clean_salario(self):
    #     salario = self.cleaned_data.get('salario')
    #     if isinstance(salario, str):
    #         salario = salario.replace('.', '').replace(',', '.')
    #     return salario



class DependenteForm(BootstrapMixin, forms.ModelForm):
    class Meta:
        model = Dependente
        fields = ['funcionario','nome','parentesco','genero','data_nascimento', 'rg','rg_emissao','rg_orgao_expedidor','cpf']
        widgets = {
            'nome': forms.TextInput(attrs={'autofocus': True}),
        }

class FuncionarioForm(BootstrapMixin, forms.ModelForm):
    class Meta:
        model = Funcionario
        fields = ['filial','matricula','nome','apelido','nome_social','genero','data_admissao','data_nascimento','data_desligamento','motivo_desligamento','rg','rg_emissao','rg_orgao_expedidor','cpf','titulo_eleitor','titulo_zona','titulo_secao','reservista','cnh','cnh_categoria','cnh_primeira_habilitacao','cnh_emissao','cnh_validade','fone1','fone2','email','endereco','bairro','cidade','uf','estado_civil','nome_mae','nome_pai','detalhe','usuario','pne','status','foto']
        widgets = {
            'detalhe': forms.Textarea(attrs={'style': 'min-height:300px'}),
            'pne': forms.CheckboxInput(attrs={'role': 'switch'}),
            'matricula': forms.TextInput(attrs={'class': 'fw-bold', 'autofocus': True}),
        }

class MotivoReajusteForm(BootstrapMixin, forms.ModelForm):
    class Meta:
        model = MotivoReajuste
        fields = ['nome']
        widgets = {
            'nome': forms.TextInput(attrs={'autofocus': 'autofocus'}),
        }


class EventoForm(BootstrapMixin, forms.ModelForm):
    class Meta:
        model = Evento
        fields = ['nome','rastreio','tipo','grupo']
        widgets = {
            'nome': forms.TextInput(attrs={'autofocus': True}),
            'rastreio': forms.TextInput(attrs={'class': 'bg-body-tertiary'}),
        }
    def clean_rastreio(self):
        rastreio_value = self.cleaned_data.get('rastreio')
        # verifica se o valor corresponde a expressao regular
        if rastreio_value and not RASTREIO_REGEX.match(rastreio_value):
            raise forms.ValidationError(settings.DEFAULT_MESSAGES['notMatchCriteria'])
        return rastreio_value


class EventoMovimentacaoBaseForm(forms.ModelForm):
    inicio = forms.DateField(required=True, initial=date.today(), widget=forms.TextInput(attrs={'class':'form-control','type':'date', 'autofocus':'autofocus'}))
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
        raise NotImplementedError("Subclasses devem implementar 'get_context_filters'")
    def get_model_class(self):
        """
        Deve ser sobrescrito pelos formularios filhos.
        Retorna a classe do modelo Django associada ao formulario.
        Ex: return EventoCargo
        """
        raise NotImplementedError("Subclasses devem implementar 'get_model_class'")
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
            raise forms.ValidationError(_('Data de fim não pode ser menor que data de inicio'))
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
            raise forms.ValidationError(_('Existe registro ativo no periodo informado')) 
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