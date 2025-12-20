from django.contrib import messages
from django.views.generic import UpdateView, ListView, TemplateView, DeleteView
from core.constants import DEFAULT_MESSAGES


class BaseListView(LoginRequiredMixin, ListView):
    login_url = '/handler/403'
    raise_exception = False
    

class BaseTemplateView(LoginRequiredMixin, TemplateView):
    login_url = '/handler/403'
    raise_exception = False

class BaseCreateView(LoginRequiredMixin, PermissionRequiredMixin, SuccessMessageMixin, CreateView):
    login_url = '/handler/403'
    raise_exception = False
    success_message = DEFAULT_MESSAGES.get('created')
    def form_invalid(self, form):
        messages.error(self.request, DEFAULT_MESSAGES.get('saveError'))
        return super().form_invalid(form)

class BaseUpdateView(UpdateView):
    login_url = '/handler/403'
    raise_exception = False
    success_message = DEFAULT_MESSAGES.get('updated')
    def form_invalid(self, form):
        messages.error(self.request, DEFAULT_MESSAGES.get('saveError'))
        return super().form_invalid(form)

class BaseDeleteView(LoginRequiredMixin, PermissionRequiredMixin, DeleteView):
    login_url = '/handler/403'
    raise_exception = False
    def delete(self, request, *args, **kwargs):
        response = super().delete(request, *args, **kwargs)
        messages.warning(self.request, DEFAULT_MESSAGES.get('deleted'))
        return response
