/**
* jsTableJson Extende funcionalidade de jsTable, criando tabela a partir de objeto json
*
* TODO: Ao exportar, em caso de pivot com totalizador de linha, nao esta sendo exibido header "Total"
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
        this.tfoot = document.createElement('tfoot');this.table.appendChild(this.tfoot);
        this.container = options?.container || document.body; // container para tabela, caso nao informado, faz append no body
        this.container.appendChild(this.table);
        if(this.enablePaginate){this.table.after(this.pgControlsContainer)}
        this.originalData = options?.data || []; // Json com dados originais fornecidos
        this.data = [...this.originalData]; // Faz copia dos dados (Json), usado no caso de pivot dos dados
        this.trash = []; // Ao deletar row, registro eh movido para o trash (permitndo retornar registro)
        this.editableCols = options?.editableCols || [];
        this.ignoredCols = options?.ignoredCols || []; // ex: ignoredCols: ['detalhe', 'senha'] campos informados aqui nao serao importados na tabela
        this.restoreButton = null; // Armazena o botao para restaurar linha do trash, necessario para exibir e ocultar baseado na existencia de itens no trash
        this.saveBtn = null;
        // Pivot: ex {pivot: {lin: 'matricula', col: 'cidade', value: 'count'}} retorna os dados em formato json ajustado somente para a linha e coluna informada, so aceita 1 campo para linha e outro para coluna 
        this.pivotSchema = options?.pivot || false; 
        this.totalLin = options.hasOwnProperty('totalLin') ? options.totalLin : true;  // Se true adiciona totalizador para linha
        this.totalCol = options.hasOwnProperty('totalCol') ? options.totalCol : true;  // Se true adiciona totalizador para coluna
        if(this.pivotSchema){this.pivot(this.pivotSchema, false)}
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
        this.tfootClasslist = options?.tfootClasslist || 'bg-body-secondary';
        this.totalLinClasslist = options?.totalLinClasslist || 'bg-body-secondary';
        this.totalColClasslist = options?.totalColClasslist || 'table-secondary';
        // ****************
        
        this.buildHeaders();
        this.updateControls();
        console.log('buildRows 000');
        if(this.pivotSchema){this.buildRows(true, this.pivotSchema?.precision || 0)}else{this.buildRows()}
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
        this.thead.innerHTML = '';
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
        if(this.pivotSchema && this.totalLin){
            let th = document.createElement('th');th.innerHTML = this.data.length > 0 ? 'Total' : 'Informativo'
            tr.appendChild(th);
        }
        this.thead.appendChild(tr); // Adiciona linha no thead
        this.buildListeners(); // Refaz listeners
    }
    buildRows(cur, precision=0){ // Constroi os objetos trs baseado no conteudo de this.data, popula this.raw
        console.log(cur);
        console.log(precision);
        
        this.cleanRows(); // Reinicia this.raw e limpa elementos do this.tbody
        let data_size = this.data.length;
        this.rawNextId = data_size + 1; // Ajusta o id de um eventual proximo elemento a ser inserido
        for(let i = 0;i < data_size;i++){
            let row = document.createElement('tr');
            row.dataset.rawRef = i;
            let row_total = 0;
            for(let j = 0;j < this.headers.length;j++){
                let v = this.data[i][this.headers[j]]; // Busca no json data se existe valor na row para o header, retorna o valor ou undefinied (caso nao encontre)
                let col = document.createElement('td');
                col.innerHTML = v == undefined ? '' : cur ? formatCur(v, precision) : v; // Insere valor ou empty string '' para o campo
                let editable = this.editableCols.includes(this.headers[j]);
                col.contentEditable = editable ? true : false; // Verifica se campo pode ser editado, se sim marca contentEditable='True'
                col.classList = editable ? this.editableColsClasslist : ''; // Se campo for editavel, acidiona classe definida em editableColsClasslist
                row.appendChild(col);
                if(j > 0 && v){row_total += parseFloat(v)} // Incrementa totalizador para linha
            }
            if(this.pivotSchema && this.totalLin){ // Se definito totalizador para linhas, cria td para o total
                let td = document.createElement('td');td.classList = this.totalLinClasslist;
                td.innerHTML = this.pivotSchema.hasOwnProperty('precision') ? formatCur(row_total, this.pivotSchema.precision) : formatCur(row_total, 0);
                row.appendChild(td);
            }
            this.rowAddControls(row); // Adiciona controles para row
            this.raw.push(row); 
            if(!this.enablePaginate){this.tbody.appendChild(row)}; // Se nao tenha paginacao insere elemento no tbody
        }
        if(data_size == 0){this.addEmptyRow();} // Caso nao exista nenhum registro, adiciona linha vazia
        if(this.showCounterLabel){this.rowsCountLabel.innerHTML = data_size};
        if(this.pivotSchema && this.totalCol && this.data.length > 0){this.buildFoot()};
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
        console.log('buildRows 002');
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
    pivot(schema, refreshTable=true){
        // Pivot deve obrigatoriamente ter atributos lin e col, sendo ambos strings
        // pode ser fornecido atributo value, neste caso muda comportamento padrao (count) e espera receber atributo type
        // para type sao aceitos count, sum, average, max ou min (default: count)
        this.pivotSchema = schema;
        let hasLin = this.pivotSchema.hasOwnProperty('lin');
        let hasCol = this.pivotSchema.hasOwnProperty('col');
        let hasValue = this.pivotSchema.hasOwnProperty('value');
        let hasType = this.pivotSchema.hasOwnProperty('type');
        if(
            !hasLin || typeof this.pivotSchema.lin != 'string' ||
            !hasCol || typeof this.pivotSchema.col != 'string' ||
            hasType && (typeof this.pivotSchema.type != 'string' || !['count','sum','average','max','min'].includes(this.pivotSchema.type)) ||
            hasType && (!hasValue || typeof this.pivotSchema.value != 'string')
        ){console.log('jsTableJson: Dados para Pivot invalidos, verifique as configuracoes');return undefined;}
        this.data = []; // Limpa this.data
        this._pivotSummary = {}; // Dicionario com totalizador para entrada da coluna {rafael: {bh: 0, mg:5}}
        for(let i = 0; i < this.originalData.length; i++){ // Percorre os davos fazendo o pivot nos campos informados
            if(this._pivotSummary.hasOwnProperty(this.originalData[i][this.pivotSchema.lin])){
                // Caso ja exista entrada para registro, atualiza valores
                if(this._pivotSummary[this.originalData[i][this.pivotSchema.lin]].hasOwnProperty(this.originalData[i][this.pivotSchema.col])){
                    // Caso coluna de value ja exista para registro, atualiza coluna
                    let entry = this._pivotSummary[this.originalData[i][this.pivotSchema.lin]];
                    entry[this.originalData[i][this.pivotSchema.col]] = this._pivotGetValue(this.originalData[i], entry[this.originalData[i][this.pivotSchema.col]]);
                    this._pivotSummary[this.originalData[i][this.pivotSchema.lin]] = entry;
                }
                else{
                    // Caso nao, inicia entrada
                    let entry = this._pivotSummary[this.originalData[i][this.pivotSchema.lin]];
                    entry[this.originalData[i][this.pivotSchema.col]] = this._pivotGetValue(this.originalData[i]);
                    this._pivotSummary[this.originalData[i][this.pivotSchema.lin]] = entry;
                }
            }
            else{ // Primeira entrada para registro, inicia entrada
                let entry = {}
                entry[this.originalData[i][this.pivotSchema.col]] = this._pivotGetValue(this.originalData[i]);
                this._pivotSummary[this.originalData[i][this.pivotSchema.lin]] = entry;
            }
        }
        
        if(this.pivotSchema?.type == 'average'){this._pivotAverage()} // Se type == 'average' calcula as medias dos itens
        else{
            if(this.pivotSchema.hasOwnProperty('precision')){ // Se informado precision, percorre summary ajustando a precisao antes de plotar
                for(let key in this._pivotSummary){
                    for(let col in this._pivotSummary[key]){
                        this._pivotSummary[key][col] = this._pivotSummary[key][col].toFixed(this.pivotSchema.precision);
                    }
                }
            }
            for(let entry in this._pivotSummary){ // Percorre dados ajustados de acordo com pivot e salva em this.data
            // Transforma dicionario para montagem da tabela de {rafael:{idade:25, sexo: 'm'}} para {nome: rafael, idade: 25, sexo: 'm'}
                let lin = {}
                lin[this.pivotSchema.lin] = entry;
                lin =  {...lin, ...this._pivotSummary[entry]}
                this.data.push(lin);
            }
        }

        if(refreshTable){ // Atualiza element table
            this.headers = []; // Limpa os readers
            this.buildHeaders();
            console.log('buildRows 001');            
            this.buildRows(true, this.pivotSchema?.precision || 0);
        }
    }
    buildFoot(){
        // let col_total = Object.values(this._pivotSummary[entry]).reduce((a, b) => a + b, 0)}
        this.tfoot.innerHTML = '';
        let subtotal = {};
        let total = 0;
        for(let row in this._pivotSummary){ // Percorre todas os registros do summary
            for(let col in this._pivotSummary[row]){ // Percorre todos os campos
                if(subtotal.hasOwnProperty(col)){subtotal[col] = parseFloat(this._pivotSummary[row][col] + subtotal[col]);}
                else{subtotal[col] = parseFloat(this._pivotSummary[row][col]);}
                total += parseFloat(this._pivotSummary[row][col]);
            }
        }
        
        let tr = document.createElement('tr'); // Cria linha para o tfoot
        let tdfirst = document.createElement('td');tdfirst.innerHTML = 'Total';tdfirst.classList = this.tfootClasslist; // Cria primeira td com a identificacao do totalizador
        tr.appendChild(tdfirst);
        
        for(let item in subtotal){ // Percorre todos os itens do resumo e insere o respectivo valor
            let td = document.createElement('td');td.classList = this.tfootClasslist;
            td.innerHTML = this.pivotSchema.hasOwnProperty('precision') ? formatCur(subtotal[item], this.pivotSchema.precision) : formatCur(subtotal[item], 0);
            tr.appendChild(td);
        }
        if(this.totalLin){
            let tdlast = document.createElement('td');tdlast.classList = this.tfootClasslist;
            tdlast.innerHTML = this.pivotSchema.hasOwnProperty('precision') ? formatCur(total, this.pivotSchema.precision) : formatCur(total, 0);
            tr.appendChild(tdlast);
        }
        this.tfoot.appendChild(tr);
    }
    _pivotGetValue(row, current){ // Funcao auxiliar a pivot, trata linha e retorna value baseado na definicao de type (count, sum, average, etc)
        if(!this.pivotSchema?.type || this.pivotSchema.type == 'count'){return current != undefined ? current += 1 : 1}
        else if(this.pivotSchema.type == 'sum' || this.pivotSchema.type == 'average'){return current != undefined ? current += row[this.pivotSchema.value] : row[this.pivotSchema.value]}
        else if(this.pivotSchema.type == 'max'){return current == undefined ? row[this.pivotSchema.value] : current > row[this.pivotSchema.value] ? current : row[this.pivotSchema.value]}
        else if(this.pivotSchema.type == 'min'){return current == undefined ? row[this.pivotSchema.value] : current > row[this.pivotSchema.value] ? row[this.pivotSchema.value] : current}
    }
    _pivotAverage(){
        this.data = [];
        for(let key in this._pivotSummary){
            for(let value in this._pivotSummary[key]){
                let qtde = this.originalData.filter(v=>{
                    return v[this.pivotSchema.lin] == key && v[this.pivotSchema.col] == value
                }).length;
                this._pivotSummary[key][value] = this.pivotSchema.hasOwnProperty('precision') ? (this._pivotSummary[key][value] / qtde).toFixed(this.pivotSchema.precision) : this._pivotSummary[key][value] / qtde;
            }
            this.data.push({key, ...this._pivotSummary[key]});
        }
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