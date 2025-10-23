/*
* jsSelectm   Implementa controle para select multiple
*
* @version  1.08
* @since    03/02/2023
* @release  08/03/2023 [adicionado marcar todos]
* @author   Rafael Gustavo Alves {@email castelhano.rafael@gmail.com}
* @depend   boostrap 5.x, dot.css, dot.js
*/
class jsSelectm{
    constructor(el, options){
        this.target = typeof el === 'string' ? document.querySelector(el) : el;
        // Configuracoes
        this.defaults = {
            optionsSelected: [],                                       // Opcoes pre selecionadas ao instanciar objeto
            options: this.__initializeOptions(),                       // Options do select, pode dicionario {1: 'Ativo', 2: 'Afastado'} ou na omissao busca options do elemento 
            groups: false,                                             // Informa grupos com respectivos valores ex: {grupoA: [1,4], grupoB: [2]}
            title: false,                                              // Titulo do select
            onchange: () => {return true},                             // Funcao a ser chamada ao alterar componente
            disabled: false,                                           // Se true desativa operacoes nos eventos click e altera formatacao
            checkAll: true,                                            // Se true sera adicionado controle para marcar todas as opcoes
            canFilter: false,                                          // Se true adiciona input para filtrar opcoes
            reorderOptions: true,                                      // Se true reordena opcoes baseado no innerText
            // Estilizacao
            customStyles: false,                                       // Se false, adiciona estilos da lib na pagina
            wrapperClassList: 'jsSelectm_wrapper',                     // Classes o titulo (small) do select 
            filterInputClasslist: 'border-0 border-bottom rounded-top bg-body py-1 mb-1',  // Classes do input search
            filterInputStyle: 'outline: none; color: var(--bs-body-color); width: 99%;',                     // Stilos do input search
            filterInputPlaceholder: 'Pesquisa',                        // Placeholder do input
            iconUncheckedClasslist: 'bi bi-square me-2',               // Classes do icone desmarcado
            iconCheckedClasslist: 'bi bi-check-square-fill me-2',      // Classes do icone marcado
            iconSemiCheckedClasslist: 'bi bi-dash-square me-2',        // Classes do icone marcado parcialmente
            emptySelectMessage: '<p class="text-body-secondary fs-7">Nenhuma opção disponivel</p>', // Mensagem exibida em caso de select vazio
        }
        for(let k in this.defaults){ // carrega configuracoes para classe
            if(options.hasOwnProperty(k)){this[k] = options[k]}
            else{this[k] = this.defaults[k]}
        }

        this.__buildSelect();
        if(!this.customStyles){this.__addStyles();} // Cria estilos padrao caso nao definido estilos customizados
        this.buildOptions();
        // assegura que todos os valores informados em optionsSelected estejam marcados como selected no select original
        this.optionsSelected.forEach((el)=>{this.target.querySelector(`option[value="${el}"]`).selected = true})
    }
    __addStyles(){
        let style = document.createElement('style');
        style.innerHTML = '.jsSelectm_wrapper{position:relative;border: 1px solid var(--bs-border-color);border-radius: 0.375rem;padding: 0.375rem 0.875rem 0.475rem 0.75rem;}';
        style.innerHTML += '.jsSelectm_wrapper.disabled{background-color: #E9ECEF;}';
        style.innerHTML += '[data-bs-theme="dark"] .jsSelectm_wrapper.disabled{background-color: #393939;}';
        style.innerHTML += '.jsSelectm_wrapper small{margin-bottom: 5px;margin-right: 5px;}';
        style.innerHTML += '.jsSelectm_wrapper > div{max-height:230px;overflow-y: scroll;}';
        style.innerHTML += '.jsSelectm_wrapper div[data-value], .jsSelectm_wrapper div[data-role]{padding: 2px 5px 2px 5px; border-radius: 3px;}';
        style.innerHTML += '.jsSelectm_wrapper div[data-select]{background-color: rgba(25, 135, 84, 0.25)!important;}';
        style.innerHTML += '.accordion-collapse > input[type=search]{width: 100%!important;padding-left: 10px;}';
        if(!this.disabled){style.innerHTML += '@media(min-width: 992px){.jsSelectm_wrapper div[data-value]:hover, .jsSelectm_wrapper div[data-role]:hover{cursor: pointer;background-color: var(--bs-secondary-bg);}}';}
        document.getElementsByTagName('head')[0].appendChild(style);
    }
    __buildSelect(){
        this.target.style.display = 'none'; // Oculta select original
        this.wrapper = document.createElement('div');this.wrapper.classList = this.wrapperClassList;
        if(this.disabled){this.wrapper.classList.add('disabled')}
        if(this.title){
            this.titleEl = document.createElement('small');this.titleEl.innerHTML = this.title;
            this.wrapper.appendChild(this.titleEl);
        }
        this.loadingStatus = document.createElement('span');this.loadingStatus.style = 'position:absolute;top:5px;right:5px;display:none;';this.loadingStatus.innerHTML = '<div class="spinner-grow text-success"></div>';
        this.wrapper.appendChild(this.loadingStatus);
        this.optionsContainer = document.createElement('div');this.optionsContainer.style.marginTop = '5px';
        this.wrapper.appendChild(this.optionsContainer);
        this.target.after(this.wrapper);
    }
    __initializeOptions(){
        let options = {};
        this.target.querySelectorAll('option').forEach((e) => {
            options[e.value] = `${e.innerText}`;
            if(e.selected){
                this.optionsSelected.push(String(e.value));
            }
        });
        return options;
    }
    __reorderOptions(){
        let items = [...this.optionsContainer.querySelectorAll('[data-value]')];
        let reordered = items.sort(function(a, b) {
            return a.innerText == b.innerText ? 0 : (a.innerText > b.innerText ? 1 : -1);
        });
        this.optionsContainer.querySelectorAll('[data-value]').forEach((el)=>{el.remove()})
        for(let i in reordered){
            this.optionsContainer.appendChild(reordered[i]);
        }
    }
    buildOptions(){ // Monta os options
        console.log('build options');
          
        this.optionsContainer.innerHTML = '';
        let els; // armazena retorno da funcao addCheckAll: {'selectAll': selectAll, 'checkIcon':checkIcon, 'optionTxt':optionTxt};
        if(this.groups){this.__buildGroupsContainer()}
        else{
            if(this.canFilter){this.__addFilterInput(this.optionsContainer)};
            if(this.checkAll){
                els = this.__addCheckAll(this.optionsContainer);
                els.container = this.optionsContainer;
            };
        }
        
        let count = 0, selected = 0;
        for(let key in this.options){
            let option = document.createElement('div');
            let checkIcon = document.createElement('i');
            if(this.optionsSelected.includes(key)){
                checkIcon.classList = this.iconCheckedClasslist;
                option.dataset.select = '';
                selected++;
            }
            else{checkIcon.classList = this.iconUncheckedClasslist;}
            let optionTxt = document.createElement('span');
            option.dataset.value = key;
            optionTxt.innerHTML = this.options[key];
            option.appendChild(checkIcon);
            option.appendChild(optionTxt);
            if(!this.disabled){
                option.onclick = () => {
                    this.__switchOption(option);
                    if(this.groups){
                        els = this.__getCheckallGroupContainer(key)
                    }
                    if(els.container.querySelectorAll('[data-value][data-select]').length > 0){
                        if(els.container.querySelectorAll('[data-value]:not([data-select])').length > 0){els.checkIcon.classList = this.iconSemiCheckedClasslist}
                        else{els.checkIcon.classList = this.iconCheckedClasslist}
                        els.selectAll.setAttribute('data-checked', '')
                        els.optionTxt.innerHTML = 'Desmarcar todos';
                    }
                    else{
                        els.selectAll.removeAttribute('data-checked')
                        els.checkIcon.classList = this.iconUncheckedClasslist;
                        els.optionTxt.innerHTML = 'Marcar todos';
                    }
                };
            }
            if(this.groups){this.__getGroupContainer(key).appendChild(option);} // Se trabalhando com grupos adiciona item no devido grupo
            else{this.optionsContainer.appendChild(option);} // Caso nao insere no container
            count++;
        }
        // ajusta checkAll (texto e icone) baseado se existe ou nao itens selecionados
        if(this.groups){ // se aplicado grupos, analise precisa ser feita grupo a grupo
            for(let grupo in this.groups){
                let itens = new Set(this.groups[grupo]);
                let selected = this.optionsSelected.filter(i => itens.has(i));
                let els = {
                    'container': this.optionsContainer.querySelector(`[data-group="${grupo}"]`),
                    'selectAll': this.optionsContainer.querySelector(`[data-group="${grupo}"] [data-role="checkAll"]`), 
                    'checkIcon': this.optionsContainer.querySelector(`[data-group="${grupo}"] [data-role="checkAll"] i`), 
                    'optionTxt': this.optionsContainer.querySelector(`[data-group="${grupo}"] [data-role="checkAll"] span`)
                };
                if(selected == 0){
                    els.selectAll.removeAttribute('data-checked')
                    els.checkIcon.classList = this.iconUncheckedClasslist;
                    els.optionTxt.innerHTML = 'Marcar todos';
                }
                else{
                    if(selected.length == this.groups[grupo].length){els.checkIcon.classList = this.iconCheckedClasslist}
                    else{els.checkIcon.classList = this.iconSemiCheckedClasslist}
                    els.selectAll.setAttribute('data-checked', '')
                    els.optionTxt.innerHTML = 'Desmarcar todos';
                }
            }

        }
        else if(els && selected > 0){ // se select simples e existe item selecionado, altera o icone / status do botao checkAll
            if(selected == count){els.checkIcon.classList = this.iconCheckedClasslist}
            else{els.checkIcon.classList = this.iconSemiCheckedClasslist}
            els.optionTxt.innerHTML = 'Descarcar todos';
            els.selectAll.setAttribute('data-checked', '')
        }
        if(Object.keys(this.options).length == 0){
            this.optionsContainer.innerHTML = this.emptySelectMessage;
        }
        else if(this.reorderOptions && !this.groups){this.__reorderOptions();}
    }
    __buildGroupsContainer(){
        let acc = document.createElement('div');acc.classList = 'accordion';acc.setAttribute('data-jsSelect-role','group_container');
        for(let i in this.groups){
            let acc_item = document.createElement('div');acc_item.classList = 'accordion-item';
            let acc_header = document.createElement('div');acc_header.classList = 'accordion-header pointer';
            let acc_button = document.createElement('span');acc_button.classList = 'accordion-button collapsed fs-6 py-2';acc_button.setAttribute('data-bs-toggle','collapse');acc_button.setAttribute('data-bs-target',`[data-group=${i}]`);
            acc_button.innerHTML = i;
            let acc_container = document.createElement('div');acc_container.classList = 'accordion-collapse collapse';acc_container.setAttribute('data-group', i);acc_container.setAttribute('data-bs-parent', '[data-jsSelect-role=group_container]');
            if(this.canFilter){this.__addFilterInput(acc_container);}
            if(this.checkAll){this.__addCheckAll(acc_container);}
            acc_header.appendChild(acc_button);
            acc_item.appendChild(acc_header);
            acc_item.appendChild(acc_container);
            acc.appendChild(acc_item);
            this.optionsContainer.appendChild(acc);
        }
    }
    __addFilterInput(container){
        let filterInput = document.createElement('input');
        filterInput.setAttribute('data-role', 'filterInput')
        filterInput.type = 'search';
        filterInput.classList = this.filterInputClasslist;
        filterInput.style = this.filterInputStyle;
        filterInput.placeholder = this.filterInputPlaceholder;
        filterInput.oninput = ()=>{
            container.querySelectorAll('[data-value]').forEach((el)=>{
                if(el.innerText.toLowerCase().includes(filterInput.value.toLowerCase())){el.classList.remove('d-none')}
                else{el.classList.add('d-none')}
            })
        }
        container.appendChild(filterInput);
    }
    __addCheckAll(container, status='uncheck'){ // adiciona opção para selecionar todas as opções
        let selectAll = document.createElement('div');selectAll.setAttribute('data-role', 'checkAll');
        let checkIcon = document.createElement('i');
        switch (status) {
            case 'uncheck': checkIcon.classList = this.iconUncheckedClasslist; break;
            case 'check': checkIcon.classList = this.iconCheckedClasslist; selectAll.setAttribute('data-checked', '');break;
            case 'semi': checkIcon.classList = this.iconSemiCheckedClasslist; selectAll.setAttribute('data-checked', ''); break;
            default: checkIcon.classList = this.iconUncheckedClasslist; break;
        }
        let optionTxt = document.createElement('span');optionTxt.classList = 'fs-7 text-secondary';optionTxt.innerHTML = status == 'uncheck' ? 'Marcar todos' : 'Decarcar todos';
        selectAll.onclick = (e) => {
            this.loadingStatus.style.display = 'inline-block';
            setTimeout(() => { // Adiciona timeout para exibir this.loadingStatus antes de inicar processo..
                if(selectAll.dataset.checked != undefined){
                    this.optionsSelected = [];
                    selectAll.parentNode.querySelectorAll('[data-select]:not(.d-none)').forEach((el) => {
                        el.removeAttribute('data-select');
                        el.querySelector('i').classList = this.iconUncheckedClasslist;
                    });
                    if(selectAll.parentNode.querySelectorAll('[data-select]').length == 0){
                        checkIcon.classList = this.iconUncheckedClasslist;
                        selectAll.removeAttribute('data-checked');
                        optionTxt.innerHTML = 'Marcar todos';
                    }
                    else{
                        checkIcon.classList = this.iconSemiCheckedClasslist;
                    }
                }
                else{
                    if(selectAll.parentNode.querySelectorAll('div[data-value].d-none').length == 0){
                        checkIcon.classList = this.iconCheckedClasslist;
                        selectAll.setAttribute('data-checked', '');
                    }
                    this.optionsSelected = Object.keys(this.options);
                    selectAll.parentNode.querySelectorAll('div[data-value]:not([data-select], .d-none)').forEach((el) => {
                        el.setAttribute('data-select', '');
                        el.querySelector('i').classList = this.iconCheckedClasslist;
                    });
                    optionTxt.innerHTML = 'Desmarcar todos';
                }
                this.loadingStatus.style.display = 'none';
                this.rebuildTargetOptions();
                this.onchange();
            }, 15);
        };
        selectAll.appendChild(checkIcon);
        selectAll.appendChild(optionTxt);
        container.appendChild(selectAll);
        return {'selectAll': selectAll, 'checkIcon':checkIcon, 'optionTxt':optionTxt};
    }
    __getGroupContainer(key){ // Localiza se item esta em algum grupo, se sim retorna o container do grupo, caso nao retorna o container principal
        for(let group in this.groups){
            if(this.groups[group].includes(key)){return this.optionsContainer.querySelector(`[data-group="${group}"]`);}
        }
        return this.optionsContainer;
    }
    __getCheckallGroupContainer(key){
        for(let group in this.groups){
            if(this.groups[group].includes(key)){
                return {
                    'container': this.optionsContainer.querySelector(`[data-group="${group}"]`),
                    'selectAll': this.optionsContainer.querySelector(`[data-group="${group}"] [data-role="checkAll"]`), 
                    'checkIcon': this.optionsContainer.querySelector(`[data-group="${group}"] [data-role="checkAll"] i`), 
                    'optionTxt': this.optionsContainer.querySelector(`[data-group="${group}"] [data-role="checkAll"] span`)
                };
                // return this.optionsContainer.querySelector(`[data-group="${group}"]`)
            }
        }
        return false;

    }
    __switchOption(opt){ // Altera stilo e data-attr do option e chama funcao que refaz conteudo do select target 
        if(opt.dataset.select != undefined){
            opt.removeAttribute('data-select')
            opt.querySelector('i').classList = this.iconUncheckedClasslist;
            this.optionsSelected.splice(this.optionsSelected.indexOf(opt.dataset.value), 1);
        }
        else{
            opt.setAttribute('data-select','')
            opt.querySelector('i').classList = this.iconCheckedClasslist;
            this.optionsSelected.push(opt.dataset.value);
        }
        this.rebuildTargetOptions();
    }
    rebuildTargetOptions(){
        this.target.innerHTML = '';
        this.optionsContainer.querySelectorAll('[data-select]').forEach((e, i) => {
            this.target.innerHTML += `<option value="${e.dataset.value}" selected>${e.innerText}</option>`;
        })
        this.loadingStatus.style.display = 'none'; // Oculta loadingStatus (caso exibido)
        this.onchange();
    }
}