class Autocomplete {
    /**
     * Inicializa a instância do Autocomplete.
     * @param {string|HTMLInputElement|HTMLTextAreaElement} inputSelector - Seletor CSS ou referência ao elemento input/textarea.
     * @param {Array<string>} data - Array de strings com os dados para autocompletar.
     * @param {object} options - Opções de configuração (opcional).
     */
    constructor(inputSelector, data, options = {}) {
        // Variáveis de instância (privadas ou protegidas por convenção)
        this.inputElement = typeof inputSelector === 'string' ? document.querySelector(inputSelector) : inputSelector;
        this.data = data;
        this.options = {
            minLength: options.minLength || 1, // Número mínimo de caracteres para começar a buscar
            maxResults: options.maxResults || 10, // Número máximo de resultados exibidos
            matchSubstring: options.matchSubstring || true, // Permitir busca por substring em qualquer parte do texto
            caseSensitive: options.caseSensitive || false, // Diferenciar maiúsculas de minúsculas
            ...options
        };
        this.autocompleteContainer = null; // Contêiner para a lista de sugestões
        this.selectedIndex = -1; // Índice do item selecionado na lista (para navegação via teclado)

        // Verificação básica do elemento de input
        if (!this.inputElement || !(this.inputElement instanceof HTMLInputElement || this.inputElement instanceof HTMLTextAreaElement)) {
            console.error('Elemento de input inválido fornecido.');
            return;
        }

        this._init();
    }

    /**
     * Método de inicialização que anexa os listeners de eventos.
     * @private
     */
    _init() {
        this.inputElement.addEventListener('input', this._handleInput.bind(this));
        this.inputElement.addEventListener('keydown', this._handleKeyDown.bind(this));
        this.inputElement.addEventListener('blur', this._handleBlur.bind(this));
        this._createContainer();
    }

    /**
     * Cria e anexa o contêiner de sugestões ao DOM.
     * @private
     */
    _createContainer() {
        this.autocompleteContainer = document.createElement('ul');
        this.autocompleteContainer.classList.add('autocomplete-results');
        // Posicione o contêiner abaixo do input no DOM, por exemplo, após o input.
        this.inputElement.parentNode.insertBefore(this.autocompleteContainer, this.inputElement.nextSibling);
    }

    /**
     * Lida com o evento de 'input' (digitação).
     * @private
     */
    _handleInput(event) {
        const query = event.target.value;
        if (query.length >= this.options.minLength) {
            const results = this._filterData(query);
            this._renderResults(results);
        } else {
            this._hideResults();
        }
    }

    /**
     * Filtra os dados com base na consulta, suportando busca por substring.
     * @private
     * @param {string} query - O texto digitado.
     * @returns {Array<string>} Os resultados filtrados.
     */
    _filterData(query) {
        // Normaliza a consulta se não for case-sensitive
        const normalizedQuery = this.options.caseSensitive ? query : query.toLowerCase();

        return this.data
            .filter(item => {
                const normalizedItem = this.options.caseSensitive ? item : item.toLowerCase();
                // Usa includes() para pesquisa de substring em qualquer lugar do texto
                return normalizedItem.includes(normalizedQuery); //
            })
            .slice(0, this.options.maxResults); // Limita o número de resultados
    }

    /**
     * Renderiza a lista de resultados no contêiner.
     * @private
     * @param {Array<string>} results - Os resultados a serem exibidos.
     */
    _renderResults(results) {
        this.autocompleteContainer.innerHTML = '';
        this.selectedIndex = -1;

        if (results.length === 0) {
            this._hideResults();
            return;
        }

        results.forEach((result, index) => {
            const li = document.createElement('li');
            li.textContent = result;
            li.addEventListener('click', () => this._selectResult(result));
            this.autocompleteContainer.appendChild(li);
        });

        this.autocompleteContainer.style.display = 'block';
    }

    /**
     * Esconde a lista de resultados.
     * @private
     */
    _hideResults() {
        this.autocompleteContainer.style.display = 'none';
        this.autocompleteContainer.innerHTML = '';
    }

    /**
     * Seleciona um resultado e atualiza o input.
     * @private
     * @param {string} result - O resultado selecionado.
     */
    _selectResult(result) {
        this.inputElement.value = result;
        this._hideResults();
        // Disparar evento personalizado se necessário (ex: 'autocomplete:select')
        const selectEvent = new CustomEvent('autocomplete:select', { detail: result });
        this.inputElement.dispatchEvent(selectEvent);
    }

    /**
     * Lida com a navegação via teclado (Arrow Up/Down, Enter).
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
     * Adiciona destaque visual ao item selecionado.
     * @private
     * @param {Array<HTMLLIElement>} items - A lista de elementos <li>.
     */
    _highlightItem(items) {
        items.forEach(item => item.classList.remove('highlighted'));
        if (items[this.selectedIndex]) {
            items[this.selectedIndex].classList.add('highlighted');
        }
    }

    /**
     * Esconde os resultados quando o input perde o foco (blur).
     * @private
     */
    _handleBlur() {
        // Pequeno atraso para permitir o clique em um item da lista antes de esconder
        setTimeout(() => this._hideResults(), 100);
    }
}

//******************  */

Dicas para Performance e Compatibilidade
Manipulação Eficiente do DOM:
Minimize a reflow e repaint do navegador. Em vez de adicionar itens li um por um, crie um fragmento de documento (DocumentFragment) com todos os itens e adicione-o ao autocompleteContainer de uma só vez.
Reutilize o contêiner (autocompleteContainer) em vez de criar e destruir a cada busca. Apenas limpe o conteúdo interno (innerHTML = '') e adicione os novos resultados.
Otimização do Filtro de Dados:
Para grandes volumes de dados, a função _filterData pode ser custosa. Considere o uso de algoritmos de busca mais eficientes, como o algoritmo de busca KMP ou Tries, se a performance for crítica. Para a maioria dos casos, Array.prototype.filter() e String.prototype.includes() são performáticos o suficiente.
Execute operações de normalização (como toLowerCase()) apenas uma vez, talvez durante o carregamento inicial dos dados ou no constructor, em vez de em cada evento de input.
Compatibilidade e Boas Práticas:
Use const e let em vez de var para melhor escopo e evitar problemas de hoisting.
O código acima usa JavaScript puro (Vanilla JS), o que garante excelente compatibilidade com todos os navegadores modernos, sem depender de bibliotecas externas. Teste em vários navegadores para garantir.
Utilize o método addEventListener() para vincular eventos, pois é o padrão moderno e compatível.
Adicione um pequeno atraso (setTimeout) no evento blur para permitir que o clique no item da lista seja registrado antes que a lista desapareça.
Experiência do Usuário (UX):
Adicione CSS para estilizar o autocompleteContainer e a classe .highlighted, fazendo a interface ser responsiva e acessível.
Use atributos aria-* para melhorar a acessibilidade para usuários que dependem de leitores de tela.
Com este modelo e dicas, você terá uma base sólida para uma biblioteca de autocomplete eficiente e robusta.


