import django_filters
from .models import Funcionario


class FuncionarioFilter(django_filters.FilterSet):
    cnh_validade__lte = django_filters.DateFilter(
        field_name='cnh_validade',
        lookup_expr='lte',
        label='Expired drivers license validity'
    )

    class Meta:
        model = Funcionario
        fields = ['empresa', 'status', 'motivo_desligamento', 'regime', 'cargo__setor', 'pne', 'cnh_validade__lte']