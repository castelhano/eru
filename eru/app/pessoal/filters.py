import django_filters
from core.models import Empresa
from .models import Funcionario, Evento, EventoEmpresa, EventoCargo, EventoFuncionario, MotivoReajuste


class FuncionarioFilter(django_filters.FilterSet):
    cnh_validade__lte = django_filters.DateFilter(
        field_name='cnh_validade',
        lookup_expr='lte',
        label='Expired drivers license validity'
    )
    class Meta:
        model = Funcionario
        fields = ['filial', 'status', 'motivo_desligamento', 'regime', 'cargo__setor', 'pne', 'cnh_validade__lte']


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