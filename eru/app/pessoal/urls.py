from django.urls import path
from . import views

urlpatterns = [
    path('pessoal_funcionarios',views.funcionarios,name='pessoal_funcionarios'),
]