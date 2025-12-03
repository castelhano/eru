/*
* Gerencia atalhos de teclado e implementa tabulacao ao pressionar Enter em formularios
**
* @version  6.3
* @since    05/08/2024
* @release  31/10/2025 [removido suporte para teclas de acento ex ~ ´]
* @ver 6.1  Adicionado suporte para i18n lib appKeyMap.bind(...{'data-i18n'='my.key'})
* @ver < 6  [add keyup, multiple shortcuts at same trigger, priority as useCapture]
* @author   Rafael Gustavo Alves {@email castelhano.rafael@gmail.com}
* @example  appKeyMap = new Keywatch();
* @example  appKeyMap.bind('ctrl+e', ()=>{...do something})
* @example  appKeyMap.bind('g+i;alt+i', ()=>{...do something}, {desc: 'Responde tanto no g+i quanto no alt+i', context: 'userModal'})
* @example  appKeyMap.bind('g+i', (ev, shortcut)=>{...do something}, {keyup: true, keydown: false, useCapture: true})
--
* Versao 6.3 adiciona tratamento para conflito em acionamento de teclas de atalho acidental quado foco esta no input impondo a seguinte restrição:
* atalhos que usam teclas basicas como modificador, se o foco estiver num input nao sera acionado de maneira imediata, nestes casos espera que tecla de 
* confirmacao (this.composedTrigger default:';') apareca logo na sequencia, ou seja o atalho 'c+o' sera acionado imediato quando foco nao estiver em input
* e somente ap precionar ; logo apos precionar c+o
*/
class Keywatch{
    constructor(options={}){
        this.handlers = {};                        // armazena shortcuts vinculados ao document
        
        this.pressed = [];                         // lista com reclas precionadas
        this.contexts = {                          // contextos disponiveis
            all: 'Atalhos Globais',
            default: 'Atalhos Base',
        };
        this.contextPool = [];                     // pilha de contextos, ao usar setContext('foo') adiciona contexto na pilha e setContex() carrega ultimo contexto
        // this.composedMatch = '';                   // 
        this.composedMatch = [];                   // ['c,o', ['keydown','keyup']]
        this.locked = false;                       // se true desativa atalhos gerados fora da classe, usado para travar atalhos quando usando o shortcutModal
        this.context = 'default';                  // contexto ativo
        this.handlerOptions = {                    // configuracoes padrao para shortcut
            context: 'default',
            desc: '',
            icon: null,
            element: document,
            origin: undefined,
            keydown: true,
            keyup: false,
            group: null,
            display: true,
            preventDefault: true,
            useCapture: false,
            'data-i18n': undefined,
            'i18n-dynamicKey': false,
            composed: false                         // composed sera true caso usado modificadores nao convencionais, definido automaticamente na lib
        }
        this.defaultOptions = { // configuracoes padrao para classe
            splitKey: '+',
            separator: ';',
            tabOnEnter: true,
            cleanDelay: 300, // tempo em milissegundos para limpeza de this.pressed em elementos select (trata prblema de teclas presas)
            shortcutMaplist: "alt+k", // atalho para exibir mapa com atalhos disposiveis para pagina, altere para null para desabilitar
            shortcutMaplistDesc: "Exibe lista de atalhos disponiveis na página",
            shortcutMaplistIcon: "bi bi-alt",
            shortcutMaplistOnlyContextActive: true, // se true so mostra atalhados do contexto ativo (alem do all)
            i18nHandler: null, // integracao com lib i18n, se ativa deve informar objeto instanciado
            composedTrigger: ';', // caractere que confirma atalhos 'composed' (atalhos com modificadores nao convencionais)
            composedListener: ()=>{}, // funcao eh acionada sempre que um atalho composed eh iniciado ou finalizado
            reserve: {},    // lista de atalhos reservados, sera usada apenas para notificacao pelo metodo avail
            //Definicoes de estilizacao
            shortcutModalClasslist: 'w-100 h-100 border-2 border-secondary bg-dark-subtle mt-3',
            searchInputClasslist: 'form-control form-control-sm',
            searchInputPlaceholder: 'Criterio pesquisa',
            contextLabelClasslist: 'fs-8 text-body-tertiary position-absolute',
            contextLabelStyle: 'top: 22px; right: 25px;',
            modalTableClasslist: 'table table-sm table-bordered table-striped mt-2 fs-7',
            modalTableLabelClasslist: 'border rounded py-1 px-2 bg-dark-subtle text-body-secondary font-monospace',
            shortcutModalTableDetailClasslist: 'fit text-center px-3',
            shortcutModalTableDetailText: '<i class="bi bi-question-lg"></i>',
            shortcutModalTableDetailItemText: '<i class="bi bi-list d-block text-center pointer"></i>',
        }
        
        for(let k in this.defaultOptions){ // carrega configuracoes para classe
            if(options.hasOwnProperty(k)){this[k] = options[k]}
            else{this[k] = this.defaultOptions[k]}
        }
        
        this.modifier = {                  // itens para conversao de codigo
            'ctrl': 'control',
            '[space]': ' ',
            'esc': 'escape',
            '↑': 'arrowup',
            '↓': 'arrowdown',
            '→': 'arrowright',
            '←': 'arrowleft',
        }
        
        // adiciona listeners basico para document
        this._addEvent(document, 'keydown', (ev)=>{ this._eventHandler(ev, this) }, false);
        this._addEvent(document, 'keyup', (ev)=>{this._eventHandler(ev, this)}, false);
        this._addEvent(window, 'focus', (ev)=>{this.pressed = []}, false); // previne teclas travadas ao receber foco, evita conflito ao mudar de tela
        //--
        if(this.shortcutMaplist){this.bind(this.shortcutMaplist, ()=>{this.showKeymap()}, {origin: 'Keywatch JS', context: 'all', 'data-i18n': 'shortcuts.keywatch.shortcutMaplist', 'i18n-dynamicKey': true, icon: this.shortcutMaplistIcon, desc: this.shortcutMaplistDesc})}
        this._createModal();
    }
    
    // adiciona listener no objeto
    _addEvent(element, event, method, useCapture=false){element.addEventListener(event, method, useCapture)}
    
    // roda os methods atrelados aos shortcuts e retorna quantidade de matchs
    _eventsMatch(scope, ev){
        let prev = false; // prevent default
        let count = 0;
        let list = [];
        // composedMatch carregado na interacao anterior, seguido do trigger
        // this.composedMatch armazena scope e evento encontrado, ex ['c,o', ['keydown']], lista deve buscar no evento encontrado (ou em ambos)
        if(scope == this.composedTrigger && this.composedMatch.length > 0){ scope = this.composedMatch[0] }
        list = [
            ...this.handlers?.[ev.type]?.[this.context]?.[scope] || [],
            ...this.handlers?.[ev.type]?.['all']?.[scope] || []
        ];
        list.forEach((el)=>{
            if(el.element == document || el.element == ev.target){
                let composed = this.composedMatch.length == 0 || !this.composedMatch[1].includes(ev.type);
                if(
                    el.composed && 
                    composed && 
                    ['input', 'textarea','select'].includes(ev.target.nodeName.toLowerCase())
                ){ 
                    // em caso de teclas composed (que usa modificadores nao convencionais) apenas
                    // salva scope em this.composedMatch e aguarda acionamento do trigger na proxima
                    // tecla precionada. Precisa validar se nao existe entrada para outro evento (keyup ou keydown)
                    this.composedMatch = (this.composedMatch.length === 0) 
                    ? [scope, [ev.type]] 
                    : (this.composedMatch[1].includes(ev.type) 
                    ? this.composedMatch 
                    : (this.composedMatch[1].push(ev.type), this.composedMatch));
                    this.composedListener(true, scope);
                    count += 1;
                    return;
                }
                el.method(ev, el);
                count += 1;
                prev = prev || el.preventDefault;
                this.composedMatch = (this.composedMatch.length > 0 && this.composedMatch[1].includes(ev.type)) 
                ? (this.composedMatch[1].length === 1 ? [] : [this.composedMatch[0], this.composedMatch[1].filter(type => type !== ev.type)]) 
                : this.composedMatch;
                
            }
        })        
        if(prev){ev.preventDefault()}
        return count;
    }
    
    // trata os eventos e busca correspondente em this.handlers
    _eventHandler(ev){
        if(this.locked){return false}
        if(ev.type == 'keydown'){ // no keydown verifica se tecla esta listada em pressed, se nao faz push da tecla
            let key = this._normalize(ev.key);
            if(ev.key && !this.pressed.includes(key)){this.pressed.push(key)}
            let scope = this.pressed.length == 1 ? this.pressed[0] : [this.pressed.slice(0, -1).sort(), this.pressed[this.pressed.length - 1]].join();
            let find = this._eventsMatch(scope, ev); // Busca (e executa) match de composicao
            if(!find && ev.key != this.composedTrigger && this.composedMatch){ this.composedMatch = [] }
            if(!find && this.tabOnEnter && ev.key == 'Enter' && ev.target.form && (ev.target.nodeName === 'INPUT' || ev.target.nodeName === 'SELECT')){
                // caso nao localizado atalho, verifica se ev.key eh Enter e se originou de input / select
                // neste caso, implementa tabulacao pela tecla enter, ao instanciar opbeto (ou em qualquer momento) defina tabOnEnter = false para desativar tabulacao
                // para desativar tabulacao em um input especifico atribua data-keywatch='none' para nao tabular (nao submete form) ou data-keywatch='default' para submit
                try{
                    // Adicione attr data-keywatch='default' no input para assumir evento padrao (submit do form)
                    if(ev.target.dataset?.keywatch == 'default'){return false}
                    ev.preventDefault();
                    if(ev.target.dataset?.keywatch == 'none'){return false} // Adicione attr data-keywatch='none' no input que queira evitar tabulacao no enter mais nao submeter
                    let form = ev.target.form;
                    let index = Array.prototype.indexOf.call(form, ev.target);
                    if(form.elements[index + 1].disabled == false && !form.elements[index + 1]?.readOnly == true && form.elements[index + 1].offsetParent != null && form.elements[index + 1].tabIndex >= 0){form.elements[index + 1].focus();}
                    else{
                        let el = ev.target.form.elements;
                        let i = index + 1;
                        let escape = false;
                        while(i <= el.length && !escape){
                            if(form.elements[i].disabled == false && !form.elements[i]?.readOnly == true && form.elements[i].offsetParent != null && form.elements[i].tabIndex >= 0){form.elements[i].focus();escape = true;}
                            else{i++;}
                        }
                    }
                }catch(e){}
            }
        }
        else if(ev.type == 'keyup'){ // no keyup remove a tecla de this.pressed
            let scope = this.pressed.length == 1 ? this.pressed[0] : [this.pressed.slice(0, -1).sort(), this.pressed[this.pressed.length - 1]].join();            
            this._eventsMatch(scope, ev); // Busca match de composicao
            let key = this._normalize(ev.key);
            if(ev.key && this.pressed.indexOf(key) > -1){ this.pressed.splice(this.pressed.indexOf(key), 1);} 
            else if(ev.code == 'Altleft'){ this.pressed.splice(this.pressed.indexOf('alt'), 1)} // alt usado em combinacoes (alt+1+2) pode retornar simbolo diferente em ev.key
            if(ev.key.toLowerCase() == 'escape'){ this.pressed = [] }
        }
    }
    _normalize(str){ return str.normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/çÇ/g, "c").toLowerCase() }
    
    // cria entrada em this.handlers
    _spread(event){
        if(event.keydown){
            if(!this.handlers.hasOwnProperty('keydown')){this.handlers.keydown = {}}
            if(!this.handlers.keydown.hasOwnProperty(event.context)){this.handlers.keydown[event.context] = {}}
            if(!this.handlers.keydown[event.context].hasOwnProperty(event.scope)){this.handlers.keydown[event.context][event.scope] = []}
            this.handlers.keydown[event.context][event.scope].push(event);
            this.handlers.keydown[event.context][event.scope].sort((a,b)=>{return a.useCapture == b.useCapture ? 0 : a.useCapture ? -1 : 1;});
        }
        if(event.keyup){
            if(!this.handlers.hasOwnProperty('keyup')){this.handlers.keyup = {}}
            if(!this.handlers.keyup.hasOwnProperty(event.context)){this.handlers.keyup[event.context] = {}}
            if(!this.handlers.keyup[event.context].hasOwnProperty(event.scope)){this.handlers.keyup[event.context][event.scope] = []}
            this.handlers.keyup[event.context][event.scope].push(event);
            this.handlers.keyup[event.context][event.scope].sort((a,b)=>{return a.useCapture == b.useCapture ? 0 : a.useCapture ? -1 : 1;});
        }
    }
    
    // retorna lista com modificadores e key ex. getScope('g+u+i') = [['g','u'], 'i'], mods retornados classificados
    _getScope(scope){
        let keys = scope.split(this.splitKey);
        let index = keys.lastIndexOf('');
        for(; index >= 0;){ // Trata existencia de + no scope ex: "ctrl++" ou "+"
            keys[index - 1] += this.splitKey;
            keys.splice(index, 1);
            index = keys.lastIndexOf('');
        }
        keys.forEach((el, index)=>{
            keys[index] = this.modifier[el] || el;
        })
        return [keys.slice(0, -1).sort(), keys[keys.length - 1]]
    }
    
    // retorna array com shortcuts ex: ('g+i;g+u') => ['g+i','g+u']
    _getMultipleKeys(scope){
        let keys = scope.split(this.separator); // cria array com blocos
        let index = keys.lastIndexOf('');
        for(; index >= 0;){ // Trata existencia de ; no scope ex: "ctrl+;"
            keys[index - 1] += ';';
            keys.splice(index, 1);
            index = keys.lastIndexOf('');
        }
        return keys;
    }
    
    // cria novo shortcut
    bind(scope, method, options={}){
        let keysList = this._getMultipleKeys(scope); // separa entradas multiplas ex: bind('g+i;g+u') => ['g+i','g+u']
        
        keysList.forEach((el, index)=>{ // percorre todas as entradas do escopo e prepara extrutura do shortcut
            let event = {...this.handlerOptions};
            for(let k in event){if(options.hasOwnProperty(k)){event[k] = options[k]}}
            [event.mods, event.key] = this._getScope(el);
            event.scope = [...event.mods, event.key].flat().join();
            event.schema = scope;
            event.method = method;
            if(index > 0){event.display = false} // evita de exibir duplicatas no modal de atalhos para atalhos multiplos
            let defaultMods = ['control','shift','alt','meta'];
            event.composed = event.mods.some(m => !defaultMods.includes((m || '').toLowerCase()));
            this._spread(event);
        })
    }
    unbind(scope, options={}){ // remove atalho especificado
        if(!options.hasOwnProperty('type')){ // se options.type omitido, chama recursivamente metodo tanto para keydown quando keyup
            ['keydown','keyup'].forEach((el)=>{
                options.type = el;
                this.unbind(scope, options)
            })
            return;
        }
        if(!options.context){ // se nao informado context, remove atalho de todos os contextos
            for(let k in this.contexts){ // chama recursivamente metodo para todos os escopos
                options.context = k;
                this.unbind(scope, options)
            }
            return;
        }
        if(!this.contexts.hasOwnProperty(options.context)){return} // se contexto informado nao existe termina codigo
        
        let entries = this._getScope(scope).flat().join();
        let matchs = this.handlers?.[options.type]?.[options.context]?.[entries] || [];
        if(matchs.length == 0){return false} // se nenhum match, termina bloco
        let residual = []; // armazena atalhos que nao seram afetados
        let count = 0;
        matchs.forEach((el, index)=>{
            if(options.element && options.element != el.element){residual.push(el)}
            else{count += 1;}
        })
        if(count == 0){return}
        if(residual.length > 0){this.handlers[options.type][options.context][entries] = residual}
        else{ // limpa entradas vazias apos remocao
            delete this.handlers[options.type][options.context][entries];
            if(Object.keys(this.handlers[options.type][options.context]).length === 0){delete this.handlers[options.type][options.context]}
            if(Object.keys(this.handlers[options.type]).length === 0){delete this.handlers[options.type]}
        }
        return true;
    }
    unbindContext(context){if(this.contexts.hasOwnProperty(context)){ // apaga TODAS as entradas para o contexto informado
        for(let type in this.handlers){
            if(this.handlers[type].hasOwnProperty(context)){delete this.handlers[type][context]}
            if(Object.keys(this.handlers[type]).length === 0){delete this.handlers[type]}
        }
    }}
    unbindGroup(group){ // remove todas as entradas do grupo especificado
        if(!group){return}
        for(let type in this.handlers){
            for(let context in this.handlers[type]){
                for(let scope in this.handlers[type][context]){
                    let residual = []
                    this.handlers[type][context][scope].forEach((el)=>{
                        if(el.group != group){residual.push(el)}
                    })
                    if(residual.length > 0){this.handlers[type][context][scope] = residual}
                    else{delete this.handlers[type][context][scope]}
                }
                if(Object.keys(this.handlers[type][context]).length === 0){delete this.handlers[type][context]}
            }
            if(Object.keys(this.handlers[type]).length === 0){delete this.handlers[type]}
        }
    }
    unbindAll(){this.handlers = {}} // limpa todos os atalhos
    overwrite(scope, method, options){ // sobregrava atalho informado (se existir), caso nao exista apenas cria novo atalho
        Object.assign(options, this.handlerOptions);
        this.unbind(scope, options);
        this.bind(scope, method, options);
    }
    getContext(){return this.context}
    addContext(context, desc=''){if(context && !this.contexts.hasOwnProperty(context)){this.contexts[context] = desc}}
    setContext(context, desc=''){
        // se nao informado contexto, assume ultimo contexto da pilha ou se vazio ajusta para default
        if(!context){ 
            this.context = this.contextPool.pop() || 'default';
            this.contextLabel.innerHTML = this.context;
            return;
        }
        if(!this.contexts.hasOwnProperty(context)){this.addContext(context, desc)} // Se novo contexto, chama metodo addContext
        else if(desc){this.contexts[context] = desc} // Desc pode ser alterado pelo metodo setContext
        this.contextPool.push(this.context);
        this.context = context;
        this.contextLabel.innerHTML = context;
    }
    updateContext(context, desc=''){if(this.contexts.hasOwnProperty(context)){this.contexts[context] = desc}}
    avail(scope, options={}){
        // retorna (bool) se shortcut esta disponivel, se nao informado contexto retorna true somente se shortcut disponivel em TODOS os contextos
        // se nao informado event.type assume 'keydown' como padrao
        // ## So deve ser usado para shortcut unico (sem entrada multipla)
        if(!options.hasOwnProperty('type')){options.type = 'keydown'}
        if(this.reserve.hasOwnProperty(scope)){console.log(this.reserve[scope])}
        scope = scope.replace(this.splitKey, ',');
        if(options.context){ // se informado contexto verifica se atalho existe no contexto
            if(!this.contexts.hasOwnProperty(options.context) || !this.handlers?.[options.type]?.[options.context]){return true}
            return !this.handlers[options.type][options.context].hasOwnProperty(scope);
        }
        else { // Se nao fornecido contexto, analisa todos os contextos para ver se entrada existe em algum
            for(let c in this.contexts){
                if(this.handlers?.[options.type]?.[c] && this.handlers[options.type][c].hasOwnProperty(scope)){return false}
            }
            return true;
        }
    }
    getReserve(){return this.reserve}
    duplicated(context='default'){ // retorna lista com detalhes dos schemas duplicados (leva em consideracao evento, contexto e elemento)
        let duplicatedList = [];
        for(let ev in this.handlers){
            for(let cx in this.handlers[ev]){
                for(let schema in this.handlers[ev][cx]){
                    if(this.handlers[ev][cx][schema].length > 1){
                        let unic = []
                        for(let sk in this.handlers[ev][cx][schema]){
                            let stringfy = JSON.stringify({event: ev, context: cx, schema: schema, element: this.handlers[ev][cx][schema][sk].element == window.document ? 'document' : this.handlers[ev][cx][schema][sk].element.id})
                            if(unic.includes(stringfy)){duplicatedList.push(JSON.parse(stringfy))}
                            else{unic.push(stringfy)}
                        }
                    }
                }
            }
        }
        return duplicatedList;
    }
    run(scope, options={}){ // executa atalho simulando que evento foi acionado ex appKeyMap.run('ctrl+c')
        let defaultOptions = {
            type: 'keydown',
            context: 'default',
            element: document
        }
        for(let k in defaultOptions){if(!options.hasOwnProperty(k)){options[k] = defaultOptions[k]}}
        if(this.handlers?.[options.type]?.[options.context]?.[scope.replace(this.splitKey, ',')]){
            this.handlers[options.type][options.context][scope.replace(this.splitKey, ',')].forEach((el)=>{
                if(el.element == options.element){el.method()}
            })
        }
    }
    showKeymap(){
        this._refreshMapTable();
        this.shortcutModal.showModal();
        this.locked = true;
        this.pressed = [];
    }
    _createModal(){
        this.shortcutModal = document.createElement('dialog'); this.shortcutModal.classList = this.shortcutModalClasslist;
        this.shortcutModal.onclose = ()=>{this.shortcutSearchInput.value = '';this.locked = false;} // Limpa input ao fechar modal e retorna contexto para default
        this.shortcutSearchInput = document.createElement('input');this.shortcutSearchInput.type = 'search';this.shortcutSearchInput.classList = this.searchInputClasslist;this.shortcutSearchInput.placeholder = this.searchInputPlaceholder;this.shortcutSearchInput.id = 'keywatch_shortcutSearchInput';
        this.shortcutSearchInput.oninput = (ev)=>{this._filterMapTable(ev)}
        this.contextLabel = document.createElement('span');this.contextLabel.classList = this.contextLabelClasslist;this.contextLabel.style = this.contextLabelStyle; this.contextLabel.innerHTML = this.context;
        this.shortcutModalTable = document.createElement('table');
        this.shortcutModalTable.classList = this.modalTableClasslist;
        this.shortcutModalTableThead = document.createElement('thead');
        this.shortcutModalTableTbody = document.createElement('tbody');
        this.shortcutModalTableThead.innerHTML = `<tr><th${!this.maplistShowCommands ? ' style="display: none;"' : ''}>Comando</th><th>Shortcut</th><th>Description</th><th class="${this.shortcutModalTableDetailClasslist}">${this.shortcutModalTableDetailText}</th></tr>`;
        this.shortcutModalTable.appendChild(this.shortcutModalTableThead);
        this.shortcutModalTable.appendChild(this.shortcutModalTableTbody);
        this.shortcutModal.appendChild(this.shortcutSearchInput);
        this.shortcutModal.appendChild(this.contextLabel);
        this.shortcutModal.appendChild(this.shortcutModalTable);
        document.body.appendChild(this.shortcutModal);
    }
    _refreshMapTable(source=this.handlers){ // atualiza tabela com shortcuts
        this.shortcutModalTableTbody.innerHTML = ''; // Limpa lista atual de atalhos
        for(let type in source){ // percorre todos os types
            for(let context in source[type]){ // percorre todos os contextos
                // Se shortcutMaplistOnlyContextActive = true so mostra shortcuts do contexto ativo e do all 
                if(this.shortcutMaplistOnlyContextActive && (context != this.context && context != 'all')){continue}
                for(let entries in source[type][context]){ // percorre todos os atalhos no contexto
                    source[type][context][entries].forEach((el)=>{
                        if(!el.display){return}
                        let shortcut = el.schema;
                        // Ajusta alias para versao abreviada ex (control = ctrl)
                        for(let key in this.modifier){shortcut = shortcut.replaceAll(this.modifier[key].toLowerCase(), key.toLowerCase())} 
                        shortcut = this._humanize(shortcut);
                        let title = '';
                        for(let attr in el){
                            if(!['origin','context','keydown','keyup','preventDefault','useCapture'].includes(attr)){continue}
                            title += `${attr}: ${el[attr]}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;\n`
                        }
                        let desc = el?.icon ? `<i class="${el.icon} me-2"></i>` : '';
                        desc += this.i18nHandler && el['data-i18n'] ? this.i18nHandler.getEntry(el['data-i18n']) || el?.desc || '' : el?.desc || '';
                        let tr = `
                        <tr>
                        <td>${shortcut}</td>
                        <td${el['data-i18n'] ? " data-i18n='" + el['data-i18n'] + "'" : "" }${el['data-i18n-dynamicKey'] ? ' data-i18n-dynamicKey=true' : ''}>${desc}</td>
                        <td title="${title}">${this.shortcutModalTableDetailItemText}</td>
                        </tr>
                        `;
                        this.shortcutModalTableTbody.innerHTML += tr;
                        
                    })
                }
            }
        }
        // Se utilizando integracao com i18n ajusta demais campos (inpit fields, etc)
        if(this.i18nHandler){
            this.shortcutSearchInput.placeholder = this.i18nHandler.getEntry('shortcuts.keywatch.searchInputPlaceholder') || this.defaultOptions.searchInputPlaceholder;
        }
    }
    _filterMapTable(ev){
        let term = this.shortcutSearchInput.value.toLowerCase();
        let trs = this.shortcutModalTableTbody.querySelectorAll('tr');
        for(let i = 0; i < trs.length; i++){
            let tds = trs[i].querySelectorAll('td');
            let rowValue = tds[0].innerHTML.replace(/<[^>]*>/g,'').toLowerCase();
            rowValue += tds[1].innerHTML.replace(/<[^>]*>/g,'').toLowerCase();
            rowValue += tds[2].innerHTML.replace(/<[^>]*>/g,'').toLowerCase();
            if(rowValue.replaceAll(/&nbsp;| /g,'').indexOf(term) < 0){trs[i].style.display = 'none'}
            else{trs[i].style.display = 'table-row'}
        }
    }
    
    _humanize(entry){ // recebe um schema de atalho e formata para exibicao na tabela de atalhos
        let entries = this._getMultipleKeys(entry);
        let formated = '';
        for(let i = 0; i < entries.length; i++){
            let schema = this._splitEntry(entries[i]);
            for(let j = 0; j < schema.length; j++){
                formated += `<small class="${this.modalTableLabelClasslist}">${schema[j].toUpperCase()}</small>`;
                if(j < schema.length - 1){formated += '+';}
            }
            if(i < entries.length - 1){formated += '&nbsp;&nbsp;ou&nbsp;&nbsp;';}
        }
        return formated;
    }
    _splitEntry(entry){ // retorna lista de caracteres de um shortcut. ex: 'g+i' = ['g', 'i']
        let keys = entry.split(this.splitKey); // cria array com blocos
        let index = keys.lastIndexOf('');
        for(; index >= 0;){ // trata conflito ao usar simbolo do splitKey no shortcut, ex splitKey = '+' e shortcut (alt++)
            keys[index - 1] += this.splitKey;
            keys.splice(index, 1);
            index = keys.lastIndexOf('');
        }
        return keys;
    }
    
}