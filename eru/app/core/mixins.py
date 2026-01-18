import json
import csv
from django import forms
from django.http import JsonResponse, HttpResponse, HttpResponseRedirect
from django.core import serializers
from core.widgets import I18nSelect, I18nSelectMultiple
from django.utils.safestring import mark_safe
import django_tables2 as tables
# from django_tables2 import RequestConfig
from django_tables2 import RequestConfig, TemplateColumn
from django.template.loader import render_to_string
from django.db.models.fields.related import ManyToManyField
from django.db.models.query import QuerySet
from django.db.models.fields import DateTimeField, DateField

class AjaxableListMixin:
    # permite a view retornar resultado em formado JSON (requisicao ajax) ou para um template
    def render_to_response(self, context, **response_kwargs):
        if self.is_ajax_request():
            queryset = context.get(self.context_object_name) or context.get('object_list')
            data = serializers.serialize('json', queryset)
            return HttpResponse(data, content_type="application/json")
        # se nao for AJAX, segue o fluxo normal
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
    # permite salvar registro por uma requisicao ajax ou de um form
    def form_invalid(self, form):
        response = super().form_invalid(form)
        if self.is_ajax_request():
            # retorna JSON com os erros de validacao
            return JsonResponse( {'errors': form.errors, 'status': 'error'}, status=400)
        return response
    def form_valid(self, form):
        # retorna json com dados do objeto
        response = super().form_valid(form) 
        if self.is_ajax_request():
            # self.object eh o objeto alvo
            data = serializers.serialize('json', [self.object])
            return HttpResponse(data, content_type="application/json", status=200)
        # se nao for AJAX, retorna a resposta padrao da base view
        return response
    def dispatch(self, request, *args, **kwargs):
        # prepara os dados para serem lidos pelo POST do django
        # se Content-Type for JSON, carrega o request.body para o request.POST
        if request.content_type == 'application/json':
            try:
                request.POST = json.loads(request.body)
            except json.JSONDecodeError:
                return JsonResponse({'status': 'invalid json'}, status=400)
        return super().dispatch(request, *args, **kwargs)
    def is_ajax_request(self):
        # metodo auxiliar para verificar se requisicao eh AJAX ou JSON
        # consiste tanto requisicoes ajax usando X-Requested-With (antigos)
        # quanto application/json (padrao Fecth moderno)
        return self.request.headers.get('x-requested-with') == 'XMLHttpRequest' or \
               self.request.content_type == 'application/json'


class CSVExportMixin:
    def render_to_response(self, context, **response_kwargs):
        if self.request.GET.get('_export') == 'csv':
            table = context.get('table')
            if not table:
                return super().render_to_response(context, **response_kwargs)
            response = HttpResponse(content_type='text/csv; charset=utf-8')
            filename = f"{self.model._meta.model_name}_export.csv"
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            response.write('\ufeff'.encode('utf8'))  # BOM para o Excel identificar UTF-8 corretamente
            writer = csv.writer(response, delimiter=';', quoting=csv.QUOTE_ALL)            
            exportable_columns = [
                col for col in table.columns 
                if col.name not in ['actions', 'acoes'] and col.header
            ]
            writer.writerow([str(column.header) for column in exportable_columns])
            for row in table.rows:
                row_data = []
                for column in exportable_columns:
                    value = row.get_cell_value(column.name)
                    if isinstance(value, QuerySet):
                        value = ", ".join([str(getattr(obj, 'nome', obj)) for obj in value.all()])
                    elif hasattr(value, 'strftime'):
                        value = value.strftime('%d/%m/%Y')
                    if value is None:
                        value = ""
                    value = str(value).replace('\r', '').replace('\n', ' ') # limpeza de quebras de linha
                    row_data.append(value)
                writer.writerow(row_data)
            response.set_cookie("fileDownload", "true", max_age=60)
            return response
        return super().render_to_response(context, **response_kwargs)


# adiciona classes e integracao com i18n aos campos
# implementa label com integracao ao i18n usando {{ form.campo.i18n_label }}
class BootstrapI18nMixin:
    i18n_maps = {}
    _CSS_MAP = {
        forms.CheckboxInput: 'form-check-input', 
        forms.Select: 'form-select'
    }
    def setup_bootstrap_and_i18n(self):
        for name, field in self.fields.items():
            key = self.i18n_maps.get(name)
            widget = field.widget
            # 1. configuracao de widgets Especiais
            if key and hasattr(field, 'choices') and isinstance(key, dict):
                W = I18nSelectMultiple if isinstance(widget, forms.SelectMultiple) else I18nSelect
                widget = field.widget = W(choices=field.choices, data_map=key)
            elif key:
                widget.attrs['data-i18n'] = key
            # 2. atribuicao de CSS e atributos
            css = self._CSS_MAP.get(type(widget), 'form-control')
            sync_attrs = {
                'max_length': 'maxlength',
                'min_length': 'minlength',
                'min_value': 'min',
                'max_value': 'max',
            }
            for field_attr, html_attr in sync_attrs.items():
                val = getattr(field, field_attr, None)
                if val is not None:
                    widget.attrs[html_attr] = val
            widget.attrs.update({
                'class': f"{css} {widget.attrs.get('class', '')}".strip(),
                'placeholder': widget.attrs.get('placeholder', ' '),
            })
            # 3. cache da label (acessivel via {{ form.campo.i18n_label }})
            bf = self[name]
            attr = f' data-i18n="{key}"' if isinstance(key, str) else ''
            bf.i18n_label = mark_safe(f'<label for="{bf.id_for_label}"{attr}>{field.label}</label>')


# Mixin para django-filter, implementa injecao de data-i18n nos fields e label do filtro
class FilterI18nMixin:
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # busca mapa de traducao no model vinculado ao Meta do Filtro
        i18n_map = getattr(self.Meta.model, 'i18n_map', {}) 
        for name, field in self.form.fields.items():
            key = i18n_map.get(name)
            if key:
                # Injeta no Widget (Input)
                field.widget.attrs['data-i18n'] = key
                # Injeta um atributo no campo para a Label no template
                field.i18n_label_key = key
            
            # Aplica estilizacao padrao do Bootstrap 5
            field.widget.attrs.update({
                'class': 'form-control form-control-sm',
                'placeholder': ' ' 
            })



class TableCustomMixin:
    render_filter = ""
    
    def __init__(self, *args, **kwargs):
        # 1. Coluna de ação (Sua lógica original que funciona)
        edit_url = getattr(self.Meta, 'edit_url', None)
        if edit_url:
            self.base_columns["actions"] = tables.TemplateColumn(
                template_code=f'<a class="btn btn-sm btn-dark" href="{{% url "{edit_url}" record.id %}}"><i class="bi bi-pen-fill"></i></a>',
                attrs={"td": {"class": "text-end fit py-1"}}, 
                verbose_name=""
            )
        
        super().__init__(*args, **kwargs)

        # 2. Configurações visuais (Sua ordem original que garante o template)
        self.template_name = "tables/bootstrap5_custom.html"
        self.attrs = {
            "class": "table border table-striped table-hover mb-2",
            "id": getattr(self.Meta, 'attrs', {}).get("id", "app_table")
        }

        # 3. I18n e Responsividade
        model = getattr(self.Meta, 'model', None)
        i18n_map = getattr(model, 'i18n_map', {})
        resp_cols = getattr(self.Meta, 'responsive_columns', {})

        for col_name, column in self.columns.items():
            # Responsividade (Sua lógica direta no col_obj)
            col_obj = column.column
            if col_name in resp_cols:
                col_obj.attrs.update({
                    "th": {"class": resp_cols[col_name]},
                    "td": {"class": resp_cols[col_name]}
                })

            # Injetamos a chave tanto no col_obj (pro Python) quanto na column (pro Template)
            key = i18n_map.get(col_name)
            if key:
                column.i18n_key = key  # Essencial para o Template ler

    def config(self, request, filter_obj=None):
        paginate = {"per_page": getattr(self.Meta, 'paginate_by', 10)}
        RequestConfig(request, paginate=paginate).configure(self)
        if filter_obj:
            self.render_filter = render_to_string(
                'tables/auto_filter_form.html', 
                {'filter': filter_obj, 'request': request, 'table': self}
            )
        return self





# Mixin para geracao altomatica de tabela (django-table2), atribui classes de cada campo (breakponit), insere botao de edicao, 
# class TableCustomMixin:
#     render_filter = "" # inicializa para evitar erro no template
#     def __init__(self, *args, **kwargs):
#         # 1. coluna de acao
#         edit_url = getattr(self.Meta, 'edit_url', None)
#         if edit_url:
#             self.base_columns["actions"] = tables.TemplateColumn(
#                 template_code=f'<a class="btn btn-sm btn-dark" href="{{% url "{edit_url}" record.id %}}"><i class="bi bi-pen-fill"></i></a>',
#                 attrs={"td": {"class": "text-end fit py-1"}}, 
#                 verbose_name=""
#             )
#         super().__init__(*args, **kwargs)
#         # 2. configuracoes visuais padrao
#         self.template_name = "tables/bootstrap5_custom.html"
#         self.attrs = {
#             "class": "table border table-striped table-hover mb-2",
#             "id": getattr(self.Meta, 'attrs', {}).get("id", "app_table")
#         }
#         # 3. responsividade e data-i18n
#         model = getattr(self.Meta, 'model', None)
#         i18n_map = getattr(model, 'i18n_map', {})
#         resp_cols = getattr(self.Meta, 'responsive_columns', {})
#         for col_name, column in self.columns.items():
#             col_obj = column.column
#             # aplica classes de responsividade
#             if col_name in resp_cols:
#                 col_obj.attrs.update({
#                     "th": {"class": resp_cols[col_name]},
#                     "td": {"class": resp_cols[col_name]}
#                 })
#             # aplica data-i18n do Model
#             key = i18n_map.get(col_name)
#             if key:
#                 th_attrs = col_obj.attrs.get("th", {})
#                 th_attrs["data-i18n"] = key
#                 col_obj.attrs["th"] = th_attrs
#     def config(self, request, filter_obj=None):
#         paginate = {"per_page": getattr(self.Meta, 'paginate_by', 10)}
#         RequestConfig(request, paginate=paginate).configure(self)
#         if filter_obj:
#             self.render_filter = render_to_string(
#                 'tables/auto_filter_form.html', 
#                 {'filter': filter_obj, 'request': request, 'table':self}
#             )
#         return self