class Autocomplete {
    /**
     * Inicializa a instancia do Autocomplete
     * @param {string|HTMLInputElement|HTMLTextAreaElement} inputSelector - Seletor CSS ou referencia ao elemento input/textarea
     * @param {Array<string>} data - Array de strings com os dados para autocompletar
     * @param {object} options - Opcoes de configuracao (opcional)
     */
    constructor(inputSelector, data=[], options = {}) {
        this.inputElement = typeof inputSelector === 'string' ? document.querySelector(inputSelector) : inputSelector;
        this.data = data;
        this.defaultOptions = {
            minLength: 2, // Numero minimo de caracteres para comecar a buscar
            maxResults: 10, // Numero maximo de resultados exibidos
            caseSensitive: false, // Diferenciar maiusculas de minusculas
            enable: true,
            prefix: '', // Adiciona prefixo ao valor que sera renderizado no input
            posfix: '', // Adiciona posfixo ao valor que sera renderizado no input
            tabValue: '    ', // ao precionar tab em textarea previne comportamento default e insere tabValue
            onchange: ()=>{}, // function a ser executada sempre que valor do input for alterado
        };
        this.options = Object.assign({}, this.defaultOptions, options)
        this.autocompleteContainer = null; // Conteiner para a lista de sugestoes
        this.selectedIndex = -1; // Indice do item selecionado na lista (para navegacao via teclado)
       

        // Verificacao basica do elemento de input
        if(!(this.inputElement.tagName.toLowerCase() === 'textarea' || (this.inputElement.tagName.toLowerCase() === 'input' && ['text','search'].includes(this.inputElement.type.toLowerCase())))){
            console.error('Autocomplete: Element must be a input (text or search) or textearea');
            return;
        }
        this._init();
    }

    /**
     * Metodo de inicializacao que anexa os listeners de eventos
     * @private
     */
    _init() {
        this.inputElement.addEventListener('input', this._handleInput.bind(this));
        this.inputElement.addEventListener('keydown', this._handleKeyDown.bind(this), true);
        this._createContainer();
        this.autocompleteContainer.addEventListener('click', this._handleClick.bind(this));
    }

    /**
     * Encontra a posicao do ultimo delimitador (espaco ou quebra de linha) antes da posicao dada
     * @private
     * @param {string} text - O texto do input
     * @param {number} pos - Posicao do cursor
     * @returns {number} Posicao de inicio da palavra
     */
    _findLastDelimiter(text, pos) {
        const delimiters = [' ', '\n'];
        let lastPos = -1;
        for (let delim of delimiters) {
            let idx = text.lastIndexOf(delim, pos - 1);
            if (idx > lastPos) lastPos = idx;
        }
        return Math.max(lastPos + 1, 0);
    }

    /**
     * Encontra a posicao do proximo delimitador (espaco ou quebra de linha) apos a posicao dada
     * @private
     * @param {string} text - O texto do input
     * @param {number} pos - Posicao do cursor
     * @returns {number} Posicao de fim da palavra
     */
    _findNextDelimiter(text, pos) {
        const delimiters = [' ', '\n'];
        let nextPos = text.length;
        for (let delim of delimiters) {
            let idx = text.indexOf(delim, pos);
            if (idx !== -1 && idx < nextPos) nextPos = idx;
        }
        return nextPos;
    }

    /**
     * Cria e anexa o conteiner de sugestoes ao DOM
     * @private
     */
    _createContainer() {
        this.inputElement.parentNode.style.position = 'relative';
        this.autocompleteContainer = document.createElement('ul');
        this.autocompleteContainer.classList.add('autocomplete-results');
        // Posiciona conteiner abaixo do input no DOM
        this.inputElement.parentNode.insertBefore(this.autocompleteContainer, this.inputElement.nextSibling);
    }

    /**
     * Lida com o evento de 'input' (digitacao)
     * @private
     */
    _handleInput(event) {
        if(!this.options.enable){return} // Se this.options.enable == false desativa analise do input
        if(event.data == ' ' || event.data == '\n' || event.data == null){  // se a tecla digitada for espaco ou quebra de linha nao realiza sugestao
            this._hideResults();
            return;
        }
        let cursorPosition = this.inputElement.selectionStart;
        let start = this._findLastDelimiter(this.inputElement.value, cursorPosition);
        let end = this._findNextDelimiter(this.inputElement.value, cursorPosition);
        const query = this.inputElement.value.substring(start, end);
        
        if (query.length >= this.options.minLength) {
            const results = this._filterData(query);
            this._renderResults(results, query);
        } else { this._hideResults() }
    }

    /**
     * Filtra os dados com base na consulta, suportando busca por substring
     * @private
     * @param {string} query - O texto digitado
     * @returns {Array<string>} Os resultados filtrados
     */
    _filterData(query) {
        // Normaliza a consulta se nao for case-sensitive
        const normalizedQuery = this.options.caseSensitive ? query : query.toLowerCase();

        return this.data
            .filter(item => {
                const normalizedItem = this.options.caseSensitive ? item : item.toLowerCase();
                // Usa includes() para pesquisa de substring em qualquer lugar do texto
                return normalizedItem.includes(normalizedQuery);
            })
            .slice(0, this.options.maxResults); // Limita o numero de resultados
    }

    /**
     * Renderiza a lista de resultados no conteiner
     * @private
     * @param {Array<string>} results - Os resultados a serem exibidos
     */
    _renderResults(results, query) {
        if (results.length === 0) {
            this._hideResults();
            return;
        }
        this.autocompleteContainer.innerHTML = '';

        results.forEach((result, index) => {
            const li = document.createElement('li');
            li.innerHTML = this._highlightMatch(result, query);
            this.autocompleteContainer.appendChild(li);
        });

        this.autocompleteContainer.style.display = 'block';
    }

    /**
     * Esconde a lista de resultados
     * @private
     */
    _hideResults() {
        this.autocompleteContainer.style.display = 'none';
        this.autocompleteContainer.innerHTML = '';
        this.selectedIndex = -1;
    }

    /**
     * Plota resultado no input, e dispara evento
     * @private
     * @param {string} result - O resultado selecionado
     */
    _selectResult(result) {
        result = this.options.prefix + result + this.options.posfix;
        let cursorPosition = this.inputElement.selectionStart;
        let start = this._findLastDelimiter(this.inputElement.value, cursorPosition);
        let end = this._findNextDelimiter(this.inputElement.value, cursorPosition);
        this.inputElement.value = this.inputElement.value.slice(0, start) + result + this.inputElement.value.slice(end);
        this.inputElement.focus();
        this.inputElement.setSelectionRange(start + result.length, start + result.length);
        this._hideResults();
        // Dispara evento no input de valor selecionado
        const selectEvent = new CustomEvent('autocomplete:select', { entry: result });
        this.inputElement.dispatchEvent(selectEvent);
        this.options.onchange();
    }

    /**
     * Lida com a navegacao via teclado (Arrow Up/Down, Enter)
     * @private
     */
    _handleKeyDown(event) {
        if(!this.options.enable) return;
        // alterar comportamento tecla tab em textarea com instancia Autocomplete de forma que insira tabulacao no texto
        // ao invez de assumir comportamento padrao (mudar foco para proximo elemento)
        if(event.key === 'Tab' && event.target.nodeName == 'TEXTAREA'){
            event.preventDefault();            
            const start = this.inputElement.selectionStart;
            const end = this.inputElement.selectionEnd;
            // insere a tabulacao no texto, na posicao do cursor
            this.inputElement.value = this.inputElement.value.substring(0, start) + this.options.tabValue + this.inputElement.value.substring(end);
            
            // mve o cursor para o final do texto inserido (mantem a usabilidade)
            this.inputElement.selectionStart = start + this.options.tabValue.length;
            this.inputElement.selectionEnd = start + this.options.tabValue.length;
            return;
        }
        
        const items = Array.from(this.autocompleteContainer.children);
        if (items.length === 0) return;
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            this.selectedIndex = (this.selectedIndex + 1) % items.length;
            this._highlightItem(items);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            this.selectedIndex = (this.selectedIndex - 1 + items.length) % items.length;
            this._highlightItem(items);
        } else if (event.key === 'Enter') {
            event.preventDefault();
            if (this.selectedIndex > -1) {
                this._selectResult(items[this.selectedIndex].textContent);
            }
        } else if (event.key === 'Escape') { this._hideResults() }
    }

    /**
     * Lida com evento click (selecao de entrada via mouse) na lista de opcoes
     * @private
     * @param {event} event - Evento a ser tratado
     */
    _handleClick(event) {
        if (event.target.nodeName === 'LI') { this._selectResult(event.target.textContent) }
    }

    /**
     * Adiciona destaque visual ao item selecionado
     * @private
     * @param {Array<HTMLLIElement>} items - A lista de elementos <li>
     */
    _highlightItem(items) {
        items.forEach(item => item.classList.remove('highlighted'));
        if (items[this.selectedIndex]) {
            items[this.selectedIndex].classList.add('highlighted');
        }
    }

    /**
     * Adiciona destaque visual ao texto correspondente no item
     * @private
     * @param {string} item - String com texto que sera renderizado
     * @param {string} match - Substring correspondente para destaque
     */
    _highlightMatch(item, match){ return item.replaceAll(match, `<span class="emphasis">${match}</span>`) }


    /**
     * Atualiza os dados para autocompletar
     * @public
     * @param {Array<string>} data - Lista com opcoes de sugestao para autocompletar
     */
    setData(data) { this.data = data; }
}