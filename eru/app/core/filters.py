import django_filters
from django.contrib.auth.models import User
from auditlog.models import LogEntry
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
        # lookup_expr='icontains', # 'icontains' permite uma busca parcial e insensivel a maiusculas/minusculas
        # label='Username'
    )
    content_type = ModelMultipleChoiceFilter(
        queryset=ContentType.objects.all(),
        label='Content Type',
    )
    class Meta:
        model = LogEntry
        fields = ['actor', 'action', 'content_type', 'timestamp']


