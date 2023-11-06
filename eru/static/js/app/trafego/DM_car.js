import { metrics as $, min2Range, defaultParam } from './DM_metrics.js';
import { Route } from './DM_route.js';
import { Trip } from './DM_trip.js';

class Car{
    constructor(options){
        this.classificacao = options?.classificacao || $.CONVENCIONAL; // Tipo de tecnologia a ser usada
        this.viagens = options?.viagens || []; // Armazena as viagens do carro
        this.escalas = options?.escalas || []; // Armazena as tabelas (escalas) para o carro
        if(options.initialize != false && this.viagens.length == 0){ // Por padrao insere primeira viagem no carro
            this.addTrip({
                linha: options.linha,
                startAt: options.startAt,
                param: options.param,
            })
        }
    }
    addTrip(options){ // Adiciona viagem, se omitido options insere apos ultima viagem
        let route = options?.linha || new Route({});
        let startAt = options?.startAt || null;
        let param = options?.param || defaultParam();
        let opt = {}; // Dados da viagem
        if(this.viagens.length > 0){
            let last = null;
            if(!startAt){last = this.viagens[this.viagens.length - 1]} // Se nao informado startAt insere apos ultima viagem
            else{ // Se startAt busca viagem anterior
                let i = this.viagens.length - 1;
                let escape = false;
                while(!escape && i >= 0){
                    if(this.viagens[i].inicio < startAt && ![$.INTERVALO, $.ACESSO, $.RECOLHE].includes(this.viagens[i].tipo)){
                        escape = true;
                        last = this.viagens[i];
                    }
                    i--;
                }
            }
            let faixa;
            if(startAt){faixa = min2Range(startAt)}
            else if(last){faixa = min2Range(last.fim)}
            else{faixa = 0} // Em teoria se nao definido startAt, sempre deve existir uma viagem anterior
            
            let intervalo = last?.sentido == $.VOLTA || route.circular == true ? param[faixa].intervalo_ida : param[faixa].intervalo_volta;
            let ciclo = last?.sentido == $.VOLTA || route.circular == true ? param[faixa].ida : param[faixa].volta;
            opt = {
                inicio: startAt ? startAt : last.fim + intervalo,
                fim: startAt ? startAt + intervalo + ciclo : last.fim + intervalo + ciclo,
                sentido: last.sentido == $.VOLTA || route.circular == true ? $.IDA : $.VOLTA,
                origem: last.sentido == $.VOLTA || route.circular == true ? route.origem.id : route.destino.id,
                destino: last.sentido == $.IDA || route.circular == true ? route.origem.id : route.destino.id,
                tipo: $.PRODUTIVA
            }
        }
        else{
            let faixa = min2Range($.INICIO_OPERACAO);
            opt = {
                inicio: startAt ? startAt : $.INICIO_OPERACAO,
                fim: startAt ? startAt + param[faixa].ida : $.INICIO_OPERACAO + param[faixa].ida,
                sentido: $.IDA,
                origem: route.origem.id,
                destino: route.circular == true ? route.origem.id : route.destino.id,
                tipo: $.PRODUTIVA
            }
        }
        let v = new Trip(opt);
        if(startAt && !this.__tripIsValid(v)){ // Se definido startAt e viagem entra em conflito com outras viagens, cancela operacao
            appNotify('warning','jsMarch: Conflito com <b>outras viagens</b>');
            return false;
        }
        this.viagens.push(v);
        this.viagens.sort((a, b) => a.inicio > b.inicio ? 1 : -1);
        return v;
    }
    addInterv(tripIndex){ // Adiciona viagem do tipo intervalo entre duas viagens
        // Necessario ter viagem valida (produtiva) antes e depois do intervalo, e mais de um minuto entre as viagens
        if(tripIndex == this.viagens.length - 1 || [$.INTERVALO, $.RECOLHE].includes(this.viagens[tripIndex].tipo) || [$.INTERVALO, $.ACESSO].includes(this.viagens[tripIndex + 1].tipo) || this.viagens[tripIndex + 1].inicio <= this.viagens[tripIndex].fim + 1){return false}
        let current = this.viagens[tripIndex];
        let next = this.viagens[tripIndex + 1];
        let v = new Trip({inicio: current.fim + 1, fim: next.inicio - 1, tipo: $.INTERVALO, sentido: current.sentido})
        this.viagens.push(v);
        this.viagens.sort((a, b) => a.inicio > b.inicio ? 1 : -1);
        return v;
    }
    addAccess(tripIndex, route){
        // Acesso somente inserido se viagem for produtiva
        if([$.INTERVALO, $.ACESSO, $.RECOLHE].includes(this.viagens[tripIndex].tipo)){return false}
        let sentidoAccess = this.viagens[tripIndex].sentido == $.IDA ? 'acesso_origem_minutos' : 'acesso_destino_minutos';
        let accessMin = route[sentidoAccess];
        let v = new Trip({
            inicio: this.viagens[tripIndex].inicio - accessMin - 1, 
            fim: this.viagens[tripIndex].inicio - 1, 
            tipo: $.ACESSO, sentido: this.viagens[tripIndex].sentido, 
            origem: route.garagem.id,
            destino: this.viagens[tripIndex].sentido == $.IDA ? route.origem.id : route.destino.id
        })
        if(this.__tripIsValid(v)){
            this.viagens.push(v);
            this.viagens.sort((a, b) => a.inicio > b.inicio ? 1 : -1);
            return v;
        }
        return false;
    }
    addRecall(tripIndex, route){
        // Recolhe somente inserido se viagem for produtiva ou tiver sido encerrada
        if([$.INTERVALO, $.ACESSO, $.RECOLHE].includes(this.viagens[tripIndex].tipo) || this.viagens[tripIndex].encerrar){return false}
        let sentidoRecall = this.viagens[tripIndex].sentido == $.IDA ? 'recolhe_origem_minutos' : 'recolhe_destino_minutos';
        let recallMin = route[sentidoRecall];
        let v = new Trip({
            inicio: this.viagens[tripIndex].fim + 1, 
            fim: this.viagens[tripIndex].fim + recallMin + 1, 
            tipo: $.RECOLHE, sentido: this.viagens[tripIndex].sentido,
            origem: this.viagens[tripIndex].sentido == $.IDA ? route.origem.id : route.destino.id,
            destino: route.garagem.id
        })
        if(this.__tripIsValid(v)){
            this.viagens.push(v);
            this.viagens.sort((a, b) => a.inicio > b.inicio ? 1 : -1);
            return v;
        }
        return false;
    }
    __tripIsValid(viagem){ // Valida se viagem pode ser inserida no carro sem gerar conflito com outras viagens
        let conflict = false;
        let i = 0;
        while(!conflict && i < this.viagens.length){
            if((viagem.inicio >= this.viagens[i].inicio && viagem.inicio <= this.viagens[i].fim) || (viagem.fim >= this.viagens[i].inicio && viagem.fim <= this.viagens[i].fim)){conflict = true;}
            i++;
        }
        return !conflict;
    }
    addSchedule(options){ // Cria nova escala
        options.deltaStart = 0;
        if(this.escalas.length == 0){
            this.escalas.push(options)
            this.escalas.sort((a, b) => a.inicio > b.inicio ? 1 : -1); // Reordena escalas pelo inicio
        }
        else{
            this.escalas.push(options)
            this.escalas.sort((a, b) => a.inicio > b.inicio ? 1 : -1); // Reordena escalas pelo inicio
            let indice = this.escalas.indexOf(options);
            if(indice > 0 && (![$.RECOLHE, $.INTERVALO].includes(this.viagens[this.escalas[indice].fim].tipo) || !this.viagens[this.escalas[indice].fim].encerrar)){
                this.escalas[indice].deltaStart = this.escalas[indice - 1].deltaEnd;
            }
        }
        return this.escalas.indexOf(options);
    }
    updateSchedule(scheduleIndex, options, blockStartIndex, blockEndIndex){
        // Aborta operacao caso o novo fim informado seja menor que o inicio da escala, ou se o novo fim ser igual ao atual fim
        if(this.escalas[scheduleIndex].inicio > options.fim || (this.escalas[scheduleIndex].fim == options.fim && this.escalas[scheduleIndex].deltaStart == options.deltaStart && this.escalas[scheduleIndex].deltaEnd == options.deltaEnd)){return false}
        for(let key in options){
            this.escalas[scheduleIndex][key] = options[key]; // Atualiza os valores da escala
        }
        // Se existir escala depois da editada, verifica se ser necessario ajustar posteriores
        if(this.escalas.length > scheduleIndex + 1 && options.fim != undefined && this.escalas[scheduleIndex + 1].inicio <= blockEndIndex){
            if(this.escalas[scheduleIndex].fim == this.escalas[scheduleIndex + 1].fim){ // Novo final ocupa todo espaco da proxima escala, apaga a proxima
                this.escalas.splice(scheduleIndex + 1, 1)
            }
            else if(this.escalas[scheduleIndex].fim > this.escalas[scheduleIndex + 1].fim){ // Se novo final ocupe mais que o final da proxima viagem, apaga toda as demais
                this.escalas.splice(scheduleIndex + 1, this.escalas.length - 1 - scheduleIndex)
            }
            else{
                if(!this.viagens[this.escalas[scheduleIndex].fim].tipo == $.RECOLHE || !this.viagens[this.escalas[scheduleIndex].encerrar]){
                    this.escalas[scheduleIndex + 1].inicio = Math.max(blockStartIndex, this.escalas[scheduleIndex].fim + 1);
                    this.escalas[scheduleIndex + 1].deltaStart = this.escalas[scheduleIndex].deltaEnd;
                }
            }
        }
        return true;
    }
    deleteSchedule(scheduleIndex){
        this.escalas.splice(scheduleIndex, 1);
        return true;
    }
    getCarSchedulesBlock(route){ // Retorna array com blocos de viagens, cada bloco terminando com RECOLHE ou viagem.encerrar
        let blocks = [];
        let block = {inicio: this.viagens[0].inicio, inicioIndex: 0, fimIndex: 0, size:0, spots: []};
        let origemRefs = route.getSurrfimerRefs(IDA);
        let destinoRefs = route.getSurrfimerRefs(VOLTA);
        for(let i = 0; i < this.viagens.length; i++){
            // Adiciona spot de referencia do bloco
            if(this.viagens[i].sentido == $.IDA && [$.PRODUTIVA, $.EXPRESSO, $.SEMIEXPRESSO].includes(this.viagens[i].tipo)){
                for(let j = 0; j < origemRefs.length; j++){
                    let time = this.viagens[i].inicio + origemRefs[j].delta;
                    block.spots.push({locale: origemRefs[j].local, time: time, tipo: 'reference', tripIndex: i, sentido: IDA, delta: origemRefs[j].delta})
                }
            }
            else if(this.viagens[i].sentido == $.VOLTA && [$.PRODUTIVA, $.EXPRESSO, $.SEMIEXPRESSO].includes(this.viagens[i].tipo)){
                for(let j = 0; j < destinoRefs.length; j++){
                    let time = this.viagens[i].inicio + destinoRefs[j].delta;
                    block.spots.push({locale: destinoRefs[j].local, time: time, tipo: 'reference', tripIndex: i, sentido: VOLTA, delta: destinoRefs[j].delta})
                }
            }
            // Adiciona spots de viagem do bloco
            if(![$.ACESSO, $.INTERVALO].includes(this.viagens[i].tipo)){
                let time = this.viagens[i].fim + (this.viagens[i].encerrar ? 0 : this.getInterv(i));
                if(this.viagens[i].sentido == $.IDA){block.spots.push({locale: route.destino, time: time, tipo: 'viagemEnd', tripIndex: i, sentido: this.viagens[i].sentido, delta: 0})}
                else if(this.viagens[i].sentido == $.VOLTA){block.spots.push({locale: route.origem, time: time, tipo: 'viagemEnd', tripIndex: i})}
            }
            // Ajusta bloco inicio, fim e dimensao
            if(this.viagens[i].encerrar || this.viagens[i].tipo == $.RECOLHE || this.viagens.length - 1 == i){
                block.fimIndex = i;
                block.size += this.viagens[i].getCycle();
                blocks.push(Object.assign({}, this.__blockAddEmpty(block)));
                if(this.viagens.length - 1 > i){
                    block.inicio = this.viagens[i + 1].inicio;
                    block.inicioIndex = i + 1;
                    block.spots = [];
                    delete block.emptyStart;
                    delete block.emptyEnd;
                }
                block.size = 0;
            }
            else{block.size += this.viagens[i].getCycle() + this.getInterv(i)}
        }
        return blocks;
    }
    __blockAddEmpty(block){
        let lastScheduleIndex = -1;
        let lastDeltaStart = 0;
        let lastDeltaEnd = 0;
        for(let i = 0; i < this.escalas.length; i++){
            if(this.escalas[i].inicio >= block.inicioIndex && this.escalas[i].fim <= block.fimIndex){
                lastScheduleIndex = this.escalas[i].fim
                lastDeltaStart = this.escalas[i].deltaStart
                lastDeltaEnd = this.escalas[i].deltaEnd
            }
        }
        if(lastScheduleIndex == -1){block.emptyStart = block.inicioIndex;block.deltaStart = 0;block.deltaEnd = 0;}
        else if(lastScheduleIndex < block.fimIndex){
            block.emptyStart = lastScheduleIndex + 1;
            block.deltaStart = lastDeltaStart;
            block.deltaEnd = lastDeltaEnd;
        }
        return block;
    }
    cleanSchedule(indice=null){ // Limpa escala, se nao informado indice limpa todas as escalas
    }
    getScheduleJourney(scheduleIndex, allMetrics=false){
        let inicio = this.viagens[this.escalas[scheduleIndex].inicio].inicio;
        let fim = this.viagens[this.escalas[scheduleIndex].fim].fim;
        if(this.escalas[scheduleIndex].deltaStart > 0){
            inicio = this.viagens[this.escalas[scheduleIndex - 1].fim].inicio + this.escalas[scheduleIndex].deltaStart;
        }
        if(this.escalas[scheduleIndex].deltaEnd > 0){
            fim = this.viagens[this.escalas[scheduleIndex].fim].inicio + this.escalas[scheduleIndex].deltaEnd;
        }
        else{
            fim += this.getInterv(this.escalas[scheduleIndex].fim);
        }
        return allMetrics ? [fim - inicio, inicio, fim] : fim - inicio;
    }
    removeTrip(indice, cascade=true, count=1){ // Remove a viagem com indice informado e todas as subsequentes (se cascade = true)
        if(this.viagens.length == 1 || indice == 0 && cascade){return false} // Car precisa de pelo menos uma viagem
        let removed = [];
        let before = indice > 0 && [$.ACESSO, $.INTERVALO].includes(this.viagens[indice - 1].tipo) ? true : false;
        let after = indice < this.viagens.length - 1 && [$.RECOLHE, $.INTERVALO].includes(this.viagens[indice + 1].tipo) ? true : false;
        if(cascade){
            let count = (this.viagens.length - indice) + (before ? 1 : 0);
            if(this.viagens.length <= count){return false} // Valida se vai sobrar pelo menos uma viagem no carro
            removed = this.viagens.splice(indice - (before ? 1 : 0), this.viagens.length - 1);
        }
        else{
            if(this.viagens.length <= count + (after ? 1 : 0) + (before ? 1 : 0)){return false} // Valida se vai sobrar pelo menos uma viagem no carro
            removed = this.viagens.splice(indice - (before ? 1 : 0), count + (before ? 1 : 0) + (after ? 1 : 0));
        }
        return [removed, before, after];
    }
    switchWay(tripIndex, cascade=true){ // Altera o sentido da viagem, se cascade altera tbm das seguintes
        this.viagens[tripIndex].sentido = this.viagens[tripIndex].sentido == $.IDA ? $.VOLTA : $.IDA;
        if(cascade){
            for(let i = tripIndex + 1; i < this.viagens.length; i++){
                this.viagens[i].sentido = this.viagens[i].sentido == $.IDA ? $.VOLTA : $.IDA;
            }
        }
        return true;
    }
    viagemShut(tripIndex){ // Encerra (ou cancela encerramento) viagem informada
        if(this.viagens[tripIndex].encerrar){this.viagens[tripIndex].encerrar = false; return true;} // Para cancelar encerramnto nao existe validacao
        // Retorna false se viagem nao for produtiva e/ou se viagem posterior nao for produtiva ou acesso
        if([$.ACESSO, $.RECOLHE, $.INTERVALO].includes(this.viagens[tripIndex].tipo) || (tripIndex < this.viagens.length - 1 &&  [$.RECOLHE, $.INTERVALO].includes(this.viagens[tripIndex + 1].tipo))){return false}
        this.viagens[tripIndex].encerrar = true;
        return true;
    }
    plus(indice, cascade=true){ // Aumenta um minuto no final da viagem e no inicio e fim das viagens subsequentes (se cascade=true)
        if(!cascade && indice != this.viagens.lengthcurrent - 1 && this.viagens[indice + 1].inicio <= this.viagens[indice].fim + 1){return false;} // Se viagem posterior e diff de apenas 1 min nao realiza operacao
        this.viagens[indice].plus();
        if(!cascade || this.viagens.length - 1 == indice){return true} // Se for a ultima viagem ou cascade = false retorna true
        for(let i = indice + 1; i < this.viagens.length; i++){ // Caso tenha visgens posteriores, move viagens
            this.viagens[i].advance();
        }
        return true;
    }
    sub(indice, cascade=true){ // Subtrai um minuto no final da viagem e no inicio e final das viagens subsequentes (se cascade=true)
        let r = this.viagens[indice].sub();
        if(!cascade || !r || this.viagens.length - 1 == indice){return r;} // Se for ultima viagens ou se operacao retornou false, termina e retorna status (true false)
        for(let i = indice + 1; i < this.viagens.length; i++){ // Caso tenha visgens posteriores, volta viagens em 1 min
            this.viagens[i].back();
        }
        return true;
    }
    moveStart(indice, cascade=true){ // Aumenta um minuto no inicio da viagem
        return this.viagens[indice].moveStart();
    }
    backStart(indice, cascade=true){ // Subtrai um minuto no inicio da viagem
        if(indice == 0 && this.viagens[indice].inicio > 1 || indice > 0 && this.viagens[indice - 1].fim < this.viagens[indice].inicio - 1){return this.viagens[indice].backStart();}
        return false; // Retorna false caso fim da viagem anterior esteja com apenas 1 min de diff no inicio da atual
    }
    advance(indice){ // Aumenta um minuto no inicio e no final da viagem e em todas as subsequentes
        for(let i = indice; i < this.viagens.length; i++){
            this.viagens[i].advance();
        }
        return true;
    }
    back(indice){ // Subtrai um minuto no inicio e no final da viagem e em todas as subsequentes
        if(indice == 0 && this.viagens[indice].inicio > 1 || indice > 0 && this.viagens[indice - 1].fim < this.viagens[indice].inicio - 1){
            for(let i = indice; i < this.viagens.length; i++){
                this.viagens[i].back();
            }
            return true;
        }
        return false; // Retorna false caso fim da viagem anterior esteja com apenas 1 min de diff no inicio da atual
        
    }
    firstTrip(){ // Retorna a primeira viagem produtiva do carro
        for(let i = 0; i < this.viagens.length; i++){
            if(![$.ACESSO, $.RECOLHE, $.INTERVALO, $.RESERVADO].includes(this.viagens[i].tipo)){return this.viagens[i]}
        }
        return false;
    }
    lastTrip(){ // Retorna a ultima viagem produtiva do carro
        for(let i = this.viagens.length - 1; i >= 0; i--){
            if(![$.ACESSO, $.RECOLHE, $.INTERVALO, $.RESERVADO].includes(this.viagens[i].tipo)){return this.viagens[i]}
        }
        return false;
    }
    countViagens(){ // Retorna a quantidade de viagens do carro (viagens produtivas), ignora acessos, recolhidas e intervalos
        let count = 0;
        for(let i = 0; i < this.viagens.length; i++){
            if([$.PRODUTIVA, $.EXPRESSO, $.SEMIEXPRESSO, $.RESERVADO].includes(this.viagens[i].tipo)){count++}
        }
        return count;
    }
    getInterv(tripIndex){ // Retorna o intervalo entre a viagem informada e a proxima (se for produtiva)
        if(tripIndex == this.viagens.length - 1){return 0}
        // Se viagem atual NAO for recolhe e proxima viagem for produtiva retorna intervalo entre viagens
        if(![$.RECOLHE, $.INTERVALO].includes(this.viagens[tripIndex].tipo) && !this.viagens[tripIndex].encerrar && [$.PRODUTIVA, $.EXPRESSO, $.SEMIEXPRESSO, $.RECOLHE].includes(this.viagens[tripIndex + 1].tipo)){
            return this.viagens[tripIndex + 1].inicio - this.viagens[tripIndex].fim;
        }
        return 0;
    }
    getJourney(gaps=true){ // Retorna jornada total do carro
        let sum = this.getIntervs(true, false); // Retorna soma dos intervalos
        for(let i = 0; i < this.viagens.length;i++){
            if(this.viagens[i].tipo != $.INTERVALO){
                sum += this.viagens[i].getCycle();
            }
        }
        return sum;
    }
    getIntervs(gaps=true, intervs=true){ // Retorna total de intervalos do carro
        let sum = 0;
        for(let i = 0; i < this.viagens.length; i++){
            if(intervs && this.viagens[i].tipo == $.INTERVALO){sum += this.viagens[i].getCycle() + 2} // Soma 'viagens' do tipo INTERVALO, soma 2 para considerar os gaps antes e depois do intervalo
            else if(gaps){sum += this.getInterv(i)} // Se gaps soma os intervalos entre viagens
        }
        return sum;
    }
}

export { Car }