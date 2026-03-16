from django.contrib.auth.mixins import LoginRequiredMixin, PermissionRequiredMixin
from core.views_base import (BaseListView, BaseCreateView, BaseUpdateView, BaseDeleteView)
from core.models import Filial
from pessoal.models import FeriasAquisitivo
from pessoal.tables import FeriasAquisitivoTable
from pessoal.filters import FeriasAquisitivoFilter

class FeriasListView(LoginRequiredMixin, PermissionRequiredMixin, BaseListView):
    model = FeriasAquisitivo
    template_name = 'pessoal/ferias.html'
    permission_required = 'pessoal.view_feriasaquisitivo'
    filterset_class = FeriasAquisitivoFilter
    def get_queryset(self):
        filial_id = self.request.GET.get('filial')  # filtro filial eh obrigatorio
        if not filial_id:
            return FeriasAquisitivo.objects.none()
        return (
            FeriasAquisitivo.objects
            .filter(funcionario__filial_id=filial_id)
            .select_related('funcionario')
            .prefetch_related('gozos')
            .order_by('funcionario__matricula', '-inicio')
        )
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        f = self.filterset_class(self.request.GET, queryset=self.get_queryset(), user=self.request.user)
        context['table'] = FeriasAquisitivoTable(f.qs).config(self.request, filter_obj=f)
        context['filter'] = f
        return context