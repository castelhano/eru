/*
* I18n      Lib para interlacionalização de codigo
*
* @version  1.0
* @release  02/10/2025
* @since    06/10/2025
* @author   Rafael Gustavo Alves {@email castelhano.rafael@gmail.com }
* @depend   na
* @example  const i18n = new I18n({app: 'core'})
*/

class I18n{
    constructor(options){
        this.db = {}; // Base com idioma(s), entrada com idioma default montado de maneira automatica ao instanciar objeto
        this.apps = [];
        this.defaultLanguagePopulated = false;
        let defaultOptions = {
            url: 'i18n',
            method: 'GET',
            autoDetect: true,
            defaultLanguage: 'pt-BR',
            callbackLanguage: null,
            switcher: null,
        }
        
        for(let k in defaultOptions){ // carrega configuracoes para classe
            if(options.hasOwnProperty(k)){this[k] = options[k]}
            else{this[k] = defaultOptions[k]}
        }
        this.language = this.defaultLanguage; // this.language armazena o idioma ativo, inicia setado com defaultLanguage
        if(options?.apps && Array.isArray(options.apps)){this.apps = options.apps}

        
        if(this.autoDetect){this.translate(navigator.language || navigator.userLanguage)}
        else{console.log(`${timeNow({showSeconds: true})} | i18n: Autodetect setting "false", waiting for manualy change language`)}
        
        if(this.switcher){this.setSwitcher(this.switcher)}
    }
    // Percorre pagina e monta dicionario de idioma com estado original da pagina
    __populateDefaultLanguage(){
        console.log(`${timeNow({showSeconds: true})} | i18n: Populating default language DB`);
        this.db[this.defaultLanguage] = {}; // Inicia entrada para default language
        let entries = document.querySelectorAll('[i18n], [data-i18n]');
        entries.forEach(el=>{
            let keys = el.getAttribute('i18n').split('.');
            let size = keys.length;
            let target = this.db[this.defaultLanguage];
            keys.forEach((k, index)=>{
                if(target.hasOwnProperty(k) && index < size - 1){ // Se entrada ja existe apenas altera apontador busca proxima entrada
                    target = target[k];
                    return
                }
                if(index == size - 1){ // Ultima parte da chave, finaliza a entrada em DB
                    if(el.getAttribute('i18n-target')){ // Caso entrada nao seja no innerHTML 
                        target[k] = el.getAttribute(el.getAttribute('i18n-target'))
                    }
                    else{
                        target[k] = el.innerHTML;
                    }
                }
                else{
                    target[k] = {}
                }
                target = target[k];
            })
        })
        this.defaultLanguagePopulated = true;
        console.log(`${timeNow({showSeconds: true})} | i18n: Total of ${entries.length} entries found`);
    }
    
    // Busca arquivo de traducao localmente em this.db, caso nao localize solicita para o servidor
    translate(lng){
        if(lng == this.language){
            // Termina codigo se idioma for igual ao idioma ativo
            console.log(`${timeNow({showSeconds: true})} | i18n: Language ${lng} already in use, scaping...`);
            return
        }
        if(!this.defaultLanguagePopulated){this.__populateDefaultLanguage()} // Caso ainda nao criado entrada para defaultLanguage chama metodo de criacao

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
                this.language = lng;    // Altera idioma carregado
                if(Object.keys(resp).length == 0){return} // Chega se json eh vazio, se sim termina codigo
                this.__updateDb(lng, resp); // Insere dicionario no db
            })
            promisses.push(promise)
        })        
        Promise.all(promisses).then((r)=>{
            console.log(`${timeNow({showSeconds: true})} | i18n: Starting interpolation on entries`);
            this.refresh();         // Chama metodo para plotar alteracoes na pagina
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
                    target[key] = deepMerge(target[key], schemas[key]);
                }
                else {target[key] = schemas[key]} // Otherwise, directly assign or overwrite
            }
        }
        return true;
    }
    addApp(app){this.apps.push(app)}
    setLanguage(lng=(navigator.language || navigator.userLanguage)){}
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
                if(el.getAttribute('i18n_dynamicKey') != 'true'){
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
            if(this.language != this.defaultLanguage && el.getAttribute('i18n-bold') && result.toLowerCase().includes(el.getAttribute('i18n-bold').toLowerCase())){
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
            // Se definido i18n-target, resultado sera aplicado ao atribute informado, se nao plota resultado no innerHTML do elemento
            if(el.getAttribute('i18n-target') == null){el.innerHTML =  result || el.innerHTML}
            else{el.setAttribute(el.getAttribute('i18n-target'), result || el.getAttribute(el.getAttribute('i18n-target')))}
        })
        console.log(`${timeNow({showSeconds: true})} | i18n: Translate process completed with ${errorCount} errors`);
    }
}