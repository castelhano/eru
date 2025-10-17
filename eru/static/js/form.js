/*
* jsForm    Implementa operacoes com formularios (validacao, conversao, busca via ajax, etc)
*
* @version  1.9
* @since    03/06/2023
* @release  22/08/2024 [add beforeSubmit, add data-formDefault]
* @author   Rafael Gustavo Alves {@email castelhano.rafael@gmail.com }
* @example  const form = new jsForm(document.getElementById('my_form'), {});
*/

class jsForm{
    constructor(form, options){
        this.form = form;
        this.common = []; // Lista vai armazenar os fields comuns (sem maskara)
        this.imask = options?.imask || []; // Lista elementos Imask presentes no form
        this.imaskFieldNames = []; // Lista com nomes dos elementos Imask
        this.defaultOptions = {
            selectPopulate: [],                         // Lista com selects para preenchimento via ajax
            multipleAddon: [],                          // Adiciona controle para entrada multipla (cria um select)
            selectAddAllOption: [],                     // Adiciona opcao 'Todos' nos selects informados [{nome: 'empresa', value: '', desc: 'Todas', i18n: 'foo.bar'}] apenas opcao 'nome' obrigatoria
            beforeSubmit: () => { return true },        // Funcao a ser chamada antes de submeter form, deve retornar true ou false
            customValidation: {},                       // [**] detalhes abaixo
            novalidate: false,                          // Setar {novalidate: true} para desativar validacao do formulario
            modalBody: null,                            // Usar (modalBody: container) para criacao de modal (bootstrap modal) de filtros
            modalTrigger: null,                         // Elemento acionador do modal
            modalFocus: null,                           // Elemento html a receber foco ao abrir modal
        }
        // ** customValidation deve ser um dicionario com a chave = nome do campo e o valor funcao que fara validacao
        // ** deve retornar um array com a primeira posicao o resultado (true ou false) e na segunda (opcional) texto de orientacao 
        for(let k in this.defaultOptions){ // carrega configuracoes para classe
            if(options.hasOwnProperty(k)){this[k] = options[k]}
            else{this[k] = this.defaultOptions[k]}
        }

        this.imask.forEach((el)=>{ // Carrega list com nomes dos imaskFields
            this.imaskFieldNames.push(el.el.input.name); // Popula list com names dos campos imask
        })
        for(let i = 0; i < this.form.elements.length; i++){
        // Carrega list dos elementos do form comuns (sem mascara) alem de liberar acesso dos elementos como instance.field_name (ex. form.cpf)
            if(this.form.elements[i]?.name){this[this.form.elements[i].name] = this.form.elements[i];}
            if(this.imaskFieldNames.includes(this.form.elements[i].name)){continue}
            this.common.push(this.form.elements[i]);
        }
        this.multipleAddon.forEach((el)=>{ // multipleAddon pode ser array com campos ['matricula','cpf'] ou json [{field: 'matricula', shortcut: 'f5', ...}]
            if(typeof el == 'string'){ // se for string, cria componente com configuracoes padrao
                if(!this.hasOwnProperty(el)){return}
                this[el].multipleAddon = new MultipleAddon(this[el])
            }
            else if(typeof el == 'object'){ // se dicionario repassa configuracoes para construtor
                if(!this.hasOwnProperty(el.field)){return}
                this[el.field].multipleAddon = new MultipleAddon(this[el.field], el);
            }
        })
        for(let i = 0;i < this.selectPopulate.length; i++){ // Busca (ajax) dados e preenche select
            // Salva instancia no attr [selectpolulate] no elemento. Ex.: form.empresa.selectPopulate.update();
            this[this.selectPopulate[i].target.name].selectPopulate = new selectPopulate(this.selectPopulate[i]);
        }
        if(!this.novalidate){
            this.form.setAttribute('novalidate', null); // Desativa validacao nativa do navegador
            this.form.onsubmit = ()=>{ // Chama funcao de validacao ao submeter form
                if(this.validate()){return this.beforeSubmit()} // Se passou na validacao, chama funcao beforeSubmit
                return false;
            };
            this.__imaskValidate(); // Adiciona validacao para elementos imask
            this.__validateListeners(); // Adiciona listeners (onblur) nos fields
        }
        else { // Roda metodo antes de submeter form
            this.form.onsubmit = ()=>{return this.beforeSubmit()};
        }
        this.__selectAddAllOption();
        if(this.modalBody){
            this.__createModalFilter();
        }
    }
    load(data, ignore=[]){ // Metodo carrega dados no form, deve recebe um dicionario. Ex. form.load({nome: 'Maria', idade: 25}) 
        this.imask.forEach((el)=>{ // Ajusta elementos imask
            if(data.hasOwnProperty(el.el.input.name)){el.value = data[el.el.input.name]}; // Carrega valores ajustados em campos imask
        })
        for(let key in data){ // Carrega demais valores do dicionario
            if(!ignore.includes(key) && !this.imaskFieldNames.includes(key)){try{this.form.querySelector(`#id_${key}`).value = data[key]}catch(e){}}
        }

    }
    get(field){ // Retorna valor do campo especificado ou na omissao dicionario com todos os campos do form
        let formData = new FormData(this.form);
        if(field){
            if(this[field].type == 'select-multiple'){
                return Array.from(this[field].options).filter(function (option) { return option.selected; }).map(function (option) {return option.value});
            }
            return formData.get(field)
        }
        let resp = {};
        for(let [key, value] of formData){resp[key] = value}
        this.form.querySelectorAll('select[multiple]').forEach((el)=>{ // se existe select multiple no form, Formdata retorna apenas um dos valores selecionados
            resp[el.name] = Array.from(el.options).filter(function (option) { return option.selected; }).map(function (option) {return option.value});
        })
        return resp;
    }
    disabled(fields){ // Recebe array com nome dos campos a serem desabilitados
        if(fields){
            for(let i in fields){
                try {
                    let field = this.form.querySelector(`#id_${fields[i]}`);
                    if(field instanceof HTMLElement && field.getAttribute('data-jsform') == 'always_enable'){continue;} // Para habilitar um controle num form disabled adicione o attr data-jsform='always_enable'
                    if(['INPUT','TEXTAREA','BUTTON'].includes(field.tagName)){
                        field.disabled = true;
                        if(field.type == 'file'){
                            try{ // Django input#files adiciona controle para limpar campo, também desabilita controle 
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
                if(['INPUT','TEXTAREA','BUTTON'].includes(this.form.elements[i].tagName)){
                    this.form.elements[i].disabled = true;
                    if(this.form.elements[i].type == 'file'){
                        try{ // Django input#files adiciona controle para limpar campo, também desabilita controle 
                            this.form.querySelector(`#${this.form.elements[i].name}-clear_id`).disabled = true;                                
                        }catch(e){}
                    }   
                }
                else if(this.form.elements[i].tagName == 'SELECT'){this.form.elements[i].classList.add('readonly');this.form.elements[i].tabIndex = -1;}
            }
        }
    }
    // Recebe array com nome dos campos a serem marcados como readonly, alguns elementos nao tem attr readonly, 
    // nestes casos usa script bostrap para classe readonly
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
    __validateRequired(el, notify=true){
        let max = el.getAttribute('maxlength');
        let min = el.getAttribute('minlength');
        if(max && el.value.length > el.maxLength || min && el.value.length < el.minLength){
            el.classList.add('is-invalid');
            if(notify && max && min){appNotify('warning', `jsform: <b>${el.name}</b> deve ter entre ${el.minLength} e ${el.maxLength} caracteres`, {autodismiss: false})}
            else if(notify && max || notify && min){appNotify('warning', `jsform: <b>${el.name}</b> deve ter no ${max ? 'máximo' : 'mínimo'} ${max ? el.maxLength : el.minLength} caracteres`, {autodismiss: false})}
        }
        else if(el.required && el.value == ''){
            el.classList.add('is-invalid');
            if(notify){appNotify('warning', `jsform: O campo <b>${el.name}</b> é obrigatório`, {autodismiss: false})}
        }
        else{el.classList.remove('is-invalid')}
    }
    __validateNumber(el, notify=true){
        let max = parseFloat(el.getAttribute('max')) || null;
        let min = parseFloat(el.getAttribute('min')) || null;
        if(max && parseFloat(el.value) > max || min && parseFloat(el.value) < min){
            el.classList.add('is-invalid');
            if(notify && max && min){appNotify('warning', `jsform: <b>${el.name}</b> deve ser entre ${min} e ${max}`, {autodismiss: false})}
            else if(notify && max || notify && min){appNotify('warning', `jsform: <b>${el.name}</b> deve ser no ${max ? 'máximo' : 'mínimo'} ${max ? max : min}`, {autodismiss: false})}
            
        }
        else if(el.required && el.value == ''){el.classList.add('is-invalid');}
        else{el.classList.remove('is-invalid')}
    }
    __validateEmail(el, notify=true){
        if(el.value != '' && !this.__emailIsValid(el.value) || el.value == '' && el.required){
            el.classList.add('is-invalid');
            if(notify){appNotify('warning', 'jsform: <b>Email</b> tem formato inválido', {autodismiss: false})}
        }
        else{el.classList.remove('is-invalid')}
    }
    __emailIsValid(email){
        return /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(email)
    }
    __selectAddAllOption(){
        this.selectAddAllOption.forEach((el)=>{
            try{
                let opt = document.createElement('option');
                opt.value = el?.value || '';
                if(el?.i18n){
                    opt.innerHTML = i18n.getEntry(el.i18n) || el?.desc || 'Todos';
                    opt.setAttribute('data-i18n', el.i18n);
                }
                else{opt.innerHTML = el?.desc || 'Todos';}
                this[el.nome].insertBefore(opt, this[el.nome].firstChild);
                this[el.nome].value = opt.value;
            }catch(err){
                console.log(`jsForm: [selectAddAllOption] Erro ao criar 'option', verificque o valor informado [{nome: 'meuCampo'}] campo 'nome' necessario.`);
            }            
        })
    }
    __createModalFilter(){ // se definido modal nas opcoes, cria bootstrap modal
        let modalContainer = document.createElement('div'); modalContainer.classList = 'modal fade'; modalContainer.tabIndex = '-1';
        let modalDialog = document.createElement('div'); modalDialog.classList = 'modal-dialog modal-fullscreen';
        let modalContent = document.createElement('div'); modalContent.classList = 'modal-content';
        let modalBody = document.createElement('div'); modalBody.classList = 'modal-body';
        let modalTitle = document.createElement('h5'); modalTitle.setAttribute('data-i18n', 'sys.filterQuery');modalTitle.innerHTML = 'Filtrar Consulta';
        let separator = document.createElement('hr');
        let modalFooter = document.createElement('div'); modalFooter.classList = 'modal-footer';
        let cancel = document.createElement('button'); cancel.type = 'button'; cancel.classList = 'btn btn-sm btn-secondary'; cancel.setAttribute('data-bs-dismiss', "modal"); cancel.setAttribute('data-i18n', "common.cancel"); cancel.innerHTML = 'Cancelar';
        let confirm = document.createElement('button'); confirm.type = 'submit'; confirm.classList = 'btn btn-sm btn-primary'; confirm.setAttribute('data-i18n', "common.confirm");confirm.setAttribute('data-i18n-bold', "c"); confirm.innerHTML = '<b>C</b>onfirmar';
        // *******
        modalFooter.appendChild(cancel);
        modalFooter.appendChild(confirm);
        modalBody.appendChild(modalTitle);
        modalBody.appendChild(separator);
        modalBody.appendChild(this.modalBody); // conteudo do forma repassado ao instanciar form
        modalContent.appendChild(modalBody);
        modalContent.appendChild(modalFooter);
        modalDialog.appendChild(modalContent);
        modalContainer.appendChild(modalDialog);
        document.body.appendChild(modalContainer);
        this.modal = new bootstrap.Modal(modalContainer, {});
        if(this.modalFocus){
            modalContainer.addEventListener('shown.bs.modal', () => { this.modalFocus.focus()})
            modalContainer.addEventListener('hide.bs.modal', () => { this.modalFocus.focus(), appKeyMap.setContext();})
        }
        if(this.modalTrigger){
            this.modalTrigger.addEventListener('click', () => { 
                this.modal.show();
                appKeyMap.setContext('filterModal');
            })
        }
        this.modalBody.style.display = 'block'; // Recomendado setar o body na pagina como display = none, aqui voltamos a exibir elemento
    }
    validate(){ // Metodo faz validacao para os campos do form
        cleanNotify(); // Limpa area de notificacao
        // Valida status required, maxlength e minlength
        this.form.querySelectorAll('[required]:not([data-form=novalidate]):not([type=number]):not([type=email]),[minlength]:not([data-form=novalidate]):not([type=email]),[maxlength]:not([data-form=novalidate]):not([type=email])').forEach((el)=>{
            if(this.customValidation.hasOwnProperty(el.name)){return}; this.__validateRequired(el);})

        // Valida inputs NUMBER quanto ao MIN e MAX e required
        this.form.querySelectorAll('input[type=number]:not([data-form=novalidate])').forEach((el)=>{if(this.customValidation.hasOwnProperty(el.name)){return};this.__validateNumber(el)})

        // Valida email fields
        this.form.querySelectorAll('input[type=email]:not([data-form=novalidate])').forEach((el)=>{if(this.customValidation.hasOwnProperty(el.name)){return};this.__validateEmail(el);})

        // Verifica se existe validacao adicional na pagina de origem
        for(let i in this.customValidation){
            try {
                let el = this.form.querySelector(`#id_${i}`);
                let resp = this.customValidation[i](el.value);
                if(!resp[0]){
                    el.classList.add('is-invalid');
                    if(resp[1]){
                        appNotify('warning', `jsform: ${resp[1]}`, {autodismiss: false});
                    }
                }
                else{el.classList.remove('is-invalid')}
            } catch (e){
                console.log(`jsform: ERRO customValidation para ${i} inválido, verifique dados informados`);
                console.log(`Deve existir no form field com ID id_${i}, e retorno deve ser um array, ex: [false, 'Texto de ajuda'] ou [true]`);
            }
        }

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
        // appAlert('warning', '<b>jsform</b>: Existem campo(s) inválidos, corriga antes de prosseguir');
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
    __validateListeners(){ // Adiciona validacao (alem de demais comportamentos ao perder o foco) nos campos do form baseado em criterios pre definidos
        // Adiciona validacao para input com required, maxlength e minlength
        this.form.querySelectorAll('[required]:not([data-form=novalidate]):not([type=number]):not([type=email]),[minlength]:not([data-form=novalidate]):not([type=email]),[maxlength]:not([data-form=novalidate]):not([type=email])').forEach((el)=>{
            if(this.customValidation.hasOwnProperty(el.name)){return}
            el.onblur = () => {this.__validateRequired(el, false)}
        })
        // Adiciona validacao para input number com max ou min e required
        this.form.querySelectorAll('input[type=number][min]:not([data-form=novalidate]), input[type=number][max]:not([data-form=novalidate])').forEach((el)=>{
            if(this.customValidation.hasOwnProperty(el.name)){return}
            el.onblur = () => {this.__validateNumber(el, false)}  
        })
        // Adiciona validacao para input email
        this.form.querySelectorAll('input[type=email]:not([data-form=novalidate])').forEach((el)=>{
            if(this.customValidation.hasOwnProperty(el.name)){return}
            el.onblur = () => {this.__validateEmail(el, false)}
        })
        // Adiciona valor padrao para inputs com data-form-default
        this.form.querySelectorAll('input[data-formDefault]').forEach((el)=>{
            if(this.customValidation.hasOwnProperty(el.name)){return}
            el.onblur = () => {if([undefined, ''].includes(el.value)){el.value = el.dataset.formdefault}}
        })
    }
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
        if(!options.target || !options.url){console.log('selectPopulate: target e url sao obrigatórios');return false}
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
            this.target.innerHTML = `<span>${this.emptyMessage}</span>`;
        };
        this.onError = options?.onError != undefined ? options.onError : ()=>{ 
            this.target.innerHTML = `<option selected disabled>${this.emptyMessage}</option>`;
            appNotify('danger', `jsform: Erro ao carregar <b>${this.target.name}</b>, favor informar ao administrador`, {autodismiss: false})
        };
        this.onSuccess = options?.onSuccess != undefined ? options.onSuccess : ()=>{}; // Funcao a ser executada em caso de successo (apos popular elemento)
        this.then = options?.then != undefined ? ()=>{options.then(this.data)} : ()=>{}; // Funcao a ser executada ao concluir (indiferente de sucesso ou erro)
        if(!options?.wait){this.reload()} // Preenche select ao carregar componente, para nao buscar ao carregar defina {wait: true}
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

class MultipleAddon{
    constructor(el, options={}){
        this.list = [];
        const defaultOptions = {
            text: '<i class="bi bi-list-ul">',
            badgeClasslist: 'badge bg-dark',
            btnClasslist: 'btn btn-secondary',
            btnTitle: 'Entrada multipla',
            dialogClasslist: 'border rounded p-1 text-end bg-body-tertiary',
            dialogWidth: '150px',
            textareaClasslist: 'form-control mb-2',
            textareaRows: 6,
            confirmButtonClasslist: 'btn btn-sm btn-primary border-0',
            confirmButtonText: 'Salvar',
            shortcut: 'f2',
            marginTop: 3,
            container: el.parentElement,
            groupContainerClasslist: 'input-group',
            max: 999,
            el: el
        }
        for(let key in defaultOptions){     // Carrega configuracoes informadas ao instanciar objeto ou de defaultOptions se omitido
            this[key] = options.hasOwnProperty(key) ? options[key] : defaultOptions[key];
        }
        this._build();
    }
    _build(){
        this.select = document.createElement('select');this.select.multiple = true;this.select.style.display = 'none';this.select.name = `${this.el.name}_multiple`;
        this.dialog = document.createElement('dialog');this.dialog.classList = this.dialogClasslist;this.dialog.style.margin = '0px';this.dialog.style.zIndex = '10';
        this.dialog.style.width = this.dialogWidth;
        this.textarea = document.createElement('textarea');this.textarea.classList = this.textareaClasslist;this.textarea.rows = this.textareaRows;
        this.textarea.addEventListener('keydown', (ev)=>{
            if(ev.key === 'Escape'){this.el.focus();this.dialog.close();}
            else if(ev.key === 'Enter' && ev.altKey){this.confirmButton.click();ev.preventDefault();}
        })
        this.confirmButton = document.createElement('button');this.confirmButton.type = 'button';this.confirmButton.classList = this.confirmButtonClasslist;this.confirmButton.innerHTML = this.confirmButtonText;this.confirmButton.title = 'Alt+Enter'
        this.confirmButton.onclick = ()=>{
            this.select.innerHTML = '';
            this.list = [];
            let count = 0;
            this.textarea.value.trim().split('\n').filter(n => n).every((el, index)=>{
                if(count == this.max){
                    this.textarea.value = this.list.join('\n'); // atualiza o textarea somente com os valores aceitos
                    appNotify('warning', `jsForm: Campo <b>${this.el.name}</b> Máximo de <b>${this.max}</b> registros`, {autodismiss: false})
                    return false
                }
                let opt = document.createElement('option'); opt.value = el; opt.selected = true;
                this.select.appendChild(opt);
                count += 1;
                this.list.push(el);
                return true;
            })
            if(count > 0){
                this.btn.innerHTML = `<span class="${this.badgeClasslist}">${count}</span>`;
                this.el.value = '';
                this.el.readOnly = true;
            }
            else{
                this.btn.innerHTML = this.text;
                this.el.readOnly = false;
                this.el.focus();
            }
            this.dialog.close();

        }
        this.dialog.appendChild(this.textarea);
        this.dialog.appendChild(this.confirmButton);
        this.dialog.appendChild(this.select);
        // **
        if(this.shortcut){ // adiciona shortcut quando foco estiver no input
            this.el.addEventListener('keydown', (ev)=>{
                if(ev.key.toLowerCase() === this.shortcut){this.btn.click(); ev.preventDefault();}
            })
        }
        this.btn = document.createElement('button');this.btn.type = 'button';this.btn.classList = this.btnClasslist;this.btn.title = `${this.btnTitle} ${this.shortcut ? ' [ ' + this.shortcut.toUpperCase() + ' ]' : ''}`;this.btn.tabIndex = '-1';this.btn.innerHTML = this.text;
        this.btn.onclick = ()=>{
            if(this.dialog.open){this.dialog.close()}
            else{this.dialog.show()}
        }
        let groupContainer = document.createElement('div'); groupContainer.classList = this.groupContainerClasslist;
        // carrega componente junto ao controle original, usa classes de input-group do bootstrap
        if(this.container.classList.contains('form-floating') && this.container.parentNode.classList.contains('row')){
        /** row
         *  ** form-floating col
         *  **** input
         */
            let col = document.createElement('div');
            let addClass = this.container.classList.value.replace('form-floating', '').trim().split(' ');
            addClass.forEach((e)=>{
                this.container.classList.remove(e);
                col.classList.add(e);
            })
            // se definido maxWidth no container, remove stilo e aplica max widht no col
            if(this.container.style.maxWidth != ''){
                col.style.maxWidth = this.container.style.maxWidth;
                this.container.style.maxWidth = '';
            }
            this.container.before(col);
            col.appendChild(groupContainer);
            col.appendChild(this.dialog);
            groupContainer.appendChild(this.container);
            groupContainer.appendChild(this.btn);
        }
        else{}
        // ajusta posicionamento do dialog abaixo do controle (alinhado a direita)
        let rect = this.btn.getBoundingClientRect();
        let left = this.el.getBoundingClientRect().left;
        this.dialog.style.top = (parseInt(rect.bottom) + this.marginTop) + 'px';
        this.dialog.style.left = Math.max(parseInt(rect.right) - parseInt(this.dialog.style.width), left) + 'px';
    }
    get(){return this.list}
}

// Configuracoes / Listeners ao carregar pagina
window.addEventListener('load', ()=>{
    // Evita tabulacao em elementos select com classe readonly
    document.querySelectorAll('select.readonly').forEach((e) => {e.tabIndex = -1});
    
    // Adiciona eventos auxiliares a input:date ([t => today()], [+ currentday + 1], [- currentday - 1])
    // para desativar, crie variavel jsForm_dateExtra e atribua valor false. Ex: var jsForm_dateExtra = false;
    if(typeof jsForm_dateExtra == 'undefined' || jsForm_dateExtra == true){
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
})
