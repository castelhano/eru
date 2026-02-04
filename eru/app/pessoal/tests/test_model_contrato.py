from django.test import TestCase
from django.core.exceptions import ValidationError
from django.utils import timezone
from core.models import Empresa, Filial
from datetime import date, timedelta
from pessoal.models import Funcionario, Contrato, Cargo, Setor

class ContratoModelTest(TestCase):

    def setUp(self):
        self.empresa = Empresa.objects.create(nome="Empresa Teste")
        self.filial = Filial.objects.create(nome="Filial Teste", empresa=self.empresa)
        self.funcionario = Funcionario.objects.create(
            nome="João Silva", 
            matricula="123",
            filial=self.filial
        )
        self.setor = Setor.objects.create(nome="TI")
        self.cargo = Cargo.objects.create(
            nome="Desenvolvedor", 
            setor=self.setor
        )
    def test_fim_menor_que_inicio_deve_falhar(self):
        """Garante que a data de fim não pode ser anterior à de início"""
        contrato = Contrato(
            funcionario=self.funcionario,
            salario=5000,
            inicio=date(2023, 1, 10),
            fim=date(2023, 1, 5) # Data inválida
        )
        with self.assertRaises(ValidationError):
            contrato.full_clean()

    def test_sobreposicao_com_contrato_aberto_deve_falhar(self):
        """Se existe um contrato sem data de fim, não pode permitir novo contrato"""
        # 1. Contrato ativo (sem data fim)
        Contrato.objects.create(
            funcionario=self.funcionario,
            salario=3000,
            inicio=date(2023, 1, 1),
            fim=None
        )

        # 2. Tentativa de novo contrato começando depois
        novo_contrato = Contrato(
            funcionario=self.funcionario,
            salario=4000,
            inicio=date(2023, 2, 1)
        )

        with self.assertRaises(ValidationError):
            novo_contrato.full_clean()

    def test_sobreposicao_entre_datas_deve_falhar(self):
        """Verifica sobreposição de períodos fechados"""
        Contrato.objects.create(
            funcionario=self.funcionario,
            salario=3000,
            inicio=date(2023, 1, 1),
            fim=date(2023, 1, 30)
        )

        # Tenta criar um contrato que começa antes do anterior terminar
        sobreposto = Contrato(
            funcionario=self.funcionario,
            salario=3000,
            inicio=date(2023, 1, 25),
            fim=date(2023, 2, 25)
        )
        
        with self.assertRaises(ValidationError):
            sobreposto.full_clean()

    def test_calculo_dias_contrato(self):
        """Valida a property C_diasContrato"""
        inicio = date(2023, 1, 1)
        fim = date(2023, 1, 11) # 10 dias de diferença
        
        contrato = Contrato.objects.create(
            funcionario=self.funcionario,
            salario=3000,
            inicio=inicio,
            fim=fim
        )
        
        self.assertEqual(contrato.C_diasContrato, 10)

    def test_calculo_dias_contrato_sem_fim_usa_hoje(self):
        """Garante que se fim é None, usa a data de hoje para o cálculo"""
        ontem = date.today() - timedelta(days=18)
        contrato = Contrato.objects.create(
            funcionario=self.funcionario,
            salario=3000,
            inicio=ontem,
            fim=None
        )
        self.assertEqual(contrato.C_diasContrato, 18)
    
    def test_regime_choices_validos(self):
        """Garante que apenas regimes definidos no TextChoices sejam aceitos"""
        # Testando um valor válido (deve passar)
        contrato_ok = Contrato(
            funcionario=self.funcionario,
            salario=2000,
            regime=Contrato.Regime.PJ
        )
        try:
            contrato_ok.full_clean()
        except ValidationError:
            self.fail("full_clean() lançou ValidationError com um regime válido!")

        # Testando um valor inválido (deve falhar)
        contrato_ruim = Contrato(
            funcionario=self.funcionario,
            salario=2000,
            regime="FREELANCER"  # Valor não existe no TextChoices
        )
        with self.assertRaises(ValidationError):
            contrato_ruim.full_clean()
