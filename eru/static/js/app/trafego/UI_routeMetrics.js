import { metrics as $ } from './DM_metrics.js';

function __showRouteMetrics(){
    canvasNavActive(false);
    this.gridLocked = true;
    let dialog = document.createElement('dialog'); dialog.style.minWidth = '600px';dialog.style.display = 'flex';dialog.style.columnGap = '15px';
    dialog.addEventListener('close', ()=>{this.gridLocked = false;dialog.remove();})
    let col1 = document.createElement('div'); col1.style.display = 'inline-block';col1.style.width = '25%';col1.innerHTML = `<h6 class="mb-2">Métricas - <span class="text-purple">${this.projects[this.projectIndex].linha.codigo} ${this.projects[this.projectIndex].linha.nome}</span></h6>`;
    let col2 = document.createElement('div'); col2.style.display = 'inline-block';col2.style.width = '75%';col2.style.borderLeft = '1px solid var(--bs-secondary-bg)';col2.style.paddingLeft = '15px';col2.innerHTML = '<h6 class="mb-2">Patamares de Operação</h6>'
    let dialogDismiss = document.createElement('i'); dialogDismiss.classList = 'bi bi-x-lg position-absolute pointer';dialogDismiss.style.top = '8px'; dialogDismiss.style.right = '15px';
    dialogDismiss.onclick = ()=>{dialog.close()}
    dialog.appendChild(dialogDismiss);
    // Adicionado os controles das metricas
    let linhaCirc = document.createElement('input');linhaCirc.type = 'checkbox';linhaCirc.id = 'March_linhaCircControl';linhaCirc.checked = this.projects[this.projectIndex].linha.circular;
    linhaCirc.disabled = true;
    col1.appendChild(this.__settingsContainerSwitch(linhaCirc, 'Linha circular', '10px'));
    let col11 = document.createElement('div'); col11.style.display = 'inline-block';col11.style.width = '50%';
    this.settingsOrigemExtension = document.createElement('input');this.settingsOrigemExtension.type = 'number';this.settingsOrigemExtension.classList = 'flat-input';this.settingsOrigemExtension.min = 0;this.settingsOrigemExtension.max = 300;this.settingsOrigemExtension.value = this.projects[this.projectIndex].linha.extensao_ida;this.settingsOrigemExtension.id = 'March_settingsOrigemExtension';this.settingsOrigemExtension.placeholder = ' ';
    this.settingsOrigemExtension.disabled = true;
    col11.appendChild(this.settingsOrigemExtension);
    col11.appendChild(this.__settingsAddCustomLabel(this.settingsOrigemExtension, 'Extensão Ida (km)'));
    col1.appendChild(col11);
    
    let col12 = document.createElement('div'); col12.style.display = 'inline-block';col12.style.width = '50%';
    this.settingsToExtension = document.createElement('input');this.settingsToExtension.type = 'number';this.settingsToExtension.classList = 'flat-input';this.settingsToExtension.min = 0;this.settingsToExtension.max = 300;this.settingsToExtension.value = this.projects[this.projectIndex].linha.extensao_volta;this.settingsToExtension.id = 'March_settingsToExtension';this.settingsToExtension.placeholder = ' ';
    this.settingsToExtension.disabled = true;
    col12.appendChild(this.settingsToExtension);
    col12.appendChild(this.__settingsAddCustomLabel(this.settingsToExtension, 'Extensão Volta (km)'));
    col1.appendChild(col12);
    
    let col13 = document.createElement('div'); col13.style.display = 'inline-block';col13.style.width = '50%';
    this.settingsAccessOrigemMin = document.createElement('input');this.settingsAccessOrigemMin.type = 'number';this.settingsAccessOrigemMin.classList = 'flat-input';this.settingsAccessOrigemMin.min = 1;this.settingsAccessOrigemMin.max = 300;this.settingsAccessOrigemMin.value = this.projects[this.projectIndex].linha.acesso_origem_minutos;this.settingsAccessOrigemMin.id = 'March_settingsAccessOrigemMin';this.settingsAccessOrigemMin.placeholder = ' ';
    this.settingsAccessOrigemMin.disabled = true;
    col13.appendChild(this.settingsAccessOrigemMin);
    col13.appendChild(this.__settingsAddCustomLabel(this.settingsAccessOrigemMin, 'Acesso PT1 (min)'));
    col1.appendChild(col13);
    
    let col14 = document.createElement('div'); col14.style.display = 'inline-block';col14.style.width = '50%';
    this.settingsAccessToMin = document.createElement('input');this.settingsAccessToMin.type = 'number';this.settingsAccessToMin.classList = 'flat-input';this.settingsAccessToMin.min = 1;this.settingsAccessToMin.max = 300;this.settingsAccessToMin.value = this.projects[this.projectIndex].linha.acesso_destino_minutos;this.settingsAccessToMin.id = 'March_settingsAccessToMin';this.settingsAccessToMin.placeholder = ' ';
    this.settingsAccessToMin.disabled = true;
    col14.appendChild(this.settingsAccessToMin);
    col14.appendChild(this.__settingsAddCustomLabel(this.settingsAccessToMin, 'Acesso PT2 (min)'));
    col1.appendChild(col14);
    
    let col15 = document.createElement('div'); col15.style.display = 'inline-block';col15.style.width = '50%';
    this.settingsRecallOrigemMin = document.createElement('input');this.settingsRecallOrigemMin.type = 'number';this.settingsRecallOrigemMin.classList = 'flat-input';this.settingsRecallOrigemMin.min = 1;this.settingsRecallOrigemMin.max = 300;this.settingsRecallOrigemMin.value = this.projects[this.projectIndex].linha.recolhe_origem_minutos;this.settingsRecallOrigemMin.id = 'March_settingsRecallOrigemMin';this.settingsRecallOrigemMin.placeholder = ' ';
    this.settingsRecallOrigemMin.disabled = true;
    col15.appendChild(this.settingsRecallOrigemMin);
    col15.appendChild(this.__settingsAddCustomLabel(this.settingsRecallOrigemMin, 'Recolhe PT1 (min)'));
    col1.appendChild(col15);
    
    let col16 = document.createElement('div'); col16.style.display = 'inline-block';col16.style.width = '50%';
    this.settingsRecallToMin = document.createElement('input');this.settingsRecallToMin.type = 'number';this.settingsRecallToMin.classList = 'flat-input';this.settingsRecallToMin.min = 1;this.settingsRecallToMin.max = 300;this.settingsRecallToMin.value = this.projects[this.projectIndex].linha.recolhe_destino_minutos;this.settingsRecallToMin.id = 'March_settingsRecallToMin';this.settingsRecallToMin.placeholder = ' ';
    this.settingsRecallToMin.disabled = true;
    col16.appendChild(this.settingsRecallToMin);
    col16.appendChild(this.__settingsAddCustomLabel(this.settingsRecallToMin, 'Recolhe PT2 (min)'));
    col1.appendChild(col16);
    
    let col17 = document.createElement('div'); col17.style.display = 'inline-block';col17.style.width = '50%';
    this.settingsAccessOrigemKm = document.createElement('input');this.settingsAccessOrigemKm.type = 'number';this.settingsAccessOrigemKm.classList = 'flat-input';this.settingsAccessOrigemKm.min = 0;this.settingsAccessOrigemKm.max = 300;this.settingsAccessOrigemKm.value = this.projects[this.projectIndex].linha.acesso_origem_km;this.settingsAccessOrigemKm.id = 'March_settingsAccessOrigemKm';this.settingsAccessOrigemKm.placeholder = ' ';
    this.settingsAccessOrigemKm.disabled = true;
    col17.appendChild(this.settingsAccessOrigemKm);
    col17.appendChild(this.__settingsAddCustomLabel(this.settingsAccessOrigemKm, 'Acesso PT1 (km)'));
    col1.appendChild(col17);
    
    let col18 = document.createElement('div'); col18.style.display = 'inline-block';col18.style.width = '50%';
    this.settingsAccessToKm = document.createElement('input');this.settingsAccessToKm.type = 'number';this.settingsAccessToKm.classList = 'flat-input';this.settingsAccessToKm.min = 0;this.settingsAccessToKm.max = 300;this.settingsAccessToKm.value = this.projects[this.projectIndex].linha.acesso_destino_km;this.settingsAccessToKm.id = 'March_settingsAccessToKm';this.settingsAccessToKm.placeholder = ' ';
    this.settingsAccessToKm.disabled = true;
    col18.appendChild(this.settingsAccessToKm);
    col18.appendChild(this.__settingsAddCustomLabel(this.settingsAccessToKm, 'Acesso PT2 (km)'));
    col1.appendChild(col18);
    
    let col19 = document.createElement('div'); col19.style.display = 'inline-block';col19.style.width = '50%';
    this.settingsRecallOrigemKm = document.createElement('input');this.settingsRecallOrigemKm.type = 'number';this.settingsRecallOrigemKm.classList = 'flat-input';this.settingsRecallOrigemKm.min = 0;this.settingsRecallOrigemKm.max = 300;this.settingsRecallOrigemKm.value = this.projects[this.projectIndex].linha.recolhe_origem_km;this.settingsRecallOrigemKm.id = 'March_settingsRecallOrigemKm';this.settingsRecallOrigemKm.placeholder = ' ';
    this.settingsRecallOrigemKm.disabled = true;
    col19.appendChild(this.settingsRecallOrigemKm);
    col19.appendChild(this.__settingsAddCustomLabel(this.settingsRecallOrigemKm, 'Recolhe PT1 (km)'));
    col1.appendChild(col19);
    
    let col20 = document.createElement('div'); col20.style.display = 'inline-block';col20.style.width = '50%';
    this.settingsRecallToKm = document.createElement('input');this.settingsRecallToKm.type = 'number';this.settingsRecallToKm.classList = 'flat-input';this.settingsRecallToKm.min = 0;this.settingsRecallToKm.max = 300;this.settingsRecallToKm.value = this.projects[this.projectIndex].linha.recolhe_destino_km;this.settingsRecallToKm.id = 'March_settingsRecallToKm';this.settingsRecallToKm.placeholder = ' ';
    this.settingsRecallToKm.disabled = true;
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
    this.settingsBaselineOrigemMin = document.createElement('input');this.settingsBaselineOrigemMin.type = 'number';this.settingsBaselineOrigemMin.classList = 'flat-input';this.settingsBaselineOrigemMin.min = 1;this.settingsBaselineOrigemMin.max = 300;this.settingsBaselineOrigemMin.value = $.CICLO_BASE;this.settingsBaselineOrigemMin.id = 'March_settingsBaselineOrigemMin';this.settingsBaselineOrigemMin.placeholder = ' ';
    this.settingsBaselineOrigemMin.onchange = () => {this.__settingsUpdateFreqSimulate()}
    col23.appendChild(this.settingsBaselineOrigemMin);
    col23.appendChild(this.__settingsAddCustomLabel(this.settingsBaselineOrigemMin, 'Ciclo Ida'));
    col2.appendChild(col23);
    
    let col24 = document.createElement('div'); col24.style.display = 'inline-block';col24.style.width = '12%';
    this.settingsBaselineToMin = document.createElement('input');this.settingsBaselineToMin.type = 'number';this.settingsBaselineToMin.classList = 'flat-input';this.settingsBaselineToMin.min = 1;this.settingsBaselineToMin.max = 300;this.settingsBaselineToMin.value = $.CICLO_BASE;this.settingsBaselineToMin.id = 'March_settingsBaselineToMin';this.settingsBaselineToMin.placeholder = ' ';
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
    if(this.projects[this.projectIndex].linha.circular){
        this.settingsBaselineToMin.disabled = true;
        this.settingsBaselineToInterv.disabled = true;
    }
    this.settingsBaselineToInterv.onchange = () => {this.__settingsUpdateFreqSimulate()}
    col26.appendChild(this.settingsBaselineToInterv);
    col26.appendChild(this.__settingsAddCustomLabel(this.settingsBaselineToInterv, 'Intervalo Volta'));
    col2.appendChild(col26);
    
    let col27 = document.createElement('div'); col27.style.display = 'inline-block';col27.style.width = '12%';
    this.settingsCarSimulate = document.createElement('input');this.settingsCarSimulate.type = 'number';this.settingsCarSimulate.classList = 'flat-input w-auto';this.settingsCarSimulate.min = 0;this.settingsCarSimulate.max = 30;this.settingsCarSimulate.value = 0;this.settingsCarSimulate.id = 'March_settingsCarSimulate';this.settingsCarSimulate.placeholder = ' ';
    this.settingsCarSimulate.onchange = () => {this.__settingsUpdateFreqSimulate()}
    col27.appendChild(this.settingsCarSimulate);
    col27.appendChild(this.__settingsAddCustomLabel(this.settingsCarSimulate, 'Frota (simulada)'));
    
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
        // Se parametros do projeto ainda nao iniciado, replica parametros da linha
        if(!this.projects[this.projectIndex].param){
            this.projects[this.projectIndex].param = {};
            for(let i in this.projects[this.projectIndex].linha.param){
                this.projects[this.projectIndex].param[i] = {...this.projects[this.projectIndex].linha.param[i]}
            }
        }
        for(let i = parseInt(this.settingsBaselineStart.value); i <= parseInt(this.settingsBaselineEnd.value); i++){
            this.projects[this.projectIndex].param[i].ida = parseInt(this.settingsBaselineOrigemMin.value);
            this.projects[this.projectIndex].param[i].volta = parseInt(this.settingsBaselineToMin.value);
            this.projects[this.projectIndex].param[i].intervalo_ida = parseInt(this.settingsBaselineOrigemInterv.value);
            this.projects[this.projectIndex].param[i].intervalo_volta = parseInt(this.settingsBaselineToInterv.value);
        }
        this.__settingsUpdateBaselines();
    }
    col28.appendChild(this.settingsBaselineSubmit);
    
    this.settingsBaselineRestore = document.createElement('button');this.settingsBaselineRestore.type = 'button';this.settingsBaselineRestore.classList  = 'btn btn-sm btn-phanton-orange ms-1';this.settingsBaselineRestore.innerHTML = 'Restaurar';
    this.settingsBaselineRestore.onclick = ()=>{this.projects[this.projectIndex].param = null;this.__settingsUpdateBaselines();}
    col28.appendChild(this.settingsBaselineRestore);
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

export { __showRouteMetrics }