import os
import django

# Inicializa o ambiente Django se for rodar como script fora do 'manage.py test'
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'seu_projeto.settings')
django.setup()

from pessoal.folha.engine import get_interpreter, dependence_resolve, engine_run
from decimal import Decimal
from django.test import TestCase

# 1. Classe Dummy para simular a Frequência que ainda não existe
class FrequenciaMock:
    @property
    def H_faltas(self): return 2
    @property
    def H_horas_extras(self): return 10.0

# 2. Mock de objetos de Regras (Simulando o que viria do banco)
class RegraMock:
    def __init__(self, rastreio, valor):
        self.valor = valor
        self.rastreio = rastreio
        # Mock do objeto Evento relacionado
        class EventoMock:
            def __init__(self, r): self.rastreio = r
        self.evento = EventoMock(rastreio)

def testar_motor_folha():
    print("Iniciando Teste do Motor de Folha...\n")

    # Cenário: Dependências encadeadas
    # U_salario_bruto depende de F_salario (do modelo)
    # U_gratificacao depende de U_salario_bruto
    # U_inss depende de U_salario_bruto + U_gratificacao
    regras = {
        'U_inss': RegraMock('U_inss', '(U_salario_bruto + U_gratificacao) * 0.11'),
        'U_salBase': RegraMock('U_salario_bruto', 'F_salario - (H_faltas * 100)'),
        'U_gratificacao': RegraMock('U_gratificacao', 'U_salario_bruto * 0.05'),
    }

    # Contexto inicial (Simulando o que vem do get_event_vars_master)
    vars_dict = {
        'F_salario': 5000.00,
        'H_faltas': FrequenciaMock().H_faltas,
        'H_horas_extras': FrequenciaMock().H_horas_extras,
    }

    print(f"Contexto Inicial: {vars_dict}")

    # Passo 1: Resolver Grafo
    try:
        ordem = dependence_resolve(regras)
        print(f"Ordem de Cálculo Gerada: {ordem}")
    except Exception as e:
        print(f"ERRO NO GRAFO: {e}")
        return

    # Passo 2: Executar Engine
    aeval = get_interpreter()
    resultado, erros = engine_run(aeval, vars_dict, ordem, regras)

    if erros:
        print(f"ERROS DE CÁLCULO: {erros}")
    else:
        print("\n--- Resultados Finais ---")
        print(f"U_salario_bruto: {resultado.get('U_salario_bruto')}")
        print(f"U_gratificacao: {resultado.get('U_gratificacao')}")
        print(f"U_inss: {resultado.get('U_inss')}")
        
        # Validação manual rápida:
        # Bruto: 5000 - (2 * 100) = 4800
        # Grat: 4800 * 0.05 = 240
        # INSS: (4800 + 240) * 0.11 = 554.4
        if resultado.get('U_inss') == 554.4:
            print("\n✅ SUCESSO: O cálculo e as dependências estão perfeitos!")
        else:
            print("\n❌ AVISO: O valor calculado diverge do esperado.")

class FolhaMotorTest(TestCase):
    def test_calculo_encadeado_com_sucesso(self):
        """Valida se o motor calcula U_inss dependendo de U_bruto corretamente."""
        
        # 1. Mock de Regras (Simulando banco de dados)
        class Regra:
            def __init__(self, valor): self.valor = valor

        regras = {
            'U_inss': Regra('U_bruto * 0.11'),
            'U_bruto': Regra('F_salario - 200'),
        }

        # 2. Contexto inicial (Simulando propriedades do modelo)
        vars_dict = {'F_salario': 5000.00}

        # 3. Execução
        ordem = dependence_resolve(regras)
        aeval = get_interpreter()
        resultado, erros = engine_run(aeval, vars_dict, ordem, regras)

        # 4. Asserts (Validações)
        self.assertEqual(len(erros), 0, f"Erros encontrados: {erros}")
        self.assertEqual(ordem, ['U_bruto', 'U_inss']) # Valida se o grafo ordenou certo
        self.assertEqual(resultado['U_bruto'], 4800.00)
        self.assertEqual(resultado['U_inss'], 528.00) # 4800 * 0.11




if __name__ == "__main__":
    testar_motor_folha()
