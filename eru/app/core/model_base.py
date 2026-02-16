from django.db import models

class BaseSettings(models.Model):
    _config = models.JSONField(default=dict, db_column='config')
    class Meta:
        abstract = True
    @property
    def config(self):
        schema_class = self.get_schema()
        schema_padrao = schema_class()
        config_merged = {**schema_padrao.model_dump(), **(self._config or {})}
        return schema_class(**config_merged)
    @config.setter
    def config(self, value):
        # aceita dict ou Pydantic object
        if value is None:
            self._config = {}
        elif isinstance(value, dict):
            self._config = value
        else:
            self._config = value.model_dump() if hasattr(value, 'model_dump') else value
    def get_schema(self):
        raise NotImplementedError()
    def save(self, *args, **kwargs):
        schema = self.get_schema()(**(self._config or {}))
        self._config = schema.model_dump()
        super().save(*args, **kwargs)