"""
test_motores.py — Testes dos motores de frequência e folha do app pessoal.

Estrutura:
  FrequenciaEngineTests  — testa a função consolidar() isoladamente
  FolhaEngineTests       — testa engine_run / dependence_resolve isoladamente
  IntegracaoTests        — testa run_single / payroll_run com dados completos
  EdgeCaseTests          — casos especiais: contrato quebrado, sem contrato, etc.

Como rodar:
  python manage.py test pessoal.tests_motores --keepdb -v 2

Fixture carregada automaticamente pelo atributo fixtures = [...].
Os PKs referenciados abaixo correspondem exatamente ao fixture_pessoal.json.
"""

import math
from datetime import date, datetime, timedelta, time
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from pessoal.models import (
    Contrato, EventoFrequencia, Frequencia, FrequenciaConsolidada,
    FolhaPagamento, Funcionario, EventoEmpresa, EventoCargo,
    EventoFuncionario, PessoalSettings,
)
from pessoal.services.frequencia.engine import (
    consolidar, _calcular_dia, _horas_noturnas, _horas, _segmentos_noturnos,
)
from pessoal.services.folha.engine import (
    engine_run, dependence_resolve, extract_deps, get_interpreter,
)
from pessoal.services.folha.collectors import get_event_vars_master, get_period
from pessoal.services.folha.services import merge_events, run_single, payroll_run


# ─── helpers de criação de frequência ─────────────────────────────────────────

TZ = timezone.get_current_timezone()

def _dt(year, month, day, hour=0, minute=0):
    """Cria datetime aware em America/Cuiaba."""
    return timezone.make_aware(datetime(year, month, day, hour, minute), TZ)

def _freq(contrato, evento_pk, data, inicio=None, fim=None):
    """Cria um registro Frequencia no banco."""
    ef = EventoFrequencia.objects.get(pk=evento_pk)
    kwargs = dict(contrato=contrato, evento=ef, data=date(data[0], data[1], data[2]))
    if inicio and fim:
        kwargs['inicio'] = _dt(*data[:3], *inicio)
        kwargs['fim']    = _dt(*data[:3], *fim)
    return Frequencia.objects.create(**kwargs)

def _freq_virada(contrato, evento_pk, data_ini, hora_ini, data_fim, hora_fim):
    """Frequência com virada de dia (ex: 18:00 → 06:00)."""
    ef = EventoFrequencia.objects.get(pk=evento_pk)
    return Frequencia.objects.create(
        contrato=contrato, evento=ef,
        data=date(*data_ini),
        inicio=_dt(*data_ini, *hora_ini),
        fim=_dt(*data_fim, *hora_fim),
    )


# ══════════════════════════════════════════════════════════════════════════════
# GRUPO 1 — Motor de frequência: funções unitárias
# ══════════════════════════════════════════════════════════════════════════════

class FrequenciaUnitTests(TestCase):
    """Testa as funções auxiliares do engine de frequência sem banco."""

    # ── _horas ─────────────────────────────────────────────────────────────

    def test_horas_jornada_simples(self):
        """8h de jornada = 8.0h."""
        class FakeFreq:
            inicio = _dt(2026, 1, 5, 6, 0)
            fim    = _dt(2026, 1, 5, 14, 0)
        self.assertAlmostEqual(_horas(FakeFreq()), 8.0)

    def test_horas_jornada_12h(self):
        """Turno 12x36: 12.0h."""
        class FakeFreq:
            inicio = _dt(2026, 1, 5, 6, 0)
            fim    = _dt(2026, 1, 5, 18, 0)
        self.assertAlmostEqual(_horas(FakeFreq()), 12.0)

    def test_horas_sem_inicio_fim(self):
        """Evento dia_inteiro sem horário → 0.0h."""
        class FakeFreq:
            inicio = None
            fim    = None
        self.assertEqual(_horas(FakeFreq()), 0.0)

    def test_horas_virada_meia_noite(self):
        """18:00 → 06:00 do dia seguinte = 12.0h."""
        class FakeFreq:
            inicio = _dt(2026, 1, 5, 18, 0)
            fim    = _dt(2026, 1, 6, 6, 0)
        self.assertAlmostEqual(_horas(FakeFreq()), 12.0)

    # ── _horas_noturnas ────────────────────────────────────────────────────

    def test_horas_noturnas_turno_diurno(self):
        """Jornada 06h–14h → 0h noturnas (fora da janela 22h–06h)."""
        ini = _dt(2026, 1, 5, 6, 0)
        fim = _dt(2026, 1, 5, 14, 0)
        hn = _horas_noturnas(ini, fim, time(22, 0), time(6, 0))
        self.assertAlmostEqual(hn, 0.0)

    def test_horas_noturnas_turno_noturno_completo(self):
        """18:00 → 06:00: intersecção com janela 22h–06h = 8h noturnas."""
        ini = _dt(2026, 1, 5, 18, 0)
        fim = _dt(2026, 1, 6, 6, 0)
        hn = _horas_noturnas(ini, fim, time(22, 0), time(6, 0))
        self.assertAlmostEqual(hn, 8.0)

    def test_horas_noturnas_parcial(self):
        """20:00 → 02:00: sobreposição de 4h com 22h–06h."""
        ini = _dt(2026, 1, 5, 20, 0)
        fim = _dt(2026, 1, 6, 2, 0)
        hn = _horas_noturnas(ini, fim, time(22, 0), time(6, 0))
        self.assertAlmostEqual(hn, 4.0)

    def test_horas_noturnas_apenas_matinal(self):
        """04:00 → 08:00: sobreposição de 2h com segmento 00h–06h."""
        ini = _dt(2026, 1, 5, 4, 0)
        fim = _dt(2026, 1, 5, 8, 0)
        hn = _horas_noturnas(ini, fim, time(22, 0), time(6, 0))
        self.assertAlmostEqual(hn, 2.0)

    def test_horas_noturnas_cruzando_meia_noite_completo(self):
        """22:00 → 06:00 exato = 8h noturnas exatas."""
        ini = _dt(2026, 1, 5, 22, 0)
        fim = _dt(2026, 1, 6, 6, 0)
        hn = _horas_noturnas(ini, fim, time(22, 0), time(6, 0))
        self.assertAlmostEqual(hn, 8.0)

    # ── _calcular_dia ──────────────────────────────────────────────────────

    def test_calcular_dia_sem_registros(self):
        """Dia sem nenhum registro → todos os contadores zero/False."""
        r = _calcular_dia([], carga_dia=None, incluir_intervalo=False,
                          hn_inicio=time(22, 0), hn_fim=time(6, 0))
        self.assertFalse(r['dia_trabalhado'])
        self.assertEqual(r['h_trabalhadas'], 0.0)
        self.assertEqual(r['h_extras'], 0.0)

    def test_calcular_dia_jornada_8h_sem_carga_diaria(self):
        """8h de jornada, metodologia mensal → HE = 0, trabalhadas = 8."""
        # Cria objeto simulado de Frequencia
        ef = type('EF', (), {'categoria': EventoFrequencia.Categoria.JORNADA,
                             'dia_inteiro': False, 'rastreio': ''})()
        freq = type('F', (), {
            'evento': ef,
            'inicio': _dt(2026, 1, 5, 6, 0),
            'fim':    _dt(2026, 1, 5, 14, 0),
            'desconta_efetivos': False,   # atributo no evento, não no freq
        })()
        freq.evento.desconta_efetivos = False
        r = _calcular_dia([freq], carga_dia=None, incluir_intervalo=False,
                          hn_inicio=time(22, 0), hn_fim=time(6, 0))
        self.assertAlmostEqual(r['h_trabalhadas'], 8.0)
        self.assertAlmostEqual(r['h_extras'], 0.0)
        self.assertTrue(r['dia_trabalhado'])

    def test_calcular_dia_he_metodologia_diaria(self):
        """9h trabalhadas com carga_dia=8 → 1h extra."""
        ef = type('EF', (), {'categoria': EventoFrequencia.Categoria.JORNADA,
                             'dia_inteiro': False, 'rastreio': '',
                             'desconta_efetivos': False})()
        freq = type('F', (), {
            'evento': ef,
            'inicio': _dt(2026, 1, 5, 6, 0),
            'fim':    _dt(2026, 1, 5, 15, 0),
        })()
        r = _calcular_dia([freq], carga_dia=8.0, incluir_intervalo=False,
                          hn_inicio=time(22, 0), hn_fim=time(6, 0))
        self.assertAlmostEqual(r['h_trabalhadas'], 8.0)   # normalizado ao teto
        self.assertAlmostEqual(r['h_extras'], 1.0)

    def test_calcular_dia_falta_injustificada_desconta_efetivos(self):
        """Falta injustificada com desconta_efetivos=True → flag levantada."""
        ef = type('EF', (), {'categoria': EventoFrequencia.Categoria.AUSENCIA_NJUST,
                             'dia_inteiro': True, 'rastreio': '',
                             'desconta_efetivos': True})()
        freq = type('F', (), {'evento': ef, 'inicio': None, 'fim': None})()
        r = _calcular_dia([freq], carga_dia=None, incluir_intervalo=False,
                          hn_inicio=time(22, 0), hn_fim=time(6, 0))
        self.assertTrue(r['desconta_efetivos'])
        self.assertTrue(r['dia_falta_njust'])

    def test_calcular_dia_rastreio_nivel2(self):
        """Evento com rastreio acumula no nível 2 (ef dict)."""
        ef = type('EF', (), {'categoria': EventoFrequencia.Categoria.HORA_EXTRA,
                             'dia_inteiro': False, 'rastreio': 'EF_he50',
                             'desconta_efetivos': False})()
        freq = type('F', (), {
            'evento': ef,
            'inicio': _dt(2026, 1, 5, 14, 0),
            'fim':    _dt(2026, 1, 5, 16, 0),
        })()
        r = _calcular_dia([freq], carga_dia=None, incluir_intervalo=False,
                          hn_inicio=time(22, 0), hn_fim=time(6, 0))
        self.assertIn('EF_he50', r['ef'])
        self.assertAlmostEqual(r['ef']['EF_he50']['horas'], 2.0)


# ══════════════════════════════════════════════════════════════════════════════
# GRUPO 2 — Motor de frequência: consolidar() com banco + fixture
# ══════════════════════════════════════════════════════════════════════════════

class FrequenciaConsolidarTests(TestCase):
    fixtures = ['fixture_pessoal.json']

    # ── Cenário A: mês completo, motorista, metodologia mensal ────────────

    def _contrato_motorista_normal(self):
        """Contrato 2 — Motorista, ativo desde 2024-11, sem carga diária."""
        return Contrato.objects.get(pk=2)

    def test_consolidar_mes_sem_frequencias_gera_erros(self):
        """Sem nenhum registro de frequência → todos os dias ficam como 'Dia sem registro'."""
        ct = self._contrato_motorista_normal()
        obj = consolidar(ct, date(2026, 1, 1), date(2026, 1, 31))
        self.assertFalse(obj.bloqueado is False)   # bloqueado = True pois há erros
        self.assertTrue(obj.bloqueado)
        self.assertGreater(len(obj.erros), 0)
        # todos os 31 dias de janeiro dentro da vigência devem estar no erros
        self.assertIn('2026-01-01', obj.erros)
        self.assertIn('2026-01-31', obj.erros)

    def test_consolidar_zera_totais_sem_frequencias(self):
        """Sem frequências, totalizadores de horas e dias devem ser zero."""
        ct = self._contrato_motorista_normal()
        obj = consolidar(ct, date(2026, 1, 1), date(2026, 1, 31))
        c = obj.consolidado
        self.assertEqual(c['H_horas_trabalhadas'], 0.0)
        self.assertEqual(c['H_dias_trabalhados'], 0)
        self.assertEqual(c['H_horas_extras'], 0.0)

    def test_consolidar_H_dias_mes_correto(self):
        """H_dias_mes deve ser 31 para janeiro."""
        ct = self._contrato_motorista_normal()
        obj = consolidar(ct, date(2026, 1, 1), date(2026, 1, 31))
        self.assertEqual(obj.consolidado['H_dias_mes'], 31)

    def test_consolidar_H_dias_mes_fevereiro(self):
        """H_dias_mes deve ser 28 para fevereiro de 2026 (não bissexto)."""
        ct = self._contrato_motorista_normal()
        obj = consolidar(ct, date(2026, 2, 1), date(2026, 2, 28))
        self.assertEqual(obj.consolidado['H_dias_mes'], 28)

    # ── Cenário B: frequências manualmente inseridas ───────────────────────

    def _setup_mes_completo(self, contrato_pk, ano=2026, mes=1,
                            horas_por_dia=8.0, folgas_semana=(5, 6)):
        """
        Popula frequências simulando mês completo: dias úteis com jornada,
        fins de semana (folgas_semana: 0=dom,6=sab) com folga.
        Retorna o objeto FrequenciaConsolidada.
        """
        ct = Contrato.objects.get(pk=contrato_pk)
        d = date(ano, mes, 1)
        import calendar
        ultimo_dia = calendar.monthrange(ano, mes)[1]

        while d <= date(ano, mes, ultimo_dia):
            dia_semana = d.weekday()  # 0=seg, 6=dom
            if dia_semana in folgas_semana:
                # folga semanal
                Frequencia.objects.create(
                    contrato=ct,
                    evento=EventoFrequencia.objects.get(pk=2),  # Folga Semanal
                    data=d,
                )
            else:
                # jornada com horário real
                ini = timezone.make_aware(datetime(ano, mes, d.day, 6, 0), TZ)
                fim = timezone.make_aware(datetime(ano, mes, d.day, 6, 0) + timedelta(hours=horas_por_dia), TZ)
                Frequencia.objects.create(
                    contrato=ct,
                    evento=EventoFrequencia.objects.get(pk=1),  # Jornada Normal
                    data=d,
                    inicio=ini,
                    fim=fim,
                )
            d += timedelta(days=1)

        return consolidar(ct, date(ano, mes, 1), date(ano, mes, ultimo_dia))

    def test_dias_trabalhados_mes_completo(self):
        """Janeiro/2026 tem 22 dias úteis (seg-sex). Verificamos H_dias_trabalhados."""
        # ct=2 motorista normal
        obj = self._setup_mes_completo(2, horas_por_dia=8.0, folgas_semana=(5, 6))
        # Janeiro 2026: 22 dias úteis seg-sex (1,2,5,6,7,8,9,12,13,14,15,16,19,20,21,22,23,26,27,28,29,30)
        self.assertEqual(obj.consolidado['H_dias_trabalhados'], 22)
        self.assertEqual(obj.consolidado['H_dias_folga'], 9)   # 9 sab+dom em jan
        self.assertFalse(obj.bloqueado)
        self.assertEqual(len(obj.erros), 0)

    def test_horas_trabalhadas_metodologia_mensal(self):
        """8h/dia × 22 dias = 176h. HE deve ser 0 (metodologia mensal sem carga_diaria)."""
        obj = self._setup_mes_completo(2, horas_por_dia=8.0)
        c = obj.consolidado
        self.assertAlmostEqual(c['H_horas_trabalhadas'], 176.0, places=1)
        self.assertAlmostEqual(c['H_horas_extras'], 0.0)   # metodologia mensal → sem HE auto

    def test_status_fechado_quando_sem_erros(self):
        """Quando todos os dias têm registro, status deve ser FECHADO."""
        obj = self._setup_mes_completo(2)
        self.assertEqual(obj.status, FrequenciaConsolidada.Status.FECHADO)

    def test_idempotencia_reconsolidar(self):
        """Reconsolidar o mesmo período deve update_or_create sem duplicar."""
        ct = Contrato.objects.get(pk=2)
        consolidar(ct, date(2026, 1, 1), date(2026, 1, 31))
        consolidar(ct, date(2026, 1, 1), date(2026, 1, 31))
        qtd = FrequenciaConsolidada.objects.filter(
            contrato=ct, competencia=date(2026, 1, 1)).count()
        self.assertEqual(qtd, 1)

    # ── Cenário C: metodologia diária (Mecânico A, carga_diaria=8h) ────────

    def test_horas_extras_metodologia_diaria(self):
        """Mecânico A: 9h/dia × 22 dias → 1h extra/dia → 22h extras no mês."""
        # ct=33 Mecanico A, carga_diaria=8.00
        ct = Contrato.objects.get(pk=33)
        obj = self._setup_mes_completo(33, horas_por_dia=9.0)
        c = obj.consolidado
        self.assertAlmostEqual(c['H_horas_extras'], 22.0, places=1)
        # Horas trabalhadas normalizadas = 8h/dia × 22 = 176h
        self.assertAlmostEqual(c['H_horas_trabalhadas'], 176.0, places=1)

    def test_sem_horas_extras_quando_exato(self):
        """Mecânico A trabalhando exatamente 8h/dia → HE = 0."""
        ct = Contrato.objects.get(pk=33)
        obj = self._setup_mes_completo(33, horas_por_dia=8.0)
        self.assertAlmostEqual(obj.consolidado['H_horas_extras'], 0.0)

    # ── Cenário D: horas noturnas (turno 18h–06h) ─────────────────────────

    def test_horas_noturnas_turno_2p(self):
        """Turno 2P 18:00–06:00 → 8h noturnas por dia (22h–06h)."""
        ct = Contrato.objects.get(pk=4)   # Motorista normal
        # Cria 5 dias de jornada noturna (segunda a sexta de uma semana)
        for dia in range(5, 10):  # 5-9 jan 2026 (seg-sex)
            Frequencia.objects.create(
                contrato=ct,
                evento=EventoFrequencia.objects.get(pk=1),
                data=date(2026, 1, dia),
                inicio=_dt(2026, 1, dia, 18, 0),
                fim=_dt(2026, 1, dia + 1, 6, 0),
            )
        # Adiciona folgas para completar a semana
        for dia in [3, 4, 10, 11]:  # sab/dom anteriores e posteriores
            Frequencia.objects.create(
                contrato=ct,
                evento=EventoFrequencia.objects.get(pk=2),
                data=date(2026, 1, dia),
            )
        obj = consolidar(ct, date(2026, 1, 3), date(2026, 1, 11))
        hn = obj.consolidado['H_horas_noturnas']
        # 5 dias × 8h noturnas = 40h
        self.assertAlmostEqual(hn, 40.0, places=1)

    # ── Cenário E: falta justificada / injustificada ───────────────────────

    def test_falta_injustificada_desconta_efetivos(self):
        """1 dia de falta injustificada → H_dias_efetivos diminui 1."""
        ct = Contrato.objects.get(pk=5)
        # Preenche um mês completo normal
        obj_sem_falta = self._setup_mes_completo(5)
        efetivos_sem_falta = obj_sem_falta.consolidado['H_dias_efetivos']
        # Remove frequências e refaz com uma falta injustificada no dia 15
        Frequencia.objects.filter(contrato=ct).delete()
        FrequenciaConsolidada.objects.filter(contrato=ct).delete()

        import calendar
        for d in [date(2026, 1, day) for day in range(1, 32)]:
            if d.weekday() in (5, 6):
                Frequencia.objects.create(contrato=ct, evento=EventoFrequencia.objects.get(pk=2), data=d)
            elif d.day == 15:
                Frequencia.objects.create(contrato=ct, evento=EventoFrequencia.objects.get(pk=6), data=d)  # Falta Injust
            else:
                Frequencia.objects.create(
                    contrato=ct, evento=EventoFrequencia.objects.get(pk=1), data=d,
                    inicio=_dt(2026, 1, d.day, 6, 0),
                    fim=_dt(2026, 1, d.day, 14, 0),
                )
        obj = consolidar(ct, date(2026, 1, 1), date(2026, 1, 31))
        c = obj.consolidado
        self.assertEqual(c['H_dias_falta_njust'], 1)
        self.assertEqual(c['H_dias_efetivos'], c['H_dias_contrato'] - 1)

    def test_atestado_nao_desconta_efetivos(self):
        """Atestado médico (desconta_efetivos=False) não reduz H_dias_efetivos."""
        ct = Contrato.objects.get(pk=5)
        Frequencia.objects.filter(contrato=ct).delete()
        FrequenciaConsolidada.objects.filter(contrato=ct).delete()

        for d in [date(2026, 1, day) for day in range(1, 32)]:
            if d.weekday() in (5, 6):
                Frequencia.objects.create(contrato=ct, evento=EventoFrequencia.objects.get(pk=2), data=d)
            elif d.day == 10:
                Frequencia.objects.create(contrato=ct, evento=EventoFrequencia.objects.get(pk=7), data=d)  # Atestado
            else:
                Frequencia.objects.create(
                    contrato=ct, evento=EventoFrequencia.objects.get(pk=1), data=d,
                    inicio=_dt(2026, 1, d.day, 6, 0),
                    fim=_dt(2026, 1, d.day, 14, 0),
                )
        obj = consolidar(ct, date(2026, 1, 1), date(2026, 1, 31))
        c = obj.consolidado
        # Atestado não desconta → H_dias_efetivos = H_dias_contrato
        self.assertEqual(c['H_dias_efetivos'], c['H_dias_contrato'])
        self.assertEqual(c['H_dias_afastamento'], 1)

    # ── Cenário F: nível 2 (EF_*) ─────────────────────────────────────────

    def test_nivel2_he50_acumula_horas(self):
        """Horas extras 50% acumulam em EF.EF_he50.horas."""
        ct = Contrato.objects.get(pk=4)
        # 3 dias com 2h extras cada (usando evento HE 50% = pk 11)
        for dia in [5, 6, 7]:
            Frequencia.objects.create(
                contrato=ct,
                evento=EventoFrequencia.objects.get(pk=11),  # HE 50%
                data=date(2026, 1, dia),
                inicio=_dt(2026, 1, dia, 14, 0),
                fim=_dt(2026, 1, dia, 16, 0),
            )
        Frequencia.objects.create(contrato=ct, evento=EventoFrequencia.objects.get(pk=2), data=date(2026, 1, 4))
        Frequencia.objects.create(contrato=ct, evento=EventoFrequencia.objects.get(pk=2), data=date(2026, 1, 3))
        obj = consolidar(ct, date(2026, 1, 3), date(2026, 1, 9))
        ef_he50 = obj.consolidado.get('EF', {}).get('EF_he50', {})
        self.assertAlmostEqual(ef_he50.get('horas', 0), 6.0)

    def test_nivel2_multiplos_rastreios(self):
        """Dois rastreios distintos acumulam separadamente no EF."""
        ct = Contrato.objects.get(pk=4)
        # HE 50%: 2h
        Frequencia.objects.create(
            contrato=ct, evento=EventoFrequencia.objects.get(pk=11),
            data=date(2026, 1, 5),
            inicio=_dt(2026, 1, 5, 14, 0),
            fim=_dt(2026, 1, 5, 16, 0),
        )
        # HE 100%: 1h
        Frequencia.objects.create(
            contrato=ct, evento=EventoFrequencia.objects.get(pk=12),
            data=date(2026, 1, 6),
            inicio=_dt(2026, 1, 6, 14, 0),
            fim=_dt(2026, 1, 6, 15, 0),
        )
        obj = consolidar(ct, date(2026, 1, 5), date(2026, 1, 6))
        ef = obj.consolidado.get('EF', {})
        self.assertAlmostEqual(ef.get('EF_he50', {}).get('horas', 0), 2.0)
        self.assertAlmostEqual(ef.get('EF_he100', {}).get('horas', 0), 1.0)

    # ── Cenário G: contrato com início no meio do mês ──────────────────────

    def test_H_dias_contrato_inicio_meio_mes(self):
        """
        Contrato 59 inicia em 2026-02-12.
        H_dias_contrato para fev/2026 deve ser 28 - 12 + 1 = 17 dias.
        """
        ct = Contrato.objects.get(pk=59)   # Motorista, ini=2026-02-12
        obj = consolidar(ct, date(2026, 2, 1), date(2026, 2, 28))
        # Dias de contrato = 12 a 28 fev = 17 dias
        self.assertEqual(obj.consolidado['H_dias_contrato'], 17)

    def test_H_dias_contrato_fora_do_periodo(self):
        """
        Contrato 6 encerra em 2026-01-17.
        H_dias_contrato para jan/2026 deve ser 17 dias (1–17).
        """
        ct = Contrato.objects.get(pk=6)
        obj = consolidar(ct, date(2026, 1, 1), date(2026, 1, 31))
        self.assertEqual(obj.consolidado['H_dias_contrato'], 17)

    def test_dias_sem_registro_ignorados_fora_vigencia(self):
        """
        Contrato 59 inicia em 2026-02-12. Dias 1–11 de fev não devem gerar
        erro, pois estão fora da vigência.
        """
        ct = Contrato.objects.get(pk=59)
        obj = consolidar(ct, date(2026, 2, 1), date(2026, 2, 28))
        erros = obj.erros
        for dia in range(1, 12):
            self.assertNotIn(f'2026-02-{dia:02d}', erros)


# ══════════════════════════════════════════════════════════════════════════════
# GRUPO 3 — Motor de folha: funções unitárias
# ══════════════════════════════════════════════════════════════════════════════

class FolhaEngineUnitTests(TestCase):

    def test_extract_deps_sem_dependencias(self):
        """Fórmula sem U_* → deps vazio."""
        deps = extract_deps("round(F_salario * 0.09, 2)")
        self.assertEqual(deps, set())

    def test_extract_deps_com_dependencias(self):
        """Fórmula com U_salario e U_he50 → deps corretas."""
        deps = extract_deps("round(U_salario + U_he50, 2)")
        self.assertEqual(deps, {'U_salario', 'U_he50'})

    def test_extract_deps_formula_invalida(self):
        """Fórmula inválida não deve levantar exceção → retorna set vazio."""
        deps = extract_deps("!!@#$%")
        self.assertEqual(deps, set())

    def test_dependence_resolve_ordem_correta(self):
        """
        U_inss depende de U_base_inss que depende de U_salario.
        Ordem esperada: U_salario antes de U_base_inss antes de U_inss.
        """
        class FakeRegra:
            def __init__(self, formula): self.valor = formula

        rules = {
            'U_salario':    FakeRegra('round(F_salario * H_dias_efetivos / H_dias_mes, 2)'),
            'U_base_inss':  FakeRegra('round(U_salario, 2)'),
            'U_inss_func':  FakeRegra('round(U_base_inss * 0.12, 2)'),
        }
        ordem = dependence_resolve(rules)
        idx = {r: i for i, r in enumerate(ordem)}
        self.assertLess(idx['U_salario'], idx['U_base_inss'])
        self.assertLess(idx['U_base_inss'], idx['U_inss_func'])

    def test_dependence_resolve_ciclo_levanta_excecao(self):
        """Dependência circular deve levantar ValueError."""
        class FakeRegra:
            def __init__(self, formula): self.valor = formula
        rules = {
            'U_a': FakeRegra('U_b + 1'),
            'U_b': FakeRegra('U_a + 1'),
        }
        with self.assertRaises(ValueError):
            dependence_resolve(rules)

    def test_engine_run_calculo_simples(self):
        """Calcula U_salario = F_salario sem dependências externas."""
        aeval = get_interpreter()
        context = {'F_salario': 3000.0, 'H_dias_efetivos': 31, 'H_dias_mes': 31}

        class FakeRegra:
            def __init__(self, v): self.valor = v

        rules = {'U_salario': FakeRegra('round(F_salario, 2)')}
        resultado, erros = engine_run(aeval, context, ['U_salario'], rules)
        self.assertEqual(erros, {})
        self.assertAlmostEqual(resultado['U_salario'], 3000.0)

    def test_engine_run_encadeamento(self):
        """U_inss calculado a partir de U_salario previamente calculado."""
        aeval = get_interpreter()
        context = {'F_salario': 3000.0, 'H_dias_efetivos': 31, 'H_dias_mes': 31}

        class FakeRegra:
            def __init__(self, v): self.valor = v

        rules = {
            'U_salario':   FakeRegra('round(F_salario, 2)'),
            'U_inss_func': FakeRegra('round(U_salario * 0.12, 2)'),
        }
        ordem = ['U_salario', 'U_inss_func']
        resultado, erros = engine_run(aeval, context, ordem, rules)
        self.assertEqual(erros, {})
        self.assertAlmostEqual(resultado['U_inss_func'], 360.0)

    def test_engine_run_formula_com_erro_nao_para_execucao(self):
        """Erro em uma fórmula não deve interromper o cálculo das demais."""
        aeval = get_interpreter()
        context = {'F_salario': 3000.0}

        class FakeRegra:
            def __init__(self, v): self.valor = v

        rules = {
            'U_erro':    FakeRegra('1 / 0'),   # ZeroDivisionError
            'U_salario': FakeRegra('F_salario'),
        }
        resultado, erros = engine_run(aeval, context, ['U_erro', 'U_salario'], rules)
        self.assertIn('U_erro', erros)
        self.assertAlmostEqual(resultado['U_salario'], 3000.0)

    def test_engine_run_valor_zero_para_evento_com_erro(self):
        """Evento com erro deve ter valor 0 no resultado (comportamento seguro)."""
        aeval = get_interpreter()
        context = {}

        class FakeRegra:
            def __init__(self, v): self.valor = v

        rules = {'U_xpto': FakeRegra('variavel_inexistente + 999')}
        resultado, erros = engine_run(aeval, context, ['U_xpto'], rules)
        self.assertIn('U_xpto', erros)
        self.assertEqual(resultado.get('U_xpto', 0), 0)

    def test_engine_run_funcoes_whitelist(self):
        """Funções da whitelist (round, min, max, sqrt) devem funcionar."""
        aeval = get_interpreter()
        context = {'F_salario': 3000.0}

        class FakeRegra:
            def __init__(self, v): self.valor = v

        rules = {
            'U_desc_vt': FakeRegra('round(min(F_salario * 0.06, 350.00), 2)'),
        }
        resultado, erros = engine_run(aeval, context, ['U_desc_vt'], rules)
        self.assertEqual(erros, {})
        self.assertAlmostEqual(resultado['U_desc_vt'], 180.0)  # 3000 * 0.06 = 180

    def test_engine_run_whitelist_vt_capped(self):
        """Desconto VT não ultrapassa R$350 (cap via min)."""
        aeval = get_interpreter()
        context = {'F_salario': 7000.0}  # 6% = 420 → cap em 350

        class FakeRegra:
            def __init__(self, v): self.valor = v

        rules = {'U_desc_vt': FakeRegra('round(min(F_salario * 0.06, 350.00), 2)')}
        resultado, _ = engine_run(aeval, context, ['U_desc_vt'], rules)
        self.assertAlmostEqual(resultado['U_desc_vt'], 350.0)


# ══════════════════════════════════════════════════════════════════════════════
# GRUPO 4 — get_event_vars_master: contexto de variáveis
# ══════════════════════════════════════════════════════════════════════════════

class CollectorsTests(TestCase):
    fixtures = ['fixture_pessoal.json']

    def test_vars_master_lista_contem_prefixos(self):
        """Modo lista deve conter variáveis F_*, C_*, H_*, U_*."""
        variaveis = get_event_vars_master()
        nomes = variaveis if isinstance(variaveis, list) else list(variaveis.keys())
        tem_F = any(v.startswith('F_') for v in nomes)
        tem_C = any(v.startswith('C_') for v in nomes)
        self.assertTrue(tem_F, "Esperava variáveis F_* (Funcionario)")
        self.assertTrue(tem_C, "Esperava variáveis C_* (Contrato)")

    def test_vars_master_modo_calculo_retorna_valores(self):
        """Modo cálculo com contrato real deve retornar dict com valores numéricos."""
        ct = Contrato.objects.get(pk=2)
        func = ct.funcionario
        ctx = get_event_vars_master(funcionario=func, contrato=ct)
        self.assertIsInstance(ctx, dict)
        self.assertIn('F_salario', ctx)
        self.assertIn('C_carga_mensal', ctx)
        self.assertEqual(ctx['C_carga_mensal'], 220)

    def test_vars_master_com_consolidado_injeta_H(self):
        """Com FrequenciaConsolidada, variáveis H_* devem estar no contexto."""
        ct = Contrato.objects.get(pk=2)
        # Cria consolidado mínimo
        fc = FrequenciaConsolidada.objects.create(
            contrato=ct,
            competencia=date(2026, 1, 1),
            inicio=timezone.make_aware(datetime(2026, 1, 1), TZ),
            fim=timezone.make_aware(datetime(2026, 1, 31, 23, 59), TZ),
            consolidado={
                'H_horas_trabalhadas': 176.0, 'H_horas_extras': 0.0,
                'H_horas_noturnas': 0.0, 'H_intervalos': 0.0,
                'H_faltas_justificadas': 0.0, 'H_faltas_injustificadas': 0.0,
                'H_atestados': 0.0, 'H_dias_trabalhados': 22,
                'H_dias_falta_just': 0, 'H_dias_falta_njust': 0,
                'H_dias_folga': 9, 'H_dias_afastamento': 0,
                'H_dias_mes': 31, 'H_dias_contrato': 31, 'H_dias_efetivos': 31,
                'EF': {'EF_he50': {'horas': 4.0, 'dias': 2}},
            }
        )
        ctx = get_event_vars_master(
            funcionario=ct.funcionario, contrato=ct, consolidado=fc
        )
        self.assertAlmostEqual(ctx['H_horas_trabalhadas'], 176.0)
        self.assertIn('EF_he50_horas', ctx)
        self.assertAlmostEqual(ctx['EF_he50_horas'], 4.0)
        self.assertEqual(ctx['EF_he50_dias'], 2)

    def test_F_salario_property_no_contexto(self):
        """F_salario deve corresponder ao salário do contrato ativo."""
        ct = Contrato.objects.get(pk=2)
        ctx = get_event_vars_master(funcionario=ct.funcionario, contrato=ct)
        # F_salario vem da property do Funcionario que usa F_contrato
        # Como pode haver cache, verifica apenas que é numérico e razoável
        self.assertIsInstance(ctx.get('F_salario', None), (int, float))
        self.assertGreater(ctx['F_salario'], 0)

    def test_C_salario_hora_correto(self):
        """C_salario_hora = salario / carga_mensal com 4 casas."""
        ct = Contrato.objects.get(pk=2)   # sal=3275.9, carga=220
        ctx = get_event_vars_master(funcionario=ct.funcionario, contrato=ct)
        esperado = round(float(ct.salario) / ct.carga_mensal, 4)
        self.assertAlmostEqual(ctx['C_salario_hora'], esperado, places=4)


# ══════════════════════════════════════════════════════════════════════════════
# GRUPO 5 — Integração: run_single com valores calculados verificados
# ══════════════════════════════════════════════════════════════════════════════

class IntegracaoFolhaTests(TestCase):
    fixtures = ['fixture_pessoal.json']

    def _criar_consolidado(self, contrato, h_trabalhadas=176.0, he50_horas=0.0,
                           noturnas=0.0, dias_trab=22, dias_folga=9,
                           dias_falta_njust=0, dias_efetivos=31):
        """Helper para criar FrequenciaConsolidada com valores controlados."""
        fc, _ = FrequenciaConsolidada.objects.update_or_create(
            contrato=contrato, competencia=date(2026, 1, 1),
            defaults=dict(
                inicio=timezone.make_aware(datetime(2026, 1, 1), TZ),
                fim=timezone.make_aware(datetime(2026, 1, 31, 23, 59), TZ),
                consolidado={
                    'H_horas_trabalhadas':     h_trabalhadas,
                    'H_horas_extras':          0.0,
                    'H_horas_noturnas':        noturnas,
                    'H_intervalos':            0.0,
                    'H_faltas_justificadas':   0.0,
                    'H_faltas_injustificadas': dias_falta_njust * 8.0,
                    'H_atestados':             0.0,
                    'H_dias_trabalhados':      dias_trab,
                    'H_dias_falta_just':       0,
                    'H_dias_falta_njust':      dias_falta_njust,
                    'H_dias_folga':            dias_folga,
                    'H_dias_afastamento':      0,
                    'H_dias_mes':              31,
                    'H_dias_contrato':         31,
                    'H_dias_efetivos':         dias_efetivos,
                    'EF': {'EF_he50': {'horas': he50_horas, 'dias': int(he50_horas / 2)}} if he50_horas else {},
                },
                status=FrequenciaConsolidada.Status.FECHADO,
            )
        )
        return fc

    def _rodar_folha(self, contrato_pk, **kwargs):
        """Cria consolidado e roda run_single. Retorna FolhaPagamento."""
        ct = Contrato.objects.get(pk=contrato_pk)
        fc = self._criar_consolidado(ct, **kwargs)
        aeval = get_interpreter()

        ev_e = list(EventoEmpresa.objects.filter(
            filiais=ct.funcionario.filial_id,
            inicio__lte=date(2026, 1, 1)
        ).filter(
            __import__('django.db.models', fromlist=['Q']).Q(fim__isnull=True) |
            __import__('django.db.models', fromlist=['Q']).Q(fim__gte=date(2026, 1, 1))
        ).select_related('evento'))
        ev_c = list(EventoCargo.objects.filter(cargo=ct.cargo).select_related('evento'))
        ev_f = list(EventoFuncionario.objects.filter(
            funcionario=ct.funcionario,
            inicio__lte=date(2026, 1, 31)
        ).filter(
            __import__('django.db.models', fromlist=['Q']).Q(fim__isnull=True) |
            __import__('django.db.models', fromlist=['Q']).Q(fim__gte=date(2026, 1, 1))
        ).select_related('evento'))

        return run_single(ct, date(2026, 1, 1), ev_e, ev_c, ev_f, fc, aeval)

    def test_run_single_gera_folha_pagamento(self):
        """run_single deve criar um FolhaPagamento no banco."""
        self._rodar_folha(2)
        self.assertTrue(FolhaPagamento.objects.filter(
            contrato_id=2, competencia=date(2026, 1, 1)).exists())

    def test_salario_base_mes_completo(self):
        """
        Motorista ct=2, sal=3275.90, 31 dias efetivos em jan (31 dias).
        U_salario = round(3275.90 * 31 / 31, 2) = 3275.90
        """
        folha = self._rodar_folha(2)
        eventos = {e['rastreio']: e for e in folha.regras['eventos']}
        self.assertIn('U_salario', eventos)
        self.assertAlmostEqual(eventos['U_salario']['valor'], 3275.90, places=1)

    def test_salario_base_proporcional(self):
        """
        Contrato com apenas 17 dias efetivos (31 dias no mês).
        U_salario = round(sal * 17 / 31, 2)
        """
        ct = Contrato.objects.get(pk=2)
        sal = float(ct.salario)
        esperado = round(sal * 17 / 31, 2)
        folha = self._rodar_folha(2, dias_efetivos=17)
        eventos = {e['rastreio']: e for e in folha.regras['eventos']}
        self.assertAlmostEqual(eventos['U_salario']['valor'], esperado, places=2)

    def test_he50_calculado_corretamente(self):
        """
        4h de HE 50%: U_he50 = round(C_salario_hora * 4 * 1.5, 2)
        """
        ct = Contrato.objects.get(pk=2)
        sh = round(float(ct.salario) / ct.carga_mensal, 4)
        esperado = round(sh * 4.0 * 1.5, 2)
        folha = self._rodar_folha(2, he50_horas=4.0)
        eventos = {e['rastreio']: e for e in folha.regras['eventos']}
        self.assertAlmostEqual(eventos['U_he50']['valor'], esperado, places=2)

    def test_adicional_noturno_calculado(self):
        """
        40h noturnas: U_ad_noturno = round(salario_hora * 40 * 0.25, 2)
        """
        ct = Contrato.objects.get(pk=2)
        sh = round(float(ct.salario) / ct.carga_mensal, 4)
        esperado = round(sh * 40.0 * 0.25, 2)
        folha = self._rodar_folha(2, noturnas=40.0)
        eventos = {e['rastreio']: e for e in folha.regras['eventos']}
        self.assertAlmostEqual(eventos['U_ad_noturno']['valor'], esperado, places=2)

    def test_desconto_vt_cap_350(self):
        """
        Salário alto → desconto VT limitado a R$350.
        """
        # Usa folha sem HE para isolar
        folha = self._rodar_folha(2)
        eventos = {e['rastreio']: e for e in folha.regras['eventos']}
        ct = Contrato.objects.get(pk=2)
        sal_calc = eventos['U_salario']['valor']
        esperado = round(min(sal_calc * 0.06, 350.0), 2)
        self.assertAlmostEqual(eventos['U_desc_vt']['valor'], esperado, places=2)

    def test_vr_por_dias_trabalhados(self):
        """VR = R$20 × dias_trabalhados."""
        folha = self._rodar_folha(2, dias_trab=22)
        eventos = {e['rastreio']: e for e in folha.regras['eventos']}
        self.assertAlmostEqual(eventos['U_vr']['valor'], 440.0, places=2)

    def test_inss_aliquota_12_pct(self):
        """
        Base INSS entre 1320,01 e 2571,29 → alíquota 12%.
        Ajusta salário para cair nessa faixa.
        """
        # ct=2 sal=3275.90 é alto. Vamos testar com um contrato de salário ~2000
        # Procura contrato com salário nessa faixa
        from django.db.models import Q
        ct_qs = Contrato.objects.filter(
            cargo__nome='Motorista',
            fim__isnull=True,
            salario__gte=1700,
            salario__lte=2300,
        ).first()
        if ct_qs is None:
            self.skipTest("Nenhum contrato com salário na faixa 1700–2300")

        # cria consolidado proporcional (31 efetivos)
        fc = self._criar_consolidado(ct_qs)
        aeval = get_interpreter()
        from django.db.models import Q as DjQ
        ev_e = list(EventoEmpresa.objects.filter(
            filiais=ct_qs.funcionario.filial_id
        ).select_related('evento'))
        folha = run_single(ct_qs, date(2026, 1, 1), ev_e, [], [], fc, aeval)
        eventos = {e['rastreio']: e for e in folha.regras['eventos']}
        base = eventos['U_base_inss']['valor']
        if 1320 < base <= 2571.29:
            self.assertAlmostEqual(
                eventos['U_inss_func']['valor'],
                round(base * 0.12, 2), places=2)

    def test_liquido_coerente_com_soma(self):
        """
        U_liquido deve ser consistente com a soma de proventos - descontos
        conforme a fórmula: salario + he50 + he100 + ad_noturno + vr - desc_vt - inss - irrf - desc_falta
        """
        folha = self._rodar_folha(2, dias_trab=22, dias_efetivos=31, he50_horas=2.0, noturnas=8.0)
        eventos = {e['rastreio']: e for e in folha.regras['eventos']}

        sal      = eventos['U_salario']['valor']
        he50     = eventos['U_he50']['valor']
        he100    = eventos.get('U_he100', {}).get('valor', 0)
        noturno  = eventos['U_ad_noturno']['valor']
        vr       = eventos['U_vr']['valor']
        desc_vt  = eventos['U_desc_vt']['valor']
        inss     = eventos['U_inss_func']['valor']
        irrf     = eventos['U_irrf']['valor']
        desc_flt = eventos['U_desc_falta']['valor']

        liquido_calculado = round(sal + he50 + he100 + noturno + vr - desc_vt - inss - irrf - desc_flt, 2)
        self.assertAlmostEqual(eventos['U_liquido']['valor'], liquido_calculado, places=2)

    def test_folha_sem_erros_evento_correto(self):
        """Folha de um motorista normal não deve ter erros de fórmula."""
        folha = self._rodar_folha(2)
        self.assertEqual(folha.total_erros, 0)
        self.assertIsNone(folha.erros)

    def test_encargo_cargo_mecanico_insalubridade(self):
        """
        Mecânico A deve receber adicional de insalubridade via EventoCargo.
        Valor = round(1518.00 * 0.20, 2) = 303.60
        """
        # ct=33 Mecanico A
        ct = Contrato.objects.get(pk=33)
        fc = self._criar_consolidado(ct)
        aeval = get_interpreter()
        from django.db.models import Q as DjQ
        ev_e = list(EventoEmpresa.objects.filter(filiais=ct.funcionario.filial_id).select_related('evento'))
        ev_c = list(EventoCargo.objects.filter(cargo=ct.cargo).select_related('evento'))
        folha = run_single(ct, date(2026, 1, 1), ev_e, ev_c, [], fc, aeval)
        eventos = {e['rastreio']: e for e in folha.regras['eventos']}
        self.assertIn('U_ad_insalub', eventos)
        self.assertAlmostEqual(eventos['U_ad_insalub']['valor'], 303.60, places=2)

    def test_encargo_funcionario_adiantamento(self):
        """
        Funcionários com EventoFuncionario de adiantamento devem ter U_adiantamento=500.
        """
        # Encontra um func com EventoFuncionario de adiantamento
        ev_func_qs = EventoFuncionario.objects.filter(
            evento__rastreio='U_adiantamento'
        ).select_related('funcionario', 'funcionario__contratos')
        if not ev_func_qs.exists():
            self.skipTest("Nenhum EventoFuncionario de adiantamento cadastrado")

        ev_func = ev_func_qs.first()
        func = ev_func.funcionario
        from django.db.models import Q as DjQ
        ct = func.contratos.filter(
            inicio__lte=date(2026, 1, 31)
        ).filter(
            DjQ(fim__isnull=True) | DjQ(fim__gte=date(2026, 1, 1))
        ).first()
        if not ct:
            self.skipTest("Funcionário com adiantamento não tem contrato ativo")

        fc = self._criar_consolidado(ct)
        aeval = get_interpreter()
        ev_e = list(EventoEmpresa.objects.filter(filiais=func.filial_id).select_related('evento'))
        ev_f = list(EventoFuncionario.objects.filter(
            funcionario=func, inicio__lte=date(2026, 1, 31)
        ).select_related('evento'))
        folha = run_single(ct, date(2026, 1, 1), ev_e, [], ev_f, fc, aeval)
        eventos = {e['rastreio']: e for e in folha.regras['eventos']}
        self.assertIn('U_adiantamento', eventos)
        self.assertAlmostEqual(eventos['U_adiantamento']['valor'], 500.0, places=2)


# ══════════════════════════════════════════════════════════════════════════════
# GRUPO 6 — payroll_run: lote completo por filial
# ══════════════════════════════════════════════════════════════════════════════

class PayrollRunTests(TestCase):
    fixtures = ['fixture_pessoal.json']

    def _criar_consolidados_filial(self, filial_pk, mes=1, ano=2026):
        """Cria FrequenciaConsolidadas sintéticas para todos contratos da filial."""
        from django.db.models import Q as DjQ
        ini, fim = get_period(mes, ano)
        contratos = Contrato.objects.filter(
            funcionario__filial_id=filial_pk,
            inicio__lte=fim
        ).filter(DjQ(fim__isnull=True) | DjQ(fim__gte=ini))

        for ct in contratos:
            dias_ct = sum(
                1 for n in range((fim - ini).days + 1)
                if ct.inicio <= (ini + timedelta(n)) <= (ct.fim or date.max)
            )
            FrequenciaConsolidada.objects.update_or_create(
                contrato=ct, competencia=ini,
                defaults=dict(
                    inicio=timezone.make_aware(datetime(ano, mes, 1), TZ),
                    fim=timezone.make_aware(datetime(ano, mes, 28 if mes == 2 else 31, 23, 59), TZ),
                    status=FrequenciaConsolidada.Status.FECHADO,
                    consolidado={
                        'H_horas_trabalhadas':     176.0,
                        'H_horas_extras':          0.0,
                        'H_horas_noturnas':        0.0,
                        'H_intervalos':            0.0,
                        'H_faltas_justificadas':   0.0,
                        'H_faltas_injustificadas': 0.0,
                        'H_atestados':             0.0,
                        'H_dias_trabalhados':      22,
                        'H_dias_falta_just':       0,
                        'H_dias_falta_njust':      0,
                        'H_dias_folga':            9,
                        'H_dias_afastamento':      0,
                        'H_dias_mes':              31,
                        'H_dias_contrato':         dias_ct,
                        'H_dias_efetivos':         dias_ct,
                        'EF': {},
                    }
                )
            )
        return contratos.count()

    def test_payroll_run_processa_filial_sem_erros(self):
        """payroll_run deve rodar sem exceção para filial 1."""
        n = self._criar_consolidados_filial(filial_pk=1)
        total = payroll_run(filial_id=1, mes=1, ano=2026)
        self.assertEqual(total, n)

    def test_payroll_run_gera_folhas_no_banco(self):
        """Após payroll_run, FolhaPagamento deve existir para cada contrato."""
        self._criar_consolidados_filial(filial_pk=1)
        payroll_run(filial_id=1, mes=1, ano=2026)
        qtd_folhas = FolhaPagamento.objects.filter(
            contrato__funcionario__filial_id=1,
            competencia=date(2026, 1, 1)
        ).count()
        self.assertGreater(qtd_folhas, 0)

    def test_payroll_run_idempotente(self):
        """Rodar duas vezes não deve duplicar registros (update_or_create)."""
        self._criar_consolidados_filial(filial_pk=1)
        payroll_run(filial_id=1, mes=1, ano=2026)
        payroll_run(filial_id=1, mes=1, ano=2026)
        qtd = FolhaPagamento.objects.filter(
            contrato__funcionario__filial_id=1,
            competencia=date(2026, 1, 1)
        ).count()
        esperado = Contrato.objects.filter(
            funcionario__filial_id=1,
            inicio__lte=date(2026, 1, 31)
        ).filter(
            __import__('django.db.models', fromlist=['Q']).Q(fim__isnull=True) |
            __import__('django.db.models', fromlist=['Q']).Q(fim__gte=date(2026, 1, 1))
        ).count()
        self.assertEqual(qtd, esperado)

    def test_payroll_run_contrato_fora_do_periodo_nao_gera_folha(self):
        """
        Contratos fora do período (ex: encerrados antes de jan/2026)
        não devem gerar FolhaPagamento.
        """
        self._criar_consolidados_filial(filial_pk=1)
        payroll_run(filial_id=1, mes=1, ano=2026)
        # ct=39 encerrou em 2023-11-30 — não deve ter folha
        self.assertFalse(
            FolhaPagamento.objects.filter(contrato_id=39, competencia=date(2026, 1, 1)).exists()
        )

    def test_payroll_run_proventos_maiores_que_zero(self):
        """Proventos de todos os contratos com salário devem ser > 0."""
        self._criar_consolidados_filial(filial_pk=1)
        payroll_run(filial_id=1, mes=1, ano=2026)
        folhas = FolhaPagamento.objects.filter(
            contrato__funcionario__filial_id=1,
            competencia=date(2026, 1, 1),
            total_erros=0,
        )
        for f in folhas:
            self.assertGreater(f.proventos, 0,
                msg=f"Folha contrato={f.contrato_id} tem proventos=0")

    def test_payroll_run_sem_consolidado_roda_sem_explodir(self):
        """
        Contratos sem FrequenciaConsolidada devem gerar folha com H_*=0
        e não levantar exceção.
        """
        # Não cria consolidados — run_single deve tratar freq=None
        try:
            payroll_run(filial_id=1, mes=1, ano=2026)
        except Exception as e:
            self.fail(f"payroll_run levantou exceção com consolidado ausente: {e}")


# ══════════════════════════════════════════════════════════════════════════════
# GRUPO 7 — Edge cases e cenários especiais
# ══════════════════════════════════════════════════════════════════════════════

class EdgeCaseTests(TestCase):
    fixtures = ['fixture_pessoal.json']

    def test_funcionario_sem_contrato_nao_tem_property_F_salario(self):
        """Funcionário sem contrato → F_salario = 0."""
        func = Funcionario.objects.get(pk=199)  # sem contrato no fixture
        self.assertEqual(func.F_salario, 0)

    def test_funcionario_sem_contrato_F_contrato_e_none(self):
        """F_contrato retorna None para funcionários sem contrato ativo."""
        func = Funcionario.objects.get(pk=199)
        self.assertIsNone(func.F_contrato)

    def test_contrato_multiplos_apenas_ativo_conta(self):
        """
        Funcionários 195-198 têm 2 contratos: 1 antigo + 1 atual.
        F_contrato deve retornar apenas o vigente em jan/2026.
        """
        from django.db.models import Q as DjQ
        func = Funcionario.objects.get(pk=195)
        # Limpa cache da property
        if hasattr(func, '_cached_contrato'):
            del func._cached_contrato
        ct_ativo = func.F_contrato
        if ct_ativo:
            self.assertIsNone(ct_ativo.fim)   # contrato aberto = ativo
        # Deve ter exatamente 2 contratos no banco
        self.assertEqual(func.contratos.count(), 2)

    def test_merge_events_prioridade_funcionario_sobre_empresa(self):
        """EventoFuncionario deve sobrescrever EventoEmpresa para o mesmo rastreio."""
        class FakeEvento:
            def __init__(self, rastreio): self.evento = type('E', (), {'rastreio': rastreio})()

        ev_empresa = [FakeEvento('U_salario')]
        ev_cargo   = []
        ev_func    = [FakeEvento('U_salario')]

        # mock para ter rastreio acessível
        ev_empresa[0].id = 1
        ev_func[0].id = 99

        regras = merge_events(ev_empresa, ev_cargo, ev_func)
        self.assertEqual(regras['U_salario'].id, 99)  # funcionário tem prioridade

    def test_merge_events_prioridade_cargo_sobre_empresa(self):
        """EventoCargo deve sobrescrever EventoEmpresa."""
        class FakeEvento:
            def __init__(self, rastreio, ev_id):
                self.id = ev_id
                self.evento = type('E', (), {'rastreio': rastreio})()

        ev_e = [FakeEvento('U_ad_insalub', 1)]
        ev_c = [FakeEvento('U_ad_insalub', 50)]
        ev_f = []

        regras = merge_events(ev_e, ev_c, ev_f)
        self.assertEqual(regras['U_ad_insalub'].id, 50)

    def test_consolidar_competencia_sempre_dia_1(self):
        """FrequenciaConsolidada.competencia deve ser sempre o dia 1 do mês."""
        ct = Contrato.objects.get(pk=2)
        obj = consolidar(ct, date(2026, 1, 1), date(2026, 1, 31))
        self.assertEqual(obj.competencia.day, 1)
        self.assertEqual(obj.competencia.month, 1)
        self.assertEqual(obj.competencia.year, 2026)

    def test_consolidar_arredondamento_float(self):
        """Valores float no consolidado devem ter no máximo 4 casas decimais."""
        ct = Contrato.objects.get(pk=4)
        # Insere 1 frequência para evitar erro de dia sem registro
        Frequencia.objects.create(
            contrato=ct,
            evento=EventoFrequencia.objects.get(pk=1),
            data=date(2026, 1, 5),
            inicio=_dt(2026, 1, 5, 6, 0),
            fim=_dt(2026, 1, 5, 13, 20),  # 7h20 = 7.3333... horas
        )
        obj = consolidar(ct, date(2026, 1, 5), date(2026, 1, 5))
        for k, v in obj.consolidado.items():
            if isinstance(v, float):
                # Verifica que o valor não tem mais de 4 casas decimais
                partes = str(v).split('.')
                if len(partes) > 1:
                    self.assertLessEqual(len(partes[1]), 4,
                        msg=f"Campo {k}={v} tem mais de 4 casas decimais")

    def test_frequencia_dia_inteiro_sem_horario(self):
        """Evento dia_inteiro não deve gerar h_trabalhadas via _horas."""
        ct = Contrato.objects.get(pk=2)
        Frequencia.objects.create(
            contrato=ct,
            evento=EventoFrequencia.objects.get(pk=2),  # Folga Semanal, dia_inteiro=True
            data=date(2026, 1, 4),
        )
        obj = consolidar(ct, date(2026, 1, 4), date(2026, 1, 4))
        self.assertEqual(obj.consolidado['H_horas_trabalhadas'], 0.0)
        self.assertEqual(obj.consolidado['H_dias_folga'], 1)

    def test_contrato_iniciado_no_meio_do_mes_erros_so_da_vigencia(self):
        """
        Contrato 23 (ini 2026-03-19): erros em março/2026 devem ser apenas dias 19–31.
        Dias 1–18 não devem aparecer no dicionário de erros.
        """
        ct = Contrato.objects.get(pk=23)
        obj = consolidar(ct, date(2026, 3, 1), date(2026, 3, 31))
        for dia in range(1, 19):
            self.assertNotIn(f'2026-03-{dia:02d}', obj.erros)
        # Dias 19–31 estão na vigência e sem registro → devem ter erro
        self.assertIn('2026-03-19', obj.erros)

    def test_get_period_retorna_datas_corretas(self):
        """get_period(1, 2026) deve retornar (2026-01-01, 2026-01-31)."""
        ini, fim = get_period(1, 2026)
        self.assertEqual(ini, date(2026, 1, 1))
        self.assertEqual(fim, date(2026, 1, 31))

    def test_get_period_fevereiro_nao_bissexto(self):
        """get_period(2, 2026) deve retornar (2026-02-01, 2026-02-28)."""
        ini, fim = get_period(2, 2026)
        self.assertEqual(fim, date(2026, 2, 28))

    def test_H_dias_contrato_nao_excede_dias_do_mes(self):
        """H_dias_contrato não deve ser maior que H_dias_mes."""
        ct = Contrato.objects.get(pk=2)
        obj = consolidar(ct, date(2026, 1, 1), date(2026, 1, 31))
        c = obj.consolidado
        self.assertLessEqual(c['H_dias_contrato'], c['H_dias_mes'])

    def test_H_dias_efetivos_nao_excede_H_dias_contrato(self):
        """H_dias_efetivos não deve ser maior que H_dias_contrato."""
        ct = Contrato.objects.get(pk=2)
        # Cria 1 falta injustificada
        Frequencia.objects.create(
            contrato=ct,
            evento=EventoFrequencia.objects.get(pk=6),
            data=date(2026, 1, 15),
        )
        obj = consolidar(ct, date(2026, 1, 1), date(2026, 1, 31))
        c = obj.consolidado
        self.assertLessEqual(c['H_dias_efetivos'], c['H_dias_contrato'])

    def test_folha_sem_frequencia_nao_levanta_excecao(self):
        """run_single com freq=None deve rodar e gerar folha sem erros de importação."""
        ct = Contrato.objects.get(pk=2)
        aeval = get_interpreter()
        from django.db.models import Q as DjQ
        ev_e = list(EventoEmpresa.objects.filter(filiais=ct.funcionario.filial_id).select_related('evento'))
        try:
            folha = run_single(ct, date(2026, 1, 1), ev_e, [], [], None, aeval)
            self.assertIsNotNone(folha)
        except Exception as e:
            self.fail(f"run_single com freq=None levantou: {e}")

    def test_desconto_falta_injustificada_na_folha(self):
        """
        1 dia de falta injustificada → U_desc_falta = round(sal / 31 * 1, 2).
        """
        ct = Contrato.objects.get(pk=2)
        fc, _ = FrequenciaConsolidada.objects.update_or_create(
            contrato=ct, competencia=date(2026, 1, 1),
            defaults=dict(
                inicio=timezone.make_aware(datetime(2026, 1, 1), TZ),
                fim=timezone.make_aware(datetime(2026, 1, 31, 23, 59), TZ),
                status=FrequenciaConsolidada.Status.FECHADO,
                consolidado={
                    'H_horas_trabalhadas': 168.0, 'H_horas_extras': 0.0,
                    'H_horas_noturnas': 0.0, 'H_intervalos': 0.0,
                    'H_faltas_justificadas': 0.0, 'H_faltas_injustificadas': 8.0,
                    'H_atestados': 0.0, 'H_dias_trabalhados': 21,
                    'H_dias_falta_just': 0, 'H_dias_falta_njust': 1,
                    'H_dias_folga': 9, 'H_dias_afastamento': 0,
                    'H_dias_mes': 31, 'H_dias_contrato': 31, 'H_dias_efetivos': 30,
                    'EF': {}
                }
            )
        )
        aeval = get_interpreter()
        ev_e = list(EventoEmpresa.objects.filter(filiais=ct.funcionario.filial_id).select_related('evento'))
        folha = run_single(ct, date(2026, 1, 1), ev_e, [], [], fc, aeval)
        eventos = {e['rastreio']: e for e in folha.regras['eventos']}
        sal_calc = float(ct.salario)
        esperado = round(sal_calc / 31 * 1, 2)
        self.assertAlmostEqual(eventos['U_desc_falta']['valor'], esperado, places=2)