class RelatedAddon {
    constructor(el, options){
        this.element = typeof el == 'string' ? document.querySelector(el) : el;
        let defaultOptions = {
            container: this.element.parentElement,
            fields: [{ // campos que seram exibidos no modal de cadastro, na omisao gera um imput text "nome"
                type: 'text', 
                name: 'nome', 
                id: 'id_nome', 
                classlist: 'form-control', 
                required: true,
                placeholder: i18n ? i18n.getEntry('common.name') || 'Nome' : 'Nome',
            }],
            labels:{
                nome: i18n ? i18n.getEntry('common.name') || '<span data-i18n="common.name">Nome</span>' : '<span data-i18n="common.name">Nome</span>'
            },
            url: {
                csrf_token: getCookie('csrftoken'),
                updateOnStart: false,
                parent: {
                    show: null,
                    params: null,
                },
                related: {
                    show: null,
                    add: null,
                    change: null,
                    delete: null,
                    params: null,
                }
            },
            styles: {
                dialog: 'min-width:500px;min-height:300px;position:fixed;top:30px;left:50%; padding-bottom: 60px;transform: translate(-50%, 0);',
                spinner: 'position: absolute;top: 10px; right: 20px;',
                addOn: '',
                submit: '',
                cancel: '',
                addBtn: '',
                tableBtn: '',
                editButton: '',
                title: '',
                footer: 'position: absolute; bottom: 0;left: 0;width: 100%',
                addOnIcon: '',
                container: '',
                tableContainer: '',
                fieldContainer: '',
                table: '',
                inputLabel: '',
                inputText: '',
            },
            classlist: {
                dialog: 'border-2 border-secondary bg-dark-subtle',
                spinner: 'spinner-grow text-success',
                title: 'text-body-secondary mb-2 pb-2 border-bottom',
                footer: 'border-top p-2 text-end',
                addOn: options?.url?.related?.show ? 'btn btn-secondary' : 'btn btn-success',
                submit: 'btn btn-sm btn-success ms-1',
                cancel: 'btn btn-sm btn-secondary',
                addBtn: 'btn btn-sm btn-success float-start me-1',
                tableBtn: 'btn btn-sm btn-secondary float-start me-1',
                editButton: 'btn btn-sm btn-dark py-0 me-1',
                addOnIcon: options?.url?.related?.show ? 'bi bi-search' : 'bi bi-plus-lg',
                addBtnIcon: 'bi bi-plus-lg',
                tableBtnIcon: 'bi bi-arrow-counterclockwise',
                editButtonIcon: 'bi bi-pen-fill',
                container: 'input-group',
                tableContainer: 'pt-2',
                fieldContainer: '',
                table: 'table table-sm border table-striped table-hover',
                inputLabel: 'form-label ps-1',
                inputText: 'form-control mb-2',
            },
            key: 'pk',                  // usado no SelectPopulate, eh o value do option a ser criado
            value: 'nome',              // usado no SelectPopulate, eh o innerHTML do option a ser criado
            shortcut: 'ctrl+enter;alt+enter',
            addBtnShortcut: 'alt+n',
            tableBtnShortcut: 'alt+v',
            submitShortcut: 'alt+g',
            title: '',
            jsTable: {canExportCsv: false, enablePaginate: true, rowsPerPage: 10, showCounterLabel: false},
            submit: i18n ? i18n.getEntry('common.save__bold:g') || '<span data-i18n="common.save__bold:g"><b>G</b>ravar</span>' : '<span data-i18n="common.save__bold:g"><b>G</b>ravar</span>',
            cancel: i18n ? i18n.getEntry('common.cancel') || '<span data-i18n="common.cancel">Cancelar</span>' : '<span data-i18n="common.cancel">Cancelar</span>',
        }
        this.config = deepMerge(defaultOptions, options);
        this.config.rows = [];      // array armazena todas as linhas da tabela com registro do modelo related
        this.context = this.config.url.related.show ? 'show' : 'add';
        this.stackOnUpdate = [];    // pilha, executa todos as funcoes quando concluido o update do parent
        this._build();
    }
    _build(){
        this.model = {}
        appKeyMap.bind(this.config.shortcut, ()=>{ this.model.addOn.click()}, {element: this.element, display: false, origin: 'form#RelatedAddon'})
        this.model.dialog = document.createElement('dialog');
        this.model.dialog.style = this.config.styles.dialog;
        this.model.dialog.classList = this.config.classlist.dialog;
        this.model.dialog.style.margin = '0px';
        this.model.dialog.style.zIndex = '10';
        this.model.dialog.addEventListener('beforetoggle', (ev)=>{
            if(ev.newState == 'open'){
                appPreviousContext = appKeyMap.getContext();
                appKeyMap.setContext(`relatedAddon#${this.context == 'show' ? 'show' : 'set'}`);
            }
            else if(ev.newState == 'closed'){
                appKeyMap.setContext(appPreviousContext);
            }
        })
        // --
        this.model.spinner = document.createElement('div');
        this.model.spinner.style = this.config.styles.spinner;
        this.model.spinner.classList = this.config.classlist.spinner;
        this.model.spinner.style.display = 'none';
        this.model.dialog.appendChild(this.model.spinner);
        // --
        if(this.config.title){
            this.model.title = document.createElement('h5');
            this.model.title.style = this.config.styles.title;
            this.model.title.classList = this.config.classlist.title;
            this.model.title.innerHTML += this.config.title;
            this.model.dialog.appendChild(this.model.title);
        }
        if(this.config.url.related.show){ this.model.dialog.appendChild(this._addModalTable()); }
        this.model.dialog.appendChild(this._addFields());
        this.model.dialog.appendChild(this._addFooter());
        document.body.appendChild(this.model.dialog)
        if(jsForm){ this.model.form = new jsForm(this.model.fieldsContainer, {}) }
        this.model.addOn = document.createElement('button');
        this.model.addOn.type = 'button';
        this.model.addOn.classList = this.config.classlist.addOn;
        this.model.addOn.tabIndex = '-1';
        this.model.addOn.onclick = ()=>{this.model.dialog.showModal()}
        this.model.icon = document.createElement('i');
        this.model.icon.style = this.config.styles.addOnIcon;
        this.model.icon.classList = this.config.classlist.addOnIcon;
        this.model.addOn.appendChild(this.model.icon);

        // *********
        // se definido url para o elemento principal (parent) e se for um select, cria instancia de selectPopulate
        if(this.config.url.parent.show && this.element.nodeName == 'SELECT'){
            // cria instancia de SelectPopulate, instancia disponivel this.parent
            this.config.parent = new selectPopulate({
                wait: !this.config.url.updateOnStart,
                target: this.element, 
                url: this.config.url.parent.show, 
                param: this.config.url.parent.param,
                emptyRow: {innerHTML: '---------', value: ''},
                then: ()=>{
                    this.stackOnUpdate.forEach((el)=>{
                        el();
                    })
                }
            })
        }
        
        let groupContainer = document.createElement('div');
        groupContainer.style = this.config.styles.container;
        groupContainer.classList = this.config.classlist.container;
        // carrega componente junto ao controle original, usa classes de input-group do bootstrap
        
        if(this.config.container.classList.contains('form-floating') && this.config.container.parentNode.classList.contains('row')){
            /** row
            *  ** form-floating col
            *  **** input
            */
            let col = document.createElement('div');
            let addClass = this.config.container.classList.value.replace('form-floating', '').trim().split(' ');
            addClass.forEach((e)=>{
                this.config.container.classList.remove(e);
                col.classList.add(e);
            })
            // se definido maxWidth no container, remove stilo e aplica max widht no col
            if(this.config.container.style.maxWidth != ''){
                col.style.maxWidth = this.config.container.style.maxWidth;
                this.config.container.style.maxWidth = '';
            }
            this.config.container.before(col);
            col.appendChild(groupContainer);
            // col.appendChild(this.dialog);
            groupContainer.appendChild(this.config.container);
            groupContainer.appendChild(this.model.addOn);
        }
        else{}
    }
    _addModalTable(){
        this.model.tableContainer = document.createElement('div');
        this.model.tableContainer.style = this.config.styles.tableContainer;
        this.model.tableContainer.classList = this.config.classlist.tableContainer;
        this.model.table = document.createElement('table');
        this.model.table.style = this.config.styles.table;
        this.model.table.classList = this.config.classlist.table;
        this.model.thead = document.createElement('thead');
        let tr = document.createElement('tr');
        this.model.thead.appendChild(tr);
        this.config.fields.forEach((el)=>{
            let th = document.createElement('th');
            th.innerHTML = el.name.captalize();
            tr.appendChild(th)
        })
        if(this.config.url.related.change){
            let th = document.createElement('th');
            th.innerHTML = ' ';
            tr.appendChild(th)
        }
        this.model.thead.appendChild(tr);
        this.model.tbody = document.createElement('tbody');
        this._relatedGetAll().then((resp)=>{
            resp.forEach((el)=>{
                this.config.rows.push(el);
                this.model.tbody.appendChild(this._addTableRow(el));
            })
            if(jsTable){this.model.jsTable = new jsTable(this.model.table, Object.assign(this.config.jsTable, {keyBindContext: 'relatedAddon#show'}))}
        });
        this.model.table.appendChild(this.model.thead);
        this.model.table.appendChild(this.model.tbody);
        this.model.tableContainer.appendChild(this.model.table)
        return this.model.tableContainer;
    }
    _addFields(){
        this.model.fieldsContainer = document.createElement('form');
        this.model.fieldsContainer.style = this.config.styles.fieldContainer;
        this.model.fieldsContainer.classList = this.config.classlist.fieldContainer;
        this.model.fieldsContainer.noValidate = true;
        this.model.fieldsContainer.setAttribute('autocomplete', 'off');
        // se informado url para show, inicia com context exibindo tabela com registros
        if(this.config.url.related.show){ this.model.fieldsContainer.style.display = 'none' }
        // adiciona input hidden para armazenar id do elemento no update
        this.config.fields.push({type: 'hidden', name: 'pk'})
        this.config.fields.forEach((el)=>{
            let attrs = {...el};
            if(el.type != 'hidden'){
                attrs = Object.assign({
                    class: this.config.classlist.inputText,
                    style: this.config.styles.inputText
                }, el);
                if(this.config.labels[attrs.name]){
                    this.model[`${attrs.name}_label`] = document.createElement('label');
                    this.model[`${attrs.name}_label`].innerHTML = this.config.labels[el.name];
                    this.model[`${attrs.name}_label`].style = this.config.styles.inputLabel;
                    this.model[`${attrs.name}_label`].classList = this.config.classlist.inputLabel;
                    this.model.fieldsContainer.appendChild(this.model[`${attrs.name}_label`])
                }
            }
            if(!['select', 'textarea', 'switch', 'checkbox', 'radio'].includes(el.type)){
                this.model[attrs.name] = document.createElement('input');
                for(let attr in attrs){
                    this.model[attrs.name].setAttribute(attr, attrs[attr])
                }
                this.model.fieldsContainer.appendChild(this.model[attrs.name])
            }
        })
        return this.model.fieldsContainer;
    }
    _addTableRow(data){
        let tr = document.createElement('tr');
        for(let field in this.config.fields){
            if(this.config.fields[field].name == 'pk'){continue}
            let td = document.createElement('td')
            td.innerHTML = data.fields[this.config.fields[field].name] || '';
            tr.appendChild(td);
        }
        if(this.config.url.related.change){
            let td = document.createElement('td');
            td.classList = 'text-end fit'
            let btn = document.createElement('button');
            btn.type = 'button';
            btn.classList = this.config.classlist.editButton;
            btn.style = this.config.styles.editButton;
            btn.setAttribute('data-id', data.pk)
            btn.innerHTML = `<i class="${this.config.classlist.editButtonIcon}"></i>`;
            btn.onclick = (el)=>{
                let target = this.config.rows.find(row => row.pk === parseInt(el.target.dataset.id));
                for(let field in this.config.fields){
                    this.model[this.config.fields[field].name].value = target?.[this.config.fields[field].name] || target?.fields?.[this.config.fields[field].name];
                }
                this._setContext('change');
            }
            td.appendChild(btn);
            tr.appendChild(td);
        }
        return tr;        
    }
    _addFooter(){
        this.model.footer = document.createElement('div');
        this.model.footer.style = this.config.styles.footer;
        this.model.footer.classList = this.config.classlist.footer;
        this.model.submit = document.createElement('button');
        this.model.submit.type = 'button';
        this.model.submit.style = this.config.styles.submit;
        this.model.submit.classList = this.config.classlist.submit;
        this.model.submit.innerHTML = this.config.submit;
        this.model.submit.onclick = ()=>{
            if(!this.model.form.validate()){return} // valida form, se for nao for valido, cancela operacao
            switch (this.context) {
                case 'add': this._add(); break;
                case 'change': this._update(); break;
            }
        };
        appKeyMap.bind(this.config.submitShortcut, ()=>{this.model.submit.click()}, {context: 'relatedAddon#set', icon: 'bi bi-floppy-fill text-primary', 'data-i18n': 'sys.shortcuts.submitForm', desc: 'Salva alterações', origin: 'form#RelatedAddon'})
        this.model.cancel = document.createElement('button');
        this.model.cancel.type = 'button';
        this.model.cancel.style = this.config.styles.cancel;
        this.model.cancel.classList = this.config.classlist.cancel;
        this.model.cancel.innerHTML = this.config.cancel;
        this.model.cancel.onclick = ()=>{this.model.dialog.close()}
        // --
        if(this.config.url.related.show){
            this.model.addBtn = document.createElement('button');
            this.model.addBtn.type = 'button';
            this.model.addBtn.tabIndex = '-1';
            this.model.addBtn.style = this.config.styles.addBtn;
            this.model.addBtn.classList = this.config.classlist.addBtn;
            this.model.addBtn.innerHTML = `<i class="${this.config.classlist.addBtnIcon}"></i>`;
            this.model.addBtn.onclick = ()=>{
                // limpa todos os campos do form
                for(let field in this.config.fields){ this.model[this.config.fields[field].name].value = '' }
                this._setContext('add'); // altera contexto para add
            };
            appKeyMap.bind(this.config.addBtnShortcut, ()=>{this.model.addBtn.click()}, {context: 'relatedAddon#show', icon: 'bi bi-plus-square-fill text-success', desc: '<span data-i18n="jsForm.relatedAddon.showAddContext">Exibe form para adicionar registro</span>', 'data-i18n': 'jsForm.relatedAddon.showAddContext', origin: 'form#RelatedAddon'})
            this.model.tableBtn = document.createElement('button');
            this.model.tableBtn.type = 'button';
            this.model.tableBtn.tabIndex = '-1';
            this.model.tableBtn.style = this.config.styles.tableBtn;
            this.model.tableBtn.classList = this.config.classlist.tableBtn;
            this.model.tableBtn.style.display = 'none';
            this.model.tableBtn.innerHTML = `<i class="${this.config.classlist.tableBtnIcon}"></i>`;
            this.model.tableBtn.onclick = ()=>{this._setContext('show')};
            appKeyMap.bind(this.config.tableBtnShortcut, ()=>{this._setContext('show')}, {context: 'relatedAddon#set', icon: 'bi bi-table text-success', desc: '<span data-i18n="jsForm.relatedAddon.showTableContext">Exibe lista de registros</span>', 'data-i18n': 'jsForm.relatedAddon.showTableContext', origin: 'form#RelatedAddon'})
            // --
            this.model.submit.style.display = 'none';
            this.model.footer.appendChild(this.model.addBtn);
            this.model.footer.appendChild(this.model.tableBtn);
        }
        this.model.footer.appendChild(this.model.cancel);
        this.model.footer.appendChild(this.model.submit);
        return this.model.footer;
    }
    _setContext(context){ // altera perfil de exibicao do modal
        if(!['add', 'change', 'show'].includes(context)){return false}
        this.context = context;
        if(context == 'show'){
            this.context = 'show';
            appKeyMap.setContext('relatedAddon#show');
            this.model.tableContainer.style.display = 'block';
            this.model.fieldsContainer.style.display = 'none';
            this.model.addBtn.style.display = 'block';
            this.model.tableBtn.style.display = 'none';
            this.model.submit.style.display = 'none';
        }
        else if(context == 'add' || context == 'change'){
            this.context = context;
            appKeyMap.setContext('relatedAddon#set');
            this.model.tableContainer.style.display = 'none';
            this.model.fieldsContainer.style.display = 'inline';
            this.model.addBtn.style.display = 'none';
            this.model.tableBtn.style.display = 'inline';
            this.model.submit.style.display = 'inline';
            this.model[this.config.fields[0].name].focus();
        }
    }
    _getData(){
        let data = {};
        this.config.fields.forEach((el)=>{
            data[el.name] = this.model[el.name].value
        })
        return data;
    }
    _relatedGetAll(){ // retora promise de requisicao ajax use _relatedGetAll().then((resp)=>{}).catch((err)=>{})
        let self = this;
        return new Promise(function(resolve, reject) {
            var xhr = new XMLHttpRequest();
            xhr.onload = function() {
                let d = JSON.parse(this.responseText);
                if(typeof d != 'object'){d = JSON.parse(d)}
                resolve(d);
            };
            xhr.onerror = reject;
            xhr.open('GET', self.config.url.related.show);
            xhr.send();
        });
    }
    _add(){ // executa ajax post para criacao de novo registro
        let self = this;
        this.model.spinner.style.display = 'block';
        let xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function() {
            if(this.readyState == 4 && this.status == 200){
                let resp =  JSON.parse(this.response);
                if(self.config.url.related.show){ // se estiver listando options, adiciona linha na tabela
                    self.model.tbody.appendChild(self._addTableRow(resp)); // adiciona linha na tabela do modal
                }
                if(self.config.parent){
                    self.config.parent.reload();
                    self.stackOnUpdate.push(()=>{self.element.value = resp.pk}); // adiciona na pilha a ser atualizada a selecao do option criado
                } // se definido url para atualiza o parent, faz ocnsulta ajax
                else{ // se nao apenas cria option e insere ao final do controle
                    let opt = document.createElement('option');
                    opt.value = resp.pk;
                    opt.innerHTML = resp.fields[self.config.value];
                    self.element.appendChild(opt);
                    self.element.value = resp.pk;
                }
                self._clearForm();
                self.model.dialog.close();
                self.model.spinner.style.display = 'none';
                appNotify('success', i18n ? i18n.getEntry(`sys.recordCreated__posfix: <b>${resp.fields.nome}</b>`) || `Registro criado com sucesso <b>${resp.fields.nome}</b>` : `Registro criado com sucesso <b>${resp.nome}</b>`)
            }
            else if(this.readyState == 4){
                let resp =  JSON.parse(this.response);
                console.log(resp);                
                let message = `<b>${i18n.getEntry('sys.recordErrorOnSaved__posfix::')}</b>` || '<b>Erro ao salvar registro:</b>';
                if(this.status == 401){
                    message += `<br>${i18n.getEntry('sys.401')}` || '<br>Permissão negada, verifique com administrador do sistema';
                }
                else if(this.status == 500){
                    message += `<br>${i18n.getEntry('sys.500')}` || '<br>Erro de servidor, se o problema persistir, contate o administrador';
                }
                else if(this.status == 400){
                    for(let field in resp.errors){
                        resp.errors[field].forEach((el)=>{ message += `<br>${el}` })
                    }
                }
                appAlert('danger', message, {autodismiss: false})
                self._clearForm();
                self._setContext('show');
                self.model.dialog.close();
            }
        };
        xhttp.open("POST", this.config.url.related.add, true);
        xhttp.setRequestHeader('X-CSRFToken', this.config.url.csrf_token);
        xhttp.send(JSON.stringify(this._getData()));
    }
    _update(){
        let self = this;
        this.model.spinner.style.display = 'block';
        let xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function() {
            if(this.readyState == 4 && this.status == 200){
                let resp =  JSON.parse(this.response);
                let target = self.config.rows.find(row => row.pk === parseInt(resp.pk));
                for(let attr in resp.fields){ target.fields[attr] = resp.fields[attr] }
                // ajusta referencia ao option em this.config.rows
                if(self.config.parent){self.config.parent.reload()} // se definido url para atualiza o parent, faz ocnsulta ajax
                else{ // se nao apenas cria option e insere ao final do controle
                    self.element.querySelector(`option[value="${resp.pk}"`).innerHTML = resp.fields[self.config.value]
                }
                self._rebuildTableRows();                
                self._clearForm();
                self.model.spinner.style.display = 'none';
                self._setContext('show');
                appNotify('success', i18n ? i18n.getEntry(`sys.recordUpdated__posfix: <b>${resp.fields[self.config.value]}</b>`) || `Registro alterado com sucesso <b>${resp.fields[self.config.value]}</b>` : `Registro alterado com sucesso <b>${resp.fields[self.value]}</b>`)
            }
            else if(this.readyState == 4){
                let resp =  JSON.parse(this.response);
                console.log(resp);
                let message = `<b>${i18n.getEntry('sys.recordErrorOnSaved__posfix::')}</b>` || '<b>Erro ao salvar registro:</b>';
                if(this.status == 401){
                    message += `<br>${i18n.getEntry('sys.401')}` || '<br>Permissão negada, verifique com administrador do sistema';
                }
                else if(this.status == 500){
                    message += `<br>${i18n.getEntry('sys.500')}` || '<br>Erro de servidor, se o problema persistir, contate o administrador';
                }
                else if(this.status == 400){
                    for(let field in resp.errors){
                        resp.errors[field].forEach((el)=>{ message += `<br>${el}` })
                    }
                }
                appAlert('danger', message, {autodismiss: false})
                self._clearForm();
                self._setContext('show');
                self.model.dialog.close();
            }
        };
        xhttp.open("POST", this.config.url.related.change, true);
        xhttp.setRequestHeader('X-CSRFToken', this.config.url.csrf_token);
        xhttp.send(JSON.stringify(this._getData()));
    }
    _delete(){}
    _clearForm(){
        this.config.fields.forEach((el)=>{
            this.model[el.name].value = '';
        })
    }
    _rebuildTableRows(){
        this.model.tbody.innerHTML = ''; // limpa linhas da tabela
        this.config.rows.forEach((el)=>{ this.model.tbody.appendChild(this._addTableRow(el)) })
        if(jsTable){
            this.model.jsTable.dispose(); // destroi referencias e listeners
            this.model.jsTable = null;
            this.model.jsTable = new jsTable(this.model.table, Object.assign(this.config.jsTable, {keyBindContext: 'relatedAddon#show'}))
        }
    }
}