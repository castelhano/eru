class jsForm{
    constructor(form, options){
        this.form = form;
        this.common = []; // Lista vai armazenar os fields comuns (sem maskara)
        this.imask = options?.imask || [];
        this.imaskFieldNames = [];
        this.novalidate = options?.novalidate != undefined ? options.novalidate : false;
        this.imask.forEach((el)=>{ // Carrega list com nomes dos imaskFields
            this.imaskFieldNames.push(el.el.input.name); // Popula list com names dos campos imask (usado no for do dicionario data)
        })
        for(let i = 0; i < this.form.elements.length; i++){ // Carrega list dos elementos do form comuns (sem mascara)
            if(this.imaskFieldNames.includes(this.form.elements[i].name)){continue}
            this.common.push(this.form.elements[i]);
        }

        if(!this.novalidate){
            this.form.setAttribute('novalidate', null); // Desativa validacao pelo navegador
            this.form.onsubmit = ()=>{return this.validate()} ; // Chama funcao de validacao ao submeter form
            this.__imaskValidate(); // Adiciona validacao para elementos imask
            this.__validateListeners(); // Adiciona listeners (onblur) nos fields

        }


    }
    load(data, ignore=[]){
        this.imask.forEach((el)=>{ // Ajusta elementos imask
            if(data.hasOwnProperty(el.el.input.name)){el.value = data[el.el.input.name]}; // Carrega valores ajustados em campos imask
        })
        for(let key in data){ // Carrega demais valores do dicionario
            if(!ignore.includes(key) && !this.imaskFieldNames.includes(key)){try{this.form.querySelector(`#id_${key}`).value = data[key]}catch(e){}}
        }

    }
    get(field){ // Retorna dicionario com valores do form form.get() ou valor de field em especifico form.get('nome')
        let formData = new FormData(this.form);
        if(field){return formData.get(field)} 
        let resp = {};
        for(let [key, value] of formData){resp[key] = value}
        return resp;
    }
    disabled(fields){
        if(fields){
            for(let i in fields){
                try {
                    let field = this.form.querySelector(`#id_${fields[i]}`);
                    if(field instanceof HTMLElement && field.getAttribute('data-jsform') == 'always_enable'){continue;} // Para habilitar um controle num form disabled adicione o attr data-jsform='always_enable'
                    if(['INPUT','TEXTAREA','BUTTON'].includes(field.tagName)){
                        field.disabled = true;
                        if(field.type == 'file'){
                            try{ // Djando input#files adiciona controle para limpar campo, também desabilita controle 
                                this.form.querySelector(`#${field.name}-clear_id`).disabled = true;                                
                            }catch(e){}
                        }
                    }
                    else if(field.tagName == 'SELECT'){field.classList.add('readonly');field.tabIndex = -1;}
                }catch(e){}
            }
        }
        else{
            for(let i = 0; i < this.form.elements.length; i++){
                if(this.form.elements[i] instanceof HTMLElement && this.form.elements[i].getAttribute('data-jsform') == 'always_enable'){continue;} // Para habilitar um controle num form disabled adicione o attr data-jsform='always_enable'
                if(['INPUT','TEXTAREA','BUTTON'].includes(this.form.elements[i].tagName)){this.form.elements[i].disabled = true;}
                else if(this.form.elements[i].tagName == 'SELECT'){this.form.elements[i].classList.add('readonly');this.form.elements[i].tabIndex = -1;}
            }
        }
    }
    readonly(fields){
        if(fields){
            for(let i in fields){
                try {
                    let field = this.form.querySelector(`#id_${fields[i]}`);
                    if(field instanceof HTMLElement && field.getAttribute('data-jsform') == 'always_enable'){continue;} // Para habilitar um controle num form disabled adicione o attr data-jsform='always_enable'
                    if(['INPUT','TEXTAREA','BUTTON'].includes(field.tagName)){
                        if(field.type == 'file'){
                            field.style.pointerEvents = 'none';field.style.touchAction = 'none';field.onkeydown = (e)=>{e.preventDefault(); return false;}
                            try{ // Djando input#files adiciona controle para limpar campo, também desabilita controle 
                                this.form.querySelector(`#${field.name}-clear_id`).disabled = true;                                
                            }catch(e){}
                        }
                        else{field.readOnly = true;}
                    }
                    else if(field.tagName == 'SELECT'){field.classList.add('readonly');field.tabIndex = -1;}
                }catch(e){}
            }
        }
        else{
            for(let i = 0; i < this.form.elements.length; i++){
                if(this.form.elements[i] instanceof HTMLElement && this.form.elements[i].getAttribute('data-jsform') == 'always_enable'){continue;} // Para habilitar um controle num form disabled adicione o attr data-jsform='always_enable'
                if(['INPUT','TEXTAREA','BUTTON'].includes(this.form.elements[i].tagName)){
                    if(this.form.elements[i].type == 'file'){ // Inputs[file] necessario desativar eventos de click e input
                        this.form.elements[i].style.pointerEvents = 'none';this.form.elements[i].style.touchAction = 'none';this.form.elements[i].onkeydown = (e)=>{e.preventDefault(); return false;}
                        try{ // Djando input#files adiciona controle para limpar campo, também desabilita controle 
                            this.form.querySelector(`#${this.form.elements[i].name}-clear_id`).disabled = true;                                
                        }catch(e){}
                    }
                    else{this.form.elements[i].readOnly = true;}
                }
                else if(this.form.elements[i].tagName == 'SELECT'){this.form.elements[i].classList.add('readonly');this.form.elements[i].tabIndex = -1;}
            }
        }
    }
    __validateRequired(el){
        let max = el.getAttribute('maxlength');
        let min = el.getAttribute('minlength');
        if(max && el.value.length > el.maxLength || min && el.value.length < el.minLength){
            el.classList.add('is-invalid');
            if(max && min){appNotify('warning', `jsform: <b>${el.name}</b> deve ter entre ${el.minLength} e ${el.maxLength} caracteres`)}
            else if(max || min){appNotify('warning', `jsform: <b>${el.name}</b> deve ter no ${max ? 'máximo' : 'mínimo'} ${max ? el.maxLength : el.minLength} caracteres`)}
        }
        else if(el.required && el.value == ''){el.classList.add('is-invalid');}
    }
    __validateNumber(el){
        let max = parseFloat(el.getAttribute('max')) || null;
        let min = parseFloat(el.getAttribute('min')) || null;
        if(max && parseFloat(el.value) > max || min && parseFloat(el.value) < min){
            el.classList.add('is-invalid');
            if(max && min){appNotify('warning', `jsform: <b>${el.name}</b> deve ser entre ${min} e ${max}`, false)}
            else if(max || min){appNotify('warning', `jsform: <b>${el.name}</b> deve ser no ${max ? 'máximo' : 'mínimo'} ${max ? max : min}`, false)}
            
        }
        else if(el.required && el.value == ''){el.classList.add('is-invalid');}
    }
    __validateEmail(el){
        if(el.value != '' && !this.__emailIsValid(el.value)){
            el.classList.add('is-invalid');
            appNotify('warning', 'jsform: <b>Email</b> tem formato inválido');
        }
    }
    __emailIsValid(email){
        return /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(email)
    }
    validate(){ // PAREI AQUI< FALTA ADICIONAR __validateListeners
        cleanNotify(); // Limpa area de notificacao
        // Valida status required, maxlength e minlength
        this.form.querySelectorAll('[required]:not([type=number]):not([type=email]),[minlength]:not([type=email]),[maxlength]:not([type=email])').forEach((el)=>{this.__validateRequired(el)})

        // Valida inputs NUMBER quanto ao MIN e MAX e required
        this.form.querySelectorAll('input[type=number]').forEach((el)=>{this.__validateNumber(el)})

        // Valida email fields
        this.form.querySelectorAll('input[type=email]').forEach((el)=>{ this.__validateEmail(el); })

        // Verifica se foi apontado erro em algum field, se nao faz tratamento e submete form
        if(this.form.querySelectorAll('.is-invalid').length == 0){ // Caso nao tenha erros
            // Ajusta formatacao de campos currency (data-jsform_unmask=cur) para o padrao americano (de 0.000,00 para 0000.00)
            this.form.querySelectorAll('[data-jsform_unmask=cur]').forEach((el)=>{el.value = el.value.replace('.','').replace(',','.');})
            
            // Remove alpha e espacos do texto mantendo apenas numeros (data-jsform_unmask=num)
            this.form.querySelectorAll('[data-jsform_unmask=num]').forEach((el)=>{el.value = el.value.replace(/\D/g,'');})
            
            // Faz toUpperCase no valor de elementos com classe text-uppercase
            this.form.querySelectorAll('.text-uppercase').forEach((el)=>{el.value = el.value.toUpperCase();})
            
            // Faz toLowerCase no valor de elementos com classe text-lowercase
            this.form.querySelectorAll('.text-lowercase').forEach((el)=>{el.value = el.value.toLowerCase()})
            return true;
        }
        appAlert('warning', '<b>jsform</b>: Existem campo(s) inválidos, corriga antes de prosseguir');
        return false;
        
    }
    __imaskValidate(){
        for(let i in this.imask){
            if(this.imask[i].el.input.required){ // Adiciona validacao para required
                this.imask[i].el.input.onblur = ()=>{if(this.imask[i].value == ''){this.imask[i].el.input.classList.add('is-invalid')}}
            }
            let self = this; // workaround para acessar this dentro de funcao assinc
            this.imask[i].on('accept', function(ev) { // Adiciona validacao no imask
                if(self.imask[i].value != ''){self.imask[i].el.input.classList.add('is-invalid');}
                else{self.imask[i].el.input.classList.remove('is-invalid');}
            }).on('complete', function(){self.imask[i].el.input.classList.remove('is-invalid')})
        }
    }
    __validateListeners(){}
}



/*
* formValidate
*
* @version  1.0
* @since    03/09/2023
* @author   Rafael Gustavo Alves {@email castelhano.rafael@gmail.com }
* @desc     Implementa validacao de dados para formulario
* @example  formValidate(document.querySelector('form'));
* Validacoes disponiveis:
* -> fields com required
* -> fields number valida min e max
* -> fields text valida maxLength e minLength
* -> atribua data-jsform_unmask="cur" ou data-jsform_unmask="num" para remover formatacao antes do submit
* -> ajusta valores de elementos com classes text-[uppercase, lowercase] conforme caso
* -> atribua data-jsform="novalidate" para ignorar validacao no elemento
*/
function formValidate(form){
    
    form.setAttribute('novalidate', null); // Desativa validacao pelo navegador
    formValidate_addListeners(form); // Adiciona os listeners (onblur) nos elementos do form
    form.onsubmit = () => { // Funcao de validacao do form
        cleanNotify(); // Limpa area de notificacao
        // Verifica elementos REQUIRES se estao preenchidos
        form.querySelectorAll('[required]:not([data-jsform=novalidate]):not([type=number]):not([type=email]),[minlength]:not([data-jsform=novalidate]):not([type=email]),[maxlength]:not([data-jsform=novalidate]):not([type=email])').forEach((el)=>{
            let max = el.getAttribute('maxlength');
            let min = el.getAttribute('minlength');
            if(max && el.value.length > el.maxLength || min && el.value.length < el.minLength){
                el.classList.add('is-invalid');
                if(max && min){appNotify('warning', `jsform: <b>${el.name}</b> deve ter entre ${el.minLength} e ${el.maxLength} caracteres`)}
                else if(max || min){appNotify('warning', `jsform: <b>${el.name}</b> deve ter no ${max ? 'máximo' : 'mínimo'} ${max ? el.maxLength : el.minLength} caracteres`)}
            }
            else if(el.required && el.value == ''){el.classList.add('is-invalid');}
        })
        
        // Valida inputs NUMBER quanto ao MIN e MAX
        form.querySelectorAll('input[type=number][min]:not([data-jsform=novalidate]), input[type=number][max]:not([data-jsform=novalidate])').forEach((el)=>{
            if(el.hasAttribute('max') && parseFloat(el.value) > parseFloat(el.max) || el.hasAttribute('min') && parseFloat(el.value) < parseFloat(el.min)){
                el.classList.add('is-invalid');
                appNotify('warning', `jsform: <b>${el.name}</b> deve ser entre ${el.min || '--'} e ${el.max || '--'}`);
            }
        })

        // Valida email
        form.querySelectorAll('input[type=email]:not([data-jsform=novalidate])').forEach((el)=>{
            if(el.value != '' && !emailIsValid(el.value)){
                el.classList.add('is-invalid');
                appNotify('warning', 'jsform: <b>Email</b> tem formato inválido');
            }
        })
        
        if(form.querySelectorAll('.is-invalid').length == 0){ // Caso nao tenha mais erros
            // Ajusta formatacao de campos currency (data-jsform_unmask=cur) para o padrao americano (de 0.000,00 para 0000.00)
            form.querySelectorAll('[data-jsform_unmask=cur]').forEach((el)=>{el.value = el.value.replace('.','').replace(',','.');})
            
            // Remove alpha e espacos do texto mantendo apenas numeros (data-jsform_unmask=num)
            form.querySelectorAll('[data-jsform_unmask=num]').forEach((el)=>{el.value = el.value.replace(/\D/g,'');})
            
            // Faz toUpperCase no valor de elementos com classe text-uppercase
            form.querySelectorAll('.text-uppercase').forEach((el)=>{el.value = el.value.toUpperCase();})
            
            // Faz toLowerCase no valor de elementos com classe text-lowercase
            form.querySelectorAll('.text-lowercase').forEach((el)=>{el.value = el.value.toLowerCase()})
            return true;
        }
        appAlert('warning', '<b>jsform</b>: Existem campo(s) inválidos, corriga antes de prosseguir');
        return false;
    }
    function formValidate_addListeners(form){ // Funcao auxiliar ao formValidate, adiciona listeners de validacao no onblur
        form.querySelectorAll('[required]:not([data-jsform=novalidate]):not([type=number]):not([type=email]),[minlength]:not([data-jsform=novalidate]):not([type=email]),[maxlength]:not([data-jsform=novalidate])').forEach((el)=>{
            el.onblur = () => {
                let max = el.getAttribute('maxlength');
                let min = el.getAttribute('minlength');
                if(el.required && el.value == '' || max && el.value.length > el.maxLength || min && el.value.length < el.minLength){el.classList.add('is-invalid')}
                else{el.classList.remove('is-invalid')}
            }
        })
        form.querySelectorAll('input[type=number][min]:not([data-jsform=novalidate]), input[type=number][max]:not([data-jsform=novalidate])').forEach((el)=>{
            el.onblur = () => {
                if(el.hasAttribute('max') && parseFloat(el.value) > parseFloat(el.max) || el.hasAttribute('min') && parseFloat(el.value) < parseFloat(el.min)){
                    el.classList.add('is-invalid');
                    appNotify('warning', `jsform: <b>${el.name}</b> deve ser entre ${el.min || '--'} e ${el.max || '--'}`);
                }
                else{el.classList.remove('is-invalid');}
            }  
        })
        form.querySelectorAll('input[type=email]:not([data-jsform=novalidate])').forEach((el)=>{
            el.onblur = () => {
                if(el.required && el.value == '' || el.value != '' && !emailIsValid(el.value)){el.classList.add('is-invalid');}
                else{el.classList.remove('is-invalid');}
            }  
        })
    }
    function emailIsValid(email){return /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(email)}
}



/*
* selectPopulate
* --
* @version  1.0
* @since    05/09/2023
* @author   Rafael Gustavo Alves {@email castelhano.rafael@gmail.com }
* @desc     Busca dados via Ajax e carrega em select
* @example  const empresas = new selectPopulate({target: element, url: 'url', ...})
*/
class selectPopulate{
    constructor(options){
        if(!options.target || !options.url){console.log('jsform: target e url são obrigatórios');return false}
        this.target = options.target;
        this.data = []; // Json com dados retornados
        this.url = options.url;
        this.params = options.params ? `?${options.params}`  : '';
        this.key = options?.key || 'id';
        this.value = options?.value || 'nome';
        this.method = options?.method || 'GET';
        this.beforeRequest = options?.beforeRequest != undefined ? options.beforeRequest : ()=>{return true}; // Funcao a ser chamada antes de executar a consulta
        this.emptyRow = options?.emptyRow || false; // Se true insere linha vazia antes dos registros
        this.emptyRowValue = options?.emptyRowValue || '';
        this.emptyRowText = options?.emptyRowText || '--';
        this.emptyMessage = options?.emptyMessage || 'Nenhum registro';
        if(options?.onChange){this.target.onchange = options.onChange} // Funcao a ser atribuida no evento onchange (caso informado ao instanciar)
        this.onEmpty = options?.onEmpty != undefined ? options.onEmpty : ()=>{ // Funcao a ser executada caso retorno seja array vazio '[]'
            this.target.innerHTML = `<option selected disabled>${this.emptyMessage}</option>`;
        };
        this.onError = options?.onError != undefined ? options.onError : ()=>{ 
            this.target.innerHTML = `<option selected disabled>${this.emptyMessage}</option>`;
            appNotify('danger', `jsform: Erro ao carregar <b>${this.target.name}</b>, favor informar ao administrador`, false)
        };
        this.onSuccess = options?.onSuccess != undefined ? options.onSuccess : ()=>{}; // Funcao a ser executada em caso de successo (apos popular elemento)
        this.then = options?.then != undefined ? options.then : ()=>{}; // Funcao a ser executada ao concluir (indiferente de sucesso ou erro)
        this.reload();
    }
    reload(){ // Consulta e carrega registros no select
        if(!this.beforeRequest()){return false}
        this.target.innerHTML = ''; // Limpa conteudo atual
        let xhttp = new XMLHttpRequest();
        let instance = this; // Cria alias para instancia para ser acessado dentro do ajax
        xhttp.onreadystatechange = function() {
            if(this.readyState == 4 && this.status == 200){
                if(this.responseText == ''){instance.onError()}
                else if(this.responseText == '[]'){instance.onEmpty()}
                else{
                    instance.data = JSON.parse(this.responseText);
                    if(instance.emptyRow){instance.target.innerHTML = `<option value="${instance.emptyRowValue}">${instance.emptyRowText}</option>`}
                    for(let i in instance.data){instance.target.innerHTML += `<option value="${instance.data[i][instance.key]}">${instance.data[i][instance.value]}</option>`;}
                    instance.onSuccess();
                }
                instance.then(); // Funcao a ser executada indiferente se retornado dados do servidor
            }
        };
        xhttp.open(instance.method, instance.url + instance.params, true);
        xhttp.send();
    }

}



// Configuracoes / Listeners ao carregar pagina
// **
// Evita tabulação em elementos select com classe readonly
document.querySelectorAll('select.readonly').forEach((e) => {e.tabIndex = -1});

// Adiciona eventos auxiliares a input:date ([t => today()], [+ currentday + 1], [- currentday - 1])
// para desativar, crie variavel (ANTES DE INSERIR lib) dateExtra e atribua valor false. Ex: var dateExtra = false;
if(typeof dateExtra == 'undefined' || dateExtra == true){
    document.querySelectorAll('input[type=date]').forEach((el) => {
        el.onkeydown = (e) => {
            if(e.key == 't'){el.value = dateToday({native:true})} // Precionado a letra T, carrega data atual
            else{
                if(!['-', '+'].includes(e.key)){return} // Se nao for teclas - ou + encerra bloco
                let current = Date.parse(el.value + ' 00:00') ? new Date(el.value + ' 00:00') : new Date();
                if(e.key == '-'){ // Precionado -
                    current.setDate(current.getDate() - 1);
                    el.value = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2,'0')}-${String(current.getDate()).padStart(2, '0')}`;
                }
                if(e.key == '+'){ // Precionado +
                    current.setDate(current.getDate() + 1);
                    el.value = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2,'0')}-${String(current.getDate()).padStart(2, '0')}`;
                }
            }
        }
    });
}
