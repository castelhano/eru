from django.contrib import messages
from django.contrib.messages.views import SuccessMessageMixin
from django.views.generic import UpdateView, ListView, CreateView, TemplateView, DeleteView
from core.constants import DEFAULT_MESSAGES


class BaseListView(ListView):
    login_url = '/handler/403'
    raise_exception = False
    

class BaseTemplateView(TemplateView):
    login_url = '/handler/403'
    raise_exception = False

class BaseCreateView(SuccessMessageMixin, CreateView):
    login_url = '/handler/403'
    raise_exception = False
    success_message = DEFAULT_MESSAGES.get('created')
    def form_invalid(self, form):
        messages.error(self.request, DEFAULT_MESSAGES.get('saveError'))
        return super().form_invalid(form)

class BaseUpdateView(SuccessMessageMixin, UpdateView):
    login_url = '/handler/403'
    raise_exception = False
    success_message = DEFAULT_MESSAGES.get('updated')
    def form_invalid(self, form):
        messages.error(self.request, DEFAULT_MESSAGES.get('saveError'))
        return super().form_invalid(form)

class BaseDeleteView(SuccessMessageMixin, DeleteView):
    login_url = '/handler/403'
    raise_exception = False
    error_url = None        # caso em alguma view queira alterar pagina de destino no erro, especificar error_url
    # caso view queira uma mensagem customizada basta sobregravar success_message
    success_message = DEFAULT_MESSAGES.get('deleted', 'Registro excluido com sucesso')