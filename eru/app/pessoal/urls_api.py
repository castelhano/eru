from rest_framework.routers import DefaultRouter
from .views import FuncionarioViewSet, CargoViewSet 

router = DefaultRouter()
router.register(r'funcionarios', FuncionarioViewSet, basename='funcionario-api')
router.register(r'cargos', CargoViewSet, basename='cargo-api')

urlpatterns = router.urls