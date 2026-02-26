from core.mixins import TableCustomMixin
from django.utils.translation import gettext_lazy as _
from django.utils.encoding import force_str
from django.utils.safestring import mark_safe
from django_tables2 import Table, Column
from .models import (
    Funcionario, Contrato, Setor, Cargo, Afastamento, Dependente, Evento, GrupoEvento, MotivoReajuste, 
    EventoEmpresa, EventoCargo, EventoFuncionario, EventoFrequencia
)


class FuncionarioTable(TableCustomMixin, Table):
    export_csv = True
    empresa = Column(accessor='filial__empresa__nome', verbose_name=_("Empresa"))
    cargo = Column(accessor='F_cargo', verbose_name=_("Cargo"))
    status = Column(
        verbose_name="Status",
        attrs={
            "td": {
                "class": lambda record: f"d-none d-sm-table-cell { 'text-bg-orange-matte hl-orange' if record.status != 'A' else '' }"
            },
            "th": {"class": "d-none d-lg-table-cell"}
        }
    )
    class Meta:
        model = Funcionario        
        fields = ('empresa','filial','matricula','nome','apelido','nome_social','genero','data_admissao','data_nascimento','cpf','cnh','cnh_validade','cargo','fone1','fone2','regime','pne','status',)
        actions = [
            {'action': 'update', 'url_name': 'pessoal:funcionario_update', 'path_params': {'pk': 'id'}, 'perm': 'pessoal.view_funcionario'}
        ]
        responsive_columns = {
            "empresa": "d-none d-md-table-cell",
            "filial": "d-none d-md-table-cell",
            "nome": "d-none d-lg-table-cell",
            "apelido": "d-table-cell d-lg-none",
            "nome_social": "d-none",
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
        template_name = '_tables/contrato_table.html'
        fields = ('funcionario', 'cargo', 'regime', 'salario', 'inicio', 'fim','carga_mensal','carga_diaria',)
        actions = [
            {
                'label': '<i class="bi bi-chevron-down"></i>',
                'class': 'btn btn-sm btn-info-matte',
                'data_bs_toggle': 'collapse',
                'data_bs_target': lambda record: f'#turnos-{record.id}',
            },
            {
                'action': 'update',
                'url_name': 'pessoal:contrato_list',
                'perm': 'pessoal.change_contrato', # Checagem automática no Mixin
                'path_params': {'pk': 'funcionario_id'}, # Vira /contratos/ID_FUNC/
                'query_params': {'edit': 'id'}           # Vira ?edit=ID_CONTRATO
            }
        ]
        responsive_columns = {
            "funcionario": "d-none",
        }


class SetorTable(TableCustomMixin, Table):
    export_csv = True
    ativos = Column(accessor='total_ativos', verbose_name=_('Ativos'))
    class Meta:
        model = Setor        
        fields = ('nome','ativos')
        actions = [
            {'action': 'update', 'url_name': 'pessoal:setor_update', 'path_params': {'pk': 'id'}, 'perm': 'pessoal.change_setor'}
        ]


class GrupoEventoTable(TableCustomMixin, Table):
    class Meta:
        model = GrupoEvento
        fields = ('nome',)
        actions = [
            {'action': 'update', 'url_name': 'pessoal:grupoevento_update', 'path_params': {'pk': 'id'}, 'perm': 'pessoal.change_grupoevento'}
        ]

class EventoTable(TableCustomMixin, Table):
    export_csv = True
    tipo = Column(accessor='get_tipo_display', verbose_name=_('Tipo'))    
    class Meta:
        model = Evento
        fields = ('nome', 'tipo', 'grupo', 'rastreio')
        actions = [
            {'action': 'update', 'url_name': 'pessoal:evento_update', 'path_params': {'pk': 'id'}, 'perm': 'pessoal.change_evento'}
        ]


class CargoTable(TableCustomMixin, Table):
    funcoes_fixas = Column(verbose_name=_('Funções Fixas'))
    def render_funcoes_fixas(self, value):
        if not value: return ""
        choices = dict(Cargo.FuncaoTipo.choices)
        return ", ".join(force_str(choices.get(v, v)) for v in value)
    class Meta:
        model = Cargo
        fields = ('nome', 'setor', 'funcoes_fixas')
        actions = [
            {'action': 'update', 'url_name': 'pessoal:cargo_update', 'path_params': {'pk': 'id'}, 'perm': 'pessoal.change_cargo'}
        ]
        responsive_columns = {'funcoes_fixas': 'd-none d-md-table-cell'}



class AfastamentoTable(TableCustomMixin, Table):
    export_csv = True
    class Meta:
        model = Afastamento        
        fields = ('funcionario','motivo','origem','data_afastamento','data_retorno','reabilitado','remunerado',)
        actions = [
            {'action': 'update', 'url_name': 'pessoal:afastamento_update', 'path_params': {'pk': 'id'}, 'perm': 'pessoal.change_afastamento'}
        ]


class MotivoReajusteTable(TableCustomMixin, Table):
    export_csv = True
    class Meta:
        model = MotivoReajuste        
        fields = ('nome',)
        actions = [
            {'action': 'update', 'url_name': 'pessoal:motivoreajuste_update', 'path_params': {'pk': 'id'}, 'perm': 'pessoal.change_motivoreajuste'}
        ]


class DependenteTable(TableCustomMixin, Table):
    export_csv = True
    idade = Column(accessor='idade', verbose_name=_('Idade'))
    class Meta:
        model = Dependente        
        fields = ('funcionario','nome','parentesco','genero','data_nascimento', 'rg','rg_emissao','rg_orgao_expedidor','cpf',)
        actions = [
            {'action': 'update', 'url_name': 'pessoal:dependente_update', 'path_params': {'pk': 'id'}, 'perm': 'pessoal.change_dependente'}
        ]
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

class EventoMovimentacaoBaseTable(TableCustomMixin, Table):
    class Meta:
        responsive_columns = {
            'inicio': 'd-none d-lg-table-cell',
            'fim': 'd-none d-lg-table-cell',
            'motivo': 'd-none d-md-table-cell',
            'valor': 'd-none'
        }
    def __init__(self, *args, **kwargs):
        related_type = kwargs.pop('related', 'empresa')
        self.actions = [{
            'action': 'update', 
            'url_name': 'pessoal:eventorelated_update',
            'path_params': {'related': related_type.upper(), 'pk': 'id'},
            'perm': f'pessoal.change_evento{related_type.lower()}'
        }]
        super().__init__(*args, **kwargs)


# Subclasses com campos específicos
class EventoEmpresaTable(EventoMovimentacaoBaseTable):
    filiais = Column(accessor='filiais', verbose_name=_('Filiais'))
    class Meta(EventoMovimentacaoBaseTable.Meta):
        model = EventoEmpresa
        fields = ('evento', 'inicio', 'fim', 'filiais', 'motivo')
    def render_filiais(self, value):
        if value:
            return ", ".join([f.nome for f in value.all()])
        return '--'


class EventoCargoTable(EventoMovimentacaoBaseTable):
    filiais = Column(accessor='filiais', verbose_name=_('Filiais'))
    class Meta(EventoMovimentacaoBaseTable.Meta):
        model = EventoCargo
        fields = ('evento', 'cargo', 'inicio', 'fim', 'filiais', 'motivo')
    def render_filiais(self, value):
        if value:
            return ", ".join([f.nome for f in value.all()])
        return '--'

class EventoFuncionarioTable(EventoMovimentacaoBaseTable):
    class Meta(EventoMovimentacaoBaseTable.Meta):
        model = EventoFuncionario
        fields = ('evento', 'inicio', 'fim', 'motivo', 'valor')


class EventoFrequenciaTable(TableCustomMixin, Table):
    export_csv = True
    class Meta:
        model = EventoFrequencia        
        fields = ('id','nome', 'categoria', 'contabiliza_horas', 'remunerado', 'dia_inteiro', 'prioridade', 'cor',)
        actions = [
            {'action': 'update', 'url_name': 'pessoal:eventofrequencia_update', 'path_params': {'pk': 'id'}, 'perm': 'pessoal.change_eventofrequencia'}
        ]
        responsive_columns = {
            'categoria' : 'd-none d-sm-table-cell',
            'contabiliza_horas' : 'd-none d-lg-table-cell',
            'remunerado' : 'd-none d-lg-table-cell',
            'dia_inteiro' : 'd-none d-lg-table-cell',
            'prioridade' : 'd-none d-md-table-cell',
            'cor' : 'fit d-none d-xl-table-cell',
        }
    def render_cor(self, value, **kwargs):
        return mark_safe(
            f'<span class="badge w-100" style="background-color: {value}; color: #fff;'
            f'text-shadow: 1px 1px 2px rgba(0,0,0,0.5); user-select: all; cursor: pointer;">'
            f'{value}</span>'
        )