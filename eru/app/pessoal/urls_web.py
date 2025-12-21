from django.urls import path
from utils.routing import generate_urls
from . import views

app_name = 'pessoal'

urlpatterns = [
    *generate_urls('Funcionario', views),
    *generate_urls('Dependente', views),
    *generate_urls('Setor', views, plural_name='setores'),
    *generate_urls('Cargo', views),
    *generate_urls('Evento', views),
    path('eventos_related/<str:related>/<int:id>/', views.eventos_related,name='eventos_related'),
    path('evento_related/<str:related>/<int:id>/new', views.evento_related_add,name='evento_related_add'),
    path('evento_related/<str:related>/<int:id>/update', views.evento_related_update,name='evento_related_update'),
    path('evento_related/<str:related>/<int:id>/delete', views.evento_related_delete,name='evento_related_delete'),
    *generate_urls('GrupoEvento', views, plural_name='grupos_evento'),
    *generate_urls('MotivoReajuste', views, plural_name='motivos_reajuste'),
    path('api/formula_validate',views.FormulaValidateView.as_view(),name='formula_validate'),
]