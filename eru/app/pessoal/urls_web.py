from django.urls import path
from core.routing import generate_urls, generate_urls_related
from . import views

app_name = 'pessoal'

urlpatterns = [
    *generate_urls('Funcionario', views),
    *generate_urls_related('Dependente', views),
    *generate_urls_related('Afastamento', views),
    *generate_urls('Setor', views, plural_name='setores'),
    *generate_urls('Cargo', views),
    *generate_urls('Evento', views),
    *generate_urls('MotivoReajuste', views, plural_name='motivos_reajuste'),
    *generate_urls('GrupoEvento', views, plural_name='grupos_evento'),
    *generate_urls('EventoFrequencia', views, plural_name='eventos_frequencia'),
    path('contratos/<int:pk>', views.ContratoManagementView.as_view(),name='contrato_list'),
    path('contratos/<int:pk_func>/delete/<int:pk>/', views.ContratoDeleteView.as_view(), name='contrato_delete'),
    path('eventos_related/<str:related>/<int:pk>/', views.EventoRelatedListView.as_view(),name='eventorelated_list'),
    path('evento_related/<str:related>/<int:pk>/new', views.EventoRelatedCreateView.as_view(),name='eventorelated_create'),
    path('evento_related/<str:related>/<int:pk>/update', views.EventoRelatedUpdateView.as_view(),name='eventorelated_update'),
    path('evento_related/<str:related>/<int:pk>/delete', views.EventoRelatedDeleteView.as_view(),name='eventorelated_delete'),
    path('turnos/', views.TurnoManagementView.as_view(), name='turno_list'),
    path('settings/', views.PessoalSettingsUpdateView.as_view(), name='settings_list'),
    path('settings/<int:filial_id>/', views.PessoalSettingsUpdateView.as_view(), name='settings_update'),
    path('frequencia/', views.FrequenciaManagementView.as_view(), name='frequencia_list'),
    path('api/formula_validate',views.FormulaValidateView.as_view(),name='formula_validate'),
]