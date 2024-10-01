from django import forms
from .models import Linha, Localidade, Trajeto, Planejamento, Passageiro
from datetime import date


class LocalidadeForm(forms.ModelForm):
    class Meta:
        model = Localidade
        fields = ['nome','eh_garagem','troca_turno', 'ponto_de_controle']
    nome = forms.CharField(error_messages={'required': 'Defina um nome para localidade'}, min_length=3, widget=forms.TextInput(attrs={'class': 'form-control','autofocus':'autofocus','placeholder':' '}))
    eh_garagem = forms.BooleanField(required=False, widget=forms.CheckboxInput(attrs={'class': 'form-check-input'}))
    troca_turno = forms.BooleanField(required=False, initial=True, widget=forms.CheckboxInput(attrs={'class': 'form-check-input'}))
    ponto_de_controle = forms.BooleanField(required=False, initial=False, widget=forms.CheckboxInput(attrs={'class': 'form-check-input'}))

class TrajetoForm(forms.ModelForm):
    class Meta:
        model = Trajeto
        fields = ['linha','sentido','seq','local','delta','labels','fechado','detalhe']
    sentido = forms.ChoiceField(choices=Trajeto.SENTIDO_CHOICES, widget=forms.Select(attrs={'class':'form-select'}))
    seq = forms.IntegerField(required=False, widget=forms.TextInput(attrs={'class': 'form-control','type':'number','min':'1','max':'199', 'onfocus':'this.select();'}))
    fechado = forms.BooleanField(required=False, initial=False, widget=forms.CheckboxInput(attrs={'class': 'form-check-input'}))
    detalhe = forms.CharField(required=False,widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    

class LinhaForm(forms.ModelForm):
    class Meta:
        model = Linha
        fields = ['empresa','codigo','nome','classificacao','garagem','origem','destino','acesso_origem_km','acesso_destino_km','acesso_origem_minutos','acesso_destino_minutos','recolhe_origem_km','recolhe_destino_km','recolhe_origem_minutos','recolhe_destino_minutos','extensao_ida','extensao_volta','demanda', 'detalhe']
    codigo = forms.CharField(error_messages={'required': 'Campo Código OBRIGATÓRIO'},max_length=8,widget=forms.TextInput(attrs={'class': 'form-control fw-bold','placeholder':' '}))
    nome = forms.CharField(error_messages={'required': 'É necessário informar um noma para linha'}, min_length=3, widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    classificacao = forms.ChoiceField(choices=Linha.CLASSIFICACAO_CHOICES, widget=forms.Select(attrs={'class':'form-select'}))
    extensao_ida = forms.DecimalField(required=False,initial=0,min_value=0,max_digits=10,decimal_places=2,widget=forms.TextInput(attrs={'class': 'form-control','type':'number','min':'0','max':'1000','step':'.01', 'onfocus':'this.select();'}))
    extensao_volta = forms.DecimalField(required=False,initial=0,min_value=0,max_digits=10,decimal_places=2,widget=forms.TextInput(attrs={'class': 'form-control','type':'number','min':'0','max':'1000','step':'.01', 'onfocus':'this.select();'}))
    acesso_origem_km = forms.DecimalField(required=False,initial=0,min_value=0,max_digits=10,decimal_places=2,widget=forms.TextInput(attrs={'class': 'form-control','type':'number','min':'0','max':'1000','step':'.01', 'onfocus':'this.select();'}))
    acesso_destino_km = forms.DecimalField(required=False,initial=0,min_value=0,max_digits=10,decimal_places=2,widget=forms.TextInput(attrs={'class': 'form-control','type':'number','min':'0','max':'1000','step':'.01', 'onfocus':'this.select();'}))
    recolhe_origem_km = forms.DecimalField(required=False,initial=0,min_value=0,max_digits=10,decimal_places=2,widget=forms.TextInput(attrs={'class': 'form-control','type':'number','min':'0','max':'1000','step':'.01', 'onfocus':'this.select();'}))
    recolhe_destino_km = forms.DecimalField(required=False,initial=0,min_value=0,max_digits=10,decimal_places=2,widget=forms.TextInput(attrs={'class': 'form-control','type':'number','min':'0','max':'1000','step':'.01', 'onfocus':'this.select();'}))
    acesso_origem_minutos = forms.IntegerField(required=False,initial=0, widget=forms.TextInput(attrs={'class': 'form-control','type':'number','min':'0','max':'1000', 'onfocus':'this.select();'}))
    acesso_destino_minutos = forms.IntegerField(required=False,initial=0, widget=forms.TextInput(attrs={'class': 'form-control','type':'number','min':'0','max':'1000', 'onfocus':'this.select();'}))
    recolhe_origem_minutos = forms.IntegerField(required=False,initial=0, widget=forms.TextInput(attrs={'class': 'form-control','type':'number','min':'0','max':'1000', 'onfocus':'this.select();'}))
    recolhe_destino_minutos = forms.IntegerField(required=False,initial=0, widget=forms.TextInput(attrs={'class': 'form-control','type':'number','min':'0','max':'1000', 'onfocus':'this.select();'}))
    detalhe = forms.CharField(required=False, widget=forms.Textarea(attrs={'class': 'form-control','placeholder':'Detalhes', 'rows':4}))

class PlanejamentoForm(forms.ModelForm):
    class Meta:
        model = Planejamento
        fields = ['empresa','linha','codigo','descricao','dia_tipo','patamares','ativo','pin']
    codigo = forms.CharField(error_messages={'required': 'Informe um código para o projeto', 'unique': 'Projeto com esse nome já existe'},max_length=8,widget=forms.TextInput(attrs={'class': 'form-control fw-bold','placeholder':' '}))
    descricao = forms.CharField(required=False, max_length=60,widget=forms.TextInput(attrs={'class': 'form-control','placeholder':' '}))
    dia_tipo = forms.ChoiceField(choices=Planejamento.DIA_TIPO, widget=forms.Select(attrs={'class':'form-select'}))
    ativo = forms.BooleanField(required=False, initial=False, widget=forms.CheckboxInput(attrs={'class': 'form-check-input'}))
    pin = forms.BooleanField(required=False, initial=True, widget=forms.CheckboxInput(attrs={'class': 'form-check-input'}))
    def clean_codigo(self):
        return self.cleaned_data['codigo'].upper()

class PassageiroForm(forms.ModelForm):
    class Meta:
        model = Passageiro
        fields = ['empresa','embarque','referencia','dia_tipo','linha','veiculo','cartao','aplicacao','tipo','tarifa']
    dia_tipo = forms.ChoiceField(choices=Passageiro.DIA_TIPO, widget=forms.Select(attrs={'class':'form-select'}))
    referencia = forms.DateField(error_messages={'required': 'Informe a data de referência'}, initial=date.today(), widget=forms.TextInput(attrs={'class':'form-control','type':'date'}))