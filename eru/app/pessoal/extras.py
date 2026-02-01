from core.extras import get_props
from .models import Funcionario, Evento

# Retorna lista com todas as variaveis utilizadas para composicao de formula em eventos
# busca tanto eventos criados pelo usuario quanto props definidas nos modelos alvo
# adicione True como primeira variavel posicional para retornar um dicionario (1 para valores)
def getEventProps(asDict=False):
    prop_func = get_props(Funcionario)
    props_custom = list(Evento.objects.exclude(rastreio='').values_list('rastreio', flat=True).distinct())
    return dict.fromkeys(prop_func + props_custom, 1) if asDict else prop_func + props_custom