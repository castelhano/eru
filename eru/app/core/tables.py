from .mixins import TableCustomMixin
from django_tables2 import Column, Table
from .models import Empresa, Filial
from django.utils.html import format_html



class EmpresaTable(TableCustomMixin, Table):
    can_export = True
    max_filiais = 2
    filiais = Column(orderable=False)
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