import os
import zoneinfo
from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models
from django.db.models import Prefetch
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils.translation import gettext_lazy as _
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
        default_permissions = []
auditlog.register(User, exclude_fields=['last_login'])
auditlog.register(Profile, m2m_fields={"filiais"}, exclude_fields=['force_password_change','config'])

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



class Job(models.Model):
    """
    Job — registro de execução de processos assíncronos.

    Funciona como painel de controle do qcluster: rastreia status, progresso
    e resultado de qualquer processo em background, independente do app que o disparou.

    Cada app define livremente o schema de 'params' (entrada) e 'resultado' (saída).
    """
    class Status(models.TextChoices):
        AGUARDANDO  = 'AG', _('Aguardando')
        PROCESSANDO = 'PR', _('Processando')
        CONCLUIDO   = 'OK', _('Concluído')
        ERRO        = 'ER', _('Erro')
    app          = models.CharField(max_length=50)   # 'pessoal', 'financeiro', etc
    tipo         = models.CharField(max_length=50)   # 'folha', 'rescisao', 'ferias', etc
    criado_por   = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='jobs')
    criado_em    = models.DateTimeField(auto_now_add=True)
    iniciado_em  = models.DateTimeField(null=True, blank=True)
    concluido_em = models.DateTimeField(null=True, blank=True)
    status       = models.CharField(max_length=2, choices=Status.choices, default=Status.AGUARDANDO, db_index=True)
    progresso = models.PositiveSmallIntegerField(default=0)
    # ── payload livre | cada processo define suas proprias metricas ─────────────────────────────────────────────
    params      = models.JSONField(default=dict, blank=True)   # parametros de entrada
    resultado   = models.JSONField(default=dict, blank=True)   # resultado estruturado
    erros       = models.JSONField(default=list, blank=True)   # lista de erros individuais
    observacoes = models.JSONField(default=list, blank=True)   # avisos nao fatais
    historico   = models.JSONField(default=list, blank=True)   # snapshots de execucoes anteriores
    class Meta:
        app_label = 'core'
        ordering  = ['-criado_em']
        indexes   = [
            models.Index(fields=['app', 'tipo']),
            models.Index(fields=['status']),
            models.Index(fields=['criado_em']),
        ]
    def __str__(self):
        return f'{self.app}.{self.tipo} [{self.get_status_display()}] — {self.criado_em:%d/%m/%Y %H:%M}'
    @property
    def duracao(self):
        """Duração da execução em segundos. None se ainda não concluído."""
        if self.iniciado_em and self.concluido_em:
            return (self.concluido_em - self.iniciado_em).total_seconds()
        return None
    @property
    def tem_erros(self) -> bool:
        return bool(self.erros)


class JobArquivo(models.Model):
    """
    Armazena arquivos gerados por jobs assíncronos
    Cada registro representa um arquivo de retorno
    """
    class TipoConteudo(models.TextChoices):
        PDF  = 'PDF', _('PDF')
        CSV  = 'CSV', _('CSV')
        XLSX = 'XLSX', _('Excel')
        ZIP  = 'ZIP', _('ZIP')
    # relação generica — aponta para qualquer model de qualquer app
    content_type   = models.ForeignKey(ContentType, on_delete=models.CASCADE, null=True, blank=True)
    object_id      = models.PositiveIntegerField(null=True, blank=True)
    origem         = GenericForeignKey('content_type', 'object_id')
    arquivo        = models.FileField(upload_to='jobs/%Y/%m/')
    nome           = models.CharField(max_length=255)
    tipo           = models.CharField(max_length=4, choices=TipoConteudo.choices, default=TipoConteudo.PDF)
    tamanho        = models.PositiveIntegerField(default=0)
    objeto_id_ref  = models.CharField(max_length=100, blank=True)  # referência livre ao objeto gerado (alias)
    criado_em      = models.DateTimeField(auto_now_add=True)
    expira_em      = models.DateTimeField(null=True, blank=True)
    baixado_em     = models.DateTimeField(null=True, blank=True)
    impresso_em    = models.DateTimeField(null=True, blank=True)
    class Meta:
        app_label = 'core'
        ordering  = ['nome']
        indexes   = [
            models.Index(fields=['content_type', 'object_id']),
            models.Index(fields=['expira_em']),
        ]
    @property
    def expirado(self) -> bool:
        if not self.expira_em:
            return False
        from django.utils import timezone
        return timezone.now() > self.expira_em
    @property
    def tamanho_legivel(self) -> str:
        if self.tamanho < 1024:
            return f"{self.tamanho} B"
        if self.tamanho < 1024 ** 2:
            return f"{self.tamanho / 1024:.1f} KB"
        return f"{self.tamanho / 1024 ** 2:.1f} MB"