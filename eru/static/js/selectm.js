/*
* jsSelectm   Implementa controle para select multiple
*
* @version  2.4
* @since    03/02/2023
* @release  26/10/2025 [refactor]
* @author   Rafael Gustavo Alves {@email castelhano.rafael@gmail.com}
* @depend   boostrap 5.x, bootsrap icons

TODO: ERRO ao salvar, aparentemente nao esta carregando as opcoes em this.selected dos itens precarragados

Metodo onchange deve encaminhar como elemento array com os options que sofreram modificacao [1,3,8]

*/
class jsSelectm{
    constructor(el, options){
        this.select = typeof el === 'string' ? document.querySelector(el) : el;
        this.select.style.display = 'none'; // oculta select original
        // Configuracoes
        this.defaults = {
            options: {},                                               // Options do select, dicionario {1: {value: 1, text: 'Ativo'}, 2: {value: 2, text: 'Afastado', 'data-group': 'RH'}} na omissao constroi options do elemento
            selected: [],                                              // Opcoes pre selecionadas ao instanciar objeto
            groups: {},                                                // Informa grupos com respectivos valores ex: {grupoA: [1,4], grupoB: [2]}
            title: false,                                              // Titulo do select
            icon: false,                                               // Se informado sera inserido icone ao lado do titulo
            onchange: () => {return true},                             // Funcao a ser chamada ao alterar componente
            disabled: false,                                           // Se true desativa operacoes nos eventos click e altera formatacao
            checkAll: true,                                            // Se true sera adicionado controle para marcar todas as opcoes
            groupCounter: true,                                        // Se true adiciona contador de opcoes somente nas opcoes de grupo
            canFilter: false,                                          // Se true adiciona input para filtrar opcoes
            filterOptions: {                                           // Opcoes para o input#search
                placeholder: i18n ? i18n.getEntry('common.search') || 'Pesquisa' : 'Pesquisa'
            },
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
        this._addPseudoClass();                    // adiciona pseudo classes para componentes
        this._normalizeGroups();                   // ajusta grupos converterndo entradas para string
        if(Object.keys(this.options) == 0){        // se opcoes nao informadas ao instanciar objeto, constroi opcoes a partir do select
            let result = this._initOptions();      // monta modelo de opcoes a partir das options do select informado 
            this.options = result.options;
            this.selected = result.selected;
        }
        else{ // caso options sejam informadas ao instanciar componente, cria options no select original
            for(let opt in this.options){
                let el = document.createElement('option');
                el.value = this.options[opt].value;
                el.innerHTML = this.options[opt]['data-i18n'] ? i18n.getEntry(this.options[opt]['data-i18n']) || this.options[opt].text || '' : this.options[opt].text || '';
                el.selected = this.options[opt].selected == true;
                this.select.appendChild(el);
                this.options[opt].el = el;
            }
        }
        
        // Cria this.model, extrutura que armazena apontadores para todos os elementos criados
        if(Object.keys(this.options).length == 0){ this.config.disabled = true }
        this._normalizeOptions();
        this.model = this._buildModel();
        let summary = this.getSummary();
        if(summary.default.total == 0){ this.model.wrapper.style.display = 'none' }
        this._groupCounterUpdate();
        
        if(this.config.checkAll){ // adiciona controle de marcar todos para cada grupo
            for(let group in this.model.groups){
                this._checkAllUpdateStatus(this._containerGetState(this.model.groups[group].wrapper) , this.model.groups[group].checkAll);
                if(this.config.disabled){ this.model.groups[group].checkAll.container.classList.add('disabled') }
                if(this.config.sort){ this._sort(this.model.groups[group].wrapper) }
            }
            this._checkAllUpdateStatus(this._containerGetState(this.model.wrapper) , this.model.checkAll);
            if(this.config.disabled){ this.model.checkAll.container.classList.add('disabled') }
            if(this.config.sort){ this._sort(this.model.wrapper) }
        }
        // -- Adiciona componente no DOM
        this.select.after(this.model.container);
    }
    _initOptions(){ // para selects contruidos no template, carrega opcoes no modelo
        let options = {};
        let selected = this.selected.length > 0 ? this.selected : [];
        this.select.querySelectorAll('option').forEach((el) => {
            let opt = {}
            for(let attr of el.attributes){opt[attr.name] = attr.value}
            opt.el = el;
            opt.text = el.innerText; 
            opt.selected = el.selected || selected.includes(el.value);
            if(opt.selected != el.selected){el.selected = opt.selected}
            options[el.value] = opt;
            if(el.selected && !selected.includes(el.value)){selected.push(el.value)}
        });
        return {options: options, selected: selected}
    }
    _normalizeOptions(){ 
        this.selected.forEach((el)=>{ 
        // marca options selected=true para os itens em this.selected (caso nao informado ao instanciar elemento)
            this.options[el].selected = true;
            this.select.querySelector(`option[value="${el}"]`).selected = true;
        })
    // ao criar opcoes uzando o metodo _initOptions o atributo data-group pode nao estar informado, padroniza option para grupos
    // tambem trata inclusao no grupo de option inexistente, removendo entrada invalida do group
        for(let grupo in this.groups){
            let toRemove = [];
            this.groups[grupo].forEach((el)=>{
                if(!this.options[el]){toRemove.push(el); return;}
                this.options[el]['data-group'] = grupo;
            })
            toRemove.forEach((el)=>{
                this.groups[grupo].splice(this.groups[grupo].indexOf(el), 1);
                console.log(`jsSelectm: Item "${el}" for group "${grupo}" not found in option, descarted`);
            })
        }
    }
    _normalizeGroups(){ // ao instanciar grupos {groups: [1,5]} necessario converter todas as entradas para string para evitar conflitos de comparacao
        for(let group in this.groups){
            this.groups[group] = this.groups[group].map(item => String(item));
        }
    }
    checkAll(state){ // marca todas as opcoes para o container padrao
        this.model.checkAll.state = state == undefined ? this.model.checkAll.state : state == true ? 'uncheck' : 'check';
        this._checkAllSwitch(this.model.checkAll)
        this.config.onchange({origin: 'checkAll'})
    }
    groupCheckAll(group=undefined, state=undefined){ // marca todas as opcoes para o grupo informado, na omissaomarca todas as opcoes de todos os grupos
        if(typeof group == 'boolean' && state == undefined){ // checkAll para todos os grupos
            state = group;
            group = undefined;
        }
        if(group && !this.groups[group]){return}
        // if(group == undefined && state == undefined){return}
        
        if(group){
            this.model.groups[group].checkAll.state = state == undefined ? this.model.groups[group].checkAll.state : state == true ? 'uncheck' : 'check';
            this._checkAllSwitch(this.model.groups[group].checkAll);
            this._groupCounterUpdate(group);
        }
        else{
            // state = state == true ? 'uncheck' : 'check';
            for(let group in this.groups){ 
                this.model.groups[group].checkAll.state = state == undefined ? this.model.groups[group].checkAll.state : state == true ? 'uncheck' : 'check';
                // this.model.groups[group].checkAll.state = state;
                this._checkAllSwitch(this.model.groups[group].checkAll) ;
                this._groupCounterUpdate(group);
            }
        }
        this.config.onchange({origin: 'groupCheckAll'})
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
    _addSearchInput(options={}, groupContainer=false){
        let input = document.createElement('input');
        input.type = 'search';
        ['data-i18n', 'placeholder'].forEach((el)=>{ if(this.config.filterOptions?.[el]) {input.setAttribute(el, this.config.filterOptions[el])} })
        input.style = groupContainer ? this.config.styles.groupInput : this.config.styles.input;
        input.classList = groupContainer ? this.config.classlist.groupInput : this.config.classlist.input;
        input.oninput = (ev)=>{
            input.parentNode.querySelectorAll('[data-role="option"]').forEach((el)=>{
                if(el.innerText.toLowerCase().includes(input.value.toLowerCase())){el.classList.remove('d-none')}
                else{el.classList.add('d-none')}
            })
        }
        if(this.config.disabled){input.disabled = true}
        return input;
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
            icon: 'margin-right: 8px;margin-left: 5px;',
            input: 'outline: none; color: var(--bs-body-color); width: 99%;',
            groupInput: 'outline: none; color: var(--bs-body-color); width: 100%!important;padding-left: 10px;',
            groupLabel: 'width: 100%',
            groupCounter: 'font-size: 0.75rem; margin-right: 15px;',
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
            title: 'fw-bold text-body-secondary',
            icon: '',
            input: 'border-0 border-bottom rounded-top bg-body py-1 mb-1',
            groupInput: 'border-0 border-bottom rounded-top bg-body py-1 mb-1',
            groupLabel: '',
            groupCounter: 'badge bg-body-tertiary fw-normal ms-2',
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
        if(updatecheckAll){ // atualiza checkAll
            let modelTarget = opt.container.dataset?.group ? this.model.groups[opt.container.dataset.group] : this.model;
            this._checkAllUpdateStatus(this._containerGetState(modelTarget.wrapper), opt.container.dataset?.group ? this.model.groups[opt.container.dataset.group].checkAll : this.model.checkAll);
            this.config.onchange({origin: '_optionSwitch'});
        }
        if(el.dataset?.group && this.config.groupCounter){this._groupCounterUpdate(el.dataset.group);}
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
    _checkAllSwitch(checkAll){ // marca todas as opcoes do container
        let count = 0;
        if(checkAll.state == 'check' || checkAll.state == 'partial'){ // desmarca todas as opcoes
            checkAll.container.parentNode.querySelectorAll('[data-value][data-selected]:not(.d-none)').forEach((el)=>{
                this._optionSwitch(el, false, false); // desmarca option sem ajustar o checkAll
                count++;
            })
        }
        else{ // marca todas as opcoes
            checkAll.container.parentNode.querySelectorAll('[data-value]:not([data-selected]):not(.d-none)').forEach((el)=>{
                this._optionSwitch(el, true, false); // marca option sem ajustar o checkAll
                count++;
            })
        }
        this._checkAllUpdateStatus(this._containerGetState(checkAll.container.parentNode), checkAll) // atualiza checkAll ao final
        if(count > 0){ this.config.onchange({origin: '_checkAllSwitch'}) }
    }
    _groupCounterUpdate(group=false, summary=this.getSummary()){ // atualiza contador para grupos
        if(group){ // atualiza contador para grupo informado
            this.model.groups[group].groupCounter.innerHTML = `${summary[group].selected} / ${summary[group].total}`;
        }
        else{ // atualiza contador para todos os grupos
            for(let g in this.groups){
                this.model.groups[g].groupCounter.innerHTML = `${summary[g].selected} / ${summary[g].total}`;
            }
        }
    }
    _containerGetState(container){ // retorna all, none ou partial, baseado na quantidade de opcoes selecionadas no container
        let total = container.querySelectorAll('[data-value]').length;
        let selected = container.querySelectorAll('[data-value][data-selected]').length;
        return selected == 0 ? 'none' : selected == total ? 'all' : 'partial';
    }
    getSummary(){ 
    // retorna resumo das opcoes separado por grupo ex {grupo1: {total: 22, selected: 4}, default: {total: 14, selected: 6}}
        let summary = {default: {total: 0, selected: 0}}
        let groupsCount = [0,0];
        for(let group in this.groups){
            let entry = {total: this.groups[group].length, selected: 0};
            groupsCount[0] += entry.total;
            this.groups[group].forEach((el)=>{
                if(this.selected.includes(el)){
                    entry.selected += 1;
                    groupsCount[1] += 1;
                }
            })
            summary[group] = entry;
        }
        summary.default.total = Object.keys(this.options).length - groupsCount[0];
        summary.default.selected = this.selected.length - groupsCount[1];
        return summary ;
    }
    // Metodos de manipulacao de opcoes
    _buildModel(){ // constroi base do componente e insere na pagina, retorna escopo do modelo com apontadores
        let model = {};
        model.container = document.createElement('div'); // container principal, todo componente eh inserido aq
        model.container.style = this.config.styles.wrapper;
        model.container.classList = this.config.classlist.wrapper;
        model.container.setAttribute('data-role', 'wrapper');
        model.container.addEventListener('click', (ev)=>{this._handleOnclick(ev)})
        model.wrapper = document.createElement('div'); // container dos options (sem grupo associado)
        if(this.config.title){ // adiciona titulo para componente
            model.title = this._addTitle();
            model.container.appendChild(model.title);
        }
        if(this.config.canFilter){ // adiciona input para filtrar opcoes
            model.input = this._addSearchInput(this.config.filterOptions)
            model.wrapper.appendChild(model.input)
        }
        if(this.config.checkAll){ // adiciona controle para marca / desmarcar todas as opcoes
            model.checkAll = this._addCheckAll({})
            model.wrapper.appendChild(model.checkAll.container);
        }
        model.options = {};
        model.groups = {};
        // cria accordion para grupos
        model.accordion = document.createElement('div');
        model.accordion.classList = 'accordion my-2';
        model.accordion.setAttribute('data-role','groupsContainer');
        model.container.appendChild(model.accordion);
        
        // adiciona wrapper das opcoes sem grupo no container principa
        model.container.appendChild(model.wrapper);

        // percorre todas as options construindo entrada no seu respectivo container
        for(let option in this.options){ 
            if(this.options[option]?.['data-group']){
                // cria entrada em this.groups caso nao exista, ocorre ao adicionar option{group: 'x'} ao invez de usar groups
                if(!this.groups[this.options[option]?.['data-group']]){this.groups[this.options[option]['data-group']] = [this.options[option].value]}
                else if(!this.groups[this.options[option]['data-group']].includes(this.options[option].value)){this.groups[this.options[option]['data-group']].push(this.options[option].value)}
                // valida entrada em this.model.groups
                if(model.groups[this.options[option]['data-group']]){ // se grupo ja existe cria option e insere no grupo
                    // cria entrada em this.model para option
                    model.groups[this.options[option]['data-group']].options[option] = this._addOption(this.options[option]);
                    // adiciona option no wrapper
                    model.groups[this.options[option]['data-group']].wrapper.appendChild(model.groups[this.options[option]['data-group']].options[option].container); 
                }
                else{ this._addGroup(this.options[option]['data-group'], [ this.options[option].value ], model) }
            }
            else{
                model.options[option] = this._addOption(this.options[option]);  // cria entrada em this.model para option
                model.wrapper.appendChild(model.options[option].container); // adiciona option no wrapper
            }
        }
        return model;
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
        // adiciona data-group no elemento para identificacao do evento click
        if(config['data-group']){ container.setAttribute('data-group', config['data-group']) }
        
        ['data-i18n'].forEach((el)=>{
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
    addOptions(options){
        if(!Array.isArray(options)){console.log('jsSelectm: addOptions expect an array element');return;}
        options.forEach((el)=>{ try{this.addOption(el)}catch(err){} })
        this.config.onchange({origin: 'addOptions'});
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
        this.options[option.value] = {...option, ...{el: el}};              // adiciona option na lista geral de opcoes
        if(option.selected){ this.selected.push(String(option.value)) };    // adiciona em this.selected
        
        if(option?.['data-group']){
            if(!this.groups[option['data-group']]){ // se grupo informado nao existe, cria novo grupo
                this.groups[option['data-group']] = [option.value];
                this._addGroup(option['data-group'], [String(option.value)], this.model);
            }
            else{ // se grupo ja existe insere option no grupo
                opt.container.setAttribute('data-group', ['data-group']);
                this.model.groups[['data-group']].options[option.value] = opt;
                this.model.groups[['data-group']].wrapper.appendChild(opt.container);
            }
            if(this.config.sort){this._sort(this.model.groups[option['data-group']].wrapper)}
        }
        else{
            this.model.options[option.value] = opt;
            this.model.wrapper.appendChild(opt.container);
            if(this.config.sort){this._sort(this.model.container)}
            this.model.wrapper.style.display = 'block'; // assegura que container esta visivel ao adicionar um elemento
        }

        this.config.onchange({origin: 'addOption'});
    }
    _sort(wrapper){
        let items = [...wrapper.querySelectorAll('[data-value]')];
        // para sort usamos document.fragment para otimizar desempenho evitando reescrita no DOM
        let fragment = document.createDocumentFragment();
        items.sort((a, b) => a.innerText.localeCompare(b.innerText));
        items.forEach(el => fragment.appendChild(el));
        wrapper.appendChild(fragment);
    }
    _addGroup(name='novo', options=[], model=this.model){ // cria elementos para novo grupo
        model.groups[name] = {}; // inicia extrutura de novo grupo
        let acc_item = document.createElement('div');acc_item.classList = 'accordion-item';
        let acc_header = document.createElement('div');acc_header.classList = 'accordion-header pointer';
        //--
        let acc_button = document.createElement('div');
        acc_button.classList = 'accordion-button collapsed fs-6 py-2';
        acc_button.setAttribute('data-bs-toggle','collapse');
        acc_button.setAttribute('data-bs-target',`[data-groupContainer=${name}]`);
        let acc_button_text = document.createElement('span');
        acc_button_text.style = this.config.styles.groupLabel;
        acc_button_text.classList = this.config.classlist.groupLabel;
        acc_button_text.innerHTML = name;
        acc_button.appendChild(acc_button_text);
        if(this.config.groupCounter){
            model.groups[name].groupCounter = document.createElement('span');
            model.groups[name].groupCounter.style = this.config.styles.groupCounter;
            model.groups[name].groupCounter.classList = this.config.classlist.groupCounter;
            model.groups[name].groupCounter.innerHTML = '2 / 4';
            acc_button.appendChild(model.groups[name].groupCounter);
        }
        //--
        model.groups[name].wrapper = document.createElement('div');
        model.groups[name].wrapper.classList = 'accordion-collapse collapse';
        model.groups[name].wrapper.setAttribute('data-groupContainer', name);
        model.groups[name].wrapper.setAttribute('data-bs-parent', '[data-role="groupsContainer"]');
        //--
        if(this.config.canFilter){ // adiciona input para filtrar opcoes
            model.groups[name].input = this._addSearchInput(this.config.filterOptions, true)
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
        options.forEach((el)=>{
            model.groups[name].options[el] = this._addOption(this.options[el]);         // cria elemento adiciona entrada no modelo
            model.groups[name].wrapper.appendChild(model.groups[name].options[el].container);
        })
        return model.groups[name]
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
}