/*
* jsTableAjax Extende funcionalidade de jsTable, implementando busca via ajax dos elementos da tabela
*
* @version  1.0
* @since    08/01/2024
* @author   Rafael Gustavo Alves {@email castelhano.rafael@gmail.com }
*/

class jsTableAjax extends jsTable{
    constructor(target, options){
        options['canFilter'] = true;
        options['filterCols'] = ['ajax'];
        super(target, options);
        this.container = options?.container || document.body; // parentNode da tabela, usado na construcao de tabela pelo evento createTable(), caso nao informado append nova tabela no body
        this.data = options?.data || []; // Json com dados para popular tabela
        this.dataUrl = options?.dataUrl || null; // URL para buscar registros (via ajax)
        this.dataUrlKeyName = options?.dataUrlKeyName || 'pesquisa'; // Nome da variavel usada na consulta ajax
        this.dataUrlAdicionalFilters = options?.dataUrlAdicionalFilters || ''; // Filtros adicionais a serem adicionados na consulta ajax
        this.dataUrlMinDigits = options?.dataUrlMinDigits != undefined ? options.dataUrlMinDigits : 3; // Busca ajax eh acionada com no minimo de digitos setado em dataUrlMinDigits
        this.dataUrlDelay = options?.dataUrlDelay || 800; // Delay em milisegundos entre os inputs para realizar a consulta ajax
        this.filterInput.onkeyup = (e) => {this.dataUrlKeyup(e)};
        this.filterInput.onkeydown = (e) => {this.dataUrlKeydown(e)};
    }
    dataUrlKeyup(e){
        clearTimeout(this.dataUrlTimeout);
        // Nao busca registros caso tecla seja enter, arrows, shift, cntrl ou alt
        if(e != undefined && [9,13,16,17,18,19,20,27,33,34,35,36,37,38,39,40,45,91,93,112,113,114,115,116,117,118,119,120,121,122,123,144,145].includes(e.keyCode)){return false;}
        this.dataUrlTimeout = setTimeout(this.dataUrlGet.bind(this), this.dataUrlDelay);
    }
    dataUrlKeydown(e){clearTimeout(this.dataUrlTimeout)}
    dataUrlGet(){ // Funcao (overwritten) chamada no keyup do filterInput
        let criterio = this.filterInput.value.trim();
        if(criterio.length >= this.dataUrlMinDigits){ // Aciona o ajax somente se tiver um minimo de caracteres digitados
            this.cleanRows();
            let self = this;
            var xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange = function(){
                if(this.readyState == 4 && this.status == 200){
                    if(this.responseText == '[]'){
                        self.cleanRows();
                        self.rowsCountLabel.innerHTML = 0;
                        self.addEmptyRow();
                    }
                    else{
                        let obj = JSON.parse(this.responseText);
                        self.updateTable(obj);
                    }
                }
            };
            xhttp.open("GET", `${this.dataUrl}?${this.dataUrlKeyName}=${criterio}${this.dataUrlAdicionalFilters}`, true);
            xhttp.send();
        }
        else{this.cleanRows();if(this.showCounterLabel){this.rowsCountLabel.innerHTML = 0};this.addEmptyRow()}
    }
    updateTable(json){ // Atualiza linhas da tabela conforme json de retorno
        let data_size = json.length;
        for(let i = 0; i < data_size;i++){
            let row = document.createElement('tr');
            for(let j = 0;j < this.headers.length;j++){
                let v = json[i][this.headers[j]]; // Busca no json data se existe valor na row para o header, retorna o valor ou undefinied (caso nao encontre)
                let col = document.createElement('td');
                col.innerHTML = v != undefined ? v : ''; // Insere valor ou empty string '' para o campo
                row.appendChild(col);
            }
            this.raw.push(row);
        }
        if(this.enablePaginate){this.paginate()}
        else{for(let i = 0; i < data_size; i++){this.tbody.appendChild(this.raw[i]);}}
        if(this.showCounterLabel){this.rowsCountLabel.innerHTML = data_size};
    }
}