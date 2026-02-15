import json
from django.utils.html import format_html
from django.utils.translation import gettext_lazy as _
from django.utils.safestring import mark_safe
from .mixins import TableCustomMixin
from django_tables2 import Column, Table
from .models import Empresa, Filial
from django.contrib.auth.models import User, Group
from auditlog.models import LogEntry



class EmpresaTable(TableCustomMixin, Table):
    export_csv = True
    max_filiais = 2
    filiais = Column(verbose_name=_('Filiais'), orderable=False)
    class Meta:
        model = Empresa
        fields = ("id", "nome", "razao_social", "cnpj_base", "filiais")
        paginate_by = 20
        actions = [
            {'action': 'update', 'url_name': 'empresa_update', 'path_params': {'pk': 'id'}, 'perm': 'core.change_empresa'}
        ]
        responsive_columns = {
            "id": "fit pe-5",
            "razao_social": "d-none d-lg-table-cell",
            "cnpj_base": "d-none d-lg-table-cell",
            "filiais": "d-none d-md-table-cell"
        }
    def render_filiais(self, value):
        items = [format_html('<span class="badge btn-secondary-matte me-1">{}</span>', f.nome) for f in value.all()[:self.max_filiais]]
        if value.count() > self.max_filiais:
            items.append(mark_safe('<b class="badge btn-secondary-matte"><i class="bi bi-plus-lg"></i></b>'))
        return mark_safe("".join(items))

class FilialTable(TableCustomMixin, Table):
    class Meta:
        model = Filial
        fields = ("id", "nome", "cnpj", "cidade")
        paginate_by = 1
        actions = [
            {'action': 'update', 'url_name': 'filial_update', 'path_params': {'pk': 'id'}, 'perm':'core.change_filial'}
        ]
        responsive_columns = {
            "id": "d-none d-sm-table-cell",
            "cnpj": "d-none d-lg-table-cell",
            "cidade": "d-none d-lg-table-cell",
        }

class UsuarioTable(TableCustomMixin, Table):
    export_csv = True
    class Meta:
        model = User
        fields = ("id", "username", "first_name", "last_name", "is_active", "last_login")
        paginate_by = 10
        actions = [
            {'action': 'update', 'url_name': 'usuario_update', 'path_params': {'pk': 'id'}, 'perm':'auth.change_user'}
        ]
        responsive_columns = {
            "id": "d-none d-md-table-cell",
            "first_name": "d-none d-lg-table-cell",
            "last_name": "d-none d-lg-table-cell",
            "last_login": "d-none d-md-table-cell",
        }

class GrupoTable(TableCustomMixin, Table):
    export_csv = True
    class Meta:
        model = Group
        fields = ("id", "name")
        actions = [
            {'action': 'update', 'url_name': 'grupo_update', 'path_params': {'pk': 'id'}, 'perm':'auth.change_group'},
            {
                'url_name': 'usuario_list',
                'query_params': {'group': 'id'},
                'label': mark_safe('<i class="bi bi-people-fill"></i>'),
                'class': 'btn btn-sm btn-info-matte'
            }
        ]

class LogsTable(TableCustomMixin, Table):
    class Meta:
        model = LogEntry
        fields = ("timestamp", "actor", "action", "content_type", "object_repr", "changes")
        actions = [
            {
                'action': 'search',
                'onclick': 'showDetails(this)', 
            }
        ]
        action_script = "showDetails(this)"
        action_innerhtml = '<i class="bi bi-search"></i>'
        exclude_from_export = ["changes"]
        paginate_by = 20
        responsive_columns = {
            "changes": "d-none col-changes",
        }
    def render_changes(self, value):
        return json.dumps(value)