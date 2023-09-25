class MarchaUI{
    constructor(options){
        this.sw = screen.width;
        this.initialView = options?.initialView || 0; // Inicio da regua (em minutos)

        this.container = options?.container || document.body;

        this.fleetTagWidth = options?.fleetTagWidth || '25px';
        this.fleetHeight = options?.fleetHeight || '8px';
        
        this.rulerMarginTop = options?.rulerMarginTop || '40px';
        this.rulerHeight = options?.rulerHeight || '25px';
        this.rulerNumColor = options?.rulerNumColor || '#888';
        this.rulerNumSize = options?.rulerNumSize || '11px';
        this.rulerNumPaddingStart = options?.rulerNumPaddingStart || '0.75ch';
        
        this.rulerUnit = options?.rulerUnit || '8px';
        this.rulerSmallWidth = options?.rulerSmallWidth || '1px';
        this.rulerSmallColor = options?.rulerSmallColor || '#666';
        this.rulerSmallHeight = options?.rulerSmallHeight || '10px';
        this.rulerSmallMarginRight = (parseInt(this.rulerUnit) - parseInt(this.rulerSmallWidth)) + 'px'
        this.rulerMediumWidth = options?.rulerMediumWidth || '1px';
        this.rulerMediumColor = options?.rulerMediumColor || '#BBB';
        this.rulerMediumHeight = options?.rulerMediumHeight || '15px';
        this.rulerMediumUnit = options?.rulerMediumUnit || 30;
        this.rulerMediumMarginRight = (parseInt(this.rulerUnit) - parseInt(this.rulerMediumWidth)) + 'px'
        
        this.maxMinutsVisible = parseInt((this.sw - parseInt(this.fleetTagWidth)) / parseInt(this.rulerUnit));
        
        this.__build();
        this.__buildRuler();

    }
    __build(){
        this.canvas = document.createElement('div');
        this.canvas.style.overflow = 'hidden';
        this.canvas.style.height = `calc(100vh - ${this.rulerMarginTop});`;
        this.rulerTop = document.createElement('div');
        this.rulerTop.style.position = 'relative';
        this.rulerTop.style.height = this.rulerHeight;
        this.rulerTop.style.paddingLeft = this.fleetTagWidth;

        // ----
        this.canvas.appendChild(this.rulerTop);
        this.container.firstChild.before(this.canvas);
    }
    __buildRuler(){
        this.rulerTop.innerHTML = '';
        let start = this.initialView;
        let reset = 0; // contador para testar tamanho da liha a ser utulizada (small, medium) 
        for(let i = 0; i < this.maxMinutsVisible; i++){
            let d = document.createElement('span');
            d.style.display = 'inline-block';
            d.style.verticalAlign = 'text-top';
            if(reset == this.rulerMediumUnit){reset = 0}
            if(reset > 0){
                d.style.width = this.rulerSmallWidth;
                d.style.height = this.rulerSmallHeight;
                d.style.backgroundColor = this.rulerSmallColor;
                d.style.marginRight = this.rulerSmallMarginRight;
                this.rulerTop.appendChild(d);
            }
            else{
                d.style.width = this.rulerMediumWidth;
                d.style.height = this.rulerMediumHeight;
                d.style.backgroundColor = this.rulerMediumColor;
                d.style.marginRight = this.rulerMediumMarginRight
                let num = document.createElement('span');
                num.style.position = 'absolute';
                num.style.marginLeft = '-3px';
                num.style.top = this.rulerSmallHeight;
                num.style.color = this.rulerNumColor;
                num.style.fontSize = this.rulerNumSize;
                num.innerHTML = '00:30';
                this.rulerTop.appendChild(d);
                this.rulerTop.appendChild(num);
            }
            reset++;
        }

    }
}