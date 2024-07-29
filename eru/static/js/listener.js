/*
* Gerencia atalhos de teclado e implementa tabulacao ao pressionar Enter em formularios
*
* @version  4.0
* @since    02/03/2022
* @release  20/08/2023
* @author   Rafael Gustavo Alves {@email castelhano.rafael@gmail.com }
* @example  appKeyMap.bind({key: 'e', ctrl: true, run: ()=>{...do something}})
* @example  appKeyMap.bind({key: 'e', alt:true, ctrl: true, run: ()=>{...do something}, group: 'cadastro'})
*/
class Keywatch{
    constructor(){
        this.map = {};                                  // Mapa com todos os atalhos cadastrados
        this.filteredMap = [];                          // Mapa filtrado
        this.tabOnEnter = true;                         // Ativa tabulacao ao precionar enter (dentro de formularios <form>)
        // Adiciona estilo e configuracoes para modal com lista de atalhos
        this.__addStyles();
        this.modal = document.createElement('dialog');  // Cria modal para exibir atalhos
        this.modal.classList.add('keywatch_modal');
        document.body.appendChild(this.modal);
        this.__buildTable();
    }
    __addStyles(){
        let style = document.createElement('style');
        style.innerHTML = '.keywatch_modal{padding: 8px;width: 100%;}@media (min-width: 576px){.keywatch_modal{max-width: 800px;}}';
        document.getElementsByTagName('head')[0].appendChild(style);
    }
    bind(options){
        if(!options.hasOwnProperty('key') || !options.hasOwnProperty('run')){return false;} // Attrs key e run sao obrigatorios, nao adiciona caso nao presentes
        let cmd = this.getScope(options);
        if(cmd){
            if(this.map.hasOwnProperty(cmd)){delete this.map[cmd]} // Se atalho ja existe, apaga entrada antes de sobregravar (para garantir ordem de posicionamento)
            this.map[cmd] = options;
        }
    }
    avail(options){
        if(typeof options == 'object'){return !this.map.hasOwnProperty(this.getScope(options))}
        else if(typeof options == 'string'){return !this.map.hasOwnProperty(options)}
        return true;
    }
    run(ev){ // Recebe e trata evento, executa metodo run do atalho (caso encontrado)
        // console.log(ev);
        let cmd = this.getScope(ev);
        if(this.map[cmd]){
            if(cmd.slice(-3) != 'FFF'){ev.preventDefault();} // Caso atalho seja sem combo (alt, ctrl, shift), nao previne comportamento default
            this.map[cmd].run(ev);
        }
        // Verifica se key=Enter e evento tem origem em input/select, se sim tenta tabular para proximo controle
        // !Atencao: Tabulacao somente ocorre se input estiver dentro de um <form> e somente para outros elementos deste form
        // Caso proximo input esteja disable, readonly, hide ou tiver tabindex menor que zero busca proximo elemento
        else if(this.tabOnEnter && ev.key == 'Enter' && (ev.target.nodeName === 'INPUT' || ev.target.nodeName === 'SELECT')){
            ev.preventDefault();
            if(ev.target.hasOwnProperty('data-escape_tab')){return false} // Adicione attr data-escape_tab no inpit que queira evitar tabulacao no enter
            try{
                let form = ev.target.form;
                let index = Array.prototype.indexOf.call(form, ev.target);
                if(form.elements[index + 1].disabled == false && !form.elements[index + 1]?.readOnly == true && form.elements[index + 1].offsetParent != null && form.elements[index + 1].tabIndex >= 0){form.elements[index + 1].focus();}
                else{
                    let el = ev.target.form.elements;
                    let i = index + 1;
                    let escape = false;
                    while(i <= el.length && !escape){
                        if(form.elements[i].disabled == false && !form.elements[i]?.readOnly == true && form.elements[i].offsetParent != null && form.elements[i].tabIndex >= 0){form.elements[i].focus();escape = true;}
                        else{i++;}
                    }
                }
            }catch(e){}
        }
    }
    getScope(ev){ // Funcao auxiliar, retorna mascara do atalho. Ex: cFTF (Ctrl C), f1TTF (Alt + Ctrl + F1), etc... usado na montagem do dicionario map
        if(!ev.key){return null}
        let cmd = ev.key.toLowerCase();
        cmd += ev.altKey || ev.alt ? 'T': 'F';
        cmd += ev.ctrlKey || ev.ctrl ? 'T': 'F';
        cmd += ev.shiftKey || ev.shift ? 'T': 'F';
        return cmd;
    }
    getHumanize(entry){ // Recebe atalho e retorna legenda. Ex: appKeyMap.getHumanize({alt: true, key:'c', ....}); retorno Alt C
        let comb = entry.alt ? 'Alt ' : '';
        comb += entry.ctrl ? 'Ctrl ' : '';
        comb += entry.shift ? 'Shift ' : '';
        comb += entry.key == ' ' ? '[space]' : entry.key.toUpperCase();
        return comb;        
    }
    getEntryByRole(role, onlyHumanizeScope=false){
    // Retorna entrada (primeira localizada) com atributo role fornecido, 2o parametro posicional (bool) define se retorno sera entrada ou string de legenda do atalho
        let entry = Object.entries(this.map).filter(([k,v]) => v?.role == role)[0];
        if(!onlyHumanizeScope){return entry}
        return this.getHumanize(entry[1]);
    }
    unbind(target){ // Remove listener do mapa (scope ou dicionario). Ex: appKeyBind.unbind('fTFF'); ou appKeyBind.unbind({key: 'f', alt: true});
        if(typeof target == 'string'){try{delete this.map[target]}catch(e){}}
        else if(typeof target == 'object'){try{delete this.map[this.getScope(target)]}catch(e){}}
    }
    unbindAll(){this.map = {}} // Limpa todas as entradas de atalho
    unbindGroup(group){ // Limpa todas as entradas do grupos especificado. Ex: appKeyMap.unbindGroup('cadastro')
        let l;
        if(typeof group == 'object'){l = Object.entries(this.map).filter(([k,v]) => group.includes(v?.group))}
        else{l = Object.entries(this.map).filter(([k,v]) => v?.group == group)}
        for(let i = 0; i < l.length; i++){
            delete this.map[l[i][0]];
        }
    }
    getGroup(groupName){ // Retorna lista com entradas associadas ao grupo fornecido
        return Object.entries(this.map).filter(([k,v]) => v?.group == groupName);
    }
    getMap(){return Object.values(this.map)} // Retorna lista com todas as entradas de atalhos
    hide(target=null){ // Oculta um atalho (ou todos), se nao informado parametro oculta todos os atalhos, pode ser informado 'alias' do atalho ou entrada (dict)
        if(!target){for(let i in this.map){this.map[i].visible = false}} // Se nao informado, oculta todos os atalhos
        else if(typeof target == 'string'){try{this.map[target].visible = false;}catch(e){}}
        else if(typeof target == 'object'){try{this.map[this.getScope(target)].visible = false;}catch(e){}}
    }
    showKeymap(){ // Exibe modal com atalhos disponiveis
        this.__tableRefresh();
        this.modal.showModal();
    }
    __filterMapTable(e, criterio=null){
        if(this.map.length == 0){return false}
        this.filteredMap = [];
        if([37, 38, 39, 40, 13].includes(e.keyCode)){return false;} // Nao busca registros caso tecla seja enter ou arrows
        let c = criterio || this.searchInput.value.toLowerCase();
        for(let i in this.map){
            if(this.map[i].visible == false){continue}
            let value = this.map[i]?.name ? this.map[i].name.replace(/<[^>]*>/g,'').toLowerCase() : '';
            value += this.map[i]?.desc ? this.map[i].desc.replace(/<[^>]*>/g,'').toLowerCase() : '';
            value += this.map[i].alt ? 'alt+' : '';
            value += this.map[i].ctrl ? 'ctrl+' : '';
            value += this.map[i].shift ? 'shift+' : '';
            value += this.map[i].key;
            if(value.indexOf(c) > -1){this.filteredMap.push(this.map[i])}
        }
        this.__tableRefresh(this.filteredMap);
    }
    __tableRefresh(map=this.getMap()){
        if(map.length == 0){this.modalTableTbody.innerHTML = '<tr><td colspan="3">Nenhum atalho localizado</td></tr>'}
        else{
            this.modalTableTbody.innerHTML = ''
            for(let item in map){
                if(map[item]?.visible == false){continue}
                let comb = this.getHumanize(map[item]);
                let tr = `<tr><td>${map[item].name || ''}</td><td class="keywatch_table_combination_td"><code>${comb}</code></td><td>${map[item].desc || ''}</td></tr>`
                this.modalTableTbody.innerHTML += tr;
            }
            // Se nenhum atalho visivel apos loop, adiciona linha informativa
            if(this.modalTableTbody.childNodes.length == 0){this.modalTableTbody.innerHTML = '<tr><td colspan="3">Nenhum atalho localizado</td></tr>'}
        }
    }
    __buildTable(){ // Cria tabela no modal (roda apenas ao carregar a pagina)
        this.searchInput = document.createElement('input');this.searchInput.type = 'search';this.searchInput.classList = 'form-control form-control-sm bg-body-tertiary mb-1';this.searchInput.placeholder = 'Criterio pesquisa';this.searchInput.id = 'Listener_searchInput';
        this.searchInput.oninput = (ev)=>{this.__filterMapTable(ev)}
        this.modalTable = document.createElement('table');
        this.modalTable.classList = 'keywatch_table table table-sm table-striped table-hover border fs-7 mb-0';
        this.modalTableThead = document.createElement('thead');
        this.modalTableTbody = document.createElement('tbody');
        this.modalTableThead. innerHTML = '<tr><th>Nome</th><th>Combinação</th><th>Descrição</th></tr>';
        this.modalTable.appendChild(this.modalTableThead);
        this.modalTable.appendChild(this.modalTableTbody);
        this.modal.appendChild(this.searchInput);
        this.modal.appendChild(this.modalTable);
    }
}
const appKeyMap = new Keywatch();
document.addEventListener('keydown', (e) => {appKeyMap.run(e)})