// atualiza cargo, espera receber o id do setor como primeira variavel posicional
// segunda posicional (opcional) ira incluir a opcao Todos se for definida para true (default false)
function updateCargos(setorId, include_all=false) {
    const cargoSelect = document.getElementById('id_cargo');
    if (!cargoSelect) return;
    if (include_all) cargoSelect.innerHTML = '<option value="" data-i18n="common.all">Todos</option>';
    else cargoSelect.innerHTML = '';
    if (!setorId) return;
    fetch(`{% url 'pessoal:cargo_list' %}?cargo__setor=${setorId}`, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
    })
    .then(response => response.json())
    .then(data => {
        data.forEach(cargo => {
            const option = document.createElement('option');
            option.value = cargo.pk;
            option.textContent = cargo.fields.nome;
            cargoSelect.appendChild(option);
        });
    })
    .catch(error => {
        console.error('Erro ao carregar cargos:', error);
        appAlert('danger', i18n.getEntry('sys.recordErrorOnFilter') || 'Erro ao buscar dados solicitados');
    });
}