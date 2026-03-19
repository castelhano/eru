import copy, json
from django.core.serializers.json import DjangoJSONEncoder
from django.db import models




def resolve_refs(schema: dict) -> dict:
    schema = copy.deepcopy(schema)
    defs = schema.get('$defs', {})

    def _resolve(node):
        if not isinstance(node, dict):
            return node

        # Resolve allOf: [{$ref: ...}] com metadados extras — padrão do Pydantic v2
        if 'allOf' in node and len(node['allOf']) == 1 and '$ref' in node['allOf'][0]:
            ref_name = node['allOf'][0]['$ref'].split('/')[-1]
            resolved = copy.deepcopy(defs.get(ref_name, {}))
            # Metadados extras (perm_view, perm_change, title, etc.) ficam fora do allOf
            extra = {k: v for k, v in node.items() if k != 'allOf'}
            resolved.update(extra)  # extra sobrescreve para preservar title, perms, etc.
            return _resolve(resolved)

        # Resolve $ref direto (sem metadados extras)
        if '$ref' in node:
            ref_name = node['$ref'].split('/')[-1]
            resolved = copy.deepcopy(defs.get(ref_name, {}))
            extra = {k: v for k, v in node.items() if k != '$ref'}
            resolved.update(extra)
            return _resolve(resolved)

        return {k: _resolve(v) for k, v in node.items()}

    resolved = _resolve(schema)
    resolved.pop('$defs', None)
    return resolved




# def resolve_refs(schema: dict) -> dict:
#     """
#     Substitui todos os $ref pelo conteúdo real de $defs, inline.
#     Retorna um schema sem $ref e sem $defs.
#     """
#     schema = copy.deepcopy(schema)
#     defs = schema.get('$defs', {})

#     def _resolve(node):
#         if not isinstance(node, dict):
#             return node
#         if '$ref' in node:
#             ref_name = node['$ref'].split('/')[-1]  # "#/$defs/AfastamentoSchema" → "AfastamentoSchema"
#             resolved = copy.deepcopy(defs.get(ref_name, {}))
#             # Preserva metadados extras que estavam junto ao $ref (perm_view, perm_change, title, etc.)
#             extra = {k: v for k, v in node.items() if k != '$ref'}
#             resolved.update(extra)
#             return _resolve(resolved)
#         return {k: _resolve(v) for k, v in node.items()}

#     resolved = _resolve(schema)
#     resolved.pop('$defs', None)
#     return resolved





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
    def get_filtered_config(self, user):
        schema_dict = self.get_filtered_schema(user)
        allowed_keys = schema_dict.get('properties', {}).keys()
        return {
            k: v for k, v in self.config.model_dump().items()
            if k in allowed_keys
        }
    def get_filtered_schema(self, user):
        schema_class = self.get_schema()
        raw_schema = schema_class.model_json_schema(mode='serialization')
        raw_schema = json.loads(json.dumps(raw_schema, cls=DjangoJSONEncoder))  # resolve proxies
        schema = resolve_refs(raw_schema)  # ← resolve antes de filtrar

        def filter_node(node):
            if not isinstance(node, dict):
                return node

            # Checa perm_view ANTES de qualquer processamento
            view_perm = node.get('perm_view')
            if view_perm and not user.has_perm(view_perm):
                return None  # bloco inteiro removido

            change_perm = node.get('perm_change')
            if change_perm and not user.has_perm(change_perm):
                node['readOnly'] = True

            # Só depois processa properties filhas
            if 'properties' in node:
                filtered = {}
                for field_name, details in node['properties'].items():
                    result = filter_node(details)
                    if result is not None:
                        filtered[field_name] = result
                node['properties'] = filtered

            return node


        return filter_node(schema)

    def save(self, *args, **kwargs):
        schema = self.get_schema()(**(self._config or {}))
        self._config = schema.model_dump()
        super().save(*args, **kwargs)