

class KeywatchNew{
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
            element: document,
            keydown: true,
            keyup: false,
            group: null,
            display: true,
            preventDefault: false,
            useCapture: false
        }
        this.defaultOptions = {                     // configuracoes padrao para classe
            splitKey: '+',
            separator: ';',
        }
        
        for(let k in this.defaultOptions){ // carrega configuracoes para classe
            if(options.hasOwnProperty(k)){this[k] = options[k]}
            else{this[k] = this.defaultOptions[k]}
        }
        
        let isff = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase().indexOf('firefox') > 0 : false;
        this.modifier = {                          // itens para conversao de codigo
            'ctrl': 'control',
            '[space]': ' ',
            'esc': 'escape',
            '↑': 'arrowup',
            '↓': 'arrowdown',
            '→': 'arrowright',
            '←': 'arrowleft',
        }
        
        this.keyMap = {
            shiftkey: 16, 
            ctrlkey: 17, 
            altkey: 18, 
            backspace: 8,
            '⌫': 8,
            tab: 9,
            clear: 12,
            enter: 13,
            '↩': 13,
            return: 13,
            esc: 27,
            escape: 27,
            space: 32,
            left: 37,
            up: 38,
            right: 39,
            down: 40,
            del: 46,
            delete: 46,
            ins: 45,
            insert: 45,
            home: 36,
            end: 35,
            pageup: 33,
            pagedown: 34,
            capslock: 20,
            num_0: 96,
            num_1: 97,
            num_2: 98,
            num_3: 99,
            num_4: 100,
            num_5: 101,
            num_6: 102,
            num_7: 103,
            num_8: 104,
            num_9: 105,
            num_multiply: 106,
            num_add: 107,
            num_enter: 108,
            num_subtract: 109,
            num_decimal: 110,
            num_divide: 111,
            '⇪': 20,
            ',': 188,
            '.': 190,
            '/': 191,
            '`': 192,
            '-': isff ? 173 : 189,
            '=': isff ? 61 : 187,
            ';': isff ? 59 : 186,
            '\'': 222,
            '[': 219,
            ']': 221,
            '\\': 220
        };
        
        // adiciona listeners basico para document
        this.addEvent(document, 'keydown', (ev)=>{this._eventHandler(ev, this)}, false);
        this.addEvent(document, 'keyup', (ev)=>{this._eventHandler(ev, this)}, false);
    }
    // adiciona listener no objeto
    addEvent(element, event, method, useCapture=false){element.addEventListener(event, method, useCapture)}
    
    // adiciona listener no objeto
    removeEvent(element, event, method, useCapture=false){element.removeEventListener(event, method, useCapture)}
    
    _eventsRun(list, ev){
        let prev = true; // prevent default
        list.forEach((el)=>{
            if(el.element == document || el.element == ev.target){
                el.method();
                prev = prev || el.preventDefault;
            }
        })
        if(prev){ev.preventDefault()}
    }

    // trata os eventos e busca correspondente em this.handlers
    _eventHandler(ev){
        if(ev.type == 'keydown'){
            // verifica se tecla esta listada em pressed, se nao faz push da tecla

            if(!this.pressed.includes(this.keyMap[ev.key.toLowerCase()] || ev.key.toLowerCase().charCodeAt(0))){
                this.pressed.push(this.keyMap[ev.key.toLowerCase()] || ev.key.toLowerCase().charCodeAt(0))
                console.log('down', this.pressed);
                
                
                // analisa escopo base do evento
                let keys = this.getEventScope(ev);
                
                // let find
                if(this.handlers?.['keydown']?.[this.context]?.[keys[1]]?.[keys[0].join(',')]){ // localiza correspondentes do evento
                    this._eventsRun(this.handlers['keydown'][this.context][keys[1]][keys[0].join(',')], ev);
                }
                if(this.handlers?.['keydown']?.['all']?.[keys[1]]?.[keys[0].join(',')]){ // localiza correspondentes do evento
                    this._eventsRun(this.handlers['keydown']['all'][keys[1]][keys[0].join(',')], ev);
                }
            }
            
            
        }
        else if(ev.type == 'keyup'){
            console.log(this.pressed.indexOf(this.keyMap[ev.key.toLowerCase()] || ev.key.toLowerCase().charCodeAt(0)));
            
            if(this.pressed.indexOf(this.keyMap[ev.key.toLowerCase()] || ev.key.toLowerCase().charCodeAt(0)) > -1){ // libera tecla precionada caso listada em this.pressed
                this.pressed.splice(this.keyMap[ev.key.toLowerCase()] || ev.key.toLowerCase().charCodeAt(0), 1); // Libera tecla de this.pressed
                console.log('up', this.pressed);
            }
            // else if(String.fromCharCode(ev.keyC )== 18 && this.pressed.includes('alt')){ // tecla alt se usada em composicao ex: (alt+1+2) retorna ev.key gerado pela combinacao, neste caso limpa alt do pressed
            //     this.pressed.splice(this.pressed.indexOf('alt')); // Libera recla alt de this.pressed
            // }
        }
    }
    
    // cria entrada em this.handlers
    dispatch(event){
        if(event.keydown){
            if(!this.handlers.hasOwnProperty('keydown')){this.handlers.keydown = {}}
            if(!this.handlers.keydown.hasOwnProperty(event.context)){this.handlers.keydown[event.context] = {}}
            if(!this.handlers.keydown[event.context].hasOwnProperty(event.key)){this.handlers.keydown[event.context][event.key] = []}
            if(!this.handlers.keydown[event.context][event.key].hasOwnProperty(event.mods.join(','))){this.handlers.keydown[event.context][event.key][event.mods.join(',')] = []}
            this.handlers.keydown[event.context][event.key][event.mods.join(',')].push(event);
        }
        if(event.keyup){
            if(!this.handlers.hasOwnProperty('keyup')){this.handlers.keyup = {}}
            if(!this.handlers.keyup.hasOwnProperty(event.context)){this.handlers.keyup[event.context] = {}}
            if(!this.handlers.keyup[event.context].hasOwnProperty(event.key)){this.handlers.keyup[event.context][event.key] = []}
            if(!this.handlers.keyup[event.context][event.key].hasOwnProperty(event.mods.join(','))){this.handlers.keyup[event.context][event.key][event.mods.join(',')] = []}
            this.handlers.keyup[event.context][event.key][event.mods.join(',')].push(event);
        }
    }
    
    // retorna lista com modificadores e key ex. getScope('g+u+i') = [[103,117], 105]
    getScope(scope){
        let keys = scope.split(this.splitKey);
        keys.forEach((el, index)=>{
            keys[index] = this.keyMap[el] || el.charCodeAt(0)
        })
        return [keys.slice(0, -1).sort(), keys[keys.length - 1]]
    }
    
    // retorna lista com modificadores e key direto do evento
    getEventScope(ev){
        let mods = [];
        if(ev.keyCode != 16 && ev.shiftKey){mods.push(16)}
        if(ev.keyCode != 17 && ev.ctrlKey){mods.push(17)}
        if(ev.keyCode != 18 && ev.altKey){mods.push(18)}
        return [mods, String.fromCharCode(ev.key)]
    }
    
    // cria novo shortcut
    bind(scope, method, options={}){
        let event = {...this.handlerOptions};
        for(let k in event){if(options.hasOwnProperty(k)){event[k] = options[k]}}
        let keysList = this._getKeyCodes(scope.split(this.separator)); // recebe codigos na ordem informada no bind
        
        keysList.forEach((el)=>{ // percorre todas as entradas do escopo e prepara extrutura do shortcut
            [event.mods, event.key] = this.getScope(scope)
            event.keys = scope;
            event.method = method;
            this.dispatch(event);
        })
    }
    _getKeyCodes(list){ // recebe array com string de teclas e devolve char codes ex ['alt', 'e'] => [18, 69]
        let keyCodes = [];
        list.forEach((el)=>{
            keyCodes.push(this.modifier[el] || el.charCodeAt(0))
        })
        return keyCodes
    }
    unbind(scope, context='default'){}
    unbindContext(context){}
    unbindAll(){}
}