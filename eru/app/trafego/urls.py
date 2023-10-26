from django.urls import path
from . import views

urlpatterns = [
    path('trafego_linhas',views.linhas,name='trafego_linhas'),
    path('trafego_linha_add',views.linha_add,name='trafego_linha_add'),
    path('trafego_linha_id/<int:id>',views.linha_id,name='trafego_linha_id'),
    path('trafego_linha_update/<int:id>',views.linha_update,name='trafego_linha_update'),
    path('trafego_linha_delete/<int:id>/delete',views.linha_delete,name='trafego_linha_delete'),
    path('trafego_localidades',views.localidades,name='trafego_localidades'),
    path('trafego_localidade_add',views.localidade_add,name='trafego_localidade_add'),
    path('trafego_localidade_id/<int:id>',views.localidade_id,name='trafego_localidade_id'),
    path('trafego_localidade_update/<int:id>',views.localidade_update,name='trafego_localidade_update'),
    path('trafego_localidade_delete/<int:id>/delete',views.localidade_delete,name='trafego_localidade_delete'),
    path('trafego_trajetos/<int:id_linha>',views.trajetos,name='trafego_trajetos'),
    path('trafego_trajeto_delete/<int:id>/delete',views.trajeto_delete,name='trafego_trajeto_delete'),
    path('trafego_planejamentos',views.planejamentos,name='trafego_planejamentos'),
    path('trafego_planejamento_add',views.planejamento_add,name='trafego_planejamento_add'),
    path('trafego_planejamento_id/<int:id>',views.planejamento_id,name='trafego_planejamento_id'),
    path('trafego_planejamento_grid/<int:id>',views.planejamento_grid,name='trafego_planejamento_grid'),
    path('trafego_planejamento_horarios/<int:id>',views.planejamento_horarios,name='trafego_planejamento_horarios'),
    path('trafego_planejamento_update/<int:id>',views.planejamento_update,name='trafego_planejamento_update'),
    path('trafego_planejamento_delete/<int:id>/delete',views.planejamento_delete,name='trafego_planejamento_delete'),
    path('trafego_planejamento_grid_update/<int:id>',views.planejamento_grid_update,name='trafego_planejamento_grid_update'),
    path('trafego_patamar_update',views.patamar_update,name='trafego_patamar_update'),
    path('trafego_get_linha',views.get_linha,name='trafego_get_linha'),
    path('trafego_get_linhas_empresa',views.get_linhas_empresa,name='trafego_get_linhas_empresa'),
    path('trafego_get_localidades',views.get_localidades,name='trafego_get_localidades'),
]