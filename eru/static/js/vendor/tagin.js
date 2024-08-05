
/*
* tagin.js ** FORK ** (modificacoes locais)
*
* @version  2.0.2
* @author   Erwin Heldy G
* @licence  MIT (https://github.com/erwinheldy/tagin/blob/master/LICENSE)
* @fork Adicionado atributo tagColor para cor da tag
* @fork Adicionado opcao para autofocus
* @method el.addTag('yellow')           # Adiciona a tag 'yellow'
* @method el.addTag(['cyan', 'black'])  # Adiciona tags 'cyan' e 'black'
* @method el.getTag()                   # Retorna  tags as string red,green,blue,yellow,cyan,black
* @method el.getTags()                  # Retorna array com tags ['red', 'green', 'blue', 'yellow', 'cyan', 'black']
* @example  
*     <link rel="stylesheet" href="css/vendor/tagin.css" type="text/css">
*      
*     <div class="row g-1">
*       <div class="form-floating mb-1 col-lg-12">
*         <input type="text" class="form-control tagin" id="id_tags">
*         <label for="id_tags">Tags</label>
*       </div>
*     </div>
*
*     new Tagin(document.getElementById('id_tags'),{}) ou
*     new Tagin(document.getElementById('id_tags'), {
*       separator: ';',                             # Default = ','
*       tagColor: 'primary',                        # Default = '' Valores possiveis: [primary, success, warning, danger, purple, orange]
*       enter: true,                                # Default = false
*       placeholder: 'Enter ou ,',                  # Default = ''
*       transform: 'input => input.toUpperCase()',  # Deafult = 'input => input'
*       duplicate: true,                            # Default = false
*      })
*
* Caso prefira configurar via data-options <input type="text" name="tags" class="form-control tagin" data-tagin-separator=";">
* Options: [data-tagin-placeholder, data-tagin-separator, data-tagin-duplicate, data-tagin-transform, data-tagin-enter]
* @see      {@link https://tagin.netlify.app/}
* @see      {@link https://github.com/erwinheldy/tagin}
*/
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.Tagin = factory());
})(this, (function () { 'use strict';

    class Tagin {
        classElement = 'tagin';
        classWrapper = 'tagin-wrapper';
        classTag = 'tagin-tag';
        tagColor = '';
        classRemove = 'tagin-tag-remove';
        classInput = 'tagin-input';
        classInputHidden = 'tagin-input-hidden';
        target;
        wrapper;
        input;
        separator;
        placeholder;
        duplicate;
        transform;
        enter;
        constructor(inputElement, options) {
            this.target = inputElement;
            this.separator = options?.separator || inputElement.dataset.taginSeparator || ',';
            this.placeholder = options?.placeholder || inputElement.dataset.taginPlaceholder || '';
            this.duplicate = options?.duplicate || inputElement.dataset.taginDuplicate !== undefined;
            this.transform = options?.transform || inputElement.dataset.taginTransform || 'input => input';
            this.enter = options?.enter || inputElement.dataset.taginEnter !== undefined;
            this.disabled = options?.disabled || options.disabled == true;
            this.autofocus = options?.autofocus || inputElement.autofocus;
            this.tagColor = options?.tagColor || inputElement.dataset.tagColor || '';
            this.createWrapper();
            this.autowidth();
            if(!this.disabled){
                this.addEventListener();
                if(this.autofocus){this.input.focus()}
            }
        }
        createWrapper() {
            const tags = this.getValue() === '' ? '' : this.getValues().map(val => this.createTag(val)).join('');
            const input = document.createElement('input');
            input.type = 'text';
            input.className = this.classInput;
            input.placeholder = this.placeholder;
            if(this.enter){input.setAttribute('data-keywatch','none')} // Integracao com keywatch js
            const wrapper = document.createElement('div');
            wrapper.className = `${this.classWrapper} ${this.target.className}`;
            wrapper.classList.remove(this.classElement);
            wrapper.insertAdjacentHTML('afterbegin', tags);
            wrapper.insertAdjacentElement('beforeend', input);
            this.target.insertAdjacentElement('afterend', wrapper); // insert wrapper after input
            this.wrapper = wrapper;
            this.input = input;
        }
        createTag(value) {
            const onclick = `this.closest('div').dispatchEvent(new CustomEvent('tagin:remove', { detail: this }))`;
            return `<span class="${this.classTag} ${this.tagColor}">${value}<span onclick="${onclick}" class="${this.classRemove}"></span></span>`;
        }
        getValue() {
            return this.target.value.trim();
        }
        getValues() {
            return this.getValue().split(this.separator);
        }
        getTags() {
            return Array.from(this.wrapper.getElementsByClassName(this.classTag)).map(tag => tag.textContent);
        }
        getTag() {
            return this.getTags().join(this.separator);
        }
        updateValue() {
            this.target.value = this.getTag();
            this.target.dispatchEvent(new Event('change'));
        }
        autowidth() {
            const fakeEl = document.createElement('div');
            fakeEl.classList.add(this.classInput, this.classInputHidden);
            const string = this.input.value || this.input.placeholder || '';
            fakeEl.innerHTML = string.replace(/ /g, '&nbsp;');
            document.body.appendChild(fakeEl);
            this.input.style.setProperty('width', Math.ceil(parseInt(window.getComputedStyle(fakeEl).width.replace('px', ''))) + 1 + 'px');
            fakeEl.remove();
        }
        addEventListener() {
            const wrapper = this.wrapper;
            const input = this.input;
            // Focus to input
            wrapper.addEventListener('click', () => input.focus());
            // Toggle focus class
            input.addEventListener('focus', () => wrapper.classList.add('focus'));
            input.addEventListener('blur', () => wrapper.classList.remove('focus'));
            // Add tag when input
            input.addEventListener('input', () => {
                this.appendTag();
                this.autowidth();
            });
            // Add tag when blur
            input.addEventListener('blur', () => {
                this.appendTag(true);
                this.autowidth();
            });
            input.addEventListener('keydown', (e) => {
                // Remove with backspace
                if (input.value === '' && e.key === 'Backspace' && wrapper.getElementsByClassName(this.classTag).length) {
                    wrapper.querySelector(`.${this.classTag}:last-of-type`).remove();
                    this.updateValue();
                }
                // Add with Enter
                if (input.value !== '' && e.key === 'Enter' && this.enter) {
                    this.appendTag(true);
                    this.autowidth();
                    e.preventDefault();
                }
            });
            wrapper.addEventListener('tagin:remove', (e) => {
                if (e['detail'] instanceof HTMLSpanElement) {
                    e['detail'].parentElement.remove();
                    this.updateValue();
                }
            });
            this.target.addEventListener('change', () => this.updateTag());
        }
        appendTag(force = false) {
            const input = this.input;
            const value = eval(this.transform)(input.value.trim());
            if (value === '')
                input.value = '';
            if (input.value.includes(this.separator) || (force && input.value !== '')) {
                value
                    .split(this.separator)
                    .filter((i) => i !== '')
                    .forEach((val) => {
                    if (this.getTags().includes(val) && this.duplicate === false) {
                        this.alertExist(val);
                    }
                    else {
                        input.insertAdjacentHTML('beforebegin', this.createTag(val));
                        this.updateValue();
                    }
                });
                input.value = '';
                input.removeAttribute('style');
            }
        }
        alertExist(value) {
            for (const el of this.wrapper.getElementsByClassName(this.classTag)) {
                if (el.textContent === value && el instanceof HTMLSpanElement) {
                    el.style.transform = 'scale(1.09)';
                    setTimeout(() => { el.removeAttribute('style'); }, 150);
                }
            }
        }
        updateTag() {
            if (this.getValue() !== this.getTag()) {
                [...this.wrapper.getElementsByClassName(this.classTag)].map(tag => tag.remove());
                this.getValue().trim() !== '' && this.input.insertAdjacentHTML('beforebegin', this.getValues().map(val => this.createTag(val)).join(''));
            }
        }
        addTag(tag) {
            this.input.value = (Array.isArray(tag) ? tag.join(this.separator) : tag) + this.separator;
            this.input.dispatchEvent(new Event('input'));
        }
    }
    return Tagin;
}));
