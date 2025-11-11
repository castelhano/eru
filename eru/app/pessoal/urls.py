from django.urls import path
from . import views

app_name = 'pessoal'

urlpatterns = [
    path('funcionarios',views.funcionarios,name='funcionarios'),
    path('funcionario_add',views.funcionario_add,name='funcionario_add'),
    path('funcionario_id/<int:id>',views.funcionario_id,name='funcionario_id'),
    path('funcionario_update/<int:id>',views.funcionario_update,name='funcionario_update'),
    path('funcionario_delete/<int:id>/delete',views.funcionario_delete,name='funcionario_delete'),
    path('setores',views.setores,name='setores'),
    path('setor_add',views.setor_add,name='setor_add'),
    path('setor_id/<int:id>',views.setor_id,name='setor_id'),
    path('setor_update/<int:id>',views.setor_update,name='setor_update'),
    path('setor_delete/<int:id>/delete',views.setor_delete,name='setor_delete'),
    path('cargos',views.cargos,name='cargos'),
    path('cargo_add',views.cargo_add,name='cargo_add'),
    path('cargo_id/<int:id>',views.cargo_id,name='cargo_id'),
    path('cargo_update/<int:id>',views.cargo_update,name='cargo_update'),
    path('cargo_delete/<int:id>/delete',views.cargo_delete,name='cargo_delete'),
    path('eventos',views.eventos,name='eventos'),
    path('evento_add',views.evento_add,name='evento_add'),
    path('evento_id/<int:id>',views.evento_id,name='evento_id'),
    path('evento_update/<int:id>',views.evento_update,name='evento_update'),
    path('evento_delete/<int:id>/delete',views.evento_delete,name='evento_delete'),
    path('grupos_evento',views.grupos_evento,name='grupos_evento'),
    path('grupo_evento_add',views.grupo_evento_add,name='grupo_evento_add'),
    path('grupo_evento_id/<int:id>',views.grupo_evento_id,name='grupo_evento_id'),
    path('grupo_evento_update/<int:id>',views.grupo_evento_update,name='grupo_evento_update'),
    path('grupo_evento_delete/<int:id>/delete',views.grupo_evento_delete,name='grupo_evento_delete'),
    path('get_setores',views.get_setores,name='get_setores'),
    path('get_cargos',views.get_cargos,name='get_cargos'),
    path('get_grupos_evento',views.get_grupos_evento,name='get_grupos_evento'),
    path('add_setor',views.add_setor,name='add_setor'),
    path('add_grupo_evento',views.add_grupo_evento,name='add_grupo_evento'),
    path('update_grupo_evento', views.update_grupo_evento,name='update_grupo_evento'),
    path('delete_grupo_evento', views.delete_grupo_evento,name='delete_grupo_evento'),
]