# pessoal/urls.py
from django.urls import path
from pessoal.views import common, frequencia, turno

app_name = 'pessoal'

urlpatterns = [
    # ============================================
    # FUNCIONÁRIO
    # ============================================
    path('funcionarios/', common.FuncionarioListView.as_view(), name='funcionario_list'),
    path('funcionario/new/', common.FuncionarioCreateView.as_view(), name='funcionario_create'),
    path('funcionario/<int:pk>/update/', common.FuncionarioUpdateView.as_view(), name='funcionario_update'),
    path('funcionario/<int:pk>/delete/', common.FuncionarioDeleteView.as_view(), name='funcionario_delete'),
    
    # ============================================
    # DEPENDENTE
    # ============================================
    path('dependentes/<int:pk>/', common.DependenteListView.as_view(), name='dependente_list'),
    path('dependente/<int:pk>/new/', common.DependenteCreateView.as_view(), name='dependente_create'),
    path('dependente/<int:pk>/update/', common.DependenteUpdateView.as_view(), name='dependente_update'),
    path('dependente/<int:pk>/delete/', common.DependenteDeleteView.as_view(), name='dependente_delete'),
    
    # ============================================
    # AFASTAMENTO
    # ============================================
    path('afastamentos/<int:pk>/', common.AfastamentoListView.as_view(), name='afastamento_list'),
    path('afastamento/<int:pk>/new/', common.AfastamentoCreateView.as_view(), name='afastamento_create'),
    path('afastamento/<int:pk>/update/', common.AfastamentoUpdateView.as_view(), name='afastamento_update'),
    path('afastamento/<int:pk>/delete/', common.AfastamentoDeleteView.as_view(), name='afastamento_delete'),
    
    # ============================================
    # SETOR
    # ============================================
    path('setores/', common.SetorListView.as_view(), name='setor_list'),
    path('setor/new/', common.SetorCreateView.as_view(), name='setor_create'),
    path('setor/<int:pk>/update/', common.SetorUpdateView.as_view(), name='setor_update'),
    path('setor/<int:pk>/delete/', common.SetorDeleteView.as_view(), name='setor_delete'),
    
    # ============================================
    # CARGO
    # ============================================
    path('cargos/', common.CargoListView.as_view(), name='cargo_list'),
    path('cargo/new/', common.CargoCreateView.as_view(), name='cargo_create'),
    path('cargo/<int:pk>/update/', common.CargoUpdateView.as_view(), name='cargo_update'),
    path('cargo/<int:pk>/delete/', common.CargoDeleteView.as_view(), name='cargo_delete'),
    
    # ============================================
    # EVENTO
    # ============================================
    path('eventos/', common.EventoListView.as_view(), name='evento_list'),
    path('evento/new/', common.EventoCreateView.as_view(), name='evento_create'),
    path('evento/<int:pk>/update/', common.EventoUpdateView.as_view(), name='evento_update'),
    path('evento/<int:pk>/delete/', common.EventoDeleteView.as_view(), name='evento_delete'),
    
    # ============================================
    # MOTIVO REAJUSTE
    # ============================================
    path('motivos_reajuste/', common.MotivoReajusteListView.as_view(), name='motivoreajuste_list'),
    path('motivoreajuste/new/', common.MotivoReajusteCreateView.as_view(), name='motivoreajuste_create'),
    path('motivoreajuste/<int:pk>/update/', common.MotivoReajusteUpdateView.as_view(), name='motivoreajuste_update'),
    path('motivoreajuste/<int:pk>/delete/', common.MotivoReajusteDeleteView.as_view(), name='motivoreajuste_delete'),
    
    # ============================================
    # GRUPO EVENTO
    # ============================================
    path('grupos_evento/', common.GrupoEventoListView.as_view(), name='grupoevento_list'),
    path('grupoevento/new/', common.GrupoEventoCreateView.as_view(), name='grupoevento_create'),
    path('grupoevento/<int:pk>/update/', common.GrupoEventoUpdateView.as_view(), name='grupoevento_update'),
    path('grupoevento/<int:pk>/delete/', common.GrupoEventoDeleteView.as_view(), name='grupoevento_delete'),
    
    # ============================================
    # EVENTO FREQUÊNCIA
    # ============================================
    path('eventos_frequencia/', common.EventoFrequenciaListView.as_view(), name='eventofrequencia_list'),
    path('eventofrequencia/new/', common.EventoFrequenciaCreateView.as_view(), name='eventofrequencia_create'),
    path('eventofrequencia/<int:pk>/update/', common.EventoFrequenciaUpdateView.as_view(), name='eventofrequencia_update'),
    path('eventofrequencia/<int:pk>/delete/', common.EventoFrequenciaDeleteView.as_view(), name='eventofrequencia_delete'),
    
    # ============================================
    # CONTRATO
    # ============================================
    path('contratos/<int:pk>', common.ContratoManagementView.as_view(), name='contrato_list'),
    path('contratos/<int:pk_func>/delete/<int:pk>/', common.ContratoDeleteView.as_view(), name='contrato_delete'),
    
    # ============================================
    # EVENTO RELATED
    # ============================================
    path('eventos_related/<str:related>/<int:pk>/', common.EventoRelatedListView.as_view(), name='eventorelated_list'),
    path('evento_related/<str:related>/<int:pk>/new', common.EventoRelatedCreateView.as_view(), name='eventorelated_create'),
    path('evento_related/<str:related>/<int:pk>/update', common.EventoRelatedUpdateView.as_view(), name='eventorelated_update'),
    path('evento_related/<str:related>/<int:pk>/delete', common.EventoRelatedDeleteView.as_view(), name='eventorelated_delete'),
    
    # ============================================
    # FREQUÊNCIA (Refatorada com Services)
    # ============================================
    path('frequencia/', frequencia.FrequenciaManagementView.as_view(), name='frequencia_list'),
    path('frequencia/import/', frequencia.FrequenciaImportView.as_view(), name='frequencia_import'),
    
    # ============================================
    # TURNO (Refatorado com Services)
    # ============================================
    path('turnos/', turno.TurnoManagementView.as_view(), name='turno_list'),
    
    # ============================================
    # SETTINGS
    # ============================================
    path('settings/', common.PessoalSettingsUpdateView.as_view(), name='settings_list'),
    path('settings/<int:filial_id>/', common.PessoalSettingsUpdateView.as_view(), name='settings_update'),
    
    # ============================================
    # API
    # ============================================
    path('api/formula_validate', common.FormulaValidateView.as_view(), name='formula_validate'),
]