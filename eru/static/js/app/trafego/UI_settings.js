function __builSettingsUI(){
    this.settingsContainer.innerHTML = `<small class="text-secondary">Version: <b>${this.projects[this.projectIndex].version}</b></small>`;
    this.settingsShowFreqRule = document.createElement('input');this.settingsShowFreqRule.id = `March_settingsShowFreqRule`;this.settingsShowFreqRule.checked = true;
    this.settingsShowFreqRule.onclick = () => {
        if(this.settingsShowFreqRule.checked){this.rulerFreqDialog.show()}
        else{this.rulerFreqDialog.close()}
    }
    this.settingsContainer.appendChild(this.__settingsContainerSwitch(this.settingsShowFreqRule, 'Exibir régua de frequência'));
    
    this.settingsSumIntervGaps = document.createElement('input');this.settingsSumIntervGaps.id = `March_settingsSumIntervGaps`;this.settingsSumIntervGaps.checked = this.projects[this.projectIndex].somar_intervalo_entre_viagens;
    this.settingsSumIntervGaps.onclick = () => {
        if(this.settingsSumIntervGaps.checked){this.projects[this.projectIndex].somar_intervalo_entre_viagens = true;}
        else{this.projects[this.projectIndex].somar_intervalo_entre_viagens = false;}
    }
    this.settingsContainer.appendChild(this.__settingsContainerSwitch(this.settingsSumIntervGaps, 'Somar tempo parado aos intervalos'));
    
    this.settingsContainer.appendChild(__settingsAddDivisor());
    
    this.settingstripOrigemColor = document.createElement('input');this.settingstripOrigemColor.type = `color`;this.settingstripOrigemColor.value = this.tripOrigemColor;
    this.settingstripOrigemColor.onchange = () => {
        this.tripOrigemColor = this.settingstripOrigemColor.value;
        for(let i = 0; i < this.projects[this.projectIndex].carros.length; i++){
            for(let j = 0; j < this.projects[this.projectIndex].carros[i].viagens.length;j++){
                if(this.projects[this.projectIndex].carros[i].viagens[j].sentido == $.IDA){this.__updateTripStyle(this.projects[this.projectIndex].carros[i].viagens[j], this.carGrid[i][j])}
            }
        }
    }
    this.settingsContainer.appendChild(this.settingstripOrigemColor);
    let origemColorLabel = document.createElement('small');origemColorLabel.innerHTML = `IDA`;origemColorLabel.style.position = 'relative';origemColorLabel.style.top = '-7px';origemColorLabel.style.left = '5px';
    this.settingsContainer.appendChild(origemColorLabel);
    
    this.settingstripDestinoColor = document.createElement('input');this.settingstripDestinoColor.type = `color`;this.settingstripDestinoColor.style.marginLeft = `25px`;this.settingstripDestinoColor.value = this.tripDestinoColor;
    this.settingstripDestinoColor.onchange = () => {
        this.tripDestinoColor = this.settingstripDestinoColor.value;
        for(let i = 0; i < this.projects[this.projectIndex].carros.length; i++){
            for(let j = 0; j < this.projects[this.projectIndex].carros[i].viagens.length;j++){
                if(this.projects[this.projectIndex].carros[i].viagens[j].sentido == $.VOLTA){this.__updateTripStyle(this.projects[this.projectIndex].carros[i].viagens[j], this.carGrid[i][j])}
            }
        }
    }
    this.settingsContainer.appendChild(this.settingstripDestinoColor);
    let toColorLabel = document.createElement('small');toColorLabel.innerHTML = `VOLTA`;toColorLabel.style.position = 'relative';toColorLabel.style.top = '-7px';toColorLabel.style.left = '5px';
    this.settingsContainer.appendChild(toColorLabel);
    
    this.settingsContainer.appendChild(__settingsAddDivisor());
    
    this.settingsrulerUnit = document.createElement('input');this.settingsrulerUnit.type = 'number';this.settingsrulerUnit.min = 2;this.settingsrulerUnit.max = 6;this.settingsrulerUnit.placeholder = ' ';this.settingsrulerUnit.classList = 'flat-input';this.settingsrulerUnit.id = 'March_settingsrulerUnit';this.settingsrulerUnit.value = parseFloat(this.rulerUnit);
    this.settingsrulerUnit.onchange = () => {
        if(this.settingsrulerUnit.value == '' || parseInt(this.settingsrulerUnit.value) < this.settingsrulerUnit.min || parseInt(this.settingsrulerUnit.value) > this.settingsrulerUnit.max){
            this.settingsrulerUnit.classList.add('is-invalid');
            return false;
        }
        this.settingsrulerUnit.classList.remove('is-invalid');
        this.rulerUnit = `${this.settingsrulerUnit.value}px`;
        this.__buildRuler(); // Refaz a regua com novos valores
        if(this.tripIndex >= 0){ // Se tiver viagem inserida ajusta posicionamento do canvas
            this.__canvasRebuild(); // Limpa p canvas e refazer todas as viagens com novos parametros
        }
        this.__cursorMove(); // Move o cursor para ajustar view
        this.canvasFit(); // Ajusta posicao do canvas com novas definicoes
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
    }
    this.settingsContainer.appendChild(this.settingsrulerMediumUnit);
    this.settingsContainer.appendChild(this.__settingsAddCustomLabel(this.settingsrulerMediumUnit, 'Display de minutos [ 10 a 180 ]'));
    
    this.settingsUploadProjectControl = document.createElement('button');this.settingsUploadProjectControl.type = 'button';this.settingsUploadProjectControl.classList = 'btn btn-sm btn-dark';this.settingsUploadProjectControl.innerHTML = 'Carregar Arquivo';
    this.settingsUploadProjectControl.onclick = ()=>{this.uploadProject();}
    this.settingsContainer.appendChild(this.settingsUploadProjectControl);
}

function __settingsAddCustomLabel(input, text){
    let l = document.createElement('label');
    l.setAttribute('for', input.id);
    l.classList = 'flat-label';
    l.innerHTML = text;
    return l;
}
function __settingsContainerSwitch(el, label_text, marginBottom=false){ // Recebe um elemento input e configura attrs para switch
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
function __settingsAddDivisor(){return document.createElement('hr')}
function __settingsAddBreak(){return document.createElement('br')}
function __settingsUpdateBaselines(){ // Atualiza tabela com patamares cadastrados
    let baseline = this.projects[this.projectIndex].param ? this.projects[this.projectIndex].getBaselines() : this.projects[this.projectIndex].linha.getBaselines();
    this.settingsBaselineTable.innerHTML = '<thead><tr><th colspan="2">Faixa</th><th colspan="2">Ciclo</th><th colspan="2">Intervalo</th><th colspan="2">Frequência</th></tr><tr><th>Inicio</th><th>Fim</th><th>Ida</th><th>Volta</th><th>Ida</th><th>Volta</th><th>Frota</th><th>Freq</th></tr></thead>';
    for(let i = 0; i < baseline.length; i++){
        let onclick = `if(parseInt(this.innerHTML) > 0){this.nextSibling.innerHTML = parseFloat((parseInt(this.parentNode.childNodes[2].innerHTML) + parseInt(this.parentNode.childNodes[3].innerHTML) + parseInt(this.parentNode.childNodes[4].innerHTML) + parseInt(this.parentNode.childNodes[5].innerHTML)) / parseInt(this.innerHTML)).toFixed(2)}else{this.nextSibling.innerHTML = ''}`;
        let tr = `<tr><td>${baseline[i].inicial}</td><td>${baseline[i].final}</td><td>${baseline[i].ida}</td><td>${baseline[i].volta}</td><td>${baseline[i].intervalo_ida}</td><td>${baseline[i].intervalo_volta}</td><td class="bg-body-secondary" contenteditable="true" oninput="${onclick}"></td><td></td></tr>`;
        this.settingsBaselineTable.innerHTML += tr;
    }
}
function __settingsUpdateFreqSimulate(){ // Calcula frequencia (exibe na label) baseado nos dados do patamar
    if(this.settingsCarSimulate.value == '' || this.settingsCarSimulate.value == 0){this.settingsFreqSimulate.innerHTML = '--'; return false;}
    if(!this.projects[this.projectIndex].linha.circular){
        this.settingsFreqSimulate.innerHTML = ((parseInt(this.settingsBaselineOrigemMin.value) + parseInt(this.settingsBaselineToMin.value) + parseInt(this.settingsBaselineOrigemInterv.value) + parseInt(this.settingsBaselineToInterv.value)) / parseInt(this.settingsCarSimulate.value)).toFixed(2);
    }
    else{
        this.settingsFreqSimulate.innerHTML = ((parseInt(this.settingsBaselineOrigemMin.value) + parseInt(this.settingsBaselineOrigemInterv.value)) / parseInt(this.settingsCarSimulate.value)).toFixed(2);
    }
}

export { __builSettingsUI, __settingsAddCustomLabel, __settingsContainerSwitch, __settingsAddDivisor, __settingsAddBreak, __settingsUpdateBaselines, __settingsUpdateFreqSimulate}