/*
* jsSelectm   Implementa controle para select multiple
*
* @version  2.0
* @since    03/02/2023
* @release  25/10/2025 [refactor]
* @author   Rafael Gustavo Alves {@email castelhano.rafael@gmail.com}
* @depend   boostrap 5.x, bootsrap icons
*/
class jsSelectm{
    constructor(el, options){
        this.select = typeof el === 'string' ? document.querySelector(el) : el;
        // this.select.style.display = 'none'; // oculta select original
        // Configuracoes
        this.defaults = {
            options: {},                                               // Options do select, dicionario {1: 'Ativo', 2: 'Afastado'} na omissao constroi options do elemento
            selected: [],                                              // Opcoes pre selecionadas ao instanciar objeto
            groups: false,                                             // Informa grupos com respectivos valores ex: {grupoA: [1,4], grupoB: [2]}
            title: false,                                              // Titulo do select
            icon: false,                                               // Se informado sera inserido icone ao lado do titulo
            onchange: () => {return true},                             // Funcao a ser chamada ao alterar componente
            disabled: false,                                           // Se true desativa operacoes nos eventos click e altera formatacao
            checkAll: true,                                            // Se true sera adicionado controle para marcar todas as opcoes
            canFilter: false,                                          // Se true adiciona input para filtrar opcoes
            filterOpions: {},                                          // Opcoes para o input#search
            placeholder: 'Pesquisa',                                   // Placeholder do search input para filtrar opcoes
            emptyMessage: '<p class="text-body-secondary fs-7">Nenhuma opcão disponivel</p>',
            sort: false,                                                // Se true reordena opcoes baseado no innerText
        }
        this.config = { ...this.defaults, ...options };
        this.config.styles = { ...this._getDefaultStyles(), ...options?.styles || {}};
        this.config.classlist = { ...this._getDefaultClasslist(), ...options?.classlist || {}};
        //--
        this.options = this.config.options;     // apontador para config.options, options armazena stado inicial dos elementos
        this.groups = this.config.groups;       // apontador para config.groups
        this.selected = this.config.selected;   // apontador para config.selected
        //--
        this._init();
    }
    _init() {
        this._addPseudoClass();                // adiciona pseudo classes para componentes
        if(Object.keys(this.options) == 0){        // se opcoes nao informadas ao instanciar objeto, constroi opcoes a partir do select
            let result = this._initOptions();      // monta modelo de opcoes a partir das options do select informado 
            this.options = result.options;
            this.selected = result.selected;
        }
        // Cria this.model, extrutura que armazena apontadores para todos os elementos criados
        if(Object.keys(this.options).length == 0){ this.config.disabled = true }
        this.model = this._buildModel();
        if(this.groups){
            if(this.config.checkAll){ // adiciona controle de marcar todos para cada grupo
                for(let group in this.model.groups){
                    this._checkAllUpdateStatus(this._containerGetState(this.model.groups[group].wrapper) , this.model.groups[group].checkAll);
                    if(this.config.disabled){ this.model.groups[group].checkAll.container.classList.add('disabled') }
                    if(this.config.sort){ this._sort(this.model.groups[group].wrapper) }
                }
            }
        }
        else{
            if(this.config.checkAll){ // adiciona controle marcar todos ao container principal
                this._checkAllUpdateStatus(this._containerGetState(this.model.wrapper) , this.model.checkAll);
                if(this.config.disabled){
                    this.model.checkAll.container.classList.add('disabled');
                }
            }
            if(this.config.sort){ this._sort(this.model.wrapper) }
        }
        
        // -- Adiciona componente no DOM
        this.select.after(this.model.wrapper);
    }
    // Metodos de estilizacao 
    _getDefaultStyles(){
        return {
            wrapper: 'position:relative;border: 1px solid var(--bs-border-color);border-radius: 0.375rem;padding: 0.375rem 0.875rem 0.475rem 0.75rem;',
            container: 'max-height:230px; overflow-y: scroll;',
            option: 'padding: 2px 5px; border-radius: 3px;',
            selected: 'background-color: rgba(25, 135, 84, 0.25)!important;',
            titleContainer: '',
            title: '',
            icon: 'margin-right: 5px;margin-left: 5px;',
            input: 'outline: none; color: var(--bs-body-color); width: 99%;',
            groupInput: 'outline: none; color: var(--bs-body-color); width: 100%!important;padding-left: 10px;',
            checkAll: 'padding: 2px 5px;',
            checkAllText: '',
        }
    }
    _getDefaultClasslist(){
        return {
            wrapper: 'selectm-wrapper',
            container: '',
            option: 'selectm-option',
            titleContainer: '',
            title: 'fs-5 text-body-secondary',
            icon: '',
            input: 'border-0 border-bottom rounded-top bg-body py-1 mb-1',
            groupInput: 'border-0 border-bottom rounded-top bg-body py-1 mb-1',
            checkAll: 'pointer user-select-none',
            checkAllText: 'text-body-tertiary',
            uncheck: 'bi bi-square me-2',
            check: 'bi bi-check-square-fill me-2',
            partial: 'bi bi-dash-square me-2',
        }
    }
    _addPseudoClass(){
        let style = document.createElement('style');
        style.innerHTML = '.selectm-wrapper.disabled{background-color: #E9ECEF;}';
        style.innerHTML += '[data-bs-theme="dark"] .selectm-wrapper.disabled{background-color: #393939;}';
        style.innerHTML += '[data-role="checkAll"].disabled{cursor: default; font-style: italic;}';
        style.innerHTML += '.selectm-option[data-selected]{background-color: rgba(25, 135, 84, 0.25)!important;}';
        style.innerHTML += '@media(min-width: 992px){.selectm-option:hover {cursor: pointer; background-color: var(--bs-secondary-bg);}}';
        document.getElementsByTagName('head')[0].appendChild(style);
    }
    
    // Metodos de manipulacao de estado
    _optionSwitch(el, state=null, updatecheckAll=true){
        // recebe elemento data-role=option e altera estado, se nao informado state (true ou false) inverte estado do elemento
        let opt = el.dataset?.group ? this.model.groups[el.dataset.group].options[el.dataset.value] : this.model.options[el.dataset.value];
        let htmlOpt = this.options[el.dataset.value];
        let newState = state != null ? state : opt.selected ? false : true;
        opt.selected = newState;     // atualiza modelo em memoria
        if(!newState){
            el.removeAttribute('data-selected'); // atualiza componente
            htmlOpt.el.selected = false; // atualiza elemento html original
            let index = this.selected.indexOf(el.dataset.value);
            if(index > -1){ this.selected.splice(index, 1) }
            opt.icon.classList = this.config.classlist.uncheck;
        }
        else{
            el.setAttribute('data-selected', '');
            htmlOpt.el.selected = true; // atualiza elemento html original
            this.selected.push(el.dataset.value);
            opt.icon.classList = this.config.classlist.check;
        }
        // atualiza contole de marcar todos
        if(updatecheckAll && opt.container.dataset?.remain != 'true'){ // atualiza checkAll
            let modelTarget = opt.container.dataset?.group ? this.model.groups[opt.container.dataset.group] : this.model;
            this._checkAllUpdateStatus(this._containerGetState(modelTarget.wrapper), opt.container.dataset?.group ? this.model.groups[opt.container.dataset.group].checkAll : this.model.checkAll);
        }
    }
    _checkAllUpdateStatus(state, checkAll){ // atualiza informacoes (icone, descricao e status) do controle de marcar todos
        if(state == 'none'){
            checkAll.text.innerHTML = 'Marcar todos'
            checkAll.container.removeAttribute('data-checked');
            checkAll.icon.classList = this.config.classlist.uncheck;
            checkAll.state = 'uncheck';
        }
        else{
            if(state == 'all'){ 
                checkAll.icon.classList = this.config.classlist.check;
                checkAll.state = 'check';
            }
            else{ 
                checkAll.icon.classList = this.config.classlist.partial;
                checkAll.state = 'partial';
             }
            checkAll.text.innerHTML = 'Desmarcar todos';
            checkAll.container.setAttribute('data-checked', '');   
        }
    }
    _checkAllSwitch(checkAll){
        if(checkAll.state == 'check' || checkAll.state == 'partial'){ // desmarca todas as opcoes
            checkAll.container.parentNode.querySelectorAll('[data-value][data-selected]:not(.d-none)').forEach((el)=>{
                this._optionSwitch(el, false, false); // desmarca option sem ajustar o checkAll
            })
        }
        else{ // marca todas as opcoes
            checkAll.container.parentNode.querySelectorAll('[data-value]:not([data-selected]):not(.d-none)').forEach((el)=>{
                this._optionSwitch(el, true, false); // marca option sem ajustar o checkAll
            })
        }
        this._checkAllUpdateStatus(this._containerGetState(checkAll.container.parentNode), checkAll) // atualiza checkAll ao final
    }
    _containerGetState(container){ // retorna all, none ou partial, baseado na quantidade de opcoes selecionadasno container
        let total = container.querySelectorAll('[data-value]').length;
        let selected = container.querySelectorAll('[data-value][data-selected]').length;
        return selected == 0 ? 'none' : selected == total ? 'all' : 'partial';
    }
    
    // Metodos de manipulacão de opcoes
    _initOptions(){ // para selects contruidos no template, carrega opcoes no modelo
        let options = {};
        let selected = [];
        this.select.querySelectorAll('option').forEach((el) => {
            let opt = {}
            for(let attr of el.attributes){opt[attr.name] = attr.value}
            opt.el = el;
            opt.text = el.innerText; 
            opt.selected = el.selected
            options[el.value] = opt;
            if(el.selected){selected.push(el.value)}
        });
        return {options: options, selected: selected}

    }
    addOption(option) {
        if(!option?.value){console.log('jsSelectm: Option require at least "value"'); return;}
        if(this.options[option.value]){console.log('jsSelectm: Option value duplicated'); return;}
        
        let opt = this._addOption(option);      // cria extrutura do option para this.model
        let el = document.createElement('option');
        el.value = option.value;
        el.innerHTML = option?.['data-i18n'] ? i18n.getEntry(option['data-i18n']) || option?.text || '' : option?.text || '';
        el.selected = option.selected == true;
        this.select.appendChild(el);
        //--
        this.options[option.value] = {...option, ...{el: el}};      // adiciona option na lista geral de opcoes
        if(option.selected){ this.selected.push(String(option.value)) };    // adiciona em this.selected
        if(option?.group){}
        else{
            this.model.options[option.value] = opt;
            this.model.wrapper.appendChild(opt.container);
            if(this.groups){ opt.container.setAttribute('data-remain', 'true') }
            else if(this.config.sort){this._sort(this.model.wrapper)}
        }
    }
    _sort(wrapper){
        let items = [...wrapper.querySelectorAll('[data-value]')];
        // para sort usamos document.fragment para otimizar desempenho evitando reescrita no DOM
        let fragment = document.createDocumentFragment();
        items.sort((a, b) => a.innerText.localeCompare(b.innerText));
        items.forEach(el => fragment.appendChild(el));
        wrapper.appendChild(fragment);
    }
    _buildModel(){ // constroi base do componente e insere na pagina, retorna escopo do modelo com apontadores
        let model = {};
        model.wrapper = document.createElement('div');
        model.wrapper.style = this.config.styles.wrapper;
        model.wrapper.classList = this.config.styles.classlist;
        model.wrapper.setAttribute('data-role', 'wrapper');
        model.wrapper.addEventListener('click', (ev)=>{this._handleOnclick(ev)})
        if(this.config.title){ // adiciona titulo para componente
            model.title = this._addTitle();
            model.wrapper.appendChild(model.title);
        }
        if(!this.groups && this.config.canFilter){ // adiciona input para filtrar opcoes
            model.input = this._addSearchInput(this.config.filterOptions)
            model.wrapper.appendChild(model.input)
        }
        if(!this.groups && this.config.checkAll){ // adiciona controle para marca / desmarcar todas as opcoes
            model.checkAll = this._addCheckAll({})
            model.wrapper.appendChild(model.checkAll.container);
        }
        model.options = {};
        model.groups = {};
        // cria accordion para grupos
        model.accordion = document.createElement('div');
        model.accordion.classList = 'accordion my-2';
        model.accordion.setAttribute('data-role','groupsContainer');
        model.wrapper.appendChild(model.accordion);
        
        // armazena indice das opcoes, se restar algum indice nao adicionado em nenhum grupo opcao eh adiciona abaixo dos grupos
        let remainsOptions = Object.keys(this.options); 
        
        // percorre grupos e cria entrada 
        for(let group in this.groups){ 
            let g = this._addGroup(group, this.groups[group], model); 
            this.groups[group].forEach((el)=>{ remainsOptions.splice(remainsOptions.indexOf(el), 1) }) // limpa de remainsOptions os itens do grupo
        }
        
        // adiciona options que nao estao associados a nenhum grupo
        remainsOptions.forEach((el)=>{ // cria e adiciona todos os options
            model.options[el] = this._addOption(this.options[el]);    // cria entrada em this.model para option
            model.wrapper.appendChild(model.options[el].container);   // adiciona option no wrapper
            if(this.groups){ model.options[el].container.setAttribute('data-remain', 'true') } // se usando abordagem de grupos, os itens sem grupos sao marcados
        })
        return model;
    }
    _addGroup(name='novo', options=[], model=this.model){ // cria elementos para novo grupo
        model.groups[name] = {}; // inicia extrutura de novo grupo
        let acc_item = document.createElement('div');acc_item.classList = 'accordion-item';
        let acc_header = document.createElement('div');acc_header.classList = 'accordion-header pointer';
        //--
        let acc_button = document.createElement('span');
        acc_button.classList = 'accordion-button collapsed fs-6 py-2';
        acc_button.setAttribute('data-bs-toggle','collapse');
        acc_button.setAttribute('data-bs-target',`[data-groupContainer=${name}]`);
        acc_button.innerHTML = name;
        //--
        model.groups[name].wrapper = document.createElement('div');
        model.groups[name].wrapper.classList = 'accordion-collapse collapse';
        model.groups[name].wrapper.setAttribute('data-groupContainer', name);
        model.groups[name].wrapper.setAttribute('data-bs-parent', '[data-role=groupsContainer]');
        //--
        if(this.config.canFilter){ // adiciona input para filtrar opcoes
            model.groups[name].input = this._addSearchInput(this.config.filterOptions)
            model.groups[name].wrapper.appendChild(model.groups[name].input)
        }
        if(this.config.checkAll){ // adiciona controle para marcar / desmarcar todas as opcoes
            model.groups[name].checkAll = this._addCheckAll({})
            model.groups[name].checkAll.container.setAttribute('data-group', name)
            model.groups[name].wrapper.appendChild(model.groups[name].checkAll.container);
        }
        acc_header.appendChild(acc_button);
        acc_item.appendChild(acc_header);
        acc_item.appendChild(model.groups[name].wrapper);
        model.accordion.appendChild(acc_item);
        // incia entrada para options no modelo
        model.groups[name].options = {};
        // carrega options nos grupos
        this.groups[name].forEach((el)=>{
            model.groups[name].options[el] = this._addOption(this.options[el]);         // cria elemento adiciona entrada no modelo
            model.groups[name].options[el].container.setAttribute('data-group', name);  // adiciona data-group no elemento para identificacao do evento click
            model.groups[name].wrapper.appendChild(model.groups[name].options[el].container);
        })
        return model.groups[name]
    }
    _addOption(config){ // cria elemento que representa uma <option> para componente
        let container = document.createElement('div');
        container.classList = this.config.classlist.option; 
        container.style = this.config.styles.option;
        container.setAttribute('data-role', 'option')
        container.setAttribute('data-value', config.value)
        let icon = document.createElement('i');
        let text = document.createElement('span');
        let result = {
            container: container,
            icon: icon,
            text: text,
            selected: config.selected == true
        };
        
        ['data-i18n', 'data-i18n-target', 'data-i18n-transform', 'data-i18n-bold'].forEach((el)=>{
            if(config?.[el]){
                result[el] = config[el];
                text.setAttribute(el, config[el]);
            }
        })
        if(config?.selected){
            container.setAttribute('data-selected', '');
            icon.classList = this.config.classlist.check;
        }
        else{ icon.classList = this.config.classlist.uncheck }
        text.innerHTML = config?.['data-i18n'] ? i18n.getEntry(config['data-i18n']) || config.text : config.text;
        container.appendChild(icon);
        container.appendChild(text);
        return result;
    }
    _addTitle(){ // cria elemento de titulo para componente
        // options pode ser string simples com texto para o titulo ou dicionario ex {innerText: 'texto', 'data-i18n': 'foo', etc: 2}
        let container = document.createElement('div');
        container.style = this.config.styles.titleContainer;
        container.classList = this.config.classlist.titleContainer;
        if(this.config.icon){
            let icon = document.createElement('i');
            icon.classList = this.config.icon;
            icon.style = this.config.styles.icon;
            container.appendChild(icon);
        }
        let text = document.createElement('span');
        text.style = this.config.styles.title;
        text.classList = this.config.classlist.title;
        if(typeof this.config.title == 'string'){text.innerHTML = this.config.title}
        else{ for(let k in options){ text.setAttribute(k, this.config.title[k]) }}
        container.appendChild(text);
        return container;
    }
    _addCheckAll(options={}){ // cria um controle para selecionar todas as opcoes
        let container = document.createElement('div');
        let icon = document.createElement('i');
        let text = document.createElement('span');
        container.setAttribute('data-role', 'checkAll');
        container.style = this.config.styles.checkAll;
        container.classList = this.config.classlist.checkAll;
        text.style = this.config.styles.checkAllText;
        text.classList = this.config.classlist.checkAllText;
        let state = options?.state || 'unckeck';
        icon.classList = state == 'unckeck' ? this.config.classlist.uncheck : state == 'check' ? this.config.classlist.check : this.config.classlist.partial;
        text.innerHTML = state == 'unckeck' ? 'Marcar todos' : 'Desmarcar todos';
        container.appendChild(icon);
        container.appendChild(text);
        return {
            container: container,
            icon: icon,
            text: text,
            state: state
        }
    }
    _addSearchInput(options={}){
        let input = document.createElement('input');
        input.type = 'search';
        ['data-i18n', 'data-i18n-transform', 'data-i18n-target', 'placeholder'].forEach((el)=>{ if(this.config.filterOptions?.[el]) {input.setAttribute(el, this.config.filterOptions[el])} })
        input.style = this.groups ? this.config.styles.groupInput : this.config.styles.input;
        input.classList = this.groups ? this.config.classlist.groupInput : this.config.classlist.input;
        input.oninput = (ev)=>{
            input.parentNode.querySelectorAll('[data-role="option"]').forEach((el)=>{
                if(el.innerText.toLowerCase().includes(input.value.toLowerCase())){el.classList.remove('d-none')}
                else{el.classList.add('d-none')}
            })
        }
        if(this.config.disabled){input.disabled = true}
        return input;
    }
    
    // Metodos para eventos
    _handleOnclick(ev){
        if(this.config.disabled){return} // se componente disabled, nao responde a eventos
        // click disparado do container
        if(ev.target.dataset?.role == 'option'){ this._optionSwitch(ev.target) }
        else if(ev.target.parentNode.dataset?.role == 'option'){ this._optionSwitch(ev.target.parentNode) }
        else if(ev.target.dataset?.role == 'checkAll'){ 
            if(ev.target.dataset?.group){ this._checkAllSwitch(this.model.groups[ev.target.dataset.group].checkAll) }
            else{ this._checkAllSwitch(this.model.checkAll) }
        }
        else if(ev.target.parentNode.dataset?.role == 'checkAll'){ 
            if(ev.target.parentNode.dataset.group){this._checkAllSwitch(this.model.groups[ev.target.parentNode.dataset.group].checkAll) }
            else{ this._checkAllSwitch(this.model.checkAll) }
        }
    }
    onChange(){
        if(typeof this.options.onchange === 'function'){}
    }
    destroy(){}
}