import os
import django
import math
from decimal import Decimal
from datetime import date

# 1. Configuração do Ambiente
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'seu_projeto.settings')
django.setup()

from django.test import TestCase
from django.db import transaction
from pessoal.folha.engine import get_interpreter, dependence_resolve, engine_run
from pessoal.folha.persistence import payroll_memory

# ==============================================================================
# MOCKS PARA SIMULAÇÃO DO AMBIENTE
# ==============================================================================

class FrequenciaMock:
    """Simula o modelo FrequenciaConsolidada e seu JSONField 'consolidado'"""
    def __init__(self):
        self.consolidado = {
            'H_faltas': 2,
            'H_horas_extras': 10.5
        }

class EventoMock:
    """Simula o modelo Evento"""
    def __init__(self, rastreio, nome, tipo='P'):
        self.rastreio = rastreio
        self.nome = nome
        self.tipo = tipo # 'P' Provento, 'D' Desconto

class RegraBaseMock:
    """Simula as classes EventoFuncionario, EventoCargo ou EventoEmpresa"""
    def __init__(self, id, rastreio, valor, tipo='P'):
        self.id = id
        self.valor = str(valor)
        self.evento = EventoMock(rastreio, f"Evento {rastreio}", tipo)

class EventoFuncionario(RegraBaseMock): pass # Simula nome da classe para persistence.py

# ==============================================================================
# SCRIPT DE TESTE FUNCIONAL (MODO SCRIPT)
# ==============================================================================

def testar_motor_folha_manual():
    print("\n" + "="*50)
    print("INICIANDO TESTE MANUAL DO MOTOR DE FOLHA")
    print("="*50 + "\n")

    # CENÁRIO:
    # U_bruto = Salário(5000) - Faltas(2 * 100) = 4800
    # U_gratificacao = 4800 * 0.05 = 240
    # U_inss (Desconto) = (4800 + 240) * 0.11 = 554.40
    
    regras = {
        'U_inss': EventoFuncionario(1, 'U_inss', '(U_salario_bruto + U_gratificacao) * 0.11', 'D'),
        'U_salario_bruto': EventoFuncionario(2, 'U_salario_bruto', 'F_salario - (H_faltas * 100)'),
        'U_gratificacao': EventoFuncionario(3, 'U_gratificacao', 'U_salario_bruto * 0.05'),
    }

    # Contexto simulado (Vem do get_event_vars_master)
    freq = FrequenciaMock()
    vars_dict = {
        'F_salario': 5000.00,
        'H_faltas': freq.consolidado['H_faltas'],
        'H_horas_extras': freq.consolidado['H_horas_extras'],
    }

    print(f"[*] Contexto de Entrada: {vars_dict}")

    # 1. RESOLVER GRAFO (Engine)
    try:
        ordem = dependence_resolve(regras)
        print(f"[*] Ordem de Cálculo: {ordem}")
    except Exception as e:
        print(f"[-] ERRO NO GRAFO: {e}")
        return

    # 2. EXECUTAR ENGINE (Engine)
    aeval = get_interpreter()
    resultado_final, erros = engine_run(aeval, vars_dict, ordem, regras)

    if erros:
        print(f"[-] ERROS DE CÁLCULO: {erros}")
        return

    # 3. GERAR MEMÓRIA DE CÁLCULO (Persistence)
    try:
        memoria = payroll_memory(resultado_final, regras, erros)
        print("[+] Memória de Cálculo (JSON) gerada com sucesso.")
    except Exception as e:
        print(f"[-] ERRO NA PERSISTÊNCIA: {e}")
        return

    # 4. VALIDAÇÃO DOS RESULTADOS
    bruto = resultado_final.get('U_salario_bruto')
    grat = resultado_final.get('U_gratificacao')
    inss = resultado_final.get('U_inss')

    print(f"\n--- Tabela de Resultados ---")
    print(f"Bruto:        R$ {bruto:>10.2f}")
    print(f"Gratificação: R$ {grat:>10.2f}")
    print(f"INSS (Desc):  R$ {inss:>10.2f}")
    
    liquido_esperado = (4800 + 240) - 554.40
    liquido_calc = (float(bruto) + float(grat)) - float(inss)

    if math.isclose(liquido_calc, liquido_esperado, rel_tol=1e-5):
        print("\n✅ SUCESSO: O motor calculou os valores encadeados corretamente!")
    else:
        print(f"\n❌ ERRO: Valor líquido {liquido_calc} diverge do esperado {liquido_esperado}")

# ==============================================================================
# CLASSE DE TESTE UNITÁRIO (DJANGO TEST CASE)
# ==============================================================================

class FolhaMotorTest(TestCase):
    def setUp(self):
        self.aeval = get_interpreter()

    def test_dependencia_e_calculo(self):
        """Valida se o INSS é calculado após o Bruto em um fluxo real"""
        regras = {
            'U_inss': EventoFuncionario(10, 'U_inss', 'U_bruto * 0.11', 'D'),
            'U_bruto': EventoFuncionario(11, 'U_bruto', 'F_salario - 200'),
        }
        vars_dict = {'F_salario': 5000.00}

        ordem = dependence_resolve(regras)
        resultado, erros = engine_run(self.aeval, vars_dict, ordem, regras)

        # Asserts
        self.assertEqual(len(erros), 0)
        self.assertEqual(ordem, ['U_bruto', 'U_inss']) # Valida precedência
        self.assertAlmostEqual(float(resultado['U_inss']), 528.00)

    def test_erro_sintaxe_formula(self):
        """Valida se o motor captura erros de fórmulas mal escritas sem travar"""
        regras = {
            'U_erro': EventoFuncionario(20, 'U_erro', 'F_salario / 0'), # Divisão por zero
        }
        vars_dict = {'F_salario': 5000.00}
        ordem = ['U_erro']
        
        resultado, erros = engine_run(self.aeval, vars_dict, ordem, regras)
        self.assertIn('U_erro', erros)
        self.assertEqual(resultado['U_erro'], 0) # Engine deve zerar o valor com erro

if __name__ == "__main__":
    testar_motor_folha_manual()
