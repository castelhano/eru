import json
import csv
from datetime import datetime
from django import forms
from django.utils.translation import gettext_lazy as _
from django.http import JsonResponse, HttpResponse, QueryDict
from django.contrib import messages
from django.urls import reverse
from django.utils.safestring import mark_safe
from django.utils.html import strip_tags
from django_tables2 import RequestConfig, Column
from django.template.loader import render_to_string
from django.forms.models import model_to_dict
from .templatetags.ui_components import btn_tag


class AjaxableListMixin:
# mixin para consulta de registros via ajax, adicione na view, e no template:
# fetch('{% url "empresa_list" %}?id=1', {})
# .then(res => res.json())
# .then(data => console.log(data));
    def render_to_response(self, context, **response_kwargs):
        if self.is_ajax_request():
            # ordem: filtro do contexto > filtro da classe > queryset bruta
            qs = context['filter'].qs if 'filter' in context else (self.filterset_class(self.request.GET, queryset=self.get_queryset()).qs if hasattr(self, 'filterset_class') else self.get_queryset())
            return JsonResponse(list(qs.values()), safe=False)
        return super().render_to_response(context, **response_kwargs)
    def is_ajax_request(self):
        headers = self.request.headers
        if headers.get('Sec-Fetch-Dest') == 'empty':
            return True
        if headers.get('x-requested-with') == 'XMLHttpRequest':
            return True
        if self.request.GET.get('format') == 'json':
            return True
        return False


class AjaxableFormMixin:
# mixin para create / update de registros via ajax, adicione o mixin na view e no template:
# fetch('{% url "empresa_create" %}', {
#     method: 'POST',
#     headers: {
#         'Content-Type': 'application/json',
#         'X-CSRFToken': getCookie('csrftoken'),
#     },
#     body: JSON.stringify({
#         "nome": "Uma nova 3",
#       })
# })
# .then(res => { return res.json() })
# .then(data => console.log(data))
# .catch(err => console.error(err));
    def form_invalid(self, form):
        response = super().form_invalid(form) 
        if self.is_ajax_request():
            return JsonResponse({'errors': form.errors, 'status': 'error'}, status=400)
        return response
    def form_valid(self, form):
        response = super().form_valid(form) # Executa o save() e define self.object
        if self.is_ajax_request():
            list(messages.get_messages(self.request)) # Limpa a mensagem default de sucesso para evitar duplicidade
            return JsonResponse(model_to_dict(self.object), status=200)
        return response
    def dispatch(self, request, *args, **kwargs):
        if request.method == 'POST' and 'application/json' in request.content_type:
            try:
                data = json.loads(request.body)
                q_dict = QueryDict('', mutable=True) # transforma o dict em QueryDict para o form
                for key, value in data.items():
                    if isinstance(value, list):
                        for item in value: q_dict.appendlist(key, item)
                    else:
                        q_dict[key] = value
                # 3. Sobrescreve o POST. Agora o Form vai "magicamente" achar os dados
                request.POST = q_dict # sobrescreve o POST
            except json.JSONDecodeError:
                return JsonResponse({'status': 'invalid json'}, status=400)
        return super().dispatch(request, *args, **kwargs)
    def is_ajax_request(self):
        h = self.request.headers
        return any([
            h.get('x-requested-with') == 'XMLHttpRequest',
            self.request.content_type == 'application/json'
        ])

class CSVExportMixin:
# mixin exporta dados como CSV, adicione o mixin na view para habilitar
    def render_to_response(self, context, **response_kwargs):
        # if self.request.GET.get('_export') != 'csv' or not context.get('table'):
        #     return super().render_to_response(context, **response_kwargs)
        if self.request.GET.get('_export') != 'csv':
            return super().render_to_response(context, **response_kwargs)
        table = context.get('table')
        if not table:
            return super().render_to_response(context, **response_kwargs)
        table, response = context['table'], HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="{self.model._meta.verbose_name}_export.csv"'
        response.write('\ufeff'.encode('utf8'))
        writer = csv.writer(response, delimiter=';', quoting=csv.QUOTE_ALL)
        excl = getattr(table.Meta, 'exclude_from_export', [])
        cols = [c for c in table.columns if c.name not in ['actions', 'acoes'] + excl and c.header]
        writer.writerow([str(c.header).title() for c in cols])
        qs = getattr(table.data, 'data', table.data)
        iterator = qs.iterator(chunk_size=2000) if getattr(qs, '_prefetch_related_lookups', None) else qs.iterator()
        for obj in iterator:
            writer.writerow([self._get_csv_value(obj, col, table) for col in cols])
        response.set_cookie("fileDownload", "true", max_age=60)
        return response
    def _get_csv_value(self, obj, col, table):
        raw_val = getattr(obj, col.name, None)
        if raw_val is None: # se nao achar coluna busca por coluna 'virtual' (coluna relacionada)
            try: raw_val = col.accessor.resolve(obj)
            except: raw_val = ""
        if hasattr(raw_val, 'all'):
            return ";".join([str(i) for i in raw_val.all()])
        render = getattr(table, f"render_{col.name}", None)
        display = getattr(obj, f"get_{col.name}_display", None)
        val = render(value=raw_val, record=obj) if render else (display() if display else raw_val)
        if hasattr(val, 'strftime'):
            return val.strftime('%d/%m/%Y %H:%M') if isinstance(val, datetime) else val.strftime('%d/%m/%Y')
        return strip_tags(str(val if val is not None else "")).replace('\n', ' ').strip()





class BootstrapMixin:
# mixin injeta classes CSS e normaliza campos (data), alem de implementar metodo i18n_label para injetar label
# no template faca {{ form.nome }} {{ form.nome.i18n_label }}
    _CSS_MAP = {
        forms.CheckboxInput: 'form-check-input',
        forms.Select: 'form-select',
        forms.SelectMultiple: 'form-select',
        forms.RadioSelect: 'form-check-input',
    }
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for name, field in self.fields.items():
            widget = field.widget
            # 1. normalizacao de datas
            if isinstance(field, forms.DateField):
                widget.input_type = 'date'
                widget.format = '%Y-%m-%d'
            # 2. atribuicao de classes CSS
            css_class = self._CSS_MAP.get(type(widget), 'form-control')
            current_class = widget.attrs.get('class', '')
            widget.attrs['class'] = f"{css_class} {current_class}".strip()            
            # 3. define placeholder (Bootstrap Floating Labels) para os campos que suportam esse attr
            valid_types = ('email', 'number', 'password', 'search', 'tel', 'text', 'url')
            if not widget.attrs.get('placeholder') and getattr(widget, 'input_type', None) in valid_types:
                widget.attrs['placeholder'] = ' '
            # 4. sincronizacao de atributos de validacao
            self._sync_validator_attrs(field, widget)
            # 5. label traduzivel (acessivel via {{ form.campo.i18n_label }})
            bf = self[name]
            bf.i18n_label = mark_safe(f'<label for="{bf.id_for_label}">{field.label}</label>')
    def _sync_validator_attrs(self, field, widget):
        attrs_to_sync = {
            'max_length': 'maxlength',
            'min_length': 'minlength',
            'max_value': 'max',
            'min_value': 'min'
        }
        for f_attr, h_attr in attrs_to_sync.items():
            val = getattr(field, f_attr, None)
            if val is not None:
                widget.attrs[h_attr] = val



class TableCustomMixin:
    """
    Mixin para django-tables2 que padroniza o layout Bootstrap 5 e automatiza acoes CRUD.
    
    Funcionalidades:
    - Injecao automatica da coluna actions (via extra_columns) para evitar cache entre usuarios
    - Suporte unificado a links (url_name) e scripts (onclick) com checagem de permissao (perm)
    - Configuracao de colunas responsivas e estilizacao automatica de filtros (django-filter)
    - Suporte a 'Single Page CRUD' via path_params e query_params.
    - Definicao de metodo para criacao automatica de filtros (django-filter)

    Configuracoes na Meta (ou instância):
        actions (list): Lista de dicts [{'url_name': str, 'onclick': str, 'perm': str, ...}].
        action_innerhtml (str/html): Ícone/Texto padrao para os botoes.
        action_classlist (str): Classes CSS padrao (ex: 'btn btn-sm btn-primary').
        responsive_columns (dict): Mapeamento {'coluna': 'classe_css'}.
        attrs (dict): Customizacao da tag <table> (data-navigate, data-action-selector, class).
    
    Observacao: Sempre instancie a tabela com 'request' para habilitar a validacao de permissoes
    Mais detalhes em README_CORE.md.
    """
    def __init__(self, *args, **kwargs):
        self.request = kwargs.get('request')
        meta = getattr(self, 'Meta', object())
        actions = getattr(self, 'actions', getattr(meta, 'actions', []))
        if actions:
            # estilos globais da Meta (fallback)
            b_kw = {k: getattr(meta, v) for k, v in [('label', 'action_innerhtml'), ('class', 'action_classlist')] if hasattr(meta, v)}
            def render_actions(record):
                if not self.request: return ""
                btns = []
                for a in actions:
                    cfg = a.copy()
                    # 1. Filtro de Seguranca (perm)
                    perm = cfg.pop('perm', None)
                    if perm and not self.request.user.has_perm(perm):
                        continue
                    # 2. Extracao de configuracoes
                    act, url, onclick = cfg.pop('action', ''), cfg.pop('url_name', None), cfg.pop('onclick', None)
                    p_params, q_params = cfg.pop('path_params', {}), cfg.pop('query_params', {})
                    # btn_styles = {**b_kw, **cfg}
                    btn_styles = {**b_kw}
                    for k, v in cfg.items():
                        btn_styles[k] = v(record) if callable(v) else v
                    href = None
                    if url:
                        try:
                            # 2.1. Resolve os argumentos do PATH
                            k_args = {k: getattr(record, v, v) for k, v in p_params.items()}
                            href = reverse(url, kwargs=k_args)
                            # 2.2. Resolve a QueryString
                            if q_params:
                                q = "&".join(f"{k}={getattr(record, v, v)}" for k, v in q_params.items())
                                href += f"?{q}"
                            btns.append(btn_tag(act, href=href, **btn_styles))
                        except Exception as e:
                            # Se o reverse falhar, o botao nao eh adicionado
                            continue 
                    else:
                        btns.append(btn_tag(act, onclick=onclick or '', **btn_styles))
                        # btns.append(btn_tag(act, onclick=onclick, **btn_styles))
                return mark_safe(f'<div class="d-flex justify-content-end gap-1">{"".join(btns)}</div>')
            # Injecao segura via extra_columns
            col = Column(empty_values=(), attrs={"td": {"class": "text-end fit py-1"}}, orderable=False)
            col.render = render_actions 
            extra = list(kwargs.get('extra_columns', []))
            extra.append(('actions', col))
            kwargs['extra_columns'] = extra
        super().__init__(*args, **kwargs)
        # Configuracoes de layout e atributos da tabela
        self.template_name = getattr(self.Meta, 'template_name', "_tables/bootstrap5_custom.html")
        self.empty_text = self.empty_text or _("Nenhum registro a exibir")
        self.attrs = {
            "class": "table border table-striped table-hover mb-2", 
            "data-navigate": "true", "id": self.__class__.__name__.lower(),
            **getattr(meta, 'attrs', {})
        }        
        # Responsividade
        for name, css in getattr(meta, 'responsive_columns', {}).items():
            if name in self.columns:
                for target in ["th", "td"]:
                    self.columns[name].column.attrs.setdefault(target, {})["class"] = css
    def config(self, request, filter_obj=None):
        """Aplica paginacao e estiliza o form do django-filter"""
        RequestConfig(request, paginate={"per_page": getattr(self.Meta, 'paginate_by', 10)}).configure(self)
        if filter_obj:
            filter_obj.form.auto_id = f"id_%s_filter" # altera id do elemento com sufixo _filter para evitar conflito com multiforms na pagina
            for f in filter_obj.form.fields.values():
                if isinstance(f, forms.DateField): f.widget.input_type = 'date'
                cls = 'form-select form-select-sm' if isinstance(f.widget, (forms.Select, forms.SelectMultiple)) else 'form-control form-control-sm'
                f.widget.attrs['class'] = f.widget.attrs.get('class', cls)
            self.render_filter = render_to_string('_tables/auto_filter_form.html', {'filter': filter_obj, 'request': request, 'table': self})
        return self