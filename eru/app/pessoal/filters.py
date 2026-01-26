from django.db import connection
import django_filters
from django import forms
from django.urls import reverse_lazy
from django.utils.translation import gettext_lazy as _
from core.models import Empresa, Filial
from .models import Funcionario, Contrato, Setor, Cargo, Evento, EventoEmpresa, EventoCargo, EventoFuncionario, MotivoReajuste


class FuncionarioFilter(django_filters.FilterSet):
    empresa = django_filters.ModelChoiceFilter(field_name='filial__empresa', queryset=Empresa.objects.none(), label=_('Empresa'))
    filial = django_filters.ModelChoiceFilter(queryset=Filial.objects.none(), label=_('Filial'))
    setor = django_filters.ModelChoiceFilter(field_name='contratos__cargo__setor', queryset=Setor.objects.all(), label=_('Setor'))
    cargo = django_filters.ModelChoiceFilter(field_name='contratos__cargo', queryset=Cargo.objects.none(), label=_('Cargo'))
    cnh_validade__lte = django_filters.DateFilter(
        field_name='cnh_validade',
        lookup_expr='lte',
        label=_('Vencimento CNH')
    )
    status = django_filters.MultipleChoiceFilter(
        choices=Funcionario.Status.choices,
        label=_('Status'),
        widget=forms.SelectMultiple(attrs={'class': 'form-control form-control-sm ts-compact'})
    )
    funcao_fixa = django_filters.ChoiceFilter(
        choices=Cargo.FuncaoTipo.choices,
        label=_('Funções Fixa'),
        method='filter_funcao_fixa'
    )
    class Meta:
        model = Funcionario
        fields = ['empresa','filial','setor','cargo','status','motivo_desligamento','pne','cnh_validade__lte','funcao_fixa']
    def filter_funcao_fixa(self, queryset, name, value):
        if not value:
            return queryset
        # define o lookup conforme o banco: __contains para os robustos, __icontains para SQLite
        is_native = connection.vendor in ['postgresql', 'mysql', 'mariadb']
        lookup = 'contratos__cargo__funcoes_fixas__contains' if is_native else 'contratos__cargo__funcoes_fixas__icontains'
        # Se for SQLite, envolve o valor em aspas para simular a busca no JSON
        val = value if is_native else f'"{value}"'        
        return queryset.filter(**{lookup: val}).distinct()
    def __init__(self, *args, **kwargs):
        user = kwargs.pop('user', None)
        super().__init__(*args, **kwargs)
        self.filters['filial'].field.widget.attrs.update({
            'data-chained-field': 'id_empresa',
            'data-url': reverse_lazy('filial_list'),
            'class': 'form-select form-select-sm select-chained'
        })
        self.filters['status'].field.widget.attrs.update({'class_cols': '2'})
        cargo_field = self.filters['cargo'].field
        cargo_field.widget.attrs.update({
            'data-chained-field': 'id_setor',
            'data-url': reverse_lazy('pessoal:cargo_list'),
            'class': 'form-select form-select-sm select-chained'
        })
        setor_id = self.data.get('setor')
        self.filters['cargo'].field.queryset = Cargo.objects.filter(setor_id=setor_id) if setor_id else Cargo.objects.none()
        if user:
            filiais_qs = user.profile.filiais.all()
            self.filters['empresa'].queryset = Empresa.objects.filter(filiais__in=filiais_qs).distinct()
            empresa_id = self.data.get('empresa')
            self.filters['filial'].field.queryset = filiais_qs.filter(empresa_id=empresa_id) if empresa_id else Filial.objects.none()


class ContratoFilterSet(django_filters.FilterSet):
    class Meta:
        fields = ['cargo', 'regime', 'salario', 'inicio', 'fim']

class EventoMovimentacaoFilterSet(django_filters.FilterSet):
    inicio = django_filters.DateFilter(field_name="inicio", lookup_expr='gte')
    fim = django_filters.DateFilter(field_name="fim", lookup_expr='lte')
    motivo = django_filters.ModelChoiceFilter(queryset=MotivoReajuste.objects.all())
    evento = django_filters.ModelChoiceFilter(queryset=Evento.objects.all())
    class Meta:
        fields = ['inicio', 'fim', 'tipo', 'motivo', 'evento']


class EventoCargoFilter(EventoMovimentacaoFilterSet):
    empresa = django_filters.ModelChoiceFilter(queryset=Empresa.objects.all(), field_name='empresas', label="Empresa")
    class Meta(EventoMovimentacaoFilterSet.Meta):
        model = EventoCargo
        fields = EventoMovimentacaoFilterSet.Meta.fields + ['cargo', 'empresa'] # Adiciona o campo 'cargo'

class EventoFuncionarioFilter(EventoMovimentacaoFilterSet):
    class Meta(EventoMovimentacaoFilterSet.Meta):
        model = EventoFuncionario
        fields = EventoMovimentacaoFilterSet.Meta.fields + ['funcionario'] # Adiciona o campo 'funcionario'

class EventoEmpresaFilter(EventoMovimentacaoFilterSet):
    empresa = django_filters.ModelChoiceFilter(queryset=Empresa.objects.all(), field_name='empresas', label="Empresa")
    class Meta(EventoMovimentacaoFilterSet.Meta):
        model = EventoEmpresa
        fields = EventoMovimentacaoFilterSet.Meta.fields + ['empresa'] # Adiciona o campo 'empresa'