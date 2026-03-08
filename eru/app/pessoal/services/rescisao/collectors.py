"""
collectors.py — Coleta de dados para cálculo de rescisão.

Responsabilidade única: buscar e estruturar tudo que o engine precisa,
sem nenhuma lógica de cálculo. Segue o mesmo padrão de folha/collectors.py.
"""
from datetime import date
from django.db.models import Min, Q, Sum
from pessoal.models import (
    Funcionario, Contrato, EventoEmpresa, EventoCargo, EventoFuncionario,
    FrequenciaConsolidada, Afastamento, FeriasAquisitivo,
)


def get_dados_rescisao(funcionario: Funcionario, contrato: Contrato, data_desligamento: date) -> dict:
    """
    Ponto de entrada único para o engine.
    Retorna dict com tudo necessário para calcular todas as verbas rescisórias.
    Uma chamada por rescisão — sem N+1.
    """
    # Data de admissão real: campo do funcionário tem prioridade.
    # Fallback: início do primeiro contrato (Min garante uma query, não N+1).
    data_admissao = funcionario.data_admissao or _get_primeira_admissao(funcionario)

    return {
        'funcionario':        funcionario,
        'contrato':           contrato,
        'data_desligamento':  data_desligamento,
        'consolidado_atual':  _get_consolidado_mes(contrato, data_desligamento),
        'afastamentos':       _get_afastamentos(funcionario, data_admissao, data_desligamento),
        'eventos':            _get_eventos(funcionario, contrato, data_desligamento),
        'saldo_ferias':       _get_saldo_ferias(funcionario, data_admissao, data_desligamento),
    }


# ─── helpers privados ────────────────────────────────────────────────────────

def _get_primeira_admissao(funcionario: Funcionario) -> date | None:
    """
    Retorna o início do contrato mais antigo do funcionário.
    Usado como fallback quando data_admissao não está preenchida no cadastro.
    Min em query única — sem carregar todos os contratos em memória.
    """
    resultado = Contrato.objects.filter(funcionario=funcionario).aggregate(Min('inicio'))
    return resultado['inicio__min']


def _get_consolidado_mes(contrato: Contrato, data_desligamento: date) -> FrequenciaConsolidada | None:
    """Consolidado da competência corrente — pode ser None se freq não foi processada."""
    competencia = data_desligamento.replace(day=1)
    return (
        FrequenciaConsolidada.objects
        .filter(contrato=contrato, competencia=competencia)
        .first()
    )


def _get_afastamentos(funcionario: Funcionario, admissao: date, desligamento: date) -> list:
    """
    Todos os afastamentos desde a admissão até o desligamento.
    Usados para calcular dias efetivos e impacto em férias/13º.
    """
    return list(
        Afastamento.objects.filter(
            funcionario=funcionario,
            data_afastamento__lte=desligamento,
        ).filter(
            Q(data_retorno__isnull=True) | Q(data_retorno__gte=admissao)
        ).order_by('data_afastamento')
    )


def _get_eventos(funcionario: Funcionario, contrato: Contrato, data_desligamento: date) -> dict:
    """
    Eventos ativos na data de desligamento — mesma precedência do motor de folha:
    Funcionario > Cargo > Empresa.
    Retorna dict {rastreio: EventoMovimentacao} pronto para o engine.
    """
    vigencia = Q(inicio__lte=data_desligamento) & (Q(fim__gte=data_desligamento) | Q(fim__isnull=True))

    ev_e = {e.evento.rastreio: e for e in
            EventoEmpresa.objects.filter(filiais=funcionario.filial_id).filter(vigencia).select_related('evento')}

    ev_c = {e.evento.rastreio: e for e in
            EventoCargo.objects.filter(cargo=contrato.cargo).filter(vigencia).select_related('evento')} if contrato.cargo_id else {}

    ev_f = {e.evento.rastreio: e for e in
            EventoFuncionario.objects.filter(funcionario=funcionario).filter(vigencia).select_related('evento')}

    # merge com precedência crescente
    return {**ev_e, **ev_c, **ev_f}


def _get_saldo_ferias(funcionario: Funcionario, data_admissao: date,
                      data_desligamento: date) -> dict:
    """
    Calcula saldo real de férias consultando FeriasAquisitivo.
    Fallback para cálculo estimado se não houver períodos cadastrados.
    """
    # tenta usar períodos aquisitivos reais — fonte confiável
    aquisitivos_pendentes = FeriasAquisitivo.objects.filter(
        funcionario=funcionario,
        status__in=[FeriasAquisitivo.Status.DISPONIVEL, FeriasAquisitivo.Status.PARCIAL],
    )
    if aquisitivos_pendentes.exists():
        # dias reais disponíveis considerando gozos já registrados
        dias_vencidos = sum(a.dias_disponiveis for a in aquisitivos_pendentes)
        return {
            'admissao':             data_admissao,
            'meses_periodo_atual':  _meses_periodo_atual(data_admissao, data_desligamento),
            'periodos_completos':   0,        # não usado quando dias_vencidos está preenchido
            'dias_vencidos':        dias_vencidos,
            'ferias_vencidas':      dias_vencidos > 0,
            'fonte':                'aquisitivo_real',
        }

    # fallback: estimativa por meses quando módulo de férias não foi implantado
    meses_total = (
        (data_desligamento.year - data_admissao.year) * 12
        + (data_desligamento.month - data_admissao.month)
        - (1 if data_desligamento.day < data_admissao.day else 0)
    )
    periodos_completos  = meses_total // 12
    return {
        'admissao':             data_admissao,
        'meses_periodo_atual':  meses_total % 12,
        'periodos_completos':   periodos_completos,
        'dias_vencidos':        periodos_completos * 30,  # estimativa — sem controle de gozo
        'ferias_vencidas':      periodos_completos > 0,
        'fonte':                'estimado',   # auditoria: indica que é fallback
    }


def _meses_periodo_atual(admissao: date, desligamento: date) -> int:
    """Meses no período aquisitivo atual (0–11)."""
    meses_total = (
        (desligamento.year - admissao.year) * 12
        + (desligamento.month - admissao.month)
        - (1 if desligamento.day < admissao.day else 0)
    )
    return meses_total % 12
