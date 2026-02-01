{% if related == 'cargo' or related == 'empresa' %}
const empresas = new jsSelectm('#id_filiais', {
    title: gettext('Filiais')
})
appKeyMap.bind('alt+t', ()=>{empresas.checkAll()}, {
    icon: 'bi bi-check-square-fill', 
    desc: gettext('Marca todas as empresas'),
    origin: 'pessoal:evento_related_add'
})
{% endif %}

const responseValidade = document.getElementById('responseValidate');
const validateBtn = document.getElementById('id_validate');
const submitBtn = document.getElementById('submit');

const submitShortcut = appKeyMap.getShortcut('alt+g');
submitShortcut.desc = gettext('Salvar ou Validar formula');
submitShortcut.method = ()=>{
    if(submitBtn.disabled){validateBtn.click()}
    else{submitBtn.click()}
}
validateBtn.onclick = ()=>{syntaxCheck()};
// valor deve ser tratado em formato americano pois sera tratado no servidor desta forma
const valor = document.getElementById('id_valor');
const formulaMask = IMask(valor, { mask: /[\s\S]*/ })

const form = new jsForm(document.getElementById('app_form'), {
    imask: [formulaMask],
})
const autocomplete = new Autocomplete(valor, {{props|safe|default:'[]'}}, {
    enable: true,
    onchange: ()=>{ formulaMask.updateValue() }
})

{% if perms.pessoal.add_motivoreajuste %}
  const motivoRelated = new RelatedAddon('#id_motivo', {
    labels: {
      nome: gettext('Nome do grupo')
    },
    url: {
      related: {
        add: "{% url 'pessoal:motivoreajuste_create' %}",
      }
    }    
  })
  {% endif %}


async function syntaxCheck() {
    const url = "{% url 'pessoal:formula_validate' %}";
    responseValidade.textContent = gettext("Validando fórmula...");
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({ valor: valor.value })
        });
        const result = await response.json();
        if (result.status === 'ok') {
            responseValidade.innerHTML = `<i class="bi bi-check2-circle text-success me-2"></i> ${gettext('Sintaxe é valida')}`
            document.getElementById('submit').disabled = false;
        } else {
            responseValidade.innerHTML = `<i class="bi bi-x-octagon-fill text-danger me-2"></i> [ <b>${result.type}</b> ] <br>--<br>${result.message}`;
            document.getElementById('submit').disabled = true;
        }
    } catch (error) {        
        responseValidade.innerHTML = gettext('[500] Erro no servidor, se o problema persistir, contate o administrador');
        document.getElementById('submit').disabled = false;
    }
}