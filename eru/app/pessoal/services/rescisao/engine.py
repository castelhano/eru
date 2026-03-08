"""
engine.py — Cálculo puro das verbas rescisórias.

Sem efeitos colaterais: todas as funções recebem dados e retornam dicts.
Compatível com dry_run — o services.py decide se persiste ou não.

Estrutura do dict retornado por calcular_rescisao():
{
  "contexto": { ...todos os inputs usados como base... },
  "verbas": [
    {
      "nome": str, "rastreio": str, "tipo": "P"|"D"|"R",
      "valor": float, "formula": str, "detalhes": dict
    }
  ],
  "frequencia_base": { ...snapshot do consolidado... } | None,
  "total_bruto": float,
  "total_liquido": float,
  "erros": { rastreio: motivo }
}
"""
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

_CENT = Decimal('0.01')  # quantizador padrão para valores monetários


def _dec(val) -> Decimal:
    """Converte float/int para Decimal quantizado em 2 casas — evita ruído de ponto flutuante."""
    return Decimal(str(val)).quantize(_CENT, rounding=ROUND_HALF_UP)


# Frações de aviso prévio proporcional (CLT art. 487 + Lei 12.506/2011)
_DIAS_BASE_AVISO = 30
_DIAS_EXTRA_ANO  = 3    # +3 dias por ano completo trabalhado, máx 60 dias extras


def calcular_rescisao(dados: dict) -> dict:
    """
    Orquestra o cálculo de todas as verbas.
    `dados` é o dict retornado por collectors.get_dados_rescisao().
    """
    from pessoal.models import Rescisao  # import local evita circular
    contrato         = dados['contrato']
    funcionario      = dados['funcionario']
    rescisao_obj     = dados.get('rescisao_obj')  # instância de Rescisao (pode ser None em dry_run)
    data_deslig      = dados['data_desligamento']
    motivo           = rescisao_obj.motivo if rescisao_obj else dados.get('motivo', '')
    saldo_ferias     = dados['saldo_ferias']
    consolidado      = dados['consolidado_atual']

    salario          = float(contrato.salario)
    dias_empresa     = funcionario.F_dias_empresa
    anos_completos   = dias_empresa // 365

    # flags definidas pelo usuário no formulário de rescisão
    # se rescisao_obj não disponível (dry_run sem instância), assume True para todos
    flags = _extrair_flags(rescisao_obj, motivo)

    erros  = {}
    verbas = []

    # ── contexto de auditoria ─────────────────────────────────────────────────

    contexto = {
        'funcionario_id':    funcionario.pk,
        'matricula':         funcionario.matricula,
        'contrato_id':       contrato.pk,
        'cargo':             str(contrato.cargo) if contrato.cargo else None,
        'regime':            contrato.regime,
        'salario':           salario,
        'carga_mensal':      contrato.carga_mensal,
        # data_admissao vem do funcionário — contrato.inicio pode ser posterior (recontrato)
        'data_admissao':     funcionario.data_admissao or contrato.inicio,
        'data_desligamento': data_deslig,
        'dias_empresa':      dias_empresa,
        'anos_completos':    anos_completos,
        'motivo':            motivo,
        'motivo_display':    dict(Rescisao.MotivoDesligamento.choices).get(motivo, motivo),
        'meses_ferias':      saldo_ferias['meses_periodo_atual'],
        'ferias_vencidas':   saldo_ferias['ferias_vencidas'],
        'ferias_fonte':      saldo_ferias.get('fonte', 'estimado'),  # auditoria
        'flags_usuario':     {k: v for k, v in flags.items() if k != '_rescisao_obj'},
        'flags_divergentes': _detectar_divergencias(flags, motivo),  # divergências da regra CLT
    }

    # ── aviso prévio ──────────────────────────────────────────────────────────
    # PD + Trabalhado/Dispensado: sem verba. PD + Indenizado: desconto D — passa para _calcular_aviso.
    # A função decide internamente se gera P ou D com base no aviso_tipo.
    _aviso_tipo = getattr(rescisao_obj, 'aviso_tipo', None) if rescisao_obj else None
    _pd_indenizado = (motivo == Rescisao.MotivoDesligamento.PEDIDO and
                      _aviso_tipo == Rescisao.AvisoPrevioTipo.INDENIZADO)
    if flags['aviso'] and (motivo != Rescisao.MotivoDesligamento.PEDIDO or _pd_indenizado):
        _calcular_aviso(rescisao_obj, salario, anos_completos, verbas, erros, flags)

    # ── saldo de salário — sempre devido ──────────────────────────────────────
    _calcular_saldo_salario(contrato, data_deslig, salario, verbas, erros)

    # ── férias proporcionais ──────────────────────────────────────────────────
    if flags['ferias_proporcionais']:
        _calcular_ferias_proporcionais(
            saldo_ferias['meses_periodo_atual'], salario, verbas, erros
        )

    # ── férias vencidas ───────────────────────────────────────────────────────
    if flags['ferias_vencidas'] and saldo_ferias['ferias_vencidas']:
        _calcular_ferias_vencidas(
            saldo_ferias['dias_vencidos'], salario, verbas, erros
        )

    # ── 13º proporcional ─────────────────────────────────────────────────────
    if flags['decimo_terceiro']:
        _calcular_decimo_terceiro(data_deslig, salario, verbas, erros)

    # ── multa FGTS ────────────────────────────────────────────────────────────
    if flags['multa_fgts']:
        _calcular_multa_fgts(dados, salario, dias_empresa, motivo, verbas, erros)

    # ── totais — Decimal evita ruído de ponto flutuante na soma de verbas ──────
    total_bruto   = sum((_dec(v['valor']) for v in verbas if v['tipo'] == 'P'), Decimal('0'))
    total_desconto = sum((_dec(v['valor']) for v in verbas if v['tipo'] == 'D'), Decimal('0'))
    total_liquido = total_bruto - total_desconto

    return {
        'contexto':         contexto,
        'verbas':           verbas,
        'frequencia_base':  _snapshot_consolidado(consolidado),
        # float com exatamente 2 casas — DecimalField(decimal_places=2) valida isso
        'total_bruto':      float(total_bruto),
        'total_liquido':    float(total_liquido),
        'erros':            erros,
    }


# ─── verbas individuais ───────────────────────────────────────────────────────

def _calcular_aviso(rescisao_obj, salario: float, anos_completos: int,
                    verbas: list, erros: dict, flags: dict = None) -> None:
    """
    Aviso prévio — comportamento por motivo e tipo:

    EM/RI/AB + Trabalhado  → sem verba (já remunerado pelo salário)
    EM/RI/AB + Indenizado  → provento P (empresa paga dias não trabalhados)
    EM/RI/AB + Dispensado  → sem verba (empresa dispensou sem ônus)
    PD       + Trabalhado  → sem verba
    PD       + Dispensado  → sem verba (empresa abriu mão do cumprimento)
    PD       + Indenizado  → desconto D (funcionário não cumpriu, empresa desconta)
    """
    from pessoal.models import Rescisao
    try:
        tipo_aviso = rescisao_obj.aviso_tipo
        motivo     = rescisao_obj.motivo
        T  = Rescisao.AvisoPrevioTipo.TRABALHADO
        I  = Rescisao.AvisoPrevioTipo.INDENIZADO
        D  = Rescisao.AvisoPrevioTipo.DISPENSADO
        PD = Rescisao.MotivoDesligamento.PEDIDO

        # trabalhado ou dispensado — sem verba em qualquer motivo
        if tipo_aviso in (T, D):
            return

        # dias devidos:
        #   PD  → sempre 30 (aviso é obrigação do funcionário, sem proporcionalidade)
        #   demais → proporcional Lei 12.506 (30 + 3×anos, máx 90), mas respeita
        #            aviso_dias_devidos se o usuário informou valor diferente
        if motivo == PD:
            dias_devidos_clt = 30
        else:
            dias_devidos_clt = min(_DIAS_BASE_AVISO + _DIAS_EXTRA_ANO * anos_completos, 90)

        # respeita o que o usuário informou — registra divergência se diferente
        dias_devidos_usuario = rescisao_obj.aviso_dias_devidos or 0
        if dias_devidos_usuario and dias_devidos_usuario != dias_devidos_clt:
            dias_devidos  = dias_devidos_usuario
            aviso_diverge = {'dias_devidos': {'usuario': dias_devidos_usuario, 'clt': dias_devidos_clt}}
        else:
            dias_devidos  = dias_devidos_clt
            aviso_diverge = {}

        dias_cumpridos   = rescisao_obj.aviso_dias_cumpridos or 0
        dias_indenizados = max(dias_devidos - dias_cumpridos, 0)

        if dias_indenizados == 0:
            return

        valor = float(_dec(salario / 30 * dias_indenizados))
        detalhes = {
            'dias_devidos':      dias_devidos,
            'dias_devidos_clt':  dias_devidos_clt,
            'dias_cumpridos':    dias_cumpridos,
            'dias_indenizados':  dias_indenizados,
            'anos_completos':    anos_completos,
            'tipo_aviso':        tipo_aviso,
            **({'divergencia': aviso_diverge} if aviso_diverge else {}),
        }

        if motivo == PD and tipo_aviso == I:
            # PD + indenizado → desconto: funcionário deve à empresa
            verbas.append({
                'nome':     'Aviso Prévio — Desconto (não cumprido)',
                'rastreio': 'aviso_desconto',
                'tipo':     'D',
                'valor':    valor,
                'formula':  f'salario / 30 * {dias_indenizados}',
                'detalhes': detalhes,
            })
        else:
            # EM/RI/AB + indenizado → provento: empresa paga ao funcionário
            verbas.append({
                'nome':     'Aviso Prévio Indenizado',
                'rastreio': 'aviso_previo',
                'tipo':     'P',
                'valor':    valor,
                'formula':  f'salario / 30 * {dias_indenizados}',
                'detalhes': detalhes,
            })
    except Exception as e:
        erros['aviso_previo'] = str(e)


def _calcular_saldo_salario(contrato, data_deslig: date, salario: float,
                             verbas: list, erros: dict) -> None:
    """Saldo dos dias trabalhados no mês de desligamento."""
    try:
        dias_trabalhados = data_deslig.day
        valor            = float(_dec(salario / 30 * dias_trabalhados))
        verbas.append({
            'nome':     'Saldo de Salário',
            'rastreio': 'saldo_salario',
            'tipo':     'P',
            'valor':    valor,
            'formula':  f'salario / 30 * {dias_trabalhados}',
            'detalhes': {'dias_trabalhados': dias_trabalhados},
        })
    except Exception as e:
        erros['saldo_salario'] = str(e)


def _calcular_ferias_proporcionais(meses: int, salario: float,
                                    verbas: list, erros: dict) -> None:
    """
    Férias proporcionais + 1/3 constitucional.
    Guard de motivo (JC) tratado pelas flags no caller — não repetir aqui.
    """
    if meses == 0:
        return  # nada a calcular — guard JC já tratado pelas flags no caller
    try:
        valor_ferias = float(_dec(salario / 12 * meses))
        valor_terco  = float(_dec(valor_ferias / 3))
        verbas.append({
            'nome':     'Férias Proporcionais',
            'rastreio': 'ferias_proporcionais',
            'tipo':     'P',
            'valor':    valor_ferias,
            'formula':  f'salario / 12 * {meses}',
            'detalhes': {'meses_aquisitivos': meses},
        })
        verbas.append({
            'nome':     'Férias Proporcionais — 1/3',
            'rastreio': 'ferias_proporcionais_terco',
            'tipo':     'P',
            'valor':    valor_terco,
            'formula':  f'ferias_proporcionais / 3',
            'detalhes': {'base': valor_ferias},
        })
    except Exception as e:
        erros['ferias_proporcionais'] = str(e)


def _calcular_ferias_vencidas(dias_vencidos: int, salario: float,
                               verbas: list, erros: dict) -> None:
    """
    Férias vencidas não gozadas + 1/3.
    Recebe dias_vencidos reais (de FeriasAquisitivo) ou estimados (fallback).
    Guard de motivo (JC) tratado pelas flags no caller — não repetir aqui.
    """
    try:
        valor_ferias = float(_dec(salario / 30 * dias_vencidos))
        valor_terco  = float(_dec(valor_ferias / 3))
        verbas.append({
            'nome':     'Férias Vencidas',
            'rastreio': 'ferias_vencidas',
            'tipo':     'P',
            'valor':    valor_ferias,
            'formula':  f'salario / 30 * {dias_vencidos}',
            'detalhes': {'dias_vencidos': dias_vencidos},
        })
        verbas.append({
            'nome':     'Férias Vencidas — 1/3',
            'rastreio': 'ferias_vencidas_terco',
            'tipo':     'P',
            'valor':    valor_terco,
            'formula':  'ferias_vencidas / 3',
            'detalhes': {'base': valor_ferias},
        })
    except Exception as e:
        erros['ferias_vencidas'] = str(e)


def _calcular_decimo_terceiro(data_deslig: date, salario: float,
                               verbas: list, erros: dict) -> None:
    """
    13º proporcional (meses trabalhados no ano corrente).
    Guard de motivo (JC) tratado pelas flags no caller — não repetir aqui.
    """
    # guard JC já tratado pelas flags no caller
    try:
        meses = data_deslig.month  # meses completos no ano (jan=1 … dez=12)
        valor = float(_dec(salario / 12 * meses))
        verbas.append({
            'nome':     '13º Proporcional',
            'rastreio': 'decimo_terceiro_prop',
            'tipo':     'P',
            'valor':    valor,
            'formula':  f'salario / 12 * {meses}',
            'detalhes': {'meses_trabalhados_ano': meses},
        })
    except Exception as e:
        erros['decimo_terceiro_prop'] = str(e)


def _calcular_multa_fgts(dados: dict, salario: float, dias_empresa: int,
                          motivo: str, verbas: list, erros: dict) -> None:
    """
    Multa FGTS 40% (demissão sem justa causa) ou 20% (rescisão indireta).
    Base simplificada: salario × anos_empresa × 0.08 (depósitos estimados).
    Em produção substituir pela base real do FGTS depositado.
    """
    from pessoal.models import Rescisao
    percentual = None
    if motivo in (Rescisao.MotivoDesligamento.PELO_EMPREGADOR,
                  Rescisao.MotivoDesligamento.ABANDONO):
        percentual = 0.40
    elif motivo == Rescisao.MotivoDesligamento.RESCISAO_INDIRETA:
        percentual = 0.20

    if not percentual:
        return

    try:
        anos            = dias_empresa / 365
        base_fgts_est   = float(_dec(salario * anos * 0.08))  # estimativa de depósitos
        valor           = float(_dec(base_fgts_est * percentual))
        verbas.append({
            'nome':     f'Multa FGTS ({int(percentual * 100)}%)',
            'rastreio': 'multa_fgts',
            'tipo':     'P',
            'valor':    valor,
            'formula':  f'base_fgts_estimada * {percentual}',
            'detalhes': {
                'base_fgts_estimada': base_fgts_est,
                'percentual':         percentual,
                'dias_empresa':       dias_empresa,
                'aviso': 'Base estimada. Substituir pelo saldo real do FGTS.',
            },
        })
    except Exception as e:
        erros['multa_fgts'] = str(e)


# ─── utilidade ────────────────────────────────────────────────────────────────

def _extrair_flags(rescisao_obj, motivo: str) -> dict:
    """
    Extrai os booleanos de pagamento do rescisao_obj.
    Quando não há instância (dry_run), aplica as regras padrão CLT por motivo.
    """
    from pessoal.models import Rescisao
    JC = Rescisao.MotivoDesligamento.POR_JUSTA_CAUSA
    PD = Rescisao.MotivoDesligamento.PEDIDO

    if rescisao_obj:
        return {
            # aviso: True se há dias indenizados — engine decide se é P ou D pelo tipo
            'aviso':               (rescisao_obj.aviso_dias_devidos or 0) > 0,
            'ferias_proporcionais': rescisao_obj.ferias_proporcionais_pagas,
            'ferias_vencidas':      rescisao_obj.ferias_vencidas_pagas,
            'decimo_terceiro':      rescisao_obj.decimo_terceiro_proporcional,
            'multa_fgts':           rescisao_obj.multa_fgts_paga,
            # interno — usado só por _detectar_divergencias para checar aviso_tipo
            '_rescisao_obj':        rescisao_obj,
        }
    # dry_run sem instância — regras padrão CLT
    return {
        'aviso':               motivo not in (JC, PD),
        'ferias_proporcionais': motivo != JC,
        'ferias_vencidas':      True,   # JC mantém vencidas — CLT art. 146
        'decimo_terceiro':      motivo != JC,
        'multa_fgts':           motivo in (
            Rescisao.MotivoDesligamento.PELO_EMPREGADOR,
            Rescisao.MotivoDesligamento.ABANDONO,
            Rescisao.MotivoDesligamento.RESCISAO_INDIRETA,
        ),
    }


def _detectar_divergencias(flags: dict, motivo: str) -> dict:
    """
    Compara as flags do usuário com as regras padrão CLT e retorna
    um dict com as divergências para registro de auditoria no campo regras.
    """
    from pessoal.models import Rescisao
    JC = Rescisao.MotivoDesligamento.POR_JUSTA_CAUSA
    PD = Rescisao.MotivoDesligamento.PEDIDO
    tem_aviso_indenizado_pd = (
        motivo == PD and
        getattr(flags.get('_rescisao_obj'), 'aviso_tipo', None) == Rescisao.AvisoPrevioTipo.INDENIZADO
    )
    padrao = {
        # PD + tipo indenizado é desconto legítimo — não é divergência
        'aviso':               motivo not in (JC, PD) or tem_aviso_indenizado_pd,
        'ferias_proporcionais': motivo != JC,
        'ferias_vencidas':      True,
        'decimo_terceiro':      motivo != JC,
        'multa_fgts':           motivo in (
            Rescisao.MotivoDesligamento.PELO_EMPREGADOR,
            Rescisao.MotivoDesligamento.ABANDONO,
            Rescisao.MotivoDesligamento.RESCISAO_INDIRETA,
        ),
    }
    # retorna só o que diverge — dict vazio = tudo conforme CLT
    return {
        k: {'usuario': flags[k], 'clt': padrao[k]}
        for k in flags
        if k != '_rescisao_obj' and flags.get(k) != padrao.get(k)
    }


def _snapshot_consolidado(consolidado) -> dict | None:
    """Serializa o consolidado de frequência para auditoria no campo regras."""
    if not consolidado:
        return None
    return {
        'id':          consolidado.pk,
        'competencia': str(consolidado.competencia),
        'status':      consolidado.status,
        'consolidado': consolidado.consolidado,  # já é dict — cópia direta
    }