class MarchUI{
    constructor(options){
        this.sw = screen.width;
        this.carFocus = -1;
        this.tripFocus = -1;
        this.initialView = options?.initialView || 0; // Inicio da regua (em minutos)
        // Verifica se foi repassado initialView como hora em string ex '04:30', se sim converte em minutos
        if(typeof this.initialView == 'string'){this.initialView = hour2Min(this.initialView)}

        this.project = options?.project || new March();
        this.container = options?.container || document.body;
        this.container.style.position = 'relative'; // Ajusta posicionamento do container para relativo para correta alocacao dos elementos

        this.fleetTagWidth = options?.fleetTagWidth || '25px';
        this.fleetHeight = options?.fleetHeight || '35px'; // height do carro
        
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
        
        this.footerClasslist = options?.footerClasslist || 'bg-body-secondary container-fluid position-absolute bottom-0 border-top';
        
        this.__build();
        this.__buildRuler();
        // this.__buildFooter();

    }
    __build(){
        this.canvas = document.createElement('div');
        this.canvas.style.overflow = 'hidden';
        // Regua superior
        this.rulerTop = document.createElement('div');
        this.rulerTop.style.position = 'relative';
        this.rulerTop.style.height = this.rulerHeight;
        this.rulerTop.style.marginTop = this.rulerMarginTop;
        this.rulerTop.style.paddingLeft = this.fleetTagWidth;
        
        // ----
        this.container.firstChild.before(this.rulerTop);
        this.rulerTop.after(this.canvas);
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
                num.innerHTML = min2Hour(start);
                this.rulerTop.appendChild(d);
                this.rulerTop.appendChild(num);
            }
            reset++;
            start++;
        }
    }
    __buildFooter(){
        // Footer
        this.footer = document.createElement('div');this.footer.classList = this.footerClasslist;
        let row = document.createElement('div');row.classList = 'row text-body-tertiary';
        let col1 = document.createElement('div');col1.classList = 'col-auto text-center';
        this.viagemInicio = document.createElement('h4');this.viagemInicio.classList = 'my-1';this.viagemInicio.innerHTML = '--:--';
        this.viagemFim = document.createElement('h4');this.viagemFim.classList = 'my-1';this.viagemFim.innerHTML = '--:--';
        let col2 = document.createElement('div');col2.classList = 'col-auto text-center';
        this.viagemFreq = document.createElement('h3');this.viagemFreq.classList = 'm-0 pt-1';this.viagemFreq.innerHTML = '--';
        let label = document.createElement('small');label.innerHTML = 'FREQ';
        col1.appendChild(this.viagemInicio);
        col1.appendChild(this.viagemFim);
        col2.appendChild(this.viagemFreq);
        col2.appendChild(label);
        row.appendChild(col1);
        row.appendChild(col2);
        this.footer.appendChild(row);
    }
    addCar(){
        let car = this.project.addCar();
        let carLabel = document.createElement('span');
        carLabel.style.width = this.fleetTagWidth;
        carLabel.style.height = this.fleetHeight;
        let seq = this.project.cars.length;
        carLabel.innerHTML = String(seq).padStart(2,'0');
        carLabel.style.position = 'absolute';
        carLabel.style.top = `calc(${this.fleetHeight} * ${seq})`;
        carLabel.style.left = 0;
        carLabel.style.textAlign = 'right';
        console.log(carLabel);
        this.container.appendChild(carLabel);
        // PAREI AQUI
        // AQUI DEVE FAZER for viagem in carro ... foo



    }
    refreshCanvas(){}
}