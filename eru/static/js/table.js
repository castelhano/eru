/*
* jsTable   Implementa operacoes com tabelas previamente criadas ou gera tabela a partir de dados json
*
* @version  2.21
* @since    07/08/2022
* @release  16/05/2023 [data-sort_role="none" em th para desativar sort][data-print="false" em tags sao desconsideradas para exportacao]
* @author   Rafael Gustavo Alves {@email castelhano.rafael@gmail.com}
* @depend   boostrap 5.2.0, fontawesome 5.15.4, dot.css, dot.js
*/
class jsTable{
    constructor(id, options){
        // Variaveis internas ********
        this.id = typeof id == 'string' ? id : id.id ? id.id : 'jsTable' ; // Armazena id da tabela (ou jsTable caso nao informado id)
        this.table = typeof id == 'object' ? id : null; // Aponta para tabela alvo
        this.raw = []; // Guarda todos os TRs da tabela
        this.filteredRows = []; // Guarda as rows filtradas
        this.rawNextId = 0; // Armazena o proximo id disponivel, usado no medido addRow
        this.loadingEl = null; // Guarda o componente loading
        this.rowsCountLabel = null; // Span com a qtde de registros na tabela
        this.headers = []; // Arrays de strings com o nome dos headers da tabela
        this.thead = this.table ? this.table.tHead : null; // Aponta para thead
        this.tbody = this.table ? this.table.tBodies[0] : null; // Aponta para tbody principal (armazena registros visiveis)
        this.trash = []; // Ao deletar row, registro eh movido para o trash (permitndo retornar registro)
        this.pgControls = null; // Elemento UL que ira conter os botoes de navegacao da tabela
        this.lastPage = 0; // Armazena a ultima pagina da tabela
        this.leid = 0; // Last Element Id: Armazena o id do ultimo elemento a ser exibido no body (na pagina atual)
        this.activeRow = null; // Armazena a row ativa caso habilitado navegacao na tabela
        this.activeRowEl = null; // Armazena o elemento tr ativo
        this.restoreButton = null; // Armazena o botao para restaurar linha do trash, necessario para exibir e ocultar baseado na existencia de itens no trash
        this.exportButtonCSV = null;
        this.saveBtn = null;
        this.filterInput = null;
        this.dataUrlTimeout = null; // Armazena o timeout para realizar consulta ajax
        // Configuracao ********
        this.data = options?.data || []; // Json com dados para popular tabela
        this.dataUrl = options?.dataUrl || null; // URL para buscar registros (via ajax)
        this.dataUrlKeyName = options?.dataUrlKeyName || 'pesquisa'; // Nome da variavel usada na consulta ajax
        this.dataUrlAdicionalFilters = options?.dataUrlAdicionalFilters || ''; // Filtros adicionais a serem adicionados na consulta ajax
        this.dataUrlMinDigits = options?.dataUrlMinDigits != undefined ? options.dataUrlMinDigits : 3; // Busca ajax eh acionada com no minimo de digitos setado em dataUrlMinDigits
        this.dataUrlDelay = options?.dataUrlDelay || 800; // Delay em milisegundos entre os inputs para realizar a consulta ajax
        this.container = options?.container || document.body; // parentNode da tabela, usado na construcao de tabela pelo evento createTable(), caso nao informado append nova tabela no body
        this.caption = options?.caption || null;
        this.keyBind = options?.keyBind != undefined ? options.keyBind : true;
        this.keyBindEscape = options?.keyBindEscape || []; // Atalhos a serem desconsiderados na inclusao
        this.showCounterLabel = options?.showCounterLabel != undefined ? options.showCounterLabel : true;
        this.canAddRow = options?.canAddRow != undefined ? options.canAddRow : false;
        this.canDeleteRow = options?.canDeleteRow != undefined ? options.canDeleteRow : false;
        this.canSave = options?.canSave != undefined ? options.canSave : false; // Boolean para exibicao do botao para salvar dados da tabela (funcao deve ser definida na origem)
        this.save = options?.save != undefined ? options.save : function(){console.log('jsTable: Nenhuma funcao definida para save, nas opcoes marque {canSave:true, save: suaFuncao} ')}; // Funcao definida aqui sera acionada no evento click do botao save
        this.canSort = options?.canSort != undefined ? options.canSort : true;
        this.canFilter = options?.canFilter != undefined ? options.canFilter : false;
        this.actionRowSelector = options?.actionRowSelector || '.btn'; // Aciona evento click de elemento que atenda querySelector
        this.filterCols = options?.filterCols || []; // Recebe o nome das colunas a ser analisado ao filtar Ex: filterCols: ['nome', 'email']
        this.canExportCsv = options?.canExportCsv != undefined ? options.canExportCsv : true;
        this.csvSeparator = options?.csvSeparator || ';';
        this.csvClean = options?.csvClean != undefined ? options.csvClean : false; // Se setado para true remove acentuacao e caracteres especiais (normalize NFD)
        this.csvHeaders = options?.csvHeaders != undefined ? options.csvHeaders : true; // Define se sera incluido cabecalhos no arquivo de exportacao CSV
        this.canExportJson = options?.canExportJson != undefined ? options.canExportJson : false;
        this.editableCols = options?.editableCols || [];
        this.fileName = options?.fileName || this.id; // Nome dos arquivos de exportacao (sem a extensao)
        this.enablePaginate = options?.enablePaginate != undefined ? options.enablePaginate : false; // Booleno setado para true se paginacao estiver ativa para tabela
        this.pgControlContainer = options?.pgControlContainer || false; // Controles de paginacao por default criados logo abaixo da tabela, pode ser alterado setando esta variavel
        this.rowsPerPage = options?.rowsPerPage || 15; // Quantidade de registros a serem exibidos por pagina
        this.activePage = options?.activePage || 1; // Informa pagina exibida no momento (ou pode ser setada na criacao do objeto)
        this.maxPagesButtons = options?.maxPagesButtons || 6; // Quantidade maxima de botoes a serem exibidos 
        // Estilizacao ********
        this.tableClasslist = options?.tableClasslist || 'table border table-striped table-hover caption-top mb-2';
        this.editableColsClasslist = options?.editableColsClasslist || 'text-primary';
        this.rowsCountLabelClasslist = options?.rowsCountLabelClasslist || 'btn btn-sm bg-body-secondary';
        this.addRowButtonClasslist = options?.addRowButtonClasslist || 'btn btn-sm btn-outline-success';
        this.addRowButtonText = options?.addRowButtonText || '<i class="bi bi-plus-lg px-1"></i>';
        this.newRowClasslist = options?.newRowClasslist || 'table-done';
        this.deleteRowButtonClasslist = options?.deleteRowButtonClasslist || 'btn btn-sm btn-secondary';
        this.deleteRowButtonText = options?.deleteRowButtonText || '<i class="bi bi-trash-fill"></i>';
        this.saveButtonClasslist = options?.saveButtonClasslist || 'btn btn-sm btn-outline-primary';
        this.saveButtonText = options?.saveButtonText || '<i class="bi bi-floppy-fill px-1"></i>';
        this.restoreButtonClasslist = options?.restoreButtonClasslist || 'btn btn-sm btn-outline-secondary d-none';
        this.restoreButtonText = options?.restoreButtonText || '<i class="bi bi-clock-history px-1"></i>';
        this.activeRowClass = options?.activeRowClass || 'selected';
        this.pgControlClasslist = options?.pgControlClasslist || 'pagination justify-content-end'; 
        this.pgPageClasslist = options?.pgPageClasslist || 'page-item';
        this.pgLinkClasslist = options?.pgLinkClasslist || 'page-link fs-7 px-2 py-1';
        this.pgFirstButtonLabel = options?.pgFirstButtonLabel || '<i class="bi bi-arrow-bar-left"></i>';
        this.pgPreviousButtonLabel = options?.pgPreviousButtonLabel || '<i class="bi bi-arrow-left"></i>';
        this.pgNextButtonLabel = options?.pgNextButtonLabel || '<i class="bi bi-arrow-right"></i>';
        this.emptyTableMessage = options?.emptyTableMessage || 'Nenhum registro a exibir';
        if(this.table == null){
            this.createTable();
            this.buildHeaders();
            this.buildControls();
            this.buildRows();
            this.buildListeners();
        }
        else{
            this.validateTable();
            this.buildControls();
            this.buildListeners();
        }
        if(this.enablePaginate){this.paginate();}
        if(this.keyBind){this.__appKeyMapIntegration();}
        this.loading(true); // Oculta spiner de loading quando terminado de carregar tabela
    }
    createTable(){
        this.table = document.createElement('table');
        this.table.id = this.id;
        this.table.classList = this.tableClasslist;
        this.thead = document.createElement('thead');
        this.tbody = document.createElement('tbody');
        this.table.caption = document.createElement('caption');
        this.table.caption.style.position = 'relative';
        this.table.appendChild(this.thead);
        this.table.appendChild(this.tbody);
        this.container.appendChild(this.table);
    }
    buildHeaders(){
        let tr = document.createElement('tr');
        for(let i = 0;i < this.data.length;i++){
            for(let j in this.data[i]){
                if(!this.headers.includes(j)){
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
    buildControls(){
        this.table.classList.add('caption-top'); // Adiciona a classe caption top (caso nao exista)
        if(this.canSort){this.table.classList.add('table-sortable')}
        if(this.enablePaginate){ // Cria os controles gerais para paginacao (first, next e previous)
            let pgNav = this.pgControlContainer || document.createElement('nav'); // Container principal dos controles de navegacao da tabela
            this.pgControls = document.createElement('ul'); // Controles de navegacao
            this.pgControls.classList = this.pgControlClasslist;
            let first = document.createElement('li');
            first.onclick = () => this.goToPage(1);
            first.classList = this.pgPageClasslist;
            first.innerHTML = `<span class="${this.pgLinkClasslist}">${this.pgFirstButtonLabel}</span>`;
            let previous = document.createElement('li');
            previous.onclick = () => this.previousPage();
            previous.classList = this.pgPageClasslist;
            previous.innerHTML = `<span class="${this.pgLinkClasslist}">${this.pgPreviousButtonLabel}</span>`;
            let next = document.createElement('li');
            next.onclick = () => this.nextPage();
            next.classList = this.pgPageClasslist;
            next.innerHTML = `<span class="${this.pgLinkClasslist}">${this.pgNextButtonLabel}</span>`;
            this.pgControls.appendChild(first); // Adiciona o botao para primeira pagina no pgControls
            this.pgControls.appendChild(previous); // Adiciona o botao para pagina anterior no pgControls
            this.pgControls.appendChild(next); // Adiciona o botao para proxima pagina no pgControls
            pgNav.appendChild(this.pgControls); // Adiciona o pgControls no container de navegacao
            if(!this.pgControlContainer){this.table.after(pgNav);} // Insere nav (caso nao definido container na instancia da clsse) com controles de paginacao no fim da tabela
        }
        // Controles do caption (filter input, addRow, export, save etc...)
        let capRow = document.createElement('div');capRow.classList = 'row g-2 align-items-end'; // Inicia row
        if(this.caption){ // Se informado caption ao instanciar objeto, cria div.col com conteudo do caption
            let capText = document.createElement('div');
            capText.classList = 'col-lg-auto';
            capText.innerHTML = this.caption;
            capRow.appendChild(capText);
        }
        if(this.canFilter || this.dataUrl){ // Se habilitado filtro insere div.col com input.text para filtrar tabela (ou buscar dados por ajax)
            let capFilter = document.createElement('div');
            capFilter.classList = 'col';
            this.filterInput = document.createElement('input');
            this.filterInput.type = 'text';
            this.filterInput.disabled = this.filterCols.length || this.dataUrl != null ? false : true; // Disabled elemento se nao informado colunas para filtrar (filterCols) ou definido url para busca ajax
            this.filterInput.classList = 'form-control form-control-sm';
            this.filterInput.placeholder = this.dataUrl != null ? 'Pesquisa' : 'Filtrar*';
            if(this.dataUrl != null){ // Se dataUrl busca dados ajax ao digitar
                this.filterInput.onkeyup = (e) => {this.dataUrlKeyup(e)};
                this.filterInput.onkeydown = (e) => {this.dataUrlKeydown(e)};
            }
            else{this.filterInput.onkeyup = (e) => this.filter(e);} // Caso nao, aciona metodo para filtrar eventos da tabela
            capFilter.appendChild(this.filterInput);
            capRow.appendChild(capFilter);
        }
        let capControlsGroup = document.createElement('div'); // Inicia btn-group
        capControlsGroup.classList = 'btn-group';
        if(this.showCounterLabel){
            this.rowsCountLabel = document.createElement('button'); // Cria elemento que vai armazenar a quantidade de registros na tabela
            this.rowsCountLabel.classList = this.rowsCountLabelClasslist;
            this.rowsCountLabel.disabled = true;
            this.rowsCountLabel.innerHTML = this.raw.length;
            capControlsGroup.appendChild(this.rowsCountLabel);
        }
        if(this.canAddRow){
            let btn = document.createElement('button');
            btn.classList = this.addRowButtonClasslist;
            btn.onclick = () => this.addRow();
            btn.innerHTML = this.addRowButtonText;
            capControlsGroup.appendChild(btn);
        }
        if(this.canSave){
            this.saveBtn = document.createElement('button');
            this.saveBtn.classList = this.saveButtonClasslist;
            this.saveBtn.onclick = () => this.save();
            this.saveBtn.innerHTML = this.saveButtonText;
            capControlsGroup.appendChild(this.saveBtn);
        }
        if(this.canDeleteRow){
            this.restoreButton = document.createElement('button');
            this.restoreButton.classList = this.restoreButtonClasslist;
            this.restoreButton.onclick = () => this.restoreRow();
            this.restoreButton.innerHTML = this.restoreButtonText;
            capControlsGroup.appendChild(this.restoreButton);
        }
        if(this.canExportCsv){
            this.exportButtonCSV = document.createElement('button');
            this.exportButtonCSV.classList = 'btn btn-sm btn-outline-secondary';
            this.exportButtonCSV.onclick = (e) => this.exportCsv(e);
            this.exportButtonCSV.innerHTML = 'CSV';
            this.exportButtonCSV.id = 'jsTableDownloadCSV';
            capControlsGroup.appendChild(this.exportButtonCSV);
        }
        if(this.canExportJson){
            let btn = document.createElement('button');
            btn.classList = 'btn btn-sm btn-outline-secondary';
            btn.onclick = (e) => this.exportJson(e);
            btn.innerHTML = 'JSON';
            capControlsGroup.appendChild(btn);
        }
        let capControls = document.createElement('div');
        capControls.classList = 'col-auto ms-auto';
        capControls.appendChild(capControlsGroup);
        capRow.appendChild(capControls);
        this.table.caption.appendChild(capRow);
        this.loadingEl = document.createElement('div');
        this.loadingEl.classList = 'd-flex justify-content-center align-items-center bg-light position-absolute border w-100 top-0 h-100';
        this.loadingEl.innerHTML = '<div class="spinner-border text-success" role="status"><span class="visually-hidden">Loading...</span></div>';
        this.table.caption.appendChild(this.loadingEl); // Adiciona loading componente na tabela        
    }
    buildListeners(){
        if(this.canSort){
            this.thead.querySelectorAll("th:not([data-sort_role=none]").forEach(headerCell => {
                headerCell.addEventListener("click", () => {
                    const headerIndex = Array.prototype.indexOf.call(headerCell.parentElement.children, headerCell);
                    const currentIsAscending = headerCell.classList.contains("th-sort-asc");  
                    this.sort(headerIndex, !currentIsAscending);
                });
            });
        }
    }
    loadData(json){ // Carrega dados na tabela (!! Limpa dados atuais)
        this.loading(); // Mostra spinner de carregamento
        this.data = json;
        this.cleanTable();
        this.buildHeaders();
        this.buildListeners();
        this.buildRows();
        this.rowsReset(); // Atualiza conteudo da tabela
        this.loading(true); // Oculta spinner de carregamento
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
    dataUrlKeyup(e){
        clearTimeout(this.dataUrlTimeout);
        if(e != undefined && [9,13,16,17,18,19,20,27,33,34,35,36,37,38,39,40,45,91,93,112,113,114,115,116,117,118,119,120,121,122,123,144,145].includes(e.keyCode)){return false;} // Nao busca registros caso tecla seja enter, arrows, shift, cntrl ou alt
        this.dataUrlTimeout = setTimeout(this.dataUrlGet.bind(this), this.dataUrlDelay);
    }
    dataUrlKeydown(e){clearTimeout(this.dataUrlTimeout)}
    dataUrlGet(){ // Funcao chamada no keyup do filterInput se definido dataUrl
        let criterio = this.filterInput.value.trim();
        let self = this; // Workaround para resolver conflito dentro da funcao ajax (this passa a se referir ao XMLHttpRequest)
        if(criterio.length >= this.dataUrlMinDigits){ // Aciona o ajax somente se tiver um minimo de caracteres digitados
            self.cleanRows();
            var xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange = function() {
                if(this.readyState == 4 && this.status == 200){
                    if(this.responseText == '[]'){
                        self.cleanRows();
                        self.rowsCountLabel.innerHTML = 0;
                        self.addEmptyRow();
                    }
                    else{
                        let obj = JSON.parse(this.responseText);
                        self.appendData(obj);
                    }
                }
            };
            xhttp.open("GET", `${self.dataUrl}?${self.dataUrlKeyName}=${criterio}${self.dataUrlAdicionalFilters}`, true);
            xhttp.send();
        }
        else{this.cleanRows();if(this.showCounterLabel){this.rowsCountLabel.innerHTML = 0};this.addEmptyRow()}
    }
    filter(e, criterio=null){
        if(this.raw.length == 0){ return null; } // Se tabela for vazia nao executa processo para filtro
        if([37, 38, 39, 40, 13].includes(e.keyCode)){this.filterInput.blur();return false;} // Nao busca registros caso tecla seja enter ou arrows
        let c = criterio || this.filterInput.value.toLowerCase();
        if(this.canFilter && this.filterCols.length > 0 && c != ""){
            this.filteredRows = []; // Limpa os filtros
            let rows_size = this.raw.length;
            let cols_size = this.headers.length;
            let cols = []; // Array armazena os indices das coluas a serem analizadas
            for(let i = 0;i < cols_size;i++){ // Monta array com indices das colunas procuradas
                if(this.filterCols.includes(this.headers[i])){cols.push(i)}
            }
            let row_count = 0;
            for (let i = 0; i < rows_size; i++) { // Percorre todas as linhas, e verifica nas colunas definidas em filterCols, se texto atende criterio
                let row_value = '';
                for(let j=0; j < cols.length;j++) {
                    try{ // Caso exista celulas mescladas cols[j] sera null, try omite apresentacao de erro
                        let td = this.raw[i].getElementsByTagName("td")[cols[j]];
                        row_value += td.textContent || td.innerText;
                    }catch(e){}
                }
                if(row_value.toLowerCase().indexOf(c) > -1) {this.filteredRows.push(this.raw[i]);row_count++;}
            }            
            if(row_count == 0){
                let tr = document.createElement('tr');
                tr.innerHTML = `<td colspan="${this.canDeleteRow ? this.headers.length + 1 : this.headers.length}">Nenhum registro encontrado com o criterio informado</td>`;
                this.filteredRows.push(tr);
            }
            if(this.showCounterLabel){this.rowsCountLabel.innerHTML = row_count};
        }
        else if(c == ""){
            this.filteredRows = [];
            if(this.showCounterLabel){this.rowsCountLabel.innerHTML = this.raw.length}
            
        }; // Ao limpar filtro, limpa array com rows filtradas
        if(this.enablePaginate){this.paginate()} // Refaz paginacao
        else{ // Caso paginacao nao esteja ativa, limpa as rows da tabela e carrega (filteredRows ou raw)
            this.cleanTbody();
            if(this.filteredRows.length > 0){this.filteredRows.forEach((r) => this.tbody.append(r))}
            else{
                if(this.raw.length > 0){this.raw.forEach((r) => this.tbody.append(r));}
                else{this.addEmptyRow();} // Caso nao exista nenhum registro, mostra linha com mensagem
            }
        }
    }
    paginate(){
        if(!this.enablePaginate){this.enablePaginate = true;} // Caso metodo seja acionado apos objeto instanciado, ativa flag enablePaginate = true
        let data = this.filteredRows.length > 0 ? this.filteredRows : this.raw; // Faz paginamento pelo array raw ou filteredRows (caso registros filtrados)
        let rowsSize = data.length;
        if(rowsSize > 0){
            this.lastPage = Math.ceil(rowsSize / this.rowsPerPage);
            if(this.activePage > this.lastPage){this.activePage = this.lastPage} // Impede tentativa de acesso de pagina maior que a qtde de paginas
            if(this.activePage < 1){this.activePage = 1} // Impede tentativa de acesso de pagina menor que 1
            let feid = (this.activePage - 1) * this.rowsPerPage; // FirstElementId: Seta o ID do primeiro elemento a ser mostrado
            this.leid = Math.min((feid + this.rowsPerPage) - 1, rowsSize - 1); // LastElementId: Seta o ID do ultimo elemento a ser mostrado   
            this.cleanTbody();
            for(let i = feid;i <= this.leid;i++ ){
                this.tbody.appendChild(data[i]);
            }
        }
        else{this.lastPage = 1; this.activePage = 1;} // Se tabela vazia, cria uma unica pagina e aponta p ela
        this.pgBuildPageControls(this.lastPage);
        this.activeRow = null; // Limpa foco na linha (caso linha focada)
        try {this.activeRowEl.classList.remove(this.activeRowClass);}catch(e){} // Limpa foco na linha (caso linha focada)
        this.activeRowEl = null; // Limpa foco na linha (caso linha focada)

    }
    pgBuildPageControls(pages){ // Cria botoes de navegacao das paginas
        let btns = this.pgControls.querySelectorAll('[data-type="pgPage"]'); // Seleciona todos os botoes de paginas
        btns.forEach(btn => {btn.remove();}); // Remove todos os botoes
        let startAt = Math.max(Math.min(Math.max(1, this.activePage - 1), (pages - this.maxPagesButtons) + 1),1); // Primeira pagina a ser exibida
        let current = startAt; // Contador para iteracao nas paginas
        let remmains = Math.min(this.maxPagesButtons, pages); // Contador para qtde de paginas restantes a inserir
        while(remmains > 0){ // Insere um botao para cada pagina (maximo definido em this.maxPagesButtons)
            let btn = document.createElement('li');
            btn.classList = this.pgPageClasslist;
            btn.dataset.type = 'pgPage';
            btn.dataset.page = current;
            if(this.activePage == current){btn.classList.add('active');}
            else{
                btn.onclick = () => this.goToPage(btn.dataset.page);
            } // Caso nao seja botao referente a pagina atual, adiciona trigger para pagina correspondente
            btn.innerHTML = `<a class="${this.pgLinkClasslist}">${current}</a>`;
            this.pgControls.appendChild(btn);
            current++;remmains--;
            if(remmains == 1){current = pages} // Ultimo botao sempre aponta para ultima pagina
        }
    }
    goToPage(page){this.activePage = page;this.paginate();}
    previousPage(){if(!this.enablePaginate || this.activePage == 1){return false}this.activePage--;this.paginate();}
    nextPage(){if(!this.enablePaginate || this.activePage == this.lastPage){return false}this.activePage++;this.paginate();}
    clearRowFocus(){}
    nextRow(){
        let tableRowsCount = this.tbody.querySelectorAll('tr:not(.emptyRow)').length;
        if(tableRowsCount == 0){return false;} // Se tabela vazia nao executa codigo
        if(tableRowsCount == this.activeRow + 1){this.firstRow();return false;} // Se estiver apontando para a ultima linha, retorna para a primeira
        if(this.activeRow == null){this.activeRow = 0;}
        else{
            this.tbody.querySelectorAll('tr')[this.activeRow].classList.remove(this.activeRowClass); // Remove classe da linha em foco atual
            this.activeRow ++;
        }
        this.tbody.querySelectorAll('tr')[this.activeRow].classList.add(this.activeRowClass); // Adiciona classe na linha destino
        this.activeRowEl = this.tbody.querySelectorAll('tr')[this.activeRow]; // Aponta para tr em foco
    }
    previousRow(){
        let tableRowsCount = this.tbody.querySelectorAll('tr:not(.emptyRow)').length;
        if(tableRowsCount == 0){return false;} // Se tabela vazia nao executa codigo
        if(this.activeRow == 0){this.lastRow();return false;} // Se estiver apontando para a primeira linha, foca ultima linha da tabela
        if(this.activeRow == null){this.activeRow = 0;}
        else{
            this.tbody.querySelectorAll('tr')[this.activeRow].classList.remove(this.activeRowClass); // Remove classe da linha em foco atual
            this.activeRow --;
        }
        this.tbody.querySelectorAll('tr')[this.activeRow].classList.add(this.activeRowClass); // Adiciona classe na linha destino
        this.activeRowEl = this.tbody.querySelectorAll('tr')[this.activeRow]; // Aponta para tr em foco
    }
    firstRow(){
        let tableRowsCount = this.tbody.querySelectorAll('tr:not(.emptyRow)').length;
        if(tableRowsCount == 0){return false;} // Se tabela vazia nao executa codigo
        if(this.activeRow != null){this.tbody.querySelectorAll('tr')[this.activeRow].classList.remove(this.activeRowClass);} // Remove classe da linha em foco atual}
        this.activeRow = 0;
        this.tbody.querySelectorAll('tr')[0].classList.add(this.activeRowClass); // Adiciona classe na linha destino
        this.tbody.querySelectorAll('tr')[0].focus(); // Move o foco
    }
    lastRow(){
        let tableRowsCount = this.tbody.querySelectorAll('tr:not(.emptyRow)').length;
        if(tableRowsCount == 0){return false;} // Se tabela vazia nao executa codigo
        if(this.activeRow != null){this.tbody.querySelectorAll('tr')[this.activeRow].classList.remove(this.activeRowClass);} // Remove classe da linha em foco atual}
        this.activeRow = tableRowsCount - 1;
        this.tbody.querySelectorAll('tr')[this.activeRow].classList.add(this.activeRowClass); // Adiciona classe na linha destino
    }
    enterRow(){
        if(this.activeRow != null){
            try {this.tbody.querySelectorAll('tr')[this.activeRow].querySelector(this.actionRowSelector).click();}catch(e){}
        }
    }
    sort(column, asc=true){
        if(this.raw.length == 0){ return null } // Se tabela for vazia, nao executa processo para classificar
        const modifier = asc ? 1 : -1; // Modificador para classificar em order crecente (asc=true) ou decrescente (asc=false)
        let rows = this.filteredRows.length > 0 ? this.filteredRows : this.raw; // Busca linhas em this.filteredRows (caso filtrado) ou em this.raw caso nao
        const sortedRows = rows.sort((a, b) => {
            const aColText = a.querySelector(`td:nth-child(${ column + 1 })`).textContent.trim();
            const bColText = b.querySelector(`td:nth-child(${ column + 1 })`).textContent.trim();  
            return aColText > bColText ? (1 * modifier) : (-1 * modifier);
        });
        rows = sortedRows; // Atualiza campos (filteredRows ou no raw)
        if(this.enablePaginate){this.paginate()} // Se paginacao habilitada, refaz paginacao
        else{rows.forEach((e) => this.tbody.append(e))} // Caso nao, atualiza o tbody da tabela
        
        this.thead.querySelectorAll("th").forEach(th => th.classList.remove("th-sort-asc", "th-sort-desc"));
        this.thead.querySelector(`th:nth-child(${ column + 1})`).classList.toggle("th-sort-asc", asc);
        this.thead.querySelector(`th:nth-child(${ column + 1})`).classList.toggle("th-sort-desc", !asc);
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
    getRows(){ // Retorna array com todas as linhas da tabela
        let items = [];
        let raw_size = this.raw.length;
        for(let i = 0;i < raw_size;i++){
            let item = {};
            let cols = this.raw[i].querySelectorAll('td');
            let cols_size = this.canDeleteRow ? cols.length - 1 : cols.length; // cols.length - 1 desconsidera a ultima coluna dos controles
            for(let j = 0; j < cols_size; j++){
                if(cols[j].innerHTML.match(/<.*data-print="false".*>(.*?)<\/.*>/gi)){ // Verifica se existe texto a ser desconsiderado para exportacao
                    let fakeEl = document.createElement('span');
                    fakeEl.innerHTML = cols[j].innerHTML.replaceAll(/<.*data-print="false".*>(.*?)<\/.*>/gi, '');
                    item[this.headers[j]] = fakeEl.innerText.replace(/(\r\n|\n|\r)/gm, '').replace(/(\s\s)/gm, ' ').trim(); // Remove espacos multiplos e quebra de linha
                }
                else{item[this.headers[j]] = cols[j].innerText.replace(/(\r\n|\n|\r)/gm, '').replace(/(\s\s)/gm, ' ').trim()}
            }
            items.push(item);
        }
        return items;
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
    getJson(){return JSON.stringify(this.getRows())} // Retorna todas as linhas da tabela em formato Json
    exportJson(e){
        let data = this.getJson();
        if(data.match(/<[^>]+data-print="false".*>(.*?)<\/.+?>/gi)){ // Verifica se existe texto a ser desconsiderado para exportacao
            data = data.replaceAll(/<[^>]+data-print="false".*>(.*?)<\/.+?>/gi, '');
        }
        let dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(data);
        let filename = `${this.fileName}.json`;
        let btn = document.createElement('a');
        btn.classList = 'd-none';
        btn.setAttribute('href', dataUri);
        btn.setAttribute('download', filename);
        btn.click();
        btn.remove();
        let originalClasslist = e.target.className;
        e.target.classList = 'btn btn-sm btn-success';
        try {dotAlert('success', 'Arquivo <b>json</b> gerado com <b>sucesso</b>')}catch(error){}
        setTimeout(function() {e.target.classList = originalClasslist;}, 800);
    }
    exportCsv(e){
        let csv = [];
        let raw_size = this.raw.length;
        if(this.csvHeaders){ // Insere cabecalhos
            csv.push(this.headers.join(this.csvSeparator));
        }
        for (let i = 0; i < raw_size; i++) {
            let row = [], cols = this.raw[i].querySelectorAll('td, th');
            let cols_size = this.canDeleteRow ? cols.length - 1 : cols.length; // Desconsidera coluna de controles (se existir)
            for (let j = 0; j < cols_size; j++) {
                let data;
                if(cols[j].innerHTML.match(/<[^>]+data-print="false".*>(.*?)<\/.+?>/gi)){ // Verifica se existe texto a ser desconsiderado para exportacao
                    let fakeEl = document.createElement('span');
                    fakeEl.innerHTML = cols[j].innerHTML.replaceAll(/<[^>]+data-print="false".*>(.*?)<\/.+?>/gi, '');
                    data = fakeEl.innerText.replace(/(\r\n|\n|\r)/gm, '').replace(/(\s\s)/gm, ' '); // Remove espacos multiplos e quebra de linha
                }
                else{data = cols[j].innerText.replace(/(\r\n|\n|\r)/gm, '').replace(/(\s\s)/gm, ' ')}
                if(this.csvClean){data = data.normalize("NFD").replace(/[\u0300-\u036f]/g, "");} // Remove acentuação e caracteres especiais
                data = data.replace(/"/g, '""').trim(); // Escape double-quote com double-double-quote 
                row.push('"' + data + '"'); // Carrega string
            }
            csv.push(row.join(this.csvSeparator));
        }
        let csv_string = csv.join('\n');
        let filename = `${this.fileName}.csv`;
        let link = document.createElement('a');
        link.style.display = 'none';
        link.setAttribute('target', '_blank');
        link.setAttribute('href', 'data:text/csv;charset=utf-8,%EF%BB%BF' + encodeURIComponent(csv_string));
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        let originalClasslist = e.target.className;
        e.target.classList = 'btn btn-sm btn-success';
        try {dotAlert('success', 'Arquivo <b>csv</b> gerado com <b>sucesso</b>')}catch(error){}
        setTimeout(function() {e.target.classList = originalClasslist;}, 800);
    }
    cleanTable(){this.headers = [];this.raw = [];this.thead.innerHTML = '';this.tbody.innerHTML = '';}
    cleanRows(){this.raw = [];this.tbody.innerHTML = '';this.rawNextId = 0;this.leid = 0;} // Reinicia this.raw e limpa this.tbody
    cleanTbody(){this.tbody.innerHTML = '';}
    addEmptyRow(){this.tbody.innerHTML = `<tr class="emptyRow"><td data-type="emptyRow" colspan="${this.canDeleteRow ? this.headers.length + 1 : this.headers.length}">${this.emptyTableMessage}</td></tr>`;}
    loading(done=false){
        if(done){this.loadingEl.classList.add('d-none')}
        else{this.loadingEl.classList.remove('d-none')}
    }
    validateTable(){ // Metodo chamado em tabelas previamente criadas, normaliza e categoriza elementos  
        if(!this.table.caption){this.table.caption = document.createElement('caption');} // Cria o caption da tabela caso nao exista
        else{this.caption = this.table.caption.innerHTML;this.table.caption.innerHTML = ''} // Limpa o caption atual, sera refeito no metodo buildControls
        this.table.caption.style.position = 'relative'; // Ajusta o posicionamento do caption para relative
        let ths = this.table.tHead.querySelectorAll('th,td'); // Busca todos os elementos th ou td no header da tabela
        for(let i = 0; i < ths.length;i++){ // Percorre todos os headers, ajustando conteudo e populando array de headers
            ths[i].setAttribute('data-key',ths[i].innerText); // Ajusta o data-attr key com o valor informado no th
            this.headers.push(ths[i].innerText); // Adiciona o header no array de headers
            if(this.canFilter && this.filterCols.includes(ths[i].innerText)){ths[i].innerHTML += '*'} // Verifica se header esta marcado para ser filtrado, se sim adiciona caracter identificador
        }
        if(this.canDeleteRow){this.thead.querySelector('tr').innerHTML += "<th></th>";} // Insere header para controle caso canDeleteRow
        
        let trs = this.table.querySelectorAll('tbody tr'); // Busca todas as linhas dentro de um tbody
        let trs_count = trs.length;
        this.rawNextId = trs_count; // Ajusta o id de um eventual proximo elemento a ser inserido
        for(let i = 0; i < trs_count; i++){
            trs[i].dataset.rawRef = i; // Ajusta data-attr rawRef do elemento tr
            let cols_size = trs[i].querySelectorAll('td').length;
            for(let j = 0; j < cols_size; j++){ // Percorre todas as colunas da tr para setar contentEditable nas colunas definidas em this.editableCols
                let editable = this.editableCols.includes(ths[j].dataset.key);
                trs[i].querySelectorAll('td')[j].contentEditable = editable ? true : false; // Verifica se campo pode ser editado, se sim marca contentEditable='True'
                let originalClasslist = trs[i].querySelectorAll('td')[j].className;
                trs[i].querySelectorAll('td')[j].classList = editable ? originalClasslist + this.editableColsClasslist : originalClasslist; // Se campo for editavel, acidiona classe definida em editableColsClasslist
            }
            this.rowAddControls(trs[i]); // Adiciona controles para row
            this.raw.push(trs[i]); // Adiciona linha no array raw
        }
        if(trs_count == 0){this.addEmptyRow();} // Caso nao exista nenhum registro, adiciona linha vazia
    }
    __appKeyMapIntegration(){
        appKeyMap.bind({key: 'arrowdown', ctrl: true, name: '<b class="text-orange">TABELA:</b>&nbsp;&nbsp;Próxima linha', desc:'Navega para próxima linha', run: () => {this.nextRow()}})
        appKeyMap.bind({key: 'arrowup', ctrl: true, name: '<b class="text-orange">TABELA:</b>&nbsp;&nbsp;Linha anterior', desc:'Navega para linha anterior', run: () => {this.previousRow()}})
        if(!this.keyBindEscape.includes('enterRow')){appKeyMap.bind({key: 'enter', ctrl: true, name: '<b class="text-orange">TABELA:</b>&nbsp;&nbsp;Acessa registro', desc:'Acessa registro em foco', run: () => {this.enterRow()}})}
        if(this.canFilter){appKeyMap.bind({key: 'f', ctrl: true, name: '<b class="text-orange">TABELA:</b>&nbsp;&nbsp;Pesquisar', desc:'Foca caixa de pesquisa tabela', run: () => {this.filterInput.select()}})}
        if(this.canExportCsv){appKeyMap.bind({key: 'd', alt: true, name: '<b class="text-orange">TABELA:</b>&nbsp;&nbsp;Baixar CSV', desc:'Baixa registros em formato CSV', run: () => {this.exportButtonCSV.click()}})}
        if(this.enablePaginate){
            appKeyMap.bind({key: 'arrowright', ctrl: true, name: '<b class="text-orange">TABELA:</b>&nbsp;&nbsp;Próxima página', desc:'Exibe próxima página da tabela', run: () => {this.nextPage()}})
            appKeyMap.bind({key: 'arrowleft', ctrl: true, name: '<b class="text-orange">TABELA:</b>&nbsp;&nbsp;Página Anterior', desc:'Exibe página anterior da tabela', run: () => {this.previousPage()}})
        }
    }
}