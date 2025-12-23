import re
from itertools import groupby
from django import forms
from django.forms import Field
from django.forms.models import ModelChoiceIterator, ModelMultipleChoiceField
from .models import Empresa, Filial, Settings, Profile
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

class FilialForm(forms.ModelForm):
    class Meta:
        model = Filial
        fields = ['empresa','nome','nome_fantasia','cnpj','inscricao_estadual','inscricao_municipal','cnae','atividade','endereco','bairro','cidade','uf','cep','fone','fax','logo','footer']
    nome = forms.CharField(max_length=35, widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' ','autofocus':'autofocus'}))
    nome_fantasia = forms.CharField(required=False, max_length=80,widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    cnpj = forms.CharField(required=False, max_length=18 ,widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
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



@lru_cache(maxsize=1)
def get_grouped_permissions():
    perms = Permission.objects.exclude(content_type__app_label__in=['admin', 'contenttypes', 'sessions']).select_related('content_type').order_by('content_type__app_label', 'content_type__model')
    return [(app.capitalize(), [(p.id, f"{p.content_type.model}: {p.name}") for p in g]) 
            for app, g in groupby(perms, lambda p: p.content_type.app_label)]

def get_grouped_filiais():
    filiais = Filial.objects.select_related('empresa').order_by('empresa__nome', 'nome')
    return [(emp, [(f.id, str(f)) for f in g]) for emp, g in groupby(filiais, lambda f: f.empresa.nome)]

class UserForm(forms.ModelForm):
    password = forms.CharField(required=False, widget=forms.PasswordInput(attrs={'class': 'form-control'}))
    filiais = forms.ModelMultipleChoiceField(queryset=Filial.objects.all(), required=False)
    force_password_change = forms.BooleanField(required=False, widget=forms.CheckboxInput(attrs={'class': 'form-check-input', 'role': 'switch'}))
    class Meta:
        model = User
        fields = ['username', 'first_name', 'last_name', 'email', 'is_superuser', 'is_staff', 'is_active', 'groups', 'user_permissions']
        widgets = {
            'username': forms.TextInput(attrs={'class': 'form-control fw-bold', 'autofocus': True}),
            'is_superuser': forms.CheckboxInput(attrs={'class': 'form-check-input', 'role': 'switch'}),
            'is_staff': forms.CheckboxInput(attrs={'class': 'form-check-input', 'role': 'switch'}),
            'is_active': forms.CheckboxInput(attrs={'class': 'form-check-input', 'role': 'switch'}),
        }
    def __init__(self, *args, **kwargs):
        instance = kwargs.get('instance')
        super().__init__(*args, **kwargs)
        # Injeção de choices agrupadas dinamicamente
        self.fields['user_permissions'].choices = get_grouped_permissions()
        self.fields['filiais'].choices = get_grouped_filiais()
        
        if instance and instance.pk:
            profile, _ = Profile.objects.get_or_create(user=instance)
            self.fields['filiais'].initial = profile.filiais.all()
            self.fields['force_password_change'].initial = profile.force_password_change

        # Aplica form-control em massa para campos de texto/select
        for name, field in self.fields.items():
            if not isinstance(field.widget, (forms.CheckboxInput, forms.RadioSelect)):
                field.widget.attrs.setdefault('class', 'form-control')
                field.widget.attrs.update({'placeholder': ' '})

    def save(self, commit=True):
        user = super().save(commit=False)
        if self.cleaned_data.get("password"):
            user.set_password(self.cleaned_data["password"])
        if commit:
            user.save()
            self.save_m2m()
            profile, _ = Profile.objects.get_or_create(user=user)
            profile.force_password_change = self.cleaned_data['force_password_change']
            profile.save()
            profile.filiais.set(self.cleaned_data['filiais'])
        return user











# class UserForm(forms.ModelForm):
#     filiais = GroupedModelMultipleChoiceField(
#         queryset=Filial.objects.all(),
#         required=False,
#         widget=forms.SelectMultiple(attrs={'class': 'form-control select2'})
#     )
    
#     password = forms.CharField(
#         required=False,
#         widget=forms.PasswordInput(attrs={'class': 'form-control', 'placeholder': 'Deixe em branco para não alterar'})
#     )
#     force_password_change = forms.BooleanField(
#         required=False, 
#         label="Forçar troca de senha",
#         widget=forms.CheckboxInput(attrs={'class': 'form-check-input', 'role': 'switch'})
#     )

#     class Meta:
#         model = User
#         fields = ['username', 'first_name', 'last_name', 'email', 'is_superuser', 'is_staff', 'is_active', 'groups', 'user_permissions']
    # username = forms.CharField(widget=forms.TextInput(attrs={'class': 'form-control fw-bold','placeholder':' ','autofocus':'autofocus'}))
    # first_name = forms.CharField(required=False, widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    # last_name = forms.CharField(required=False, widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    # email = forms.CharField(required=False, widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' ','type':'email'}))
    # is_superuser = forms.BooleanField(required=False, initial=False, widget=forms.CheckboxInput(attrs={'class': 'form-check-input','role':'switch'}))
    # is_staff = forms.BooleanField(required=False, initial=False, widget=forms.CheckboxInput(attrs={'class': 'form-check-input','role':'switch'}))
    # is_active = forms.BooleanField(required=False, initial=True, widget=forms.CheckboxInput(attrs={'class': 'form-check-input','role':'switch'}))
    # groups = forms.ModelMultipleChoiceField(queryset=Group.objects.all(), required=False)
    # user_permissions = forms.ModelMultipleChoiceField(queryset=Permission.objects.all(), required=False)

#     def __init__(self, *args, **kwargs):
#         super().__init__(*args, **kwargs)
        
#         # 1. Carrega as permissões agrupadas do cache
#         self.fields['user_permissions'].choices = get_grouped_permissions()
        
#         # 2. Se estiver editando, preenche as filiais do Profile
#         profile_instance = None
#         if self.instance and self.instance.pk:
#             profile_instance, _ = Profile.objects.get_or_create(user=self.instance)
#             self.fields['filiais'].initial = profile_instance.filiais.all()
#         self.profile_form = ProfileForm(*args, **kwargs, instance=profile_instance, prefix='profile')
#         self.fields.update(self.profile_form.fields)
#     def is_valid(self):
#         # O UserForm só é válido se o ProfileForm também for
#         user_form_valid = super().is_valid()
#         # Precisamos popular os dados do profile_form antes de validar
#         self.profile_form.data = self.data
#         self.profile_form.is_bound = self.is_bound
#         return user_form_valid and self.profile_form.is_valid()    
#     def save(self, commit=True):
#         # Salva o User (sem commit primeiro para tratar a senha)
#         user = super().save(commit=False)
        
#         password = self.cleaned_data.get("password")
#         if password:
#             user.set_password(password)
        
#         if commit:
#             user.save()
#             # Salva Groups e Permissions (M2M nativo do User)
#             self.save_m2m()
            
#             # Salva o Profile e as Filiais (M2M customizado)
#             profile = self.profile_form.save(commit=False)
#             profile.user = user # Garante o vínculo 1to1
#             profile.save()
#             profile.filiais.set(self.cleaned_data['filiais'])
#             # profile, _ = Profile.objects.get_or_create(user=user)
#             # profile.filiais.set(self.cleaned_data['filiais'])
#             # profile.save()
            
#         return user


# class UserForm(forms.ModelForm):
#     # Campo Filiais com iterador performático
#     filiais = GroupedModelMultipleChoiceField(
#         queryset=Filial.objects.all(),
#         required=False,
#         widget=forms.SelectMultiple(attrs={'class': 'form-control select2'})
#     )

#     password = forms.CharField(
#         required=False,
#         widget=forms.PasswordInput(attrs={'class': 'form-control', 'placeholder': 'Senha'})
#     )

#     class Meta:
#         model = User
#         fields = ['username', 'first_name', 'last_name', 'email', 
#                   'is_superuser', 'is_staff', 'is_active', 'groups', 'user_permissions']

#     def __init__(self, *args, **kwargs):
#         super().__init__(*args, **kwargs)
        
#         # 1. Aplica o agrupamento de permissões vindo do Cache
#         self.fields['user_permissions'].choices = get_permission_choices()
        
#         # 2. Configura o estado inicial das filiais se estiver editando (Update)
#         if self.instance and self.instance.pk:
#             try:
#                 # Busca as filiais do profile para preencher o form
#                 self.fields['filiais'].initial = self.instance.profile.filiais.values_list('id', flat=True)
#             except Profile.DoesNotExist:
#                 pass

#         # 3. Estilização em massa
#         for name, field in self.fields.items():
#             if not isinstance(field.widget, forms.CheckboxInput):
#                 field.widget.attrs.update({'class': 'form-control'})

#     def save(self, commit=True):
#         # O commit=False é essencial para tratarmos a senha e o profile
#         user = super().save(commit=False)
        
#         password = self.cleaned_data.get("password")
#         if password:
#             user.set_password(password)
        
#         if commit:
#             user.save()
#             # Salva campos M2M nativos (groups e permissions)
#             self.save_m2m()
            
#             # Salva a extensão Profile e as Filiais
#             profile, _ = Profile.objects.get_or_create(user=user)
#             profile.filiais.set(self.cleaned_data['filiais'])
#             profile.save()
            
#         return user












# class UserForm(forms.ModelForm):
#     filiais = GroupedModelMultipleChoiceField( queryset=Filial.objects.all(), required=False)
#     password = forms.CharField(required=False)
#     class Meta:
#         model = User
#         fields = ['username','first_name','last_name','email','is_superuser','is_staff','is_active', 'groups', 'user_permissions']
    # username = forms.CharField(widget=forms.TextInput(attrs={'class': 'form-control fw-bold','placeholder':' ','autofocus':'autofocus'}))
    # first_name = forms.CharField(required=False, widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    # last_name = forms.CharField(required=False, widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    # email = forms.CharField(required=False, widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' ','type':'email'}))
    # is_superuser = forms.BooleanField(required=False, initial=False, widget=forms.CheckboxInput(attrs={'class': 'form-check-input','role':'switch'}))
    # is_staff = forms.BooleanField(required=False, initial=False, widget=forms.CheckboxInput(attrs={'class': 'form-check-input','role':'switch'}))
    # is_active = forms.BooleanField(required=False, initial=True, widget=forms.CheckboxInput(attrs={'class': 'form-check-input','role':'switch'}))
    # # groups = forms.ModelMultipleChoiceField(queryset=Group.objects.all(), required=False)
    # # user_permissions = forms.ModelMultipleChoiceField(queryset=Permission.objects.all(), required=False)
#     def __init__(self, *args, **kwargs):
#         super(UserForm, self).__init__(*args, **kwargs)
#         if self.instance and self.instance.pk:
#             try:
#                 self.fields['filiais'].initial = self.instance.profile.filiais.all()
#             except Profile.DoesNotExist:
#                 pass
#         self.fields['user_permissions'].choices = get_grouped_permissions()
#         novo_agrupamento = []
#         empresas = Empresa.objects.all().prefetch_related('filiais')
#         for empresa in empresas:
#             filiais_da_empresa = [
#                 (filial.id, str(filial)) 
#                 for filial in empresa.filiais.all()
#             ]
#             if filiais_da_empresa:
#                 novo_agrupamento.append((empresa.nome, filiais_da_empresa))
#         self.fields['filiais'].choices = novo_agrupamento
#     def save(self, commit=True):
#         user = super().save(commit=False)
#         password = self.cleaned_data.get("password")
#         if password:
#             user.set_password(password)
#         if commit:
#             user.save()
#             self.save_m2m()
#             profile, _ = Profile.objects.get_or_create(user=user)
#             profile.filiais.set(self.cleaned_data['filiais'])
#             profile.save()
#         return user






# class UserForm(forms.ModelForm):
#     password = forms.CharField(required=False)
#     filiais = forms.ModelMultipleChoiceField(queryset=Filial.objects.none())
#     class Meta:
#         model = User
#         fields = ['username','first_name','last_name','email','is_superuser','is_staff','is_active', 'groups', 'user_permissions']
    # username = forms.CharField(widget=forms.TextInput(attrs={'class': 'form-control fw-bold','placeholder':' ','autofocus':'autofocus'}))
    # first_name = forms.CharField(required=False, widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    # last_name = forms.CharField(required=False, widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    # email = forms.CharField(required=False, widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' ','type':'email'}))
    # is_superuser = forms.BooleanField(required=False, initial=False, widget=forms.CheckboxInput(attrs={'class': 'form-check-input','role':'switch'}))
    # is_staff = forms.BooleanField(required=False, initial=False, widget=forms.CheckboxInput(attrs={'class': 'form-check-input','role':'switch'}))
    # is_active = forms.BooleanField(required=False, initial=True, widget=forms.CheckboxInput(attrs={'class': 'form-check-input','role':'switch'}))
    # groups = forms.ModelMultipleChoiceField(queryset=Group.objects.all(), required=False)
    # user_permissions = forms.ModelMultipleChoiceField(queryset=Permission.objects.all(), required=False)
    # def __init__(self, *args, **kwargs):
    #     super().__init__(*args, **kwargs)
    #     self.fields['user_permissions'].choices = get_grouped_permissions()
    #     novo_agrupamento = []
    #     empresas = Empresa.objects.all().prefetch_related('filiais')
    #     for empresa in empresas:
    #         filiais_da_empresa = [
    #             (filial.id, str(filial)) 
    #             for filial in empresa.filiais.all()
    #         ]
    #         if filiais_da_empresa:
    #             novo_agrupamento.append((empresa.nome, filiais_da_empresa))
    #     self.fields['filiais'].choices = novo_agrupamento

    

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