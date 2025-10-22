import django_filters
from django.contrib.auth.models import User


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