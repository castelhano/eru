import json
import csv
from datetime import datetime
from django import forms
from django.utils.translation import gettext_lazy as _
from django.http import JsonResponse, HttpResponse, QueryDict
from django.core import serializers
from django.utils.safestring import mark_safe
from django.utils.html import strip_tags
from django_tables2 import RequestConfig, Column
from django.template.loader import render_to_string
from django.forms.models import model_to_dict
from django.db.models.fields import DateField
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
        if self.is_ajax_request():
            return JsonResponse({'errors': form.errors, 'status': 'error'}, status=400)
        return super().form_invalid(form)
    def form_valid(self, form):
        response = super().form_valid(form) # Executa o save() e define self.object
        if self.is_ajax_request():
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
                # 3. Sobrescreve o POST. Agora o Form vai "mágicamente" achar os dados
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
        if self.request.GET.get('_export') != 'csv' or not context.get('table'):
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
            # 3. define placeholder (Bootstrap Floating Labels)
            if not widget.attrs.get('placeholder'):
                widget.attrs['placeholder'] = field.label or ' '
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
    def __init__(self, *args, **kwargs):
        meta = getattr(self, 'Meta', object())
        edit_url, extra_actions = getattr(meta, 'edit_url', None), getattr(meta, 'extra_actions', [])
        if (edit_url or extra_actions) and "actions" not in self.base_columns:
            def render_actions(record):
                # botao de edicao padrao
                btns = [btn_tag('update', edit_url, pk=record.id, **{k: getattr(meta, v) for k, v in [('label', 'action_innerhtml'), ('class', 'action_classlist')] if hasattr(meta, v)})] if edit_url else []
                # botoes extras
                for b in extra_actions:
                    c = b.copy()
                    btns.append(btn_tag(c.pop('action'), c.pop('url_name', None), pk=(record.id if c.pop('use_pk', True) else None), **c))
                return mark_safe(f'<div class="d-flex justify-content-end gap-1">{"".join(btns)}</div>')
            col = Column(empty_values=(), attrs={"td": {"class": "text-end fit py-1"}}, orderable=False, verbose_name="")
            col.render = render_actions 
            self.base_columns["actions"] = col
        super().__init__(*args, **kwargs)
        self.empty_text = self.empty_text or _("Nenhum registro a exibir")
        self.template_name = "_tables/bootstrap5_custom.html"
        self.attrs = {
            "class": "table border table-striped table-hover mb-2", 
            "data-navigate": "true", 
            "data-action-selector": ".btn", 
            "id": self.__class__.__name__.lower()
        }
        for name, css in getattr(meta, 'responsive_columns', {}).items():
            if name in self.columns:
                self.columns[name].column.attrs.update({"th": {"class": css}, "td": {"class": css}})
    # def config(self, request, filter_obj=None):
    #     RequestConfig(request, paginate={"per_page": getattr(self.Meta, 'paginate_by', 10)}).configure(self)
    #     if filter_obj:
    #         for field in filter_obj.form.fields.values():
    #             base_css = 'form-select form-select-sm' if isinstance(field.widget, (forms.Select, forms.SelectMultiple)) else 'form-control form-control-sm'
    #             existing_classes = field.widget.attrs.get('class', '')
    #             all_classes = f"{base_css} {existing_classes} ts-compact".strip()
    #             field.widget.attrs['class'] = " ".join(set(all_classes.split()))
    #             if isinstance(field, forms.DateField): field.widget.input_type = 'date'
    #         self.render_filter = render_to_string('_tables/auto_filter_form.html', {'filter': filter_obj, 'request': request, 'table': self})
    #     return self
    def config(self, request, filter_obj=None):
        RequestConfig(request, paginate={"per_page": getattr(self.Meta, 'paginate_by', 10)}).configure(self)
        if filter_obj:
            for field in filter_obj.form.fields.values():
                if isinstance(field, forms.DateField): field.widget.input_type = 'date'
                if not field.widget.attrs.get('class'):
                    base = 'form-select form-select-sm' if isinstance(field.widget, (forms.Select, forms.SelectMultiple)) else 'form-control form-control-sm'
                    field.widget.attrs['class'] = f"{base}"
            self.render_filter = render_to_string('_tables/auto_filter_form.html', {'filter': filter_obj, 'request': request, 'table': self})
        return self
