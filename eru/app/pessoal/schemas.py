from pydantic import BaseModel, Field
from django.utils.translation import gettext_lazy as _

class FrequenciaSchema(BaseModel):
    calcular_intervalos_jornada: bool = Field(
        False, 
        title=_("Incluir intervalos na jornada"),
        json_schema_extra={'format': 'checkbox'}
    )

class PessoalSettingsSchema(BaseModel):
    model_config = {"title": " "}
    frequencia: FrequenciaSchema = Field(default_factory=FrequenciaSchema, title=_("Frequência"))
    # folha: FolhaSchema = Field(default_factory=FolhaSchema)
