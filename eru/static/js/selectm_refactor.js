/*
* jsSelectm   Implementa controle para select multiple
*
* @version  1.18
* @since    03/02/2023
* @release  23/10/2025 [checkAll, filter, full refactor lib]
* @author   Rafael Gustavo Alves {@email castelhano.rafael@gmail.com}
* @depend   boostrap 5.x, bootsrap icons
*/
class jsSelectm{
    constructor(el, options){
        this.select = typeof el === 'string' ? document.querySelector(el) : el;
        this.select.style.display = 'none'; // oculta select original
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
            sort: true,                                                // Se true reordena opcoes baseado no innerText
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
        if(Object.keys(this.options) == 0){        // se opcoes nao informadas ao instanciar objeto, constroi opcoes a partir do select
            this._addPseudoClass();                // adiciona pseudo classes para componentes
            let result = this._initOptions();      // monta modelo de opcoes a partir das options do select informado 
            this.options = result.options;
            this.selected = result.selected;
        }
        // Cria this.model, extrutura que armazena apontadores para todos os elementos criados
        if(this.groups){ this.model = this._buildGroupModel() }
        else{ this.model = this._buildModel() }
        
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
            groupInput: 'width: 100%!important;padding-left: 10px;',
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
            groupInput: '',
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
        style.innerHTML += '.selectm-option[data-selected]{background-color: rgba(25, 135, 84, 0.25)!important;}';
        style.innerHTML += '@media(min-width: 992px){.selectm-option:hover {cursor: pointer; background-color: var(--bs-secondary-bg);}}';
        document.getElementsByTagName('head')[0].appendChild(style);
    }
    
    // Metodos de manipulacao de estado
    getSelected() { return this.selected }
    setSelected(values=[]) {
        // Logica para definir as opcoes selecionadas
        this.selected = values;
        this.onChange();
    }
    
    // Metodos de manipulacão de opcoes
    addOption(opt={}) {
    }
    _sort(group=null){ // reordena opcoes baseado no innerText
    }
    _initOptions(){ // para selects contruidos no template, carrega opcoes no modelo
        let options = {};
        let selected = [];
        this.select.querySelectorAll('option').forEach((el) => {
            let opt = {}
            for(let attr of el.attributes){opt[attr.name] = attr.value}
            opt.text = el.innerText; 
            opt.selected = el.selected
            options[el.value] = opt;
            if(el.selected){selected.push(el.value)}
        });
        return {options: options, selected: selected}

    }
    _buildModel(){ // constroi base do componente e insere na pagina, retorna escopo basico do modelo com apontadores
        let model = {};
        model.wrapper = document.createElement('div');
        model.wrapper.style = this.config.styles.wrapper;
        model.wrapper.classList = this.config.styles.classlist;
        model.wrapper.setAttribute('data-role', 'wrapper');
        if(this.config.title){ // adiciona titulo para componente
            model.title = this._addTitle();
            model.wrapper.appendChild(model.title);
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
        for(let key in this.options){ // cria e adiciona todos os options
            model.options[key] = this._addOption(this.options[key]);    // cria entrada em this.model para option
            model.wrapper.appendChild(model.options[key].container);    // adiciona option no wrapper
        }
        return model;
    }
    _addGroup(name='novo', opt=[], options={}){ // cria elementos para novo grupo
    }
    _buildGroupModel(){}
    _addOption(config){ // cria elemento que representa uma <option> para componente
        let container = document.createElement('div'); container.classList = this.config.classlist.option; container.style = this.config.styles.option;
        container.setAttribute('data-role', 'option')
        let icon = document.createElement('i');
        let text = document.createElement('span');
        ['data-i18n'].forEach((el)=>{if(config?.[el]){ text.setAttribute(el, config[el]) }})
        if(config?.selected){
            container.setAttribute('data-selected', '');
            icon.classList = this.config.classlist.check;
        }
        else{ icon.classList = this.config.classlist.uncheck }
        text.innerHTML = config?.['data-i18n'] ? i18n.getEntry(config['data-i18n']) || config.text : config.text;
        container.appendChild(icon);
        container.appendChild(text);
        return {
            container: container,
            icon: icon,
            text: text,
            selected: config.selected == true
        }
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
        input.style = this.groups ? this.config.style.groupInput : this.config.styles.input;
        input.classList = this.groups ? this.config.classlist.groupInput : this.config.classlist.input;
        input.oninput = (ev)=>{
            input.parentNode.querySelectorAll('[data-role="option"]').forEach((el)=>{
                if(el.innerText.toLowerCase().includes(input.value.toLowerCase())){el.classList.remove('d-none')}
                else{el.classList.add('d-none')}
            })
        }
        return input;
    }
    
    // Metodos para eventos
    _handleOnclick(ev){
        console.log(ev.target);
    }
    onChange(){
        if(typeof this.options.onchange === 'function'){}
    }
    destroy(){}
}