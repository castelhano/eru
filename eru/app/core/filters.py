import django_filters
from django.contrib.auth.models import User
from auditlog.models import LogEntry
from .models import Empresa, Filial
from django.contrib.contenttypes.models import ContentType
from django_filters import DateFromToRangeFilter, ModelMultipleChoiceFilter
from django_filters.widgets import RangeWidget


class UserFilter(django_filters.FilterSet):
    last_login__lte = django_filters.DateFilter(
        field_name='last_login',
        lookup_expr='lte',
        label='Last login before'
    )

    never_login = django_filters.BooleanFilter(
        field_name='last_login',
        lookup_expr='isnull',
        label='Never login before',
    )

    class Meta:
        model = User
        fields = ['username', 'email', 'is_superuser', 'is_staff', 'is_active', 'last_login', 'last_login__lte', 'never_login']


class LogEntryFilter(django_filters.FilterSet):
    timestamp = DateFromToRangeFilter(widget=RangeWidget(attrs={'type': 'date'}), label='Interval')
    actor = django_filters.CharFilter(
        field_name='actor__username', 
        # lookup_expr='icontains',
        # label='Username'
    )
    content_type = ModelMultipleChoiceFilter(
        queryset=ContentType.objects.all(),
        label='Content Type'
    )
    class Meta:
        model = LogEntry
        fields = ['actor', 'action', 'content_type', 'timestamp']


class EmpresaFilter(django_filters.FilterSet):
    id = django_filters.NumberFilter(label='Id')
    nome = django_filters.CharFilter(lookup_expr='icontains')
    razao_social = django_filters.CharFilter(lookup_expr='icontains')
    cnpj_base = django_filters.CharFilter(lookup_expr='icontains')
    class Meta:
        model = Empresa
        fields = ['id', 'nome', 'razao_social', 'cnpj_base']


class FilialFilter(django_filters.FilterSet):
    nome = django_filters.CharFilter(lookup_expr='icontains', label='Nome')
    cnpj = django_filters.CharFilter(lookup_expr='icontains', label='CNPJ')
    cidade = django_filters.CharFilter(lookup_expr='icontains', label='Cidade')
    class Meta:
        model = Filial
        fields = ['nome', 'cnpj', 'cidade', 'uf']
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Injeta classes do Bootstrap em todos os campos do form de busca
        for field in self.form.fields:
            self.form.fields[field].widget.attrs.update({'class': 'form-control form-control-sm'})
