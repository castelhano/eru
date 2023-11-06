import { metrics as $, min2Hour, hour2Min } from './DM_metrics.js';

// Id unico para individualizar viagens com mesmos parametros dentro do projeto
var nextTripId = 0;

class Trip{
    constructor(options){
        this.inicio = options?.inicio || $.INICIO_OPERACAO;
        if(typeof this.inicio == 'string'){this.inicio = $.hour2Min(this.inicio)}
        this.fim = options?.fim || $.INICIO_OPERACAO + $.CICLO_BASE;
        if(typeof this.fim == 'string'){this.fim = hour2Min(this.fim)} // Converte em inteiros caso instanciado inicio: '04:00'
        if(this.fim <= this.inicio){this.fim = this.inicio + $.CICLO_BASE} // Final tem que ser maior (pelo menos 1 min) que inicio 
        this.__id = nextTripId;
        this.encerrar = options?.encerrar || options?.encerrar == true; // Define encerramento de viagem, usado para encerrar turno onde nao ocorre a recolhida do veiculo
        this.origem = options?.origem || ''; // Id local de origem da viagem
        this.destino = options?.destino || ''; // Id local de destino da viagem
        nextTripId++;

        this.sentido = options?.sentido || $.IDA; // Sentido da viagem (ida, volta)
        this.tipo = options?.tipo || $.PRODUTIVA;  // Tipo (produtiva, inprodutiva, especial, etc)
    }
    plus(){ // Aumenta um minuto no final da viagem
        this.fim++;
        return true;
    }
    sub(){ // Subtrai um minuto no final da viagem
        if(this.fim > this.inicio + 1){this.fim--; return true;}
        return false;
    }
    moveStart(){ // Aumenta um minuto no inicio da viagem
        if(this.inicio < this.fim - 1){this.inicio++;return true;}
        return false;
    }
    backStart(){ // Subtrai um minuto no inicio da viagem
        if(this.inicio > 1){ // Primeira viagem precisa iniciar as 00:01 no grid
            this.inicio--;
            return true;
        }
        return false;
    }
    advance(){ // Aumenta um minuto no inicio e no final da viagem
        this.inicio++;
        this.fim++;
        return true;
    }
    back(){ // Subtrai um minuto no inicio e no final da viagem
        if(this.inicio > 1){ // Primeira viagem precisa iniciar as 00:01 no grid
            this.inicio--;
            this.fim--;
            return true;
        }
        return false;
    }
    getCycle(){ // Retorna ciclo em minutos
        return this.fim - this.inicio;
    }
    getStart(){return min2Hour(this.inicio)}
    getEnd(){return min2Hour(this.fim)}
}

export { Trip }