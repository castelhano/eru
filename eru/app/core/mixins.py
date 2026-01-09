import json
from django import forms
from django.http import JsonResponse, HttpResponse, HttpResponseRedirect
from django.core import serializers
from core.widgets import I18nSelect

class AjaxableListMixin:
    # permite a view retornar resultado em formado JSON (requisicao ajax) ou para um template
    def render_to_response(self, context, **response_kwargs):
        if self.request.headers.get('x-requested-with') == 'XMLHttpRequest' or \
            self.request.content_type == 'application/json' or \
            self.request.GET.get('format') == 'json': # Opcional: permite forçar via URL ?format=json
            queryset = context.get(self.context_object_name) or context.get('object_list')
            data = serializers.serialize('json', queryset)
            return HttpResponse(data, content_type="application/json")
        # se nao for AJAX, segue o fluxo normal
        return super().render_to_response(context, **response_kwargs)



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

class BootstrapI18nMixin:
    i18n_maps = {} 
    def setup_bootstrap_and_i18n(self):
        for name, field in self.fields.items():
            if name in self.i18n_maps:
                field.widget = I18nSelect(
                    choices=getattr(field, 'choices', []),
                    data_map=self.i18n_maps[name]
                )
            # 2. Define Classe CSS baseada no tipo de Widget
            if isinstance(field.widget, forms.CheckboxInput):
                css_class = 'form-check-input'
            elif isinstance(field.widget, forms.Select):
                css_class = 'form-select'
            else:
                css_class = 'form-control'
            # 3. Preserva classes existentes e adiciona placeholder
            existing_classes = field.widget.attrs.get('class', '')
            field.widget.attrs.update({
                'class': f"{css_class} {existing_classes}".strip(),
                'placeholder': ' '
            })