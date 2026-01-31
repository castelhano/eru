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
                placeholder: gettext('Nome'),
            }],
            labels:{
                nome: gettext('Nome')
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
                dialog: 'min-height:300px;position:fixed;top:30px;left:50%; padding-bottom: 60px;transform: translate(-50%, 0);',
                spinner: 'position: absolute;top: 10px; right: 45px;',
                addOn: '',
                submit: '',
                cancel: 'position: absolute; top: 15px; right: 15px;',
                addBtn: '',
                deleteBtn: '',
                tableBtn: '',
                editButton: '',
                title: '',
                footer: 'position: absolute; bottom: 0;left: 0;width: 100%',
                addOnIcon: '',
                container: '',
                tableContainer: '',
                fieldContainer: '',
                deleteContainer: 'padding-left: 65px;',
                table: '',
                warningIcon: 'position: absolute; top: 135px; left: 20px; opacity: 0.4;font-size: 3.0rem;',
                inputLabel: '',
                inputText: '',
            },
            classlist: {
                dialog: 'related border-2 border-secondary bg-dark-subtle',
                spinner: 'spinner-grow text-success',
                title: 'text-body-secondary mb-2 pb-2 border-bottom',
                footer: 'border-top p-2 text-end',
                addOn: options?.url?.related?.show ? 'btn btn-secondary' : 'btn btn-success',
                submit: 'btn btn-sm btn-success ms-1',
                cancel: 'btn-close',
                addBtn: 'btn btn-sm btn-success float-start me-1',
                deleteBtn: 'btn btn-sm btn-danger me-1',
                tableBtn: 'btn btn-sm btn-secondary float-start me-1',
                editButton: 'btn btn-sm btn-dark py-0 me-1',
                addOnIcon: options?.url?.related?.show ? 'bi bi-search' : 'bi bi-plus-lg',
                addBtnIcon: 'bi bi-plus-lg',
                tableBtnIcon: 'bi bi-arrow-counterclockwise',
                editButtonIcon: 'bi bi-pen-fill',
                warningIcon: 'bi bi-exclamation-triangle-fill text-danger',
                container: 'input-group',
                tableContainer: 'pt-2',
                fieldContainer: '',
                deleteContainer: 'mt-3 fs-5 text-orange',
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
            deleteMsg: gettext('Esta operação não pode ser desfeita, confirma a exclusão do registro?'),
            submit: gettext('Gravar'),
            delete: gettext('Excluir'),
        }
        this.config = deepMerge(defaultOptions, options);
        this.config.rows = [];      // array armazena todas as linhas da tabela com registro do modelo related
        this.context = this.config.url.related.show ? 'show' : 'add';
        this.stackOnUpdate = [];    // pilha, executa todos as funcoes quando concluido o update do parent
        this._build();
    }
    _createElement(tag, attrs = {}) {
        const el = document.createElement(tag);
        for (const [key, value] of Object.entries(attrs)) {
            if (key === 'class') el.className = value;
            else if (key === 'classes') el.classList.add(...value.split(' '));
            else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
            else if (key === 'listener') {
                for (const [evt, handler] of Object.entries(value)) {
                    el.addEventListener(evt, handler);
                }
            } else if (typeof value === 'function') el[key] = value;
            else el.setAttribute(key, value);
        }
        return el;
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
                appKeyMap.setContext(`relatedAddon#${this.context == 'show' ? 'show' : 'set'}`);
            }
            else if(ev.newState == 'closed'){
                appKeyMap.setContext();
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
        this.model.cancel = document.createElement('button');
        this.model.cancel.type = 'button';
        this.model.cancel.style = this.config.styles.cancel;
        this.model.cancel.classList = this.config.classlist.cancel;
        this.model.cancel.onclick = ()=>{this.model.dialog.close()}
        this.model.dialog.appendChild(this.model.cancel);

        // --
        if(this.config.url.related.show){ this.model.dialog.appendChild(this._addModalTable()); }
        this.model.dialog.appendChild(this._addFields());
        if(this.config.url.related.delete){ this.model.dialog.appendChild(this._addDeleteContainer()); }
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
        this.model[this.config.value].autofocus = true;
        return this.model.fieldsContainer;
    }
    _addDeleteContainer(){
        this.model.deleteContainer = document.createElement('div');
        this.model.deleteContainer.classList = this.config.classlist.deleteContainer;
        this.model.deleteContainer.style = this.config.styles.deleteContainer;
        this.model.deleteContainer.style.display = 'none';
        this.model.deleteContainer.innerHTML = this.config.deleteMsg + '<br>';
        let warningIcon = document.createElement('i');
        warningIcon.style = this.config.styles.warningIcon;
        warningIcon.classList = this.config.classlist.warningIcon;
        let returnBtn = document.createElement('span');
        returnBtn.classList = 'link fs-5 ps-1'
        returnBtn.innerHTML = gettext('Voltar');
        returnBtn.onclick = ()=>{
            this._setContext('change');
        }
        this.model.deleteContainer.appendChild(warningIcon);
        this.model.deleteContainer.appendChild(returnBtn);
        return this.model.deleteContainer;
    }
    _addTableRow(data){
        let tr = document.createElement('tr');
        for(let field in this.config.fields){
            if(this.config.fields[field].name == 'pk'){continue}
            let td = document.createElement('td')
            td.innerHTML = data[this.config.fields[field].name] || '';
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
                    this.model[this.config.fields[field].name].value = target?.[this.config.fields[field].name];
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
        appKeyMap.bind(this.config.submitShortcut, ()=>{this.model.submit.click()}, {context: 'relatedAddon#set', icon: 'bi bi-floppy-fill text-primary', desc: gettext('Salva alterações'), origin: 'form#RelatedAddon'})
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
            appKeyMap.bind(this.config.addBtnShortcut, ()=>{this.model.addBtn.click()}, {context: 'relatedAddon#show', icon: 'bi bi-plus-square-fill text-success', desc: gettext('Exibe form para adicionar registro'), origin: 'form#RelatedAddon'})
            if(this.config.url.related.delete){ 
                this.model.deleteBtn = document.createElement('button');
                this.model.deleteBtn.type = 'button';
                this.model.deleteBtn.tabIndex = '-1';
                this.model.deleteBtn.style = this.config.styles.deleteBtn;
                this.model.deleteBtn.classList = this.config.classlist.deleteBtn;
                this.model.deleteBtn.innerHTML = this.config.delete;
                this.model.deleteBtn.onclick = ()=>{
                    if(this.context != 'delete'){
                        this._setContext('delete'); // altera contexto para delete
                    }
                    else{ this._delete() }
                };
                this.model.deleteBtn.style.display = 'none';
                this.model.footer.appendChild(this.model.deleteBtn) 
            }
            this.model.tableBtn = document.createElement('button');
            this.model.tableBtn.type = 'button';
            this.model.tableBtn.tabIndex = '-1';
            this.model.tableBtn.style = this.config.styles.tableBtn;
            this.model.tableBtn.classList = this.config.classlist.tableBtn;
            this.model.tableBtn.style.display = 'none';
            this.model.tableBtn.innerHTML = `<i class="${this.config.classlist.tableBtnIcon}"></i>`;
            this.model.tableBtn.onclick = ()=>{this._setContext('show')};
            appKeyMap.bind(this.config.tableBtnShortcut, ()=>{this._setContext('show')}, {context: 'relatedAddon#set', icon: 'bi bi-table text-success', desc: gettext('Exibe lista de registros'), origin: 'form#RelatedAddon'})
            // --
            this.model.submit.style.display = 'none';
            this.model.footer.appendChild(this.model.addBtn);
            this.model.footer.appendChild(this.model.tableBtn);
        }
        this.model.footer.appendChild(this.model.submit);
        return this.model.footer;
    }
    _setContext(context){
        if(!['add', 'change', 'show', 'delete'].includes(context)) return false;
        
        const contextConfig = {
            show: {
                tableContainer: 'block', fieldsContainer: 'none', deleteContainer: 'none',
                addBtn: 'block', tableBtn: 'none', deleteBtn: 'none', submit: 'none',
                keyContext: 'relatedAddon#show', focusField: null
            },
            add: {
                tableContainer: 'none', fieldsContainer: 'inline', deleteContainer: 'none',
                addBtn: 'none', tableBtn: this.config.url.related.show ? 'inline' : 'none', 
                deleteBtn: 'none', submit: 'inline', keyContext: 'relatedAddon#set', focusField: true, disabled: false
            },
            change: {
                tableContainer: 'none', fieldsContainer: 'inline', deleteContainer: 'none',
                addBtn: 'none', tableBtn: this.config.url.related.show ? 'inline' : 'none',
                deleteBtn: this.config.url.related.delete ? 'inline' : 'none', submit: 'inline',
                keyContext: 'relatedAddon#set', focusField: true, disabled: false
            },
            delete: {
                tableContainer: 'none', fieldsContainer: 'inline', deleteContainer: 'block',
                addBtn: 'none', tableBtn: 'none', deleteBtn: 'inline', submit: 'none',
                keyContext: 'relatedAddon#delete', focusField: false, disabled: true
            }
        };
        
        const cfg = contextConfig[context];
        this.context = context;
        appKeyMap.setContext(cfg.keyContext);
        
        if(this.model.tableContainer) this.model.tableContainer.style.display = cfg.tableContainer;
        this.model.fieldsContainer.style.display = cfg.fieldsContainer;
        if(this.model.deleteContainer) this.model.deleteContainer.style.display = cfg.deleteContainer;
        if(this.model.addBtn) this.model.addBtn.style.display = cfg.addBtn;
        if(this.model.tableBtn) this.model.tableBtn.style.display = cfg.tableBtn;
        if(this.model.deleteBtn) this.model.deleteBtn.style.display = cfg.deleteBtn;
        this.model.submit.style.display = cfg.submit;
        
        if(cfg.disabled !== undefined) this.model[this.config.value].disabled = cfg.disabled;
        if(cfg.focusField) this.model[this.config.fields[0].name].focus();
    }
    _getData(){
        let data = {};
        this.config.fields.forEach((el)=>{
            data[el.name] = this.model[el.name].value
        })
        return data;
    }
    _handleError(status, resp) {
        let message = `<b>${gettext('Erro ao salvar registro:')}</b>`;
        if (status === 401) {
            message += `<br>${gettext('Permissão negada')}`;
        } else if (status === 500) {
            message += `<br>${gettext('Erro de servidor')}`;
        } else if (status === 400 && resp?.errors) {
            for (let field in resp.errors) {
                resp.errors[field].forEach(el => { message += `<br>${el}`; });
            }
        }
        appAlert('danger', message, { autodismiss: false });
    }
    _relatedGetAll(){
        return fetch(this.config.url.related.show)
            .then(resp => resp.json())
            .then(d => typeof d !== 'object' ? JSON.parse(d) : d);
    }
    _parseData(response) {
        // Aceita tanto JSON direto quanto array JSON
        return Array.isArray(response) ? response[0] : response;
    }
    async _add() {
        this.model.spinner.style.display = 'block';
        try {
            const response = await fetch(this.config.url.related.add, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRFToken': this.config.url.csrf_token
                },
                body: JSON.stringify(this._getData())
            });
            const data = this._parseData(await response.json());
            if (response.ok) {
                if (this.config.url.related.show) {
                    this.config.rows.push(data);
                    this.model.tbody.appendChild(this._addTableRow(data));
                }
                if (this.config.parent) {
                    this.config.parent.reload();
                    this.stackOnUpdate.push(() => { this.element.value = data.pk });
                } else {
                    const opt = document.createElement('option');
                    opt.value = data.pk;
                    opt.innerHTML = data[this.config.value];
                    this.element.appendChild(opt);
                    this.element.value = data.pk;
                }
                this._clearForm();
                this.model.dialog.close();
                const label = data[this.config.value];
                appNotify('success', `${gettext('Registro criado com sucesso')}: <b>${label}</b>`);
            } else {
                this._handleError(response.status, data);
                this._clearForm();
                this._setContext('show');
                this.model.dialog.close();
            }
        } catch (error) {
            console.error('Erro ao criar:', error);
            appAlert('danger', 'Erro de conexão ao criar o registro.');
        } finally {
            this.model.spinner.style.display = 'none';
        }
    }
    async _update() {
        this.model.spinner.style.display = 'block';
        try {
            const response = await fetch(this.config.url.related.change, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRFToken': this.config.url.csrf_token
                },
                body: JSON.stringify(this._getData())
            });
            const data = this._parseData(await response.json());
            if (response.ok) {
                const target = this.config.rows.find(row => row.pk === parseInt(data.pk));
                if (target) {
                    for (let attr in data) { 
                        target[attr] = data[attr]; 
                    }
                }
                if (this.config.parent) {
                    this.config.parent.reload();
                } else {
                    const option = this.element.querySelector(`option[value="${data.pk}"]`);
                    if (option) option.innerHTML = data[this.config.value];
                }
                this._rebuildTableRows();
                this._clearForm();
                this._setContext('show');
                const label = data[this.config.value];
                appNotify('success', `${gettext('Registro alterado com sucesso')}: <b>${label}</b>`);
            } else {
                this._handleError(response.status, data);
                this._clearForm();
                this._setContext('show');
                this.model.dialog.close();
            }
        } catch (error) {
            console.error('Erro ao atualizar:', error);
            appAlert('danger', 'Erro de conexão ao atualizar o registro.');
        } finally {
            this.model.spinner.style.display = 'none';
        }
    }
    async _delete() {
        this.model.spinner.style.display = 'block';
        try {
            const response = await fetch(this.config.url.related.delete, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRFToken': this.config.url.csrf_token
                },
                body: JSON.stringify(this._getData())
            });
            const data = await response.json();
            if (response.ok) {
                this.config.rows = this.config.rows.filter(row => row.pk !== parseInt(data.pk));
                if (this.config.parent) {
                    this.config.parent.reload();
                } else {
                    const opt = this.element.querySelector(`option[value="${data.pk}"]`);
                    if (opt) opt.remove();
                }
                this._rebuildTableRows();
                this._clearForm();
                this._setContext('show');
                appNotify('warning', gettext('Registro excluído com sucesso'));
            } else {
                this._handleError(response.status, data);
                this._clearForm();
                this._setContext('show');
                this.model.dialog.close();
            }
        } catch (error) {
            console.error('Erro ao deletar:', error);
            appAlert('danger', 'Erro de conexão ao excluir o registro.');
        } finally {
            this.model.spinner.style.display = 'none';
        }
    }
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