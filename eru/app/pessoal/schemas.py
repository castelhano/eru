from datetime import time
from pydantic import BaseModel, Field
from pydantic.json_schema import SkipJsonSchema
from django.utils.translation import gettext_lazy as _

class AfastamentoSchema(BaseModel):
    evento_doenca_id:   int | SkipJsonSchema[None] = Field(None, title=_("Evento para Doença"))
    evento_acidente_id: int | SkipJsonSchema[None] = Field(None, title=_("Evento para Acidente de Trabalho"))
    evento_outro_id:    int | SkipJsonSchema[None] = Field(None, title=_("Evento para Outros Afastamentos"))

class FrequenciaSchema(BaseModel):
    incluir_intervalos_jornada: bool = Field(False, title= _("Incluir intervalos na jornada"), json_schema_extra={'format': 'checkbox'})
    evento_jornada_id: int | SkipJsonSchema[None] = Field(None, title=_("Evento padrão Jornada"))
    evento_folga_id: int | SkipJsonSchema[None] = Field(None, title=_("Evento padrão para Folga"))
    hora_noturna_inicio:        str = Field(default='22:00', title=_("Início hora noturna"))
    hora_noturna_fim:           str = Field(default='06:00', title=_("Fim hora noturna"))
    @property
    def hn_inicio(self) -> time:
        """Converte string HH:MM para time — uso interno no engine."""
        h, m = self.hora_noturna_inicio.split(':')
        return time(int(h), int(m))
    @property
    def hn_fim(self) -> time:
        h, m = self.hora_noturna_fim.split(':')
        return time(int(h), int(m))

class FolhaSchema(BaseModel):
    dia_fechamento: int = Field(default=30, ge=1, le=31)
    permite_adiantamento: bool = Field(False, json_schema_extra={'format': 'checkbox'})

class PessoalSettingsSchema(BaseModel):
    model_config = {"title": _("Configurações Gerais")}
    afastamento: AfastamentoSchema = Field(default_factory=AfastamentoSchema, title=_("Afastamento"), json_schema_extra={"options": {"collapsed": True}})
    frequencia: FrequenciaSchema = Field(default_factory=FrequenciaSchema, title=_("Frequência"), json_schema_extra={"options": {"collapsed": True}})
    folha: FolhaSchema = Field(default_factory=FolhaSchema, title=_("Folha"), json_schema_extra={"options": {"collapsed": True}})
