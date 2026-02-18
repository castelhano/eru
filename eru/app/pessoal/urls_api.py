from rest_framework.routers import DefaultRouter
from pessoal.views.common import FuncionarioViewSet 

router = DefaultRouter()
router.register(r'funcionarios', FuncionarioViewSet, basename='funcionario-api')

urlpatterns = router.urls