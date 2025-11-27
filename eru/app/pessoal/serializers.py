from rest_framework import serializers
from .models import Funcionario, Cargo

class FuncionarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Funcionario
        fields = ['pk','empresa','matricula','nome','apelido','cargo','pne']

class CargoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cargo
        fields = ['pk','nome','setor']