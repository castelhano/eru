from .mixins import TableCustomMixin
import django_tables2 as tables
from .models import Empresa, Filial


class EmpresaTable(TableCustomMixin, tables.Table):
    can_export = True
    filiais = tables.TemplateColumn(
        template_code='{% for f in record.filiais.all %}<span class="badge bg-secondary me-1">{{f.nome}}</span>{% endfor %}',
        orderable=False,
        verbose_name="Filiais"
    )
    class Meta:
        model = Empresa
        fields = ("id", "nome", "razao_social", "cnpj_base", "filiais")
        edit_url = "empresa_update"
        paginate_by = 10



class FilialTable(TableCustomMixin, tables.Table):
    class Meta:
        model = Filial
        fields = ("id", "nome", "cnpj", "cidade")
        edit_url = "filial_update"
        responsive_columns = {
            "cnpj": "d-none d-lg-table-cell",
            "id": "d-none d-sm-table-cell"
        }