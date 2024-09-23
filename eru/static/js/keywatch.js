/*
TODO: showKeyMap
TODO: avail
TODO: run
* Gerencia atalhos de teclado e implementa tabulacao ao pressionar Enter em formularios
*
* @version  6.0
* @since    05/08/2024
* @release  23/09/2024 [add keyup, multiple shortcuts]
* @author   Rafael Gustavo Alves {@email castelhano.rafael@gmail.com}
* @example  appKeyMap = new Keywatch();
* @example  appKeyMap.bind('ctrl+e', ()=>{...do something})
* @example  appKeyMap.bind('g+i;alt+i', ()=>{...do something}, {desc: 'Responde tanto no g+i quanto no alt+i', context: 'userModal'})
* @example  appKeyMap.bind('g+i', (ev, shortcut)=>{...do something}, {keyup: true, keydown: false, useCapture: true})
*/
class Keywatch{
    constructor(options={}){
        this.handlers = {};                        // armazena shortcuts vinculados ao document
        
        this.pressed = [];                         // lista com reclas precionadas
        this.contexts = {                          // contextos disponiveis
            all: 'Atalhos Globais',
            default: 'Atalhos Base',
        };
        this.context = 'default';                    // contexto ativo
        this.handlerOptions = {                      // configuracoes padrao para shortcut
            context: 'default',
            desc: '',
            element: document,
            keydown: true,
            keyup: false,
            group: null,
            display: true,
            preventDefault: true,
            useCapture: false
        }
        this.defaultOptions = {                     // configuracoes padrao para classe
            splitKey: '+',
            separator: ';',
            tabOnEnter: true,
        }
        
        for(let k in this.defaultOptions){ // carrega configuracoes para classe
            if(options.hasOwnProperty(k)){this[k] = options[k]}
            else{this[k] = this.defaultOptions[k]}
        }
        
        this.modifier = {                          // itens para conversao de codigo
            'ctrl': 'control',
            '[space]': ' ',
            'esc': 'escape',
            '↑': 'arrowup',
            '↓': 'arrowdown',
            '→': 'arrowright',
            '←': 'arrowleft',
        }
        
        // adiciona listeners basico para document
        this._addEvent(document, 'keydown', (ev)=>{this._eventHandler(ev, this)}, false);
        this._addEvent(document, 'keyup', (ev)=>{this._eventHandler(ev, this)}, false);
        this._addEvent(window, 'focus', (ev)=>{this.pressed = []}, false); // previne registro indevido no this.pressed ao perder o foco do document
    }
    
    // adiciona listener no objeto
    _addEvent(element, event, method, useCapture=false){element.addEventListener(event, method, useCapture)}
    
    // roda os methods atrelados aos shortcuts e retorna quantidade de matchs
    _eventsMatch(scope, ev){
        let prev = false; // prevent default
        let count = 0;
        let list = [
            ...this.handlers?.[ev.type]?.[this.context]?.[scope] || [],
            ...this.handlers?.[ev.type]?.['all']?.[scope] || []
        ];
        list.forEach((el)=>{
            if(el.element == document || el.element == ev.target){
                el.method(ev, el);
                count += 1;
                prev = prev || el.preventDefault;
            }
        })
        if(prev){ev.preventDefault()}
        return count;
    }
    
    // trata os eventos e busca correspondente em this.handlers
    _eventHandler(ev){
        let scope = this._getEventScope(ev); // scopo pata match em this.handlers
        let find = this._eventsMatch(scope, ev); // Busca inicialmente match no scopo simples do evento (sem analisar this.pressed)
        
        if(ev.type == 'keydown'){ // no keydown verifica se tecla esta listada em pressed, se nao faz push da tecla
            if(!this.pressed.includes(ev.key.toLowerCase())){this.pressed.push(ev.key.toLowerCase())}
            if(!find){ // caso nao localizado match no evento, analisa composicao com this.pressed
                scope = [this.pressed.slice(0, -1).sort(), this.pressed[this.pressed.length - 1]].join();
                find = this._eventsMatch(scope, ev); // Busca match de composicao
            }
        }
        else if(ev.type == 'keyup'){ // no keyup remove a tecla de this.pressed
            if(!find){ // caso nao localizado match no evento, analisa composicao com this.pressed ANTES de remover de this.press
                scope = [this.pressed.slice(0, -1).sort(), this.pressed[this.pressed.length - 1]].join();
                find = this._eventsMatch(scope, ev); // Busca match de composicao
            }
            if(this.pressed.indexOf(ev.key.toLowerCase()) > -1){this.pressed.splice(this.pressed.indexOf(ev.key.toLowerCase()), 1);} 
            else if(ev.keyCode == 18){this.pressed.splice(this.pressed.indexOf('alt'), 1)} // alt usado em combinacoes (alt+1+2) pode retornar simbolo diferente em ev.key
        }
    }
    
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
        keys.forEach((el, index)=>{
            keys[index] = this.modifier[el] || el;
        })
        return [keys.slice(0, -1).sort(), keys[keys.length - 1]]
    }
    
    // retorna string com scopo ex: 'control,i' (mods devem ser retornados em ordem alfabetica)
    _getEventScope(ev){
        let scope = [];
        if(ev.keyCode != 18 && ev.altKey){scope.push('alt')}
        if(ev.key != 'Control' && ev.ctrlKey){scope.push('control')}
        if(ev.key != 'Shift' && ev.shiftKey){scope.push('shift')}
        scope.push(ev.key.toLowerCase());
        return scope.join()
    }
    
    // cria novo shortcut
    bind(scope, method, options={}){
        let keysList = scope.split(this.separator); // separa entradas multiplas ex: bind('g+i;g+u') => ['g+i','g+u']
        
        keysList.forEach((el)=>{ // percorre todas as entradas do escopo e prepara extrutura do shortcut
            let event = {...this.handlerOptions};
            for(let k in event){if(options.hasOwnProperty(k)){event[k] = options[k]}}
            [event.mods, event.key] = this._getScope(el);
            event.scope = [...event.mods, event.key].flat().join();
            event.method = method;
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
    unbindContext(context){}
    unbindAll(){}
    getContext(){return this.context}
    addContext(context, desc=''){if(context){this.context[context] = desc}}
    setContext(context, desc=''){
        if(!this.contexts.hasOwnProperty(context)){this.addContext(context, desc)} // Se novo contexto, chama metodo addContext
        else if(desc){this.contexts[context] = desc} // Desc pode ser alterado pelo metodo setContext
        this.context = context;
    }
    updateContext(context, desc=''){if(this.contexts.hasOwnProperty(context)){this.contexts[context] = desc}}
    avail(scope, options={}){
        // retorna (bool) se shortcut esta disponivel, se nao informado contexto retorna true somente se shortcut disponivel em TODOS os contextos
        // se nao informado event.type assume 'keydown' como padrao
        // ## So deve ser usado para shortcut unico (sem entrada multipla)
        if(!options.hasOwnProperty('type')){options.type = 'keydown'}
        if(!options.hasOwnProperty('element')){options.element = document}
        scope = scope.replace(this.splitKey, ',');
        if(options.context){ // se informado contexto verifica se atalho existe no contexto
            if(!this.contexts.hasOwnProperty(options.context) || !this.handlers?.[options.type]?.[options.context]){return true}
            return !this.handlers[options.type][options.context].hasOwnProperty(scope);
        }
        else { // Se nao fornecido contexto, analisa todos os contextos para ver se entraa existe em algum
            for(let c in this.contexts){
                if(this.handlers?.[options.type]?.[c] && this.handlers[options.type][c].hasOwnProperty(scope)){return false}
            }
            return true;
        }
    }
}