import { metrics as $, defaultParam, min2Hour, min2Range, hour2Min } from './DM_metrics.js';
import { jsGaitDiagram } from "./DM_main.js";
import { __buildStyles, __build, __buildCursor, __buildRuler, __buildFooter } from "./UI_build.js";
import { __addGeneralListeners, __addStage1Listeners, __addStage2Listeners } from "./UI_listeners.js";
import { __builSettingsUI, __settingsAddCustomLabel, __settingsContainerSwitch, __settingsUpdateBaselines, __settingsUpdateFreqSimulate} from "./UI_settings.js";
import { __showRouteMetrics } from "./UI_routeMetrics.js";
import { loadStage1 } from "./UI_stage1.js";

class jsGaitDiagramUI{
    constructor(options){
        this.sw = screen.width;
        this.sh = window.innerHeight;
        this.gridLocked = false; // Se true desativa atalhos de edicao do grid
        this.projectIndex = 0; // Indice para apontamento do projeto
        this.carIndex = -1;
        this.tripIndex = -1;
        this.carSelect = -1; // Indice do carro onde foi iniciado selecao
        this.startSelect = -1; // Trip inicial selecionada
        this.endSelect = -1; // Trip final selecionada
        this.scheduleFocus = null;
        this.scheduleSelect = null;
        this.carLabels = []; // Lista com apontadores das labels dos carros
        this.carGrid = {}; // Dicionario Todos os elementos do grid (carros e viagens) serao armazenados aqui
        this.freqGrid = {}; // Dicionario com item da regua de frequencia
        this.scheduleGrid = {}; // Dicionario com os escalas
        this.arrowsGrid = {}; // Lista com elementos arrows
        this.arrowsVisible = true; 
        this.spotsGrid = {}; // Dicionario com os pontos de rendicao dos carros
        this.initialView = options?.initialView || 0; // Inicio da regua (em minutos)
        this.endMinutsMargin = options?.endMinutsMargin || 15; // Margem (em minutos) final antes de rolar o canvas
        this.initialCarView = 0; // Indice do primeiro carro sfimo exibido no grid
        // Verifica se foi repassado initialView como hora em string ex '04:30', se sim converte em minutos
        if(typeof this.initialView == 'string'){this.initialView = hour2Min(this.initialView)}
        
        this.projects = []; // Lista de projetos carregados
        if(options?.project){this.projects.push(options.project)}
        else{this.projects.push(new jsGaitDiagram({}))}
        this.container = options?.container || document.body;
        this.container.style.overflow = 'hidden'; // Remove scroll do container
        this.container.style.position = 'relative'; // Ajusta posicionamento do container para relativo para correta alocacao dos elementos
        
        this.settingsContainer = options?.settingsContainer || null;
        this.canvasMarginTop = options?.canvasMarginTop || '40px';
        
        this.freqRulerSelectColor = options?.freqRulerSelectColor || '#FFF';
        this.freqRulerSelectHeight = options?.freqRulerSelectHeight || '15px';
        
        this.cursorClasslist = options?.cursorClasslist || 'bi bi-caret-down-fill fs-2';
        
        this.carTagWidth = options?.carTagWidth || '35px';
        this.carTagColor = options?.carTagColor || '#bcbcbc';
        this.carHeight = options?.carHeight || '45px'; // height do carro
        
        this.rulerHeight = options?.rulerHeight || '25px';
        this.rulerNumColor = options?.rulerNumColor || '#888';
        this.rulerNumSize = options?.rulerNumSize || '11px';
        this.rulerNumPaddingStart = options?.rulerNumPaddingStart || '4px';
        this.rulerNumPaddingTop = options?.rulerNumPaddingTop || '2px';
        
        this.rulerUnit = options?.rulerUnit || '2px';
        this.rulerClasslist = options?.rulerClasslist || 'bg-body';
        this.rulerSmallWidth = options?.rulerSmallWidth || '1px';
        this.rulerSmallColor = options?.rulerSmallColor || '#666';
        this.rulerSmallHeight = options?.rulerSmallHeight || '10px';
        this.rulerMediumWidth = options?.rulerMediumWidth || '1px';
        this.rulerMediumColor = options?.rulerMediumColor || '#BBB';
        this.rulerMediumHeight = options?.rulerMediumHeight || '15px';
        this.rulerMediumUnit = options?.rulerMediumUnit || 60;
        
        this.tripStyle = options?.tripStyle || 'height: 8px;border-radius: 10px;';
        
        this.tripOrigemColor = options?.tripOrigemColor || '#4080A0';
        this.tripDestinoColor = options?.tripDestinoColor || '#98D3F0';
        this.tripHeight = options?.tripHeight || '8px';
        
        this.defaultSettings = {
            rulerUnit: '2px',
            rulerMediumUnit: 30,
            tripOrigemColor: '#4080A0',
            tripDestinoColor: '#98D3F0',
        }
        
        // $.PRODUTIVA = '1', EXPRESSO = '2', SEMIEXPRESSO = '3', EXTRA = '4', ACESSO = '5', RECOLHE = '6', INTERVALO = '7', RESERVADO = '9';
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
        
        this.maxCarsVisible = Math.floor((this.sh - parseInt(this.canvasMarginTop) - parseInt(this.rulerHeight) - parseInt(this.footerHeight)) / parseInt(this.carHeight));
        
        // Ao navegar pelas viagens/carros so atualiza display de carros apos alguns segundos de delay (para evitar processamento desnecessario)
        this.updateCarDisplayDelay = 300;
        this.updateCarDisplayTimeout = null;
        
        // Associando modulos secundarios a instancia principal
        this.__buildCursor = __buildCursor;
        this.__buildRuler = __buildRuler;
        this.__builSettingsUI = __builSettingsUI;
        this.__build = __build;
        this.__buildFooter = __buildFooter;
        this.__addGeneralListeners = __addGeneralListeners;
        this.__addStage1Listeners = __addStage1Listeners;
        this.__addStage2Listeners = __addStage2Listeners;
        this.__builSettingsUI = __builSettingsUI;
        this.__settingsAddCustomLabel = __settingsAddCustomLabel;
        this.__settingsContainerSwitch = __settingsContainerSwitch;
        this.__settingsUpdateBaselines = __settingsUpdateBaselines;
        this.__settingsUpdateFreqSimulate = __settingsUpdateFreqSimulate;
        this.__showRouteMetrics = __showRouteMetrics;
        
        // Construindo componentes da interface
        __buildStyles();
        this.__build();
        this.__buildFooter();
        this.__buildCursor();
        this.__addGeneralListeners();
        if(this.settingsContainer){this.__builSettingsUI()}
        
        this.switchStage(this.projects[this.projectIndex].viewStage); // Carrega interface do respectivo viewStage
    }
    tripFocus(){ // Retorna a viagem em foco
        return this.tripIndex >=0 ? this.projects[this.projectIndex].carros[this.carIndex].viagens[this.tripIndex] : null
    }
    carFocus(){ // Retorna o carro em foco
        return this.carIndex >=0 ? this.projects[this.projectIndex].carros[this.carIndex] : null
    }
    addCar(car=null, seq=this.projects[this.projectIndex].carros.length + 1){
        car = car || this.projects[this.projectIndex].addCar({linha: this.projects[this.projectIndex].linha});
        let carLabel = document.createElement('span');
        carLabel.style.width = this.carTagWidth;
        carLabel.style.color = this.carTagColor;
        carLabel.style.height = this.carHeight;
        carLabel.style.paddingLeft = '3px';
        carLabel.style.position = 'absolute';
        carLabel.style.backgroundColor = 'var(--bs-body-bg)';
        carLabel.style.zIndex = '95';
        carLabel.innerHTML = String(seq).padStart(2,'0');
        carLabel.style.top = `calc(${this.carHeight} * ${seq})`;
        carLabel.style.left = 0;
        this.carLabels.push(carLabel);
        this.container.appendChild(carLabel);
        this.carGrid[seq - 1] = []; // Adiciona entrada para o carro no dicionario de grid
        this.freqGrid[seq - 1] = []; // Adiciona entrada para o carro no dicionario de freqGrid
        for(let i = 0; i < car.viagens.length; i++){
            let v = this.addTrip(car.viagens[i], seq - 1);
        }
        if(this.tripIndex < 0){ // Se nenhuma viagem em foco, aponta para primeira viagem do primeiro carro
            this.projectIndex = 0;
            this.carIndex = 0;
            this.tripIndex = 0;
            this.__cursorMove();
            this.__updateTripDisplay();
            this.__updateCarDisplay();
        }
    }
    addTrip(viagem=null, seq=this.carIndex, confirmed=false){
        this.__clearSelecao();
        viagem = viagem || this.projects[this.projectIndex].carros[this.carIndex].addTrip({linha: this.projects[this.projectIndex].linha, param: this.projects[this.projectIndex].param || this.projects[this.projectIndex].linha.param});
        let v = document.createElement('div'); // Elemento viagem (grid)
        v.style = this.tripStyle;
        this.__updateTripStyle(viagem, v);
        v.style.position = 'absolute';
        v.style.width = `calc(${this.rulerUnit} * ${viagem.getCycle()})`;
        v.style.top = `calc(${this.carHeight} * ${seq + 1} - 17px)`;
        v.style.left = `calc(${this.carTagWidth} + ${viagem.inicio} * ${this.rulerUnit})`;
        this.carGrid[seq].push(v);
        this.canvas.appendChild(v);
        let vf = document.createElement('div'); // Dot na regua de frequencia
        vf.style.position = 'absolute';
        vf.style.left = v.style.left; // Assume mesmo posicionamento da viagem
        vf.style.top = viagem.sentido == $.IDA ? '5px' : '30px';
        vf.style.width = this.rulerSmallWidth;
        vf.style.height = this.rulerSmallHeight;
        vf.style.backgroundColor = this.rulerSmallColor;
        vf.style.marginRight = this.rulerSmallMarginRight;
        if([$.INTERVALO, $.ACESSO, $.RECOLHE, $.RESERVADO].includes(viagem.tipo)){
            vf.style.visibility = 'hidden';
        }
        this.freqGrid[seq].push(vf);
        this.rulerFreq.appendChild(vf);
        this.__updateCarDisplay();
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
        this.__clearSelecao();
        this.gridLocked = true;
        let modal = document.createElement('dialog');modal.innerHTML = '<h6>Adicionar viagem as:</h6>'
        let startAt = document.createElement('input');startAt.type = 'time';startAt.style.width = '100px';startAt.style.textAlign = 'center';startAt.style.display = 'block';startAt.style.marginLeft = 'auto';startAt.style.marginRight = 'auto';
        let confirm = document.createElement('button');confirm.type = 'button';confirm.classList = 'btn btn-sm btn-dark mt-2 float-end';confirm.innerHTML = 'Confirmar';
        confirm.onclick = () => {
            let time = hour2Min(startAt.value)
            if(time){
                let v = this.projects[this.projectIndex].addTrip(this.carIndex, time);
                if(v){ // Se viagem atfime requisitos, insere viagem no grid
                    this.addTrip(v, this.carIndex);
                    // Ao inserir viagem com horario predefinido move o foco para esta viagem
                    this.tripIndex = this.projects[this.projectIndex].carros[this.carIndex].viagens.indexOf(this.tripFocus());
                    // Ao inserir viagem com horario predefinido a viagem sera inserida na ordem de inicio
                    // necessario reordenar tambem grid para corresponder indices de viagens
                    this.carGrid[this.carIndex].sort((a, b) => a.offsetLeft > b.offsetLeft ? 1 : -1);
                    this.freqGrid[this.carIndex].sort((a, b) => a.offsetLeft > b.offsetLeft ? 1 : -1);
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
        this.__clearSelecao();
        let viagem = this.projects[this.projectIndex].carros[this.carIndex].addInterv(this.tripIndex);
        if(viagem){
            let v = document.createElement('div'); // Elemento viagem (grid)
            v.style = this.tripStyle;
            v.style.background = this.typePattern[$.INTERVALO];
            v.style.position = 'absolute';
            v.style.width = `calc(${this.rulerUnit} * ${viagem.getCycle()})`;
            v.style.top = `calc(${this.carHeight} * ${this.carIndex + 1} - 17px)`;
            v.style.left = `calc(${this.carTagWidth} + ${viagem.inicio} * ${this.rulerUnit})`;
            this.carGrid[this.carIndex].push(v);
            this.canvas.appendChild(v);
            this.carGrid[this.carIndex].sort((a, b) => a.offsetLeft > b.offsetLeft ? 1 : -1);
            let vf = document.createElement('div'); // Dot na regua de frequencia
            vf.style.position = 'absolute';
            vf.style.left = v.style.left; // Assume mesmo posicionamento da viagem
            vf.style.top = viagem.sentido == $.IDA ? '5px' : '30px';
            vf.style.width = this.rulerSmallWidth;
            vf.style.height = this.rulerSmallHeight;
            vf.style.backgroundColor = this.rulerSmallColor;
            vf.style.marginRight = this.rulerSmallMarginRight;
            vf.style.visibility = 'hidden'; // Intervalos nao sao vistos na freqRule
            this.freqGrid[this.carIndex].push(vf);
            this.rulerFreq.appendChild(vf);
            this.freqGrid[this.carIndex].sort((a, b) => a.offsetLeft > b.offsetLeft ? 1 : -1);
            this.__updateCarDisplay();
        }
    }
    addAccess(carIndex=this.carIndex, tripIndex=this.tripIndex, incrementIndice=true){
        this.__clearSelecao();
        let viagem = this.projects[this.projectIndex].carros[carIndex].addAccess(tripIndex, this.projects[this.projectIndex].linha);
        if(viagem){
            let v = document.createElement('div'); // Elemento viagem (grid)
            v.style = this.tripStyle;
            v.style.background = this.typePattern[$.ACESSO];
            v.style.position = 'absolute';
            v.style.width = `calc(${this.rulerUnit} * ${viagem.getCycle()})`;
            v.style.top = `calc(${this.carHeight} * ${carIndex + 1} - 17px)`;
            v.style.left = `calc(${this.carTagWidth} + ${viagem.inicio} * ${this.rulerUnit})`;
            this.carGrid[carIndex].push(v);
            this.canvas.appendChild(v);
            this.carGrid[carIndex].sort((a, b) => a.offsetLeft > b.offsetLeft ? 1 : -1);
            let vf = document.createElement('div'); // Dot na regua de frequencia
            vf.style.position = 'absolute';
            vf.style.left = v.style.left; // Assume mesmo posicionamento da viagem
            vf.style.top = viagem.sentido == $.IDA ? '5px' : '30px';
            vf.style.width = this.rulerSmallWidth;
            vf.style.height = this.rulerSmallHeight;
            vf.style.backgroundColor = this.rulerSmallColor;
            vf.style.marginRight = this.rulerSmallMarginRight;
            vf.style.visibility = 'hidden';; // Acesso nao sao vistos na freqRule
            this.freqGrid[carIndex].push(vf);
            this.rulerFreq.appendChild(vf);
            this.freqGrid[carIndex].sort((a, b) => a.offsetLeft > b.offsetLeft ? 1 : -1);
            if(incrementIndice){this.tripIndex++}
        }
    }
    addRecall(carIndex=this.carIndex, tripIndex=this.tripIndex){ // Adiciona recolhida na viagem em foco
        this.__clearSelecao();
        let viagem = this.projects[this.projectIndex].carros[carIndex].addRecall(tripIndex, this.projects[this.projectIndex].linha);
        if(viagem){
            let v = document.createElement('div'); // Elemento viagem (grid)
            v.style = this.tripStyle;
            v.style.background = this.typePattern[$.RECOLHE];
            v.style.position = 'absolute';
            v.style.width = `calc(${this.rulerUnit} * ${viagem.getCycle()})`;
            v.style.top = `calc(${this.carHeight} * ${carIndex + 1} - 17px)`;
            v.style.left = `calc(${this.carTagWidth} + ${viagem.inicio} * ${this.rulerUnit})`;
            this.carGrid[carIndex].push(v);
            this.canvas.appendChild(v);
            this.carGrid[carIndex].sort((a, b) => a.offsetLeft > b.offsetLeft ? 1 : -1);
            let vf = document.createElement('div'); // Dot na regua de frequencia
            vf.style.position = 'absolute';
            vf.style.left = v.style.left; // Assume mesmo posicionamento da viagem
            vf.style.top = viagem.sentido == $.IDA ? '5px' : '30px';
            vf.style.width = this.rulerSmallWidth;
            vf.style.height = this.rulerSmallHeight;
            vf.style.backgroundColor = this.rulerSmallColor;
            vf.style.marginRight = this.rulerSmallMarginRight;
            vf.style.visibility = 'hidden';; // Recolhe nao sao vistos na freqRule
            this.rulerFreq.appendChild(vf);
            this.freqGrid[carIndex].push(vf);
            this.freqGrid[carIndex].sort((a, b) => a.offsetLeft > b.offsetLeft ? 1 : -1);
            return true;
        }
        return false;
    }
    viagemShut(){ // Encerra turno na viagem em foco
        let v = this.carFocus().viagemShut(this.tripIndex);
        if(v){
            this.__updateTripStyle(this.tripFocus(), this.carGrid[this.carIndex][this.tripIndex]);
        }
    }
    switchWay(){ // Abre modal para alteracao do sentido da viagem
        let dialog = document.createElement('dialog');
        dialog.innerHTML = `<p>Deseja altera o sentido da viagem para <b class="text-purple">${this.tripFocus().sentido  == $.IDA ? 'VOLTA' : 'IDA'}</b>?</p>`
        let check = document.createElement('input');check.id = 'March_switchWayCheck';check.checked = 'true'
        dialog.appendChild(this.__settingsContainerSwitch(check, 'Alterar demais viagens'));
        let cancel = document.createElement('button');cancel.type = 'button';cancel.classList = 'btn btn-sm btn-phanton text-secondary float-end';cancel.innerHTML = 'Cancelar';
        cancel.onclick = ()=>{
            dialog.close();
            dialog.remove();            
        }
        let confirm = document.createElement('button');confirm.type = 'button';confirm.classList = 'btn btn-sm btn-phanton float-end';confirm.innerHTML = 'Gravar';
        confirm.onclick = () => {
            this.projects[this.projectIndex].carros[this.carIndex].switchWay(this.tripIndex, check.checked);
            this.__updateTripStyle(this.projects[this.projectIndex].carros[this.carIndex].viagens[this.tripIndex], this.carGrid[this.carIndex][this.tripIndex]);
            if(check.checked){
                for(let i = this.tripIndex + 1; i < this.projects[this.projectIndex].carros[this.carIndex].viagens.length; i++){
                    this.__updateTripStyle(this.projects[this.projectIndex].carros[this.carIndex].viagens[i], this.carGrid[this.carIndex][i]);
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
        target.style.backgroundColor = model.sentido == $.IDA ? this.tripOrigemColor : this.tripDestinoColor;
        target.style.color = target.style.backgroundColor;
        if(model.tipo != $.PRODUTIVA){
            let c = model.sentido == $.IDA ? this.tripOrigemColor : this.tripDestinoColor;
            target.style.background = this.typePattern[model.tipo].replaceAll('COLOR', c);
        }
        if(model.encerrar){target.classList.add('viagem-encerrar')}
        else{target.classList.remove('viagem-encerrar')}
    }
    plus(cascade=true){
        if(this.tripFocus() != null){
            this.projects[this.projectIndex].carros[this.carIndex].plus(this.tripIndex, cascade); // Icrementa 1 minuto no final na viagem foco e no inicio e fim das posteriores
            this.carGrid[this.carIndex][this.tripIndex].style.width = `calc(${this.projects[this.projectIndex].carros[this.carIndex].viagens[this.tripIndex].getCycle()} * ${this.rulerUnit})`;
            if(cascade){
                for(let i = 1; i < this.projects[this.projectIndex].carros[this.carIndex].viagens.length; i++){
                    this.carGrid[this.carIndex][i].style.left = `calc(${this.carTagWidth} + ${this.projects[this.projectIndex].carros[this.carIndex].viagens[i].inicio} * ${this.rulerUnit})`;
                    this.carGrid[this.carIndex][i].style.width = `calc(${this.projects[this.projectIndex].carros[this.carIndex].viagens[i].getCycle()} * ${this.rulerUnit})`;
                    this.freqGrid[this.carIndex][i].style.left = `calc(${this.carTagWidth} + ${this.projects[this.projectIndex].carros[this.carIndex].viagens[i].inicio} * ${this.rulerUnit})`;
                }
            }
            this.__updateTripDisplay();
        }
    }
    sub(cascade=true){
        if(this.tripFocus() != null){
            this.projects[this.projectIndex].carros[this.carIndex].sub(this.tripIndex, cascade); // Subtrai 1 minuto no final na viagem foco e no inicio e fim das posteriores
            this.carGrid[this.carIndex][this.tripIndex].style.width = `calc(${this.projects[this.projectIndex].carros[this.carIndex].viagens[this.tripIndex].getCycle()} * ${this.rulerUnit})`;
            if(cascade){
                for(let i = 1; i < this.projects[this.projectIndex].carros[this.carIndex].viagens.length; i++){
                    this.carGrid[this.carIndex][i].style.left = `calc(${this.carTagWidth} + ${this.projects[this.projectIndex].carros[this.carIndex].viagens[i].inicio} * ${this.rulerUnit})`;
                    this.carGrid[this.carIndex][i].style.width = `calc(${this.projects[this.projectIndex].carros[this.carIndex].viagens[i].getCycle()} * ${this.rulerUnit})`;
                    this.freqGrid[this.carIndex][i].style.left = `calc(${this.carTagWidth} + ${this.projects[this.projectIndex].carros[this.carIndex].viagens[i].inicio} * ${this.rulerUnit})`;
                }
            }
            this.__updateTripDisplay();
        }
    }
    moveStart(){
        if(this.tripFocus() != null){
            this.projects[this.projectIndex].carros[this.carIndex].moveStart(this.tripIndex); // Aumenta 1 minuto no final na viagem foco
            this.carGrid[this.carIndex][this.tripIndex].style.left = `calc(${this.carTagWidth} + ${this.projects[this.projectIndex].carros[this.carIndex].viagens[this.tripIndex].inicio} * ${this.rulerUnit})`;
            this.carGrid[this.carIndex][this.tripIndex].style.width = `calc(${this.projects[this.projectIndex].carros[this.carIndex].viagens[this.tripIndex].getCycle()} * ${this.rulerUnit})`;
            this.freqGrid[this.carIndex][this.tripIndex].style.left = `calc(${this.carTagWidth} + ${this.projects[this.projectIndex].carros[this.carIndex].viagens[this.tripIndex].inicio} * ${this.rulerUnit})`;
            this.__updateTripDisplay();
        }
        
    }
    backStart(){
        if(this.tripFocus() != null){
            this.projects[this.projectIndex].carros[this.carIndex].backStart(this.tripIndex);
            this.carGrid[this.carIndex][this.tripIndex].style.left = `calc(${this.carTagWidth} + ${this.projects[this.projectIndex].carros[this.carIndex].viagens[this.tripIndex].inicio} * ${this.rulerUnit})`;
            this.carGrid[this.carIndex][this.tripIndex].style.width = `calc(${this.projects[this.projectIndex].carros[this.carIndex].viagens[this.tripIndex].getCycle()} * ${this.rulerUnit})`;
            this.freqGrid[this.carIndex][this.tripIndex].style.left = `calc(${this.carTagWidth} + ${this.projects[this.projectIndex].carros[this.carIndex].viagens[this.tripIndex].inicio} * ${this.rulerUnit})`;
            this.__cursorMove();
            this.__updateTripDisplay();
        }
    }
    advance(){
        if(this.tripFocus() != null){
            this.projects[this.projectIndex].carros[this.carIndex].advance(this.tripIndex);
            for(let i = this.tripIndex; i < this.projects[this.projectIndex].carros[this.carIndex].viagens.length; i++){
                this.carGrid[this.carIndex][i].style.left = `calc(${this.carTagWidth} + ${this.projects[this.projectIndex].carros[this.carIndex].viagens[i].inicio} * ${this.rulerUnit})`;
                this.carGrid[this.carIndex][i].style.width = `calc(${this.projects[this.projectIndex].carros[this.carIndex].viagens[i].getCycle()} * ${this.rulerUnit})`;
                this.freqGrid[this.carIndex][i].style.left = `calc(${this.carTagWidth} + ${this.projects[this.projectIndex].carros[this.carIndex].viagens[i].inicio} * ${this.rulerUnit})`;
            }
            this.__cursorMove();
            this.__updateTripDisplay();
        }
        
    }
    back(){
        if(this.tripFocus() != null){
            this.projects[this.projectIndex].carros[this.carIndex].back(this.tripIndex);
            for(let i = this.tripIndex; i < this.projects[this.projectIndex].carros[this.carIndex].viagens.length; i++){
                this.carGrid[this.carIndex][i].style.left = `calc(${this.carTagWidth} + ${this.projects[this.projectIndex].carros[this.carIndex].viagens[i].inicio} * ${this.rulerUnit})`;
                this.carGrid[this.carIndex][i].style.width = `calc(${this.projects[this.projectIndex].carros[this.carIndex].viagens[i].getCycle()} * ${this.rulerUnit})`;
                this.freqGrid[this.carIndex][i].style.left = `calc(${this.carTagWidth} + ${this.projects[this.projectIndex].carros[this.carIndex].viagens[i].inicio} * ${this.rulerUnit})`;
            }
            this.__cursorMove();
            this.__updateTripDisplay();
        }
        
    }
    removeCar(){
        if(!this.carFocus()){return false}
        let r = this.projects[this.projectIndex].removeCar(this.carIndex);
        if(r){this.__loadStage1()} // Ao remover carro, todo o grid eh reconstruido
    }
    removeTrip(cascade=true){ // Remove viagem em foco e se cascade=true as seguintes
        if(this.tripFocus()){
            let r;
            // Se itens selecionados, apaga as viagens selecionadas
            if(this.startSelect >= 0 && this.endSelect >= 0){r = this.projects[this.projectIndex].carros[this.carIndex].removeTrip(this.tripIndex, false, this.endSelect - this.startSelect + 1)}
            else{r = this.projects[this.projectIndex].carros[this.carIndex].removeTrip(this.tripIndex, cascade)}
            if(r){
                if(this.startSelect >= 0 && this.endSelect >= 0){
                    let ajustedStart = this.startSelect - (r[1] ? 1 : 0);
                    let ajustedEnd = this.endSelect + (r[2] ? 1 : 0);
                    for(let i = ajustedEnd; i >= ajustedStart; i--){
                        this.carGrid[this.carSelect][i].remove(); // Apaga viagem no grid
                        this.freqGrid[this.carSelect][i].remove(); // Apaga viagem no freqGrid
                    }
                    this.carGrid[this.carSelect].splice(ajustedStart, ajustedEnd - ajustedStart + 1); // Apaga entradas no grid
                    this.freqGrid[this.carSelect].splice(this.tripIndex, ajustedEnd - ajustedStart + 1); // Apaga entradas no freqGrid
                }
                else if(!cascade){
                    let ajustedStart = this.tripIndex - (r[1] ? 1 : 0);
                    let ajustedEnd = this.tripIndex + (r[2] ? 1 : 0);
                    for(let i = ajustedEnd; i >= ajustedStart; i--){
                        this.carGrid[this.carIndex][i].remove(); // Apaga elemento do canvas
                        this.freqGrid[this.carIndex][i].remove(); // Apaga elemento no ruleFreq
                    }
                    this.carGrid[this.carIndex].splice(ajustedStart, 1 + (r[1] ? 1 : 0) + (r[2] ? 1 : 0)); // Apaga entrada no grid
                    this.freqGrid[this.carIndex].splice(ajustedStart, 1 + (r[1] ? 1 : 0) + (r[2] ? 1 : 0)); // Apaga viagem no freqGrid
                }
                else{
                    let ajustedStart = this.tripIndex - (r[1] ? 1 : 0);
                    for(let i = this.carGrid[this.carIndex].length - 1; i >= ajustedStart; i--){
                        this.carGrid[this.carIndex][i].remove(); // Apaga viagem no grid
                        this.freqGrid[this.carIndex][i].remove(); // Apaga viagem no freqGrid
                    }
                    this.carGrid[this.carIndex].splice(ajustedStart, this.carGrid[this.carIndex].length - ajustedStart); // Apaga entradas no grid
                    this.freqGrid[this.carIndex].splice(ajustedStart, this.freqGrid[this.carIndex].length - ajustedStart); // Apaga entradas no freqGrid
                }
                this.__clearSelecao();
                // Muda o foco para viagem anterior (se existir) ou posterior
                this.tripIndex = this.tripIndex == 0 || (this.tripIndex == 1 && r[1]) ? 0 : this.tripIndex - (r[1] ? 2 : 1);
                this.__cursorMove();
                this.__updateTripDisplay();
            }
        }
    }
    moveTrips(){
        if(this.carSelect == this.carIndex || this.carSelect < 0 || this.startSelect < 0 || this.endSelect < 0){return false;}
        let resp = this.projects[this.projectIndex].moveTrips(this.carSelect, this.carIndex, this.startSelect, this.endSelect);
        if(resp){
            for(let i = this.startSelect; i <= this.endSelect;i++){ // Ajusta posicao top das viagens alvo para novo carro no canvas
                this.carGrid[this.carSelect][i].style.top = `calc(${this.carHeight} * ${this.carIndex + 1} - 17px)`;
            }
            this.carGrid[this.carIndex] = this.carGrid[this.carIndex].concat(this.carGrid[this.carSelect].splice(this.startSelect, this.endSelect - this.startSelect + 1));
            this.carGrid[this.carIndex].sort((a, b) => a.offsetLeft > b.offsetLeft ? 1 : -1);
            this.freqGrid[this.carIndex] = this.freqGrid[this.carIndex].concat(this.freqGrid[this.carSelect].splice(this.startSelect, this.endSelect - this.startSelect + 1));
            this.freqGrid[this.carIndex].sort((a, b) => a.offsetLeft > b.offsetLeft ? 1 : -1);
            this.__clearSelecao();
            this.__cursorMove();
        }
        else{appNotify('warning', '<b>Atenção:</b> Conflito de horário ou você tentou mover todas as viagens do veiculo')}
    }
    addToTransferArea(){
        if(this.carSelect < 0 || this.startSelect < 0 || this.endSelect < 0){return false};
        let r = this.projects[this.projectIndex].addToTransferArea(this.carSelect, this.startSelect, this.endSelect);
        if(r){
            for(let i = this.startSelect; i <= this.endSelect; i++){ // Remove itens do grid e freqGrid
                let v = this.projects[this.projectIndex].carros[this.carSelect].viagens[i];
                this.carGrid[this.carSelect][i].remove();
                this.freqGrid[this.carSelect][i].remove();
            }
            this.carGrid[this.carSelect].splice(this.startSelect, r.length);
            this.freqGrid[this.carSelect].splice(this.startSelect, r.length);
            if(this.startSelect > 0){
                this.tripIndex = this.startSelect - 1;
            }
            this.__cursorMove();
            this.__updateTripDisplay();
            this.__clearSelecao();
            this.__addToTransferAddLabel()
        }
    }
    __addToTransferAddLabel(){
        // Adiciona icone identificando que existe viagens na area de transferencia
        this.transferAreaIcon = document.createElement('div');
        this.transferAreaIcon.style = 'position: absolute; top: 90px; right: 20px; border:1px solid var(--bs-border-color); border-radius: 10px;padding: 4px 10px; background-color: var(--bs-secondary-bg);opacity: 0.7; cursor: pointer;';
        this.transferAreaIcon.innerHTML = `<i class="bi bi-copy fs-5 me-1"></i> <b>${this.projects[this.projectIndex].area_transferencia.length}</b>`;
        this.transferAreaIcon.title = `Inicio: ${this.projects[this.projectIndex].area_transferencia[0].getStart()} | Fim: ${this.projects[this.projectIndex].area_transferencia[this.projects[this.projectIndex].area_transferencia.length - 1].getEnd()}`;
        document.body.appendChild(this.transferAreaIcon);
    }
    pasteTransfer(){ // 
        let r = this.projects[this.projectIndex].pasteTransfer(this.carIndex);
        if(r){
            for(let i = 0; i < this.carGrid[this.carIndex].length; i++){
                this.carGrid[this.carIndex][i].remove(); // Limpa a viagem do grid
                this.freqGrid[this.carIndex][i].remove(); // Limpa a viagem do freqGrid
            }
            this.carGrid[this.carIndex] = []; // Limpa o grid
            this.freqGrid[this.carIndex] = []; // Limpa o freqGrid
            for(let i = 0; i < this.projects[this.projectIndex].carros[this.carIndex].viagens.length; i++){
                this.addTrip(this.projects[this.projectIndex].carros[this.carIndex].viagens[i]); // Adiciona as viagens ajustadas do carro no grid
            }
            this.__cursorMove();
            this.transferAreaIcon.remove();
        }
        else{appNotify('warning', '<b>Atenção:</b> Conflito de horário, não é possivel mover viagens')}
        
        
    }
    __addToSelecao(){ // Seleciona viagens
        if(!this.tripFocus() || this.projects[this.projectIndex].carros[this.carIndex].viagens.length <= this.endSelect + 1){return false}
        if(this.carSelect >= 0 &&  this.startSelect >= 0){ // Selecao ja iniciada
            this.endSelect++;
            let wd = this.projects[this.projectIndex].carros[this.carIndex].viagens[this.endSelect].fim - this.projects[this.projectIndex].carros[this.carIndex].viagens[this.startSelect].inicio;
            this.selectTripsBox.style.width = `calc(${wd} * ${this.rulerUnit} + 10px)`;
            
        }
        else{
            this.carSelect = this.carIndex;
            this.startSelect = this.tripIndex;
            this.endSelect = this.tripIndex;
            this.selectTripsBox = document.createElement('div');
            let selectWd = `calc(${this.tripFocus().getCycle()} * ${this.rulerUnit} + 10px)`;
            let selectSt = `calc(${this.carTagWidth} + ${this.tripFocus().inicio} * ${this.rulerUnit} - 5px)`;
            let selectTp = `calc(${this.carHeight} * ${this.carIndex + 1} - 22px)`;
            this.selectTripsBox.style = `border:1px solid #b72a2a;height: calc(${this.tripHeight} + 10px);border-radius: 10px;width: ${selectWd};position: absolute; top: ${selectTp}; left: ${selectSt}`;
            this.canvas.appendChild(this.selectTripsBox);
        }
        
    }
    __subToSelecao(){
        if(!this.tripFocus() || this.carSelect < 0 || this.startSelect < 0 || this.endSelect < 0){return false}
        if(this.endSelect == this.startSelect){this.__clearSelecao();return false} // Se existe apenas uma viagem selecionada apenasremove a selecao e encerra bloco
        this.endSelect--;
        let wd = this.projects[this.projectIndex].carros[this.carIndex].viagens[this.endSelect].fim - this.projects[this.projectIndex].carros[this.carIndex].viagens[this.startSelect].inicio;
        this.selectTripsBox.style.width = `calc(${wd} * ${this.rulerUnit} + 10px)`;
    }
    __clearSelecao(){
        if(!this.selectTripsBox){return false}
        this.carSelect = -1;
        this.startSelect = -1;
        this.endSelect = -1;
        this.selectTripsBox.remove();
    }
    nextTrip(){ // Move foco para proxima viagem no mesmo sentido (indiferente do carro)
        let v = this.projects[this.projectIndex].nextTrip(this.tripFocus());
        if(v){
            this.carLabels[this.carIndex].style.color = 'inherit';
            this.carIndex = v[0];
            this.tripIndex = v[1];
            this.carLabels[this.carIndex].style.color = 'var(--bs-link-color)';
            this.__cursorMove();
            this.__updateTripDisplay();
            this.__updateCarDisplay();
        }
    }
    previousTrip(){ // Move foco para proxima viagem no mesmo sentido (indiferente do carro)
        let v = this.projects[this.projectIndex].previousTrip(this.tripFocus());
        if(v){
            this.carLabels[this.carIndex].style.color = 'inherit';
            this.carIndex = v[0];
            this.tripIndex = v[1];
            this.carLabels[this.carIndex].style.color = 'var(--bs-link-color)';
            this.__cursorMove();
            this.__updateTripDisplay();
            this.__updateCarDisplay();
        }
    }
    __updateTripDisplay(){
        if(this.tripFocus() == null){return false;}
        this.displayTripType.innerHTML = this.translateType[this.tripFocus().tipo];
        if(this.tripFocus().tipo != $.INTERVALO){
            this.displayStart.innerHTML = this.tripFocus().getStart();
            this.displayEnd.innerHTML = this.tripFocus().getEnd();
            this.displayCycle.innerHTML = this.tripFocus().getCycle();
            this.displayFreq.innerHTML = this.tripFocus().tipo != $.RESERVADO ? this.projects[this.projectIndex].getHeadway(this.tripFocus()) || '--' : '--';
            this.displayInterv.innerHTML = this.projects[this.projectIndex].carros[this.carIndex].getInterv(this.tripIndex) || '--';
            this.displayTripWay.innerHTML = this.translateWay[this.tripFocus().sentido];
        }
        else{
            this.displayStart.innerHTML = min2Hour(this.tripFocus().inicio - 1);
            this.displayEnd.innerHTML = min2Hour(this.tripFocus().fim + 1);
            this.displayCycle.innerHTML = this.tripFocus().getCycle() + 2;
            this.displayFreq.innerHTML = '--';
            this.displayInterv.innerHTML = '--';
            this.displayTripWay.innerHTML = '';
        }
    }
    __updateCarDisplay(){
        if(this.tripIndex < 0){return false;}
        clearTimeout(this.updateCarDisplayTimeout);
        this.updateCarDisplayTimeout = setTimeout(()=>{this.__updateCarDisplayRun()}, this.updateCarDisplayDelay);
    }
    __updateCarDisplayRun(){
        this.displayTripsCount.innerHTML = this.projects[this.projectIndex].carros[this.carIndex].countTrips();
        this.displayJorney.innerHTML = min2Hour(this.projects[this.projectIndex].getJourney(this.carIndex), false);
        this.displayInterv2.innerHTML = min2Hour(this.projects[this.projectIndex].getIntervs(this.carIndex), false);
        this.carDisplayClassification.style.display = 'block';
        this.carDisplayClassification.value = this.projects[this.projectIndex].carros[this.carIndex].classificacao;
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
    __clearCarDisplay(){
        this.displayTripsCount.innerHTML = '';
        this.displayJorney.innerHTML = '';
        this.displayInterv2.innerHTML = '';
        try{
            this.carroDisplayClassification.remove();
        }catch(e){}
    }
    __cursorMove(){ // Movimenta o cursor para carro e viagem em foco, se cursor atingir limites (vertical ou horiontal) move canvas para ajustar voualizacao
        this.cursor.style.top = `calc(${this.carIndex + 1} * ${this.carHeight} - ${this.carTagWidth} - 17px)`;
        this.cursor.style.left = `calc((${this.tripFocus().inicio}) * ${this.rulerUnit} + ${this.carTagWidth} - 13px)`;
        // Ajusta estilo na freqRule dando enfase a viagem em foco
        this.rulerFreq.querySelectorAll('[data-selected=true]').forEach((el)=>{
            el.removeAttribute('data-selected');
            el.style.height = this.rulerSmallHeight;
            el.style.backgroundColor = this.rulerSmallColor;
        })
        if(![$.INTERVALO, $.ACESSO, $.RECOLHE].includes(this.tripFocus().tipo)){ // Identifica viagem na rulerFreq se viagem for produtiva
            this.freqGrid[this.carIndex][this.tripIndex].setAttribute('data-selected', true);
            this.freqGrid[this.carIndex][this.tripIndex].style.backgroundColor = this.freqRulerSelectColor;
            this.freqGrid[this.carIndex][this.tripIndex].style.height = this.freqRulerSelectHeight;
        }
        // --
        if(this.tripFocus().inicio < this.initialView){ // Verifica se cursor esta atingindo o limite horizontal a esquerda, se sim ajusta canvas
            let x = Math.ceil((this.initialView - this.tripFocus().inicio) / this.rulerMediumUnit) * this.rulerMediumUnit;
            this.canvasMove(x * -1);
        }
        else if(this.tripFocus().inicio > this.__getCanvasEndMargin()){// Verifica se cursor esta atingindo o limite horizontal a direita, se sim ajusta canvas
            let x = Math.ceil((this.tripFocus().inicio - this.__getCanvasEndMargin()) / this.rulerMediumUnit) * this.rulerMediumUnit;
            this.canvasMove(x);
        }
        if(this.carIndex < this.initialCarView){ // Verifica se cursor esta atingindo o limite vertical superior, se sim ajusta canvas
            let y = this.initialCarView - this.carIndex;
            this.initialCarView -= y;
            this.canvasMove(0, y);
        }
        else if(this.carIndex > (this.initialCarView + this.maxCarsVisible - 1)){ // Verifica se cursor esta atingindo o limite vertical inferior, se sim ajusta canvas
            let y = this.carIndex - (this.initialCarView + this.maxCarsVisible - 1);
            this.initialCarView += y;
            this.canvasMove(0, y * -1);            
        }
    }
    canvasFit(){ // Move canvas para posicao ajustada com a regua
        this.canvas.style.left = `calc(${this.rulerUnit} * ${this.initialView} * -1)`;
        this.rulerFreq.style.left = this.canvas.style.left;
    }
    canvasMove(x=0, y=0){ // Ajusta regua e move canvas em x e/ou y unidades
        // X valor em unidades (int) a ser movido o canvas
        // Y valor em unidades (int) representando os carros (2 = this.carIndex += 2)
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
            this.canvas.style.top = `calc(${this.canvas.style.top} + (${this.carHeight} * ${y}))`;
            this.carLabels.forEach((el)=>{ // Move as labels dos carros no eixo y
                el.style.top = `calc(${el.style.top} + (${this.carHeight} * ${y}))`;
            })
        }
    }
    __canvasRebuild(){ // Limpa canvas e refaz todas as viagens
        this.canvas.innerHTML = '';
        this.canvas.style.top = '0px';
        this.rulerFreq.innerHTML = '';
        this.__buildCursor(); // Refaz cursor
        this.carGrid = {};
        this.freqGrid = {};
        for(let i = 0; i < this.projects[this.projectIndex].carros.length;i++){
            this.carGrid[i] = [];
            this.freqGrid[i] = [];
            for(let j = 0; j < this.projects[this.projectIndex].carros[i].viagens.length; j++){
                this.addTrip(this.projects[this.projectIndex].carros[i].viagens[j], i);
            } 
        }
    }
    __clearGrid(){
        for(let i in this.carGrid){ // Apaga todos os elementos do grid
            for(let j = 0; j < this.carGrid[i].length; j++){
                this.carGrid[i][j].remove(); // Apaga viagem no grid
                this.freqGrid[i][j].remove(); // Apaga viagem no freqGrid
            }
        }
        this.carGrid = {};
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
        this.canvas.innerHTML = ''; // Limpa restante dos componentes (carro e carro_tags)
    }
    __clearCarLabels(){
        this.carLabels.forEach((el)=>{el.remove()}); // Apaga todos os labels de frota
        this.carLabels = [];
    }
    __getCanvasEndMargin(){ // Retorna (em minutos) a margem maxima a direita (usado para verificar limite antes do canvas movimentar)
        return this.initialView + this.maxMinutsVisible - this.endMinutsMargin;
    }
    __showTripPatterns(){
        if(this.patternsDialog){this.patternsDialog.close(); return false;} // Se modal ja esta aberto, fecha modal
        this.gridLocked = true; // Trava edicao do grid enquanto modal esta aberto
        this.patternsDialog = document.createElement('dialog');
        this.patternsDialog.innerHTML = `<h6>Padrão de Viagens<h6>IDA <div id="ida" style="margin-bottom:6px;width: 150px;height: 8px;border-radius: 10px;background-color: ${this.tripOrigemColor};"></div>
        VOLTA <div id="volta" style="margin-bottom:6px;width: 150px;height: 8px;border-radius: 10px;background-color: ${this.tripDestinoColor}"></div>
        RESERVADO <div id="reservado" style="margin-bottom:6px;width: 150px;height: 8px;border-radius: 10px;background: ${this.typePattern[$.RESERVADO].replaceAll('COLOR', this.tripOrigemColor)};"></div>
        EXPRESSO <div id="expresso" style="margin-bottom:6px;width: 150px;height: 8px;border-radius: 10px;background: ${this.typePattern[$.EXPRESSO].replaceAll('COLOR', this.tripOrigemColor)};"></div>
        SEMIEXPRESSO <div id="semi" style="margin-bottom:6px;width: 150px;height: 8px;border-radius: 10px;background: ${this.typePattern[$.SEMIEXPRESSO].replaceAll('COLOR', this.tripOrigemColor)};"></div>
        ACESSO <div id="acesso" style="margin-bottom:6px;width: 150px;height: 8px;border-radius: 10px;background: ${this.typePattern[$.ACESSO].replaceAll('COLOR', this.tripOrigemColor)};"></div>
        RECOLHE <div id="recolhe" style="margin-bottom:6px;width: 150px;height: 8px;border-radius: 10px;background: ${this.typePattern[$.RECOLHE].replaceAll('COLOR', this.tripOrigemColor)};"></div>
        INTERVALO <div id="refeicao" style="margin-bottom:6px;width: 150px;height: 8px;border-radius: 10px;background: ${this.typePattern[$.INTERVALO].replaceAll('COLOR', this.tripOrigemColor)};"></div>`;
        this.patternsDialog.addEventListener("close", (e) => {this.gridLocked = false;this.patternsDialog = null;}); // AO fechar destrava grid
        document.body.appendChild(this.patternsDialog);
        this.patternsDialog.showModal();
    }
    
    __gridIsBlock(){
        return this.gridLocked || canvasNavActive() || appKeyMap.modal.open;        
    }
    __generate(){
        this.gridLocked = true;
        let dialog = document.createElement('dialog');dialog.innerHTML = '<h5><i class="bi bi-code-slash me-1"></i> Gerar Planejamento</h5><p><b class="text-purple">Atenção</b>, ao confirmar, todo projeto em andamento <b class="text-purple">será apagado</b>,<br>este processo não pode ser desfeito.</p>';
        dialog.addEventListener('close', ()=>{this.gridLocked = false;dialog.remove()})
        let col1 = document.createElement('div');col1.style.width = '25%';col1.style.display = 'inline-block';
        let col2 = document.createElement('div');col2.style.width = '25%';col2.style.display = 'inline-block';col2.style.paddingLeft = '5px';
        let col3 = document.createElement('div');col3.style.width = '25%';col3.style.display = 'inline-block';col3.style.paddingLeft = '5px';
        let col4 = document.createElement('div');col4.style.width = '25%';col4.style.display = 'inline-block';col4.style.paddingLeft = '5px';col4.style.marginBottom = '10px';
        let carro = document.createElement('input');carro.type = 'number';carro.min = '1';carro.max = '40';carro.classList = 'flat-input';carro.placeholder = ' ';carro.id = 'March_generateCar'
        let inicioOperation = document.createElement('input');inicioOperation.type = 'time';inicioOperation.value = min2Hour($.INICIO_OPERACAO);inicioOperation.classList = 'flat-input';inicioOperation.placeholder = ' ';inicioOperation.id = 'March_generateStartOperation';
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
            let r = await this.projects[this.projectIndex].generate(metrics);
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
        this.projects[this.projectIndex].viewStage = stage;
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
        let stage2 = document.createElement('button');stage2.type = 'button';stage2.classList = 'btn btn-sm btn-phanton';stage2.innerHTML = 'Escalas';
        stage2.onclick = ()=>{
            this.switchStage(2)
            dialog.close();
        };
        let stage3 = document.createElement('button');stage3.type = 'button';stage3.classList = 'btn btn-sm btn-phanton';stage3.innerHTML = 'Conclusão';
        stage3.onclick = ()=>{
            this.switchStage(3)
            dialog.close();
        };
        switch (this.projects[this.projectIndex].viewStage){
            case 1: stage1.classList.add('active','disabled');break;
            case 2: stage2.classList.add('active','disabled');break;
            case 3: stage3.classList.add('active','disabled');break;
        }
        switch (this.projects[this.projectIndex].viewStage){
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
        this.initialCarView = 0;
        if(this.summaryModal){this.summaryModal.remove()}
        if(this.transferAreaIcon){this.transferAreaIcon.remove()}
        this.__clearScheduleGrid();
        this.__canvasRebuild();
        if(!this.settingsShowFreqRule.checked){this.settingsShowFreqRule.click()}
        this.footer.style.display = 'block';
        this.rulerTop.style.display = 'block';
        this.__clearTripDisplay();
        this.__clearCarDisplay();
        appKeyMap.unbindGroup(['March_stage2','March_stage3']); // Limpa atalhos exclusivos das outras viewStage
        this.__addStage1Listeners(); // Adiciona novamente atalhos para stage 1
        this.__clearGrid(); // Apaga elemento do grid e freqGrid
        this.__clearCarLabels(); // Apaga as labels dos carros
        this.__clearSelecao(); // Limpa selecao (caso exista)
        this.rulerUnit = this.defaultSettings.rulerUnit;
        this.rulerMediumUnit = this.defaultSettings.rulerMediumUnit;
        this.settingsrulerUnit.value = parseInt(this.defaultSettings.rulerUnit);
        this.settingsrulerMediumUnit.value = this.defaultSettings.rulerMediumUnit;
        for(let i = 0; i < this.projects[this.projectIndex].carros.length; i++){ // Recria todos os carros e viagens
            this.addCar(this.projects[this.projectIndex].carros[i], i + 1);
        }
        if(this.projects[this.projectIndex].carros.length > 0){ // Se projeto ja iniciado aponta para primeira viagem do primeiro carro
            this.carIndex = 0;
            this.tripIndex = 0;
            this.__cursorMove();
            this.__updateTripDisplay();
            this.__updateCarDisplay();
            this.initialView = min2Range(this.projects[this.projectIndex].carros[0].viagens[0].inicio) * 60; // Ajusta a visao inicial do grid para a faixa da primeira viagem do projeto
            this.canvasFit();
            this.__buildRuler();
            this.carLabels[this.carIndex].style.color = 'var(--bs-link-color)';
            if(this.projects[this.projectIndex].area_transferencia.length > 0)(this.__addToTransferAddLabel()) // Se existe viagem na area de transferencia, adiciona label
        }
        else{
            this.carIndex = -1;
            this.tripIndex = -1;
            this.cursor.style.left = '-200px'
            this.canvasFit();
            this.__buildRuler();
        }
    }
    __loadStage2(){ // Carrega interface para manipulacao das escalas
        this.initialCarView = 0;
        this.canvas.style.top = '0px';
        this.footer.style.display = 'none';
        this.rulerTop.style.display = 'block';
        this.arrowsVisible = true;
        if(this.summaryModal){this.summaryModal.remove()}
        if(this.settingsShowFreqRule.checked){this.settingsShowFreqRule.click()}
        appKeyMap.unbindGroup(['March_stage1','March_stage3']);
        this.__addStage2Listeners(); // Adiciona novamente atalhos para stage 1
        this.__clearGrid(); // Apaga elemento do grid e freqGrid
        this.__clearCarLabels(); // Apaga as labels dos carros
        if(this.cursor){this.cursor.remove();} // Remove o cursor
        this.rulerUnit = '2px';
        this.rulerMediumUnit = 60;
        this.settingsrulerUnit.value = 2;
        this.settingsrulerMediumUnit.value = 60;
        if(this.projects[this.projectIndex].carros.length > 0){
            this.initialView = min2Range(this.projects[this.projectIndex].getFirstTrip()[0].inicio) * 60; // Ajusta a visao inicial do grid para a faixa da primeira viagem do projeto
        }
        this.__buildRuler();
        this.canvasFit();
        // --
        for(let i = 0; i < this.projects[this.projectIndex].carros.length; i++){ // Constroi os escalas do carro
            let blocks = this.projects[this.projectIndex].carros[i].getCarSchedulesBlock(this.projects[this.projectIndex].linha);
            this.scheduleGrid[i] = []; // Incicia array para armazenar escalas do carro
            this.spotsGrid[i] = []; // Incicia array para armazenar elements spots
            for(let y = 0; y < blocks.length; y++){
                let carro = document.createElement('div');carro.style = 'position:absolute;display: flex;height: 45px;border:1px solid #495057;border-radius: 3px;'
                carro.style.width = `calc(${this.rulerUnit} * ${blocks[y].size})`;
                carro.style.top = `calc(${this.carHeight} * ${i + 1} - ${this.carHeight} + 10px)`;
                carro.style.left = `calc(${this.carTagWidth} + (${blocks[y].inicio} * ${this.rulerUnit}))`;
                this.canvas.appendChild(carro);
                // Adiciona pontos de rendicao de cada bloco
                for(let x = 0; x < blocks[y].spots.length; x++){
                    let sp = document.createElement('i');sp.style.position = 'absolute';sp.style.zIndex = '80';
                    sp.style.opacity = '10%';
                    sp.style.top = `calc(${this.carHeight} * ${i + 1} - 12px)`;
                    sp.style.left = `calc(${this.carTagWidth} + ${blocks[y].spots[x].time} * ${this.rulerUnit} - 9px)`;
                    sp.title = `${min2Hour(blocks[y].spots[x].time)} ${blocks[y].spots[x].locale.nome}`;
                    if(blocks[y].spots[x].tipo == 'tripEnd'){
                        sp.classList = 'bi bi-caret-down-fill marchSpot pt-1';
                    }
                    else{sp.classList = 'bi bi-pin-map-fill marchSpot';}
                    sp.onclick = () => {
                        if(this.scheduleFocus == null || this.scheduleFocus[0] != i || this.scheduleFocus[2] != y){return false}
                        let r;
                        if(blocks[y].spots[x].tipo == 'tripEnd'){
                            r = this.projects[this.projectIndex].carros[this.scheduleFocus[0]].updateSchedule(this.scheduleFocus[1], {fim: blocks[y].spots[x].tripIndex, deltaEnd: 0, local: blocks[y].spots[x].locale}, blocks[y].inicioIndex, blocks[y].fimIndex);
                        }
                        else{
                            r = this.projects[this.projectIndex].carros[this.scheduleFocus[0]].updateSchedule(this.scheduleFocus[1],{fim: blocks[y].spots[x].tripIndex, deltaEnd: blocks[y].spots[x].delta, local: blocks[y].spots[x].locale}, blocks[y].inicioIndex, blocks[y].fimIndex);
                        }
                        if(r){  // Ajustar para atualizar o blocks
                            this.__cleanScheduleGrid(i);
                            this.__updateCarSchedules(i, this.projects[this.projectIndex].carros[i].getCarSchedulesBlock(this.projects[this.projectIndex].linha))
                        }
                    }
                    this.canvas.appendChild(sp);
                    this.spotsGrid[i].push(sp);                    
                }
            }
            let carro_tag = document.createElement('div');carro_tag.style = 'position: absolute; user-select: none;';
            carro_tag.style.top = `calc(${this.carHeight} * ${i + 1} - 25px)`;
            carro_tag.style.left = `calc(${this.carTagWidth} + (${blocks[0].inicio} * ${this.rulerUnit}) - 22px)`;
            carro_tag.innerHTML = String(i + 1).padStart(2,'0');
            this.__updateCarSchedules(i, blocks);
            this.canvas.appendChild(carro_tag);
        }
        this.__updateScheduleArrows(); // Adiciona arrows nas escalas
        if(this.projects[this.projectIndex].carros.length > 0){
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
        this.__clearCarLabels(); // Apaga as labels dos carros
        this.__clearSelecao(); // Limpa selecao (caso exista)
        if(this.settingsShowFreqRule.checked){this.settingsShowFreqRule.click()}
        this.rulerTop.style.display = 'none';
        if(this.cursor){this.cursor.remove();} // Remove o cursor
        appKeyMap.unbindGroup(['March_stage1','March_stage3']); // Limpa atalhos exclusivos das outras viewStage
        // ****
        this.summaryModal = document.createElement('dialog');this.summaryModal.style = 'border: 1px solid #FFF; width: 1000px; position: absolute; top: 60px';
        this.summaryModal.addEventListener('cancel', (ev)=>{ev.preventDefault();})
        let summary1 = this.projects[this.projectIndex].countTrips(); // Gera resumo das viagens planejadas
        let summary2 = this.projects[this.projectIndex].countWorkers(); // Gera resumo de mao de obra
        let km_produtiva = parseFloat((summary1.origem * this.projects[this.projectIndex].linha.extensao_ida) + (summary1.destino * this.projects[this.projectIndex].linha.extensao_volta));
        let km_improdutiva = parseFloat((summary1.accessFrom * this.projects[this.projectIndex].linha.acesso_origem_km) + (summary1.accessTo * this.projects[this.projectIndex].linha.acesso_destino_km) + (summary1.recallFrom * this.projects[this.projectIndex].linha.recolhe_origem_km) + (summary1.recallTo * this.projects[this.projectIndex].linha.recolhe_destino_km) + (summary1.lazyFrom * this.projects[this.projectIndex].linha.extensao_ida) + (summary1.lazyTo * this.projects[this.projectIndex].linha.extensao_volta));
        let perc_produtiva = km_produtiva / (km_produtiva + km_improdutiva) * 100 || 0;
        let perc_improdutiva = km_improdutiva / (km_produtiva + km_improdutiva) * 100 || 0;
        this.summaryModal.innerHTML = `
        <h6>Resumo de Projeto</h6><hr>
        <div style="display: flex;gap: 10px;">
        <table>
        <tbody>
        <tr><td style="padding-right: 10px;">Frota</td><td>${this.projects[this.projectIndex].carros.length}</td></tr>
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
        <tr><td style="padding-right: 20px;">Projeto:</td><td><b class="text-secondary">${this.projects[this.projectIndex].nome}</b></td></tr>
        <tr><td style="padding-right: 20px;">Linha:</td><td><b class="text-secondary">${this.projects[this.projectIndex].linha.codigo}</b></td></tr>
        <tr><td style="padding-right: 20px;">Nome:</td><td><b class="text-secondary">${this.projects[this.projectIndex].linha.nome}</b></td></tr>
        <tr><td style="padding-right: 20px;">Status:</td><td><b class="text-secondary" id="March_summaryActiveLabel">${this.projects[this.projectIndex].active ? '<b class="text-success">Ativo</b>' : '<b class="text-secondary">Inativo</b>'}</b></td></tr>
        <tr><td colspan="2"><hr class="my-2"></td></tr>
        <tr><td colspan="2" class="text-secondary">${this.projects[this.projectIndex].desc}</td></tr>
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
            this.projects[this.projectIndex].save();
        };
        document.getElementById('March_summaryBlock3Container').appendChild(summaryProjectSumbit);
        
        let summaryProjectExport = document.createElement('button');summaryProjectExport.type = 'button';summaryProjectExport.classList = 'btn btn-sm btn-phanton mt-3 me-2 float-end fw-bold';summaryProjectExport.id = 'March_summaryProjectExport';summaryProjectExport.innerHTML = 'Exportar';
        summaryProjectExport.onclick = () => {this.projects[this.projectIndex].exportJson()}
        document.getElementById('March_summaryBlock3Container').appendChild(summaryProjectExport);
        
        // Gera Grafico de oferta e demanda (requer chartJS)
        let od = this.projects[this.projectIndex].supplyNDemand();
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
        if(this.projects[this.projectIndex].carros[options.carIndex].escalas[options.escala_index].deltaStart > 0){
            inicio = min2Hour(this.projects[this.projectIndex].carros[options.carIndex].viagens[this.projects[this.projectIndex].carros[options.carIndex].escalas[options.escala_index].inicio - 1].inicio + this.projects[this.projectIndex].carros[options.carIndex].escalas[options.escala_index].deltaStart);
        }
        else{inicio = min2Hour(this.projects[this.projectIndex].carros[options.carIndex].viagens[this.projects[this.projectIndex].carros[options.carIndex].escalas[options.escala_index].inicio].inicio)}
        // ---
        if(this.projects[this.projectIndex].carros[options.carIndex].escalas[options.escala_index].deltaEnd > 0){
            fim = min2Hour(this.projects[this.projectIndex].carros[options.carIndex].viagens[this.projects[this.projectIndex].carros[options.carIndex].escalas[options.escala_index].fim].inicio + this.projects[this.projectIndex].carros[options.carIndex].escalas[options.escala_index].deltaEnd - 1);
        }
        else{fim = min2Hour(this.projects[this.projectIndex].carros[options.carIndex].viagens[this.projects[this.projectIndex].carros[options.carIndex].escalas[options.escala_index].fim].fim)}
        let jornada = this.projects[this.projectIndex].carros[options.carIndex].getScheduleJourney(options.escala_index);
        let previous, next;
        
        if(this.projects[this.projectIndex].carros[options.carIndex].escalas[options.escala_index].next?.externalProject){ // Verifica se existe complmento de jornada em outra linha posterior a esta
            next = {nome: `[ ${this.projects[this.projectIndex].carros[options.carIndex].escalas[options.escala_index].next.externalProject} ]`}
        }
        if(this.projects[this.projectIndex].carros[options.carIndex].escalas[options.escala_index].previous?.externalProject){ // Verifica se existe complemento de jornada em outra linha anterior a esta
            previous = {nome: `[ ${this.projects[this.projectIndex].carros[options.carIndex].escalas[options.escala_index].previous.externalProject} ]`}
        }
        return `<div><b data-type="escala-next" class="ms-1">${previous ? previous.nome + ' <i class="bi bi-arrow-left me-1"></i>': ''}</b><b data-type="escala-nome" class="me-2">${this.projects[this.projectIndex].carros[options.carIndex].escalas[options.escala_index].nome}</b>${min2Hour(jornada)}<b data-type="escala-next" class="ms-1">${next ? '<i class="bi bi-arrow-right ms-1"></i> ' + next.nome : ''}</b><div class="fs-8 text-center text-secondary">${inicio}&nbsp;&nbsp;&nbsp;${fim}</div></div>`;
    }
    __updateCarSchedules(carIndex, blocks){ // Refaz escalas do carro informado
        this.scheduleGrid[carIndex].forEach((el) => {el.remove()});
        this.scheduleGrid[carIndex] = []; // Incicia array para armazenar escalas do carro
        for(let j = 0; j < this.projects[this.projectIndex].carros[carIndex].escalas.length; j++){ // Percorre todos os escalas ja definidos e adiciona no carro
            let metrics = this.projects[this.projectIndex].carros[carIndex].getScheduleJourney(j, true);
            let bg = this.scheduleFocus && JSON.stringify([this.scheduleFocus[0], this.scheduleFocus[1]]) == JSON.stringify([carIndex, j]) ? '#032830' : '#1a1d20';
            let sq = document.createElement('div');sq.setAttribute('data-bs-theme', 'dark'); sq.style = `height: 43px;border-right: 2px solid #495057;text-align: center;background-color: ${bg};color: #ced4da;user-select: none; position: absolute;z-index: 50;`;
            sq.style.left = `calc(${metrics[1]} * ${this.rulerUnit} + ${this.carTagWidth} + 1px)`;
            sq.style.top = `calc(${this.carHeight} * ${carIndex + 1} - ${this.carHeight} + 11px)`;
            sq.innerHTML = this.__escalaAddContent({carIndex: carIndex, escala_index: j});
            sq.style.width = `calc(${metrics[0]} * ${this.rulerUnit} - 1px)`;
            sq.onclick = () => {
                if(this.scheduleFocus){this.scheduleGrid[this.scheduleFocus[0]][this.scheduleFocus[1]].style.backgroundColor = '#1a1d20';}
                sq.style.backgroundColor = '#032830';
                let target_block = null;
                for(let x = 0; x < blocks.length; x++){ // Verifica a qual bloco a viagem pertence
                    if(this.projects[this.projectIndex].carros[carIndex].escalas[j].inicio >= blocks[x].inicioIndex && this.projects[this.projectIndex].carros[carIndex].escalas[j].fim <= blocks[x].fimIndex){target_block = x;break;}
                }
                this.scheduleFocus = [carIndex, j, target_block];
            }
            if(this.projects[this.projectIndex].carros[carIndex].escalas[j].previous == null){
                let previous = document.createElement('i');previous.classList = 'bi bi-arrow-bar-left px-1 py-1 fs-5 pointer';previous.style.position = 'absolute';previous.style.left = '5px';previous.style.top = '3px';
                previous.onclick = (ev) => {
                    ev.stopImmediatePropagation();
                    if(!this.scheduleSelect){
                        this.scheduleSelect = [carIndex, j, previous];
                        this.__scheduleExternalControl('previous', blocks); // Adiciona controle para externalProject
                    }
                    else if(this.scheduleSelect[0] != carIndex || this.scheduleSelect[1] != j){
                        let inicio = this.projects[this.projectIndex].carros[carIndex].viagens[this.projects[this.projectIndex].carros[carIndex].escalas[j].inicio];
                        let fim = this.projects[this.projectIndex].carros[this.scheduleSelect[0]].viagens[this.projects[this.projectIndex].carros[this.scheduleSelect[0]].escalas[this.scheduleSelect[1]].fim];
                        if(fim.fim > inicio.inicio){return false}
                        this.projects[this.projectIndex].carros[this.scheduleSelect[0]].escalas[this.scheduleSelect[1]].next = {externalProject: null, carro: carIndex, escala: j};
                        this.projects[this.projectIndex].carros[carIndex].escalas[j].previous = {externalProject: null, carro: this.scheduleSelect[0], escala: this.scheduleSelect[1]};
                        this.__updateCarSchedules(carIndex, blocks);
                        if(this.scheduleSelect[0] != carIndex){this.__updateCarSchedules(this.scheduleSelect[0], blocks);}
                        this.__updateScheduleArrows();
                        this.scheduleSelect = null;
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
                    if(!this.projects[this.projectIndex].carros[carIndex].escalas[j].previous.externalProject){
                        destiny = this.projects[this.projectIndex].carros[carIndex].escalas[j].previous;
                        this.projects[this.projectIndex].carros[destiny.carro].escalas[destiny.escala].next = null;
                    }
                    if(!this.projects[this.projectIndex].carros[carIndex].escalas[j].previous.externalProject && carIndex != destiny.carro){
                        this.__updateCarSchedules(destiny.carro, blocks);
                    }
                    this.projects[this.projectIndex].carros[carIndex].escalas[j].previous = null;
                    this.__updateCarSchedules(carIndex, blocks);
                    this.__updateScheduleArrows();
                }
                sq.appendChild(previous);
            }
            if(this.projects[this.projectIndex].carros[carIndex].escalas[j].next == null){
                let next = document.createElement('i');next.classList = 'bi bi-arrow-bar-right px-1 py-1 fs-5 pointer';next.style.position = 'absolute';next.style.right = '5px';next.style.top = '3px';
                next.onclick = (ev) => {
                    ev.stopImmediatePropagation();
                    if(this.scheduleSelect && (this.scheduleSelect[0] != carIndex || this.scheduleSelect[1] != j)){return null} // So seleciona caso nao existe escala selecionada
                    if(this.scheduleSelect && this.scheduleSelect[0] == carIndex && this.scheduleSelect[1] == j){ // Se precionar novamente cancela selecao de escala
                        next.classList = 'bi bi-arrow-bar-right px-1 py-1 fs-5 pointer';
                        this.scheduleSelect = null;
                        this.externalControl.remove();
                    }
                    else{
                        next.classList = 'bi bi-arrow-left-right py-1 pe-1 fs-5 pointer';
                        this.scheduleSelect = [carIndex, j, next];
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
                    if(!this.projects[this.projectIndex].carros[carIndex].escalas[j].next.externalProject){
                        destiny = this.projects[this.projectIndex].carros[carIndex].escalas[j].next;
                        this.projects[this.projectIndex].carros[destiny.carro].escalas[destiny.escala].previous = null;
                    }
                    if(!this.projects[this.projectIndex].carros[carIndex].escalas[j].next.externalProject && carIndex != destiny.carro){
                        this.__updateCarSchedules(destiny.carro, blocks);
                    }
                    this.projects[this.projectIndex].carros[carIndex].escalas[j].next = null;
                    this.__updateCarSchedules(carIndex, blocks);
                    this.__updateScheduleArrows();
                }
                sq.appendChild(next);
            }
            this.canvas.appendChild(sq);
            this.scheduleGrid[carIndex].push(sq);
        }
        // Se existe viagens sem escala no bloco, insere bloco empty
        for(let i = 0; i < blocks.length; i++){
            if(blocks[i].emptyStart == undefined){continue}
            let sq = document.createElement('div');sq.style = `height: 43px;text-align: center;user-select: none; position: absolute;z-index: 50; padding-top: 5px`;
            sq.setAttribute('data-type', 'emptySchedule');
            let left;
            if(blocks[i].deltaEnd == 0){left = this.projects[this.projectIndex].carros[carIndex].viagens[blocks[i].emptyStart].inicio}
            else{
                left = this.projects[this.projectIndex].carros[carIndex].viagens[blocks[i].emptyStart - 1].inicio + blocks[i].deltaEnd;
            }
            sq.style.left = `calc(${left} * ${this.rulerUnit} + ${this.carTagWidth} + 1px)`;
            sq.style.top = `calc(${this.carHeight} * ${carIndex + 1} - ${this.carHeight} + 11px)`;
            sq.innerHTML = '<i class="bi bi-plus-lg fs-5 text-secondary"></i>';
            
            let jornada = blocks[i].inicio + blocks[i].size - left;
            sq.style.width = `calc(${jornada} * ${this.rulerUnit} - 2px)`;
            sq.onclick = () => {
                if(this.scheduleFocus){this.scheduleGrid[this.scheduleFocus[0]][this.scheduleFocus[1]].style.backgroundColor = '#1a1d20';}
                let r = this.projects[this.projectIndex].addSchedule(carIndex, {inicio: blocks[i].emptyStart, fim: blocks[i].fimIndex, deltaEnd: 0, deltaStart: 0, next: null, previous: null})
                this.scheduleFocus = [carIndex, r, i];
                this.__updateCarSchedules(carIndex, this.projects[this.projectIndex].carros[carIndex].getCarSchedulesBlock(this.projects[this.projectIndex].linha))
            }
            this.canvas.appendChild(sq);
            this.scheduleGrid[carIndex].push(sq);
            this.scheduleGrid[carIndex].sort((a, b) => a.offsetLeft > b.offsetLeft ? 1 : -1);
        }
    }
    __updateScheduleArrows(){
        for(let i in this.arrowsGrid){ // Apaga todos as arrows do canvas
            this.arrowsGrid[i].forEach((el)=>{el.destroy();});
        }
        for(let i = 0; i < this.projects[this.projectIndex].carros.length; i++){ // Monta arrows
            this.arrowsGrid[i] = []; // Reinicia dicionario
            for(let j = 0; j < this.projects[this.projectIndex].carros[i].escalas.length; j++){
                if(this.projects[this.projectIndex].carros[i].escalas[j].next && !this.projects[this.projectIndex].carros[i].escalas[j].next.externalProject){
                    let arrow = new jsELConnector({
                        from: this.scheduleGrid[i][j],
                        to: this.scheduleGrid[this.projects[this.projectIndex].carros[i].escalas[j].next.carro][this.projects[this.projectIndex].carros[i].escalas[j].next.escala],
                        container: this.canvas,               
                    });
                    this.arrowsGrid[i].push(arrow);
                }
            }
        }
    }
    __scheduleExternalControl(position, blocks){ // Exibe modal para adicao de externalProject na escala
        let el = this.scheduleGrid[this.scheduleSelect[0]][this.scheduleSelect[1]];
        this.externalControl = document.createElement('button');this.externalControl.type = 'button';this.externalControl.classList = 'btn btn-sm btn-phanton'; this.externalControl.innerHTML = 'Externo';
        this.externalControl.style = `position: absolute; top: ${el.offsetTop + 5}px;left: ${el.offsetLeft + el.offsetWidth + 5}px;z-index: 200;`;
        this.externalControl.onclick = () => {
            this.gridLocked = true;
            let modal = document.createElement('dialog');modal.style.width = '200px';
            modal.addEventListener('close', ()=>{
                this.gridLocked = false;
                if(position == 'previous'){
                    this.externalControl.remove();
                    this.scheduleSelect = null;
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
                this.projects[this.projectIndex].carros[this.scheduleSelect[0]].escalas[this.scheduleSelect[1]][position] = s;
                this.__updateCarSchedules(this.scheduleSelect[0], blocks);
                this.scheduleSelect = null;
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
        for(let i in this.arrowsGrid){
            this.arrowsGrid[i].forEach((el) => {el.setVisibility(v)});
        }
    }
    __cleanScheduleGrid(carIndex){ // Limpa as escalas do carro informado (nao remove nem carro nem spots)
        for(let i in this.scheduleGrid[carIndex]){
            this.scheduleGrid[carIndex][i].remove();
        }
    }
    uploadProject(){
        let loadInput = document.createElement('input');loadInput.type = 'file';loadInput.setAttribute('accept', '.json');loadInput.style.display = 'none';
        let obj = this;
        loadInput.onchange = (ev) => {
            ev.stopPropagation();
            let fr = new FileReader();
            fr.onload = (function(){
                let r = JSON.parse(fr.result);
                if(r.version != obj.projects[obj.projectIndex].version){appNotify('warning', `O arquivo carregado <code>${r.version}</code> tem versão diferente da aplicação <code>${obj.projects[obj.projectIndex].version}</code>, o que pode gerar incompatibilidade e/ou erros de execução.`, false)}
                obj.projects[obj.projectIndex].load(JSON.parse(fr.result));
                obj.projects[obj.projectIndex].viewStage = 1;
                obj.switchStage(1);
                canvasNavActive(false);
            });
            fr.readAsText(loadInput.files[0]);
        }
        loadInput.click();
        loadInput.remove();
    }
}

export { jsGaitDiagramUI }