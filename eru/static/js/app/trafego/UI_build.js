import { metrics as $, min2Hour } from './DM_metrics.js';

function __buildStyles(){
    let style = document.createElement('style');
    style.innerHTML = `
    .viagem-encerrar{border-radius: 5px 0 0 5px!important;}
    .viagem-encerrar::after{
        content: '|';
        font-weight: bolder;
        position: relative;
        top: -16px;
        left: calc(100% - 3.6px);
    }
    .marchSpot{cursor: pointer;z-index: 50;}
    .marchSpot:hover{opacity: 100!important;}`;
    document.getElementsByTagName('head')[0].appendChild(style);
}

function __build(){ // Constroi o canvas (grid principal) e as reguas superior e de frequencia, alem do modal de configuracao do projeto
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
    this.rulerTop.style.paddingLeft = this.carTagWidth;
    // ----
    this.container.appendChild(this.rulerTop);
    this.rulerTop.after(this.canvas);
    // Regua de frequencia
    this.rulerFreqDialog = document.createElement('dialog');this.rulerFreqDialog.setAttribute('data-bs-theme', 'dark');
    this.rulerFreqDialog.style = 'border:0; width: 100%; height: 45px;z-index: 110;opacity: 0.95;position:fixed;bottom: 70px;padding: 0;background-color: var(--bs-tertiary-bg)'
    this.rulerFreqDialog.open = true; // Inicia exibindo a regua de freq
    this.rulerFreq = document.createElement('div');
    this.rulerFreq.style.position = 'relative';
    this.rulerFreq.style.left = this.canvas.style.left;
    this.rulerFreqDialog.appendChild(this.rulerFreq);
    this.canvas.after(this.rulerFreqDialog);
}

function __buildCursor(){ // Controi o cursor
    this.cursor = document.createElement('i');
    this.cursor.classList = this.cursorClasslist;
    this.cursor.style.position = 'absolute';
    this.cursor.style.left = '-300px';
    this.cursor.style.top = '-300px';
    this.cursor.style.zIndex = '98';
    this.canvas.appendChild(this.cursor);
}

function __buildRuler(){ // Cria (ou atualiza) regua
    this.rulerSmallMarginRight = (parseFloat(this.rulerUnit) - parseInt(this.rulerSmallWidth)) + 'px';
    this.rulerMediumMarginRight = (parseFloat(this.rulerUnit) - parseInt(this.rulerMediumWidth)) + 'px';
    this.maxMinutsVisible = parseInt((this.sw - parseInt(this.carTagWidth)) / parseFloat(this.rulerUnit));
    this.rulerTop.innerHTML = '';
    let inicio = this.initialView;
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
            num.innerHTML = min2Hour(inicio);
            this.rulerTop.appendChild(d);
            this.rulerTop.appendChild(num);
        }
        reset++;
        inicio++;
    }
}
function __buildFooter(){ // Cria elementos do footer
    this.footer = document.createElement('div');this.footer.classList = this.footerClasslist;this.footer.classList.add('user-select-none');this.footer.style.height = this.footerHeight;this.footer.style.zIndex = '100';
    this.displayStart = document.createElement('h5');this.displayStart.style.width = '70px';this.displayStart.style.position = 'absolute';this.displayStart.style.top = '5px';this.displayStart.style.left = '10px';this.displayStart.innerHTML = '--:--';
    this.displayEnd = document.createElement('h5');this.displayEnd.style.width = '70px';this.displayEnd.style.position = 'absolute';this.displayEnd.style.bottom = '5px';this.displayEnd.style.left = '10px';this.displayEnd.innerHTML = '--:--';
    this.displayCycle = document.createElement('h5');this.displayCycle.style.position = 'absolute';this.displayCycle.style.top = '5px';this.displayCycle.style.left = '70px';this.displayCycle.innerHTML = '--';
    let cycleLabel = document.createElement('small');cycleLabel.style.position = 'absolute';cycleLabel.style.bottom = '10px';cycleLabel.style.left = '70px';cycleLabel.innerHTML = 'MIN';
    this.displayFreq = document.createElement('h5');this.displayFreq.style.position = 'absolute';this.displayFreq.style.top = '5px';this.displayFreq.style.left = '110px';this.displayFreq.innerHTML = '--';
    let freqLabel = document.createElement('small');freqLabel.style.position = 'absolute';freqLabel.style.bottom = '10px';freqLabel.style.left = '110px';freqLabel.innerHTML = 'FREQ';
    this.displayInterv = document.createElement('h5');this.displayInterv.style.position = 'absolute';this.displayInterv.style.top = '5px';this.displayInterv.style.left = '150px';this.displayInterv.innerHTML = '--';
    let intervLabel = document.createElement('small');intervLabel.style.position = 'absolute';intervLabel.style.bottom = '10px';intervLabel.style.left = '150px';intervLabel.innerHTML = 'INTERV';
    this.displayTripType = document.createElement('h6');this.displayTripType.classList.add('text-secondary');this.displayTripType.style.position = 'absolute';this.displayTripType.style.top = '10px';this.displayTripType.style.left = '210px';this.displayTripType.innerHTML = '';
    this.displayTripType.ondblclick = () => { // No double click, transforma span em select para alterar tipo da viagem
        if([$.INTERVALO, $.ACESSO, $.RECOLHE].includes(this.projects[this.projectIndex].carros[this.carIndex].viagens[this.tripIndex].tipo)){return false;} // Nao pode ser alterado tipos de intervalo, acesso e recolhe
        this.gridLocked = true;
        this.displayTripType.style.display = 'none';
        let select = document.createElement('select');select.style = `position: absolute;left: ${this.displayTripType.style.left};top: ${this.displayTripType.style.top};border: 1px solid var(--bs-border-color);background-color: var(--bs-dark-bg-subtle);`;
        let options = {'1': 'Produtiva', '9': 'Reservado', '2': 'Expresso', '3': 'Semiexpresso'};
        for(let key in options){
            let opt = document.createElement('option');
            opt.value = key;opt.innerHTML = options[key];
            if(opt.value == this.projects[this.projectIndex].carros[this.carIndex].viagens[this.tripIndex].tipo){opt.selected = true;}
            select.appendChild(opt);
        }
        this.displayTripType.after(select);
        let confirm = document.createElement('button');confirm.type = 'button';confirm.innerHTML = 'OK';
        confirm.style = `position: absolute;left: ${select.offsetLeft + select.offsetWidth + 2}px;top: ${select.style.top};border: 1px solid var(--bs-border-color);font-size: 0.8rem;padding: 1px 5px;border-radius: 2px;background-color: var(--bs-dark-bg-subtle);`;
        confirm.onclick = () => {
            this.projects[this.projectIndex].carros[this.carIndex].viagens[this.tripIndex].tipo = select.value;
            if(select.value != $.PRODUTIVA){
                let c = this.projects[this.projectIndex].carros[this.carIndex].viagens[this.tripIndex].sentido == $.IDA ? this.tripOrigemColor : this.tripDestinoColor;
                this.carGrid[this.carIndex][this.tripIndex].style.background = this.typePattern[select.value].replaceAll('COLOR', c);
            }
            else{
                if(this.projects[this.projectIndex].carros[this.carIndex].viagens[this.tripIndex].sentido == $.IDA){
                    this.carGrid[this.carIndex][this.tripIndex].style.background = ''; // Limpa patterns (caso exista)
                    this.carGrid[this.carIndex][this.tripIndex].style.backgroundColor = this.tripOrigemColor; // Ajusta cor da linha
                }
                else{
                    this.carGrid[this.carIndex][this.tripIndex].style.background = ''; // Limpa patterns (caso exista)
                    this.carGrid[this.carIndex][this.tripIndex].style.backgroundColor = this.tripDestinoColor; // Ajusta cor da linha
                }
            }
            // Se viagem foi alterada p reservada, deixa de aparecer no freqRule
            this.freqGrid[this.carIndex][this.tripIndex].style.visibility = select.value == $.RESERVADO ? 'hidden' : 'visible';
            select.remove();
            confirm.remove();
            this.displayTripType.style.display = 'inline';
            this.__updateTripDisplay();
            this.gridLocked = false;
        }
        select.after(confirm);
    }
    this.displayTripWay = document.createElement('h5');this.displayTripWay.classList = 'text-body-tertiary';this.displayTripWay.style.position = 'absolute';this.displayTripWay.style.bottom = '5px';this.displayTripWay.style.left = '210px';this.displayTripWay.innerHTML = '';
    this.displayTripWay.ondblclick = () => {if(this.projects[this.projectIndex].carros[this.carIndex].viagens[this.tripIndex]){this.switchWay();}}
    let vr = document.createElement('div');vr.classList = 'vr';vr.style = 'position: absolute; left: 375px;top: 10px;height: 50px;'
    this.displayTripsCount = document.createElement('h5');this.displayTripsCount.style.position = 'absolute';this.displayTripsCount.style.top = '10px';this.displayTripsCount.style.left = '390px';this.displayTripsCount.innerHTML = '';
    let viagensCountLabel = document.createElement('small');viagensCountLabel.style.position = 'absolute';viagensCountLabel.style.bottom = '10px';viagensCountLabel.style.left = '390px';viagensCountLabel.innerHTML = 'VIAGENS';
    this.displayJorney = document.createElement('h5');this.displayJorney.style.position = 'absolute';this.displayJorney.style.top = '10px';this.displayJorney.style.left = '455px';this.displayJorney.innerHTML = '';
    let jorneyLabel = document.createElement('small');jorneyLabel.style.position = 'absolute';jorneyLabel.style.bottom = '10px';jorneyLabel.style.left = '455px';jorneyLabel.innerHTML = 'JORNADA';
    this.displayInterv2 = document.createElement('h5');this.displayInterv2.style.position = 'absolute';this.displayInterv2.style.top = '10px';this.displayInterv2.style.left = '530px';this.displayInterv2.innerHTML = '';
    let intervLabel2 = document.createElement('small');intervLabel2.style.position = 'absolute';intervLabel2.style.bottom = '10px';intervLabel2.style.left = '530px';intervLabel2.innerHTML = 'INTERV';
    this.carDisplayClassification = document.createElement('select');this.carDisplayClassification.style = `position: absolute;left: 600px;top: 7px;width: 128px;border: 1px solid var(--bs-border-color);background-color: var(--bs-dark-bg-subtle);`;this.carDisplayClassification.id = 'March_footerCarDisplayClassification';
    this.carDisplayClassification.style.display = 'none';
    this.carDisplayClassification.onchange = () => {
        this.projects[this.projectIndex].carros[this.carIndex].classificacao = this.carDisplayClassification.value;
        this.carDisplayClassification.blur();
    }
    let classOptions = {'CV': 'Convencional', 'PD': 'Padron', 'MC': 'Microonibus', 'AT': 'Articulado', 'BI': 'Biarticulado'};
    for(let key in classOptions){
        let opt = document.createElement('option');
        opt.value = key;opt.innerHTML = classOptions[key];
        this.carDisplayClassification.appendChild(opt);
    }
    // ---
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
    this.footer.appendChild(vr);
    this.footer.appendChild(this.displayTripsCount);
    this.footer.appendChild(viagensCountLabel);
    this.footer.appendChild(this.displayJorney);
    this.footer.appendChild(jorneyLabel);
    this.footer.appendChild(this.displayInterv2);
    this.footer.appendChild(intervLabel2);
    this.footer.appendChild(this.carDisplayClassification);   
    this.canvas.after(this.footer);
}

export { __buildStyles, __build, __buildCursor, __buildRuler, __buildFooter }