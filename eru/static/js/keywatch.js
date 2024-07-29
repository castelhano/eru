

class Keywatch{
    constructor(options){
        let defaultOptions = { 
            tabOnEnter: true,           // Se true (default) implementa tabulacao para formularios ao precionar Enter
            customStyle: false,         // Se true (default) cria stilo basico para tabela de atalhos, altere para false para usar estilo personalizado
            shortcutMaplist: "alt+k",   // Atalho para exibir mapa com atalhos disposiveis para pagina, altere para null para desabilitar essa opcao
            maplistShowCommands: false, // Se true (default false) exibe no modal com lista de atalhos o comando para acionamento 
        }
        this.map = {};              // Dicionario com os atalhos. Ex: this.map = {'all': {'ctrl+u;alt+y': {....}}}
        this.entries = {};          // Dicionario com apontadores para this.map, pois uma entrada de this.map pode ter varios shortcuts relacionados em this.entries
        this.sequences = {};        // Dicionario com os atalhos de sequencia "qwe" "qwe;u"
        this.sequence = '';         // Sequencia com entrada parcial existente em this.sequences, aguardando conclusao
        this.commands = {};         // Dicionario com apontadores para this.map que implementa acionamento de atalho por comando
        this.pressed = [];          // Lista com teclas precionadas
        this.context = 'default';   // Contexto ativo (atalho no context all serao executados em todos os contextos)
        // ------
        window.addEventListener('keydown', (ev)=>{this._onKeyDown(ev, this)});
        window.addEventListener('keyup', (ev)=>{this._onKeyUp(ev, this)});
        window.addEventListener('focus', (ev)=>{this.pressed = []}); // Limpa lista de precionados ao receber foco (evita conflitos ao mover foco da pagina)
    }
    bind(shortcut, run, options={}){ // Adiciona novo atalho de teclado
        // shortcut: String com teclas a serem tratadas. Ex: "ctrl+u" "ctrl+alt+x" "ctrl+u;alt+y" "q,xe"
        // run: Function a ser executada quando acionado atalho
        // options: Dict com demais configuracoes: {context: 'default', element: null, visible: true}
        if(typeof shortcut != "string" || typeof run != "function"){return false}
        let context = options?.context || 'default';
        if(!this.map.hasOwnProperty(context)){this.map[context] = {}} // Verifica se context existe, se nao inicia entrada
        this.map[context][shortcut] = { // Cria entrada em this.map para novo shortcut
            run: run,
            options: options
        }        
        let keys = this._getEntries(shortcut); // _getEntries retorna array com entradas do shortcut. Ex _getEntries('ctrl+u;alt+y') = ['ctrl+u','alt+y']
        for(let i = 0; i < keys.length; i++){ // 
            if(this._hasSequence(keys[i])){ // Se shortcut eh uma sequencia, adiciona sequencia em this.sequences
                // TODO......
                return
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
        // Adiciona tecla em this.pressed (caso ainda nao esteja)
        if(!instance.pressed.includes(ev.key)){
            instance.pressed.push(ev.key)
        }
        // Chama metodo run que roda 
        instance.run(ev, instance.pressed.join(','))

    }
    _onKeyUp(ev, instance){
        instance.pressed.splice(instance.pressed.indexOf(ev.key));
    }
    run(ev, shortcut, context=this.context){ // Busca entrada em this.map que atenda criterios do shortcut
        // console.log(shortcut);
        // ev.preventDefault()
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
}