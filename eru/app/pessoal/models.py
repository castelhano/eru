from django.db import models
from pathlib import Path
from django.conf import settings
from core.models import Empresa, Filial, ImageField as core_ImageField
from datetime import datetime, date
from django.contrib.auth.models import User
from django.utils.safestring import mark_safe
from core.extras import create_image
from auditlog.registry import auditlog

class Pessoa(models.Model):
    class EstadoCivil(models.TextChoices):
        SOLTEIRO   = "S", "Solteiro"
        CASADO     = "C", "Casado"
        DIVORCIADO = "D", "Divorciado"
        VIUVO      = "V", "Viuvo"
        @classmethod
        def i18n_map(cls):
            return {
                cls.SOLTEIRO:   "common.single",
                cls.CASADO:     "common.married",
                cls.DIVORCIADO: "common.divorced",
                cls.VIUVO:      "common.widower",
            }
    class Sexo(models.TextChoices):
        NAO_INFORMADO = 'N', "Nao informado"
        MASCULINO     = 'M', "Masculino"
        FEMININO      = 'F', "Feminino"
        @classmethod
        def i18n_map(cls):
            return {
                cls.NAO_INFORMADO: "compound.notInformed",
                cls.MASCULINO:     "common.male",
                cls.FEMININO:      "common.female",
            }
    class CnhCategoria(models.TextChoices):
        NONE = "", "----" 
        A    = "A", "A"
        B    = "B", "B"
        AB   = "AB", "AB"
        C    = "C", "C"
        AC   = "AC", "AC"
        D    = "D", "D"
        AD   = "AD", "AD"
        E    = "E", "E"
        AE   = "AE", "AE"
        ACC  = "ACC", "ACC"
    nome = models.CharField(max_length=100, blank=False)
    apelido = models.CharField(max_length=20, blank=True)
    nome_social = models.CharField(max_length=100, blank=True)
    sexo = models.CharField(max_length=3,choices=Sexo.choices, blank=True)
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
    cnh_categoria = models.CharField(max_length=4,choices=CnhCategoria.choices, blank=True)
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
    estado_civil = models.CharField(max_length=3,choices=EstadoCivil.choices, blank=True)
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
        MOTORISTA = "M", "Motorista"
        AUXILIAR  = "A", "Auxiliar"
        TRAFEGO   = "T", "Tráfego"
        OFICINA   = "O", "Oficina"
        @classmethod
        def i18n_map(cls):
            return {
                cls.MOTORISTA: "personal.common.driver",
                cls.AUXILIAR:  "personal.common.assistant",
                cls.TRAFEGO:   "personal.common.traffic",
                cls.OFICINA:   "personal.common.mechanics",
            }
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
    class Status(models.TextChoices):
        ATIVO     = "A", "Ativo"
        AFASTADO  = "F", "Afastado"
        DESLIGADO = "D", "Desligado"
        @classmethod
        def i18n_map(cls):
            return {
                cls.ATIVO:     "common.active",
                cls.AFASTADO:  "personal.common.onLeave",
                cls.DESLIGADO: "personal.common.terminated",
            }
    class MotivoDesligamento(models.TextChoices):
        PELO_EMPREGADOR  = "EM", "Pelo Empregador"
        POR_JUSTA_CAUSA  = "JC", "Por Justa Causa"
        PEDIDO           = "PD", "Pedido de Desligamento"
        RESCISAO_INDIRETA= "RI", "Rescisao Indireta"
        ABANDONO         = "AB", "Abandono de Emprego"
        DECISAO_JUDICIAL = "DJ", "Descisao Judicial"
        @classmethod
        def i18n_map(cls):
            return {
                cls.PELO_EMPREGADOR:   "personal.common.dismissed",
                cls.POR_JUSTA_CAUSA:   "personal.employee.form.forJustCause",
                cls.PEDIDO:            "personal.common.resign",
                cls.RESCISAO_INDIRETA: "personal.employee.form.indirectTermination",
                cls.ABANDONO:          "personal.employee.form.abandonment",
                cls.DECISAO_JUDICIAL:  "personal.employee.form.judicialTermination",
            }
    class Regime(models.TextChoices):
        CLT        = "CLT", "CLT"
        PJ         = "PJ", "Pessoa Juridica"
        APRENDIZ   = "AP", "Aprendiz"
        @classmethod
        def i18n_map(cls):
            return {
                cls.PJ:       "personal.employee.form.legalEntity",
                cls.APRENDIZ: "personal.common.apprentice",
            }
    filial = models.ForeignKey(Filial, blank=True, null=True, on_delete=models.RESTRICT)
    matricula = models.CharField(max_length=15, unique=True, blank=False)
    cargo = models.ForeignKey(Cargo, blank=True, null=True, on_delete=models.RESTRICT)
    regime = models.CharField(max_length=5, choices=Regime.choices, default='CLT', blank=True)
    data_admissao = models.DateField(blank=True, null=True, default=datetime.today)
    data_desligamento = models.DateField(blank=True, null=True)
    motivo_desligamento = models.CharField(max_length=3,choices=MotivoDesligamento.choices, blank=True)
    pne = models.BooleanField(default=False)
    foto = core_ImageField(upload_to='pessoal/fotos/', blank=True)
    usuario = models.OneToOneField(User, blank=True, null=True, on_delete=models.RESTRICT)
    status = models.CharField(max_length=3, choices=Status.choices, default='A', blank=True)    
    def __str__(self):
        return self.matricula
    def process_and_save_photo(self, foto_data_url):
        if not foto_data_url:
            return
        if self.foto:
            self.foto.delete(save=False) # caso update da foto, apaga a anterior
        folder_relative = "pessoal/fotos"
        folder_path = Path(settings.MEDIA_ROOT) / folder_relative
        folder_path.mkdir(parents=True, exist_ok=True)
        file_name = f"{self.filial.empresa.id}_{self.matricula}_{int(datetime.now().timestamp())}.png"
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
    class Motivo(models.TextChoices):
        DOENCA           = "D", "Doenca"
        ACIDENTE_TRABALHO= "A", "Acidente Trabalho"
        OUTRO            = "O", "Outro"
        @classmethod
        def i18n_map(cls):
            return {
                cls.DOENCA:            "personal.common.illness",
                cls.ACIDENTE_TRABALHO: "personal.employee.form.workplaceAccident",
                cls.OUTRO:             "common.other",
            }
    class Origem(models.TextChoices):
        INSS      = "I", "INSS"
        ESCALA    = "E", "Escala"
        SINDICATO = "S", "Sindicato"
        GESTORA   = "G", "Gestora"
        OUTRO     = "O", "Outro"
        @classmethod
        def i18n_map(cls):
            return {
                cls.ESCALA:    "personal.common.schedule",
                cls.SINDICATO: "personal.common.syndicate",
                cls.GESTORA:   "common.regulator",
                cls.OUTRO:     "common.other",
            }
    funcionario = models.ForeignKey(Funcionario, on_delete=models.RESTRICT)
    motivo = models.CharField(max_length=3, choices=Motivo.choices, default='D', blank=True)
    origem = models.CharField(max_length=3, choices=Origem.choices, default='I', blank=True)
    data_afastamento = models.DateField(blank=True, null=True, default=datetime.today)
    data_retorno = models.DateField(blank=True, null=True)
    reabilitado = models.BooleanField(default=False)
    remunerado = models.BooleanField(default=False)
    detalhe = models.TextField(blank=True)
auditlog.register(Afastamento)

class Dependente(models.Model):
    class Parentesco(models.TextChoices):
        CONJUGE      = "C", "Cônjuge"
        FILHO        = "F", "Filho / Enteado"
        IRMAO        = "I", "Irmão"
        PAI_MAE      = "P", "Pai / Mãe"
        SOGRO_SOGRA  = "S", "Sogro / Sogra"
        ASCENDENTE   = "A", "Ascendente"
        DESCENDENTE  = "N", "Descendente"
        INCAPAZ      = "In", "Incapaz"
        OUTRO        = "M", "Outro"
        @classmethod
        def i18n_map(cls):
            return {
                cls.CONJUGE:     "personal.common.spouse",
                cls.FILHO:       "personal.employee.form.sonStepson",
                cls.IRMAO:       "personal.common.brother",
                cls.PAI_MAE:     "personal.employee.form.fatherMother",
                cls.SOGRO_SOGRA: "personal.employee.form.fatherMotherInLaw",
                cls.ASCENDENTE:  "personal.common.ascendant",
                cls.DESCENDENTE: "personal.common.descendant",
                cls.INCAPAZ:     "personal.common.incapable",
                cls.OUTRO:       "common.other",
            }
    funcionario = models.ForeignKey(Funcionario, on_delete=models.RESTRICT)
    nome = models.CharField(max_length=230, blank=False)
    parentesco = models.CharField(max_length=3, choices=Parentesco.choices, default='F', blank=True)
    sexo = models.CharField(max_length=3,choices=Funcionario.Sexo.choices, blank=True)
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
    class TipoMovimento(models.TextChoices):
        PROVENTO   = "P", "Provento"
        DESCONTO   = "D", "Desconto"
        REFERENCIA = "R", "Referência"
        @classmethod
        def i18n_map(cls):
            return {
                cls.PROVENTO:   "personal.common.profit",
                cls.DESCONTO:   "personal.common.deduction",
                cls.REFERENCIA: "personal.common.reference",
            }
    nome = models.CharField(max_length=100, blank=False)
    rastreio = models.SlugField(unique=True)
    tipo = models.CharField(max_length=3, choices=TipoMovimento.choices, default='P', blank=False)
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
    class TipoValorFormula(models.TextChoices):
        VALOR   = "V", "Valor"
        FORMULA = "F", "Formula"
        @classmethod
        def i18n_map(cls):
            return {
                cls.VALOR:   "common.value",
                cls.FORMULA: "common.formula",
            }
    evento = models.ForeignKey(Evento, on_delete=models.RESTRICT)
    inicio = models.DateField(blank=False, null=False, default=datetime.today)
    fim = models.DateField(blank=True, null=True)
    tipo = models.CharField(max_length=3, choices=TipoValorFormula.choices, default='V', blank=False)
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
