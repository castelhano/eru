/*
* Descreva o contexto do codigo em poucas linhas
*
* @version  1.0
* @since    05/03/2022
* @author   Rafael Gustavo Alves {@email castelhano.rafael@gmail.com }
* @desc     Decricao abreviada do codigo
* @param    {Int} Parametro do codigo
* @returns  {Array} Retorno da funcao
* @throws   Excessoes lancadas pela funcao
* @example  Exemplo de utilizacao da funcao
* @see      {@link https://foo.com}
*/

const customCanvasNavMenu = document.getElementById('customCanvasNavMenu');

class canvasNavLink{
    constructor(options){
        this.el = document.createElement('li'); this.el.classList = 'nav-item py-1';
        this.link = document.createElement('a');
        this.link.classList = `${options?.class || 'nav-link'}`;
        if(options.icon){
            let icon = document.createElement('i'); icon.classList = options.icon + ' me-2';
            this.link.appendChild(icon)
            this.link.insertAdjacentHTML("beforeend", options?.name || 'name_not_defined')
        }
        else{this.link.innerHTML = options?.name || 'name_not_defined';}
        
        let attrs = {...options};
        if(attrs.hasOwnProperty('keybind')){delete attrs['keybind']}
        if(attrs.hasOwnProperty('name')){delete attrs['name']}
        for(let i in attrs){
            this.link.setAttribute(i, attrs[i])
        }
        if(options?.keybind){this.addKeyBind(options.keybind)}
        this.el.appendChild(this.link);
        customCanvasNavMenu.appendChild(this.el);
    }
    click(){this.link.click()}
    focus(){this.link.focus()}
    hide(){this.el.classList.add('d-none')}
    destroy(){this.el.remove()}
    addKeyBind(options){appKeyMap.bind(options)}

}

class canvasNavDropdown{
    constructor(options){
        this.itens = options?.itens || [];
        if(!options?.itens || options.itens.length == 0){return false} // Se nao informado intens p o dropdown, nao insere menu
        this.el = document.createElement('li'); this.el.classList = 'nav-item dropdown';
        this.link = document.createElement('a');
        this.link.classList = `${options?.class || 'nav-link dropdown-toggle py-1'}`;
        this.link.href = '#';this.link.setAttribute('role', 'button');this.link.setAttribute('data-bs-toggle', 'dropdown');
        if(options.icon){
            let icon = document.createElement('i'); icon.classList = options.icon + ' me-2';
            this.link.appendChild(icon)
            this.link.insertAdjacentHTML("beforeend", options?.name || 'name_not_defined')
        }
        else{this.link.innerHTML = options?.name || 'name_not_defined';}

        this.ul = document.createElement('ul');this.ul.classList = 'dropdown-menu mb-2';
        for(let i in this.itens){
            this.ul.appendChild(this.__buildMenuItem(this.itens[i]));
            if(this.itens[i]?.keybind){this.addKeyBind(this.itens[i].keybind)}
        }
        
        this.el.appendChild(this.link);
        this.el.appendChild(this.ul);
        customCanvasNavMenu.appendChild(this.el);
        if(options?.keybind){this.addKeyBind(options.keybind)}
    }
    __buildMenuItem(options){
        let item = document.createElement('li');item.classList = options?.liClass || '';
        let link = document.createElement(options?.tagName || 'a');link.classList = options?.linkClass || 'dropdown-item';
        if(options.icon){
            let icon = document.createElement('i'); icon.classList = options.icon + ' me-2';
            link.appendChild(icon)
            link.insertAdjacentHTML("beforeend", options?.name || 'name_not_defined')
        }
        else{link.innerHTML = options?.name || 'name_not_defined';}
        let attrs = {...options}; // Cria copia de opcoes antes de remover attrs
        if(attrs.hasOwnProperty('keybind')){delete attrs['keybind']}
        if(attrs.hasOwnProperty('name')){delete attrs['name']}
        for(let i in attrs){ // Adiciona os atributos do elemento
            link.setAttribute(i, options[i]);
        }
        item.appendChild(link);
        return item;        
    }
    isOpen(){return this.ul.classList.contains('show')}
    click(){this.link.click()}
    focus(){this.link.focus()}
    hide(){this.el.classList.add('d-none')}
    destroy(){this.el.remove()}
    addKeyBind(options){appKeyMap.bind(options)}
}