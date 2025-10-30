from django.db import models
from core.models import Empresa, Log, ImageField as core_ImageField
from datetime import datetime, date
from django.contrib.auth.models import User

class Pessoa(models.Model):
    ESTADO_CIVIL_CHOICES = (
        ("S","Solteiro (a)"),
        ("C","Casado (a)"),
        ("D","Divorciado (a)"),
        ("V","Viuvo (a)"),
    )
    SEXO_CHOICES = (
        ('N','Nao Informado'),
        ('M','Masculino'),
        ('F','Feminino'),
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
    def ultimas_alteracoes(self):
        logs = Log.objects.filter(modelo='pessoal.setor',objeto_id=self.id).order_by('-data')[:15]
        return reversed(logs)

class Cargo(models.Model):
    nome = models.CharField(max_length=50, unique=True, blank=False)
    setor = models.ForeignKey(Setor, on_delete=models.PROTECT)
    atividades = models.TextField(blank=True)
    def __str__(self):
        return self.nome
    def ativos(self):
        return Funcionario.objects.filter(cargo=self, status='A').count()
    def funcoes_fixas(self):
        return self.ffixas.all()
    def funcoes_fixas_list(self):
        return list(self.ffixas.values_list('nome', flat=True))
    def ultimas_alteracoes(self):
        logs = Log.objects.filter(modelo='pessoal.cargo',objeto_id=self.id).order_by('-data')[:15]
        return reversed(logs)
    class Meta:
        ordering = ['nome']

class FuncaoFixa(models.Model):
    FFIXA_CHOICES = (
        ("M","Motorista"),
        ("A","Auxiliar"),
        ("T","Trafego"),
        ("O","Oficina"),
    )
    nome = models.CharField(max_length=3,choices=FFIXA_CHOICES,unique=True, blank=False)
    cargos = models.ManyToManyField(Cargo, related_name="ffixas")
    def __str__(self):
        return self.get_nome_display
    def ultimas_alteracoes(self):
        logs = Log.objects.filter(modelo='pessoal.funcao_fixa',objeto_id=self.id).order_by('-data')[:15]
        return reversed(logs)
    
    
class Funcionario(Pessoa):
    STATUS_CHOICES = (
        ("A","Ativo"),
        ("F","Afastado"),
        ("D","Desligado"),
    )
    MOTIVOS_DESLIGAMENTO = (
        ("EM","Pelo Empregador"),
        ("JC","Por Justa Causa"),
        ("PD","Pedido de Desligamento"),
        ("RI","Rescisao Indireta"),
        ("AB","Abandono de Emprego"),
        ("DJ","Descisao Judicial")
    )
    REGIME_CHOICES = (
        ("CLT","CLT"),
        ("PJ","Pessoa Juridica"),
        ("AP","Aprendiz"),
    )
    empresa = models.ForeignKey(Empresa, blank=True, null=True, on_delete=models.RESTRICT)
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
    def desligamento(self, data, motivo):
        try:
            if self.status == 'A': # Desligamento restrito a funcionarios ativos
                self.status = 'D'
                self.data_desligamento = data
                self.motivo_desligamento = motivo
                return [True,'DESLIGADO',f'Funcionario {self.matricula} desligado']
            else:
                return [False,'Fail','Somente funcionários ativos podem ser desligados']                
        except:
            return [False,'Erro ao desligar funcionario']
    def foto_url(self):
        return self.foto.url if self.foto else None
    def foto_name(self):
        return self.foto.name.split('/')[-1]
    def ultimas_alteracoes(self):
        logs = Log.objects.filter(modelo='pessoal.funcionario',objeto_id=self.id).order_by('-data')[:15]
        return reversed(logs)
    class Meta:
        permissions = [
            ("associar_usuario", "Pode associar usuario a funcionário"),
            ("afastar_funcionario", "Pode afastar funcionário"),
            ("desligar_funcionario", "Pode desligar funcionário"),
            ("dashboard_funcionario", "Pode acessar dashboard pessoal"),
        ]

class Afastamento(models.Model):
    MOTIVO_AFASTAMENTO = (
        ("D","Doenca"),
        ("A","Acidente Trabalho"),
        ("O","Outro")
    )
    ORIGEM_CHOICES = (
        ("I","INSS"),
        ("E","Escala"),
        ("S","Sindicato"),
        ("G","Gestora"),
        ("O","Outros")
    )
    funcionario = models.ForeignKey(Funcionario, on_delete=models.RESTRICT)
    motivo = models.CharField(max_length=3, choices=MOTIVO_AFASTAMENTO, default='D', blank=True)
    origem = models.CharField(max_length=3, choices=ORIGEM_CHOICES, default='I', blank=True)
    data_afastamento = models.DateField(blank=True, null=True, default=datetime.today)
    data_retorno = models.DateField(blank=True, null=True)
    reabilitado = models.BooleanField(default=False)
    remunerado = models.BooleanField(default=False)
    detalhe = models.TextField(blank=True)
    def ultimas_alteracoes(self):
        logs = Log.objects.filter(modelo='pessoal.afastamento',objeto_id=self.id).order_by('-data')[:15]
        return reversed(logs)

class Dependente(models.Model):
    PARENTESCO = (
        ("C","Conjuge"),
        ("F","Filho / Enteado"),
        ("I","Irmao"),
        ("P","Pai / Mae"),
        ("S","Sogro / Sogra"),
        ("A","Avo / Bisavo"),
        ("N","Neto / Bisneto"),
        ("In","Incapaz"),
        ("M","Outros menores"),
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
    def ultimas_alteracoes(self):
        logs = Log.objects.filter(modelo='pessoal.dependente',objeto_id=self.id).order_by('-data')[:15]
        return reversed(logs)
    def idade(self):
        if self.data_nascimento:
            hoje = date.today()
            return hoje.year - self.data_nascimento.year - ((hoje.month, hoje.day) < (self.data_nascimento.month, self.data_nascimento.day))
        else:
            return ''