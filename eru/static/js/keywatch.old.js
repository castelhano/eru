/*
* Gerencia atalhos de teclado e implementa tabulacao ao pressionar Enter em formularios
*
* @version  5.4
* @since    05/08/2024
* @release  13/09/2024 [add commands] | 29/08/2024 [_autoToggleContext]
* @author   Rafael Gustavo Alves {@email castelhano.rafael@gmail.com}
* @example  appKeyMap = new Keywatch();
* @example  appKeyMap.bind('ctrl+e', ()=>{...do something})
* @example  appKeyMap.bind('g+i;alt+i', ()=>{...do something}, {desc: 'Responde tanto no g+i quanto no alt+i', group: 'meuGrupo'})
*/
class KeywatchOld{
    constructor(options={}){
        let defaultOptions = { 
            tabOnEnter: true,                           // Se true (default) implementa tabulacao para formularios ao precionar Enter
            shortcutMaplist: "alt+k",                   // Atalho para exibir mapa com atalhos disposiveis para pagina, altere para null para desabilitar essa opcao
            shortcutMaplistDesc: "Exibe lista de atalhos disponiveis na página",
            shortcutMaplistOnlyContextActive: false,    // Se true so mostra atalhados do contexto ativo (alem do all)
            //Definicoes de estilizacao
            shortcutModalClasslist: 'w-100 h-100 border-2 border-secondary bg-dark-subtle mt-3',
            searchInputClasslist: 'form-control form-control-sm',
            searchInputPlaceholder: 'Criterio pesquisa',
            modalTableClasslist: 'table table-sm table-bordered table-striped mt-2 fs-7',
            modalTableLabelClasslist: 'border rounded py-1 px-2 bg-dark-subtle text-body-secondary font-monospace',
        }
        this._aliases = {                           // Dicionario com valores de conversao (alias), aplicado antes do bind
            'ctrl': 'control',
            '[space]': ' ',
            'esc': 'escape',
            '↑': 'arrowup',
            '↓': 'arrowdown',
            '→': 'arrowright',
            '←': 'arrowleft',
        }
        this.map = {all: {}, default:{}};           // Dicionario com os atalhos. Ex: this.map = {'all': {'ctrl+u;alt+y': {....}}}
        this.entries = {all: {}, default:{}};       // Dicionario com apontadores para this.map, pois uma entrada de this.map pode ter varios shortcuts relacionados em this.entries
        this.commands = {};                         // Dicionario com commandos, (usado no metodo runCommand) ignora contexto
        this.pressed = [];                          // Lista com teclas precionadas
        this.contexts = {                           // Armazena contextos disponiveis e uma breve descricao que sera usada no modal showKeyMap
            all: "Atalhos Globais",
            default: "Atalhos Base",
        };
        this.context = 'default';                   // Contexto ativo (shortcut no context all serao executados em todos os contextos)
        for(let key in defaultOptions){             // Carrega configuracoes informadas ao instanciar objeto ou de defaultOptions se omitido
            this[key] = options.hasOwnProperty(key) ? options[key] : defaultOptions[key];
        }
        this._createComponents();

        if(this.shortcutMaplist){this.bind(this.shortcutMaplist, ()=>{this.showKeymap();return false;}, {desc: this.shortcutMaplistDesc, context: 'all'})}
        // ------
        window.addEventListener('keydown', (ev)=>{this._onKeyDown(ev, this)});
        window.addEventListener('keyup', (ev)=>{this._onKeyUp(ev, this)});
        window.addEventListener('focus', (ev)=>{this.pressed = []}); // Limpa lista de precionados ao receber foco (evita conflitos ao mover foco da pagina)
        // ------
        this._autoToggleContext(); // Recorre document em busca de elementos para ativacao automatica de contexto
    }
    bind(shortcut, run, options={}){ // Adiciona novo shortcut
        // shortcut: String com teclas a serem tratadas. Ex: "control+u" "ctrl+alt+x" "ctrl+u;alt+y"
        // run: Function a ser executada quando acionado atalho
        // options: Dict com demais configuracoes: {context: 'default', element: null, visible: true}
        if(typeof shortcut != "string" || typeof run != "function"){return false} // Attrs shortcut (String) e run (Function) obrigatorios
        for(let alias in this._aliases){ // Converte entradas abreviadas (ex: ctrl = control)
            shortcut = shortcut.replaceAll(alias, this._aliases[alias]);
        }
        let context = options?.context || 'default';
        if(!this.contexts.hasOwnProperty(context)){this.addContext(context, '');} // Se novo contexto, chama metodo addContext
        
        let rawKeys = this._getEntries(shortcut); // _getEntries retorna array com entradas do shortcut. Ex _getEntries('ctrl+u;alt+y') = ['ctrl+u','alt+y']
        let keys = [];
        
        for(let i = 0; i < rawKeys.length; i++){ // Percorre rawKeys para tratar precenca de combinacoes com mais de um mod, se existir gera permutacoes da combinacao
            let split = this._splitEntry(rawKeys[i]);
            if(split.length > 2){ // Eh combinacao com mais de um mod
                keys.push(...this._getEntryPermuts(split));
            }
            else{keys.push(rawKeys[i])}
        }
        
        for(let i = 0; i < keys.length; i++){ // Verifica se algum atalho ja responde pela combinacao, se sim faz o unbind
            if(this.entries[context].hasOwnProperty(keys[i])){this.unbind(keys[i]);}
        }        
        this.map[context][shortcut] = { // Cria entrada em this.map para novo shortcut
            schema: shortcut,
            run: run,
            options: options
        }
        for(let i = 0; i < keys.length; i++){ // 
            if(!this.entries.hasOwnProperty(context)){this.entries[context] = {}} // Inicia context em this.entries (caso nao iniciado)
            this.entries[context][keys[i]] = this.map[context][shortcut];
        }
        if(options.hasOwnProperty('command')){ // Se foi atribuido comando para o shortcut, adiciona apontador no dict this.commands
            this.commands[options.command] = this.map[context][shortcut];
        }
    }
    unbind(entry, context=null){ // Remove shortcut, se nao informado contexto remove de todos os contextos
        if(!context){ // Se nao informado contexto, chama recursivamente metodo para todos os contextos
            for(let c in this.contexts){
                this.unbind(entry, c);
            }
            return;
        }
        if(!this.contexts.hasOwnProperty(context)){return} // Se contexto informado nao existe, termina bloco
        let entries = this._getEntries(entry); // Separa os grupos de shortcut (caso multiplo shortcut)
        for(let i = 0; i < entries.length; i++){ // Percorre parciais no shortcut
            if(this.entries[context].hasOwnProperty(entries[i])){ // Sobregrava em this.entries (caso entrada exista)
                if(this.entries[context][entries[i]].schema == entry){ // Se parcial e shortcut forem iguais, apaga entrada em this.map
                    delete this.map[context][this.entries[context][entries[i]].schema];
                    let split = this._splitEntry(entries[i]);
                    if(split.length > 2){ // Se shortcut for combo com mais de um modificador eh necessario apagar todas as possiveis permuts
                        let permuts = this._getEntryPermuts(split);
                        for(let j = 0; j < permuts.length; j++){
                            delete this.entries[context][permuts[j]];
                        }
                    }
                }
                else{ // Caso multi shortcut, apaga apenas parcial informada, nao eh possivel renomear chave, neste caso cria nova entrada e apaga anterior
                    let residue = this._removeEntry(entry, this.entries[context][entry].schema); // Remove a parcial do shortcut
                    this.map[context][residue] = {...this.entries[context][entry]}; // Cria copia com shortcut atualizado
                    this.map[context][residue].schema = residue; // Atualiza o schema no registro princial (map)
                    
                    // residue pode conter mais de um apontador, neste caso eh necessario iterar entre todos para atualizar referencia em this.map
                    let residues = this._getEntries(residue);
                    
                    for(let j = 0; j < residues.length; j++){
                        let split = this._splitEntry(residues[j]);
                        if(split.length > 2){ // Se shortcut for combo com mais de um modificador eh necessario atualiza ref em todas as possiveis permuts
                            let permuts = this._getEntryPermuts(split);
                            for(let k = 0; k < permuts.length; k++){
                                this.entries[context][permuts[k]] = this.map[context][residue];
                            }
                        }
                        else{ // Caso combo simples, apenas atualiza referencia da entrada
                            this.entries[context][residues[j]] = this.map[context][residue]; // Refaz apontador para nova entrada
                        }
                    }
                    delete this.map[context][this.entries[context][entries[i]].schema]; // Apaga entrada antiga
                }
                // ######## AJUSTAR AQUI, this._splitEntry(entries[i]) ja consta no bloco anterior ##########################
                if(this._splitEntry(entries[i]).length > 2){
                    let permuts = this._getEntryPermuts(this._splitEntry(entries[i]));
                    for(let k = 0; k < permuts.length; k++){
                        delete this.entries[context][permuts[k]];
                    }
                }
                else{
                    delete this.entries[context][entries[i]]; // Apaga entrada de this.entries
                }
            }
        }
    }
    unbindContext(context){ // Apaga todas as entradas do contexto
        if(!this.contexts.hasOwnProperty(context)){return}
        this.map[context] = {};
        this.entries[context] = {};
    }
    unbindGroup(group, context=null){
        if(!group || context && !this.contexts.hasOwnProperty(context)){return} // Se nao informado grupo ou se contexto informado inexistente termina bloco
        if(context){ // Se informado contexto, apaga entradas do grupo somente no contexto informado
            let entries = Object.fromEntries(Object.entries(this.map[context]).filter(([k,v]) => v.options.hasOwnProperty('group') && v.options.group == group)); // Filtra entrada com grupo informado
            for(let key in entries){ // Percorre os grupos para proceder com o unbind
                this.unbind(key, context);
            }
        }
        else{ // Se nao informado contexto, apaga todas as entradas do grupo em todos os contextos
            for(let c in this.contexts){ // Percorre todos so contextos e chama this.unbindGroup (recursivo)
                this.unbindGroup(group, c);
            }
        }
    }
    unbindAll(){ // Apaga todos as entradas e restaura escopos para estado original
        this.map = {all: {}, default:{}}
        this.entries = {all: {}, default:{}}
    }
    _onKeyDown(ev, instance){
        // Adiciona tecla em this.pressed (caso ainda nao esteja)
        try {
            if(!instance.pressed.includes(ev.key.toLowerCase())){instance.pressed.push(ev.key.toLowerCase());}
            instance._runKeydown(ev); // Aciona metodo this._runKeydown que processa entrada 
        } catch (e){}
    }
    _onKeyUp(ev, instance){
        try {
            if(instance.pressed.indexOf(ev.key.toLowerCase()) > -1){ // libera tecla precionada caso listada em this.pressed
                instance.pressed.splice(instance.pressed.indexOf(ev.key.toLowerCase()), 1); // Libera tecla de this.pressed
            }
            else if(instance.pressed.includes('alt')){ // Tecla alt se usada em composicao ex: (alt+1+2) retorna ev.key gerado pela combinacao, neste caso limpa alt do pressed
                instance.pressed.splice(instance.pressed.indexOf('alt')); // Libera recla alt de this.pressed
            }
        } catch (e){}
    }
    _runKeydown(ev){
    // Busca entrada no dict this.entries que atenda criterios do shortcut, caso nao, se event.key = Enter e target vem de um form, implementa tabulacao no form
        let match = this._bestMatch(ev); // metodo _bestMatch retorna melhor correspondente
        if(match){
            let resp = match.run(ev);
            if(resp === false)(ev.preventDefault())
        }
        else if(this.tabOnEnter && ev.key == 'Enter' && (ev.target.nodeName === 'INPUT' || ev.target.nodeName === 'SELECT')){
        // Se tecla Enter em input dentro de form, implementa tabulacao (ao instanciar defina {tabOnEnter: false} para desativar) ou no input defina attr data-escape_tab
        // logica trata elemento nao visiveis e/ou com index menor que zero e busca proximo elemento 
            try{
                if(ev.target.dataset?.keywatch == 'submit'){return false} // Adicione attr data-keywatch='default' no input para assumir evento padrao (submit do form)
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
    _getEntries(shortcut){ // Retorna lista de strings com triggers (usado em multiplos apontadores para mesmo shortcut). _getEntries('ctrl+u;alt+u') = ['ctrl+u','alt+u']
        let keys = shortcut.split(';'); // Cria array com blocos
        let index = keys.lastIndexOf('');
        for(; index >= 0;){ // Trata existencia de ; no shortcut ex: "ctrl+;"
            keys[index - 1] += ';';
            keys.splice(index, 1);
            index = keys.lastIndexOf('');
        }
        return keys;
    }
    _getEntryPermuts(list){ // Retorna array com todas as permutacoes de um shortcut ex _getEntryPermuts(['ctrl','alt','e']) = ['ctrl+alt+e','alt+ctrl+e']
        let result = []
        let trigger = list.pop(); // Remove ultima entrada (ficando apenas os mods)
        let permut = (arr, m = []) => {
            if (arr.length === 0){m.push(trigger); result.push(m.join('+'))}
            else {
                for (let i = 0; i < arr.length; i++) {
                    let curr = arr.slice();
                    let next = curr.splice(i, 1);
                    permut(curr.slice(), m.concat(next))
                }
            }
        }
        permut(list);
        return result;
    }
    _getKeyDownSchema(ev){ // retorna array com schemas possiveis no evento
        let list = [];
        if(ev.ctrlKey){list.push('control')}
        if(ev.shiftKey){list.push('shift')}
        if(ev.altKey){list.push('alt')}
        if(!['Control','Alt','Shift'].includes(ev.key)){list.push(ev.key.toLowerCase())}
        return this._getEntryPermuts(list)
    }
    _bestMatch(ev){ // retorna entrada (que melhor atenda) em this.map com shortcut ou false se nao localizado correspondente
        // prioriza entradas compostas a entradas simples (g+i antes de i), e contexto all tem prioridade em relacao 
        if(this.entries['all'].hasOwnProperty(this.pressed.join('+')) && (!this.entries['all'][this.pressed.join('+')].options.hasOwnProperty('element') || this.entries['all'][this.pressed.join('+')].options.element == ev.target)){return this.entries['all'][this.pressed.join('+')]}
        if(this.entries[this.context].hasOwnProperty(this.pressed.join('+')) && (!this.entries[this.context][this.pressed.join('+')].options.hasOwnProperty('element') || this.entries[this.context][this.pressed.join('+')].options.element == ev.target)){return this.entries[this.context][this.pressed.join('+')]}
        
        // analisa entrada simples (i ou ctrl+i, ....)
        let schema, index = 0, schemas = this._getKeyDownSchema(ev); // Recebe schemas possiveis do evento ([control+alt+e, alt+control+e])
        for(let i = 0;  i < schemas.length; i++){ // percorre os schemas, se localizar no context all ou entries retorna shortcut
            if(schemas[index].length == 1 && this.pressed.length > 1){continue}
            if(this.entries['all'].hasOwnProperty(schemas[index]) && (!this.entries['all'][schemas[index]].options.hasOwnProperty('element') || this.entries['all'][schemas[index]].options.element == ev.target)){return this.entries['all'][schemas[index]]}
            if(this.entries[this.context].hasOwnProperty(schemas[index]) && (!this.entries[this.context][schemas[index]].options.hasOwnProperty('element') || this.entries[this.context][schemas[index]].options.element == ev.target)){return this.entries[this.context][schemas[index]]}
        }
        return false;
    }
    _splitEntry(entry){ // Retorna lista de caracteres de um shortcut. ex: 'g+i' = ['g', 'i'] alem do separador usado
        let keys = entry.split('+'); // Cria array com blocos
        let index = keys.lastIndexOf('');
        for(; index >= 0;){ // Trata existencia de [';','+'] no shortcut ex: "ctrl+;" ou "alt++"
            keys[index - 1] += '+';
            keys.splice(index, 1);
            index = keys.lastIndexOf('');
        }
        return keys;
    }
    _removeEntry(entry, shortcut){ // Funcao auxiliar, remove parcial de um shortcut e retorna restante. ex: _removeEntry('g+i', 'g+i;a+i') = 'a+i'
        let entries = shortcut.split(';'); // Separa parciais num array
        entries.splice(entries.indexOf(entry), 1); // Remove parcial informada em entry
        return entries.join(';');
    }
    getContext(){return this.context}
    setContext(context='default', desc=''){
        if(!this.contexts.hasOwnProperty(context)){this.addContext(context, desc)} // Se novo contexto, chama metodo addContext
        else if(desc){this.contexts[context] = desc} // Desc pode ser alterado pelo metodo setContext
        this.context = context;
    }
    updateContext(context, desc=''){
        if(this.contexts.hasOwnProperty(context)){this.contexts[context] = desc} // Se contexto existe, atualiza desc
    }
    addContext(context='default', desc=''){
        this.map[context] = {};
        this.entries[context] = {};
        this.contexts[context] = desc;
    }
    showKeymap(){
        this._refreshMapTable();
        this.shortcutModal.showModal();
        this.setContext('keywatchModal');
    }
    avail(shortcut, context=null){
    // Retorna (bool) se shortcut esta disponivel, se nao informado contexto retorna true somente se shortcut disponivel em TODOS os contextos
    // ## So deve ser usado para shortcut unico (sem entrada multipla) 
        if(context){ // Se informado contexto verifica se atalho existe no contexto
            if(!this.contexts.hasOwnProperty(context)){return false;}
            return !this.entries[context].hasOwnProperty(shortcut);
        }
        else { // Se nao fornecido contexto, analisa todos os contextos para ver se entraa existe em algum
            let inUse = false;
            for(let c in this.contexts){
                if(this.entries[c].hasOwnProperty(shortcut)){inUse = true}
            }
            return !inUse;
        }
    }
    run(shortcut, context='default'){ // Roda funcao definida para o shortcut (caso exista), necessario informar o contexto
        if(!this.context.includes(context)){return false}
        if(this.entries[context].hasOwnProperty(shortcut)){
            this.entries[context][shortcut].run();
        }
    }
    runCommand(command=null){ // Aciona atalho pelo respectivo comando, se nao informado comando usa valor inserido em this.commandInput 
        if(this.commands.hasOwnProperty(command)){this.commands[command].run()}
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
    _refreshMapTable(source=this.map){
        this.shortcutModalTableTbody.innerHTML = ''; // Limpa lista atual de atalhos
        for(let context in source){ // Filtra todos os atalhos visiveis
            // Se shortcutMaplistOnlyContextActive = true so mostra shortcuts do contexto ativo e do all 
            if(this.shortcutMaplistOnlyContextActive && (context != this.context && context != 'all')){continue}
            for(let entry in source[context]){
                if(source[context][entry].options?.visible == false){continue}
                let shortcut = entry;
                // Ajusta alias para versao abreviada ex (control = ctrl)
                for(let key in this._aliases){shortcut = shortcut.replaceAll(this._aliases[key].toLowerCase(), key.toLowerCase())} 
                shortcut = this._humanize(shortcut);
                let tr = `
                <tr>
                <td>${shortcut}</td>
                <td>${source[context][entry].options?.desc || ''}</td>
                <td>${this.contexts[context]}</td>
                </tr>`;
                this.shortcutModalTableTbody.innerHTML += tr;
            }
        }
    }
    _humanize(entry){ // Recebe um schema de atalho e formata para exibicao na tabela de atalhos
        let entries = this._getEntries(entry);
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
    _autoToggleContext(){ // Implementa alteracao do contexto em elementos com tags predefinidas
        // Exemplo: <div data-kw-context="modalDelete" data-kw-context-start="show.bs.modal" data-kw-context-end="hide.bs.modal" ...>
        // data-kw-context          Nome do contexto a ser ativado
        // data-kw-context-start    Evento a ser escutado para ativar contexto
        // data-kw-context-end      Evento a ser escutado para ativar contexto
        document.querySelectorAll('[data-kw-context]').forEach((el)=>{
            if(el.hasAttribute('data-kw-context-start')){ // Evento start altera altera contexto informado
                el.addEventListener(el.dataset['kwContextStart'], ()=>{this.setContext(el.dataset['kwContext'])});
            }
            if(el.hasAttribute('data-kw-context-end')){ // Evento end retorna contexto para default
                el.addEventListener(el.dataset['kwContextEnd'], ()=>{this.setContext()});
            }
        })
    }
    _createComponents(){ // Cria modais e demais elementos para tabela de atalhos
        // Criando shortcutMapList
        this.shortcutModal = document.createElement('dialog'); this.shortcutModal.classList = this.shortcutModalClasslist;
        this.shortcutModal.onclose = ()=>{this.shortcutSearchInput.value = '';this.setContext();} // Limpa input ao fechar modal e retorna contexto para default
        this.shortcutSearchInput = document.createElement('input');this.shortcutSearchInput.type = 'search';this.shortcutSearchInput.classList = this.searchInputClasslist;this.shortcutSearchInput.placeholder = this.searchInputPlaceholder;this.shortcutSearchInput.id = 'keywatch_shortcutSearchInput';
        this.shortcutSearchInput.oninput = (ev)=>{this._filterMapTable(ev)}
        this.shortcutModalTable = document.createElement('table');
        this.shortcutModalTable.classList = this.modalTableClasslist;
        this.shortcutModalTableThead = document.createElement('thead');
        this.shortcutModalTableTbody = document.createElement('tbody');
        this.shortcutModalTableThead.innerHTML = `<tr><th${!this.maplistShowCommands ? ' style="display: none;"' : ''}>Comando</th><th>Shortcut</th><th>Descrição</th><th>Contexto</th></tr>`;
        this.shortcutModalTable.appendChild(this.shortcutModalTableThead);
        this.shortcutModalTable.appendChild(this.shortcutModalTableTbody);
        this.shortcutModal.appendChild(this.shortcutSearchInput);
        this.shortcutModal.appendChild(this.shortcutModalTable);
        document.body.appendChild(this.shortcutModal);
    }
}