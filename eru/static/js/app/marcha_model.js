// Constantes de classificacao
const IDA = 1, VOLTA = 2;
const PRODUTIVA = 1, RESERVADO = 0, EXPRESSO = 3, SEMIEXPRESSO = 4, ACESSO = -1, RECOLHE = -2, REFEICAO = 2;
const ACESSO_PADRAO = 20, RECOLHE_PADRAO = 20, CICLO_BASE = 50, FREQUENCIA_BASE = 10, INTERVALO_IDA = 5, INTERVALO_VOLTA = 1, INICIO_PADRAO = 290;
// Constantes para projeto
const UTIL = 'UTIL', SABADO = 'SABADO', DOMINGO = 'DOMINGO', ESPECIAL = 'ESPECIAL';
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
            fromMinAccess: 0,
            toMinAccess: 0,
            fromMinRecall: 0,
            toMinRecall: 0,
            fromKmAccess: 0,
            toKmAccess: 0,
            fromKmRecall: 0,
            toKmRecall: 0,
        };
    }
    return d;
}

function min2Hour(min){ // Converte minutos (int) em hora (hh:mm)
    let time = min / 60;
    let h = Math.floor(time);
    let m = Math.round((time - h) * 60);
    if(h >= 24){h -= 24}
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
            let last = this.trips[this.trips.length - 1];
            let faixa = min2Range(last.end);
            let intervalo = last.way == IDA ? route_params[faixa].toInterv : route_params[faixa].fromInterv;
            let ciclo = last.way == IDA ? route_params[faixa].toMin : route_params[faixa].fromMin;
            opt = {
                start: last.end + intervalo,
                end: last.end + intervalo + ciclo,
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
        this.trips.push(v);
        return v;
    }
    addTripAt(index){ // Adiciona viagem apos indice informado, necessario ter 'espaco' disponivel
    }
    addSchedule(options){}
    checkSchedule(start, end){ // Verifica se tabela esta disponivel para carro (se nao conflita com outras tabelas)
    }
    getEmptySchedule(){ // Retorna 1o intervalo nao alocado para carro
    }
    removeTrip(index, cascade=true){ // Remove a viagem com indice informado e todas as subsequentes (se cascade = true)
        if(cascade){this.trips = this.trips.splice(0,index);}
        else{this.trips = this.trips.slice(index);}
        return true;
    }
    plus(index, cascade=true){ // Aumenta um minuto no final da viagem e no inicio e fim das viagens subsequentes (se cascade=true)
        if(!cascade && index != this.trips.length - 1 && this.trips[index + 1].start <= this.trips[index].end + 1){return false;} // Se viagem posterior e diff de apenas 1 min nao realiza operacao
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
}

class March{
    constructor(options){
        this.id = options?.id || null;
        this.desc = options?.desc || 'Novo projeto';
        this.route = options?.route || new Route();
        this.cars = options?.cars || [];
        this.user = options?.user || null;
        this.status = options?.status || INCOMPLETO;
        this.dayType = options?.dayType || UTIL;
        this.transf = []; // Armazena viagem(s) colocadas na area de transferencia
    }
    addCar(options){ // Adiciona carro no projeto ja inserindo uma viagem (sentido ida)
        if(this.cars.length > 0){options['startAt'] = this.cars[this.cars.length - 1].trips[0].start + FREQUENCIA_BASE;}
        this.cars.push(new Car(options));
        return this.cars.slice(-1)[0]; // Retorna carro inserido 
    }
    addTrip(car_index, trip_index=null){
        this.cars[car_index].addTrip(this.route.params);
    }
    nextTrip(trip){ // Retorna proxima viagem (no mesmo sentido) indiferente de carro, alem do index do referido carro e viagem
        let bestMatch = null;
        let carIndex = null;
        for(let i = 0; i < this.cars.length; i++){
            let curTrips = this.cars[i].trips.filter((el) => el != trip && el.way == trip.way);
            for(let j = 0; j < curTrips.length; j++){
                if(!bestMatch && curTrips[j].start >= trip.start || curTrips[j].start < bestMatch?.start && curTrips[j].start >= trip.start){
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
                if(!bestMatch && curTrips[j].start <= trip.start || curTrips[j].start > bestMatch?.start && curTrips[j].start <= trip.start){
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
}