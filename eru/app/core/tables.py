from .mixins import TableCustomMixin
import django_tables2 as tables
from .models import Empresa, Filial


class EmpresaTable(TableCustomMixin, tables.Table):
    filiais = tables.TemplateColumn(
        template_code='{% for f in record.filiais.all %}<span class="badge bg-secondary me-1">{{f.nome}}</span>{% endfor %}',
        verbose_name="Filiais"
    )
    class Meta:
        model = Empresa
        fields = ("id", "nome", "razao_social", "cnpj_base", "filiais")
        edit_url = "empresa_update"
        paginate_by = 10













# V1
# class EmpresaTable(TableCustomMixin, tables.Table):
#     filiais = tables.TemplateColumn(
#         template_code='',
#         verbose_name="Filiais"
#     )

#     class Meta:
#         model = Empresa
#         fields = ("id", "nome", "razao_social", "cnpj_base", "filiais")
#         edit_url = "empresa_update"





# V2
# class EmpresaTable(TableCustomMixin, tables.Table):
#     # Coluna Filiais: itera sobre o prefetch_related e gera as badges
#     filiais = tables.TemplateColumn(
#         template_code='''
#             {% for filial in record.filiais.all %}
#                 <span class="badge bg-body-secondary text-body">{{ filial.nome|truncatechars:18 }}</span>
#             {% endfor %}
#         ''',
#         verbose_name="Filiais",
#         attrs={"td": {"class": "d-none d-lg-table-cell"}, "th": {"class": "d-none d-lg-table-cell"}}
#     )

#     class Meta:
#         model = Empresa
#         fields = ("id", "nome", "razao_social", "cnpj_base", "filiais")
#         # Atributos para os cabeçalhos com data-i18n
#         extra_columns_attrs = {
#             "nome": {"th": {"data-i18n": "common.name__posfix:*"}},
#             "razao_social": {
#                 "th": {"data-i18n": "company.companyName", "class": "d-none d-lg-table-cell"},
#                 "td": {"class": "d-none d-lg-table-cell"}
#             },
#             "cnpj_base": {
#                 "th": {"class": "d-none d-lg-table-cell"},
#                 "td": {"class": "d-none d-lg-table-cell"}
#             }
#         }
        
#         edit_url = "empresa_update" # Aciona a criação do botão no Mixin
#         attrs = {"id": "main_table", "class": "table border table-striped table-hover"}

class FilialTable(TableCustomMixin, tables.Table):
    class Meta:
        model = Filial
        fields = ("id", "nome", "cnpj", "cidade")
        edit_url = "filial_update"
        responsive_columns = {
            "cnpj": "d-none d-lg-table-cell",
            "id": "d-none d-sm-table-cell"
        }