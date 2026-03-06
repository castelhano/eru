"""
views.py (dashboard) — View única do painel de frequência/folha.
GET  → carrega contexto do dashboard (resumos, status dos jobs, etc.)
POST → despacha ações declaradas em _ACOES

_ACOES — registro central de cada processo:
    label            → texto exibido no botão e no card
    job_tipo         → ProcessamentoJob.Tipo correspondente
    resumo_fn        → método que retorna dict de resumo (ou None)
    icon             → ícone Bootstrap para o card de última execução
    metric_min_width → minmax do CSS grid dos metric-boxes (padrão: 110)
    metric_style     → dict campo → opções visuais por métrica:
                           hide_prefix  → oculta "R$ " do valor
                           val_size     → font-size do .m-val (ex: '.9rem')
    card_links       → dict campo → URL de detalhe (target=_blank)
                       Use {filial_id} e {competencia} como placeholders;
                       a view os interpola antes de enviar ao template.
                       Use None para deixar o box não-clicável.
    sub_jobs         → lista de chaves de _ACOES cujos jobs aparecem como
                       sub-bloco no card de última execução deste item.
                       Usado para agrupar processamento + fechamento + pagamento
                       no mesmo card visual.
"""
import calendar
import csv
from datetime import datetime, date
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib import messages
from django.db.models import Sum, Count, Min, Max, Q as Qm
from django.http import JsonResponse, HttpResponse
from django.utils.translation import gettext_lazy as _
from django.utils import timezone
from django.shortcuts import redirect
from core.views import BaseTemplateView
from pessoal.models import (
    Contrato, FolhaPagamento, FrequenciaConsolidada, ProcessamentoJob, Funcionario
)
from pessoal.tasks import (
    disparar_consolidacao, disparar_folha, disparar_carga_escala,
    disparar_fechar_freq, disparar_fechar_folha, disparar_pagar_folha, disparar_cancelar_folha,
)

# ─── Registro central de ações ───────────────────────────────────────────────

_ACOES = {
    'carregar_escala': {
        'is_sub_job':       False,
        'label':            _('Carregar escala'),
        'job_tipo':         ProcessamentoJob.Tipo.CARGA_ESCALA,
        'resumo_fn':        None,
        'icon':             'bi bi-calendar-date-fill text-primary-matte',
        'metric_min_width': None,
        'metric_style':     {},
        'card_links':       {},
        'sub_jobs':         [],
    },
    'consolidar_freq': {
        'is_sub_job':       False,
        'label':            _('Consolidar frequência'),
        'job_tipo':         ProcessamentoJob.Tipo.CONSOLIDACAO_FREQ,
        'resumo_fn':        '_resumo_freq',
        'icon':             'bi bi-calendar-check-fill text-info-matte',
        'metric_min_width': 110,
        'metric_style':     {},
        'card_links': {
            'pendencias':       '/pessoal/dashboard/detalhe/?tipo=freq_erros&filial_id={filial_id}&competencia={competencia}',
            'H_horas_extras':   '/pessoal/dashboard/detalhe/?tipo=freq_he&filial_id={filial_id}&competencia={competencia}',
            'dias_falta_just':  '/pessoal/dashboard/detalhe/?tipo=freq_falta_just&filial_id={filial_id}&competencia={competencia}',
            'dias_falta_njust': '/pessoal/dashboard/detalhe/?tipo=freq_falta_njust&filial_id={filial_id}&competencia={competencia}',
            'dias_atestado':    '/pessoal/dashboard/detalhe/?tipo=freq_atestados&filial_id={filial_id}&competencia={competencia}',
            'consolidados':     '/pessoal/dashboard/detalhe/?tipo=freq_consolidados&filial_id={filial_id}&competencia={competencia}',
            'total_contratos':  None,
        },
        'sub_jobs': ['fechar_freq'],
    },
    'fechar_freq': {
        'is_sub_job':       True,
        'label':            _('Fechar frequência'),
        'job_tipo':         ProcessamentoJob.Tipo.FECHAR_FREQ,
        'resumo_fn':        None,
        # 'icon':             'bi bi-lock-fill text-info-matte',
        'metric_min_width': None,
        'metric_style':     {},
        'card_links':       {},
        'sub_jobs':         [],
    },
    'processar_folha': {
        'is_sub_job':       False,
        'label':            _('Processar folha'),
        'job_tipo':         ProcessamentoJob.Tipo.FOLHA,
        'resumo_fn':        '_resumo_folha',
        'icon':             'bi bi-percent text-warning-matte',
        'metric_min_width': 150,
        'metric_style': {
            'total_bruto':     {'hide_prefix': True, 'val_size': '.9rem'},
            'total_descontos': {'hide_prefix': True, 'val_size': '.9rem'},
            'total_liq':       {'hide_prefix': True, 'val_size': '.9rem'},
        },
        'card_links': {
            'total_bruto':     '/pessoal/dashboard/detalhe/?tipo=folha_lista&filial_id={filial_id}&competencia={competencia}',
            'total_descontos': '/pessoal/dashboard/detalhe/?tipo=folha_lista&filial_id={filial_id}&competencia={competencia}',
            'total_liq':       '/pessoal/dashboard/detalhe/?tipo=folha_lista&filial_id={filial_id}&competencia={competencia}',
            'qtd_total':       '/pessoal/dashboard/detalhe/?tipo=folha_lista&filial_id={filial_id}&competencia={competencia}',
            'qtd_erros':       '/pessoal/dashboard/detalhe/?tipo=folha_erros&filial_id={filial_id}&competencia={competencia}',
        },
        'sub_jobs': ['fechar_folha', 'pagar_folha'],
    },
    'fechar_folha': {
        'is_sub_job':       True,
        'label':            _('Fechar folha'),
        'job_tipo':         ProcessamentoJob.Tipo.FECHAR_FOLHA,
        'resumo_fn':        None,
        # 'icon':             'bi bi-lock-fill text-warning-matte',
        'metric_min_width': None,
        'metric_style':     {},
        'card_links':       {},
        'sub_jobs':         [],
    },
    'pagar_folha': {
        'is_sub_job':       True,
        'label':            _('Pagar folha'),
        'job_tipo':         ProcessamentoJob.Tipo.PAGAR_FOLHA,
        'resumo_fn':        None,
        'icon':             'bi bi-cash-coin text-success-matte',
        'metric_min_width': None,
        'metric_style':     {},
        'card_links':       {},
        'sub_jobs':         [],
    },
}


class FolhaDashboardView(LoginRequiredMixin, BaseTemplateView):
    template_name = 'pessoal/folha_dashboard.html'

    # ── GET ──────────────────────────────────────────────────────────────────

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        filial_id, competencia = self._parse_params()
        context['filtro'] = {
            'filial_id':   filial_id,
            'competencia': competencia.strftime('%Y-%m') if competencia else datetime.today().strftime('%Y-%m'),
            # botões de ação exibidos no painel — exclui sub_jobs (aparecem nos cards)
            'acoes': {k: v['label'] for k, v in _ACOES.items() if not v.get('is_sub_job')},
        }
        context['consultado'] = False
        if filial_id and competencia:
            context.update(self._montar_dashboard(filial_id, competencia))
        return context

    def _montar_dashboard(self, filial_id: int, competencia: date) -> dict:
        _, fim_comp = self._parse_periodo(competencia)
        comp_str = competencia.strftime('%Y-%m')

        tipos    = [cfg['job_tipo'] for cfg in _ACOES.values()]
        jobs_map = {
            j.tipo: j
            for j in ProcessamentoJob.objects.filter(
                filial_id=filial_id,
                competencia=competencia,
                tipo__in=tipos,
            )
        }

        cards_jobs = []
        for acao, cfg in _ACOES.items():
            if cfg.get('is_sub_job'):
                continue  # sub-jobs aparecem embutidos nos cards principais, não como cards próprios
            job    = jobs_map.get(cfg['job_tipo'])
            resumo = (
                getattr(self, cfg['resumo_fn'])(filial_id, competencia, fim_comp)
                if cfg['resumo_fn'] else None
            )

            # Interpola placeholders nas URLs de card_links
            links = {}
            for campo, url in cfg.get('card_links', {}).items():
                if url:
                    links[campo] = url.format(
                        filial_id=filial_id,
                        competencia=comp_str,
                    )
                else:
                    links[campo] = None

            cards_jobs.append({
                'acao':             acao,
                'label':            cfg['label'],
                'icon':             cfg['icon'],
                'job':              job,
                'resumo':           resumo,
                'metric_min_width': cfg.get('metric_min_width') or 110,
                'metric_style':     cfg.get('metric_style', {}),
                'card_links':       links,
                # sub_jobs: lista de dicts {acao, label, icon, job} para renderizar
                # como sub-bloco no card de última execução
                'sub_jobs': [
                    {
                        'acao':  sub_acao,
                        'label': _ACOES[sub_acao]['label'],
                        'icon':  _ACOES[sub_acao].get('icon', None),
                        'job':   jobs_map.get(_ACOES[sub_acao]['job_tipo']),
                    }
                    for sub_acao in cfg.get('sub_jobs', [])
                ],
            })

        return {'cards_jobs': cards_jobs, 'consultado': True}

    # ── Funções de resumo ─────────────────────────────────────────────────────

    def _resumo_freq(self, filial_id, competencia, fim_comp) -> dict | None:
        consolidados = list(
            FrequenciaConsolidada.objects.filter(
                contrato__funcionario__filial_id=filial_id,
                competencia=competencia,
            )
        )
        if not consolidados:
            return None

        totais = {'H_horas_extras': 0.0, 'dias_falta_just': 0, 'dias_falta_njust': 0, 'dias_atestado': 0}
        qtd_erros = 0
        for fc in consolidados:
            c = fc.consolidado or {}
            totais['H_horas_extras']   += c.get('H_horas_extras', 0)
            totais['dias_falta_just']  += c.get('H_dias_falta_just', 0)
            totais['dias_falta_njust'] += c.get('H_dias_falta_njust', 0)
            totais['dias_atestado']    += c.get('H_dias_afastamento', 0)
            qtd_erros                  += len(fc.erros or {})

        datas = FrequenciaConsolidada.objects.filter(
            contrato__funcionario__filial_id=filial_id,
            competencia=competencia,
        ).aggregate(inicio=Min('inicio'), fim=Max('fim'))

        periodo = None
        if datas['inicio'] and datas['fim']:
            periodo = {
                'inicio': timezone.localtime(datas['inicio']).strftime('%d/%m/%y'),
                'fim':    timezone.localtime(datas['fim']).strftime('%d/%m/%y'),
            }

        total_contratos = (
            Contrato.objects
            .filter(funcionario__filial_id=filial_id, inicio__lte=fim_comp)
            .filter(Qm(fim__gte=competencia) | Qm(fim__isnull=True))
            .count()
        )

        todos_fechados = all(fc.status == FrequenciaConsolidada.Status.FECHADO for fc in consolidados)
        status = 'FECHADO' if todos_fechados else ('ABERTO' if qtd_erros else 'PROCESSADO')

        return {
            **totais,
            'consolidados':    len(consolidados),
            'total_contratos': total_contratos,
            'pendencias':      qtd_erros,
            'periodo':         periodo,
            'status':          status,
        }

    def _resumo_folha(self, filial_id, competencia, fim_comp) -> dict | None:
        qs = FolhaPagamento.objects.filter(
            contrato__funcionario__filial_id=filial_id,
            competencia=competencia,
        )
        if not qs.exists():
            return None

        agg = qs.aggregate(
            total_bruto=Sum('proventos'),
            total_descontos=Sum('descontos'),
            total_liq=Sum('liquido'),
            qtd_total=Count('id'),
            qtd_erros=Count('id', filter=Qm(total_erros__gt=0)),
        )

        # Status do lote: PAGO se todas pagas, FECHADO se todas fechadas, etc.
        statuses = set(qs.values_list('status', flat=True).distinct())
        if statuses == {FolhaPagamento.Status.PAGO}:
            status = 'PAGO'
        elif FolhaPagamento.Status.PAGO in statuses:
            status = 'PAGO PARCIAL'
        elif statuses == {FolhaPagamento.Status.FECHADO}:
            status = 'FECHADO'
        elif FolhaPagamento.Status.CANCELADO in statuses:
            status = 'CANCELADO'
        else:
            status = 'RASCUNHO'

        return {**agg, 'status': status}

    # ── GET handlers ─────────────────────────────────────────────────────────

    def get(self, request, *args, **kwargs):
        if request.GET.get('export') == 'erros_freq':
            return self._export_erros_csv(request)
        return super().get(request, *args, **kwargs)

    def _export_erros_csv(self, request):
        filial_id, competencia = self._parse_params()
        if not filial_id or not competencia:
            return HttpResponse('Parâmetros inválidos.', status=400)

        response = HttpResponse(
            content_type='text/csv; charset=utf-8-sig',
            headers={'Content-Disposition': f'attachment; filename="erros_freq_{competencia}.csv"'},
        )
        response.set_cookie('fileDownload', 'true', max_age=60)

        writer = csv.writer(response, delimiter=';')
        writer.writerow(['Matrícula', 'Funcionário', 'Data', 'Motivo'])

        qs = FrequenciaConsolidada.objects.filter(
            contrato__funcionario__filial_id=filial_id,
            competencia=competencia,
        ).select_related('contrato__funcionario')

        for fc in qs:
            func = fc.contrato.funcionario
            for data, motivo in sorted((fc.erros or {}).items()):
                writer.writerow([func.matricula, func.nome, data, motivo])

        return response

    # ── POST ─────────────────────────────────────────────────────────────────

    def post(self, request, *args, **kwargs):
        acao      = request.POST.get('acao', '').strip()
        filial_id, competencia = self._parse_params()

        if acao not in _ACOES:
            messages.error(request, 'Ação inválida.')
            return redirect(request.path)
        if not filial_id or not competencia:
            messages.error(request, 'Filial e competência obrigatórios.')
            return redirect(request.path)

        try:
            getattr(self, f'_acao_{acao}')(filial_id, competencia)
        except Exception as e:
            messages.error(request, str(e))

        return redirect(
            f"{request.path}?filial_id={filial_id}&competencia={competencia.strftime('%Y-%m')}"
        )

    def _acao_consolidar_freq(self, filial_id, competencia):
        inicio, fim = self._parse_periodo(competencia)
        inicio_str  = self.request.POST.get('inicio', '').strip()
        fim_str     = self.request.POST.get('fim',    '').strip()
        if inicio_str:
            inicio = date.fromisoformat(inicio_str)
        if fim_str:
            fim = date.fromisoformat(fim_str)
        return disparar_consolidacao(
            filial_id=filial_id,
            competencia=competencia,
            inicio=inicio,
            fim=fim,
            matricula_de=self.request.POST.get('matricula_de',  '').strip() or None,
            matricula_ate=self.request.POST.get('matricula_ate', '').strip() or None,
            usuario=self.request.user,
        )

    def _acao_processar_folha(self, filial_id, competencia):
        return disparar_folha(
            filial_id=filial_id,
            competencia=competencia,
            usuario=self.request.user,
        )

    def _acao_fechar_freq(self, filial_id, competencia):
        # Bloqueia se houver qualquer consolidado ABERTO (com erros) na competência
        freq_aberta = FrequenciaConsolidada.objects.filter(
            contrato__funcionario__filial_id=filial_id,
            competencia=competencia,
            status=FrequenciaConsolidada.Status.ABERTO,
        ).exists()
        if freq_aberta:
            raise ValueError(
                'Existem frequências com pendências (ABERTO). '
                'Corrija os erros antes de fechar a frequência.'
            )
        return disparar_fechar_freq(
            filial_id=filial_id,
            competencia=competencia,
            usuario=self.request.user,
        )

    def _acao_fechar_folha(self, filial_id, competencia):
        # Bloqueia se houver qualquer frequência ainda ABERTA (com erros)
        freq_aberta = FrequenciaConsolidada.objects.filter(
            contrato__funcionario__filial_id=filial_id,
            competencia=competencia,
            status=FrequenciaConsolidada.Status.ABERTO,
        ).exists()
        if freq_aberta:
            raise ValueError(
                'Existem frequências com pendências (ABERTO). '
                'Corrija ou feche a frequência antes de fechar a folha.'
            )
        return disparar_fechar_folha(
            filial_id=filial_id,
            competencia=competencia,
            usuario=self.request.user,
        )

    def _acao_pagar_folha(self, filial_id, competencia):
        # Bloqueia se houver qualquer folha que não esteja FECHADO
        nao_fechada = FolhaPagamento.objects.filter(
            contrato__funcionario__filial_id=filial_id,
            competencia=competencia,
        ).exclude(status=FolhaPagamento.Status.FECHADO).exists()
        if nao_fechada:
            raise ValueError(
                'Existem folhas não fechadas na competência. '
                'Feche todas as folhas antes de efetuar o pagamento.'
            )
        return disparar_pagar_folha(
            filial_id=filial_id,
            competencia=competencia,
            usuario=self.request.user,
        )

    def _acao_cancelar_folha(self, filial_id, competencia):
        return disparar_cancelar_folha(
            filial_id=filial_id,
            competencia=competencia,
            usuario=self.request.user,
        )

    def _acao_carregar_escala(self, filial_id, competencia):
        inicio, fim = self._parse_periodo(competencia)
        inicio_str  = self.request.POST.get('inicio', '').strip()
        fim_str     = self.request.POST.get('fim',    '').strip()
        if inicio_str:
            inicio = date.fromisoformat(inicio_str)
        if fim_str:
            fim = date.fromisoformat(fim_str)
        return disparar_carga_escala(
            filial_id=filial_id,
            competencia=competencia,
            inicio=inicio,
            fim=fim,
            matricula_de=self.request.POST.get('matricula_de',  '').strip() or None,
            matricula_ate=self.request.POST.get('matricula_ate', '').strip() or None,
            usuario=self.request.user,
        )

    # ── Helpers ──────────────────────────────────────────────────────────────

    def _parse_params(self) -> tuple[int | None, date | None]:
        params = self.request.GET if self.request.method == 'GET' else self.request.POST
        try:
            filial_id   = int(params.get('filial_id', 0)) or None
            competencia = datetime.strptime(params.get('competencia', ''), '%Y-%m').date().replace(day=1)
            return filial_id, competencia
        except (ValueError, AttributeError):
            return None, None

    def _parse_periodo(self, competencia: date) -> tuple[date, date]:
        ultimo = calendar.monthrange(competencia.year, competencia.month)[1]
        return competencia, competencia.replace(day=ultimo)

# ─── Registro de tipos de detalhe para DashboardDetalheView ──────────────────
#
# Cada entrada define como obter e exibir os dados de um card clicável do dashboard.
#
# Campos:
#   titulo       → título exibido no topo da página de detalhe
#   fonte        → 'freq_erros'      — erros do JSON FrequenciaConsolidada.erros
#                  'freq_consolidado' — FrequenciaConsolidada filtrado por filtro_consolidado
#                  'folha'            — FolhaPagamento filtrado por filtro_qs
#   filtro_consolidado → callable(consolidado_dict) → bool, usado quando fonte='freq_consolidado'
#   filtro_qs    → dict de kwargs para .filter(), usado quando fonte='folha'
#   colunas      → lista de chaves que o template deve renderizar
#                  colunas especiais: 'matricula', 'nome' (do funcionário), 'erros_json' (folha)
_DETALHES: dict[str, dict] = {
    # ── Frequência — erros do JSON (dias sem registro, etc.) ─────────────────
    'freq_erros': {
        'titulo':              _('Pendências de Frequência'),
        'fonte':               'freq_erros',
        'colunas':             ['matricula', 'nome', 'data', 'motivo'],
    },
    # ── Frequência — consolidados com hora extra ──────────────────────────────
    'freq_he': {
        'titulo':              _('Horas Extras'),
        'fonte':               'freq_consolidado',
        'filtro_consolidado':  lambda c: (c.get('H_horas_extras') or 0) > 0,
        'colunas':             ['matricula', 'nome', 'H_horas_extras'],
    },
    # ── Frequência — faltas justificadas ─────────────────────────────────────
    'freq_falta_just': {
        'titulo':              _('Faltas Justificadas'),
        'fonte':               'freq_consolidado',
        'filtro_consolidado':  lambda c: (c.get('H_dias_falta_just') or 0) > 0,
        'colunas':             ['matricula', 'nome', 'H_dias_falta_just', 'H_faltas_justificadas'],
    },
    # ── Frequência — faltas injustificadas ───────────────────────────────────
    'freq_falta_njust': {
        'titulo':              _('Faltas Injustificadas'),
        'fonte':               'freq_consolidado',
        'filtro_consolidado':  lambda c: (c.get('H_dias_falta_njust') or 0) > 0,
        'colunas':             ['matricula', 'nome', 'H_dias_falta_njust', 'H_faltas_injustificadas'],
    },
    # ── Frequência — atestados/afastamentos ──────────────────────────────────
    'freq_atestados': {
        'titulo':              _('Atestados / Afastamentos'),
        'fonte':               'freq_consolidado',
        'filtro_consolidado':  lambda c: (c.get('H_dias_afastamento') or 0) > 0,
        'colunas':             ['matricula', 'nome', 'H_dias_afastamento', 'H_atestados'],
    },
    # ── Frequência — todos os consolidados ───────────────────────────────────
    'freq_consolidados': {
        'titulo':              _('Frequências Consolidadas'),
        'fonte':               'freq_consolidado',
        'filtro_consolidado':  None,  # sem filtro — lista todos
        'colunas':             ['matricula', 'nome', 'H_dias_trabalhados', 'H_horas_trabalhadas',
                                'H_horas_extras', 'H_dias_falta_just', 'H_dias_falta_njust', 'status'],
    },
    # ── Folha — lista geral ───────────────────────────────────────────────────
    'folha_lista': {
        'titulo':              _('Folha de Pagamento'),
        'fonte':               'folha',
        'filtro_qs':           {},
        'colunas':             ['matricula', 'nome', 'proventos', 'descontos', 'liquido', 'status'],
    },
    # ── Folha — com erros de cálculo ─────────────────────────────────────────
    'folha_erros': {
        'titulo':              _('Folha com Erros de Cálculo'),
        'fonte':               'folha',
        'filtro_qs':           {'total_erros__gt': 0},
        'colunas':             ['matricula', 'nome', 'total_erros', 'erros_json'],
    },
}

# Mapeamento nome-coluna → label legível para o cabeçalho da tabela
_COLUNA_LABEL: dict[str, str] = {
    'matricula':              'Matrícula',
    'nome':                   'Nome',
    'data':                   'Data',
    'motivo':                 'Motivo',
    'status':                 'Status',
    'H_horas_trabalhadas':    'Horas Trab.',
    'H_horas_extras':         'Horas Extras',
    'H_faltas_justificadas':  'Horas Falta J.',
    'H_faltas_injustificadas':'Horas Falta I.',
    'H_dias_trabalhados':     'Dias Trab.',
    'H_dias_falta_just':      'Dias Falta J.',
    'H_dias_falta_njust':     'Dias Falta I.',
    'H_dias_afastamento':     'Dias Afas.',
    'H_atestados':            'Horas Atestado',
    'proventos':              'Proventos (R$)',
    'descontos':              'Descontos (R$)',
    'liquido':                'Líquido (R$)',
    'total_erros':            'Qtd. Erros',
    'erros_json':             'Detalhes dos Erros',
}


class DashboardDetalheView(LoginRequiredMixin, BaseTemplateView):
    """
    View única para todos os cards clicáveis do dashboard.

    GET /pessoal/dashboard/detalhe/?tipo=TIPO&filial_id=X&competencia=YYYY-MM

    O parâmetro `tipo` mapeia para _DETALHES e determina qual queryset executar
    e quais colunas renderizar. O template é genérico para todos os tipos.
    """
    template_name = 'pessoal/dashboard_detalhe.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        tipo = self.request.GET.get('tipo', '').strip()
        cfg  = _DETALHES.get(tipo)

        if not cfg:
            context.update({'erro': _('Tipo de detalhe inválido.'), 'linhas': [], 'colunas': [], 'titulo': ''})
            return context

        try:
            filial_id, competencia = self._parse_params()
        except Exception:
            filial_id = competencia = None

        if not filial_id or not competencia:
            context.update({'erro': _('Filial e competência obrigatórios.'), 'linhas': [], 'colunas': [], 'titulo': cfg['titulo']})
            return context

        linhas  = self._coletar(cfg, filial_id, competencia)
        colunas = [(col, _COLUNA_LABEL.get(col, col)) for col in cfg['colunas']]

        context.update({
            'titulo':      cfg['titulo'],
            'colunas':     colunas,
            'linhas':      linhas,
            'filial_id':   filial_id,
            'competencia': competencia.strftime('%Y-%m'),
            'tipo':        tipo,
            'erro':        None,
        })
        return context

    # ── Coletores por fonte ───────────────────────────────────────────────────

    def _coletar(self, cfg: dict, filial_id: int, competencia: date) -> list[dict]:
        fonte = cfg['fonte']
        if fonte == 'freq_erros':
            return self._coletar_freq_erros(filial_id, competencia)
        if fonte == 'freq_consolidado':
            return self._coletar_freq_consolidado(cfg, filial_id, competencia)
        if fonte == 'folha':
            return self._coletar_folha(cfg, filial_id, competencia)
        return []

    def _coletar_freq_erros(self, filial_id: int, competencia: date) -> list[dict]:
        """Abre o JSON de erros de cada FrequenciaConsolidada e retorna uma linha por erro."""
        qs = (
            FrequenciaConsolidada.objects
            .filter(contrato__funcionario__filial_id=filial_id, competencia=competencia)
            .select_related('contrato__funcionario')
            .order_by('contrato__funcionario__matricula')
        )
        linhas = []
        for fc in qs:
            f = fc.contrato.funcionario
            for data_str, motivo in sorted((fc.erros or {}).items()):
                linhas.append({
                    'matricula': f.matricula,
                    'nome':      f.nome,
                    'data':      data_str,
                    'motivo':    motivo,
                })
        return linhas

    def _coletar_freq_consolidado(self, cfg: dict, filial_id: int, competencia: date) -> list[dict]:
        """Retorna uma linha por FrequenciaConsolidada, com campos do JSON consolidado."""
        qs = (
            FrequenciaConsolidada.objects
            .filter(contrato__funcionario__filial_id=filial_id, competencia=competencia)
            .select_related('contrato__funcionario')
            .order_by('contrato__funcionario__matricula')
        )
        fn_filtro = cfg.get('filtro_consolidado')
        linhas = []
        for fc in qs:
            c = fc.consolidado or {}
            if fn_filtro and not fn_filtro(c):
                continue
            f = fc.contrato.funcionario
            row = {'matricula': f.matricula, 'nome': f.nome, 'status': fc.get_status_display()}
            for col in cfg['colunas']:
                if col not in ('matricula', 'nome', 'status'):
                    row[col] = c.get(col, 0)
            linhas.append(row)
        return linhas

    def _coletar_folha(self, cfg: dict, filial_id: int, competencia: date) -> list[dict]:
        """Retorna uma linha por FolhaPagamento com campos de proventos/descontos/erros."""
        filtro_qs = cfg.get('filtro_qs') or {}
        qs = (
            FolhaPagamento.objects
            .filter(contrato__funcionario__filial_id=filial_id, competencia=competencia, **filtro_qs)
            .select_related('contrato__funcionario')
            .order_by('contrato__funcionario__matricula')
        )
        linhas = []
        for fp in qs:
            f = fp.contrato.funcionario
            row = {
                'matricula':  f.matricula,
                'nome':       f.nome,
                'proventos':  fp.proventos,
                'descontos':  fp.descontos,
                'liquido':    fp.liquido,
                'status':     fp.get_status_display(),
                'total_erros': fp.total_erros,
                'erros_json': fp.erros or {},
            }
            linhas.append(row)
        return linhas

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _parse_params(self) -> tuple[int, date]:
        p = self.request.GET
        filial_id   = int(p.get('filial_id', 0)) or None
        competencia = datetime.strptime(p.get('competencia', ''), '%Y-%m').date().replace(day=1)
        return filial_id, competencia