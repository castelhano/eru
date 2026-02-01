from django.db import models
from django.db.models import Q
from pathlib import Path
from django.conf import settings
from core.models import Empresa, Filial
from django.utils.translation import gettext_lazy as _
from core.constants import DEFAULT_MESSAGES
from datetime import datetime, date
from django.utils.timezone import now
from django.contrib.auth.models import User
from django.utils.safestring import mark_safe
from auditlog.registry import auditlog
from django.core.exceptions import ValidationError

class Pessoa(models.Model):
    class EstadoCivil(models.TextChoices):
        SOLTEIRO   = "S", _("Solteiro")
        CASADO     = "C", _("Casado")
        DIVORCIADO = "D", _("Divorciado")
        VIUVO      = "V", _("Viuvo")
    class Genero(models.TextChoices):
        NAO_INFORMADO = 'N', _("Não informado")
        MASCULINO     = 'M', _("Masculino")
        FEMININO      = 'F', _("Feminino")
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
    nome = models.CharField(_('Nome'), max_length=100, blank=False)
    apelido = models.CharField(_('Apelido'), max_length=20, blank=True)
    nome_social = models.CharField(_('Nome Social'), max_length=100, blank=True)
    genero = models.CharField(_('Gênero'), max_length=3,choices=Genero.choices, blank=True)
    data_nascimento = models.DateField(_('Data Nascimento'), blank=True, null=True)
    rg = models.CharField(_('Rg'), max_length=20, blank=True)
    rg_emissao = models.DateField(_('Rg Emissão'), blank=True, null=True)
    rg_orgao_expedidor = models.CharField(_('Rg Org Expedidor'), max_length=15, blank=True)
    cpf = models.CharField(_('Cpf'), max_length=20,blank=True)
    titulo_eleitor = models.CharField(_('Titulo Eleitor'), max_length=20, blank=True)
    titulo_zona = models.CharField(_('Zona'), max_length=10, blank=True)
    titulo_secao = models.CharField(_('Seção'), max_length=8, blank=True)
    reservista = models.CharField(_('Reservista'), max_length=20, blank=True)
    cnh = models.CharField(_('Cnh'), max_length=20, blank=True)
    cnh_categoria = models.CharField(_('Categoria'), max_length=4,choices=CnhCategoria.choices, blank=True)
    cnh_primeira_habilitacao = models.DateField(_('Primeira Habilitação'), blank=True, null=True)
    cnh_emissao = models.DateField(_('Emissão'), blank=True, null=True)
    cnh_validade = models.DateField(_('Validade'), blank=True, null=True)
    fone1 = models.CharField(_('Fone 1'), max_length=20, blank=True)
    fone2 = models.CharField(_('Fone 2'), max_length=20, blank=True)
    email = models.CharField(_('Email'), max_length=150, blank=True)
    endereco = models.CharField(_('Endereço'), max_length=255, blank=True)
    bairro = models.CharField(_('Bairro'), max_length=100, blank=True)
    cidade = models.CharField(_('Cidade'), max_length=60, blank=True)
    uf = models.CharField(_('Uf'), max_length=5, blank=True)
    estado_civil = models.CharField(_('Estado Civil'), max_length=3,choices=EstadoCivil.choices, blank=True)
    nome_mae = models.CharField(_('Nome da Mãe'), max_length=150, blank=True)
    nome_pai = models.CharField(_('Nome do Pai'), max_length=150, blank=True)
    detalhe = models.TextField(_('Detalhe'), blank=True)
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
    nome = models.CharField(_('Nome'), max_length=50, unique=True, blank=False)
    def __str__(self):
        return self.nome
    def ativos(self):
        return Funcionario.objects.filter(contrato__cargo__setor=self, is_active=True).distinct().count()
auditlog.register(Setor)

class Cargo(models.Model):
    class FuncaoTipo(models.TextChoices):
        MOTORISTA = "M", _("Motorista")
        AUXILIAR  = "A", _("Auxiliar")
        TRAFEGO   = "T", _("Tráfego")
        OFICINA   = "O", _("Oficina")
    nome = models.CharField(_('Nome'), max_length=50, unique=True, blank=False)
    setor = models.ForeignKey(Setor, on_delete=models.PROTECT, verbose_name=_('Setor'))
    atividades = models.TextField(_('Atividades'), blank=True)
    funcoes_fixas = models.JSONField(_('Funções Fixas'), default=list, blank=True)
    def __str__(self):
        return self.nome
    def ativos(self):
        return 0
    class Meta:
        ordering = ['nome']
auditlog.register(Cargo)


class Funcionario(Pessoa):
    class Status(models.TextChoices):
        ATIVO     = "A", _("Ativo")
        AFASTADO  = "F", _("Afastado")
        DESLIGADO = "D", _("Desligado")
    class MotivoDesligamento(models.TextChoices):
        PELO_EMPREGADOR  = "EM", _("Pelo Empregador")
        POR_JUSTA_CAUSA  = "JC", _("Por Justa Causa")
        PEDIDO           = "PD", _("Pedido de Desligamento")
        RESCISAO_INDIRETA= "RI", _("Rescisão Indireta")
        ABANDONO         = "AB", _("Abandono de Emprego")
        DECISAO_JUDICIAL = "DJ", _("Descisão Judicial")
    filial = models.ForeignKey(Filial, on_delete=models.RESTRICT, verbose_name=_('Filial'))
    matricula = models.CharField(_('Matricula'), max_length=15, unique=True, blank=False)
    data_admissao = models.DateField(_('Data Admissão'), blank=True, null=True, default=datetime.today)
    data_desligamento = models.DateField(_('Data Desligamento'), blank=True, null=True)
    motivo_desligamento = models.CharField(_('Motivo Desligamento'), max_length=3,choices=MotivoDesligamento.choices, blank=True)
    pne = models.BooleanField(_('Pne'), default=False)
    foto = models.ImageField(_('Foto'), upload_to='pessoal/fotos/', blank=True)
    usuario = models.OneToOneField(User, blank=True, null=True, on_delete=models.RESTRICT, verbose_name=_('Usuário'))
    status = models.CharField(_('Status'), max_length=3, choices=Status.choices, default='A', blank=True, db_index=True)
    def __str__(self):
        return self.matricula
    def upload_foto_path(instance, filename):
        ext = filename.split('.')[-1]
        return f"pessoal/fotos/{instance.filial.empresa.id}_{instance.matricula}_{int(datetime.now().timestamp())}.{ext}"
    def delete(self, *args, **kwargs):
        # ao excluir funcionario, caso ele tenha foto, apaga registro fisico
        if self.foto:
            self.foto.delete(save=False)
        super().delete(*args, **kwargs)
    def validar_afastamento(self):
        if self.status == self.Status.DESLIGADO:
            raise ValidationError(_("Não é possível alterar dados de funcionários desligados"))
        if self.status == self.Status.AFASTADO:
            raise ValidationError(_("Funcionário já possui um afastamento ativo"))
        return True
    def afastar(self):
        self.status = self.Status.AFASTADO
        self.save(update_fields=['status'])
    def retornar(self):
        self.status = self.Status.ATIVO
        self.save(update_fields=['status'])
    def dependentes(self):
        return Dependente.objects.filter(funcionario=self).order_by('nome')
    def afastamentos(self):
        return Afastamento.objects.filter(funcionario=self).order_by('data_afastamento')
    def foto_url(self):
        return self.foto.url if self.foto else None
    def foto_name(self):
        return self.foto.name.split('/')[-1]
    @property
    def F_contrato(self):
        if not hasattr(self, '_cached_contrato'):
            hoje = now().date()
            self._cached_contrato = self.contratos.filter(inicio__lte=hoje
            ).filter(Q(fim__gte=hoje) | Q(fim__isnull=True)
            ).order_by('-inicio').first()
        return self._cached_contrato
    @property
    def F_ehEditavel(self):
        return self.status != self.Status.DESLIGADO
    @property
    def F_cargo(self):
        return self.F_contrato.cargo if self.F_contrato else None
    @property
    def F_salario(self):
        return self.F_contrato.salario if self.F_contrato else 0
    @property
    def F_regime(self):
        return self.F_contrato.get_regime_display() if self.F_contrato else ""
    @property
    def F_pne(self):
        return self.pne
    @property
    def F_anosEmpresa(self):
        return self.F_diasEmpresa // 365
    @property
    def F_diasEmpresa(self):
        if not self.data_admissao: return 0
        fim = self.data_desligamento or now().date()
        return max((fim - self.data_admissao).days, 0)
    def clean(self):
        if self.pk: # eh um update
            original = Funcionario.objects.get(pk=self.pk)
            if original.status == 'D' and self.status == 'D':
                raise ValidationError(_("Não é possível alterar dados de funcionários desligados"))
        super().clean()
    def save(self, *args, **kwargs):
        if self.pk and Funcionario.objects.get(pk=self.pk).status == 'D':
            raise PermissionError(_("Não é possível alterar dados de funcionários desligados"))
        super().save(*args, **kwargs)
auditlog.register(Funcionario, exclude_fields=['foto'])


# Modelos para contrato / frequencia / escala

class Contrato(models.Model):
    class Regime(models.TextChoices):
        CLT        = "CLT", _("CLT")
        PJ         = "PJ",  _("Pessoa Jurídica")
        ESTAGIO   = "EST",  _("Estágio")
        APRENDIZ   = "AP",  _("Aprendiz")
    class Tipo(models.TextChoices):
        DIARIO  = "D", _("Diario")
        SEMANAL = "S", _("Semanal flexivel")
        MENSAL  = "M", _("Mensal")
    funcionario = models.ForeignKey(Funcionario , on_delete=models.CASCADE, related_name='contratos', verbose_name=_('Funcionário'))
    cargo = models.ForeignKey(Cargo, blank=True, null=True, on_delete=models.RESTRICT, verbose_name=_('Cargo'))
    regime = models.CharField(_('Regime'), max_length=5, choices=Regime.choices, default='CLT', blank=True)
    salario = models.DecimalField(_('Salário'), max_digits=10, decimal_places=2)
    inicio = models.DateField(_('Inicio'), default=datetime.today)
    fim = models.DateField(_('Fim'), blank=True, null=True)
    def __str__(self):
        return f'{self.funcionario.matricula} | start: {self.inicio}'
    def clean(self):
        super().clean()
        if self.inicio and self.fim and self.fim <= self.inicio:
            raise ValidationError({'fim': DEFAULT_MESSAGES.get('endShorterThanStart')})
        if self.funcionario_id:
            overlap = Contrato.objects.filter(funcionario_id=self.funcionario_id).exclude(pk=self.pk).filter(
                Q(fim__gte=self.inicio) | Q(fim__isnull=True),
                Q(inicio__lte=self.fim) if self.fim else Q()
            )
            if overlap.exists():
                raise ValidationError(DEFAULT_MESSAGES.get('recordOverlap'))
    @property
    def C_diasContrato(self):
        return max(((self.fim or date.today()) - self.inicio).days, 0)
auditlog.register(Contrato)


class Turno(models.Model):
    nome = models.CharField(_('Nome'), max_length=30, unique=True, blank=False)
    dias_ciclo = models.PositiveIntegerField(_('Dias Ciclo'), default=7)
    inicio = models.DateField(_('Inicio'), default=datetime.today)
    def __str__(self):
        return self.nome
auditlog.register(Turno)


class TurnoDia(models.Model):
    turno = models.ForeignKey(Turno, on_delete=models.CASCADE, related_name='dias', verbose_name=_('Turno'))
    posicao_ciclo = models.IntegerField(_('Posição Ciclo'))
    entrada = models.TimeField(_('Entrada'))
    saida = models.TimeField(_('Saída'))
    carga_horaria = models.DurationField(_('Carga Horária'))
    tolerancia = models.PositiveIntegerField(_('Tolerância'), default=10)
    eh_folga = models.BooleanField(_('É Folga'), default=False)
    class Meta:
        constraints = [ models.UniqueConstraint( fields=['turno', 'posicao_ciclo'], name='unique_posicao_por_turno' )]
        ordering = ['posicao_ciclo']
    def __str__(self):
        return f'{self.turno.nome} | cicle: {self.posicao_ciclo}'
    def clean(self):
        if self.posicao_ciclo > self.turno.dias_no_ciclo:
            raise ValidationError(
                _("A posição %(posicao)s excede o limite de %(limite)s dias definido para este turno") % {
                    'posicao': self.posicao_ciclo,
                    'limite': self.turno.dias_no_ciclo,
                }
            )
auditlog.register(Turno)


class TurnoHistorico(models.Model):
    contrato = models.ForeignKey(Contrato, on_delete=models.CASCADE, related_name='historico_turnos', verbose_name=_('Contrato'))
    turno = turno = models.ForeignKey(Turno, on_delete=models.PROTECT, verbose_name=_('Turno'))
    inicio_vigencia = models.DateField(_('Inicio Vigência'), default=datetime.today)
    def __str__(self):
        return f'{self.contrato.funcionario.matricula} | {self.turno.nome}'
auditlog.register(TurnoHistorico)


class Afastamento(models.Model):
    class Motivo(models.TextChoices):
        DOENCA           = "D", _("Doenca")
        ACIDENTE_TRABALHO= "A", _("Acidente Trabalho")
        OUTRO            = "O", _("Outro")
    class Origem(models.TextChoices):
        INSS      = "I", _("INSS")
        ESCALA    = "E", _("Escala")
        SINDICATO = "S", _("Sindicato")
        GESTORA   = "G", _("Gestora")
        OUTRO     = "O", _("Outro")
    funcionario = models.ForeignKey(Funcionario, on_delete=models.RESTRICT, verbose_name=_('Funcionário'))
    motivo = models.CharField(_('Motivo'), max_length=3, choices=Motivo.choices, default='D', blank=True)
    origem = models.CharField(_('Origem'), max_length=3, choices=Origem.choices, default='I', blank=True)
    data_afastamento = models.DateField(_('Data Afastamento'), blank=True, null=True, default=datetime.today)
    data_retorno = models.DateField(_('Data Retorno'), blank=True, null=True)
    reabilitado = models.BooleanField(_('Reabilitado'), default=False)
    remunerado = models.BooleanField(_('Remunerado'), default=False)
    detalhe = models.TextField(_('Detalhe'), blank=True)
    def __str__(self):
        return f'{self.funcionario.matricula} | {self.data_afastamento}'
    @property
    def T_diasAfastado(self):
        # retorna quantidade de dias que funcionario ficou/esta em afastamento
        if self.data_afastamento is None:
            return 0
        # usa a data de retorno se existir, ou data atual
        end_date = self.data_retorno if self.data_retorno else date.today()
        delta = (end_date - self.data_afastamento).days
        return max(delta, 0) # caso lancamento futuro retorno eh negativo, neste caso retorna 0
    def clean(self):
        if not self.pk:
            self.funcionario.validar_afastamento() # sera gerado excessao caso nao seja possivel
        # validacao para garantir que nao haja sobreposicao entre afastamentos
        if self.data_afastamento is None:
            return
        if self.data_retorno and self.data_retorno < self.data_afastamento:
            raise ValidationError({
                'data_retorno': _("A data de retorno não pode ser anterior à data de afastamento")
            })
        query = Afastamento.objects.filter(funcionario=self.funcionario).exclude(pk=self.pk)
        # Sobreposicao ocorre se:
        # a) O novo periodo comeca antes ou durante um periodo existente E termina depois ou durante um periodo existente
        # b) O novo periodo comeca durante um periodo existente
        if self.data_retorno:
            overlapping_absences = query.filter(
                Q(data_afastamento__lte=self.data_retorno) & 
                (Q(data_retorno__gte=self.data_afastamento) | Q(data_retorno__isnull=True))
            )
        else:
            # caso novo afastamento nao tenha data de retorno
            overlapping_absences = query.filter(
                Q(data_retorno__gte=self.data_afastamento) | Q(data_retorno__isnull=True)
            )
        if overlapping_absences.exists():
            raise ValidationError(DEFAULT_MESSAGES.get('recordOverlap'), '')
    def save(self, *args, **kwargs):
        is_new = self.pk is None
        self.full_clean()
        super().save(*args, **kwargs)
        if is_new:
            self.funcionario.afastar()
        elif self.data_retorno and self.data_retorno <= date.today():
            self.funcionario.retornar()
auditlog.register(Afastamento)

class Dependente(models.Model):
    class Parentesco(models.TextChoices):
        CONJUGE      = "C",  _("Cônjuge")
        FILHO        = "F",  _("Filho / Enteado")
        IRMAO        = "I",  _("Irmão")
        PAI_MAE      = "P",  _("Pai / Mãe")
        SOGRO_SOGRA  = "S",  _("Sogro / Sogra")
        ASCENDENTE   = "A",  _("Ascendente")
        DESCENDENTE  = "N",  _("Descendente")
        INCAPAZ      = "In", _("Incapaz")
        OUTRO        = "M",  _("Outro")
    funcionario = models.ForeignKey(Funcionario, on_delete=models.RESTRICT, verbose_name=_('Funcionário'))
    nome = models.CharField(_('Nome'), max_length=230, blank=False)
    parentesco = models.CharField(_('Parentesco'), max_length=3, choices=Parentesco.choices, default='F', blank=True)
    genero = models.CharField(_('Gênero'), max_length=3,choices=Pessoa.Genero.choices, blank=True)
    data_nascimento = models.DateField(_('Data Nascimento'), blank=True, null=True)
    rg = models.CharField(_('Rg'), max_length=20, blank=True)
    rg_emissao = models.DateField(_('Rg Emissão'), blank=True, null=True)
    rg_orgao_expedidor = models.CharField(_('Rg Org Expedidor'), max_length=15, blank=True)
    cpf = models.CharField(_('Cpf'), max_length=20,blank=True)
    def __str__(self):
        return f'{self.funcionario.matricula} | {self.nome[:10]}'
    def idade(self):
        if self.data_nascimento:
            hoje = date.today()
            return hoje.year - self.data_nascimento.year - ((hoje.month, hoje.day) < (self.data_nascimento.month, self.data_nascimento.day))
        else:
            return ''
auditlog.register(Dependente)

class GrupoEvento(models.Model):
    nome = models.CharField(_('Nome'), max_length=100, blank=False, unique=True)
    def __str__(self):
        return self.nome
auditlog.register(GrupoEvento)

class Evento(models.Model):
    class TipoMovimento(models.TextChoices):
        PROVENTO   = "P", _("Provento")
        DESCONTO   = "D", _("Desconto")
        REFERENCIA = "R", _("Referência")
    nome = models.CharField(_('Nome'), max_length=100, blank=False)
    rastreio = models.SlugField(unique=True)
    tipo = models.CharField(_('Tipo'), max_length=3, choices=TipoMovimento.choices, default='P', blank=False)
    grupo = models.ForeignKey(GrupoEvento, on_delete=models.RESTRICT, null=True, verbose_name=_('Grupo'))
    def __str__(self):
        return self.nome
auditlog.register(Evento)

class MotivoReajuste(models.Model):
    nome = models.CharField(_('Nome'), max_length=100, blank=False)
    def __str__(self):
        return self.nome
auditlog.register(MotivoReajuste)

class EventoMovimentacao(models.Model):
    evento = models.ForeignKey(Evento, on_delete=models.RESTRICT, verbose_name=_('Evento'))
    inicio = models.DateField(_('Inicio'), blank=False, null=False, default=datetime.today)
    fim = models.DateField(_('Fim'), blank=True, null=True)
    valor = models.TextField(_('Valor'), blank=True)
    motivo = models.ForeignKey(MotivoReajuste, on_delete=models.RESTRICT, verbose_name=_('Motivo'))
    class Meta:
        abstract = True
    def clean(self):
        if self.fim and self.inicio > self.fim:
            raise ValidationError({'fim': _('Data de fim não pode ser menor que data de inicio')})
        campos_validos = [f for f in self._meta.get_fields() 
            if f.name not in ['id', 'evento', 'inicio', 'fim', 'valor', 'motivo'] 
            and not f.auto_created and f.concrete and not f.many_to_many]
        if campos_validos:
            campo = campos_validos[0].name
            valor = getattr(self, campo)
            qs = self.__class__.objects.filter(evento=self.evento, **{campo: valor}).exclude(pk=self.pk)
            conflito = qs.filter(
                Q(fim__isnull=True, inicio__lte=self.fim if self.fim else datetime.max.date()) |
                Q(fim__isnull=False, inicio__lte=self.fim if self.fim else datetime.max.date(), fim__gte=self.inicio)
            )
            if conflito.exists():
                raise ValidationError(_('Existe registro ativo no periodo informado'))
# Eventos podem ser inseridos para empresas / cargos / funcionarios
# mesmo evento em escopos diferentes sao aplicados seguindo ordem de prioridade:
# 1) Funcionario (mais especifico)
# 2) Cargo
# 3) Empresa (mais generico)
##########
# !! deve ser tratado duplicidade de evento no mesmo escopo no form
class EventoEmpresa(EventoMovimentacao):
    filiais = models.ManyToManyField(Filial, related_name="eventos_filial", verbose_name=_('Filiais'))
    def __str__(self):
        return f'event:company | {self.evento.nome}'
auditlog.register(EventoEmpresa, m2m_fields={"filiais"})

class EventoCargo(EventoMovimentacao):
    cargo = models.ForeignKey(Cargo, on_delete=models.RESTRICT, verbose_name=_('Cargo'))
    filiais = models.ManyToManyField(Filial, related_name="eventos_cargo", verbose_name=_('Filiais'))
    def __str__(self):
        return f'event:position | {self.evento.nome}'
auditlog.register(EventoCargo, m2m_fields={"filiais"})

class EventoFuncionario(EventoMovimentacao):
    funcionario = models.ForeignKey(Funcionario, on_delete=models.RESTRICT, verbose_name=_('Funcionário'))
    def __str__(self):
        return f'event:company | {self.evento.nome}'
auditlog.register(EventoFuncionario)
