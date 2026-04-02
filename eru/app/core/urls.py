from django.urls import path
from django.contrib.auth import views as auth_views
from .routing import generate_urls

# Entidades independentes
common = [ "Usuario", "Grupo", "Empresa", "Settings", "Log" ]

# Entidades Dependentes (Hierarquia)
related = [
    "Filial", 
    {"model": "User", "context": "Group"}
]

# Configuração customizada
extra = {
    "Index": [
        {"context": "View", "path": "", "name": "index"},
        {"context": "View", "path": "index", "name": "index"}
    ],
    "CustomLogin": [{"context": "View", "path": "login", "name": "login"}],
    "Handler": [{"context": "View", "path": "handler/<int:code>", "name": "handler"}],
    "FilialData": [{"context": "View", "path": "api/filiais/", "name": "filial_list"}]
}
foo = generate_urls(app_name="core", common=common, related=related, extra=extra)
print(foo)

urlpatterns = [
    path('logout', auth_views.LogoutView.as_view(), name='logout'),
    *foo
]