import base64
import os, glob
from pathlib import Path

# Monta dicionario com parametros recebidos no request
# --
# @version  1.0
# @since    10/10/2021
# @author   Rafael Gustavo ALves {@email castelhano.rafael@gmail.com }
# @param    {Dict} request Requisicao
# @param    {Array} fields Lista com campos aceitos no request, todos os demais serao desconsiderados
# @returns  {Dict} Dicionario ajustado
def clean_request(request, fields):
    params = {}
    for p in fields:
        if p in request:
            if request[p] != 'True' and request[p] != 'False' and request[p] != 'None':
                params[p] = request[p]
            elif request[p] == 'True':
                params[p] = True
            elif request[p] == 'False':
                params[p] = False
            else:
                params[p] = None
    return params


# Cria imagem a partir de dataUrl
# --
# @version  1.0
# @since    14/10/2022
# @author   Rafael Gustavo Alves {@email castelhano.rafael@gmail.com }
# @param    {String} data_url Ex.: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAA...'
# @param    {String} file_path Caminho a ser salvo Ex: '{settings.MEDIA_ROOT}/pessoal/fotos'
# @param    {String} file_name Nome do arquivo a ser criado/alterado
# @param    {String} older_prefix_to_remove Se informado, revome arquivos que iniciam com o mesmo prefixo
# @returns  {Array} Retorna [True] ou [False, error]
def create_image(data_url, file_path, file_name, older_prefix_to_remove=False):
    try:
        if older_prefix_to_remove:
            for filename in glob.glob(f'{file_path}/{older_prefix_to_remove}*'):
                os.remove(filename)
        image_bin = data_url.split(',')[1]
        if not os.path.exists(file_path):
            Path(file_path).mkdir(parents=True, exist_ok=True)
        output = open(f'{file_path}/{file_name}', 'wb')
        output.write(base64.b64decode(image_bin))
        output.close()
        return [True]
    except Exception as e:
        return [False, str(e)]
    