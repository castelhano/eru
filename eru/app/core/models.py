import os
from django.db import models
from django.contrib.auth.models import User, Group
from datetime import datetime
from django.db.models.signals import post_save
from django.dispatch import receiver
from auditlog.registry import auditlog

# EXTENDED **********************************************
class ImageField(models.ImageField):
    class Meta:
        abstract = True
    def save_form_data(self, instance, data):
        if data is not None: 
            file = getattr(instance, self.attname)
            if file != data:
                file.delete(save=False)
        super(ImageField, self).save_form_data(instance, data)

class FileField(models.FileField):
    class Meta:
        abstract = True
    def save_form_data(self, instance, data):
        if data is not None: 
            file = getattr(instance, self.attname)
            if file != data:
                file.delete(save=False)
        super(FileField, self).save_form_data(instance, data)

# **********************************************
class Empresa(models.Model):
    nome = models.CharField(max_length=50, unique=True, blank=False)
    razao_social = models.CharField(max_length=150, blank=True)
    cnpj_base = models.CharField(max_length=20, blank=True)
    def __str__(self):
        return self.nome
auditlog.register(Empresa)

class Filial(models.Model):
    empresa = models.ForeignKey(Empresa, on_delete=models.PROTECT)
    nome = models.CharField(max_length=50, unique=True, blank=False)
    cnpj = models.CharField(max_length=20, blank=True)
    inscricao_estadual = models.CharField(max_length=25, blank=True)
    inscricao_municipal = models.CharField(max_length=25, blank=True)
    cnae = models.CharField(max_length=20, blank=True)
    atividade = models.CharField(max_length=255, blank=True)
    endereco = models.CharField(max_length=255, blank=True)
    bairro = models.CharField(max_length=100, blank=True)
    cidade = models.CharField(max_length=60, blank=True)
    uf = models.CharField(max_length=5, blank=True)
    cep = models.CharField(max_length=10, blank=True)
    fone = models.CharField(max_length=20, blank=True)
    fax = models.CharField(max_length=20, blank=True)
    logo = ImageField(upload_to="core/logos/", blank=True)
    footer = models.TextField(blank=True)
    def __str__(self):
        return self.nome
    def logo_filename(self):
        return os.path.basename(self.logo.name)
auditlog.register(Filial)


class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    filiais = models.ManyToManyField(Filial)
    force_password_change = models.BooleanField(default=True)
    config = models.JSONField(default=dict, blank=True, null=True)
    def __str__(self):
        return self.user.username
    def allow_filial(self, id): # Verifica se filial esta habilitada para usuario
        return self.filiais.filter(pk=id).exists()
    class Meta:
        permissions = [
            ("debug", "Can debug system"),
            ("docs", "Can access system docs"),
        ]
        default_permissions = []
auditlog.register(User, exclude_fields=['last_login'])
auditlog.register(Profile, m2m_fields={"empresas"}, exclude_fields=['config'])

class Settings(models.Model):
    quantidade_caracteres_senha = models.PositiveIntegerField(default=8)
    senha_exige_alpha = models.BooleanField(default=True)
    senha_exige_numero = models.BooleanField(default=True)
    senha_exige_maiuscula = models.BooleanField(default=False)
    senha_exige_caractere = models.BooleanField(default=False)
    historico_senhas_nao_repetir = models.PositiveIntegerField(default=0)
    quantidade_tentantivas_erradas = models.PositiveIntegerField(default=3)
    class Meta:
        default_permissions = ('view','change',)
auditlog.register(Settings)

@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(user=instance)

# @receiver(post_save, sender=User)
# def save_user_profile(sender, instance, **kwargs):
#     instance.profile.save()