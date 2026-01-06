from django import forms
from django.forms.widgets import Select

# widget I18nSelect injeta data-i18n nos options, deve ser repassado no form, ex:
# parentesco = forms.ChoiceField(choices=Dependente.PARENTESCO, widget=I18nSelect(attrs={ 'class': 'form-select' }, data_map=Dependente.PARENTESCO_I18N_MAP))
# PARENTESCO_I18N_MAP deve ser um dicionario inserido no modelo

class I18nSelect(Select):
    def __init__(self, attrs=None, choices=(), data_map=None):
        super().__init__(attrs, choices)
        self.data_map = data_map or {}
    def create_option(self, name, value, label, selected, index, subindex=None, attrs=None):
        option = super().create_option(name, value, label, selected, index, subindex, attrs)
        if value in self.data_map:
            option['attrs']['data-i18n'] = self.data_map[value]
        return option

class I18nSelectMultiple(forms.SelectMultiple):
    def __init__(self, attrs=None, choices=(), data_map=None):
        super().__init__(attrs, choices)
        self.data_map = data_map or {}
    def create_option(self, name, value, label, selected, index, subindex=None, attrs=None):
        option = super().create_option(name, value, label, selected, index, subindex, attrs)
        if value in self.data_map:
            option['attrs']['data-i18n'] = self.data_map[value]
        return option

