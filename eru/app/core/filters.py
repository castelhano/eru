import django_filters
from django.utils.translation import gettext_lazy as _
from django.contrib.auth.models import User, Group
from django.contrib.contenttypes.models import ContentType
from auditlog.models import LogEntry
from .models import Empresa, Filial
from django_filters import DateFromToRangeFilter, ModelMultipleChoiceFilter
from django_filters.widgets import RangeWidget


class UserFilter(django_filters.FilterSet):
    last_login__lte = django_filters.DateFilter(
        field_name='last_login',
        lookup_expr='lte',
        label=_('Último login')
    )
    never_login = django_filters.BooleanFilter(
        field_name='last_login',
        lookup_expr='isnull',
        label=_('Nunca logado'),
    )
    is_superuser = django_filters.BooleanFilter(
        lookup_expr='exact',
        label=_('Superusuario'),
    )
    group = django_filters.ModelChoiceFilter(
        field_name='groups',
        queryset=Group.objects.all(),
        label=_('Grupo')
    )
    class Meta:
        model = User
        fields = {
            'username': ['icontains'],
            'email': ['icontains'],
            'is_staff': ['exact'],
            'is_active': ['exact'],
        }

class GroupFilter(django_filters.FilterSet):
    users_isnull = django_filters.BooleanFilter(field_name='user', lookup_expr='isnull', label=_('Sem usuários'))
    class Meta:
        model = Group
        fields = ['users_isnull']



class LogEntryFilter(django_filters.FilterSet):
    timestamp = DateFromToRangeFilter(widget=RangeWidget(attrs={'type': 'date'}), label='Interval')
    actor = django_filters.CharFilter(
        field_name='actor__username', 
        # lookup_expr='icontains',
        # label='Username'
    )
    content_type = ModelMultipleChoiceFilter(
        queryset=ContentType.objects.all(),
        # label='Content Type'
    )
    class Meta:
        model = LogEntry
        fields = ['actor', 'action', 'content_type', 'timestamp']


class EmpresaFilter(django_filters.FilterSet):
    class Meta:
        model = Empresa
        fields = ['nome', 'razao_social', 'cnpj_base']
        fields = {
            'nome': ['icontains'],
            'razao_social': ['icontains'],
            'cnpj_base': ['icontains']
        }