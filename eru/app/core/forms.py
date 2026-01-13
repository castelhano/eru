import re
from itertools import groupby
from django import forms
from django.forms import Field
from django.forms.models import ModelChoiceIterator, ModelMultipleChoiceField
from .models import Empresa, Filial, Settings, Profile
from .mixins import BootstrapI18nMixin
from django.contrib.auth.forms import PasswordChangeForm
from django.core.exceptions import ValidationError
from django.contrib.auth.hashers import check_password
from django.contrib.auth.models import User, Group, Permission
from django.utils.translation import gettext_lazy as _
from itertools import groupby
from functools import lru_cache
from django.utils.safestring import mark_safe

Field.default_error_messages['required'] = _('<span data-i18n="sys.fieldRequired">Campo obrigatório</span>')
Field.default_error_messages['unique'] = _('<span data-i18n="sys.fieldUnique">Campo duplicado, precisa ser unico</span>')



class EmpresaForm(forms.ModelForm):
    class Meta:
        model = Empresa
        fields = ['nome','razao_social','cnpj_base']
    nome = forms.CharField(max_length=20, widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' ','autofocus':'autofocus'}))
    razao_social = forms.CharField(required=False, max_length=80,widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    cnpj_base = forms.CharField(required=False, max_length=15 ,widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))



class FilialForm(BootstrapI18nMixin, forms.ModelForm):
    # i18n_maps = {
    #     # 'sexo': Funcionario.Sexo,
    #     # 'regime': Funcionario.Regime,
    #     # 'status': Funcionario.Status,
    #     # 'estado_civil': Funcionario.EstadoCivil,
    #     # 'motivo_desligamento': Funcionario.MotivoDesligamento,
    # }
    class Meta:
        model = Filial
        fields = '__all__'
        widgets = {
            'nome': forms.TextInput(attrs={'autofocus': True}),
        }
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['nome'].widget.attrs['maxlength'] = 35
        self.setup_bootstrap_and_i18n() # aplica classes de estilo, e atribui data-i18n aos campos        




@lru_cache(maxsize=1)
def get_grouped_permissions():
    perms = Permission.objects.exclude(content_type__app_label__in=['admin', 'contenttypes', 'sessions']).select_related('content_type').order_by('content_type__app_label', 'content_type__model')
    return [(app.capitalize(), [(p.id, f"{p.content_type.model}: {p.name}") for p in g]) 
            for app, g in groupby(perms, lambda p: p.content_type.app_label)]

def get_grouped_filiais():
    filiais = Filial.objects.select_related('empresa').order_by('empresa__nome', 'nome')
    return [(emp, [(f.id, str(f)) for f in g]) for emp, g in groupby(filiais, lambda f: f.empresa.nome)]


class UserForm(forms.ModelForm):
    password = forms.CharField(required=False, widget=forms.PasswordInput())
    filiais = forms.ModelMultipleChoiceField(queryset=Filial.objects.all(), required=False)
    force_password_change = forms.BooleanField(required=False, initial=True, widget=forms.CheckboxInput(attrs={'role': 'switch'}))
    class Meta:
        model = User
        fields = ['username', 'first_name', 'last_name', 'email', 'is_superuser', 'is_staff', 'is_active', 'groups', 'user_permissions']
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['user_permissions'].choices = get_grouped_permissions()
        self.fields['filiais'].choices = get_grouped_filiais()
        # usa o profile ja carregado pelo select_related da View
        if (user := self.instance) and user.pk:
            profile = user.profile
            self.fields['filiais'].initial = profile.filiais.all()
            self.fields['force_password_change'].initial = profile.force_password_change
        for name, field in self.fields.items():
            is_check = isinstance(field.widget, (forms.CheckboxInput, forms.RadioSelect))
            field.widget.attrs.update({
                'class': 'form-check-input' if is_check else 'form-control',
                'placeholder': ' '
            })
            self.fields['username'].widget.attrs.update({'autofocus': True})
    def save(self, commit=True):
        user = super().save(commit=False)
        if password := self.cleaned_data.get("password"):
            user.set_password(password)
        if commit:
            user.save()
            self.save_m2m()
            # atualiza o profile de forma direta
            profile = user.profile
            profile.force_password_change = self.cleaned_data['force_password_change']
            profile.filiais.set(self.cleaned_data['filiais'])
            profile.save()
        return user


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

class CustomPasswordChangeForm(PasswordChangeForm):
    def save(self, commit=True):
        user = super().save(commit=False)
        password = self.cleaned_data.get("new_password1")
        profile = getattr(user, 'profile', None)
        
        if commit and profile:
            try:
                settings = Settings.objects.get()
                limit = settings.historico_senhas_nao_repetir
            except Settings.DoesNotExist:
                limit = 0
            if limit > 0:
                config = profile.config if profile.config else {}
                history = config.get("history_password", [])
                history.insert(0, make_password(password))
                config["history_password"] = history[:limit]
                profile.config = config
            profile.force_password_change = False
            profile.save()
        if commit:
            user.save()
        return user
    
    def clean_new_password1(self):
        password = self.cleaned_data.get("new_password1")
        user = self.user
        try:
            settings = Settings.objects.get()
        except Settings.DoesNotExist:
            settings = Settings()
        if len(password) < settings.quantidade_caracteres_senha:
            raise ValidationError(f"A senha deve ter pelo menos {settings.quantidade_caracteres_senha} caracteres.")
        if settings.senha_exige_numero and not re.search(r'[0-9]', password):
            raise ValidationError("A senha deve conter pelo menos um número.")
        if settings.senha_exige_maiuscula:
            if not re.search(r'[a-z]', password) or not re.search(r'[A-Z]', password):
                raise ValidationError("A senha deve conter letras maiúsculas e minúsculas.")
        elif settings.senha_exige_alpha and not re.search(r'[a-zA-Z]', password):
            raise ValidationError("A senha deve conter pelo menos uma letra.")
        if settings.senha_exige_caractere:
            if not re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?]", password):
                raise ValidationError("A senha deve conter pelo menos um caractere especial.")
        if settings.historico_senhas_nao_repetir > 0:
            profile = user.profile
            config = profile.config if profile.config else {}
            history = config.get("history_password", [])
            for old_password_hash in history:
                if check_password(password, old_password_hash):
                    raise ValidationError("Você já usou esta senha anteriormente. Por favor, escolha uma senha nova.")
        return password