
class jsGrid{
    constructor(options){
        this.container = options?.container || null;
        this.containerClasslist = options?.containerClasslist || '';
        this.emptyMessage = options?.emptyMessage || '<p>Nenhum item a exibir</p>';
        this.items = options?.items || [];
        this.defaultItemClasslist = options?.defaultItemClasslist || 'jsGrid-item col-6 col-lg-4 col-xl-2 btn-secondary';
        this.__addStyles();
        this.__build();
        // Carregando o items
        if(this.items.length == 0){this.container.innerHTML = this.emptyMessage;}
        for(let item in this.items){this.addItem(this.items[item])}
    }
    __addStyles(){}
    __build(){
        if(!this.container){ // Se container nao fornecido ao instanciar objeto, cria container e faz append no body
            this.container = document.createElement('div');
            document.body.appendChild(this.container);
        }
        this.container.classList = this.containerClasslist;
        this.container.style.display = 'flex';
    }
    __addControler(item){}
    addItem(options){
        let el = document.createElement('div');
        el.classList = options?.class || this.defaultItemClasslist;
        if(options?.icon){
            let icon = document.createElement('i');
            if(options?.text){icon.classList = `jsGrid-icon-text ${option.icon}`;}
            else{icon.classList = `jsGrid-icon-only ${option.icon}`;}
            el.appendChild(icon);
        }
        if(options?.href){
            let link = document.createElement('a');
            link.classList = 'jsGrid-link stretched-link';
            link.href = options?.href || '#';
            link.innerHTML = options?.linkText || '';
            el.appendChild(link);
        }
        this.container.appendChild(el);
    }
    keyBind(options){}
}

