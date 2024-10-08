from django.db import models
from datetime import datetime
from core.models import Empresa, Log
from django.contrib.auth.models import User
import json



class Localidade(models.Model):
    nome = models.CharField(max_length=80, unique=True, blank=False)
    eh_garagem = models.BooleanField(default=False)
    troca_turno = models.BooleanField(default=False)
    ponto_de_controle = models.BooleanField(default=False)
    def __str__(self):
        return self.nome
    def ultimas_alteracoes(self):
        logs = Log.objects.filter(modelo='trafego.localidade',objeto_id=self.id).order_by('-data')[:15]
        return reversed(logs)


class Linha(models.Model):
    CLASSIFICACAO_CHOICES = (
    ('RD','Radial'),
    ('DM','Diametral'),
    ('CR','Circular'),
    ('TR','Troncal'),
    ('AL','Alimentadora'),
    ('IT','Intersetorial'),
    ('ES','Especial'),
    )
    empresa = models.ForeignKey(Empresa, blank=True, null=True, on_delete=models.RESTRICT)
    codigo = models.CharField(max_length=8, unique=True, blank=False)
    nome = models.CharField(max_length=80, blank=False)
    classificacao = models.CharField(max_length=3,choices=CLASSIFICACAO_CHOICES, blank=True)
    garagem = models.ForeignKey(Localidade,related_name='local_garagem', blank=True, null=True, on_delete=models.RESTRICT)
    origem = models.ForeignKey(Localidade,related_name='local_origem', blank=True, null=True, on_delete=models.RESTRICT)
    destino = models.ForeignKey(Localidade,related_name='local_destino', blank=True, null=True, on_delete=models.RESTRICT)
    extensao_ida = models.DecimalField(default=0, max_digits=10, decimal_places=2)
    extensao_volta = models.DecimalField(default=0, max_digits=10, decimal_places=2)
    acesso_origem_km = models.DecimalField(default=0, max_digits=6, decimal_places=2)
    acesso_destino_km = models.DecimalField(default=0, max_digits=6, decimal_places=2)
    acesso_origem_minutos = models.PositiveIntegerField(blank=True, null=True)
    acesso_destino_minutos = models.PositiveIntegerField(blank=True, null=True)
    recolhe_origem_km = models.DecimalField(default=0, max_digits=6, decimal_places=2)
    recolhe_destino_km = models.DecimalField(default=0, max_digits=6, decimal_places=2)
    recolhe_origem_minutos = models.PositiveIntegerField(blank=True, null=True)
    recolhe_destino_minutos = models.PositiveIntegerField(blank=True, null=True)
    inativa = models.BooleanField(default=False)
    demanda = models.TextField(blank=True)
    detalhe = models.TextField(blank=True)
    def __str__(self):
        return self.codigo
    def ultimas_alteracoes(self):
        logs = Log.objects.filter(modelo='trafego.linha', objeto_id=self.id).order_by('-data')[:15]
        return reversed(logs)
    def patamares(self):
        return Patamar.objects.filter(linha=self).order_by('inicial')
    def params(self): # Retorna detalhamento dos patamares em formato JSON para integracao com jsMarch ex: {0:{fromMin: 55, toMin: 40, ...}}
        params = {}
        for p in self.patamares():
            for i in range(p.inicial, p.final + 1, 1):
                params[i] = {'ida': p.ida, 'volta': p.volta, 'intervalo_ida': p.intervalo_ida, 'intervalo_volta': p.intervalo_volta, 'demanda_ida': 0, 'demanda_volta': 0}
        return json.dumps(params)
    def trajeto(self, sentido='I'):
        return Trajeto.objects.filter(linha=self, sentido=sentido).order_by('seq')
    def circular(self):
        return self.classificacao == 'CR'
    def rendicoes_ida(self):
        return Trajeto.objects.filter(linha=self, sentido='I', local__troca_turno=True, delta__gt=0).exclude(local=self.origem).exclude(local=self.destino)
    def rendicoes_volta(self):
        return Trajeto.objects.filter(linha=self, sentido='V', local__troca_turno=True, delta__gt=0).exclude(local=self.origem).exclude(local=self.destino)
    class Meta:
        permissions = [
            ("dop_linha", "Pode acessar DOP"),
            ("demanda_update", "Pode atualizar demanda"),
        ]

class Trajeto(models.Model):
    SENTIDO_CHOICES = (
    ('I','Ida'),
    ('V','Volta'),
    ('U','Unico'),
    )
    linha = models.ForeignKey(Linha, blank=False, null=False, on_delete=models.RESTRICT)
    sentido = models.CharField(max_length=3,choices=SENTIDO_CHOICES, blank=True, default='I')
    seq = models.PositiveIntegerField(default=1)
    local = models.ForeignKey(Localidade, on_delete=models.RESTRICT)
    delta = models.PositiveIntegerField(default=0)
    labels = models.CharField(max_length=250, blank=True)
    fechado = models.BooleanField(default=False)
    detalhe = models.CharField(max_length=250, blank=True)
    class Meta:
        default_permissions = []


class Patamar(models.Model):
    linha = models.ForeignKey(Linha, blank=False, null=False, on_delete=models.CASCADE)
    inicial = models.PositiveIntegerField(blank=False, null=False)
    final = models.PositiveIntegerField(blank=False, null=False)
    ida = models.PositiveIntegerField(blank=True, null=True)
    volta = models.PositiveIntegerField(blank=True, null=True)
    intervalo_ida = models.PositiveIntegerField(blank=True, null=True)
    intervalo_volta = models.PositiveIntegerField(blank=True, null=True)
    def ultimas_alteracoes(self):
        logs = Log.objects.filter(modelo='trafego.patamar',objeto_id=self.id).order_by('-data')[:15]
        return reversed(logs)
    class Meta:
        default_permissions = ('change',)

class Planejamento(models.Model):
    DIA_TIPO = (
    ('U','Util'),
    ('S','Sabado'),
    ('D','Domingo'),
    ('F','Ferias'),
    ('E','Especial'),
    )
    empresa = models.ForeignKey(Empresa, blank=False, null=False, on_delete=models.RESTRICT)
    linha = models.ForeignKey(Linha, blank=False, null=False, on_delete=models.RESTRICT)
    codigo = models.CharField(max_length=15, unique=True, blank=False)
    descricao = models.CharField(max_length=200, blank=True)
    dia_tipo = models.CharField(max_length=3,choices=DIA_TIPO, blank=True, default='U')
    usuario = models.ForeignKey(User, blank=True, null=True, on_delete=models.RESTRICT)
    data_criacao = models.DateField(blank=True, null=True, default=datetime.today)
    patamares = models.TextField(blank=True)
    ativo = models.BooleanField(default=False)
    pin = models.BooleanField(default=True)
    def __str__(self):
        return self.codigo
    def carros(self):
        return Carro.objects.filter(planejamento=self)
    def qtd_carros(self):
        return Carro.objects.filter(planejamento=self).count()
    def viagens(self):
        return Viagem.objects.filter(carro__planejamento=self)
    def qtd_condutores(self):
        condutores = 0
        aproveitamentos = 0
        for carro in self.carros():
            if carro.escalas == '[]':
                continue
            escalas = json.loads(carro.escalas)
            for escala in escalas:
                if escala['previous'] and not escala['previous']['externalProject']:
                    continue
                if not escala['previous']:
                    condutores += 1 # Se escala nao tiver apontamento anterior, incrementa motorista
                else:
                    aproveitamentos += 1
        return {"condutores": condutores, "aproveitamentos":aproveitamentos}
    def qtd_viagens(self):
        return Viagem.objects.filter(carro__planejamento=self).count()
    def qtd_viagens_produtivas(self):
        return Viagem.objects.filter(carro__planejamento=self, tipo__in=['1','2','3']).count()
    def qtd_viagens_improdutivas(self):
        return Viagem.objects.filter(carro__planejamento=self).exclude(tipo__in=['1','2','3','7']).count()
    def km_planejada(self):
        return self.km_produtivo() + self.km_ociosa() 
    def km_produtivo(self):
        viagens_ida = Viagem.objects.filter(carro__planejamento=self, sentido='I').exclude(tipo__in=['5','6','7']).count()
        viagens_volta = Viagem.objects.filter(carro__planejamento=self, sentido='V').exclude(tipo__in=['5','6','7']).count()
        return (viagens_ida * self.linha.extensao_ida) + (viagens_volta * self.linha.extensao_volta)
    def km_ociosa(self):
        acessos_ida = Viagem.objects.filter(carro__planejamento=self, sentido='I', tipo='5').count()
        acessos_volta = Viagem.objects.filter(carro__planejamento=self, sentido='V', tipo='5').count()
        recolhes_ida = Viagem.objects.filter(carro__planejamento=self, sentido='I', tipo='6').count()
        recolhes_volta = Viagem.objects.filter(carro__planejamento=self, sentido='V', tipo='6').count()
        return (acessos_ida * self.linha.acesso_origem_km) + (acessos_volta * self.linha.acesso_destino_km) + (recolhes_ida * self.linha.recolhe_origem_km) + (recolhes_volta * self.linha.recolhe_destino_km)
    def params(self): # Retorna detalhamento dos patamares em formato JSON para integracao com jsMarch ex: {0:{fromMin: 55, toMin: 40, ...}}
        if self.patamares == '':
            return 'false'
        params = {}
        print('PASSEI')
        print(self.patamares)
        patamares = json.loads(self.patamares)
        for p in patamares:
            for i in range(p['inicial'], p['final'] + 1, 1):
                params[i] = {'ida': p['ida'], 'volta': p['volta'], 'intervalo_ida': p['intervalo_ida'], 'intervalo_volta': p['intervalo_volta'], 'demanda_ida': 0, 'demanda_volta': 0}
        return json.dumps(params)
    def ultimas_alteracoes(self):
        logs = Log.objects.filter(modelo='trafego.planejamento',objeto_id=self.id).order_by('-data')[:15]
        return reversed(logs)

class Carro(models.Model):
    CLASSIFICACAO_CHOICES = (
        ("","---"),
        ("CV","Convencional"),
        ("PD","Padron"),
        ("MC","Microonibus"),
        ("AT","Articulado"),
        ("BI","Biarticulado"),
    )
    planejamento = models.ForeignKey(Planejamento, blank=False, null=False, on_delete=models.CASCADE)
    classificacao = models.CharField(max_length=3,choices=CLASSIFICACAO_CHOICES, default='CV', blank=True)
    escalas = models.TextField(blank=True)
    labels = models.CharField(max_length=250, blank=True)
    def viagens(self):
        return Viagem.objects.filter(carro=self)
    class Meta:
        default_permissions = []

class Viagem(models.Model):
    SENTIDO_CHOICES = (
    ('I','Ida'),
    ('V','Volta'),
    )
    TIPO_CHOICES = (
    ('1','1 Produtiva'),
    ('2','2 Expresso'),
    ('3','3 Semi Expresso'),
    ('4','4 Extra'),
    ('5','5 Acesso'),
    ('6','6 Recolhe'),
    ('7','7 Intervalo'),
    ('9','9 Reservado'),
    )
    carro = models.ForeignKey(Carro, blank=False, null=False, on_delete=models.CASCADE)
    inicio = models.PositiveIntegerField()
    fim = models.PositiveIntegerField()
    sentido = models.CharField(max_length=3,choices=SENTIDO_CHOICES, blank=True, default='1')
    tipo = models.CharField(max_length=3,choices=TIPO_CHOICES, blank=True, default='1')
    origem = models.ForeignKey(Localidade,related_name='viagem_origem', blank=True, null=True, on_delete=models.RESTRICT)
    destino = models.ForeignKey(Localidade,related_name='viagem_destino', blank=True, null=True, on_delete=models.RESTRICT)
    encerrar = models.BooleanField(default=False)
    detalhe = models.CharField(max_length=10, blank=True)
    class Meta:
        default_permissions = []


class Passageiro(models.Model):
    DIA_TIPO = (
    ('U','Util'),
    ('S','Sabado'),
    ('D','Domingo'),
    ('F','Ferias'),
    ('E','Especial'),
    )
    empresa = models.ForeignKey(Empresa, blank=False, null=False, on_delete=models.RESTRICT)
    embarque = models.DateTimeField()
    referencia = models.DateField()
    dia_tipo = models.CharField(max_length=3,choices=DIA_TIPO, blank=True, default='U')
    linha = models.ForeignKey(Linha, blank=False, null=False, on_delete=models.RESTRICT)
    veiculo = models.CharField(max_length=30, blank=True)
    cartao = models.CharField(max_length=60, blank=True)
    aplicacao = models.CharField(max_length=60, blank=True)
    tipo = models.CharField(max_length=60, blank=True)
    tarifa = models.DecimalField(default=0, max_digits=10, decimal_places=2)
    class Meta:
        default_permissions = ('view','import','delete',)