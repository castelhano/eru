import { metrics as $, defaultParam, min2Hour, min2Range, hour2Min } from './DM_metrics.js';
import { Car } from './DM_car.js';
import { Trip } from './DM_trip.js';
import { Route } from './DM_route.js';
import { Locale } from './DM_locale.js';

class jsGaitDiagram{
    constructor(options){
        this.version = '1.1.322';
        this.id = options?.id || 'new';
        this.nome = options?.nome || 'Novo Projeto';
        this.desc = options?.desc || '';
        this.linha = options?.linha || new Route({});
        this.param = options?.param || null;
        this.carros = options?.carros || [];
        this.viewStage = options?.viewStage || 1; // View 1: Diagrama de Marcha, 2: Editor de Schedules, 3: Resumo e definicoes
        this.dia_tipo = options?.dia_tipo || $.UTIL;
        this.jornada_normal = options?.jornada_normal || 420; // Jornada de trabalho normal 07:00 = 420 | 07:20 = 440
        this.ativo = options?.ativo || options?.ativo == true;
        this.area_transferencia = options?.area_transferencia || []; // Area de armazenomento de viagens
        this.somar_intervalo_entre_viagens = options?.somar_intervalo_entre_viagens || options?.somar_intervalo_entre_viagens == true;
        this.save = options?.save != undefined ? options.save : () => { // Funcao de salvamento do projeto
            console.log('jsMarch: Nenhuma funcao definida para save, nas opcoes marque {save: suaFuncao}');
        };
    }
    addCar(options){ // Adiciona carro no projeto ja inserindo uma viagem (sentido ida)
        if(this.carros.length > 0){
            options['startAt'] = this.carros[this.carros.length - 1].firstTrip().inicio + (options?.freq || $.FREQUENCIA_BASE);
        }
        options.param = this.param || this.linha.param;
        this.carros.push(new Car(options));
        return this.carros.slice(-1)[0]; // Retorna carro inserido 
    }
    addTrip(carIndex, startAt=null){
        return this.carros[carIndex].addTrip({linha: this.linha, startAt: startAt, param: this.param || this.linha.param});
    }
    removeCar(carIndex){
        return this.carros.splice(carIndex, 1);
    }
    addSchedule(carIndex, options){
        options.nome = this.escalaBaptize(carIndex, this.carros[carIndex].escalas.length);
        let r = this.carros[carIndex].addSchedule(options)
        return r;
    }
    nextTrip(viagem){ // Retorna proxima viagem (no mesmo sentido) indiferente de carro, alem do indice do referido carro e viagem
        let bestMatch = null;
        let carIndex = null;
        for(let i = 0; i < this.carros.length; i++){
            let curTrips = this.carros[i].viagens.filter((el) => el != viagem && el.sentido == viagem.sentido);
            for(let j = 0; j < curTrips.length; j++){
                if(!bestMatch && ![$.INTERVALO, $.ACESSO, $.RECOLHE, $.RESERVADO].includes(curTrips[j].tipo) && curTrips[j].inicio >= viagem.inicio || ![$.INTERVALO, $.ACESSO, $.RECOLHE, $.RESERVADO].includes(curTrips[j].tipo) && curTrips[j].inicio < bestMatch?.inicio && curTrips[j].inicio >= viagem.inicio){
                    bestMatch = curTrips[j];
                    carIndex = i;
                }
            }            
        }
        return bestMatch ? [carIndex, this.carros[carIndex].viagens.indexOf(bestMatch), bestMatch] : false;
    }
    previousTrip(viagem){ // Retorna viagem anterior (no mesmo sentido) indiferente de carro, alem do indice do referido carro e viagem
        let bestMatch = null;
        let carIndex = null;
        for(let i = 0; i < this.carros.length; i++){
            let curTrips = this.carros[i].viagens.filter((el) => el != viagem && el.sentido == viagem.sentido);
            for(let j = 0; j < curTrips.length; j++){
                if(!bestMatch && ![$.INTERVALO, $.ACESSO, $.RECOLHE, $.RESERVADO].includes(curTrips[j].tipo) && curTrips[j].inicio <= viagem.inicio || ![$.INTERVALO, $.ACESSO, $.RECOLHE, $.RESERVADO].includes(curTrips[j].tipo) && curTrips[j].inicio > bestMatch?.inicio && curTrips[j].inicio <= viagem.inicio){
                    bestMatch = curTrips[j];
                    carIndex = i;
                }
            }            
        }
        return bestMatch ? [carIndex, this.carros[carIndex].viagens.indexOf(bestMatch), bestMatch] : false;
    }
    getHeadway(viagem){ // Retorna minutos entre a viagem atual e anterior (mesmo sentido)
        let t = this.previousTrip(viagem);
        return t ? viagem.inicio - t[2].inicio : false;
    }
    getJourney(carIndex=null){ // Retorna a soma da jornada do carro informado
        if(carIndex != null){
            return this.carros[carIndex].getJourney(this.somar_intervalo_entre_viagens);
        }
        let sum = 0;
        for(let i = 0; i < this.carros.length; i++){
            sum += this.carros[i].getJourney(this.somar_intervalo_entre_viagens);
        }
        return sum;
    }
    autoGenerateSchedules(){
        for(let i = 0; i < this.carros.length; i++){
            let blocks = this.carros[i].getCarSchedulesBlock(this.linha);
            this.carros[i].escalas = []; // Limpa as escalas do carro
            for(let j = 0; j < blocks.length; j++){
                this.carros[i].escalas.push({inicio: blocks[j].inicioIndex, fim: blocks[j].fimIndex, nome: this.escalaBaptize(i, j), deltaStart: 0, deltaEnd: 0, previous: null, next: null})
            }
        }
        return true;
    }
    escalaBaptize(carIndex, new_seq){ // Define nome automatico para tabela
        let seq = ['A', 'B', 'C', 'D', 'E', 'F'];
        return `${String(carIndex + 1).padStart(2,'0')}${seq[new_seq]}`;
    }
    deleteSchedule(carIndex, scheduleIndex){
        let chain = [];
        if(this.carros[carIndex].escalas[scheduleIndex].next && !this.carros[carIndex].escalas[scheduleIndex].next.externalProject){
            chain.push(this.carros[carIndex].escalas[scheduleIndex].next.carro);
            this.carros[this.carros[carIndex].escalas[scheduleIndex].next.carro].escalas[this.carros[carIndex].escalas[scheduleIndex].next.escala].previous = null;
        }
        if(this.carros[carIndex].escalas[scheduleIndex].previous && !this.carros[carIndex].escalas[scheduleIndex].previous.externalProject){
            chain.push(this.carros[carIndex].escalas[scheduleIndex].previous.carro);
            this.carros[this.carros[carIndex].escalas[scheduleIndex].previous.carro].escalas[this.carros[carIndex].escalas[scheduleIndex].previous.escala].next = null;
        }
        this.carros[carIndex].deleteSchedule(scheduleIndex);
        return chain;
    }
    getBaselines(){ // Retorna json com resumo dos patamares {inicio: 4, fim: 8, ida: 50, volta: 45, ...}
        let paramKeys = ['ida','volta','intervalo_ida','intervalo_volta'];
        let baseline = [];
        let inicial = 0;
        let final = 0;
        let last_entry = {};
        for(let i in this.param){
            let entry = {};
            for(let j = 0; j < paramKeys.length;j++){entry[paramKeys[j]] = this.param[i][paramKeys[j]]} // Carrega os attrs em entry
            if(i == 0){ // Na primeira iteracao, cria a entrada do primeiro patamar
                last_entry = {...entry}
                baseline.push(Object.assign({inicial: 0, final: 0}, entry));
            }
            else if(JSON.stringify(last_entry) == JSON.stringify(entry)){ // Se nova entrada for igual entrada anterior, apenas aumenta final em 1
                baseline[baseline.length - 1].final += 1;
            }
            else{ // Se encontrou diferenca no patamar, fecha entry e carrega na baseline
                baseline.push(Object.assign({inicial: parseInt(i), final: parseInt(i)}, entry));
                last_entry = {...entry};
            }
        }
        return baseline;
    }
    getIntervs(carIndex=null){ // Retorna a soma de intervalos do carro informado (ou soma total do projeto)
        if(carIndex != null){
            return this.carros[carIndex].getIntervs(this.somar_intervalo_entre_viagens);
        }
        let sum = 0;
        for(let i = 0; i < this.carros.length; i++){
            sum += this.carros[i].getIntervs(this.somar_intervalo_entre_viagens);
        }
        return sum;
    }
    getFirstTrip(sentido=$.IDA){ // Retorna primeia viagem no sentido informado
        if(this.carros.length == 0){return false}
        let first, carIndex, tripIndex;
        for(let i = 0; i < this.carros.length;i++){
            for(let j = 0; j < this.carros[i].viagens.length; j++){
                if(![$.ACESSO, $.RECOLHE, $.INTERVALO].includes(this.carros[i].viagens[j].tipo) && this.carros[i].viagens[j].sentido == sentido && (this.carros[i].viagens[j].inicio < first?.inicio || !first)){
                    first = this.carros[i].viagens[j];
                    carIndex = i;
                    tripIndex = j;
                }
            }
        }
        return [first, carIndex, tripIndex];
    }
    getLastTrip(sentido=$.VOLTA){ // Retorna ultima viagem no sentido informado
        if(this.carros.length == 0){return false}
        let last, carIndex, tripIndex;
        for(let i = 0; i < this.carros.length;i++){
            for(let j = 0; j < this.carros[i].viagens.length; j++){
                if(![$.ACESSO, $.RECOLHE, $.INTERVALO].includes(this.carros[i].viagens[j].tipo) && this.carros[i].viagens[j].sentido == sentido && (this.carros[i].viagens[j].inicio > last?.inicio || !last)){
                    last = this.carros[i].viagens[j];
                    carIndex = i;
                    tripIndex = j;
                }
            }
        }
        return [last, carIndex, tripIndex];
    }
    moveTrips(carOriginIndex, carDestinyIndex, startTripIndex, endTripIndex){ // Movimenta viagens de um carro para outro
        if(this.carros[carOriginIndex].viagens.length <= endTripIndex - startTripIndex + 1){return false}
        let conflict = false;
        let i = startTripIndex;
        while(!conflict && i <= endTripIndex){ // Verifica de todas as viagens podem ser movimentadas
            if(!this.carros[carDestinyIndex].__tripIsValid(this.carros[carOriginIndex].viagens[i])){
                conflict = true;
            }
            i++;
        }
        if(conflict){return false}
        // Se nenhum conflito encontrado, remove as viagens do carro de origem e move para o destino
        this.carros[carDestinyIndex].viagens = this.carros[carDestinyIndex].viagens.concat(this.carros[carOriginIndex].viagens.splice(startTripIndex, endTripIndex - startTripIndex + 1));
        this.carros[carDestinyIndex].viagens.sort((a, b) => a.inicio > b.inicio ? 1 : -1); // Reordena viagens pelo inicio
        return true;
    }
    addToTransferArea(carIndex, tripStartIndex, tripEndIndex){ // Adiciona viagem's a area de transferencia
        if(this.area_transferencia.length > 0 || tripEndIndex - tripStartIndex + 1 == this.carros[carIndex].viagens.length){return false} // Area de transferencia armazena apenas um grupo de linhas de cada vez
        this.area_transferencia = this.carros[carIndex].removeTrip(tripStartIndex, false, tripEndIndex - tripStartIndex + 1)[0];
        return this.area_transferencia;
    }
    pasteTransfer(carIndex){ // Move as viagens da area de transfeencia para o carro informado
        for(let i = 0; i < this.area_transferencia.length; i++){ // Valida todas as viagens se nao gera conflito com a carro de destino
            if(!this.carros[carIndex].__tripIsValid(this.area_transferencia[i])){return false}
        }    
        for(let i = 0; i < this.area_transferencia.length; i++){ // Adiciona as viagens no carro alvo
            this.carros[carIndex].viagens.push(this.area_transferencia[i]);
        }
        this.carros[carIndex].viagens.sort((a, b) => a.inicio > b.inicio ? 1 : -1); // Reordena viagens pelo inicio
        this.area_transferencia = []; // Limpa area de trasnferencia
        return true;
    }
    generate(metrics){ // Gera planejamento baseado nas metricas definidas
        return new Promise(resolve => {
            this.carros = []; // Limpa planejamento atual
            let faixa = min2Range(metrics.inicio);
            let ciclo;
            let param = this.param ? this.param : this.linha.param; // Se parametros para o planejamento atual usa este, se nao usa os da linha
            if(this.linha.circular){ciclo = param[faixa].ida + param[faixa].intervalo_ida}
            else{ciclo = param[faixa].ida + param[faixa].volta + param[faixa].intervalo_ida + param[faixa].intervalo_volta}
            let freq = Math.ceil(ciclo / metrics.carro);
            $.INICIO_OPERACAO = metrics.inicio; // Ajusta inicio de operacao para hora informada
            for(let i = 0; i < metrics.carro; i++){
                let c = this.addCar({linha: this.linha, freq: freq});
                let j = 0;
                while(c.viagens[j].inicio < metrics.fim){
                    c.addTrip({linha: this.linha, param: param});
                    j++;
                }
            }
            if(metrics?.addAccess){
                for(let i = 0; i < metrics.carro; i++){ // Adiciona acesso para todos os carros
                    this.carros[i].addAccess(0, this.linha);
                }
            }
            resolve(true);
        })
    }
    load(project){ // Recebe dicionario, monta instancias e carrega projeto
        let allowedFields = ['version','id', 'nome', 'desc','user', 'status','dia_tipo','ativo','viewStage','jornada_normal','somar_intervalo_entre_viagens'];
        for(let i = 0; i < allowedFields.length; i++){ // Carrega os dados base do projeto
            this[allowedFields[i]] = project[allowedFields[i]];
        }
        // ----------
        project.linha.origem = new Locale(project.linha.origem); // Cria instancia Locale para origem
        project.linha.destino = new Locale(project.linha.destino); // Cria instancia Locale para origem
        let origemRefs = [], destinoRefs = [];
        for(let i = 0; i < project.linha.refs.origem.length;i++){ // Cria instancias para referencias de ida
            project.linha.refs.origem[i].local = new Locale(project.linha.refs.origem[i].local); // Cria instancia de Locale
            origemRefs.push(project.linha.refs.origem[i])
        }
        for(let i = 0; i < project.linha.refs.destino.length;i++){ // Cria instancias para referencias de volta
            project.linha.refs.destino[i].local = new Locale(project.linha.refs.destino[i].local); // Cria instancia de Locale
            destinoRefs.push(project.linha.refs.destino[i])
        }
        project.linha.refs.origem = origemRefs;
        project.linha.refs.destino = destinoRefs;
        // ----------
        this.linha = new Route(project.linha); // Cria instancia da linha
        this.carros = [];
        for(let i = 0; i < project.carros.length;i++){ // Cria instancias para todos os carros do projeto
            let viagens = [];
            for(let j = 0; j < project.carros[i].viagens.length;j++){ // Cria instancias para todas as viagens
                viagens.push(new Trip(project.carros[i].viagens[j]))
            }
            project.carros[i].viagens = viagens; // Substitui o carros.viagens (array simples) pelo viagens (array de instancias Trip)
            this.carros.push(new Car(project.carros[i]));
        }
        this.area_transferencia = [];
        for(let i = 0; i < project.area_transferencia.length;i++){ // Cria instancias para viagens na area de transferencia
            this.area_transferencia.push(new Trip(project.area_transferencia[i]))
        }
    }
    reset(){ // Limpa planejamento e escalas
        this.carros = [];
        this.viewStage = 1;
        this.area_transferencia = [];
        return true;
    }
    countTrips(){ // Retorna a quantidade de viagens geral do projeto ou do carro se informado carIndex
        let counter = {origem: 0, destino: 0, expresso: 0, semiexpresso: 0, lazyFrom: 0, lazyTo: 0, accessFrom: 0, accessTo: 0, recallFrom: 0, recallTo: 0};
        for(let i = 0; i < this.carros.length; i++){
            for(let j = 0; j < this.carros[i].viagens.length; j++){
                if(this.carros[i].viagens[j].tipo == $.INTERVALO){continue}
                else if(this.carros[i].viagens[j].tipo == $.ACESSO){if(this.carros[i].viagens[j].sentido == $.IDA){counter.accessFrom ++}else{counter.accessTo ++}}
                else if(this.carros[i].viagens[j].tipo == $.RECOLHE){if(this.carros[i].viagens[j].sentido == $.IDA){counter.recallFrom ++}else{counter.recallTo ++}}
                else if(this.carros[i].viagens[j].tipo == $.RESERVADO){if(this.carros[i].viagens[j].sentido == $.IDA){counter.lazyFrom ++}else{counter.lazyTo ++}}
                else{
                    if(this.carros[i].viagens[j].tipo == $.EXPRESSO){counter.expresso ++;}
                    else if(this.carros[i].viagens[j].tipo == $.SEMIEXPRESSO){counter.semiexpresso ++;}
                    // ---
                    if(this.carros[i].viagens[j].sentido == $.IDA){counter.origem ++;}
                    else if(this.carros[i].viagens[j].sentido == $.VOLTA){counter.destino ++;}
                }
            }
        }
        return counter;
    }
    countWorkers(){
        let full = 0, half = 0, horas_normais = 0, horas_extras = 0, escalas = [];
        for(let i = 0; i < this.carros.length; i++){
            for(let j = 0; j < this.carros[i].escalas.length; j++){
                if(this.carros[i].escalas[j].previous && !this.carros[i].escalas[j].previous.externalProject){continue}
                if(!this.carros[i].escalas[j].previous){full++} // Se escala nao tiver apontamento anterior, conta motorista
                else{half++;}
                let c = 0, p = 0, n = 0, nt = 0, ot = 0, chain = this.carros[i].escalas[j].next; // Current sched, previous e next, normal_time e overtime, chain marca proxima escala encadeada
                c = this.carros[i].getScheduleJourney(j);
                while(chain){ // Corre escalas procurando proximo elo
                    n += this.carros[i].escalas[j].next.externalProject ? chain.journey : this.carros[chain.carro].getScheduleJourney(chain.escala);
                    chain = this.carros[i].escalas[j].next.externalProject ? false : this.carros[chain.carro].escalas[chain.escala].next;
                }
                if(this.carros[i].escalas[j].previous && this.carros[i].escalas[j].previous.externalProject){p = this.carros[i].escalas[j].previous.journey}
                nt = Math.min(c + p + n, this.jornada_normal);
                ot = (c + p + n) - nt;
                escalas.push({nome: this.carros[i].escalas[j].nome, normalTime: nt, overtime: ot})
                horas_normais += nt;
                horas_extras += ot;
            }
        }
        return {workers: full, half: half, normalTime: horas_normais, overtime: horas_extras, escalas: escalas};
    }
    supplyNDemand(){ // Retorna dicionario com dados de oferta e demanda por faixa horario (demanda deve ser fornecida)
        let od = {}
        for(let i = 0; i < 24; i++){
            od[i] = {viagens_ida: 0, demanda_ida: this.linha.param[i].demanda_ida, oferta_ida: 0, viagens_volta: 0, demanda_volta: this.linha.param[i].demanda_volta, oferta_volta: 0}
        }
        for(let i = 0; i < this.carros.length; i++){
            for(let j = 0; j < this.carros[i].viagens.length; j++){
                let faixa = min2Range(this.carros[i].viagens[j].inicio);
                if(![$.ACESSO, $.RECOLHE, $.INTERVALO, $.RESERVADO].includes(this.carros[i].viagens[j].tipo)){ // Se for viagem produtiva
                    if(this.carros[i].viagens[j].sentido == $.IDA){
                        od[faixa].viagens_ida++; // Incrementa contador de viagens da faixa/sentido
                        od[faixa].oferta_ida += $.CAPACIDADE_CARREGAMENTO[this.carros[i].classificacao]; // Incrementa contator de oferta para faixa/sentido
                    }
                    else if(this.carros[i].viagens[j].sentido == $.VOLTA){
                        od[faixa].destinoTrips++; // Incrementa contador de viagens da faixa/sentido
                        od[faixa].oferta_volta += $.CAPACIDADE_CARREGAMENTO[this.carros[i].classificacao]; // Incrementa contator de oferta para faixa/sentido
                    }
                }
            }
        }
        let oferta_ida=[], demanda_ida=[], oferta_volta=[], demanda_volta=[];
        for(let i in od){
            oferta_ida.push(od[i].oferta_ida);
            demanda_ida.push(od[i].demanda_ida);
            oferta_volta.push(od[i].oferta_volta);
            demanda_volta.push(od[i].demanda_volta);
        }
        
        return [od, {oferta_ida:oferta_ida, demanda_ida:demanda_ida, oferta_volta:oferta_volta, demanda_volta:demanda_volta}];
    }
    exportJson(){
        let data = JSON.stringify(this);
        let dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(data);
        let filename = `${this.nome}.json`;
        let btn = document.createElement('a');
        btn.classList = 'd-none';
        btn.setAttribute('href', dataUri);
        btn.setAttribute('download', filename);
        btn.click();
        btn.remove();
    }
}
export { jsGaitDiagram }