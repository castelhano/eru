# folha/tributos.py
"""
Helpers de cálculo de INSS e IRRF.

As tabelas são configuráveis via PessoalSettings (FolhaSettings) com campo
vigencia: date — garante reprocessamento histórico com a tabela correta.
Se nenhuma tabela estiver configurada, usa as tabelas federais embutidas como fallback.

Ordem de cálculo obrigatória: INSS → base IRRF (salário − INSS) → IRRF.
Os valores são injetados no contexto do engine como:
    FM_inss_devido    → float, valor a descontar de INSS
    FM_irrf_devido    → float, valor a descontar de IRRF
    FM_base_inss      → float, salário bruto usado como base INSS
    FM_inss_devido    → float, base tributável após dedução INSS + dependentes
"""
from datetime import date

# ─── Tabelas federais embutidas (fallback) ────────────────────────────────────
# Fonte: tabela vigente a partir de maio/2023 (MP 1.206/2023)
# Atualize via PessoalSettings ao invés de alterar aqui.

_TABELA_INSS_FALLBACK = [
    # (limite_superior, aliquota)
    (1_412.00,  0.075),
    (2_666.68,  0.09),
    (4_000.03,  0.12),
    (7_786.02,  0.14),
]  # acima do último limite → teto: aplica alíquota máxima só até o teto

_TETO_INSS_FALLBACK = 7_786.02

_TABELA_IRRF_FALLBACK = [
    # (limite_superior, aliquota, deducao_fixa)
    (2_259.20,  0.0,    0.00),
    (2_826.65,  0.075,  169.44),
    (3_751.05,  0.15,   381.44),
    (4_664.68,  0.225,  662.77),
    (float('inf'), 0.275, 896.00),
]

_DEDUCAO_DEPENDENTE_FALLBACK = 189.59


# ─── Helpers de tabela vigente ────────────────────────────────────────────────

def get_tabela_vigente(tabelas: list, competencia: date):
    """
    Retorna a tabela com vigencia <= competencia mais recente.
    Retorna None se nenhuma tabela estiver configurada para o período.
    """
    candidatas = [t for t in (tabelas or []) if t.vigencia <= competencia]
    return max(candidatas, key=lambda t: t.vigencia, default=None)


# ─── Cálculo de INSS ──────────────────────────────────────────────────────────

def calcular_inss(salario_bruto: float, competencia: date, tabela_cfg=None) -> dict:
    """
    Calcula INSS pelo regime progressivo (Lei 8.212/91 + RFB).

    Retorna:
        base_inss   → salário bruto limitado ao teto
        inss_devido → valor total a descontar
    """
    salario = float(salario_bruto or 0)

    if tabela_cfg:
        # tabela configurada via PessoalSettings
        faixas = [(f.limite, f.aliquota) for f in tabela_cfg.faixas]
        teto   = faixas[-1][0] if faixas else _TETO_INSS_FALLBACK
    else:
        faixas = _TABELA_INSS_FALLBACK
        teto   = _TETO_INSS_FALLBACK

    base = min(salario, teto)  # INSS não incide acima do teto
    inss = 0.0
    anterior = 0.0

    for limite, aliquota in faixas:
        if base <= anterior:
            break
        faixa_atual = min(base, limite) - anterior
        inss       += faixa_atual * aliquota
        anterior    = limite

    return {
        'FM_base_inss':   round(base, 2),
        'FM_inss_devido': round(inss, 2),
    }


# ─── Cálculo de IRRF ──────────────────────────────────────────────────────────

def calcular_irrf(salario_bruto: float, inss_devido: float, num_dependentes: int, competencia: date, tabela_cfg=None) -> dict:
    """
    Calcula IRRF sobre rendimentos do trabalho (RIR/2018).

    Base tributável = salário bruto − INSS − (dependentes × dedução/dependente)
    Retorna:
        FM_base_irrf   → base tributável após deduções
        FM_irrf_devido → valor a descontar (zero se base negativa)
    [ * ] Competencia injetada na assinatura e não usada, mantido para uso futuro
    (regras de isenção que variam por data, como isenção para maiores de 65 anos que tem base legal)
    """
    if tabela_cfg:
        faixas             = [(f.limite, f.aliquota, f.deducao) for f in tabela_cfg.faixas]
        deducao_dependente = float(tabela_cfg.deducao_dependente)
    else:
        faixas             = _TABELA_IRRF_FALLBACK
        deducao_dependente = _DEDUCAO_DEPENDENTE_FALLBACK

    base = float(salario_bruto or 0) - float(inss_devido or 0) - (num_dependentes * deducao_dependente)
    base = max(base, 0.0)  # base negativa → isento

    irrf = 0.0
    for limite, aliquota, deducao_fixa in faixas:
        if base <= limite:
            irrf = base * aliquota - deducao_fixa
            break

    return {
        'FM_base_irrf':   round(base, 2),
        'FM_irrf_devido': round(max(irrf, 0.0), 2),
    }


# ─── Entry point: calcula ambos e retorna contexto pronto para injeção ────────

def calcular_tributos(salario_bruto: float, num_dependentes: int, competencia: date, settings_obj=None) -> dict:
    """
    Calcula INSS e IRRF e retorna dict pronto para injeção no contexto do engine.

    Uso em run_single:
        tributos = calcular_tributos(
            salario_bruto  = contrato.funcionario.salario,
            num_dependentes= contrato.funcionario.dependentes.filter(deduz_irrf=True).count(),
            competencia    = competencia,
            settings_obj   = settings_obj,
        )
        vars_dict.update(tributos)

    Variáveis disponíveis nas fórmulas após injeção:
        FM_inss_devido, FM_irrf_devido, FM_base_inss, FM_base_irrf
    """
    # busca tabelas configuradas se settings disponível
    tabela_inss_cfg = None
    tabela_irrf_cfg = None
    if settings_obj:
        cfg_folha = getattr(settings_obj.config, 'folha', None)
        if cfg_folha:
            tabela_inss_cfg = get_tabela_vigente(
                getattr(cfg_folha, 'tabela_inss', []), competencia
            )
            tabela_irrf_cfg = get_tabela_vigente(
                getattr(cfg_folha, 'tabela_irrf', []), competencia
            )

    resultado_inss = calcular_inss(salario_bruto, competencia, tabela_inss_cfg)
    resultado_irrf = calcular_irrf(
        salario_bruto   = salario_bruto,
        inss_devido     = resultado_inss['FM_inss_devido'],
        num_dependentes = num_dependentes,
        competencia     = competencia,
        tabela_cfg      = tabela_irrf_cfg,
    )
    return {**resultado_inss, **resultado_irrf}