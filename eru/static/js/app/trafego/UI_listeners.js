function __addGeneralListeners(){ // Cria atalhos de teclado gerais do projeto (indiferente do viewStage)
    appKeyMap.unbind('alt+l'); // Remove atalho para dar reload em pagina (se projeto nao salvo iria perder todo progresso)
    appKeyMap.bind('ctrl+arrowright', ()=>{this.canvasMove(120); return false;}, {group: 'March_general', desc: 'Move grid para direita (02 horas)'})
    appKeyMap.bind('ctrl+arrowleft', ()=>{this.canvasMove(-120);return false;}, {group: 'March_general', desc: 'Move grid para esquerda (02 horas)'})
    appKeyMap.bind('f5', (ev)=>{return false;}, {context:'all', visible: false}) // Desabilita tecla F5 (evita de perder projeto)
    appKeyMap.bind('alt+1', ()=>{this.switchStage(1); return false;}, {group: 'March_general', desc: 'Altera visualização para o Grid'})
    appKeyMap.bind('alt+2', ()=>{this.switchStage(2); return false;}, {group: 'March_general', desc: 'Altera visualização para Escalas'})
    appKeyMap.bind('alt+3', ()=>{this.switchStage(3); return false;}, {group: 'March_general', desc: 'Altera visualização para resumo'})
    appKeyMap.bind('alt+g', ()=>{
        appNotify('warning', '<i class="bi bi-check2-square me-2"></i> Em desenvolvimento....');
        return false;
    }, {group: 'March_general', desc: 'Salva projeto em armazenamento local'})
    appKeyMap.bind('ctrl+shift+l', ()=>{
        this.projects[this.projectIndex].reset();
        this.__loadStage1();
        this.settingsSumIntervGaps.checked = this.projects[this.projectIndex].sumInterGaps;
        appNotify('warning', '<b class="me-1">Info:</b> Projeto reiniciado.');
        return false;
    }, {group: 'March_general', desc: 'Limpa projeto atual'})
}

function __addStage1Listeners(){ // Cria atalhos de teclado para manipulação do diagrama de marcha
    appKeyMap.bind('alt+;', ()=>{if(this.__gridIsBlock()){return false};this.addCar();return false;}, {group: 'March_stage1', desc: 'Insere carro no projeto'})
    appKeyMap.bind('alt+.', ()=>{
        if(this.__gridIsBlock() || !this.tripFocus()){return false}
        if(this.projects[this.projectIndex].carros[this.carIndex].escalas.length > 0){
            this.__modalConfirmationChangeProject(()=>{
                this.projects[this.projectIndex].carros[this.carIndex].escalas = [];
                this.addTrip();
            })
        }
        else{this.addTrip();}
        return false;
    }, {group: 'March_stage1', desc: 'Insere viagem ao final do carro'})
    appKeyMap.bind('alt+ctrl+.', ()=>{
        if(this.__gridIsBlock() || !this.tripFocus()){return false;}
        if(this.projects[this.projectIndex].carros[this.carIndex].escalas.length > 0){
            this.__modalConfirmationChangeProject(()=>{
                this.projects[this.projectIndex].carros[this.carIndex].escalas = [];
                this.addTripAt()
            })
        }
        else{this.addTripAt();}
        return false;
    }, {group: 'March_stage1', desc: 'Insere viagem para carro informando inicio'})
    appKeyMap.bind('arrowright', (ev)=>{
        if(!this.tripFocus() || this.__gridIsBlock()){return}
        if(this.projects[this.projectIndex].carros[this.carIndex].viagens.length > this.tripIndex + 1){
            this.tripIndex++;
            this.__cursorMove();
            this.__updateTripDisplay();
        }
        return false;
    }, {group: 'March_stage1', desc: 'Move foco para próxima viagem do carro'})
    appKeyMap.bind('arrowleft', (ev)=>{
        if(!this.tripFocus() || this.__gridIsBlock()){return}
        if(this.tripIndex > 0){
            this.tripIndex--;
            this.__cursorMove();
            this.__updateTripDisplay();
        }
        return false;
    }, {group: 'March_stage1', desc: 'Move foco para viagem anterior do carro'})
    appKeyMap.bind('arrowdown', (ev)=>{
        if(!this.tripFocus() || this.__gridIsBlock()){return}
        if(this.projects[this.projectIndex].carros.length > this.carIndex + 1){
            let inicio = this.tripFocus().inicio;
            this.carLabels[this.carIndex].style.color = 'inherit';
            this.carIndex++;
            this.carLabels[this.carIndex].style.color = 'var(--bs-link-color)';
            // Identifica viagem mais proxima do proximo carro para mover cursor
            let bestMatch = this.projects[this.projectIndex].carros[this.carIndex].viagens[0];
            let escape = false;
            this.tripIndex = 0;
            while(!escape){
                // Percorre viagens do proximo carro ate final ou ate achar melhor correspondente
                // Se viagem analisada inicia apos (ou no mesmo horario) de bestMatch termina execucao
                if(this.projects[this.projectIndex].carros[this.carIndex].viagens.length == this.tripIndex + 1 || this.projects[this.projectIndex].carros[this.carIndex].viagens[this.tripIndex + 1].inicio >= inicio){escape = true}
                else{
                    this.tripIndex++;
                    bestMatch = this.projects[this.projectIndex].carros[this.carIndex].viagens[this.tripIndex];
                }
            }
            this.__cursorMove();
            this.__updateTripDisplay();
            this.__updateCarDisplay();
        }
        return false;
    }, {group: 'March_stage1', desc: 'Move foco para próximo carro'})
    appKeyMap.bind('arrowup', (ev) => {
        if(!this.tripFocus() || this.__gridIsBlock()){return}
        if(this.carIndex > 0){
            let inicio = this.tripFocus().inicio;
            this.carLabels[this.carIndex].style.color = 'inherit';
            this.carIndex--;
            this.carLabels[this.carIndex].style.color = 'var(--bs-link-color)';
            // Identifica viagem mais proxima do proximo carro para mover cursor
            let bestMatch = this.projects[this.projectIndex].carros[this.carIndex].viagens[0];
            let escape = false;
            this.tripIndex = 0;
            while(!escape){
                // Percorre viagens do proximo carro ate final ou ate achar melhor correspondente
                // Se viagem analisada inicia apos (ou no mesmo horario) de bestMatch termina execucao
                if( this.projects[this.projectIndex].carros[this.carIndex].viagens.length == this.tripIndex + 1 ||
                    this.projects[this.projectIndex].carros[this.carIndex].viagens[this.tripIndex + 1].inicio > inicio){escape = true}
                    else{
                        this.tripIndex++;
                        bestMatch = this.projects[this.projectIndex].carros[this.carIndex].viagens[this.tripIndex];
                    }
                }
                this.__cursorMove();
                this.__updateTripDisplay();
                this.__updateCarDisplay();
            }
        return false;
    }, {group: 'March_stage1', desc: 'Move foco para carro anterior'})
    appKeyMap.bind('alt+/', ()=>{this.settingsShowFreqRule.click();return false;}, {group: 'March_stage1', desc: 'Exibe/oculta régua de frequência'})
    appKeyMap.bind('+', (ev)=>{if(!this.tripFocus() || this.__gridIsBlock()){return} this.plus();return false;}, {group: 'March_stage1', desc: 'Aumenta 1 min ao final da viagem e nas posteriores'})
    appKeyMap.bind('shift++', ()=>{if(!this.tripFocus() || this.__gridIsBlock()){return false}this.plus(false);return false;}, {group: 'March_stage1', desc: 'Aumenta 1 minuto na viagem'})
    appKeyMap.bind('-', (ev)=>{if(!this.tripFocus() || this.__gridIsBlock()){return} this.sub();return false;}, {group: 'March_stage1', desc: 'Subtrai 1 min ao final da viagem e nas posteriores'})
    appKeyMap.bind('shift+-', ()=>{if(!this.tripFocus() || this.__gridIsBlock()){return false}this.sub(false);return false;}, {group: 'March_stage1', desc: 'Subtrai 1 minuto na viagem'})
    appKeyMap.bind(' ', (ev)=>{if(!this.tripFocus() || this.__gridIsBlock()){return} this.advance();return false;}, {group: 'March_stage1', desc: 'Atrasa inicio em 1 minuto, move posteriores'})
    appKeyMap.bind('shift+ ', ()=>{if(!this.tripFocus() || this.__gridIsBlock()){return false}
        this.moveStart();
        this.__cursorMove();
        return false;
    }, {group: 'March_stage1', desc: 'Aumenta 1 min no inicio da viagem'})
    appKeyMap.bind('backspace', (ev)=>{if(!this.tripFocus() || this.__gridIsBlock()){return} this.back();}, {group: 'March_stage1', desc: 'Adianta em 1 min inicio da viagem e nas posteriores'})
    appKeyMap.bind('shift+backspace', ()=>{if(!this.tripFocus() || this.__gridIsBlock()){return false}this.backStart();return false;}, {group: 'March_stage1', desc: 'Adianta inicio da viagem em 1 min'})
    appKeyMap.bind('alt+r', ()=>{
        if(this.__gridIsBlock() || !this.tripFocus()){return false;}
        if(this.projects[this.projectIndex].carros[this.carIndex].escalas.length > 0){
            this.__modalConfirmationChangeProject(()=>{
                this.projects[this.projectIndex].carros[this.carIndex].escalas = [];
                this.addInterv();
                this.__updateTripDisplay();
            })
        }
        else{this.addInterv();this.__updateTripDisplay();}
        return false;
    }, {group: 'March_stage1', desc: 'Adiciona intervalo ate a próxima viagem'})
    appKeyMap.bind('alt+a', ()=>{
        if(!this.tripFocus() || this.__gridIsBlock()){return false}
        if(this.projects[this.projectIndex].carros[this.carIndex].escalas.length > 0){
            this.__modalConfirmationChangeProject(()=>{
                this.projects[this.projectIndex].carros[this.carIndex].escalas = [];
                this.addAccess();
                this.__updateTripDisplay();
            })
        }
        else{this.addAccess();this.__updateTripDisplay();}
        return false;
    }, {group: 'March_stage1', desc: 'Adiciona acesso na viagem'})
    appKeyMap.bind('ctrl+shift+a', ()=>{
        if(!this.tripFocus() || this.__gridIsBlock()){return false}
        let increment = true; // addAccess por padrao incrementa o this.tripIndex, deve incrementar somente para o carro em foco
        for(let i = 0; i < this.projects[this.projectIndex].carros.length; i++){
            let r = this.addAccess(i, 0, increment); // Tenta adicionar recolhe na ultima viagem de cada carro
            increment = false;
            if(r){this.projects[this.projectIndex].carros[i].escalas = [];} // Limpa escalas do carro
        }
        return false;
    }, {group: 'March_stage1', desc: 'Adiciona acesso para todos os carros'})
    appKeyMap.bind('alt+p', ()=>{
        if(this.__gridIsBlock() || !this.tripFocus()){return false;}
        if(this.projects[this.projectIndex].carros[this.carIndex].escalas.length > 0){
            this.__modalConfirmationChangeProject(()=>{
                this.projects[this.projectIndex].carros[this.carIndex].escalas = [];
                this.viagemShut();
                this.__updateTripDisplay();
            })
        }
        else{this.viagemShut();this.__updateTripDisplay();}
        return false;
    }, {group: 'March_stage1', desc: 'Encerra turno na viagem'})
    
    appKeyMap.bind('alt+e', ()=>{
        if(this.__gridIsBlock() || !this.tripFocus()){return false;}
        if(this.projects[this.projectIndex].carros[this.carIndex].escalas.length > 0){
            this.__modalConfirmationChangeProject(()=>{
                this.projects[this.projectIndex].carros[this.carIndex].escalas = [];
                this.addRecall();
                this.__updateTripDisplay();
            })
        }
        else{this.addRecall();this.__updateTripDisplay();}
        return false;
    }, {group: 'March_stage1', desc: 'Adiciona recolhe na viagem'})
    appKeyMap.bind('ctrl+shift+e', (ev)=>{
        if(!this.tripFocus() || this.__gridIsBlock()){return false}
        for(let i = 0; i < this.projects[this.projectIndex].carros.length; i++){
            let r = this.addRecall(i, this.projects[this.projectIndex].carros[i].viagens.length - 1); // Tenta adicionar recolhe na ultima viagem de cada carro
            if(r){this.projects[this.projectIndex].carros[i].escalas = [];} // Limpa escalas do carro
        }
        return false;
    }, {group: 'March_stage1', desc: 'Recolhe todos os carros'})
    appKeyMap.bind('pagedown', (ev)=>{if(!this.tripFocus() || this.__gridIsBlock()){return} this.nextTrip();return false;}, {group: 'March_stage1', desc: 'Foca próxima viagem no mesmo sentido'})
    appKeyMap.bind('pageup', (ev)=>{if(!this.tripFocus() || this.__gridIsBlock()){return} this.previousTrip();return false;}, {group: 'March_stage1', desc: 'Foca viagem anterior no mesmo sentido'})
    appKeyMap.bind('home', (ev)=>{
        if(!this.tripFocus() || this.__gridIsBlock()){return}
        this.tripIndex = 0;
        this.__cursorMove();
        this.__updateTripDisplay();
        return false;
    }, {group: 'March_stage1', desc: 'Foca primeira viagem do carro'})
    appKeyMap.bind('end', (ev)=>{
        if(!this.tripFocus() || this.__gridIsBlock()){return}
        this.tripIndex = this.projects[this.projectIndex].carros[this.carIndex].viagens.length - 1;
        this.__cursorMove();
        this.__updateTripDisplay();
        return false;
    }, {group: 'March_stage1', desc: 'Foca ultima viagem do carro'})
    appKeyMap.bind('ctrl+home', ()=>{
        if(!this.tripFocus() || this.__gridIsBlock()){return false}
        let resp = this.projects[this.projectIndex].getFirstTrip(this.tripFocus().sentido);
        if(resp){
            this.carLabels[this.carIndex].style.color = 'inherit';
            this.carIndex = resp[1];
            this.tripIndex = resp[2];
            this.carLabels[this.carIndex].style.color = 'var(--bs-link-color)';
            this.__cursorMove();
            this.__updateTripDisplay();
        }
        return false;
    }, {group: 'March_stage1', desc: 'Foca primeira viagem no mesmo sentido'})
    appKeyMap.bind('ctrl+end', ()=>{
        if(!this.tripFocus() || this.__gridIsBlock()){return false}
        let resp = this.projects[this.projectIndex].getLastTrip(this.tripFocus().sentido);
        if(resp){
            this.carLabels[this.carIndex].style.color = 'inherit';
            this.carIndex = resp[1];
            this.tripIndex = resp[2];
            this.carLabels[this.carIndex].style.color = 'var(--bs-link-color)';
            this.__cursorMove();
            this.__updateTripDisplay();
        }
        return false;
    }, {group: 'March_stage1', desc: 'Foca ultima viagem no mesmo sentido'})
    appKeyMap.bind('shift+arrowright', ()=>{this.__addToSelecao();return false;}, {group: 'March_stage1', desc: 'Arrasta seleção para direita'})
    appKeyMap.bind('shift+arrowleft', ()=>{this.__subToSelecao();return false;}, {group: 'March_stage1', desc: 'Diminui da seleção ultima viagem'})
    appKeyMap.bind('alt+l', ()=>{this.__clearSelecao();return false;}, {group: 'March_stage1', desc: 'Limpa a seleção de viagens'})
    appKeyMap.bind('ctrl+v', ()=>{
        if(this.__gridIsBlock() || this.startSelect < 0){return false;}
        if(this.projects[this.projectIndex].carros[this.carSelect].escalas.length > 0 || this.projects[this.projectIndex].carros[this.carIndex].escalas.length > 0){
            this.__modalConfirmationChangeProject(()=>{
                this.projects[this.projectIndex].carros[this.carSelect].escalas = [];
                this.projects[this.projectIndex].carros[this.carIndex].escalas = [];
                this.moveTrips()
            })
        }
        else{this.moveTrips()}
        return false;
    }, {group: 'March_stage1', desc: 'Move viagens selecionadas'})
    appKeyMap.bind('ctrl+x', ()=>{ // Recorta viagens selecionadas para area de transferencia
        if(this.__gridIsBlock() || this.startSelect < 0 || this.projects[this.projectIndex].area_transferencia.length > 0){return false;}
        if(this.projects[this.projectIndex].carros[this.carSelect].escalas.length > 0){
            this.__modalConfirmationChangeProject(()=>{ // Metodo resolve
                this.projects[this.projectIndex].carros[this.carSelect].escalas = [];
                this.addToTransferArea()
            },
            ()=>{this.__clearSelecao()}) // Metodo reject, ao cancelar modal, limpa area de transferencia
        }
        else{this.addToTransferArea()}
        return false;
    }, {group: 'March_stage1', desc: 'Move viagens selecionadas para area de transferência'})
    appKeyMap.bind('ctrl+shift+v', ()=>{
        if(this.projects[this.projectIndex].area_transferencia.length == 0){return false}
        this.pasteTransfer()
        return false;
    }, {group: 'March_stage1', desc: 'Cola todas as viagens da área de transferência'})
    
    appKeyMap.bind('ctrl+ ', ()=>{
        if(this.tripFocus()){
            this.initialView = this.tripFocus().inicio - 60; // Ajusta o view inicial para uma hora antes da viagem em foco
            this.__buildRuler();
            this.canvasFit();
        }
        return false;
    }, {group: 'March_stage1', desc: 'Centraliza grid na viagem em foco'})
    appKeyMap.bind('ctrl+delete', ()=>{
        if(this.__gridIsBlock() || !this.tripFocus()){return false;}
        if(this.projects[this.projectIndex].carros[this.carIndex].escalas.length > 0){
            this.__modalConfirmationChangeProject(()=>{
                this.projects[this.projectIndex].carros[this.carIndex].escalas = [];
                this.removeTrip(false)
            })
        }
        else{this.removeTrip(false)}
        return false;
    }, {group: 'March_stage1', desc: 'Remove viagem'})
    appKeyMap.bind('ctrl+shift+delete', ()=>{
        if(this.__gridIsBlock() || !this.tripFocus()){return false;}
        if(this.tripIndex == 0){this.removeCar()}
        else if(this.projects[this.projectIndex].carros[this.carIndex].escalas.length > 0){
            this.__modalConfirmationChangeProject(()=>{
                this.projects[this.projectIndex].carros[this.carIndex].escalas = [];
                this.removeTrip();
            })
        }
        else{this.removeTrip()}
        return false;
    }, {group: 'March_stage1', role: 'removeCarro', desc: 'Remove viagem e posteriores, se 1a viag apaga carro'})
    
    appKeyMap.bind('alt+t', ()=>{this.__showTripPatterns();return false;}, {group: 'March_stage1', desc: 'Exibe legenda dos tipos de viagens'})
    appKeyMap.bind('f2', (ev)=>{this.__showRouteMetrics();return false;}, {group: 'March_stage1', desc: 'Exibe controles de métricas da linha'})
    appKeyMap.bind('f4', (ev)=>{this.__generate();return false;}, {desc: 'Exibe modal para geração de planejamento'})   
}

function __addStage2Listeners(){ // Cria atalhos de teclado para manipulação do diagrama de marcha
    appKeyMap.bind('arrowright', (ev)=>{
        if(this.__gridIsBlock() || !this.scheduleFocus){return}
        if(this.scheduleGrid[this.scheduleFocus[0]].length - 1 > this.scheduleFocus[1]){
            this.scheduleGrid[this.scheduleFocus[0]][this.scheduleFocus[1]].style.backgroundColor = this.scheduleGrid[this.scheduleFocus[0]][this.scheduleFocus[1]].dataset.type == 'emptySchedule' ? '' : '#1a1d20'; // Altera visual da escala em foco atual
            this.scheduleGrid[this.scheduleFocus[0]][this.scheduleFocus[1] + 1].style.backgroundColor = '#032830'; // Altera visual da proxima escala
            this.scheduleFocus = [this.scheduleFocus[0], this.scheduleFocus[1] + 1, this.scheduleFocus[2]];
        }
        return false;
    }, {group: 'March_stage2', desc: 'Seleciona próxima escala'})
    appKeyMap.bind('arrowleft', (ev)=>{
        if(this.__gridIsBlock() || !this.scheduleFocus){return}
        if(this.scheduleFocus[1] > 0){
            this.scheduleGrid[this.scheduleFocus[0]][this.scheduleFocus[1]].style.backgroundColor = this.scheduleGrid[this.scheduleFocus[0]][this.scheduleFocus[1]].dataset.type == 'emptySchedule' ? '' : '#1a1d20'; // Altera visual da escala em foco atual
            this.scheduleGrid[this.scheduleFocus[0]][this.scheduleFocus[1] - 1].style.backgroundColor = '#032830'; // Altera visual da proxima escala
            this.scheduleFocus = [this.scheduleFocus[0], this.scheduleFocus[1] - 1, this.scheduleFocus[2]];
        }
        return false;
    }, {group: 'March_stage2', desc: 'Seleciona escala anterior'})
    appKeyMap.bind('arrowdown', (ev)=>{
        if(this.__gridIsBlock() || !this.scheduleFocus){return}
        if(this.scheduleGrid[this.scheduleFocus[0] + 1]){
            this.scheduleGrid[this.scheduleFocus[0]][this.scheduleFocus[1]].style.backgroundColor = this.scheduleGrid[this.scheduleFocus[0]][this.scheduleFocus[1]].dataset.type == 'emptySchedule' ? '' : '#1a1d20'; // Altera visual da escala em foco atual
            this.scheduleGrid[this.scheduleFocus[0] + 1][0].style.backgroundColor = '#032830'; // Altera visual da proxima escala
            this.scheduleFocus = [this.scheduleFocus[0] + 1, 0 , 0];
        }
        return false;
    }, {group: 'March_stage2', desc: 'Seleciona escala do próximo carro'})
    appKeyMap.bind('arrowup', (ev)=>{
        if(this.__gridIsBlock() || !this.scheduleFocus){return}
        if(this.scheduleFocus[0] > 0){
            this.scheduleGrid[this.scheduleFocus[0]][this.scheduleFocus[1]].style.backgroundColor = this.scheduleGrid[this.scheduleFocus[0]][this.scheduleFocus[1]].dataset.type == 'emptySchedule' ? '' : '#1a1d20'; // Altera visual da escala em foco atual
            this.scheduleGrid[this.scheduleFocus[0] - 1][0].style.backgroundColor = '#032830'; // Altera visual da proxima escala
            this.scheduleFocus = [this.scheduleFocus[0] - 1, 0 , 0];
        }
        return false;
    }, {group: 'March_stage2', desc: 'Seleciona escala do carro anterior'})
    appKeyMap.bind('ctrl+arrowdown', ()=>{
        if(this.__gridIsBlock()){return false}
        if(this.canvas.offsetTop > (this.maxCarsVisible - this.projects[this.projectIndex].carros.length) * 45){
            this.canvas.style.top = `calc(${this.canvas.style.top} - 45px)`;
        }
        return false;
    }, {group: 'March_stage2', desc: 'Move grid para baixo'})
    appKeyMap.bind('ctrl+arrowup', ()=>{
        if(this.__gridIsBlock()){return false}
        if(this.canvas.offsetTop < 0){
            this.canvas.style.top = `calc(${this.canvas.style.top} + 45px)`;
        }
        return false;
    }, {group: 'March_stage2', desc: 'Move grid para cima'})
    appKeyMap.bind('alt+enter   ', (ev)=>{
        if(this.__gridIsBlock() || !this.scheduleFocus){return false}
        this.scheduleGrid[this.scheduleFocus[0]][this.scheduleFocus[1]].click();
        return false;
    }, {group: 'March_stage2', desc: 'Inicia escala no espaço em foco'})
    appKeyMap.bind('alt+/', ()=>{
        if(this.__gridIsBlock()){return false}
        this.__toggleArrowVisibility();
        return false;
    }, {group: 'March_stage2', desc: 'Exibe ou oculta conexões entre escalas'})
    appKeyMap.bind('f4', (ev)=>{
        if(this.__gridIsBlock() || this.projects[this.projectIndex].carros.length == 0){return false}
        this.projects[this.projectIndex].autoGenerateSchedules();
        this.scheduleFocus = [0, 0, 0]; // Seleciona primeira viagem do primeiro carro
        for(let i = 0; i < this.projects[this.projectIndex].carros.length; i++){
            this.__updateCarSchedules(i, this.projects[this.projectIndex].carros[i].getCarSchedulesBlock(this.projects[this.projectIndex].linha))
        }
        this.__updateScheduleArrows();
        return false;
    }, {group: 'March_stage2', desc: 'Inicia tabela de todos os carros'})
    appKeyMap.bind('f2', (ev)=>{
        if(this.__gridIsBlock() || !this.scheduleFocus || this.scheduleGrid[this.scheduleFocus[0]][this.scheduleFocus[1]].dataset.type == 'emptySchedule'){return false}
        this.gridLocked = true;
        let modal = document.createElement('dialog');modal.innerHTML = '<h6>Renomear Tabela</h6>';modal.style.position = 'relative';
        modal.addEventListener('close', ()=>{modal.remove(); this.gridLocked = false;})
        let nameInput = document.createElement('input');nameInput.type = 'text';nameInput.classList = 'flat-input';nameInput.id = 'March_renameEscalaName';
        nameInput.value = this.projects[this.projectIndex].carros[this.scheduleFocus[0]].escalas[this.scheduleFocus[1]].nome;
        nameInput.onfocus = ()=>{nameInput.select()}
        nameInput.addEventListener('keydown', (ev)=>{if(ev.key == 'Enter'){submit.click()}})
        let submit = document.createElement('button');submit.type = 'button';submit.classList = 'btn btn-sm btn-phanton position-absolute';submit.innerHTML = 'Gravar';submit.style = 'top:56px; right: 10px;'
        submit.onclick = () => {
            if(nameInput.value == '' || nameInput.value.length < 2){nameInput.classList.add('is-invalid'); return false;}
            this.projects[this.projectIndex].carros[this.scheduleFocus[0]].escalas[this.scheduleFocus[1]].nome = nameInput.value;
            this.scheduleGrid[this.scheduleFocus[0]][this.scheduleFocus[1]].querySelector('[data-type=escala-nome]').innerHTML = nameInput.value;
            modal.close();
        }
        modal.appendChild(nameInput)
        modal.appendChild(this.__settingsAddCustomLabel(nameInput, 'Nome Tabela'))
        modal.appendChild(submit);
        document.body.appendChild(modal);
        modal.showModal();
        return false;
    }, {group: 'March_stage2', desc: 'Renomear tabela'})
    appKeyMap.bind('alt+delete', ()=>{
        if(this.__gridIsBlock() || !this.scheduleFocus || this.scheduleGrid[this.scheduleFocus[0]][this.scheduleFocus[1]].dataset.type == 'emptySchedule'){return false}
        let r = this.projects[this.projectIndex].deleteSchedule(this.scheduleFocus[0], this.scheduleFocus[1]);
        if(r){
            let carro_index = this.scheduleFocus[0];
            this.scheduleFocus = null;
            if(this.scheduleGrid[0].length > 0){
                this.scheduleFocus = [0,0,0];
                this.scheduleGrid[0][0].style.backgroundColor = '#032830';
            }
            this.__updateCarSchedules(carro_index, this.projects[this.projectIndex].carros[carro_index].getCarSchedulesBlock(this.projects[this.projectIndex].linha));
            r.forEach(el => {this.__updateCarSchedules(el, this.projects[this.projectIndex].carros[el].getCarSchedulesBlock(this.projects[this.projectIndex].linha))});
            this.__updateScheduleArrows();
        }
        return false;
    }, {group: 'March_stage2', desc: 'Exclui a escala em foco'})
    appKeyMap.bind('ctrl+shift+delete', ()=>{
        if(this.__gridIsBlock()){return false}
        for(let i = 0; i < this.projects[this.projectIndex].carros.length; i++){
            this.projects[this.projectIndex].carros[i].escalas = [];
            this.__updateCarSchedules(i, this.projects[this.projectIndex].carros[i].getCarSchedulesBlock(this.projects[this.projectIndex].linha))
        }
        this.__updateScheduleArrows();
        return false;
    }, {group: 'March_stage2', desc: 'Remove todas as escalas'})
}

export {__addGeneralListeners, __addStage1Listeners, __addStage2Listeners }