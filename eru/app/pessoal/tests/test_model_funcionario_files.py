import os
from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from django.conf import settings
from pessoal.models import Funcionario
from core.models import Filial, Empresa

class FuncionarioFileTest(TestCase):
    def test_exclusao_fisica_da_foto_ao_deletar_funcionario(self):
        # 1. Cria uma imagem fake
        imagem_fake = SimpleUploadedFile(
            name='foto_teste.jpg', 
            content=b'file_content', 
            content_type='image/jpeg'
        )
        # 2. Cria empresa/filial necessárias
        emp = Empresa.objects.create(nome="E")
        fil = Filial.objects.create(nome="F", empresa=emp)
        # 3. Cria funcionário com a foto
        func = Funcionario.objects.create(
            nome="Teste", matricula="1", filial=fil, foto=imagem_fake
        )
        caminho_foto = func.foto.path
        self.assertTrue(os.path.exists(caminho_foto)) # Foto existe no disco
        # 4. Deleta o funcionário
        func.delete()
        # 5. O teste passa se o arquivo sumiu do HD
        self.assertFalse(os.path.exists(caminho_foto))
