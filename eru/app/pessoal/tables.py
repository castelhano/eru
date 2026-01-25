from core.mixins import TableCustomMixin
from django.utils.translation import gettext_lazy as _
from django_tables2 import Table, Column
from .models import Funcionario



class FuncionarioTable(TableCustomMixin, Table):
    export_csv = True
    empresa = Column(accessor='filial__empresa__nome', verbose_name=_("Empresa"))
    class Meta:
        model = Funcionario        
        fields = ('empresa','filial','matricula','nome','apelido','nome_social','genero','data_admissao','data_nascimento','cpf','cnh','cnh_validade','cargo','fone1','fone2','regime','pne','status',)
        edit_url, paginate_by = "funcionario_update", 20
        responsive_columns = {
            "filial": "d-none d-sm-table-cell",
            "nome": "d-none d-lg-table-cell",
            "apelido": "d-table-cell d-lg-none",
            "genero": "d-none",
            "data_nascimento": "d-none",
            "data_admissao": "d-none",
            "cpf": "d-none",
            "cnh": "d-none",
            "cnh_validade": "d-none",
            "cargo": "d-none d-sm-table-cell",
            "fone1": "d-none",
            "fone2": "d-none",
            "regime": "d-none",
            "pne": "d-none",
            "status": "d-none d-lg-table-cell"
        }
