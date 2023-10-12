// Constantes de classificacao
const IDA = 1, VOLTA = 2;
const RESERVADO = '0', PRODUTIVA = '1', EXPRESSO = '3', SEMIEXPRESSO = '4', ACESSO = '-1', RECOLHE = '-2', INTERVALO = '2';
var ACESSO_PADRAO = 20, RECOLHE_PADRAO = 20, CICLO_BASE = 50, FREQUENCIA_BASE = 10, INTERVALO_IDA = 5, INTERVALO_VOLTA = 1, INICIO_OPERACAO = 290;
// Constantes para projeto
var UTIL = 1, SABADO = 2, DOMINGO = 3, ESPECIAL = 4;
const FINALIZADO = 2, PARCIAL = 1, INCOMPLETO = 0;
const MICROONIBUS = -1, CONVENCIONAL = 0, PADRON = 1, ARTICULADO = 2, BIARTICULADO = 3;
const PORTA_LE = 1;
var March_nextTripId = 0; // Contador para insercao de identificador unico na viagem, necessario para diferenciar viagens com parametros identicos
// ------------------------------------------------------------------------------
function defaultParam(value=50){
    let d = {};
    for(let i = 0; i < 24; i++){
        d[i] = {
            fromMin: value,
            toMin: value,
            fromInterv: INTERVALO_IDA,
            toInterv: INTERVALO_VOLTA,
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

class Locale{
    constructor(options){
        this.id = options?.id || null;
        this.name = options?.name || 'Local indefinido';
        this.checkpoint = options?.checkpoint || false;
        this.surrender = options?.surrender || true;
    }
}
class Reference{
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
        this.circular = options?.circular || false;
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
}
class Trip{
    constructor(options){
        this.start = options?.start || INICIO_OPERACAO;
        if(typeof this.start == 'string'){this.start = hour2Min(this.start)}
        this.end = options?.end || INICIO_OPERACAO + CICLO_BASE;
        if(typeof this.end == 'string'){this.end = hour2Min(this.end)} // Converte em inteiros caso instanciado start: '04:00'
        if(this.end <= this.start){this.end = this.start + CICLO_BASE} // Final tem que ser maior (pelo menos 1 min) que inicio 
        this.__id = March_nextTripId;
        this.shut = false; // Define encerramento de viagem, usado para encerrar turno onde nao ocorre a recolhida do veiculo
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
        this.prefix = options?.prefix || '';
        this.class = options?.class || CONVENCIONAL; // Tipo de tecnologia a ser usada
        this.espec = options?.espec || null; // Especificacao adicional para carro (porta lado esquerdo, etc..)
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
    __tripIsValid(trip){ // Valida de viagem pode ser inserida no carro sem gerar conflito com outras viagens
        let conflict = false;
        let i = 0;
        while(!conflict && i < this.trips.length){
            if((trip.start >= this.trips[i].start && trip.start <= this.trips[i].end) || (trip.end >= this.trips[i].start && trip.end <= this.trips[i].end)){conflict = true;}
            i++;
        }
        return !conflict;
    }
    addSchedule(options){}
    checkSchedule(start, end){ // Verifica se tabela esta disponivel para carro (se nao conflita com outras tabelas)
    }
    getEmptySchedule(){ // Retorna 1o intervalo nao alocado para carro
    }
    removeTrip(index, cascade=true, count=1){ // Remove a viagem com indice informado e todas as subsequentes (se cascade = true)
        if(this.trips.length == 1 || index == 0 && cascade){return false} // Carro precisa de pelo menos uma viagem
        let removed = [];
        if(cascade){removed = this.trips.splice(index, this.trips.length - 1);}
        else{removed = this.trips.splice(index, count);}
        return removed;
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
    countTrips(){
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
        this.version = '0.1.36';
        this.id = options?.id || 'new';
        this.name = options?.name || 'Novo Projeto';
        this.desc = options?.desc || '';
        this.route = options?.route || new Route({});
        this.cars = options?.cars || [];
        this.user = options?.user || null;
        this.status = options?.status || INCOMPLETO;
        this.dayType = options?.dayType || UTIL;
        this.transferArea = []; // Area de armazenamento de viagens
        this.sumInterGaps = options?.sumInterGaps || options?.sumInterGaps == true;
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
        this.transferArea = this.cars[fleet_index].removeTrip(trip_start_index, false, trip_end_index - trip_start_index + 1);
        return this.transferArea;
    }
    copyTransfer(fleet_index){ // Move as viagens da area de transfeencia para o carro informado
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
            let ciclo = this.route.param[faixa].fromMin + this.route.param[faixa].toMin + this.route.param[faixa].fromInterv + this.route.param[faixa].toInterv;
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
    load(project){ // Recebe json simples, monta instancias e carrega projeto
        // project = JSON.parse(project);
        let allowedFields = ['id', 'desc', 'name','user', 'status','dayType','sumInterGaps'];
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

    }
}