function __addGeneralListeners(){ // Cria atalhos de teclado gerais do projeto (indiferente do viewStage)
    appKeyMap.unbind('alt+l'); // Remove atalho para dar reload em pagina (se projeto nao salvo iria perder todo progresso)
    appKeyMap.bind('ctrl+arrowright', ()=>{this.canvasMove(120); return false;}, {group: 'March_general', desc: 'Move grid para direita (02 horas)'})
    appKeyMap.bind('ctrl+arrowleft', ()=>{this.canvasMove(-120);return false;}, {group: 'March_general', desc: 'Move grid para esquerda (02 horas)'})
    appKeyMap.bind('f5', (ev)=>{}, {group: 'March_general', desc: 'Recarrega ultimo status salvo do projeto'}) // Apenas entrada para exibicao no keymap
    appKeyMap.bind('f8', (ev)=>{this.__switchStageModal(); return false;}, {group: 'March_general', desc: 'Exibe modal para alteração da visualização'})
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
        if(!this.tripFocus() || this.__gridIsBlock()){return false}
        if(this.projects[this.projectIndex].carros[this.carIndex].viagens.length > this.tripIndex + 1){
            this.tripIndex++;
            this.__cursorMove();
            this.__updateTripDisplay();
        }
        return false;
    }, {group: 'March_stage1', desc: 'Move foco para próxima viagem do carro'})
    appKeyMap.bind('arrowleft', (ev)=>{
        if(!this.tripFocus() || this.__gridIsBlock()){return false}
        if(this.viagemIndice > 0){
            this.viagemIndice--;
            this.tripFocus() = this.project.carros[this.carroIndice].viagens[this.viagemIndice];
            this.__cursorMove();
            this.__updateViagemDisplay();
        }
    }, {group: 'March_stage1', desc: 'Move foco para viagem anterior do carro'})
    appKeyMap.bind('arrowdown', (ev)=>{
        if(!this.tripFocus() || this.__gridIsBlock()){return false}
        this.__clearCarroDisplay(); // Ao alterar de carro, limpa o resumo (caso exibido)
        if(this.project.carros.length > this.carroIndice + 1){
            this.carroLabels[this.carroIndice].style.color = 'inherit';
            this.carroIndice++;
            this.carroLabels[this.carroIndice].style.color = 'var(--bs-link-color)';
            this.carroFocus = this.project.carros[this.carroIndice];
            // Identifica viagem mais proxima do proximo carro para mover cursor
            let bestMatch = this.project.carros[this.carroIndice].viagens[0];
            let inicio = this.tripFocus().inicio;
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
            this.tripFocus() = bestMatch;
            this.__cursorMove();
            this.__updateViagemDisplay();
        }
        return false;
    }, {group: 'March_stage1', desc: 'Move foco para próximo carro'})
    appKeyMap.bind('arrowup', (ev) => {
        if(!this.tripFocus() || this.__gridIsBlock()){return false}
        this.__clearCarroDisplay(); // Ao alterar de carro, limpa o resumo (caso exibido)
        if(this.carroIndice > 0){
            this.carroLabels[this.carroIndice].style.color = 'inherit';
            this.carroIndice--;
            this.carroLabels[this.carroIndice].style.color = 'var(--bs-link-color)';
            this.carroFocus = this.project.carros[this.carroIndice];
            // Identifica viagem mais proxima do proximo carro para mover cursor
            let bestMatch = this.project.carros[this.carroIndice].viagens[0];
            let inicio = this.tripFocus().inicio;
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
            this.tripFocus() = bestMatch;
            this.__cursorMove();
            this.__
            updateViagemDisplay();
        }
        return false;
    }, {group: 'March_stage1', desc: 'Move foco para carro anterior'})
    appKeyMap.bind('alt+/', ()=>{this.settingsShowFreqRule.click();return false;}, {group: 'March_stage1', desc: 'Exibe/oculta régua de frequência'})
    appKeyMap.bind('+', (ev)=>{if(!this.tripFocus() || this.__gridIsBlock()){return false} this.plus();return false;}, {group: 'March_stage1', desc: 'Aumenta 1 min ao final da viagem e nas posteriores'})
    appKeyMap.bind('shift++', ()=>{if(!this.tripFocus() || this.__gridIsBlock()){return false}this.plus(false);return false;}, {group: 'March_stage1', desc: 'Aumenta 1 minuto na viagem'})
    appKeyMap.bind('-', (ev)=>{if(!this.tripFocus() || this.__gridIsBlock()){return false} this.sub();return false;}, {group: 'March_stage1', desc: 'Subtrai 1 min ao final da viagem e nas posteriores'})
    appKeyMap.bind('shift+-', ()=>{if(!this.tripFocus() || this.__gridIsBlock()){return false}this.sub(false);return false;}, {group: 'March_stage1', desc: 'Subtrai 1 minuto na viagem'})
    appKeyMap.bind(' ', (ev)=>{if(!this.tripFocus() || this.__gridIsBlock()){return false} this.advance();return false;}, {group: 'March_stage1', desc: 'Atrasa inicio em 1 minuto, move posteriores'})
    appKeyMap.bind('shift+ ', ()=>{if(!this.tripFocus() || this.__gridIsBlock()){return false}
        this.moveStart();
        this.__cursorMove();
        return false;
    }, {group: 'March_stage1', desc: 'Aumenta 1 min no inicio da viagem'})
    appKeyMap.bind('backspace', (ev)=>{if(!this.tripFocus() || this.__gridIsBlock()){return false} this.back();}, {group: 'March_stage1', desc: 'Adianta em 1 min inicio da viagem e nas posteriores'})
    appKeyMap.bind('shift+backspace', ()=>{if(!this.tripFocus() || this.__gridIsBlock()){return false}this.backStart();return false;}, {group: 'March_stage1', desc: 'Adianta inicio da viagem em 1 min'})
    appKeyMap.bind('alt+r', ()=>{
        if(this.__gridIsBlock() || !this.tripFocus()){return false;}
        if(this.project.carros[this.carroIndice].escalas.length > 0){
            this.__modalConfirmationChangeProject(()=>{
                this.project.carros[this.carroIndice].escalas = [];
                this.addInterv();
                this.__updateViagemDisplay();
            })
        }
        else{this.addInterv();this.__updateViagemDisplay();}
        return false;
    }, {group: 'March_stage1', desc: 'Adiciona intervalo ate a próxima viagem'})
    appKeyMap.bind('alt+a', ()=>{
        if(!this.tripFocus() || this.__gridIsBlock()){return false}
        if(this.project.carros[this.carroIndice].escalas.length > 0){
            this.__modalConfirmationChangeProject(()=>{
                this.project.carros[this.carroIndice].escalas = [];
                this.addAccess();
                this.__updateViagemDisplay();
            })
        }
        else{this.addAccess();this.__updateViagemDisplay();}
        return false;
    }, {group: 'March_stage1', desc: 'Adiciona acesso na viagem'})
    appKeyMap.bind('ctrl+shift+a', ()=>{
        if(!this.tripFocus() || this.__gridIsBlock()){return false}
        let increment = true; // addAccess por padrao incrementa o this.viagemIndice, deve incrementar somente para o carro em foco
        for(let i = 0; i < this.project.carros.length; i++){
            let r = this.addAccess(i, 0, increment); // Tenta adicionar recolhe na ultima viagem de cada carro
            increment = false;
            if(r){this.project.carros[i].escalas = [];} // Limpa escalas do carro
        }
        return false;
    }, {group: 'March_stage1', desc: 'Adiciona acesso para todos os carros'})
    appKeyMap.bind('alt+p', ()=>{
        if(this.__gridIsBlock() || !this.tripFocus()){return false;}
        if(this.project.carros[this.carroIndice].escalas.length > 0){
            this.__modalConfirmationChangeProject(()=>{
                this.project.carros[this.carroIndice].escalas = [];
                this.viagemShut();
                this.__updateViagemDisplay();
            })
        }
        else{this.viagemShut();this.__updateViagemDisplay();}
        return false;
    }, {group: 'March_stage1', desc: 'Encerra turno na viagem'})
    appKeyMap.bind('alt+e', ()=>{
        if(this.__gridIsBlock() || !this.tripFocus()){return false;}
        if(this.project.carros[this.carroIndice].escalas.length > 0){
            this.__modalConfirmationChangeProject(()=>{
                this.project.carros[this.carroIndice].escalas = [];
                this.addRecall();
                this.__updateViagemDisplay();
            })
        }
        else{this.addRecall();this.__updateViagemDisplay();}
        return false;
    }, {group: 'March_stage1', desc: 'Adiciona recolhe na viagem'})
    appKeyMap.bind('ctrl+shift+e', (ev)=>{
        if(!this.tripFocus() || this.__gridIsBlock()){return false}
        for(let i = 0; i < this.project.carros.length; i++){
            let r = this.addRecall(i, this.project.carros[i].viagens.length - 1); // Tenta adicionar recolhe na ultima viagem de cada carro
            if(r){this.project.carros[i].escalas = [];} // Limpa escalas do carro
        }
        return false;
    }, {group: 'March_stage1', desc: 'Recolhe todos os carros'})
    appKeyMap.bind('pagedown', (ev)=>{if(!this.tripFocus() || this.__gridIsBlock()){return false} this.nextViagem();return false;}, {group: 'March_stage1', desc: 'Foca próxima viagem no mesmo sentido'})
    appKeyMap.bind('pageup', (ev)=>{if(!this.tripFocus() || this.__gridIsBlock()){return false} this.previousViagem();return false;}, {group: 'March_stage1', desc: 'Foca viagem anterior no mesmo sentido'})
    appKeyMap.bind('home', (ev)=>{
        if(!this.tripFocus() || this.__gridIsBlock()){return false}
        this.viagemIndice = 0;
        this.tripFocus() = this.project.carros[this.carroIndice].viagens[this.viagemIndice];
        this.__cursorMove();
        this.__updateViagemDisplay();
        return false;
    }, {group: 'March_stage1', desc: 'Foca primeira viagem do carro'})
    appKeyMap.bind('end', (ev)=>{
        if(!this.tripFocus() || this.__gridIsBlock()){return false}
        this.viagemIndice = this.project.carros[this.carroIndice].viagens.length - 1;
        this.tripFocus() = this.project.carros[this.carroIndice].viagens[this.viagemIndice];
        this.__cursorMove();
        this.__updateViagemDisplay();
        return false;
    }, {group: 'March_stage1', desc: 'Foca ultima viagem do carro'})
    appKeyMap.bind('ctrl+home', ()=>{
        if(!this.tripFocus() || this.__gridIsBlock()){return false}
        let resp = this.project.getFirstViagem(this.tripFocus().sentido);
        if(resp){
            this.carroLabels[this.carroIndice].style.color = 'inherit';
            this.tripFocus() = resp[0];
            this.carroIndice = resp[1];
            this.viagemIndice = resp[2];
            this.carroLabels[this.carroIndice].style.color = 'var(--bs-link-color)';
            this.__cursorMove();
            this.__updateViagemDisplay();
        }
        return false;
    }, {group: 'March_stage1', desc: 'Foca primeira viagem no mesmo sentido'})
    appKeyMap.bind('end', ()=>{
        if(!this.tripFocus() || this.__gridIsBlock()){return false}
        let resp = this.project.getLastViagem(this.tripFocus().sentido);
        if(resp){
            this.carroLabels[this.carroIndice].style.color = 'inherit';
            this.tripFocus() = resp[0];
            this.carroIndice = resp[1];
            this.viagemIndice = resp[2];
            this.carroLabels[this.carroIndice].style.color = 'var(--bs-link-color)';
            this.__cursorMove();
            this.__updateViagemDisplay();
        }
        return false;
    }, {group: 'March_stage1', desc: 'Foca ultima viagem no mesmo sentido'})
    appKeyMap.bind('shift+arrowright', ()=>{this.__addToSelecao();return false;}, {group: 'March_stage1', desc: 'Arrasta seleção para direita'})
    appKeyMap.bind('shift+arrowleft', ()=>{this.__subToSelecao();return false;}, {group: 'March_stage1', desc: 'Diminui da seleção ultima viagem'})
    appKeyMap.bind('alt+l', ()=>{this.__clearSelecao();return false;}, {group: 'March_stage1', desc: 'Limpa a seleção de viagens'})
    appKeyMap.bind('ctrl+v', ()=>{
        if(this.__gridIsBlock() || this.inicioSelecao < 0){return false;}
        if(this.project.carros[this.carroSelecao].escalas.length > 0 || this.project.carros[this.carroIndice].escalas.length > 0){
            this.__modalConfirmationChangeProject(()=>{
                this.project.carros[this.carroSelecao].escalas = [];
                this.project.carros[this.carroIndice].escalas = [];
                this.moveViagems()
            })
        }
        else{this.moveViagems()}
        return false;
    }, {group: 'March_stage1', desc: 'Move viagens selecionadas'})
    appKeyMap.bind('ctrl+x', ()=>{
        if(this.__gridIsBlock() || this.inicioSelecao < 0 || this.project.area_transferencia.length > 0){return false;}
        if(this.project.carros[this.carroSelecao].escalas.length > 0){
            this.__modalConfirmationChangeProject(()=>{
                this.project.carros[this.carroSelecao].escalas = [];
                this.addToTransferArea()
            })
        }
        else{this.addToTransferArea()}
        return false;
    }, {group: 'March_stage1', desc: 'Move viagens selecionadas para area de transferência'})
    appKeyMap.bind('ctrl+shift+v', ()=>{
        if(this.project.area_transferencia.length == 0){return false}
        this.pasteTransfer();
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
        if(this.project.carros[this.carroIndice].escalas.length > 0){
            this.__modalConfirmationChangeProject(()=>{
                this.project.carros[this.carroIndice].escalas = [];
                this.removeViagem(false)
            })
        }
        else{this.removeViagem(false)}
        return false;
    }, {group: 'March_stage1', desc: 'Remove viagem'})
    appKeyMap.bind('ctrl+shift+delete', ()=>{
        if(this.__gridIsBlock() || !this.tripFocus()){return false;}
        if(this.viagemIndice == 0){this.removeCarro()}
        else if(this.project.carros[this.carroIndice].escalas.length > 0){
            this.__modalConfirmationChangeProject(()=>{
                this.project.carros[this.carroIndice].escalas = [];
                this.removeViagem();
            })
        }
        else{this.removeViagem()}
        return false;
    }, {group: 'March_stage1', role: 'removeCarro', desc: 'Remove viagem e posteriores, se 1a viag apaga carro'})
    
    appKeyMap.bind('alt+t', ()=>{this.__showViagemPatterns();return false;}, {group: 'March_stage1', desc: 'Exibe legfima dos tipos de viagens'})
    appKeyMap.bind('alt+enter', ()=>{this.__updateCarroDisplay();return false;}, {group: 'March_stage1', desc: 'Exibe resumo do carro em foco'})
    appKeyMap.bind('f2', (ev)=>{this.__showRouteMetrics();return false;}, {group: 'March_stage1', desc: 'Exibe controles de métricas da linha'})
    appKeyMap.bind('f4', (ev)=>{this.__generate();return false;}, {desc: 'Exibe modal para geração de planejamento'})
    appKeyMap.bind('ctrl+shift+backspace', ()=>{
        localStorage.removeItem('marchUiSettings');
        for(let key in this.defaultSettings){
            this[key] = this.defaultSettings[key]; // Retorna valor padrao a variavel de ambiente
            this[`settings${key}`].value = this.defaultSettings[key]; // Retorna valor padrao ao controle no painel de configuracoes
        }
        this.__buildRuler(); // Refaz Regua
        this.__loadStage1(false); // Ajusta viagens
        this.canvasFit(); // Centraliza canvas na viagem em foco
        return false;
    }, {group: 'March_stage1', desc: 'Restaura configurações padrão de interface'})
    
}

function __addStage2Listeners(){ // Cria atalhos de teclado para manipulação do diagrama de marcha
    appKeyMap.bind('arrowright', (ev)=>{
        if(this.__gridIsBlock() || !this.escalaFocus){return false}
        if(this.escalaGrid[this.escalaFocus[0]].length - 1 > this.escalaFocus[1]){
            this.escalaGrid[this.escalaFocus[0]][this.escalaFocus[1]].style.backgroundColor = this.escalaGrid[this.escalaFocus[0]][this.escalaFocus[1]].dataset.type == 'emptyEscala' ? '' : '#1a1d20'; // Altera visual da escala em foco atual
            this.escalaGrid[this.escalaFocus[0]][this.escalaFocus[1] + 1].style.backgroundColor = '#032830'; // Altera visual da proxima escala
            this.escalaFocus = [this.escalaFocus[0], this.escalaFocus[1] + 1, this.escalaFocus[2]];
        }
    }, {group: 'March_stage2', desc: 'Seleciona próxima escala'})
    appKeyMap.bind('arrowleft', (ev)=>{
        if(this.__gridIsBlock() || !this.escalaFocus){return false}
        if(this.escalaFocus[1] > 0){
            this.escalaGrid[this.escalaFocus[0]][this.escalaFocus[1]].style.backgroundColor = this.escalaGrid[this.escalaFocus[0]][this.escalaFocus[1]].dataset.type == 'emptyEscala' ? '' : '#1a1d20'; // Altera visual da escala em foco atual
            this.escalaGrid[this.escalaFocus[0]][this.escalaFocus[1] - 1].style.backgroundColor = '#032830'; // Altera visual da proxima escala
            this.escalaFocus = [this.escalaFocus[0], this.escalaFocus[1] - 1, this.escalaFocus[2]];
        }
    }, {group: 'March_stage2', desc: 'Seleciona escala anterior'})
    appKeyMap.bind('arrowdown', (ev)=>{
        if(this.__gridIsBlock() || !this.escalaFocus){return false}
        if(this.escalaGrid[this.escalaFocus[0] + 1]){
            this.escalaGrid[this.escalaFocus[0]][this.escalaFocus[1]].style.backgroundColor = this.escalaGrid[this.escalaFocus[0]][this.escalaFocus[1]].dataset.type == 'emptyEscala' ? '' : '#1a1d20'; // Altera visual da escala em foco atual
            this.escalaGrid[this.escalaFocus[0] + 1][0].style.backgroundColor = '#032830'; // Altera visual da proxima escala
            this.escalaFocus = [this.escalaFocus[0] + 1, 0 , 0];
        }
        return false;
    }, {group: 'March_stage2', desc: 'Seleciona escala do próximo carro'})
    appKeyMap.bind('arrowup', (ev)=>{
        if(this.__gridIsBlock() || !this.escalaFocus){return false}
        if(this.escalaFocus[0] > 0){
            this.escalaGrid[this.escalaFocus[0]][this.escalaFocus[1]].style.backgroundColor = this.escalaGrid[this.escalaFocus[0]][this.escalaFocus[1]].dataset.type == 'emptyEscala' ? '' : '#1a1d20'; // Altera visual da escala em foco atual
            this.escalaGrid[this.escalaFocus[0] - 1][0].style.backgroundColor = '#032830'; // Altera visual da proxima escala
            this.escalaFocus = [this.escalaFocus[0] - 1, 0 , 0];
        }
        return false;
    }, {group: 'March_stage2', desc: 'Seleciona escala do carro anterior'})
    appKeyMap.bind('ctrl+arrowdown', ()=>{
        if(this.__gridIsBlock()){return false}
        if(this.canvas.offsetTop > (this.maxCarsVisible - this.project.carros.length) * 45){
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
    appKeyMap.bind('alt+enter', (ev)=>{
        if(this.__gridIsBlock() || !this.escalaFocus){return false}
        this.escalaGrid[this.escalaFocus[0]][this.escalaFocus[1]].click();
        return false;
    }, {group: 'March_stage2', desc: 'Inicia escala no espaço em foco'})
    appKeyMap.bind('alt+/', ()=>{
        if(this.__gridIsBlock()){return false}
        this.__toggleArrowVisibility();
        return false;
    }, {group: 'March_stage2', desc: 'Exibe ou oculta conexões entre escalas'})
    appKeyMap.bind('f4', (ev)=>{
        if(this.__gridIsBlock() || this.project.carros.length == 0){return false}
        this.project.autoGenerateEscalas();
        this.escalaFocus = [0, 0, 0]; // Seleciona primeira viagem do primeiro carro
        for(let i = 0; i < this.project.carros.length; i++){
            this.__updateCarroEscalas(i, this.project.carros[i].getCarroEscalasBlock(this.project.linha))
        }
        this.__updateEscalaArrows();
        return false;
    }, {group: 'March_stage2', desc: 'Inicia tabela de todos os carros'})
    appKeyMap.bind('f2', (ev)=>{
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
        return false;
    }, {group: 'March_stage2', desc: 'Renomear tabela'})
    appKeyMap.bind('alt+delete', ()=>{
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
        return false;
    }, {group: 'March_stage2', desc: 'Exclui a escala em foco'})
    appKeyMap.bind('ctrl+shift+delete', ()=>{
        if(this.__gridIsBlock()){return false}
        for(let i = 0; i < this.project.carros.length; i++){
            this.project.carros[i].escalas = [];
            this.__updateCarroEscalas(i, this.project.carros[i].getCarroEscalasBlock(this.project.linha))
        }
        this.__updateEscalaArrows();
        return false;
    }, {group: 'March_stage2', desc: 'Remove todas as escalas'})
}

export {__addGeneralListeners, __addStage1Listeners, __addStage2Listeners }