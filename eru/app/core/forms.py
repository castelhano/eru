from django import forms
from django.forms import Field
from .models import Empresa, Settings
from django.contrib.auth.models import User, Group, Permission
from django.utils.translation import gettext_lazy as _
from itertools import groupby
from functools import lru_cache

Field.default_error_messages['required'] = _('<span data-i18n="sys.fieldRequired">Campo obrigatório</span>')
Field.default_error_messages['unique'] = _('<span data-i18n="sys.fieldUnique">Campo duplicado, precisa ser unico</span>')

@lru_cache(maxsize=1)
def get_grouped_permissions():
    permissions = Permission.objects.exclude(content_type__app_label__in=['admin', 'contenttypes', 'sessions']).select_related('content_type').order_by('content_type__app_label', 'codename')
    grouped = groupby(permissions, lambda p: p.content_type.app_label)
    choices = []
    for app_label, perms in grouped:
        choices.append((app_label, [(p.id, f"{p.content_type.app_label}: {p.codename}") for p in perms]))
    return choices

class EmpresaForm(forms.ModelForm):
    class Meta:
        model = Empresa
        fields = ['nome','cnpj','razao_social','inscricao_estadual','inscricao_municipal','cnae','atividade','endereco','bairro','cidade','uf','cep','fone','fax','logo','footer']
    nome = forms.CharField(max_length=20, widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' ','autofocus':'autofocus'}))
    cnpj = forms.CharField(required=False, max_length=18 ,widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    razao_social = forms.CharField(required=False, max_length=80,widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    inscricao_estadual = forms.CharField(required=False, max_length=15,widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    inscricao_municipal = forms.CharField(required=False, max_length=15,widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    cnae = forms.CharField(required=False, max_length=10,widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    atividade = forms.CharField(required=False, max_length=150,widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    endereco = forms.CharField(required=False, max_length=150,widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    bairro = forms.CharField(required=False, max_length=50,widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    cidade = forms.CharField(required=False, max_length=50,widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    uf = forms.CharField(required=False, max_length=2,widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    cep = forms.CharField(required=False, max_length=10,widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    fone = forms.CharField(required=False, widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    fax = forms.CharField(required=False, widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    logo = forms.ImageField(required=False, widget=forms.ClearableFileInput(attrs={'class': 'form-control','accept':'image/*'}))
    footer = forms.CharField(required=False, widget=forms.Textarea(attrs={'class': 'form-control','style':'min-height:200px;','placeholder':'Rodapé padrão MD Report'}))


class UserForm(forms.ModelForm):
    class Meta:
        model = User
        fields = ['username','first_name','last_name','email','is_superuser','is_staff','is_active', 'groups', 'user_permissions']
    username = forms.CharField(widget=forms.TextInput(attrs={'class': 'form-control fw-bold','placeholder':' ','autofocus':'autofocus'}))
    first_name = forms.CharField(required=False, widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    last_name = forms.CharField(required=False, widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    email = forms.CharField(required=False, widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' ','type':'email'}))
    is_superuser = forms.BooleanField(required=False, initial=False, widget=forms.CheckboxInput(attrs={'class': 'form-check-input','role':'switch'}))
    is_staff = forms.BooleanField(required=False, initial=False, widget=forms.CheckboxInput(attrs={'class': 'form-check-input','role':'switch'}))
    is_active = forms.BooleanField(required=False, initial=True, widget=forms.CheckboxInput(attrs={'class': 'form-check-input','role':'switch'}))
    groups = forms.ModelMultipleChoiceField(queryset=Group.objects.all(), required=False)
    user_permissions = forms.ModelMultipleChoiceField(queryset=Permission.objects.all(), required=False)
    empresas = forms.ModelMultipleChoiceField(queryset=Empresa.objects.all(), required=False)
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['user_permissions'].choices = get_grouped_permissions()

class GroupForm(forms.ModelForm):
    class Meta:
        model = Group
        fields = ['name','permissions']
    name = forms.CharField(widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' ','autofocus':'autofocus'}))
    permissions = forms.ModelMultipleChoiceField(queryset=Permission.objects.all(), required=False)
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['permissions'].choices = get_grouped_permissions()


class SettingsForm(forms.ModelForm):
    class Meta:
        model = Settings
        fields = ['quantidade_caracteres_senha','senha_exige_alpha','senha_exige_numero','senha_exige_maiuscula','senha_exige_caractere','historico_senhas_nao_repetir','quantidade_tentantivas_erradas']
    quantidade_caracteres_senha = forms.IntegerField(required=False, initial=8, widget=forms.TextInput(attrs={'class': 'form-control form-control-sm','type':'number','min':'1','max':'90'}))
    senha_exige_alpha = forms.BooleanField(required=False, initial=True, widget=forms.CheckboxInput(attrs={'class': 'form-check-input','role':'switch'}))
    senha_exige_numero = forms.BooleanField(required=False, initial=True, widget=forms.CheckboxInput(attrs={'class': 'form-check-input','role':'switch'}))
    senha_exige_maiuscula = forms.BooleanField(required=False, initial=False, widget=forms.CheckboxInput(attrs={'class': 'form-check-input','role':'switch'}))
    senha_exige_caractere = forms.BooleanField(required=False, initial=False, widget=forms.CheckboxInput(attrs={'class': 'form-check-input','role':'switch'}))
    historico_senhas_nao_repetir = forms.IntegerField(required=False, initial=0, widget=forms.TextInput(attrs={'class': 'form-control form-control-sm','type':'number','min':'0','max':'10'}))
    quantidade_tentantivas_erradas = forms.IntegerField(required=False, initial=3, widget=forms.TextInput(attrs={'class': 'form-control','type':'number','min':'0','max':'10'}))