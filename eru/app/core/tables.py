import json
from django.utils.translation import gettext_lazy as _
from .mixins import TableCustomMixin
from django_tables2 import Column, Table
from .models import Empresa, Filial
from django.contrib.auth.models import User
from auditlog.models import LogEntry
from django.utils.html import format_html



class EmpresaTable(TableCustomMixin, Table):
    export_csv = True
    max_filiais = 2
    filiais = Column(verbose_name=_('Filiais'), orderable=False)
    class Meta:
        model = Empresa
        fields = ("id", "nome", "razao_social", "cnpj_base", "filiais")
        edit_url, paginate_by = "empresa_update", 20
        responsive_columns = {
            "id": "fit pe-5",
            "razao_social": "d-none d-lg-table-cell",
            "cnpj_base": "d-none d-lg-table-cell",
            "filiais": "d-none d-md-table-cell"
        }
    def render_filiais(self, value):
        return format_html("".join(format_html('<span class="badge bg-secondary me-1">{}</span>', f.nome) for f in value.all()[:self.max_filiais]) + ('<i class="bi bi-plus-square-fill align-middle text-body-secondary" style="font-size: 1.2em; line-height: 1;"></i>' if value.count() > self.max_filiais else ""))


class FilialTable(TableCustomMixin, Table):
    class Meta:
        model = Filial
        fields = ("id", "nome", "cnpj", "cidade")
        edit_url = "filial_update"
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
        edit_url = "usuario_update"
        responsive_columns = {
        }

class LogsTable(TableCustomMixin, Table):
    class Meta:
        model = LogEntry
        fields = ("timestamp", "actor", "action", "content_type", "object_repr", "changes")
        action_script = "showDetails(this)"
        action_innerhtml = '<i class="bi bi-search"></i>'
        exclude_from_export = ["changes"]
        paginate_by = 20
        responsive_columns = {
            "changes": "d-none col-changes",
        }
    def render_changes(self, value):
        return json.dumps(value) # forca exibicao de json com aspas duplas