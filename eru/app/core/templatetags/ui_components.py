from django import template
from django.urls import reverse, NoReverseMatch
from django.utils.html import format_html
from django.utils.translation import gettext as _
from django.utils.safestring import mark_safe
from .tag_extra import hl_str

register = template.Library()

# @register.simple_tag()
# def btn_tag(action, url_name=None, **kwargs):
# # {% load ui_components %}
# # {% btn_tag 'add' href='pessoal:funcionario_create' hl=False %} hl = highlight
# # {% btn_tag 'add' onclick='pessoal:funcionario_update' pk=funcionario.id|safe %}
# # {% btn_tag 'add' class="btn btn-sm btn-purple" data_bs_toggle="modal" %} se nao informar href cria button ao inves de link
# # {% btn_tag _('Meu btao') %} 
#     config = {
#         'add':    {'label': mark_safe('<i class="bi bi-plus-lg"></i>'), 'key': 'n', 'id': 'add', 'class': 'btn btn-sm btn-success'},
#         'update': {'label': mark_safe('<i class="bi bi-pen-fill"></i>'), 'key': '', 'id': '', 'class': 'btn btn-sm btn-dark'},
#         'search': {'label': mark_safe('<i class="bi bi-search"></i>'), 'key': '', 'id': '', 'class': 'btn btn-sm btn-info-matte'},
#         'submit': {'label': _('Gravar'), 'key': 'g', 'id': 'submit', 'class': 'btn btn-sm btn-primary-matte'},
#         'back':   {'label': _('Voltar'), 'key': 'v', 'id': 'back', 'class': 'btn btn-sm btn-secondary'},
#         'delete': {'label': _('Excluir'), 'key': '', 'id': '', 'class': 'btn btn-sm btn-danger-matte'},
#     }
#     btn = config.get(action, {'label': action, 'key': '', 'id': '', 'class': 'btn btn-sm btn-secondary-matte'})
#     shortcut_key = kwargs.pop('key', btn['key'])
#     label = str(kwargs.pop('label', btn['label']))
#     hl = kwargs.pop('hl', True)     # atalho para desativar o destaque do texto (mesmo definido key)
#     kwargs.setdefault('class', btn['class'])
#     if btn['id']: kwargs.setdefault('id', btn['id'])
#     href = kwargs.get('href')
#     pk_val = kwargs.pop('pk', None)
#     if url_name:
#         url_kwargs = {'pk': pk_val} if pk_val else {}
#         try:
#             href = reverse(url_name, kwargs=url_kwargs)
#         except NoReverseMatch:
#             href = "#"
#     if href: 
#         kwargs['href'] = href
#         tag_name = 'a'
#     else:
#         tag_name = 'button'
#         kwargs.setdefault('type', 'submit' if action in ['submit', 'delete'] else 'button')
#     if shortcut_key and hl and '<' not in label:
#         label = hl_str(label, shortcut_key)
#     if kwargs.pop('disabled', False): kwargs['disabled'] = 'disabled'
#     attrs_list = []
#     for k, v in kwargs.items():
#         attrs_list.append(format_html(' {}="{}"', mark_safe(k.replace("_", "-")), v))
#     attrs_html = mark_safe("".join(attrs_list))
#     return format_html('<{0}{1}>{2}</{0}>', mark_safe(tag_name), attrs_html, mark_safe(label))

@register.simple_tag()
def btn_tag(action, url_name=None, **kwargs):
    config = {
        'add':    {'label': '<i class="bi bi-plus-lg"></i>', 'key': 'n', 'id': 'add', 'class': 'btn btn-sm btn-success'},
        'update': {'label': '<i class="bi bi-pen-fill"></i>', 'key': '', 'id': '', 'class': 'btn btn-sm btn-dark'},
        'search': {'label': '<i class="bi bi-search"></i>', 'key': '', 'id': '', 'class': 'btn btn-sm btn-info-matte'},
        'submit': {'label': _('Gravar'), 'key': 'g', 'id': 'submit', 'class': 'btn btn-sm btn-primary-matte'},
        'back':   {'label': _('Voltar'), 'key': 'v', 'id': 'back', 'class': 'btn btn-sm btn-secondary'},
        'delete': {'label': _('Excluir'), 'key': '', 'id': '', 'class': 'btn btn-sm btn-danger-matte'},
    }    
    btn = config.get(action, {'label': action, 'key': '', 'id': '', 'class': 'btn btn-sm btn-secondary-matte'})
    icon = kwargs.pop('icon', None)
    label = str(kwargs.pop('label', btn['label']))
    shortcut_key = kwargs.pop('key', btn['key'])
    hl = kwargs.pop('hl', True)
    if icon:
        label = f'<i class="{icon}"></i> {label}'
    if shortcut_key and hl and '<' not in label:
        label = hl_str(label, shortcut_key)
    kwargs.setdefault('class', btn['class'])
    if btn['id']: kwargs.setdefault('id', btn['id'])
    if url_name:
        try: kwargs['href'] = reverse(url_name, kwargs={'pk': kwargs.pop('pk')} if 'pk' in kwargs else {})
        except NoReverseMatch: kwargs['href'] = "#"
    tag_name = 'a' if 'href' in kwargs or 'url_name' in locals() and url_name else 'button'
    if tag_name == 'button':
        kwargs.setdefault('type', 'submit' if action in ['submit', 'delete'] else 'button')
    if kwargs.pop('disabled', False): kwargs['disabled'] = 'disabled'
    attrs = mark_safe("".join([format_html(' {}="{}"', mark_safe(k.replace("_", "-")), v) for k, v in kwargs.items()]))
    return format_html('<{0}{1}>{2}</{0}>', mark_safe(tag_name), attrs, mark_safe(label))
