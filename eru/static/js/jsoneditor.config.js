// Define o mapeamento para o Bootstrap Icons
JSONEditor.defaults.iconlibs.bootstrapicons = class extends JSONEditor.AbstractIconLib {
    getIconClass(key) {
        const mapping = {
            collapse: 'bi-chevron-up',
            expand: 'bi-chevron-down',
            delete: 'bi-trash',
            edit: 'bi-pencil',
            add: 'bi-plus-lg',
            cancel: 'bi-x-lg',
            save: 'bi-check-lg',
            moveup: 'bi-arrow-up',
            movedown: 'bi-arrow-down',
            properties: 'bi-list',
            copy: 'bi-clipboard'
        };
        const icon = mapping[key] || 'bi-app'; 
        return 'bi ' + icon;
    }
};

const jsoneditor_options = {
    theme: 'bootstrap5',
    iconlib: 'bootstrapicons',
    disable_edit_json: true,
    disable_properties: true,
};