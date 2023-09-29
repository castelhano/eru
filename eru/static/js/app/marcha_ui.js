class MarchUI{
    constructor(options){
        this.sw = screen.width;
        this.fleetFocus = -1;
        this.tripFocus = null;
        this.fleetLabels = []; // Lista com apontadores das labels dos carros
        this.grid = {}; // Dicionario Todos os elementos do grid (carros e viagens) serao armazenados aqui
        this.initialView = options?.initialView || 0; // Inicio da regua (em minutos)
        // Verifica se foi repassado initialView como hora em string ex '04:30', se sim converte em minutos
        if(typeof this.initialView == 'string'){this.initialView = hour2Min(this.initialView)}

        this.project = options?.project || new March();
        this.container = options?.container || document.body;
        this.container.style.overflow = 'hidden'; // Remove scroll do container
        this.container.style.position = 'relative'; // Ajusta posicionamento do container para relativo para correta alocacao dos elementos
        this.canvasMarginTop = options?.canvasMarginTop || '40px';


        this.cursorClasslist = options?.cursorClasslist || 'bi bi-caret-down-fill fs-2';

        this.fleetTagWidth = options?.fleetTagWidth || '35px';
        this.fleetHeight = options?.fleetHeight || '45px'; // height do carro
        
        this.rulerHeight = options?.rulerHeight || '25px';
        this.rulerNumColor = options?.rulerNumColor || '#888';
        this.rulerNumSize = options?.rulerNumSize || '11px';
        this.rulerNumPaddingStart = options?.rulerNumPaddingStart || '0.75ch';
        
        this.rulerUnit = options?.rulerUnit || '8px';
        this.rulerClasslist = options?.rulerClasslist || 'bg-body';
        this.rulerSmallWidth = options?.rulerSmallWidth || '1px';
        this.rulerSmallColor = options?.rulerSmallColor || '#666';
        this.rulerSmallHeight = options?.rulerSmallHeight || '10px';
        this.rulerSmallMarginRight = (parseInt(this.rulerUnit) - parseInt(this.rulerSmallWidth)) + 'px'
        this.rulerMediumWidth = options?.rulerMediumWidth || '1px';
        this.rulerMediumColor = options?.rulerMediumColor || '#BBB';
        this.rulerMediumHeight = options?.rulerMediumHeight || '15px';
        this.rulerMediumUnit = options?.rulerMediumUnit || 30;
        this.rulerMediumMarginRight = (parseInt(this.rulerUnit) - parseInt(this.rulerMediumWidth)) + 'px'

        this.tripFromStyle = options?.tripFromStyle || 'height: 8px;border-radius: 10px;';
        // this.tripFromColor = options?.tripFromColor || 'var(--bs-link-color)';
        this.tripToStyle = options?.tripToStyle || 'height: 8px;border-radius: 10px;background-color: red;';
        this.tripFromColor = options?.tripFromColor || 'var(--bs-emphasis-color)';
        this.tripHeight = options?.tripHeight || '8px';
        
        this.maxMinutsVisible = parseInt((this.sw - parseInt(this.fleetTagWidth)) / parseInt(this.rulerUnit));
        
        this.footerClasslist = options?.footerClasslist || 'bg-body-secondary container-fluid position-fixed bottom-0 start-0 border-top';
        this.footerHeight = options?.footerHeight || '70px';
        
        this.__build();
        this.__buildRuler();
        this.__buildFooter();

    }
    __build(){
        this.canvas = document.createElement('div');
        this.canvas.style.position = 'relative';
        this.canvas.style.height = `calc(100vh - ${this.footerHeight} - ${this.canvasMarginTop} - ${this.rulerHeight})`;
        this.canvas.style.left = `calc(${this.rulerUnit} * ${this.initialView} * -1)`;
        // Cursor
        this.cursor = document.createElement('i');
        this.cursor.classList = this.cursorClasslist;
        this.cursor.style.position = 'absolute';
        this.cursor.style.left = '-300px';
        this.cursor.style.top = '-300px';
        // Regua superior
        this.rulerTop = document.createElement('div');
        this.rulerTop.classList = this.rulerClasslist;
        this.rulerTop.style.zIndex = 100;
        this.rulerTop.style.position = 'relative';
        this.rulerTop.style.height = this.rulerHeight;
        this.rulerTop.style.paddingLeft = this.fleetTagWidth;
        
        // ----
        this.container.firstChild.before(this.rulerTop);
        this.canvas.appendChild(this.cursor);
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
        this.footer = document.createElement('div');this.footer.classList = this.footerClasslist;this.footer.style.height = this.footerHeight;
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
        this.canvas.after(this.footer);
    }
    addCar(){
        let car = this.project.addCar();
        let carLabel = document.createElement('span');
        carLabel.style.width = this.fleetTagWidth;
        carLabel.style.height = this.fleetHeight;
        carLabel.style.paddingLeft = '3px';
        let seq = this.project.cars.length;
        carLabel.innerHTML = String(seq).padStart(2,'0');
        carLabel.style.position = 'absolute';
        carLabel.style.top = `calc(${this.fleetHeight} * ${seq})`;
        carLabel.style.left = 0;
        this.fleetLabels.push(carLabel);
        this.container.appendChild(carLabel);
        this.grid[seq - 1] = []; // Adiciona entrada para o carro no dicionario de grid
        let v = this.addTrip(car.trips[0], seq)
        // for(let i = 0; i < car.trips.length;i++){let v = this.addTrip(car.trips[i], seq)}
        if(this.tripFocus == null){
            this.fleetFocus = seq;
            this.tripFocus = car.trips[0];
            this.__cursorMove()
        }
    }
    addTrip(trip, seq){
        let v = document.createElement('div');
        v.style = trip.way == IDA ? this.tripFromStyle : this.tripToStyle;
        v.style.backgroundColor = trip.way == IDA ? this.tripFromColor : this.tripToColor;
        v.style.position = 'absolute';
        v.style.width = `calc(${this.rulerUnit} * ${trip.getCycle()})`;
        v.style.top = `calc(${this.fleetHeight} * ${seq} - 17px)`;
        v.style.left = `calc(${this.fleetTagWidth} + ${trip.start} * ${this.rulerUnit})`;
        this.grid[seq - 1].push(v);
        this.canvas.appendChild(v);
        return v;
    }
    __cursorMove(){
        this.cursor.style.top = `calc(${this.fleetFocus} * ${this.fleetTagWidth} - ${this.fleetTagWidth} - 10px)`;
        this.cursor.style.left = `calc((${this.tripFocus.start}) * ${this.rulerUnit} + ${this.fleetTagWidth} - 13px)`;
        // this.cursor.style.left = `calc((${this.tripFocus.start} - ${this.initialView}) * ${this.rulerUnit} + ${this.fleetTagWidth} - 13px)`;
    }
    refreshCanvas(){}
}