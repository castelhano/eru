import copy, json
from django.core.serializers.json import DjangoJSONEncoder
from django.db import models




def resolve_refs(schema: dict) -> dict:
    schema = copy.deepcopy(schema)
    defs = schema.get('$defs', {})

    def _resolve(node):
        if not isinstance(node, dict):
            return node

        if 'allOf' in node and len(node['allOf']) == 1 and '$ref' in node['allOf'][0]:
            ref_name = node['allOf'][0]['$ref'].split('/')[-1]
            resolved = copy.deepcopy(defs.get(ref_name, {}))
            extra = {k: v for k, v in node.items() if k != 'allOf'}
            resolved.update(extra)
            return _resolve(resolved)

        if '$ref' in node:
            ref_name = node['$ref'].split('/')[-1]
            resolved = copy.deepcopy(defs.get(ref_name, {}))
            extra = {k: v for k, v in node.items() if k != '$ref'}
            resolved.update(extra)
            return _resolve(resolved)

        # ✅ Novo: int | None → apenas int, com default null
        if 'anyOf' in node:
            types = [b.get('type') for b in node['anyOf'] if 'type' in b]
            non_null = [t for t in types if t != 'null']
            has_null = 'null' in types
            if non_null and len(non_null) == 1:
                # ✅ pega todos os atributos do branch não-null, não só o type
                non_null_branch = next(b for b in node['anyOf'] if b.get('type') == non_null[0])
                result = {k: v for k, v in node.items() if k != 'anyOf'}
                result.update(non_null_branch)  # traz minimum, maximum, etc.
                if has_null:
                    result['type'] = ['null', non_null[0]]
                    result['x-format'] = 'number-nullable'
                if 'default' not in result:
                    result['default'] = None
                return _resolve(result)




        # ✅ Garante type: object quando tem properties
        result = {k: _resolve(v) for k, v in node.items()}
        if 'properties' in result and 'type' not in result:
            result['type'] = 'object'
        return result

    resolved = _resolve(schema)
    resolved.pop('$defs', None)
    return resolved




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
    def get_schema_dict(self):
        raw = self.get_schema().model_json_schema(mode='serialization')
        raw = json.loads(json.dumps(raw, cls=DjangoJSONEncoder))
        return resolve_refs(raw)
    def save(self, *args, **kwargs):
        schema = self.get_schema()(**(self._config or {}))
        self._config = schema.model_dump()
        super().save(*args, **kwargs)