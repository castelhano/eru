
class jsGrid{
    constructor(options){
        this.container = options?.container || document.body;
        this.containerClasslist = options?.containerClasslist || '';
        this.emptyMessage = options?.emptyMessage || '<p class="mt-2 text-secondary">Nenhum item a exibir</p>';
        this.items = options?.items || []; // Array de objetos com dados dos elementos do grid
        this.gridItems = []; // Armazena os elementos html do grid
        this.defaultItemClasslist = options?.defaultItemClasslist || 'jsGrid-item';
        this.defaultItemColor = options?.defaultItemColor || 'dark';
        this.selectedIndex = 0;
        this.canNavigate = options?.canNavigate != undefined ? options.canNavigate : true; // Implementa nagevacao 
        this.size = ['sm','md','lg','xl'].includes(options.size) ? options.size : 'md'; // Opcao de tamanho dos items (md, lg, xl)
        this.breakpoint = this.size == 'sm' ? 'col-4 col-lg-3 col-xl-1' : this.size == 'lg' ? 'col-lg-6 col-xl-4' : this.size == 'xl' ? 'col-lg-6' : 'col-6 col-lg-4 col-xl-2';
        // Carregando o items
        if(this.items.length == 0){this.container.innerHTML = this.emptyMessage;}
        for(let item in this.items){
            this.addItem(this.items[item])
        }
        if(__sw >= 992 && this.canNavigate){ // Se viewport acima 992 (lg) adiciona funcionalidade de navegacao no grid
            this.selectItem(0); // 
            // Calcula a quantidade de colunas por linha pelo viewport
            if(__sw >= 1200){this.cols = this.size == 'sm' ? 12 : this.size == 'lg' ? 3 : this.size == 'xl' ? 2 : 6;}
            else{this.cols = this.size == 'sm' ? 4 : ['lg', 'xl'].includes(this.size) ? 2 : 3;}
            // Integracao com Keywatch
            this.__appKeyMapIntegration()
            this.rows = Math.ceil(this.gridItems.length / this.cols);
        }
        this.__addStyles();
        this.__build();
        
        
    }
    __addStyles(){
        let style = document.createElement('style');
        style.innerHTML = `
        .jsGrid-item{opacity: 0.8; min-height: 100px;border: 2px solid var(--bs-body-bg);position: relative;padding-top: 5px;padding-bottom: 5px;padding-left: 10px;padding-right: 10px;}
        .jsGrid-item > .jsGrid-lead-image{display: inline-block;width: 100%;line-height: 250%;text-align: center;font-size: 3.2rem;}
        .jsGrid-item > .jsGrid-label{font-size: 0.9rem; color: #FFF;}
        .jsGrid-item > .jsGrid-control{position: absolute;padding-top: 3px;padding-bottom: 3px;padding-left: 7px;padding-right: 7px;border-radius: 25px;text-align: center;cursor: pointer;top: 0;right: 0;z-index: 500;transition: background-color 0.2s;user-select: none;}
        .jsGrid-item-selected{opacity: 1;}
        [data-bs-theme="dark"] .jsGrid-item-selected{border-bottom:4px solid #FFF;}
        @media(min-width: 992px){
            .jsGrid-item{height: 166px;}
            .jsGrid-item-sm{height: auto;}
            .jsGrid-item-fixed{overflow-y: auto;}
        }`;
        document.getElementsByTagName('head')[0].appendChild(style);
    }
    __build(){
        if(!this.container){ // Se container nao fornecido ao instanciar objeto, cria container e faz append no body
            this.container = document.createElement('div');
            document.body.appendChild(this.container);
        }
        this.container.classList = this.containerClasslist;
        this.container.classList.add('row');
    }
    __addControler(item, menu, color){
        if(menu.length == 0){return false}
        let ancor = document.createElement('a');
        ancor.classList = 'jsGrid-control text-body mt-2 me-2';
        ancor.setAttribute('data-bs-toggle', 'dropdown');
        ancor.setAttribute('role', 'button');
        ancor.innerHTML = '<i class="bi bi-three-dots-vertical"></i>'
        let dropdown = document.createElement('ul');
        dropdown.classList = `dropdown-menu bg-${color}-subtle dropdown-menu-end fs-7`;
        for(let i in menu){
            let li = document.createElement('li');
            let text = document.createElement(menu[i]?.href ? 'a' : 'span');
            text.classList = menu[i]?.class ? menu[i].class : 'dropdown-item pointer';
            text.innerHTML = menu[i]?.icon ? `<i class="${menu[i].icon} me-1"></i> ${menu[i].text}` : menu[i].text;
            let attrs = Object.keys(menu[i]);
            let avoid = ['text', 'icon', 'class', 'divisor', 'onclick'];
            for(let j in attrs){ // Percorre os demais atributos
                if(!avoid.includes(attrs[j])){
                    text.setAttribute(attrs[j], menu[i][attrs[j]]);
                }
            }
            if(attrs.includes('onclick')){text.onclick = menu[i].onclick}
            li.appendChild(text);
            if(menu[i]?.divisor){
                let divisor = document.createElement('li');
                divisor.innerHTML = '<hr class="dropdown-divider">';
                dropdown.appendChild(divisor);
            }
            dropdown.appendChild(li);
        }
        item.appendChild(ancor);
        item.appendChild(dropdown);
    }
    addItem(options){
        let el = document.createElement('div');
        el.classList = options?.color ? `${this.defaultItemClasslist} btn-${options.color} ${this.breakpoint}` : `${this.defaultItemClasslist} btn-${this.defaultItemColor} ${this.breakpoint}`;
        if(options?.icon){
            let icon = document.createElement('i');
            if(options?.name){icon.classList = `jsGrid-icon-text ${options.icon}`;}
            else{icon.classList = `jsGrid-lead-image ${options.icon}`;}
            el.appendChild(icon);
        }
        else if(options?.text){
            let text = document.createElement('span');
            text.classList = `jsGrid-lead-image`;
            text.innerHTML = options.text;
            el.appendChild(text);
        }
        else if(options?.img){
            let img = document.createElement('img');
            img.classList = `position-absolute top-0 start-0 w-100`;
            el.classList.add('overflow-hidden');
            img.src = options.img;
            img.style.zIndex = '1';
            el.appendChild(img);
        }
        if(options?.href){
            let link = document.createElement('a');
            link.href = options.href;
            link.classList = 'stretched-link';
            el.appendChild(link);
        }
        else if(options?.onclick){
            el.onclick = options.onclick;
            el.setAttribute('data-jsGrid-clickable', true);
            el.classList.add('pointer');
        }
        if(options?.desc){
            let desc = document.createElement('span');
            desc.classList = 'jsGrid-label user-select-none';
            desc.innerHTML = options.desc;
            el.appendChild(desc);
        }
        if(options?.menu){
            this.__addControler(el, options.menu, options?.color || '');
        }
        // Se informado keybind, adiciona ao mapa (Keywatch class)
        if(options?.keybind){
            appKeyMap.bind(...options.keybind);
            if(!options.onclick){ // Se nao especificado outro onclick para elemento, aplica onclick para a funcao atribuida em run
                console.log(options);
                el.onclick = () => {options[1]};
            }
        }
        this.gridItems.push(el);
        this.container.appendChild(el);
    }
    selectItem(index){
        if(!this.canNavigate || index < 0 || index >= this.gridItems.length){return false}
        this.__clearSelectItem();
        this.gridItems[index].classList.add('jsGrid-item-selected');
        this.selectedIndex = index;
    }
    enterItem(){ // Tenta acessa o item selecionado
        if(!this.canNavigate){return false}
        // Veririca se item eh clicavel (se sim aciona evento click), se nao tenta localizar link (a) e aciona click do link
        try{
            if(this.gridItems[this.selectedIndex].dataset['jsgridClickable'] == 'true'){this.gridItems[this.selectedIndex].click()}
            else{this.gridItems[this.selectedIndex].querySelector('a').click()}
        }
        catch(e){}
    }
    nextItem(){
        if(!this.canNavigate || this.gridItems.length <= this.selectedIndex + 1){return false}
        this.selectedIndex++;
        this.selectItem(this.selectedIndex);
    }
    previousItem(){
        if(!this.canNavigate || this.selectedIndex == 0){return false}
        this.selectedIndex--;
        this.selectItem(this.selectedIndex);
    }
    itemAbove(){
        if(!this.canNavigate || !['lg','xl','xxl'].includes(__ss)){return false}
        let nextIndex = this.selectedIndex - this.cols;
        if(nextIndex >= 0){this.selectItem(nextIndex)}
    }
    itemBelow(){
        if(!this.canNavigate || !['lg','xl','xxl'].includes(__ss)){return false}
        let nextIndex = this.selectedIndex + this.cols;
        if(nextIndex < this.gridItems.length){this.selectItem(nextIndex)}
    }
    __clearSelectItem(){
        try{this.container.querySelector('.jsGrid-item-selected').classList.remove('jsGrid-item-selected')}
        catch(e){}
    }
    __appKeyMapIntegration(){
        appKeyMap.bind('ctrl+arrowleft', ()=>{this.previousItem();return false;}, {'data-i18n':'index.shortcuts.grid.previousItem', icon: 'bi bi-grid-3x3-gap-fill text-purple-light', desc:'Seleciona item anterior do grid'})
        appKeyMap.bind('ctrl+arrowright', ()=>{this.nextItem();return false;}, {'data-i18n':'index.shortcuts.grid.nextItem', icon: 'bi bi-grid-3x3-gap-fill text-purple-light', desc: 'Seleciona próximo item do grid'})
        appKeyMap.bind('ctrl+arrowdown', ()=>{this.itemBelow();return false;}, {'data-i18n':'index.shortcuts.grid.bottomItem', icon: 'bi bi-grid-3x3-gap-fill text-purple-light', desc: 'Seleciona item abaixo do grid'})
        appKeyMap.bind('ctrl+arrowup', ()=>{this.itemAbove();return false;}, {'data-i18n':'index.shortcuts.grid.upItem', icon: 'bi bi-grid-3x3-gap-fill text-purple-light', desc: 'Seleciona item acima do grid'})
        appKeyMap.bind('ctrl+enter', ()=>{this.enterItem();return false;}, {'data-i18n':'index.shortcuts.grid.accessItem', icon: 'bi bi-grid-3x3-gap-fill text-purple-light', desc: 'Tenta acessar o item selecionado do grid'})
    }
}

