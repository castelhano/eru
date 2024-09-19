

class keywatch{
    #handlers = {};                        // armazena shortcuts vinculados ao document
    #modifier = {                          // itens para conversao de codigo
    }
    #pressed = [];                         // lista com reclas precionadas
    #contexts = {                          // contextos disponiveis
        all: 'Atalhos Globais',
        default: 'Atalhos Base',
    };
    #context = 'default';                    // contexto ativo
    #handlerOptions = {                      // configuracoes padrao para shortcut
        context: 'default',
        element: document,
        keydown: true,
        keyup: false,
        group: null,
        useCapture: false
    }
    #defaultOptions = {                     // configuracoes padrao para classe
        splitKey: '+',
        separator: ';',
    }
    
    constructor(options={}){
        
        for(let k in this.#defaultOptions){ // carrega configuracoes para classe
            if(options.hasOwnProperty(k)){this[k] = options[k]}
            else{this[k] = this.#defaultOptions[k]}
        }

        // adiciona listeners basico para document
        this.#addEvent(document, 'keydown', this.#eventHandler, false);
        this.#addEvent(document, 'keyup', this.#eventHandler, false);
    }
    // adiciona listener no objeto
    #addEvent(element, event, method, useCapture=false){element.addEventListener(event, method, useCapture)}
    
    // adiciona listener no objeto
    #removeEvent(element, event, method, useCapture=false){element.removeEventListener(event, method, useCapture)}
    
    // trata os eventos e busca correspondente em this.handlers
    #eventHandler(ev){
        if(ev.type == 'keydown'){
            // verifica se tecla esta listada em #pressed, se nao faz push da tecla
            if(!this.#pressed.includes(ev.key.toLowerCase())){this.#pressed.push(ev.key.toLowerCase())}
            
            // analisa escopo base do evento
            let keys = this.#getEventScope(ev);


        }
        else if(ev.type == 'keyup'){}
    }
    
    // cria entrada em this.#handlers
    #dispatch(event){
        if(event.keydown){
            if(!this.#handlers.hasOwnProperty('keydown')){this.#handlers.keydown = {}}
            if(!this.#handlers.keydown.hasOwnProperty(event.context)){this.#handlers.keydown[event.context] = {}}
            if(!this.#handlers.keydown[event.context].hasOwnProperty(event.key)){this.#handlers.keydown[event.context][event.key] = []}
            this.#handlers.keydown[event.context][event.key].push(event);
        }
        if(event.keyup){
            if(!this.#handlers.hasOwnProperty('keyup')){this.#handlers.keyup = {}}
            if(!this.#handlers.keyup.hasOwnProperty(event.context)){this.#handlers.keyup[event.context] = {}}
            if(!this.#handlers.keyup[event.context].hasOwnProperty(event.key)){this.#handlers.keyup[event.context][event.key] = []}
            this.#handlers.keyup[event.context][event.key].push(event);
        }
    }
    
    // retorna lista com modificadores e key ex. getScope('g+u+i;q+u') = [['g','u'], 'i']
    #getScope(scope){
        let keys = scope.split(this.splitKey);
        return [keys.slice(0, -1), keys[keys.length - 1]]
    }

    // retorna lista com modificadores e key direto do evento
    #getEventScope(ev){
        let mods = [];
        if(ev.shiftKey){mods.push('shift')}
        if(ev.ctrlKey){mods.push('control')}
        if(ev.altKey){mods.push('alt')}
        return [mods, ev.key.toLowerCase()]
    }
    
    // cria novo shortcut
    bind(scope, method, options={}){
        /**
        * handlers
        * ** eventType [keydown, keyup]
        * ** * context
        * ** ** * key
        * ** ** ** * mods : [{entries..}]
        */
        let event = {...this.#handlerOptions};
        for(let k in event){if(options.hasOwnProperty(k)){event[k] = options[k]}}
        let keysList = scope.split(this.separator);
        keysList.forEach((el)=>{ // percorre todas as entradas do escopo e prepara extrutura do shortcut
            [event.mods, event.key] = this.#getScope(scope)
            if(!event.key){return false} // se escopo nao for valido, retorna false e termina codigo
            event.keys = scope;
            event.method = method;
            this.#dispatch(event);
        })
    }
    getHandlers(){return this.#handlers}
    unbind(scope, context='default'){}
    unbindContext(context){}
    unbindAll(){}
}