// // atualiza cargo, espera receber o id do setor como primeira variavel posicional
// // segunda posicional (opcional) ira incluir a opcao Todos se for definida para true (default false)
function updateCargos(setorId, include_all=false) {
    const cargoSelect = document.getElementById('id_cargo');
    if (!cargoSelect) return;
    if (include_all) cargoSelect.innerHTML = '<option value="" data-i18n="common.all">Todos</option>';
    else cargoSelect.innerHTML = '';
    if (!setorId) return;
    return fetch(`{% url 'pessoal:cargo_list' %}?cargo__setor=${setorId}`, {
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
        return data;
    })
    .catch(error => {
        console.error('Erro ao carregar cargos:', error);
        appAlert('danger', i18n.getEntry('sys.recordErrorOnFilter') || 'Erro ao buscar dados solicitados');
    });
}


function updateCargos(setorId, include_all=false) {
    const cargoSelect = document.getElementById('id_cargo');
    if (!cargoSelect) return Promise.resolve(); 
    if (include_all) cargoSelect.innerHTML = '<option value="" data-i18n="common.all">Todos</option>';
    else cargoSelect.innerHTML = '';
    if (!setorId) return Promise.resolve();
    return fetch(`{% url 'pessoal:cargo_list' %}?cargo__setor=${setorId}`, {
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
        return data; // retorna para o proximo .then() (caso definido na chama da funcao)
    })
    .catch(error => {
        let msg = i18n.getEntry('sys.recordErrorOnFilter');
        console.error(msg, error);
        throw new Error(msg); // lanca erro para ser capturado no catch externo (chamada da funcao) caso definido
    });
}
