from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('',include('core.urls')),
    path('trafego/',include('trafego.urls')),
    path('pessoal/',include('pessoal.urls_web')),
    path('api/', include('pessoal.urls_api')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)