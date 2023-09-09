from django.urls import path
from . import views

urlpatterns = [
    path('',views.index,name='index'),
    path('index',views.index,name='index'),
    path('login',views.login,name='login'),
    path('logout',views.logout,name='logout'),
    path('authenticate',views.authenticate,name='authenticate'),
    path('change_password',views.change_password,name='change_password'),
    path('logs',views.logs,name='logs'),
    path('handler/<int:code>',views.handler,name='handler'),
    path('core_usuarios',views.usuarios,name='core_usuarios'),
    path('core_usuario_add',views.usuario_add,name='core_usuario_add'),
    path('core_usuario_id/<int:id>',views.usuario_id,name='core_usuario_id'),
    path('core_usuario_update/<int:id>',views.usuario_update,name='core_usuario_update'),
    path('core_usuario_delete/<int:id>',views.usuario_delete,name='core_usuario_delete'),
    path('core_usuarios_grupo/<int:id>',views.usuarios_grupo,name='core_usuarios_grupo'),
    path('core_grupos',views.grupos,name='core_grupos'),
    path('core_grupo_add',views.grupo_add,name='core_grupo_add'),
    path('core_grupo_id/<int:id>',views.grupo_id,name='core_grupo_id'),
    path('core_grupo_update/<int:id>',views.grupo_update,name='core_grupo_update'),
    path('core_grupo_delete/<int:id>',views.grupo_delete,name='core_grupo_delete'),
    path('core_empresas',views.empresas,name='core_empresas'),
    path('core_empresa_add',views.empresa_add,name='core_empresa_add'),
    path('core_empresa_id/<int:id>',views.empresa_id,name='core_empresa_id'),
    path('core_empresa_update/<int:id>',views.empresa_update,name='core_empresa_update'),
    path('core_empresa_delete/<int:id>',views.empresa_delete,name='core_empresa_delete'),
    path('core_settings',views.settings,name='core_settings'),
    path('core_settings_update/<int:id>',views.settings_update,name='core_settings_update'),
    path('core_get_empresas',views.get_empresas,name='core_get_empresas'),
    path('core_get_grupos',views.get_grupos,name='core_get_grupos'),
    path('core_get_user_perms',views.get_user_perms,name='core_get_user_perms'),
    path('core_get_group_perms',views.get_group_perms,name='core_get_group_perms'),
]