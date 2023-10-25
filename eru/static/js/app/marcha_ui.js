class MarchUI{
    constructor(options){
        this.sw = screen.width;
        this.sh = window.innerHeight;
        this.gridLocked = false; // Se true desativa atalhos de edicao do grid
        this.carroIndice = -1;
        this.viagemIndice = -1;
        this.carroSelecao = -1; // Indice do carro onde foi iniciado selecao
        this.inicioSelecao = -1; // Viagem inicial selecionada
        this.fimSelecao = -1; // Viagem final selecionada
        this.carroFocus = null;
        this.viagemFocus = null;
        this.escalaFocus = null;
        this.escalaSelecao = null;
        this.carroLabels = []; // Lista com apontadores das labels dos carros
        this.grid = {}; // Dicionario Todos os elementos do grid (carros e viagens) serao armazenados aqui
        this.freqGrid = {}; // Dicionario com item da regua de frequencia
        this.escalaGrid = {}; // Dicionario com os escalas
        this.escalaArrowsGrid = {}; // Lista com elementos arrows
        this.arrowsVisible = true; 
        this.spotsGrid = {}; // Dicionario com os pontos de rfimicao dos carros
        this.initialView = options?.initialView || 0; // Inicio da regua (em minutos)
        this.fimMinutsMargin = options?.fimMinutsMargin || 15; // Margem (em minutos) final antes de rolar o canvas
        this.initialCarroView = 0; // Indice do primeiro carro sfimo exibido no grid
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

        this.carroTagWidth = options?.carroTagWidth || '35px';
        this.carroTagColor = options?.carroTagColor || '#bcbcbc';
        this.carroHeight = options?.carroHeight || '45px'; // height do carro
        
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

        this.viagemStyle = options?.viagemStyle || 'height: 8px;border-radius: 10px;';
        
        this.viagemOrigemColor = options?.viagemOrigemColor || '#4080A0';
        this.viagemDestinoColor = options?.viagemDestinoColor || '#98D3F0';
        this.viagemHeight = options?.viagemHeight || '8px';

        this.defaultSettings = {
            rulerUnit: '4px',
            rulerMediumUnit: 30,
            viagemOrigemColor: '#4080A0',
            viagemDestinoColor: '#98D3F0',
        }

        // PRODUTIVA = '1', EXPRESSO = '2', SEMIEXPRESSO = '3', EXTRA = '4', ACESSO = '5', RECOLHE = '6', INTERVALO = '7', RESERVADO = '9';
        this.typePattern = { // Ajusta style da viagem baseado no tipo da viagem
            '2':'repeating-linear-gradient(90deg, COLOR, COLOR 6px, var(--bs-secondary-bg) 5px, var(--bs-secondary-bg) 15px)',
            '3':'repeating-linear-gradient(90deg, COLOR, COLOR 6px, var(--bs-secondary-bg) 5px, var(--bs-secondary-bg) 15px)',
            '5':'linear-gradient(90deg, #666 40%, #CCC 0)',
            '6':'linear-gradient(90deg, #CCC 60%, #666 0)',
            '7':'repeating-linear-gradient(0deg, #CCC, #CCC 3px, transparent 3px, transparent)',
            '9':`repeating-linear-gradient(-45deg, COLOR, COLOR 5px, var(--bs-secondary-bg) 3px, var(--bs-secondary-bg) 10px)`,
        }
        
        this.footerClasslist = options?.footerClasslist || 'bg-body-secondary text-body-secondary w-100 position-fixed bottom-0 inicio-0 border-top';
        this.footerHeight = options?.footerHeight || '70px';

        this.translateType = {
            '1': '<span class="text-success">PRODUTIVA</span>',
            '2': '<span class="text-orange">EXPRESSO</span>',
            '3': '<span class="text-orange">SEMIEXPRESSO</span>',
            '5': '<span class="text-orange">ACESSO</span>',
            '6': '<span class="text-orange">RECOLHE</span>',
            '7': '<span class="text-purple">INTERVALO</span>',
            '9': '<span class="text-orange">RESERVADO</span>',
        }
        this.translateWay = {
            'I': 'IDA',
            'V': 'VOLTA',
        }
        
        this.maxCarsVisible = Math.floor((this.sh - parseInt(this.canvasMarginTop) - parseInt(this.rulerHeight) - parseInt(this.footerHeight)) / parseInt(this.carroHeight));
        
        // Carrega configuracoes do usuario para o grid
        if(localStorage['marchUiSettings']){
            let s = JSON.parse(localStorage['marchUiSettings']);
            this.project.sumInterGaps = s.sumInterGaps;
            this.viagemOrigemColor = s.viagemOrigemColor;
            this.viagemDestinoColor = s.viagemDestinoColor;
        }

        this.__buildStyles();
        this.__build();
        this.__buildFooter();
        this.__addGeneralListeners();
        if(this.settingsContainer){this.__builSettingsUI()}
        
        // Se projeto vazio verifica se nao existe previa salvo localmente, se sim carrega previa
        if(this.project.carros.length == 0 && localStorage['marchCurrentProject']){
            this.project.load(JSON.parse(localStorage.marchCurrentProject)); // Carrega modelo com projeto salvo localmente
        }
        this.switchStage(this.project.viewStage); // Carrega interface do respectivo viewStage
    }
    __buildStyles(){
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
    __build(){ // Constroi o canvas (grid principal) e as reguas superior e de frequencia, alem do modal de configuracao do projeto
        this.canvas = document.createElement('div');
        this.canvas.style.position = 'relative';
        this.canvas.style.height = `calc(100vh - ${this.footerHeight} - ${this.canvasMarginTop} - ${this.rulerHeight})`;
        this.canvas.style.left = `calc(${this.rulerUnit} * ${this.initialView} * -1)`;
        // Regua superior
        this.rulerTop = document.createElement('div');
        this.rulerTop.classList = this.rulerClasslist;
        this.rulerTop.style.zIndice = 100;
        this.rulerTop.style.position = 'relative';
        this.rulerTop.style.height = this.rulerHeight;
        this.rulerTop.style.paddingLeft = this.carroTagWidth;
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
        this.cursor.style.zIndice = '98';
        this.canvas.appendChild(this.cursor);
    }
    __buildRuler(){ // Cria (ou atualiza) regua
        this.rulerSmallMarginRight = (parseFloat(this.rulerUnit) - parseInt(this.rulerSmallWidth)) + 'px';
        this.rulerMediumMarginRight = (parseFloat(this.rulerUnit) - parseInt(this.rulerMediumWidth)) + 'px';
        this.maxMinutsVisible = parseInt((this.sw - parseInt(this.carroTagWidth)) / parseFloat(this.rulerUnit));
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
    __buildFooter(){ // Cria elementos do footer
        this.footer = document.createElement('div');this.footer.classList = this.footerClasslist;this.footer.classList.add('user-select-none');this.footer.style.height = this.footerHeight;this.footer.style.zIndice = '100';
        this.displayStart = document.createElement('h5');this.displayStart.style.width = '70px';this.displayStart.style.position = 'absolute';this.displayStart.style.top = '5px';this.displayStart.style.left = '10px';this.displayStart.innerHTML = '--:--';
        this.displayEnd = document.createElement('h5');this.displayEnd.style.width = '70px';this.displayEnd.style.position = 'absolute';this.displayEnd.style.bottom = '5px';this.displayEnd.style.left = '10px';this.displayEnd.innerHTML = '--:--';
        this.displayCycle = document.createElement('h5');this.displayCycle.style.position = 'absolute';this.displayCycle.style.top = '5px';this.displayCycle.style.left = '70px';this.displayCycle.innerHTML = '--';
        let cycleLabel = document.createElement('small');cycleLabel.style.position = 'absolute';cycleLabel.style.bottom = '10px';cycleLabel.style.left = '70px';cycleLabel.innerHTML = 'MIN';
        this.displayFreq = document.createElement('h5');this.displayFreq.style.position = 'absolute';this.displayFreq.style.top = '5px';this.displayFreq.style.left = '110px';this.displayFreq.innerHTML = '--';
        let freqLabel = document.createElement('small');freqLabel.style.position = 'absolute';freqLabel.style.bottom = '10px';freqLabel.style.left = '110px';freqLabel.innerHTML = 'FREQ';
        this.displayInterv = document.createElement('h5');this.displayInterv.style.position = 'absolute';this.displayInterv.style.top = '5px';this.displayInterv.style.left = '150px';this.displayInterv.innerHTML = '--';
        let intervLabel = document.createElement('small');intervLabel.style.position = 'absolute';intervLabel.style.bottom = '10px';intervLabel.style.left = '150px';intervLabel.innerHTML = 'INTERV';
        this.displayViagemTipo = document.createElement('h6');this.displayViagemTipo.classList.add('text-secondary');this.displayViagemTipo.style.position = 'absolute';this.displayViagemTipo.style.top = '10px';this.displayViagemTipo.style.left = '210px';this.displayViagemTipo.innerHTML = '';
        this.displayViagemTipo.ondblclick = () => { // No double click, transforma span em select para alterar tipo da viagem
            if([INTERVALO, ACESSO, RECOLHE].includes(this.viagemFocus.tipo)){return false;} // Nao pode ser alterado tipos de intervalo, acesso e recolhe
            this.gridLocked = true;
            this.displayViagemTipo.style.display = 'none';
            let select = document.createElement('select');select.style = `position: absolute;left: ${this.displayViagemTipo.style.left};top: ${this.displayViagemTipo.style.top};border: 1px solid var(--bs-border-color);background-color: var(--bs-dark-bg-subtle);`;
            let options = {'1': 'Produtiva', '9': 'Reservado', '2': 'Expresso', '3': 'Semiexpresso'};
            for(let key in options){
                let opt = document.createElement('option');
                opt.value = key;opt.innerHTML = options[key];
                if(opt.value == this.viagemFocus.tipo){opt.selected = true;}
                select.appendChild(opt);
            }
            this.displayViagemTipo.after(select);
            let confirm = document.createElement('button');confirm.type = 'button';confirm.innerHTML = 'OK';
            confirm.style = `position: absolute;left: ${select.offsetLeft + select.offsetWidth + 2}px;top: ${select.style.top};border: 1px solid var(--bs-border-color);font-size: 0.8rem;padding: 1px 5px;border-radius: 2px;background-color: var(--bs-dark-bg-subtle);`;
            confirm.onclick = () => {
                this.project.carros[this.carroIndice].viagens[this.viagemIndice].tipo = select.value;
                if(select.value != PRODUTIVA){
                    let c = this.viagemFocus.sentido == IDA ? this.viagemOrigemColor : this.viagemDestinoColor;
                    this.grid[this.carroIndice][this.viagemIndice].style.background = this.typePattern[select.value].replaceAll('COLOR', c);
                }
                else{
                    if(this.viagemFocus.sentido == IDA){
                        this.grid[this.carroIndice][this.viagemIndice].style.background = ''; // Limpa patterns (caso exista)
                        this.grid[this.carroIndice][this.viagemIndice].style.backgroundColor = this.viagemOrigemColor; // Ajusta cor da linha
                    }
                    else{
                        this.grid[this.carroIndice][this.viagemIndice].style.background = ''; // Limpa patterns (caso exista)
                        this.grid[this.carroIndice][this.viagemIndice].style.backgroundColor = this.viagemDestinoColor; // Ajusta cor da linha
                    }
                }
                // Se viagem foi alterada p reservada, deixa de aparecer no freqRule
                this.freqGrid[this.carroIndice][this.viagemIndice].style.visibility = select.value == RESERVADO ? 'hidden' : 'visible';
                select.remove();
                confirm.remove();
                this.displayViagemTipo.style.display = 'inline';
                this.__updateViagemDisplay();
                this.gridLocked = false;
            }
            select.after(confirm);
        }
        this.displayViagemWay = document.createElement('h5');this.displayViagemWay.classList = 'text-body-tertiary';this.displayViagemWay.style.position = 'absolute';this.displayViagemWay.style.bottom = '5px';this.displayViagemWay.style.left = '210px';this.displayViagemWay.innerHTML = '';
        this.displayViagemWay.ondblclick = () => {if(this.viagemFocus){this.switchWay();}}
        let vr = document.createElement('div');vr.classList = 'vr';vr.style = 'position: absolute; left: 375px;top: 10px;height: 50px;'
        this.displayViagemsCount = document.createElement('h5');this.displayViagemsCount.style.position = 'absolute';this.displayViagemsCount.style.top = '10px';this.displayViagemsCount.style.left = '390px';this.displayViagemsCount.innerHTML = '';
        let viagensCountLabel = document.createElement('small');viagensCountLabel.style.position = 'absolute';viagensCountLabel.style.bottom = '10px';viagensCountLabel.style.left = '390px';viagensCountLabel.innerHTML = 'VIAGENS';
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
        this.footer.appendChild(this.displayViagemTipo);
        this.footer.appendChild(this.displayViagemWay);
        this.footer.appendChild(vr);
        this.footer.appendChild(this.displayViagemsCount);
        this.footer.appendChild(viagensCountLabel);
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
        
        this.settingsviagemOrigemColor = document.createElement('input');this.settingsviagemOrigemColor.type = `color`;this.settingsviagemOrigemColor.value = this.viagemOrigemColor;
        this.settingsviagemOrigemColor.onchange = () => {
            this.viagemOrigemColor = this.settingsviagemOrigemColor.value;
            for(let i = 0; i < this.project.carros.length; i++){
                for(let j = 0; j < this.project.carros[i].viagens.length;j++){
                    if(this.project.carros[i].viagens[j].sentido == IDA){this.__updateViagemStyle(this.project.carros[i].viagens[j], this.grid[i][j])}
                }
            }
            this.__saveUISettings();
        }
        this.settingsContainer.appendChild(this.settingsviagemOrigemColor);
        let origemColorLabel = document.createElement('small');origemColorLabel.innerHTML = `IDA`;origemColorLabel.style.position = 'relative';origemColorLabel.style.top = '-7px';origemColorLabel.style.left = '5px';
        this.settingsContainer.appendChild(origemColorLabel);
        
        this.settingsviagemDestinoColor = document.createElement('input');this.settingsviagemDestinoColor.type = `color`;this.settingsviagemDestinoColor.style.marginLeft = `25px`;this.settingsviagemDestinoColor.value = this.viagemDestinoColor;
        this.settingsviagemDestinoColor.onchange = () => {
            this.viagemDestinoColor = this.settingsviagemDestinoColor.value;
            for(let i = 0; i < this.project.carros.length; i++){
                for(let j = 0; j < this.project.carros[i].viagens.length;j++){
                    if(this.project.carros[i].viagens[j].sentido == VOLTA){this.__updateViagemStyle(this.project.carros[i].viagens[j], this.grid[i][j])}
                }
            }
            this.__saveUISettings();
        }
        this.settingsContainer.appendChild(this.settingsviagemDestinoColor);
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
            if(this.viagemFocus){ // Se tiver viagem inserida ajusta posicionamento do canvas
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

        this.settingsProjectName = document.createElement('input');this.settingsProjectName.placeholder = ' ';this.settingsProjectName.classList = 'flat-input';this.settingsProjectName.id = 'March_settingsProjectName';this.settingsProjectName.value = this.project.nome;
        this.settingsProjectName.disabled = true;
        // this.settingsProjectName.onchange = ()=>{this.project.nome = this.settingsProjectName.value;}
        this.settingsContainer.appendChild(this.settingsProjectName);
        this.settingsContainer.appendChild(this.__settingsAddCustomLabel(this.settingsProjectName, 'Nome Projeto'));
        
        this.settingsDayTipo = document.createElement('select');this.settingsDayTipo.classList = 'flat-select';this.settingsDayTipo.id = 'March_settingsDayTipo';
        this.settingsDayTipo.disabled = true;
        let dayTypeOpts = {'U': 'Util', 'S': 'Sabado', 'D': 'Domingo', 'E': 'Especial', 'F': 'Ferias'}
        for(let key in dayTypeOpts){
            let opt = document.createElement('option');opt.value = key; opt.innerHTML = dayTypeOpts[key];
            if(this.project.dayType == key){opt.selected = true}
            this.settingsDayTipo.appendChild(opt);
        }
        // this.settingsDayTipo.onchange = ()=>{this.project.dayType = this.settingsDayTipo.value}
        this.settingsContainer.appendChild(this.settingsDayTipo);
        this.settingsContainer.appendChild(this.__settingsAddCustomLabel(this.settingsDayTipo, 'Dia Tipo'));

        this.settingsProjectDesc = document.createElement('textarea');this.settingsProjectDesc.placeholder = ' ';this.settingsProjectDesc.classList = 'flat-textarea';this.settingsProjectDesc.id = 'March_settingsProjectDesc';this.settingsProjectDesc.value = this.project.desc;
        this.settingsProjectDesc.disabled = true;
        // this.settingsProjectDesc.onchange = ()=>{this.project.desc = this.settingsProjectDesc.value;}
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
        let baseline = this.project.linha.getBaselines();
        this.settingsBaselineTable.innerHTML = '<thead><tr><th colspan="2">Faixa</th><th colspan="2">Ciclo</th><th colspan="2">Intervalo</th><th colspan="2">Frequência</th></tr><tr><th>Inicio</th><th>Fim</th><th>Ida</th><th>Volta</th><th>Ida</th><th>Volta</th><th>Frota</th><th>Freq</th></tr></thead>';
        for(let i = 0; i < baseline.length; i++){
            let onclick = `if(parseInt(this.innerHTML) > 0){this.nextSibling.innerHTML = parseFloat((parseInt(this.parentNode.childNodes[2].innerHTML) + parseInt(this.parentNode.childNodes[3].innerHTML) + parseInt(this.parentNode.childNodes[4].innerHTML) + parseInt(this.parentNode.childNodes[5].innerHTML)) / parseInt(this.innerHTML)).toFixed(2)}else{this.nextSibling.innerHTML = ''}`;
            let tr = `<tr><td>${baseline[i].inicio}</td><td>${baseline[i].fim}</td><td>${baseline[i].origemMin}</td><td>${baseline[i].destinoMin}</td><td>${baseline[i].origemInterv}</td><td>${baseline[i].destinoInterv}</td><td class="bg-body-secondary" contenteditable="true" oninput="${onclick}"></td><td></td></tr>`;
            this.settingsBaselineTable.innerHTML += tr;
        }
    }
    __settingsUpdateFreqSimulate(){ // Calcula frequencia (exibe na label) baseado nos dados do patamar
        if(this.settingsCarroSimulate.value == '' || this.settingsCarroSimulate.value == 0){this.settingsFreqSimulate.innerHTML = '--'; return false;}
        if(!this.project.linha.circular){
            this.settingsFreqSimulate.innerHTML = ((parseInt(this.settingsBaselineOrigemMin.value) + parseInt(this.settingsBaselineToMin.value) + parseInt(this.settingsBaselineOrigemInterv.value) + parseInt(this.settingsBaselineToInterv.value)) / parseInt(this.settingsCarroSimulate.value)).toFixed(2);
        }
        else{
            this.settingsFreqSimulate.innerHTML = ((parseInt(this.settingsBaselineOrigemMin.value) + parseInt(this.settingsBaselineOrigemInterv.value)) / parseInt(this.settingsCarroSimulate.value)).toFixed(2);
        }
    }
    addCarro(car=null, seq=this.project.carros.length + 1){
        car = car || this.project.addCarro({linha: this.project.linha});
        let carLabel = document.createElement('span');
        carLabel.style.width = this.carroTagWidth;
        carLabel.style.color = this.carroTagColor;
        carLabel.style.height = this.carroHeight;
        carLabel.style.paddingLeft = '3px';
        carLabel.style.position = 'absolute';
        carLabel.style.backgroundColor = 'var(--bs-body-bg)';
        carLabel.style.zIndice = '95';
        carLabel.innerHTML = String(seq).padStart(2,'0');
        carLabel.style.top = `calc(${this.carroHeight} * ${seq})`;
        carLabel.style.left = 0;
        this.carroLabels.push(carLabel);
        this.container.appendChild(carLabel);
        this.grid[seq - 1] = []; // Adiciona entrada para o carro no dicionario de grid
        this.freqGrid[seq - 1] = []; // Adiciona entrada para o carro no dicionario de freqGrid
        for(let i = 0; i < car.viagens.length; i++){
            let v = this.addViagem(car.viagens[i], seq - 1);
        }
        if(this.viagemFocus == null){ // Se nenhuma viagem em foco, aponta para primeira viagem do primeiro carro
            this.carroIndice = 0;
            this.viagemIndice = 0;
            this.carroFocus = car;
            this.viagemFocus = car.viagens[0];
            this.__cursorMove();
            this.__updateViagemDisplay();
        }
    }
    addViagem(viagem=null, seq=this.carroIndice, confirmed=false){
        this.__clearSelecao();
        viagem = viagem || this.project.carros[this.carroIndice].addViagem(this.project.linha);
        let v = document.createElement('div'); // Elemento viagem (grid)
        v.style = this.viagemStyle;
        this.__updateViagemStyle(viagem, v);
        v.style.position = 'absolute';
        v.style.width = `calc(${this.rulerUnit} * ${viagem.getCycle()})`;
        v.style.top = `calc(${this.carroHeight} * ${seq + 1} - 17px)`;
        v.style.left = `calc(${this.carroTagWidth} + ${viagem.inicio} * ${this.rulerUnit})`;
        this.grid[seq].push(v);
        this.canvas.appendChild(v);
        let vf = document.createElement('div'); // Dot na regua de frequencia
        vf.style.position = 'absolute';
        vf.style.left = v.style.left; // Assume mesmo posicionamento da viagem
        vf.style.top = viagem.sentido == IDA ? '5px' : '30px';
        vf.style.width = this.rulerSmallWidth;
        vf.style.height = this.rulerSmallHeight;
        vf.style.backgroundColor = this.rulerSmallColor;
        vf.style.marginRight = this.rulerSmallMarginRight;
        if([INTERVALO, ACESSO, RECOLHE, RESERVADO].includes(viagem.tipo)){
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

    addViagemAt(){ // Exibe modal com entrada para hora de inicio de viagem
        this.__clearSelecao();
        this.gridLocked = true;
        let modal = document.createElement('dialog');modal.innerHTML = '<h6>Adicionar viagem as:</h6>'
        let inicioAt = document.createElement('input');inicioAt.type = 'time';inicioAt.style.width = '100px';inicioAt.style.textAlign = 'center';inicioAt.style.display = 'block';inicioAt.style.marginLeft = 'auto';inicioAt.style.marginRight = 'auto';
        let confirm = document.createElement('button');confirm.type = 'button';confirm.classList = 'btn btn-sm btn-dark mt-2 float-end';confirm.innerHTML = 'Confirmar';
        confirm.onclick = () => {
            let time = hour2Min(inicioAt.value)
            if(time){
                let v = this.project.addViagem(this.carroIndice, time);
                if(v){ // Se viagem atfime requisitos, insere viagem no grid
                    this.addViagem(v, this.carroIndice);
                    // Ao inserir viagem com horario predefinido move o foco para esta viagem
                    this.viagemFocus = v;
                    this.viagemIndice = this.project.carros[this.carroIndice].viagens.indexOf(this.viagemFocus);
                    // Ao inserir viagem com horario predefinido a viagem sera inserida na ordem de inicio
                    // necessario reordenar tambem grid para corresponder indices de viagens
                    this.grid[this.carroIndice].sort((a, b) => a.offsetLeft > b.offsetLeft ? 1 : -1);
                    this.freqGrid[this.carroIndice].sort((a, b) => a.offsetLeft > b.offsetLeft ? 1 : -1);
                    this.__cursorMove();
                    this.__updateViagemDisplay();
                }
                cancel.click(); // Fecha modal
            }
            else{inicioAt.style.border = '2px solid var(--bs-form-invalid-color)'}
        }
        let cancel = document.createElement('button');cancel.type = 'button';cancel.classList = 'btn btn-sm btn-secondary mt-2 me-1 float-end';cancel.innerHTML = 'Cancelar';
        cancel.onclick = () => { // Libera o grid e destroi o modal
            this.gridLocked = false;
            modal.remove();
        }
        modal.addEventListener('close', ()=>{this.gridLocked = false;})

        modal.appendChild(inicioAt);
        modal.appendChild(confirm);
        modal.appendChild(cancel);
        document.body.appendChild(modal);
        modal.showModal();
    }
    addInterv(){
        this.__clearSelecao();
        let viagem = this.project.carros[this.carroIndice].addInterv(this.viagemIndice);
        if(viagem){
            let v = document.createElement('div'); // Elemento viagem (grid)
            v.style = this.viagemStyle;
            v.style.background = this.typePattern[INTERVALO];
            v.style.position = 'absolute';
            v.style.width = `calc(${this.rulerUnit} * ${viagem.getCycle()})`;
            v.style.top = `calc(${this.carroHeight} * ${this.carroIndice + 1} - 17px)`;
            v.style.left = `calc(${this.carroTagWidth} + ${viagem.inicio} * ${this.rulerUnit})`;
            this.grid[this.carroIndice].push(v);
            this.canvas.appendChild(v);
            this.grid[this.carroIndice].sort((a, b) => a.offsetLeft > b.offsetLeft ? 1 : -1);
            let vf = document.createElement('div'); // Dot na regua de frequencia
            vf.style.position = 'absolute';
            vf.style.left = v.style.left; // Assume mesmo posicionamento da viagem
            vf.style.top = viagem.sentido == IDA ? '5px' : '30px';
            vf.style.width = this.rulerSmallWidth;
            vf.style.height = this.rulerSmallHeight;
            vf.style.backgroundColor = this.rulerSmallColor;
            vf.style.marginRight = this.rulerSmallMarginRight;
            vf.style.visibility = 'hidden'; // Intervalos nao sao vistos na freqRule
            this.freqGrid[this.carroIndice].push(vf);
            this.rulerFreq.appendChild(vf);
            this.freqGrid[this.carroIndice].sort((a, b) => a.offsetLeft > b.offsetLeft ? 1 : -1);
        }
    }
    addAccess(carroIndice=this.carroIndice, viagemIndice=this.viagemIndice, incrementIndice=true){
        this.__clearSelecao();
        let viagem = this.project.carros[carroIndice].addAccess(viagemIndice, this.project.linha.metrics);
        if(viagem){
            let v = document.createElement('div'); // Elemento viagem (grid)
            v.style = this.viagemStyle;
            v.style.background = this.typePattern[ACESSO];
            v.style.position = 'absolute';
            v.style.width = `calc(${this.rulerUnit} * ${viagem.getCycle()})`;
            v.style.top = `calc(${this.carroHeight} * ${carroIndice + 1} - 17px)`;
            v.style.left = `calc(${this.carroTagWidth} + ${viagem.inicio} * ${this.rulerUnit})`;
            this.grid[carroIndice].push(v);
            this.canvas.appendChild(v);
            this.grid[carroIndice].sort((a, b) => a.offsetLeft > b.offsetLeft ? 1 : -1);
            let vf = document.createElement('div'); // Dot na regua de frequencia
            vf.style.position = 'absolute';
            vf.style.left = v.style.left; // Assume mesmo posicionamento da viagem
            vf.style.top = viagem.sentido == IDA ? '5px' : '30px';
            vf.style.width = this.rulerSmallWidth;
            vf.style.height = this.rulerSmallHeight;
            vf.style.backgroundColor = this.rulerSmallColor;
            vf.style.marginRight = this.rulerSmallMarginRight;
            vf.style.visibility = 'hidden';; // Acesso nao sao vistos na freqRule
            this.freqGrid[carroIndice].push(vf);
            this.rulerFreq.appendChild(vf);
            this.freqGrid[carroIndice].sort((a, b) => a.offsetLeft > b.offsetLeft ? 1 : -1);
            if(incrementIndice){this.viagemIndice++}
        }
    }
    addRecall(carroIndice=this.carroIndice, viagemIndice=this.viagemIndice){ // Adiciona recolhida na viagem em foco
        this.__clearSelecao();
        let viagem = this.project.carros[carroIndice].addRecall(viagemIndice, this.project.linha.metrics);
        if(viagem){
            let v = document.createElement('div'); // Elemento viagem (grid)
            v.style = this.viagemStyle;
            v.style.background = this.typePattern[RECOLHE];
            v.style.position = 'absolute';
            v.style.width = `calc(${this.rulerUnit} * ${viagem.getCycle()})`;
            v.style.top = `calc(${this.carroHeight} * ${carroIndice + 1} - 17px)`;
            v.style.left = `calc(${this.carroTagWidth} + ${viagem.inicio} * ${this.rulerUnit})`;
            this.grid[carroIndice].push(v);
            this.canvas.appendChild(v);
            this.grid[carroIndice].sort((a, b) => a.offsetLeft > b.offsetLeft ? 1 : -1);
            let vf = document.createElement('div'); // Dot na regua de frequencia
            vf.style.position = 'absolute';
            vf.style.left = v.style.left; // Assume mesmo posicionamento da viagem
            vf.style.top = viagem.sentido == IDA ? '5px' : '30px';
            vf.style.width = this.rulerSmallWidth;
            vf.style.height = this.rulerSmallHeight;
            vf.style.backgroundColor = this.rulerSmallColor;
            vf.style.marginRight = this.rulerSmallMarginRight;
            vf.style.visibility = 'hidden';; // Recolhe nao sao vistos na freqRule
            this.rulerFreq.appendChild(vf);
            this.freqGrid[carroIndice].push(vf);
            this.freqGrid[carroIndice].sort((a, b) => a.offsetLeft > b.offsetLeft ? 1 : -1);
            return true;
        }
        return false;
    }
    viagemShut(){ // Encerra turno na viagem em foco
        let v = this.carroFocus.viagemShut(this.viagemIndice);
        if(v){
            this.__updateViagemStyle(this.viagemFocus, this.grid[this.carroIndice][this.viagemIndice]);
        }
    }
    switchWay(){ // Abre modal para alteracao do sentido da viagem
        let dialog = document.createElement('dialog');
        dialog.innerHTML = `<p>Deseja altera o sentido da viagem para <b class="text-purple">${this.viagemFocus.sentido  == IDA ? 'VOLTA' : 'IDA'}</b>?</p>`
        let check = document.createElement('input');check.id = 'March_switchWayCheck';check.checked = 'true'
        dialog.appendChild(this.__settingsContainerSwitch(check, 'Alterar demais viagens'));
        let cancel = document.createElement('button');cancel.type = 'button';cancel.classList = 'btn btn-sm btn-phanton text-secondary float-end';cancel.innerHTML = 'Cancelar';
        cancel.onclick = ()=>{
            dialog.close();
            dialog.remove();            
        }
        let confirm = document.createElement('button');confirm.type = 'button';confirm.classList = 'btn btn-sm btn-phanton float-end';confirm.innerHTML = 'Gravar';
        confirm.onclick = () => {
            this.project.carros[this.carroIndice].switchWay(this.viagemIndice, check.checked);
            this.__updateViagemStyle(this.project.carros[this.carroIndice].viagens[this.viagemIndice], this.grid[this.carroIndice][this.viagemIndice]);
            if(check.checked){
                for(let i = this.viagemIndice + 1; i < this.project.carros[this.carroIndice].viagens.length; i++){
                    this.__updateViagemStyle(this.project.carros[this.carroIndice].viagens[i], this.grid[this.carroIndice][i]);
                }
            }
            cancel.click();
            this.__updateViagemDisplay();
        }
        dialog.appendChild(confirm);
        dialog.appendChild(cancel);
        document.body.appendChild(dialog);
        dialog.showModal();
    }
    __updateViagemStyle(model, target){ // Ajusta stilo da viagem
        target.style.backgroundColor = model.sentido == IDA ? this.viagemOrigemColor : this.viagemDestinoColor;
        target.style.color = target.style.backgroundColor;
        if(model.tipo != PRODUTIVA){
            let c = model.sentido == IDA ? this.viagemOrigemColor : this.viagemDestinoColor;
            target.style.background = this.typePattern[model.tipo].replaceAll('COLOR', c);
        }
        if(model.encerrar){target.classList.add('viagem-encerrar')}
        else{target.classList.remove('viagem-encerrar')}
    }
    plus(cascade=true){
        if(this.viagemFocus != null){
            this.project.carros[this.carroIndice].plus(this.viagemIndice, cascade); // Icrementa 1 minuto no final na viagem foco e no inicio e fim das posteriores
            this.grid[this.carroIndice][this.viagemIndice].style.width = `calc(${this.project.carros[this.carroIndice].viagens[this.viagemIndice].getCycle()} * ${this.rulerUnit})`;
            if(cascade){
                for(let i = 1; i < this.project.carros[this.carroIndice].viagens.length; i++){
                    this.grid[this.carroIndice][i].style.left = `calc(${this.carroTagWidth} + ${this.project.carros[this.carroIndice].viagens[i].inicio} * ${this.rulerUnit})`;
                    this.grid[this.carroIndice][i].style.width = `calc(${this.project.carros[this.carroIndice].viagens[i].getCycle()} * ${this.rulerUnit})`;
                    this.freqGrid[this.carroIndice][i].style.left = `calc(${this.carroTagWidth} + ${this.project.carros[this.carroIndice].viagens[i].inicio} * ${this.rulerUnit})`;
                }
            }
            this.__updateViagemDisplay();
        }
    }
    sub(cascade=true){
        if(this.viagemFocus != null){
            this.project.carros[this.carroIndice].sub(this.viagemIndice, cascade); // Subtrai 1 minuto no final na viagem foco e no inicio e fim das posteriores
            this.grid[this.carroIndice][this.viagemIndice].style.width = `calc(${this.project.carros[this.carroIndice].viagens[this.viagemIndice].getCycle()} * ${this.rulerUnit})`;
            if(cascade){
                for(let i = 1; i < this.project.carros[this.carroIndice].viagens.length; i++){
                    this.grid[this.carroIndice][i].style.left = `calc(${this.carroTagWidth} + ${this.project.carros[this.carroIndice].viagens[i].inicio} * ${this.rulerUnit})`;
                    this.grid[this.carroIndice][i].style.width = `calc(${this.project.carros[this.carroIndice].viagens[i].getCycle()} * ${this.rulerUnit})`;
                    this.freqGrid[this.carroIndice][i].style.left = `calc(${this.carroTagWidth} + ${this.project.carros[this.carroIndice].viagens[i].inicio} * ${this.rulerUnit})`;
                }
            }
            this.__updateViagemDisplay();
        }
    }
    moveStart(){
        if(this.viagemFocus != null){
            this.project.carros[this.carroIndice].moveStart(this.viagemIndice); // Aumenta 1 minuto no final na viagem foco
            this.grid[this.carroIndice][this.viagemIndice].style.left = `calc(${this.carroTagWidth} + ${this.project.carros[this.carroIndice].viagens[this.viagemIndice].inicio} * ${this.rulerUnit})`;
            this.grid[this.carroIndice][this.viagemIndice].style.width = `calc(${this.project.carros[this.carroIndice].viagens[this.viagemIndice].getCycle()} * ${this.rulerUnit})`;
            this.freqGrid[this.carroIndice][this.viagemIndice].style.left = `calc(${this.carroTagWidth} + ${this.project.carros[this.carroIndice].viagens[this.viagemIndice].inicio} * ${this.rulerUnit})`;
            this.__updateViagemDisplay();
        }

    }
    backStart(){
        if(this.viagemFocus != null){
            this.project.carros[this.carroIndice].backStart(this.viagemIndice);
            this.grid[this.carroIndice][this.viagemIndice].style.left = `calc(${this.carroTagWidth} + ${this.project.carros[this.carroIndice].viagens[this.viagemIndice].inicio} * ${this.rulerUnit})`;
            this.grid[this.carroIndice][this.viagemIndice].style.width = `calc(${this.project.carros[this.carroIndice].viagens[this.viagemIndice].getCycle()} * ${this.rulerUnit})`;
            this.freqGrid[this.carroIndice][this.viagemIndice].style.left = `calc(${this.carroTagWidth} + ${this.project.carros[this.carroIndice].viagens[this.viagemIndice].inicio} * ${this.rulerUnit})`;
            this.__cursorMove();
            this.__updateViagemDisplay();
        }
    }
    advance(){
        if(this.viagemFocus != null){
            this.project.carros[this.carroIndice].advance(this.viagemIndice);
            for(let i = this.viagemIndice; i < this.project.carros[this.carroIndice].viagens.length; i++){
                this.grid[this.carroIndice][i].style.left = `calc(${this.carroTagWidth} + ${this.project.carros[this.carroIndice].viagens[i].inicio} * ${this.rulerUnit})`;
                this.grid[this.carroIndice][i].style.width = `calc(${this.project.carros[this.carroIndice].viagens[i].getCycle()} * ${this.rulerUnit})`;
                this.freqGrid[this.carroIndice][i].style.left = `calc(${this.carroTagWidth} + ${this.project.carros[this.carroIndice].viagens[i].inicio} * ${this.rulerUnit})`;
            }
            this.__cursorMove();
            this.__updateViagemDisplay();
        }

    }
    back(){
        if(this.viagemFocus != null){
            this.project.carros[this.carroIndice].back(this.viagemIndice);
            for(let i = this.viagemIndice; i < this.project.carros[this.carroIndice].viagens.length; i++){
                this.grid[this.carroIndice][i].style.left = `calc(${this.carroTagWidth} + ${this.project.carros[this.carroIndice].viagens[i].inicio} * ${this.rulerUnit})`;
                this.grid[this.carroIndice][i].style.width = `calc(${this.project.carros[this.carroIndice].viagens[i].getCycle()} * ${this.rulerUnit})`;
                this.freqGrid[this.carroIndice][i].style.left = `calc(${this.carroTagWidth} + ${this.project.carros[this.carroIndice].viagens[i].inicio} * ${this.rulerUnit})`;
            }
            this.__cursorMove();
            this.__updateViagemDisplay();
        }

    }
    removeCarro(){
        if(!this.carroFocus){return false}
        let r = this.project.removeCarro(this.carroIndice);
        if(r){this.__loadStage1()} // Ao remover carro, todo o grid eh reconstruido
    }
    removeViagem(cascade=true){ // Remove viagem em foco e se cascade=true as seguintes
        if(this.viagemFocus){
            let r;
            // Se itens selecionados, apaga as viagens selecionadas
            if(this.inicioSelecao >= 0 && this.fimSelecao >= 0){r = this.project.carros[this.carroIndice].removeViagem(this.viagemIndice, false, this.fimSelecao - this.inicioSelecao + 1)}
            else{r = this.project.carros[this.carroIndice].removeViagem(this.viagemIndice, cascade)}
            if(r){
                if(this.inicioSelecao >= 0 && this.fimSelecao >= 0){
                    let ajustedStart = this.inicioSelecao - (r[1] ? 1 : 0);
                    let ajustedEnd = this.fimSelecao + (r[2] ? 1 : 0);
                    for(let i = ajustedEnd; i >= ajustedStart; i--){
                        this.grid[this.carroSelecao][i].remove(); // Apaga viagem no grid
                        this.freqGrid[this.carroSelecao][i].remove(); // Apaga viagem no freqGrid
                    }
                    this.grid[this.carroSelecao].splice(ajustedStart, ajustedEnd - ajustedStart + 1); // Apaga entradas no grid
                    this.freqGrid[this.carroSelecao].splice(this.viagemIndice, ajustedEnd - ajustedStart + 1); // Apaga entradas no freqGrid
                }
                else if(!cascade){
                    let ajustedStart = this.viagemIndice - (r[1] ? 1 : 0);
                    let ajustedEnd = this.viagemIndice + (r[2] ? 1 : 0);
                    for(let i = ajustedEnd; i >= ajustedStart; i--){
                        this.grid[this.carroIndice][i].remove(); // Apaga elemento do canvas
                        this.freqGrid[this.carroIndice][i].remove(); // Apaga elemento no ruleFreq
                    }
                    this.grid[this.carroIndice].splice(ajustedStart, 1 + (r[1] ? 1 : 0) + (r[2] ? 1 : 0)); // Apaga entrada no grid
                    this.freqGrid[this.carroIndice].splice(ajustedStart, 1 + (r[1] ? 1 : 0) + (r[2] ? 1 : 0)); // Apaga viagem no freqGrid
                }
                else{
                    let ajustedStart = this.viagemIndice - (r[1] ? 1 : 0);
                    for(let i = this.grid[this.carroIndice].length - 1; i >= ajustedStart; i--){
                        this.grid[this.carroIndice][i].remove(); // Apaga viagem no grid
                        this.freqGrid[this.carroIndice][i].remove(); // Apaga viagem no freqGrid
                    }
                    this.grid[this.carroIndice].splice(ajustedStart, this.grid[this.carroIndice].length - ajustedStart); // Apaga entradas no grid
                    this.freqGrid[this.carroIndice].splice(ajustedStart, this.freqGrid[this.carroIndice].length - ajustedStart); // Apaga entradas no freqGrid
                }
                this.__clearSelecao();
                // Muda o foco para viagem anterior (se existir) ou posterior
                this.viagemIndice = this.viagemIndice == 0 || (this.viagemIndice == 1 && r[1]) ? 0 : this.viagemIndice - (r[1] ? 2 : 1);
                this.viagemFocus = this.project.carros[this.carroIndice].viagens[this.viagemIndice];
                this.__cursorMove();
                this.__updateViagemDisplay();
            }
        }
    }
    moveViagems(){
        if(this.carroSelecao == this.carroIndice || this.carroSelecao < 0 || this.inicioSelecao < 0 || this.fimSelecao < 0){return false;}
        let resp = this.project.moveViagems(this.carroSelecao, this.carroIndice, this.inicioSelecao, this.fimSelecao);
        if(resp){
            for(let i = this.inicioSelecao; i <= this.fimSelecao;i++){ // Ajusta posicao top das viagens alvo para novo carro no canvas
                this.grid[this.carroSelecao][i].style.top = `calc(${this.carroHeight} * ${this.carroIndice + 1} - 17px)`;
            }
            this.grid[this.carroIndice] = this.grid[this.carroIndice].concat(this.grid[this.carroSelecao].splice(this.inicioSelecao, this.fimSelecao - this.inicioSelecao + 1));
            this.grid[this.carroIndice].sort((a, b) => a.offsetLeft > b.offsetLeft ? 1 : -1);
            this.freqGrid[this.carroIndice] = this.freqGrid[this.carroIndice].concat(this.freqGrid[this.carroSelecao].splice(this.inicioSelecao, this.fimSelecao - this.inicioSelecao + 1));
            this.freqGrid[this.carroIndice].sort((a, b) => a.offsetLeft > b.offsetLeft ? 1 : -1);
            this.__clearSelecao();
            this.viagemFocus = this.project.carros[this.carroIndice].viagens[this.viagemIndice];
            this.__cursorMove();
        }
        else{appNotify('warning', '<b>Atenção:</b> Conflito de horário ou você tentou mover todas as viagens do veiculo')}
    }
    addToTransferArea(){
        if(this.carroSelecao < 0 || this.inicioSelecao < 0 || this.fimSelecao < 0){return false};
        let r = this.project.addToTransferArea(this.carroSelecao, this.inicioSelecao, this.fimSelecao);
        if(r){
            for(let i = this.inicioSelecao; i <= this.fimSelecao; i++){ // Remove itens do grid e freqGrid
                let v = this.project.carros[this.carroSelecao].viagens[i];
                this.grid[this.carroSelecao][i].remove();
                this.freqGrid[this.carroSelecao][i].remove();
            }
            this.grid[this.carroSelecao].splice(this.inicioSelecao, r.length);
            this.freqGrid[this.carroSelecao].splice(this.inicioSelecao, r.length);
            if(this.inicioSelecao > 0){
                this.viagemIndice = this.inicioSelecao - 1;
                this.viagemFocus = this.project.carros[this.carroIndice].viagens[this.viagemIndice];
            }
            else{
                this.viagemFocus = this.project.carros[this.carroIndice].viagens[this.viagemIndice];
            }
            this.__cursorMove();
            this.__updateViagemDisplay();
            this.__clearSelecao();
            this.__addToTransferAddLabel()
        }
    }
    __addToTransferAddLabel(){
        // Adiciona icone identificando que existe viagens na area de transferencia
        this.transferAreaIcon = document.createElement('div');
        this.transferAreaIcon.style = 'position: absolute; top: 90px; right: 20px; border:1px solid var(--bs-border-color); border-radius: 10px;padding: 4px 10px; background-color: var(--bs-secondary-bg);opacity: 0.7; cursor: pointer;';
        this.transferAreaIcon.innerHTML = `<i class="bi bi-copy fs-5 me-1"></i> <b>${this.project.area_transferencia.length}</b>`;
        this.transferAreaIcon.title = `Inicio: ${this.project.area_transferencia[0].getStart()} | Fim: ${this.project.area_transferencia[this.project.area_transferencia.length - 1].getEnd()}`;
        document.body.appendChild(this.transferAreaIcon);
    }
    pasteTransfer(){ // 
        let r = this.project.pasteTransfer(this.carroIndice);
        if(r){
            for(let i = 0; i < this.grid[this.carroIndice].length; i++){
                this.grid[this.carroIndice][i].remove(); // Limpa a viagem do grid
                this.freqGrid[this.carroIndice][i].remove(); // Limpa a viagem do freqGrid
            }
            this.grid[this.carroIndice] = []; // Limpa o grid
            this.freqGrid[this.carroIndice] = []; // Limpa o freqGrid
            for(let i = 0; i < this.project.carros[this.carroIndice].viagens.length; i++){
                this.addViagem(this.project.carros[this.carroIndice].viagens[i]); // Adiciona as viagens ajustadas do carro no grid
            }
            this.viagemFocus = this.project.carros[this.carroIndice].viagens[this.viagemIndice];
            this.__cursorMove();
            this.transferAreaIcon.remove();
        }
        else{appNotify('warning', '<b>Atenção:</b> Conflito de horário, não é possivel mover viagens')}


    }
    __addToSelecao(){ // Seleciona viagens
        if(!this.viagemFocus || this.project.carros[this.carroIndice].viagens.length <= this.fimSelecao + 1){return false}
        if(this.carroSelecao >= 0 &&  this.inicioSelecao >= 0){ // Selecao ja iniciada
            this.fimSelecao++;
            let wd = this.project.carros[this.carroIndice].viagens[this.fimSelecao].fim - this.project.carros[this.carroIndice].viagens[this.inicioSelecao].inicio;
            this.selectViagemsBox.style.width = `calc(${wd} * ${this.rulerUnit} + 10px)`;

        }
        else{
            this.carroSelecao = this.carroIndice;
            this.inicioSelecao = this.viagemIndice;
            this.fimSelecao = this.viagemIndice;
            this.selectViagemsBox = document.createElement('div');
            let selectWd = `calc(${this.viagemFocus.getCycle()} * ${this.rulerUnit} + 10px)`;
            let selectSt = `calc(${this.carroTagWidth} + ${this.viagemFocus.inicio} * ${this.rulerUnit} - 5px)`;
            let selectTp = `calc(${this.carroHeight} * ${this.carroIndice + 1} - 22px)`;
            this.selectViagemsBox.style = `border:1px solid #b72a2a;height: calc(${this.viagemHeight} + 10px);border-radius: 10px;width: ${selectWd};position: absolute; top: ${selectTp}; left: ${selectSt}`;
            this.canvas.appendChild(this.selectViagemsBox);
        }
        
    }
    __subToSelecao(){
        if(!this.viagemFocus || this.carroSelecao < 0 || this.inicioSelecao < 0 || this.fimSelecao < 0){return false}
        if(this.fimSelecao == this.inicioSelecao){this.__clearSelecao();return false} // Se existe apenas uma viagem selecionada apenasremove a selecao e encerra bloco
        this.fimSelecao--;
        let wd = this.project.carros[this.carroIndice].viagens[this.fimSelecao].fim - this.project.carros[this.carroIndice].viagens[this.inicioSelecao].inicio;
        this.selectViagemsBox.style.width = `calc(${wd} * ${this.rulerUnit} + 10px)`;
    }
    __clearSelecao(){
        if(!this.selectViagemsBox){return false}
        this.carroSelecao = -1;
        this.inicioSelecao = -1;
        this.fimSelecao = -1;
        this.selectViagemsBox.remove();
    }
    nextViagem(){ // Move foco para proxima viagem no mesmo sentido (indiferente do carro)
        let v = this.project.nextViagem(this.viagemFocus);
        if(v){
            this.carroLabels[this.carroIndice].style.color = 'inherit';
            this.carroIndice = v[0];
            this.viagemIndice = v[1];
            this.viagemFocus = v[2];
            this.carroLabels[this.carroIndice].style.color = 'var(--bs-link-color)';
            this.carroFocus = this.project.carros[this.carroIndice];
            this.__cursorMove();
            this.__updateViagemDisplay();
            this.__clearCarroDisplay();
        }
    }
    previousViagem(){ // Move foco para proxima viagem no mesmo sentido (indiferente do carro)
        let v = this.project.previousViagem(this.viagemFocus);
        if(v){
            this.carroLabels[this.carroIndice].style.color = 'inherit';
            this.carroIndice = v[0];
            this.viagemIndice = v[1];
            this.viagemFocus = v[2];
            this.carroLabels[this.carroIndice].style.color = 'var(--bs-link-color)';
            this.carroFocus = this.project.carros[this.carroIndice];
            this.__cursorMove();
            this.__updateViagemDisplay();
            this.__clearCarroDisplay();
        }
    }
    __updateViagemDisplay(){
        if(this.viagemFocus == null){return false;}
        this.displayViagemTipo.innerHTML = this.translateType[this.viagemFocus.tipo];
        if(this.viagemFocus.tipo != INTERVALO){
            this.displayStart.innerHTML = this.viagemFocus.getStart();
            this.displayEnd.innerHTML = this.viagemFocus.getEnd();
            this.displayCycle.innerHTML = this.viagemFocus.getCycle();
            this.displayFreq.innerHTML = this.viagemFocus.tipo != RESERVADO ? this.project.getHeadway(this.viagemFocus) || '--' : '--';
            this.displayInterv.innerHTML = this.project.carros[this.carroIndice].getInterv(this.viagemIndice) || '--';
            this.displayViagemWay.innerHTML = this.translateWay[this.viagemFocus.sentido];
        }
        else{
            this.displayStart.innerHTML = min2Hour(this.viagemFocus.inicio - 1);
            this.displayEnd.innerHTML = min2Hour(this.viagemFocus.fim + 1);
            this.displayCycle.innerHTML = this.viagemFocus.getCycle() + 2;
            this.displayFreq.innerHTML = '--';
            this.displayInterv.innerHTML = '--';
            this.displayViagemWay.innerHTML = '';
        }
    }
    __updateCarroDisplay(){
        if(this.viagemFocus == null){return false;}
        this.displayViagemsCount.innerHTML = this.project.carros[this.carroIndice].countViagens();
        this.displayJorney.innerHTML = min2Hour(this.project.getJourney(this.carroIndice), false);
        this.displayInterv2.innerHTML = min2Hour(this.project.getIntervs(this.carroIndice), false);
        this.carroDisplayClassification = document.createElement('select');this.carroDisplayClassification.style = `position: absolute;left: 600px;top: 7px;width: 128px;border: 1px solid var(--bs-border-color);background-color: var(--bs-dark-bg-subtle);`;this.carroDisplayClassification.id = 'March_footerCarroDisplayClassification';
        this.carroDisplayClassification.onchange = () => {this.project.carros[this.carroIndice].classification = this.carroDisplayClassification.value;}
        let classOptions = {'CV': 'Convencional', 'PD': 'Padron', 'MC': 'Microonibus', 'AT': 'Articulado', 'BI': 'Biarticulado'};
        for(let key in classOptions){
            let opt = document.createElement('option');
            opt.value = key;opt.innerHTML = classOptions[key];
            if(opt.value == this.carroFocus.classification){opt.selected = true;}
            this.carroDisplayClassification.appendChild(opt);
        }
        this.footer.appendChild(this.carroDisplayClassification);
        
        this.carroDisplaySpecification = document.createElement('select');this.carroDisplaySpecification.style = `position: absolute;left: 600px;bottom: 7px;width: 128px;border: 1px solid var(--bs-border-color);background-color: var(--bs-dark-bg-subtle);`;this.carroDisplaySpecification.id = 'March_footerCarroDisplaySpecification';
        this.carroDisplaySpecification.onchange = () => {this.project.carros[this.carroIndice].specification = this.carroDisplaySpecification.value;}
        let specOptions = {'0': '---', '1': 'Porta LE'};
        for(let key in specOptions){
            let opt = document.createElement('option');
            opt.value = key;opt.innerHTML = specOptions[key];
            if(opt.value == this.carroFocus.specification){opt.selected = true;}
            this.carroDisplaySpecification.appendChild(opt);
        }
        this.footer.appendChild(this.carroDisplaySpecification);
    }
    __clearViagemDisplay(){
        this.displayStart.innerHTML = '--:--';
        this.displayEnd.innerHTML = '--:--';
        this.displayCycle.innerHTML = '--';
        this.displayFreq.innerHTML = '--';
        this.displayInterv.innerHTML = '--';
        this.displayViagemWay.innerHTML = '';
        this.displayViagemTipo.innerHTML = '';
    }
    __clearCarroDisplay(){
        this.displayViagemsCount.innerHTML = '';
        this.displayJorney.innerHTML = '';
        this.displayInterv2.innerHTML = '';
        try{
            this.carroDisplayClassification.remove();
            this.carroDisplaySpecification.remove();
        }catch(e){}
    }
    __cursorMove(){ // Movimenta o cursor para carro e viagem em foco, se cursor atingir limites (vertical ou horiontal) move canvas para ajustar voualizacao
        this.cursor.style.top = `calc(${this.carroIndice + 1} * ${this.carroHeight} - ${this.carroTagWidth} - 17px)`;
        this.cursor.style.left = `calc((${this.viagemFocus.inicio}) * ${this.rulerUnit} + ${this.carroTagWidth} - 13px)`;
        // Ajusta estilo na freqRule dando enfase a viagem em foco
        this.rulerFreq.querySelectorAll('[data-selected=true]').forEach((el)=>{
            el.removeAttribute('data-selected');
            el.style.height = this.rulerSmallHeight;
            el.style.backgroundColor = this.rulerSmallColor;
        })
        if(![INTERVALO, ACESSO, RECOLHE].includes(this.viagemFocus.tipo)){ // Identifica viagem na rulerFreq se viagem for produtiva
            this.freqGrid[this.carroIndice][this.viagemIndice].setAttribute('data-selected', true);
            this.freqGrid[this.carroIndice][this.viagemIndice].style.backgroundColor = this.freqRulerSelectColor;
            this.freqGrid[this.carroIndice][this.viagemIndice].style.height = this.freqRulerSelectHeight;
        }
        // --
        if(this.viagemFocus.inicio < this.initialView){ // Verifica se cursor esta atingindo o limite horizontal a esquerda, se sim ajusta canvas
            let x = Math.ceil((this.initialView - this.viagemFocus.inicio) / this.rulerMediumUnit) * this.rulerMediumUnit;
            this.canvasMove(x * -1);
        }
        else if(this.viagemFocus.inicio > this.__getCanvasEndMargin()){// Verifica se cursor esta atingindo o limite horizontal a direita, se sim ajusta canvas
            let x = Math.ceil((this.viagemFocus.inicio - this.__getCanvasEndMargin()) / this.rulerMediumUnit) * this.rulerMediumUnit;
            this.canvasMove(x);
        }
        if(this.carroIndice < this.initialCarroView){ // Verifica se cursor esta atingindo o limite vertical superior, se sim ajusta canvas
            let y = (this.initialCarroView - this.carroIndice) * parseInt(this.carroHeight);
            this.initialCarroView = this.carroIndice;
            this.canvasMove(0, y);            
        }
        else if(this.carroIndice > (this.initialCarroView + this.maxCarsVisible - 1)){ // Verifica se cursor esta atingindo o limite vertical inferior, se sim ajusta canvas
            let y = this.carroIndice - (this.initialCarroView + this.maxCarsVisible - 1);
            this.initialCarroView += y;
            this.canvasMove(0, y * -1);            
        }
    }
    canvasFit(){ // Move canvas para posicao ajustada com a regua
        this.canvas.style.left = `calc(${this.rulerUnit} * ${this.initialView} * -1)`;
        this.rulerFreq.style.left = this.canvas.style.left;
    }
    canvasMove(x=0, y=0){ // Ajusta regua e move canvas em x e/ou y unidades
        // X valor em unidades (int) a ser movido o canvas
        // Y valor em unidades (int) representando os carros (2 = this.carroIndice += 2)
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
            this.canvas.style.top = `calc(${this.carroHeight} * ${this.initialCarroView} * ${y > 0 ? 1 : -1})`;
            this.carroLabels.forEach((el)=>{ // Move as labels dos carros no eixo y
                el.style.top = `calc(${el.style.top} + (${this.carroHeight} * ${y > 0 ? 1 : -1}))`;
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
        for(let i = 0; i < this.project.carros.length;i++){
            this.grid[i] = [];
            this.freqGrid[i] = [];
            for(let j = 0; j < this.project.carros[i].viagens.length; j++){
                this.addViagem(this.project.carros[i].viagens[j], i);
            } 
        }
        this.carroFocus = this.project.carros[this.carroIndice]
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
    __clearEscalaGrid(){ // Limpa toda interface de escala
        for(let i in this.escalaGrid){ // Apaga todos os elementos do grid
            for(let j = 0; j < this.escalaGrid[i].length; j++){
                this.escalaGrid[i][j].remove(); // Apaga escalas
            }
        }
        for(let i in this.spotsGrid){ // Apaga todos os elementos do grid
            for(let j = 0; j < this.spotsGrid[i].length; j++){
                this.spotsGrid[i][j].remove(); // Apaga spots
            }
        }
        this.escalaGrid = {};
        this.spotsGrid = {};
        this.canvas.innerHTML = ''; // Limpa restante dos componentes (carro e carro_tags)
    }
    __clearCarroLabels(){
        this.carroLabels.forEach((el)=>{el.remove()}); // Apaga todos os labels de frota
        this.carroLabels = [];
    }
    __getCanvasEndMargin(){ // Retorna (em minutos) a margem maxima a direita (usado para verificar limite antes do canvas movimentar)
        return this.initialView + this.maxMinutsVisible - this.fimMinutsMargin;
    }
    __showViagemPatterns(){
        if(this.patternsDialog){this.patternsDialog.close(); return false;} // Se modal ja esta aberto, fecha modal
        this.gridLocked = true; // Trava edicao do grid enquanto modal esta aberto
        this.patternsDialog = document.createElement('dialog');
        this.patternsDialog.innerHTML = `<h6>Padrão de Viagens<h6>IDA <div id="ida" style="margin-bottom:6px;width: 150px;height: 8px;border-radius: 10px;background-color: ${this.viagemOrigemColor};"></div>
        VOLTA <div id="volta" style="margin-bottom:6px;width: 150px;height: 8px;border-radius: 10px;background-color: ${this.viagemDestinoColor}"></div>
        RESERVADO <div id="reservado" style="margin-bottom:6px;width: 150px;height: 8px;border-radius: 10px;background: ${this.typePattern[RESERVADO].replaceAll('COLOR', this.viagemOrigemColor)};"></div>
        EXPRESSO <div id="expresso" style="margin-bottom:6px;width: 150px;height: 8px;border-radius: 10px;background: ${this.typePattern[EXPRESSO].replaceAll('COLOR', this.viagemOrigemColor)};"></div>
        SEMIEXPRESSO <div id="semi" style="margin-bottom:6px;width: 150px;height: 8px;border-radius: 10px;background: ${this.typePattern[SEMIEXPRESSO].replaceAll('COLOR', this.viagemOrigemColor)};"></div>
        ACESSO <div id="acesso" style="margin-bottom:6px;width: 150px;height: 8px;border-radius: 10px;background: ${this.typePattern[ACESSO].replaceAll('COLOR', this.viagemOrigemColor)};"></div>
        RECOLHE <div id="recolhe" style="margin-bottom:6px;width: 150px;height: 8px;border-radius: 10px;background: ${this.typePattern[RECOLHE].replaceAll('COLOR', this.viagemOrigemColor)};"></div>
        INTERVALO <div id="refeicao" style="margin-bottom:6px;width: 150px;height: 8px;border-radius: 10px;background: ${this.typePattern[INTERVALO].replaceAll('COLOR', this.viagemOrigemColor)};"></div>`;
        this.patternsDialog.addEventListener("close", (e) => {this.gridLocked = false;this.patternsDialog = null;}); // AO fechar destrava grid
        document.body.appendChild(this.patternsDialog);
        this.patternsDialog.showModal();
    }
    __showRouteMetrics(){
        canvasNavActive(false);
        this.gridLocked = true;
        let dialog = document.createElement('dialog'); dialog.style.minWidth = '600px';dialog.style.display = 'flex';dialog.style.columnGap = '15px';
        dialog.addEventListener('close', ()=>{this.gridLocked = false;dialog.remove();})
        let col1 = document.createElement('div'); col1.style.display = 'inline-block';col1.style.width = '25%';col1.innerHTML = `<h6 class="mb-2">Métricas - <span class="text-purple">${this.project.linha.prefix} ${this.project.linha.nome}</span></h6>`;
        let col2 = document.createElement('div'); col2.style.display = 'inline-block';col2.style.width = '75%';col2.style.borderLeft = '1px solid var(--bs-secondary-bg)';col2.style.paddingLeft = '15px';col2.innerHTML = '<h6 class="mb-2">Patamares de Operação</h6>'
        // Adicionado os controles das metricas
        let linhaCirc = document.createElement('input');linhaCirc.type = 'checkbox';linhaCirc.id = 'March_linhaCircControl';linhaCirc.checked = this.project.linha.circular;
        linhaCirc.disabled = true;
        // linhaCirc.onchange = () => {
        //     this.project.linha.circular = linhaCirc.checked;
        //     if(linhaCirc.checked){
        //         this.settingsBaselineToMin.disabled = true;
        //         this.settingsBaselineToInterv.disabled = true;
        //     }
        //     else{
        //         this.settingsBaselineToMin.disabled = false;
        //         this.settingsBaselineToInterv.disabled = false;
        //     }
        // }
        col1.appendChild(this.__settingsContainerSwitch(linhaCirc, 'Linha circular', '10px'));
        let col11 = document.createElement('div'); col11.style.display = 'inline-block';col11.style.width = '50%';
        this.settingsOrigemExtension = document.createElement('input');this.settingsOrigemExtension.type = 'number';this.settingsOrigemExtension.classList = 'flat-input';this.settingsOrigemExtension.min = 0;this.settingsOrigemExtension.max = 300;this.settingsOrigemExtension.value = this.project.linha.extensao_ida;this.settingsOrigemExtension.id = 'March_settingsOrigemExtension';this.settingsOrigemExtension.placeholder = ' ';
        this.settingsOrigemExtension.disabled = true;
        // this.settingsOrigemExtension.onchange = ()=>{
        //     if(this.settingsOrigemExtension.value == '' || parseInt(this.settingsOrigemExtension.value) < this.settingsOrigemExtension.min || parseInt(this.settingsOrigemExtension.value) > this.settingsOrigemExtension.max){
        //         this.settingsOrigemExtension.classList.add('is-invalid');
        //         return false;
        //     }
        //     this.settingsOrigemExtension.classList.remove('is-invalid');
        //     this.project.linha.extensao_ida = parseInt(this.settingsOrigemExtension.value);
        // }
        col11.appendChild(this.settingsOrigemExtension);
        col11.appendChild(this.__settingsAddCustomLabel(this.settingsOrigemExtension, 'Extensão Ida (km)'));
        col1.appendChild(col11);
        
        let col12 = document.createElement('div'); col12.style.display = 'inline-block';col12.style.width = '50%';
        this.settingsToExtension = document.createElement('input');this.settingsToExtension.type = 'number';this.settingsToExtension.classList = 'flat-input';this.settingsToExtension.min = 0;this.settingsToExtension.max = 300;this.settingsToExtension.value = this.project.linha.extensao_volta;this.settingsToExtension.id = 'March_settingsToExtension';this.settingsToExtension.placeholder = ' ';
        this.settingsToExtension.disabled = true;
        // this.settingsToExtension.onchange = ()=>{
        //     if(this.settingsToExtension.value == '' || parseInt(this.settingsToExtension.value) < this.settingsToExtension.min || parseInt(this.settingsToExtension.value) > this.settingsToExtension.max){
        //         this.settingsToExtension.classList.add('is-invalid');
        //         return false;
        //     }
        //     this.settingsToExtension.classList.remove('is-invalid');
        //     this.project.linha.extensao_volta = parseInt(this.settingsToExtension.value);
        // }
        col12.appendChild(this.settingsToExtension);
        col12.appendChild(this.__settingsAddCustomLabel(this.settingsToExtension, 'Extensão Volta (km)'));
        col1.appendChild(col12);
        
        let col13 = document.createElement('div'); col13.style.display = 'inline-block';col13.style.width = '50%';
        this.settingsAccessOrigemMin = document.createElement('input');this.settingsAccessOrigemMin.type = 'number';this.settingsAccessOrigemMin.classList = 'flat-input';this.settingsAccessOrigemMin.min = 1;this.settingsAccessOrigemMin.max = 300;this.settingsAccessOrigemMin.value = this.project.linha.metrics.origemMinAccess;this.settingsAccessOrigemMin.id = 'March_settingsAccessOrigemMin';this.settingsAccessOrigemMin.placeholder = ' ';
        this.settingsAccessOrigemMin.disabled = true;
        // this.settingsAccessOrigemMin.onchange = ()=>{
        //     if(this.settingsAccessOrigemMin.value == '' || parseInt(this.settingsAccessOrigemMin.value) < this.settingsAccessOrigemMin.min || parseInt(this.settingsAccessOrigemMin.value) > this.settingsAccessOrigemMin.max){
        //         this.settingsAccessOrigemMin.classList.add('is-invalid');
        //         return false;
        //     }
        //     this.settingsAccessOrigemMin.classList.remove('is-invalid');
        //     this.project.linha.metrics.origemMinAccess = parseInt(this.settingsAccessOrigemMin.value);
        // }
        col13.appendChild(this.settingsAccessOrigemMin);
        col13.appendChild(this.__settingsAddCustomLabel(this.settingsAccessOrigemMin, 'Acesso PT1 (min)'));
        col1.appendChild(col13);
        
        let col14 = document.createElement('div'); col14.style.display = 'inline-block';col14.style.width = '50%';
        this.settingsAccessToMin = document.createElement('input');this.settingsAccessToMin.type = 'number';this.settingsAccessToMin.classList = 'flat-input';this.settingsAccessToMin.min = 1;this.settingsAccessToMin.max = 300;this.settingsAccessToMin.value = this.project.linha.metrics.destinoMinAccess;this.settingsAccessToMin.id = 'March_settingsAccessToMin';this.settingsAccessToMin.placeholder = ' ';
        this.settingsAccessToMin.disabled = true;
        // this.settingsAccessToMin.onchange = ()=>{
        //     if(this.settingsAccessToMin.value == '' || parseInt(this.settingsAccessToMin.value) < this.settingsAccessToMin.min || parseInt(this.settingsAccessToMin.value) > this.settingsAccessToMin.max){
        //         this.settingsAccessToMin.classList.add('is-invalid');
        //         return false;
        //     }
        //     this.settingsAccessToMin.classList.remove('is-invalid');
        //     this.project.linha.metrics.destinoMinAccess = parseInt(this.settingsAccessToMin.value);
        // }
        col14.appendChild(this.settingsAccessToMin);
        col14.appendChild(this.__settingsAddCustomLabel(this.settingsAccessToMin, 'Acesso PT2 (min)'));
        col1.appendChild(col14);
        
        let col15 = document.createElement('div'); col15.style.display = 'inline-block';col15.style.width = '50%';
        this.settingsRecallOrigemMin = document.createElement('input');this.settingsRecallOrigemMin.type = 'number';this.settingsRecallOrigemMin.classList = 'flat-input';this.settingsRecallOrigemMin.min = 1;this.settingsRecallOrigemMin.max = 300;this.settingsRecallOrigemMin.value = this.project.linha.metrics.origemMinRecall;this.settingsRecallOrigemMin.id = 'March_settingsRecallOrigemMin';this.settingsRecallOrigemMin.placeholder = ' ';
        this.settingsRecallOrigemMin.disabled = true;
        // this.settingsRecallOrigemMin.onchange = ()=>{
        //     if(this.settingsRecallOrigemMin.value == '' || parseInt(this.settingsRecallOrigemMin.value) < this.settingsRecallOrigemMin.min || parseInt(this.settingsRecallOrigemMin.value) > this.settingsRecallOrigemMin.max){
        //         this.settingsRecallOrigemMin.classList.add('is-invalid');
        //         return false;
        //     }
        //     this.settingsRecallOrigemMin.classList.remove('is-invalid');
        //     this.project.linha.metrics.origemMinRecall = parseInt(this.settingsRecallOrigemMin.value);
        // }
        col15.appendChild(this.settingsRecallOrigemMin);
        col15.appendChild(this.__settingsAddCustomLabel(this.settingsRecallOrigemMin, 'Recolhe PT1 (min)'));
        col1.appendChild(col15);
        
        let col16 = document.createElement('div'); col16.style.display = 'inline-block';col16.style.width = '50%';
        this.settingsRecallToMin = document.createElement('input');this.settingsRecallToMin.type = 'number';this.settingsRecallToMin.classList = 'flat-input';this.settingsRecallToMin.min = 1;this.settingsRecallToMin.max = 300;this.settingsRecallToMin.value = this.project.linha.metrics.destinoMinRecall;this.settingsRecallToMin.id = 'March_settingsRecallToMin';this.settingsRecallToMin.placeholder = ' ';
        this.settingsRecallToMin.disabled = true;
        // this.settingsRecallToMin.onchange = ()=>{
        //     if(this.settingsRecallToMin.value == '' || parseInt(this.settingsRecallToMin.value) < this.settingsRecallToMin.min || parseInt(this.settingsRecallToMin.value) > this.settingsRecallToMin.max){
        //         this.settingsRecallToMin.classList.add('is-invalid');
        //         return false;
        //     }
        //     this.settingsRecallToMin.classList.remove('is-invalid');
        //     this.project.linha.metrics.destinoMinRecall = parseInt(this.settingsRecallToMin.value);
        // }
        col16.appendChild(this.settingsRecallToMin);
        col16.appendChild(this.__settingsAddCustomLabel(this.settingsRecallToMin, 'Recolhe PT2 (min)'));
        col1.appendChild(col16);
        
        let col17 = document.createElement('div'); col17.style.display = 'inline-block';col17.style.width = '50%';
        this.settingsAccessOrigemKm = document.createElement('input');this.settingsAccessOrigemKm.type = 'number';this.settingsAccessOrigemKm.classList = 'flat-input';this.settingsAccessOrigemKm.min = 0;this.settingsAccessOrigemKm.max = 300;this.settingsAccessOrigemKm.value = this.project.linha.metrics.origemKmAccess;this.settingsAccessOrigemKm.id = 'March_settingsAccessOrigemKm';this.settingsAccessOrigemKm.placeholder = ' ';
        this.settingsAccessOrigemKm.disabled = true;
        // this.settingsAccessOrigemKm.onchange = ()=>{
        //     if(this.settingsAccessOrigemKm.value == '' || parseInt(this.settingsAccessOrigemKm.value) < this.settingsAccessOrigemKm.min || parseInt(this.settingsAccessOrigemKm.value) > this.settingsAccessOrigemKm.max){
        //         this.settingsAccessOrigemKm.classList.add('is-invalid');
        //         return false;
        //     }
        //     this.settingsAccessOrigemKm.classList.remove('is-invalid');
        //     this.project.linha.metrics.origemKmAccess = parseInt(this.settingsAccessOrigemKm.value);
        // }
        col17.appendChild(this.settingsAccessOrigemKm);
        col17.appendChild(this.__settingsAddCustomLabel(this.settingsAccessOrigemKm, 'Acesso PT1 (km)'));
        col1.appendChild(col17);
        
        let col18 = document.createElement('div'); col18.style.display = 'inline-block';col18.style.width = '50%';
        this.settingsAccessToKm = document.createElement('input');this.settingsAccessToKm.type = 'number';this.settingsAccessToKm.classList = 'flat-input';this.settingsAccessToKm.min = 0;this.settingsAccessToKm.max = 300;this.settingsAccessToKm.value = this.project.linha.metrics.destinoKmAccess;this.settingsAccessToKm.id = 'March_settingsAccessToKm';this.settingsAccessToKm.placeholder = ' ';
        this.settingsAccessToKm.disabled = true;
        // this.settingsAccessToKm.onchange = ()=>{
        //     if(this.settingsAccessToKm.value == '' || parseInt(this.settingsAccessToKm.value) < this.settingsAccessToKm.min || parseInt(this.settingsAccessToKm.value) > this.settingsAccessToKm.max){
        //         this.settingsAccessToKm.classList.add('is-invalid');
        //         return false;
        //     }
        //     this.settingsAccessToKm.classList.remove('is-invalid');
        //     this.project.linha.metrics.destinoKmAccess = parseInt(this.settingsAccessToKm.value);
        // }
        col18.appendChild(this.settingsAccessToKm);
        col18.appendChild(this.__settingsAddCustomLabel(this.settingsAccessToKm, 'Acesso PT2 (km)'));
        col1.appendChild(col18);
        
        let col19 = document.createElement('div'); col19.style.display = 'inline-block';col19.style.width = '50%';
        this.settingsRecallOrigemKm = document.createElement('input');this.settingsRecallOrigemKm.type = 'number';this.settingsRecallOrigemKm.classList = 'flat-input';this.settingsRecallOrigemKm.min = 0;this.settingsRecallOrigemKm.max = 300;this.settingsRecallOrigemKm.value = this.project.linha.metrics.origemKmRecall;this.settingsRecallOrigemKm.id = 'March_settingsRecallOrigemKm';this.settingsRecallOrigemKm.placeholder = ' ';
        this.settingsRecallOrigemKm.disabled = true;
        // this.settingsRecallOrigemKm.onchange = ()=>{
        //     if(this.settingsRecallOrigemKm.value == '' || parseInt(this.settingsRecallOrigemKm.value) < this.settingsRecallOrigemKm.min || parseInt(this.settingsRecallOrigemKm.value) > this.settingsRecallOrigemKm.max){
        //         this.settingsRecallOrigemKm.classList.add('is-invalid');
        //         return false;
        //     }
        //     this.settingsRecallOrigemKm.classList.remove('is-invalid');
        //     this.project.linha.metrics.origemKmRecall = parseInt(this.settingsRecallOrigemKm.value);
        // }
        col19.appendChild(this.settingsRecallOrigemKm);
        col19.appendChild(this.__settingsAddCustomLabel(this.settingsRecallOrigemKm, 'Recolhe PT1 (km)'));
        col1.appendChild(col19);
        
        let col20 = document.createElement('div'); col20.style.display = 'inline-block';col20.style.width = '50%';
        this.settingsRecallToKm = document.createElement('input');this.settingsRecallToKm.type = 'number';this.settingsRecallToKm.classList = 'flat-input';this.settingsRecallToKm.min = 0;this.settingsRecallToKm.max = 300;this.settingsRecallToKm.value = this.project.linha.metrics.destinoKmRecall;this.settingsRecallToKm.id = 'March_settingsRecallToKm';this.settingsRecallToKm.placeholder = ' ';
        this.settingsRecallToKm.disabled = true;
        // this.settingsRecallToKm.onchange = ()=>{
        //     if(this.settingsRecallToKm.value == '' || parseInt(this.settingsRecallToKm.value) < this.settingsRecallToKm.min || parseInt(this.settingsRecallToKm.value) > this.settingsRecallToKm.max){
        //         this.settingsRecallToKm.classList.add('is-invalid');
        //         return false;
        //     }
        //     this.settingsRecallToKm.classList.remove('is-invalid');
        //     this.project.linha.metrics.destinoKmRecall = parseInt(this.settingsRecallToKm.value);
        // }
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
        this.settingsBaselineOrigemMin = document.createElement('input');this.settingsBaselineOrigemMin.type = 'number';this.settingsBaselineOrigemMin.classList = 'flat-input';this.settingsBaselineOrigemMin.min = 1;this.settingsBaselineOrigemMin.max = 300;this.settingsBaselineOrigemMin.value = CICLO_BASE;this.settingsBaselineOrigemMin.id = 'March_settingsBaselineOrigemMin';this.settingsBaselineOrigemMin.placeholder = ' ';
        this.settingsBaselineOrigemMin.onchange = () => {this.__settingsUpdateFreqSimulate()}
        col23.appendChild(this.settingsBaselineOrigemMin);
        col23.appendChild(this.__settingsAddCustomLabel(this.settingsBaselineOrigemMin, 'Ciclo Ida'));
        col2.appendChild(col23);
        
        let col24 = document.createElement('div'); col24.style.display = 'inline-block';col24.style.width = '12%';
        this.settingsBaselineToMin = document.createElement('input');this.settingsBaselineToMin.type = 'number';this.settingsBaselineToMin.classList = 'flat-input';this.settingsBaselineToMin.min = 1;this.settingsBaselineToMin.max = 300;this.settingsBaselineToMin.value = CICLO_BASE;this.settingsBaselineToMin.id = 'March_settingsBaselineToMin';this.settingsBaselineToMin.placeholder = ' ';
        this.settingsBaselineToMin.onchange = () => {this.__settingsUpdateFreqSimulate()}
        col24.appendChild(this.settingsBaselineToMin);
        col24.appendChild(this.__settingsAddCustomLabel(this.settingsBaselineToMin, 'Ciclo Volta'));
        col2.appendChild(col24);
        
        let col25 = document.createElement('div'); col25.style.display = 'inline-block';col25.style.width = '12%';
        this.settingsBaselineOrigemInterv = document.createElement('input');this.settingsBaselineOrigemInterv.type = 'number';this.settingsBaselineOrigemInterv.classList = 'flat-input';this.settingsBaselineOrigemInterv.min = 1;this.settingsBaselineOrigemInterv.max = 300;this.settingsBaselineOrigemInterv.value = 10;this.settingsBaselineOrigemInterv.id = 'March_settingsBaselineOrigemInterv';this.settingsBaselineOrigemInterv.placeholder = ' ';
        this.settingsBaselineOrigemInterv.onchange = () => {this.__settingsUpdateFreqSimulate()}
        col25.appendChild(this.settingsBaselineOrigemInterv);
        col25.appendChild(this.__settingsAddCustomLabel(this.settingsBaselineOrigemInterv, 'Intervalo Ida'));
        col2.appendChild(col25);
        
        let col26 = document.createElement('div'); col26.style.display = 'inline-block';col26.style.width = '12%';
        this.settingsBaselineToInterv = document.createElement('input');this.settingsBaselineToInterv.type = 'number';this.settingsBaselineToInterv.classList = 'flat-input';this.settingsBaselineToInterv.min = 1;this.settingsBaselineToInterv.max = 300;this.settingsBaselineToInterv.value = 1;this.settingsBaselineToInterv.id = 'March_settingsBaselineToInterv';this.settingsBaselineToInterv.placeholder = ' ';
        if(this.project.linha.circular){
            this.settingsBaselineToMin.disabled = true;
            this.settingsBaselineToInterv.disabled = true;
        }
        this.settingsBaselineToInterv.onchange = () => {this.__settingsUpdateFreqSimulate()}
        col26.appendChild(this.settingsBaselineToInterv);
        col26.appendChild(this.__settingsAddCustomLabel(this.settingsBaselineToInterv, 'Intervalo Volta'));
        col2.appendChild(col26);
        
        let col27 = document.createElement('div'); col27.style.display = 'inline-block';col27.style.width = '12%';
        this.settingsCarroSimulate = document.createElement('input');this.settingsCarroSimulate.type = 'number';this.settingsCarroSimulate.classList = 'flat-input w-auto';this.settingsCarroSimulate.min = 0;this.settingsCarroSimulate.max = 30;this.settingsCarroSimulate.value = 0;this.settingsCarroSimulate.id = 'March_settingsCarroSimulate';this.settingsCarroSimulate.placeholder = ' ';
        this.settingsCarroSimulate.onchange = () => {this.__settingsUpdateFreqSimulate()}
        col27.appendChild(this.settingsCarroSimulate);
        col27.appendChild(this.__settingsAddCustomLabel(this.settingsCarroSimulate, 'Frota (simulada)'));
        
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
                this.project.linha.param[i].origemMin = parseInt(this.settingsBaselineOrigemMin.value);
                this.project.linha.param[i].destinoMin = parseInt(this.settingsBaselineToMin.value);
                this.project.linha.param[i].origemInterv = parseInt(this.settingsBaselineOrigemInterv.value);
                this.project.linha.param[i].destinoInterv = parseInt(this.settingsBaselineToInterv.value);
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
            viagemOrigemColor: this.viagemOrigemColor,
            viagemDestinoColor: this.viagemDestinoColor,
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
        let carro = document.createElement('input');carro.type = 'number';carro.min = '1';carro.max = '40';carro.classList = 'flat-input';carro.placeholder = ' ';carro.id = 'March_generateCarro'
        let inicioOperation = document.createElement('input');inicioOperation.type = 'time';inicioOperation.value = min2Hour(INICIO_OPERACAO);inicioOperation.classList = 'flat-input';inicioOperation.placeholder = ' ';inicioOperation.id = 'March_generateStartOperation';
        let fimOperation = document.createElement('input');fimOperation.type = 'time';fimOperation.value = '23:00';fimOperation.classList = 'flat-input';fimOperation.placeholder = ' ';fimOperation.id = 'March_generateEndOperation';
        let submit = document.createElement('button');submit.type = 'button';submit.classList = 'btn btn-sm btn-phanton-warning px-3 ms-4';submit.innerHTML = 'Gerar';
        submit.onclick = async () => {
            dialog.close(); // Ao fechar lock do grid sera destravado (manter para tratar esc quando foco no modal)
            this.gridLocked = true; // Adiciona trava novamente
            let loading = document.createElement('dialog');loading.innerHTML = '<div class="spinner-border text-warning me-1"></div><span style="position: relative; top: -6px; left: 8px; padding-right: 10px;">Processando, aguarde...</span>'
            loading.addEventListener('cancel', (e)=>{e.preventDefault();}) // Previne fechar modal ao precionar esc
            document.body.appendChild(loading);
            loading.showModal();
            let metrics = {
                carro: parseInt(carro.value),
                inicio: hour2Min(inicioOperation.value),
                fim: hour2Min(fimOperation.value),
                addAccess: addAccess.checked
            }
            if(metrics.carro < 1 || !metrics.inicio || !metrics.fim){return false;}
            let r = await this.project.generate(metrics);
            if(r){
                this.__loadStage1();
            }
            else{appNotify('danger', '<b>Erro:</b> Ao gerar planejamento')}
            loading.close();
            loading.remove();
            this.gridLocked = false;
        }
        col1.appendChild(carro);
        col1.appendChild(this.__settingsAddCustomLabel(carro, 'Frota'));
        col2.appendChild(inicioOperation);
        col2.appendChild(this.__settingsAddCustomLabel(inicioOperation, 'Hora Inicial'));
        col3.appendChild(fimOperation);
        col3.appendChild(this.__settingsAddCustomLabel(fimOperation, 'Hora Final'));
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
        this.escalaFocus = null;
        this.initialCarroView = 0;
        if(this.summaryModal){this.summaryModal.remove()}
        if(this.transferAreaIcon){this.transferAreaIcon.remove()}
        this.__clearEscalaGrid();
        this.__canvasRebuild();
        if(!this.settingsShowFreqRule.checked){this.settingsShowFreqRule.click()}
        this.footer.style.display = 'block';
        this.rulerTop.style.display = 'block';
        this.__clearViagemDisplay();
        this.__clearCarroDisplay();
        appKeyMap.unbindGroup(['March_stage2','March_stage3']); // Limpa atalhos exclusivos das outras viewStage
        this.__addStage1Listeners(); // Adiciona novamente atalhos para stage 1
        this.__clearGrid(); // Apaga elemento do grid e freqGrid
        this.__clearCarroLabels(); // Apaga as labels dos carros
        this.__clearSelecao(); // Limpa selecao (caso exista)
        this.rulerUnit = this.defaultSettings.rulerUnit;
        this.rulerMediumUnit = this.defaultSettings.rulerMediumUnit;
        this.settingsrulerUnit.value = parseInt(this.defaultSettings.rulerUnit);
        this.settingsrulerMediumUnit.value = this.defaultSettings.rulerMediumUnit;
        for(let i = 0; i < this.project.carros.length; i++){ // Recria todos os carros e viagens
            this.addCarro(this.project.carros[i], i + 1);
        }
        if(this.project.carros.length > 0){ // Se projeto ja iniciado aponta para primeira viagem do primeiro carro
            this.carroFocus = this.project.carros[0];
            this.viagemFocus = this.project.carros[0].viagens[0];
            this.carroIndice = 0;
            this.viagemIndice = 0;
            this.__cursorMove();
            this.__updateViagemDisplay();
            this.initialView = min2Range(this.project.carros[0].viagens[0].inicio) * 60; // Ajusta a visao inicial do grid para a faixa da primeira viagem do projeto
            this.canvasFit();
            this.__buildRuler();
            this.carroLabels[this.carroIndice].style.color = 'var(--bs-link-color)';
            if(this.project.area_transferencia.length > 0)(this.__addToTransferAddLabel()) // Se existe viagem na area de transferencia, adiciona label
        }
        else{
            this.carroFocus = null;
            this.viagemFocus = null;
            this.carroIndice = -1;
            this.viagemIndice = -1;
            this.cursor.style.left = '-200px'
            this.canvasFit();
            this.__buildRuler();
        }
    }
    __loadStage2(){ // Carrega interface para manipulacao das escalas
        this.initialCarroView = 0;
        this.canvas.style.top = '0px';
        this.footer.style.display = 'none';
        this.rulerTop.style.display = 'block';
        this.arrowsVisible = true;
        if(this.summaryModal){this.summaryModal.remove()}
        if(this.settingsShowFreqRule.checked){this.settingsShowFreqRule.click()}
        appKeyMap.unbindGroup(['March_stage1','March_stage3']);
        this.__addStage2Listeners(); // Adiciona novamente atalhos para stage 1
        this.__clearGrid(); // Apaga elemento do grid e freqGrid
        this.__clearCarroLabels(); // Apaga as labels dos carros
        if(this.cursor){this.cursor.remove();} // Remove o cursor
        this.rulerUnit = '2px';
        this.rulerMediumUnit = 60;
        this.settingsrulerUnit.value = 2;
        this.settingsrulerMediumUnit.value = 60;
        if(this.project.carros.length > 0){
            this.initialView = min2Range(this.project.getFirstViagem()[0].inicio) * 60; // Ajusta a visao inicial do grid para a faixa da primeira viagem do projeto
        }
        this.__buildRuler();
        this.canvasFit();
        // --
        for(let i = 0; i < this.project.carros.length; i++){ // Constroi os escalas do carro
            let blocks = this.project.carros[i].getCarroEscalasBlock(this.project.linha);
            this.escalaGrid[i] = []; // Incicia array para armazenar escalas do carro
            this.spotsGrid[i] = []; // Incicia array para armazenar elements spots
            for(let y = 0; y < blocks.length; y++){
                let carro = document.createElement('div');carro.style = 'position:absolute;display: flex;height: 45px;border:1px solid #495057;border-radius: 3px;'
                carro.style.width = `calc(${this.rulerUnit} * ${blocks[y].size})`;
                carro.style.top = `calc(${this.carroHeight} * ${i + 1} - ${this.carroHeight} + 10px)`;
                carro.style.left = `calc(${this.carroTagWidth} + (${blocks[y].inicio} * ${this.rulerUnit}))`;
                this.canvas.appendChild(carro);
                // Adiciona pontos de rfimicao de cada bloco
                for(let x = 0; x < blocks[y].spots.length; x++){
                    let sp = document.createElement('i');sp.style.position = 'absolute';sp.style.zIndice = '80';
                    sp.style.opacity = '10%';
                    sp.style.top = `calc(${this.carroHeight} * ${i + 1} - 12px)`;
                    sp.style.left = `calc(${this.carroTagWidth} + ${blocks[y].spots[x].time} * ${this.rulerUnit} - 9px)`;
                    sp.title = blocks[y].spots[x].locale.nome;
                    if(blocks[y].spots[x].tipo == 'viagemEnd'){sp.classList = 'bi bi-caret-down-fill marchSpot pt-1';}
                    else{sp.classList = 'bi bi-pin-map-fill marchSpot';}
                    sp.onclick = () => {
                        if(this.escalaFocus == null || this.escalaFocus[0] != i || this.escalaFocus[2] != y){return false}
                        let r;
                        if(blocks[y].spots[x].tipo == 'viagemEnd'){
                            r = this.project.carros[this.escalaFocus[0]].updateEscala(this.escalaFocus[1],{fim: blocks[y].spots[x].viagemIndice, deltaEnd: 0, local: blocks[y].spots[x].locale}, blocks[y].inicioIndice, blocks[y].fimIndice);
                        }
                        else{
                            r = this.project.carros[this.escalaFocus[0]].updateEscala(this.escalaFocus[1],{fim: blocks[y].spots[x].viagemIndice, deltaEnd: blocks[y].spots[x].delta, local: blocks[y].spots[x].locale}, blocks[y].inicioIndice, blocks[y].fimIndice);
                        }
                        if(r){  // Ajustar para atualizar o blocks
                            this.__cleanEscalaGrid(i);
                            this.__updateCarroEscalas(i, this.project.carros[i].getCarroEscalasBlock(this.project.linha))
                        }
                    }
                    this.canvas.appendChild(sp);
                    this.spotsGrid[i].push(sp);                    
                }
            }
            let carro_tag = document.createElement('div');carro_tag.style = 'position: absolute; user-select: none;';
            carro_tag.style.top = `calc(${this.carroHeight} * ${i + 1} - 25px)`;
            carro_tag.style.left = `calc(${this.carroTagWidth} + (${blocks[0].inicio} * ${this.rulerUnit}) - 22px)`;
            carro_tag.innerHTML = String(i + 1).padStart(2,'0');
            this.__updateCarroEscalas(i, blocks);
            this.canvas.appendChild(carro_tag);
        }
        this.__updateEscalaArrows(); // Adiciona arrows nas escalas
        if(this.project.carros.length > 0){
            this.escalaFocus = [0,0,0];
            this.escalaGrid[0][0].style.backgroundColor = '#032830'
        }
    }
    __loadStage3(){ // Carrega interface de conclusao e resumo do projeto
        this.escalaFocus = null;
        this.canvas.style.top = '0px';
        this.__clearGrid(); // Apaga elemento do grid e freqGrid
        this.__clearEscalaGrid();
        if(this.summaryModal){this.summaryModal.remove()}
        this.footer.style.display = 'none';
        this.__clearCarroLabels(); // Apaga as labels dos carros
        this.__clearSelecao(); // Limpa selecao (caso exista)
        if(this.settingsShowFreqRule.checked){this.settingsShowFreqRule.click()}
        this.rulerTop.style.display = 'none';
        if(this.cursor){this.cursor.remove();} // Remove o cursor
        appKeyMap.unbindGroup(['March_stage1','March_stage3']); // Limpa atalhos exclusivos das outras viewStage
        // ****
        this.summaryModal = document.createElement('dialog');this.summaryModal.style = 'border: 1px solid #FFF; width: 1000px; position: absolute; top: 60px';
        this.summaryModal.addEventListener('cancel', (ev)=>{ev.preventDefault();})
        let summary1 = this.project.countViagens(); // Gera resumo das viagens planejadas
        let summary2 = this.project.countOperatores(); // Gera resumo de mao de obra
        let km_produtiva = parseFloat((summary1.origem * this.project.linha.extensao_ida) + (summary1.destino * this.project.linha.extensao_volta));
        let km_improdutiva = parseFloat((summary1.accessFrom * this.project.linha.metrics.acesso_origem_km) + (summary1.accessTo * this.project.linha.metrics.acesso_destino_km) + (summary1.lazyFrom * this.project.linha.extensao_ida) + (summary1.lazyTo * this.project.linha.extensao_volta));
        let perc_produtiva = km_produtiva / (km_produtiva + km_improdutiva) * 100 || 0;
        let perc_improdutiva = km_improdutiva / (km_produtiva + km_improdutiva) * 100 || 0;
        this.summaryModal.innerHTML = `
        <h6>Resumo de Projeto</h6><hr>
        <div style="display: flex;gap: 10px;">
            <table>
                <tbody>
                    <tr><td style="padding-right: 10px;">Frota</td><td>${this.project.carros.length}</td></tr>
                    <tr><td style="padding-right: 10px;">Viagens Produtivas</td><td>${summary1.origem + summary1.destino}</td></tr>
                    <tr><td style="padding-right: 10px;">Viagens Reservadas</td><td>${summary1.lazyFrom + summary1.lazyTo}</td></tr>
                    <tr><td style="padding-right: 10px;">Km planejada</td><td>${formatCur(km_produtiva + km_improdutiva)}</td></tr>
                    <tr><td colspan="2"><hr class="m-0"></td></tr>
                    <tr><td style="padding-right: 10px;text-align: right;">Ida</td><td>${summary1.origem}</td></tr>
                    <tr><td style="padding-right: 10px;text-align: right;">Volta</td><td>${summary1.destino}</td></tr>
                    <tr><td style="padding-right: 10px;text-align: right;">Expresso</td><td>${summary1.expresso}</td></tr>
                    <tr><td style="padding-right: 10px;text-align: right;">Semiexpresso</td><td>${summary1.semiexpresso}</td></tr>
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
                    <table class="text-inicio mb-2">
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
                        <tr><td style="padding-right: 20px;">Projeto:</td><td><b class="text-secondary">${this.project.nome}</b></td></tr>
                        <tr><td style="padding-right: 20px;">Linha:</td><td><b class="text-secondary">${this.project.linha.codigo}</b></td></tr>
                        <tr><td style="padding-right: 20px;">Nome:</td><td><b class="text-secondary">${this.project.linha.nome}</b></td></tr>
                        <tr><td style="padding-right: 20px;">Status:</td><td><b class="text-secondary" id="March_summaryActiveLabel">${this.project.active ? '<b class="text-success">Ativo</b>' : '<b class="text-secondary">Inativo</b>'}</b></td></tr>
                        <tr><td colspan="2"><hr class="my-2"></td></tr>
                        <tr><td colspan="2" class="text-secondary">${this.project.desc}</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
        <hr>
        <h6>Oferta x Demanda</h6>
        <div class="bg-body-tertiary text-center">IDA</div>
        <div style="height: 200px;"><canvas id="March_summaryOD_IDA_canvas"></canvas></div>
        <div class="bg-body-tertiary text-center">VOLTA</div>
        <div style="height: 200px;margin-bottom: 60px;"><canvas id="March_summaryOD_VOLTA_canvas"></canvas></div>
        `;
        let summaryWorkerControl = document.createElement('input');summaryWorkerControl.type = 'checkbox';summaryWorkerControl.role = 'switch';summaryWorkerControl.id = 'March_summaryWorkerControl';
        summaryWorkerControl.onclick = () => {
            if(summaryWorkerControl.checked){document.getElementById('March_summaryWorkersQtde').innerHTML = summary2.workers + summary2.half;}
            else{document.getElementById('March_summaryWorkersQtde').innerHTML = summary2.workers;}
        }
        document.body.appendChild(this.summaryModal);
        
        document.getElementById('March_summaryWorkerControls').appendChild(this.__settingsContainerSwitch(summaryWorkerControl, 'Contar aproveitamentos'));
        
        let summaryProjectSumbit = document.createElement('button');summaryProjectSumbit.type = 'button';summaryProjectSumbit.classList = 'btn btn-sm btn-phanton-success mt-3 float-end fw-bold';summaryProjectSumbit.id = 'March_summaryProjectSubmit';summaryProjectSumbit.innerHTML = 'Gravar e Fechar'
        summaryProjectSumbit.onclick = ()=>{
            this.project.save();
            localStorage.removeItem('marchCurrentProject');
        };
        document.getElementById('March_summaryBlock3Container').appendChild(summaryProjectSumbit);
        
        let summaryProjectExport = document.createElement('button');summaryProjectExport.type = 'button';summaryProjectExport.classList = 'btn btn-sm btn-phanton mt-3 me-2 float-end fw-bold';summaryProjectExport.id = 'March_summaryProjectExport';summaryProjectExport.innerHTML = 'Exportar';
        summaryProjectExport.onclick = () => {this.project.exportJson()}
        document.getElementById('March_summaryBlock3Container').appendChild(summaryProjectExport);

        // Gera Grafico de oferta e demanda (requer chartJS)
        let od = this.project.supplyNDemand();
        let od_idaChart = new Chart(document.getElementById('March_summaryOD_IDA_canvas'), {
            data: {
                datasets: [{
                    type: 'line',
                    label: 'Demanda',
                    data: od[1].demanda_ida,
                    pointBorderWidth: 4,
                    hoverBorderWidth: 8,
                    pointHitRadius: 8,
                    borderColor: '#C0504D',
                },{
                    type: 'bar',
                    label: 'Oferta',
                    data: od[1].oferta_ida,
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
            }
        });
        let od_voltaChart = new Chart(document.getElementById('March_summaryOD_VOLTA_canvas'), {
            data: {
                datasets: [{
                    type: 'line',
                    label: 'Demanda',
                    data: od[1].demanda_volta,
                    pointBorderWidth: 4,
                    hoverBorderWidth: 8,
                    pointHitRadius: 8,
                    borderColor: '#C0504D',
                },{
                    type: 'bar',
                    label: 'Oferta',
                    data: od[1].oferta_volta,
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
            }
        });        
        this.summaryModal.show();
    }
    __escalaAddContent(options){
        let inicio, fim;
        if(this.project.carros[options.carro_index].escalas[options.escala_index].deltaStart > 0){
            inicio = min2Hour(this.project.carros[options.carro_index].viagens[this.project.carros[options.carro_index].escalas[options.escala_index].inicio - 1].inicio + this.project.carros[options.carro_index].escalas[options.escala_index].deltaStart);
        }
        else{inicio = min2Hour(this.project.carros[options.carro_index].viagens[this.project.carros[options.carro_index].escalas[options.escala_index].inicio].inicio)}
        // ---
        if(this.project.carros[options.carro_index].escalas[options.escala_index].deltaEnd > 0){
            fim = min2Hour(this.project.carros[options.carro_index].viagens[this.project.carros[options.carro_index].escalas[options.escala_index].fim].inicio + this.project.carros[options.carro_index].escalas[options.escala_index].deltaEnd - 1);
        }
        else{fim = min2Hour(this.project.carros[options.carro_index].viagens[this.project.carros[options.carro_index].escalas[options.escala_index].fim].fim)}
        let jornada = this.project.carros[options.carro_index].getEscalaJourney(options.escala_index);
        let previous, next;

        if(this.project.carros[options.carro_index].escalas[options.escala_index].next?.externalProject){ // Verifica se existe complmento de jornada em outra linha posterior a esta
            next = {nome: `[ ${this.project.carros[options.carro_index].escalas[options.escala_index].next.externalProject} ]`}
        }
        if(this.project.carros[options.carro_index].escalas[options.escala_index].previous?.externalProject){ // Verifica se existe complemento de jornada em outra linha anterior a esta
            previous = {nome: `[ ${this.project.carros[options.carro_index].escalas[options.escala_index].previous.externalProject} ]`}
        }
        return `<div><b data-type="escala-next" class="ms-1">${previous ? previous.nome + ' <i class="bi bi-arrow-left me-1"></i>': ''}</b><b data-type="escala-nome" class="me-2">${this.project.carros[options.carro_index].escalas[options.escala_index].nome}</b>${min2Hour(jornada)}<b data-type="escala-next" class="ms-1">${next ? '<i class="bi bi-arrow-right ms-1"></i> ' + next.nome : ''}</b><div class="fs-8 text-center text-secondary">${inicio}&nbsp;&nbsp;&nbsp;${fim}</div></div>`;
    }
    __updateCarroEscalas(carro_index, blocks){ // Refaz escalas do carro informado
        this.escalaGrid[carro_index].forEach((el) => {el.remove()});
        this.escalaGrid[carro_index] = []; // Incicia array para armazenar escalas do carro
        for(let j = 0; j < this.project.carros[carro_index].escalas.length; j++){ // Percorre todos os escalas ja definidos e adiciona no carro
            let metrics = this.project.carros[carro_index].getEscalaJourney(j, true);
            let bg = this.escalaFocus && JSON.stringify([this.escalaFocus[0], this.escalaFocus[1]]) == JSON.stringify([carro_index, j]) ? '#032830' : '#1a1d20';
            let sq = document.createElement('div');sq.setAttribute('data-bs-theme', 'dark'); sq.style = `height: 43px;border-right: 2px solid #495057;text-align: center;background-color: ${bg};color: #ced4da;user-select: none; position: absolute;z-index: 50;`;
            sq.style.left = `calc(${metrics[1]} * ${this.rulerUnit} + ${this.carroTagWidth} + 1px)`;
            sq.style.top = `calc(${this.carroHeight} * ${carro_index + 1} - ${this.carroHeight} + 11px)`;
            sq.innerHTML = this.__escalaAddContent({carro_index: carro_index, escala_index: j});
            sq.style.width = `calc(${metrics[0]} * ${this.rulerUnit} - 1px)`;
            sq.onclick = () => {
                if(this.escalaFocus){this.escalaGrid[this.escalaFocus[0]][this.escalaFocus[1]].style.backgroundColor = '#1a1d20';}
                sq.style.backgroundColor = '#032830';
                let target_block = null;
                for(let x = 0; x < blocks.length; x++){ // Verifica a qual bloco a viagem pertence
                    if(project.project.carros[carro_index].escalas[j].inicio >= blocks[x].inicioIndice && project.project.carros[carro_index].escalas[j].fim <= blocks[x].fimIndice){ target_block = x}
                }
                this.escalaFocus = [carro_index, j, target_block];
            }
            if(this.project.carros[carro_index].escalas[j].previous == null){
                let previous = document.createElement('i');previous.classList = 'bi bi-arrow-bar-left px-1 py-1 fs-5 pointer';previous.style.position = 'absolute';previous.style.left = '5px';previous.style.top = '3px';
                previous.onclick = (ev) => {
                    ev.stopImmediatePropagation();
                    if(!this.escalaSelecao){
                        this.escalaSelecao = [carro_index, j, previous];
                        this.__escalaExternalControl('previous', blocks); // Adiciona controle para externalProject
                    }
                    if(this.escalaSelecao[0] != carro_index || this.escalaSelecao[1] != j){
                        let inicio = this.project.carros[carro_index].viagens[this.project.carros[carro_index].escalas[j].inicio];
                        let fim = this.project.carros[this.escalaSelecao[0]].viagens[this.project.carros[this.escalaSelecao[0]].escalas[this.escalaSelecao[1]].fim];
                        if(fim.fim > inicio.inicio){return false}
                        this.project.carros[this.escalaSelecao[0]].escalas[this.escalaSelecao[1]].next = {externalProject: null, carro: carro_index, escala: j};
                        this.project.carros[carro_index].escalas[j].previous = {externalProject: null, carro: this.escalaSelecao[0], escala: this.escalaSelecao[1]};
                        this.__updateCarroEscalas(carro_index, blocks);
                        if(this.escalaSelecao[0] != carro_index){this.__updateCarroEscalas(this.escalaSelecao[0], blocks);}
                        this.__updateEscalaArrows();
                        this.escalaSelecao = null;
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
                    if(!this.project.carros[carro_index].escalas[j].previous.externalProject){
                        destiny = this.project.carros[carro_index].escalas[j].previous;
                        this.project.carros[destiny.carro].escalas[destiny.escala].next = null;
                    }
                    if(!this.project.carros[carro_index].escalas[j].previous.externalProject && carro_index != destiny.carro){
                        this.__updateCarroEscalas(destiny.carro, blocks);
                    }
                    this.project.carros[carro_index].escalas[j].previous = null;
                    this.__updateCarroEscalas(carro_index, blocks);
                    this.__updateEscalaArrows();
                }
                sq.appendChild(previous);
            }
            if(this.project.carros[carro_index].escalas[j].next == null){
                let next = document.createElement('i');next.classList = 'bi bi-arrow-bar-right px-1 py-1 fs-5 pointer';next.style.position = 'absolute';next.style.right = '5px';next.style.top = '3px';
                next.onclick = (ev) => {
                    ev.stopImmediatePropagation();
                    if(this.escalaSelecao && (this.escalaSelecao[0] != carro_index || this.escalaSelecao[1] != j)){return null} // So seleciona caso nao existe escala selecionada
                    if(this.escalaSelecao && this.escalaSelecao[0] == carro_index && this.escalaSelecao[1] == j){ // Se precionar novamente cancela selecao de escala
                        next.classList = 'bi bi-arrow-bar-right px-1 py-1 fs-5 pointer';
                        this.escalaSelecao = null;
                        this.externalControl.remove();
                    }
                    else{
                        next.classList = 'bi bi-arrow-left-right py-1 pe-1 fs-5 pointer';
                        this.escalaSelecao = [carro_index, j, next];
                        this.__escalaExternalControl('next', blocks); // Adiciona controle para externalProject
                    }
                }
                sq.appendChild(next);
            }
            else{
                let next = document.createElement('i');next.classList = 'bi bi-x-lg px-1 py-1 fs-5 pointer';next.style.position = 'absolute';next.style.right = '5px';next.style.top = '3px';
                next.onclick = (ev) => { // Remove o apontamento de next do alvo e o previous do correlato
                    ev.stopImmediatePropagation();
                    let destiny;
                    if(!this.project.carros[carro_index].escalas[j].next.externalProject){
                        destiny = this.project.carros[carro_index].escalas[j].next;
                        this.project.carros[destiny.carro].escalas[destiny.escala].previous = null;
                    }
                    if(!this.project.carros[carro_index].escalas[j].next.externalProject && carro_index != destiny.carro){
                        this.__updateCarroEscalas(destiny.carro, blocks);
                    }
                    this.project.carros[carro_index].escalas[j].next = null;
                    this.__updateCarroEscalas(carro_index, blocks);
                    this.__updateEscalaArrows();
                }
                sq.appendChild(next);
            }
            this.canvas.appendChild(sq);
            this.escalaGrid[carro_index].push(sq);
        }
        // Se existe viagens sem escala no bloco, insere bloco empty
        for(let i = 0; i < blocks.length; i++){
            if(blocks[i].emptyStart == undefined){continue}
            let sq = document.createElement('div');sq.style = `height: 43px;text-align: center;user-select: none; position: absolute;z-index: 50; padding-top: 5px`;
            sq.setAttribute('data-type', 'emptyEscala');
            let left;
            if(blocks[i].deltaEnd == 0){left = this.project.carros[carro_index].viagens[blocks[i].emptyStart].inicio}
            else{
                left = this.project.carros[carro_index].viagens[blocks[i].emptyStart - 1].inicio + blocks[i].deltaEnd;
            }
            sq.style.left = `calc(${left} * ${this.rulerUnit} + ${this.carroTagWidth} + 1px)`;
            sq.style.top = `calc(${this.carroHeight} * ${carro_index + 1} - ${this.carroHeight} + 11px)`;
            sq.innerHTML = '<i class="bi bi-plus-lg fs-5 text-secondary"></i>';
            
            let jornada = blocks[i].inicio + blocks[i].size - left;
            sq.style.width = `calc(${jornada} * ${this.rulerUnit} - 2px)`;
            sq.onclick = () => {
                if(this.escalaFocus){this.escalaGrid[this.escalaFocus[0]][this.escalaFocus[1]].style.backgroundColor = '#1a1d20';}
                let r = this.project.addEscala(carro_index, {inicio: blocks[i].emptyStart, fim: blocks[i].fimIndice, deltaEnd: 0, deltaStart: 0, next: null, previous: null})
                this.escalaFocus = [carro_index, r, i];
                this.__updateCarroEscalas(carro_index, this.project.carros[carro_index].getCarroEscalasBlock(this.project.linha))
            }
            this.canvas.appendChild(sq);
            this.escalaGrid[carro_index].push(sq);
            this.escalaGrid[carro_index].sort((a, b) => a.offsetLeft > b.offsetLeft ? 1 : -1);
        }
    }
    __updateEscalaArrows(){
        for(let i in this.escalaArrowsGrid){ // Apaga todos as arrows do canvas
            this.escalaArrowsGrid[i].forEach((el)=>{el.destroy();});
        }
        for(let i = 0; i < this.project.carros.length; i++){ // Monta arrows
            this.escalaArrowsGrid[i] = []; // Reinicia dicionario
            for(let j = 0; j < this.project.carros[i].escalas.length; j++){
                if(this.project.carros[i].escalas[j].next && !this.project.carros[i].escalas[j].next.externalProject){
                    let arrow = new jsELConnector({
                        from: this.escalaGrid[i][j],
                        to: this.escalaGrid[this.project.carros[i].escalas[j].next.carro][this.project.carros[i].escalas[j].next.escala],
                        container: this.canvas,               
                    });
                    this.escalaArrowsGrid[i].push(arrow);
                }
            }
        }
    }
    __escalaExternalControl(position, blocks){ // Exibe modal para adicao de externalProject na escala
        let el = this.escalaGrid[this.escalaSelecao[0]][this.escalaSelecao[1]];
        this.externalControl = document.createElement('button');this.externalControl.type = 'button';this.externalControl.classList = 'btn btn-sm btn-phanton'; this.externalControl.innerHTML = 'Externo';
        this.externalControl.style = `position: absolute; top: ${el.offsetTop + 5}px;left: ${el.offsetLeft + el.offsetWidth + 5}px;z-index: 200;`;
        this.externalControl.onclick = () => {
            this.gridLocked = true;
            let modal = document.createElement('dialog');modal.style.width = '200px';
            modal.addEventListener('close', ()=>{
                this.gridLocked = false;
                if(position == 'previous'){
                    this.externalControl.remove();
                    this.escalaSelecao = null;
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
                let s = {externalProject: `${name.value}:${tabela.value}`, carro: null, escala: null, journey: hour2Min(jornada.value)}
                if(!s.journey){jornada.classList.add('is-invalid')}
                if(modal.querySelectorAll('.is-invalid').length > 0){return false}
                this.project.carros[this.escalaSelecao[0]].escalas[this.escalaSelecao[1]][position] = s;
                this.__updateCarroEscalas(this.escalaSelecao[0], blocks);
                this.escalaSelecao = null;
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
        for(let i in this.escalaArrowsGrid){
            this.escalaArrowsGrid[i].forEach((el) => {el.setVisibility(v)});
        }
    }
    __cleanEscalaGrid(carro_index){ // Limpa as escalas do carro informado (nao remove nem carro nem spots)
        for(let i in this.escalaGrid[carro_index]){
            this.escalaGrid[carro_index][i].remove();
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
        appKeyMap.bind({group: 'March_stage1', key: ';', alt: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Novo carro', desc: 'Insere carro no projeto', run: ()=>{if(this.__gridIsBlock()){return false};this.addCarro()}})
        appKeyMap.bind({group: 'March_stage1', key: '.', alt: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Adicionar Viagem', desc: 'Insere viagem ao final do carro', run: ()=>{
            if(this.__gridIsBlock() || !this.viagemFocus){return false}
            if(this.project.carros[this.carroIndice].escalas.length > 0){
                this.__modalConfirmationChangeProject(()=>{
                    this.project.carros[this.carroIndice].escalas = [];
                    this.addViagem();
                })
            }
            else{this.addViagem();}
        }})
        appKeyMap.bind({group: 'March_stage1', key: '.', alt: true, ctrl: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Adicionar Viagem AS', desc: 'Insere viagem para carro informando inicio', run: ()=>{
            if(this.__gridIsBlock() || !this.viagemFocus){return false;}
            if(this.project.carros[this.carroIndice].escalas.length > 0){
                this.__modalConfirmationChangeProject(()=>{
                    this.project.carros[this.carroIndice].escalas = [];
                    this.addViagemAt()
                })
            }
            else{this.addViagemAt();}
        }})

        appKeyMap.bind({group: 'March_stage1', key: 'arrowright', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Navegar próxima viagem', desc: 'Move foco para próxima viagem do carro', run: (ev)=>{
            if(!this.viagemFocus || this.__gridIsBlock()){return false}
            ev.preventDefault();
            if(this.project.carros[this.carroIndice].viagens.length > this.viagemIndice + 1){
                this.viagemIndice++;
                this.viagemFocus = this.project.carros[this.carroIndice].viagens[this.viagemIndice];
                this.__cursorMove();
                this.__updateViagemDisplay();
                
            }
        }})
        appKeyMap.bind({group: 'March_stage1', key: 'arrowleft', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Navegar viagem anterior', desc: 'Move foco para viagem anterior do carro', run: (ev)=>{
            if(!this.viagemFocus || this.__gridIsBlock()){return false}
            ev.preventDefault();
            if(this.viagemIndice > 0){
                this.viagemIndice--;
                this.viagemFocus = this.project.carros[this.carroIndice].viagens[this.viagemIndice];
                this.__cursorMove();
                this.__updateViagemDisplay();
            }
        }})
        appKeyMap.bind({group: 'March_stage1', key: 'arrowdown', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Navegar próximo carro', desc: 'Move foco para próximo carro', run: (ev)=>{
            if(!this.viagemFocus || this.__gridIsBlock()){return false}
            ev.preventDefault();
            this.__clearCarroDisplay(); // Ao alterar de carro, limpa o resumo (caso exibido)
            if(this.project.carros.length > this.carroIndice + 1){
                this.carroLabels[this.carroIndice].style.color = 'inherit';
                this.carroIndice++;
                this.carroLabels[this.carroIndice].style.color = 'var(--bs-link-color)';
                this.carroFocus = this.project.carros[this.carroIndice];
                // Identifica viagem mais proxima do proximo carro para mover cursor
                let bestMatch = this.project.carros[this.carroIndice].viagens[0];
                let inicio = this.viagemFocus.inicio;
                let escape = false;
                this.viagemIndice = 0;
                while(!escape){
                    // Percorre viagens do proximo carro ate final ou ate achar melhor correspondente
                    // Se viagem analisada inicia apos (ou no mesmo horario) de bestMatch termina execucao
                    if( this.project.carros[this.carroIndice].viagens.length == this.viagemIndice + 1 ||
                        this.project.carros[this.carroIndice].viagens[this.viagemIndice + 1].inicio >= inicio){escape = true}
                    else{
                        this.viagemIndice++;
                        bestMatch = this.project.carros[this.carroIndice].viagens[this.viagemIndice];
                    }
                }
                this.viagemFocus = bestMatch;
                this.__cursorMove();
                this.__updateViagemDisplay();
            }
        }})
        appKeyMap.bind({group: 'March_stage1', key: 'arrowup', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Navegar carro anterior', desc: 'Move foco para carro anterior', run: (ev) => {
            if(!this.viagemFocus || this.__gridIsBlock()){return false}
            ev.preventDefault();
            this.__clearCarroDisplay(); // Ao alterar de carro, limpa o resumo (caso exibido)
            if(this.carroIndice > 0){
                this.carroLabels[this.carroIndice].style.color = 'inherit';
                this.carroIndice--;
                this.carroLabels[this.carroIndice].style.color = 'var(--bs-link-color)';
                this.carroFocus = this.project.carros[this.carroIndice];
                // Identifica viagem mais proxima do proximo carro para mover cursor
                let bestMatch = this.project.carros[this.carroIndice].viagens[0];
                let inicio = this.viagemFocus.inicio;
                let escape = false;
                this.viagemIndice = 0;
                while(!escape){
                    // Percorre viagens do proximo carro ate final ou ate achar melhor correspondente
                    // Se viagem analisada inicia apos (ou no mesmo horario) de bestMatch termina execucao
                    if( this.project.carros[this.carroIndice].viagens.length == this.viagemIndice + 1 ||
                        this.project.carros[this.carroIndice].viagens[this.viagemIndice + 1].inicio > inicio){escape = true}
                    else{
                        this.viagemIndice++;
                        bestMatch = this.project.carros[this.carroIndice].viagens[this.viagemIndice];
                    }
                }
                this.viagemFocus = bestMatch;
                this.__cursorMove();
                this.__updateViagemDisplay();
            }
        }})
        appKeyMap.bind({group: 'March_stage1', key: '/', alt: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Régua frequência', desc: 'Exibe/oculta régua de frequência', run: ()=>{this.settingsShowFreqRule.click()}})
        appKeyMap.bind({group: 'March_stage1', key: '+', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Viagem Plus', desc: 'Aumenta 1 min ao final da viagem e nas posteriores', run: (ev)=>{if(!this.viagemFocus || this.__gridIsBlock()){return false}ev.preventDefault();this.plus();}})
        appKeyMap.bind({group: 'March_stage1', key: '+', shift: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Viagem Plus (single)', desc: 'Aumenta 1 minuto na viagem', run: ()=>{if(!this.viagemFocus || this.__gridIsBlock()){return false}this.plus(false)}})
        appKeyMap.bind({group: 'March_stage1', key: '-', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Viagem Sub', desc: 'Subtrai 1 min ao final da viagem e nas posteriores', run: (ev)=>{if(!this.viagemFocus || this.__gridIsBlock()){return false}ev.preventDefault();this.sub();}})
        appKeyMap.bind({group: 'March_stage1', key: '-', shift: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Viagem Sub (single)', desc: 'Subtrai 1 minuto na viagem', run: ()=>{if(!this.viagemFocus || this.__gridIsBlock()){return false}this.sub(false)}})
        appKeyMap.bind({group: 'March_stage1', key: ' ', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Atrasar', desc: 'Atrasa inicio em 1 minuto, move posteriores', run: (ev)=>{if(!this.viagemFocus || this.__gridIsBlock()){return false}ev.preventDefault();this.advance();}})
        appKeyMap.bind({group: 'March_stage1', key: ' ', shift: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Atrasar (single)', desc: 'Aumenta 1 min no inicio da viagem', run: ()=>{if(!this.viagemFocus || this.__gridIsBlock()){return false}
            this.moveStart();
            this.__cursorMove();
        }})
        appKeyMap.bind({group: 'March_stage1', key: 'backspace', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Adiantar', desc: 'Adianta em 1 min inicio da viagem e nas posteriores', run: (ev)=>{if(!this.viagemFocus || this.__gridIsBlock()){return false}ev.preventDefault();this.back()}})
        appKeyMap.bind({group: 'March_stage1', key: 'backspace', shift: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Adiantar (single)', desc: 'Adianta inicio da viagem em 1 min', run: ()=>{if(!this.viagemFocus || this.__gridIsBlock()){return false}this.backStart()}})
        appKeyMap.bind({group: 'March_stage1', key: 'r', alt: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Adicionar Intervalo', desc: 'Adiciona intervalo ate a próxima viagem', run: ()=>{
            if(this.__gridIsBlock() || !this.viagemFocus){return false;}
            if(this.project.carros[this.carroIndice].escalas.length > 0){
                this.__modalConfirmationChangeProject(()=>{
                    this.project.carros[this.carroIndice].escalas = [];
                    this.addInterv();
                    this.__updateViagemDisplay();
                })
            }
            else{this.addInterv();this.__updateViagemDisplay();}
        }})
        appKeyMap.bind({group: 'March_stage1', key: 'a', alt: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Adicionar Acesso', desc: 'Adiciona acesso na viagem', run: ()=>{
            if(!this.viagemFocus || this.__gridIsBlock()){return false}
            if(this.project.carros[this.carroIndice].escalas.length > 0){
                this.__modalConfirmationChangeProject(()=>{
                    this.project.carros[this.carroIndice].escalas = [];
                    this.addAccess();
                    this.__updateViagemDisplay();
                })
            }
            else{this.addAccess();this.__updateViagemDisplay();}
        }})
        appKeyMap.bind({group: 'March_stage1', key: 'a', ctrl: true, shift:true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Acesso à todos', desc: 'Adiciona acesso para todos os carros', run: ()=>{
            if(!this.viagemFocus || this.__gridIsBlock()){return false}
            let increment = true; // addAccess por padrao incrementa o this.viagemIndice, deve incrementar somente para o carro em foco
            for(let i = 0; i < this.project.carros.length; i++){
                let r = this.addAccess(i, 0, increment); // Tenta adicionar recolhe na ultima viagem de cada carro
                increment = false;
                if(r){this.project.carros[i].escalas = [];} // Limpa escalas do carro
            }
        }})
        appKeyMap.bind({group: 'March_stage1', key: 'p', alt: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Encerrar turno', desc: 'Encerra turno na viagem', run: ()=>{
            if(this.__gridIsBlock() || !this.viagemFocus){return false;}
            if(this.project.carros[this.carroIndice].escalas.length > 0){
                this.__modalConfirmationChangeProject(()=>{
                    this.project.carros[this.carroIndice].escalas = [];
                    this.viagemShut();
                    this.__updateViagemDisplay();
                })
            }
            else{this.viagemShut();this.__updateViagemDisplay();}
        }})
        appKeyMap.bind({group: 'March_stage1', key: 'e', alt: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Adicionar Recolhe', desc: 'Adiciona recolhe na viagem', run: ()=>{
            if(this.__gridIsBlock() || !this.viagemFocus){return false;}
            if(this.project.carros[this.carroIndice].escalas.length > 0){
                this.__modalConfirmationChangeProject(()=>{
                    this.project.carros[this.carroIndice].escalas = [];
                    this.addRecall();
                    this.__updateViagemDisplay();
                })
            }
            else{this.addRecall();this.__updateViagemDisplay();}
        }})
        appKeyMap.bind({group: 'March_stage1', key: 'e', ctrl: true, shift: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Recolher todos', desc: 'Recolhe todos os carros', run: (ev)=>{
            if(!this.viagemFocus || this.__gridIsBlock()){return false}
            for(let i = 0; i < this.project.carros.length; i++){
                let r = this.addRecall(i, this.project.carros[i].viagens.length - 1); // Tenta adicionar recolhe na ultima viagem de cada carro
                if(r){this.project.carros[i].escalas = [];} // Limpa escalas do carro
            }
        }})
        appKeyMap.bind({group: 'March_stage1', key: 'pagedown', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Próxima viagem sentido', desc: 'Foca próxima viagem no mesmo sentido', run: (ev)=>{if(!this.viagemFocus || this.__gridIsBlock()){return false}ev.preventDefault();this.nextViagem();}})
        appKeyMap.bind({group: 'March_stage1', key: 'pageup', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Viagem anterior sentido', desc: 'Foca viagem anterior no mesmo sentido', run: (ev)=>{if(!this.viagemFocus || this.__gridIsBlock()){return false}ev.preventDefault();this.previousViagem();}})
        appKeyMap.bind({group: 'March_stage1', key: 'home', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Primeira viagem carro', desc: 'Foca primeira viagem do carro', run: (ev)=>{
            if(!this.viagemFocus || this.__gridIsBlock()){return false}
            ev.preventDefault();
            this.viagemIndice = 0;
            this.viagemFocus = this.project.carros[this.carroIndice].viagens[this.viagemIndice];
            this.__cursorMove();
            this.__updateViagemDisplay();
        }})
        appKeyMap.bind({group: 'March_stage1', key: 'fim', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Ultima viagem carro', desc: 'Foca ultima viagem do carro', run: (ev)=>{
            if(!this.viagemFocus || this.__gridIsBlock()){return false}
            ev.preventDefault();
            this.viagemIndice = this.project.carros[this.carroIndice].viagens.length - 1;
            this.viagemFocus = this.project.carros[this.carroIndice].viagens[this.viagemIndice];
            this.__cursorMove();
            this.__updateViagemDisplay();
        }})
        appKeyMap.bind({group: 'March_stage1', key: 'home', ctrl: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Primeira viagem sentido', desc: 'Foca primeira viagem no mesmo sentido', run: ()=>{
            if(!this.viagemFocus || this.__gridIsBlock()){return false}
            let resp = this.project.getFirstViagem(this.viagemFocus.sentido);
            if(resp){
                this.carroLabels[this.carroIndice].style.color = 'inherit';
                this.viagemFocus = resp[0];
                this.carroIndice = resp[1];
                this.viagemIndice = resp[2];
                this.carroLabels[this.carroIndice].style.color = 'var(--bs-link-color)';
                this.__cursorMove();
                this.__updateViagemDisplay();
            }
        }})
        appKeyMap.bind({group: 'March_stage1', key: 'fim', ctrl: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Ultima viagem sentido', desc: 'Foca ultima viagem no mesmo sentido', run: ()=>{
            if(!this.viagemFocus || this.__gridIsBlock()){return false}
            let resp = this.project.getLastViagem(this.viagemFocus.sentido);
            if(resp){
                this.carroLabels[this.carroIndice].style.color = 'inherit';
                this.viagemFocus = resp[0];
                this.carroIndice = resp[1];
                this.viagemIndice = resp[2];
                this.carroLabels[this.carroIndice].style.color = 'var(--bs-link-color)';
                this.__cursorMove();
                this.__updateViagemDisplay();
            }
        }})
        appKeyMap.bind({group: 'March_stage1', key: 'arrowright', shift: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Selecionar a direita', desc: 'Arrasta seleção para direita', run: ()=>{this.__addToSelecao();}})
        appKeyMap.bind({group: 'March_stage1', key: 'arrowleft', shift: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Voltar seleção', desc: 'Diminui da seleção ultima viagem', run: ()=>{this.__subToSelecao();}})
        appKeyMap.bind({group: 'March_stage1', key: 'l', alt: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Limpar seleção', desc: 'Limpa a seleção de viagens', run: ()=>{this.__clearSelecao();}})
        appKeyMap.bind({group: 'March_stage1', key: 'v', ctrl: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Mover viagens', desc: 'Move viagens selecionadas', run: ()=>{
            if(this.__gridIsBlock() || this.inicioSelecao < 0){return false;}
            if(this.project.carros[this.carroSelecao].escalas.length > 0 || this.project.carros[this.carroIndice].escalas.length > 0){
                this.__modalConfirmationChangeProject(()=>{
                    this.project.carros[this.carroSelecao].escalas = [];
                    this.project.carros[this.carroIndice].escalas = [];
                    this.moveViagems()
                })
            }
            else{this.moveViagems()}
        }})
        appKeyMap.bind({group: 'March_stage1', key: 'x', ctrl: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Recortar viagens', desc: 'Move viagens selecionadas para area de transferência', run: ()=>{
            if(this.__gridIsBlock() || this.inicioSelecao < 0 || this.project.area_transferencia.length > 0){return false;}
            if(this.project.carros[this.carroSelecao].escalas.length > 0){
                this.__modalConfirmationChangeProject(()=>{
                    this.project.carros[this.carroSelecao].escalas = [];
                    this.addToTransferArea()
                })
            }
            else{this.addToTransferArea()}
        }})
        appKeyMap.bind({group: 'March_stage1', key: 'v', ctrl: true, shift: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Cola área de transf ', desc: 'Cola todas as viagens da área de transferência', run: ()=>{
            if(this.project.area_transferencia.length == 0){return false}
            this.pasteTransfer()
        }})
        appKeyMap.bind({group: 'March_stage1', key: ' ', ctrl: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Centralizar', desc: 'Centraliza grid na viagem em foco', run: ()=>{
            if(this.viagemFocus){
                this.initialView = this.viagemFocus.inicio - 60; // Ajusta o view inicial para uma hora antes da viagem em foco
                this.__buildRuler();
                this.canvasFit();
            }
        }})
        appKeyMap.bind({group: 'March_stage1', key: 'delete', ctrl:true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Remover viagem', desc: 'Remove viagem', run: ()=>{
            if(this.__gridIsBlock() || !this.viagemFocus){return false;}
            if(this.project.carros[this.carroIndice].escalas.length > 0){
                this.__modalConfirmationChangeProject(()=>{
                    this.project.carros[this.carroIndice].escalas = [];
                    this.removeViagem(false)
                })
            }
            else{this.removeViagem(false)}
        }})
        appKeyMap.bind({group: 'March_stage1', role: 'removeCarro', key: 'delete', ctrl:true, shift: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Remove viagens/carro', desc: 'Remove viagem e posteriores, se 1a viag apaga carro', run: ()=>{
            if(this.__gridIsBlock() || !this.viagemFocus){return false;}
            if(this.viagemIndice == 0){this.removeCarro()}
            else if(this.project.carros[this.carroIndice].escalas.length > 0){
                this.__modalConfirmationChangeProject(()=>{
                    this.project.carros[this.carroIndice].escalas = [];
                    this.removeViagem();
                })
            }
            else{this.removeViagem()} 
        }})
        appKeyMap.bind({group: 'March_stage1', key: 't', alt:true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Legfima viagens', desc: 'Exibe legfima dos tipos de viagens', run: ()=>{this.__showViagemPatterns()}})
        appKeyMap.bind({group: 'March_stage1', key: 'enter', alt:true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Recalcula resumo', desc: 'Exibe resumo do carro em foco', run: ()=>{this.__updateCarroDisplay()}})
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
            if(this.__gridIsBlock() || !this.escalaFocus){return false}
            ev.preventDefault();
            if(this.escalaGrid[this.escalaFocus[0]].length - 1 > this.escalaFocus[1]){
                this.escalaGrid[this.escalaFocus[0]][this.escalaFocus[1]].style.backgroundColor = this.escalaGrid[this.escalaFocus[0]][this.escalaFocus[1]].dataset.type == 'emptyEscala' ? '' : '#1a1d20'; // Altera visual da escala em foco atual
                this.escalaGrid[this.escalaFocus[0]][this.escalaFocus[1] + 1].style.backgroundColor = '#032830'; // Altera visual da proxima escala
                this.escalaFocus = [this.escalaFocus[0], this.escalaFocus[1] + 1, this.escalaFocus[2]];
            }
        }})
        appKeyMap.bind({group: 'March_stage2', key: 'arrowleft', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Focar escala anterior', desc: 'Seleciona escala anterior', run: (ev)=>{
            if(this.__gridIsBlock() || !this.escalaFocus){return false}
            ev.preventDefault();
            if(this.escalaFocus[1] > 0){
                this.escalaGrid[this.escalaFocus[0]][this.escalaFocus[1]].style.backgroundColor = this.escalaGrid[this.escalaFocus[0]][this.escalaFocus[1]].dataset.type == 'emptyEscala' ? '' : '#1a1d20'; // Altera visual da escala em foco atual
                this.escalaGrid[this.escalaFocus[0]][this.escalaFocus[1] - 1].style.backgroundColor = '#032830'; // Altera visual da proxima escala
                this.escalaFocus = [this.escalaFocus[0], this.escalaFocus[1] - 1, this.escalaFocus[2]];
            }
        }})
        appKeyMap.bind({group: 'March_stage2', key: 'arrowdown', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Focar próximo carro', desc: 'Seleciona escala do próximo carro', run: (ev)=>{
            if(this.__gridIsBlock() || !this.escalaFocus){return false}
            ev.preventDefault();
            if(this.escalaGrid[this.escalaFocus[0] + 1]){
                this.escalaGrid[this.escalaFocus[0]][this.escalaFocus[1]].style.backgroundColor = this.escalaGrid[this.escalaFocus[0]][this.escalaFocus[1]].dataset.type == 'emptyEscala' ? '' : '#1a1d20'; // Altera visual da escala em foco atual
                this.escalaGrid[this.escalaFocus[0] + 1][0].style.backgroundColor = '#032830'; // Altera visual da proxima escala
                this.escalaFocus = [this.escalaFocus[0] + 1, 0 , 0];
            }
        }})
        appKeyMap.bind({group: 'March_stage2', key: 'arrowup', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Focar carro anterior', desc: 'Seleciona escala do carro anterior', run: (ev)=>{
            if(this.__gridIsBlock() || !this.escalaFocus){return false}
            ev.preventDefault();
            if(this.escalaFocus[0] > 0){
                this.escalaGrid[this.escalaFocus[0]][this.escalaFocus[1]].style.backgroundColor = this.escalaGrid[this.escalaFocus[0]][this.escalaFocus[1]].dataset.type == 'emptyEscala' ? '' : '#1a1d20'; // Altera visual da escala em foco atual
                this.escalaGrid[this.escalaFocus[0] - 1][0].style.backgroundColor = '#032830'; // Altera visual da proxima escala
                this.escalaFocus = [this.escalaFocus[0] - 1, 0 , 0];
            }
        }})
        appKeyMap.bind({group: 'March_stage2', key: 'arrowdown', ctrl: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Rolar para baixo', desc: 'Move grid para baixo', run: ()=>{
            if(this.__gridIsBlock()){return false}
            if(this.canvas.offsetTop > (this.maxCarsVisible - this.project.carros.length) * 45){
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
            if(this.__gridIsBlock() || !this.escalaFocus){return false}
            this.escalaGrid[this.escalaFocus[0]][this.escalaFocus[1]].click();
        }})
        appKeyMap.bind({group: 'March_stage2', key: '/', alt: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Conexões Escalas', desc: 'Exibe ou oculta conexões entre escalas', run: ()=>{
            if(this.__gridIsBlock()){return false}
            this.__toggleArrowVisibility();
        }})
        appKeyMap.bind({group: 'March_stage2', key: 'f4', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Auto Gerar tabelas', desc: 'Inicia tabela de todos os carros', run: (ev)=>{
            ev.preventDefault();
            if(this.__gridIsBlock() || this.project.carros.length == 0){return false}
            this.project.autoGenerateEscalas();
            this.escalaFocus = [0, 0, 0]; // Seleciona primeira viagem do primeiro carro
            for(let i = 0; i < this.project.carros.length; i++){
                this.__updateCarroEscalas(i, this.project.carros[i].getCarroEscalasBlock(this.project.linha))
            }
            this.__updateEscalaArrows();
        }})
        appKeyMap.bind({group: 'March_stage2', key: 'f2', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Renomear tabela', desc: 'Renomear tabela', run: (ev)=>{
            ev.preventDefault();
            if(this.__gridIsBlock() || !this.escalaFocus || this.escalaGrid[this.escalaFocus[0]][this.escalaFocus[1]].dataset.type == 'emptyEscala'){return false}
            this.gridLocked = true;
            let modal = document.createElement('dialog');modal.innerHTML = '<h6>Renomear Tabela</h6>';modal.style.position = 'relative';
            modal.addEventListener('close', ()=>{modal.remove(); this.gridLocked = false;})
            let nameInput = document.createElement('input');nameInput.type = 'text';nameInput.classList = 'flat-input';nameInput.id = 'March_renameEscalaName';
            nameInput.value = this.project.carros[this.escalaFocus[0]].escalas[this.escalaFocus[1]].name;
            nameInput.onfocus = ()=>{nameInput.select()}
            nameInput.addEventListener('keydown', (ev)=>{if(ev.key == 'Enter'){submit.click()}})
            let submit = document.createElement('button');submit.type = 'button';submit.classList = 'btn btn-sm btn-phanton position-absolute';submit.innerHTML = 'Gravar';submit.style = 'top:56px; right: 10px;'
            submit.onclick = () => {
                if(nameInput.value == '' || nameInput.value.length < 2){nameInput.classList.add('is-invalid'); return false;}
                this.project.carros[this.escalaFocus[0]].escalas[this.escalaFocus[1]].name = nameInput.value;
                this.escalaGrid[this.escalaFocus[0]][this.escalaFocus[1]].querySelector('[data-type=escala-name]').innerHTML = nameInput.value;
                modal.close();
            }
            modal.appendChild(nameInput)
            modal.appendChild(this.__settingsAddCustomLabel(nameInput, 'Nome Tabela'))
            modal.appendChild(submit);
            document.body.appendChild(modal);
            modal.showModal();
        }})
        appKeyMap.bind({group: 'March_stage2', key: 'delete', alt: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Apagar Escala', desc: 'Exclui a escala em foco', run: ()=>{
            if(this.__gridIsBlock() || !this.escalaFocus || this.escalaGrid[this.escalaFocus[0]][this.escalaFocus[1]].dataset.type == 'emptyEscala'){return false}
            let r = this.project.deleteEscala(this.escalaFocus[0], this.escalaFocus[1]);
            if(r){
                let carro_index = this.escalaFocus[0];
                this.escalaFocus = null;
                if(this.escalaGrid[0].length > 0){
                    this.escalaFocus = [0,0,0];
                    this.escalaGrid[0][0].style.backgroundColor = '#032830';
                }
                this.__updateCarroEscalas(carro_index, this.project.carros[carro_index].getCarroEscalasBlock(this.project.linha));
                r.forEach(el => {this.__updateCarroEscalas(el, this.project.carros[el].getCarroEscalasBlock(this.project.linha))});
                this.__updateEscalaArrows();
            }
        }})
        appKeyMap.bind({group: 'March_stage2', key: 'delete', ctrl: true, shift: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Limpar escalas', desc: 'Remove todas as escalas', run: ()=>{
            if(this.__gridIsBlock()){return false}
            for(let i = 0; i < this.project.carros.length; i++){
                this.project.carros[i].escalas = [];
                this.__updateCarroEscalas(i, this.project.carros[i].getCarroEscalasBlock(this.project.linha))
            }
            this.__updateEscalaArrows();
        }})
    }
}