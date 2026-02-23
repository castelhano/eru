"""
views.py (dashboard) — View única do painel de frequência/folha.
GET  → carrega contexto do dashboard (resumos, status dos jobs, etc.)
POST → despacha ações: consolidar frequência ou processar folha
"""
import calendar
from datetime import datetime, date
from django.contrib.auth.mixins import LoginRequiredMixin
from django.http import JsonResponse
from django.utils.translation import gettext_lazy as _
from core.views import BaseTemplateView
from pessoal.models import ProcessamentoJob
from pessoal.tasks import disparar_consolidacao, disparar_folha

# FolhaDashboardView: Ações aceitas via POST 
_ACOES = {
    'consolidar_freq': _('Consolidar frequência'),
    'processar_folha': _('Processar folha'),
}

from django.db.models import Sum, Count, Q as Qm
from pessoal.models import FrequenciaConsolidada, FolhaPagamento
import csv
from django.http import HttpResponse
from pessoal.models import FrequenciaConsolidada
from pessoal.models import FrequenciaConsolidada
class FolhaDashboardView(LoginRequiredMixin, BaseTemplateView):
    template_name = 'pessoal/folha_dashboard.html'
    # ── GET ──────────────────────────────────────────────────────────────────
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        filial_id, competencia = self._parse_params()
        context['filtro'] = {
            'filial_id':   filial_id,
            'competencia': competencia.strftime('%Y-%m') if competencia else datetime.today().strftime('%Y-%m'),
            'acoes': _ACOES,
            'consultado': False
        }
        if filial_id and competencia:
            context.update(self._montar_dashboard(filial_id, competencia))
        return context
    def _montar_dashboard(self, filial_id: int, competencia: date) -> dict:
        jobs = ProcessamentoJob.objects.filter(filial_id=filial_id, competencia=competencia)

        # FrequenciaConsolidada agregada da filial — soma os consolidados existentes
        consolidados = FrequenciaConsolidada.objects.filter(
            contrato__funcionario__filial_id=filial_id,
            competencia=competencia,
        )
        # agrega os erros de todos os consolidados num único dict {data: motivo}
        erros_freq = {}
        resumo_freq = None
        if consolidados.exists():
            totais = {'H_horas_extras': 0.0,
                    'H_faltas_justificadas': 0.0, 'H_faltas_injustificadas': 0.0,
                    'H_atestados': 0.0, 'H_dias_trabalhados': 0}
            for c in consolidados:
                for k in totais:
                    totais[k] += c.consolidado.get(k, 0)
                erros_freq.update(c.erros or {})
            totais['qtd_funcionarios'] = consolidados.count()
            resumo_freq = totais

        # resumo de folha
        resumo_folha = FolhaPagamento.objects.filter(
            contrato__funcionario__filial_id=filial_id,
            competencia=competencia,
        ).aggregate(
            total_bruto=Sum('proventos'),
            total_descontos=Sum('descontos'),
            total_liq=Sum('liquido'),
            qtd_total=Count('id'),
            qtd_erros=Count('id', filter=Qm(total_erros__gt=0)),
        ) if FolhaPagamento.objects.filter(
            contrato__funcionario__filial_id=filial_id, competencia=competencia
        ).exists() else None

        return {
            'job_freq':    jobs.filter(tipo=ProcessamentoJob.Tipo.CONSOLIDACAO_FREQ).first(),
            'job_folha':   jobs.filter(tipo=ProcessamentoJob.Tipo.FOLHA).first(),
            'resumo_freq': resumo_freq,
            'resumo_folha': resumo_folha,
            'erros_freq':  erros_freq,
            'qtd_erros_freq': sum(len(fc.erros or {}) for fc in consolidados),
            'consultado': True
        }
    def get(self, request, *args, **kwargs):
        # polling do JS
        job_id = request.GET.get('job_status')
        if job_id:
            try:
                job = ProcessamentoJob.objects.get(pk=job_id)
                return JsonResponse({'status': job.status})
            except ProcessamentoJob.DoesNotExist:
                return JsonResponse({'status': 'ER'})

        # erros de frequência para o modal (AJAX)
        if request.GET.get('erros_json'):
            return self._export_erros_json(request)

        # download CSV
        if request.GET.get('export') == 'erros_freq':
            return self._export_erros_csv(request)

        return super().get(request, *args, **kwargs)
    def _export_erros_json(self, request):
        """Retorna erros de consolidação formatados para o modal."""
        filial_id, competencia = self._parse_params()
        rows = []
        for fc in FrequenciaConsolidada.objects.filter(
            contrato__funcionario__filial_id=filial_id,
            competencia=competencia,
        ).select_related('contrato__funcionario'):
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
        response.set_cookie('fileDownload', 'true', max_age=60) # necessario para fechar modal loading (se usado no cliente)
        writer = csv.writer(response, delimiter=';')
        writer.writerow(['Matrícula', 'Funcionário', 'Data', 'Motivo'])
        for fc in FrequenciaConsolidada.objects.filter(
            contrato__funcionario__filial_id=filial_id,
            competencia=competencia,
        ).select_related('contrato__funcionario'):
            func = fc.contrato.funcionario
            for data, motivo in sorted((fc.erros or {}).items()):
                writer.writerow([func.matricula, func.nome, data, motivo])
        return response




    # ── POST ─────────────────────────────────────────────────────────────────

    def post(self, request, *args, **kwargs):
        acao = request.POST.get('acao', '').strip()
        if acao not in _ACOES:
            return JsonResponse({'status': 'error', 'message': 'Ação inválida'}, status=400)
        try:
            filial_id, competencia = self._parse_params()
            if not filial_id or not competencia:
                return JsonResponse({'status': 'error', 'message': 'Filial e competência obrigatórios'}, status=400)
            handler = getattr(self, f'_acao_{acao}')
            job = handler(filial_id, competencia)
            return JsonResponse({'status': 'queued', 'job_id': job.id})
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=400)

    def _acao_consolidar_freq(self, filial_id: int, competencia: date) -> ProcessamentoJob:
        """Valida parâmetros e dispara consolidação de frequência."""
        inicio, fim = self._parse_periodo(competencia)
        inicio_str = self.request.POST.get('inicio', '').strip()
        fim_str    = self.request.POST.get('fim',    '').strip()
        if inicio_str:            
            inicio = date.fromisoformat(inicio_str)
        if fim_str:
            fim = date.fromisoformat(fim_str)
        matricula_de  = self.request.POST.get('matricula_de',  '').strip() or None
        matricula_ate = self.request.POST.get('matricula_ate', '').strip() or None
        incluir_intervalo = self.request.POST.get('incluir_intervalo') == '1'
        return disparar_consolidacao(
            filial_id=filial_id,
            competencia=competencia,
            inicio=inicio,
            fim=fim,
            incluir_intervalo=incluir_intervalo,
            matricula_de=matricula_de,
            matricula_ate=matricula_ate,
            usuario=self.request.user,
        )

    def _acao_processar_folha(self, filial_id: int, competencia: date) -> ProcessamentoJob:
        """Dispara processamento de folha de pagamento."""
        return disparar_folha(
            filial_id=filial_id,
            competencia=competencia,
            usuario=self.request.user,
        )

    # ── Helpers ──────────────────────────────────────────────────────────────

    def _parse_params(self) -> tuple[int | None, date | None]:
        """Lê filial_id e competência de GET ou POST."""
        params = self.request.GET if self.request.method == 'GET' else self.request.POST
        try:
            filial_id   = int(params.get('filial_id', 0)) or None
            competencia = datetime.strptime(params.get('competencia', ''), '%Y-%m').date().replace(day=1)
            return filial_id, competencia
        except (ValueError, AttributeError):
            return None, None

    def _parse_periodo(self, competencia: date) -> tuple[date, date]:
        """Retorna (primeiro dia, último dia) da competência."""
        ultimo = calendar.monthrange(competencia.year, competencia.month)[1]
        return competencia, competencia.replace(day=ultimo)