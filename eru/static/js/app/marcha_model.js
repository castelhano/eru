// TODO: CRUD referencias
// ------------------
// Constantes de classificacao
const IDA = 'I', VOLTA = 'V';
const PRODUTIVA = '1', EXPRESSO = '2', SEMIEXPRESSO = '3', EXTRA = '4', ACESSO = '5', RECOLHE = '6', INTERVALO = '7', RESERVADO = '9';
var ACESSO_PADRAO = 20, RECOLHE_PADRAO = 20, CICLO_BASE = 50, FREQUENCIA_BASE = 10, INTERVALO_IDA = 5, INTERVALO_VOLTA = 1, INICIO_OPERACAO = 290;
// Constantes para projeto
var UTIL = 'U', SABADO = 'S', DOMINGO = 'D', ESPECIAL = 'E', FERIAS = 'F';
const MICROONIBUS = 'MC', CONVENCIONAL = 'CV', PADRON = 'PD', ARTICULADO = 'AT', BIARTICULADO = 'BI';
const PORTA_LE = '1';
var March_nextTripId = 0; // Contador para insercao de identificador unico na viagem, necessario para diferenciar viagens com parametros identicos
var classificationLoad = { // Capacidade de carregamento de cada tecnologia
    'MC': 35,
    'CV': 80,
    'PD': 90,
    'AT': 120,
    'BI': 200
}

// ------------------------------------------------------------------------------
function defaultParam(value=50){
    let d = {};
    for(let i = 0; i < 24; i++){
        d[i] = {
            fromMin: value,
            toMin: value,
            fromInterv: INTERVALO_IDA,
            toInterv: INTERVALO_IDA,
            fromDemand: 0,
            toDemand: 0,
        };
    }
    return d;
}

function min2Hour(min, reset=true){ // Converte minutos (int) em hora (hh:mm)
    let time = min / 60;
    let h = Math.floor(time);
    let m = Math.round((time - h) * 60);
    if(reset && h >= 24){h -= 24}
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}
function min2Range(min){ // Retorna a faixa horaria
    let time = min / 60;
    if(time >= 24){time -= 24} // Reinicia faixa apos 23h59 (24h00 => 00, 25h00 => 01, etc)
    return Math.floor(time);
}

function hour2Min(hour, day=0){ // Converte string de hora (hh:mm) em minutos, recebe parametro opcional para virada de dia (0 = dia zero, 1 =  prox dia) 
    let [h,m] = hour.split(':');
    return day * 1440 + parseInt(h) * 60 + parseInt(m);
}

class Locale{ // Class para locais
    constructor(options){
        this.id = options?.id || null;
        this.name = options?.name || 'Local indefinido';
        this.garage = options?.garage || options?.garage == true;
        this.checkpoint = options?.checkpoint || options?.checkpoint == true;
        this.surrender = options?.surrender || options?.surrender == true;
    }
}
class Reference{ // Classe das referencias
    constructor(options){
        this.local = options?.local || new Locale({}); // Deve referenciar um local
        this.delta = options?.delta || 1; // Armazena o tempo em minutos em relacao a origem (from ou to)
    }
}
class Route{
    constructor(options){
        this.id = options?.id || null;
        this.prefix = options?.prefix || '0.00';
        this.name = options?.name || 'Linha indefinida';
        this.circular = options?.circular || options?.circular == true;
        this.from = options?.from || new Locale({}); // Ponto inicial da linha (PT1)
        this.to = options?.to || new Locale({}); // Ponto final da linha (PT2)
        this.fromExtension = options?.fromExtension || 0; // Extensao de ida (em km)
        this.toExtension = options?.toExtension || 0; // Extensao de volta (em km)
        this.param = options?.param || defaultParam(); // Parametros de operacao (tempo de ciclo, acesso, recolhe, km, etc..)
        this.metrics = options?.metrics || { // Metricas adicionais (tempos de acesso, recolhe e extensao de acesso e recolhe)
            fromMinAccess: ACESSO_PADRAO,
            toMinAccess: ACESSO_PADRAO,
            fromMinRecall: RECOLHE_PADRAO,
            toMinRecall: RECOLHE_PADRAO,
            fromKmAccess: 0,
            toKmAccess: 0,
            fromKmRecall: 0,
            toKmRecall: 0,
        }; 
        this.refs = options?.refs || {from:[], to:[]}; // Armazena os pontos de referencia por sentido
    }
    getBaselines(){ // Retorna json com resumo dos patamares {start: 4, end: 8, fromMin: 50, toMin: 45, ...}
        let paramKeys = ['fromMin','toMin','fromInterv','toInterv'];
        let baseline = [];
        let start = 0;
        let end = 0;
        let last_entry = {};
        for(let i in this.param){
            let entry = {};
            for(let j = 0; j < paramKeys.length;j++){entry[paramKeys[j]] = this.param[i][paramKeys[j]]} // Carrega os attrs em entry
            if(i == 0){ // Na primeira iteracao, cria a entrada do primeiro patamar
                last_entry = {...entry}
                baseline.push(Object.assign({start: 0, end: 0}, entry));
            }
            else if(JSON.stringify(last_entry) == JSON.stringify(entry)){ // Se nova entrada for igual entrada anterior, apenas aumenta end em 1
                baseline[baseline.length - 1].end += 1;
            }
            else{ // Se encontrou diferenca no patamar, fecha entry e carrega na baseline
                baseline.push(Object.assign({start: parseInt(i), end: parseInt(i)}, entry));
                last_entry = {...entry};
            }
        }
        return baseline;
   }
   getSurrenderRefs(way){
    if(way == IDA){return this.refs.from.filter((el) => el.local.surrender == true)}
    else{return this.refs.to.filter((el) => el.local.surrender == true)}
   }
}
class Trip{
    constructor(options){
        this.start = options?.start || INICIO_OPERACAO;
        if(typeof this.start == 'string'){this.start = hour2Min(this.start)}
        this.end = options?.end || INICIO_OPERACAO + CICLO_BASE;
        if(typeof this.end == 'string'){this.end = hour2Min(this.end)} // Converte em inteiros caso instanciado start: '04:00'
        if(this.end <= this.start){this.end = this.start + CICLO_BASE} // Final tem que ser maior (pelo menos 1 min) que inicio 
        this.__id = March_nextTripId;
        this.shut = options?.shut || options?.shut == true; // Define encerramento de viagem, usado para encerrar turno onde nao ocorre a recolhida do veiculo
        March_nextTripId++;

        this.way = options?.way || IDA; // Sentido da viagem (ida, volta)
        this.type = options?.type || PRODUTIVA;  // Tipo (produtiva, inprodutiva, especial, etc)
    }
    plus(){ // Aumenta um minuto no final da viagem
        this.end++;
        return true;
    }
    sub(){ // Subtrai um minuto no final da viagem
        if(this.end > this.start + 1){this.end--; return true;}
        return false;
    }
    moveStart(){ // Aumenta um minuto no inicio da viagem
        if(this.start < this.end - 1){this.start++;return true;}
        return false;
    }
    backStart(){ // Subtrai um minuto no inicio da viagem
        if(this.start > 1){ // Primeira viagem precisa iniciar as 00:01 no grid
            this.start--;
            return true;
        }
        return false;
    }
    advance(){ // Aumenta um minuto no inicio e no final da viagem
        this.start++;
        this.end++;
        return true;
    }
    back(){ // Subtrai um minuto no inicio e no final da viagem
        if(this.start > 1){ // Primeira viagem precisa iniciar as 00:01 no grid
            this.start--;
            this.end--;
            return true;
        }
        return false;
    }
    getCycle(){ // Retorna ciclo em minutos
        return this.end - this.start;
    }
    getStart(){return min2Hour(this.start)}
    getEnd(){return min2Hour(this.end)}
}

class Car{
    constructor(options){
        this.classification = options?.classification || CONVENCIONAL; // Tipo de tecnologia a ser usada
        this.specification = options?.specification || '0'; // Especificacao adicional para carro (porta lado esquerdo, etc..)
        this.trips = options?.trips || []; // Armazena as viagens do carro
        this.schedules = options?.schedules || []; // Armazena as tabelas (escalas) para o carro
        if(this.trips.length == 0){this.addTrip(options.route, options['startAt'])} // Necessario pelo menos uma viagem no carro
    }
    addTrip(route=null, startAt=null){ // Adiciona viagem apos ultima viagem
        let opt = {}; // Dados da viagem
        if(this.trips.length > 0){
            let last = null;
            if(!startAt){last = this.trips[this.trips.length - 1]} // Se nao informado startAt insere apos ultima viagem
            else{ // Se startAt busca viagem anterior
                let i = this.trips.length - 1;
                let escape = false;
                while(!escape && i >= 0){
                    if(this.trips[i].start < startAt && ![INTERVALO, ACESSO, RECOLHE].includes(this.trips[i].type)){
                        escape = true;
                        last = this.trips[i];
                    }
                    i--;
                }
            }
            let faixa;
            if(startAt){faixa = min2Range(startAt)}
            else if(last){faixa = min2Range(last.end)}
            else{faixa = 0} // Em teoria se nao definido startAt, sempre deve existir uma viagem anterior
            
            // let faixa = min2Range(last.end);
            let intervalo = last?.way == VOLTA || route.circular == true ? route.param[faixa].fromInterv : route.param[faixa].toInterv;
            let ciclo = last?.way == VOLTA || route.circular == true ? route.param[faixa].fromMin : route.param[faixa].toMin;
            opt = {
                start: startAt ? startAt : last.end + intervalo,
                end: startAt ? startAt + intervalo + ciclo : last.end + intervalo + ciclo,
                way: last?.way == VOLTA || route.circular == true ? IDA : VOLTA,
                type: PRODUTIVA
            }
        }
        else{
            let faixa = min2Range(INICIO_OPERACAO);
            opt = {
                start: startAt ? startAt : INICIO_OPERACAO,
                end: startAt ? startAt + route.param[faixa].fromMin : INICIO_OPERACAO + route.param[faixa].fromMin,
                way: IDA,
                type: PRODUTIVA
            }
        }
        let v = new Trip(opt);
        if(startAt && !this.__tripIsValid(v)){ // Se definido startAt e viagem entra em conflito com outras viagens, cancela operacao
            appNotify('warning','jsMarch: Conflito com <b>outras viagens</b>');
            return false;
        }
        this.trips.push(v);
        this.trips.sort((a, b) => a.start > b.start ? 1 : -1);
        return v;
    }
    addInterv(trip_index){ // Adiciona viagem do tipo intervalo entre duas viagens
        // Necessario ter viagem valida (produtiva) antes e depois do intervalo, e mais de um minuto entre as viagens
        if(trip_index == this.trips.length - 1 || [INTERVALO, RECOLHE].includes(this.trips[trip_index].type) || [INTERVALO, ACESSO].includes(this.trips[trip_index + 1].type) || this.trips[trip_index + 1].start <= this.trips[trip_index].end + 1){return false}
        let current = this.trips[trip_index];
        let next = this.trips[trip_index + 1];
        let v = new Trip({start: current.end + 1, end: next.start - 1, type: INTERVALO, way: current.way})
        this.trips.push(v);
        this.trips.sort((a, b) => a.start > b.start ? 1 : -1);
        return v;
    }
    addAccess(trip_index, metrics){
        // Acesso somente inserido se viagem for produtiva
        if([INTERVALO, ACESSO, RECOLHE].includes(this.trips[trip_index].type)){return false}
        let wayAccess = this.trips[trip_index].way == IDA ? 'fromMinAccess' : 'toMinAccess';
        let accessMin = metrics[wayAccess];
        let v = new Trip({start: this.trips[trip_index].start - accessMin - 1, end: this.trips[trip_index].start - 1, type: ACESSO, way: this.trips[trip_index].way})
        if(this.__tripIsValid(v)){
            this.trips.push(v);
            this.trips.sort((a, b) => a.start > b.start ? 1 : -1);
            return v;
        }
        return false;
    }
    addRecall(trip_index, metrics){
        // Recolhe somente inserido se viagem for produtiva ou tiver sido encerrada
        if([INTERVALO, ACESSO, RECOLHE].includes(this.trips[trip_index].type) || this.trips[trip_index].shut){return false}
        let wayRecall = this.trips[trip_index].way == IDA ? 'fromMinRecall' : 'toMinRecall';
        let recallMin = metrics[wayRecall];
        let v = new Trip({start: this.trips[trip_index].end + 1, end: this.trips[trip_index].end + recallMin + 1, type: RECOLHE, way: this.trips[trip_index].way})
        if(this.__tripIsValid(v)){
            this.trips.push(v);
            this.trips.sort((a, b) => a.start > b.start ? 1 : -1);
            return v;
        }
        return false;
    }
    __tripIsValid(trip){ // Valida se viagem pode ser inserida no carro sem gerar conflito com outras viagens
        let conflict = false;
        let i = 0;
        while(!conflict && i < this.trips.length){
            if((trip.start >= this.trips[i].start && trip.start <= this.trips[i].end) || (trip.end >= this.trips[i].start && trip.end <= this.trips[i].end)){conflict = true;}
            i++;
        }
        return !conflict;
    }
    addSchedule(options){ // Cria nova escala
        options.deltaStart = 0;
        if(this.schedules.length == 0){
            this.schedules.push(options)
            this.schedules.sort((a, b) => a.start > b.start ? 1 : -1); // Reordena escalas pelo start
        }
        else{
            this.schedules.push(options)
            this.schedules.sort((a, b) => a.start > b.start ? 1 : -1); // Reordena escalas pelo start
            let index = this.schedules.indexOf(options);
            if(index > 0 && (![RECOLHE, INTERVALO].includes(this.trips[this.schedules[index].end].type) || !this.trips[this.schedules[index].end].shut)){
                this.schedules[index].deltaStart = this.schedules[index - 1].deltaEnd;
            }
        }
        return this.schedules.indexOf(options);
    }
    updateSchedule(schedule_index, options, blockStartIndex, blockEndIndex){
        // Aborta operacao caso o novo fim informado seja menor que o inicio da escala, ou se o novo fim ser igual ao atual fim
        if(this.schedules[schedule_index].start > options.end || (this.schedules[schedule_index].end == options.end && this.schedules[schedule_index].deltaStart == options.deltaStart && this.schedules[schedule_index].deltaEnd == options.deltaEnd)){return false}
        for(let key in options){
            this.schedules[schedule_index][key] = options[key]; // Atualiza os valores da schedule
        }
        // Se existir schedule depois da editada, verifica se ser necessario ajustar posteriores
        if(this.schedules.length > schedule_index + 1 && options.end != undefined && this.schedules[schedule_index + 1].start <= blockEndIndex){
            if(this.schedules[schedule_index].end == this.schedules[schedule_index + 1].end){ // Novo final ocupa todo espaco da proxima escala, apaga a proxima
                this.schedules.splice(schedule_index + 1, 1)
            }
            else if(this.schedules[schedule_index].end > this.schedules[schedule_index + 1].end){ // Se novo final ocupe mais que o final da proxima viagem, apaga toda as demais
                this.schedules.splice(schedule_index + 1, this.schedules.length - 1 - schedule_index)
            }
            else{
                if(!this.trips[this.schedules[schedule_index].end].type == RECOLHE || !this.trips[this.schedules[schedule_index].shut]){
                    this.schedules[schedule_index + 1].start = Math.max(blockStartIndex, this.schedules[schedule_index].end + 1);
                    this.schedules[schedule_index + 1].deltaStart = this.schedules[schedule_index].deltaEnd;
                }
            }
        }
        return true;
    }
    deleteSchedule(schedule_index){
        this.schedules.splice(schedule_index, 1);
        return true;
    }
    getFleetSchedulesBlock(route){ // Retorna array com blocos de viagens, cada bloco terminando com RECOLHE ou trip.shut
        let blocks = [];
        let block = {start: this.trips[0].start, startIndex: 0, endIndex: 0, size:0, spots: []};
        let fromRefs = route.getSurrenderRefs(IDA);
        let toRefs = route.getSurrenderRefs(VOLTA);
        for(let i = 0; i < this.trips.length; i++){
            // Adiciona spot de referencia do bloco
            if(this.trips[i].way == IDA && [PRODUTIVA, EXPRESSO, SEMIEXPRESSO].includes(this.trips[i].type)){
                for(let j = 0; j < fromRefs.length; j++){
                    let time = this.trips[i].start + fromRefs[j].delta;
                    block.spots.push({locale: fromRefs[j].local, time: time, type: 'reference', tripIndex: i, way: IDA, delta: fromRefs[j].delta})
                }
            }
            else if(this.trips[i].way == VOLTA && [PRODUTIVA, EXPRESSO, SEMIEXPRESSO].includes(this.trips[i].type)){
                for(let j = 0; j < toRefs.length; j++){
                    let time = this.trips[i].start + toRefs[j].delta;
                    block.spots.push({locale: toRefs[j].local, time: time, type: 'reference', tripIndex: i, way: VOLTA, delta: toRefs[j].delta})
                }
            }
            // Adiciona spots de viagem do bloco
            if(![ACESSO, INTERVALO].includes(this.trips[i].type)){
                let time = this.trips[i].end + (this.trips[i].shut ? 0 : this.getInterv(i));
                if(this.trips[i].way == IDA && route.to.surrender){block.spots.push({locale: route.to, time: time, type: 'tripEnd', tripIndex: i, way: this.trips[i].way, delta: 0})}
                else if(this.trips[i].way == VOLTA && route.from.surrender){block.spots.push({locale: route.from, time: time, type: 'tripEnd', tripIndex: i})}
            }
            // Ajusta bloco inicio, fim e dimensao
            if(this.trips[i].shut || this.trips[i].type == RECOLHE || this.trips.length - 1 == i){
                block.endIndex = i;
                block.size += this.trips[i].getCycle();
                blocks.push(Object.assign({}, this.__blockAddEmpty(block)));
                if(this.trips.length - 1 > i){
                    block.start = this.trips[i + 1].start;
                    block.startIndex = i + 1;
                    block.spots = [];
                    delete block.emptyStart;
                    delete block.emptyEnd;
                }
                block.size = 0;
            }
            else{block.size += this.trips[i].getCycle() + this.getInterv(i)}
        }
        return blocks;
    }
    __blockAddEmpty(block){
        let lastScheduleIndex = -1;
        let lastDeltaStart = 0;
        let lastDeltaEnd = 0;
        for(let i = 0; i < this.schedules.length; i++){
            if(this.schedules[i].start >= block.startIndex && this.schedules[i].end <= block.endIndex){
                lastScheduleIndex = this.schedules[i].end
                lastDeltaStart = this.schedules[i].deltaStart
                lastDeltaEnd = this.schedules[i].deltaEnd
            }
        }
        if(lastScheduleIndex == -1){block.emptyStart = block.startIndex;block.deltaStart = 0;block.deltaEnd = 0;}
        else if(lastScheduleIndex < block.endIndex){
            block.emptyStart = lastScheduleIndex + 1;
            block.deltaStart = lastDeltaStart;
            block.deltaEnd = lastDeltaEnd;
        }
        return block;
    }
    cleanSchedule(index=null){ // Limpa escala, se nao informado indice limpa todas as escalas
    }
    getScheduleJourney(schedule_index, allMetrics=false){
        let start = this.trips[this.schedules[schedule_index].start].start;
        let end = this.trips[this.schedules[schedule_index].end].end;
        if(this.schedules[schedule_index].deltaStart > 0){
            start = this.trips[this.schedules[schedule_index - 1].end].start + this.schedules[schedule_index].deltaStart;
        }
        if(this.schedules[schedule_index].deltaEnd > 0){
            end = this.trips[this.schedules[schedule_index].end].start + this.schedules[schedule_index].deltaEnd;
        }
        else{
            end += this.getInterv(this.schedules[schedule_index].end);
        }
        return allMetrics ? [end - start, start, end] : end - start;
    }
    removeTrip(index, cascade=true, count=1){ // Remove a viagem com indice informado e todas as subsequentes (se cascade = true)
        if(this.trips.length == 1 || index == 0 && cascade){return false} // Carro precisa de pelo menos uma viagem
        let removed = [];
        let before = index > 0 && [ACESSO, INTERVALO].includes(this.trips[index - 1].type) ? true : false;
        let after = index < this.trips.length - 1 && [RECOLHE, INTERVALO].includes(this.trips[index + 1].type) ? true : false;
        if(cascade){
            let count = (this.trips.length - index) + (before ? 1 : 0);
            if(this.trips.length <= count){return false} // Valida se vai sobrar pelo menos uma viagem no carro
            removed = this.trips.splice(index - (before ? 1 : 0), this.trips.length - 1);
        }
        else{
            if(this.trips.length <= count + (after ? 1 : 0) + (before ? 1 : 0)){return false} // Valida se vai sobrar pelo menos uma viagem no carro
            removed = this.trips.splice(index - (before ? 1 : 0), count + (before ? 1 : 0) + (after ? 1 : 0));
        }
        return [removed, before, after];
    }
    switchWay(trip_index, cascade=true){ // Altera o sentido da viagem, se cascade altera tbm das seguintes
        this.trips[trip_index].way = this.trips[trip_index].way == IDA ? VOLTA : IDA;
        if(cascade){
            for(let i = trip_index + 1; i < this.trips.length; i++){
                this.trips[i].way = this.trips[i].way == IDA ? VOLTA : IDA;
            }
        }
        return true;
    }
    tripShut(trip_index){ // Encerra (ou cancela encerramento) viagem informada
        if(this.trips[trip_index].shut){this.trips[trip_index].shut = false; return true;} // Para cancelar encerramnto nao existe validacao
        // Retorna false se viagem nao for produtiva e/ou se viagem posterior nao for produtiva ou acesso
        if([ACESSO, RECOLHE, INTERVALO].includes(this.trips[trip_index].type) || (trip_index < this.trips.length - 1 &&  [RECOLHE, INTERVALO].includes(this.trips[trip_index + 1].type))){return false}
        this.trips[trip_index].shut = true;
        return true;
    }
    plus(index, cascade=true){ // Aumenta um minuto no final da viagem e no inicio e fim das viagens subsequentes (se cascade=true)
        if(!cascade && index != this.trips.lengthcurrent - 1 && this.trips[index + 1].start <= this.trips[index].end + 1){return false;} // Se viagem posterior e diff de apenas 1 min nao realiza operacao
        this.trips[index].plus();
        if(!cascade || this.trips.length - 1 == index){return true} // Se for a ultima viagem ou cascade = false retorna true
        for(let i = index + 1; i < this.trips.length; i++){ // Caso tenha visgens posteriores, move viagens
            this.trips[i].advance();
        }
        return true;
    }
    sub(index, cascade=true){ // Subtrai um minuto no final da viagem e no inicio e final das viagens subsequentes (se cascade=true)
        let r = this.trips[index].sub();
        if(!cascade || !r || this.trips.length - 1 == index){return r;} // Se for ultima viagens ou se operacao retornou false, termina e retorna status (true false)
        for(let i = index + 1; i < this.trips.length; i++){ // Caso tenha visgens posteriores, volta viagens em 1 min
            this.trips[i].back();
        }
        return true;
    }
    moveStart(index, cascade=true){ // Aumenta um minuto no inicio da viagem
        return this.trips[index].moveStart();
    }
    backStart(index, cascade=true){ // Subtrai um minuto no inicio da viagem
        if(index == 0 && this.trips[index].start > 1 || index > 0 && this.trips[index - 1].end < this.trips[index].start - 1){return this.trips[index].backStart();}
        return false; // Retorna false caso fim da viagem anterior esteja com apenas 1 min de diff no inicio da atual
    }
    advance(index){ // Aumenta um minuto no inicio e no final da viagem e em todas as subsequentes
        for(let i = index; i < this.trips.length; i++){
            this.trips[i].advance();
        }
        return true;
    }
    back(index){ // Subtrai um minuto no inicio e no final da viagem e em todas as subsequentes
        if(index == 0 && this.trips[index].start > 1 || index > 0 && this.trips[index - 1].end < this.trips[index].start - 1){
            for(let i = index; i < this.trips.length; i++){
                this.trips[i].back();
            }
            return true;
        }
        return false; // Retorna false caso fim da viagem anterior esteja com apenas 1 min de diff no inicio da atual
        
    }
    firstTrip(){ // Retorna a primeira viagem produtiva do carro
        for(let i = 0; i < this.trips.length; i++){
            if(![ACESSO, RECOLHE, INTERVALO, RESERVADO].includes(this.trips[i].type)){return this.trips[i]}
        }
        return false;
    }
    lastTrip(){ // Retorna a ultima viagem produtiva do carro
        for(let i = this.trips.length - 1; i >= 0; i--){
            if(![ACESSO, RECOLHE, INTERVALO, RESERVADO].includes(this.trips[i].type)){return this.trips[i]}
        }
        return false;
    }
    countTrips(){ // Retorna a quantidade de viagens do carro (viagens produtivas), ignora acessos, recolhidas e intervalos
        let count = 0;
        for(let i = 0; i < this.trips.length; i++){
            if([PRODUTIVA, EXPRESSO, SEMIEXPRESSO, RESERVADO].includes(this.trips[i].type)){count++}
        }
        return count;
    }
    getInterv(tripIndex){ // Retorna o intervalo entre a viagem informada e a proxima (se for produtiva)
        if(tripIndex == this.trips.length - 1){return 0}
        // Se viagem atual NAO for recolhe e proxima viagem for produtiva retorna intervalo entre viagens
        if(![RECOLHE,INTERVALO].includes(this.trips[tripIndex].type) && !this.trips[tripIndex].shut && [PRODUTIVA, EXPRESSO, SEMIEXPRESSO, RECOLHE].includes(this.trips[tripIndex + 1].type)){
            return this.trips[tripIndex + 1].start - this.trips[tripIndex].end;
        }
        return 0;
    }
    getJourney(gaps=true){ // Retorna jornada total do carro
        let sum = this.getIntervs(true, false); // Retorna soma dos intervalos
        for(let i = 0; i < this.trips.length;i++){
            if(this.trips[i].type != INTERVALO){
                sum += this.trips[i].getCycle();
            }
        }
        return sum;
    }
    getIntervs(gaps=true, intervs=true){ // Retorna total de intervalos do carro
        let sum = 0;
        for(let i = 0; i < this.trips.length; i++){
            if(intervs && this.trips[i].type == INTERVALO){sum += this.trips[i].getCycle() + 2} // Soma 'viagens' do tipo INTERVALO, soma 2 para considerar os gaps antes e depois do intervalo
            else if(gaps){sum += this.getInterv(i)} // Se gaps soma os intervalos entre viagens
        }
        return sum;
    }
}

class March{
    constructor(options){
        this.version = '1.1.322';
        this.id = options?.id || 'new';
        this.name = options?.name || 'Novo Projeto';
        this.desc = options?.desc || '';
        this.route = options?.route || new Route({});
        this.cars = options?.cars || [];
        this.viewStage = options?.viewStage || 1; // View 1: Diagrama de Marcha, 2: Editor de Escalas, 3: Resumo e definicoes
        this.dayType = options?.dayType || UTIL;
        this.workHours = options?.workHours || 420; // Jornada de trabalho normal 07:00 = 420 | 07:20 = 440
        this.active = options?.active || options?.active == true;
        this.transferArea = options?.transferArea || []; // Area de armazenamento de viagens
        this.sumInterGaps = options?.sumInterGaps || options?.sumInterGaps == true;
        this.save = options?.save != undefined ? options.save : function(){console.log('jsMarch: Nenhuma funcao definida para save, nas opcoes marque {save: suaFuncao}')}; // Funcao de salvamento do projeto
    }
    addFleet(options){ // Adiciona carro no projeto ja inserindo uma viagem (sentido ida)
        if(this.cars.length > 0){
            options['startAt'] = this.cars[this.cars.length - 1].firstTrip().start + (options?.freq || FREQUENCIA_BASE);
        }
        this.cars.push(new Car(options));
        return this.cars.slice(-1)[0]; // Retorna carro inserido 
    }
    addTrip(car_index, startAt=null){
        return this.cars[car_index].addTrip(this.route, startAt);
    }
    removeFleet(fleet_index){
        return this.cars.splice(fleet_index, 1);
    }
    addSchedule(fleet_index, options){
        options.name = this.scheduleBaptize(fleet_index, this.cars[fleet_index].schedules.length);
        let r = this.cars[fleet_index].addSchedule(options)
        return r;
    }
    nextTrip(trip){ // Retorna proxima viagem (no mesmo sentido) indiferente de carro, alem do index do referido carro e viagem
        let bestMatch = null;
        let carIndex = null;
        for(let i = 0; i < this.cars.length; i++){
            let curTrips = this.cars[i].trips.filter((el) => el != trip && el.way == trip.way);
            for(let j = 0; j < curTrips.length; j++){
                if(!bestMatch && ![INTERVALO, ACESSO, RECOLHE, RESERVADO].includes(curTrips[j].type) && curTrips[j].start >= trip.start || ![INTERVALO, ACESSO, RECOLHE, RESERVADO].includes(curTrips[j].type) && curTrips[j].start < bestMatch?.start && curTrips[j].start >= trip.start){
                    bestMatch = curTrips[j];
                    carIndex = i;
                }
            }            
        }
        return bestMatch ? [carIndex, this.cars[carIndex].trips.indexOf(bestMatch), bestMatch] : false;
    }
    previousTrip(trip){ // Retorna viagem anterior (no mesmo sentido) indiferente de carro, alem do index do referido carro e viagem
        let bestMatch = null;
        let carIndex = null;
        for(let i = 0; i < this.cars.length; i++){
            let curTrips = this.cars[i].trips.filter((el) => el != trip && el.way == trip.way);
            for(let j = 0; j < curTrips.length; j++){
                if(!bestMatch && ![INTERVALO, ACESSO, RECOLHE, RESERVADO].includes(curTrips[j].type) && curTrips[j].start <= trip.start || ![INTERVALO, ACESSO, RECOLHE, RESERVADO].includes(curTrips[j].type) && curTrips[j].start > bestMatch?.start && curTrips[j].start <= trip.start){
                    bestMatch = curTrips[j];
                    carIndex = i;
                }
            }            
        }
        return bestMatch ? [carIndex, this.cars[carIndex].trips.indexOf(bestMatch), bestMatch] : false;
    }
    getHeadway(trip){ // Retorna minutos entre a viagem atual e anterior (mesmo sentido)
        let t = this.previousTrip(trip);
        return t ? trip.start - t[2].start : false;
    }
    getJourney(car_index=null){ // Retorna a soma da jornada do carro informado
        if(car_index != null){
            return this.cars[car_index].getJourney(this.sumInterGaps);
        }
        let sum = 0;
        for(let i = 0; i < this.cars.length; i++){
            sum += this.cars[i].getJourney(this.sumInterGaps);
        }
        return sum;
    }
    autoGenerateSchedules(){
        for(let i = 0; i < this.cars.length; i++){
            let blocks = this.cars[i].getFleetSchedulesBlock(this.route);
            this.cars[i].schedules = []; // Limpa as escalas do carro
            for(let j = 0; j < blocks.length; j++){
                this.cars[i].schedules.push({start: blocks[j].startIndex, end: blocks[j].endIndex, name: this.scheduleBaptize(i, j), deltaStart: 0, deltaEnd: 0, previous: null, next: null})
            }
        }
        return true;
    }
    scheduleBaptize(fleet_index, new_seq){ // Define nome automatico para tabela
        let seq = ['A', 'B', 'C', 'D', 'E', 'F'];
        return `${String(fleet_index + 1).padStart(2,'0')}${seq[new_seq]}`;
    }
    deleteSchedule(fleet_index, schedule_index){
        let chain = [];
        if(this.cars[fleet_index].schedules[schedule_index].next && !this.cars[fleet_index].schedules[schedule_index].next.externalProject){
            chain.push(this.cars[fleet_index].schedules[schedule_index].next.fleet);
            this.cars[this.cars[fleet_index].schedules[schedule_index].next.fleet].schedules[this.cars[fleet_index].schedules[schedule_index].next.schedule].previous = null;
        }
        if(this.cars[fleet_index].schedules[schedule_index].previous && !this.cars[fleet_index].schedules[schedule_index].previous.externalProject){
            chain.push(this.cars[fleet_index].schedules[schedule_index].previous.fleet);
            this.cars[this.cars[fleet_index].schedules[schedule_index].previous.fleet].schedules[this.cars[fleet_index].schedules[schedule_index].previous.schedule].next = null;
        }
        this.cars[fleet_index].deleteSchedule(schedule_index);
        return chain;
    }
    getIntervs(car_index=null){ // Retorna a soma de intervalos do carro informado
        if(car_index != null){
            return this.cars[car_index].getIntervs(this.sumInterGaps);
        }
        let sum = 0;
        for(let i = 0; i < this.cars.length; i++){
            sum += this.cars[i].getIntervs(this.sumInterGaps);
        }
        return sum;
    }
    getFirstTrip(way=IDA){ // Retorna primeia viagem no sentido informado
        if(this.cars.length == 0){return false}
        let first, fleet_index, trip_index;
        for(let i = 0; i < this.cars.length;i++){
            for(let j = 0; j < this.cars[i].trips.length; j++){
                if(![ACESSO, RECOLHE, INTERVALO].includes(this.cars[i].trips[j].type) && this.cars[i].trips[j].way == way && (this.cars[i].trips[j].start < first?.start || !first)){
                    first = this.cars[i].trips[j];
                    fleet_index = i;
                    trip_index = j;
                }
            }
        }
        return [first, fleet_index, trip_index];
    }
    getLastTrip(way=VOLTA){ // Retorna ultima viagem no sentido informado
        if(this.cars.length == 0){return false}
        let last, fleet_index, trip_index;
        for(let i = 0; i < this.cars.length;i++){
            for(let j = 0; j < this.cars[i].trips.length; j++){
                if(![ACESSO, RECOLHE, INTERVALO].includes(this.cars[i].trips[j].type) && this.cars[i].trips[j].way == way && (this.cars[i].trips[j].start > last?.start || !last)){
                    last = this.cars[i].trips[j];
                    fleet_index = i;
                    trip_index = j;
                }
            }
        }
        return [last, fleet_index, trip_index];
    }
    moveTrips(fleetOriginIndex, fleetDestinyIndex, startTripIndex, endTripIndex){ // Movimenta viagens de um carro para outro
        if(this.cars[fleetOriginIndex].trips.length <= endTripIndex - startTripIndex + 1){return false}
        let conflict = false;
        let i = startTripIndex;
        while(!conflict && i <= endTripIndex){ // Verifica de todas as viagens podem ser movimentadas
            if(!this.cars[fleetDestinyIndex].__tripIsValid(this.cars[fleetOriginIndex].trips[i])){
                conflict = true;
            }
            i++;
        }
        if(conflict){return false}
        // Se nenhum conflito encontrado, remove as viagens do carro de origem e move para o destino
        this.cars[fleetDestinyIndex].trips = this.cars[fleetDestinyIndex].trips.concat(this.cars[fleetOriginIndex].trips.splice(startTripIndex, endTripIndex - startTripIndex + 1));
        this.cars[fleetDestinyIndex].trips.sort((a, b) => a.start > b.start ? 1 : -1); // Reordena viagens pelo inicio
        return true;
    }
    addToTransferArea(fleet_index, trip_start_index, trip_end_index){ // Adiciona viagem's a area de transferencia
        if(this.transferArea.length > 0 || trip_end_index - trip_start_index + 1 == this.cars[fleet_index].trips.length){return false} // Area de transferencia armazena apenas um grupo de linhas de cada vez
        this.transferArea = this.cars[fleet_index].removeTrip(trip_start_index, false, trip_end_index - trip_start_index + 1)[0];
        return this.transferArea;
    }
    pasteTransfer(fleet_index){ // Move as viagens da area de transfeencia para o carro informado
        for(let i = 0; i < this.transferArea.length; i++){ // Valida todas as viagens se nao gera conflito com a carro de destino
            if(!this.cars[fleet_index].__tripIsValid(this.transferArea[i])){return false}
        }    
        for(let i = 0; i < this.transferArea.length; i++){ // Adiciona as viagens no carro alvo
            this.cars[fleet_index].trips.push(this.transferArea[i]);
        }
        this.cars[fleet_index].trips.sort((a, b) => a.start > b.start ? 1 : -1); // Reordena viagens pelo inicio
        this.transferArea = []; // Limpa area de trasnferencia
        return true;
    }
    generate(metrics){ // Gera planejamento baseado nas metricas definidas
        return new Promise(resolve => {
            this.cars = []; // Limpa planejamento atual
            let faixa = min2Range(metrics.start);
            let ciclo;
            if(this.route.circular){ciclo = this.route.param[faixa].fromMin + this.route.param[faixa].fromInterv}
            else{ciclo = this.route.param[faixa].fromMin + this.route.param[faixa].toMin + this.route.param[faixa].fromInterv + this.route.param[faixa].toInterv}
            let freq = Math.ceil(ciclo / metrics.fleet);
            INICIO_OPERACAO = metrics.start; // Ajusta inicio de operacao para hora informada
            for(let i = 0; i < metrics.fleet; i++){
                let c = this.addFleet({route: this.route, freq: freq});
                let j = 0;
                while(c.trips[j].start < metrics.end){
                    c.addTrip(this.route);
                    j++;
                }
            }
            if(metrics?.addAccess){
                for(let i = 0; i < metrics.fleet; i++){ // Adiciona acesso para todos os carros
                    this.cars[i].addAccess(0, this.route.metrics);
                }
            }
            resolve(true);
        })
    }
    load(project){ // Recebe dicionario, monta instancias e carrega projeto
        let allowedFields = ['version','id', 'name', 'desc','user', 'status','dayType','active','viewStage','workHours','sumInterGaps'];
        for(let i = 0; i < allowedFields.length; i++){ // Carrega os dados base do projeto
            this[allowedFields[i]] = project[allowedFields[i]];
        }
        
        // ----------
        project.route.from = new Locale(project.route.from); // Cria instancia Locale para from
        project.route.to = new Locale(project.route.to); // Cria instancia Locale para from
        let fromRefs = [], toRefs = [];
        for(let i = 0; i < project.route.refs.from.length;i++){ // Cria instancias para referencias de ida
            project.route.refs.from[i].local = new Locale(project.route.refs.from[i].local); // Cria instancia de Locale
            fromRefs.push(new Reference(project.route.refs.from[i]))
        }
        for(let i = 0; i < project.route.refs.to.length;i++){ // Cria instancias para referencias de volta
            project.route.refs.to[i].local = new Locale(project.route.refs.to[i].local); // Cria instancia de Locale
            toRefs.push(new Reference(project.route.refs.to[i]))
        }
        project.route.refs.from = fromRefs;
        project.route.refs.to = toRefs;
        // ----------
        this.route = new Route(project.route); // Cria instancia da linha
        this.cars = [];
        for(let i = 0; i < project.cars.length;i++){ // Cria instancias para todos os carros do projeto
            let trips = [];
            for(let j = 0; j < project.cars[i].trips.length;j++){ // Cria instancias para todas as viagens
                trips.push(new Trip(project.cars[i].trips[j]))
            }
            project.cars[i].trips = trips; // Substitui o cars.trips (array simples) pelo trips (array de instancias Trip)
            this.cars.push(new Car(project.cars[i]));
        }
        this.transferArea = [];
        for(let i = 0; i < project.transferArea.length;i++){ // Cria instancias para viagens na area de transferencia
            this.transferArea.push(new Trip(project.transferArea[i]))
        }
    }
    reset(){ // Limpa planejamento e escalas
        this.cars = [];
        this.viewStage = 1;
        this.transferArea = [];
        return true;
    }
    countTrips(){ // Retorna a quantidade de viagens geral do projeto ou do carro se informado fleet_index
        let counter = {from: 0, to: 0, express: 0, semiexpress: 0, lazyFrom: 0, lazyTo: 0, accessFrom: 0, accessTo: 0, recallFrom: 0, recallTo: 0};
        for(let i = 0; i < this.cars.length; i++){
            for(let j = 0; j < this.cars[i].trips.length; j++){
                if(this.cars[i].trips[j].type == INTERVALO){continue}
                else if(this.cars[i].trips[j].type == ACESSO){if(this.cars[i].trips[j].way == IDA){counter.accessFrom ++}else{counter.accessTo ++}}
                else if(this.cars[i].trips[j].type == RECOLHE){if(this.cars[i].trips[j].way == IDA){counter.recallFrom ++}else{counter.recallTo ++}}
                else if(this.cars[i].trips[j].type == RESERVADO){if(this.cars[i].trips[j].way == IDA){counter.lazyFrom ++}else{counter.lazyTo ++}}
                else{
                    if(this.cars[i].trips[j].type == EXPRESSO){counter.express ++;}
                    else if(this.cars[i].trips[j].type == SEMIEXPRESSO){counter.semiexpress ++;}
                    // ---
                    if(this.cars[i].trips[j].way == IDA){counter.from ++;}
                    else if(this.cars[i].trips[j].way == VOLTA){counter.to ++;}
                }
            }
        }
        return counter;
    }
    countOperatores(){
        let full = 0, half = 0, horas_normais = 0, horas_extras = 0, escalas = [];
        for(let i = 0; i < this.cars.length; i++){
            for(let j = 0; j < this.cars[i].schedules.length; j++){
                if(this.cars[i].schedules[j].previous && !this.cars[i].schedules[j].previous.externalProject){continue}
                if(!this.cars[i].schedules[j].previous){full++} // Se escala nao tiver apontamento anterior, conta motorista
                else{half++;}
                let c = 0, p = 0, n = 0, nt = 0, ot = 0, chain = this.cars[i].schedules[j].next; // Current sched, previous e next, normal_time e overtime, chain marca proxima schedule encadeada
                c = this.cars[i].getScheduleJourney(j);
                while(chain){ // Corre escalas procurando proximo elo
                    n += this.cars[i].schedules[j].next.externalProject ? hour2Min(chain.journey) : this.cars[chain.fleet].getScheduleJourney(chain.schedule);
                    chain = this.cars[i].schedules[j].next.externalProject ? false : this.cars[chain.fleet].schedules[chain.schedule].next;
                }
                if(this.cars[i].schedules[j].previous && this.cars[i].schedules[j].previous.externalProject){p = this.cars[i].schedules[j].previous.journey}
                nt = Math.min(c + p + n, this.workHours);
                ot = (c + p + n) - nt;
                escalas.push({name: this.cars[i].schedules[j].name, normalTime: nt, overtime: ot})
                horas_normais += nt;
                horas_extras += ot;
            }
        }
        return {workers: full, half: half, normalTime: horas_normais, overtime: horas_extras, schedules: escalas};
    }
    supplyNDemand(){ // Retorna dicionario com dados de oferta e demanda por faixa horario (demanda deve ser fornecida)
        let od = {}
        for(let i = 0; i < 24; i++){
            od[i] = {fromTrips: 0, fromDemand: this.route.param[i].fromDemand, fromSuply: 0, toTrips: 0, toDemand: this.route.param[i].toDemand, toSuply: 0}
        }
        for(let i = 0; i < this.cars.length; i++){
            for(let j = 0; j < this.cars[i].trips.length; j++){
                let faixa = min2Range(this.cars[i].trips[j].start);
                if(![ACESSO, RECOLHE, INTERVALO, RESERVADO].includes(this.cars[i].trips[j].type)){ // Se for viagem produtiva
                    if(this.cars[i].trips[j].way == IDA){
                        od[faixa].fromTrips++; // Incrementa contador de viagens da faixa/sentido
                        od[faixa].fromSuply += classificationLoad[this.cars[i].classification]; // Incrementa contator de oferta para faixa/sentido
                    }
                    else if(this.cars[i].trips[j].way == VOLTA){
                        od[faixa].toTrips++; // Incrementa contador de viagens da faixa/sentido
                        od[faixa].toSuply += classificationLoad[this.cars[i].classification]; // Incrementa contator de oferta para faixa/sentido
                    }
                }
            }
        }
        let fromSuply=[], fromDemand=[], toSuply=[], toDemand=[];
        for(let i in od){
            fromSuply.push(od[i].fromSuply);
            fromDemand.push(od[i].fromDemand);
            toSuply.push(od[i].toSuply);
            toDemand.push(od[i].toDemand);
        }

        return [od, {fromSuply:fromSuply, fromDemand:fromDemand, toSuply:toSuply, toDemand:toDemand}];
    }
    exportJson(){
        let data = JSON.stringify(this);
        let dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(data);
        let filename = `${this.name}.json`;
        let btn = document.createElement('a');
        btn.classList = 'd-none';
        btn.setAttribute('href', dataUri);
        btn.setAttribute('download', filename);
        btn.click();
        btn.remove();
    }
}