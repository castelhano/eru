(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.keywatch = factory());
})(this, (function () { 'use strict';

    const handlers = {all:{}, default:{}};      // armazena todos os shortcuts
    const modifier = {                          // itens para conversao de codigo
    }
    const pressed = [];                         // lista com reclas precionadas
    const contexts = {                          // contextos disponiveis
        all: 'Atalhos Globais',
        default: 'Atalhos Base',
    };
    let context = 'default';                    // contexto ativo
    let handlerOptions = {                      // options default para shortcut
        context: 'default',
        keydown: true,
        keyup: false,
        group: null,
    }
    /**
     * handlers
     * ** eventType [keydown, keyup]
     * ** * context
     * ** ** * keycode
     * ** ** ** * mods : [{entries..}]
     */
    function addEvent(object, event, method, useCapture){}
    function removeEvent(object, event, method, useCapture){}
    function dispatch(event, element){ // trata listeners no document
    }
    function eventHandler(event, handler){}
    
    function getMods(key, mods=modifiers){}
    function getKeys(key){}

    function unbind(key, context='default'){}
    function unbindContext(context){}
    function unbindAll(){}

    function keywatch(keys, method, options){
        let entry = {
            keys: keys,
            method: method
        }
        for(let k in handlerOptions){
            entry[k] = options.hasOwnProperty(k) ? options[k] : handlerOptions[k];
        }
        

    }
    return keywatch;
}))