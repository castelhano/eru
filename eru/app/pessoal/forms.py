import re, json
from itertools import groupby
from django import forms
from django.db.models import Q
from django.utils import timezone
from django.urls import reverse_lazy
from .models import (
    PessoalSettings, Setor, Cargo, Funcionario, Contrato, Afastamento, Rescisao, Dependente, Evento, GrupoEvento,
    EventoEmpresa, EventoCargo, EventoFuncionario, MotivoReajuste, FrequenciaImport, EventoFrequencia
)
from datetime import date
from core.mixins import BootstrapMixin
from core.extras import asteval_run
from core.models import Filial
from pessoal.services.folha.collectors import get_event_vars_master

from django.conf import settings
from django.utils.translation import gettext_lazy as _

RASTREIO_REGEX = re.compile(r'^[a-zA-Z][a-zA-Z0-9_]*$')



class PessoalSettingsForm(forms.ModelForm):
    config_data = forms.CharField(widget=forms.HiddenInput(), required=False)
    class Meta:
        model = PessoalSettings
        fields = []
    def clean_config_data(self):
        data = self.cleaned_data.get('config_data')
        try:
            return json.loads(data) if data else {}
        except:
            raise forms.ValidationError("JSON inválido")




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
            'detalhe': forms.Textarea(attrs={'placeholder': _('Detalhes'), 'style': 'min-height:300px'}),
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
        fields = ['funcionario','setor','cargo', 'regime', 'salario', 'inicio', 'fim', 'carga_mensal', 'carga_diaria']
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        sid = self.data.get('setor') or (self.instance.cargo.setor_id if self.instance.pk and self.instance.cargo else None)
        if sid:
            self.fields['cargo'].queryset = Cargo.objects.filter(setor_id=sid).order_by('nome')
            self.initial['setor'] = sid
        else:
            self.fields['cargo'].queryset = Cargo.objects.none()
        self.fields['cargo'].widget.attrs.update({
            'class': 'form-select select-chained',
            'data-chained-field': 'id_setor',
            'data-url': reverse_lazy('pessoal:cargo_list')
        })


class DependenteForm(BootstrapMixin, forms.ModelForm):
    class Meta:
        model = Dependente
        fields = ['funcionario','nome','parentesco','genero','data_nascimento', 'rg','rg_emissao','rg_orgao_expedidor','cpf', 'deduz_irrf', 'deduz_plano_saude', 'plano_saude', 'incapacitado']
        widgets = {
            'nome': forms.TextInput(attrs={'autofocus': True}),
        }

class FuncionarioForm(BootstrapMixin, forms.ModelForm):
    class Meta:
        model = Funcionario
        # data_desligamento e motivo_desligamento foram movidos para RescisaoForm
        fields = ['filial','matricula','nome','apelido','nome_social','genero','data_admissao','data_nascimento','rg','rg_emissao','rg_orgao_expedidor','cpf','titulo_eleitor','titulo_zona','titulo_secao','reservista','cnh','cnh_categoria','cnh_primeira_habilitacao','cnh_emissao','cnh_validade','fone1','fone2','email','endereco','bairro','cidade','uf','estado_civil','nome_mae','nome_pai','detalhe','usuario','pne','foto']
        widgets = {
            'detalhe': forms.Textarea(attrs={'style': 'min-height:300px'}),
            'pne': forms.CheckboxInput(attrs={'role': 'switch'}),
            'matricula': forms.TextInput(attrs={'class': 'fw-bold', 'autofocus': True}),
        }

class RescisaoForm(BootstrapMixin, forms.ModelForm):
    class Meta:
        model = Rescisao
        fields = [
            'funcionario', 'contrato', 'motivo', 'data_comunicacao','data_desligamento',
            'aviso_tipo', 'aviso_dias_devidos', 'aviso_dias_cumpridos',
            'multa_fgts_paga', 'ferias_proporcionais_pagas', 'ferias_vencidas_pagas',
            'decimo_terceiro_proporcional', 'detalhe',
        ]
        widgets = {
            'data_desligamento':            forms.DateInput(attrs={'type': 'date', 'autofocus': True}),
            'multa_fgts_paga':              forms.CheckboxInput(attrs={'role': 'switch'}),
            'ferias_proporcionais_pagas':   forms.CheckboxInput(attrs={'role': 'switch'}),
            'ferias_vencidas_pagas':        forms.CheckboxInput(attrs={'role': 'switch'}),
            'decimo_terceiro_proporcional': forms.CheckboxInput(attrs={'role': 'switch'}),
            'detalhe': forms.Textarea(attrs={'class': 'form-control form-control-sm', 'rows': 4,'placeholder': _('Detalhe')}),
        }
    def __init__(self, *args, **kwargs):
        self.funcionario = kwargs.pop('funcionario', None)
        self.contrato = kwargs.pop('contrato', None)
        super().__init__(*args, **kwargs)
        if not self.instance.pk:
            self.initial['data_desligamento'] = timezone.now().date()
            self.initial['ferias_vencidas_pagas'] = True
            self.initial['decimo_terceiro_proporcional'] = True
            self.initial['ferias_proporcionais_pagas'] = True
    def clean(self):
        cleaned_data = super().clean()
        # impede rescisao se houver afastamento em aberto
        if self.funcionario.afastamentos().filter(data_retorno__isnull=True).exists():
            raise forms.ValidationError(
                "Funcionário possui afastamento ativo. Registre o retorno antes de desligar"
            )
        return cleaned_data
    def save(self, commit=True):
        instance = super().save(commit=False)
        instance.funcionario = self.funcionario
        instance.contrato = self.contrato
        if commit:
            instance.save()
        return instance

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



class EventoMovimentacaoBaseForm(BootstrapMixin, forms.ModelForm):
    class Meta:
        fields = ['evento', 'inicio', 'fim', 'valor', 'motivo']
        widgets = {
            'inicio': forms.DateInput(attrs={'autofocus': True, 'type': 'month'}, format='%Y-%m'),
            'fim':    forms.DateInput(attrs={'type': 'month'}, format='%Y-%m'),
            'evento': forms.Select(attrs={'class': 'form-select'}),
            'valor': forms.Textarea(attrs={'class': 'form-control', 'rows': 4,'placeholder': _('Valor / Formula')}),
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
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # ensina o DateField a aceitar YYYY-MM e normaliza para primeiro do mês
        for field_name in ('inicio', 'fim'):
            self.fields[field_name].input_formats = ['%Y-%m']
        # formata valor inicial para YYYY-MM
        for field in ('inicio', 'fim'):
            if self.instance and getattr(self.instance, field):
                self.initial[field] = getattr(self.instance, field).strftime('%Y-%m')
    def clean(self):
        cd = super().clean()
        inicio, fim, ev = cd.get('inicio'), cd.get('fim'), cd.get('evento')
        val = cd.get('valor')
        if not all([inicio, ev]): return cd
        # 1. Validacao Asteval (Sintaxe)
        if val:
            check = asteval_run(val, get_event_vars_master(True))
            if not check['status']:
                self.add_error('valor', f"{_('Erro de sintaxe')}:<br>{check['message']}")
        # 2. Validacao de Datas
        if fim and inicio > fim:
            self.add_error('fim', _('Data de fim não pode ser menor que data de inicio'))
            return cd
        # 3. Validacao de Conflito
        model = self.get_model_class()
        ctx = self.get_context_filters(cd)        
        # Filtro de sobreposicao: (Inicio <= Fim Existente) AND (Fim >= Inicio Existente)
        q_overlap = Q(inicio__lte=fim or date.max) & (Q(fim__gte=inicio) | Q(fim__isnull=True))        
        filters = Q(evento=ev) & (Q(**ctx) if isinstance(ctx, dict) else ctx)
        if model.objects.filter(filters).exclude(pk=self.instance.pk).filter(q_overlap).exists():
            raise forms.ValidationError(_('Registro sobrepõe outras entradas existentes'))            
        return cd


class EventoCargoForm(EventoMovimentacaoBaseForm):
    class Meta(EventoMovimentacaoBaseForm.Meta):
        model = EventoCargo
        fields = EventoMovimentacaoBaseForm.Meta.fields + ['cargo', 'filiais']
    def __init__(self, *args, user=None, **kwargs):
        super().__init__(*args, **kwargs)
        if user:
            # Filtra e agrupa em uma única operacao lógica
            qs = user.profile.filiais.select_related('empresa').order_by('empresa__nome', 'nome')
            self.fields['filiais'].queryset = qs
            self.fields['filiais'].choices = [
                (emp, [(f.id, str(f)) for f in g]) 
                for emp, g in groupby(qs, lambda f: f.empresa.nome)
            ]
    def get_model_class(self): 
        return EventoCargo

    def get_context_filters(self, cleaned_data):
        filiais = cleaned_data.get('filiais')
        return {'filiais__id__in': filiais.values_list('id', flat=True)} if filiais else {}


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


class EventoFrequenciaForm(BootstrapMixin, forms.ModelForm):
    class Meta:
        model = EventoFrequencia
        fields = ['nome', 'rastreio' ,'categoria', 'contabiliza_horas', 'remunerado', 'dia_inteiro', 'desconta_efetivos','prioridade', 'cor']
        widgets = {
            'nome': forms.TextInput(attrs={'autofocus': True}),
            'cor': forms.TextInput(attrs={'type': 'hidden', 'class': 'form-control-color'}),
        }

class FrequenciaImportForm(BootstrapMixin, forms.Form):
    filial = forms.ModelChoiceField(
        queryset=Filial.objects.none(),
        label=_("Filial")
    )
    origem = forms.ChoiceField(choices=FrequenciaImport.Origem.choices, initial='AFD')
    arquivo = forms.FileField(label=_("Arquivo de Ponto"))
    def __init__(self, *args, **kwargs):
        user = kwargs.pop('user', None)
        super().__init__(*args, **kwargs)
        if user:
            self.fields['filial'].queryset = user.profile.filiais.all()