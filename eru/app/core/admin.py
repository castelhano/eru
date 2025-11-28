from django.contrib import admin
from django.contrib.admin.models import LogEntry
from .models import Empresa

@admin.register(LogEntry)
class LogEntryAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'user', 'action_time', 'content_type', 'object_repr', 'action_flag')
    list_filter = ('action_time', 'user', 'content_type', 'action_flag')
    search_fields = ('object_repr', 'change_message')
    date_hierarchy = 'action_time'
    
    # Adiciona filtros na barra lateral
    def get_queryset(self, request):
        return super().get_queryset(request)

admin.site.register(Empresa)