from core.mixins import TableCustomMixin
from django.utils.translation import gettext_lazy as _
from django_tables2 import Table, Column
from .models import Funcionario, Contrato, Setor, Afastamento, Dependente


class FuncionarioTable(TableCustomMixin, Table):
    export_csv = True
    empresa = Column(accessor='filial__empresa__nome', verbose_name=_("Empresa"))
    cargo = Column(accessor='F_cargo', verbose_name=_("Cargo"))
    status = Column(
        verbose_name="Status",
        attrs={
            "td": {
                "class": lambda record: f"d-none d-lg-table-cell { 'hl-orange' if record.status != 'A' else '' }"
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

class ContratoTable(TableCustomMixin, Table):
    export_csv = True
    class Meta:
        model = Contrato        
        fields = ('funcionario', 'cargo', 'regime', 'salario', 'inicio', 'fim',)
        paginate_by = 10
        responsive_columns = {
            "funcionario": "d-none",
        }
    def __init__(self, *args, **kwargs):
        self.request = kwargs.get('request') 
        actions = []
        if self.request and self.request.user.has_perm('pessoal.change_contrato'):
            actions.append({
                'action': 'update', 
                'url_name': 'pessoal:contrato_list',
                'url_params': {'edit': 'id'},
                'use_pk': 'funcionario_id'
            })
        self.Meta.extra_actions = actions        
        super().__init__(*args, **kwargs)


class SetorTable(TableCustomMixin, Table):
    export_csv = True
    class Meta:
        model = Setor        
        fields = ('nome',)
        edit_url, paginate_by = "pessoal:setor_update", 20

class AfastamentoTable(TableCustomMixin, Table):
    export_csv = True
    class Meta:
        model = Afastamento        
        fields = ('funcionario','motivo','origem','data_afastamento','data_retorno','reabilitado','remunerado',)
        edit_url, paginate_by = "pessoal:afastamento_update", 10


class DependenteTable(TableCustomMixin, Table):
    export_csv = True
    idade = Column(accessor='idade', verbose_name=_('Idade'))
    class Meta:
        model = Dependente        
        fields = ('funcionario','nome','parentesco','genero','data_nascimento', 'rg','rg_emissao','rg_orgao_expedidor','cpf',)
        edit_url, paginate_by = "pessoal:dependente_update", 10
        responsive_columns = {
            "funcionario": "d-none",
            "parentesco": "d-none d-md-table-cell",
            "genero": "d-none d-lg-table-cell",
            "data_nascimento": "d-none d-lg-table-cell",
            "idade": "d-none d-sm-table-cell",
            "rg": "d-none",
            "rg_emissao": "d-none",
            "rg_orgao_expedidor": "d-none",
            "cpf": "d-none",
        }