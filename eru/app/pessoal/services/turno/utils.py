from datetime import date

def get_turno_dia(historico: list, data: date):
    """Retorna o TurnoHistorico vigente para uma data, ou None."""
    return next((
        th for th in reversed(historico)
        if th.inicio_vigencia <= data and (
            th.fim_vigencia is None or th.fim_vigencia >= data
        )
    ), None)


def get_turno_dia_ciclo(turno, dias_turno: list, data: date):
    """Retorna o TurnoDia correspondente à posição de ciclo para uma data, ou None."""
    if turno.dias_ciclo <= 0:
        return None
    pos = (data - turno.inicio).days % turno.dias_ciclo
    return next((d for d in dias_turno if d.posicao_ciclo == pos), None)


def horarios_conflitam(h1: dict, h2: dict) -> bool:
    """Verifica se dois dicts {entrada, saida, virada?} se sobrepõem."""
    def to_min(t): h, m = t.split(':'); return int(h) * 60 + int(m)
    in1  = to_min(h1['entrada'])
    out1 = to_min(h1['saida']) + (1440 if h1.get('virada') else 0)
    in2  = to_min(h2['entrada'])
    out2 = to_min(h2['saida']) + (1440 if h2.get('virada') else 0)
    return in1 < out2 and out1 > in2
