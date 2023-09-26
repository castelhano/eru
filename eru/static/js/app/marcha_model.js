class Linha{
    constructor(options){}
}
class Viagem{
    constructor(options){
        // Tipos:
        // 0 Reservado | 1 Produtiva | 2 Refeicao | 3 Expresso | 4 Semiexpresso | -1 Acesso | -2 Recolhe
        this.inicio = options?.inicio || 0;
        this.fim = options?.fim || 1;
        this.tipo = options?.tipo || 1;
    }
    plus(){ // Aumenta um minuto no final da viagem
    }
    sub(){ // Subtrai um minuto no final da viagem
    }
    initMove(){ // Aumenta um minuto no fim da viagem
    }
    initBack(){ // Subtrai um minuto no fim da viagem
    }
    advance(){ // Aumenta um minuto no inicio e no fim da viagem
    }
    back(){ // Subtrai um minuto no inicio e no fim da viagem
    }
    getCiclo(){ // Retorna ciclo em minutos
    }
}
class Carro{
    constructor(options){}
}

class Marcha{
    constructor(options){}
}