import os
import zoneinfo
from django.utils.translation import gettext_lazy as _
from django.db import models
from django.db.models import Prefetch
from django.contrib.auth.models import User, Group
from datetime import datetime
from django.db.models.signals import post_save
from django.dispatch import receiver
from functools import cached_property
from auditlog.registry import auditlog

# EXTENDED **********************************************
class FileField(models.FileField):
    class Meta:
        abstract = True
    def save_form_data(self, instance, data):
        if data is not None: 
            file = getattr(instance, self.attname)
            if file != data:
                file.delete(save=False)
        super(FileField, self).save_form_data(instance, data)

def get_timezone_choices():
    # retorna lista de tuplas (valor, rotulo) ordenada
    # return [(tz, tz) for tz in sorted(zoneinfo.available_timezones())]
    tzs = [
        (tz, tz.replace('_', ' ')) 
        for tz in sorted(zoneinfo.available_timezones()) 
        if '/' in tz and not tz.startswith('Etc/')
    ]
    return tzs

# **********************************************
class Empresa(models.Model):
    nome = models.CharField(_('Nome'), max_length=50, unique=True, blank=False)
    razao_social = models.CharField(_('Razão Social'), max_length=150, blank=True)
    cnpj_base = models.CharField(_('Cnpj Base'), max_length=20, blank=True)
    class Meta:
        verbose_name = _('Empresa')
    def __str__(self):
        return self.nome
auditlog.register(Empresa)

class Filial(models.Model):
    empresa = models.ForeignKey(Empresa, on_delete=models.PROTECT, related_name='filiais', verbose_name=_('Empresa'))
    nome = models.CharField(_('Nome'), max_length=50, unique=True, blank=False)
    nome_fantasia = models.CharField(_('Nome Fantasia'), max_length=150, blank=True)
    cnpj = models.CharField(_('Cnpj'), max_length=20, blank=True)
    inscricao_estadual = models.CharField(_('Inscrição Estadual'), max_length=25, blank=True)
    inscricao_municipal = models.CharField(_('Inscrição Municipal'), max_length=25, blank=True)
    cnae = models.CharField(_('Cnae'), max_length=20, blank=True)
    atividade = models.CharField(_('Atividade'), max_length=255, blank=True)
    endereco = models.CharField(_('Endereço'), max_length=255, blank=True)
    bairro = models.CharField(_('Bairro'), max_length=100, blank=True)
    cidade = models.CharField(_('Cidade'), max_length=60, blank=True)
    uf = models.CharField(_('Uf'), max_length=5, blank=True)
    cep = models.CharField(_('Cep'), max_length=10, blank=True)
    fone = models.CharField(_('Fone'), max_length=20, blank=True)
    fax = models.CharField(_('Fax'), max_length=20, blank=True)
    fuso_horario = models.CharField(_('Fuso Horário'), blank=True, max_length=50, choices=get_timezone_choices)
    logo = models.ImageField(_('Logo'), upload_to="core/logos/", blank=True)
    footer = models.TextField(_('Rodapé'), blank=True)
    def __str__(self):
        return self.nome
    def logo_filename(self):
        return os.path.basename(self.logo.name)
auditlog.register(Filial)


class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, verbose_name=_('Usuário'))
    filiais = models.ManyToManyField(Filial, blank=True, verbose_name=_('Filiais'))
    force_password_change = models.BooleanField(_('Forçar troca de senha'), default=True)
    config = models.JSONField(_('Configurações'), default=dict, blank=True, null=True)
    def __str__(self):
        return self.user.username
    def allow_filial(self, id): # Verifica se filial esta habilitada para usuario
        return self.filiais.filter(pk=id).exists()
    @cached_property
    def empresas(self):
        filiais_qs = self.filiais.all()
        return Empresa.objects.filter(filiais__in=filiais_qs).prefetch_related(
            Prefetch(
                'filiais', 
                queryset=filiais_qs.order_by('nome'),
                to_attr='filiais_permitidas'
                )).distinct().order_by('pk')
    class Meta:
        permissions = [
            ("debug", "Can debug system"),
            ("docs", "Can access system docs"),
        ]
        default_permissions = []
auditlog.register(User, exclude_fields=['last_login'])
auditlog.register(Profile, m2m_fields={"filiais"}, exclude_fields=['config'])

class Settings(models.Model):
    quantidade_caracteres_senha = models.PositiveIntegerField(default=8)
    senha_exige_alpha = models.BooleanField(default=True)
    senha_exige_numero = models.BooleanField(default=True)
    senha_exige_maiuscula = models.BooleanField(default=False)
    senha_exige_caractere = models.BooleanField(default=False)
    historico_senhas_nao_repetir = models.PositiveIntegerField(default=0)
    quantidade_tentantivas_erradas = models.PositiveIntegerField(default=3)
    def __str__(self):
        return 'Singleton'
    def save(self, *args, **kwargs):
        # forca edicao / adicao sempre do ID 1 (impedindo duplicidade de registro)
        self.pk = 1
        super().save(*args, **kwargs)
    class Meta:
        default_permissions = ('view','change',)
auditlog.register(Settings)


@receiver(post_save, sender=User)
def manage_user_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(user=instance)