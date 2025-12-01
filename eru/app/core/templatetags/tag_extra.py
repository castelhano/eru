from datetime import date
from django import template
from urllib.parse import urlparse, parse_qs
from django.utils.safestring import mark_safe
import datetime
import json


register = template.Library()

# call_method Metodo chama funcao de objeto passando parametros
# --
# @version  1.0
# @since    09/04/2022
# @author   Rafael Gustavo ALves {@email castelhano.rafael@gmail.com }
# @example  {% call_method indicador 'analises_pendentes' metrics.empresa.id as analises_pendentes %}
#           <p>{{analises_pendentes}}</p> ou for i in analises_pendentes ......
@register.simple_tag
def call_method(obj, method_name, *args):
    try:
        method = getattr(obj, method_name)
        return method(*args)
    except Exception as e:
        return None

# add_days Recebe uma data e adiciona x dias
# --
# @version  1.0
# @since    10/11/2021
# @author   Rafael Gustavo ALves {@email castelhano.rafael@gmail.com }
# @example  {{data|add_days:5}} ou {{data|add_days:-5}}
@register.filter
def add_days(value, days):
    return value + datetime.timedelta(days=days)

# now_until_date Calcula a diferenca em dias de hoje ate uma data informada
# --
# @version  1.0
# @since    10/11/2021
# @author   Rafael Gustavo ALves {@email castelhano.rafael@gmail.com }
# @example  {{data|now_until_date}} dias
@register.filter
def now_until_date(value):
    return (value - date.today()).days if value else '--'

# days_since Retorna a quantidade de dias entre duas datas
# --
# @version  1.0
# @since    10/04/2022
# @author   Rafael Gustavo ALves {@email castelhano.rafael@gmail.com }
# @example  {{data|now_until_date}} dias
@register.filter
def days_since(v1, v2):
    return (v2 - v1).days if v1 and v2 else None

# sub Subtrai dois valores
# --
# @version  1.0
# @since    10/11/2021
# @author   Rafael Gustavo ALves {@email castelhano.rafael@gmail.com }
# @example  {{valor|sub:outro_valor}}
@register.filter
def sub(minuendo, subtraendo):
    return minuendo - subtraendo

# percentual Retorna o valor percentual de determinado valor
# --
# @version  1.0
# @since    05/10/2021
# @author   Rafael Gustavo ALves {@email castelhano.rafael@gmail.com }
# @example  {{valor|percentual:total}}
@register.filter
def percentual(valor, total):
    return (valor / total) * 100 if total > 0 and valor else 0

# parseInt Retorna o inteiro correspondente ao valor
# --
# @version  1.0
# @since    11/04/2022
# @author   Rafael Gustavo ALves {@email castelhano.rafael@gmail.com }
# @example  {{valor|parseInt}}
@register.filter
def parseInt(valor):
    try:
        return int(valor)
    except:
        return valor

# zfill Retorna valor completando com zeros n vezes
# --
# @version  1.0
# @since    05/10/2021
# @author   Rafael Gustavo ALves {@email castelhano.rafael@gmail.com }
# @example  {{2|zfill:5}} -> 00002
@register.filter
def zfill(valor,casas):
    return str(valor).zfill(int(casas))

# dict_value Retorna valor de dicionario informando a key
# --
# @version  1.0
# @since    05/10/2021
# @author   Rafael Gustavo ALves {@email castelhano.rafael@gmail.com }
# @example  {{metrics.marcas_sum|dict_value:key|zfill:2}}
@register.filter
def dict_value(dict,key):
    return dict.get(key)

# filter indicatorArrow
# @desc     Retorna icone de arrow correspondente ao valor (use filter |safe para exibir html correspondente)
# @param    {Number} value Valor alvo
# @param    {Bool} maior_melhor (opcional) Se definido como False inverte a ordem das arrows
# @returns  {html} Tag html correspondente ao valor
# @example  obj.value|indicatorArrow|safe ou obj.value|indicatorArrow:True|safe
@register.filter
def indicatorArrow(value, maior_melhor=True):
    try:
        if int(value) < 0:
            return f'<i class="fas fa-arrow-down text-danger"></i>' if maior_melhor else f'<i class="fas fa-arrow-down text-success"></i>'
        elif int(value) > 0:
            return f'<i class="fas fa-arrow-up text-success"></i>' if maior_melhor else f'<i class="fas fa-arrow-up text-danger"></i>'
        else:
            return f'<i class="fas fa-minus text-muted"></i>'
    except Exception as e:
        return ''

# filter stars
# @desc     Retorna icone de stars correspondente a quantidade informada (use filter |safe para exibir html correspondente)
# @param    {Int} value Avaliacao
# @returns  {html} Tag html correspondente ao valor
# @example  obj.value|stars|safe ou obj.value|indicatorArrow:True|safe
@register.filter
def stars(value):
    s = ''
    for x in range(5):
        s += '<i class="fas fa-star"></i>' if value >= x + 1 else '<i class="far fa-star"></i>'
    return s

# replace Retorna string trocando um valor por outro
# @version  1.0
# @since    01/06/2022
# @author   Rafael Gustavo ALves {@email castelhano.rafael@gmail.com }
# @example  {{ model.field|replace:'foo,bar'}}
@register.filter
def replace(value, criterio):
    c = criterio.split(',')
    return str(value).replace(c[0],c[1])

# split
# @version  1.0
# @since    08/07/2022
# @author   Rafael Gustavo ALves {@email castelhano.rafael@gmail.com }
# @example  {{ model.labels|split:','}}
@register.filter
def split(value, separator = ' '):
    return str(value).split(separator) if value != '' else None

# maximo
# @version  1.0
# @since    15/05/2023
# @author   Rafael Gustavo ALves {@email castelhano.rafael@gmail.com }
# @example  {{ model.value|maximo:250 }}
@register.filter
def maximo(value, limit):
    return max(value, limit)

# minimo
# @version  1.0
# @since    15/05/2023
# @author   Rafael Gustavo ALves {@email castelhano.rafael@gmail.com }
# @example  {{ model.value|minimo:250 }}
@register.filter
def minimo(value, limit):
    return min(value, limit)

@register.filter
def badge_list(value, style):
    badges = ''
    for k in value.split(';'):
        badges += f'<span class="badge me-1 {style}">{k}</span>'
    return mark_safe(badges)

@register.filter
def auditlog_action(value):
    tags = {
        0: mark_safe('<span class="badge text-bg-success">Create</span>'),
        1: mark_safe('<span class="badge text-bg-primary">Update</span>'),
        2: mark_safe('<span class="badge bg-orange">Delete</span>')
    }
    return tags.get(value, value)

#Retorna json valido
@register.filter
def json_encode(value):
    if isinstance(value, str):
        try:
            obj = json.loads(value)
            return mark_safe(json.dumps(obj, ensure_ascii=False))
        except json.JSONDecodeError:
            return mark_safe(json.dumps(value, ensure_ascii=False))
    else:
        return mark_safe(json.dumps(value, ensure_ascii=False))