from django.urls import path
from django.contrib.auth import views as auth_views
from .routing import generate_urls, generate_urls_related
from . import views

urlpatterns = [
    path('',views.IndexView.as_view(),name='index'),
    path('index',views.IndexView.as_view(),name='index'),
    path('login',views.CustomLoginView.as_view(template_name='core/login.html'), name='login'),
    path('logout', auth_views.LogoutView.as_view(), name='logout'),
    path('change_password',views.CustomPasswordChangeView.as_view(),name='change_password'),
    path('handler/<int:code>',views.HandlerView.as_view(),name='handler'),
    path('logs',views.LogAuditListView.as_view(),name='logs'),
    *generate_urls('Usuario', views),
    *generate_urls('Grupo', views),
    *generate_urls('Empresa', views),
    *generate_urls_related('Filial', views),
    path('usuarios_grupo/<int:pk>',views.UsuariosPorGrupoListView.as_view(),name='usuario_grupo'),
    path('settings',views.SettingsUpdateView.as_view(),name='settings'),
    path('api/filiais/', views.FilialDataView.as_view(), name='filial_list'),
]