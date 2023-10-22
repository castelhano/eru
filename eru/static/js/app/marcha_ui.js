class MarchUI{
    constructor(options){
        this.sw = screen.width;
        this.sh = window.innerHeight;
        this.gridLocked = false; // Se true desativa atalhos de edicao do grid
        this.fleetIndex = -1;
        this.tripIndex = -1;
        this.fleetSelection = -1; // Indice do carro onde foi iniciado selecao
        this.startSelection = -1; // Viagem inicial selecionada
        this.endSelection = -1; // Viagem final selecionada
        this.fleetFocus = null;
        this.tripFocus = null;
        this.scheduleFocus = null;
        this.scheduleSelection = null;
        this.fleetLabels = []; // Lista com apontadores das labels dos carros
        this.grid = {}; // Dicionario Todos os elementos do grid (carros e viagens) serao armazenados aqui
        this.freqGrid = {}; // Dicionario com item da regua de frequencia
        this.scheduleGrid = {}; // Dicionario com os schedules
        this.scheduleArrowsGrid = {}; // Lista com elementos arrows
        this.arrowsVisible = true; 
        this.spotsGrid = {}; // Dicionario com os pontos de rendicao dos carros
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

        this.freqRulerSelectColor = options?.freqRulerSelectColor || '#FFF';
        this.freqRulerSelectHeight = options?.freqRulerSelectHeight || '15px';

        this.cursorClasslist = options?.cursorClasslist || 'bi bi-caret-down-fill fs-2';

        this.fleetTagWidth = options?.fleetTagWidth || '35px';
        this.fleetTagColor = options?.fleetTagColor || '#bcbcbc';
        this.fleetHeight = options?.fleetHeight || '45px'; // height do carro
        
        this.rulerHeight = options?.rulerHeight || '25px';
        this.rulerNumColor = options?.rulerNumColor || '#888';
        this.rulerNumSize = options?.rulerNumSize || '11px';
        this.rulerNumPaddingStart = options?.rulerNumPaddingStart || '4px';
        this.rulerNumPaddingTop = options?.rulerNumPaddingTop || '2px';
        
        this.rulerUnit = options?.rulerUnit || '4px';
        this.rulerClasslist = options?.rulerClasslist || 'bg-body';
        this.rulerSmallWidth = options?.rulerSmallWidth || '1px';
        this.rulerSmallColor = options?.rulerSmallColor || '#666';
        this.rulerSmallHeight = options?.rulerSmallHeight || '10px';
        this.rulerMediumWidth = options?.rulerMediumWidth || '1px';
        this.rulerMediumColor = options?.rulerMediumColor || '#BBB';
        this.rulerMediumHeight = options?.rulerMediumHeight || '15px';
        this.rulerMediumUnit = options?.rulerMediumUnit || 60;

        this.tripStyle = options?.tripStyle || 'height: 8px;border-radius: 10px;';
        
        this.tripFromColor = options?.tripFromColor || '#4080A0';
        this.tripToColor = options?.tripToColor || '#98D3F0';
        this.tripHeight = options?.tripHeight || '8px';

        this.defaultSettings = {
            rulerUnit: '4px',
            rulerMediumUnit: 30,
            tripFromColor: '#4080A0',
            tripToColor: '#98D3F0',
        }

        // PRODUTIVA = 1, RESERVADO = 0, EXPRESSO = 3, SEMIEXPRESSO = 4, ACESSO = -1, RECOLHE = -2, INTERVALO = 2;
        this.typePattern = { // Ajusta style da viagem baseado no tipo da viagem
            '0':`repeating-linear-gradient(-45deg, COLOR, COLOR 5px, var(--bs-secondary-bg) 3px, var(--bs-secondary-bg) 10px)`,
            '3':'repeating-linear-gradient(90deg, COLOR, COLOR 6px, var(--bs-secondary-bg) 5px, var(--bs-secondary-bg) 15px)',
            '4':'repeating-linear-gradient(90deg, COLOR, COLOR 6px, var(--bs-secondary-bg) 5px, var(--bs-secondary-bg) 15px)',
            '-1':'linear-gradient(90deg, #666 40%, #CCC 0)',
            '-2':'linear-gradient(90deg, #CCC 60%, #666 0)',
            '2':'repeating-linear-gradient(0deg, #CCC, #CCC 3px, transparent 3px, transparent)',
        }
        
        this.footerClasslist = options?.footerClasslist || 'bg-body-secondary text-body-secondary w-100 position-fixed bottom-0 start-0 border-top';
        this.footerHeight = options?.footerHeight || '70px';

        this.translateType = {
            '0': '<span class="text-orange">RESERVADO</span>',
            '1': '<span class="text-success">PRODUTIVA</span>',
            '3': '<span class="text-orange">EXPRESSO</span>',
            '4': '<span class="text-orange">SEMIEXPRESSO</span>',
            '-1': '<span class="text-orange">ACESSO</span>',
            '-2': '<span class="text-orange">RECOLHE</span>',
            '2': '<span class="text-purple">INTERVALO</span>',
        }
        this.translateWay = {
            '1': 'IDA',
            '2': 'VOLTA',
        }
        
        this.maxCarsVisible = Math.floor((this.sh - parseInt(this.canvasMarginTop) - parseInt(this.rulerHeight) - parseInt(this.footerHeight)) / parseInt(this.fleetHeight));
        
        // Carrega configuracoes do usuario para o grid
        if(localStorage['marchUiSettings']){
            let s = JSON.parse(localStorage['marchUiSettings']);
            this.project.sumInterGaps = s.sumInterGaps;
            this.tripFromColor = s.tripFromColor;
            this.tripToColor = s.tripToColor;
        }

        this.__buildStyles();
        this.__build();
        this.__buildRuler();
        this.__buildFooter();
        this.__addGeneralListeners();
        if(this.settingsContainer){this.__builSettingsUI()}
        
        // Se projeto vazio verifica se nao existe previa salvo localmente, se sim carrega previa
        if(this.project.cars.length == 0 && localStorage['marchCurrentProject']){
            this.project.load(JSON.parse(localStorage.marchCurrentProject)); // Carrega modelo com projeto salvo localmente
        }
        this.switchStage(this.project.viewStage); // Carrega interface do respectivo viewStage
    }
    __buildStyles(){
        let style = document.createElement('style');
        style.innerHTML = `
        .trip-shut{border-radius: 5px 0 0 5px!important;}
        .trip-shut::after{
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
    __build(){ // Constroi o canvas (grid principal) e as reguas superior e de frequencia, alem do modal de configuracao do projeto
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
        this.rulerFreqDialog = document.createElement('dialog');this.rulerFreqDialog.setAttribute('data-bs-theme', 'dark');
        this.rulerFreqDialog.style = 'border:0; width: 100%; height: 45px;z-index: 110;opacity: 0.95;position:fixed;bottom: 70px;padding: 0;background-color: var(--bs-tertiary-bg)'
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
        this.rulerSmallMarginRight = (parseFloat(this.rulerUnit) - parseInt(this.rulerSmallWidth)) + 'px';
        this.rulerMediumMarginRight = (parseFloat(this.rulerUnit) - parseInt(this.rulerMediumWidth)) + 'px';
        this.maxMinutsVisible = parseInt((this.sw - parseInt(this.fleetTagWidth)) / parseFloat(this.rulerUnit));
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
            if([INTERVALO, ACESSO, RECOLHE].includes(this.tripFocus.type)){return false;} // Nao pode ser alterado tipos de intervalo, acesso e recolhe
            this.gridLocked = true;
            this.displayTripType.style.display = 'none';
            let select = document.createElement('select');select.style = `position: absolute;left: ${this.displayTripType.style.left};top: ${this.displayTripType.style.top};border: 1px solid var(--bs-border-color);background-color: var(--bs-dark-bg-subtle);`;
            let options = {'1': 'Produtiva', '0': 'Reservado', '3': 'Expresso', '4': 'Semiexpresso'};
            for(let key in options){
                let opt = document.createElement('option');
                opt.value = key;opt.innerHTML = options[key];
                if(opt.value == this.tripFocus.type){opt.selected = true;}
                select.appendChild(opt);
            }
            this.displayTripType.after(select);
            let confirm = document.createElement('button');confirm.type = 'button';confirm.innerHTML = 'OK';
            confirm.style = `position: absolute;left: ${select.offsetLeft + select.offsetWidth + 2}px;top: ${select.style.top};border: 1px solid var(--bs-border-color);font-size: 0.8rem;padding: 1px 5px;border-radius: 2px;background-color: var(--bs-dark-bg-subtle);`;
            confirm.onclick = () => {
                this.project.cars[this.fleetIndex].trips[this.tripIndex].type = select.value;
                if(select.value != PRODUTIVA){
                    let c = this.tripFocus.way == IDA ? this.tripFromColor : this.tripToColor;
                    this.grid[this.fleetIndex][this.tripIndex].style.background = this.typePattern[select.value].replaceAll('COLOR', c);
                }
                else{
                    if(this.tripFocus.way == IDA){
                        this.grid[this.fleetIndex][this.tripIndex].style.background = ''; // Limpa patterns (caso exista)
                        this.grid[this.fleetIndex][this.tripIndex].style.backgroundColor = this.tripFromColor; // Ajusta cor da linha
                    }
                    else{
                        this.grid[this.fleetIndex][this.tripIndex].style.background = ''; // Limpa patterns (caso exista)
                        this.grid[this.fleetIndex][this.tripIndex].style.backgroundColor = this.tripToColor; // Ajusta cor da linha
                    }
                }
                // Se viagem foi alterada p reservada, deixa de aparecer no freqRule
                this.freqGrid[this.fleetIndex][this.tripIndex].style.visibility = select.value == RESERVADO ? 'hidden' : 'visible';
                select.remove();
                confirm.remove();
                this.displayTripType.style.display = 'inline';
                this.__updateTripDisplay();
                this.gridLocked = false;
            }
            select.after(confirm);
        }
        this.displayTripWay = document.createElement('h5');this.displayTripWay.classList = 'text-body-tertiary';this.displayTripWay.style.position = 'absolute';this.displayTripWay.style.bottom = '5px';this.displayTripWay.style.left = '210px';this.displayTripWay.innerHTML = '';
        this.displayTripWay.ondblclick = () => {if(this.tripFocus){this.switchWay();}}
        let vr = document.createElement('div');vr.classList = 'vr';vr.style = 'position: absolute; left: 375px;top: 10px;height: 50px;'
        this.displayTripsCount = document.createElement('h5');this.displayTripsCount.style.position = 'absolute';this.displayTripsCount.style.top = '10px';this.displayTripsCount.style.left = '390px';this.displayTripsCount.innerHTML = '';
        let tripsCountLabel = document.createElement('small');tripsCountLabel.style.position = 'absolute';tripsCountLabel.style.bottom = '10px';tripsCountLabel.style.left = '390px';tripsCountLabel.innerHTML = 'VIAGENS';
        this.displayJorney = document.createElement('h5');this.displayJorney.style.position = 'absolute';this.displayJorney.style.top = '10px';this.displayJorney.style.left = '455px';this.displayJorney.innerHTML = '';
        let jorneyLabel = document.createElement('small');jorneyLabel.style.position = 'absolute';jorneyLabel.style.bottom = '10px';jorneyLabel.style.left = '455px';jorneyLabel.innerHTML = 'JORNADA';
        this.displayInterv2 = document.createElement('h5');this.displayInterv2.style.position = 'absolute';this.displayInterv2.style.top = '10px';this.displayInterv2.style.left = '530px';this.displayInterv2.innerHTML = '';
        let intervLabel2 = document.createElement('small');intervLabel2.style.position = 'absolute';intervLabel2.style.bottom = '10px';intervLabel2.style.left = '530px';intervLabel2.innerHTML = 'INTERV';


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
        this.footer.appendChild(tripsCountLabel);
        this.footer.appendChild(this.displayJorney);
        this.footer.appendChild(jorneyLabel);
        this.footer.appendChild(this.displayInterv2);
        this.footer.appendChild(intervLabel2);
        this.canvas.after(this.footer);
    }
    __builSettingsUI(){
        this.settingsContainer.innerHTML = `<small class="text-secondary">Version: <b>${this.project.version}</b></small>`;
        this.settingsShowFreqRule = document.createElement('input');this.settingsShowFreqRule.id = `March_settingsShowFreqRule`;this.settingsShowFreqRule.checked = true;
        this.settingsShowFreqRule.onclick = () => {
            if(this.settingsShowFreqRule.checked){this.rulerFreqDialog.show()}
            else{this.rulerFreqDialog.close()}
        }
        this.settingsContainer.appendChild(this.__settingsContainerSwitch(this.settingsShowFreqRule, 'Exibir régua de frequência'));
        
        this.settingsSumIntervGaps = document.createElement('input');this.settingsSumIntervGaps.id = `March_settingsSumIntervGaps`;this.settingsSumIntervGaps.checked = this.project.sumInterGaps;
        this.settingsSumIntervGaps.onclick = () => {
            if(this.settingsSumIntervGaps.checked){this.project.sumInterGaps = true;}
            else{this.project.sumInterGaps = false;}
            this.__saveUISettings();
        }
        this.settingsContainer.appendChild(this.__settingsContainerSwitch(this.settingsSumIntervGaps, 'Somar tempo parado aos intervalos'));
        
        this.settingsContainer.appendChild(this.__settingsAddDivisor());
        
        this.settingstripFromColor = document.createElement('input');this.settingstripFromColor.type = `color`;this.settingstripFromColor.value = this.tripFromColor;
        this.settingstripFromColor.onchange = () => {
            this.tripFromColor = this.settingstripFromColor.value;
            for(let i = 0; i < this.project.cars.length; i++){
                for(let j = 0; j < this.project.cars[i].trips.length;j++){
                    if(this.project.cars[i].trips[j].way == IDA){this.__updateTripStyle(this.project.cars[i].trips[j], this.grid[i][j])}
                }
            }
            this.__saveUISettings();
        }
        this.settingsContainer.appendChild(this.settingstripFromColor);
        let fromColorLabel = document.createElement('small');fromColorLabel.innerHTML = `IDA`;fromColorLabel.style.position = 'relative';fromColorLabel.style.top = '-7px';fromColorLabel.style.left = '5px';
        this.settingsContainer.appendChild(fromColorLabel);
        
        this.settingstripToColor = document.createElement('input');this.settingstripToColor.type = `color`;this.settingstripToColor.style.marginLeft = `25px`;this.settingstripToColor.value = this.tripToColor;
        this.settingstripToColor.onchange = () => {
            this.tripToColor = this.settingstripToColor.value;
            for(let i = 0; i < this.project.cars.length; i++){
                for(let j = 0; j < this.project.cars[i].trips.length;j++){
                    if(this.project.cars[i].trips[j].way == VOLTA){this.__updateTripStyle(this.project.cars[i].trips[j], this.grid[i][j])}
                }
            }
            this.__saveUISettings();
        }
        this.settingsContainer.appendChild(this.settingstripToColor);
        let toColorLabel = document.createElement('small');toColorLabel.innerHTML = `VOLTA`;toColorLabel.style.position = 'relative';toColorLabel.style.top = '-7px';toColorLabel.style.left = '5px';
        this.settingsContainer.appendChild(toColorLabel);
        
        this.settingsContainer.appendChild(this.__settingsAddDivisor());
        
        this.settingsrulerUnit = document.createElement('input');this.settingsrulerUnit.type = 'number';this.settingsrulerUnit.min = 2;this.settingsrulerUnit.max = 6;this.settingsrulerUnit.placeholder = ' ';this.settingsrulerUnit.classList = 'flat-input';this.settingsrulerUnit.id = 'March_settingsrulerUnit';this.settingsrulerUnit.value = parseFloat(this.rulerUnit);
        this.settingsrulerUnit.onchange = () => {
            if(this.settingsrulerUnit.value == '' || parseInt(this.settingsrulerUnit.value) < this.settingsrulerUnit.min || parseInt(this.settingsrulerUnit.value) > this.settingsrulerUnit.max){
                this.settingsrulerUnit.classList.add('is-invalid');
                return false;
            }
            this.settingsrulerUnit.classList.remove('is-invalid');
            this.rulerUnit = `${this.settingsrulerUnit.value}px`;
            this.__buildRuler(); // Refaz a regua com novos valores
            if(this.tripFocus){ // Se tiver viagem inserida ajusta posicionamento do canvas
                this.__canvasRebuild(); // Limpa p canvas e refazer todas as viagens com novos parametros
                this.__cursorMove(); // Move o cursor para ajustar view
            }
            this.canvasFit(); // Ajusta posicao do canvas com novas definicoes
            this.__saveUISettings();
        }
        this.settingsContainer.appendChild(this.settingsrulerUnit);
        this.settingsContainer.appendChild(this.__settingsAddCustomLabel(this.settingsrulerUnit, 'Unidade (em px) [ 2 a 6 ]'));
        
        this.settingsrulerMediumUnit = document.createElement('input');this.settingsrulerMediumUnit.type = 'number';this.settingsrulerMediumUnit.min = 10;this.settingsrulerMediumUnit.max = 180;this.settingsrulerMediumUnit.placeholder = ' ';this.settingsrulerMediumUnit.classList = 'flat-input';this.settingsrulerMediumUnit.id = 'March_settingsrulerMediumUnit';this.settingsrulerMediumUnit.value = parseInt(this.rulerMediumUnit);
        this.settingsrulerMediumUnit.onchange = () => {
            if(this.settingsrulerMediumUnit.value == '' || parseInt(this.settingsrulerMediumUnit.value) < this.settingsrulerMediumUnit.min || parseInt(this.settingsrulerMediumUnit.value) > this.settingsrulerMediumUnit.max){
                this.settingsrulerMediumUnit.classList.add('is-invalid');
                return false;
            }
            this.settingsrulerMediumUnit.classList.remove('is-invalid');
            this.rulerMediumUnit = this.settingsrulerMediumUnit.value;
            this.__buildRuler();
            this.__saveUISettings();
        }
        this.settingsContainer.appendChild(this.settingsrulerMediumUnit);
        this.settingsContainer.appendChild(this.__settingsAddCustomLabel(this.settingsrulerMediumUnit, 'Display de minutos [ 10 a 180 ]'));

        this.settingsProjectName = document.createElement('input');this.settingsProjectName.placeholder = ' ';this.settingsProjectName.classList = 'flat-input';this.settingsProjectName.id = 'March_settingsProjectName';this.settingsProjectName.value = this.project.name;
        this.settingsProjectName.onchange = ()=>{this.project.name = this.settingsProjectName.value;}
        this.settingsContainer.appendChild(this.settingsProjectName);
        this.settingsContainer.appendChild(this.__settingsAddCustomLabel(this.settingsProjectName, 'Nome Projeto'));
        
        this.settingsDayType = document.createElement('select');this.settingsDayType.classList = 'flat-select';this.settingsDayType.id = 'March_settingsDayType';
        let dayTypeOpts = {1: 'Util', 2: 'Sabado', 3: 'Domingo', 4: 'Especial'}
        for(let key in dayTypeOpts){
            let opt = document.createElement('option');opt.value = key; opt.innerHTML = dayTypeOpts[key];
            if(this.project.dayType == key){opt.selected = true}
            this.settingsDayType.appendChild(opt);
        }
        this.settingsDayType.onchange = ()=>{this.project.dayType = this.settingsDayType.value}
        this.settingsContainer.appendChild(this.settingsDayType);
        this.settingsContainer.appendChild(this.__settingsAddCustomLabel(this.settingsDayType, 'Dia Tipo'));

        this.settingsProjectDesc = document.createElement('textarea');this.settingsProjectDesc.placeholder = ' ';this.settingsProjectDesc.classList = 'flat-textarea';this.settingsProjectDesc.id = 'March_settingsProjectDesc';this.settingsProjectDesc.value = this.project.desc;
        this.settingsProjectDesc.onchange = ()=>{this.project.desc = this.settingsProjectDesc.value;}
        this.settingsContainer.appendChild(this.settingsProjectDesc);
        this.settingsContainer.appendChild(this.__settingsAddCustomLabel(this.settingsProjectDesc, 'Descrição'));
        
        this.settingsUploadProjectControl = document.createElement('button');this.settingsUploadProjectControl.type = 'button';this.settingsUploadProjectControl.classList = 'btn btn-sm btn-dark';this.settingsUploadProjectControl.innerHTML = 'Carregar Arquivo';
        this.settingsUploadProjectControl.onclick = ()=>{this.uploadProject();}
        this.settingsContainer.appendChild(this.settingsUploadProjectControl);
    }
    __settingsAddCustomLabel(input, text){
        let l = document.createElement('label');
        l.setAttribute('for', input.id);
        l.classList = 'flat-label';
        l.innerHTML = text;
        return l;
    }
    __settingsContainerSwitch(el, label_text, marginBottom=false){ // Recebe um elemento input e configura attrs para switch
        let c = document.createElement('div');c.classList = 'form-check form-switch';
        if(marginBottom){c.style.marginBottom = marginBottom};
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
    __settingsUpdateBaselines(){ // Atualiza tabela com patamares cadastrados
        let baseline = this.project.route.getBaselines();
        this.settingsBaselineTable.innerHTML = '<thead><tr><th colspan="2">Faixa</th><th colspan="2">Ciclo</th><th colspan="2">Intervalo</th></tr><tr><th>Inicio</th><th>Fim</th><th>Ida</th><th>Volta</th><th>Ida</th><th>Volta</th></tr></thead>';
        for(let i = 0; i < baseline.length; i++){
            let tr = `<tr><td>${baseline[i].start}</td><td>${baseline[i].end}</td><td>${baseline[i].fromMin}</td><td>${baseline[i].toMin}</td><td>${baseline[i].fromInterv}</td><td>${baseline[i].toInterv}</td></tr>`;
            this.settingsBaselineTable.innerHTML += tr;
        }
    }
    __settingsUpdateFreqSimulate(){ // Calcula frequencia (exibe na label) baseado nos dados do patamar
        if(this.settingsFleetSimulate.value == '' || this.settingsFleetSimulate.value == 0){this.settingsFreqSimulate.innerHTML = '--'; return false;}
        if(!this.project.route.circular){
            this.settingsFreqSimulate.innerHTML = ((parseInt(this.settingsBaselineFromMin.value) + parseInt(this.settingsBaselineToMin.value) + parseInt(this.settingsBaselineFromInterv.value) + parseInt(this.settingsBaselineToInterv.value)) / parseInt(this.settingsFleetSimulate.value)).toFixed(2);
        }
        else{
            this.settingsFreqSimulate.innerHTML = ((parseInt(this.settingsBaselineFromMin.value) + parseInt(this.settingsBaselineFromInterv.value)) / parseInt(this.settingsFleetSimulate.value)).toFixed(2);
        }
    }
    addFleet(car=null, seq=this.project.cars.length + 1){
        car = car || this.project.addFleet({route: this.project.route});
        let carLabel = document.createElement('span');
        carLabel.style.width = this.fleetTagWidth;
        carLabel.style.color = this.fleetTagColor;
        carLabel.style.height = this.fleetHeight;
        carLabel.style.paddingLeft = '3px';
        carLabel.style.position = 'absolute';
        carLabel.style.backgroundColor = 'var(--bs-body-bg)';
        carLabel.style.zIndex = '95';
        carLabel.innerHTML = String(seq).padStart(2,'0');
        carLabel.style.top = `calc(${this.fleetHeight} * ${seq})`;
        carLabel.style.left = 0;
        this.fleetLabels.push(carLabel);
        this.container.appendChild(carLabel);
        this.grid[seq - 1] = []; // Adiciona entrada para o carro no dicionario de grid
        this.freqGrid[seq - 1] = []; // Adiciona entrada para o carro no dicionario de freqGrid
        for(let i = 0; i < car.trips.length; i++){
            let v = this.addTrip(car.trips[i], seq - 1);
        }
        if(this.tripFocus == null){ // Se nenhuma viagem em foco, aponta para primeira viagem do primeiro carro
            this.fleetIndex = 0;
            this.tripIndex = 0;
            this.fleetFocus = car;
            this.tripFocus = car.trips[0];
            this.__cursorMove();
            this.__updateTripDisplay();
        }
    }
    addTrip(trip=null, seq=this.fleetIndex, confirmed=false){
        this.__clearSelection();
        trip = trip || this.project.cars[this.fleetIndex].addTrip(this.project.route);
        let v = document.createElement('div'); // Elemento viagem (grid)
        v.style = this.tripStyle;
        this.__updateTripStyle(trip, v);
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
        if([INTERVALO, ACESSO, RECOLHE, RESERVADO].includes(trip.type)){
            vf.style.visibility = 'hidden';
        }
        this.freqGrid[seq].push(vf);
        this.rulerFreq.appendChild(vf);
        return v;
    }
    __modalConfirmationChangeProject(resolve, reject=null){
        this.gridLocked = true;
        let modal = document.createElement('dialog');modal.innerHTML = '<h6 class="text-orange">Alteração de Planejamento</h6><hr class="mt-0"><p><b>Atenção:</b> Já existe escala gerada para o carro, ao inserir, excluir ou movimentar viagens, as escalas do veiculo serão <b class="text-orange">removidas</b>, confirma operação?</p>';
        modal.addEventListener('close', ()=> {modal.remove(); this.gridLocked = false;})
        let confirm = document.createElement('button');confirm.type = 'button';confirm.classList = 'btn btn-sm btn-secondary float-end';confirm.innerHTML = 'Confirmar';
        confirm.onclick = ()=>{resolve();modal.close()};
        let cancel = document.createElement('button');cancel.type = 'button';cancel.classList = 'btn btn-sm btn-phanton float-end me-2';cancel.innerHTML = 'Cancelar';
        cancel.onclick = ()=>{
            if(reject){reject()}
            modal.close();
        };        
        modal.appendChild(confirm);
        modal.appendChild(cancel);
        document.body.appendChild(modal);
        modal.showModal();
    }

    addTripAt(){ // Exibe modal com entrada para hora de inicio de viagem
        this.__clearSelection();
        this.gridLocked = true;
        let modal = document.createElement('dialog');modal.innerHTML = '<h6>Adicionar viagem as:</h6>'
        let startAt = document.createElement('input');startAt.type = 'time';startAt.style.width = '100px';startAt.style.textAlign = 'center';startAt.style.display = 'block';startAt.style.marginLeft = 'auto';startAt.style.marginRight = 'auto';
        let confirm = document.createElement('button');confirm.type = 'button';confirm.classList = 'btn btn-sm btn-dark mt-2 float-end';confirm.innerHTML = 'Confirmar';
        confirm.onclick = () => {
            let time = hour2Min(startAt.value)
            if(time){
                let v = this.project.addTrip(this.fleetIndex, time);
                if(v){ // Se viagem atende requisitos, insere viagem no grid
                    this.addTrip(v, this.fleetIndex);
                    // Ao inserir viagem com horario predefinido move o foco para esta viagem
                    this.tripFocus = v;
                    this.tripIndex = this.project.cars[this.fleetIndex].trips.indexOf(this.tripFocus);
                    // Ao inserir viagem com horario predefinido a viagem sera inserida na ordem de inicio
                    // necessario reordenar tambem grid para corresponder indices de viagens
                    this.grid[this.fleetIndex].sort((a, b) => a.offsetLeft > b.offsetLeft ? 1 : -1);
                    this.freqGrid[this.fleetIndex].sort((a, b) => a.offsetLeft > b.offsetLeft ? 1 : -1);
                    this.__cursorMove();
                    this.__updateTripDisplay();
                }
                cancel.click(); // Fecha modal
            }
            else{startAt.style.border = '2px solid var(--bs-form-invalid-color)'}
        }
        let cancel = document.createElement('button');cancel.type = 'button';cancel.classList = 'btn btn-sm btn-secondary mt-2 me-1 float-end';cancel.innerHTML = 'Cancelar';
        cancel.onclick = () => { // Libera o grid e destroi o modal
            this.gridLocked = false;
            modal.remove();
        }
        modal.addEventListener('close', ()=>{this.gridLocked = false;})

        modal.appendChild(startAt);
        modal.appendChild(confirm);
        modal.appendChild(cancel);
        document.body.appendChild(modal);
        modal.showModal();
    }
    addInterv(){
        this.__clearSelection();
        let trip = this.project.cars[this.fleetIndex].addInterv(this.tripIndex);
        if(trip){
            let v = document.createElement('div'); // Elemento viagem (grid)
            v.style = this.tripStyle;
            v.style.background = this.typePattern[INTERVALO];
            v.style.position = 'absolute';
            v.style.width = `calc(${this.rulerUnit} * ${trip.getCycle()})`;
            v.style.top = `calc(${this.fleetHeight} * ${this.fleetIndex + 1} - 17px)`;
            v.style.left = `calc(${this.fleetTagWidth} + ${trip.start} * ${this.rulerUnit})`;
            this.grid[this.fleetIndex].push(v);
            this.canvas.appendChild(v);
            this.grid[this.fleetIndex].sort((a, b) => a.offsetLeft > b.offsetLeft ? 1 : -1);
            let vf = document.createElement('div'); // Dot na regua de frequencia
            vf.style.position = 'absolute';
            vf.style.left = v.style.left; // Assume mesmo posicionamento da viagem
            vf.style.top = trip.way == IDA ? '5px' : '30px';
            vf.style.width = this.rulerSmallWidth;
            vf.style.height = this.rulerSmallHeight;
            vf.style.backgroundColor = this.rulerSmallColor;
            vf.style.marginRight = this.rulerSmallMarginRight;
            vf.style.visibility = 'hidden'; // Intervalos nao sao vistos na freqRule
            this.freqGrid[this.fleetIndex].push(vf);
            this.rulerFreq.appendChild(vf);
            this.freqGrid[this.fleetIndex].sort((a, b) => a.offsetLeft > b.offsetLeft ? 1 : -1);
        }
    }
    addAccess(fleetIndex=this.fleetIndex, tripIndex=this.tripIndex, incrementIndex=true){
        this.__clearSelection();
        let trip = this.project.cars[fleetIndex].addAccess(tripIndex, this.project.route.metrics);
        if(trip){
            let v = document.createElement('div'); // Elemento viagem (grid)
            v.style = this.tripStyle;
            v.style.background = this.typePattern[ACESSO];
            v.style.position = 'absolute';
            v.style.width = `calc(${this.rulerUnit} * ${trip.getCycle()})`;
            v.style.top = `calc(${this.fleetHeight} * ${fleetIndex + 1} - 17px)`;
            v.style.left = `calc(${this.fleetTagWidth} + ${trip.start} * ${this.rulerUnit})`;
            this.grid[fleetIndex].push(v);
            this.canvas.appendChild(v);
            this.grid[fleetIndex].sort((a, b) => a.offsetLeft > b.offsetLeft ? 1 : -1);
            let vf = document.createElement('div'); // Dot na regua de frequencia
            vf.style.position = 'absolute';
            vf.style.left = v.style.left; // Assume mesmo posicionamento da viagem
            vf.style.top = trip.way == IDA ? '5px' : '30px';
            vf.style.width = this.rulerSmallWidth;
            vf.style.height = this.rulerSmallHeight;
            vf.style.backgroundColor = this.rulerSmallColor;
            vf.style.marginRight = this.rulerSmallMarginRight;
            vf.style.visibility = 'hidden';; // Acesso nao sao vistos na freqRule
            this.freqGrid[fleetIndex].push(vf);
            this.rulerFreq.appendChild(vf);
            this.freqGrid[fleetIndex].sort((a, b) => a.offsetLeft > b.offsetLeft ? 1 : -1);
            if(incrementIndex){this.tripIndex++}
        }
    }
    addRecall(fleetIndex=this.fleetIndex, tripIndex=this.tripIndex){ // Adiciona recolhida na viagem em foco
        this.__clearSelection();
        let trip = this.project.cars[fleetIndex].addRecall(tripIndex, this.project.route.metrics);
        if(trip){
            let v = document.createElement('div'); // Elemento viagem (grid)
            v.style = this.tripStyle;
            v.style.background = this.typePattern[RECOLHE];
            v.style.position = 'absolute';
            v.style.width = `calc(${this.rulerUnit} * ${trip.getCycle()})`;
            v.style.top = `calc(${this.fleetHeight} * ${fleetIndex + 1} - 17px)`;
            v.style.left = `calc(${this.fleetTagWidth} + ${trip.start} * ${this.rulerUnit})`;
            this.grid[fleetIndex].push(v);
            this.canvas.appendChild(v);
            this.grid[fleetIndex].sort((a, b) => a.offsetLeft > b.offsetLeft ? 1 : -1);
            let vf = document.createElement('div'); // Dot na regua de frequencia
            vf.style.position = 'absolute';
            vf.style.left = v.style.left; // Assume mesmo posicionamento da viagem
            vf.style.top = trip.way == IDA ? '5px' : '30px';
            vf.style.width = this.rulerSmallWidth;
            vf.style.height = this.rulerSmallHeight;
            vf.style.backgroundColor = this.rulerSmallColor;
            vf.style.marginRight = this.rulerSmallMarginRight;
            vf.style.visibility = 'hidden';; // Recolhe nao sao vistos na freqRule
            this.rulerFreq.appendChild(vf);
            this.freqGrid[fleetIndex].push(vf);
            this.freqGrid[fleetIndex].sort((a, b) => a.offsetLeft > b.offsetLeft ? 1 : -1);
            return true;
        }
        return false;
    }
    tripShut(){ // Encerra turno na viagem em foco
        let v = this.fleetFocus.tripShut(this.tripIndex);
        if(v){
            this.__updateTripStyle(this.tripFocus, this.grid[this.fleetIndex][this.tripIndex]);
        }
    }
    switchWay(){ // Abre modal para alteracao do sentido da viagem
        let dialog = document.createElement('dialog');
        dialog.innerHTML = `<p>Deseja altera o sentido da viagem para <b class="text-purple">${this.tripFocus.way  == IDA ? 'VOLTA' : 'IDA'}</b>?</p>`
        let check = document.createElement('input');check.id = 'March_switchWayCheck';check.checked = 'true'
        dialog.appendChild(this.__settingsContainerSwitch(check, 'Alterar demais viagens'));
        let cancel = document.createElement('button');cancel.type = 'button';cancel.classList = 'btn btn-sm btn-phanton text-secondary float-end';cancel.innerHTML = 'Cancelar';
        cancel.onclick = ()=>{
            dialog.close();
            dialog.remove();            
        }
        let confirm = document.createElement('button');confirm.type = 'button';confirm.classList = 'btn btn-sm btn-phanton float-end';confirm.innerHTML = 'Gravar';
        confirm.onclick = () => {
            this.project.cars[this.fleetIndex].switchWay(this.tripIndex, check.checked);
            this.__updateTripStyle(this.project.cars[this.fleetIndex].trips[this.tripIndex], this.grid[this.fleetIndex][this.tripIndex]);
            if(check.checked){
                for(let i = this.tripIndex + 1; i < this.project.cars[this.fleetIndex].trips.length; i++){
                    this.__updateTripStyle(this.project.cars[this.fleetIndex].trips[i], this.grid[this.fleetIndex][i]);
                }
            }
            cancel.click();
            this.__updateTripDisplay();
        }
        dialog.appendChild(confirm);
        dialog.appendChild(cancel);
        document.body.appendChild(dialog);
        dialog.showModal();
    }
    __updateTripStyle(model, target){ // Ajusta stilo da viagem
        target.style.backgroundColor = model.way == IDA ? this.tripFromColor : this.tripToColor;
        target.style.color = target.style.backgroundColor;
        if(model.type != PRODUTIVA){
            let c = model.way == IDA ? this.tripFromColor : this.tripToColor;
            target.style.background = this.typePattern[model.type].replaceAll('COLOR', c);
        }
        if(model.shut){target.classList.add('trip-shut')}
        else{target.classList.remove('trip-shut')}
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
    removeFleet(){
        if(!this.fleetFocus){return false}
        let r = this.project.removeFleet(this.fleetIndex);
        if(r){this.__loadStage1()} // Ao remover carro, todo o grid eh reconstruido
    }
    removeTrip(cascade=true){ // Remove viagem em foco e se cascade=true as seguintes
        if(this.tripFocus){
            let r;
            // Se itens selecionados, apaga as viagens selecionadas
            if(this.startSelection >= 0 && this.endSelection >= 0){r = this.project.cars[this.fleetIndex].removeTrip(this.tripIndex, false, this.endSelection - this.startSelection + 1)}
            else{r = this.project.cars[this.fleetIndex].removeTrip(this.tripIndex, cascade)}
            if(r){
                if(this.startSelection >= 0 && this.endSelection >= 0){
                    let ajustedStart = this.startSelection - (r[1] ? 1 : 0);
                    let ajustedEnd = this.endSelection + (r[2] ? 1 : 0);
                    for(let i = ajustedEnd; i >= ajustedStart; i--){
                        this.grid[this.fleetSelection][i].remove(); // Apaga viagem no grid
                        this.freqGrid[this.fleetSelection][i].remove(); // Apaga viagem no freqGrid
                    }
                    this.grid[this.fleetSelection].splice(ajustedStart, ajustedEnd - ajustedStart + 1); // Apaga entradas no grid
                    this.freqGrid[this.fleetSelection].splice(this.tripIndex, ajustedEnd - ajustedStart + 1); // Apaga entradas no freqGrid
                }
                else if(!cascade){
                    let ajustedStart = this.tripIndex - (r[1] ? 1 : 0);
                    let ajustedEnd = this.tripIndex + (r[2] ? 1 : 0);
                    for(let i = ajustedEnd; i >= ajustedStart; i--){
                        this.grid[this.fleetIndex][i].remove(); // Apaga elemento do canvas
                        this.freqGrid[this.fleetIndex][i].remove(); // Apaga elemento no ruleFreq
                    }
                    this.grid[this.fleetIndex].splice(ajustedStart, 1 + (r[1] ? 1 : 0) + (r[2] ? 1 : 0)); // Apaga entrada no grid
                    this.freqGrid[this.fleetIndex].splice(ajustedStart, 1 + (r[1] ? 1 : 0) + (r[2] ? 1 : 0)); // Apaga viagem no freqGrid
                }
                else{
                    let ajustedStart = this.tripIndex - (r[1] ? 1 : 0);
                    for(let i = this.grid[this.fleetIndex].length - 1; i >= ajustedStart; i--){
                        this.grid[this.fleetIndex][i].remove(); // Apaga viagem no grid
                        this.freqGrid[this.fleetIndex][i].remove(); // Apaga viagem no freqGrid
                    }
                    this.grid[this.fleetIndex].splice(ajustedStart, this.grid[this.fleetIndex].length - ajustedStart); // Apaga entradas no grid
                    this.freqGrid[this.fleetIndex].splice(ajustedStart, this.freqGrid[this.fleetIndex].length - ajustedStart); // Apaga entradas no freqGrid
                }
                this.__clearSelection();
                // Muda o foco para viagem anterior (se existir) ou posterior
                this.tripIndex = this.tripIndex == 0 || (this.tripIndex == 1 && r[1]) ? 0 : this.tripIndex - (r[1] ? 2 : 1);
                this.tripFocus = this.project.cars[this.fleetIndex].trips[this.tripIndex];
                this.__cursorMove();
                this.__updateTripDisplay();
            }
        }
    }
    moveTrips(){
        if(this.fleetSelection == this.fleetIndex || this.fleetSelection < 0 || this.startSelection < 0 || this.endSelection < 0){return false;}
        let resp = this.project.moveTrips(this.fleetSelection, this.fleetIndex, this.startSelection, this.endSelection);
        if(resp){
            for(let i = this.startSelection; i <= this.endSelection;i++){ // Ajusta posicao top das viagens alvo para novo carro no canvas
                this.grid[this.fleetSelection][i].style.top = `calc(${this.fleetHeight} * ${this.fleetIndex + 1} - 17px)`;
            }
            this.grid[this.fleetIndex] = this.grid[this.fleetIndex].concat(this.grid[this.fleetSelection].splice(this.startSelection, this.endSelection - this.startSelection + 1));
            this.grid[this.fleetIndex].sort((a, b) => a.offsetLeft > b.offsetLeft ? 1 : -1);
            this.freqGrid[this.fleetIndex] = this.freqGrid[this.fleetIndex].concat(this.freqGrid[this.fleetSelection].splice(this.startSelection, this.endSelection - this.startSelection + 1));
            this.freqGrid[this.fleetIndex].sort((a, b) => a.offsetLeft > b.offsetLeft ? 1 : -1);
            this.__clearSelection();
            this.tripFocus = this.project.cars[this.fleetIndex].trips[this.tripIndex];
            this.__cursorMove();
        }
        else{appNotify('warning', '<b>Atenção:</b> Conflito de horário ou você tentou mover todas as viagens do veiculo')}
    }
    addToTransferArea(){
        if(this.fleetSelection < 0 || this.startSelection < 0 || this.endSelection < 0){return false};
        let r = this.project.addToTransferArea(this.fleetSelection, this.startSelection, this.endSelection);
        if(r){
            for(let i = this.startSelection; i <= this.endSelection; i++){ // Remove itens do grid e freqGrid
                let v = this.project.cars[this.fleetSelection].trips[i];
                this.grid[this.fleetSelection][i].remove();
                this.freqGrid[this.fleetSelection][i].remove();
            }
            this.grid[this.fleetSelection].splice(this.startSelection, r.length);
            this.freqGrid[this.fleetSelection].splice(this.startSelection, r.length);
            if(this.startSelection > 0){
                this.tripIndex = this.startSelection - 1;
                this.tripFocus = this.project.cars[this.fleetIndex].trips[this.tripIndex];
            }
            else{
                this.tripFocus = this.project.cars[this.fleetIndex].trips[this.tripIndex];
            }
            this.__cursorMove();
            this.__updateTripDisplay();
            this.__clearSelection();
            this.__addToTransferAddLabel()
        }
    }
    __addToTransferAddLabel(){
        // Adiciona icone identificando que existe viagens na area de transferencia
        this.transferAreaIcon = document.createElement('div');
        this.transferAreaIcon.style = 'position: absolute; top: 90px; right: 20px; border:1px solid var(--bs-border-color); border-radius: 10px;padding: 4px 10px; background-color: var(--bs-secondary-bg);opacity: 0.7; cursor: pointer;';
        this.transferAreaIcon.innerHTML = `<i class="bi bi-copy fs-5 me-1"></i> <b>${this.project.transferArea.length}</b>`;
        this.transferAreaIcon.title = `Inicio: ${this.project.transferArea[0].getStart()} | Fim: ${this.project.transferArea[this.project.transferArea.length - 1].getEnd()}`;
        document.body.appendChild(this.transferAreaIcon);
    }
    pasteTransfer(){ // 
        let r = this.project.pasteTransfer(this.fleetIndex);
        if(r){
            for(let i = 0; i < this.grid[this.fleetIndex].length; i++){
                this.grid[this.fleetIndex][i].remove(); // Limpa a viagem do grid
                this.freqGrid[this.fleetIndex][i].remove(); // Limpa a viagem do freqGrid
            }
            this.grid[this.fleetIndex] = []; // Limpa o grid
            this.freqGrid[this.fleetIndex] = []; // Limpa o freqGrid
            for(let i = 0; i < this.project.cars[this.fleetIndex].trips.length; i++){
                this.addTrip(this.project.cars[this.fleetIndex].trips[i]); // Adiciona as viagens ajustadas do carro no grid
            }
            this.tripFocus = this.project.cars[this.fleetIndex].trips[this.tripIndex];
            this.__cursorMove();
            this.transferAreaIcon.remove();
        }
        else{appNotify('warning', '<b>Atenção:</b> Conflito de horário, não é possivel mover viagens')}


    }
    __addToSelection(){ // Seleciona viagens
        if(!this.tripFocus || this.project.cars[this.fleetIndex].trips.length <= this.endSelection + 1){return false}
        if(this.fleetSelection >= 0 &&  this.startSelection >= 0){ // Selecao ja iniciada
            this.endSelection++;
            let wd = this.project.cars[this.fleetIndex].trips[this.endSelection].end - this.project.cars[this.fleetIndex].trips[this.startSelection].start;
            this.selectTripsBox.style.width = `calc(${wd} * ${this.rulerUnit} + 10px)`;

        }
        else{
            this.fleetSelection = this.fleetIndex;
            this.startSelection = this.tripIndex;
            this.endSelection = this.tripIndex;
            this.selectTripsBox = document.createElement('div');
            let selectWd = `calc(${this.tripFocus.getCycle()} * ${this.rulerUnit} + 10px)`;
            let selectSt = `calc(${this.fleetTagWidth} + ${this.tripFocus.start} * ${this.rulerUnit} - 5px)`;
            let selectTp = `calc(${this.fleetHeight} * ${this.fleetIndex + 1} - 22px)`;
            this.selectTripsBox.style = `border:1px solid #b72a2a;height: calc(${this.tripHeight} + 10px);border-radius: 10px;width: ${selectWd};position: absolute; top: ${selectTp}; left: ${selectSt}`;
            this.canvas.appendChild(this.selectTripsBox);
        }
        
    }
    __subToSelection(){
        if(!this.tripFocus || this.fleetSelection < 0 || this.startSelection < 0 || this.endSelection < 0){return false}
        if(this.endSelection == this.startSelection){this.__clearSelection();return false} // Se existe apenas uma viagem selecionada apenasremove a selecao e encerra bloco
        this.endSelection--;
        let wd = this.project.cars[this.fleetIndex].trips[this.endSelection].end - this.project.cars[this.fleetIndex].trips[this.startSelection].start;
        this.selectTripsBox.style.width = `calc(${wd} * ${this.rulerUnit} + 10px)`;
    }
    __clearSelection(){
        if(!this.selectTripsBox){return false}
        this.fleetSelection = -1;
        this.startSelection = -1;
        this.endSelection = -1;
        this.selectTripsBox.remove();
    }
    nextTrip(){ // Move foco para proxima viagem no mesmo sentido (indiferente do carro)
        let v = this.project.nextTrip(this.tripFocus);
        if(v){
            this.fleetLabels[this.fleetIndex].style.color = 'inherit';
            this.fleetIndex = v[0];
            this.tripIndex = v[1];
            this.tripFocus = v[2];
            this.fleetLabels[this.fleetIndex].style.color = 'var(--bs-link-color)';
            this.fleetFocus = this.project.cars[this.fleetIndex];
            this.__cursorMove();
            this.__updateTripDisplay();
            this.__clearFleetDisplay();
        }
    }
    previousTrip(){ // Move foco para proxima viagem no mesmo sentido (indiferente do carro)
        let v = this.project.previousTrip(this.tripFocus);
        if(v){
            this.fleetLabels[this.fleetIndex].style.color = 'inherit';
            this.fleetIndex = v[0];
            this.tripIndex = v[1];
            this.tripFocus = v[2];
            this.fleetLabels[this.fleetIndex].style.color = 'var(--bs-link-color)';
            this.fleetFocus = this.project.cars[this.fleetIndex];
            this.__cursorMove();
            this.__updateTripDisplay();
            this.__clearFleetDisplay();
        }
    }
    __updateTripDisplay(){
        if(this.tripFocus == null){return false;}
        this.displayTripType.innerHTML = this.translateType[this.tripFocus.type];
        if(this.tripFocus.type != INTERVALO){
            this.displayStart.innerHTML = this.tripFocus.getStart();
            this.displayEnd.innerHTML = this.tripFocus.getEnd();
            this.displayCycle.innerHTML = this.tripFocus.getCycle();
            this.displayFreq.innerHTML = this.tripFocus.type != RESERVADO ? this.project.getHeadway(this.tripFocus) || '--' : '--';
            this.displayInterv.innerHTML = this.project.cars[this.fleetIndex].getInterv(this.tripIndex) || '--';
            this.displayTripWay.innerHTML = this.translateWay[this.tripFocus.way];
        }
        else{
            this.displayStart.innerHTML = min2Hour(this.tripFocus.start - 1);
            this.displayEnd.innerHTML = min2Hour(this.tripFocus.end + 1);
            this.displayCycle.innerHTML = this.tripFocus.getCycle() + 2;
            this.displayFreq.innerHTML = '--';
            this.displayInterv.innerHTML = '--';
            this.displayTripWay.innerHTML = '';
        }
    }
    __updateFleetDisplay(){
        if(this.tripFocus == null){return false;}
        this.displayTripsCount.innerHTML = this.project.cars[this.fleetIndex].countTrips();
        this.displayJorney.innerHTML = min2Hour(this.project.getJourney(this.fleetIndex), false);
        this.displayInterv2.innerHTML = min2Hour(this.project.getIntervs(this.fleetIndex), false);
        this.fleetDisplayClassification = document.createElement('select');this.fleetDisplayClassification.style = `position: absolute;left: 600px;top: 7px;width: 128px;border: 1px solid var(--bs-border-color);background-color: var(--bs-dark-bg-subtle);`;this.fleetDisplayClassification.id = 'March_footerFleetDisplayClassification';
        this.fleetDisplayClassification.onchange = () => {this.project.cars[this.fleetIndex].classification = this.fleetDisplayClassification.value;}
        let classOptions = {'0': 'Convencional', '1': 'Padron', '-1': 'Microonibus', '2': 'Articulado', '3': 'Biarticulado'};
        for(let key in classOptions){
            let opt = document.createElement('option');
            opt.value = key;opt.innerHTML = classOptions[key];
            if(opt.value == this.fleetFocus.classification){opt.selected = true;}
            this.fleetDisplayClassification.appendChild(opt);
        }
        this.footer.appendChild(this.fleetDisplayClassification);
        
        this.fleetDisplaySpecification = document.createElement('select');this.fleetDisplaySpecification.style = `position: absolute;left: 600px;bottom: 7px;width: 128px;border: 1px solid var(--bs-border-color);background-color: var(--bs-dark-bg-subtle);`;this.fleetDisplaySpecification.id = 'March_footerFleetDisplaySpecification';
        this.fleetDisplaySpecification.onchange = () => {this.project.cars[this.fleetIndex].specification = this.fleetDisplaySpecification.value;}
        let specOptions = {'0': '---', '1': 'Porta LE'};
        for(let key in specOptions){
            let opt = document.createElement('option');
            opt.value = key;opt.innerHTML = specOptions[key];
            if(opt.value == this.fleetFocus.specification){opt.selected = true;}
            this.fleetDisplaySpecification.appendChild(opt);
        }
        this.footer.appendChild(this.fleetDisplaySpecification);
    }
    __clearTripDisplay(){
        this.displayStart.innerHTML = '--:--';
        this.displayEnd.innerHTML = '--:--';
        this.displayCycle.innerHTML = '--';
        this.displayFreq.innerHTML = '--';
        this.displayInterv.innerHTML = '--';
        this.displayTripWay.innerHTML = '';
        this.displayTripType.innerHTML = '';
    }
    __clearFleetDisplay(){
        this.displayTripsCount.innerHTML = '';
        this.displayJorney.innerHTML = '';
        this.displayInterv2.innerHTML = '';
        try{
            this.fleetDisplayClassification.remove();
            this.fleetDisplaySpecification.remove();
        }catch(e){}
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
        if(![INTERVALO, ACESSO, RECOLHE].includes(this.tripFocus.type)){ // Identifica viagem na rulerFreq se viagem for produtiva
            this.freqGrid[this.fleetIndex][this.tripIndex].setAttribute('data-selected', true);
            this.freqGrid[this.fleetIndex][this.tripIndex].style.backgroundColor = this.freqRulerSelectColor;
            this.freqGrid[this.fleetIndex][this.tripIndex].style.height = this.freqRulerSelectHeight;
        }
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
        this.rulerFreq.style.left = this.canvas.style.left;
    }
    canvasMove(x=0, y=0){ // Ajusta regua e move canvas em x e/ou y unidades
        // X valor em unidades (int) a ser movido o canvas
        // Y valor em unidades (int) representando os carros (2 = this.fleetIndex += 2)
        if(x == 0 && y == 0){return false}
        if(x != 0){
            let actualView = this.initialView;
            this.initialView += x; // Redefine valor para initialView
            if(this.initialView < 0){this.initialView = 0} // Impede que regua assuma valor negativo
            if(actualView == this.initialView){return false; } // Se valor do canvas nao foi alterado, termina codigo
            this.__buildRuler(); // Refaz a regua bazeado na nova dimensao
            // Move o canvas
            this.canvas.style.left = `calc(${this.rulerUnit} * ${this.initialView} * -1)`;
            // Move regua de freq
            this.rulerFreq.style.left = this.canvas.style.left;
        }
        if(y != 0){
            this.canvas.style.top = `calc(${this.fleetHeight} * ${this.initialFleetView} * ${y > 0 ? 1 : -1})`;
            this.fleetLabels.forEach((el)=>{ // Move as labels dos carros no eixo y
                el.style.top = `calc(${el.style.top} + (${this.fleetHeight} * ${y > 0 ? 1 : -1}))`;
            })
        }
    }
    __canvasRebuild(){ // Limpa canvas e refaz todas as viagens
        this.canvas.innerHTML = '';
        this.canvas.style.top = '0px';
        this.rulerFreq.innerHTML = '';
        this.__buildCursor(); // Refaz cursor
        this.grid = {};
        this.freqGrid = {};
        for(let i = 0; i < this.project.cars.length;i++){
            this.grid[i] = [];
            this.freqGrid[i] = [];
            for(let j = 0; j < this.project.cars[i].trips.length; j++){
                this.addTrip(this.project.cars[i].trips[j], i);
            } 
        }
        this.fleetFocus = this.project.cars[this.fleetIndex]
    }
    __clearGrid(){
        for(let i in this.grid){ // Apaga todos os elementos do grid
            for(let j = 0; j < this.grid[i].length; j++){
                this.grid[i][j].remove(); // Apaga viagem no grid
                this.freqGrid[i][j].remove(); // Apaga viagem no freqGrid
            }
        }
        this.grid = {};
        this.freqGrid = {};
    }
    __clearScheduleGrid(){ // Limpa toda interface de escala
        for(let i in this.scheduleGrid){ // Apaga todos os elementos do grid
            for(let j = 0; j < this.scheduleGrid[i].length; j++){
                this.scheduleGrid[i][j].remove(); // Apaga escalas
            }
        }
        for(let i in this.spotsGrid){ // Apaga todos os elementos do grid
            for(let j = 0; j < this.spotsGrid[i].length; j++){
                this.spotsGrid[i][j].remove(); // Apaga spots
            }
        }
        this.scheduleGrid = {};
        this.spotsGrid = {};
        this.canvas.innerHTML = ''; // Limpa restante dos componentes (fleet e fleet_tags)
    }
    __clearFleetLabels(){
        this.fleetLabels.forEach((el)=>{el.remove()}); // Apaga todos os labels de frota
        this.fleetLabels = [];
    }
    __getCanvasEndMargin(){ // Retorna (em minutos) a margem maxima a direita (usado para verificar limite antes do canvas movimentar)
        return this.initialView + this.maxMinutsVisible - this.endMinutsMargin;
    }
    __showTripPatterns(){
        if(this.patternsDialog){this.patternsDialog.close(); return false;} // Se modal ja esta aberto, fecha modal
        this.gridLocked = true; // Trava edicao do grid enquanto modal esta aberto
        this.patternsDialog = document.createElement('dialog');
        this.patternsDialog.innerHTML = `<h6>Padrão de Viagens<h6>IDA <div id="ida" style="margin-bottom:6px;width: 150px;height: 8px;border-radius: 10px;background-color: ${this.tripFromColor};"></div>
        VOLTA <div id="volta" style="margin-bottom:6px;width: 150px;height: 8px;border-radius: 10px;background-color: ${this.tripToColor}"></div>
        RESERVADO <div id="reservado" style="margin-bottom:6px;width: 150px;height: 8px;border-radius: 10px;background: ${this.typePattern[RESERVADO].replaceAll('COLOR', this.tripFromColor)};"></div>
        EXPRESSO <div id="expresso" style="margin-bottom:6px;width: 150px;height: 8px;border-radius: 10px;background: ${this.typePattern[EXPRESSO].replaceAll('COLOR', this.tripFromColor)};"></div>
        SEMIEXPRESSO <div id="semi" style="margin-bottom:6px;width: 150px;height: 8px;border-radius: 10px;background: ${this.typePattern[SEMIEXPRESSO].replaceAll('COLOR', this.tripFromColor)};"></div>
        ACESSO <div id="acesso" style="margin-bottom:6px;width: 150px;height: 8px;border-radius: 10px;background: ${this.typePattern[ACESSO].replaceAll('COLOR', this.tripFromColor)};"></div>
        RECOLHE <div id="recolhe" style="margin-bottom:6px;width: 150px;height: 8px;border-radius: 10px;background: ${this.typePattern[RECOLHE].replaceAll('COLOR', this.tripFromColor)};"></div>
        INTERVALO <div id="refeicao" style="margin-bottom:6px;width: 150px;height: 8px;border-radius: 10px;background: ${this.typePattern[INTERVALO].replaceAll('COLOR', this.tripFromColor)};"></div>`;
        this.patternsDialog.addEventListener("close", (e) => {this.gridLocked = false;this.patternsDialog = null;}); // AO fechar destrava grid
        document.body.appendChild(this.patternsDialog);
        this.patternsDialog.showModal();
    }
    __showRouteMetrics(){
        canvasNavActive(false);
        this.gridLocked = true;
        let dialog = document.createElement('dialog'); dialog.style.minWidth = '600px';dialog.style.display = 'flex';dialog.style.columnGap = '15px';
        dialog.addEventListener('close', ()=>{this.gridLocked = false;dialog.remove();})
        let col1 = document.createElement('div'); col1.style.display = 'inline-block';col1.style.width = '25%';col1.innerHTML = '<h6 class="mb-2">Métricas da Linha</h6>';
        let col2 = document.createElement('div'); col2.style.display = 'inline-block';col2.style.width = '75%';col2.style.borderLeft = '1px solid var(--bs-secondary-bg)';col2.style.paddingLeft = '15px';col2.innerHTML = '<h6 class="mb-2">Patamares de Operação</h6>'
        // Adicionado os controles das metricas
        let routeCirc = document.createElement('input');routeCirc.type = 'checkbox';routeCirc.id = 'March_routeCircControl';routeCirc.checked = this.project.route.circular;
        routeCirc.onchange = () => {
            this.project.route.circular = routeCirc.checked;
            if(routeCirc.checked){
                this.settingsBaselineToMin.disabled = true;
                this.settingsBaselineToInterv.disabled = true;
            }
            else{
                this.settingsBaselineToMin.disabled = false;
                this.settingsBaselineToInterv.disabled = false;
            }
        }
        col1.appendChild(this.__settingsContainerSwitch(routeCirc, 'Linha circular', '10px'));
        let col11 = document.createElement('div'); col11.style.display = 'inline-block';col11.style.width = '50%';
        this.settingsFromExtension = document.createElement('input');this.settingsFromExtension.type = 'number';this.settingsFromExtension.classList = 'flat-input';this.settingsFromExtension.min = 0;this.settingsFromExtension.max = 300;this.settingsFromExtension.value = this.project.route.fromExtension;this.settingsFromExtension.id = 'March_settingsFromExtension';this.settingsFromExtension.placeholder = ' ';
        this.settingsFromExtension.onchange = ()=>{
            if(this.settingsFromExtension.value == '' || parseInt(this.settingsFromExtension.value) < this.settingsFromExtension.min || parseInt(this.settingsFromExtension.value) > this.settingsFromExtension.max){
                this.settingsFromExtension.classList.add('is-invalid');
                return false;
            }
            this.settingsFromExtension.classList.remove('is-invalid');
            this.project.route.fromExtension = parseInt(this.settingsFromExtension.value);
        }
        col11.appendChild(this.settingsFromExtension);
        col11.appendChild(this.__settingsAddCustomLabel(this.settingsFromExtension, 'Extensão Ida (km)'));
        col1.appendChild(col11);
        
        let col12 = document.createElement('div'); col12.style.display = 'inline-block';col12.style.width = '50%';
        this.settingsToExtension = document.createElement('input');this.settingsToExtension.type = 'number';this.settingsToExtension.classList = 'flat-input';this.settingsToExtension.min = 0;this.settingsToExtension.max = 300;this.settingsToExtension.value = this.project.route.toExtension;this.settingsToExtension.id = 'March_settingsToExtension';this.settingsToExtension.placeholder = ' ';
        this.settingsToExtension.onchange = ()=>{
            if(this.settingsToExtension.value == '' || parseInt(this.settingsToExtension.value) < this.settingsToExtension.min || parseInt(this.settingsToExtension.value) > this.settingsToExtension.max){
                this.settingsToExtension.classList.add('is-invalid');
                return false;
            }
            this.settingsToExtension.classList.remove('is-invalid');
            this.project.route.toExtension = parseInt(this.settingsToExtension.value);
        }
        col12.appendChild(this.settingsToExtension);
        col12.appendChild(this.__settingsAddCustomLabel(this.settingsToExtension, 'Extensão Volta (km)'));
        col1.appendChild(col12);
        
        let col13 = document.createElement('div'); col13.style.display = 'inline-block';col13.style.width = '50%';
        this.settingsAccessFromMin = document.createElement('input');this.settingsAccessFromMin.type = 'number';this.settingsAccessFromMin.classList = 'flat-input';this.settingsAccessFromMin.min = 1;this.settingsAccessFromMin.max = 300;this.settingsAccessFromMin.value = this.project.route.metrics.fromMinAccess;this.settingsAccessFromMin.id = 'March_settingsAccessFromMin';this.settingsAccessFromMin.placeholder = ' ';
        this.settingsAccessFromMin.onchange = ()=>{
            if(this.settingsAccessFromMin.value == '' || parseInt(this.settingsAccessFromMin.value) < this.settingsAccessFromMin.min || parseInt(this.settingsAccessFromMin.value) > this.settingsAccessFromMin.max){
                this.settingsAccessFromMin.classList.add('is-invalid');
                return false;
            }
            this.settingsAccessFromMin.classList.remove('is-invalid');
            this.project.route.metrics.fromMinAccess = parseInt(this.settingsAccessFromMin.value);
        }
        col13.appendChild(this.settingsAccessFromMin);
        col13.appendChild(this.__settingsAddCustomLabel(this.settingsAccessFromMin, 'Acesso PT1 (min)'));
        col1.appendChild(col13);
        
        let col14 = document.createElement('div'); col14.style.display = 'inline-block';col14.style.width = '50%';
        this.settingsAccessToMin = document.createElement('input');this.settingsAccessToMin.type = 'number';this.settingsAccessToMin.classList = 'flat-input';this.settingsAccessToMin.min = 1;this.settingsAccessToMin.max = 300;this.settingsAccessToMin.value = this.project.route.metrics.toMinAccess;this.settingsAccessToMin.id = 'March_settingsAccessToMin';this.settingsAccessToMin.placeholder = ' ';
        this.settingsAccessToMin.onchange = ()=>{
            if(this.settingsAccessToMin.value == '' || parseInt(this.settingsAccessToMin.value) < this.settingsAccessToMin.min || parseInt(this.settingsAccessToMin.value) > this.settingsAccessToMin.max){
                this.settingsAccessToMin.classList.add('is-invalid');
                return false;
            }
            this.settingsAccessToMin.classList.remove('is-invalid');
            this.project.route.metrics.toMinAccess = parseInt(this.settingsAccessToMin.value);
        }
        col14.appendChild(this.settingsAccessToMin);
        col14.appendChild(this.__settingsAddCustomLabel(this.settingsAccessToMin, 'Acesso PT2 (min)'));
        col1.appendChild(col14);
        
        let col15 = document.createElement('div'); col15.style.display = 'inline-block';col15.style.width = '50%';
        this.settingsRecallFromMin = document.createElement('input');this.settingsRecallFromMin.type = 'number';this.settingsRecallFromMin.classList = 'flat-input';this.settingsRecallFromMin.min = 1;this.settingsRecallFromMin.max = 300;this.settingsRecallFromMin.value = this.project.route.metrics.fromMinRecall;this.settingsRecallFromMin.id = 'March_settingsRecallFromMin';this.settingsRecallFromMin.placeholder = ' ';
        this.settingsRecallFromMin.onchange = ()=>{
            if(this.settingsRecallFromMin.value == '' || parseInt(this.settingsRecallFromMin.value) < this.settingsRecallFromMin.min || parseInt(this.settingsRecallFromMin.value) > this.settingsRecallFromMin.max){
                this.settingsRecallFromMin.classList.add('is-invalid');
                return false;
            }
            this.settingsRecallFromMin.classList.remove('is-invalid');
            this.project.route.metrics.fromMinRecall = parseInt(this.settingsRecallFromMin.value);
        }
        col15.appendChild(this.settingsRecallFromMin);
        col15.appendChild(this.__settingsAddCustomLabel(this.settingsRecallFromMin, 'Recolhe PT1 (min)'));
        col1.appendChild(col15);
        
        let col16 = document.createElement('div'); col16.style.display = 'inline-block';col16.style.width = '50%';
        this.settingsRecallToMin = document.createElement('input');this.settingsRecallToMin.type = 'number';this.settingsRecallToMin.classList = 'flat-input';this.settingsRecallToMin.min = 1;this.settingsRecallToMin.max = 300;this.settingsRecallToMin.value = this.project.route.metrics.toMinRecall;this.settingsRecallToMin.id = 'March_settingsRecallToMin';this.settingsRecallToMin.placeholder = ' ';
        this.settingsRecallToMin.onchange = ()=>{
            if(this.settingsRecallToMin.value == '' || parseInt(this.settingsRecallToMin.value) < this.settingsRecallToMin.min || parseInt(this.settingsRecallToMin.value) > this.settingsRecallToMin.max){
                this.settingsRecallToMin.classList.add('is-invalid');
                return false;
            }
            this.settingsRecallToMin.classList.remove('is-invalid');
            this.project.route.metrics.toMinRecall = parseInt(this.settingsRecallToMin.value);
        }
        col16.appendChild(this.settingsRecallToMin);
        col16.appendChild(this.__settingsAddCustomLabel(this.settingsRecallToMin, 'Recolhe PT2 (min)'));
        col1.appendChild(col16);
        
        let col17 = document.createElement('div'); col17.style.display = 'inline-block';col17.style.width = '50%';
        this.settingsAccessFromKm = document.createElement('input');this.settingsAccessFromKm.type = 'number';this.settingsAccessFromKm.classList = 'flat-input';this.settingsAccessFromKm.min = 0;this.settingsAccessFromKm.max = 300;this.settingsAccessFromKm.value = this.project.route.metrics.fromKmAccess;this.settingsAccessFromKm.id = 'March_settingsAccessFromKm';this.settingsAccessFromKm.placeholder = ' ';
        this.settingsAccessFromKm.onchange = ()=>{
            if(this.settingsAccessFromKm.value == '' || parseInt(this.settingsAccessFromKm.value) < this.settingsAccessFromKm.min || parseInt(this.settingsAccessFromKm.value) > this.settingsAccessFromKm.max){
                this.settingsAccessFromKm.classList.add('is-invalid');
                return false;
            }
            this.settingsAccessFromKm.classList.remove('is-invalid');
            this.project.route.metrics.fromKmAccess = parseInt(this.settingsAccessFromKm.value);
        }
        col17.appendChild(this.settingsAccessFromKm);
        col17.appendChild(this.__settingsAddCustomLabel(this.settingsAccessFromKm, 'Acesso PT1 (km)'));
        col1.appendChild(col17);
        
        let col18 = document.createElement('div'); col18.style.display = 'inline-block';col18.style.width = '50%';
        this.settingsAccessToKm = document.createElement('input');this.settingsAccessToKm.type = 'number';this.settingsAccessToKm.classList = 'flat-input';this.settingsAccessToKm.min = 0;this.settingsAccessToKm.max = 300;this.settingsAccessToKm.value = this.project.route.metrics.toKmAccess;this.settingsAccessToKm.id = 'March_settingsAccessToKm';this.settingsAccessToKm.placeholder = ' ';
        this.settingsAccessToKm.onchange = ()=>{
            if(this.settingsAccessToKm.value == '' || parseInt(this.settingsAccessToKm.value) < this.settingsAccessToKm.min || parseInt(this.settingsAccessToKm.value) > this.settingsAccessToKm.max){
                this.settingsAccessToKm.classList.add('is-invalid');
                return false;
            }
            this.settingsAccessToKm.classList.remove('is-invalid');
            this.project.route.metrics.toKmAccess = parseInt(this.settingsAccessToKm.value);
        }
        col18.appendChild(this.settingsAccessToKm);
        col18.appendChild(this.__settingsAddCustomLabel(this.settingsAccessToKm, 'Acesso PT2 (km)'));
        col1.appendChild(col18);
        
        let col19 = document.createElement('div'); col19.style.display = 'inline-block';col19.style.width = '50%';
        this.settingsRecallFromKm = document.createElement('input');this.settingsRecallFromKm.type = 'number';this.settingsRecallFromKm.classList = 'flat-input';this.settingsRecallFromKm.min = 0;this.settingsRecallFromKm.max = 300;this.settingsRecallFromKm.value = this.project.route.metrics.fromKmRecall;this.settingsRecallFromKm.id = 'March_settingsRecallFromKm';this.settingsRecallFromKm.placeholder = ' ';
        this.settingsRecallFromKm.onchange = ()=>{
            if(this.settingsRecallFromKm.value == '' || parseInt(this.settingsRecallFromKm.value) < this.settingsRecallFromKm.min || parseInt(this.settingsRecallFromKm.value) > this.settingsRecallFromKm.max){
                this.settingsRecallFromKm.classList.add('is-invalid');
                return false;
            }
            this.settingsRecallFromKm.classList.remove('is-invalid');
            this.project.route.metrics.fromKmRecall = parseInt(this.settingsRecallFromKm.value);
        }
        col19.appendChild(this.settingsRecallFromKm);
        col19.appendChild(this.__settingsAddCustomLabel(this.settingsRecallFromKm, 'Recolhe PT1 (km)'));
        col1.appendChild(col19);
        
        let col20 = document.createElement('div'); col20.style.display = 'inline-block';col20.style.width = '50%';
        this.settingsRecallToKm = document.createElement('input');this.settingsRecallToKm.type = 'number';this.settingsRecallToKm.classList = 'flat-input';this.settingsRecallToKm.min = 0;this.settingsRecallToKm.max = 300;this.settingsRecallToKm.value = this.project.route.metrics.toKmRecall;this.settingsRecallToKm.id = 'March_settingsRecallToKm';this.settingsRecallToKm.placeholder = ' ';
        this.settingsRecallToKm.onchange = ()=>{
            if(this.settingsRecallToKm.value == '' || parseInt(this.settingsRecallToKm.value) < this.settingsRecallToKm.min || parseInt(this.settingsRecallToKm.value) > this.settingsRecallToKm.max){
                this.settingsRecallToKm.classList.add('is-invalid');
                return false;
            }
            this.settingsRecallToKm.classList.remove('is-invalid');
            this.project.route.metrics.toKmRecall = parseInt(this.settingsRecallToKm.value);
        }
        col20.appendChild(this.settingsRecallToKm);
        col20.appendChild(this.__settingsAddCustomLabel(this.settingsRecallToKm, 'Recolhe PT2 (km)'));
        col1.appendChild(col20);
        
        // Adicionando os controles dos patamares
        let col21 = document.createElement('div'); col21.style.display = 'inline-block';col21.style.width = '12%';
        this.settingsBaselineStart = document.createElement('input');this.settingsBaselineStart.type = 'number';this.settingsBaselineStart.classList = 'flat-input';this.settingsBaselineStart.min = 0;this.settingsBaselineStart.max = 23;this.settingsBaselineStart.value = 0;this.settingsBaselineStart.id = 'March_settingsBaselineStart';this.settingsBaselineStart.placeholder = ' ';
        col21.appendChild(this.settingsBaselineStart);
        col21.appendChild(this.__settingsAddCustomLabel(this.settingsBaselineStart, 'Faixa Inicio'));
        col2.appendChild(col21);
        
        let col22 = document.createElement('div'); col22.style.display = 'inline-block';col22.style.width = '12%';
        this.settingsBaselineEnd = document.createElement('input');this.settingsBaselineEnd.type = 'number';this.settingsBaselineEnd.classList = 'flat-input';this.settingsBaselineEnd.min = 1;this.settingsBaselineEnd.max = 23;this.settingsBaselineEnd.value = 23;this.settingsBaselineEnd.id = 'March_settingsBaselineEnd';this.settingsBaselineEnd.placeholder = ' ';
        col22.appendChild(this.settingsBaselineEnd);
        col22.appendChild(this.__settingsAddCustomLabel(this.settingsBaselineEnd, 'Faixa Fim'));
        col2.appendChild(col22);
        
        let col23 = document.createElement('div'); col23.style.display = 'inline-block';col23.style.width = '12%';
        this.settingsBaselineFromMin = document.createElement('input');this.settingsBaselineFromMin.type = 'number';this.settingsBaselineFromMin.classList = 'flat-input';this.settingsBaselineFromMin.min = 1;this.settingsBaselineFromMin.max = 300;this.settingsBaselineFromMin.value = CICLO_BASE;this.settingsBaselineFromMin.id = 'March_settingsBaselineFromMin';this.settingsBaselineFromMin.placeholder = ' ';
        this.settingsBaselineFromMin.onchange = () => {this.__settingsUpdateFreqSimulate()}
        col23.appendChild(this.settingsBaselineFromMin);
        col23.appendChild(this.__settingsAddCustomLabel(this.settingsBaselineFromMin, 'Ciclo Ida'));
        col2.appendChild(col23);
        
        let col24 = document.createElement('div'); col24.style.display = 'inline-block';col24.style.width = '12%';
        this.settingsBaselineToMin = document.createElement('input');this.settingsBaselineToMin.type = 'number';this.settingsBaselineToMin.classList = 'flat-input';this.settingsBaselineToMin.min = 1;this.settingsBaselineToMin.max = 300;this.settingsBaselineToMin.value = CICLO_BASE;this.settingsBaselineToMin.id = 'March_settingsBaselineToMin';this.settingsBaselineToMin.placeholder = ' ';
        this.settingsBaselineToMin.onchange = () => {this.__settingsUpdateFreqSimulate()}
        col24.appendChild(this.settingsBaselineToMin);
        col24.appendChild(this.__settingsAddCustomLabel(this.settingsBaselineToMin, 'Ciclo Volta'));
        col2.appendChild(col24);
        
        let col25 = document.createElement('div'); col25.style.display = 'inline-block';col25.style.width = '12%';
        this.settingsBaselineFromInterv = document.createElement('input');this.settingsBaselineFromInterv.type = 'number';this.settingsBaselineFromInterv.classList = 'flat-input';this.settingsBaselineFromInterv.min = 1;this.settingsBaselineFromInterv.max = 300;this.settingsBaselineFromInterv.value = 10;this.settingsBaselineFromInterv.id = 'March_settingsBaselineFromInterv';this.settingsBaselineFromInterv.placeholder = ' ';
        this.settingsBaselineFromInterv.onchange = () => {this.__settingsUpdateFreqSimulate()}
        col25.appendChild(this.settingsBaselineFromInterv);
        col25.appendChild(this.__settingsAddCustomLabel(this.settingsBaselineFromInterv, 'Intervalo Ida'));
        col2.appendChild(col25);
        
        let col26 = document.createElement('div'); col26.style.display = 'inline-block';col26.style.width = '12%';
        this.settingsBaselineToInterv = document.createElement('input');this.settingsBaselineToInterv.type = 'number';this.settingsBaselineToInterv.classList = 'flat-input';this.settingsBaselineToInterv.min = 1;this.settingsBaselineToInterv.max = 300;this.settingsBaselineToInterv.value = 1;this.settingsBaselineToInterv.id = 'March_settingsBaselineToInterv';this.settingsBaselineToInterv.placeholder = ' ';
        if(this.project.route.circular){
            this.settingsBaselineToMin.disabled = true;
            this.settingsBaselineToInterv.disabled = true;
        }
        this.settingsBaselineToInterv.onchange = () => {this.__settingsUpdateFreqSimulate()}
        col26.appendChild(this.settingsBaselineToInterv);
        col26.appendChild(this.__settingsAddCustomLabel(this.settingsBaselineToInterv, 'Intervalo Volta'));
        col2.appendChild(col26);
        
        let col27 = document.createElement('div'); col27.style.display = 'inline-block';col27.style.width = '12%';
        this.settingsFleetSimulate = document.createElement('input');this.settingsFleetSimulate.type = 'number';this.settingsFleetSimulate.classList = 'flat-input w-auto';this.settingsFleetSimulate.min = 0;this.settingsFleetSimulate.max = 30;this.settingsFleetSimulate.value = 0;this.settingsFleetSimulate.id = 'March_settingsFleetSimulate';this.settingsFleetSimulate.placeholder = ' ';
        this.settingsFleetSimulate.onchange = () => {this.__settingsUpdateFreqSimulate()}
        col27.appendChild(this.settingsFleetSimulate);
        col27.appendChild(this.__settingsAddCustomLabel(this.settingsFleetSimulate, 'Frota (simulada)'));
        
        this.settingsFreqSimulate = document.createElement('b');this.settingsFreqSimulate.style.paddingLeft = '20px';;this.settingsFreqSimulate.innerHTML = '--';
        col27.appendChild(this.settingsFreqSimulate);
        
        col2.appendChild(col27);
        
        let col28 = document.createElement('div'); col28.style.display = 'inline-block';col28.style.width = '16%';col28.style.textAlign  = 'right';
        this.settingsBaselineSubmit = document.createElement('button');this.settingsBaselineSubmit.type = 'button';this.settingsBaselineSubmit.classList  = 'btn btn-sm btn-dark ms-2';this.settingsBaselineSubmit.innerHTML = 'Gravar'; 
        this.settingsBaselineSubmit.onclick = ()=>{
            let has_error = false
            col2.querySelectorAll('input').forEach((el)=>{ // Valida entradas nos inputs
                if(el.value == '' || parseInt(el.value) < el.min || parseInt(el.value) > el.max){
                    el.classList.add('is-invalid');
                    has_error = true;
                }
            })
            if(has_error){return false}
            for(let i = parseInt(this.settingsBaselineStart.value); i <= parseInt(this.settingsBaselineEnd.value); i++){
                this.project.route.param[i].fromMin = parseInt(this.settingsBaselineFromMin.value);
                this.project.route.param[i].toMin = parseInt(this.settingsBaselineToMin.value);
                this.project.route.param[i].fromInterv = parseInt(this.settingsBaselineFromInterv.value);
                this.project.route.param[i].toInterv = parseInt(this.settingsBaselineToInterv.value);
            }
            this.__settingsUpdateBaselines();
        }
        col28.appendChild(this.settingsBaselineSubmit);
        
        this.settingsBaselineCancel = document.createElement('button');this.settingsBaselineCancel.type = 'button';this.settingsBaselineCancel.classList  = 'btn btn-sm btn-dark ms-1';this.settingsBaselineCancel.innerHTML = 'Cancelar'; 
        this.settingsBaselineCancel.onclick = ()=>{dialog.close();dialog.remove();}
        col28.appendChild(this.settingsBaselineCancel);
        col2.appendChild(col28);
        
        this.settingsBaselineContainer = document.createElement('div');
        this.settingsBaselineTable = document.createElement('table');this.settingsBaselineTable.classList = 'table table-sm table-border text-center fs-7 mt-2';
        this.settingsBaselineContainer.appendChild(this.settingsBaselineTable);
        col2.appendChild(this.settingsBaselineContainer);
        this.__settingsUpdateBaselines();
        
        // ****
        dialog.appendChild(col1);
        dialog.appendChild(col2);
        document.body.appendChild(dialog);
        dialog.showModal();
    }
    __gridIsBlock(){
        return this.gridLocked || canvasNavActive() || appKeyMap.modal.open;        
    }
    __saveLocal(){ // Salva no localStorage o projeto
        localStorage.marchCurrentProject = JSON.stringify(this.project);
    }
    __saveUISettings(){ // Salva no localStorage algumas variaveis de interface
        localStorage.marchUiSettings = JSON.stringify({
            sumInterGaps: this.project.sumInterGaps,
            tripFromColor: this.tripFromColor,
            tripToColor: this.tripToColor,
        })
    }
    __generate(){
        this.gridLocked = true;
        let dialog = document.createElement('dialog');dialog.innerHTML = '<h5><i class="bi bi-code-slash me-1"></i> Gerar Planejamento</h5><p><b class="text-purple">Atenção</b>, ao confirmar, todo projeto em andamento <b class="text-purple">será apagado</b>,<br>este processo não pode ser desfeito.</p>';
        dialog.addEventListener('close', ()=>{this.gridLocked = false;dialog.remove()})
        let col1 = document.createElement('div');col1.style.width = '25%';col1.style.display = 'inline-block';
        let col2 = document.createElement('div');col2.style.width = '25%';col2.style.display = 'inline-block';col2.style.paddingLeft = '5px';
        let col3 = document.createElement('div');col3.style.width = '25%';col3.style.display = 'inline-block';col3.style.paddingLeft = '5px';
        let col4 = document.createElement('div');col4.style.width = '25%';col4.style.display = 'inline-block';col4.style.paddingLeft = '5px';col4.style.marginBottom = '10px';
        let fleet = document.createElement('input');fleet.type = 'number';fleet.min = '1';fleet.max = '40';fleet.classList = 'flat-input';fleet.placeholder = ' ';fleet.id = 'March_generateFleet'
        let startOperation = document.createElement('input');startOperation.type = 'time';startOperation.value = min2Hour(INICIO_OPERACAO);startOperation.classList = 'flat-input';startOperation.placeholder = ' ';startOperation.id = 'March_generateStartOperation';
        let endOperation = document.createElement('input');endOperation.type = 'time';endOperation.value = '23:00';endOperation.classList = 'flat-input';endOperation.placeholder = ' ';endOperation.id = 'March_generateEndOperation';
        let submit = document.createElement('button');submit.type = 'button';submit.classList = 'btn btn-sm btn-phanton-warning px-3 ms-4';submit.innerHTML = 'Gerar';
        submit.onclick = async () => {
            dialog.close(); // Ao fechar lock do grid sera destravado (manter para tratar esc quando foco no modal)
            this.gridLocked = true; // Adiciona trava novamente
            let loading = document.createElement('dialog');loading.innerHTML = '<div class="spinner-border text-warning me-1"></div><span style="position: relative; top: -6px; left: 8px; padding-right: 10px;">Processando, aguarde...</span>'
            loading.addEventListener('cancel', (e)=>{e.preventDefault();}) // Previne fechar modal ao precionar esc
            document.body.appendChild(loading);
            loading.showModal();
            let metrics = {
                fleet: parseInt(fleet.value),
                start: hour2Min(startOperation.value),
                end: hour2Min(endOperation.value),
                addAccess: addAccess.checked
            }
            if(metrics.fleet < 1 || !metrics.start || !metrics.end){return false;}
            let r = await this.project.generate(metrics);
            if(r){
                this.__loadStage1();
            }
            else{appNotify('danger', '<b>Erro:</b> Ao gerar planejamento')}
            loading.close();
            loading.remove();
            this.gridLocked = false;
        }
        col1.appendChild(fleet);
        col1.appendChild(this.__settingsAddCustomLabel(fleet, 'Frota'));
        col2.appendChild(startOperation);
        col2.appendChild(this.__settingsAddCustomLabel(startOperation, 'Hora Inicial'));
        col3.appendChild(endOperation);
        col3.appendChild(this.__settingsAddCustomLabel(endOperation, 'Hora Final'));
        col4.appendChild(submit);
        let addAccess = document.createElement('input');addAccess.type = 'checkbox';addAccess.checked = true;addAccess.id = 'March_generateAddAccess';
        // --
        dialog.appendChild(col1);
        dialog.appendChild(col2);
        dialog.appendChild(col3);
        dialog.appendChild(col4);
        dialog.appendChild(this.__settingsContainerSwitch(addAccess, 'Adicionar acesso aos veículos'));
        document.body.appendChild(dialog);
        dialog.showModal();

    }
    switchStage(stage=1){
        if(![1,2,3].includes(stage)){return false}
        this.project.viewStage = stage;
        if(stage == 1){this.__loadStage1()}
        else if(stage == 2){this.__loadStage2()}
        else if(stage == 3){this.__loadStage3()}
    }
    __switchStageModal(){
        if(this.gridLocked){return false}
        this.gridLocked = true;
        let dialog = document.createElement('dialog');dialog.innerHTML = '<h5 class="text-center user-select-none">Alterar Vizualização do Grid</h5>';
        dialog.addEventListener('close', ()=>{
            this.gridLocked = false;
            dialog.remove();
        })
        let btnGroup = document.createElement('div');btnGroup.classList = 'btn-group mt-3 ps-1';
        let stage1 = document.createElement('button');stage1.type = 'button';stage1.classList = 'btn btn-sm btn-phanton';stage1.innerHTML = 'Planejamento';
        stage1.onclick = ()=>{
            this.switchStage(1);
            dialog.close();
        };
        let stage2 = document.createElement('button');stage2.type = 'button';stage2.classList = 'btn btn-sm btn-phanton';stage2.innerHTML = 'Escala';
        stage2.onclick = ()=>{
            this.switchStage(2)
            dialog.close();
        };
        let stage3 = document.createElement('button');stage3.type = 'button';stage3.classList = 'btn btn-sm btn-phanton';stage3.innerHTML = 'Conclusão';
        stage3.onclick = ()=>{
            this.switchStage(3)
            dialog.close();
        };
        switch (this.project.viewStage){
            case 1: stage1.classList.add('active','disabled');break;
            case 2: stage2.classList.add('active','disabled');break;
            case 3: stage3.classList.add('active','disabled');break;
        }
        switch (this.project.viewStage){
            case 1: setTimeout(()=>{stage1.focus();}, 10);break;
            case 2: setTimeout(()=>{stage2.focus();}, 10);break;
            case 3: setTimeout(()=>{stage3.focus();}, 10);break;
        }
        btnGroup.appendChild(stage1);
        btnGroup.appendChild(stage2);
        btnGroup.appendChild(stage3);
        dialog.appendChild(btnGroup);
        document.body.appendChild(dialog);
        dialog.showModal();
    }
    __loadStage1(){ // Refaz grid
        this.scheduleFocus = null;
        this.initialFleetView = 0;
        if(this.summaryModal){this.summaryModal.remove()}
        if(this.transferAreaIcon){this.transferAreaIcon.remove()}
        this.__clearScheduleGrid();
        this.__canvasRebuild();
        if(!this.settingsShowFreqRule.checked){this.settingsShowFreqRule.click()}
        this.footer.style.display = 'block';
        this.rulerTop.style.display = 'block';
        this.__clearTripDisplay();
        this.__clearFleetDisplay();
        appKeyMap.unbindGroup(['March_stage2','March_stage3']); // Limpa atalhos exclusivos das outras viewStage
        this.__addStage1Listeners(); // Adiciona novamente atalhos para stage 1
        this.__clearGrid(); // Apaga elemento do grid e freqGrid
        this.__clearFleetLabels(); // Apaga as labels dos carros
        this.__clearSelection(); // Limpa selecao (caso exista)
        this.rulerUnit = this.defaultSettings.rulerUnit;
        this.rulerMediumUnit = this.defaultSettings.rulerMediumUnit;
        this.settingsrulerUnit.value = parseInt(this.defaultSettings.rulerUnit);
        this.settingsrulerMediumUnit.value = this.defaultSettings.rulerMediumUnit;
        this.__buildRuler();
        for(let i = 0; i < this.project.cars.length; i++){ // Recria todos os carros e viagens
            this.addFleet(this.project.cars[i], i + 1);
        }
        if(this.project.cars.length > 0){ // Se projeto ja iniciado aponta para primeira viagem do primeiro carro
            this.fleetFocus = this.project.cars[0];
            this.tripFocus = this.project.cars[0].trips[0];
            this.fleetIndex = 0;
            this.tripIndex = 0;
            this.__cursorMove();
            this.__updateTripDisplay();
            this.initialView = min2Range(this.project.getFirstTrip()[0].start) * 60; // Ajusta a visao inicial do grid para a faixa da primeira viagem do projeto
            this.canvasFit();
            this.fleetLabels[this.fleetIndex].style.color = 'var(--bs-link-color)';
            if(this.project.transferArea.length > 0)(this.__addToTransferAddLabel()) // Se existe viagem na area de transferencia, adiciona label
        }
        else{
            this.fleetFocus = null;
            this.tripFocus = null;
            this.fleetIndex = -1;
            this.tripIndex = -1;
            this.cursor.style.left = '-200px'
        }
    }
    __loadStage2(){ // Carrega interface para manipulacao das escalas
        this.initialFleetView = 0;
        this.canvas.style.top = '0px';
        this.footer.style.display = 'none';
        this.rulerTop.style.display = 'block';
        this.arrowsVisible = true;
        if(this.summaryModal){this.summaryModal.remove()}
        if(this.settingsShowFreqRule.checked){this.settingsShowFreqRule.click()}
        appKeyMap.unbindGroup(['March_stage1','March_stage3']);
        this.__addStage2Listeners(); // Adiciona novamente atalhos para stage 1
        this.__clearGrid(); // Apaga elemento do grid e freqGrid
        this.__clearFleetLabels(); // Apaga as labels dos carros
        if(this.cursor){this.cursor.remove();} // Remove o cursor
        this.rulerUnit = '2px';
        this.rulerMediumUnit = 60;
        this.settingsrulerUnit.value = 2;
        this.settingsrulerMediumUnit.value = 60;
        this.initialView = min2Range(this.project.getFirstTrip()[0].start) * 60; // Ajusta a visao inicial do grid para a faixa da primeira viagem do projeto
        this.__buildRuler();
        this.canvasFit();
        // --
        for(let i = 0; i < this.project.cars.length; i++){ // Constroi os schedules do carro
            let blocks = this.project.cars[i].getFleetSchedulesBlock(this.project.route);
            this.scheduleGrid[i] = []; // Incicia array para armazenar schedules do carro
            this.spotsGrid[i] = []; // Incicia array para armazenar elements spots
            for(let y = 0; y < blocks.length; y++){
                let fleet = document.createElement('div');fleet.style = 'position:absolute;display: flex;height: 45px;border:1px solid #495057;border-radius: 3px;'
                fleet.style.width = `calc(${this.rulerUnit} * ${blocks[y].size})`;
                fleet.style.top = `calc(${this.fleetHeight} * ${i + 1} - ${this.fleetHeight} + 10px)`;
                fleet.style.left = `calc(${this.fleetTagWidth} + (${blocks[y].start} * ${this.rulerUnit}))`;
                this.canvas.appendChild(fleet);
                // Adiciona pontos de rendicao de cada bloco
                for(let x = 0; x < blocks[y].spots.length; x++){
                    let sp = document.createElement('i');sp.style.position = 'absolute';sp.style.zIndex = '80';
                    sp.style.opacity = '10%';
                    sp.style.top = `calc(${this.fleetHeight} * ${i + 1} - 12px)`;
                    sp.style.left = `calc(${this.fleetTagWidth} + ${blocks[y].spots[x].time} * ${this.rulerUnit} - 9px)`;
                    sp.title = blocks[y].spots[x].locale.name;
                    if(blocks[y].spots[x].type == 'tripEnd'){sp.classList = 'bi bi-caret-down-fill marchSpot pt-1';}
                    else{sp.classList = 'bi bi-pin-map-fill marchSpot';}
                    sp.onclick = () => {
                        if(this.scheduleFocus == null || this.scheduleFocus[0] != i || this.scheduleFocus[2] != y){return false}
                        let r;
                        if(blocks[y].spots[x].type == 'tripEnd'){
                            r = this.project.cars[this.scheduleFocus[0]].updateSchedule(this.scheduleFocus[1],{end: blocks[y].spots[x].tripIndex, deltaEnd: 0, local: blocks[y].spots[x].locale}, blocks[y].startIndex, blocks[y].endIndex);
                        }
                        else{
                            r = this.project.cars[this.scheduleFocus[0]].updateSchedule(this.scheduleFocus[1],{end: blocks[y].spots[x].tripIndex, deltaEnd: blocks[y].spots[x].delta, local: blocks[y].spots[x].locale}, blocks[y].startIndex, blocks[y].endIndex);
                        }
                        if(r){  // Ajustar para atualizar o blocks
                            this.__cleanScheduleGrid(i);
                            this.__updateFleetSchedules(i, this.project.cars[i].getFleetSchedulesBlock(this.project.route))
                        }
                    }
                    this.canvas.appendChild(sp);
                    this.spotsGrid[i].push(sp);                    
                }
            }
            let fleet_tag = document.createElement('div');fleet_tag.style = 'position: absolute; user-select: none;';
            fleet_tag.style.top = `calc(${this.fleetHeight} * ${i + 1} - 25px)`;
            fleet_tag.style.left = `calc(${this.fleetTagWidth} + (${blocks[0].start} * ${this.rulerUnit}) - 22px)`;
            fleet_tag.innerHTML = String(i + 1).padStart(2,'0');
            this.__updateFleetSchedules(i, blocks);
            this.canvas.appendChild(fleet_tag);
        }
        this.__updateScheduleArrows(); // Adiciona arrows nas schedules
        if(this.scheduleGrid[0].length > 0){
            this.scheduleFocus = [0,0,0];
            this.scheduleGrid[0][0].style.backgroundColor = '#032830'
        }
    }
    __loadStage3(){ // Carrega interface de conclusao e resumo do projeto
        this.scheduleFocus = null;
        this.canvas.style.top = '0px';
        this.__clearGrid(); // Apaga elemento do grid e freqGrid
        this.__clearScheduleGrid();
        if(this.summaryModal){this.summaryModal.remove()}
        this.footer.style.display = 'none';
        this.__clearFleetLabels(); // Apaga as labels dos carros
        this.__clearSelection(); // Limpa selecao (caso exista)
        if(this.settingsShowFreqRule.checked){this.settingsShowFreqRule.click()}
        this.rulerTop.style.display = 'none';
        if(this.cursor){this.cursor.remove();} // Remove o cursor
        appKeyMap.unbindGroup(['March_stage1','March_stage3']); // Limpa atalhos exclusivos das outras viewStage
        // ****
        this.summaryModal = document.createElement('dialog');this.summaryModal.style = 'border: 1px solid #FFF; width: 1000px; margin-top: 80px;';
        this.summaryModal.addEventListener('cancel', (ev)=>{ev.preventDefault();})
        let summary1 = this.project.countTrips(); // Gera resumo das viagens planejadas
        let summary2 = this.project.countOperatores(); // Gera resumo de mao de obra
        let km_produtiva = parseFloat((summary1.from * this.project.route.fromExtension) + (summary1.to * this.project.route.toExtension));
        let km_improdutiva = parseFloat((summary1.accessFrom * this.project.route.metrics.fromKmAccess) + (summary1.accessTo * this.project.route.metrics.toKmAccess) + (summary1.lazyFrom * this.project.route.fromExtension) + (summary1.lazyTo * this.project.route.toExtension));
        let perc_produtiva = km_produtiva / (km_produtiva + km_improdutiva) * 100 || 0;
        let perc_improdutiva = km_improdutiva / (km_produtiva + km_improdutiva) * 100 || 0;
        this.summaryModal.innerHTML = `
        <h6>Resumo de Projeto<span id="March_summaryProjectActivateContainer" class="float-end"></span></h6><hr>
        <div style="display: flex;gap: 10px;">
            <table>
                <tbody>
                    <tr><td style="padding-right: 10px;">Frota</td><td>${this.project.cars.length}</td></tr>
                    <tr><td style="padding-right: 10px;">Viagens Produtivas</td><td>${summary1.from + summary1.to}</td></tr>
                    <tr><td style="padding-right: 10px;">Viagens Reservadas</td><td>${summary1.lazyFrom + summary1.lazyTo}</td></tr>
                    <tr><td style="padding-right: 10px;">Km planejada</td><td>${formatCur(km_produtiva + km_improdutiva)}</td></tr>
                    <tr><td colspan="2"><hr class="m-0"></td></tr>
                    <tr><td style="padding-right: 10px;text-align: right;">Ida</td><td>${summary1.from}</td></tr>
                    <tr><td style="padding-right: 10px;text-align: right;">Volta</td><td>${summary1.to}</td></tr>
                    <tr><td style="padding-right: 10px;text-align: right;">Expresso</td><td>${summary1.express}</td></tr>
                    <tr><td style="padding-right: 10px;text-align: right;">Semiexpresso</td><td>${summary1.semiexpress}</td></tr>
                    <tr><td style="padding-right: 10px;text-align: right;">Acesso</td><td>${summary1.accessFrom + summary1.accessTo}</td></tr>
                    <tr><td style="padding-right: 10px;text-align: right;">Recolhidas</td><td>${summary1.recallFrom + summary1.recallTo}</td></tr>
                </tbody>
            </table>
            <div style="flex: 1 1 0px;" class="text-center">
                <div class="d-inline-block me-3">
                    <b class="d-block mb-2">Km Produtiva</b>
                    <small class="d-block mb-3"><b>${formatCur(km_produtiva)}</b> km</small>
                    <div class="semipie animate" style="--v:${perc_produtiva.toFixed(0)};--w:120px;--b:20px;--c:var(--bs-success)">${perc_produtiva.toFixed(2)}%</div>
                </div>
                <div class="d-inline-block">
                    <b class="d-block mb-2">Km Improdutiva</b>
                    <small class="d-block mb-3"><b>${formatCur(km_improdutiva)}</b> km</small>
                    <div class="semipie animate" style="--v:${perc_improdutiva.toFixed(0)};--w:120px;--b:20px;--c:var(--bs-danger)">${perc_improdutiva.toFixed(2)}%</div>
                </div>
                <div class="d-inline-block mt-3">
                    <table class="text-start mb-2">
                        <tbody>
                        <tr><td style="padding-right: 10px;">Condutores:</td><td><b id="March_summaryWorkersQtde">${summary2.workers}</b></td></tr>
                        <tr><td style="padding-right: 10px;">H Normais:</td><td><b>${min2Hour(summary2.normalTime, false)}</b></td></tr>
                        <tr><td style="padding-right: 10px;">H Extras:</td><td><b>${min2Hour(summary2.overtime, false)}</b></td></tr>
                        </tbody>
                    </table>
                    <div id="March_summaryWorkerControls"></div>
                </div>
            </div>
            <div style="flex: 1 1 0px;" id="March_summaryBlock3Container">
                <table class="fs-7">
                    <tbody>
                        <tr><td style="padding-right: 20px;">Projeto:</td><td><b class="text-secondary">${this.project.name}</b></td></tr>
                        <tr><td style="padding-right: 20px;">Linha:</td><td><b class="text-secondary">${this.project.route.prefix}</b></td></tr>
                        <tr><td style="padding-right: 20px;">Nome:</td><td><b class="text-secondary">${this.project.route.name}</b></td></tr>
                        <tr><td style="padding-right: 20px;">Status:</td><td><b class="text-secondary" id="March_summaryActiveLabel">${this.project.active ? '<b class="text-success">Ativo</b>' : '<b class="text-secondary">Inativo</b>'}</b></td></tr>
                        <tr><td colspan="2"><hr class="my-2"></td></tr>
                        <tr><td colspan="2" class="text-secondary">${this.project.desc}</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
        <hr>
        <h6>Oferta x Demanda</h6>
        <div style="height: 200px;"><canvas id="March_summaryOD_canvas"></canvas></div>
        `;
        let summaryProjectActivate = document.createElement('input');summaryProjectActivate.type = 'checkbox';summaryProjectActivate.role = 'switch';summaryProjectActivate.id = 'March_summaryProjectActivate';summaryProjectActivate.checked = this.project.active;
        summaryProjectActivate.onclick = () => {
            this.project.active = summaryProjectActivate.checked;
            document.getElementById('March_summaryActiveLabel').innerHTML = this.project.active ? '<b class="text-success">Ativo</b>' : '<b class="text-secondary">Inativo</b>';
        }
        
        let summaryWorkerControl = document.createElement('input');summaryWorkerControl.type = 'checkbox';summaryWorkerControl.role = 'switch';summaryWorkerControl.id = 'March_summaryWorkerControl';
        summaryWorkerControl.onclick = () => {
            if(summaryWorkerControl.checked){document.getElementById('March_summaryWorkersQtde').innerHTML = summary2.workers + summary2.half;}
            else{document.getElementById('March_summaryWorkersQtde').innerHTML = summary2.workers;}
        }
        document.body.appendChild(this.summaryModal);
        
        document.getElementById('March_summaryProjectActivateContainer').appendChild(this.__settingsContainerSwitch(summaryProjectActivate, 'Ativar projeto'));
        document.getElementById('March_summaryWorkerControls').appendChild(this.__settingsContainerSwitch(summaryWorkerControl, 'Contar aproveitamentos'));
        
        let summaryProjectSumbit = document.createElement('button');summaryProjectSumbit.type = 'button';summaryProjectSumbit.classList = 'btn btn-sm btn-phanton-success mt-3 float-end fw-bold';summaryProjectSumbit.id = 'March_summaryProjectSubmit';summaryProjectSumbit.innerHTML = 'Gravar e Fechar'
        document.getElementById('March_summaryBlock3Container').appendChild(summaryProjectSumbit);
        
        let summaryProjectExport = document.createElement('button');summaryProjectExport.type = 'button';summaryProjectExport.classList = 'btn btn-sm btn-phanton mt-3 me-2 float-end fw-bold';summaryProjectExport.id = 'March_summaryProjectExport';summaryProjectExport.innerHTML = 'Exportar';
        summaryProjectExport.onclick = () => {this.project.exportJson()}
        document.getElementById('March_summaryBlock3Container').appendChild(summaryProjectExport);

        // Gera Grafico de oferta e demanda (requer chartJS)
        let od = this.project.supplyNDemand();
        let evolucao_chart = new Chart(document.getElementById('March_summaryOD_canvas'), {
            data: {
                datasets: [{
                    type: 'line',
                    label: 'Meta',
                    data: od[1].fromDemand,
                    pointBorderWidth: 4,
                    hoverBorderWidth: 8,
                    pointHitRadius: 8,
                    borderColor: '#C0504D',
                },{
                    type: 'bar',
                    label: 'Oferta',
                    data: od[1].fromSuply,
                    backgroundColor: ['#6C757D'],
                    borderColor: ['blue'],
                    maxBarThickness: 50,
                }],
                labels: Object.keys(od[0]),
            },
            options: {
                maintainAspectRatio: false,
                scales: {
                    y: {
                        // grace: 1,
                        ticks: {
                            // stepSize: 1,
                            // precision: 0
                        }
                    }
                },
                plugins: {
                    legend: {display:false, position: 'bottom'},
                    title: {
                        display: false,
                        text:'EVOLUÇÃO INDICADOR',
                        align: 'start',
                        font: {size: 13},
                        padding: {top: 6,bottom: 10}
                    },
                }
            }
        });

        
        this.summaryModal.showModal();
    }
    __scheduleAddContent(options){
        let inicio, fim;
        if(this.project.cars[options.fleet_index].schedules[options.schedule_index].deltaStart > 0){
            inicio = min2Hour(this.project.cars[options.fleet_index].trips[this.project.cars[options.fleet_index].schedules[options.schedule_index].start - 1].start + this.project.cars[options.fleet_index].schedules[options.schedule_index].deltaStart);
        }
        else{inicio = min2Hour(this.project.cars[options.fleet_index].trips[this.project.cars[options.fleet_index].schedules[options.schedule_index].start].start)}
        // ---
        if(this.project.cars[options.fleet_index].schedules[options.schedule_index].deltaEnd > 0){
            fim = min2Hour(this.project.cars[options.fleet_index].trips[this.project.cars[options.fleet_index].schedules[options.schedule_index].end].start + this.project.cars[options.fleet_index].schedules[options.schedule_index].deltaEnd - 1);
        }
        else{fim = min2Hour(this.project.cars[options.fleet_index].trips[this.project.cars[options.fleet_index].schedules[options.schedule_index].end].end)}
        let jornada = this.project.cars[options.fleet_index].getScheduleJourney(options.schedule_index);
        let previous, next;

        if(this.project.cars[options.fleet_index].schedules[options.schedule_index].next?.externalProject){ // Verifica se existe complmento de jornada em outra linha posterior a esta
            next = {name: `[ ${this.project.cars[options.fleet_index].schedules[options.schedule_index].next.externalProject} ]`}
        }
        if(this.project.cars[options.fleet_index].schedules[options.schedule_index].previous?.externalProject){ // Verifica se existe complemento de jornada em outra linha anterior a esta
            previous = {name: `[ ${this.project.cars[options.fleet_index].schedules[options.schedule_index].previous.externalProject} ]`}
        }
        return `<div><b data-type="schedule-next" class="ms-1">${previous ? previous.name + ' <i class="bi bi-arrow-left me-1"></i>': ''}</b><b data-type="schedule-name" class="me-2">${this.project.cars[options.fleet_index].schedules[options.schedule_index].name}</b>${min2Hour(jornada)}<b data-type="schedule-next" class="ms-1">${next ? '<i class="bi bi-arrow-right ms-1"></i> ' + next.name : ''}</b><div class="fs-8 text-center text-secondary">${inicio}&nbsp;&nbsp;&nbsp;${fim}</div></div>`;
    }
    __updateFleetSchedules(fleet_index, blocks){ // Refaz schedules do carro informado
        this.scheduleGrid[fleet_index].forEach((el) => {el.remove()});
        this.scheduleGrid[fleet_index] = []; // Incicia array para armazenar schedules do carro
        for(let j = 0; j < this.project.cars[fleet_index].schedules.length; j++){ // Percorre todos os schedules ja definidos e adiciona no fleet
            let metrics = this.project.cars[fleet_index].getScheduleJourney(j, true);
            let bg = this.scheduleFocus && JSON.stringify([this.scheduleFocus[0], this.scheduleFocus[1]]) == JSON.stringify([fleet_index, j]) ? '#032830' : '#1a1d20';
            let sq = document.createElement('div');sq.setAttribute('data-bs-theme', 'dark'); sq.style = `height: 43px;border-right: 2px solid #495057;text-align: center;background-color: ${bg};color: #ced4da;user-select: none; position: absolute;z-index: 50;`;
            sq.style.left = `calc(${metrics[1]} * ${this.rulerUnit} + ${this.fleetTagWidth} + 1px)`;
            sq.style.top = `calc(${this.fleetHeight} * ${fleet_index + 1} - ${this.fleetHeight} + 11px)`;
            sq.innerHTML = this.__scheduleAddContent({fleet_index: fleet_index, schedule_index: j});
            sq.style.width = `calc(${metrics[0]} * ${this.rulerUnit} - 1px)`;
            sq.onclick = () => {
                if(this.scheduleFocus){this.scheduleGrid[this.scheduleFocus[0]][this.scheduleFocus[1]].style.backgroundColor = '#1a1d20';}
                sq.style.backgroundColor = '#032830';
                let target_block = null;
                for(let x = 0; x < blocks.length; x++){ // Verifica a qual bloco a viagem pertence
                    if(project.project.cars[fleet_index].schedules[j].start >= blocks[x].startIndex && project.project.cars[fleet_index].schedules[j].end <= blocks[x].endIndex){ target_block = x}
                }
                this.scheduleFocus = [fleet_index, j, target_block];
            }
            if(this.project.cars[fleet_index].schedules[j].previous == null){
                let previous = document.createElement('i');previous.classList = 'bi bi-arrow-bar-left px-1 py-1 fs-5 pointer';previous.style.position = 'absolute';previous.style.left = '5px';previous.style.top = '3px';
                previous.onclick = (ev) => {
                    ev.stopImmediatePropagation();
                    if(!this.scheduleSelection){
                        this.scheduleSelection = [fleet_index, j, previous];
                        this.__scheduleExternalControl('previous', blocks); // Adiciona controle para externalProject
                    }
                    if(this.scheduleSelection[0] != fleet_index || this.scheduleSelection[1] != j){
                        let start = this.project.cars[fleet_index].trips[this.project.cars[fleet_index].schedules[j].start];
                        let end = this.project.cars[this.scheduleSelection[0]].trips[this.project.cars[this.scheduleSelection[0]].schedules[this.scheduleSelection[1]].end];
                        if(end.end > start.start){return false}
                        this.project.cars[this.scheduleSelection[0]].schedules[this.scheduleSelection[1]].next = {externalProject: null, fleet: fleet_index, schedule: j};
                        this.project.cars[fleet_index].schedules[j].previous = {externalProject: null, fleet: this.scheduleSelection[0], schedule: this.scheduleSelection[1]};
                        this.__updateFleetSchedules(fleet_index, blocks);
                        if(this.scheduleSelection[0] != fleet_index){this.__updateFleetSchedules(this.scheduleSelection[0], blocks);}
                        this.__updateScheduleArrows();
                        this.scheduleSelection = null;
                        this.externalControl.remove();
                    }
                }
                sq.appendChild(previous);
            }
            else{
                let previous = document.createElement('i');previous.classList = 'bi bi-x-lg px-1 py-1 fs-5 pointer';previous.style.position = 'absolute';previous.style.left = '5px';previous.style.top = '3px';
                previous.onclick = (ev)=>{
                    ev.stopImmediatePropagation();
                    let destiny;
                    if(!this.project.cars[fleet_index].schedules[j].previous.externalProject){
                        destiny = this.project.cars[fleet_index].schedules[j].previous;
                        this.project.cars[destiny.fleet].schedules[destiny.schedule].next = null;
                    }
                    if(!this.project.cars[fleet_index].schedules[j].previous.externalProject && fleet_index != destiny.fleet){
                        this.__updateFleetSchedules(destiny.fleet, blocks);
                    }
                    this.project.cars[fleet_index].schedules[j].previous = null;
                    this.__updateFleetSchedules(fleet_index, blocks);
                    this.__updateScheduleArrows();
                }
                sq.appendChild(previous);
            }
            if(this.project.cars[fleet_index].schedules[j].next == null){
                let next = document.createElement('i');next.classList = 'bi bi-arrow-bar-right px-1 py-1 fs-5 pointer';next.style.position = 'absolute';next.style.right = '5px';next.style.top = '3px';
                next.onclick = (ev) => {
                    ev.stopImmediatePropagation();
                    if(this.scheduleSelection && (this.scheduleSelection[0] != fleet_index || this.scheduleSelection[1] != j)){return null} // So seleciona caso nao existe schedule selecionada
                    if(this.scheduleSelection && this.scheduleSelection[0] == fleet_index && this.scheduleSelection[1] == j){ // Se precionar novamente cancela selecao de schedule
                        next.classList = 'bi bi-arrow-bar-right px-1 py-1 fs-5 pointer';
                        this.scheduleSelection = null;
                        this.externalControl.remove();
                    }
                    else{
                        next.classList = 'bi bi-arrow-left-right py-1 pe-1 fs-5 pointer';
                        this.scheduleSelection = [fleet_index, j, next];
                        this.__scheduleExternalControl('next', blocks); // Adiciona controle para externalProject
                    }
                }
                sq.appendChild(next);
            }
            else{
                let next = document.createElement('i');next.classList = 'bi bi-x-lg px-1 py-1 fs-5 pointer';next.style.position = 'absolute';next.style.right = '5px';next.style.top = '3px';
                next.onclick = (ev) => { // Remove o apontamento de next do alvo e o previous do correlato
                    ev.stopImmediatePropagation();
                    let destiny;
                    if(!this.project.cars[fleet_index].schedules[j].next.externalProject){
                        destiny = this.project.cars[fleet_index].schedules[j].next;
                        this.project.cars[destiny.fleet].schedules[destiny.schedule].previous = null;
                    }
                    if(!this.project.cars[fleet_index].schedules[j].next.externalProject && fleet_index != destiny.fleet){
                        this.__updateFleetSchedules(destiny.fleet, blocks);
                    }
                    this.project.cars[fleet_index].schedules[j].next = null;
                    this.__updateFleetSchedules(fleet_index, blocks);
                    this.__updateScheduleArrows();
                }
                sq.appendChild(next);
            }
            this.canvas.appendChild(sq);
            this.scheduleGrid[fleet_index].push(sq);
        }
        // Se existe viagens sem escala no bloco, insere bloco empty
        for(let i = 0; i < blocks.length; i++){
            if(blocks[i].emptyStart == undefined){continue}
            let sq = document.createElement('div');sq.style = `height: 43px;text-align: center;user-select: none; position: absolute;z-index: 50; padding-top: 5px`;
            sq.setAttribute('data-type', 'emptySchedule');
            let left;
            if(blocks[i].deltaEnd == 0){left = this.project.cars[fleet_index].trips[blocks[i].emptyStart].start}
            else{
                left = this.project.cars[fleet_index].trips[blocks[i].emptyStart - 1].start + blocks[i].deltaEnd;
            }
            sq.style.left = `calc(${left} * ${this.rulerUnit} + ${this.fleetTagWidth} + 1px)`;
            sq.style.top = `calc(${this.fleetHeight} * ${fleet_index + 1} - ${this.fleetHeight} + 11px)`;
            sq.innerHTML = '<i class="bi bi-plus-lg fs-5 text-secondary"></i>';
            
            let jornada = blocks[i].start + blocks[i].size - left;
            sq.style.width = `calc(${jornada} * ${this.rulerUnit} - 2px)`;
            sq.onclick = () => {
                if(this.scheduleFocus){this.scheduleGrid[this.scheduleFocus[0]][this.scheduleFocus[1]].style.backgroundColor = '#1a1d20';}
                let r = this.project.addSchedule(fleet_index, {start: blocks[i].emptyStart, end: blocks[i].endIndex, deltaEnd: 0, deltaStart: 0, next: null, previous: null})
                this.scheduleFocus = [fleet_index, r, i];
                this.__updateFleetSchedules(fleet_index, this.project.cars[fleet_index].getFleetSchedulesBlock(this.project.route))
            }
            this.canvas.appendChild(sq);
            this.scheduleGrid[fleet_index].push(sq);
            this.scheduleGrid[fleet_index].sort((a, b) => a.offsetLeft > b.offsetLeft ? 1 : -1);
        }
    }
    __updateScheduleArrows(){
        for(let i in this.scheduleArrowsGrid){ // Apaga todos as arrows do canvas
            this.scheduleArrowsGrid[i].forEach((el)=>{el.destroy();});
        }
        for(let i = 0; i < this.project.cars.length; i++){ // Monta arrows
            this.scheduleArrowsGrid[i] = []; // Reinicia dicionario
            for(let j = 0; j < this.project.cars[i].schedules.length; j++){
                if(this.project.cars[i].schedules[j].next && !this.project.cars[i].schedules[j].next.externalProject){
                    let arrow = new jsELConnector({
                        from: this.scheduleGrid[i][j],
                        to: this.scheduleGrid[this.project.cars[i].schedules[j].next.fleet][this.project.cars[i].schedules[j].next.schedule],
                        container: this.canvas,               
                    });
                    this.scheduleArrowsGrid[i].push(arrow);
                }
            }
        }
    }
    __scheduleExternalControl(position, blocks){ // Exibe modal para adicao de externalProject na schedule
        let el = this.scheduleGrid[this.scheduleSelection[0]][this.scheduleSelection[1]];
        this.externalControl = document.createElement('button');this.externalControl.type = 'button';this.externalControl.classList = 'btn btn-sm btn-phanton'; this.externalControl.innerHTML = 'Externo';
        this.externalControl.style = `position: absolute; top: ${el.offsetTop + 5}px;left: ${el.offsetLeft + el.offsetWidth + 5}px;z-index: 200;`;
        this.externalControl.onclick = () => {
            this.gridLocked = true;
            let modal = document.createElement('dialog');modal.style.width = '200px';
            modal.addEventListener('close', ()=>{
                this.gridLocked = false;
                if(position == 'previous'){
                    this.externalControl.remove();
                    this.scheduleSelection = null;
                }
                modal.remove();
            })
            
            let name = document.createElement('input');name.type = 'text';name.classList = 'flat-input';
            modal.appendChild(name);modal.appendChild(this.__settingsAddCustomLabel(name, 'Nome planejamento'));
            
            let tabela = document.createElement('input');tabela.type = 'text';tabela.classList = 'flat-input';
            modal.appendChild(tabela);modal.appendChild(this.__settingsAddCustomLabel(tabela, 'Tabela'));
            
            let jornada = document.createElement('input');jornada.type = 'time';jornada.classList = 'flat-input';
            modal.appendChild(jornada);modal.appendChild(this.__settingsAddCustomLabel(jornada, 'Jornada'));
            
            let submit = document.createElement('button');submit.type = 'button';submit.classList = 'btn btn-sm btn-dark float-end mt-1';submit.innerHTML = 'Gravar';
            submit.onclick = ()=>{
                if(name.value.trim() == '' || name.value.trim().length < 3){name.classList.add('is-invalid')}else{name.classList.remove('is-invalid')};
                if(tabela.value.trim() == '' || tabela.value.trim().length < 2){tabela.classList.add('is-invalid')}else{tabela.classList.remove('is-invalid')};
                if(jornada.value.trim() == '' || jornada.value.trim().length < 5){jornada.classList.add('is-invalid')}else{jornada.classList.remove('is-invalid')};
                let s = {externalProject: `${name.value}:${tabela.value}`, fleet: null, schedule: null, journey: hour2Min(jornada.value)}
                if(!s.journey){jornada.classList.add('is-invalid')}
                if(modal.querySelectorAll('.is-invalid').length > 0){return false}
                this.project.cars[this.scheduleSelection[0]].schedules[this.scheduleSelection[1]][position] = s;
                this.__updateFleetSchedules(this.scheduleSelection[0], blocks);
                this.scheduleSelection = null;
                this.gridLocked = false;
                modal.remove();
                this.externalControl.remove();
            }
            modal.appendChild(submit);
            
            document.body.appendChild(modal);
            modal.showModal();
        }
        this.canvas.appendChild(this.externalControl);
        if(position == 'previous'){
            this.externalControl.style.display == 'none';
            this.externalControl.click();
        }
    }
    __toggleArrowVisibility(){
        this.arrowsVisible = this.arrowsVisible == false;
        let v = this.arrowsVisible ? 'visible' : 'hidden';
        for(let i in this.scheduleArrowsGrid){
            this.scheduleArrowsGrid[i].forEach((el) => {el.setVisibility(v)});
        }
    }
    __cleanScheduleGrid(fleet_index){ // Limpa as escalas do carro informado (nao remove nem carro nem spots)
        for(let i in this.scheduleGrid[fleet_index]){
            this.scheduleGrid[fleet_index][i].remove();
    }}
    uploadProject(){
        let loadInput = document.createElement('input');loadInput.type = 'file';loadInput.setAttribute('accept', '.json');loadInput.style.display = 'none';
        let obj = this;
        loadInput.onchange = (ev) => {
            ev.stopPropagation();
            let fr = new FileReader();
            fr.onload = (function(){
                let r = JSON.parse(fr.result);
                if(r.version != obj.project.version){appNotify('warning', `O arquivo carregado <code>${r.version}</code> tem versão diferente da aplicação <code>${obj.project.version}</code>, o que pode gerar incompatibilidade e/ou erros de execução.`, false)}
                obj.project.load(JSON.parse(fr.result));
                obj.project.viewStage = 1;
                obj.switchStage(1);
            });
            fr.readAsText(loadInput.files[0]);
        }
        loadInput.click();
        loadInput.remove();
    }
    __addGeneralListeners(){ // Cria atalhos de teclado gerais do projeto (indiferente do viewStage)
        appKeyMap.unbind('lTFF'); // Remove atalho para dar reload em pagina (se projeto nao salvo iria perder todo progresso)
        appKeyMap.bind({group: 'March_general', key: 'arrowright', ctrl: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Rolar para direita', desc: 'Move grid para direita (02 horas)', run: ()=>{this.canvasMove(120)}})
        appKeyMap.bind({group: 'March_general', key: 'arrowleft', ctrl: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Rolar para esquerda', desc: 'Move grid para esquerda (02 horas)', run: ()=>{this.canvasMove(-120)}})
        appKeyMap.bind({group: 'March_general', key: 'f5', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Desfazer alterações', desc: 'Recarrega ultimo status salvo do projeto', run: (ev)=>{}}) // Apenas entrada para exibicao no keymap
        appKeyMap.bind({group: 'March_general', key: 'f8', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Altera Visualização', desc: 'Exibe modal para alteração da visualização', run: (ev)=>{ev.preventDefault();this.__switchStageModal()}})
        appKeyMap.bind({group: 'March_general', key: '1', alt: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Exibe Grid', desc: 'Altera visualização para o Grid', run: ()=>{this.switchStage(1)}})
        appKeyMap.bind({group: 'March_general', key: '2', alt: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Exibe Escalas', desc: 'Altera visualização para Escalas', run: ()=>{this.switchStage(2)}})
        appKeyMap.bind({group: 'March_general', key: '3', alt: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Exibe Resumo', desc: 'Altera visualização para resumo', run: ()=>{this.switchStage(3)}})
        appKeyMap.bind({group: 'March_general', key: 'g', alt:true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Salva prévia', desc: 'Salva projeto em armazenamento local', run: ()=>{
            this.__saveLocal();
            appNotify('success', '<i class="bi bi-check2-square me-2"></i> Prévia salva localmente')
        }})
        appKeyMap.bind({group: 'March_general', key: 'l', ctrl: true, shift:true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Limpa projeto', desc: 'Limpa projeto atual', run: ()=>{
            localStorage.removeItem('marchCurrentProject');
            this.project.reset();
            this.__loadStage1();
            this.settingsSumIntervGaps.checked = this.project.sumInterGaps;
            appNotify('warning', '<b class="me-1">Info:</b> Projeto reiniciado.');
        }})
    }
    __addStage1Listeners(){ // Cria atalhos de teclado para manipulação do diagrama de marcha
        appKeyMap.bind({group: 'March_stage1', key: ';', alt: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Novo carro', desc: 'Insere carro no projeto', run: ()=>{if(this.__gridIsBlock()){return false};this.addFleet()}})
        appKeyMap.bind({group: 'March_stage1', key: '.', alt: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Adicionar Viagem', desc: 'Insere viagem ao final do carro', run: ()=>{
            if(this.__gridIsBlock() || !this.tripFocus){return false}
            if(this.project.cars[this.fleetIndex].schedules.length > 0){
                this.__modalConfirmationChangeProject(()=>{
                    this.project.cars[this.fleetIndex].schedules = [];
                    this.addTrip();
                })
            }
            else{this.addTrip();}
        }})
        appKeyMap.bind({group: 'March_stage1', key: '.', alt: true, ctrl: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Adicionar Viagem AS', desc: 'Insere viagem para carro informando inicio', run: ()=>{
            if(this.__gridIsBlock() || !this.tripFocus){return false;}
            if(this.project.cars[this.fleetIndex].schedules.length > 0){
                this.__modalConfirmationChangeProject(()=>{
                    this.project.cars[this.fleetIndex].schedules = [];
                    this.addTripAt()
                })
            }
            else{this.addTripAt();}
        }})

        appKeyMap.bind({group: 'March_stage1', key: 'arrowright', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Navegar próxima viagem', desc: 'Move foco para próxima viagem do carro', run: (ev)=>{
            if(!this.tripFocus || this.__gridIsBlock()){return false}
            ev.preventDefault();
            if(this.project.cars[this.fleetIndex].trips.length > this.tripIndex + 1){
                this.tripIndex++;
                this.tripFocus = this.project.cars[this.fleetIndex].trips[this.tripIndex];
                this.__cursorMove();
                this.__updateTripDisplay();
                
            }
        }})
        appKeyMap.bind({group: 'March_stage1', key: 'arrowleft', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Navegar viagem anterior', desc: 'Move foco para viagem anterior do carro', run: (ev)=>{
            if(!this.tripFocus || this.__gridIsBlock()){return false}
            ev.preventDefault();
            if(this.tripIndex > 0){
                this.tripIndex--;
                this.tripFocus = this.project.cars[this.fleetIndex].trips[this.tripIndex];
                this.__cursorMove();
                this.__updateTripDisplay();
            }
        }})
        appKeyMap.bind({group: 'March_stage1', key: 'arrowdown', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Navegar próximo carro', desc: 'Move foco para próximo carro', run: (ev)=>{
            if(!this.tripFocus || this.__gridIsBlock()){return false}
            ev.preventDefault();
            this.__clearFleetDisplay(); // Ao alterar de carro, limpa o resumo (caso exibido)
            if(this.project.cars.length > this.fleetIndex + 1){
                this.fleetLabels[this.fleetIndex].style.color = 'inherit';
                this.fleetIndex++;
                this.fleetLabels[this.fleetIndex].style.color = 'var(--bs-link-color)';
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
        appKeyMap.bind({group: 'March_stage1', key: 'arrowup', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Navegar carro anterior', desc: 'Move foco para carro anterior', run: (ev) => {
            if(!this.tripFocus || this.__gridIsBlock()){return false}
            ev.preventDefault();
            this.__clearFleetDisplay(); // Ao alterar de carro, limpa o resumo (caso exibido)
            if(this.fleetIndex > 0){
                this.fleetLabels[this.fleetIndex].style.color = 'inherit';
                this.fleetIndex--;
                this.fleetLabels[this.fleetIndex].style.color = 'var(--bs-link-color)';
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
        appKeyMap.bind({group: 'March_stage1', key: '/', alt: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Régua frequência', desc: 'Exibe/oculta régua de frequência', run: ()=>{this.settingsShowFreqRule.click()}})
        appKeyMap.bind({group: 'March_stage1', key: '+', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Viagem Plus', desc: 'Aumenta 1 min ao final da viagem e nas posteriores', run: (ev)=>{if(!this.tripFocus || this.__gridIsBlock()){return false}ev.preventDefault();this.plus();}})
        appKeyMap.bind({group: 'March_stage1', key: '+', shift: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Viagem Plus (single)', desc: 'Aumenta 1 minuto na viagem', run: ()=>{if(!this.tripFocus || this.__gridIsBlock()){return false}this.plus(false)}})
        appKeyMap.bind({group: 'March_stage1', key: '-', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Viagem Sub', desc: 'Subtrai 1 min ao final da viagem e nas posteriores', run: (ev)=>{if(!this.tripFocus || this.__gridIsBlock()){return false}ev.preventDefault();this.sub();}})
        appKeyMap.bind({group: 'March_stage1', key: '-', shift: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Viagem Sub (single)', desc: 'Subtrai 1 minuto na viagem', run: ()=>{if(!this.tripFocus || this.__gridIsBlock()){return false}this.sub(false)}})
        appKeyMap.bind({group: 'March_stage1', key: ' ', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Atrasar', desc: 'Atrasa inicio em 1 minuto, move posteriores', run: (ev)=>{if(!this.tripFocus || this.__gridIsBlock()){return false}ev.preventDefault();this.advance();}})
        appKeyMap.bind({group: 'March_stage1', key: ' ', shift: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Atrasar (single)', desc: 'Aumenta 1 min no inicio da viagem', run: ()=>{if(!this.tripFocus || this.__gridIsBlock()){return false}
            this.moveStart();
            this.__cursorMove();
        }})
        appKeyMap.bind({group: 'March_stage1', key: 'backspace', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Adiantar', desc: 'Adianta em 1 min inicio da viagem e nas posteriores', run: (ev)=>{if(!this.tripFocus || this.__gridIsBlock()){return false}ev.preventDefault();this.back()}})
        appKeyMap.bind({group: 'March_stage1', key: 'backspace', shift: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Adiantar (single)', desc: 'Adianta inicio da viagem em 1 min', run: ()=>{if(!this.tripFocus || this.__gridIsBlock()){return false}this.backStart()}})
        appKeyMap.bind({group: 'March_stage1', key: 'r', alt: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Adicionar Intervalo', desc: 'Adiciona intervalo ate a próxima viagem', run: ()=>{
            if(this.__gridIsBlock() || !this.tripFocus){return false;}
            if(this.project.cars[this.fleetIndex].schedules.length > 0){
                this.__modalConfirmationChangeProject(()=>{
                    this.project.cars[this.fleetIndex].schedules = [];
                    this.addInterv();
                    this.__updateTripDisplay();
                })
            }
            else{this.addInterv();this.__updateTripDisplay();}
        }})
        appKeyMap.bind({group: 'March_stage1', key: 'a', alt: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Adicionar Acesso', desc: 'Adiciona acesso na viagem', run: ()=>{if(!this.tripFocus || this.__gridIsBlock()){return false}this.addAccess();}})
        appKeyMap.bind({group: 'March_stage1', key: 'a', ctrl: true, shift:true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Acesso à todos', desc: 'Adiciona acesso para todos os carros', run: ()=>{
            if(!this.tripFocus || this.__gridIsBlock()){return false}
            let increment = true; // addAccess por padrao incrementa o this.tripIndex, deve incrementar somente para o carro em foco
            for(let i = 0; i < this.project.cars.length; i++){
                let r = this.addAccess(i, 0, increment); // Tenta adicionar recolhe na ultima viagem de cada carro
                increment = false;
                if(r){this.project.cars[i].schedules = [];} // Limpa schedules do carro
            }
        }})
        appKeyMap.bind({group: 'March_stage1', key: 'p', alt: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Encerrar turno', desc: 'Encerra turno na viagem', run: ()=>{
            if(this.__gridIsBlock() || !this.tripFocus){return false;}
            if(this.project.cars[this.fleetIndex].schedules.length > 0){
                this.__modalConfirmationChangeProject(()=>{
                    this.project.cars[this.fleetIndex].schedules = [];
                    this.tripShut();
                    this.__updateTripDisplay();
                })
            }
            else{this.tripShut();this.__updateTripDisplay();}
        }})
        appKeyMap.bind({group: 'March_stage1', key: 'e', alt: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Adicionar Recolhe', desc: 'Adiciona recolhe na viagem', run: ()=>{
            if(this.__gridIsBlock() || !this.tripFocus){return false;}
            if(this.project.cars[this.fleetIndex].schedules.length > 0){
                this.__modalConfirmationChangeProject(()=>{
                    this.project.cars[this.fleetIndex].schedules = [];
                    this.addRecall();
                    this.__updateTripDisplay();
                })
            }
            else{this.addRecall();this.__updateTripDisplay();}
        }})
        appKeyMap.bind({group: 'March_stage1', key: 'e', ctrl: true, shift: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Recolher todos', desc: 'Recolhe todos os carros', run: (ev)=>{
            if(!this.tripFocus || this.__gridIsBlock()){return false}
            for(let i = 0; i < this.project.cars.length; i++){
                let r = this.addRecall(i, this.project.cars[i].trips.length - 1); // Tenta adicionar recolhe na ultima viagem de cada carro
                if(r){this.project.cars[i].schedules = [];} // Limpa schedules do carro
            }
        }})
        appKeyMap.bind({group: 'March_stage1', key: 'pagedown', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Próxima viagem sentido', desc: 'Foca próxima viagem no mesmo sentido', run: (ev)=>{if(!this.tripFocus || this.__gridIsBlock()){return false}ev.preventDefault();this.nextTrip();}})
        appKeyMap.bind({group: 'March_stage1', key: 'pageup', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Viagem anterior sentido', desc: 'Foca viagem anterior no mesmo sentido', run: (ev)=>{if(!this.tripFocus || this.__gridIsBlock()){return false}ev.preventDefault();this.previousTrip();}})
        appKeyMap.bind({group: 'March_stage1', key: 'home', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Primeira viagem carro', desc: 'Foca primeira viagem do carro', run: (ev)=>{
            if(!this.tripFocus || this.__gridIsBlock()){return false}
            ev.preventDefault();
            this.tripIndex = 0;
            this.tripFocus = this.project.cars[this.fleetIndex].trips[this.tripIndex];
            this.__cursorMove();
            this.__updateTripDisplay();
        }})
        appKeyMap.bind({group: 'March_stage1', key: 'end', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Ultima viagem carro', desc: 'Foca ultima viagem do carro', run: (ev)=>{
            if(!this.tripFocus || this.__gridIsBlock()){return false}
            ev.preventDefault();
            this.tripIndex = this.project.cars[this.fleetIndex].trips.length - 1;
            this.tripFocus = this.project.cars[this.fleetIndex].trips[this.tripIndex];
            this.__cursorMove();
            this.__updateTripDisplay();
        }})
        appKeyMap.bind({group: 'March_stage1', key: 'home', ctrl: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Primeira viagem sentido', desc: 'Foca primeira viagem no mesmo sentido', run: ()=>{
            if(!this.tripFocus || this.__gridIsBlock()){return false}
            let resp = this.project.getFirstTrip(this.tripFocus.way);
            if(resp){
                this.fleetLabels[this.fleetIndex].style.color = 'inherit';
                this.tripFocus = resp[0];
                this.fleetIndex = resp[1];
                this.tripIndex = resp[2];
                this.fleetLabels[this.fleetIndex].style.color = 'var(--bs-link-color)';
                this.__cursorMove();
                this.__updateTripDisplay();
            }
        }})
        appKeyMap.bind({group: 'March_stage1', key: 'end', ctrl: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Ultima viagem sentido', desc: 'Foca ultima viagem no mesmo sentido', run: ()=>{
            if(!this.tripFocus || this.__gridIsBlock()){return false}
            let resp = this.project.getLastTrip(this.tripFocus.way);
            if(resp){
                this.fleetLabels[this.fleetIndex].style.color = 'inherit';
                this.tripFocus = resp[0];
                this.fleetIndex = resp[1];
                this.tripIndex = resp[2];
                this.fleetLabels[this.fleetIndex].style.color = 'var(--bs-link-color)';
                this.__cursorMove();
                this.__updateTripDisplay();
            }
        }})
        appKeyMap.bind({group: 'March_stage1', key: 'arrowright', shift: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Selecionar a direita', desc: 'Arrasta seleção para direita', run: ()=>{this.__addToSelection();}})
        appKeyMap.bind({group: 'March_stage1', key: 'arrowleft', shift: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Voltar seleção', desc: 'Diminui da seleção ultima viagem', run: ()=>{this.__subToSelection();}})
        appKeyMap.bind({group: 'March_stage1', key: 'l', alt: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Limpar seleção', desc: 'Limpa a seleção de viagens', run: ()=>{this.__clearSelection();}})
        appKeyMap.bind({group: 'March_stage1', key: 'v', ctrl: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Mover viagens', desc: 'Move viagens selecionadas', run: ()=>{
            if(this.__gridIsBlock() || this.startSelection < 0){return false;}
            if(this.project.cars[this.fleetSelection].schedules.length > 0 || this.project.cars[this.fleetIndex].schedules.length > 0){
                this.__modalConfirmationChangeProject(()=>{
                    this.project.cars[this.fleetSelection].schedules = [];
                    this.project.cars[this.fleetIndex].schedules = [];
                    this.moveTrips()
                })
            }
            else{this.moveTrips()}
        }})
        appKeyMap.bind({group: 'March_stage1', key: 'x', ctrl: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Recortar viagens', desc: 'Move viagens selecionadas para area de transferência', run: ()=>{
            if(this.__gridIsBlock() || this.startSelection < 0 || this.project.transferArea.length > 0){return false;}
            if(this.project.cars[this.fleetSelection].schedules.length > 0){
                this.__modalConfirmationChangeProject(()=>{
                    this.project.cars[this.fleetSelection].schedules = [];
                    this.addToTransferArea()
                })
            }
            else{this.addToTransferArea()}
        }})
        appKeyMap.bind({group: 'March_stage1', key: 'v', ctrl: true, shift: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Cola área de transf ', desc: 'Cola todas as viagens da área de transferência', run: ()=>{
            if(this.project.transferArea.length == 0){return false}
            this.pasteTransfer()
        }})
        appKeyMap.bind({group: 'March_stage1', key: ' ', ctrl: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Centralizar', desc: 'Centraliza grid na viagem em foco', run: ()=>{
            if(this.tripFocus){
                this.initialView = this.tripFocus.start - 60; // Ajusta o view inicial para uma hora antes da viagem em foco
                this.__buildRuler();
                this.canvasFit();
            }
        }})
        appKeyMap.bind({group: 'March_stage1', key: 'delete', ctrl:true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Remover viagem', desc: 'Remove viagem', run: ()=>{
            if(this.__gridIsBlock() || !this.tripFocus){return false;}
            if(this.project.cars[this.fleetIndex].schedules.length > 0){
                this.__modalConfirmationChangeProject(()=>{
                    this.project.cars[this.fleetIndex].schedules = [];
                    this.removeTrip(false)
                })
            }
            else{this.removeTrip(false)}
        }})
        appKeyMap.bind({group: 'March_stage1', role: 'removeFleet', key: 'delete', ctrl:true, shift: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Remove viagens/carro', desc: 'Remove viagem e posteriores, se 1a viag apaga carro', run: ()=>{
            if(this.__gridIsBlock() || !this.tripFocus){return false;}
            if(this.tripIndex == 0){this.removeFleet()}
            else if(this.project.cars[this.fleetIndex].schedules.length > 0){
                this.__modalConfirmationChangeProject(()=>{
                    this.project.cars[this.fleetIndex].schedules = [];
                    this.removeTrip();
                })
            }
            else{this.removeTrip()} 
        }})
        appKeyMap.bind({group: 'March_stage1', key: 't', alt:true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Legenda viagens', desc: 'Exibe legenda dos tipos de viagens', run: ()=>{this.__showTripPatterns()}})
        appKeyMap.bind({group: 'March_stage1', key: 'enter', alt:true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Recalcula resumo', desc: 'Exibe resumo do carro em foco', run: ()=>{this.__updateFleetDisplay()}})
        appKeyMap.bind({group: 'March_stage1', key: 'f2', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Métricas da linha', desc: 'Exibe controles de métricas da linha', run: (ev)=>{ev.preventDefault();this.__showRouteMetrics()}})
        appKeyMap.bind({group: 'March_stage1', key: 'f4', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Gerador', desc: 'Exibe modal para geração de planejamento', run: (ev)=>{ev.preventDefault();this.__generate()}})
        appKeyMap.bind({group: 'March_stage1', key: 'backspace', ctrl: true, shift:true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Restaurar Configurações', desc: 'Restaura configurações padrão de interface', run: ()=>{
            localStorage.removeItem('marchUiSettings');
            for(let key in this.defaultSettings){
                this[key] = this.defaultSettings[key]; // Retorna valor padrao a variavel de ambiente
                this[`settings${key}`].value = this.defaultSettings[key]; // Retorna valor padrao ao controle no painel de configuracoes
            }
            this.__buildRuler(); // Refaz Regua
            this.__loadStage1(false); // Ajusta viagens
            this.canvasFit(); // Centraliza canvas na viagem em foco
        }})
    }
    __addStage2Listeners(){ // Cria atalhos de teclado para manipulação do diagrama de marcha
        appKeyMap.bind({group: 'March_stage2', key: 'arrowright', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Focar próxima escala', desc: 'Seleciona próxima escala', run: (ev)=>{
            if(this.__gridIsBlock() || !this.scheduleFocus){return false}
            ev.preventDefault();
            if(this.scheduleGrid[this.scheduleFocus[0]].length - 1 > this.scheduleFocus[1]){
                this.scheduleGrid[this.scheduleFocus[0]][this.scheduleFocus[1]].style.backgroundColor = this.scheduleGrid[this.scheduleFocus[0]][this.scheduleFocus[1]].dataset.type == 'emptySchedule' ? '' : '#1a1d20'; // Altera visual da escala em foco atual
                this.scheduleGrid[this.scheduleFocus[0]][this.scheduleFocus[1] + 1].style.backgroundColor = '#032830'; // Altera visual da proxima escala
                this.scheduleFocus = [this.scheduleFocus[0], this.scheduleFocus[1] + 1, this.scheduleFocus[2]];
            }
        }})
        appKeyMap.bind({group: 'March_stage2', key: 'arrowleft', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Focar escala anterior', desc: 'Seleciona escala anterior', run: (ev)=>{
            if(this.__gridIsBlock() || !this.scheduleFocus){return false}
            ev.preventDefault();
            if(this.scheduleFocus[1] > 0){
                this.scheduleGrid[this.scheduleFocus[0]][this.scheduleFocus[1]].style.backgroundColor = this.scheduleGrid[this.scheduleFocus[0]][this.scheduleFocus[1]].dataset.type == 'emptySchedule' ? '' : '#1a1d20'; // Altera visual da escala em foco atual
                this.scheduleGrid[this.scheduleFocus[0]][this.scheduleFocus[1] - 1].style.backgroundColor = '#032830'; // Altera visual da proxima escala
                this.scheduleFocus = [this.scheduleFocus[0], this.scheduleFocus[1] - 1, this.scheduleFocus[2]];
            }
        }})
        appKeyMap.bind({group: 'March_stage2', key: 'arrowdown', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Focar próximo carro', desc: 'Seleciona escala do próximo carro', run: (ev)=>{
            if(this.__gridIsBlock() || !this.scheduleFocus){return false}
            ev.preventDefault();
            if(this.scheduleGrid[this.scheduleFocus[0] + 1]){
                this.scheduleGrid[this.scheduleFocus[0]][this.scheduleFocus[1]].style.backgroundColor = this.scheduleGrid[this.scheduleFocus[0]][this.scheduleFocus[1]].dataset.type == 'emptySchedule' ? '' : '#1a1d20'; // Altera visual da escala em foco atual
                this.scheduleGrid[this.scheduleFocus[0] + 1][0].style.backgroundColor = '#032830'; // Altera visual da proxima escala
                this.scheduleFocus = [this.scheduleFocus[0] + 1, 0 , 0];
            }
        }})
        appKeyMap.bind({group: 'March_stage2', key: 'arrowup', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Focar carro anterior', desc: 'Seleciona escala do carro anterior', run: (ev)=>{
            if(this.__gridIsBlock() || !this.scheduleFocus){return false}
            ev.preventDefault();
            if(this.scheduleFocus[0] > 0){
                this.scheduleGrid[this.scheduleFocus[0]][this.scheduleFocus[1]].style.backgroundColor = this.scheduleGrid[this.scheduleFocus[0]][this.scheduleFocus[1]].dataset.type == 'emptySchedule' ? '' : '#1a1d20'; // Altera visual da escala em foco atual
                this.scheduleGrid[this.scheduleFocus[0] - 1][0].style.backgroundColor = '#032830'; // Altera visual da proxima escala
                this.scheduleFocus = [this.scheduleFocus[0] - 1, 0 , 0];
            }
        }})
        appKeyMap.bind({group: 'March_stage2', key: 'arrowdown', ctrl: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Rolar para baixo', desc: 'Move grid para baixo', run: ()=>{
            if(this.__gridIsBlock()){return false}
            if(this.canvas.offsetTop > (this.maxCarsVisible - this.project.cars.length) * 45){
                this.canvas.style.top = `calc(${this.canvas.style.top} - 45px)`;
            }
        }})
        appKeyMap.bind({group: 'March_stage2', key: 'arrowup', ctrl: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Rolar para cima', desc: 'Move grid para cima', run: ()=>{
            if(this.__gridIsBlock()){return false}
            if(this.canvas.offsetTop < 0){
                this.canvas.style.top = `calc(${this.canvas.style.top} + 45px)`;
            }
        }})
        appKeyMap.bind({group: 'March_stage2', key: 'enter', alt: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Gerar escala', desc: 'Inicia escala no espaço em foco', run: (ev)=>{
            ev.preventDefault();
            if(this.__gridIsBlock() || !this.scheduleFocus){return false}
            this.scheduleGrid[this.scheduleFocus[0]][this.scheduleFocus[1]].click();
        }})
        appKeyMap.bind({group: 'March_stage2', key: '/', alt: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Conexões Escalas', desc: 'Exibe ou oculta conexões entre escalas', run: ()=>{
            if(this.__gridIsBlock()){return false}
            this.__toggleArrowVisibility();
        }})
        appKeyMap.bind({group: 'March_stage2', key: 'f4', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Auto Gerar tabelas', desc: 'Inicia tabela de todos os carros', run: (ev)=>{
            ev.preventDefault();
            if(this.__gridIsBlock() || this.project.cars.length == 0){return false}
            this.project.autoGenerateSchedules();
            this.scheduleFocus = [0, 0, 0]; // Seleciona primeira viagem do primeiro carro
            for(let i = 0; i < this.project.cars.length; i++){
                this.__updateFleetSchedules(i, this.project.cars[i].getFleetSchedulesBlock(this.project.route))
            }
            this.__updateScheduleArrows();
        }})
        appKeyMap.bind({group: 'March_stage2', key: 'f2', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Renomear tabela', desc: 'Renomear tabela', run: (ev)=>{
            ev.preventDefault();
            if(this.__gridIsBlock() || !this.scheduleFocus || this.scheduleGrid[this.scheduleFocus[0]][this.scheduleFocus[1]].dataset.type == 'emptySchedule'){return false}
            this.gridLocked = true;
            let modal = document.createElement('dialog');modal.innerHTML = '<h6>Renomear Tabela</h6>';modal.style.position = 'relative';
            modal.addEventListener('close', ()=>{modal.remove(); this.gridLocked = false;})
            let nameInput = document.createElement('input');nameInput.type = 'text';nameInput.classList = 'flat-input';nameInput.id = 'March_renameScheduleName';
            nameInput.value = this.project.cars[this.scheduleFocus[0]].schedules[this.scheduleFocus[1]].name;
            nameInput.onfocus = ()=>{nameInput.select()}
            nameInput.addEventListener('keydown', (ev)=>{if(ev.key == 'Enter'){submit.click()}})
            let submit = document.createElement('button');submit.type = 'button';submit.classList = 'btn btn-sm btn-phanton position-absolute';submit.innerHTML = 'Gravar';submit.style = 'top:56px; right: 10px;'
            submit.onclick = () => {
                if(nameInput.value == '' || nameInput.value.length < 2){nameInput.classList.add('is-invalid'); return false;}
                this.project.cars[this.scheduleFocus[0]].schedules[this.scheduleFocus[1]].name = nameInput.value;
                this.scheduleGrid[this.scheduleFocus[0]][this.scheduleFocus[1]].querySelector('[data-type=schedule-name]').innerHTML = nameInput.value;
                modal.close();
            }
            modal.appendChild(nameInput)
            modal.appendChild(this.__settingsAddCustomLabel(nameInput, 'Nome Tabela'))
            modal.appendChild(submit);
            document.body.appendChild(modal);
            modal.showModal();
        }})
        appKeyMap.bind({group: 'March_stage2', key: 'delete', alt: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Apagar Escala', desc: 'Exclui a escala em foco', run: ()=>{
            if(this.__gridIsBlock() || !this.scheduleFocus || this.scheduleGrid[this.scheduleFocus[0]][this.scheduleFocus[1]].dataset.type == 'emptySchedule'){return false}
            let r = this.project.deleteSchedule(this.scheduleFocus[0], this.scheduleFocus[1]);
            if(r){
                let fleet_index = this.scheduleFocus[0];
                this.scheduleFocus = null;
                if(this.scheduleGrid[0].length > 0){
                    this.scheduleFocus = [0,0,0];
                    this.scheduleGrid[0][0].style.backgroundColor = '#032830';
                }
                this.__updateFleetSchedules(fleet_index, this.project.cars[fleet_index].getFleetSchedulesBlock(this.project.route));
                r.forEach(el => {this.__updateFleetSchedules(el, this.project.cars[el].getFleetSchedulesBlock(this.project.route))});
                this.__updateScheduleArrows();
            }
        }})
        appKeyMap.bind({group: 'March_stage2', key: 'delete', ctrl: true, shift: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Limpar escalas', desc: 'Remove todas as escalas', run: ()=>{
            if(this.__gridIsBlock()){return false}
            for(let i = 0; i < this.project.cars.length; i++){
                this.project.cars[i].schedules = [];
                this.__updateFleetSchedules(i, this.project.cars[i].getFleetSchedulesBlock(this.project.route))
            }
            this.__updateScheduleArrows();
        }})
    }
}