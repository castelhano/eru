/*
* jsTableJson Extende funcionalidade de jsTable, criando tabela a partir de objeto json
*
* @version  1.0
* @since    09/01/2024
* @author   Rafael Gustavo Alves {@email castelhano.rafael@gmail.com }
*/

class jsTableJson extends jsTable{
    constructor(table_id, options){
        // Inicia configuracao da tabela a ser criada
        let fakeTable = document.createElement('table');
        fakeTable.id = table_id;
        fakeTable.classList = options?.tableClasslist || 'table border table-striped table-hover caption-top mb-2';
        fakeTable.appendChild(document.createElement('thead'));
        fakeTable.appendChild(document.createElement('tbody'));
        // ********************
        super(fakeTable, options);
        this.container = options?.container || document.body; // container para tabela, caso nao informado, faz append no body
        this.container.appendChild(this.table);
        if(this.enablePaginate){this.table.after(this.pgControlsContainer)}
        this.data = options?.data || []; // Json com dados para popular tabela
        this.trash = []; // Ao deletar row, registro eh movido para o trash (permitndo retornar registro)
        this.editableCols = options?.editableCols || [];
        this.ignoredCols = options?.ignoredCols || []; // ex: ignoredCols: ['detalhe', 'senha'] campos informados aqui nao serao importados na tabela
        this.restoreButton = null; // Armazena o botao para restaurar linha do trash, necessario para exibir e ocultar baseado na existencia de itens no trash
        this.saveBtn = null;
        this.pivot = options?.pivot || false;
        // ****************
        this.canAddRow = options?.canAddRow != undefined ? options.canAddRow : false;
        this.canDeleteRow = options?.canDeleteRow != undefined ? options.canDeleteRow : false;
        this.canSave = options?.canSave != undefined ? options.canSave : false; // Boolean para exibicao do botao para salvar dados da tabela (funcao deve ser definida na origem)
        this.save = options?.save != undefined ? options.save : function(){console.log('jsTable: Nenhuma funcao definida para save, nas opcoes marque {canSave:true, save: suaFuncao} ')}; // Funcao definida aqui sera acionada no evento click do botao save
        // ****************
        this.tableClasslist = options?.tableClasslist || 'table border table-striped table-hover caption-top mb-2';
        this.editableColsClasslist = options?.editableColsClasslist || 'bg-body-tertiary';
        this.addRowButtonClasslist = options?.addRowButtonClasslist || 'btn btn-sm btn-outline-success';
        this.addRowButtonText = options?.addRowButtonText || '<i class="bi bi-plus-lg px-1"></i>';
        this.newRowClasslist = options?.newRowClasslist || 'table-done';
        this.deleteRowButtonClasslist = options?.deleteRowButtonClasslist || 'btn btn-sm btn-secondary';
        this.deleteRowButtonText = options?.deleteRowButtonText || '<i class="bi bi-trash-fill"></i>';
        this.saveButtonClasslist = options?.saveButtonClasslist || 'btn btn-sm btn-outline-primary';
        this.saveButtonText = options?.saveButtonText || '<i class="bi bi-floppy-fill px-1"></i>';
        this.restoreButtonClasslist = options?.restoreButtonClasslist || 'btn btn-sm btn-outline-secondary d-none';
        this.restoreButtonText = options?.restoreButtonText || '<i class="bi bi-clock-history px-1"></i>';
        // ****************
        
        this.buildHeaders();
        this.updateControls();
        this.buildRows();
        if(this.enablePaginate){this.paginate();}
    }
    updateControls(){
        if(this.canAddRow){
            let btn = document.createElement('button');
            btn.classList = this.addRowButtonClasslist;
            btn.onclick = () => this.addRow();
            btn.innerHTML = this.addRowButtonText;
            this.controlsGroup.appendChild(btn);
        }
        if(this.canSave){
            this.saveBtn = document.createElement('button');
            this.saveBtn.classList = this.saveButtonClasslist;
            this.saveBtn.onclick = () => this.save();
            this.saveBtn.innerHTML = this.saveButtonText;
            this.controlsGroup.appendChild(this.saveBtn);
        }
        if(this.canDeleteRow){
            this.restoreButton = document.createElement('button');
            this.restoreButton.classList = this.restoreButtonClasslist;
            this.restoreButton.onclick = () => this.restoreRow();
            this.restoreButton.innerHTML = this.restoreButtonText;
            this.controlsGroup.appendChild(this.restoreButton);
        }
    }
    buildHeaders(){
        let tr = document.createElement('tr');
        for(let i = 0;i < this.data.length;i++){
            for(let j in this.data[i]){
                if(!this.headers.includes(j) && !this.ignoredCols.includes(j)){
                    this.headers.push(j);
                    let th = document.createElement('th');
                    th.setAttribute('data-key',j);
                    th.innerHTML = j[0].toUpperCase() + j.substring(1);
                    if(this.canFilter && this.filterCols.includes(j)){th.innerHTML += '*'}
                    tr.appendChild(th);
                }
            }
        }
        if(this.canDeleteRow){ // Caso habilitado deleteRow, adiciona uma th relativa ao controle
            let th = document.createElement('th');
            th.innerHTML = '';
            tr.appendChild(th);
        }
        this.thead.appendChild(tr);
    }
    buildRows(){ // Constroi os objetos trs baseado no conteudo de this.data, popula this.raw
        this.cleanRows(); // Reinicia this.raw e limpa elementos do this.tbody
        let data_size = this.data.length;
        this.rawNextId = data_size + 1; // Ajusta o id de um eventual proximo elemento a ser inserido
        for(let i = 0;i < data_size;i++){
            let row = document.createElement('tr');
            row.dataset.rawRef = i;
            for(let j = 0;j < this.headers.length;j++){
                let v = this.data[i][this.headers[j]]; // Busca no json data se existe valor na row para o header, retorna o valor ou undefinied (caso nao encontre)
                let col = document.createElement('td');
                col.innerHTML = v != undefined ? v : ''; // Insere valor ou empty string '' para o campo
                let editable = this.editableCols.includes(this.headers[j]);
                col.contentEditable = editable ? true : false; // Verifica se campo pode ser editado, se sim marca contentEditable='True'
                col.classList = editable ? this.editableColsClasslist : ''; // Se campo for editavel, acidiona classe definida em editableColsClasslist
                row.appendChild(col);
            }
            this.rowAddControls(row); // Adiciona controles para row
            this.raw.push(row); 
            if(!this.enablePaginate){this.tbody.appendChild(row)}; // Se nao tenha paginacao insere elemento no tbody
        }
        if(data_size == 0){this.addEmptyRow();} // Caso nao exista nenhum registro, adiciona linha vazia
        if(this.showCounterLabel){this.rowsCountLabel.innerHTML = data_size};
    }
    rowAddControls(row){ // Adiciona os controles na linha (tr) alvo
        if(this.canDeleteRow){
            let controls = document.createElement('td');
            controls.classList = 'text-end py-1';
            let deleteBtn = document.createElement('span');
            deleteBtn.classList = this.deleteRowButtonClasslist;
            deleteBtn.innerHTML = this.deleteRowButtonText;
            deleteBtn.onclick = () => this.deleteRow(row);
            controls.appendChild(deleteBtn);
            row.appendChild(controls);
        }
    }
    rowsReset(){ // Popula tbody conforme conteudo de this.raw
        let size = this.raw.length;
        this.cleanTbody();
        if(this.enablePaginate){this.paginate()}
        else{for(let i = 0; i < size; i++){this.tbody.appendChild(this.raw[i]);}}
        if(this.showCounterLabel){this.rowsCountLabel.innerHTML = size};
    }
    loadData(json){ // Carrega dados na tabela (!! Limpa dados atuais)
        this.data = json;
        this.cleanTable();
        this.buildHeaders();
        this.buildListeners();
        this.buildRows();
        this.rowsReset(); // Atualiza conteudo da tabela
    }
    appendData(json){ // Carrega dados na tabela (mantem dados atuais) (!! Não adiciona novos cabecalhos)
        let data_size = json.length;
        let first = this.rawNextId; // Inicio dos ids a serem inseridos
        for(let i = 0; i < data_size;i++){
            let row = document.createElement('tr');
            row.dataset.rawRef = first + i;
            for(let j = 0;j < this.headers.length;j++){
                let v = json[i][this.headers[j]]; // Busca no json data se existe valor na row para o header, retorna o valor ou undefinied (caso nao encontre)
                let col = document.createElement('td');
                col.innerHTML = v != undefined ? v : ''; // Insere valor ou empty string '' para o campo
                let editable = this.editableCols.includes(this.headers[j]);
                col.contentEditable = editable ? true : false; // Verifica se campo pode ser editado, se sim marca contentEditable='True'
                col.classList = editable ? this.editableColsClasslist : ''; // Se campo for editavel, acidiona classe definida em editableColsClasslist
                row.appendChild(col);
            }
            this.rowAddControls(row); // Adiciona controles para row
            this.raw.push(row);
        }
        this.rowsReset();
    }
    addRow(){ // Adiciona nova linha na tabela
        if(this.raw.length == 0){this.tbody.querySelector('[data-type="emptyRow"]').remove();} // Se tabela vazia, remove linha de emptyRow
        if(this.enablePaginate){this.goToPage(this.lastPage)}; // Muda exibicao para ultima pagina
        let tr = document.createElement('tr');
        tr.dataset.rawRef = this.rawNextId;
        tr.classList = this.newRowClasslist;
        tr.dataset.type = 'newRow';
        for(let i = 0;i < this.headers.length;i++){
            let td = document.createElement('td');
            td.innerHTML = ''
            td.contentEditable = true; // Na nova linha todos os campos sao editaveis
            td.classList = this.editableColsClasslist;
            tr.appendChild(td);
        }
        this.rowAddControls(tr);
        this.raw.push(tr);
        this.tbody.appendChild(tr);
        this.rawNextId++; // Incrementa o rawNextId para eventual proximo elemento a ser inserido
        if(this.showCounterLabel){this.rowsCountLabel.innerHTML = this.raw.length}; // Ajusta contador para tabela
    }
    deleteRow(row){
        let done = false;
        let i = 0;
        let max = this.raw.length;
        while(!done && i <= max){ // Percorre o raw buscando a linha a ser removida
            if(this.raw[i].dataset.rawRef == row.dataset.rawRef){
                this.trash.push(this.raw.splice(i,1)[0]); // Remove elemento do raw e insere no trash
                done = true;
            }
            i++;
        }
        row.remove(); // Remove o elemento da tabela
        if(this.showCounterLabel){this.rowsCountLabel.innerHTML = this.raw.length}; // Ajusta contador para tabela
        if(this.raw.length == 0){this.addEmptyRow()} // Se linha excluida for a unica da tabela, adiciona emptyRow
        if(this.enablePaginate){
            try {this.tbody.appendChild(this.raw[this.leid]);}catch(error){} // Adiciona (se existir) proximo elemento ao final do tbody
            this.paginate(); // Refaz paginacao
        }
        this.restoreButton.classList.remove('d-none'); // Exibe botao para restaurar linha
    }
    restoreRow(){
        let tr = this.trash.pop();
        tr.classList = 'table-emphasis';
        if(this.raw.length == 0){this.tbody.innerHTML = ''} // Case tabela fazia, remove linha com mensagem de emptyrow
        if(this.enablePaginate){this.goToPage(this.lastPage)};
        this.tbody.appendChild(tr);
        this.raw.push(tr);
        if(this.trash.length == 0){this.restoreButton.classList.add('d-none');}
        if(this.showCounterLabel){this.rowsCountLabel.innerHTML = this.raw.length}; // Ajusta contador para tabela
    }
    getNewRows(opt){
        let items = [];
        let raw_size = this.raw.length;
        for(let i = 0;i < raw_size;i++){
            if(this.raw[i].dataset.type == 'newRow'){
                let item = {};
                let cols = this.raw[i].querySelectorAll('td');
                let cols_size = this.canDeleteRow ? cols.length - 1 : cols.length; // cols.length - 1 desconsidera a ultima coluna dos controles
                for(let j = 0; j < cols_size; j++){ 
                    item[this.headers[j]] = cols[j].innerText.replace('\n', '');
                }
                items.push(item);
            }
        }
        let format = opt?.format || 'array';
        switch(format){
            case 'array': return items;break;
            case 'json': return JSON.stringify(items);break;
        }
        return null;
    }
}