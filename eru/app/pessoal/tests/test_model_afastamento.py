from django.test import TestCase
from django.core.exceptions import ValidationError
from datetime import date, timedelta
from core.models import Empresa, Filial
from pessoal.models import Funcionario, Cargo, Setor, Afastamento

class AfastamentoModelTest(TestCase):

    def setUp(self):
        """Prepara o cenário com toda a hierarquia necessária"""
        self.empresa = Empresa.objects.create(nome="Holding Teste")
        self.filial = Filial.objects.create(nome="Unidade Cuiabá", empresa=self.empresa)
        self.setor = Setor.objects.create(nome="Operacional")
        self.cargo = Cargo.objects.create(nome="Auxiliar", setor=self.setor)
        
        self.funcionario = Funcionario.objects.create(
            nome="João Teste", 
            matricula="ABC-123", 
            filial=self.filial,
            status=Funcionario.Status.ATIVO
        )

    def test_afastamento_com_data_fim_mantem_funcionario_ativo(self):
        """Garante que atestados (com data de fim) NÃO mudam o status do funcionário"""
        afast = Afastamento(
            funcionario=self.funcionario,
            data_afastamento=date.today(),
            data_retorno=date.today() + timedelta(days=5),
            motivo=Afastamento.Motivo.DOENCA
        )
        afast.save()

        self.funcionario.refresh_from_db()
        self.assertEqual(self.funcionario.status, Funcionario.Status.ATIVO)

    def test_afastamento_sem_data_fim_altera_para_afastado(self):
        """Garante que o status muda para AFASTADO apenas se o retorno for indefinido"""
        afast = Afastamento(
            funcionario=self.funcionario,
            data_afastamento=date.today(),
            data_retorno=None
        )
        afast.save()

        self.funcionario.refresh_from_db()
        self.assertEqual(self.funcionario.status, Funcionario.Status.AFASTADO)

    def test_fechar_afastamento_retorna_funcionario_ao_ativo(self):
        """Garante que ao editar um afastamento aberto e inserir data de fim, o status volta"""
        # Inicia afastamento sem fim (status vira 'F')
        afast = Afastamento.objects.create(
            funcionario=self.funcionario,
            data_afastamento=date.today() - timedelta(days=30),
            data_retorno=None
        )
        
        # Simula o RH preenchendo a data de retorno depois
        afast.data_retorno = date.today()
        afast.save()

        self.funcionario.refresh_from_db()
        self.assertEqual(self.funcionario.status, Funcionario.Status.ATIVO)

    def test_impedir_sobreposicao_entre_atestados(self):
        """Verifica se o clean impede dois lançamentos no mesmo período"""
        Afastamento.objects.create(
            funcionario=self.funcionario,
            data_afastamento=date(2024, 1, 1),
            data_retorno=date(2024, 1, 10)
        )

        sobreposto = Afastamento(
            funcionario=self.funcionario,
            data_afastamento=date(2024, 1, 5),
            data_retorno=date(2024, 1, 15)
        )

        with self.assertRaises(ValidationError):
            sobreposto.save()

    def test_afastamento_sem_conflito_permite_lancamento(self):
        """Verifica se o sistema permite múltiplos atestados em períodos diferentes"""
        # Atestado de Janeiro
        Afastamento.objects.create(
            funcionario=self.funcionario,
            data_afastamento=date(2024, 1, 1),
            data_retorno=date(2024, 1, 5)
        )

        # Atestado de Fevereiro (Deve passar pois o status do func continua ATIVO)
        afast2 = Afastamento(
            funcionario=self.funcionario,
            data_afastamento=date(2024, 2, 1),
            data_retorno=date(2024, 2, 5)
        )
        
        try:
            afast2.save()
        except ValidationError:
            self.fail("O sistema bloqueou um afastamento válido em período distinto.")

    def test_validar_data_retorno_menor_que_inicio(self):
        """Garante erro se data de retorno for anterior ao início"""
        afast = Afastamento(
            funcionario=self.funcionario,
            data_afastamento=date(2024, 1, 10),
            data_retorno=date(2024, 1, 5)
        )
        with self.assertRaises(ValidationError):
            afast.save()
    def test_falha_ao_afastar_funcionario_desligado_cancela_afastamento(self):
        """
        Garante que se o funcionário estiver DESLIGADO, o método afastar() 
        lança erro e o registro de Afastamento NÃO é criado no banco.
        """
        # 1. Coloca o funcionário em estado que causa erro no afastar()
        self.funcionario.status = Funcionario.Status.DESLIGADO
        self.funcionario.save()
        afast = Afastamento(
            funcionario=self.funcionario,
            data_afastamento=date.today(),
            data_retorno=None # Isso tentaria chamar afastar()
        )
        # 2. Verifica se a exceção é lançada
        with self.assertRaises(ValidationError):
            afast.save()
        self.assertFalse(Afastamento.objects.filter(funcionario=self.funcionario).exists())
    def test_falha_ao_afastar_funcionario_ja_afastado(self):
        """
        Garante que se o funcionário estiver AFASTADO, o método afastar() 
        lança erro e o registro de Afastamento NÃO é criado no banco.
        """
        # 1. Coloca o funcionário em estado que causa erro no afastar()
        self.funcionario.status = Funcionario.Status.AFASTADO
        self.funcionario.save()
        afast = Afastamento(
            funcionario=self.funcionario,
            data_afastamento=date.today(),
            data_retorno=None # Isso tentaria chamar afastar()
        )
        with self.assertRaises(ValidationError):
            afast.save()
        self.assertFalse(Afastamento.objects.filter(funcionario=self.funcionario).exists())
    def test_property_dias_afastado(self):
        """Valida a property T_diasAfastado incluindo data hoje se retorno for None"""
        inicio = date.today() - timedelta(days=15)
        afast = Afastamento.objects.create(
            funcionario=self.funcionario,
            data_afastamento=inicio,
            data_retorno=None
        )
        # Deve calcular 15 dias baseado na data de hoje
        self.assertEqual(afast.T_diasAfastado, 15)