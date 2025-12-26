from django.urls import path
from utils.routing import generate_urls
from . import views

app_name = 'pessoal'

urlpatterns = [
    *generate_urls('Funcionario', views),
    *generate_urls('Dependente', views),
    *generate_urls('Setor', views, plural_name='setores'),
    *generate_urls('Cargo', views),
    *generate_urls('Evento', views, plural_name='funcoes_fixa'),
    *generate_urls('FuncaoFixa', views),
    path('eventos_related/<str:related>/<int:id>/', views.EventoRelatedListView.as_view(),name='eventorelated_list'),
    path('evento_related/<str:related>/<int:id>/new', views.EventoRelatedCreateView.as_view(),name='eventorelated_create'),
    path('evento_related/<str:related>/<int:id>/update', views.EventoRelatedUpdateView.as_view(),name='eventorelated_update'),
    path('evento_related/<str:related>/<int:id>/delete', views.EventoRelatedDeleteView.as_view(),name='eventorelated_delete'),
    *generate_urls('GrupoEvento', views, plural_name='grupos_evento'),
    *generate_urls('MotivoReajuste', views, plural_name='motivos_reajuste'),
    path('api/formula_validate',views.FormulaValidateView.as_view(),name='formula_validate'),
]