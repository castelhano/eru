/**
 * showKeyMap
 */

class Keywatch{
    constructor(options={}){
        let defaultOptions = { 
            tabOnEnter: true,                                           // Se true (default) implementa tabulacao para formularios ao precionar Enter
            shortcutMaplist: "alt+k",                                   // Atalho para exibir mapa com atalhos disposiveis para pagina, altere para null para desabilitar essa opcao
            maplistShowCommands: false,                                 // Se true (default false) exibe no modal com lista de atalhos o comando para acionamento 
            shortcutPrompt: "f2",                                       // Atalho para exibir prompt de entrada de cmando, altere para null para desabilitar funcao
            customStyle: false,                                         // Altere para true para nao criar estilizacao padrao (class .keywatch_modal deve ser definida na pagina de origem)
            delay: 600,                                                 // Delay em milissegundos para limpar o historico de sequencia
            promptModalClasslist: 'keywatch_prompt_modal',              // Classlist para modal do prompt
            promptInputClasslist: 'form-control bg-body-tertiary mb-1', // Classlist para input do prompt

        }
        this._aliases = { // Dicionario com valores de conversao (alias), aplicado antes do bind
            'ctrl': 'control',
        }
        this.map = {all: {}, default:{}};                               // Dicionario com os atalhos. Ex: this.map = {'all': {'ctrl+u;alt+y': {....}}}
        this.entries = {all: {}, default:{}};                           // Dicionario com apontadores para this.map, pois uma entrada de this.map pode ter varios shortcuts relacionados em this.entries
        this.sequences = {all: {}, default:{}};                         // Dicionario com apontadores para this.map de sequencia "q,w,e" "q,w,e;u"
        this.sequence = [];                                             // Sequencia com entrada parcial existente em this.sequences, aguardando conclusao
        this.commands = {};                                             // Dicionario com apontadores para this.map que implementa acionamento de atalho por comando, comandos ignoram contexto
        this.pressed = [];                                              // Lista com teclas precionadas
        this.contexts = {                                               // Armazena contextos disponiveis e uma breve descricao que sera usada no modal showKeyMap
            all: "Atalhos Globais",
            default: "Atalhos Base",
        };
        this.context = 'default';                                       // Contexto ativo (shortcut no context all serao executados em todos os contextos)
        for(let key in defaultOptions){                                 // Carrega configuracoes informadas ao instanciar objeto ou de defaultOptions se omitido
            this[key] = options.hasOwnProperty(key) ? options[key] : defaultOptions[key];
        }
        if(!this.customStyle){this._addStyles()}
        this._createComponents();

        if(this.shortcutMaplist){this.bind(this.shortcutMaplist, ()=>{this.showKeymap()})}
        if(this.shortcutPrompt){
            this.bind(this.shortcutPrompt, ()=>{this.showPrompt()}, {context: 'all'}); // Cria atalho para abrir modal do prompt
            this.bind('enter', ()=>{this.runCommand();}, {element: this.promptInput, context: 'all'}); // Acerta atalho para comando ao precionar enter
        }
        // ------
        window.addEventListener('keydown', (ev)=>{this._onKeyDown(ev, this)});
        window.addEventListener('keyup', (ev)=>{this._onKeyUp(ev, this)});
        window.addEventListener('focus', (ev)=>{this.pressed = []});    // Limpa lista de precionados ao receber foco (evita conflitos ao mover foco da pagina)
    }
    _addStyles(){
        let style = document.createElement('style');
        style.innerHTML = '.keywatch_prompt_modal{margin-top: 20px;padding: 8px;border: 0;border-radius: 10px;width: 100%;}.keywatch_modal{padding: 8px;width: 100%;}@media (min-width: 576px){.keywatch_modal{max-width: 800px;} .keywatch_prompt_modal{max-width: 500px;}}';
        document.getElementsByTagName('head')[0].appendChild(style);
    }
    bind(shortcut, run, options={}){ // Adiciona novo shortcut
        // shortcut: String com teclas a serem tratadas. Ex: "control+u" "ctrl+alt+x" "ctrl+u;alt+y" "q+x,e"
        // run: Function a ser executada quando acionado atalho
        // options: Dict com demais configuracoes: {context: 'default', element: null, visible: true}
        if(typeof shortcut != "string" || typeof run != "function"){return false} // Attrs shortcut (String) e run (Function) obrigatorios
        for(let alias in this._aliases){ // Converte entradas abreviadas (ex: ctrl = control)
            shortcut = shortcut.replaceAll(alias, this._aliases[alias]);
        }
        let context = options?.context || 'default';
        if(!this.contexts.hasOwnProperty(context)){this.addContext(context, '');} // Se novo contexto, chama metodo addContext
        // if(!this.map.hasOwnProperty(context)){this.map[context] = {}} // Verifica se context existe, se nao inicia entrada
        this.map[context][shortcut] = { // Cria entrada em this.map para novo shortcut (ou sobregrava se ja existir)
            schema: shortcut,
            run: run,
            options: options
        }
        if(options.hasOwnProperty('command')){ // Se foi atribuido comando para o shortcut, adiciona apontador no dict this.commands
            this.commands[options.command] = this.map[context][shortcut];
        }
        let keys = this._getEntries(shortcut); // _getEntries retorna array com entradas do shortcut. Ex _getEntries('ctrl+u;alt+y') = ['ctrl+u','alt+y']
        for(let i = 0; i < keys.length; i++){ // 
            if(this._hasSequence(keys[i])){ // Se shortcut eh uma sequencia, adiciona apontador em this.sequences
                if(!this.sequences.hasOwnProperty(context)){this.sequences[context] = {}} // Inicia context em this.sequences (caso nao iniciado)
                this.sequences[context][keys[i]] = this.map[context][shortcut];
            }
            else{ // Caso nao, adiciona apontador em this.entries no respectivo context
                if(!this.entries.hasOwnProperty(context)){this.entries[context] = {}} // Inicia context em this.entries (caso nao iniciado)
                this.entries[context][keys[i]] = this.map[context][shortcut];
            }
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
            if(this._hasSequence(entries[i]) && this.sequences[context].hasOwnProperty(entries[i])){ // Verifica se existe sequencia no shortcut e correspondente em this.sequence
                if(this.sequences[context][entries[i]].schema == entry){ // Se parcial e shortcut forem iguais, apaga entrada em this.map
                    if(this.sequences[context][entries[i]].options.hasOwnProperty('command')){ // Se shortcut tem comando associado, remove entrada de this.commands
                        delete this.commands[this.sequences[context][entries[i]].options.command];
                    }
                    delete this.map[context][this.sequences[context][entries[i]].schema];
                }
                else{ // Caso multi shortcut, apaga apenas parcial informada, nao eh possivel renomear chave, neste caso cria nova entrada e apaga anterior
                    let residue = this._removeEntry(entry, this.sequences[context][entry].schema); // Remove a parcial do shortcut
                    this.map[context][residue] = {...this.sequences[context][entry]}; // Cria copia com shortcut atualizado
                    this.map[context][residue].schema = residue; // Atualiza o schema no registro princial (map)
                    if(this.sequences[context][entries[i]].options.hasOwnProperty('command')){ // Se shortcut tem comando associado, atualiza apontador
                        this.commands[this.sequences[context][entries[i]].options.command] = this.map[context][residue];
                    }
                    // resisue pode conter mais de um apontador, neste caso eh necessario iterar entre todos para atualizar referencia em this.map
                    let residues = this._getEntries(residue);
                    for(let j = 0; j < residues.length; j++){
                        if(this._hasSequence(residues[j])){
                            this.sequences[context][residue] = this.map[context][residues[j]]; // Refaz apontador para nova entrada
                        }
                        else{
                            this.entries[context][residue] = this.map[context][residues[j]]; // Refaz apontador para nova entrada
                        }
                    }                    
                    delete this.map[context][this.sequences[context][entries[i]].schema]; // Apaga entrada antiga
                }
                delete this.sequences[context][entries[i]]; // Apaga entrada de this.sequences
            }
            else if(this.entries[context].hasOwnProperty(entries[i])){ // Caso nao seja sequencia atualiza em this.entries (caso entrada exista)
                if(this.entries[context][entries[i]].schema == entry){ // Se parcial e shortcut forem iguais, apaga entrada em this.map
                    if(this.entries[context][entries[i]].options.hasOwnProperty('command')){ // Se shortcut tem comando associado, remove entrada de this.commands
                        delete this.commands[this.entries[context][entries[i]].options.command];
                    }
                    delete this.map[context][this.entries[context][entries[i]].schema];
                }
                else{ // Caso multi shortcut, apaga apenas parcial informada, nao eh possivel renomear chave, neste caso cria nova entrada e apaga anterior
                    let residue = this._removeEntry(entry, this.entries[context][entry].schema); // Remove a parcial do shortcut
                    this.map[context][residue] = {...this.entries[context][entry]}; // Cria copia com shortcut atualizado
                    this.map[context][residue].schema = residue; // Atualiza o schema no registro princial (map)
                    if(this.entries[context][entries[i]].options.hasOwnProperty('command')){ // Se shortcut tem comando associado, atualiza apontador
                        this.commands[this.entries[context][entries[i]].options.command] = this.map[context][residue];
                    }
                    // resisue pode conter mais de um apontador, neste caso eh necessario iterar entre todos para atualizar referencia em this.map
                    let residues = this._getEntries(residue);
                    for(let j = 0; j < residues.length; j++){
                        if(this._hasSequence(residues[j])){
                            this.sequences[context][residue] = this.map[context][residues[j]]; // Refaz apontador para nova entrada
                        }
                        else{
                            this.entries[context][residue] = this.map[context][residues[j]]; // Refaz apontador para nova entrada
                        }
                    }
                    delete this.map[context][this.entries[context][entries[i]].schema]; // Apaga entrada antiga
                }
                delete this.entries[context][entries[i]]; // Apaga entrada de this.sequences
            }
        }
    }
    unbindContext(context){ // Apaga todas as entradas do contexto
        if(!this.contexts.hasOwnProperty(context)){return}
        let commands = Object.fromEntries(Object.entries(this.map[context]).filter(([k,v]) => v.options.hasOwnProperty('command'))); // Filtra entrada com comando
        for(let key in commands){delete this.commands[commands[key].options.command]} // Apaga entradas em commands
        this.map[context] = {};
        this.entries[context] = {};
        this.sequences[context] = {};
    }
    unbindGroup(group, context=null){
        if(!group || context && !this.contexts.hasOwnProperty(context)){return} // Se nao informado grupo ou se contexto informado inexistente termina bloco
        if(context){ // Se informado contexto, apaga entradas do grupo somente no contexto informado
            let groups = Object.fromEntries(Object.entries(this.map[context]).filter(([k,v]) => v.options.hasOwnProperty('group') && v.options.group == group)); // Filtra entrada com grupo informado
            for(let key in groups){ // Percorre os grupos para proceder com o unbind
                this.unbind(key, context);
            }
        }
        else{ // Se nao informado contexto, apaga todas as entradas do grupo em todos os contextos
            for(let c in this.contexts){ // Percorre todos so contextos e chama this.unbindGroup (recursivo)
                this.unbindGroup(group, c);
            }
        }
    }
    _onKeyDown(ev, instance){
        clearTimeout(instance._sequenceTimeout);
        // Adiciona tecla em this.pressed (caso ainda nao esteja)
        try {
            if(!instance.pressed.includes(ev.key.toLowerCase())){instance.pressed.push(ev.key.toLowerCase())}
            instance._runKeydown(ev); // Aciona metodo this._runKeydown que processa entrada 
        } catch (e){}
    }
    _onKeyUp(ev, instance){
        clearTimeout(instance._sequenceTimeout);
        // Verifica se existe sequencia corresponte com a tecla digitada, se nao limpa this.sequence
        try {
            instance.pressed.splice(instance.pressed.indexOf(ev.key.toLowerCase())); // Libera tecla de this.pressed
            instance.sequence.push(ev.key.toLowerCase()); // Adiciona tecla em this.sequence
            let schema = instance.pressed.length > 0 ? instance.pressed.join('+') + '+' + instance.sequence.join(',') : instance.sequence.join(',');
            if(Object.keys(instance.sequences[instance.context]).filter(k => k.startsWith(schema)).length == 0){instance.sequence = []}
            instance._runKeyup(ev, schema);
            instance._sequenceTimeout = setTimeout(()=>{instance.sequence = []}, instance.delay); // Limpa this.sequence apos delay definido
        } catch (e){}
    }
    _runKeydown(ev){
    // Busca entrada no dict this.entries que atenda criterios do shortcut, caso nao, se event.key = Enter e target vem de um form, implementa tabulacao no form
        let resp = true; // resp usada para o prevent.default(), se metodo run retornar false, prevent.default() sera acionado no evento
        let schema = this.pressed.join('+');// monta teclas precionadas na notacao usada pela lib
        let findOnAll = this.entries['all'].hasOwnProperty(schema) && (!this.entries['all'][schema].options.hasOwnProperty('element') || this.entries['all'][schema].options.element == ev.target);
        let findOnEntries = this.entries[this.context].hasOwnProperty(schema) && (!this.entries[this.context][schema].options.hasOwnProperty('element') || this.entries[this.context][schema].options.element == ev.target);
        if(findOnAll || findOnEntries){
        // Verifica se existe shortcut em this.entries no contexto ativo ou no all, se sim aciona metodo run(), se especificado target verifica se foco esta no elemento especificado
            if(findOnAll){resp = [undefined, true].includes(this.entries['all'][schema].run(ev))&& resp}
            if(findOnEntries){resp = this.entries[this.context][schema].run(ev) == undefined  && resp}
            if(!resp){ev.preventDefault();
            }
            this.sequence = []; // Limpa sequencia
        }
        else if(this.tabOnEnter && ev.key == 'Enter' && (ev.target.nodeName === 'INPUT' || ev.target.nodeName === 'SELECT')){
        // Se tecla Enter em input dentro de form, implementa tabulacao (ao instanciar defina {tabOnEnter: false} para desativar) ou no input defina attr data-escape_tab=false
        // logica trata elemento nao visiveis e/ou com index menor que zero e busca proximo elemento 
            try{
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
            this.sequence = []; // Limpa sequencia
        }
    }
    _runKeyup(ev, schema){
        let resp = true;
        if(this.sequences[this.context].hasOwnProperty(schema) && (!this.sequences[this.context][schema].options.hasOwnProperty('element') || this.sequences[this.context][schema].options.element == ev.target)){
        // Verifica se existe sequencia correspondente em this.sequences
            resp = this.sequences[this.context][schema].run(ev);
            if(!resp){ev.preventDefault()}
            this.sequence = []; // Limpa sequencia
        }
    }
    runCommand(command=null){ // Aciona atalho pelo respectivo comando, se nao informado comando usa valor inserido em this.commandInput 
        if(command){
            if(this.commands.hasOwnProperty(command)){this.commands[command].run()}
        }
        else {
            if(this.commands.hasOwnProperty(this.promptInput.value)){this.commands[this.promptInput.value].run()}
        }
    }
    _hasSequence(shortcut){ // Verifica se existe sequencia no shortcut, se sim retorna array com sequencias, se nao retorna false
        if(!shortcut.includes(',')){return false} // Nao existe , no shortcut, retorna falso
        let keys = shortcut.split(',');
        let index = keys.lastIndexOf(''); // Se existe entrada vazia '' remove entrada e adiciona , no key anterior
        for(; index >= 0;){ // Trata existencia de , no escopo do shortcut ("alt+,")
            keys[index - 1] += ',';
            keys.splice(index, 1);
            index = keys.lastIndexOf('');
        }
        return keys.length > 1 ? keys : false;
    }
    _getEntries(shortcut){ // Retorna lista de strings com triggers (usado em multiplos apontadores para mesmo shortcut). _getEntries('ctrl+u;alt+u') = ['ctrl+u','alt+u']
        let keys = shortcut.split(';'); // Cria array com blocos
        let index = keys.lastIndexOf('');
        for(; index >= 0;){ // Trata existencia de ; no shortcut "ctrl+;"
            keys[index - 1] += ';';
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
    humanize(entry){}
    getContext(){return this.context}
    setContext(context='default', desc=''){
        if(!this.contexts.hasOwnProperty(context)){this.addContext(context, desc)} // Se novo contexto, chama metodo addContext
        this.context = context;
    }
    updateContext(context, desc=''){
        if(this.contexts.hasOwnProperty(context)){this.contexts[context] = desc} // Se contexto existe, atualiza desc
    }
    addContext(context='default', desc=''){
        this.map[context] = {};
        this.entries[context] = {};
        this.sequences[context] = {};
        this.contexts[context] = desc;
    }
    showKeymap(){console.log('mostrando mapa de atalhos');}
    showPrompt(){ // Exibe modal para entrada de comando
        this.commandDataList.innerHTML = '';
        for(let key in this.commands){ // Atualiza os comandos disponiveis no datalist
            let opt = document.createElement('option');opt.value = key;opt.innerHTML = key;
            this.commandDataList.appendChild(opt);            
        }

        this.promptModal.showModal();
    }
    _createComponents(){ // Cria modais e demais elementos para tabela de atalhos alem de prompt para entarda de comando
        this.promptModal = document.createElement('dialog'); this.promptModal.classList = this.promptModalClasslist;
        this.promptModal.oncancel = ()=>{this.promptInput.value = ''} // Limpa input ao fechar modal
        this.commandDataList = document.createElement('datalist');this.commandDataList.id = 'keywatch_datalist';
        this.promptInput = document.createElement('input');this.promptInput.type = 'search';this.promptInput.classList = this.promptInputClasslist;this.promptInput.placeholder = 'Comando';this.promptInput.setAttribute('list', 'keywatch_datalist');
        this.promptModal.appendChild(this.commandDataList);
        this.promptModal.appendChild(this.promptInput);
        document.body.appendChild(this.promptModal);
    }
}