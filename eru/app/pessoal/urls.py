from django.urls import path
from . import views

urlpatterns = [
    path('pessoal_funcionarios',views.funcionarios,name='pessoal_funcionarios'),
    path('pessoal_funcionario_add',views.funcionario_add,name='pessoal_funcionario_add'),
    path('pessoal_funcionario_id/<int:id>',views.funcionario_id,name='pessoal_funcionario_id'),
    path('pessoal_funcionario_update/<int:id>',views.funcionario_update,name='pessoal_funcionario_update'),
    path('pessoal_funcionario_delete/<int:id>/delete',views.funcionario_delete,name='pessoal_funcionario_delete'),
    path('pessoal_setores',views.setores,name='pessoal_setores'),
    path('pessoal_setor_add',views.setor_add,name='pessoal_setor_add'),
    path('pessoal_setor_id/<int:id>',views.setor_id,name='pessoal_setor_id'),
    path('pessoal_setor_update/<int:id>',views.setor_update,name='pessoal_setor_update'),
    path('pessoal_setor_delete/<int:id>/delete',views.setor_delete,name='pessoal_setor_delete'),
    path('pessoal_cargos',views.cargos,name='pessoal_cargos'),
    path('pessoal_cargo_add',views.cargo_add,name='pessoal_cargo_add'),
    path('pessoal_cargo_id/<int:id>',views.cargo_id,name='pessoal_cargo_id'),
    path('pessoal_cargo_update/<int:id>',views.cargo_update,name='pessoal_cargo_update'),
    path('pessoal_cargo_delete/<int:id>/delete',views.cargo_delete,name='pessoal_cargo_delete'),
    path('pessoal_get_setores',views.get_setores,name='pessoal_get_setores'),
    path('pessoal_get_cargos',views.get_cargos,name='pessoal_get_cargos'),
]