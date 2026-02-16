from django.utils.translation import gettext_lazy as _

DEFAULT_MESSAGES = {
    '400': _('[400] Erro de requisição, por favor verifique com o administrador do sistema'),
    '401': _('[401] Permissão negada, por favor verifique com o administrador do sistema'),
    '500': _('[500] Erro de servidor, se o problema persistir, contate o administrador'),
    'created': _('Registro criado com sucesso'),
    'updated': _('Registro atualizado com sucesso'),
    'updated_plural': _('Registros atualizados com sucesso'),
    'reset_default': _('Configurações restauradas para o padrão'),
    'deleted': _('Registro excluido, essa operação não pode ser desfeita'),
    'deleteError': _('Erro ao tentar apagar registro'),
    'emptyQuery': _('Nenhum resultado encontrado com os critérios informados'),
    'filterError': _('Erro ao buscar dados solicitados'),
    'notMatchCriteria': _('Os críterios de pelo menos um campo não foram atendidos, verifique os valores lançados'),
    'recordOverlap': _('Registro sobrepõe outras entradas existentes'),
    'endShorterThanStart': _('Data de fim não pode ser menor que inicio'),
    'saveError': _('Erro ao salvar registro'),
}