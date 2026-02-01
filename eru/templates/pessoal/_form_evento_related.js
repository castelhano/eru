{% if related == 'cargo' or related == 'empresa' %}
// const empresas = new jsSelectm('#id_empresas', {
//     title: i18n.getEntry('common.company__plural') || '<span >Empresas</span>'
// })
// appKeyMap.bind('alt+t', ()=>{empresas.checkAll()}, {
//     icon: 'bi bi-check-square-fill', 
//     'data-i18n': `compound.checkAll__var:${[i18n.getEntry('common.company__plural__toLowerCase') || 'empresas']}`, 
//     desc: 'Marca todas as empresas', 
//     origin: 'pessoal:evento_related_add'
// })
{% endif %}

const numberMaks = {
    mask: Number,
    scale: 2,
    thousandsSeparator: ',',
    padFractionalZeros: true,
    normalizeZeros: true,
    radix: '.',
    mapToRadix: [','],
}

const formulaMask = {
    mask: /[\s\S]*/
}

// valor deve ser tratado em formato americano pois sera tratado no servidor desta forma
const tipo = document.getElementById('id_tipo');
const valor = document.getElementById('id_valor');
const responseValidade = document.getElementById('responseValidate');
const validateBtn = document.getElementById('id_validate');
const submitBtn = document.getElementById('submit');

const submitShortcut = appKeyMap.getShortcut('alt+g');
submitShortcut['data-i18n'] = 'personal.event.form.saveOrValidateFormula';
submitShortcut.desc = i18n.getEntry(submitShortcut['data-i18n']) || 'Salvar ou Validar formula';
submitShortcut.method = ()=>{
    if(submitBtn.disabled){validateBtn.click()}
    else{submitBtn.click()}
}


valor.oninput = ()=>{
// ao alterar valor, exige validacao
submitBtn.disabled = true;
responseValidade.innerHTML = '';
}
validateBtn.onclick = ()=>{syntaxCheck()};
const valorMask = IMask(valor, tipo.value == 'V' ? numberMaks : formulaMask)

const form = new jsForm(document.getElementById('app_form'), {
    imask: [valorMask],
    customValidation: {
        'valor': (val)=>{
            if(form.tipo == 'V'){return true}
            // aqui deve ser validado a formula
            return [true];
        }
    },
})
tipo.onchange = (ev)=>{
    if(ev.target.value == 'V'){ 
        valorMask.value = '';
        valorMask.updateOptions(numberMaks);
        autocomplete.options.enable = false;
    }
    else{ 
        valorMask.value = '';
        valorMask.updateOptions(formulaMask);
        autocomplete.options.enable = true;
    }
    submitBtn.disabled = true; // ao alterar o tipo obriga validar formula novamente
}

const autocomplete = new Autocomplete(valor, {{props|safe|default:'[]'}}, {
    enable: form.tipo.value == 'F',
    onchange: ()=>{ valorMask.updateValue() }
})

{% if perms.pessoal.add_motivoreajuste %}
  i18n.addVar('motivoReajuste', [i18n.getEntry('personal.event.changeReason') || 'Motivo Reajuste'])
  const motivoRelated = new RelatedAddon('#id_motivo', {
    title: i18n.getEntry('compound.registerOf__varb:$motivoReajuste') || 'Cadastro de Motivo Reajuste',
    labels: {
      nome: i18n.getEntry('personal.event.form.groupName') || '<span >Nome do grupo</span>'
    },
    url: {
    //   parent: {
    //     show: "{# url 'pessoal:get_grupos_evento' #}",
    //   },
      related: {
        add: "{% url 'pessoal:motivoreajuste_create' %}",
      }
    }    
  })
  {% endif %}


async function syntaxCheck() {
    const url = "{% url 'pessoal:formula_validate' %}";
    responseValidade.textContent = "Validando sintaxe no servidor...";
    
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
            responseValidade.innerHTML = `<i class="bi bi-check2-circle text-success me-2"></i> ${i18n.getEntry('asteval.syntaxValid') || 'Sintaxe é valida'}`
            document.getElementById('submit').disabled = false;
        } else {
            responseValidade.innerHTML = `<i class="bi bi-x-octagon-fill text-danger me-2"></i> [ <b>${result.type}</b> ] <br>--<br>${result.message}`;
            document.getElementById('submit').disabled = true;
        }
    } catch (error) {        
        responseValidade.innerHTML = i18n.getEntry('sys.500') || '[500] Erro no servidor, se o problema persistir, contate o administrador';
        document.getElementById('submit').disabled = false;
    }
}