import json
import calendar
from collections import OrderedDict
from datetime import date
from django.db.models import Q
from django.utils import timezone
from pessoal.models import Afastamento
from pessoal.services.turno.utils import get_turno_dia, get_turno_dia_ciclo


class CalendarioFrequenciaService:
    """Monta o calendário mensal de frequência para exibição na tela."""

    def __init__(self, competencia, contrato):
        self.competencia  = competencia
        self.contrato     = contrato
        self.tz_local     = timezone.get_current_timezone()
        self.num_dias     = calendar.monthrange(competencia.year, competencia.month)[1]
        self.primeiro_dia = competencia.replace(day=1)
        self.ultimo_dia   = competencia.replace(day=self.num_dias)

    def montar(self, frequencias, contratos_mes, turnos_hist, afastamento_cfg=None):
        """
        Monta estrutura completa do calendário do mês.

        Args:
            frequencias:     QuerySet de Frequencia do mês.
            contratos_mes:   QuerySet/lista de contratos vigentes no mês.
            turnos_hist:     Lista de TurnoHistorico vigente no mês.
            afastamento_cfg: AfastamentoSchema da filial (opcional).

        Returns:
            OrderedDict {date: {
                horarios, escala, escala_json, escala_folga,
                bloqueado,           # True = sem contrato → dia não renderiza
                afastado,            # True = afastamento ativo → dia renderiza somente-leitura
                afastamento_evento_id  # evento pré-carregado no dia afastado
            }}
        """
        contratos_list = list(contratos_mes)               # avalia queryset uma única vez
        afastamentos   = self._obter_afastamentos()        # sempre buscado, independente de cfg

        dias_mes = self._inicializar_dias(contratos_list, afastamentos, afastamento_cfg)
        self._preencher_frequencias(dias_mes, frequencias)
        self._preencher_escalas(dias_mes, turnos_hist, afastamentos, afastamento_cfg)
        return dias_mes

    # ─── helpers privados ────────────────────────────────────────────────────

    def _obter_afastamentos(self):
        """Busca todos os afastamentos do funcionário que tocam o mês — uma query."""
        return list(
            Afastamento.objects.filter(
                funcionario=self.contrato.funcionario,
                data_afastamento__lte=self.ultimo_dia,   # começa antes ou durante o mês
            ).filter(
                Q(data_retorno__isnull=True) |           # sem data de retorno (ainda afastado)
                Q(data_retorno__gte=self.primeiro_dia)   # retorno dentro ou após o mês
            ).order_by('data_afastamento')
        )

    def _evento_id_afastamento(self, afastamento, cfg) -> int | None:
        """Mapeia o motivo do Afastamento para o evento_id configurado no AfastamentoSchema."""
        if cfg is None:
            return None
        mapa = {
            Afastamento.Motivo.DOENCA:            cfg.evento_doenca_id,
            Afastamento.Motivo.ACIDENTE_TRABALHO: cfg.evento_acidente_id,
            Afastamento.Motivo.OUTRO:             cfg.evento_outro_id,
        }
        return mapa.get(afastamento.motivo)

    def _afastamento_do_dia(self, dia: date, afastamentos: list):
        """Retorna o Afastamento ativo em 'dia', ou None."""
        return next(
            (a for a in afastamentos
             if a.data_afastamento <= dia and (a.data_retorno is None or a.data_retorno >= dia)),
            None
        )

    def _inicializar_dias(self, contratos_list, afastamentos, cfg):
        """
        Cria a estrutura base para cada dia do mês.

        bloqueado=True → sem contrato → template não renderiza o dia
        afastado=True  → afastamento ativo → template renderiza somente-leitura pré-preenchido
        Os dois estados são mutualmente exclusivos: afastado só é True quando há contrato.
        """
        dias_mes = OrderedDict()
        for dia_num in range(1, self.num_dias + 1):
            data         = date(self.competencia.year, self.competencia.month, dia_num)
            tem_contrato = any(c.inicio <= data <= (c.fim or date.max) for c in contratos_list)
            afastamento  = self._afastamento_do_dia(data, afastamentos) if tem_contrato else None
            evento_id    = self._evento_id_afastamento(afastamento, cfg) if afastamento else None
            dias_mes[data] = {
                'horarios':              [],
                'escala':                None,
                'escala_json':           '[]',
                'escala_folga':          False,
                'bloqueado':             not tem_contrato,         # sem contrato → não renderiza
                'afastado':              afastamento is not None,  # afastamento ativo → somente-leitura
                'afastamento_evento_id': evento_id,                # evento pré-carregado (pode ser None se cfg não configurado)
            }
        return dias_mes

    def _preencher_frequencias(self, dias_mes, frequencias):
        """Popula registros já salvos de Frequencia em cada dia."""
        for freq in frequencias:
            dia = freq.data if freq.data else freq.inicio.astimezone(self.tz_local).date()
            if dia not in dias_mes:
                continue
            entrada = freq.inicio.astimezone(self.tz_local).strftime('%H:%M') if freq.inicio else ''
            saida   = freq.fim.astimezone(self.tz_local).strftime('%H:%M')    if freq.fim    else ''
            dias_mes[dia]['horarios'].append({
                'id':          freq.id,
                'entrada':     entrada,
                'saida':       saida,
                'evento_id':   freq.evento_id,
                'observacao':  freq.observacao or '',
                'dia_inteiro': freq.evento.dia_inteiro,
                'origem':      self._get_origem(freq),
            })

    def _preencher_escalas(self, dias_mes, turnos_hist, afastamentos, cfg):
        """
        Preenche a escala planejada de cada dia com base no ciclo do turno vigente.
        Dias afastados com evento configurado substituem a escala pelo label do afastamento.
        Dias afastados sem evento configurado exibem a escala normal (comportamento neutro).
        """
        if not turnos_hist:
            return

        # pre-carrega dias de todos os turnos em memória — evita N+1 queries
        dias_por_turno = {th.turno_id: list(th.turno.dias.all()) for th in turnos_hist}

        for data, info in dias_mes.items():
            if info['bloqueado']:
                continue  # sem contrato — não processa escala

            afastamento = self._afastamento_do_dia(data, afastamentos)
            if afastamento:
                evento_id = self._evento_id_afastamento(afastamento, cfg)
                if evento_id:
                    # substitui escala pelo label do afastamento; front usa afastamento_evento_id
                    info['escala']               = f'Afastamento ({afastamento.get_motivo_display()})'
                    info['escala_folga']         = False
                    info['escala_json']          = '[]'
                    info['afastamento_evento_id'] = evento_id
                    continue  # não calcula ciclo para este dia

            # escala normal via ciclo do turno
            turno_hist = get_turno_dia(turnos_hist, data)
            if not turno_hist:
                continue
            turno_dia = get_turno_dia_ciclo(turno_hist.turno, dias_por_turno[turno_hist.turno_id], data)
            if not turno_dia:
                continue

            if turno_dia.eh_folga:
                info['escala']       = 'Folga'
                info['escala_folga'] = True
            elif turno_dia.horarios:
                info['escala']      = ' | '.join(
                    f"{h.get('entrada', '')}–{h.get('saida', '')}" for h in turno_dia.horarios
                )
                info['escala_json'] = json.dumps(turno_dia.horarios)

    def _get_origem(self, freq):
        """Determina a origem do registro: fonte externa, manual ou sistema."""
        if freq.metadados.get('fonte'):
            return freq.metadados['fonte']
        return 'manual' if freq.editado else 'sistema'
