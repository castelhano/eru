from core.mixins import TableCustomMixin
from django.utils.translation import gettext_lazy as _
from django_tables2 import Table, Column
from .models import Funcionario, Setor


class FuncionarioTable(TableCustomMixin, Table):
    export_csv = True
    empresa = Column(accessor='filial__empresa__nome', verbose_name=_("Empresa"))
    cargo = Column(accessor='F_cargo', verbose_name=_("Cargo"))
    status = Column(
        verbose_name="Status",
        attrs={
            "td": {
                "class": lambda value: f"d-none d-lg-table-cell { 'hl-orange' if value != 'A' else '' }"
            },
            "th": {"class": "d-none d-lg-table-cell"}
        }
    )
    class Meta:
        model = Funcionario        
        fields = ('empresa','filial','matricula','nome','apelido','nome_social','genero','data_admissao','data_nascimento','cpf','cnh','cnh_validade','cargo','fone1','fone2','regime','pne','status',)
        edit_url, paginate_by = "pessoal:funcionario_update", 20
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
        }

class SetorTable(TableCustomMixin, Table):
    export_csv = True
    class Meta:
        model = Setor        
        fields = ('nome',)
        edit_url, paginate_by = "pessoal:setor_update", 20