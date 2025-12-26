from django.db import models
from core.models import Empresa, Filial, ImageField as core_ImageField
from datetime import datetime, date
from django.contrib.auth.models import User
from django.utils.safestring import mark_safe
from core.extras import create_image
from auditlog.registry import auditlog

class Pessoa(models.Model):
    ESTADO_CIVIL_CHOICES = (
        ("S", mark_safe('<span data-i18n="common.single">Solteiro</span>')),
        ("C", mark_safe('<span data-i18n="common.married">Casado</span>')),
        ("D", mark_safe('<span data-i18n="common.divorced">Divorciado</span>')),
        ("V", mark_safe('<span data-i18n="common.widower">Viuvo</span>')),
    )
    SEXO_CHOICES = (
        ('N', mark_safe('<span data-i18n="compound.notInformed">Nao informado</span>')),
        ('M', mark_safe('<span data-i18n="common.male">Masculino</span>')),
        ('F', mark_safe('<span data-i18n="common.female">Feminino</span>')),
    )
    CNH_CATEGORIAS = (
        ("","----"),
        ("A","A"),
        ("B","B"),
        ("AB","AB"),
        ("C","C"),
        ("AC","AC"),
        ("D","D"),
        ("AD","AD"),
        ("E","E"),
        ("AE","AE"),
        ("ACC","ACC"),
    )
    nome = models.CharField(max_length=100, blank=False)
    apelido = models.CharField(max_length=20, blank=True)
    nome_social = models.CharField(max_length=100, blank=True)
    sexo = models.CharField(max_length=3,choices=SEXO_CHOICES, blank=True)
    data_nascimento = models.DateField(blank=True, null=True)
    rg = models.CharField(max_length=20, blank=True)
    rg_emissao = models.DateField(blank=True, null=True)
    rg_orgao_expedidor = models.CharField(max_length=15, blank=True)
    cpf = models.CharField(max_length=20,blank=True)
    titulo_eleitor = models.CharField(max_length=20, blank=True)
    titulo_zona = models.CharField(max_length=10, blank=True)
    titulo_secao = models.CharField(max_length=8, blank=True)
    reservista = models.CharField(max_length=20, blank=True)
    cnh = models.CharField(max_length=20, blank=True)
    cnh_categoria = models.CharField(max_length=4,choices=CNH_CATEGORIAS, blank=True)
    cnh_primeira_habilitacao = models.DateField(blank=True, null=True)
    cnh_emissao = models.DateField(blank=True, null=True)
    cnh_validade = models.DateField(blank=True, null=True)
    fone1 = models.CharField(max_length=20, blank=True)
    fone2 = models.CharField(max_length=20, blank=True)
    email = models.CharField(max_length=150, blank=True)
    endereco = models.CharField(max_length=255, blank=True)
    bairro = models.CharField(max_length=100, blank=True)
    cidade = models.CharField(max_length=60, blank=True)
    uf = models.CharField(max_length=5, blank=True)
    estado_civil = models.CharField(max_length=3,choices=ESTADO_CIVIL_CHOICES, blank=True)
    nome_mae = models.CharField(max_length=150, blank=True)
    nome_pai = models.CharField(max_length=150, blank=True)
    detalhe = models.TextField(blank=True)
    def cnh_eh_valida(self):
        if self.cnh_validade != None:
            if self.cnh_validade >= date.today():
                return True
            else:
                return False
        else:
            return True
    def idade(self):
        if self.data_nascimento:
            hoje = date.today()
            return hoje.year - self.data_nascimento.year - ((hoje.month, hoje.day) < (self.data_nascimento.month, self.data_nascimento.day))
        else:
            return ''
    class Meta:
        abstract = True

class Setor(models.Model):
    nome = models.CharField(max_length=50, unique=True, blank=False)
    def __str__(self):
        return self.nome
    def ativos(self):
        return Funcionario.objects.filter(cargo__setor=self, status='A').count()
auditlog.register(Setor)

class Cargo(models.Model):
    class FuncaoTipo(models.TextChoices):
        MOTORISTA = "M", mark_safe('<span data-i18n="personal.common.driver">Motorista</span>')
        AUXILIAR  = "A", mark_safe('<span data-i18n="personal.common.assistant">Auxiliar</span>')
        TRAFEGO   = "T", mark_safe('<span data-i18n="personal.common.traffic">Tráfego</span>')
        OFICINA   = "O", mark_safe('<span data-i18n="personal.common.mechanics">Oficina</span>')
    nome = models.CharField(max_length=50, unique=True, blank=False)
    setor = models.ForeignKey(Setor, on_delete=models.PROTECT)
    atividades = models.TextField(blank=True)
    funcoes_fixas = models.JSONField(default=list, blank=True)
    def __str__(self):
        return self.nome
    def ativos(self):
        return Funcionario.objects.filter(cargo=self, status='A').count()
    class Meta:
        ordering = ['nome']
auditlog.register(Cargo)

class Funcionario(Pessoa):
    STATUS_CHOICES = (
        ("A", mark_safe('<span data-i18n="common.active">Ativo</span>')),
        ("F", mark_safe('<span data-i18n="personal.common.onLeave">Afastado</span>')),
        ("D", mark_safe('<span data-i18n="personal.common.terminated">Desligado</span>')),
    )
    MOTIVOS_DESLIGAMENTO = (
        ("EM", mark_safe('<span data-i18n="personal.common.dismissed">Pelo Empregador</span>')),
        ("JC", mark_safe('<span data-i18n="personal.employee.form.forJustCause">Por Justa Causa</span>')),
        ("PD", mark_safe('<span data-i18n="personal.common.resign">Pedido de Desligamento</span>')),
        ("RI", mark_safe('<span data-i18n="personal.employee.form.indirectTermination">Rescisao Indireta</span>')),
        ("AB", mark_safe('<span data-i18n="personal.employee.form.abandonment">Abandono de Emprego</span>')),
        ("DJ", mark_safe('<span data-i18n="personal.employee.form.judicialTermination">Descisao Judicial</span>'))
    )
    REGIME_CHOICES = (
        ("CLT","CLT"),
        ("PJ", mark_safe('<span data-i18n="personal.employee.form.legalEntity">Pessoa Juridica</span>')),
        ("AP", mark_safe('<span data-i18n="personal.common.apprentice">Aprendiz</span>')),
    )
    filial = models.ForeignKey(Filial, blank=True, null=True, on_delete=models.RESTRICT)
    matricula = models.CharField(max_length=15, unique=True, blank=False)
    cargo = models.ForeignKey(Cargo, blank=True, null=True, on_delete=models.RESTRICT)
    regime = models.CharField(max_length=5, choices=REGIME_CHOICES, default='CLT', blank=True)
    data_admissao = models.DateField(blank=True, null=True, default=datetime.today)
    data_desligamento = models.DateField(blank=True, null=True)
    motivo_desligamento = models.CharField(max_length=3,choices=MOTIVOS_DESLIGAMENTO, blank=True)
    pne = models.BooleanField(default=False)
    foto = core_ImageField(upload_to='pessoal/fotos/', blank=True)
    usuario = models.OneToOneField(User, blank=True, null=True, on_delete=models.RESTRICT)
    status = models.CharField(max_length=3, choices=STATUS_CHOICES, default='A', blank=True)    
    def __str__(self):
        return self.matricula
    def process_and_save_photo(self, foto_data_url):
        if not foto_data_url:
            return
        folder_relative = "pessoal/fotos"
        folder_path = Path(settings.MEDIA_ROOT) / folder_relative
        folder_path.mkdir(parents=True, exist_ok=True)
        file_name = f"{self.empresa.id}_{self.matricula}_{int(datetime.now().timestamp())}.png"
        create_image(foto_data_url, str(folder_path), file_name)
        self.foto = f"{folder_relative}/{file_name}"
        self.save(update_fields=['foto'])
    def delete(self, *args, **kwargs):
        # ao excluir funcionario, caso ele tenha foto, apaga registro fisico
        if self.foto:
            self.foto.delete(save=False)
        super().delete(*args, **kwargs)
    def admissao_anos(self):
        if self.data_admissao != None:
            diferenca = date.today() - self.data_admissao
            tempo_servico = (diferenca.days + diferenca.seconds/86400)/365.2425
            return math.floor(tempo_servico)
        else:
            return ''
    def dependentes(self):
        return Dependente.objects.filter(funcionario=self).order_by('nome')
    def afastamentos(self):
        return Afastamento.objects.filter(funcionario=self).order_by('data_afastamento')
    def foto_url(self):
        return self.foto.url if self.foto else None
    def foto_name(self):
        return self.foto.name.split('/')[-1]
    @property
    def F_ehEditavel(self):
        return self.status != 'D'
    @property
    def F_pne(self):
        return self.pne
    @property
    def F_anosEmpresa(self):
        return 0
    @property
    def F_diasEmpresa(self):
        return 0
    def clean(self):
        if self.pk: # eh um update
            original = Funcionario.objects.get(pk=self.pk)
            if original.status == 'D' and self.status == 'D':
                raise ValidationError("Não é possível alterar dados de funcionários desligados.")
        super().clean()
    def save(self, *args, **kwargs):
        if self.pk and Funcionario.objects.get(pk=self.pk).status == 'D':
            raise PermissionError("Alteração bloqueada: Funcionário Desligado.")
        super().save(*args, **kwargs)
    class Meta:
        permissions = [
            ("associar_usuario", "Pode associar usuario a funcionário"),
            ("afastar_funcionario", "Pode afastar funcionário"),
            ("desligar_funcionario", "Pode desligar funcionário"),
            ("dashboard_funcionario", "Pode acessar dashboard pessoal"),
        ]
auditlog.register(Funcionario)

class Afastamento(models.Model):
    MOTIVO_AFASTAMENTO = (
        ("D", mark_safe('<span data-i18n="personal.common.illness">Doenca</span>')),
        ("A", mark_safe('<span data-i18n="personal.employee.form.workplaceAccident">Acidente Trabalho</span>')),
        ("O", mark_safe('<span data-i18n="common.other">Outro</span>'))
    )
    ORIGEM_CHOICES = (
        ("I", "INSS"),
        ("E", mark_safe('<span data-i18n="personal.common.schedule">Escala</span>')),
        ("S", mark_safe('<span data-i18n="personal.common.syndicate">Sindicato</span>')),
        ("G", mark_safe('<span data-i18n="common.regulator">Gestora</span>')),
        ("O", mark_safe('<span data-i18n="common.other">Outro</span>'))
    )
    funcionario = models.ForeignKey(Funcionario, on_delete=models.RESTRICT)
    motivo = models.CharField(max_length=3, choices=MOTIVO_AFASTAMENTO, default='D', blank=True)
    origem = models.CharField(max_length=3, choices=ORIGEM_CHOICES, default='I', blank=True)
    data_afastamento = models.DateField(blank=True, null=True, default=datetime.today)
    data_retorno = models.DateField(blank=True, null=True)
    reabilitado = models.BooleanField(default=False)
    remunerado = models.BooleanField(default=False)
    detalhe = models.TextField(blank=True)
auditlog.register(Afastamento)

class Dependente(models.Model):
    PARENTESCO = (
        ("C", mark_safe('<span data-i18n="personal.common.spouse">Conjuge</span>')),
        ("F", mark_safe('<span data-i18n="personal.employee.form.sonStepson">Filho / Enteado</span>')),
        ("I", mark_safe('<span data-i18n="personal.common.brother">Irmao</span>')),
        ("P", mark_safe('<span data-i18n="personal.employee.form.fatherMother">Pai / Mae</span>')),
        ("S", mark_safe('<span data-i18n="personal.common.fatherMotherInLaw">Sogro / Sogra</span>')),
        ("A", mark_safe('<span data-i18n="personal.common.ascendant">Ascendente</span>')),
        ("N", mark_safe('<span data-i18n="personal.common.descendant">Descendente</span>')),
        ("In", mark_safe('<span data-i18n="personal.common.incapable">Incapaz</span>')),
        ("M", mark_safe('<span data-i18n="common.other">Outro</span>')),
    )
    funcionario = models.ForeignKey(Funcionario, on_delete=models.RESTRICT)
    nome = models.CharField(max_length=230, blank=False)
    parentesco = models.CharField(max_length=3, choices=PARENTESCO, default='F', blank=True)
    sexo = models.CharField(max_length=3,choices=Funcionario.SEXO_CHOICES, blank=True)
    data_nascimento = models.DateField(blank=True, null=True)
    rg = models.CharField(max_length=20, blank=True)
    rg_emissao = models.DateField(blank=True, null=True)
    rg_orgao_expedidor = models.CharField(max_length=15, blank=True)
    cpf = models.CharField(max_length=20,blank=True)
    def idade(self):
        if self.data_nascimento:
            hoje = date.today()
            return hoje.year - self.data_nascimento.year - ((hoje.month, hoje.day) < (self.data_nascimento.month, self.data_nascimento.day))
        else:
            return ''
auditlog.register(Dependente)

class GrupoEvento(models.Model):
    nome = models.CharField(max_length=100, blank=False, unique=True)
    def __str__(self):
        return self.nome
auditlog.register(GrupoEvento)

class Evento(models.Model):
    TIPOS = (
        ("P", mark_safe('<span data-i18n="personal.common.profit">Provento</span>')),
        ("D", mark_safe('<span data-i18n="personal.common.deduction">Desconto</span>')),
        ("R", mark_safe('<span data-i18n="personal.common.reference">Referência</span>')),
    )
    nome = models.CharField(max_length=100, blank=False)
    rastreio = models.SlugField(unique=True)
    tipo = models.CharField(max_length=3, choices=TIPOS, default='P', blank=False)
    grupo = models.ForeignKey(GrupoEvento, on_delete=models.RESTRICT, null=True)
    def __str__(self):
        return self.nome
auditlog.register(Evento)

class MotivoReajuste(models.Model):
    nome = models.CharField(max_length=100, blank=False)
    def __str__(self):
        return self.nome
auditlog.register(MotivoReajuste)

class EventoMovimentacao(models.Model):
    TIPOS = (
        ("V", mark_safe('<span data-i18n="common.value">Valor</span>')),
        ("F", mark_safe('<span data-i18n="common.formula">Formula</span>')),
    )
    evento = models.ForeignKey(Evento, on_delete=models.RESTRICT)
    inicio = models.DateField(blank=False, null=False, default=datetime.today)
    fim = models.DateField(blank=True, null=True)
    tipo = models.CharField(max_length=3, choices=TIPOS, default='V', blank=False)
    valor = models.TextField(blank=True)
    motivo = models.ForeignKey(MotivoReajuste, on_delete=models.RESTRICT)
    class Meta:
        abstract = True
# Eventos podem ser inseridos para empresas / cargos / funcionarios
# mesmo evento em escopos diferentes sao aplicados seguindo ordem de prioridade:
# 1) Funcionario (mais especifico)
# 2) Cargo
# 3) Empresa (mais generico)
##########
# !! deve ser tratado duplicidade de evento no mesmo escopo no form
class EventoEmpresa(EventoMovimentacao):
    filiais = models.ManyToManyField(Filial, related_name="eventos_filial")
auditlog.register(EventoEmpresa, m2m_fields={"filiais"})

class EventoCargo(EventoMovimentacao):
    cargo = models.ForeignKey(Cargo, on_delete=models.RESTRICT)
    filiais = models.ManyToManyField(Empresa, related_name="eventos_cargo")
auditlog.register(EventoCargo, m2m_fields={"filiais"})

class EventoFuncionario(EventoMovimentacao):
    funcionario = models.ForeignKey(Funcionario, on_delete=models.RESTRICT)
auditlog.register(EventoFuncionario)
