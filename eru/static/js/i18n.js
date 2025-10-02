/*
* I18n      Lib para interlacionalização de codigo
*
* @version  1.0
* @release  02/10/2025
* @since    02/10/2025
* @author   Rafael Gustavo Alves {@email castelhano.rafael@gmail.com }
* @depend   na
*/

class I18n{
    constructor(options){
        this.db = {}; // Base com idioma(s), entrada com idioma default montado de maneira automatica ao instanciar objeto
        let defaultOptions = {
            app: '',
            url: 'i18n',
            method: 'GET',
            defaultLanguage: 'pt-BR',
            callbackLanguage: null,
            acceptedLanguages: [{'pt-BR': 'Portugues (BR)'}],
            switcher: null,
        }

        for(let k in defaultOptions){ // carrega configuracoes para classe
            if(options.hasOwnProperty(k)){this[k] = options[k]}
            else{this[k] = defaultOptions[k]}
        }

        this.__populateDefaultLanguage();
        this.language = this.defaultLanguage;

        
        
        
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
        console.log(`${timeNow({showSeconds: true})} | i18n: Total of ${entries.length} entries found`);
    }
    
    // Define idioma a ser utilizado, alem buscar 
    init(lng=(navigator.language || navigator.userLanguage)){
        if(lng == this.language){
            // Termina codigo se idioma for igual ao idioma ativo
            console.log(`${timeNow({showSeconds: true})} | i18n: Language ${lng} already in use, scaping...`);
            return
        }
        console.log(`${timeNow({showSeconds: true})} | i18n: Checking server for '${lng}' translate schema`);
        this.__getLanguage(lng).then((resp)=>{
            if(Object.keys(resp).length == 0){ // Chega se json eh vazio, se sim termina codigo
                console.log(`${timeNow({showSeconds: true})} | i18n: Server return a empty object, scaping`);
                return
            }
            this.language = lng;    // Altera idioma carregado
            this.db[lng] = resp;    // Insere dicionario no db
            console.log(`${timeNow({showSeconds: true})} | i18n: Starting interpolation on entries`);
            this.refresh();         // Chama metodo para plotar alteracoes na pagina
        })
        
    }
    __getLanguage(lng){
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
                    console.log(`${timeNow({showSeconds: true})} | i18n: [FAIL] ${this.responseText}, nothing to do..`);
                }
            };
            xhr.onerror = reject;
            xhr.open(instance?.method || 'GET', `${instance.url}?app=${instance.app}&lng=${lng}`);
            xhr.send();
        });
    }
    setLanguage(lng=(navigator.language || navigator.userLanguage)){}
    
    refresh(){
        let entries = document.querySelectorAll('[i18n], [data-i18n]');
        let errorCount = 0;
        entries.forEach((el)=>{
            let result = el.getAttribute('i18n').split('.').reduce((previous, current) => previous[current], this.db[this.language]);
            if(el.getAttribute('i18n-target') == null){el.innerHTML =  result || el.innerHTML}
            else{
                el.setAttribute(el.getAttribute('i18n-target'), result || el.getAttribute(el.getAttribute('i18n-target')))
            }
            if(!result){
                errorCount++;
                console.log(`i18n: [MISSING KEY] ${el.getAttribute('i18n')} for ${this.language}`);
            }
        })
        console.log(`${timeNow({showSeconds: true})} | i18n: Translate process completed with ${errorCount} errors`);
    }
}