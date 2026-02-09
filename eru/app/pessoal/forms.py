import re
from itertools import groupby
from django import forms
from django.forms import inlineformset_factory
from django.db.models import Q
from django.urls import reverse_lazy
from django.contrib.auth.models import User
from .models import (
    Setor, Cargo, Funcionario, Contrato, Afastamento, Dependente, Evento, GrupoEvento, EventoEmpresa, 
    EventoCargo, EventoFuncionario, MotivoReajuste, Turno, TurnoDia, Frequencia, EventoFrequencia, FrequenciaImport
)
from datetime import date, datetime, timedelta
from core.mixins import BootstrapMixin
from core.extras import asteval_run
from core.models import Filial
from pessoal.folha.collectors import get_event_vars_master

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
        fields = ['funcionario','setor','cargo', 'regime', 'salario', 'inicio', 'fim', 'carga_mensal']
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



class EventoMovimentacaoBaseForm(BootstrapMixin, forms.ModelForm):
    class Meta:
        fields = ['evento', 'inicio', 'fim', 'valor', 'motivo']
        widgets = {
            'inicio': forms.DateInput(attrs={'autofocus': True}),
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


class TurnoForm(BootstrapMixin, forms.ModelForm):
    class Meta:
        model = Turno
        fields = ['nome', 'dias_ciclo', 'inicio']
        widgets = {
            'inicio': forms.DateInput(attrs={'type': 'date'}),
        }

TurnoDiaFormSet = inlineformset_factory(
    Turno, 
    TurnoDia,
    fields=['posicao_ciclo', 'entrada', 'saida', 'tolerancia', 'eh_folga'],
    extra=0,
    widgets={
        'entrada': forms.TimeInput(format='%H:%M', attrs={'type': 'time', 'class': 'form-control-sm'}),
        'saida': forms.TimeInput(format='%H:%M', attrs={'type': 'time', 'class': 'form-control-sm'}),
        'posicao_ciclo': forms.NumberInput(attrs={'class': 'form-control-sm', 'readonly': True}),
        'tolerancia': forms.NumberInput(attrs={'class': 'form-control-sm'}),
    }
)

# class FrequenciaForm(BootstrapMixin, forms.ModelForm):
#     inicio_time = forms.TimeField(
#         label=_("Entrada"),
#         required=False,
#         widget=forms.TimeInput(format='%H:%M', attrs={'type': 'time'})
#     )
#     fim_time = forms.TimeField(
#         label=_("Saída"),
#         required=False,
#         widget=forms.TimeInput(format='%H:%M', attrs={'type': 'time'})
#     )
#     data_referencia = forms.DateField(widget=forms.HiddenInput())
#     class Meta:
#         model = Frequencia
#         fields = ['evento', 'inicio_time', 'fim_time', 'observacao', 'editado', 'data_referencia']
#     def __init__(self, *args, **kwargs):
#         super().__init__(*args, **kwargs)
#         self.fields['evento'].required = False
        
#         # 1. PEGA A DATA (Prioridade: Instância > Initial > Data do POST)
#         # Isso garante que a data_referencia nunca se perca entre GET e POST
#         data_ref = None
#         if self.instance.pk and self.instance.inicio:
#             data_ref = self.instance.inicio.date()
#         else:
#             data_ref = self.initial.get('data_referencia') or self.data.get(f'{self.prefix}-data_referencia')

#         if data_ref:
#             self.fields['data_referencia'].initial = data_ref
#             # Forçamos o valor no widget para o HTML renderizar o value="YYYY-MM-DD"
#             self.fields['data_referencia'].widget.value = data_ref

#         # 3. EXTRAÇÃO DE HORAS (Para registros existentes no banco)
#         if self.instance.pk:
#             if self.instance.inicio:
#                 self.fields['inicio_time'].initial = self.instance.inicio.time()
#             if self.instance.fim:
#                 self.fields['fim_time'].initial = self.instance.fim.time()
#     def clean(self):
#         cleaned_data = super().clean()
#         inicio_time = cleaned_data.get('inicio_time')
#         evento = cleaned_data.get('evento')

#         # Se tem hora mas não tem evento, buscamos o padrão
#         if inicio_time and not evento:
#             from .models import EventoFrequencia
#             ev_padrao = EventoFrequencia.objects.filter(categoria='PRD').first()
#             if ev_padrao:
#                 cleaned_data['evento'] = ev_padrao
#             else:
#                 raise forms.ValidationError({'evento': 'Defina um evento padrão de Jornada no banco.'})
        
#         # Se NÃO tem hora e NÃO tem evento, e é um registro novo, 
#         # limpamos os erros para o Django ignorar a linha
#         if not inicio_time and not evento and not self.instance.pk:
#             self._errors = {} 
            
#         return cleaned_data


#     def has_changed(self):
#         # O formulário só "mudou" se o usuário digitou uma hora ou escolheu um evento
#         # Ignoramos a data_referencia (que sempre vem preenchida) nesta checagem
#         has_time = bool(self.data.get(self.add_prefix('inicio_time')))
#         has_event = bool(self.data.get(self.add_prefix('evento')))
#         return has_time or has_event or super().has_changed()


from django.utils import timezone
class FrequenciaForm(BootstrapMixin, forms.ModelForm):
    inicio_t = forms.TimeField(widget=forms.TimeInput(attrs={'type': 'time'}), required=False)
    fim_t = forms.TimeField(widget=forms.TimeInput(attrs={'type': 'time'}), required=False)
    data_ref = forms.CharField(widget=forms.HiddenInput(), required=False)
    class Meta:
        model = Frequencia
        fields = ['evento', 'observacao', 'editado']
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['evento'].required = False
        inst = self.instance
        
        # Simplificando a extração de dados
        dt_ini = timezone.localtime(inst.inicio) if inst.pk and inst.inicio else None
        data_v = dt_ini.date() if dt_ini else self.initial.get('inicio')

        if dt_ini:
            self.fields['inicio_t'].initial = dt_ini.time()
            if inst.fim: 
                self.fields['fim_t'].initial = timezone.localtime(inst.fim).time()

        if data_v:
            val = data_v.strftime('%Y-%m-%d') if hasattr(data_v, 'strftime') else data_v
            self.fields['data_ref'].initial = val
            self.fields['data_ref'].widget.value = val

    def save(self, contrato, ev_padrao):
        """Centraliza a 'montagem' do registro aqui"""
        d_str = self.cleaned_data.get('data_ref')
        hi = self.cleaned_data.get('inicio_t')
        hf = self.cleaned_data.get('fim_t')

        if not (d_str and hi): return None

        d_obj = datetime.strptime(d_str, '%Y-%m-%d').date()
        self.instance.contrato = contrato
        self.instance.evento = self.cleaned_data.get('evento') or ev_padrao
        
        # Monta os Datetimes
        self.instance.inicio = timezone.make_aware(datetime.combine(d_obj, hi))
        if hf:
            virada = timedelta(1) if hf < hi else timedelta(0)
            self.instance.fim = timezone.make_aware(datetime.combine(d_obj + virada, hf))
        else:
            self.instance.fim = None
        
        self.instance.save()
        return self.instance










FrequenciaFormSet = inlineformset_factory(
    Contrato,
    Frequencia,
    form=FrequenciaForm,
    extra=0,
    can_delete=True
)

class ContratoFrequenciaForm(forms.ModelForm):
# form necessario para FrequenciaManagementView
    class Meta:
        model = Contrato
        fields = [] 


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
