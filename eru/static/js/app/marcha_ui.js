// TODO: Ajustar rulerFreq quando alterado ruleTop
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
        this.freqGrid = {}; // Dicionario com item da regua de frequencia
        this.initialView = options?.initialView || 0; // Inicio da regua (em minutos)
        this.endMinutsMargin = options?.endMinutsMargin || 15; // Margem (em minutos) final antes de rolar o canvas
        this.initialFleetView = 0; // Indice do primeiro carro sendo exibido no grid
        // Verifica se foi repassado initialView como hora em string ex '04:30', se sim converte em minutos
        if(typeof this.initialView == 'string'){this.initialView = hour2Min(this.initialView)}

        this.project = options?.project || new March();
        this.container = options?.container || document.body;
        this.container.style.overflow = 'hidden'; // Remove scroll do container
        this.container.style.position = 'relative'; // Ajusta posicionamento do container para relativo para correta alocacao dos elementos
        
        this.settingsContainer = options?.settingsContainer || null;
        this.canvasMarginTop = options?.canvasMarginTop || '40px';

        this.freqRulerSelectColor = options?.freqRulerSelectColor || 'var(--bs-info-border-subtle)';
        this.freqRulerSelectHeight = options?.freqRulerSelectHeight || '15px';

        this.cursorClasslist = options?.cursorClasslist || 'bi bi-caret-down-fill fs-2';

        this.fleetTagWidth = options?.fleetTagWidth || '35px';
        this.fleetHeight = options?.fleetHeight || '45px'; // height do carro
        
        this.rulerHeight = options?.rulerHeight || '25px';
        this.rulerNumColor = options?.rulerNumColor || '#888';
        this.rulerNumSize = options?.rulerNumSize || '11px';
        this.rulerNumPaddingStart = options?.rulerNumPaddingStart || '0';
        this.rulerNumPaddingTop = options?.rulerNumPaddingTop || '2px';
        
        this.rulerUnit = options?.rulerUnit || '6px';
        this.rulerClasslist = options?.rulerClasslist || 'bg-body';
        this.rulerSmallWidth = options?.rulerSmallWidth || '1px';
        this.rulerSmallColor = options?.rulerSmallColor || '#666';
        this.rulerSmallHeight = options?.rulerSmallHeight || '10px';
        this.rulerMediumWidth = options?.rulerMediumWidth || '1px';
        this.rulerMediumColor = options?.rulerMediumColor || '#BBB';
        this.rulerMediumHeight = options?.rulerMediumHeight || '15px';
        this.rulerMediumUnit = options?.rulerMediumUnit || 30;

        this.tripFromStyle = options?.tripFromStyle || 'height: 8px;border-radius: 10px;';
        this.tripToStyle = options?.tripToStyle || 'height: 8px;border-radius: 10px;';
        this.tripFromColor = options?.tripFromColor || 'var(--bs-info-border-subtle)';
        this.tripToColor = options?.tripToColor || 'var(--bs-secondary-bg)';
        this.tripHeight = options?.tripHeight || '8px';
        
        this.footerClasslist = options?.footerClasslist || 'bg-body-secondary text-body-secondary w-100 position-fixed bottom-0 start-0 border-top';
        this.footerHeight = options?.footerHeight || '70px';

        this.translateType = {
            '0': '<span class="text-secondary">RESERVADO</span>',
            '1': '<span class="text-success">PRODUTIVA</span>',
            '3': '<span class="text-orange">EXPRESSP</span>',
            '4': '<span class="text-orange">SEMIEXPRESSO</span>',
            '-1': '<span class="text-secondary">ACESSO</span>',
            '-2': '<span class="text-secondary">RECOLHE</span>',
        }
        this.translateWay = {
            '1': 'IDA',
            '2': 'VOLTA',
        }
        
        this.maxCarsVisible = Math.floor((this.sh - parseInt(this.canvasMarginTop) - parseInt(this.rulerHeight) - parseInt(this.footerHeight)) / parseInt(this.fleetHeight));
        
        this.__build();
        this.__buildRuler();
        this.__buildCursor();
        this.__buildFooter();
        this.__addListeners();
        if(this.settingsContainer){this.__builSettingsUI()}

    }
    __build(){ // Constroi o canvas (grid principal) e as reguas superior e de frequencia
        this.canvas = document.createElement('div');
        this.canvas.style.position = 'relative';
        this.canvas.style.height = `calc(100vh - ${this.footerHeight} - ${this.canvasMarginTop} - ${this.rulerHeight})`;
        this.canvas.style.left = `calc(${this.rulerUnit} * ${this.initialView} * -1)`;
        // Regua superior
        this.rulerTop = document.createElement('div');
        this.rulerTop.classList = this.rulerClasslist;
        this.rulerTop.style.zIndex = 100;
        this.rulerTop.style.position = 'relative';
        this.rulerTop.style.height = this.rulerHeight;
        this.rulerTop.style.paddingLeft = this.fleetTagWidth;
        // ----
        this.container.appendChild(this.rulerTop);
        this.rulerTop.after(this.canvas);
        // Regua de frequencia
        this.rulerFreqDialog = document.createElement('dialog');
        this.rulerFreqDialog.style = 'position: relative;border:0; width: 100%; height: 45px;z-index: 110;opacity: 0.8;position:absolute;bottom: 8px;padding: 0;'
        this.rulerFreqDialog.open = true; // Inicia exibindo a regua de freq
        this.rulerFreq = document.createElement('div');
        this.rulerFreq.style.position = 'relative';
        this.rulerFreq.style.left = this.canvas.style.left;
        this.rulerFreqDialog.appendChild(this.rulerFreq);
        this.canvas.after(this.rulerFreqDialog);
    }
    __buildCursor(){ // Controi o cursor
        this.cursor = document.createElement('i');
        this.cursor.classList = this.cursorClasslist;
        this.cursor.style.position = 'absolute';
        this.cursor.style.left = '-300px';
        this.cursor.style.top = '-300px';
        this.cursor.style.zIndex = '98';
        this.canvas.appendChild(this.cursor);
    }
    __buildRuler(){ // Cria (ou atualiza) regua
        this.rulerSmallMarginRight = (parseInt(this.rulerUnit) - parseInt(this.rulerSmallWidth)) + 'px';
        this.rulerMediumMarginRight = (parseInt(this.rulerUnit) - parseInt(this.rulerMediumWidth)) + 'px';
        this.maxMinutsVisible = parseInt((this.sw - parseInt(this.fleetTagWidth)) / parseInt(this.rulerUnit));
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
                num.style.paddingLeft = this.rulerNumPaddingStart;
                num.style.paddingTop = this.rulerNumPaddingTop;
                num.innerHTML = min2Hour(start);
                this.rulerTop.appendChild(d);
                this.rulerTop.appendChild(num);
            }
            reset++;
            start++;
        }
    }
    __buildFooter(){ // Cria elementos do footer
        // Footer
        this.footer = document.createElement('div');
        this.footer.classList = this.footerClasslist;
        this.footer.classList.add('user-select-none');
        this.footer.style.height = this.footerHeight;
        this.footer.style.zIndex = '100';
        this.displayStart = document.createElement('h5');this.displayStart.style.width = '70px';this.displayStart.style.position = 'absolute';this.displayStart.style.top = '5px';this.displayStart.style.left = '10px';this.displayStart.innerHTML = '--:--';
        this.displayEnd = document.createElement('h5');this.displayEnd.style.width = '70px';this.displayEnd.style.position = 'absolute';this.displayEnd.style.bottom = '5px';this.displayEnd.style.left = '10px';this.displayEnd.innerHTML = '--:--';
        this.displayCycle = document.createElement('h5');this.displayCycle.style.position = 'absolute';this.displayCycle.style.top = '5px';this.displayCycle.style.left = '70px';this.displayCycle.innerHTML = '--';
        let cycleLabel = document.createElement('small');cycleLabel.style.position = 'absolute';cycleLabel.style.bottom = '10px';cycleLabel.style.left = '70px';cycleLabel.innerHTML = 'MIN';
        this.displayFreq = document.createElement('h5');this.displayFreq.style.position = 'absolute';this.displayFreq.style.top = '5px';this.displayFreq.style.left = '110px';this.displayFreq.innerHTML = '--';
        let freqLabel = document.createElement('small');freqLabel.style.position = 'absolute';freqLabel.style.bottom = '10px';freqLabel.style.left = '110px';freqLabel.innerHTML = 'FREQ';
        this.displayInterv = document.createElement('h5');this.displayInterv.style.position = 'absolute';this.displayInterv.style.top = '5px';this.displayInterv.style.left = '150px';this.displayInterv.innerHTML = '--';
        let intervLabel = document.createElement('small');intervLabel.style.position = 'absolute';intervLabel.style.bottom = '10px';intervLabel.style.left = '150px';intervLabel.innerHTML = 'INTERV';
        this.displayTripType = document.createElement('h6');this.displayTripType.classList.add('text-secondary');this.displayTripType.style.position = 'absolute';this.displayTripType.style.top = '10px';this.displayTripType.style.left = '210px';this.displayTripType.innerHTML = '';
        this.displayTripWay = document.createElement('h5');this.displayTripWay.classList = 'text-body-tertiary';this.displayTripWay.style.position = 'absolute';this.displayTripWay.style.bottom = '5px';this.displayTripWay.style.left = '210px';this.displayTripWay.innerHTML = '';
        this.footer.appendChild(this.displayStart);
        this.footer.appendChild(this.displayEnd);
        this.footer.appendChild(this.displayCycle);
        this.footer.appendChild(cycleLabel);
        this.footer.appendChild(this.displayFreq);
        this.footer.appendChild(freqLabel);
        this.footer.appendChild(this.displayInterv);
        this.footer.appendChild(intervLabel);
        this.footer.appendChild(this.displayTripType);
        this.footer.appendChild(this.displayTripWay);
        this.canvas.after(this.footer);
    }
    __builSettingsUI(){
        this.settingsShowFreqRule = document.createElement('input');this.settingsShowFreqRule.id = `March_settingsShowFreqRule`;this.settingsShowFreqRule.checked = true;
        this.settingsShowFreqRule.onclick = () => {
            if(this.settingsShowFreqRule.checked){this.rulerFreqDialog.show()}
            else{this.rulerFreqDialog.close()}
        }
        this.settingsContainer.appendChild(this.__settingsContainerSwitch(this.settingsShowFreqRule, 'Exibir régua de frequência'));
        this.settingsContainer.appendChild(this.__settingsAddBreak());
        
        // this.settingsContainer.appendChild(this.__settingsAddSwitchLabel('Exibir régua de frequência', this.settingsShowFreqRule.id));
        

        this.settingsRulerUnit = document.createElement('input');this.settingsRulerUnit.type = 'number';this.settingsRulerUnit.min = 2;this.settingsRulerUnit.max = 10;this.settingsRulerUnit.placeholder = ' ';this.settingsRulerUnit.classList = 'flat-input';this.settingsRulerUnit.value = parseInt(this.rulerUnit);
        this.settingsRulerUnit.onchange = () => {
            if(this.settingsRulerUnit.value == '' || parseInt(this.settingsRulerUnit.value) < this.settingsRulerUnit.min || parseInt(this.settingsRulerUnit.value) > this.settingsRulerUnit.max){
                this.settingsRulerUnit.classList.add('is-invalid');
                return false;
            }
            this.settingsRulerUnit.classList.remove('is-invalid');
            this.rulerUnit = `${this.settingsRulerUnit.value}px`;
            this.__buildRuler(); // Refaz a regua com novos valores
            if(this.tripFocus){ // Se tiver viagem inserida ajusta posicionamento do canvas
                this.__canvasRebuild(); // Limpa p canvas e refazer todas as viagens com novos parametros
                this.__cursorMove(); // Move o cursor para ajustar view
            }
            this.canvasFit(); // Ajusta posicao do canvas com novas definicoes
        }
        this.settingsContainer.appendChild(this.settingsRulerUnit);
        this.settingsContainer.appendChild(this.__settingsAddCustomLabel('Unidade principal (px) [ 2 a 10 ]'));
        
        this.settingsRulerMediumUnit = document.createElement('input');this.settingsRulerMediumUnit.type = 'number';this.settingsRulerMediumUnit.min = 10;this.settingsRulerMediumUnit.max = 180;this.settingsRulerMediumUnit.placeholder = ' ';this.settingsRulerMediumUnit.classList = 'flat-input';this.settingsRulerMediumUnit.value = parseInt(this.rulerMediumUnit);
        this.settingsRulerMediumUnit.onchange = () => {
            if(this.settingsRulerMediumUnit.value == '' || parseInt(this.settingsRulerMediumUnit.value) < this.settingsRulerMediumUnit.min || parseInt(this.settingsRulerMediumUnit.value) > this.settingsRulerMediumUnit.max){
                this.settingsRulerMediumUnit.classList.add('is-invalid');
                return false;
            }
            this.settingsRulerMediumUnit.classList.remove('is-invalid');
            this.rulerMediumUnit = this.settingsRulerMediumUnit.value;
            this.__buildRuler();
        }
        this.settingsContainer.appendChild(this.settingsRulerMediumUnit);
        this.settingsContainer.appendChild(this.__settingsAddCustomLabel('Display de minutos [ 10 a 180 ]'));
    }
    __settingsAddCustomLabel(text){
        let l = document.createElement('label');
        l.classList = 'flat-label';
        l.innerHTML = text;
        return l;
    }
    __settingsContainerSwitch(el, label_text, marginBottom=false){ // Recebe um elemento input e configura attrs para switch
        let c = document.createElement('div');c.classList = 'form-check form-switch';
        el.type = 'checkbox';
        el.setAttribute('role', 'switch');
        el.classList = 'form-check-input';
        let l = document.createElement('label');
        l.classList = 'form-check-label';
        l.setAttribute('for', el.id);
        l.innerHTML = label_text;
        c.appendChild(el);
        c.appendChild(l);
        return c;
    }
    __settingsAddDivisor(){return document.createElement('hr')}
    __settingsAddBreak(){return document.createElement('br')}
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
        this.freqGrid[seq - 1] = []; // Adiciona entrada para o carro no dicionario de freqGrid
        let v = this.addTrip(car.trips[0], seq - 1)
        if(this.tripFocus == null){ // Se nenhuma viagem em foco, aponta para primeira viagem do primeiro carro
            this.fleetIndex = 0;
            this.tripIndex = 0;
            this.fleetFocus = car;
            this.tripFocus = car.trips[0];
            this.__cursorMove();
            this.__updateTripDisplay();
        }
    }
    addTrip(trip=null, seq=this.fleetIndex){
        trip = trip || this.project.cars[this.fleetIndex].addTrip(this.project.route.param);
        let v = document.createElement('div'); // Elemento viagem (grid)
        v.style = trip.way == IDA ? this.tripFromStyle : this.tripToStyle;
        v.style.backgroundColor = trip.way == IDA ? this.tripFromColor : this.tripToColor;
        v.style.position = 'absolute';
        v.style.width = `calc(${this.rulerUnit} * ${trip.getCycle()})`;
        v.style.top = `calc(${this.fleetHeight} * ${seq + 1} - 17px)`;
        v.style.left = `calc(${this.fleetTagWidth} + ${trip.start} * ${this.rulerUnit})`;
        this.grid[seq].push(v);
        this.canvas.appendChild(v);
        let vf = document.createElement('div'); // Dot na regua de frequencia
        vf.style.position = 'absolute';
        vf.style.left = v.style.left; // Assume mesmo posicionamento da viagem
        vf.style.top = trip.way == IDA ? '5px' : '30px';
        vf.style.width = this.rulerSmallWidth;
        vf.style.height = this.rulerSmallHeight;
        vf.style.backgroundColor = this.rulerSmallColor;
        vf.style.marginRight = this.rulerSmallMarginRight;
        this.freqGrid[seq].push(vf);
        this.rulerFreq.appendChild(vf);
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
                    this.freqGrid[this.fleetIndex][i].style.left = `calc(${this.fleetTagWidth} + ${this.project.cars[this.fleetIndex].trips[i].start} * ${this.rulerUnit})`;
                }
            }
            this.__updateTripDisplay();
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
                    this.freqGrid[this.fleetIndex][i].style.left = `calc(${this.fleetTagWidth} + ${this.project.cars[this.fleetIndex].trips[i].start} * ${this.rulerUnit})`;
                }
            }
            this.__updateTripDisplay();
        }
    }
    moveStart(){
        if(this.tripFocus != null){
            this.project.cars[this.fleetIndex].moveStart(this.tripIndex); // Aumenta 1 minuto no final na viagem foco
            this.grid[this.fleetIndex][this.tripIndex].style.left = `calc(${this.fleetTagWidth} + ${this.project.cars[this.fleetIndex].trips[this.tripIndex].start} * ${this.rulerUnit})`;
            this.grid[this.fleetIndex][this.tripIndex].style.width = `calc(${this.project.cars[this.fleetIndex].trips[this.tripIndex].getCycle()} * ${this.rulerUnit})`;
            this.freqGrid[this.fleetIndex][this.tripIndex].style.left = `calc(${this.fleetTagWidth} + ${this.project.cars[this.fleetIndex].trips[this.tripIndex].start} * ${this.rulerUnit})`;
            this.__updateTripDisplay();
        }

    }
    backStart(){
        if(this.tripFocus != null){
            this.project.cars[this.fleetIndex].backStart(this.tripIndex);
            this.grid[this.fleetIndex][this.tripIndex].style.left = `calc(${this.fleetTagWidth} + ${this.project.cars[this.fleetIndex].trips[this.tripIndex].start} * ${this.rulerUnit})`;
            this.grid[this.fleetIndex][this.tripIndex].style.width = `calc(${this.project.cars[this.fleetIndex].trips[this.tripIndex].getCycle()} * ${this.rulerUnit})`;
            this.freqGrid[this.fleetIndex][this.tripIndex].style.left = `calc(${this.fleetTagWidth} + ${this.project.cars[this.fleetIndex].trips[this.tripIndex].start} * ${this.rulerUnit})`;
            this.__cursorMove();
            this.__updateTripDisplay();
        }
    }
    advance(){
        if(this.tripFocus != null){
            this.project.cars[this.fleetIndex].advance(this.tripIndex);
            for(let i = this.tripIndex; i < this.project.cars[this.fleetIndex].trips.length; i++){
                this.grid[this.fleetIndex][i].style.left = `calc(${this.fleetTagWidth} + ${this.project.cars[this.fleetIndex].trips[i].start} * ${this.rulerUnit})`;
                this.grid[this.fleetIndex][i].style.width = `calc(${this.project.cars[this.fleetIndex].trips[i].getCycle()} * ${this.rulerUnit})`;
                this.freqGrid[this.fleetIndex][i].style.left = `calc(${this.fleetTagWidth} + ${this.project.cars[this.fleetIndex].trips[i].start} * ${this.rulerUnit})`;
            }
            this.__cursorMove();
            this.__updateTripDisplay();
        }

    }
    back(){
        if(this.tripFocus != null){
            this.project.cars[this.fleetIndex].back(this.tripIndex);
            for(let i = this.tripIndex; i < this.project.cars[this.fleetIndex].trips.length; i++){
                this.grid[this.fleetIndex][i].style.left = `calc(${this.fleetTagWidth} + ${this.project.cars[this.fleetIndex].trips[i].start} * ${this.rulerUnit})`;
                this.grid[this.fleetIndex][i].style.width = `calc(${this.project.cars[this.fleetIndex].trips[i].getCycle()} * ${this.rulerUnit})`;
                this.freqGrid[this.fleetIndex][i].style.left = `calc(${this.fleetTagWidth} + ${this.project.cars[this.fleetIndex].trips[i].start} * ${this.rulerUnit})`;
            }
            this.__cursorMove();
            this.__updateTripDisplay();
        }

    }
    nextTrip(){ // Move foco para proxima viagem no mesmo sentido (indiferente do carro)
        if(!this.tripFocus){return false}
        let v = this.project.nextTrip(this.tripFocus);
        if(v){
            this.fleetIndex = v[0];
            this.tripIndex = v[1];
            this.tripFocus = v[2];
            this.fleetFocus = this.project.cars[this.fleetIndex];
            this.__cursorMove();
            this.__updateTripDisplay();
        }
    }
    previousTrip(){ // Move foco para proxima viagem no mesmo sentido (indiferente do carro)
        if(!this.tripFocus){return false}
        let v = this.project.previousTrip(this.tripFocus);
        if(v){
            this.fleetIndex = v[0];
            this.tripIndex = v[1];
            this.tripFocus = v[2];
            this.fleetFocus = this.project.cars[this.fleetIndex];
            this.__cursorMove();
            this.__updateTripDisplay();
        }
    }
    __updateTripDisplay(){
        if(this.tripFocus == null){return false;}
        this.displayStart.innerHTML = min2Hour(this.tripFocus.start);
        this.displayEnd.innerHTML = min2Hour(this.tripFocus.end);
        this.displayCycle.innerHTML = this.tripFocus.getCycle();
        this.displayFreq.innerHTML = this.project.getHeadway(this.tripFocus) || '--';
        this.displayInterv.innerHTML = this.project.cars[this.fleetIndex].getInterv(this.tripIndex) || '--';
        this.displayTripType.innerHTML = this.translateType[this.tripFocus.type];
        this.displayTripWay.innerHTML = this.translateWay[this.tripFocus.way];
    }
    __cursorMove(){ // Movimenta o cursor para carro e viagem em foco, se cursor atingir limites (vertical ou horiontal) move canvas para ajustar voualizacao
        this.cursor.style.top = `calc(${this.fleetIndex + 1} * ${this.fleetHeight} - ${this.fleetTagWidth} - 17px)`;
        this.cursor.style.left = `calc((${this.tripFocus.start}) * ${this.rulerUnit} + ${this.fleetTagWidth} - 13px)`;
        // Ajusta estilo na freqRule dando enfase a viagem em foco
        this.rulerFreq.querySelectorAll('[data-selected=true]').forEach((el)=>{
            el.removeAttribute('data-selected');
            el.style.height = this.rulerSmallHeight;
            el.style.backgroundColor = this.rulerSmallColor;
        })
        this.freqGrid[this.fleetIndex][this.tripIndex].setAttribute('data-selected', true);
        this.freqGrid[this.fleetIndex][this.tripIndex].style.backgroundColor = this.freqRulerSelectColor;
        this.freqGrid[this.fleetIndex][this.tripIndex].style.height = this.freqRulerSelectHeight;
        // --
        if(this.tripFocus.start < this.initialView){ // Verifica se cursor esta atingindo o limite horizontal a esquerda, se sim ajusta canvas
            let x = Math.ceil((this.initialView - this.tripFocus.start) / this.rulerMediumUnit) * this.rulerMediumUnit;
            this.canvasMove(x * -1);
        }
        else if(this.tripFocus.start > this.__getCanvasEndMargin()){// Verifica se cursor esta atingindo o limite horizontal a direita, se sim ajusta canvas
            let x = Math.ceil((this.tripFocus.start - this.__getCanvasEndMargin()) / this.rulerMediumUnit) * this.rulerMediumUnit;
            this.canvasMove(x);
        }
        if(this.fleetIndex < this.initialFleetView){ // Verifica se cursor esta atingindo o limite vertical superior, se sim ajusta canvas
            let y = (this.initialFleetView - this.fleetIndex) * parseInt(this.fleetHeight);
            this.initialFleetView = this.fleetIndex;
            this.canvasMove(0, y);            
        }
        else if(this.fleetIndex > (this.initialFleetView + this.maxCarsVisible - 1)){ // Verifica se cursor esta atingindo o limite vertical inferior, se sim ajusta canvas
            let y = this.fleetIndex - (this.initialFleetView + this.maxCarsVisible - 1);
            this.initialFleetView += y;
            this.canvasMove(0, y * -1);            
        }
    }
    canvasFit(){ // Move canvas para posicao ajustada com a regua
        this.canvas.style.left = `calc(${this.rulerUnit} * ${this.initialView} * -1)`;
    }
    canvasMove(x=0, y=0){ // Ajusta regua e move canvas em x e/ou y unidades
        // X valor em unidades (int) a ser movido o canvas
        // Y valor em unidades (int) representando os carros (2 = this.fleetIndex += 2)
        if(x == 0 && y == 0){return false}
        if(x != 0){
            this.initialView += x; // Redefine valor para initialView
            this.__buildRuler(); // Refaz a regua bazeado na nova dimensao
            // Move o canvas
            this.canvas.style.left = `calc(${this.rulerUnit} * ${this.initialView} * -1)`;
            // Move regua de freq
            this.rulerFreq.style.left = this.canvas.style.left;
        }
        if(y != 0){
            this.canvas.style.top = `calc(${this.fleetHeight} * ${this.initialFleetView} * ${y > 0 ? 1 : -1})`;
            document.querySelectorAll('[data-role=fleet_tag]').forEach((el)=>{ // Move label dos carros
                el.style.top = `calc(${el.style.top} + (${this.fleetHeight} * ${y > 0 ? 1 : -1}))`;
            })
        }
    }
    __canvasRebuild(){ // Limpa canvas e refaz todas as viagens
        this.canvas.innerHTML = '';
        this.__buildCursor(); // Refaz cursor
        this.grid = {};
        for(let i = 0; i < this.project.cars.length;i++){
            this.grid[i] = [];
            for(let j = 0; j < this.project.cars[i].trips.length; j++){
                this.addTrip(this.project.cars[i].trips[j], i);
            } 
        }
        this.fleetFocus = this.project.cars[this.flee]
    }
    __getCanvasEndMargin(){ // Retorna (em minutos) a margem maxima a direita (usado para verificar limite antes do canvas movimentar)
        return this.initialView + this.maxMinutsVisible - this.endMinutsMargin;
    }
    __addListeners(){
        appKeyMap.bind({key: ';', alt: true, name: 'Add Carro', desc: 'Insere novo carro no projeto', run: ()=>{if(canvasNavActive()){return false};this.addCar()}})
        appKeyMap.bind({key: ']', alt: true, name: 'Add Viagem', desc: 'Insere novo viagem para carro em foco', run: ()=>{if(canvasNavActive()){return false}if(this.tripFocus){this.addTrip();this.__updateTripDisplay();}}})
        appKeyMap.bind({key: 'arrowright', name: 'Próxima viagem', desc: 'Move foco para próxima viagem', run: ()=>{
            if(!this.tripFocus || canvasNavActive()){return false}
            if(this.project.cars[this.fleetIndex].trips.length > this.tripIndex + 1){
                this.tripIndex++;
                this.tripFocus = this.project.cars[this.fleetIndex].trips[this.tripIndex];
                this.__cursorMove();
                this.__updateTripDisplay();
                
            }
        }})
        appKeyMap.bind({key: 'arrowleft', name: 'Viagem anterior', desc: 'Move foco para viagem anterior', run: ()=>{
            if(!this.tripFocus || canvasNavActive()){return false}
            if(this.tripIndex > 0){
                this.tripIndex--;
                this.tripFocus = this.project.cars[this.fleetIndex].trips[this.tripIndex];
                this.__cursorMove();
                this.__updateTripDisplay();
            }
        }})
        appKeyMap.bind({key: 'arrowdown', name: 'Próximo carro', desc: 'Move foco para próximo carro', run: ()=>{
            if(!this.tripFocus || canvasNavActive()){return false}
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
                this.__updateTripDisplay();
            }
        }})
        appKeyMap.bind({key: 'arrowup', name: 'Carro anterior', desc: 'Move foco para carro anterior', run: () => {
            if(!this.tripFocus || canvasNavActive()){return false}
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
                this.__updateTripDisplay();
            }
        }})
        appKeyMap.bind({key: '/', alt: true, name: 'Régua frequência', desc: 'Exibe/oculta régua de frequência', run: ()=>{this.settingsShowFreqRule.click()}})
        appKeyMap.bind({key: '+', name: 'Viagem >>', desc: 'Aumenta 1 min ao final da viagem atual e nas demais', run: ()=>{if(!this.tripFocus || canvasNavActive()){return false}this.plus()}})
        appKeyMap.bind({key: '-', name: 'Viagem <<', desc: 'Subtrai 1 min ao final da viagem atual e nas demais', run: ()=>{if(!this.tripFocus || canvasNavActive()){return false}this.sub()}})
        appKeyMap.bind({key: '+', shift: true, name: 'Viagem >', desc: 'Aumenta 1 minuto na viagem atual', run: ()=>{if(!this.tripFocus || canvasNavActive()){return false}this.plus(false)}})
        appKeyMap.bind({key: '-', shift: true, name: 'Viagem <', desc: 'Subtrai 1 minuto na viagem atual', run: ()=>{if(!this.tripFocus || canvasNavActive()){return false}this.sub(false)}})
        appKeyMap.bind({key: ' ', name: 'Move todas', desc: 'Move todas em 1 min', run: ()=>{if(!this.tripFocus || canvasNavActive()){return false}this.advance()}})
        appKeyMap.bind({key: ' ', shift: true, name: 'Inicio plus', desc: 'Aumenta 1 min no inicio da viagem atual', run: ()=>{if(!this.tripFocus || canvasNavActive()){return false}
            this.moveStart();
            this.__cursorMove();
        }})
        appKeyMap.bind({key: 'backspace', name: 'Adiantar todos', desc: 'Diminui 1 min no inicio da viagem atual e nas seguintes', run: ()=>{if(!this.tripFocus || canvasNavActive()){return false}this.back()}})
        appKeyMap.bind({key: 'backspace', shift: true, name: 'Inicio sub', desc: 'Diminui 1 min no inicio da viagem atual', run: ()=>{if(!this.tripFocus || canvasNavActive()){return false}this.backStart()}})
        appKeyMap.bind({key: 'pagedown', name: 'Proxima viagem', desc: 'Foca próxima viagem', run: ()=>{if(!this.tripFocus || canvasNavActive()){return false}this.nextTrip()}})
        appKeyMap.bind({key: 'pageup', name: 'Viagem anterior', desc: 'Foca viagem anterior', run: ()=>{if(!this.tripFocus || canvasNavActive()){return false}this.previousTrip()}})
    }
}