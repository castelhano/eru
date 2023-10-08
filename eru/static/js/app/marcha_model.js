// Constantes de classificacao
const IDA = 1, VOLTA = 2;
const RESERVADO = '0', PRODUTIVA = '1', EXPRESSO = '3', SEMIEXPRESSO = '4', ACESSO = '-1', RECOLHE = '-2', INTERVALO = '2';
var ACESSO_PADRAO = 20, RECOLHE_PADRAO = 20, CICLO_BASE = 50, FREQUENCIA_BASE = 10, INTERVALO_IDA = 5, INTERVALO_VOLTA = 1, INICIO_PADRAO = 290;
// Constantes para projeto
var UTIL = 'UTIL', SABADO = 'SABADO', DOMINGO = 'DOMINGO', ESPECIAL = 'ESPECIAL';
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
            fromMinAccess: ACESSO_PADRAO,
            toMinAccess: ACESSO_PADRAO,
            fromMinRecall: RECOLHE_PADRAO,
            toMinRecall: RECOLHE_PADRAO,
            fromKmAccess: 0,
            toKmAccess: 0,
            fromKmRecall: 0,
            toKmRecall: 0,
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
        this.from = options?.from || new Locale({}); // Ponto inicial da linha (PT1)
        this.to = options?.to || new Locale({}); // Ponto final da linha (PT2)
        this.param = options?.param || defaultParam(); // Parametros de operacao (tempo de ciclo, acesso, recolhe, km, etc..)
        this.refs = options?.refs || {from:[], to:[]}; // Armazena os pontos de referencia por sentido
    }
}

class Trip{
    constructor(options){
        this.start = options?.start || INICIO_PADRAO;
        if(typeof this.start == 'string'){this.start = hour2Min(this.start)}
        this.end = options?.end || INICIO_PADRAO + CICLO_BASE;
        if(typeof this.end == 'string'){this.end = hour2Min(this.end)} // Converte em inteiros caso instanciado start: '04:00'
        if(this.end <= this.start){this.end = this.start + CICLO_BASE} // Final tem que ser maior (pelo menos 1 min) que inicio 
        this.__id = March_nextTripId;
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
        this.start--;
        return true;
    }
    advance(){ // Aumenta um minuto no inicio e no final da viagem
        this.start++;
        this.end++;
        return true;
    }
    back(){ // Subtrai um minuto no inicio e no final da viagem
        this.start--;
        this.end--;
        return true;
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
        this.class = options?.class || '';
        this.espec = options?.espec || null;
        this.trips = options?.trips || []; // Armazena as viagens do carro
        this.schedules = options?.schedules || []; // Armazena as tabelas (escalas) para o carro
        if(this.trips.length == 0){this.addTrip(options.param, options['startAt'])} // Necessario pelo menos uma viagem no carro
    }
    addTrip(route_params=null, startAt=null){ // Adiciona viagem apos ultima viagem
        let opt = {}; // Dados da viagem
        if(this.trips.length > 0){
            let last;
            if(startAt == null){last = this.trips[this.trips.length - 1]} // Se nao informado startAt insere apos ultima viagem
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
            let faixa = min2Range(last.end);
            let intervalo = last.way == IDA ? route_params[faixa].toInterv : route_params[faixa].fromInterv;
            let ciclo = last.way == IDA ? route_params[faixa].toMin : route_params[faixa].fromMin;
            opt = {
                start: startAt || last.end + intervalo,
                end: (startAt || last.end) + intervalo + ciclo,
                way: last.way == IDA ? VOLTA : IDA,
                type: PRODUTIVA
            }
        }
        else{
            let faixa = min2Range(INICIO_PADRAO);
            opt = {
                start: startAt || INICIO_PADRAO,
                end: (startAt || INICIO_PADRAO) + route_params[faixa].fromMin,
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
        // Necessario ter viagem valida (produtiva) antes e depois do intervalo
        if(trip_index == this.trips.length - 1 || [INTERVALO, ACESSO, RECOLHE].includes(this.trips[trip_index]) || [INTERVALO, ACESSO, RECOLHE].includes(this.trips[trip_index + 1])){return false}
        let current = this.trips[trip_index];
        let next = this.trips[trip_index + 1];
        let v = new Trip({start: current.end + 1, end: next.start - 1, type: INTERVALO, way: current.way})
        this.trips.push(v);
        this.trips.sort((a, b) => a.start > b.start ? 1 : -1);
        return v;
    }
    addAccess(trip_index, params){
        // Acesso somente inserido se viagem for produtiva
        if([INTERVALO, ACESSO, RECOLHE].includes(this.trips[trip_index].type)){return false}
        let wayAccess = this.trips[trip_index].way == IDA ? 'fromMinAccess' : 'toMinAccess';
        let accessMin = params[min2Range(this.trips[trip_index].start)][wayAccess];
        let v = new Trip({start: this.trips[trip_index].start - accessMin - 1, end: this.trips[trip_index].start - 1, type: ACESSO, way: this.trips[trip_index].way})
        if(this.__tripIsValid(v)){
            this.trips.push(v);
            this.trips.sort((a, b) => a.start > b.start ? 1 : -1);
            return v;
        }
        return false;
    }
    addRecall(trip_index, params){
        // Recolhe somente inserido se viagem for produtiva
        if([INTERVALO, ACESSO, RECOLHE].includes(this.trips[trip_index].type)){return false}
        let wayRecall = this.trips[trip_index].way == IDA ? 'fromMinRecall' : 'toMinRecall';
        let recallMin = params[min2Range(this.trips[trip_index].end)][wayRecall];
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
    removeTrip(index, cascade=true){ // Remove a viagem com indice informado e todas as subsequentes (se cascade = true)
        if(this.trips.length == 1 || index == 0 && cascade){return false} // Carro precisa de pelo menos uma viagem
        let removed = [];
        if(cascade){removed = this.trips.splice(index, this.trips.length - 1);}
        else{removed = this.trips.splice(index, 1);}
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
        if(index == 0 || this.trips[index - 1].end < this.trips[index].start - 1){return this.trips[index].backStart();}
        return false; // Retorna false caso fim da viagem anterior esteja com apenas 1 min de diff no inicio da atual
    }
    advance(index){ // Aumenta um minuto no inicio e no final da viagem e em todas as subsequentes
        for(let i = index; i < this.trips.length; i++){
            this.trips[i].advance();
        }
        return true;
    }
    back(index){ // Subtrai um minuto no inicio e no final da viagem e em todas as subsequentes
        if(index == 0 || this.trips[index - 1].end < this.trips[index].start - 1){
            for(let i = index; i < this.trips.length; i++){
                this.trips[i].back();
            }
            return true;
        }
        return false; // Retorna false caso fim da viagem anterior esteja com apenas 1 min de diff no inicio da atual
        
    }
    getInterv(tripIndex){
        if(tripIndex == this.trips.length - 1){return false}
        return this.trips[tripIndex + 1].start - this.trips[tripIndex].end
    }
    getJourney(includeGaps=true){ // Retorna jornada total do carro
        let sum = this.trips[this.trips.length - 1].end - this.trips[0].start; // Inicia soma com o total geral do carro
        sum -= this.getIntervs(includeGaps); // Remove intervalos da jornada
        return sum;
    }
    getIntervs(includeGaps=true){ // Retorna total de intervalos do carro
        let sum = 0;
        for(let i = 0; i < this.trips.length; i++){
            if(this.trips[i].type == INTERVALO){sum += includeGaps ? this.trips[i].getCycle() : this.trips[i].getCycle() + 2} // Soma 'viagens' do tipo INTERVALO, soma 2 para considerar os gaps antes e depois do intervalo
            if(includeGaps){sum += this.getInterv(i)} // Se includeGaps soma os intervalos entre viagens
        }
        return sum;
    }
}

class March{
    constructor(options){
        this.id = options?.id || null;
        this.desc = options?.desc || 'Novo projeto';
        this.route = options?.route || new Route({});
        this.cars = options?.cars || [];
        this.user = options?.user || null;
        this.status = options?.status || INCOMPLETO;
        this.dayType = options?.dayType || UTIL;
        this.sumInterGaps = options?.sumInterGaps || options?.sumInterGaps == true;
    }
    addFleet(options){ // Adiciona carro no projeto ja inserindo uma viagem (sentido ida)
        if(this.cars.length > 0){options['startAt'] = this.cars[this.cars.length - 1].trips[0].start + FREQUENCIA_BASE;}
        this.cars.push(new Car(options));
        return this.cars.slice(-1)[0]; // Retorna carro inserido 
    }
    addTrip(car_index, startAt=null){
        return this.cars[car_index].addTrip(this.route.param, startAt);
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
    getJourney(car_index=null){
        if(car_index != null){ // Retorna a soma da jornada do carro informado
            return this.cars[car_index].getJourney(this.sumInterGaps);
        }
        let sum = 0;
        for(let i = 0; i < this.cars.length; i++){
            sum += this.cars[i].getJourney(this.sumInterGaps);
        }
        return sum;
    }
    getIntervs(car_index=null){
        if(car_index != null){ // Retorna a soma de intervalos do carro informado
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
                if(this.cars[i].trips[j].way == way && (this.cars[i].trips[j].start < first?.start || !first)){
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
                if(this.cars[i].trips[j].way == way && (this.cars[i].trips[j].start > last?.start || !last)){
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
    load(project){ // Recebe json simples, monta instancias e carrega projeto
        project = JSON.parse(project);
        let allowedFields = ['id', 'desc', 'user', 'status','dayType','sumIntervGaps'];
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