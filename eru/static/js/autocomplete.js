class Autocomplete {
    /**
     * Inicializa a instancia do Autocomplete
     * @param {string|HTMLInputElement|HTMLTextAreaElement} inputSelector - Seletor CSS ou referencia ao elemento input/textarea
     * @param {Array<string>} data - Array de strings com os dados para autocompletar
     * @param {object} options - Opcoes de configuracao (opcional)
     */
    constructor(inputSelector, data=[], options = {}) {
        // Variaveis de instancia (privadas ou protegidas por convencao)
        this.inputElement = typeof inputSelector === 'string' ? document.querySelector(inputSelector) : inputSelector;
        this.data = data;
        this.options = {
            minLength: options.minLength || 2, // Numero minimo de caracteres para comecar a buscar
            maxResults: options.maxResults || 10, // Numero maximo de resultados exibidos
            matchSubstring: options.matchSubstring || true, // Permitir busca por substring em qualquer parte do texto
            caseSensitive: options.caseSensitive || false, // Diferenciar maiusculas de minusculas
            ...options
        };
        this.autocompleteContainer = null; // Conteiner para a lista de sugestoes
        this.selectedIndex = -1; // Indice do item selecionado na lista (para navegacao via teclado)

        // Verificacao basica do elemento de input
        if((this.inputElement.tagName.toLowerCase() === 'textarea') || (this.inputElement.tagName.toLowerCase() === 'input' && (['text','search'].includes(this.inputElement.type.toLowerCase())))){
        // if (!this.inputElement || (this.inputElement.nodeName == 'INPUT' && !['text', 'search'].includes(this.inputElement.type)) && !(this.inputElement instanceof HTMLTextAreaElement)){
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
        this.inputElement.addEventListener('keydown', this._handleKeyDown.bind(this));
        this.inputElement.addEventListener('blur', this._handleBlur.bind(this));
        this._createContainer();
    }

    /**
     * Cria e anexa o conteiner de sugestoes ao DOM
     * @private
     */
    _createContainer() {
        this.autocompleteContainer = document.createElement('ul');
        this.autocompleteContainer.classList.add('autocomplete-results');
        // Posicione o conteiner abaixo do input no DOM, por exemplo, apos o input
        this.inputElement.parentNode.insertBefore(this.autocompleteContainer, this.inputElement.nextSibling);
    }

    /**
     * Lida com o evento de 'input' (digitacao)
     * @private
     */
    _handleInput(event) {
        if(event.data == ' '){return} // se a tecla digitada for espaco nao realiza sugestao
        let end = this.inputElement.selectionStart;        
        let start = Math.max(this.inputElement.value.lastIndexOf(' ', end - 1), 0);
        const query = this.inputElement.value.substring(start, end);
        if (query.length >= this.options.minLength) {
            const results = this._filterData(query);
            this._renderResults(results);
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
    _renderResults(results) {
        if (results.length === 0) {
            this._hideResults();
            return;
        }

        results.forEach((result, index) => {
            const li = document.createElement('li');
            li.textContent = result;
            // li.addEventListener('click', () => this._selectResult(result));
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
     * Seleciona um resultado e atualiza o input
     * @private
     * @param {string} result - O resultado selecionado
     */
    _selectResult(result) {
        // this.inputElement.value = result;
        this._hideResults();
        // Disparar evento personalizado se necessario (ex: 'autocomplete:select')
        const selectEvent = new CustomEvent('autocomplete:select', { detail: result });
        this.inputElement.dispatchEvent(selectEvent);
    }

    /**
     * Lida com a navegacao via teclado (Arrow Up/Down, Enter)
     * @private
     */
    _handleKeyDown(event) {
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
                items[this.selectedIndex].click();
            }
        }
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
     * Esconde os resultados quando o input perde o foco (blur)
     * @private
     */
    _handleBlur() {
        // Pequeno atraso para permitir o clique em um item da lista antes de esconder
        setTimeout(() => this._hideResults(), 100);
    }
}