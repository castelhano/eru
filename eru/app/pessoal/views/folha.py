"""
views.py (dashboard) — View única do painel de frequência/folha.
GET  → carrega contexto do dashboard (resumos, status dos jobs, etc.)
POST → despacha ações declaradas em _ACOES

_ACOES é o registro central de tudo que o dashboard conhece sobre cada processo:
    label        → texto exibido no botão e no card
    job_tipo     → ProcessamentoJob.Tipo correspondente
    resumo_fn    → método da view que retorna dict de resumo (ou None)
    situacao_fn  → método da view que retorna dict de situação (ou None)
    icon         → ícone Bootstrap para o card de última execução
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
    Contrato, FolhaPagamento, FrequenciaConsolidada, ProcessamentoJob
)
from pessoal.tasks import disparar_consolidacao, disparar_folha, disparar_carga_escala


# ─── Registro central de ações ───────────────────────────────────────────────
# Cada entrada define tudo que a view e o template precisam saber sobre uma ação.
# Para adicionar uma nova ação: inclua aqui e implemente _acao_<chave> + _resumo_<chave>
# (se aplicável). O template e o loop de _montar_dashboard se adaptam automaticamente.

_ACOES = {
    'carregar_escala': {
        'label':       _('Carregar escala'),
        'job_tipo':    ProcessamentoJob.Tipo.CARGA_ESCALA,
        'resumo_fn':   None,
        'situacao_fn': None,
        'icon':        'bi bi-calendar-date-fill text-primary-matte',
    },
    'consolidar_freq': {
        'label':       _('Consolidar frequência'),
        'job_tipo':    ProcessamentoJob.Tipo.CONSOLIDACAO_FREQ,
        'resumo_fn':   '_resumo_freq',
        'situacao_fn': '_situacao_freq',
        'icon':        'bi bi-calendar-check-fill text-info-matte',
    },
    'processar_folha': {
        'label':       _('Processar folha'),
        'job_tipo':    ProcessamentoJob.Tipo.FOLHA,
        'resumo_fn':   '_resumo_folha',
        'situacao_fn': None,
        'icon':        'bi bi-percent text-warning-matte',
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
            'acoes':       {k: v['label'] for k, v in _ACOES.items()},
        }
        context['consultado'] = False
        if filial_id and competencia:
            context.update(self._montar_dashboard(filial_id, competencia))
        return context

    def _montar_dashboard(self, filial_id: int, competencia: date) -> dict:
        _, fim_comp = self._parse_periodo(competencia)

        # ── Jobs — um único hit para todos os tipos ───────────────────────────
        tipos = [cfg['job_tipo'] for cfg in _ACOES.values()]
        jobs_qs = ProcessamentoJob.objects.filter(
            filial_id=filial_id,
            competencia=competencia,
            tipo__in=tipos,
        )
        jobs_map = {j.tipo: j for j in jobs_qs}

        # ── Monta lista de cards de jobs para o template ──────────────────────
        # Cada item: {acao, label, icon, job, resumo, situacao}
        cards_jobs = []
        for acao, cfg in _ACOES.items():
            job     = jobs_map.get(cfg['job_tipo'])
            resumo  = None
            situacao = None
            # Chama resumo/situacao independente do job — refletem estado atual do banco
            if cfg['resumo_fn']:
                resumo = getattr(self, cfg['resumo_fn'])(filial_id, competencia, fim_comp)
            if cfg['situacao_fn']:
                situacao = getattr(self, cfg['situacao_fn'])(filial_id, competencia, fim_comp)
            cards_jobs.append({
                'acao':    acao,
                'label':   cfg['label'],
                'icon':    cfg['icon'],
                'job':     job,
                'resumo':  resumo,
                'situacao': situacao,
            })

        return {
            'cards_jobs': cards_jobs,
            'consultado': True,
        }

    # ── Funções de resumo/situação ────────────────────────────────────────────

    def _resumo_freq(self, filial_id, competencia, fim_comp) -> dict | None:
        """Totalizadores de frequência + situação consolidada num único dict."""
        consolidados = list(
            FrequenciaConsolidada.objects.filter(
                contrato__funcionario__filial_id=filial_id,
                competencia=competencia,
            )
        )
        if not consolidados:
            return None

        totais = {
            'H_horas_extras':   0.0,
            'dias_falta_just':  0,
            'dias_falta_njust': 0,
            'dias_atestado':    0,
        }
        qtd_erros = 0
        for fc in consolidados:
            c = fc.consolidado or {}
            totais['H_horas_extras']   += c.get('H_horas_extras', 0)
            totais['dias_falta_just']  += c.get('H_dias_falta_just', 0)
            totais['dias_falta_njust'] += c.get('H_dias_falta_njust', 0)
            totais['dias_atestado']    += c.get('H_dias_afastamento', 0)
            qtd_erros                  += len(fc.erros or {})

        # Período consolidado (min/max) — reutiliza a query já feita via Python
        # para evitar uma query extra; se a lista for grande, vale substituir por aggregate
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

        return {
            **totais,
            'consolidados':    len(consolidados),
            'total_contratos': total_contratos,
            'pendencias':      qtd_erros,
            'periodo':         periodo,
            'status':          'FECHADO' if consolidados and not qtd_erros else 'ABERTO',
        }

    def _situacao_freq(self, filial_id, competencia, fim_comp):
        # Situação já está embutida no resumo para frequência; retorna None
        # para evitar query dupla — o template usa card.resumo diretamente.
        return None

    def _resumo_folha(self, filial_id, competencia, fim_comp) -> dict | None:
        qs = FolhaPagamento.objects.filter(
            contrato__funcionario__filial_id=filial_id,
            competencia=competencia,
        )
        if not qs.exists():
            return None
        return qs.aggregate(
            total_bruto=Sum('proventos'),
            total_descontos=Sum('descontos'),
            total_liq=Sum('liquido'),
            qtd_total=Count('id'),
            qtd_erros=Count('id', filter=Qm(total_erros__gt=0)),
        )

    # ── GET handlers ─────────────────────────────────────────────────────────

    def get(self, request, *args, **kwargs):
        if request.GET.get('erros_json'):
            return self._export_erros_json(request)
        if request.GET.get('export') == 'erros_freq':
            return self._export_erros_csv(request)
        return super().get(request, *args, **kwargs)

    def _export_erros_json(self, request):
        filial_id, competencia = self._parse_params()
        rows = []
        qs = FrequenciaConsolidada.objects.filter(
            contrato__funcionario__filial_id=filial_id,
            competencia=competencia,
        ).select_related('contrato__funcionario')
        for fc in qs:
            func = fc.contrato.funcionario
            for data, motivo in (fc.erros or {}).items():
                rows.append({
                    'matricula':   func.matricula,
                    'funcionario': func.nome,
                    'data':        data,
                    'motivo':      motivo,
                })
        rows.sort(key=lambda r: (r['matricula'], r['data']))
        return JsonResponse(rows, safe=False)

    def _export_erros_csv(self, request):
        filial_id, competencia = self._parse_params()
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="erros_freq_{competencia}.csv"'
        response.write('\ufeff'.encode('utf8'))
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
        acao = request.POST.get('acao', '').strip()
        filial_id, competencia = self._parse_params()

        if acao not in _ACOES:
            messages.error(request, 'Ação inválida.')
            return redirect(request.path)
        if not filial_id or not competencia:
            messages.error(request, 'Filial e competência obrigatórios.')
            return redirect(request.path)

        try:
            getattr(self, f'_acao_{acao}')(filial_id, competencia)
            return redirect(
                f"{request.path}?filial_id={filial_id}&competencia={competencia.strftime('%Y-%m')}"
            )
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
            incluir_intervalo=self.request.POST.get('incluir_intervalo') == '1',
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