from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin, PermissionRequiredMixin
from django.db import transaction
from django.shortcuts import get_object_or_404, redirect, render
from django.views import View

from pessoal.models import Funcionario, ProcessamentoJob
from pessoal.forms import RescisaoForm
from pessoal.tasks import disparar_desligamento
from pessoal.services.rescisao import simular_desligamento


class RescisaoProcessView(LoginRequiredMixin, PermissionRequiredMixin, View):
    permission_required = 'pessoal.funcionario_desligar'
    template_name       = 'pessoal/rescisao.html'

    def get_object(self, pk):
        return get_object_or_404(
            Funcionario.objects.select_related('filial__empresa'),
            pk=pk
        )

    def get(self, request, pk):
        funcionario = self.get_object(pk)

        # simulação: calcula sem persistir e renderiza relatório
        if request.GET.get('simular') and hasattr(funcionario, 'rescisao'):
            resultado = simular_desligamento(funcionario.pk, funcionario.rescisao.pk)
            return render(request, 'pessoal/rescisao_simulacao.html', {
                'funcionario': funcionario,
                'resultado':   resultado,
            })

        if not funcionario.F_eh_editavel:
            messages.error(request, 'Funcionário bloqueado para edição.')
            return redirect('pessoal:funcionario_update', pk=pk)

        if funcionario.status == Funcionario.Status.AFASTADO:
            messages.warning(request, 'Retorne o funcionário do afastamento antes de rescindir.')
            return redirect('pessoal:funcionario_update', pk=pk)

        contrato = funcionario.F_contrato
        if not contrato:
            messages.error(request, 'Funcionário não possui contrato vigente para rescindir.')
            return redirect('pessoal:funcionario_update', pk=pk)

        form = RescisaoForm(funcionario=funcionario, contrato=contrato)
        return render(request, self.template_name, {
            'form': form, 'funcionario': funcionario, 'contrato': contrato,
        })

    def post(self, request, pk):
        funcionario = self.get_object(pk)
        contrato    = funcionario.F_contrato

        form = RescisaoForm(request.POST, funcionario=funcionario, contrato=contrato)
        if not form.is_valid():
            return render(request, self.template_name, {
                'form': form, 'funcionario': funcionario, 'contrato': contrato,
            })

        # Impede re-disparo se já existe job em andamento
        job_em_execucao = (
            ProcessamentoJob.objects
            .filter(
                tipo=ProcessamentoJob.Tipo.DESLIGAR_FUNCIONARIO,
                object_id=funcionario.pk,
                status__in=[ProcessamentoJob.Status.AGUARDANDO, ProcessamentoJob.Status.PROCESSANDO],
            )
            .exists()
        )
        if job_em_execucao:
            messages.warning(request, 'Processamento de desligamento já está em andamento.')
            return redirect('pessoal:funcionario_update', pk=pk)

        try:
            with transaction.atomic():
                # Salva Rescisao → sync_status → PROCESSANDO_DESLIGAMENTO
                form.save()
            # Enfileira job assíncrono fora da transaction (evita race condition com qcluster)
            disparar_desligamento(funcionario.pk, request.user)
            messages.warning(request, 'Rescisão iniciada — processamento em segundo plano.')
            return redirect('pessoal:funcionario_update', pk=pk)
        except Exception as e:
            form.add_error(None, f'Erro crítico ao salvar: {e}')

        return render(request, self.template_name, {
            'form': form, 'funcionario': funcionario, 'contrato': contrato,
        })