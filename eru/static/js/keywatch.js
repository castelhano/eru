

class Keywatch{
    constructor(options={}){
        let defaultOptions = { 
            tabOnEnter: true,           // Se true (default) implementa tabulacao para formularios ao precionar Enter
            customStyle: false,         // Se true (default) cria stilo basico para tabela de atalhos, altere para false para usar estilo personalizado
            shortcutMaplist: "alt+k",   // Atalho para exibir mapa com atalhos disposiveis para pagina, altere para null para desabilitar essa opcao
            maplistShowCommands: false, // Se true (default false) exibe no modal com lista de atalhos o comando para acionamento 
            delay: 600,                 // Delay em milissegundos para limpar o historico de sequencia
        }
        this.map = {};                  // Dicionario com os atalhos. Ex: this.map = {'all': {'ctrl+u;alt+y': {....}}}
        this.entries = {default:{}};    // Dicionario com apontadores para this.map, pois uma entrada de this.map pode ter varios shortcuts relacionados em this.entries
        this.sequences = {default:{}};  // Dicionario com apontadores para this.map de sequencia "q,w,e" "q,w,e;u"
        this.sequence = [];             // Sequencia com entrada parcial existente em this.sequences, aguardando conclusao
        this.commands = {default:{}};   // Dicionario com apontadores para this.map que implementa acionamento de atalho por comando
        this.pressed = [];              // Lista com teclas precionadas
        this.context = 'default';       // Contexto ativo (shortcut no context all serao executados em todos os contextos)
        for(let key in defaultOptions){ // Carrega configuracoes informadas ao instanciar objeto ou de defaultOptions se omitido
            this[key] = options.hasOwnProperty(key) ? options[key] : defaultOptions[key];
        }
        if(this.shortcutMaplist){this.bind(this.shortcutMaplist, this.showKeymap)}
        // ------
        window.addEventListener('keydown', (ev)=>{this._onKeyDown(ev, this)});
        window.addEventListener('keyup', (ev)=>{this._onKeyUp(ev, this)});
        window.addEventListener('focus', (ev)=>{this.pressed = []}); // Limpa lista de precionados ao receber foco (evita conflitos ao mover foco da pagina)
    }
    bind(shortcut, run, options={}){ // Adiciona novo atalho de teclado
        // shortcut: String com teclas a serem tratadas. Ex: "ctrl+u" "ctrl+alt+x" "ctrl+u;alt+y" "q,xe"
        // run: Function a ser executada quando acionado atalho
        // options: Dict com demais configuracoes: {context: 'default', element: null, visible: true}
        if(typeof shortcut != "string" || typeof run != "function"){return false} // Attrs shortcut (String) e run (Function) obrigatorios
        let context = options?.context || 'default';
        if(!this.map.hasOwnProperty(context)){this.map[context] = {}} // Verifica se context existe, se nao inicia entrada
        this.map[context][shortcut] = { // Cria entrada em this.map para novo shortcut (ou sobregrava se ja existir)
            run: run,
            options: options
        }
        if(options.hasOwnProperty('command')){ // Se foi atribuido comando para o shortcut, adiciona apontador no dict this.commands
            if(!this.commands.hasOwnProperty(context)){this.commands[context] = {}} // Inicia context em this.sequences (caso nao iniciado)
            this.commands[context][options.command] = this.map[context][shortcut];
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
    unbind(entry){}
    unbindContext(context){}
    _onKeyDown(ev, instance){
        clearTimeout(instance._sequenceTimeout);
        // Adiciona tecla em this.pressed (caso ainda nao esteja)
        if(!instance.pressed.includes(ev.key.toLowerCase())){
            instance.pressed.push(ev.key.toLowerCase())
        }
        
        
        // Chama metodo this._runKeydown que processa entrada 
        instance._runKeydown(ev);

    }
    _onKeyUp(ev, instance){
        clearTimeout(instance._sequenceTimeout);
        // Verifica se existe sequencia corresponte com a tecla digitada, se nao limpa this.sequence
        instance.pressed.splice(instance.pressed.indexOf(ev.key.toLowerCase())); // Libera tecla de this.pressed
        instance.sequence.push(ev.key.toLowerCase()); // Adiciona tecla em this.sequence
        let schema = instance.pressed.length > 0 ? instance.pressed.join('+') + '+' + instance.sequence.join(',') : instance.sequence.join(',');
        if(Object.keys(instance.sequences[instance.context]).filter(k => k.startsWith(schema)).length == 0){instance.sequence = []}
        instance._runKeyup(ev, schema);
        instance._sequenceTimeout = setTimeout(()=>{instance.sequence = []}, instance.delay); // Limpa this.sequence apos delay definido
    }
    _runKeydown(ev){
    // Busca entrada no dict this.entries que atenda criterios do shortcut, caso nao, se event.key = Enter e target vem de um form, implementa tabulacao no form
        let resp = true; // resp usada para o prevent.default(), se metodo run retornar false, prevent.default() sera acionado no evento
        let schema = this._getShortcutSchema();// this._getShortcutSchema retorna this.pressed no formato usado no sistema
        if(this.entries[this.context].hasOwnProperty(schema)){ // Verifica se existe shortcut em this.entries, se sim aciona metodo run()
            resp = this.entries[this.context][schema].run();
            if(!resp){ev.preventDefault()}
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
        if(this.sequences[this.context].hasOwnProperty(schema)){
            // Verifica se existe sequencia correspondente em this.sequences
            resp = this.sequences[this.context][schema].run();
            if(!resp){ev.preventDefault()}
            this.sequence = []; // Limpa sequencia
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
    _formTabulate(){}
    _getShortcutSchema(){ // Retorna array com escopo do shortcut e escopo de sequencia para ser tratado pelo metodo this._runKeydown()
        return this.pressed.join('+');
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
    humanize(entry){}
    showKeymap(){console.log('mostrando mapa de atalhos');}
}