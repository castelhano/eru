/*
* I18n      Lib para interlacionalização de codigo
*
* @version  2.1
* @release  [2.2] 10/11/25 [declaration refactor see**, waiting pool, add __she (gender inflection)]
* @since    02/10/2025
* @author   Rafael Gustavo Alves {@email castelhano.rafael@gmail.com }
* @depend   na
* @example  const i18n = new I18n({apps: ['core']})
* --
* Read me **: 
* Ver 2.0 alterado forma de declaracao de modificadores, removido data-i18n-[bold, transform, pluralize]
* declaracao eh feita toda em data-i18n="[placeholder]common.company__she__plural__captalize__bold:c__var:teste,5,4__prefix:R$__posfix: pt-BR"
* alteracao multipla no elemento data-i18n="[placeholder]foo.bar;[title]foo.fei"
*/

class I18n{
    constructor(options){
        this.db = localStorage.getItem('i18nDB') ? JSON.parse(localStorage.getItem('i18nDB'))  : {}; // Base com idioma(s), entrada com idioma default montado de maneira automatica ao instanciar objeto
        this.apps = localStorage.getItem('i18nApps') ? localStorage.getItem('i18nApps').split(',') : [];
        let defaultOptions = {
            url: 'i18n',                                // URL para consulta ajax, (recebe app e lng) deve retornar json com entradas de trducao
            method: 'GET',                              // Metodo de consulta
            autoDetect: true,                           // Inicia traducao a partir de idioma do navegador navigator.language || navigator.userLanguage
            defaultLanguage: 'pt',                      // Idioma padrao que sera carregado ao iniciar sistema (antes da escolha do usuario)
            callbackLanguage: null,                     // Idioma a ser buscado caso nao localizado arquivo de traducao
            switcher: null,                             // Elemento select para troca de idioma 
        }
        this.waiting = [];       // fila de processos (ajax) aguardando resposta do servidor 
        // dicionario das linguagens sem suporte
        this.unsupported = localStorage.getItem('i18nUnsupported') ? JSON.parse(localStorage.getItem('i18nUnsupported'))  : {};
        this.callback_list = localStorage.getItem('i18nCallback_list') ? JSON.parse(localStorage.getItem('i18nCallback_list'))  : {};
        // dicionario de comutador para idiomas (preenchido de maneira automatica) ex {'pt-BR': 'pt'}
        this.functionAttrs = ['toUpperCase', 'toLowerCase', 'captalize'];
        this.modificatorAttrs = ['plural', 'she'];
        this.composedAttrs = ['bold','prefix', 'posfix', 'var', 'varb'];
        
        for(let k in defaultOptions){ // carrega configuracoes para classe
            if(options.hasOwnProperty(k)){this[k] = options[k]}
            else{this[k] = defaultOptions[k]}
        }
        // this.language armazena o idioma ativo, inicia setado com defaultLanguage
        this.language = localStorage.getItem('i18nLanguage') || (this.autoDetect ? (navigator.language || navigator.userLanguage) : this.defaultLanguage);
        if(this.apps.length == 0 && options?.apps && Array.isArray(options.apps)){this.apps = options.apps}
        if(this.switcher){this.setSwitcher(this.switcher)}
    }
    init(){
        this.startAt = Date.now();
        /** Ordem de prioridade para identificacao do idioma
         * 1 - Verifica existencia localStorage[i18nLanguage]
         * 2 - Se autoDetect = true, busca idioma do navegador
         * 3 - Aguarda requisicao manual para troca de idioma
         */
        if(this.waiting.length > 0){return} // nao inicia se ainda existem requisicoes ajax aguardando resposta
        this.translate(this.language, false);
    }
    
    // Busca arquivo de traducao localmente em this.db, caso nao localize solicita para o servidor
    _updateSwitch(){
        if(this.switcher && Array.from(this.switcher.options).some(o => o.value === this.language)){this.switcher.value = this.language}
    }
    translate(lng, restartCron=true){
        console.log('translate');
        
        if(restartCron){ this.startAt = Date.now() } // se chamada fora no metodo init reinicia medicao do tempo do processo
        
        // se existe arquivo de traducao localmente traduz pelo arquivo
        console.log(`${timeNow({showSeconds: true})} | i18n: Checking localy for '${lng}' translate schema`);
        if(this.db.hasOwnProperty(lng)){
            console.log(`${timeNow({showSeconds: true})} | i18n: Found schema for '${lng}' localy, stating translation`);
            this._updateSwitch();
            this.refresh();
            return;
        }
        // verifica se linguagem esta marcada como nao suportada, ao requisitar server se nao retorna dicionario para linguagem adiciona 
        // automaticamente idioma em this.unsupported
        let unsupport = 0, callbackLng = 0;
        this.apps.forEach((el)=>{
            if(this.unsupported[el] && this.unsupported[el].includes(lng)){unsupport ++}
            if(this.callbackLanguage && this.unsupported[el] && this.unsupported[el].includes(this.callbackLanguage)){callbackLng ++}
        })
        if(this.apps.length == unsupport){ // sem suporte para a linguagem em nenhum dos apps listados
            if(this.callback_list.hasOwnProperty(lng)){ // verifica se existe idioma alternativo baixado
                console.log(`${timeNow({showSeconds: true})} | i18n: Language '${lng}' commuted for '${this.callback_list[lng]}', start translating`);
                this.language = this.callback_list[lng];
                this._updateSwitch();
                this.refresh();
                return;
            }
            if(!this.callbackLanguage || this.apps.length == callbackLng){ // sem suporte tbm para callbackLanguage, termina codigo
                console.log(`${timeNow({showSeconds: true})} | i18n: Language '${lng}' not supported in last check, login again to force new check`);
                return;
            }
            else if(this.callbackLanguage != lng){
                if(this.db.hasOwnProperty(this.callbackLanguage)){
                    console.log(`${timeNow({showSeconds: true})} | i18n: Language '${lng}' not supported in last check, using callbackLanguage '${this.callbackLanguage}'`);
                    this.language = this.callbackLanguage;
                    this._updateSwitch();
                    this.refresh();
                    return;
                }
                // callbackLanguage ainda nao consultado, busca no server
                console.log(`${timeNow({showSeconds: true})} | i18n: Language '${lng}' not supported in last check, checking for callbackLanguage '${this.callbackLanguage}'`);
                lng = this.callbackLanguage;
            }
            else{
                console.log(`${timeNow({showSeconds: true})} | i18n: Language '${lng}' (is callbackLanguage) not supported in last check, login again to force new check`);
                return;
            }
        }
        console.log(`${timeNow({showSeconds: true})} | i18n: Checking server for '${lng}' translate schema`);
        let promisses = []; // Armazena todas as promisses para chegar se todas retornaram, antes do refresh()
        this.apps.forEach((el, index)=>{
            // se app ja consultado para lng e verificado que nao tem arquivo de traducao, retorna e busca por prossimo app
            if(this.unsupported.hasOwnProperty(el) && this.unsupported[el].hasOwnProperty(lng)){return}
            let promise = this.__getLanguage(lng, el).then((resp)=>{
                if(Object.keys(resp).length == 0){ // se nao retornado dados, adiciona em unsupported
                    if(this.unsupported.hasOwnProperty(el)){ this.unsupported[el].push(lng) }
                    else{ this.unsupported[el] = [lng] }
                    return;
                }
                if(index == 0 && resp.i18nSelectedLanguage != lng){
                // servidor nao localizou arquivo para lng mais retornou idioma base ex(pt-BR retornou pt)
                // Lib espera que o primeiro app adicionado tenha suporte para todas as linguagens, se o app principal retornar
                // idioma alternativo para determinado idioma (ex 'pt-BR' = 'pt') lib assume 'pt' para demais aplicacoes, indiferente
                // se criado arquivo para pt-BR em aplicacao secundaria
                    console.log(`${timeNow({showSeconds: true})} | i18n: No suport for "${lng}" commuted language for "${resp.i18nSelectedLanguage}"`);
                    this.callback_list[lng] = resp.i18nSelectedLanguage;
                    this.apps.forEach((e)=>{ // marca todas as aplicacoes como unsuported para lng informada
                        if(this.unsupported[e]){this.unsupported[e].push(lng)}
                        else{this.unsupported[e] = [lng]}
                    })
                    lng = resp.i18nSelectedLanguage;
                }
                // se app secundario nao tem suporte para lng mais retornou alternativo, entradas de traducao sao adicionadas 
                // no idioma do app principal, ou seja app principal achou traducao para pt-BR (criado db)
                // mais app secundario retornou pt, dados sao inseridos no idioma pt-BR e this.language se mantem pt-BR
                delete resp.i18nSelectedLanguage; // remove entrada i18nSelectedLanguage antes de salvar db
                this.__updateDb(lng, resp, el); // Insere dicionario no db
                
            })
            promisses.push(promise)
        })        
        Promise.all(promisses).then((r)=>{
            if(!this.db[lng]){
                console.log(`${timeNow({showSeconds: true})} | i18n: [WARNING] No translation files found for "${lng}"`);
                if(this.callbackLanguage && this.callbackLanguage != lng){
                    console.log(`${timeNow({showSeconds: true})} | i18n: Calling for callback language "${this.callbackLanguage}"`);
                    this.translate(this.callbackLanguage)
                    return;
                }
                // Se informado switcher, seleciona novamente a linguagem ativa (caso alterado via switch)
                this._updateSwitch();
                localStorage.setItem('i18nUnsupported', JSON.stringify(this.unsupported));      // Salva language no localstorage
                localStorage.setItem('i18nCallback_list', JSON.stringify(this.callback_list));  // Salva callback_list no localstorage
                return;
            }
            this.language = lng;                                    // Altera idioma carregado
            localStorage.setItem('i18nLanguage', lng);              // Salva language no localstorage
            localStorage.setItem('i18nUnsupported', JSON.stringify(this.unsupported));  // Salva language no localstorage
            localStorage.setItem('i18nCallback_list', JSON.stringify(this.callback_list));  // Salva callback_list no localstorage
            this._updateSwitch();                                   // atualiza switch
            this.refresh();                                         // Chama metodo para plotar alteracoes na pagina
        })
    }
    async __getLanguage(lng, app) {
        let url = `${this.url}?app=${app}&lng=${lng}`;
        try {
            let response = await fetch(url);
            if (!response.ok) { return {} }
            let data = await response.json();
            return data;
            
        } catch (error) { return {} }
    }
    __updateDb(lng, schemas, app){ // Recebe json com entradas de idioma e adiciona em this.db
        if(!this.db.hasOwnProperty(lng)){this.db[lng] = {}} // Inicia entrada para idioma caso ainda nao exista
        let target = this.db[lng];
        for (const key in schemas) {
            if (schemas.hasOwnProperty(key)) {
                if (typeof schemas[key] === 'object' && schemas[key] !== null && typeof target[key] === 'object' && target[key] !== null && !Array.isArray(schemas[key]) && !Array.isArray(target[key])){
                    // If both are objects (not arrays), recurse
                    target[key] = this.__updateDb(target[key], schemas[key], app);
                }
                else {target[key] = schemas[key]} // Otherwise, directly assign or overwrite
            }
        }
        if(this.db[lng]?.i18nActiveApps && !this.db[lng].i18nActiveApps.includes(app)){this.db[lng].i18nActiveApps.push(app)}
        else if(!this.db[lng]?.i18nActiveApps){this.db[lng].i18nActiveApps = [app]}
        localStorage.setItem('i18nApps', this.apps)
        localStorage.setItem('i18nDB', JSON.stringify(this.db))
        return true;
    }
    __detachEntry(original_entry){
        // recebe uma entrada e retorna parametros para traducao 
        // ex: __detachEntry('placeholder]foo.bar__upper__bold:c') => {entry: 'foo.bar', target: 'placeholder', transform: 'upperCase', bold: 'c'}
        let result = [];
        let entries = original_entry.split(';'); // eh possivel informar multiplas chaves separando por comma ex: 'foo.bar;[title]foo.fei'
        entries.forEach((el)=>{
            let entry = {entry: el};
            let target = el.match(/\[(.*?)\](.*)/);
            if(target){
                entry.target = target[1];
                entry.entry = target[2];
            }
            let attrs = entry.entry.split('__');    // separa atributos de configuracao do entry
            entry.entry = attrs[0];                 // ajusta entry removendo os atributos
            attrs.forEach((attr)=>{                 // percorre todos os atributos configurando entry
                if(this.functionAttrs.includes(attr)){ entry.transform = attr}
                if(this.modificatorAttrs.includes(attr)){entry[attr] = true}
                if(this.composedAttrs.includes(attr.split(':')[0])){
                    // trata ex. __posfix::
                    if(attr.split(':').length == 3 && attr.split(':')[2] == ''){entry[attr.split(':')[0]] = ':'}
                    else{ entry[attr.split(':')[0]] = attr.split(':')[1] }
                }
            })
            result.push(entry)
        })
        return result;
    }
    addApp(app){ // Adiciona app no array this.apps, busca schema para idioma ativo e chama metodo refresh
        if(this.db?.[this.language]?.i18nActiveApps.includes(app)){return}
        this.waiting.push(`addApp_${app}`)
        console.log(`${timeNow({showSeconds: true})} | i18n: Adding app "${app}"`);
        if(!this.apps[app]){ this.apps.push(app) }
        this.__getLanguage(this.language, app).then((resp)=>{
            this.__updateDb(this.language, resp, app);
            this.waiting.splice(this.waiting.indexOf(`addApp_${app}`, 1))
            if(this.waiting.length == 0){this.init()}
        })
    }
    setSwitcher(el){ // Define html element para alternar manualmente idioma
        // Apenas elementos select (de selecao unica) sao aceitos
        if(el.type != 'select-one'){console.log(`i18n: [ERROR] Switcher must be a select element (multiple not accepted)`);return;}
        el.addEventListener('change', ()=>{this.translate(el.value)})
    }
    getEntry(original_entry){
        try{
            let entry = this.__detachEntry(original_entry)[0]; // getEntry analisa somente a primeira entry (caso informado mais de uma)
            let result = entry.entry.split('.').reduce((previous, current) => previous[current], this.db[this.language]);
            if(entry.she && result.split('#').length > 2){ // she solicita inflexao de genero feminino
                if(entry.plural && result.split('#').length > 3){result = result.split('#')[3]}
                else{ result = result.split('#')[2] }
            }
            else if(entry.plural && result.includes('#')){result = result.split('#')[1]}
            else{result = result.split('#')[0]}
            if(entry.transform){result = result[entry.transform]()}
            if(entry.prefix){result = entry.prefix + result }
            if(entry.posfix){result = result + entry.posfix}
            if(entry.var){ entry.var.split(',').forEach((el, index)=>{ result = result.replace(`$${index + 1}`, el)})}
            if(entry.varb){ entry.varb.split(',').forEach((el, index)=>{ result = result.replace(`$${index + 1}`, `<b>${el}</b>`)})}
            if(entry.bold && entry.entry.toLowerCase().includes(String(entry.bold).toLowerCase())){
                entry.bold = String(entry.bold).toLowerCase(); // converte em string
                let indexStart = result.toLowerCase().indexOf(entry.bold);
                let indexEnd = indexStart + entry.bold.length;
                let substring = result.slice(indexStart, indexEnd);
                if(indexStart > 0){ result = result.slice(0, indexStart) + '<b><u>' + substring + '</u></b>' + result.slice(indexEnd, result.length) }
                else{ result = '<b><u>' + substring + '</u></b>' + result.slice(indexEnd, result.length) }
            }
            else if(entry.bold){ result += ` <sup><b>${entry.bold.toUpperCase()}</b></sup>` }
            return result;
        }
        catch(e){return null}
    }
    // Limpa dados salvos no localStorage e recarrega pagina (se reload=true)
    // Obs.: Caso reload=false, lembrar de setar novamente i18n.addApp('seu app')
    clearAll(reload=true){ 
        localStorage.removeItem('i18nLanguage');
        this.clearData();
    }
    // Similar ao clearAll, porem mantem o idioma selecionado pelo usuario
    clearData(reload=true){ 
        localStorage.removeItem('i18nDB');
        localStorage.removeItem('i18nApps');
        localStorage.removeItem('i18nUnsupported');
        localStorage.removeItem('i18nCallback_list');
        if(reload){ // recarrega pagina com idioma default
            window.location.href = typeof appClearUrl == 'string' ? appClearUrl : window.location.href.replace('update','id').split("?")[0].split('#')[0];
        }
        else{
            this.db = {};
            this.apps = [];
            this.language = this.defaultLanguage;
        }
    }
    refresh(){ // percorre a pagina traduzindo todas as entradas com data-i18n=""
        console.log(`${timeNow({showSeconds: true})} | i18n: Updating user interface (refresh)`);
        let els = document.querySelectorAll('[data-i18n]');
        // remove elemento sem valor em data-i18n
        els = Array.from(els).filter(el => { return el.getAttribute('data-i18n') !== null && el.getAttribute('data-i18n') !== '' });
        let errorCount = 0;
        els.forEach((el)=>{
            let entries = this.__detachEntry(el.dataset.i18n);
            entries.forEach((e)=>{
                let result;
                try{
                    result = e.entry.split('.').reduce((previous, current) => previous[current], this.db[this.language]);
                    if(!result){throw ''}
                }
                catch(err){
                    errorCount++;
                    let key = this.__detachEntry(el.getAttribute('data-i18n'))
                    console.log(`i18n: [MISSING KEY] ${key?.entry || el.getAttribute('data-i18n')} for ${this.language}`);
                    return;
                }
                if(e.she && result.split('#').length > 2){ // she solicita inflexao de genero feminino
                    if(e.plural && result.split('#').length > 3){result = result.split('#')[3]}
                    else{ result = result.split('#')[2] }
                }
                else if(e.plural && result.includes('#')){result = result.split('#')[1]}
                else{result = result.split('#')[0]}
                if(e.transform){result = result[e.transform]()}
                if(e.prefix){result = e.prefix + result }
                if(e.posfix){result = result + e.posfix}
                if(e.var){ 
                    console.log(e);
                    
                    console.log(e.var);
                    
                    e.var.split(',').forEach((el, index)=>{ result = result.replace(`$${index + 1}`, el)})}
                if(e.varb){ e.varb.split(',').forEach((el, index)=>{ result = result.replace(`$${index + 1}`, `<b>${el}</b>`)})}
                if(e.bold && result.toLowerCase().includes(String(e.bold).toLowerCase())){
                    e.bold = String(e.bold).toLowerCase();
                    let indexStart = result.toLowerCase().indexOf(e.bold);
                    let indexEnd = indexStart + e.bold.length;
                    let substring = result.slice(indexStart, indexEnd);
                    if(indexStart > 0){ result = result.slice(0, indexStart) + '<b><u>' + substring + '</u></b>' + result.slice(indexEnd, result.length) }
                    else{ result = '<b><u>' + substring + '</u></b>' + result.slice(indexEnd, result.length) }
                }
                else if(e.bold){ result += ` <sup><b>${e.bold.toUpperCase()}</b></sup>` }
                //--
                if(e.target){ el[e.target] = result }
                else{ el.innerHTML = result }
            })
        })
        this.endAt = Date.now();
        console.log(`${timeNow({showSeconds: true})} | i18n: Translation complete, ${this.endAt - this.startAt} milliseconds`);
    }
}