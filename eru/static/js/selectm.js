/*
* jsSelectm   Implementa controle para select multiple
*
* @version  2.5
* @since    03/02/2023
* @release  15/12/2025 [refactor: optgroup support, performance, error handling]
* @author   Rafael Gustavo Alves {@email castelhano.rafael@gmail.com}
* @depend   bootstrap 5.x, bootstrap icons
*/
class jsSelectm{
    /**
     * Construtor da classe jsSelectm. Inicializa o componente de seleção múltipla baseado em um elemento select.
     * @param {string|HTMLElement} el - Seletor CSS ou elemento HTML do select.
     * @param {Object} [options] - Opções de configuração para personalizar o componente.
     * @param {Object} options.options - Dicionário de opções {value: {value, text, ...}}.
     * @param {Array} options.selected - Valores pré-selecionados.
     * @param {string|Object} options.title - Título do componente.
     * @param {string} options.icon - Classe do ícone Bootstrap.
     * @param {Function} options.onchange - Callback para mudanças, recebe array de mudanças.
     * @param {boolean} options.disabled - Desabilita interações.
     * @param {boolean} options.checkAll - Habilita controle "Marcar Todos".
     * @param {boolean} options.groupCounter - Mostra contador por grupo.
     * @param {boolean} options.canFilter - Habilita filtro de opções.
     * @param {string} options.emptyMessage - Mensagem quando vazio.
     * @param {Object} options.filterOptions - Opções para input de filtro.
     * @param {boolean} options.sort - Ordena opções alfabeticamente.
     * @param {Object} options.styles - Estilos customizados.
     * @param {Object} options.classlist - Classes CSS customizadas.
     */
    constructor(el, options){
        this.select = typeof el === 'string' ? document.querySelector(el) : el;
        if (!this.select || this.select.tagName !== 'SELECT') {
            console.error('jsSelectm: Invalid select element');
            return;
        }
        this.select.style.display = 'none'; // oculta select original
        // Configuracoes
        this.defaults = {
            options: {},                                               // Options do select, dicionario {1: {value: 1, text: 'Ativo'}}
            selected: [],                                              // Opcoes pre selecionadas ao instanciar objeto
            title: false,                                              // Titulo do select
            icon: false,                                               // Se informado sera inserido icone ao lado do titulo
            onchange: (changes) => {return true},                      // Funcao a ser chamada ao alterar componente, recebe array de mudanças
            disabled: false,                                           // Se true desativa operacoes nos eventos click e altera formatacao
            checkAll: true,                                            // Se true sera adicionado controle para marcar todas as opcoes
            groupCounter: true,                                        // Se true adiciona contador de opcoes somente nas opcoes de grupo
            canFilter: false,                                          // Se true adiciona input para filtrar opcoes
            // emptyMessage sera exibido se nenhum option estiver disponivel
            emptyMessage: (typeof i18n !== 'undefined' && i18n.getEntry) ? i18n.getEntry('sys.nothingToShow') || 'Nada a exibir' : 'Nada a exibir',
            filterOptions: {                                           // Opcoes para o input#search
                placeholder: (typeof i18n !== 'undefined' && i18n.getEntry) ? i18n.getEntry('common.search') || 'Pesquisa' : 'Pesquisa'
            },
            sort: false,                                                // Se true reordena opcoes baseado no innerText
        }
        this.config = { ...this.defaults, ...options };
        this.config.styles = { ...this._getDefaultStyles(), ...options?.styles || {}};
        this.config.classlist = { ...this._getDefaultClasslist(), ...options?.classlist || {}};
        //--
        this.options = this.config.options;     // apontador para config.options, options armazena stado inicial dos elementos
        this.groups = {};                       // grupos baseados em optgroup
        this.selected = [...this.config.selected]; // copia para evitar mutacao externa
        this.changes = [];                      // rastreia mudanças para onchange
        
        //--
        this._init();
    }
    /**
     * Método privado de inicialização. Configura o componente, constrói o modelo e insere no DOM.
     * @private
     * @returns {void}
     */
    _init() {
        try {
            this._addPseudoClass();                    // adiciona pseudo classes para componentes
            if(Object.keys(this.options).length === 0){        // se opcoes nao informadas ao instanciar objeto, constroi opcoes a partir do select
                let result = this._initOptions();      // monta modelo de opcoes a partir das options do select informado 
                this.options = result.options;
                this.selected = result.selected;
                this.groups = result.groups;
            }
            else{ // caso options sejam informadas ao instanciar componente, cria options no select original
                for(let opt in this.options){
                    let el = document.createElement('option');
                    el.value = this.options[opt].value;
                    el.innerHTML = this.options[opt]['data-i18n'] ? (typeof i18n !== 'undefined' && i18n.getEntry ? i18n.getEntry(this.options[opt]['data-i18n']) || this.options[opt].text || '' : this.options[opt].text || '') : this.options[opt].text || '';
                    el.selected = this.options[opt].selected === true;
                    if(this.options[opt].selected && !this.selected.includes(opt)){ this.selected.push(opt) }
                    this.select.appendChild(el);
                    this.options[opt].el = el;
                }
            }
            
            // Cria this.model, extrutura que armazena apontadores para todos os elementos criados
            this._normalizeOptions();
            this.model = this._buildModel();
            let summary = this.getSummary();
            if(summary.default.total === 0){ this.model.wrapper.style.display = 'none' }
            if(summary.default.total === 0 && Object.keys(this.groups).length === 0){ 
                this.model.container.appendChild(this._addEmptyMessage());
            }
            if(this.config.groupCounter){ this._groupCounterUpdate() }
            
            if(this.config.checkAll){ // adiciona controle de 'marcar todos' para cada grupo
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
        } catch (error) {
            console.error('jsSelectm: Error during initialization', error);
        }
    }
    /**
     * Método privado para inicializar opções a partir do select HTML, detectando optgroup.
     * @private
     * @returns {Object} - Objeto com options, selected e groups.
     * @returns {Object} return.options - Dicionário de opções.
     * @returns {Array} return.selected - Valores selecionados.
     * @returns {Object} return.groups - Grupos baseados em optgroup.
     */
    _initOptions(){ // para selects contruidos no template, carrega opcoes no modelo
        let options = {};
        let selected = this.selected.length > 0 ? [...this.selected] : [];
        let groups = {};
        // Detecta optgroup e agrupa options
        this.select.querySelectorAll('optgroup, option').forEach((el) => {
            if (el.tagName === 'OPTGROUP') {
                let groupName = el.label || el.getAttribute('label') || 'Grupo';
                groups[groupName] = [];
                el.querySelectorAll('option').forEach((opt) => {
                    let optConfig = this._parseOption(opt);
                    options[opt.value] = { ...optConfig, 'data-group': groupName };
                    groups[groupName].push(opt.value);
                    if (opt.selected && !selected.includes(opt.value)) selected.push(opt.value);
                });
            } else if (el.tagName === 'OPTION' && !el.closest('optgroup')) {
                let optConfig = this._parseOption(el);
                options[el.value] = optConfig;
                if (el.selected && !selected.includes(el.value)) selected.push(el.value);
            }
        });
        return {options: options, selected: selected, groups: groups}
    }
    /**
     * Método privado para analisar um elemento option e extrair suas propriedades.
     * @private
     * @param {HTMLElement} el - Elemento option a ser analisado.
     * @returns {Object} - Configuração da opção com value, text, selected, etc.
     */
    _parseOption(el) {
        let opt = { el: el, text: el.innerText, value: el.value, selected: el.selected };
        for(let attr of el.attributes){
            opt[attr.name] = attr.value;
        }
        return opt;
    }
    /**
     * Método privado para normalizar opções, marcando selected conforme this.selected.
     * @private
     * @returns {void}
     */
    _normalizeOptions(){ 
        this.selected.forEach((el)=>{ 
        // marca options selected=true para os itens em this.selected (caso nao informado ao instanciar elemento)
            if (this.options[el]) {
                this.options[el].selected = true;
                if (this.options[el].el) this.options[el].el.selected = true;
            }
        })
    }

    /**
     * Método público para marcar/desmarcar todas as opções do container padrão.
     * @param {boolean} [state] - Estado desejado; se omitido, inverte o estado atual.
     * @returns {void}
     */
    checkAll(state){ // marca todas as opcoes para o container padrao
        this.model.checkAll.state = state == undefined ? this.model.checkAll.state : state == true ? 'uncheck' : 'check';
        this._checkAllSwitch(this.model.checkAll)
        this.config.onchange(this.changes);
        this.changes = [];
    }
    /**
     * Método público para marcar/desmarcar todas as opções de um grupo específico ou todos os grupos.
     * @param {string|boolean} [group] - Nome do grupo ou boolean para todos os grupos.
     * @param {boolean} [state] - Estado desejado; se omitido, inverte o estado atual.
     * @returns {void}
     */
    groupCheckAll(group=undefined, state=undefined){ // marca todas as opcoes para o grupo informado, na omissaomarca todas as opcoes de todos os grupos
        if(typeof group == 'boolean' && state == undefined){ // checkAll para todos os grupos
            state = group;
            group = undefined;
        }
        if(group && !this.groups[group]){return}
        
        if(group){
            this.model.groups[group].checkAll.state = state == undefined ? this.model.groups[group].checkAll.state : state == true ? 'uncheck' : 'check';
            this._checkAllSwitch(this.model.groups[group].checkAll);
            if(this.config.groupCounter){ this._groupCounterUpdate(group) }
        }
        else{
            for(let group in this.groups){ 
                this.model.groups[group].checkAll.state = state == undefined ? this.model.groups[group].checkAll.state : state == true ? 'uncheck' : 'check';
                this._checkAllSwitch(this.model.groups[group].checkAll) ;
                if(this.config.groupCounter){ this._groupCounterUpdate(group) }
            }
        }
        this.config.onchange(this.changes);
        this.changes = [];
    }
    /**
     * Método privado para criar o elemento de título do componente.
     * @private
     * @returns {HTMLElement} - Elemento div contendo o título.
     */
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
        else{ for(let k in this.config.title){ text.setAttribute(k, this.config.title[k]) }}
        container.appendChild(text);
        return container;
    }
    /**
     * Método privado para criar o controle "Marcar Todos".
     * @private
     * @param {Object} [options] - Opções para o controle.
     * @param {string} options.state - Estado inicial ('check', 'uncheck', 'partial').
     * @returns {Object} - Objeto com container, icon, text e state.
     */
    _addCheckAll(options={}){ // cria um controle para selecionar todas as opcoes
        let container = document.createElement('div');
        let icon = document.createElement('i');
        let text = document.createElement('span');
        container.setAttribute('data-role', 'checkAll');
        container.style = this.config.styles.checkAll;
        container.classList = this.config.classlist.checkAll;
        text.style = this.config.styles.checkAllText;
        text.classList = this.config.classlist.checkAllText;
        let state = options?.state || 'uncheck';
        icon.classList = state == 'unckeck' ? this.config.classlist.uncheck : state == 'check' ? this.config.classlist.check : this.config.classlist.partial;
        text.innerHTML = state == 'uncheck' ? (typeof i18n !== 'undefined' && i18n.getEntry ? i18n.getEntry('selectm.checkAll') || 'Marcar todos' : 'Marcar todos') : (typeof i18n !== 'undefined' && i18n.getEntry ? i18n.getEntry('selectm.uncheckAll') || 'Desmarcar todos' : 'Desmarcar todos');
        container.appendChild(icon);
        container.appendChild(text);
        return {
            container: container,
            icon: icon,
            text: text,
            state: state
        }
    }
    /**
     * Método privado para criar o input de busca para filtrar opções.
     * @private
     * @param {Object} [options] - Opções para o input.
     * @param {boolean} [groupContainer=false] - Se é para container de grupo.
     * @returns {HTMLElement} - Elemento input.
     */
    _addSearchInput(options={}, groupContainer=false){
        let input = document.createElement('input');
        input.type = 'search';
        ['data-i18n', 'placeholder'].forEach((el)=>{ if(this.config.filterOptions?.[el]) {input.setAttribute(el, this.config.filterOptions[el])} })
        input.style = groupContainer ? this.config.styles.groupInput : this.config.styles.input;
        input.classList = groupContainer ? this.config.classlist.groupInput : this.config.classlist.input;
        input.oninput = (ev)=>{
            try {
                input.parentNode.querySelectorAll('[data-role="option"]').forEach((el)=>{
                    if(el.innerText.toLowerCase().includes(input.value.toLowerCase())){el.classList.remove('d-none')}
                    else{el.classList.add('d-none')}
                })
            } catch (error) {
                console.error('jsSelectm: Error filtering options', error);
            }
        }
        if(this.config.disabled){input.disabled = true}
        return input;
    }
    /**
     * Método privado para criar a mensagem de vazio.
     * @private
     * @param {Object} [model=this.model] - Modelo a ser usado.
     * @returns {HTMLElement} - Elemento div com a mensagem.
     */
    _addEmptyMessage(model=this.model){
        model.emptyMessage = document.createElement('div'); 
        model.emptyMessage.style = this.config.styles.emptyMessage; 
        model.emptyMessage.classList = this.config.classlist.emptyMessage;
        model.emptyMessage.innerHTML = this.config.emptyMessage;
        return model.emptyMessage;
    }
    // Metodos de estilizacao 
    /**
     * Método privado para obter estilos padrão.
     * @private
     * @returns {Object} - Objeto com estilos CSS.
     */
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
            emptyMessage: '',
        }
    }
    /**
     * Método privado para obter classes CSS padrão.
     * @private
     * @returns {Object} - Objeto com classes CSS.
     */
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
            groupCounter: 'badge bg-body-secondary fw-normal ms-2 text-body',
            checkAll: 'pointer user-select-none',
            checkAllText: 'text-body-tertiary',
            uncheck: 'bi bi-square me-2',
            check: 'bi bi-check-square-fill me-2',
            partial: 'bi bi-dash-square me-2',
            emptyMessage: 'mb-1 ps-1 text-body-tertiary',
        }
    }
    /**
     * Método privado para adicionar estilos CSS pseudo-classes ao documento.
     * @private
     * @returns {void}
     */
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
    /**
     * Método privado para alternar o estado de uma opção (marcar/desmarcar).
     * @private
     * @param {HTMLElement} el - Elemento da opção.
     * @param {boolean|null} [state=null] - Estado desejado; se null, inverte.
     * @param {boolean} [updatecheckAll=true] - Se deve atualizar o checkAll.
     * @returns {void}
     */
    _optionSwitch(el, state=null, updatecheckAll=true){
        // recebe elemento data-role=option e altera estado, se nao informado state (true ou false) inverte estado do elemento
        let opt = el.dataset?.group ? this.model.groups[el.dataset.group].options[el.dataset.value] : this.model.options[el.dataset.value];
        if (!opt) return;
        let htmlOpt = this.options[el.dataset.value];
        let newState = state != null ? state : opt.selected ? false : true;
        opt.selected = newState;     // atualiza modelo em memoria
        if(!newState){
            el.removeAttribute('data-selected'); // atualiza componente
            if (htmlOpt.el) htmlOpt.el.selected = false; // atualiza elemento html original
            let index = this.selected.indexOf(el.dataset.value);
            if(index > -1){ this.selected.splice(index, 1) }
            opt.icon.classList = this.config.classlist.uncheck;
        }
        else{
            el.setAttribute('data-selected', '');
            if (htmlOpt.el) htmlOpt.el.selected = true; // atualiza elemento html original
            this.selected.push(el.dataset.value);
            opt.icon.classList = this.config.classlist.check;
        }
        // rastreia mudança
        this.changes.push({ value: el.dataset.value, selected: newState });
        // atualiza contole de marcar todos
        if(updatecheckAll){ // atualiza checkAll
            let modelTarget = opt.container.dataset?.group ? this.model.groups[opt.container.dataset.group] : this.model;
            this._checkAllUpdateStatus(this._containerGetState(modelTarget.wrapper), opt.container.dataset?.group ? this.model.groups[opt.container.dataset.group].checkAll : this.model.checkAll);
            this.config.onchange(this.changes);
            this.changes = []; // limpa após callback
        }
        if(el.dataset?.group && this.config.groupCounter){this._groupCounterUpdate(el.dataset.group);}
    }
    /**
     * Método privado para atualizar o status do controle "Marcar Todos".
     * @private
     * @param {string} state - Estado ('none', 'all', 'partial').
     * @param {Object} checkAll - Objeto do controle checkAll.
     * @returns {void}
     */
    _checkAllUpdateStatus(state, checkAll){ // atualiza informacoes (icone, descricao e status) do controle de marcar todos
        if(state == 'none'){
            checkAll.text.innerHTML = i18n.getEntry('selectm.checkAll') || 'Marcar todos';
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
            checkAll.text.innerHTML = i18n.getEntry('selectm.uncheckAll') || 'Desmarcar todos';
            checkAll.container.setAttribute('data-checked', '');   
        }
    }
    /**
     * Método privado para alternar o estado do controle "Marcar Todos".
     * @private
     * @param {Object} checkAll - Objeto do controle checkAll.
     * @returns {void}
     */
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
        if(count > 0){ 
            this.config.onchange(this.changes);
            this.changes = []; // limpa após callback
        }
    }
    /**
     * Método privado para atualizar o contador de seleções por grupo.
     * @private
     * @param {string|boolean} [group=false] - Nome do grupo ou false para todos.
     * @param {Object} [summary=this.getSummary()] - Resumo das seleções.
     * @returns {void}
     */
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
    /**
     * Método privado para obter o estado de seleção de um container.
     * @private
     * @param {HTMLElement} container - Container a ser verificado.
     * @returns {string} - 'none', 'all' ou 'partial'.
     */
    _containerGetState(container){ // retorna all, none ou partial, baseado na quantidade de opcoes selecionadas no container
        let total = container.querySelectorAll('[data-value]').length;
        let selected = container.querySelectorAll('[data-value][data-selected]').length;
        return selected == 0 ? 'none' : selected == total ? 'all' : 'partial';
    }
    /**
     * Método público para obter resumo das seleções por grupo.
     * @returns {Object} - Objeto com total e selected por grupo, incluindo 'default'.
     */
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
    /**
     * Método privado para construir o modelo DOM do componente.
     * @private
     * @returns {Object} - Modelo com elementos criados.
     */
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
        let fragmentDefault = document.createDocumentFragment();
        for(let option in this.options){ 
            if(this.options[option]?.['data-group']){
                let groupName = this.options[option]['data-group'];
                if(!model.groups[groupName]){ 
                    this._addGroup(groupName, [], model);
                }
                // cria entrada em this.model para option
                model.groups[groupName].options[option] = this._addOption(this.options[option]);
                // adiciona option no wrapper
                model.groups[groupName].wrapper.appendChild(model.groups[groupName].options[option].container); 
            }
            else{
                model.options[option] = this._addOption(this.options[option]);  // cria entrada em this.model para option
                fragmentDefault.appendChild(model.options[option].container); // adiciona option no wrapper
            }
        }
        model.wrapper.appendChild(fragmentDefault);
        if(this.config.sort){ // se sort = true, classifica nome dos grupos em ordem crescente (usando o innerText)
            let itens = [...model.accordion.children].sort((a, b) => {
                let textoA = a.innerText.toUpperCase(); // Usar toUpperCase para ordenação sem distinção de maiúsculas/minúsculas
                let textoB = b.innerText.toUpperCase();
                if (textoA < textoB) { return -1 }
                if (textoA > textoB) { return 1 }
                return 0;
            });
            itens.forEach(item => { model.accordion.appendChild(item); });
        }
        return model;
    }
    /**
     * Método privado para criar um elemento de opção no componente.
     * @private
     * @param {Object} config - Configuração da opção.
     * @returns {Object} - Objeto com container, icon, text e selected.
     */
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
    /**
     * Método público para adicionar múltiplas opções.
     * @param {Array} options - Array de objetos de opção.
     * @returns {void}
     */
    addOptions(options){
        if(!Array.isArray(options)){console.warn('jsSelectm: addOptions expect an array element');return;}
        let changes = [];
        options.forEach((el)=>{ 
            try {
                this.addOption(el);
                changes.push({ value: el.value, selected: el.selected || false });
            } catch(err) {
                console.error('jsSelectm: Error adding option in addOptions', err);
            }
        })
        if (changes.length > 0) this.config.onchange(changes);
    }
    /**
     * Método público para adicionar uma nova opção.
     * @param {Object} option - Objeto da opção a adicionar.
     * @param {string} option.value - Valor da opção.
     * @param {string} option.text - Texto da opção.
     * @param {boolean} [option.selected] - Se está selecionada.
     * @param {string} [option.group] - Grupo da opção.
     * @returns {void}
     */
    addOption(option) { // adiciona novo option tanto no select original quanto no componente
        try {
            if(!option?.value){console.warn('jsSelectm: Option require at least "value"'); return;} // option.value eh obrigatorio
            if(this.options[option.value]){console.warn('jsSelectm: Option value duplicated'); return;} // option.value nao pode ser duplicado
            
            let opt = this._addOption(option);      // cria extrutura do option para this.model
            let el = document.createElement('option');
            el.value = option.value;
            el.innerHTML = option?.['data-i18n'] ? (typeof i18n !== 'undefined' && i18n.getEntry ? i18n.getEntry(option['data-i18n']) || option?.text || '' : option?.text || '') : option?.text || '';
            el.selected = option.selected === true;
            this.select.appendChild(el);
            //--
            this.options[option.value] = {...option, ...{el: el}};              // adiciona option na lista geral de opcoes
            if(option.selected){ this.selected.push(String(option.value)) };    // adiciona em this.selected
            
            if(option?.group){
                // Para compatibilidade, se group informado, trata como optgroup
                let groupName = option.group;
                if(!this.groups[groupName]){ 
                    this.groups[groupName] = [];
                    this._addGroup(groupName, [], this.model);
                }
                this.groups[groupName].push(option.value);
                opt.container.setAttribute('data-group', groupName);
                this.model.groups[groupName].options[option.value] = opt;
                this.model.groups[groupName].wrapper.appendChild(opt.container);
                if(this.config.sort){this._sort(this.model.groups[groupName].wrapper)}
            }
            else{
                this.model.options[option.value] = opt;
                this.model.wrapper.appendChild(opt.container);
                if(this.config.sort){this._sort(this.model.wrapper)}
                this.model.wrapper.style.display = 'block'; // assegura que container esta visivel ao adicionar um elemento
            }
            if(this.model.emptyMessage){ this.model.emptyMessage.remove(); this.model.emptyMessage = null; }
            this.config.onchange([{ value: option.value, selected: option.selected || false }]);
        } catch (error) {
            console.error('jsSelectm: Error adding option', error);
        }
    }
    /**
     * Método privado para ordenar opções em um wrapper.
     * @private
     * @param {HTMLElement} wrapper - Container das opções.
     * @returns {void}
     */
    _sort(wrapper){ // reordena (ordem crescente) options no componente baseado no text (innerHTML)
        let items = [...wrapper.querySelectorAll('[data-value]')];
        // para sort usamos document.fragment para otimizar desempenho evitando reescrita no DOM
        let fragment = document.createDocumentFragment();
        items.sort((a, b) => a.innerText.localeCompare(b.innerText));
        items.forEach(el => fragment.appendChild(el));
        wrapper.appendChild(fragment);
    }
    /**
     * Método privado para criar um novo grupo no modelo.
     * @private
     * @param {string} [name='novo'] - Nome do grupo.
     * @param {Array} [options=[]] - Opções do grupo.
     * @param {Object} [model=this.model] - Modelo a ser usado.
     * @returns {Object} - Grupo criado.
     */
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
            model.groups[name].groupCounter.innerHTML = '0 / 0';
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
        
        // carrega options nos grupos usando fragment
        let fragment = document.createDocumentFragment();
        options.forEach((el)=>{
            model.groups[name].options[el] = this._addOption(this.options[el]);         // cria elemento adiciona entrada no modelo
            fragment.appendChild(model.groups[name].options[el].container);
        })
        model.groups[name].wrapper.appendChild(fragment);
        return model.groups[name]
    }
    
    // Metodos para eventos
    /**
     * Método privado para lidar com eventos de clique no componente.
     * @private
     * @param {Event} ev - Evento de clique.
     * @returns {void}
     */
    _handleOnclick(ev){
        if(this.config.disabled){return} // se componente disabled, nao responde a eventos
        try {
            // click disparado do container
            if(ev.target.dataset?.role == 'option'){ this._optionSwitch(ev.target) }
            else if(ev.target.parentNode?.dataset?.role == 'option'){ this._optionSwitch(ev.target.parentNode) }
            else if(ev.target.dataset?.role == 'checkAll'){ 
                if(ev.target.dataset?.group){ this._checkAllSwitch(this.model.groups[ev.target.dataset.group].checkAll) }
                else{ this._checkAllSwitch(this.model.checkAll) }
            }
            else if(ev.target.parentNode?.dataset?.role == 'checkAll'){ 
                if(ev.target.parentNode.dataset.group){this._checkAllSwitch(this.model.groups[ev.target.parentNode.dataset.group].checkAll) }
                else{ this._checkAllSwitch(this.model.checkAll) }
            }
        } catch (error) {
            console.error('jsSelectm: Error handling click', error);
        }
    }
}