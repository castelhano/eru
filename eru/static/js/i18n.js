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
        this.waiting = [];      // fila de processos (ajax) aguardando resposta do servidor 
        this.unsupported = [];  // lista dos idiomas nao suportados
        this.variables = {}     // variaveis carregadas, usadas para composicao de entradas com __var: ou __varb: 
        // dicionario de comutador para idiomas (preenchido de maneira automatica) ex {'pt-BR': 'pt'}
        this.callback_list = localStorage.getItem('i18nCallback_list') ? JSON.parse(localStorage.getItem('i18nCallback_list'))  : {};
        // funcoes auxiliares de traducao, uso (common.all__toUpperCase)
        this.functionAttrs = ['toUpperCase', 'toLowerCase', 'captalize'];
        // funcoes de modificador uso (common.all__plural)
        this.modificatorAttrs = ['plural', 'she'];
        // funcoes de composicao, espera variavel uso (common.all__bold:c), ou (common.custo__prefix:R$ )
        // no caso de var e varb variavel deve ser uma lista, ou referencia ao dicionario de variaveis
        // uso (1) el.innerHTML = i18n.getEntry(`foo.bar__var:${[(1+2), 'teste']}`)
        // uso (2) <span data-i18n="foo.bar__var:Foo,Bar">
        // uso (3) <span data-i18n="foo.bar__var:$refs">, e no javascript i18n.addVar('refs', [1, 'teste'])
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
    _updateSwitch(){ if(this.switcher){ this.switcher.value = this.language} }

    translate(lng, restartCron=true){
        if(restartCron){ this.startAt = Date.now() } // se chamada fora no metodo init reinicia medicao do tempo do processo
        if(this.unsupported.includes(lng)){
            console.log(`${timeNow({showSeconds: true})} | i18n: Language '${lng}' not supported in last check, login again to force new check`);
            return;
        }
        // se existe arquivo de traducao localmente traduz pelo arquivo
        console.log(`${timeNow({showSeconds: true})} | i18n: Checking localy for '${lng}' translate schema`);
        let pendingApps = [...this.apps];
        if(this.db.hasOwnProperty(lng)){
            pendingApps = this.apps.filter(item => !new Set(this.db[lng].i18nActiveApps).has(item));
            if(pendingApps.length == 0){
                console.log(`${timeNow({showSeconds: true})} | i18n: Found schema for '${lng}' localy, stating translation`);
                this._updateSwitch();
                this.refresh();
                return;
            }
        }
        console.log(`${timeNow({showSeconds: true})} | i18n: Checking server for '${lng}' translate in apps [${pendingApps.join(',')}]`);
        let promisses = []; // Armazena todas as promisses para chegar se todas retornaram, antes do refresh()
        pendingApps.forEach((el)=>{
            let promise = this.__getLanguage(lng, el).then((resp)=>{
                // carrega o app no dicionario do idioma
                if(this.db?.[lng]){this.db[lng].i18nActiveApps.push(el)}
                if(Object.keys(resp).length == 0){ return } // se nao retornado dados, termina bloco
                // let respLngIsGeneric = resp.i18nSelectedLanguage == this.language.split('-')[0];
                if(resp.i18nSelectedLanguage != lng){
                // servidor nao localizou arquivo para lng mais retornou idioma alternativo ex (pt-BR retornou pt)
                // define idioma alternativo como ativo a adiciona commutador, sempre que lng for solicitado traducao direciona
                // de maneira automatica para idioma alternativo 
                    console.log(`${timeNow({showSeconds: true})} | i18n: No suport for "${lng}" commuted language for "${resp.i18nSelectedLanguage}"`);
                    this.callback_list[lng] = resp.i18nSelectedLanguage;
                    lng = resp.i18nSelectedLanguage;
                }
                delete resp.i18nSelectedLanguage; // remove entrada i18nSelectedLanguage antes de salvar db
                this.__updateDb(lng, resp, el); // Insere dicionario no db
                
            })
            promisses.push(promise)
        })
        Promise.all(promisses).then((r)=>{
            if(!this.db[lng]){
                console.log(`${timeNow({showSeconds: true})} | i18n: [WARNING] No translation files found for "${lng}"`);
                this.unsupported.push(lng); // adiciona lng na lista de idiomas nao suportados
                localStorage.setItem('i18nUnsupported', JSON.stringify(this.unsupported));      // Salva language no localstorage
                localStorage.setItem('i18nCallback_list', JSON.stringify(this.callback_list));  // Salva callback_list no localstorage
                this._updateSwitch();
                if(this.callbackLanguage && this.callbackLanguage != lng){
                    console.log(`${timeNow({showSeconds: true})} | i18n: Calling for callback language "${this.callbackLanguage}"`);
                    this.translate(this.callbackLanguage)
                    return;
                }
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
                    let attr_split = attr.split(':');
                    if(attr_split.length == 3 && attr_split[2] == ''){entry[attr_split[0]] = ':'}
                    else{ entry[attr_split[0]] = attr_split[1] }
                }
            })
            result.push(entry)
        })
        return result;
    }
    addApp(app){ // Adiciona app no array this.apps, busca schema para idioma ativo e chama metodo refresh
        if(this.apps.includes(app)){ return }
        console.log(`${timeNow({showSeconds: true})} | i18n: Adding app "${app}"`);
        this.apps.push(app);
    }
    addVar(name, list){
        if(!name || !list || typeof name != 'string' || !Array.isArray(list)){ 
            console.log(`i18n: addApp expect a string at first position and array at second position`);
            return;
        }
        this.variables[name] = list;
    }
    setSwitcher(el){ // Define html element para alternar manualmente idioma
        // Apenas elementos select (de selecao unica) sao aceitos
        if(el.type != 'select-one'){console.log(`i18n: [ERROR] Switcher must be a select element (multiple not accepted)`);return;}
        el.addEventListener('change', ()=>{this.translate(el.value)})
    }
    _processEntry(entry){ // recebe dict de detachEntry, inclui resultado ajustado no dict antes de retornar
        let result;
        try{ result = entry.entry.split('.').reduce((previous, current) => previous[current], this.db[this.language]) }
        catch(err){return Object.assign({result: false}, entry)}
        if(!result){return Object.assign({result: false}, entry)}
        
        if(entry.she && result.split('#').length > 2){ // she solicita inflexao de genero feminino
            if(entry.plural && result.split('#').length > 3){result = result.split('#')[3]}
            else{ result = result.split('#')[2] }
        }
        else if(entry.plural && result.includes('#')){result = result.split('#')[1]}
        else{result = result.split('#')[0]}
        if(entry.transform){result = result[entry.transform]()}
        if(entry.prefix){ result = entry.prefix + result }
        if(entry.posfix){ result = result + entry.posfix }
        if(entry.var){ 
            if(entry.var[0] == '$' && this.variables[entry.var.substring(1)]){
                this.variables[entry.var.substring(1)].forEach((el, index)=>{ result = result.replace(`$${index + 1}`, `<b>${el}</b>`)})
            }
            else{
                entry.var.split(',').forEach((el, index)=>{ result = result.replace(`$${index + 1}`, `<b>${el}</b>`)})
            }
        }
        if(entry.varb){
            if(entry.varb[0] == '$' && this.variables[entry.varb.substring(1)]){
                this.variables[entry.varb.substring(1)].forEach((el, index)=>{ result = result.replace(`$${index + 1}`, `<b>${el}</b>`)})
            }
            else{
                entry.varb.split(',').forEach((el, index)=>{ result = result.replace(`$${index + 1}`, `<b>${el}</b>`)})
            }
        }
        if(entry.bold && entry.entry.toLowerCase().includes(String(entry.bold).toLowerCase())){
            entry.bold = String(entry.bold).toLowerCase(); // converte em string
            let indexStart = result.toLowerCase().indexOf(entry.bold);
            let indexEnd = indexStart + entry.bold.length;
            let substring = result.slice(indexStart, indexEnd);
            if(indexStart > 0){ result = result.slice(0, indexStart) + '<b><u>' + substring + '</u></b>' + result.slice(indexEnd, result.length) }
            else{ result = '<b><u>' + substring + '</u></b>' + result.slice(indexEnd, result.length) }
        }
        else if(entry.bold){ result += ` <sup><b>${entry.bold.toUpperCase()}</b></sup>` }
        return Object.assign({}, entry, {result: result});
    }
    getEntry(original_entry){
        try{
            let entry = this.__detachEntry(original_entry)[0]; // getEntry analisa somente a primeira entry (caso informado mais de uma)
            let resp = this._processEntry(entry);
            return resp.result || null;
        }
        catch(e){return null}
    }
    // Limpa dados salvos no localStorage e recarrega pagina (se reload=true)
    // Obs.: Caso reload=false, lembrar de setar novamente i18n.addApp('seu app')
    clearAll(reload=true){ 
        localStorage.removeItem('i18nLanguage');
        this.clearData(reload);
    }
    // Similar ao clearAll, porem mantem o idioma selecionado pelo usuario
    clearData(reload=true){ 
        localStorage.removeItem('i18nDB');
        localStorage.removeItem('i18nApps');
        // localStorage.removeItem('i18nUnsupported');
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
        els.forEach((el)=>{
            let entries = this.__detachEntry(el.dataset.i18n);
            entries.forEach((e)=>{
                let resp = this._processEntry(e);
                if(!resp.result){
                    console.log(`i18n: [MISSING KEY] ${resp.entry} for ${this.language}`);
                    return;
                }
                if(e.target){ el[e.target] = resp.result }
                else{ el.innerHTML = resp.result }
            })
        })
        this.endAt = Date.now();
        console.log(`${timeNow({showSeconds: true})} | i18n: Translation complete, ${this.endAt - this.startAt} milliseconds`);
    }
}