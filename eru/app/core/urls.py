from django.urls import path
from django.contrib.auth import views as auth_views
from utils.routing import generate_urls
from . import views

urlpatterns = [
    path('',views.IndexView.as_view(),name='index'),
    path('index',views.IndexView.as_view(),name='index'),
    path('login',views.CustomLoginView.as_view(template_name='core/login.html'), name='login'),
    path('logout', auth_views.LogoutView.as_view(), name='logout'),
    path('change_password',views.CustomPasswordChangeView.as_view(),name='change_password'),
    path('handler/<int:code>',views.HandlerView.as_view(),name='handler'),
    path('logs',views.LogAuditListView.as_view(),name='logs'),
    path('i18n',views.I18nView.as_view(),name='i18n'),
    *generate_urls('Usuario', views),
    *generate_urls('Grupo', views),
    *generate_urls('Empresa', views),
    path('usuarios_grupo/<int:pk>',views.UsuariosPorGrupoListView.as_view(),name='usuarios_grupo'),
    path('settings',views.SettingsUpdateView.as_view(),name='settings'),
]