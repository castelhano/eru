"""
services/ferias/services.py — Geração e cálculo de períodos de férias.

Responsabilidades:
  1. gerar_periodo_aquisitivo  — cria FeriasAquisitivo com dias_direito e regras calculados
  2. registrar_gozo            — cria FeriasGozo com valor calculado em regras
  3. gerar_periodos_historicos — reconstrói todos os períodos aquisitivos desde a admissão
                                 (útil ao implantar o módulo com funcionários já existentes)

Fonte de dados para cálculo:
  - FrequenciaConsolidada: faltas injustificadas (H_dias_falta_njust) e afastamentos
  - Contrato: salário base e carga mensal para médias
  - EventoFuncionario: horas extras habituais (Súmula 151 TST)
"""
import calendar
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from django.db import transaction
from django.db.models import Avg, Sum

from pessoal.models import (
    Funcionario, Contrato, FrequenciaConsolidada, FeriasAquisitivo, FeriasGozo,
)
from pessoal.models import TABELA_FERIAS_CLT, dias_direito_por_faltas

_CENT = Decimal('0.01')


def _dec(val) -> Decimal:
    return Decimal(str(val)).quantize(_CENT, rounding=ROUND_HALF_UP)


# ─── 1. Período aquisitivo ────────────────────────────────────────────────────

@transaction.atomic
def gerar_periodo_aquisitivo(funcionario: Funcionario, contrato: Contrato,
                              inicio: date) -> FeriasAquisitivo:
    """
    Cria ou atualiza um FeriasAquisitivo para o período iniciado em `inicio`.
    Calcula dias_direito consultando FrequenciaConsolidada do período.
    Popula regras com memória completa do cálculo.
    """
    fim               = _fim_periodo(inicio)
    inicio_concessivo = fim + timedelta(days=1)
    fim_concessivo    = _fim_periodo(inicio_concessivo)  # mais 12 meses

    # coleta faltas e afastamentos do período aquisitivo via consolidados
    resumo = _resumo_periodo(contrato, inicio, fim)

    dias_direito = dias_direito_por_faltas(resumo['faltas_injustificadas'])

    regras = {
        'dias_direito_base':       30,
        'faltas_injustificadas':   resumo['faltas_injustificadas'],
        'dias_direito_final':      dias_direito,
        'tabela_faltas_aplicada':  _faixa_tabela(resumo['faltas_injustificadas']),
        'dias_afastamento':        resumo['dias_afastamento'],
        'periodo_suspenso':        resumo['dias_afastamento'] > 180,  # >6 meses reinicia
        'consolidados_consultados': resumo['competencias'],
    }

    obj, _ = FeriasAquisitivo.objects.update_or_create(
        funcionario=funcionario,
        inicio=inicio,
        defaults={
            'contrato':          contrato,
            'fim':               fim,
            'inicio_concessivo': inicio_concessivo,
            'fim_concessivo':    fim_concessivo,
            'dias_direito':      dias_direito,
            'regras':            regras,
            # status: DISPONIVEL se período já encerrou, ABERTO se ainda em curso
            'status': (FeriasAquisitivo.Status.DISPONIVEL
                       if date.today() > fim
                       else FeriasAquisitivo.Status.ABERTO),
        }
    )
    return obj


# ─── 2. Gozo ─────────────────────────────────────────────────────────────────

@transaction.atomic
def registrar_gozo(aquisitivo: FeriasAquisitivo, inicio: date, fim: date,
                   abono_pecuniario: bool = False,
                   adiantamento_13: bool = False,
                   remunerado: bool = True,
                   observacao: str = '') -> FeriasGozo:
    """
    Registra um período de gozo e calcula o valor a pagar (regras).
    Delega validações de negócio ao clean() do model.
    """
    dias       = (fim - inicio).days + 1
    dias_abono = 10 if abono_pecuniario else 0
    contrato   = aquisitivo.contrato
    salario    = float(contrato.salario)

    regras = _calcular_valor_gozo(
        contrato=contrato,
        aquisitivo=aquisitivo,
        inicio=inicio,
        fim=fim,
        dias=dias,
        dias_abono=dias_abono,
        adiantamento_13=adiantamento_13,
        salario=salario,
    )

    gozo = FeriasGozo(
        aquisitivo=aquisitivo,
        inicio=inicio,
        fim=fim,
        dias=dias,
        abono_pecuniario=abono_pecuniario,
        dias_abono=dias_abono,
        adiantamento_13=adiantamento_13,
        remunerado=remunerado,
        regras=regras,
        observacao=observacao,
    )
    gozo.save()  # full_clean() dentro do save() valida e dispara _sync_status_aquisitivo
    return gozo


# ─── 3. Reconstrução histórica ────────────────────────────────────────────────

@transaction.atomic
def gerar_periodos_historicos(funcionario: Funcionario) -> list[FeriasAquisitivo]:
    """
    Gera todos os períodos aquisitivos desde a admissão até hoje.
    Útil na implantação do módulo para funcionários já existentes.
    Idempotente — usa update_or_create internamente.
    """
    admissao = funcionario.data_admissao
    if not admissao:
        return []

    periodos = []
    inicio   = admissao
    hoje     = date.today()

    # contrato vigente em cada início de período — usa o mais recente anterior ao início
    while inicio <= hoje:
        contrato = (
            funcionario.contratos
            .filter(inicio__lte=inicio)
            .filter(__import__('django.db.models', fromlist=['Q']).Q(fim__gte=inicio) |
                    __import__('django.db.models', fromlist=['Q']).Q(fim__isnull=True))
            .order_by('-inicio')
            .first()
        )
        if contrato:
            periodos.append(gerar_periodo_aquisitivo(funcionario, contrato, inicio))
        inicio = _proximo_periodo(inicio)

    return periodos


# ─── helpers privados ────────────────────────────────────────────────────────

def _fim_periodo(inicio: date) -> date:
    """Retorna o último dia do período de 12 meses iniciado em `inicio`."""
    ano  = inicio.year + (1 if inicio.month == 12 else 0)
    mes  = 1 if inicio.month == 12 else inicio.month + 1
    # mesmo dia do mês seguinte ao 12º mês, menos 1 dia
    return date(inicio.year + 1, inicio.month, inicio.day) - timedelta(days=1)


def _proximo_periodo(inicio: date) -> date:
    """Retorna o início do próximo período aquisitivo (exatamente +1 ano)."""
    try:
        return inicio.replace(year=inicio.year + 1)
    except ValueError:
        # 29/fev em ano não bissexto → usa 28/fev
        return inicio.replace(year=inicio.year + 1, day=28)


def _resumo_periodo(contrato: Contrato, inicio: date, fim: date) -> dict:
    """
    Agrega faltas injustificadas e dias de afastamento dos consolidados
    que cobrem o período aquisitivo. Uma query por tipo de dado.
    """
    consolidados = FrequenciaConsolidada.objects.filter(
        contrato=contrato,
        competencia__gte=inicio.replace(day=1),
        competencia__lte=fim,
    )
    agg = consolidados.aggregate(
        faltas=Sum('consolidado__H_dias_falta_njust'),
        afastamento=Sum('consolidado__H_dias_afastamento'),
    )
    competencias = list(
        consolidados.values_list('competencia', flat=True).order_by('competencia')
    )
    return {
        'faltas_injustificadas': int(agg['faltas'] or 0),
        'dias_afastamento':      int(agg['afastamento'] or 0),
        'competencias':          [str(c) for c in competencias],
    }


def _faixa_tabela(faltas: int) -> str:
    """Retorna a faixa da tabela CLT aplicada como string para auditoria."""
    for limite, dias in TABELA_FERIAS_CLT:
        if faltas <= limite:
            return f'0-{limite}' if limite == 5 else f'{TABELA_FERIAS_CLT[TABELA_FERIAS_CLT.index((limite, dias)) - 1][0] + 1}-{limite}'
    return '>32'


def _calcular_valor_gozo(contrato, aquisitivo, inicio, fim, dias,
                          dias_abono, adiantamento_13, salario) -> dict:
    """
    Calcula o valor bruto do gozo de férias.

    Base = salário + média de horas extras habituais (Súmula 151 TST)
           + média de adicional noturno habitual

    Fórmula:
      valor_ferias = (salario_base / 30) * dias
      valor_terco  = valor_ferias / 3
      valor_abono  = (salario_base / 30) * dias_abono  (se abono_pecuniario)
    """
    # médias dos últimos 12 meses anteriores ao início do gozo — Súmula 151 TST
    competencia_limite = inicio.replace(day=1)
    competencia_inicio = date(
        competencia_limite.year - 1 if competencia_limite.month == 1 else competencia_limite.year,
        12 if competencia_limite.month == 1 else competencia_limite.month - 1,
        1
    )
    consolidados_base = FrequenciaConsolidada.objects.filter(
        contrato=contrato,
        competencia__gte=competencia_inicio,
        competencia__lt=competencia_limite,
    )
    agg = consolidados_base.aggregate(
        media_he=Avg('consolidado__H_horas_extras'),
        media_noturno=Avg('consolidado__H_horas_noturnas'),
    )

    media_he      = float(agg['media_he'] or 0)
    media_noturno = float(agg['media_noturno'] or 0)

    # valor hora para calcular integração das médias
    salario_hora  = salario / contrato.carga_mensal if contrato.carga_mensal else 0

    # adicional de HE habitual — usa percentual padrão 50% (pode variar por acordo)
    # TODO: ler percentual do EventoFuncionario/Cargo quando implementado
    adicional_he      = float(_dec(media_he * salario_hora * 0.5))
    adicional_noturno = float(_dec(media_noturno * salario_hora * 0.2))  # 20% CLT

    salario_base  = float(_dec(salario + adicional_he + adicional_noturno))
    valor_ferias  = float(_dec(salario_base / 30 * dias))
    valor_terco   = float(_dec(valor_ferias / 3))
    valor_abono   = float(_dec(salario_base / 30 * dias_abono)) if dias_abono else 0.0
    valor_total   = float(_dec(valor_ferias + valor_terco + valor_abono))

    return {
        'salario_base':        salario,
        'media_he_mensal':     round(media_he, 4),
        'media_noturno_mensal': round(media_noturno, 4),
        'adicional_he':        adicional_he,
        'adicional_noturno':   adicional_noturno,
        'salario_base_total':  salario_base,
        'dias_gozo':           dias,
        'dias_abono':          dias_abono,
        'valor_ferias':        valor_ferias,
        'valor_terco':         valor_terco,
        'valor_abono':         valor_abono,
        'valor_total':         valor_total,
        'adiantamento_13':     adiantamento_13,
        'competencias_base':   [str(competencia_inicio), str(competencia_limite)],
    }
