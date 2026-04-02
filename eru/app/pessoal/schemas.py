from datetime import time
from pydantic import BaseModel, Field
from pydantic.json_schema import SkipJsonSchema
from django.utils.translation import gettext as _

class AfastamentoSchema(BaseModel):
    evento_doenca_id:   int | None = Field(None, title=_("Evento para Doença"), ge=1)
    evento_acidente_id: int | None = Field(None, title=_("Evento para Acidente de Trabalho"), ge=1)
    evento_outro_id:    int | None = Field(None, title=_("Evento para Outros Afastamentos"), ge=1)

class FrequenciaSchema(BaseModel):
    incluir_intervalos_jornada: bool = Field(False, title= _("Incluir intervalos na jornada"), json_schema_extra={
        'x-format': 'checkbox',
        'x-containerAttributes': {'data-switch': 'true'},
        })
    evento_jornada_id: int | None = Field(None, title=_("Evento padrão Jornada"), ge=1)
    evento_folga_id:   int | None = Field(None, title=_("Evento padrão para Folga"), ge=1)
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
    permite_adiantamento: bool = Field(False, json_schema_extra={'x-format': 'checkbox'})

class PessoalSettingsSchema(BaseModel):
    model_config = {"title": _("Configurações Gerais")}
    afastamento: AfastamentoSchema = Field(default_factory=AfastamentoSchema, title=_("Afastamento"), json_schema_extra={
    })
    frequencia: FrequenciaSchema = Field(default_factory=FrequenciaSchema, title=_("Frequência"), json_schema_extra={
    })
    folha: FolhaSchema = Field(default_factory=FolhaSchema, title=_("Folha"), json_schema_extra={
    })
