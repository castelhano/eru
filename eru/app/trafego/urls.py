from django.urls import path
from . import views

app_name = 'trafego'

urlpatterns = [
    path('linhas',views.linhas,name='linhas'),
    path('linha_add',views.linha_add,name='linha_add'),
    path('linha_id/<int:id>',views.linha_id,name='linha_id'),
    path('linha_update/<int:id>',views.linha_update,name='linha_update'),
    path('linha_delete/<int:id>/delete',views.linha_delete,name='linha_delete'),
    path('localidades',views.localidades,name='localidades'),
    path('localidade_add',views.localidade_add,name='localidade_add'),
    path('localidade_id/<int:id>',views.localidade_id,name='localidade_id'),
    path('localidade_update/<int:id>',views.localidade_update,name='localidade_update'),
    path('localidade_delete/<int:id>/delete',views.localidade_delete,name='localidade_delete'),
    path('trajetos/<int:id_linha>',views.trajetos,name='trajetos'),
    path('trajeto_delete/<int:id>/delete',views.trajeto_delete,name='trajeto_delete'),
    path('planejamentos',views.planejamentos,name='planejamentos'),
    path('planejamento_add',views.planejamento_add,name='planejamento_add'),
    path('planejamento_id/<int:id>',views.planejamento_id,name='planejamento_id'),
    path('planejamento_grid/<int:id>',views.planejamento_grid,name='planejamento_grid'),
    path('planejamento_horarios/<int:id>',views.planejamento_horarios,name='planejamento_horarios'),
    path('planejamento_update/<int:id>',views.planejamento_update,name='planejamento_update'),
    path('planejamento_delete/<int:id>/delete',views.planejamento_delete,name='planejamento_delete'),
    path('planejamento_grid_update/<int:id>',views.planejamento_grid_update,name='planejamento_grid_update'),
    path('passageiros',views.passageiros,name='passageiros'),
    path('patamar_update',views.patamar_update,name='patamar_update'),
    path('get_linha',views.get_linha,name='get_linha'),
    path('get_linhas_empresa',views.get_linhas_empresa,name='get_linhas_empresa'),
    path('get_localidades',views.get_localidades,name='get_localidades'),
    path('passageiros_import',views.passageiros_import,name='passageiros_import'),
]