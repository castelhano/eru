from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

admin.site.site_header = "System Admin"     # Header principal admin
admin.site.index_title = "ERU"              # Título da página inicial do admin
admin.site.site_title = "Admin"             # Título da aba do navegador

urlpatterns = [
    path('admin/', admin.site.urls),
    path('',include('core.urls')),
    path('pessoal/',include('pessoal.urls_web')),
    path('api/', include('pessoal.urls_api')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)