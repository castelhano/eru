"""
views.py (dashboard) — View única do painel de frequência/folha.
GET  → carrega contexto do dashboard (resumos, status dos jobs, etc.)
POST → despacha ações declaradas em _ACOES

_ACOES — registro central de cada processo:
    label            → texto exibido no botão e no card
    job_tipo         → ProcessamentoJob.Tipo correspondente
    resumo_fn        → método que retorna dict de resumo (ou None)
    icon             → ícone Bootstrap para o card de última execução
    permission       → django permission codename exigida (ou None = livre)
    metric_fields    → lista de dicts descrevendo cada métrica do card de resumo:
                           campo        → chave no dict retornado por resumo_fn
                           label        → texto exibido abaixo do valor
                           format       → 'int' | 'float1' | 'float2' | 'currency' | 'check'
                           css          → classe extra do metric-box (accent/warn/danger/…)
                           hide_if_zero → bool — oculta o box se valor == 0 (padrão False)
                           url_key      → chave em card_links para tornar o box clicável
    card_links       → dict campo → URL de detalhe (target=_blank)
                       Use {filial_id} e {competencia} como placeholders.
                       Use None para deixar o box não-clicável.
    metric_min_width → minmax do CSS grid dos metric-boxes (padrão: 110)
    sub_jobs         → dict  chave → cfg do sub-job (label, job_tipo, permission, icon)
                       Sub-jobs aparecem embutidos no card de última execução e
                       sempre exibem um botão de disparo inline.
"""
import calendar
import csv
from datetime import datetime, date

from django.contrib.auth.mixins import LoginRequiredMixin, PermissionRequiredMixin
from django.contrib import messages
from django.db.models import Sum, Count, Min, Max, Q as Qm
from django.http import HttpResponse
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
        'label':            _('Carregar escala'),
        'job_tipo':         ProcessamentoJob.Tipo.CARGA_ESCALA,
        'resumo_fn':        None,
        'icon':             'bi bi-calendar-date-fill text-primary-matte',
        'permission':       'pessoal.importar_escalas',
        'metric_fields':    [],
        'card_links':       {},
        'metric_min_width': 110,
        'sub_jobs':         {},
    },
    'consolidar_freq': {
        'label':            _('Consolidar frequência'),
        'job_tipo':         ProcessamentoJob.Tipo.CONSOLIDACAO_FREQ,
        'resumo_fn':        '_resumo_freq',
        'icon':             'bi bi-calendar-check-fill text-info-matte',
        'permission':       'pessoal.consolidar_frequencia',
        'metric_fields': [
            {'campo': 'consolidados',    'label': _('Consolidados'),      'format': 'int',    'css': 'accent',  'hide_if_zero': False, 'url_key': 'consolidados'},
            {'campo': 'total_contratos', 'label': _('Contratos ativos'),  'format': 'int',    'css': '',        'hide_if_zero': False, 'url_key': 'total_contratos'},
            {'campo': 'pendencias',      'label': _('Pendências'),        'format': 'check',  'css': 'danger',  'hide_if_zero': False, 'url_key': 'pendencias'},
            {'campo': 'H_horas_extras',  'label': _('Horas extras'),      'format': 'float1h','css': 'accent',  'hide_if_zero': False, 'url_key': 'H_horas_extras'},
            {'campo': 'dias_falta_just', 'label': _('Faltas justif.'),    'format': 'int',    'css': 'warn',    'hide_if_zero': False, 'url_key': 'dias_falta_just'},
            {'campo': 'dias_falta_njust','label': _('Faltas injustif.'),  'format': 'int',    'css': 'danger',  'hide_if_zero': False, 'url_key': 'dias_falta_njust'},
            {'campo': 'dias_atestado',   'label': _('Afastamentos'),      'format': 'int',    'css': '',        'hide_if_zero': False, 'url_key': 'dias_atestado'},
        ],
        'card_links': {
            'pendencias':       '/pessoal/dashboard/detalhe/?tipo=freq_erros&filial_id={filial_id}&competencia={competencia}',
            'H_horas_extras':   '/pessoal/dashboard/detalhe/?tipo=freq_he&filial_id={filial_id}&competencia={competencia}',
            'dias_falta_just':  '/pessoal/dashboard/detalhe/?tipo=freq_falta_just&filial_id={filial_id}&competencia={competencia}',
            'dias_falta_njust': '/pessoal/dashboard/detalhe/?tipo=freq_falta_njust&filial_id={filial_id}&competencia={competencia}',
            'dias_atestado':    '/pessoal/dashboard/detalhe/?tipo=freq_atestados&filial_id={filial_id}&competencia={competencia}',
            'consolidados':     '/pessoal/dashboard/detalhe/?tipo=freq_consolidados&filial_id={filial_id}&competencia={competencia}',
            'total_contratos':  None,
        },
        'metric_min_width': 110,
        'sub_jobs': {
            'fechar_freq': {
                'label':      _('Fechar frequência'),
                'job_tipo':   ProcessamentoJob.Tipo.FECHAR_FREQ,
                'permission': 'pessoal.consolidar_frequencia',
                'icon':       'bi bi-lock-fill text-info-matte',
            },
        },
    },
    'processar_folha': {
        'label':            _('Processar folha'),
        'job_tipo':         ProcessamentoJob.Tipo.FOLHA,
        'resumo_fn':        '_resumo_folha',
        'icon':             'bi bi-percent text-warning-matte',
        'permission':       'pessoal.rodar_folha',
        'metric_fields': [
            {'campo': 'total_bruto',     'label': _('Proventos (R$)'),   'format': 'currency', 'css': 'accent',  'hide_if_zero': False, 'url_key': 'total_bruto'},
            {'campo': 'total_descontos', 'label': _('Descontos (R$)'),   'format': 'currency', 'css': 'danger',  'hide_if_zero': False, 'url_key': 'total_descontos'},
            {'campo': 'total_liq',       'label': _('Líquido (R$)'),     'format': 'currency', 'css': '',        'hide_if_zero': False, 'url_key': 'total_liq'},
            {'campo': 'qtd_total',       'label': _('Funcionários'),     'format': 'int',      'css': '',        'hide_if_zero': False, 'url_key': 'qtd_total'},
            {'campo': 'qtd_erros',       'label': _('Com erros'),        'format': 'check',    'css': 'danger',  'hide_if_zero': False, 'url_key': 'qtd_erros'},
        ],
        'card_links': {
            'total_bruto':     '/pessoal/dashboard/detalhe/?tipo=folha_lista&filial_id={filial_id}&competencia={competencia}',
            'total_descontos': '/pessoal/dashboard/detalhe/?tipo=folha_lista&filial_id={filial_id}&competencia={competencia}',
            'total_liq':       '/pessoal/dashboard/detalhe/?tipo=folha_lista&filial_id={filial_id}&competencia={competencia}',
            'qtd_total':       '/pessoal/dashboard/detalhe/?tipo=folha_lista&filial_id={filial_id}&competencia={competencia}',
            'qtd_erros':       '/pessoal/dashboard/detalhe/?tipo=folha_erros&filial_id={filial_id}&competencia={competencia}',
        },
        'metric_min_width': 150,
        'sub_jobs': {
            'fechar_folha': {
                'label':      _('Fechar folha'),
                'job_tipo':   ProcessamentoJob.Tipo.FECHAR_FOLHA,
                'permission': 'pessoal.rodar_folha',
                'icon':       'bi bi-lock-fill text-warning-matte',
            },
            'pagar_folha': {
                'label':      _('Pagar folha'),
                'job_tipo':   ProcessamentoJob.Tipo.PAGAR_FOLHA,
                'permission': 'pessoal.rodar_folha',
                'icon':       'bi bi-cash-coin text-success-matte',
            },
        },
    },
}

# ─── Helpers de estrutura ────────────────────────────────────────────────────

def _todos_job_tipos(acoes: dict) -> list:
    """Achata _ACOES coletando todos os job_tipo (principais + sub_jobs)."""
    tipos = []
    for cfg in acoes.values():
        tipos.append(cfg['job_tipo'])
        for sub in cfg.get('sub_jobs', {}).values():
            tipos.append(sub['job_tipo'])
    return tipos


def _acoes_permitidas(acoes: dict, user) -> dict:
    """Filtra _ACOES retornando apenas ações que o usuário tem permissão."""
    return {
        chave: cfg
        for chave, cfg in acoes.items()
        if not cfg.get('permission') or user.has_perm(cfg['permission'])
    }


# ─── View principal ──────────────────────────────────────────────────────────

class FolhaDashboardView(LoginRequiredMixin, BaseTemplateView):
    template_name = 'pessoal/folha_dashboard.html'
    permission_required = 'pessoal.folha_dashboard'

    # ── GET ──────────────────────────────────────────────────────────────────

    def get_context_data(self, **kwargs):
        context  = super().get_context_data(**kwargs)
        acoes    = _acoes_permitidas(_ACOES, self.request.user)
        filial_id, competencia = self._parse_params()

        context['filtro'] = {
            'filial_id':   filial_id,
            'competencia': competencia.strftime('%Y-%m') if competencia else datetime.today().strftime('%Y-%m'),
            'acoes':       {k: v['label'] for k, v in acoes.items()},
        }
        context['consultado'] = False
        if filial_id and competencia:
            context.update(self._montar_dashboard(acoes, filial_id, competencia))
        return context

    def _montar_dashboard(self, acoes: dict, filial_id: int, competencia: date) -> dict:
        _, fim_comp = self._parse_periodo(competencia)
        comp_str    = competencia.strftime('%Y-%m')

        jobs_map = {
            j.tipo: j
            for j in ProcessamentoJob.objects.filter(
                filial_id=filial_id,
                competencia=competencia,
                tipo__in=_todos_job_tipos(acoes),
            )
        }

        cards_jobs = []
        for acao, cfg in acoes.items():
            resumo = (
                getattr(self, cfg['resumo_fn'])(filial_id, competencia, fim_comp)
                if cfg['resumo_fn'] else None
            )

            # Interpola placeholders nas URLs de card_links
            links = {
                campo: url.format(filial_id=filial_id, competencia=comp_str) if url else None
                for campo, url in cfg.get('card_links', {}).items()
            }

            # Monta metric_boxes prontos para o template (sem lógica no template)
            metric_boxes = []
            if resumo:
                for mf in cfg.get('metric_fields', []):
                    campo = mf['campo']
                    valor = resumo.get(campo)
                    if valor is None:
                        continue
                    metric_boxes.append({
                        **mf,
                        'valor': valor,
                        'url':   links.get(mf.get('url_key')),
                    })

            # Sub-jobs: filtra por permissão e enriquece com job
            sub_jobs = [
                {
                    'acao':  sub_acao,
                    'label': sub_cfg['label'],
                    'icon':  sub_cfg.get('icon', ''),
                    'job':   jobs_map.get(sub_cfg['job_tipo']),
                    'permitido': (
                        not sub_cfg.get('permission')
                        or self.request.user.has_perm(sub_cfg['permission'])
                    ),
                }
                for sub_acao, sub_cfg in cfg.get('sub_jobs', {}).items()
            ]

            cards_jobs.append({
                'acao':             acao,
                'label':            cfg['label'],
                'icon':             cfg['icon'],
                'job':              jobs_map.get(cfg['job_tipo']),
                'resumo':           resumo,
                'metric_boxes':     metric_boxes,
                'metric_min_width': cfg.get('metric_min_width') or 110,
                'card_links':       links,
                'sub_jobs':         sub_jobs,
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

        totais    = {'H_horas_extras': 0.0, 'dias_falta_just': 0, 'dias_falta_njust': 0, 'dias_atestado': 0}
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

        # Valida ação contra o dict completo (principais + sub_jobs)
        todas = {**_ACOES, **{k: v for cfg in _ACOES.values() for k, v in cfg.get('sub_jobs', {}).items()}}
        cfg   = todas.get(acao)

        if not cfg:
            messages.error(request, 'Ação inválida.')
            return redirect(request.path)
        if not filial_id or not competencia:
            messages.error(request, 'Filial e competência obrigatórios.')
            return redirect(request.path)
        if cfg.get('permission') and not request.user.has_perm(cfg['permission']):
            messages.error(request, 'Sem permissão para executar esta ação.')
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

_DETALHES: dict[str, dict] = {
    'freq_erros': {
        'titulo':             _('Pendências de Frequência'),
        'fonte':              'freq_erros',
        'colunas':            ['matricula', 'nome', 'data', 'motivo'],
    },
    'freq_he': {
        'titulo':             _('Horas Extras'),
        'fonte':              'freq_consolidado',
        'filtro_consolidado': lambda c: (c.get('H_horas_extras') or 0) > 0,
        'colunas':            ['matricula', 'nome', 'H_horas_extras'],
    },
    'freq_falta_just': {
        'titulo':             _('Faltas Justificadas'),
        'fonte':              'freq_consolidado',
        'filtro_consolidado': lambda c: (c.get('H_dias_falta_just') or 0) > 0,
        'colunas':            ['matricula', 'nome', 'H_dias_falta_just', 'H_faltas_justificadas'],
    },
    'freq_falta_njust': {
        'titulo':             _('Faltas Injustificadas'),
        'fonte':              'freq_consolidado',
        'filtro_consolidado': lambda c: (c.get('H_dias_falta_njust') or 0) > 0,
        'colunas':            ['matricula', 'nome', 'H_dias_falta_njust', 'H_faltas_injustificadas'],
    },
    'freq_atestados': {
        'titulo':             _('Atestados / Afastamentos'),
        'fonte':              'freq_consolidado',
        'filtro_consolidado': lambda c: (c.get('H_dias_afastamento') or 0) > 0,
        'colunas':            ['matricula', 'nome', 'H_dias_afastamento', 'H_atestados'],
    },
    'freq_consolidados': {
        'titulo':             _('Frequências Consolidadas'),
        'fonte':              'freq_consolidado',
        'filtro_consolidado': None,
        'colunas':            ['matricula', 'nome', 'H_dias_trabalhados', 'H_horas_trabalhadas',
                               'H_horas_extras', 'H_dias_falta_just', 'H_dias_falta_njust', 'status'],
    },
    'folha_lista': {
        'titulo':             _('Folha de Pagamento'),
        'fonte':              'folha',
        'filtro_qs':          {},
        'colunas':            ['matricula', 'nome', 'proventos', 'descontos', 'liquido', 'status'],
    },
    'folha_erros': {
        'titulo':             _('Folha com Erros de Cálculo'),
        'fonte':              'folha',
        'filtro_qs':          {'total_erros__gt': 0},
        'colunas':            ['matricula', 'nome', 'total_erros', 'erros_json'],
    },
}

_COLUNA_LABEL: dict[str, str] = {
    'matricula':               'Matrícula',
    'nome':                    'Nome',
    'data':                    'Data',
    'motivo':                  'Motivo',
    'status':                  'Status',
    'H_horas_trabalhadas':     'Horas Trab.',
    'H_horas_extras':          'Horas Extras',
    'H_faltas_justificadas':   'Horas Falta J.',
    'H_faltas_injustificadas': 'Horas Falta I.',
    'H_dias_trabalhados':      'Dias Trab.',
    'H_dias_falta_just':       'Dias Falta J.',
    'H_dias_falta_njust':      'Dias Falta I.',
    'H_dias_afastamento':      'Dias Afas.',
    'H_atestados':             'Horas Atestado',
    'proventos':               'Proventos (R$)',
    'descontos':               'Descontos (R$)',
    'liquido':                 'Líquido (R$)',
    'total_erros':             'Qtd. Erros',
    'erros_json':              'Detalhes dos Erros',
}


class DashboardDetalheView(LoginRequiredMixin, BaseTemplateView):
    """
    View única para todos os cards clicáveis do dashboard.
    GET /pessoal/dashboard/detalhe/?tipo=TIPO&filial_id=X&competencia=YYYY-MM
    """
    template_name = 'pessoal/dashboard_detalhe.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        tipo    = self.request.GET.get('tipo', '').strip()
        cfg     = _DETALHES.get(tipo)

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
        qs = (
            FrequenciaConsolidada.objects
            .filter(contrato__funcionario__filial_id=filial_id, competencia=competencia)
            .select_related('contrato__funcionario')
            .order_by('contrato__funcionario__matricula')
        )
        return [
            {'matricula': fc.contrato.funcionario.matricula, 'nome': fc.contrato.funcionario.nome,
             'data': data_str, 'motivo': motivo}
            for fc in qs
            for data_str, motivo in sorted((fc.erros or {}).items())
        ]

    def _coletar_freq_consolidado(self, cfg: dict, filial_id: int, competencia: date) -> list[dict]:
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
            f   = fc.contrato.funcionario
            row = {'matricula': f.matricula, 'nome': f.nome, 'status': fc.get_status_display()}
            for col in cfg['colunas']:
                if col not in ('matricula', 'nome', 'status'):
                    row[col] = c.get(col, 0)
            linhas.append(row)
        return linhas

    def _coletar_folha(self, cfg: dict, filial_id: int, competencia: date) -> list[dict]:
        filtro_qs = cfg.get('filtro_qs') or {}
        qs = (
            FolhaPagamento.objects
            .filter(contrato__funcionario__filial_id=filial_id, competencia=competencia, **filtro_qs)
            .select_related('contrato__funcionario')
            .order_by('contrato__funcionario__matricula')
        )
        return [
            {
                'matricula':   fp.contrato.funcionario.matricula,
                'nome':        fp.contrato.funcionario.nome,
                'proventos':   fp.proventos,
                'descontos':   fp.descontos,
                'liquido':     fp.liquido,
                'status':      fp.get_status_display(),
                'total_erros': fp.total_erros,
                'erros_json':  fp.erros or {},
            }
            for fp in qs
        ]

    def _parse_params(self) -> tuple[int, date]:
        p = self.request.GET
        filial_id   = int(p.get('filial_id', 0)) or None
        competencia = datetime.strptime(p.get('competencia', ''), '%Y-%m').date().replace(day=1)
        return filial_id, competencia