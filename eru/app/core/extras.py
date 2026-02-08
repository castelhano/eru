import os, glob, math, base64
from pathlib import Path
from asteval import Interpreter


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



def get_props(model_class):
    """
    Extrai uma lista contendo os nomes de todos os atributos decorados
    com '@property' em uma classe de modelo Django

    Esta funcao usa introspeccao de classe do Python para identificar 
    dinamicamente as propriedades definidas
    
    Args:
        model_class (class): A classe do modelo Django a ser inspecionada
                             (ex: Funcionario, Cargo)

    Returns:
        list: Uma lista de strings contendo os nomes das properties
              Ex: ['F_salario_base', 'F_nome_completo']
    """
    prop_list = []
    for name, value in model_class.__dict__.items():
        # verifica se o valor do atributo e do tipo 'property'
        if isinstance(value, property):
            prop_list.append(name)
    return prop_list


def asteval_run(expression, vars_dict):
    # expression espera uma string com calculo a ser realizado
    whitelist = {
        'sqrt': math.sqrt,
        'sin': math.sin,
        'cos': math.cos,
        'log': math.log,
        'e': math.e,
        'pi': math.pi,
        # Adicione operadores logicos se necessario (and, or, not sao nativos)
        'True': True,
        'False': False,
    }
    aeval = Interpreter(
        minimal=True,
        user_symbols=whitelist,
        use_numpy=False,
        with_if=True,
        with_ifexp=True,
        builtins_readonly=True
    )
    aeval.symtable.update(vars_dict)
    result = aeval(expression)      # tenta interpretar codigo
    if aeval.error:
        error_message = aeval.error[0].get_error()
        return {'status': False, 'type': error_message[0], 'message': error_message[1]}
    return {'status': True, 'result': result }