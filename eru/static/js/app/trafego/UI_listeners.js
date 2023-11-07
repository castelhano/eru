function __addGeneralListeners(){ // Cria atalhos de teclado gerais do projeto (indiferente do viewStage)
    appKeyMap.unbind('lTFF'); // Remove atalho para dar reload em pagina (se projeto nao salvo iria perder todo progresso)
    appKeyMap.bind({group: 'March_general', key: 'arrowright', ctrl: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Rolar para direita', desc: 'Move grid para direita (02 horas)', run: ()=>{this.canvasMove(120)}})
    appKeyMap.bind({group: 'March_general', key: 'arrowleft', ctrl: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Rolar para esquerda', desc: 'Move grid para esquerda (02 horas)', run: ()=>{this.canvasMove(-120)}})
    appKeyMap.bind({group: 'March_general', key: 'f5', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Desfazer alterações', desc: 'Recarrega ultimo status salvo do projeto', run: (ev)=>{}}) // Apenas entrada para exibicao no keymap
    appKeyMap.bind({group: 'March_general', key: 'f8', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Altera Visualização', desc: 'Exibe modal para alteração da visualização', run: (ev)=>{ev.preventDefault();this.__switchStageModal()}})
    appKeyMap.bind({group: 'March_general', key: '1', alt: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Exibe Grid', desc: 'Altera visualização para o Grid', run: ()=>{this.switchStage(1)}})
    appKeyMap.bind({group: 'March_general', key: '2', alt: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Exibe Escalas', desc: 'Altera visualização para Escalas', run: ()=>{this.switchStage(2)}})
    appKeyMap.bind({group: 'March_general', key: '3', alt: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Exibe Resumo', desc: 'Altera visualização para resumo', run: ()=>{this.switchStage(3)}})
    appKeyMap.bind({group: 'March_general', key: 'g', alt:true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Salva prévia', desc: 'Salva projeto em armazenamento local', run: ()=>{
        appNotify('warning', '<i class="bi bi-check2-square me-2"></i> Em desenvolvimento....')
    }})
    appKeyMap.bind({group: 'March_general', key: 'l', ctrl: true, shift:true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Limpa projeto', desc: 'Limpa projeto atual', run: ()=>{
        this.projects[this.projectIndex].reset();
        this.__loadStage1();
        this.settingsSumIntervGaps.checked = this.projects[this.projectIndex].sumInterGaps;
        appNotify('warning', '<b class="me-1">Info:</b> Projeto reiniciado.');
    }})
}

function __addStage1Listeners(){ // Cria atalhos de teclado para manipulação do diagrama de marcha
    appKeyMap.bind({group: 'March_stage1', key: ';', alt: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Novo carro', desc: 'Insere carro no projeto', run: ()=>{if(this.__gridIsBlock()){return false};this.addCar()}})
    appKeyMap.bind({group: 'March_stage1', key: '.', alt: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Adicionar Trip', desc: 'Insere viagem ao final do carro', run: ()=>{
        if(this.__gridIsBlock() || !this.tripFocus()){return false}
        if(this.projects[this.projectIndex].carros[this.carIndex].escalas.length > 0){
            this.__modalConfirmationChangeProject(()=>{
                this.projects[this.projectIndex].carros[this.carIndex].escalas = [];
                this.addTrip();
            })
        }
        else{this.addTrip();}
    }})
    appKeyMap.bind({group: 'March_stage1', key: '.', alt: true, ctrl: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Adicionar Trip AS', desc: 'Insere viagem para carro informando inicio', run: ()=>{
        if(this.__gridIsBlock() || !this.tripFocus()){return false;}
        if(this.projects[this.projectIndex].carros[this.carIndex].escalas.length > 0){
            this.__modalConfirmationChangeProject(()=>{
                this.projects[this.projectIndex].carros[this.carIndex].escalas = [];
                this.addTripAt()
            })
        }
        else{this.addTripAt();}
    }})
    
    appKeyMap.bind({group: 'March_stage1', key: 'arrowright', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Navegar próxima viagem', desc: 'Move foco para próxima viagem do carro', run: (ev)=>{
        if(!this.tripFocus() || this.__gridIsBlock()){return false}
        ev.preventDefault();
        if(this.projects[this.projectIndex].carros[this.carIndex].viagens.length > this.tripIndex + 1){
            this.tripIndex++;
            this.__cursorMove();
            this.__updateTripDisplay();
            
        }
    }})
    appKeyMap.bind({group: 'March_stage1', key: 'arrowleft', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Navegar viagem anterior', desc: 'Move foco para viagem anterior do carro', run: (ev)=>{
        if(!this.tripFocus() || this.__gridIsBlock()){return false}
        ev.preventDefault();
        if(this.tripIndex > 0){
            this.tripIndex--;
            this.__cursorMove();
            this.__updateTripDisplay();
        }
    }})
    appKeyMap.bind({group: 'March_stage1', key: 'arrowdown', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Navegar próximo carro', desc: 'Move foco para próximo carro', run: (ev)=>{
        if(!this.tripFocus() || this.__gridIsBlock()){return false}
        ev.preventDefault();
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
    }})
    appKeyMap.bind({group: 'March_stage1', key: 'arrowup', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Navegar carro anterior', desc: 'Move foco para carro anterior', run: (ev) => {
        if(!this.tripFocus() || this.__gridIsBlock()){return false}
        ev.preventDefault();
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
        }})
        appKeyMap.bind({group: 'March_stage1', key: '/', alt: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Régua frequência', desc: 'Exibe/oculta régua de frequência', run: ()=>{this.settingsShowFreqRule.click()}})
        appKeyMap.bind({group: 'March_stage1', key: '+', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Trip Plus', desc: 'Aumenta 1 min ao final da viagem e nas posteriores', run: (ev)=>{if(!this.tripFocus() || this.__gridIsBlock()){return false}ev.preventDefault();this.plus();}})
        appKeyMap.bind({group: 'March_stage1', key: '+', shift: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Trip Plus (single)', desc: 'Aumenta 1 minuto na viagem', run: ()=>{if(!this.tripFocus() || this.__gridIsBlock()){return false}this.plus(false)}})
        appKeyMap.bind({group: 'March_stage1', key: '-', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Trip Sub', desc: 'Subtrai 1 min ao final da viagem e nas posteriores', run: (ev)=>{if(!this.tripFocus() || this.__gridIsBlock()){return false}ev.preventDefault();this.sub();}})
        appKeyMap.bind({group: 'March_stage1', key: '-', shift: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Trip Sub (single)', desc: 'Subtrai 1 minuto na viagem', run: ()=>{if(!this.tripFocus() || this.__gridIsBlock()){return false}this.sub(false)}})
        appKeyMap.bind({group: 'March_stage1', key: ' ', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Atrasar', desc: 'Atrasa inicio em 1 minuto, move posteriores', run: (ev)=>{if(!this.tripFocus() || this.__gridIsBlock()){return false}ev.preventDefault();this.advance();}})
        appKeyMap.bind({group: 'March_stage1', key: ' ', shift: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Atrasar (single)', desc: 'Aumenta 1 min no inicio da viagem', run: ()=>{if(!this.tripFocus() || this.__gridIsBlock()){return false}
        this.moveStart();
        this.__cursorMove();
    }})
    appKeyMap.bind({group: 'March_stage1', key: 'backspace', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Adiantar', desc: 'Adianta em 1 min inicio da viagem e nas posteriores', run: (ev)=>{if(!this.tripFocus() || this.__gridIsBlock()){return false}ev.preventDefault();this.back()}})
    appKeyMap.bind({group: 'March_stage1', key: 'backspace', shift: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Adiantar (single)', desc: 'Adianta inicio da viagem em 1 min', run: ()=>{if(!this.tripFocus() || this.__gridIsBlock()){return false}this.backStart()}})
    appKeyMap.bind({group: 'March_stage1', key: 'r', alt: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Adicionar Intervalo', desc: 'Adiciona intervalo ate a próxima viagem', run: ()=>{
        if(this.__gridIsBlock() || !this.tripFocus()){return false;}
        if(this.projects[this.projectIndex].carros[this.carIndex].escalas.length > 0){
            this.__modalConfirmationChangeProject(()=>{
                this.projects[this.projectIndex].carros[this.carIndex].escalas = [];
                this.addInterv();
                this.__updateTripDisplay();
            })
        }
        else{this.addInterv();this.__updateTripDisplay();}
    }})
    appKeyMap.bind({group: 'March_stage1', key: 'a', alt: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Adicionar Acesso', desc: 'Adiciona acesso na viagem', run: ()=>{
        if(!this.tripFocus() || this.__gridIsBlock()){return false}
        if(this.projects[this.projectIndex].carros[this.carIndex].escalas.length > 0){
            this.__modalConfirmationChangeProject(()=>{
                this.projects[this.projectIndex].carros[this.carIndex].escalas = [];
                this.addAccess();
                this.__updateTripDisplay();
            })
        }
        else{this.addAccess();this.__updateTripDisplay();}
    }})
    appKeyMap.bind({group: 'March_stage1', key: 'a', ctrl: true, shift:true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Acesso à todos', desc: 'Adiciona acesso para todos os carros', run: ()=>{
        if(!this.tripFocus() || this.__gridIsBlock()){return false}
        let increment = true; // addAccess por padrao incrementa o this.tripIndex, deve incrementar somente para o carro em foco
        for(let i = 0; i < this.projects[this.projectIndex].carros.length; i++){
            let r = this.addAccess(i, 0, increment); // Tenta adicionar recolhe na ultima viagem de cada carro
            increment = false;
            if(r){this.projects[this.projectIndex].carros[i].escalas = [];} // Limpa escalas do carro
        }
    }})
    appKeyMap.bind({group: 'March_stage1', key: 'p', alt: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Encerrar turno', desc: 'Encerra turno na viagem', run: ()=>{
        if(this.__gridIsBlock() || !this.tripFocus()){return false;}
        if(this.projects[this.projectIndex].carros[this.carIndex].escalas.length > 0){
            this.__modalConfirmationChangeProject(()=>{
                this.projects[this.projectIndex].carros[this.carIndex].escalas = [];
                this.viagemShut();
                this.__updateTripDisplay();
            })
        }
        else{this.viagemShut();this.__updateTripDisplay();}
    }})
    appKeyMap.bind({group: 'March_stage1', key: 'e', alt: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Adicionar Recolhe', desc: 'Adiciona recolhe na viagem', run: ()=>{
        if(this.__gridIsBlock() || !this.tripFocus()){return false;}
        if(this.projects[this.projectIndex].carros[this.carIndex].escalas.length > 0){
            this.__modalConfirmationChangeProject(()=>{
                this.projects[this.projectIndex].carros[this.carIndex].escalas = [];
                this.addRecall();
                this.__updateTripDisplay();
            })
        }
        else{this.addRecall();this.__updateTripDisplay();}
    }})
    appKeyMap.bind({group: 'March_stage1', key: 'e', ctrl: true, shift: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Recolher todos', desc: 'Recolhe todos os carros', run: (ev)=>{
        if(!this.tripFocus() || this.__gridIsBlock()){return false}
        for(let i = 0; i < this.projects[this.projectIndex].carros.length; i++){
            let r = this.addRecall(i, this.projects[this.projectIndex].carros[i].viagens.length - 1); // Tenta adicionar recolhe na ultima viagem de cada carro
            if(r){this.projects[this.projectIndex].carros[i].escalas = [];} // Limpa escalas do carro
        }
    }})
    appKeyMap.bind({group: 'March_stage1', key: 'pagedown', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Próxima viagem sentido', desc: 'Foca próxima viagem no mesmo sentido', run: (ev)=>{if(!this.tripFocus() || this.__gridIsBlock()){return false}ev.preventDefault();this.nextTrip();}})
    appKeyMap.bind({group: 'March_stage1', key: 'pageup', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Trip anterior sentido', desc: 'Foca viagem anterior no mesmo sentido', run: (ev)=>{if(!this.tripFocus() || this.__gridIsBlock()){return false}ev.preventDefault();this.previousTrip();}})
    appKeyMap.bind({group: 'March_stage1', key: 'home', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Primeira viagem carro', desc: 'Foca primeira viagem do carro', run: (ev)=>{
        if(!this.tripFocus() || this.__gridIsBlock()){return false}
        ev.preventDefault();
        this.tripIndex = 0;
        this.__cursorMove();
        this.__updateTripDisplay();
    }})
    appKeyMap.bind({group: 'March_stage1', key: 'end', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Ultima viagem carro', desc: 'Foca ultima viagem do carro', run: (ev)=>{
        if(!this.tripFocus() || this.__gridIsBlock()){return false}
        ev.preventDefault();
        this.tripIndex = this.projects[this.projectIndex].carros[this.carIndex].viagens.length - 1;
        this.__cursorMove();
        this.__updateTripDisplay();
    }})
    appKeyMap.bind({group: 'March_stage1', key: 'home', ctrl: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Primeira viagem sentido', desc: 'Foca primeira viagem no mesmo sentido', run: ()=>{
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
    }})
    appKeyMap.bind({group: 'March_stage1', key: 'end', ctrl: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Ultima viagem sentido', desc: 'Foca ultima viagem no mesmo sentido', run: ()=>{
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
    }})
    appKeyMap.bind({group: 'March_stage1', key: 'arrowright', shift: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Selecionar a direita', desc: 'Arrasta seleção para direita', run: ()=>{this.__addToSelecao();}})
    appKeyMap.bind({group: 'March_stage1', key: 'arrowleft', shift: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Voltar seleção', desc: 'Diminui da seleção ultima viagem', run: ()=>{this.__subToSelecao();}})
    appKeyMap.bind({group: 'March_stage1', key: 'l', alt: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Limpar seleção', desc: 'Limpa a seleção de viagens', run: ()=>{this.__clearSelecao();}})
    appKeyMap.bind({group: 'March_stage1', key: 'v', ctrl: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Mover viagens', desc: 'Move viagens selecionadas', run: ()=>{
        if(this.__gridIsBlock() || this.startSelect < 0){return false;}
        if(this.projects[this.projectIndex].carros[this.carSelect].escalas.length > 0 || this.projects[this.projectIndex].carros[this.carIndex].escalas.length > 0){
            this.__modalConfirmationChangeProject(()=>{
                this.projects[this.projectIndex].carros[this.carSelect].escalas = [];
                this.projects[this.projectIndex].carros[this.carIndex].escalas = [];
                this.moveTrips()
            })
        }
        else{this.moveTrips()}
    }})
    appKeyMap.bind({group: 'March_stage1', key: 'x', ctrl: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Recortar viagens', desc: 'Move viagens selecionadas para area de transferência', run: ()=>{
        if(this.__gridIsBlock() || this.startSelect < 0 || this.projects[this.projectIndex].area_transferencia.length > 0){return false;}
        if(this.projects[this.projectIndex].carros[this.carSelect].escalas.length > 0){
            this.__modalConfirmationChangeProject(()=>{
                this.projects[this.projectIndex].carros[this.carSelect].escalas = [];
                this.addToTransferArea()
            })
        }
        else{this.addToTransferArea()}
    }})
    appKeyMap.bind({group: 'March_stage1', key: 'v', ctrl: true, shift: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Cola área de transf ', desc: 'Cola todas as viagens da área de transferência', run: ()=>{
        if(this.projects[this.projectIndex].area_transferencia.length == 0){return false}
        this.pasteTransfer()
    }})
    appKeyMap.bind({group: 'March_stage1', key: ' ', ctrl: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Centralizar', desc: 'Centraliza grid na viagem em foco', run: ()=>{
        if(this.tripFocus()){
            this.initialView = this.tripFocus().inicio - 60; // Ajusta o view inicial para uma hora antes da viagem em foco
            this.__buildRuler();
            this.canvasFit();
        }
    }})
    appKeyMap.bind({group: 'March_stage1', key: 'delete', ctrl:true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Remover viagem', desc: 'Remove viagem', run: ()=>{
        if(this.__gridIsBlock() || !this.tripFocus()){return false;}
        if(this.projects[this.projectIndex].carros[this.carIndex].escalas.length > 0){
            this.__modalConfirmationChangeProject(()=>{
                this.projects[this.projectIndex].carros[this.carIndex].escalas = [];
                this.removeTrip(false)
            })
        }
        else{this.removeTrip(false)}
    }})
    appKeyMap.bind({group: 'March_stage1', role: 'removeCar', key: 'delete', ctrl:true, shift: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Remove viagens/carro', desc: 'Remove viagem e posteriores, se 1a viag apaga carro', run: ()=>{
        if(this.__gridIsBlock() || !this.tripFocus()){return false;}
        if(this.tripIndex == 0){this.removeCar()}
        else if(this.projects[this.projectIndex].carros[this.carIndex].escalas.length > 0){
            this.__modalConfirmationChangeProject(()=>{
                this.projects[this.projectIndex].carros[this.carIndex].escalas = [];
                this.removeTrip();
            })
        }
        else{this.removeTrip()} 
    }})
    appKeyMap.bind({group: 'March_stage1', key: 't', alt:true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Legfima viagens', desc: 'Exibe legfima dos tipos de viagens', run: ()=>{this.__showTripPatterns()}})
    appKeyMap.bind({group: 'March_stage1', key: 'f2', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Métricas da linha', desc: 'Exibe controles de métricas da linha', run: (ev)=>{ev.preventDefault();this.__showRouteMetrics()}})
    appKeyMap.bind({group: 'March_stage1', key: 'f4', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Gerador', desc: 'Exibe modal para geração de planejamento', run: (ev)=>{ev.preventDefault();this.__generate()}})
    appKeyMap.bind({group: 'March_stage1', key: 'backspace', ctrl: true, shift:true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Restaurar Configurações', desc: 'Restaura configurações padrão de interface', run: ()=>{
        for(let key in this.defaultSettings){
            this[key] = this.defaultSettings[key]; // Retorna valor padrao a variavel de ambiente
            this[`settings${key}`].value = this.defaultSettings[key]; // Retorna valor padrao ao controle no painel de configuracoes
        }
        this.__buildRuler(); // Refaz Regua
        this.__loadStage1(false); // Ajusta viagens
        this.canvasFit(); // Centraliza canvas na viagem em foco
    }})
}

function __addStage2Listeners(){ // Cria atalhos de teclado para manipulação do diagrama de marcha
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
        if(this.canvas.offsetTop > (this.maxCarsVisible - this.projects[this.projectIndex].carros.length) * 45){
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
        if(this.__gridIsBlock() || this.projects[this.projectIndex].carros.length == 0){return false}
        this.projects[this.projectIndex].autoGenerateSchedules();
        this.scheduleFocus = [0, 0, 0]; // Seleciona primeira viagem do primeiro carro
        for(let i = 0; i < this.projects[this.projectIndex].carros.length; i++){
            this.__updateCarSchedules(i, this.projects[this.projectIndex].carros[i].getCarSchedulesBlock(this.projects[this.projectIndex].linha))
        }
        this.__updateScheduleArrows();
    }})
    appKeyMap.bind({group: 'March_stage2', key: 'f2', name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Renomear tabela', desc: 'Renomear tabela', run: (ev)=>{
        ev.preventDefault();
        if(this.__gridIsBlock() || !this.scheduleFocus || this.scheduleGrid[this.scheduleFocus[0]][this.scheduleFocus[1]].dataset.type == 'emptySchedule'){return false}
        this.gridLocked = true;
        let modal = document.createElement('dialog');modal.innerHTML = '<h6>Renomear Tabela</h6>';modal.style.position = 'relative';
        modal.addEventListener('close', ()=>{modal.remove(); this.gridLocked = false;})
        let nameInput = document.createElement('input');nameInput.type = 'text';nameInput.classList = 'flat-input';nameInput.id = 'March_renameEscalaName';
        nameInput.value = this.projects[this.projectIndex].carros[this.scheduleFocus[0]].escalas[this.scheduleFocus[1]].name;
        nameInput.onfocus = ()=>{nameInput.select()}
        nameInput.addEventListener('keydown', (ev)=>{if(ev.key == 'Enter'){submit.click()}})
        let submit = document.createElement('button');submit.type = 'button';submit.classList = 'btn btn-sm btn-phanton position-absolute';submit.innerHTML = 'Gravar';submit.style = 'top:56px; right: 10px;'
        submit.onclick = () => {
            if(nameInput.value == '' || nameInput.value.length < 2){nameInput.classList.add('is-invalid'); return false;}
            this.projects[this.projectIndex].carros[this.scheduleFocus[0]].escalas[this.scheduleFocus[1]].name = nameInput.value;
            this.scheduleGrid[this.scheduleFocus[0]][this.scheduleFocus[1]].querySelector('[data-type=escala-name]').innerHTML = nameInput.value;
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
    }})
    appKeyMap.bind({group: 'March_stage2', key: 'delete', ctrl: true, shift: true, name: '<b class="text-orange">GRID:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Limpar escalas', desc: 'Remove todas as escalas', run: ()=>{
        if(this.__gridIsBlock()){return false}
        for(let i = 0; i < this.projects[this.projectIndex].carros.length; i++){
            this.projects[this.projectIndex].carros[i].escalas = [];
            this.__updateCarSchedules(i, this.projects[this.projectIndex].carros[i].getCarSchedulesBlock(this.projects[this.projectIndex].linha))
        }
        this.__updateScheduleArrows();
    }})
}

export {__addGeneralListeners, __addStage1Listeners, __addStage2Listeners }