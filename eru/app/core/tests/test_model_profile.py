from django.test import TestCase
from django.contrib.auth.models import User
from core.models import Profile, Filial, Empresa

class ProfileModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='joao', password='123')
        self.empresa = Empresa.objects.create(nome="Minha Empresa")
        self.filial1 = Filial.objects.create(nome="Filial Norte", empresa=self.empresa)
        self.filial2 = Filial.objects.create(nome="Filial Sul", empresa=self.empresa)
    def test_profile_criado_automaticamente(self):
        """
        Garante que o Signal funcionou e o Profile existe para o novo User
        """
        self.assertTrue(Profile.objects.filter(user=self.user).exists())
        # Verifica se o __str__ está retornando o username como esperado
        profile = self.user.profile
        self.assertEqual(str(profile), 'joao')
    def test_nao_cria_profile_duplicado_no_update(self):
        """Verifica se o signal lida corretamente com atualizações de usuário"""
        self.user.first_name = "João Silva"
        self.user.save() # Isso dispara o signal novamente, mas o 'created' será False
        self.assertEqual(Profile.objects.filter(user=self.user).count(), 1)
    def test_allow_filial(self):
        """
        Verifica a lógica de permissão de filiais
        """
        profile = self.user.profile
        profile.filiais.add(self.filial1)
        self.assertTrue(profile.allow_filial(self.filial1.id))
        self.assertFalse(profile.allow_filial(self.filial2.id))
    def test_empresas_property(self):
        """
        Verifica se a propriedade 'empresas' retorna apenas empresas das filiais permitidas
        """
        # Criamos uma empresa e associamos filiais
        empresa = Empresa.objects.create(nome="Holding")
        empresa.filiais.add(self.filial1, self.filial2)
        profile = self.user.profile
        # Liberamos apenas a filial 1 para este perfil
        profile.filiais.add(self.filial1)
        # O teste: a empresa deve aparecer na lista
        self.assertIn(empresa, profile.empresas)
        # O teste do Prefetch: a filial_permitida deve conter a 1, mas NÃO a 2
        primeira_empresa = profile.empresas.first()
        permitidas = primeira_empresa.filiais_permitidas
        self.assertIn(self.filial1, permitidas)
        self.assertNotIn(self.filial2, permitidas)