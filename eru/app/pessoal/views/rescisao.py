"""
views/rescisao.py — View de rescisão com suporte a Simular + PDF WeasyPrint.

Fluxo POST:
  acao=salvar  → valida form → salva Rescisao → dispara qcluster → redirect
  acao=simular → valida form → simular_sem_persistir() → PDF inline no browser

Nenhum objeto é criado no banco durante simulação.
"""
from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin, PermissionRequiredMixin
from django.db import transaction
from django.http import HttpResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.template.loader import render_to_string
from django.views import View

from core.models import Job
from pessoal.models import Funcionario
from pessoal.forms import RescisaoForm
from pessoal.tasks import Tipos, disparar_desligamento
from pessoal.services.rescisao import simular_sem_persistir


class RescisaoProcessView(LoginRequiredMixin, PermissionRequiredMixin, View):
    permission_required = 'pessoal.funcionario_desligar'
    template_name       = 'pessoal/rescisao.html'
    template_pdf        = 'pessoal/reports/rescisao_m1.html'

    def get_object(self, pk):
        return get_object_or_404(
            Funcionario.objects.select_related('filial__empresa'),
            pk=pk,
        )

    # ── GET ───────────────────────────────────────────────────────────────────

    def get(self, request, pk):
        funcionario = self.get_object(pk)

        if not funcionario.F_eh_editavel:
            messages.error(request, 'Funcionário bloqueado para edição.')
            return redirect('pessoal:funcionario_update', pk=pk)

        if funcionario.status == Funcionario.Status.AFASTADO:
            messages.warning(request, 'Retorne o funcionário do afastamento antes de rescindir.')
            return redirect('pessoal:funcionario_detail', pk=pk)

        contrato = funcionario.F_contrato
        if not contrato:
            messages.error(request, 'Funcionário não possui contrato vigente para rescindir.')
            return redirect('pessoal:funcionario_detail', pk=pk)

        form = RescisaoForm(funcionario=funcionario, contrato=contrato)
        return render(request, self.template_name, {
            'form': form, 'funcionario': funcionario, 'contrato': contrato,
        })

    # ── POST ──────────────────────────────────────────────────────────────────

    def post(self, request, pk):
        funcionario = self.get_object(pk)
        contrato    = funcionario.F_contrato
        acao        = request.POST.get('acao', 'salvar')

        form = RescisaoForm(request.POST, funcionario=funcionario, contrato=contrato)
        if not form.is_valid():
            return render(request, self.template_name, {
                'form': form, 'funcionario': funcionario, 'contrato': contrato,
            })

        if acao == 'simular':
            return self._handle_simular(request, funcionario, form)

        return self._handle_salvar(request, funcionario, contrato, form)

    # ── handlers privados ─────────────────────────────────────────────────────

    def _handle_simular(self, request, funcionario, form):
        """
        Calcula rescisão sem persistir nada e retorna PDF inline.
        Nenhum objeto criado ou alterado no banco.
        """
        try:
            resultado = simular_sem_persistir(funcionario.pk, form.cleaned_data)
            return _render_pdf(
                request=request,
                template=self.template_pdf,
                context={
                    'funcionario': funcionario,
                    'resultado':   resultado,
                    'simulacao':   True,
                },
                filename=f'simulacao_rescisao_{funcionario.matricula}.pdf',
                inline=True,   # abre no browser em vez de fazer download
            )
        except Exception as e:
            form.add_error(None, f'Erro na simulação: {e}')
            contrato = funcionario.F_contrato
            return render(request, self.template_name, {
                'form': form, 'funcionario': funcionario, 'contrato': contrato,
            })

    def _handle_salvar(self, request, funcionario, contrato, form):
        """
        Fluxo real: salva Rescisao e dispara processamento assíncrono.
        """
        # object_id dentro de params identifica o funcionário — sem campo dedicado no model
        job_em_execucao = (
            Job.objects
            .filter(
                app='pessoal',
                tipo=Tipos.DESLIGAR_FUNCIONARIO,
                params__object_id=funcionario.pk,
                status__in=[
                    Job.Status.AGUARDANDO,
                    Job.Status.PROCESSANDO,
                ],
            )
            .exists()
        )
        if job_em_execucao:
            messages.warning(request, 'Processamento de desligamento já está em andamento.')
            return redirect('pessoal:funcionario_update', pk=funcionario.pk)
        try:
            with transaction.atomic():
                form.save()
            # fora da transaction — evita race condition com qcluster
            disparar_desligamento(funcionario.pk, request.user)
            messages.warning(request, 'Rescisão iniciada — processamento em segundo plano.')
            return redirect('pessoal:funcionario_update', pk=funcionario.pk)
        except Exception as e:
            form.add_error(None, f'Erro crítico ao salvar: {e}')

        return render(request, self.template_name, {
            'form': form, 'funcionario': funcionario, 'contrato': contrato,
        })


# ── utilitário PDF ────────────────────────────────────────────────────────────

def _render_pdf(request, template: str, context: dict,
                filename: str, inline: bool = True) -> HttpResponse:
    """
    Renderiza um template Django como PDF usando WeasyPrint.
    inline=True  → abre no browser (Content-Disposition: inline)
    inline=False → força download (Content-Disposition: attachment)

    Fallback: se WeasyPrint não estiver instalado (dev), retorna HTML.
    """
    try:
        from weasyprint import HTML
        from weasyprint.text.fonts import FontConfiguration
    except ImportError:
        html = render_to_string(template, context, request=request)
        return HttpResponse(html, content_type='text/html')

    html_string = render_to_string(template, context, request=request)
    font_config = FontConfiguration()
    pdf_file    = HTML(
        string=html_string,
        base_url=request.build_absolute_uri('/'),
    ).write_pdf(font_config=font_config)

    disposition = 'inline' if inline else 'attachment'
    response = HttpResponse(pdf_file, content_type='application/pdf')
    response['Content-Disposition'] = f'{disposition}; filename="{filename}"'
    return response
