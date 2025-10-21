/*
* jsTable   Lib para operacoes com tabelas
*
* @version  3.1
* @release  10/09/2022 [change search.input listener (onkeyup > oninput), add blur search.input on navigate]
* @since    07/08/2022
* @desc     Versao 3x implementa por padrao funcionalidades [sort, paginate, export csv, export json, integracao keywatch.js], demais funcionalidades nas libs complementares
* @2.0      06/10/2023 Alterado para padrao de classes ES6 
* @3.0      08/01/2024 Subdividido em varios arquivos usando heranca
* @author   Rafael Gustavo Alves {@email castelhano.rafael@gmail.com }
* @depend   boostrap 5
*/
class jsTable{
    constructor(target, options){
        // Variaveis internas ********
        if(typeof target != 'object'){return false}
        this.table = target; // Aponta para tabela alvo
        this.raw = []; // Guarda todos os TRs da tabela
        this.filteredRows = []; // Guarda as rows filtradas
        this.rowsCountLabel = null; // Span com a qtde de registros na tabela
        this.headers = []; // Arrays de strings com o nome dos headers da tabela
        this.thead = this.table ? this.table.tHead : null; // Aponta para thead
        this.tbody = this.table ? this.table.tBodies[0] : null; // Aponta para tbody principal (armazena registros visiveis)
        this.pgControls = null; // Elemento UL que ira conter os botoes de navegacao da tabela
        this.lastPage = 0; // Armazena a ultima pagina da tabela
        this.leid = 0; // Last Element Id: Armazena o id do ultimo elemento a ser exibido no body (na pagina atual)
        this.activeRow = null; // Armazena a row ativa caso habilitado navegacao na tabela
        this.activeRowEl = null; // Armazena o elemento tr ativo
        this.exportButtonCSV = null;
        this.filterInput = null;
        // Configuracao ********
        this.caption = options?.caption || null;
        this.keyBind = options?.keyBind != undefined ? options.keyBind : true; // Booleando, se true cria atalhos na lib keywatch.js
        this.keyBindContext = options?.keyBindContext || 'default'; // Contexto para atalhos da tabela
        this.keyBindEscape = options?.keyBindEscape || []; // Atalhos a serem desconsiderados na inclusao
        this.showCounterLabel = options?.showCounterLabel != undefined ? options.showCounterLabel : true;
        this.canSort = options?.canSort != undefined ? options.canSort : true;
        this.canFilter = options?.canFilter != undefined ? options.canFilter : false;
        this.actionRowSelector = options?.actionRowSelector || '.btn'; // Aciona evento click de elemento que atenda querySelector
        this.filterCols = options?.filterCols || []; // Recebe o nome das colunas a ser analisado ao filtar Ex: filterCols: ['nome', 'email']
        this.canExportCsv = options?.canExportCsv != undefined ? options.canExportCsv : true;
        this.csvSeparator = options?.csvSeparator || ';';
        this.csvClean = options?.csvClean != undefined ? options.csvClean : false; // Se setado para true remove acentuacao e caracteres especiais (normalize NFD)
        this.csvHeaders = options?.csvHeaders != undefined ? options.csvHeaders : true; // Define se sera incluido cabecalhos no arquivo de exportacao CSV
        this.csvFoot = options?.csvFoot != undefined ? options.csvFoot : true; // Define se sera incluido cabecalhos no arquivo de exportacao CSV
        this.canExportJson = options?.canExportJson != undefined ? options.canExportJson : false;
        this.fileName = options?.fileName || this.table.id; // Nome dos arquivos de exportacao (sem a extensao)
        this.enablePaginate = options?.enablePaginate != undefined ? options.enablePaginate : false; // Booleno setado para true se paginacao estiver ativa para tabela
        this.pgControlContainer = options?.pgControlContainer || false; // Controles de paginacao por default criados logo abaixo da tabela, pode ser alterado setando esta variavel
        this.rowsPerPage = options?.rowsPerPage || 15; // Quantidade de registros a serem exibidos por pagina
        this.activePage = options?.activePage || 1; // Informa pagina exibida no momento (ou pode ser setada na criacao do objeto)
        this.maxPagesButtons = options?.maxPagesButtons || 6; // Quantidade maxima de botoes a serem exibidos 
        // Estilizacao ********
        this.rowsCountLabelClasslist = options?.rowsCountLabelClasslist || 'btn btn-sm bg-body-secondary';
        this.activeRowClass = options?.activeRowClass || 'selected';
        this.pgControlClasslist = options?.pgControlClasslist || 'pagination justify-content-end'; 
        this.pgPageClasslist = options?.pgPageClasslist || 'page-item';
        this.pgLinkClasslist = options?.pgLinkClasslist || 'page-link fs-7 px-2 py-1';
        this.pgFirstButtonLabel = options?.pgFirstButtonLabel || '<i class="bi bi-arrow-bar-left"></i>';
        this.pgPreviousButtonLabel = options?.pgPreviousButtonLabel || '<i class="bi bi-arrow-left"></i>';
        this.pgNextButtonLabel = options?.pgNextButtonLabel || '<i class="bi bi-arrow-right"></i>';
        this.emptyTableMessage = options?.emptyTableMessage || 'Nenhum registro a exibir';
        
        if(!options?.noValidate){this.validateTable()}
        this.buildControls();
        this.buildListeners();
        
        if(this.enablePaginate){this.paginate();}
        if(this.keyBind){this.__appKeyMapIntegration();}
    }
    buildControls(){
        this.table.classList.add('caption-top'); // Adiciona a classe caption top (caso nao exista)
        if(this.canSort){this.table.classList.add('table-sortable')}
        if(this.enablePaginate){ // Cria os controles gerais para paginacao (first, next e previous)
            this.pgControlsContainer = this.pgControlContainer || document.createElement('nav'); // Container principal dos controles de navegacao da tabela
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
            this.pgControlsContainer.appendChild(this.pgControls); // Adiciona o pgControls no container de navegacao
            if(!this.pgControlContainer){this.table.after(this.pgControlsContainer);} // Insere nav (caso nao definido container na instancia da clsse) com controles de paginacao no fim da tabela
        }
        // Controles do caption (filter input, addRow, export, save etc...)
        let capRow = document.createElement('div');capRow.classList = 'row g-2 align-items-end'; // Inicia row
        if(this.caption){ // Se informado caption ao instanciar objeto, cria div.col com conteudo do caption
            let capText = document.createElement('div');
            capText.classList = 'col-lg-auto';
            capText.innerHTML = this.caption;
            capRow.appendChild(capText);
        }
        if(this.canFilter){ // Se habilitado filtro insere div.col com input.text para filtrar tabela
            let capFilter = document.createElement('div');
            capFilter.classList = 'col';
            this.filterInput = document.createElement('input');
            this.filterInput.id = 'jsTable_filterinput';
            this.filterInput.type = 'text';
            this.filterInput.disabled = this.filterCols.length ? false : true; // Disabled elemento se nao informado colunas para filtrar (filterCols)
            this.filterInput.classList = 'form-control form-control-sm';
            this.filterInput.placeholder = 'Filtrar*';
            this.filterInput.autocomplete = false;
            this.filterInput.oninput = (e) => this.filter(e);
            capFilter.appendChild(this.filterInput);
            capRow.appendChild(capFilter);
        }
        this.controlsGroup = document.createElement('div'); // Inicia btn-group
        this.controlsGroup.classList = 'btn-group';
        if(this.showCounterLabel){
            this.rowsCountLabel = document.createElement('button'); // Cria elemento que vai armazenar a quantidade de registros na tabela
            this.rowsCountLabel.classList = this.rowsCountLabelClasslist;
            this.rowsCountLabel.disabled = true;
            this.rowsCountLabel.innerHTML = this.raw.length;
            this.controlsGroup.appendChild(this.rowsCountLabel);
        }
        if(this.canExportCsv){
            this.exportButtonCSV = document.createElement('button');
            this.exportButtonCSV.classList = 'btn btn-sm btn-outline-secondary';
            this.exportButtonCSV.onclick = (e) => this.exportCsv(e);
            this.exportButtonCSV.innerHTML = 'CSV';
            this.exportButtonCSV.id = 'jsTableDownloadCSV';
            this.controlsGroup.appendChild(this.exportButtonCSV);
        }
        if(this.canExportJson){
            let btn = document.createElement('button');
            btn.classList = 'btn btn-sm btn-outline-secondary';
            btn.onclick = (e) => this.exportJson(e);
            btn.innerHTML = 'JSON';
            this.controlsGroup.appendChild(btn);
        }
        let capControls = document.createElement('div');
        capControls.classList = 'col-auto ms-auto';
        capControls.appendChild(this.controlsGroup);
        capRow.appendChild(capControls);
        this.table.caption.appendChild(capRow);
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
    filter(e, criterio=null){
        if(this.raw.length == 0){ return null; } // Se tabela for vazia nao executa processo para filtro
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
            if(this.adicionalHeaders){
                csv.push([...this.headers, ...this.adicionalHeaders].join(this.csvSeparator));
            }
            else{
                csv.push(this.headers.join(this.csvSeparator));
            }
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
        if(this.tfoot && this.csvFoot){ // Se tabela tiver tfoot e this.csvFoot = true adiciona rodape ao exportar csv
            let foot = '';
            this.tfoot.querySelectorAll('td').forEach((el)=>{foot +=  el.innerHTML + this.csvSeparator})
            csv.push(foot.substring(0, foot.length - 1));
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
    cleanRows(){this.raw = [];this.tbody.innerHTML = '';this.leid = 0;} // Reinicia this.raw e limpa this.tbody
    cleanTbody(){this.tbody.innerHTML = '';}
    addEmptyRow(){this.tbody.innerHTML = `<tr class="emptyRow"><td data-type="emptyRow" colspan="${this.headers.length}">${this.emptyTableMessage}</td></tr>`;}
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
        let trs = this.table.querySelectorAll('tbody tr'); // Busca todas as linhas dentro de um tbody
        let trs_count = trs.length;
        for(let i = 0; i < trs_count; i++){
            trs[i].dataset.rawRef = i; // Ajusta data-attr rawRef do elemento tr
            let cols_size = trs[i].querySelectorAll('td').length;
            this.raw.push(trs[i]); // Adiciona linha no array raw
        }
        if(trs_count == 0){this.addEmptyRow();} // Caso nao exista nenhum registro, adiciona linha vazia
    }
    __appKeyMapIntegration(){
        appKeyMap.bind('ctrl+arrowdown', () => {this.nextRow();if(this.canFilter){this.filterInput.blur()}}, {'data-i18n':"jsTable.nextRow", 'data-i18n-dynamicKey':true, icon: 'bi bi-grid-1x2-fill text-purple', desc:'Tabela: Navega para próxima linha', context: this.keyBindContext, origin: 'jsTable'})
        appKeyMap.bind('ctrl+arrowup', () => {this.previousRow();if(this.canFilter){this.filterInput.blur()}}, {'data-i18n':"jsTable.previousRow", 'data-i18n-dynamicKey':true, icon:'bi bi-grid-1x2-fill text-purple', desc:'Tabela: Navega para linha anterior', context: this.keyBindContext, origin: 'jsTable'})
        if(!this.keyBindEscape.includes('enterRow')){appKeyMap.bind('ctrl+enter', () => {this.enterRow();if(this.canFilter){this.filterInput.blur()}}, {'data-i18n':"jsTable.accessRow", 'data-i18n-dynamicKey':true, icon:'bi bi-grid-1x2-fill text-purple', desc:'Tabela: Acessa registro em foco', context: this.keyBindContext, origin: 'jsTable'})}
        if(this.canFilter){appKeyMap.bind('ctrl+f', () => {this.filterInput.select();}, {'data-i18n':"jsTable.filterInputFocus", 'data-i18n-dynamicKey':true, icon:'bi bi-grid-1x2-fill text-purple', desc:'Tabela: Foca caixa de pesquisa', context: this.keyBindContext, origin: 'jsTable'})}
        if(this.canExportCsv){appKeyMap.bind('alt+d', () => {this.exportButtonCSV.click();if(this.canFilter){this.filterInput.blur()}}, {'data-i18n':"jsTable.downloadCSV", 'data-i18n-dynamicKey':true, icon:'bi bi-grid-1x2-fill text-purple', desc:'Tabela: Baixa registros em formato CSV', context: this.keyBindContext, origin: 'jsTable'})}
        if(this.enablePaginate){
            appKeyMap.bind('ctrl+arrowright', () => {this.nextPage();if(this.canFilter){this.filterInput.blur()}}, {'data-i18n':"jsTable.nextPage", 'data-i18n-dynamicKey':true, icon:'bi bi-grid-1x2-fill text-purple', desc:'Tabela: Exibe próxima página da tabela', context: this.keyBindContext, origin: 'jsTable'})
            appKeyMap.bind('ctrl+arrowleft', () => {this.previousPage();if(this.canFilter){this.filterInput.blur()}}, {'data-i18n':"jsTable.previousPage", 'data-i18n-dynamicKey':true, icon:'bi bi-grid-1x2-fill text-purple', desc:'Tabela: Exibe página anterior da tabela', context: this.keyBindContext, origin: 'jsTable'})
        }
    }
}
