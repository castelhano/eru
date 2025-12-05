{% if related == 'cargo' %}
const empresas = new jsSelectm('#id_empresas', {
    title: i18n.getEntry('common.company__plural') || '<span data-i18n="common.company__plural">Empresas</span>'
})
appKeyMap.bind('alt+t', ()=>{empresas.checkAll()}, {
    icon: 'bi bi-check-square-fill', 
    'data-i18n': `compound.checkAll__var:${[i18n.getEntry('common.company__plural__toLowerCase') || 'empresas']}`, 
    desc: 'Marca todas as empresas', 
    origin: 'pessoal:evento_related_add'
})
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
const valor = document.getElementById('id_valor');
const tipo = document.getElementById('id_tipo');
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
}

const autocomplete = new Autocomplete(valor, {{props|safe}}, {
    enable: form.tipo.value == 'F',
    onchange: ()=>{ valorMask.updateValue() }
})