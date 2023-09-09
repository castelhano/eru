
class Keywatch{
    constructor(){
        this.map = {};                                  // Mapa com todos os atalhos cadastrados
        this.tabOnEnter = true;                         // Ativa tabulacao ao precionar enter (dentro de formularios <form>)
        // Eh possivel exibir modal com atalhos, requer lib jsTable
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
        if(cmd){this.map[cmd] = options;}
    }
    run(ev){ // Recebe e trata evento, executa metodo run do atalho (caso encontrado)
        // console.log(ev);
        let cmd = this.getScope(ev);
        if(this.map[cmd]){
            if(cmd.slice(-3) != 'FFF'){ev.preventDefault();} // Caso atalho seja sem combo (alt, ctrl, shift), nao previne comportamento default
            this.map[cmd].run(ev);
        }
        // Verifica se key=Enter e evento tem origem em input/select, se sim tenta tabular para proximo controle
        // !Atencao: Tabulacao somente ocorre se input estiver dentro de um <form> e somente para outros elementos do form
        // Caso proximo input esteja disable, hide ou tiver tabindex menor que zero busca proximo elemento
        else if(this.tabOnEnter && ev.key == 'Enter' && (ev.target.nodeName === 'INPUT' || ev.target.nodeName === 'SELECT')){
            ev.preventDefault();
            if(ev.target.hasOwnProperty('data-escape_tab')){return false} // Adicione attr data-escape_tab no inpit que queira evitar tabulacao no enter
            try{
                let form = ev.target.form;
                let index = Array.prototype.indexOf.call(form, ev.target);
                if(form.elements[index + 1].disabled == false && form.elements[index + 1].offsetParent != null && form.elements[index + 1].tabIndex >= 0){form.elements[index + 1].focus();}
                else{
                    let el = ev.target.form.elements;
                    let i = index + 1;
                    let escape = false;
                    while(i <= el.length && !escape){
                        if(form.elements[i].disabled == false && form.elements[i].offsetParent != null && form.elements[i].tabIndex >= 0){form.elements[i].focus();escape = true;}
                        else{i++;}
                    }
                }
            }catch(e){}
        }
    }
    getScope(ev){
        if(!ev.key){return null}
        let cmd = ev.key.toLowerCase();
        cmd += ev.altKey || ev.alt ? 'T': 'F';
        cmd += ev.ctrlKey || ev.ctrl ? 'T': 'F';
        cmd += ev.shiftKey || ev.shift ? 'T': 'F';
        return cmd;
    }
    unbind(list){ // Remove listener do mapa. Ex: appKeyBind.unbind('fTFF');
        try{delete this.map[list]}catch(e){}
    }
    unbindAll(){this.map = {}}
    getMap(){return Object.values(this.map)}
    showKeymapModal(){ // Requer jsTable
        let map = this.getMap();
        if(map.length == 0){this.modalTableTbody.innerHTML = '<tr><td colspan="3">Nenhum atalho disponivel</td></tr>'}
        else{
            this.modalTableTbody.innerHTML = ''
            for(let item in map){
                if(map[item]?.visible == false){continue}
                let comb = map[item].alt ? 'Alt + ' : '';
                comb += map[item].ctrl ? 'Ctrl + ' : '';
                comb += map[item].shift ? 'Shift + ' : '';
                comb += map[item].key.toUpperCase();
                let tr = `<tr><td>${map[item].name || ''}</td><td class="keywatch_table_combination_td"><code>${comb}</code></td><td>${map[item].desc || ''}</td></tr>`
                this.modalTableTbody.innerHTML += tr;
            }
        }
        this.modal.showModal();
    }
    __buildTable(){ // Cria tabela no modal (roda apenas ao carregar a pagina)
        this.modalTable = document.createElement('table');
        this.modalTable.classList = 'keywatch_table table table-sm table-striped table-hover border fs-7 mb-0';
        this.modalTableThead = document.createElement('thead');
        this.modalTableTbody = document.createElement('tbody');
        this.modalTableThead. innerHTML = '<tr><th>Nome</th><th>Combinação</th><th>Descrição</th></tr>';
        this.modalTable.appendChild(this.modalTableThead);
        this.modalTable.appendChild(this.modalTableTbody);
        this.modal.appendChild(this.modalTable);
    }
}
const appKeyMap = new Keywatch();
document.addEventListener('keydown', (e) => {appKeyMap.run(e)})