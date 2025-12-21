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
    error_url = None    # caso em alguma view queira alterar destino no erro, especificar error_url
    def delete(self, request, *args, **kwargs):
        self.object = self.get_object()
        fallback_error_url = self.error_url or request.META.get('HTTP_REFERER')
        # 1) definie url de retorno para pagina de origem
        if not fallback_error_url and hasattr(self.object, 'get_absolute_url'):
            fallback_error_url = self.object.get_absolute_url()
        # 2) caso nao consiga redireciona para mesma pagina definida para success_url 
        if not fallback_error_url:
            fallback_error_url = self.get_success_url()
        try:
            response = super().delete(request, *args, **kwargs)
            return response
        except (ProtectedError, IntegrityError):
            messages.error( self.request, settings.DEFAULT_MESSAGES.get('deleteError'))
            return redirect(fallback_error_url)
        except Exception as e:
            messages.error(self.request, settings.DEFAULT_MESSAGES.get('500'))
            return redirect(fallback_error_url)