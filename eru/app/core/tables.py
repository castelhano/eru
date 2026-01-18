from .mixins import TableCustomMixin
from django_tables2 import Column, Table
from .models import Empresa, Filial
from django.utils.html import format_html



class EmpresaTable(TableCustomMixin, Table):
    can_export = True
    filiais = Column(orderable=False) 
    class Meta:
        model = Empresa
        fields = ("id", "nome", "razao_social", "cnpj_base", "filiais")
        edit_url, paginate_by = "empresa_update", 20
    def render_filiais(self, value):
        return format_html("".join(format_html('<span class="badge bg-secondary me-1">{}</span>', f.nome) for f in value.all()))


class FilialTable(TableCustomMixin, Table):
    class Meta:
        model = Filial
        fields = ("id", "nome", "cnpj", "cidade")
        edit_url = "filial_update"
        responsive_columns = {
            "cnpj": "d-none d-lg-table-cell",
            "id": "d-none d-sm-table-cell"
        }