from pydantic import BaseModel, Field
from pydantic.json_schema import SkipJsonSchema
from django.utils.translation import gettext_lazy as _

class FrequenciaSchema(BaseModel):
    incluir_intervalos_jornada: bool = Field(
        False, 
        title= _("Incluir intervalos na jornada"),
        json_schema_extra={'format': 'checkbox'}
    )
    evento_folga_id: int | SkipJsonSchema[None] = Field(
        None, 
        title=_("Evento padrão para Folga"),
        )

class FolhaSchema(BaseModel):
    dia_fechamento: int = Field(default=30, ge=1, le=31)
    permite_adiantamento: bool = Field(
        False,
        json_schema_extra={'format': 'checkbox'}
        )
    foo: bool = Field(
        False,
        json_schema_extra={'format': 'checkbox'}
        )
    bar: bool = Field( True, json_schema_extra={'format': 'checkbox'} )
    non: bool = Field( True, json_schema_extra={'format': 'checkbox'} )

class PessoalSettingsSchema(BaseModel):
    model_config = {"title": _("Configurações Gerais")}
    frequencia: FrequenciaSchema = Field(default_factory=FrequenciaSchema, title=_("Frequência"))
    folha: FolhaSchema = Field(default_factory=FolhaSchema, title=_("Folha"))
