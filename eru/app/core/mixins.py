import json
from django import forms
from django.http import JsonResponse, HttpResponse, HttpResponseRedirect
from django.core import serializers
from core.widgets import I18nSelect, I18nSelectMultiple
from django.utils.safestring import mark_safe

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
            # 1. configuracao de Widgets Especiais
            if key and hasattr(field, 'choices') and isinstance(key, dict):
                W = I18nSelectMultiple if isinstance(widget, forms.SelectMultiple) else I18nSelect
                widget = field.widget = W(choices=field.choices, data_map=key)
            elif key:
                widget.attrs['data-i18n'] = key
            # 2. atribuicao de CSS e atributos
            css = self._CSS_MAP.get(type(widget), 'form-control')
            widget.attrs.update({
                'class': f"{css} {widget.attrs.get('class', '')}".strip(),
                'placeholder': widget.attrs.get('placeholder', ' ')
            })
            # 3. cache da label (acessivel via {{ form.campo.i18n_label }})
            bf = self[name]
            attr = f' data-i18n="{key}"' if isinstance(key, str) else ''
            bf.i18n_label = mark_safe(f'<label for="{bf.id_for_label}"{attr}>{field.label}</label>')
