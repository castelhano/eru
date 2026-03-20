/*
* jsSelectm   Implementa controle para select multiple
*
* @version  3.0
* @since    03/02/2023
* @release  2026 [refactor: performance, config groups, dropdown checkAll]
* @author   Rafael Gustavo Alves {@email castelhano.rafael@gmail.com}
* @depend   bootstrap 5.x, bootstrap icons
*/

// Flag de classe para evitar injeção duplicada de estilos
let _jsSelectmStylesInjected = false;

class jsSelectm {
    /**
    * Construtor da classe jsSelectm
    * @param {string|HTMLElement} el          - Seletor CSS ou elemento HTML do select.
    * @param {Object} [options]               - Opções de configuração.
    * @param {Object}   options.options       - Dicionário de opções {value: {value, text, ...}}.
    * @param {Object}   options.groups        - Grupos via config: {'Nome': [val1, val2, ...]}. optgroup no HTML tem precedência.
    * @param {Array}    options.selected      - Valores pré-selecionados.
    * @param {string|Object} options.title    - Título do componente.
    * @param {string}   options.icon          - Classe do ícone Bootstrap.
    * @param {Function} options.onchange      - Callback para mudanças, recebe array de mudanças.
    * @param {boolean}  options.disabled      - Desabilita interações.
    * @param {boolean}  options.checkAll      - Habilita dropdown checkAll.
    * @param {boolean}  options.groupCounter  - Mostra contador por grupo.
    * @param {boolean}  options.canFilter     - Habilita filtro de opções.
    * @param {string}   options.emptyMessage  - Mensagem quando vazio.
    * @param {Object}   options.filterOptions - Opções para input de filtro.
    * @param {boolean}  options.sort          - Ordena opções alfabeticamente.
    * @param {Object}   options.styles        - Estilos customizados.
    * @param {Object}   options.classlist     - Classes CSS customizadas.
    */
    constructor(el, options) {
        this.select = typeof el === 'string' ? document.querySelector(el) : el;
        if (!this.select || this.select.tagName !== 'SELECT') {
            console.error('jsSelectm: Invalid select element');
            return;
        }
        this.select.style.display = 'none';
        
        this.defaults = {
            options:       {},
            groups:        {},                          // Grupos via config: {'Nome': [val1, val2, ...]}
            selected:      [],
            title:         false,
            icon:          false,
            onchange:      () => true,
            disabled:      false,
            checkAll:      true,
            groupCounter:  true,
            canFilter:     false,
            emptyMessage:  'Nada a exibir',
            filterOptions: { placeholder: 'Pesquisa' },
            sort:          false,
        };
        
        this.config           = { ...this.defaults, ...options };
        this.config.styles    = { ...this._getDefaultStyles(),    ...(options?.styles    || {}) };
        this.config.classlist = { ...this._getDefaultClasslist(), ...(options?.classlist || {}) };
        
        this.options  = this.config.options;
        this.groups   = {};
        this.selected = [...this.config.selected];
        this.changes  = [];
        
        // Contadores incrementais — evitam recalcular getSummary() do zero a cada interação
        // _counts.default = {total, selected}; _counts[groupName] = {total, selected}
        this._counts = {};
        
        // cria id unico para a instancia
        this._uid = 'jsSelectm_' + Math.random().toString(36).slice(2, 9);
        this._init();
    }
    
    // ─── Inicialização ────────────────────────────────────────────────────────
    
    _init() {
        try {
            this._injectStyles();
            
            if (Object.keys(this.options).length === 0) {
                const result  = this._initOptions();
                this.options  = result.options;
                this.selected = result.selected;
                this.groups   = result.groups;
            } else {
                this._defaultOptionOrder = [];
                for (const key in this.options) {
                    this._defaultOptionOrder.push(key);
                    const opt = this.options[key];
                    const el  = document.createElement('option');
                    el.value     = opt.value;
                    el.innerHTML = opt.text || '';
                    el.selected  = opt.selected === true;
                    if (opt.selected && !this.selected.includes(key)) this.selected.push(key);
                    this.select.appendChild(el);
                    this.options[key].el = el;
                }
            }
            
            this._applyConfigGroups();   // aplica grupos via config (optgroup tem precedência)
            this._normalizeOptions();
            this._buildCounts();         // inicializa contadores incrementais
            
            this.model = this._buildModel();
            
            const summary = this.getSummary();
            if (summary.default.total === 0) this.model.wrapper.style.display = 'none';
            if (summary.default.total === 0 && Object.keys(this.groups).length === 0) {
                this.model.container.appendChild(this._buildEmptyMessage());
            }
            
            if (this.config.groupCounter) this._groupCounterUpdateAll();
            
            if (this.config.checkAll) {
                // atualiza estado inicial do checkAll global
                this._checkAllUpdateStatus(
                    this._containerGetState(this.model.wrapper),
                    this.model.checkAll
                );
                if (this.config.disabled) this.model.checkAll.btn.classList.add('disabled');
                if (this.config.sort) this._sort(this.model.wrapper);
                
                // atualiza estado inicial dos checkAll de grupos
                for (const group in this.model.groups) {
                    this._checkAllUpdateStatus(
                        this._containerGetState(this.model.groups[group].wrapper),
                        this.model.groups[group].checkAll
                    );
                    if (this.config.disabled) this.model.groups[group].checkAll.btn.classList.add('disabled');
                    if (this.config.sort) this._sort(this.model.groups[group].wrapper);
                }
            }
            
            this.select.after(this.model.container);
        } catch (err) {
            console.error('jsSelectm: Error during initialization', err);
        }
    }
    
    /**
    * Carrega opções a partir do select HTML, detectando optgroup.
    */
    _initOptions() {
        const options  = {};
        this._defaultOptionOrder = [];
        const selected = this.selected.length > 0 ? [...this.selected] : [];
        const groups   = {};
        
        this.select.querySelectorAll('optgroup, option').forEach(el => {
            if (el.tagName === 'OPTGROUP') {
                const opts = el.querySelectorAll('option');
                if (opts.length > 0) {
                    const groupName = el.label || el.getAttribute('label') || 'Grupo';
                    groups[groupName] = { options: [] };
                    opts.forEach(opt => {
                        const cfg = this._parseOption(opt);
                        options[opt.value] = { ...cfg, 'data-group': groupName };
                        groups[groupName].options.push(opt.value);
                        if (opt.selected && !selected.includes(opt.value)) selected.push(opt.value);
                    });
                } else {
                    el.remove();
                }
            } else if (el.tagName === 'OPTION' && !el.closest('optgroup')) {
                const cfg = this._parseOption(el);
                options[el.value] = cfg;
                this._defaultOptionOrder.push(el.value);
                if (el.selected && !selected.includes(el.value)) selected.push(el.value);
            }
        });
        
        return { options, selected, groups };
    }
    
    /**
    * Aplica grupos informados via config.groups.
    * optgroup no HTML tem precedência: se a option já tem data-group, é ignorada aqui.
    */
    _applyConfigGroups() {
        const configGroups = this.config.groups || {};
        for (const groupName in configGroups) {
            const values = configGroups[groupName];
            if (!Array.isArray(values)) continue;
            
            values.forEach(val => {
                const key = String(val);
                if (!this.options[key]) return;
                // optgroup vence — se já tem grupo atribuído, não sobrescreve
                if (this.options[key]['data-group']) return;
                
                if (!this.groups[groupName]) {
                    this.groups[groupName] = { options: [] };
                }
                this.options[key]['data-group'] = groupName;
                this.groups[groupName].options.push(key);
            });
        }
    }
    
    _parseOption(el) {
        const opt = { el, text: el.innerText, value: el.value, selected: el.selected };
        for (const attr of el.attributes) opt[attr.name] = attr.value;
        return opt;
    }
    
    _normalizeOptions() {
        this.selected.forEach(key => {
            if (this.options[key]) {
                this.options[key].selected = true;
                if (this.options[key].el) this.options[key].el.selected = true;
            }
        });
    }
    
    // ─── Contadores incrementais ──────────────────────────────────────────────
    
    /**
    * Inicializa _counts a partir do estado atual das opções.
    * Chamado uma única vez após _normalizeOptions.
    */
    _buildCounts() {
        this._counts = { default: { total: 0, selected: 0 } };
        
        for (const groupName in this.groups) {
            this._counts[groupName] = { total: 0, selected: 0 };
        }
        
        for (const key in this.options) {
            const opt       = this.options[key];
            const groupName = opt['data-group'];
            const bucket    = groupName ? this._counts[groupName] : this._counts.default;
            if (!bucket) continue;  // segurança
            bucket.total++;
            if (opt.selected) bucket.selected++;
        }
    }
    
    /**
    * Atualiza o contador incremental ao marcar/desmarcar uma opção.
    * @param {string} key       - Value da opção.
    * @param {boolean} selected - Novo estado.
    */
    _countUpdate(key, selected) {
        const groupName = this.options[key]?.['data-group'];
        const bucket    = groupName ? this._counts[groupName] : this._counts.default;
        if (!bucket) return;
        bucket.selected += selected ? 1 : -1;
    }
    
    // ─── Métodos públicos ─────────────────────────────────────────────────────
    
    /**
    * Retorna resumo das seleções por grupo — usa contadores em memória, O(1).
    * @returns {Object} - {default: {total, selected}, [group]: {total, selected}}
    */
    getSummary() {
        const summary = {};
        for (const key in this._counts) {
            summary[key] = { ...this._counts[key] };
        }
        return summary;
    }
    
    /** Move foco para controle */
    getFocus() {
        if (this.config.disabled) return;
        // opção visível no wrapper padrão
        const first = this.model.wrapper.querySelector('[data-role="option"]:not(.d-none)');
        if (first) { first.focus(); return; }
        
        // fallback: foca o botão do primeiro grupo
        const firstGroup = Object.values(this.model.groups)[0];
        if (firstGroup?.accButton) firstGroup.accButton.focus();
    }
    
    /** Retorna nome do grupo com foco ativo (ou null) */
    getActiveGroup() {
        const el = document.activeElement?.closest('[data-groupContainer]');
        return el?.dataset?.groupContainer || null;
    }
    
    /** Marca/desmarca todas as opções do container padrão. */
    checkAll(state) {
        const ca = this.model.checkAll;
        ca.state = state === undefined ? ca.state : (state ? 'uncheck' : 'check');
        this._checkAllSwitch(ca);
    }
    
    /** Marca/desmarca todas as opções de um grupo específico ou de todos os grupos. */
    groupCheckAll(group = undefined, state = undefined) {
        if (typeof group === 'boolean' && state === undefined) {
            state = group;
            group = undefined;
        }
        if (group && !this.groups[group]) return;
        
        const targets = group ? [group] : Object.keys(this.groups);
        targets.forEach(g => {
            const ca = this.model.groups[g].checkAll;
            ca.state = state === undefined ? ca.state : (state ? 'uncheck' : 'check');
            this._checkAllSwitch(ca);
            if (this.config.groupCounter) this._groupCounterUpdate(g);
        });
        this._fireOnchange();
    }
    
    /** Adiciona múltiplas opções. */
    addOptions(options) {
        if (!Array.isArray(options)) {
            console.warn('jsSelectm: addOptions expects an array');
            return;
        }
        options.forEach(opt => {
            try { this.addOption(opt); }
            catch (err) { console.error('jsSelectm: Error in addOptions', err); }
        });
    }
    
    /** Adiciona uma nova opção. */
    addOption(option) {
        try {
            if (!option?.value) { console.warn('jsSelectm: Option requires "value"'); return; }
            const key = String(option.value);
            if (this.options[key]) { console.warn('jsSelectm: Duplicate option value'); return; }
            
            const el = document.createElement('option');
            el.value     = option.value;
            el.innerHTML = option?.text || '';
            el.selected  = option.selected === true;
            this.select.appendChild(el);
            
            this.options[key] = { ...option, el };
            if (option.selected) this.selected.push(key);
            
            const optModel = this._buildOptionEl(this.options[key]);
            const groupName = option.group;
            
            if (groupName) {
                if (!this.groups[groupName]) {
                    this.groups[groupName] = { options: [] };
                    this._counts[groupName] = { total: 0, selected: 0 };
                    this._addGroupToModel(groupName, [], this.model);
                }
                this.options[key]['data-group'] = groupName;
                this.groups[groupName].options.push(key);
                optModel.container.setAttribute('data-group', groupName);
                this.model.groups[groupName].options[key] = optModel;
                this.model.groups[groupName].wrapper.appendChild(optModel.container);
                if (this.config.sort) this._sort(this.model.groups[groupName].wrapper);
            } else {
                this.model.options[key] = optModel;
                this.model.wrapper.appendChild(optModel.container);
                this.model.wrapper.style.display = 'block';
                if (this.config.sort) this._sort(this.model.wrapper);
            }
            
            // atualiza contadores
            const bucket = groupName ? this._counts[groupName] : this._counts.default;
            if (bucket) {
                bucket.total++;
                if (option.selected) bucket.selected++;
            }
            
            if (this.model.emptyMessage) {
                this.model.emptyMessage.remove();
                this.model.emptyMessage = null;
            }
            
            this.config.onchange([{ value: option.value, selected: option.selected || false }]);
        } catch (err) {
            console.error('jsSelectm: Error adding option', err);
        }
    }
    
    // ─── Construção do modelo DOM ─────────────────────────────────────────────
    
    _buildModel() {
        const model = {};
        
        // container principal
        model.container = document.createElement('div');
        model.container.className = this.config.classlist.wrapper;
        model.container.setAttribute('style', this.config.styles.wrapper);
        model.container.setAttribute('data-role', 'wrapper');
        model.container._jsSelectm = this; // adiciona atalho a instancia em 
        model.container.addEventListener('click',   ev => this._handleClick(ev));
        model.container.addEventListener('keydown', ev => this._handleKeydown(ev));
        
        // título
        if (this.config.title) {
            model.title = this._buildTitle();
            model.container.appendChild(model.title);
        }
        
        // accordion de grupos
        model.accordion = document.createElement('div');
        model.accordion.id = this._uid;
        model.accordion.className = 'accordion my-2';
        model.accordion.setAttribute('data-role', 'groupsContainer');
        model.container.appendChild(model.accordion);
        
        // wrapper das options sem grupo
        model.wrapper = document.createElement('div');
        model.wrapper.setAttribute('tabindex', '0');
        
        if (this.config.canFilter) {
            model.input = this._buildSearchInput();
            model.wrapper.appendChild(model.input);
        }
        if (this.config.checkAll) {
            model.checkAll = this._buildCheckAllDropdown();
            model.wrapper.appendChild(model.checkAll.container);
        }
        
        model.options = {};
        model.groups  = {};
        
        // monta grupos
        for (const groupName in this.groups) {
            this._addGroupToModel(groupName, this.groups[groupName].options, model);
        }
        
        // monta options sem grupo via fragment
        const fragment = document.createDocumentFragment();
        for (const key of this._defaultOptionOrder) {
            if (!this.options[key]['data-group']) {
                model.options[key] = this._buildOptionEl(this.options[key]);
                fragment.appendChild(model.options[key].container);
            }
        }
        model.wrapper.appendChild(fragment);
        model.container.appendChild(model.wrapper);
        
        // ordena grupos no accordion
        if (this.config.sort) {
            const sorted = [...model.accordion.children].sort((a, b) =>
                a.innerText.toUpperCase().localeCompare(b.innerText.toUpperCase()));
            sorted.forEach(item => model.accordion.appendChild(item));
        }
        
        return model;
    }
    
    _buildTitle() {
        const container = document.createElement('div');
        container.setAttribute('style', this.config.styles.titleContainer);
        container.className = this.config.classlist.titleContainer;
        if (this.config.icon) {
            const icon = document.createElement('i');
            icon.className = this.config.icon;
            icon.setAttribute('style', this.config.styles.icon);
            container.appendChild(icon);
        }
        const text = document.createElement('span');
        text.setAttribute('style', this.config.styles.title);
        text.className = this.config.classlist.title;
        if (typeof this.config.title === 'string') {
            text.innerHTML = this.config.title;
        } else {
            for (const k in this.config.title) text.setAttribute(k, this.config.title[k]);
        }
        container.appendChild(text);
        return container;
    }
    
    /**
    * Cria o dropdown checkAll (ícone de estado + menu com "Marcar todos" / "Desmarcar todos").
    */
    _buildCheckAllDropdown(groupName = null) {
        const wrapper  = document.createElement('div');
        wrapper.className = 'dropdown d-inline-block';
        wrapper.setAttribute('data-role', 'checkAll');
        if (groupName) wrapper.setAttribute('data-group', groupName);
        
        // botão gatilho
        const btn = document.createElement('button');
        btn.type      = 'button';
        btn.className = this.config.classlist.checkAll;
        btn.setAttribute('style', this.config.styles.checkAll);
        btn.setAttribute('data-bs-toggle', 'dropdown');
        btn.setAttribute('aria-expanded', 'false');
        
        const icon = document.createElement('i');
        icon.className = this.config.classlist.uncheck;
        
        btn.appendChild(icon);
        
        const label = document.createElement('span');
        label.className = 'ms-1 text-body-tertiary user-select-none';
        label.innerHTML = gettext('Selecionar');
        btn.appendChild(label);
        
        wrapper.appendChild(btn);
        
        // menu
        const menu = document.createElement('ul');
        menu.className = 'dropdown-menu dropdown-menu-sm shadow-sm py-1';
        
        const itemCheck   = this._buildCheckAllMenuItem('check',   gettext('Marcar todos'),   'bi bi-check-square me-2');
        const itemUncheck = this._buildCheckAllMenuItem('uncheck', gettext('Desmarcar todos'), 'bi bi-square me-2');
        
        menu.appendChild(itemCheck.li);
        menu.appendChild(itemUncheck.li);
        wrapper.appendChild(menu);
        
        const obj = {
            container:    wrapper,
            btn:          btn,
            icon:         icon,
            menu:         menu,
            itemCheck:    itemCheck,
            itemUncheck:  itemUncheck,
            state:        'uncheck',   // estado atual: 'check' | 'uncheck' | 'partial'
        };
        
        // bind dos itens do menu
        itemCheck.a.addEventListener('click', ev => {
            ev.stopPropagation();
            this._checkAllExecute('check', obj, groupName);
            bootstrap.Dropdown.getInstance(btn)?.hide();
        });
        itemUncheck.a.addEventListener('click', ev => {
            ev.stopPropagation();
            this._checkAllExecute('uncheck', obj, groupName);
            bootstrap.Dropdown.getInstance(btn)?.hide();
        });
        
        return obj;
    }
    
    _buildCheckAllMenuItem(action, label, iconClass) {
        const li = document.createElement('li');
        const a  = document.createElement('button');
        a.type = 'button';
        a.className = 'dropdown-item py-1 small';
        a.setAttribute('data-action', action);
        
        const ic = document.createElement('i');
        ic.className = iconClass;
        a.appendChild(ic);
        a.appendChild(document.createTextNode(label));
        li.appendChild(a);
        
        return { li, a, icon: ic };
    }
    
    /**
    * Executa marcar ou desmarcar todos — respeita filtro (só afeta opções visíveis).
    * @param {'check'|'uncheck'} action
    * @param {Object} checkAll
    * @param {string|null} groupName
    */
    _checkAllExecute(action, checkAll, groupName = null) {
        const selector = action === 'check'
        ? '[data-value]:not([data-selected]):not(.d-none)'
        : '[data-value][data-selected]:not(.d-none)';
        
        checkAll.container.parentNode.querySelectorAll(selector).forEach(el => {
            this._optionSwitch(el, action === 'check', false);
        });
        
        this._checkAllUpdateStatus(
            this._containerGetState(checkAll.container.parentNode),
            checkAll
        );
        
        if (groupName && this.config.groupCounter) this._groupCounterUpdate(groupName);
        
        this._fireOnchange();
    }
    
    _buildSearchInput(groupContainer = false) {
        const input   = document.createElement('input');
        input.type    = 'search';
        const opts    = this.config.filterOptions || {};
        if (opts.placeholder) input.setAttribute('placeholder', opts.placeholder);
        input.setAttribute('style', groupContainer ? this.config.styles.groupInput : this.config.styles.input);
        input.className = groupContainer ? this.config.classlist.groupInput : this.config.classlist.input;
        if (this.config.disabled) input.disabled = true;
        
        input.addEventListener('input', () => {
            try {
                const q = input.value.toLowerCase();
                input.parentNode.querySelectorAll('[data-role="option"]').forEach(el => {
                    el.classList.toggle('d-none', !el.innerText.toLowerCase().includes(q));
                });
                // atualiza ícone do checkAll refletindo o estado das opções visíveis
                if (this.config.checkAll) {
                    const ca = input.parentNode.querySelector('[data-role="checkAll"]');
                    if (ca) {
                        const groupAttr = ca.dataset?.group;
                        const caObj = groupAttr
                        ? this.model.groups[groupAttr]?.checkAll
                        : this.model.checkAll;
                        if (caObj) {
                            this._checkAllUpdateStatus(
                                this._containerGetState(caObj.container.parentNode),
                                caObj
                            );
                        }
                    }
                }
            } catch (err) {
                console.error('jsSelectm: Error filtering', err);
            }
        });
        
        return input;
    }
    
    _buildEmptyMessage() {
        const el = document.createElement('div');
        el.setAttribute('style', this.config.styles.emptyMessage);
        el.className = this.config.classlist.emptyMessage;
        el.innerHTML = this.config.emptyMessage;
        this.model.emptyMessage = el;
        return el;
    }
    
    _buildOptionEl(config) {
        const container = document.createElement('div');
        container.className = this.config.classlist.option;
        container.setAttribute('style', this.config.styles.option);
        container.setAttribute('data-role', 'option');
        container.setAttribute('data-value', config.value);
        container.setAttribute('tabindex', '0');
        
        const icon = document.createElement('i');
        const text = document.createElement('span');
        text.innerHTML = config.text;
        
        if (config['data-group']) container.setAttribute('data-group', config['data-group']);
        
        if (config.selected) {
            container.setAttribute('data-selected', '');
            icon.className = this.config.classlist.check;
        } else {
            icon.className = this.config.classlist.uncheck;
        }
        
        container.appendChild(icon);
        container.appendChild(text);
        
        return { container, icon, text, selected: config.selected === true };
    }
    
    _addGroupToModel(name, optionKeys = [], model = this.model) {
        model.groups[name] = {};
        
        const accItem   = document.createElement('div');
        accItem.className = 'accordion-item';
        
        const accHeader = document.createElement('div');
        accHeader.className = 'accordion-header pointer';
        
        const accButton = document.createElement('button');
        accButton.className = 'accordion-button collapsed fs-6 py-2';
        accButton.setAttribute('data-bs-toggle', 'collapse');
        accButton.setAttribute('data-bs-target', `[data-groupContainer="${CSS.escape(name)}"]`);
        accButton.setAttribute('data-group', name);
        model.groups[name].accButton = accButton; // guarda referencia ao controle
        
        const labelSpan = document.createElement('span');
        labelSpan.setAttribute('style', this.config.styles.groupLabel);
        labelSpan.className = this.config.classlist.groupLabel;
        labelSpan.innerHTML = name;
        accButton.appendChild(labelSpan);
        
        if (this.config.groupCounter) {
            model.groups[name].groupCounter = document.createElement('span');
            model.groups[name].groupCounter.setAttribute('style', this.config.styles.groupCounter);
            model.groups[name].groupCounter.className = this.config.classlist.groupCounter;
            model.groups[name].groupCounter.innerHTML = '0 / 0';
            accButton.appendChild(model.groups[name].groupCounter);
        }
        
        // wrapper das opções do grupo
        model.groups[name].wrapper = document.createElement('div');
        model.groups[name].wrapper.className = 'accordion-collapse collapse';
        model.groups[name].wrapper.setAttribute('data-groupContainer', name);
        model.groups[name].wrapper.setAttribute('data-bs-parent', `#${this._uid}`);
        model.groups[name].wrapper.setAttribute('tabindex', '0');
        
        model.groups[name].wrapper.addEventListener('shown.bs.collapse', () => {
            const first = model.groups[name].wrapper.querySelector('[data-role="option"]:not(.d-none)');
            if (first) first.focus();
        });
        
        if (this.config.canFilter) {
            model.groups[name].input = this._buildSearchInput(true);
            model.groups[name].wrapper.appendChild(model.groups[name].input);
        }
        if (this.config.checkAll) {
            model.groups[name].checkAll = this._buildCheckAllDropdown(name);
            model.groups[name].wrapper.appendChild(model.groups[name].checkAll.container);
        }
        
        accHeader.appendChild(accButton);
        accItem.appendChild(accHeader);
        accItem.appendChild(model.groups[name].wrapper);
        model.accordion.appendChild(accItem);
        
        model.groups[name].options = {};
        
        const fragment = document.createDocumentFragment();
        optionKeys.forEach(key => {
            model.groups[name].options[key] = this._buildOptionEl(this.options[key]);
            fragment.appendChild(model.groups[name].options[key].container);
        });
        model.groups[name].wrapper.appendChild(fragment);
        
        return model.groups[name];
    }
    
    // ─── Estado e seleção ─────────────────────────────────────────────────────
    
    _optionSwitch(el, state = null, updateCheckAll = true) {
        const key     = el.dataset?.value;
        const group   = el.dataset?.group || null;
        const optMdl  = group
        ? this.model.groups[group]?.options[key]
        : this.model.options[key];
        
        if (!optMdl || !this.options[key]) return;
        
        const newState = state !== null ? state : !optMdl.selected;
        
        if (newState === optMdl.selected) return; // sem mudança real
        
        optMdl.selected = newState;
        const htmlOpt   = this.options[key];
        
        if (newState) {
            el.setAttribute('data-selected', '');
            optMdl.icon.className = this.config.classlist.check;
            if (htmlOpt.el) htmlOpt.el.selected = true;
            if (!this.selected.includes(key)) this.selected.push(key);
        } else {
            el.removeAttribute('data-selected');
            optMdl.icon.className = this.config.classlist.uncheck;
            if (htmlOpt.el) htmlOpt.el.selected = false;
            const idx = this.selected.indexOf(key);
            if (idx > -1) this.selected.splice(idx, 1);
        }
        
        this._countUpdate(key, newState);
        this.changes.push({ value: key, selected: newState });
        
        if (group && this.config.groupCounter) this._groupCounterUpdate(group);
        
        if (updateCheckAll) {
            const caObj = group ? this.model.groups[group]?.checkAll : this.model.checkAll;
            if (caObj) {
                this._checkAllUpdateStatus(
                    this._containerGetState(caObj.container.parentNode),
                    caObj
                );
            }
            this._fireOnchange();
        }
    }
    
    /**
    * Atualiza o ícone do botão dropdown refletindo o estado atual (check / uncheck / partial).
    */
    _checkAllUpdateStatus(state, checkAll) {
        if (!checkAll) return;
        if (state === 'none') {
            checkAll.icon.className = this.config.classlist.uncheck;
            checkAll.state = 'uncheck';
        } else if (state === 'all') {
            checkAll.icon.className = this.config.classlist.check;
            checkAll.state = 'check';
        } else {
            checkAll.icon.className = this.config.classlist.partial;
            checkAll.state = 'partial';
        }
    }
    
    _checkAllSwitch(checkAll) {
        // mantido para compatibilidade com chamadas de checkAll() / groupCheckAll()
        const action = (checkAll.state === 'check' || checkAll.state === 'partial') ? 'uncheck' : 'check';
        const groupName = checkAll.container.dataset?.group || null;
        this._checkAllExecute(action, checkAll, groupName);
    }
    
    _containerGetState(container) {
        const options  = container.querySelectorAll('[data-value]');
        const selected = container.querySelectorAll('[data-value][data-selected]');
        if (selected.length === 0) return 'none';
        if (selected.length === options.length) return 'all';
        return 'partial';
    }
    
    _groupCounterUpdate(groupName) {
        const el = this.model.groups[groupName]?.groupCounter;
        if (!el) return;
        const c = this._counts[groupName] || { total: 0, selected: 0 };
        el.innerHTML = `${c.selected} / ${c.total}`;
    }
    
    _groupCounterUpdateAll() {
        for (const g in this.groups) this._groupCounterUpdate(g);
    }
    
    _fireOnchange() {
        if (this.changes.length === 0) return;
        this.config.onchange(this.changes);
        this.changes = [];
    }
    
    // ─── Eventos ──────────────────────────────────────────────────────────────
    
    _handleClick(ev) {
        if (this.config.disabled) return;
        try {
            // sobe a árvore até o primeiro elemento com data-role relevante
            const target = ev.target.closest('[data-role="option"], [data-role="checkAll"]');
            if (!target) return;
            
            if (target.dataset.role === 'option') {
                this._optionSwitch(target);
            }
            // checkAll é tratado diretamente pelos listeners do dropdown
        } catch (err) {
            console.error('jsSelectm: Error handling click', err);
        }
    }
    
    _handleKeydown(ev) {
        if (this.config.disabled) return;
        
        // entrada no wrapper padrão via teclado
        if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
            if (ev.target === this.model.wrapper) {
                ev.preventDefault();
                const options = [...this.model.wrapper.querySelectorAll('[data-role="option"]:not(.d-none)')];
                const first = ev.key === 'ArrowDown' ? options[0] : options[options.length - 1];
                if (first) first.focus();
                return;
            }
        }
        
        const el          = ev.target.closest('[data-role="option"]');
        const groupName   = ev.target.dataset?.group;
        const isAccButton = groupName && this.model.groups[groupName]?.accButton === ev.target;
        
        if (!el && !isAccButton) return;
        
        if (ev.key === ' ' || ev.key === 'Enter') {
            if (el) { ev.preventDefault(); this._optionSwitch(el); }
            return;
        }
        
        if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') return;
        ev.preventDefault();
        
        const groupKeys = Object.keys(this.model.groups);
        
        if (isAccButton) {
            const idx  = groupKeys.indexOf(groupName);
            const next = ev.key === 'ArrowDown' ? groupKeys[idx + 1] : groupKeys[idx - 1];
            if (next) this.model.groups[next].accButton.focus();
            return;
        }
        
        // navegação dentro de um container (grupo ou wrapper padrão)
        const container = el.closest('[data-groupContainer]') || null;
        const options   = [...(container || this.model.wrapper).querySelectorAll('[data-role="option"]:not(.d-none)')];
        const idx       = options.indexOf(el);
        const next      = ev.key === 'ArrowDown' ? options[idx + 1] : options[idx - 1];
        
        if (next) { next.focus(); return; }
        
        // borda do container — passa para o próximo/anterior grupo
        if (container) {
            const gName = container.dataset.groupContainer;
            const gIdx  = groupKeys.indexOf(gName);
            const nextG = ev.key === 'ArrowDown' ? groupKeys[gIdx + 1] : groupKeys[gIdx - 1];
            if (nextG) this.model.groups[nextG].accButton.focus();
        } else {
            // borda do wrapper padrão descendo → primeiro grupo
            if (ev.key === 'ArrowDown' && groupKeys.length > 0) {
                this.model.groups[groupKeys[0]].accButton.focus();
            }
        }
    }
    
    // ─── Estilos e classes ────────────────────────────────────────────────────
    
    /** Injeta pseudo-classes uma única vez por página. */
    _injectStyles() {
        if (_jsSelectmStylesInjected) return;
        _jsSelectmStylesInjected = true;
        
        const style = document.createElement('style');
        style.innerHTML = [
            '.selectm-wrapper.disabled{background-color:#E9ECEF;}',
            '[data-bs-theme="dark"] .selectm-wrapper.disabled{background-color:#393939;}',
            '.selectm-option[data-selected]{background-color:rgba(25,135,84,0.25)!important;}',
            '@media(min-width:992px){.selectm-option:hover{cursor:pointer;background-color:var(--bs-secondary-bg);}}',
            '.selectm-option:focus{outline:2px solid var(--bs-primary);outline-offset:1px;}',
        ].join('');
        document.head.appendChild(style);
    }
    
    _getDefaultStyles() {
        return {
            wrapper:        'position:relative;border:1px solid var(--bs-border-color);border-radius:0.375rem;padding:0.375rem 0.875rem 0.475rem 0.75rem;',
            container:      'max-height:230px;overflow-y:scroll;',
            option:         'padding:2px 5px;border-radius:3px;',
            selected:       'background-color:rgba(25,135,84,0.25)!important;',
            titleContainer: '',
            title:          '',
            icon:           'margin-right:8px;margin-left:5px;',
            input:          'outline:none;color:var(--bs-body-color);width:99%;',
            groupInput:     'outline:none;color:var(--bs-body-color);width:100%!important;padding-left:10px;',
            groupLabel:     'width:100%',
            groupCounter:   'font-size:0.75rem;margin-right:15px;',
            checkAll:       'padding: 5px !important;',
            emptyMessage:   '',
        };
    }
    
    _getDefaultClasslist() {
        return {
            wrapper:        'selectm-wrapper',
            container:      '',
            option:         'selectm-option',
            titleContainer: '',
            title:          'fw-bold text-body-secondary',
            icon:           '',
            input:          'border-0 border-bottom rounded-top bg-body py-1 mb-1',
            groupInput:     'border-0 border-bottom rounded-top bg-body py-1 mb-1',
            groupLabel:     '',
            groupCounter:   'badge bg-body-secondary fw-normal ms-2 text-body',
            // botão do dropdown checkAll — sem fundo, sem borda, só o ícone
            checkAll:       'p-0 border-0 bg-transparent text-body-secondary text-decoration-none dropdown-toggle',
            checkAllText:   'text-body-tertiary',
            uncheck:        'bi bi-square me-2',
            check:          'bi bi-check-square-fill me-2',
            partial:        'bi bi-dash-square me-2',
            emptyMessage:   'mb-1 ps-1 text-body-tertiary',
        };
    }
}