from datetime import datetime, date
from django.db import models, transaction
from django.db.models import Q
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _
from django.utils.timezone import now
from core.models import Filial
from core.model_base import BaseSettings
from core.constants import DEFAULT_MESSAGES
from auditlog.registry import auditlog
from .schemas import PessoalSettingsSchema


class PessoalSettings(BaseSettings):
    filial = models.OneToOneField(
        'core.Filial',
        on_delete=models.RESTRICT,
        related_name='pessoal_settings'
    )
    def get_schema(self):
        return PessoalSettingsSchema
    def __str__(self):
        return "Pessoal settings"
auditlog.register(PessoalSettings)


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
        return self.cnh_validade is None or self.cnh_validade >= date.today()
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
        DECISAO_JUDICIAL = "DJ", _("Decisão Judicial")
    filial = models.ForeignKey(Filial, on_delete=models.RESTRICT, verbose_name=_('Filial'))
    matricula = models.CharField(_('Matricula'), max_length=15, unique=True, blank=False)
    data_admissao = models.DateField(_('Data Admissão'), blank=True, null=True, default=date.today)
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
        if self.status != self.Status.ATIVO:
            raise ValidationError(_("Funcionário precisa estar ativo para ser afastado"))
        self.status = self.Status.AFASTADO
        self.save(update_fields=['status'])
    def retornar_afastamento(self):
        if self.status == self.Status.ATIVO:
            # se status ja eh ativo nao exetuta nada e sai sem gerar excessao
            return 
        if self.status != self.Status.AFASTADO:
            raise ValidationError(_("Funcionário nao esta afastado"))
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
    def F_eh_editavel(self):
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
    def F_anos_empresa(self):
        return self.F_dias_empresa // 365
    @property
    def F_dias_empresa(self):
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
    # caega_diaria espera receber valor decimal ja convertido, 07:20 -> 7.3333, deve ser tratado
    # na validacao do form e/ou no cliente
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
    carga_mensal = models.PositiveIntegerField(_('Carga Mensal'), default=220)
    carga_diaria = models.DecimalField( _('C Diária Decimal'), max_digits=5, decimal_places=2, null=True, blank=True)
    class Meta:
        indexes = [
            models.Index(fields=['funcionario', 'inicio', 'fim'], name='idx_contrato_vigencia'),
        ]
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
    def C_dias_contrato(self):
        return max(((self.fim or date.today()) - self.inicio).days, 0)
    @property
    def C_salario_hora(self):
        if self.salario and self.carga_mensal > 0:
            return round(self.salario / self.carga_mensal, 4)
        return 0.0
    @property
    def C_carga_mensal(self):
        return self.carga_mensal
    @property
    def C_carga_diaria(self) -> float:
        # Carga diaria efetiva: campo explicito ou fallback carga_mensal/30
        if self.carga_diaria:
            return float(self.carga_diaria)
        return round(self.carga_mensal / 30, 4)
auditlog.register(Contrato)


class Turno(models.Model):
    class DiaSemana(models.TextChoices):
        DOMINGO = '0', _('Domingo')
        SEGUNDA = '1', _('Segunda')
        TERCA = '2', _('Terça')
        QUARTA = '3', _('Quarta')
        QUINTA = '4', _('Quinta')
        SEXTA = '5', _('Sexta')
        SABADO = '6', _('Sábado')
    nome = models.CharField(_('Nome'), max_length=30, unique=True, blank=False)
    dias_ciclo = models.PositiveIntegerField(_('Dias Ciclo'), default=0)
    inicio = models.DateField(_('Inicio'), default=datetime.today)
    def __str__(self):
        return self.nome
auditlog.register(Turno)


class TurnoDia(models.Model):
    turno = models.ForeignKey(Turno, on_delete=models.CASCADE, related_name='dias', verbose_name=_('Turno'))
    posicao_ciclo = models.IntegerField(_('Posição Ciclo'))
    horarios = models.JSONField(_('Horários'), default=list)
    tolerancia = models.PositiveIntegerField(_('Tolerância'), default=10)
    eh_folga = models.BooleanField(_('É Folga'), default=False)
    class Meta:
        constraints = [ models.UniqueConstraint( fields=['turno', 'posicao_ciclo'], name='unique_posicao_por_turno' )]
        ordering = ['posicao_ciclo']
    def __str__(self):
        return f'{self.turno.nome} | cicle: {self.posicao_ciclo}'


class TurnoHistorico(models.Model):
    contrato = models.ForeignKey(Contrato, on_delete=models.CASCADE, related_name='historico_turnos', verbose_name=_('Contrato'))
    turno = models.ForeignKey(Turno, on_delete=models.PROTECT, verbose_name=_('Turno'))
    inicio_vigencia = models.DateField(_('Inicio Vigência'), default=datetime.today)
    fim_vigencia = models.DateField(_('Fim Vigência'), blank=True, null=True)
    class Meta:
        verbose_name = _('Histórico Turno')
        verbose_name_plural = _('Históricos Turnos')
        ordering = ['-inicio_vigencia']
    def __str__(self):
        return f'{self.contrato.funcionario.matricula} | {self.turno.nome}'
    def clean(self):
        # valida sobreposicao de periodos
        super().clean()        
        if not self.inicio_vigencia or not self.contrato_id:
            return        
        # validacao: fim deve ser maior que inicio
        if self.fim_vigencia and self.fim_vigencia < self.inicio_vigencia:
            raise ValidationError({
                'fim_vigencia': _('Data de fim não pode ser anterior à data de início')
            })
        # validacao de overlap        
        overlap = TurnoHistorico.objects.filter(contrato_id=self.contrato_id).exclude(pk=self.pk)        
        if self.fim_vigencia:
            overlap = overlap.filter(
                Q(fim_vigencia__gte=self.inicio_vigencia) | Q(fim_vigencia__isnull=True),
                inicio_vigencia__lte=self.fim_vigencia
            )
        else:
            overlap = overlap.filter(Q(fim_vigencia__gte=self.inicio_vigencia) | Q(fim_vigencia__isnull=True))
        if overlap.exists():
            raise ValidationError(DEFAULT_MESSAGES.get('recordOverlap'), '')
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
    def T_dias_afastado(self):
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
        self.full_clean() 
        with transaction.atomic():
            # 3. Executa a lógica no funcionário ANTES de salvar o afastamento
            if not self.data_retorno:
                self.funcionario.afastar()
            else:
                self.funcionario.retornar_afastamento()
            super().save(*args, **kwargs)
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
    class Meta:
        indexes = [
            models.Index(fields=['inicio', 'fim'], name='idx_ev_emp_vigencia'),
        ]
    def __str__(self):
        return f'event:company | {self.evento.nome}'
auditlog.register(EventoEmpresa, m2m_fields={"filiais"})

class EventoCargo(EventoMovimentacao):
    cargo = models.ForeignKey(Cargo, on_delete=models.RESTRICT, verbose_name=_('Cargo'))
    filiais = models.ManyToManyField(Filial, related_name="eventos_cargo", verbose_name=_('Filiais'))
    class Meta:
        indexes = [
            models.Index(fields=['cargo', 'inicio', 'fim'], name='idx_ev_cargo_vigencia'),
        ]
    def __str__(self):
        return f'event:position | {self.evento.nome}'
auditlog.register(EventoCargo, m2m_fields={"filiais"})

class EventoFuncionario(EventoMovimentacao):
    funcionario = models.ForeignKey(Funcionario, on_delete=models.RESTRICT, verbose_name=_('Funcionário'))
    class Meta:
        indexes = [
            models.Index(fields=['funcionario', 'inicio', 'fim'], name='idx_ev_func_vigencia'),
        ]
    def __str__(self):
        return f'event:company | {self.evento.nome}'
auditlog.register(EventoFuncionario)


class FolhaPagamento(models.Model):
    class Status(models.TextChoices):
        RASCUNHO = "R", _("Rascunho")
        FECHADO  = "F", _("Fechado")
        PAGO     = "P", _("Pago")
        CANCELADO = "C", _("Cancelado")
    contrato = models.ForeignKey('Contrato', on_delete=models.PROTECT, related_name='folhas', verbose_name=_('Contrato'))
    competencia = models.DateField(_('Competência'), db_index=True)    
    proventos = models.DecimalField(_('Total Proventos'), max_digits=12, decimal_places=2, default=0)
    descontos = models.DecimalField(_('Total Descontos'), max_digits=12, decimal_places=2, default=0)
    liquido = models.DecimalField(_('Valor Líquido'), max_digits=12, decimal_places=2, default=0)    
    regras = models.JSONField(_('Regras'), default=dict)    
    erros = models.JSONField(_('Erros'), null=True, blank=True)
    total_erros = models.PositiveIntegerField(_('Qtde Erros'), default=0, db_index=True)
    status = models.CharField(_('Status'), max_length=2, choices=Status.choices, default=Status.RASCUNHO, db_index=True)    
    create_at = models.DateTimeField(auto_now_add=True)
    update_at = models.DateTimeField(auto_now=True)
    class Meta:
        verbose_name = _('Folha de Pagamento')
        verbose_name_plural = _('Folhas de Pagamento')
        unique_together = ('contrato', 'competencia')
        ordering = ['-competencia', 'contrato__funcionario__matricula']
        permissions = [
            ("folha_dashboard", "Can view folha dashboard"),
        ]
    def __str__(self):
        return f"{self.contrato.funcionario.matricula} | {self.competencia.strftime('%m/%Y')}"


class EventoFrequencia(models.Model):
    class Categoria(models.TextChoices):
        JORNADA = 'PRD', _('Jornada/Trabalho')
        INTERVALO = 'INT', _('Intervalo')
        AUSENCIA_JUST = 'AJ', _('Ausência Justificada')
        AUSENCIA_NJUST = 'ANJ', _('Ausência Não Justificada')
        FOLGA = 'FLG', _('Folga')
        HORA_EXTRA = 'HE', _('Hora Extra')
    nome = models.CharField(_('Nome'), max_length=100)
    rastreio = models.SlugField( _('Rastreio'), unique=True, blank=True)
    categoria = models.CharField(_('Categoria'), max_length=4, choices=Categoria.choices, default=Categoria.JORNADA)
    contabiliza_horas = models.BooleanField(_('Contabiliza Horas'), default=True)
    remunerado = models.BooleanField(_('Remunerado'), default=True)
    dia_inteiro = models.BooleanField(_('Dia Inteiro'), default=False)
    desconta_efetivos = models.BooleanField(_('Desconta dias efetivos'), default=False)
    prioridade = models.PositiveIntegerField(_('Prioridade'), default=1)
    cor = models.CharField(_('Cor Hex'), max_length=7, null=True, blank=True)
    def __str__(self):
        return self.nome
auditlog.register(EventoFrequencia, exclude_fields=['cor'])


class Frequencia(models.Model):
    contrato = models.ForeignKey('Contrato', on_delete=models.CASCADE, related_name='frequencias')
    evento = models.ForeignKey(EventoFrequencia, on_delete=models.RESTRICT, verbose_name=_('Evento'))
    data = models.DateField(_('Data'), null=True, blank=True, db_index=True)
    inicio = models.DateTimeField(_('Início'), null=True, blank=True, db_index=True)
    fim = models.DateTimeField(_('Fim'), null=True, blank=True)
    metadados = models.JSONField(
        _('Importação'), 
        default=dict, 
        blank=True, 
        help_text="Armazena os horários vindos da FrequenciaImport antes da edição"
    )
    editado = models.BooleanField(_('Editado Manualmente'), default=False)
    observacao = models.CharField(_('Observação'), max_length=255, blank=True)
    class Meta:
        ordering = ['inicio']
    def __str__(self):
        dia = (self.data or (self.inicio.date() if self.inicio else '?'))
        horario = f"{self.inicio.strftime('%H:%M')}–{self.fim.strftime('%H:%M')}" if self.inicio and self.fim else 'dia inteiro'
        return f"{self.contrato.funcionario} | {dia} | {self.evento} ({horario})"
    def clean(self):
        super().clean()
        if self.inicio and self.fim:
            if self.fim <= self.inicio:
                raise ValidationError("Horário de fim deve ser maior que o início")
            overlap = Frequencia.objects.filter(
                contrato=self.contrato,
                inicio__lt=self.fim,
                fim__gt=self.inicio
            ).exclude(pk=self.pk)
            if overlap.exists():
                raise ValidationError("Registro sobrepõe outras entradas existentes")
    @property
    def H_jornada(self):
        if self.inicio and self.fim:
            return self.fim - self.inicio
        return None
    @property
    def H_horas_decimais(self):
        duracao = self.H_jornada
        return duracao.total_seconds() / 3600 if duracao else 0.0
auditlog.register(Frequencia, exclude_fields=['metadados','editado','observacao'])


class FrequenciaConsolidada(models.Model):
    class Status(models.TextChoices):
        ABERTO = 'A', _('Aberto')
        FECHADO = 'F', _('Fechado')
        PROCESSADO = 'P', _('Processado')
    contrato = models.ForeignKey('Contrato', on_delete=models.CASCADE, related_name='consolidados_freq')
    competencia = models.DateField(_('Competência'), db_index=True)
    inicio = models.DateTimeField(_('Início'), db_index=True)
    fim = models.DateTimeField(_('Fim'), null=True, blank=True)
    status = models.CharField(_('Status'), max_length=1, choices=Status.choices, default=Status.ABERTO)
    bloqueado = models.BooleanField(_('Bloqueado'), default=False)
    processamento = models.DateTimeField(_('Data Processamento'), null=True, blank=True)
    consolidado = models.JSONField(_('Valores Consolidados'), default=dict, blank=True)
    erros = models.JSONField(_('Logs de Erros'), default=dict, blank=True)
    class Meta:
        unique_together = ('contrato', 'competencia')
    def __str__(self):
        return f"{self.contrato.funcionario.matricula} - {self.competencia.strftime('%m/%Y')}"
    @property
    def H_faltas_justificadas(self): return self.consolidado.get('H_faltas_justificadas', 0)
    @property
    def H_faltas_injustificadas(self): return self.consolidado.get('H_faltas_injustificadas', 0)
    @property
    def H_horas_trabalhadas(self): return self.consolidado.get('H_horas_trabalhadas', 0.0)
    @property
    def H_horas_extras(self): return self.consolidado.get('H_horas_extras', 0.0)
    @property
    def H_atestados(self): return self.consolidado.get('H_atestados', 0)
    @property
    def H_horas_intervalo(self): return self.consolidado.get('H_intervalos', 0.0)
    @property
    def H_dias_trabalhados(self): return self.consolidado.get('H_dias_trabalhados', 0)
    @property
    def H_dias_falta_just(self): return self.consolidado.get('H_dias_falta_just', 0)
    @property
    def H_dias_falta_njust(self): return self.consolidado.get('H_dias_falta_njust', 0)
    @property
    def H_dias_folga(self): return self.consolidado.get('H_dias_folga', 0)
    @property
    def H_dias_afastamento(self): return self.consolidado.get('H_dias_afastamento', 0)
    def tem_erros(self) -> bool: return self.bloqueado


class FrequenciaImport(models.Model):
    class Origem(models.TextChoices):
        RELOGIO_AFD = 'AFD', _('Arquivo AFD (Relógio Físico)')
        APP_MOBILE  = 'APP', _('Aplicativo Móvel (GPS)')
        PORTAL_WEB  = 'WEB', _('Portal do Funcionário')
        IMPORT_CSV  = 'CSV', _('Importação de Planilha')
    contrato = models.ForeignKey('Contrato', on_delete=models.CASCADE, related_name='batidas_brutas')
    data_hora = models.DateTimeField(_('Data e Hora Original'), db_index=True)
    origem = models.CharField(_('Origem'), max_length=3, choices=Origem.choices, default=Origem.RELOGIO_AFD)
    nsr = models.CharField(_('NSR'), max_length=50, blank=True, null=True, help_text="Número Sequencial de Registro (AFD)")
    num_relogio = models.CharField(_('Nº Relógio/Equipamento'), max_length=50, blank=True, null=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    hash_verificacao = models.CharField(max_length=255, blank=True, null=True, help_text="Hash de integridade do registro original")
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        verbose_name = _('Importação de Frequência')
        verbose_name_plural = _('Importações de Frequências')
        ordering = ['-data_hora']
        indexes = [
            models.Index(fields=['contrato', 'data_hora']),
        ]
    def __str__(self):
        return f"{self.contrato.funcionario.matricula} | {self.data_hora.strftime('%d/%m/%Y %H:%M')}"


class ProcessamentoJob(models.Model):
    class Tipo(models.TextChoices):
        CONSOLIDACAO_FREQ = 'CF', _('Consolidação de Frequência')
        FOLHA             = 'FP', _('Folha de Pagamento')
        CARGA_ESCALA      = 'CE', _('Carga de Escala')
    class Status(models.TextChoices):
        AGUARDANDO   = 'AG', _('Aguardando')
        PROCESSANDO  = 'PR', _('Processando')
        CONCLUIDO    = 'OK', _('Concluído')
        ERRO         = 'ER', _('Erro')
    tipo = models.CharField(_('Tipo'), max_length=2, choices=Tipo.choices)
    filial = models.ForeignKey('core.Filial', on_delete=models.CASCADE, verbose_name=_('Filial'))
    competencia = models.DateField(_('Competência'), db_index=True)
    status = models.CharField(_('Status'), max_length=2, choices=Status.choices, default=Status.AGUARDANDO, db_index=True)
    criado_por = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, verbose_name=_('Criado por'))
    iniciado_em = models.DateTimeField(_('Iniciado em'),  null=True, blank=True)
    concluido_em = models.DateTimeField(_('Concluído em'), null=True, blank=True)
    resultado = models.JSONField(_('Resultado'), default=dict, blank=True)
    observacoes = models.JSONField(_('Observações'), default=list, blank=True)
    class Meta:
        verbose_name = _('Job de Processamento')
        # um job por tipo/filial/competência — reabre no lugar do anterior
        unique_together = ('tipo', 'filial', 'competencia')
        ordering = ['-concluido_em']
    def __str__(self):
        return f"{self.get_tipo_display()} | {self.filial} | {self.competencia.strftime('%m/%Y')} | {self.get_status_display()}"
    @property
    def em_execucao(self) -> bool: return self.status in (self.Status.AGUARDANDO, self.Status.PROCESSANDO)