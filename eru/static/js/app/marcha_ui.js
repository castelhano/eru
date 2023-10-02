class MarchUI{
    constructor(options){
        this.sw = screen.width;
        this.sh = window.innerHeight;
        this.fleetIndex = -1
        this.tripIndex = -1
        this.fleetFocus = null;
        this.tripFocus = null;
        this.fleetLabels = []; // Lista com apontadores das labels dos carros
        this.grid = {}; // Dicionario Todos os elementos do grid (carros e viagens) serao armazenados aqui
        this.initialView = options?.initialView || 0; // Inicio da regua (em minutos)
        this.endMinutsMargin = options?.endMinutsMargin || 15; // Margem (em minutos) final antes de rolar o canvas
        this.initialFleetView = 0; // Indice do primeiro carro sendo exibido no grid
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
        this.tripToStyle = options?.tripToStyle || 'height: 8px;border-radius: 10px;';
        this.tripFromColor = options?.tripFromColor || 'var(--bs-info-border-subtle)';
        this.tripToColor = options?.tripToColor || 'var(--bs-secondary-bg)';
        this.tripHeight = options?.tripHeight || '8px';
        
        this.footerClasslist = options?.footerClasslist || 'bg-body-secondary container-fluid position-fixed bottom-0 start-0 border-top';
        this.footerHeight = options?.footerHeight || '70px';
        
        this.maxMinutsVisible = parseInt((this.sw - parseInt(this.fleetTagWidth)) / parseInt(this.rulerUnit));
        this.maxCarsVisible = Math.floor((this.sh - parseInt(this.canvasMarginTop) - parseInt(this.rulerHeight) - parseInt(this.footerHeight)) / parseInt(this.fleetHeight));
        
        this.__build();
        this.__buildRuler();
        this.__buildFooter();
        this.__addListeners();

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
        this.cursor.style.zIndex = '98';
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
                num.setAttribute('data-role', 'ruler_num');
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
        this.footer = document.createElement('div');this.footer.classList = this.footerClasslist;this.footer.style.height = this.footerHeight;this.footer.style.zIndex = '100';
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
        let car = this.project.addCar({param: this.project.route.param});
        let carLabel = document.createElement('span');
        carLabel.setAttribute('data-role', 'fleet_tag');
        carLabel.style.width = this.fleetTagWidth;
        carLabel.style.height = this.fleetHeight;
        carLabel.style.paddingLeft = '3px';
        carLabel.style.position = 'absolute';
        carLabel.style.backgroundColor = 'var(--bs-body-bg)';
        carLabel.style.zIndex = '95';
        let seq = this.project.cars.length;
        carLabel.innerHTML = String(seq).padStart(2,'0');
        carLabel.style.top = `calc(${this.fleetHeight} * ${seq})`;
        carLabel.style.left = 0;
        this.fleetLabels.push(carLabel);
        this.container.appendChild(carLabel);
        this.grid[seq - 1] = []; // Adiciona entrada para o carro no dicionario de grid
        let v = this.addTrip(car.trips[0], seq - 1)
        if(this.tripFocus == null){ // Se nenhua viagem em foco, aponta para primeira viagem do primeiro carro
            this.fleetIndex = 0;
            this.tripIndex = 0;
            this.fleetFocus = car;
            this.tripFocus = car.trips[0];
            this.__cursorMove()
        }
    }
    addTrip(trip=this.project.cars[this.fleetIndex].addTrip(this.project.route.param), seq=this.fleetIndex){
        let v = document.createElement('div');
        v.style = trip.way == IDA ? this.tripFromStyle : this.tripToStyle;
        v.style.backgroundColor = trip.way == IDA ? this.tripFromColor : this.tripToColor;
        v.style.position = 'absolute';
        v.style.width = `calc(${this.rulerUnit} * ${trip.getCycle()})`;
        v.style.top = `calc(${this.fleetHeight} * ${seq + 1} - 17px)`;
        v.style.left = `calc(${this.fleetTagWidth} + ${trip.start} * ${this.rulerUnit})`;
        this.grid[seq].push(v);
        this.canvas.appendChild(v);
        return v;
    }
    plus(cascade=true){
        if(this.tripFocus != null){
            this.project.cars[this.fleetIndex].plus(this.tripIndex, cascade); // Icrementa 1 minuto no final na viagem foco e no inicio e fim das posteriores
            this.grid[this.fleetIndex][this.tripIndex].style.width = `calc(${this.project.cars[this.fleetIndex].trips[this.tripIndex].getCycle()} * ${this.rulerUnit})`;
            if(cascade){
                for(let i = 1; i < this.project.cars[this.fleetIndex].trips.length; i++){
                    this.grid[this.fleetIndex][i].style.left = `calc(${this.fleetTagWidth} + ${this.project.cars[this.fleetIndex].trips[i].start} * ${this.rulerUnit})`;
                    this.grid[this.fleetIndex][i].style.width = `calc(${this.project.cars[this.fleetIndex].trips[i].getCycle()} * ${this.rulerUnit})`;
                }
            }
        }
    }
    sub(cascade=true){
        if(this.tripFocus != null){
            this.project.cars[this.fleetIndex].sub(this.tripIndex, cascade); // Subtrai 1 minuto no final na viagem foco e no inicio e fim das posteriores
            this.grid[this.fleetIndex][this.tripIndex].style.width = `calc(${this.project.cars[this.fleetIndex].trips[this.tripIndex].getCycle()} * ${this.rulerUnit})`;
            if(cascade){
                for(let i = 1; i < this.project.cars[this.fleetIndex].trips.length; i++){
                    this.grid[this.fleetIndex][i].style.left = `calc(${this.fleetTagWidth} + ${this.project.cars[this.fleetIndex].trips[i].start} * ${this.rulerUnit})`;
                    this.grid[this.fleetIndex][i].style.width = `calc(${this.project.cars[this.fleetIndex].trips[i].getCycle()} * ${this.rulerUnit})`;
                }
            }
        }
    }
    moveStart(){
        if(this.tripFocus != null){
            this.project.cars[this.fleetIndex].moveStart(this.tripIndex); // Aumenta 1 minuto no final na viagem foco
            this.grid[this.fleetIndex][this.tripIndex].style.left = `calc(${this.fleetTagWidth} + ${this.project.cars[this.fleetIndex].trips[this.tripIndex].start} * ${this.rulerUnit})`;
            this.grid[this.fleetIndex][this.tripIndex].style.width = `calc(${this.project.cars[this.fleetIndex].trips[this.tripIndex].getCycle()} * ${this.rulerUnit})`;
        }

    }
    backStart(){
        if(this.tripFocus != null){
            this.project.cars[this.fleetIndex].backStart(this.tripIndex);
            this.grid[this.fleetIndex][this.tripIndex].style.left = `calc(${this.fleetTagWidth} + ${this.project.cars[this.fleetIndex].trips[this.tripIndex].start} * ${this.rulerUnit})`;
            this.grid[this.fleetIndex][this.tripIndex].style.width = `calc(${this.project.cars[this.fleetIndex].trips[this.tripIndex].getCycle()} * ${this.rulerUnit})`;
            this.__cursorMove();
        }
    }
    advance(){
        if(this.tripFocus != null){
            this.project.cars[this.fleetIndex].advance(this.tripIndex);
            for(let i = this.tripIndex; i < this.project.cars[this.fleetIndex].trips.length; i++){
                this.grid[this.fleetIndex][i].style.left = `calc(${this.fleetTagWidth} + ${this.project.cars[this.fleetIndex].trips[i].start} * ${this.rulerUnit})`;
                this.grid[this.fleetIndex][i].style.width = `calc(${this.project.cars[this.fleetIndex].trips[i].getCycle()} * ${this.rulerUnit})`;
            }
            this.__cursorMove();
        }

    }
    back(){
        if(this.tripFocus != null){
            this.project.cars[this.fleetIndex].back(this.tripIndex);
            for(let i = this.tripIndex; i < this.project.cars[this.fleetIndex].trips.length; i++){
                this.grid[this.fleetIndex][i].style.left = `calc(${this.fleetTagWidth} + ${this.project.cars[this.fleetIndex].trips[i].start} * ${this.rulerUnit})`;
                this.grid[this.fleetIndex][i].style.width = `calc(${this.project.cars[this.fleetIndex].trips[i].getCycle()} * ${this.rulerUnit})`;
            }
            this.__cursorMove();
        }

    }
    __cursorMove(){
        this.cursor.style.top = `calc(${this.fleetIndex + 1} * ${this.fleetHeight} - ${this.fleetTagWidth} - 17px)`;
        this.cursor.style.left = `calc((${this.tripFocus.start}) * ${this.rulerUnit} + ${this.fleetTagWidth} - 13px)`;
        if(this.tripFocus.start < this.initialView){ // Verifica se cursor esta atingindo o limite horizontal a esquerda, se sim ajusta canvas
            let x = Math.ceil((this.initialView - this.tripFocus.start) / this.rulerMediumUnit) * this.rulerMediumUnit;
            this.moveCanvas(x * -1);
        }
        else if(this.tripFocus.start > this.__getCanvasEndMargin()){// Verifica se cursor esta atingindo o limite horizontal a direita, se sim ajusta canvas
            let x = Math.ceil((this.tripFocus.start - this.__getCanvasEndMargin()) / this.rulerMediumUnit) * this.rulerMediumUnit;
            this.moveCanvas(x);
        }
        if(this.fleetIndex < this.initialFleetView){ // Verifica se cursor esta atingindo o limite vertical superior, se sim ajusta canvas
            let y = (this.initialFleetView - this.fleetIndex) * parseInt(this.fleetHeight);
            this.initialFleetView = this.fleetIndex;
            this.moveCanvas(0, y);            
        }
        else if(this.fleetIndex > (this.initialFleetView + this.maxCarsVisible - 1)){ // Verifica se cursor esta atingindo o limite vertical inferior, se sim ajusta canvas
            let y = this.fleetIndex - (this.initialFleetView + this.maxCarsVisible - 1);
            this.initialFleetView += y;
            this.moveCanvas(0, y * -1);            
        }
    }
    moveCanvas(x=0, y=0){ // Ajusta regua e move canvas em x e/ou y unidades
        // X valor em unidades (int) a ser movido o canvas
        // Y valor em unidades (int) representando os carros (2 = this.fleetIndex += 2)
        if(x == 0 && y == 0){return false}
        if(x != 0){
            this.initialView += x; // Redefine valor para initialView
            // Refaz os numeros de referencia da regua
            let v = this.initialView;
            document.querySelectorAll('[data-role=ruler_num]').forEach((el)=>{
                el.innerHTML = min2Hour(v);
                v += this.rulerMediumUnit;
            })
            // Move o canvas
            this.canvas.style.left = `calc(${this.rulerUnit} * ${this.initialView} * -1)`;
        }
        if(y != 0){
            this.canvas.style.top = `calc(${this.fleetHeight} * ${this.initialFleetView} * ${y > 0 ? 1 : -1})`;
            document.querySelectorAll('[data-role=fleet_tag]').forEach((el)=>{ // Move label dos carros
                el.style.top = `calc(${el.style.top} + (${this.fleetHeight} * ${y > 0 ? 1 : -1}))`;
            })
        }
    }
    __getCanvasEndMargin(){ // Retorna (em minutos) a margem maxima a direita (usado para verificar limite antes do canvas movimentar)
        return this.initialView + this.maxMinutsVisible - this.endMinutsMargin;
    }
    __addListeners(){
        appKeyMap.bind({key: 'n', alt: true, name: 'Add Carro', desc: 'Insere novo carro no projeto', run: ()=>{this.addCar()}})
        appKeyMap.bind({key: '+', alt: true, name: 'Add Viagem', desc: 'Insere novo viagem para carro em foco', run: ()=>{this.addTrip()}})
        appKeyMap.bind({key: 'arrowright', name: 'Próxima viagem', desc: 'Move foco para próxima viagem', run: ()=>{
            if(this.project.cars[this.fleetIndex].trips.length > this.tripIndex + 1){
                this.tripIndex++;
                this.tripFocus = this.project.cars[this.fleetIndex].trips[this.tripIndex];
                this.__cursorMove();
            }
        }})
        appKeyMap.bind({key: 'arrowleft', name: 'Viagem anterior', desc: 'Move foco para viagem anterior', run: ()=>{
            if(this.tripIndex > 0){
                this.tripIndex--;
                this.tripFocus = this.project.cars[this.fleetIndex].trips[this.tripIndex];
                this.__cursorMove();
            }
        }})
        appKeyMap.bind({key: 'arrowdown', name: 'Próximo carro', desc: 'Move foco para próximo carro', run: ()=>{
            if(this.project.cars.length > this.fleetIndex + 1){
                this.fleetIndex++;
                this.fleetFocus = this.project.cars[this.fleetIndex];
                // Identifica viagem mais proxima do proximo carro para mover cursor
                let bestMatch = this.project.cars[this.fleetIndex].trips[0];
                let start = this.tripFocus.start;
                let escape = false;
                this.tripIndex = 0;
                while(!escape){
                    // Percorre viagens do proximo carro ate final ou ate achar melhor correspondente
                    // Se viagem analisada inicia apos (ou no mesmo horario) de bestMatch termina execucao
                    if( this.project.cars[this.fleetIndex].trips.length == this.tripIndex + 1 ||
                        this.project.cars[this.fleetIndex].trips[this.tripIndex + 1].start >= start){escape = true}
                    else{
                        this.tripIndex++;
                        bestMatch = this.project.cars[this.fleetIndex].trips[this.tripIndex];
                    }
                }
                this.tripFocus = bestMatch;
                this.__cursorMove();
            }
        }})
        appKeyMap.bind({key: 'arrowup', name: 'Carro anterior', desc: 'Move foco para carro anterior', run: ()=>{
            if(this.fleetIndex > 0){
                this.fleetIndex--;
                this.fleetFocus = this.project.cars[this.fleetIndex];
                // Identifica viagem mais proxima do proximo carro para mover cursor
                let bestMatch = this.project.cars[this.fleetIndex].trips[0];
                let start = this.tripFocus.start;
                let escape = false;
                this.tripIndex = 0;
                while(!escape){
                    // Percorre viagens do proximo carro ate final ou ate achar melhor correspondente
                    // Se viagem analisada inicia apos (ou no mesmo horario) de bestMatch termina execucao
                    if( this.project.cars[this.fleetIndex].trips.length == this.tripIndex + 1 ||
                        this.project.cars[this.fleetIndex].trips[this.tripIndex + 1].start > start){escape = true}
                    else{
                        this.tripIndex++;
                        bestMatch = this.project.cars[this.fleetIndex].trips[this.tripIndex];
                    }
                }
                this.tripFocus = bestMatch;
                this.__cursorMove();
            }
        }})
        appKeyMap.bind({key: '+', name: 'Viagem >>', desc: 'Aumenta 1 min ao final da viagem atual e nas demais', run: ()=>{this.plus()}})
        appKeyMap.bind({key: '-', name: 'Viagem <<', desc: 'Subtrai 1 min ao final da viagem atual e nas demais', run: ()=>{this.sub()}})
        appKeyMap.bind({key: '+', shift: true, name: 'Viagem >', desc: 'Aumenta 1 minuto na viagem atual', run: ()=>{this.plus(false)}})
        appKeyMap.bind({key: '-', shift: true, name: 'Viagem <', desc: 'Subtrai 1 minuto na viagem atual', run: ()=>{this.sub(false)}})
        appKeyMap.bind({key: ' ', name: 'Move todas', desc: 'Move todas em 1 min', run: ()=>{this.advance()}})
        appKeyMap.bind({key: ' ', shift: true, name: 'Inicio plus', desc: 'Aumenta 1 min no inicio da viagem atual', run: ()=>{
            this.moveStart();
            this.__cursorMove();
        }})
        appKeyMap.bind({key: 'backspace', name: 'Adiantar todos', desc: 'Diminui 1 min no inicio da viagem atual e nas seguintes', run: ()=>{this.back()}})
        appKeyMap.bind({key: 'backspace', shift: true, name: 'Inicio sub', desc: 'Diminui 1 min no inicio da viagem atual', run: ()=>{this.backStart()}})
    }
}