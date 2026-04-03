from django.urls import path
from importlib import import_module

"""
generate_urls: Gera dinamicamente rotas Django (URLPatterns) baseadas em convenções de nomenclatura.

CONVENÇÕES DE NOMENCLATURA:
--------------------------
1. Classe: [Modelo][Contexto][Sufixo] (ex: CargoManageView, EventoReportData).
2. URL Path: 
   - CRUD: [modelo]/[id]/[acao]/ (ex: filial/<int:pk>/list/).
   - Extras: [modelo]/[contexto]/ ou path customizado no dicionário.
3. URL Name:
   - CRUD: [modelo]_list, [modelo]_create, [modelo]_update, [modelo]_delete.
   - Extras: [modelo]_[contexto] (minúsculo) ou 'name' customizado no dicionário.

REGRAS DE BUSCA DE CLASSE (View):
--------------------------------
- Sem 'suffix' informado: 
    1. Busca [Modelo][Contexto]View
    2. Fallback: Busca [Modelo][Contexto] (apenas se 'suffix' for omitido).
- Com 'suffix' informado: 
    - Busca estritamente [Modelo][Contexto][Suffix]. Se não existir, ignora a entrada.

EXEMPLOS DE CONFIGURAÇÃO:
------------------------
common = [
    "Usuario",                          # Padrão: usuario/list/ -> UsuarioListView (name: usuario_list)
    {"model": "Empresa", "path_module": "views.ent"} # Busca em arquivo específico
]
related = [
    {"model": "Filial", "lookup": "int:f_id"}, # URL: filial/<int:f_id>/list/ (name: filial_list)
    "Dependente"                               # Padrão: dependente/<int:pk>/list/
]
extra = {
    # Chave tupla define o path_module para todos os itens da lista
    ("Evento", "views.evento"): [
        "Manage",                       # String: Busca EventoManageView (URL: manage/, name: evento_manage)
        {"context": "Report", "suffix": "Data", "path": "pdf/", "name": "ev_pdf"} # Busca EventoReportData
    ],
    "Index": [
        {"context": "View", "path": "", "name": "index"} # Path vazio e Name fixo 'index'
    ]
}
"""
def generate_urls(app_name, default_path="views", **kwargs):
    all_urls = []
    
    # Processa cada grupo de configuração
    all_urls += _process_cruds(kwargs.get('common', []), app_name, default_path, is_related=False)
    all_urls += _process_cruds(kwargs.get('related', []), app_name, default_path, is_related=True)
    all_urls += _process_extras(kwargs.get('extra', {}), app_name, default_path)

    return all_urls

def _get_view_class(app_name, path_str, model, context, custom_suffix=None):
    module_path = f"{app_name}.{path_str}"
    try:
        mod = import_module(module_path)
        # 1. Se informou um sufixo customizado, faz busca estrita
        if custom_suffix:
            return getattr(mod, f"{model}{context}{custom_suffix}", None)
        # 2. Se não informou sufixo, tenta o padrão "View"
        view = getattr(mod, f"{model}{context}View", None)
        # 3. Fallback, tenta ModelContext (sem o sufixo), apenas para o caso de omissão do suffix
        if not view:
            view = getattr(mod, f"{model}{context}", None)
        return view
    except (ImportError, AttributeError):
        return None

def _process_cruds(models_list, app_name, default_path, is_related=False):
    urls = []
    for item in models_list:
        # Normaliza item: aceita "Modelo" ou {"model": "Modelo", "path": "...", "lookup": "..."}
        cfg = {"model": item} if isinstance(item, str) else item
        
        name = cfg.get("model")
        path_mod = cfg.get("path_module", default_path)
        lookup = cfg.get("lookup", "int:pk")
        
        singular = name.lower()
        prefix = f"<{lookup}>/" if is_related else ""
        
        # Mapeamento padrão de CRUD
        crud_steps = [
            ('ListView',   'list/',   '_list',   prefix),
            ('CreateView', 'new/',    '_create', prefix),
            ('UpdateView', 'update/', '_update', f'<{lookup}>/'),
            ('DeleteView', 'delete/', '_delete', f'<{lookup}>/'),
        ]

        for context_name, url_tail, name_tail, pk_part in crud_steps:
            view_class = _get_view_class(
                app_name=app_name, 
                path_str=path_mod, 
                model=name, 
                context=context_name,
                custom_suffix="" 
            )
            if view_class:
                urls.append(path(f"{singular}/{pk_part}{url_tail}", 
                            view_class.as_view(), 
                            name=f"{singular}{name_tail}"))
    return urls

def _process_extras(extra_dict, app_name, default_path):
    urls = []
    for model_key, views in extra_dict.items():
        # model_key: "Cargo" ou ("Cargo", "views.cargo")
        model_name = model_key[0] if isinstance(model_key, tuple) else model_key
        path_mod_root = (model_key[1] if isinstance(model_key, tuple) else None) or default_path
        
        for item in views:
            # Se for string "Manage", o contexto é "Manage"
            cfg = {"context": item} if isinstance(item, str) else item
            
            context = cfg.get("context", "")
            path_mod = cfg.get("path_module", path_mod_root)
            url_pattern = cfg.get("path", f"{model_name.lower()}/{context.lower()}/")
            url_name = cfg.get("name", f"{model_name.lower()}_{context.lower()}")
            custom_sfx = cfg.get("suffix", None)
            
            view_class = _get_view_class(
                app_name=app_name,
                path_str=path_mod,
                model=model_name,
                context=context,
                custom_suffix=custom_sfx
            )
            
            if view_class:
                urls.append(path(url_pattern, view_class.as_view(), name=url_name))
    return urls