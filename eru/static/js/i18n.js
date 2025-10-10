/*
* I18n      Lib para interlacionalização de codigo
*
* @version  1.3
* @release  02/10/2025
* @since    08/10/2025 [ajustes de bugs, remocao de populatedDefaultLanguage]
* @author   Rafael Gustavo Alves {@email castelhano.rafael@gmail.com }
* @depend   na
* @example  const i18n = new I18n({apps: ['core']})
*/

class I18n{
    constructor(options){
        this.db = localStorage.getItem('i18nDB') ? JSON.parse(localStorage.getItem('i18nDB'))  : {}; // Base com idioma(s), entrada com idioma default montado de maneira automatica ao instanciar objeto
        this.apps = localStorage.getItem('i18nApps') ? localStorage.getItem('i18nApps').split(',') : [];
        let defaultOptions = {
            url: 'i18n',                                // URL para consulta ajax, (recebe app e lng) deve retornar json com entradas de trducao
            method: 'GET',                              // Metodo de consulta
            autoDetect: true,                           // Inicia traducao a partir de idioma do navegador navigator.language || navigator.userLanguage
            defaultLanguage: 'pt-BR',                   // Idioma padrao (paginas devem ser construidas neste idioma)
            callbackLanguage: null,                     // Idioma a ser buscado caso nao localizado arquivo de traducao
            switcher: null,                             // Elemento select para troca de idioma 
            notifyFunction: null,                       // Funcao para notificacao func(style, message, autodismiss)
            notFoundMsg: 'Não encontrado arquivo de tradução para linguagem selecionada'
        }
        
        for(let k in defaultOptions){ // carrega configuracoes para classe
            if(options.hasOwnProperty(k)){this[k] = options[k]}
            else{this[k] = defaultOptions[k]}
        }
        this.language = localStorage.getItem('i18nLanguage') || this.defaultLanguage; // this.language armazena o idioma ativo, inicia setado com defaultLanguage
        if(this.apps.length == 0 && options?.apps && Array.isArray(options.apps)){this.apps = options.apps}
        if(this.switcher){this.setSwitcher(this.switcher)}
    }
    init(){
        
        /** Ordem de prioridade para identificacao do idioma
         * 1 - Verifica existencia localStorage[i18nLanguage]
         * 2 - Se autoDetect = true, busca idioma do navegador
         * 3 - Aguarda requisicao manual para troca de idioma
         */
        
        if(this.language != this.defaultLanguage){
            console.log(`${timeNow({showSeconds: true})} | i18n: Translating for localStorage`);
            if(this.switcher){this.switcher.value = this.language}
            this.translate(this.language)
        }
        else if(this.autoDetect){
            console.log(`${timeNow({showSeconds: true})} | i18n: Translating for navigator language (autoDetect)`);
            this.translate(navigator.language || navigator.userLanguage)
        }
    }
    
    // Busca arquivo de traducao localmente em this.db, caso nao localize solicita para o servidor
    translate(lng){
        if(lng == this.defaultLanguage){
            // Se retornado para idioma padrao, salva definicao de idioma no localStorage e recarrega pagina
            localStorage.setItem('i18nLanguage', lng);
            window.location.href = typeof appClearUrl == 'string' ? appClearUrl : window.location.href.replace('update','id').split("?")[0].split('#')[0];
            return;
        }
        if(lng == this.language){
            // Caso linguagem seja a mesma de this.language chama o metodo refresh (necessario ao importar DB do localStorage)
            this.refresh();
            return
        }
        console.log(`${timeNow({showSeconds: true})} | i18n: Checking localy for '${lng}' translate schema`);
        if(this.db.hasOwnProperty(lng)){ // Se idioma ja existir na base local, altera para idioma informado e chama metodo refresh
            console.log(`${timeNow({showSeconds: true})} | i18n: Found schema for '${lng}' localy, stating translation`);
            this.language = lng;
            this.refresh();
            return;
        }
        console.log(`${timeNow({showSeconds: true})} | i18n: Checking server for '${lng}' translate schema`);
        let promisses = []; // Armazena todas as promisses para chegar se todas retornaram, antes do refresh()
        this.apps.forEach((el)=>{
            let promise = this.__getLanguage(lng, el).then((resp)=>{
                if(Object.keys(resp).length == 0){return} // Chega se json eh vazio, se sim termina codigo
                this.__updateDb(lng, resp); // Insere dicionario no db
            })
            promisses.push(promise)
        })        
        Promise.all(promisses).then((r)=>{
            if(!this.db[lng]){
                console.log(`${timeNow({showSeconds: true})} | i18n: [WARNING] No translation files found for "${lng}"`);
                if(this.callbackLanguage){
                    console.log(`${timeNow({showSeconds: true})} | i18n: Calling for callback language "${this.callbackLanguage}"`);
                    this.translate(this.callbackLanguage)
                }
                if(this.switcher){try {this.switcher.value = this.language} catch(error){}} // Se informado switcher, seleciona novamente a linguagem ativa
                // Se informado funcao de notificacao, chama funcao com mensagem de alerta
                if(this.notifyFunction){this.notifyFunction('warning', this.getEntry('sys.i18n.translationFileNotFound') || this.notFoundMsg, false)}
                return;
            }
            this.language = lng;                        // Altera idioma carregado
            localStorage.setItem('i18nLanguage', lng);  // Salva language no localstorage
            this.refresh();                             // Chama metodo para plotar alteracoes na pagina
        })
    }
    __getLanguage(lng, app){
        let instance=this;
        return new Promise(function(resolve, reject) {
            let xhr = new XMLHttpRequest();
            xhr.onload = function() {
                try{
                    let d = JSON.parse(this.responseText);
                    if(typeof d != 'object'){d = JSON.parse(d)}
                    resolve(d);
                }
                catch(e){
                    console.log(`${timeNow({showSeconds: true})} | i18n: [WARNING] ${this.responseText}`);
                    resolve({})
                }
            };
            xhr.onerror = reject;
            xhr.open(instance?.method || 'GET', `${instance.url}?app=${app}&lng=${lng}`);
            xhr.send();
        });
    }
    __updateDb(lng, schemas){ // Recebe json com entradas de idioma e adiciona em this.db
        if(!this.db.hasOwnProperty(lng)){this.db[lng] = {}} // Inicia entrada para idioma caso ainda nao exista
        let target = this.db[lng];
        for (const key in schemas) {
            if (schemas.hasOwnProperty(key)) {
                if (typeof schemas[key] === 'object' && schemas[key] !== null && typeof target[key] === 'object' && target[key] !== null && !Array.isArray(schemas[key]) && !Array.isArray(target[key])){
                    // If both are objects (not arrays), recurse
                    target[key] = this.__updateDb(target[key], schemas[key]);
                }
                else {target[key] = schemas[key]} // Otherwise, directly assign or overwrite
            }
        }
        localStorage.setItem('i18nApps', this.apps)
        localStorage.setItem('i18nDB', JSON.stringify(this.db))
        return true;
    }
    addApp(app){ // Adiciona app no array this.apps, busca schema para idioma ativo e chama metodo refresh
        if(this.apps.includes(app)){return}
        console.log(`${timeNow({showSeconds: true})} | i18n: Adding app "${app}"`);
        this.apps.push(app);
        this.__getLanguage(this.language, app).then((resp)=>{
            this.__updateDb(this.language, resp);
        })
    }
    setSwitcher(el){ // Define html element para alternar manualmente idioma
        // Apenas elementos select (de selecao unica) sao aceitos
        if(el.type != 'select-one'){console.log(`i18n: [ERROR] Switcher must be a select element (multiple not accepted)`);return;}
        el.addEventListener('change', ()=>{this.translate(el.value)})
    }
    getEntry(entry){
        try{return entry.split('.').reduce((previous, current) => previous[current], this.db[this.language])}
        catch(e){return null}
    }
    
    refresh(){
        console.log(`${timeNow({showSeconds: true})} | i18n: Updating user interface (refresh)`);
        let entries = document.querySelectorAll('[i18n]');
        let errorCount = 0;
        entries.forEach((el)=>{
            let result = null;
            try {
                result = el.getAttribute('i18n').split('.').reduce((previous, current) => previous[current], this.db[this.language]);
                if(!result){ throw '' }
            }
            // Se nao encontrado correspondente adiciona contador de erro, informa no log e analisa proxima entrada
            catch (e) {
                // Chaves criadas dinamicamente (ex: por libs) nao serao contruidas no db default, e devem ser tratadas dirto na lib
                // neste caso nao apresenta erro de chave nao encontrada
                if(el.getAttribute('i18n-dynamicKey') != 'true'){
                    errorCount++;
                    console.log(`i18n: [MISSING KEY] ${el.getAttribute('i18n')} for ${this.language}`);
                }
                return;
            }
            // Analisa se existe definicao para transform no texto
            if(el.getAttribute('i18n-transform')){
                // Alterando entre caixa alta / baixa / captalize
                if(el.getAttribute('i18n-transform') == 'captalize'){result = result.charAt(0).toUpperCase() + result.slice(1)}
                else if(el.getAttribute('i18n-transform') == 'upperCase'){result = result.toUpperCase()}
                else if(el.getAttribute('i18n-transform') == 'lowerCase'){result = result.toLowerCase()}
            }
            // Caso queria destacar parte so texto (bold), use i18.bold="substring" (se existir no texto)
            // Se for a default language assume se que emphasys ja esta no texto original, e nao faz alteracoes
            if(this.language != this.defaultLanguage && el.getAttribute('i18n-bold')){
                if(typeof result != 'string'){console.log(`i18n: [ERROR] ${el.getAttribute('i18n')} return is not a string`)}
                else{
                    if(result.toLowerCase().includes(el.getAttribute('i18n-bold').toLowerCase())){
                        let indexStart = result.toLowerCase().indexOf(el.getAttribute('i18n-bold').toLowerCase());
                        let indexEnd = indexStart + el.getAttribute('i18n-bold').length;
                        let substring = result.slice(indexStart, indexEnd);
                        if(indexStart > 0){
                            result = result.slice(0,indexStart) + '<b>' + substring + '</b>' + result.slice(indexEnd, result.length) ;
                        }
                        else{
                            result = '<b>' + substring + '</b>' + result.slice(indexEnd, result.length) ;
                        }
                    }
                    else{ // Caso nao exista na traducao a letra bold adiciona ao final da palavra elemento sup com destaque para letra
                        result += ` <sup><b>${el.getAttribute('i18n-bold').toUpperCase()}</b></sup>`;
                    }
                }
            }
            // Se definido i18n-target, resultado sera aplicado ao atribute informado, se nao plota resultado no innerHTML do elemento
            if(el.getAttribute('i18n-target') == null){el.innerHTML =  result || el.innerHTML}
            else{el.setAttribute(el.getAttribute('i18n-target'), result || el.getAttribute(el.getAttribute('i18n-target')))}
        })
    }
}