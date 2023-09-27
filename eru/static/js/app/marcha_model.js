function min2Hour(min){
    let time = min / 60;
    let h = Math.floor(time);
    let m = Math.round((time - h) * 60);
    if(h >= 24){h -= 24}
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}
function hour2Min(hour, day=0){
    let [h,m] = hour.split(':');
    return day * 1440 + parseInt(h) * 60 + parseInt(m);
}

class Route{
    constructor(options){}
}
class Trip{
    constructor(options){
        // Tipos:
        // 0 Reservado | 1 Produtiva | 2 Refeicao | 3 Expresso | 4 Semiexpresso | -1 Acesso | -2 Recolhe
        this.start = options?.start || 0;
        if(typeof this.start == 'string'){this.start = hour2Min(this.start)}
        this.end = options?.end || 1;
        if(typeof this.end == 'string'){this.end = hour2Min(this.end)}
        this.tipo = options?.tipo || 1;
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
        this.trips = options?.trips || [];
    }
    addTrip(options){}
    removeTrip(index, cascade=true){ // Remove a viagem com indice informado e todas as subsequentes (se cascade = true)
        if(cascade){this.trips = this.trips.splice(0,index);}
        else{this.trips = this.trips.slice(index);}
        return true;
    }
    plus(index, cascade=true){ // Aumenta um minuto no final da viagem e no inicio e fim das viagens subsequentes (se cascade=true)
        if(index != this.trips.length - 1 && this.trips[index + 1].start <= this.trips[index].end + 1){return false;} // Se viagem posterior e diff de apenas 1 min nao realiza operacao
        this.trips[index].plus();
        if(!cascade || this.trips.length - 1 == index){return true} // Se for a ultima viagem retorna true
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
    moveStart(index){ // Aumenta um minuto no inicio da viagem
        return this.trips[index].moveStart();
    }
    backStart(index){ // Subtrai um minuto no inicio da viagem
        if(index == 0 || this.trips[index - 1].end < this.trips[index].start - 1){return this.trips[index].backStart();}
        return false; // Retorna false caso fim da viagem anterior esteja com apenas 1 min de diff no inicio da atual
    }
    advance(index){ // Aumenta um minuto no inicio e no final da viagem e em todas as subsequentes
        for(let i = index; i < this.trips.length; i++){
            this.trips[index].advance();
        }
        return true;
    }
    back(index){ // Subtrai um minuto no inicio e no final da viagem e em todas as subsequentes
        if(index == 0 || this.trips[index - 1].end < this.trips[index].start - 1){
            for(let i = index; i < this.trips.length; i++){
                this.trips[index].back();
            }
            return true;
        }
        return false; // Retorna false caso fim da viagem anterior esteja com apenas 1 min de diff no inicio da atual
        
    }
}

class March{
    constructor(options){}
}