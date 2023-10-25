// Constantes de classificacao
const IDA = 'I', VOLTA = 'V';
const PRODUTIVA = '1', EXPRESSO = '2', SEMIEXPRESSO = '3', EXTRA = '4', ACESSO = '5', RECOLHE = '6', INTERVALO = '7', RESERVADO = '9';
var ACESSO_PADRAO = 20, RECOLHE_PADRAO = 20, CICLO_BASE = 50, FREQUENCIA_BASE = 10, INTERVALO_IDA = 5, INTERVALO_VOLTA = 1, INICIO_OPERACAO = 290;
// Constantes para projeto
var UTIL = 'U', SABADO = 'S', DOMINGO = 'D', ESPECIAL = 'E', FERIAS = 'F';
const MICROONIBUS = 'MC', CONVENCIONAL = 'CV', PADRON = 'PD', ARTICULADO = 'AT', BIARTICULADO = 'BI';
const PORTA_LE = '1';
var March_nextViagemId = 0; // Contador para insercao de identificador unico na viagem, necessario para diferenciar viagens com parametros identicos
var classificacaoLoad = { // Capacidade de carregamento de cada tecnologia
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
            ida: value,
            volta: value,
            intervalo_ida: INTERVALO_IDA,
            intervalo_volta: INTERVALO_IDA,
            demanda_ida: 0,
            demanda_volta: 0,
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

class Localidade{ // Class para locais
    constructor(options){
        this.id = options?.id || null;
        this.nome = options?.nome || 'Local indefinido';
        this.garagem = options?.garagem || options?.garagem == true;
        this.ponto_de_controle = options?.ponto_de_controle || options?.ponto_de_controle == true;
        this.troca_turno = options?.troca_turno || options?.troca_turno == true;
    }
}
class Referencia{ // Classe das referencias
    constructor(options){
        this.local = options?.local || new Localidade({}); // Deve referenciar um local
        this.delta = options?.delta || 1; // Armazena o tempo em minutos em relacao a origem (origem ou to)
    }
}
class Linha{
    constructor(options){
        this.id = options?.id || null;
        this.codigo = options?.codigo || '0.00';
        this.nome = options?.nome || 'Linha indefinida';
        this.circular = options?.circular || options?.circular == true;
        this.origem = options?.origem || new Localidade({}); // Ponto inicial da linha (PT1)
        this.destino = options?.destino || new Localidade({}); // Ponto final da linha (PT2)
        this.extensao_ida = options?.extensao_ida || 0; // Extensao de ida (em km)
        this.extensao_volta = options?.extensao_volta || 0; // Extensao de volta (em km)
        this.param = options?.param || defaultParam(); // Parametros de operacao (tempo de ciclo, acesso, recolhe, km, etc..)
        this.metrics = options?.metrics || { // Metricas adicionais (tempos de acesso, recolhe e extensao de acesso e recolhe)
            acesso_origem_minutos: ACESSO_PADRAO,
            acesso_destino_minutos: ACESSO_PADRAO,
            recolhe_origem_minutos: RECOLHE_PADRAO,
            recolhe_destino_minutos: RECOLHE_PADRAO,
            acesso_origem_km: 0,
            acesso_destino_km: 0,
            recolhe_origem_km: 0,
            recolhe_destino_km: 0,
        }; 
        this.refs = options?.refs || {origem:[], destino:[]}; // Armazena os pontos de referencia por sentido
    }
    getBaselines(){ // Retorna json com resumo dos patamares {inicio: 4, fim: 8, ida: 50, volta: 45, ...}
        let paramKeys = ['ida','volta','intervalo_ida','intervalo_volta'];
        let baseline = [];
        let inicio = 0;
        let fim = 0;
        let last_entry = {};
        for(let i in this.param){
            let entry = {};
            for(let j = 0; j < paramKeys.length;j++){entry[paramKeys[j]] = this.param[i][paramKeys[j]]} // Carrega os attrs em entry
            if(i == 0){ // Na primeira iteracao, cria a entrada do primeiro patamar
                last_entry = {...entry}
                baseline.push(Object.assign({inicio: 0, fim: 0}, entry));
            }
            else if(JSON.stringify(last_entry) == JSON.stringify(entry)){ // Se nova entrada for igual entrada anterior, apenas aumenta fim em 1
                baseline[baseline.length - 1].fim += 1;
            }
            else{ // Se encontrou diferenca no patamar, fecha entry e carrega na baseline
                baseline.push(Object.assign({inicio: parseInt(i), fim: parseInt(i)}, entry));
                last_entry = {...entry};
            }
        }
        return baseline;
   }
   getSurrfimerRefs(sentido){
    if(sentido == IDA){return this.refs.origem.filter((el) => el.local.troca_turno == true)}
    else{return this.refs.destino.filter((el) => el.local.troca_turno == true)}
   }
}
class Viagem{
    constructor(options){
        this.inicio = options?.inicio || INICIO_OPERACAO;
        if(typeof this.inicio == 'string'){this.inicio = hour2Min(this.inicio)}
        this.fim = options?.fim || INICIO_OPERACAO + CICLO_BASE;
        if(typeof this.fim == 'string'){this.fim = hour2Min(this.fim)} // Converte em inteiros caso instanciado inicio: '04:00'
        if(this.fim <= this.inicio){this.fim = this.inicio + CICLO_BASE} // Final tem que ser maior (pelo menos 1 min) que inicio 
        this.__id = March_nextViagemId;
        this.encerrar = options?.encerrar || options?.encerrar == true; // Define encerramento de viagem, usado para encerrar turno onde nao ocorre a recolhida do veiculo
        March_nextViagemId++;

        this.sentido = options?.sentido || IDA; // Sentido da viagem (ida, volta)
        this.tipo = options?.tipo || PRODUTIVA;  // Tipo (produtiva, inprodutiva, especial, etc)
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

class Carro{
    constructor(options){
        this.classificacao = options?.classificacao || CONVENCIONAL; // Tipo de tecnologia a ser usada
        this.especificacao = options?.especificacao || '0'; // Especificacao adicional para carro (porta lado esquerdo, etc..)
        this.viagens = options?.viagens || []; // Armazena as viagens do carro
        this.escalas = options?.escalas || []; // Armazena as tabelas (escalas) para o carro
        if(this.viagens.length == 0){this.addViagem(options.linha, options['inicioAt'])} // Necessario pelo menos uma viagem no carro
    }
    addViagem(linha=null, inicioAt=null){ // Adiciona viagem apos ultima viagem
        let opt = {}; // Dados da viagem
        if(this.viagens.length > 0){
            let last = null;
            if(!inicioAt){last = this.viagens[this.viagens.length - 1]} // Se nao informado inicioAt insere apos ultima viagem
            else{ // Se inicioAt busca viagem anterior
                let i = this.viagens.length - 1;
                let escape = false;
                while(!escape && i >= 0){
                    if(this.viagens[i].inicio < inicioAt && ![INTERVALO, ACESSO, RECOLHE].includes(this.viagens[i].tipo)){
                        escape = true;
                        last = this.viagens[i];
                    }
                    i--;
                }
            }
            let faixa;
            if(inicioAt){faixa = min2Range(inicioAt)}
            else if(last){faixa = min2Range(last.fim)}
            else{faixa = 0} // Em teoria se nao definido inicioAt, sempre deve existir uma viagem anterior
            
            // let faixa = min2Range(last.fim);
            let intervalo = last?.sentido == VOLTA || linha.circular == true ? linha.param[faixa].intervalo_ida : linha.param[faixa].intervalo_volta;
            let ciclo = last?.sentido == VOLTA || linha.circular == true ? linha.param[faixa].ida : linha.param[faixa].volta;
            opt = {
                inicio: inicioAt ? inicioAt : last.fim + intervalo,
                fim: inicioAt ? inicioAt + intervalo + ciclo : last.fim + intervalo + ciclo,
                sentido: last?.sentido == VOLTA || linha.circular == true ? IDA : VOLTA,
                tipo: PRODUTIVA
            }
        }
        else{
            let faixa = min2Range(INICIO_OPERACAO);
            opt = {
                inicio: inicioAt ? inicioAt : INICIO_OPERACAO,
                fim: inicioAt ? inicioAt + linha.param[faixa].ida : INICIO_OPERACAO + linha.param[faixa].ida,
                sentido: IDA,
                tipo: PRODUTIVA
            }
        }
        let v = new Viagem(opt);
        if(inicioAt && !this.__viagemIsValid(v)){ // Se definido inicioAt e viagem entra em conflito com outras viagens, cancela operacao
            appNotify('warning','jsMarch: Conflito com <b>outras viagens</b>');
            return false;
        }
        this.viagens.push(v);
        this.viagens.sort((a, b) => a.inicio > b.inicio ? 1 : -1);
        return v;
    }
    addInterv(viagem_indice){ // Adiciona viagem do tipo intervalo entre duas viagens
        // Necessario ter viagem valida (produtiva) antes e depois do intervalo, e mais de um minuto entre as viagens
        if(viagem_indice == this.viagens.length - 1 || [INTERVALO, RECOLHE].includes(this.viagens[viagem_indice].tipo) || [INTERVALO, ACESSO].includes(this.viagens[viagem_indice + 1].tipo) || this.viagens[viagem_indice + 1].inicio <= this.viagens[viagem_indice].fim + 1){return false}
        let current = this.viagens[viagem_indice];
        let next = this.viagens[viagem_indice + 1];
        let v = new Viagem({inicio: current.fim + 1, fim: next.inicio - 1, tipo: INTERVALO, sentido: current.sentido})
        this.viagens.push(v);
        this.viagens.sort((a, b) => a.inicio > b.inicio ? 1 : -1);
        return v;
    }
    addAccess(viagem_indice, metrics){
        // Acesso somente inserido se viagem for produtiva
        if([INTERVALO, ACESSO, RECOLHE].includes(this.viagens[viagem_indice].tipo)){return false}
        let sentidoAccess = this.viagens[viagem_indice].sentido == IDA ? 'acesso_origem_minutos' : 'acesso_destino_minutos';
        let accessMin = metrics[sentidoAccess];
        let v = new Viagem({inicio: this.viagens[viagem_indice].inicio - accessMin - 1, fim: this.viagens[viagem_indice].inicio - 1, tipo: ACESSO, sentido: this.viagens[viagem_indice].sentido})
        if(this.__viagemIsValid(v)){
            this.viagens.push(v);
            this.viagens.sort((a, b) => a.inicio > b.inicio ? 1 : -1);
            return v;
        }
        return false;
    }
    addRecall(viagem_indice, metrics){
        // Recolhe somente inserido se viagem for produtiva ou tiver sido encerrada
        if([INTERVALO, ACESSO, RECOLHE].includes(this.viagens[viagem_indice].tipo) || this.viagens[viagem_indice].encerrar){return false}
        let sentidoRecall = this.viagens[viagem_indice].sentido == IDA ? 'recolhe_origem_minutos' : 'recolhe_destino_minutos';
        let recallMin = metrics[sentidoRecall];
        let v = new Viagem({inicio: this.viagens[viagem_indice].fim + 1, fim: this.viagens[viagem_indice].fim + recallMin + 1, tipo: RECOLHE, sentido: this.viagens[viagem_indice].sentido})
        if(this.__viagemIsValid(v)){
            this.viagens.push(v);
            this.viagens.sort((a, b) => a.inicio > b.inicio ? 1 : -1);
            return v;
        }
        return false;
    }
    __viagemIsValid(viagem){ // Valida se viagem pode ser inserida no carro sem gerar conflito com outras viagens
        let conflict = false;
        let i = 0;
        while(!conflict && i < this.viagens.length){
            if((viagem.inicio >= this.viagens[i].inicio && viagem.inicio <= this.viagens[i].fim) || (viagem.fim >= this.viagens[i].inicio && viagem.fim <= this.viagens[i].fim)){conflict = true;}
            i++;
        }
        return !conflict;
    }
    addEscala(options){ // Cria nova escala
        options.deltaStart = 0;
        if(this.escalas.length == 0){
            this.escalas.push(options)
            this.escalas.sort((a, b) => a.inicio > b.inicio ? 1 : -1); // Reordena escalas pelo inicio
        }
        else{
            this.escalas.push(options)
            this.escalas.sort((a, b) => a.inicio > b.inicio ? 1 : -1); // Reordena escalas pelo inicio
            let indice = this.escalas.indexOf(options);
            if(indice > 0 && (![RECOLHE, INTERVALO].includes(this.viagens[this.escalas[indice].fim].tipo) || !this.viagens[this.escalas[indice].fim].encerrar)){
                this.escalas[indice].deltaStart = this.escalas[indice - 1].deltaEnd;
            }
        }
        return this.escalas.indexOf(options);
    }
    updateEscala(escala_indice, options, blockStartIndex, blockEndIndex){
        // Aborta operacao caso o novo fim informado seja menor que o inicio da escala, ou se o novo fim ser igual ao atual fim
        if(this.escalas[escala_indice].inicio > options.fim || (this.escalas[escala_indice].fim == options.fim && this.escalas[escala_indice].deltaStart == options.deltaStart && this.escalas[escala_indice].deltaEnd == options.deltaEnd)){return false}
        for(let key in options){
            this.escalas[escala_indice][key] = options[key]; // Atualiza os valores da escala
        }
        // Se existir escala depois da editada, verifica se ser necessario ajustar posteriores
        if(this.escalas.length > escala_indice + 1 && options.fim != undefined && this.escalas[escala_indice + 1].inicio <= blockEndIndex){
            if(this.escalas[escala_indice].fim == this.escalas[escala_indice + 1].fim){ // Novo final ocupa todo espaco da proxima escala, apaga a proxima
                this.escalas.splice(escala_indice + 1, 1)
            }
            else if(this.escalas[escala_indice].fim > this.escalas[escala_indice + 1].fim){ // Se novo final ocupe mais que o final da proxima viagem, apaga toda as demais
                this.escalas.splice(escala_indice + 1, this.escalas.length - 1 - escala_indice)
            }
            else{
                if(!this.viagens[this.escalas[escala_indice].fim].tipo == RECOLHE || !this.viagens[this.escalas[escala_indice].encerrar]){
                    this.escalas[escala_indice + 1].inicio = Math.max(blockStartIndex, this.escalas[escala_indice].fim + 1);
                    this.escalas[escala_indice + 1].deltaStart = this.escalas[escala_indice].deltaEnd;
                }
            }
        }
        return true;
    }
    deleteEscala(escala_indice){
        this.escalas.splice(escala_indice, 1);
        return true;
    }
    getCarroEscalasBlock(linha){ // Retorna array com blocos de viagens, cada bloco terminando com RECOLHE ou viagem.encerrar
        let blocks = [];
        let block = {inicio: this.viagens[0].inicio, inicioIndex: 0, fimIndex: 0, size:0, spots: []};
        let origemRefs = linha.getSurrfimerRefs(IDA);
        let destinoRefs = linha.getSurrfimerRefs(VOLTA);
        for(let i = 0; i < this.viagens.length; i++){
            // Adiciona spot de referencia do bloco
            if(this.viagens[i].sentido == IDA && [PRODUTIVA, EXPRESSO, SEMIEXPRESSO].includes(this.viagens[i].tipo)){
                for(let j = 0; j < origemRefs.length; j++){
                    let time = this.viagens[i].inicio + origemRefs[j].delta;
                    block.spots.push({locale: origemRefs[j].local, time: time, tipo: 'reference', viagemIndex: i, sentido: IDA, delta: origemRefs[j].delta})
                }
            }
            else if(this.viagens[i].sentido == VOLTA && [PRODUTIVA, EXPRESSO, SEMIEXPRESSO].includes(this.viagens[i].tipo)){
                for(let j = 0; j < destinoRefs.length; j++){
                    let time = this.viagens[i].inicio + destinoRefs[j].delta;
                    block.spots.push({locale: destinoRefs[j].local, time: time, tipo: 'reference', viagemIndex: i, sentido: VOLTA, delta: destinoRefs[j].delta})
                }
            }
            // Adiciona spots de viagem do bloco
            if(![ACESSO, INTERVALO].includes(this.viagens[i].tipo)){
                let time = this.viagens[i].fim + (this.viagens[i].encerrar ? 0 : this.getInterv(i));
                if(this.viagens[i].sentido == IDA){block.spots.push({locale: linha.destino, time: time, tipo: 'viagemEnd', viagemIndex: i, sentido: this.viagens[i].sentido, delta: 0})}
                else if(this.viagens[i].sentido == VOLTA){block.spots.push({locale: linha.origem, time: time, tipo: 'viagemEnd', viagemIndex: i})}
            }
            // Ajusta bloco inicio, fim e dimensao
            if(this.viagens[i].encerrar || this.viagens[i].tipo == RECOLHE || this.viagens.length - 1 == i){
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
        let lastEscalaIndex = -1;
        let lastDeltaStart = 0;
        let lastDeltaEnd = 0;
        for(let i = 0; i < this.escalas.length; i++){
            if(this.escalas[i].inicio >= block.inicioIndex && this.escalas[i].fim <= block.fimIndex){
                lastEscalaIndex = this.escalas[i].fim
                lastDeltaStart = this.escalas[i].deltaStart
                lastDeltaEnd = this.escalas[i].deltaEnd
            }
        }
        if(lastEscalaIndex == -1){block.emptyStart = block.inicioIndex;block.deltaStart = 0;block.deltaEnd = 0;}
        else if(lastEscalaIndex < block.fimIndex){
            block.emptyStart = lastEscalaIndex + 1;
            block.deltaStart = lastDeltaStart;
            block.deltaEnd = lastDeltaEnd;
        }
        return block;
    }
    cleanEscala(indice=null){ // Limpa escala, se nao informado indice limpa todas as escalas
    }
    getEscalaJourney(escala_indice, allMetrics=false){
        let inicio = this.viagens[this.escalas[escala_indice].inicio].inicio;
        let fim = this.viagens[this.escalas[escala_indice].fim].fim;
        if(this.escalas[escala_indice].deltaStart > 0){
            inicio = this.viagens[this.escalas[escala_indice - 1].fim].inicio + this.escalas[escala_indice].deltaStart;
        }
        if(this.escalas[escala_indice].deltaEnd > 0){
            fim = this.viagens[this.escalas[escala_indice].fim].inicio + this.escalas[escala_indice].deltaEnd;
        }
        else{
            fim += this.getInterv(this.escalas[escala_indice].fim);
        }
        return allMetrics ? [fim - inicio, inicio, fim] : fim - inicio;
    }
    removeViagem(indice, cascade=true, count=1){ // Remove a viagem com indice informado e todas as subsequentes (se cascade = true)
        if(this.viagens.length == 1 || indice == 0 && cascade){return false} // Carro precisa de pelo menos uma viagem
        let removed = [];
        let before = indice > 0 && [ACESSO, INTERVALO].includes(this.viagens[indice - 1].tipo) ? true : false;
        let after = indice < this.viagens.length - 1 && [RECOLHE, INTERVALO].includes(this.viagens[indice + 1].tipo) ? true : false;
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
    switchWay(viagem_indice, cascade=true){ // Altera o sentido da viagem, se cascade altera tbm das seguintes
        this.viagens[viagem_indice].sentido = this.viagens[viagem_indice].sentido == IDA ? VOLTA : IDA;
        if(cascade){
            for(let i = viagem_indice + 1; i < this.viagens.length; i++){
                this.viagens[i].sentido = this.viagens[i].sentido == IDA ? VOLTA : IDA;
            }
        }
        return true;
    }
    viagemShut(viagem_indice){ // Encerra (ou cancela encerramento) viagem informada
        if(this.viagens[viagem_indice].encerrar){this.viagens[viagem_indice].encerrar = false; return true;} // Para cancelar encerramnto nao existe validacao
        // Retorna false se viagem nao for produtiva e/ou se viagem posterior nao for produtiva ou acesso
        if([ACESSO, RECOLHE, INTERVALO].includes(this.viagens[viagem_indice].tipo) || (viagem_indice < this.viagens.length - 1 &&  [RECOLHE, INTERVALO].includes(this.viagens[viagem_indice + 1].tipo))){return false}
        this.viagens[viagem_indice].encerrar = true;
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
    firstViagem(){ // Retorna a primeira viagem produtiva do carro
        for(let i = 0; i < this.viagens.length; i++){
            if(![ACESSO, RECOLHE, INTERVALO, RESERVADO].includes(this.viagens[i].tipo)){return this.viagens[i]}
        }
        return false;
    }
    lastViagem(){ // Retorna a ultima viagem produtiva do carro
        for(let i = this.viagens.length - 1; i >= 0; i--){
            if(![ACESSO, RECOLHE, INTERVALO, RESERVADO].includes(this.viagens[i].tipo)){return this.viagens[i]}
        }
        return false;
    }
    countViagens(){ // Retorna a quantidade de viagens do carro (viagens produtivas), ignora acessos, recolhidas e intervalos
        let count = 0;
        for(let i = 0; i < this.viagens.length; i++){
            if([PRODUTIVA, EXPRESSO, SEMIEXPRESSO, RESERVADO].includes(this.viagens[i].tipo)){count++}
        }
        return count;
    }
    getInterv(viagemIndex){ // Retorna o intervalo entre a viagem informada e a proxima (se for produtiva)
        if(viagemIndex == this.viagens.length - 1){return 0}
        // Se viagem atual NAO for recolhe e proxima viagem for produtiva retorna intervalo entre viagens
        if(![RECOLHE,INTERVALO].includes(this.viagens[viagemIndex].tipo) && !this.viagens[viagemIndex].encerrar && [PRODUTIVA, EXPRESSO, SEMIEXPRESSO, RECOLHE].includes(this.viagens[viagemIndex + 1].tipo)){
            return this.viagens[viagemIndex + 1].inicio - this.viagens[viagemIndex].fim;
        }
        return 0;
    }
    getJourney(gaps=true){ // Retorna jornada total do carro
        let sum = this.getIntervs(true, false); // Retorna soma dos intervalos
        for(let i = 0; i < this.viagens.length;i++){
            if(this.viagens[i].tipo != INTERVALO){
                sum += this.viagens[i].getCycle();
            }
        }
        return sum;
    }
    getIntervs(gaps=true, intervs=true){ // Retorna total de intervalos do carro
        let sum = 0;
        for(let i = 0; i < this.viagens.length; i++){
            if(intervs && this.viagens[i].tipo == INTERVALO){sum += this.viagens[i].getCycle() + 2} // Soma 'viagens' do tipo INTERVALO, soma 2 para considerar os gaps antes e depois do intervalo
            else if(gaps){sum += this.getInterv(i)} // Se gaps soma os intervalos entre viagens
        }
        return sum;
    }
}

class March{
    constructor(options){
        this.version = '1.1.322';
        this.id = options?.id || 'new';
        this.nome = options?.nome || 'Novo Projeto';
        this.desc = options?.desc || '';
        this.linha = options?.linha || new Linha({});
        this.carros = options?.carros || [];
        this.viewStage = options?.viewStage || 1; // View 1: Diagrama de Marcha, 2: Editor de Escalas, 3: Resumo e definicoes
        this.dia_tipo = options?.dia_tipo || UTIL;
        this.jornada_normal = options?.jornada_normal || 420; // Jornada de trabalho normal 07:00 = 420 | 07:20 = 440
        this.ativo = options?.ativo || options?.ativo == true;
        this.area_transferencia = options?.area_transferencia || []; // Area de armazenomento de viagens
        this.somar_intervalo_entre_viagens = options?.somar_intervalo_entre_viagens || options?.somar_intervalo_entre_viagens == true;
        this.save = options?.save != undefined ? options.save : function(){console.log('jsMarch: Nenhuma funcao definida para save, nas opcoes marque {save: suaFuncao}')}; // Funcao de salvamento do projeto
    }
    addCarro(options){ // Adiciona carro no projeto ja inserindo uma viagem (sentido ida)
        if(this.carros.length > 0){
            options['inicioAt'] = this.carros[this.carros.length - 1].firstViagem().inicio + (options?.freq || FREQUENCIA_BASE);
        }
        this.carros.push(new Carro(options));
        return this.carros.slice(-1)[0]; // Retorna carro inserido 
    }
    addViagem(car_indice, inicioAt=null){
        return this.carros[car_indice].addViagem(this.linha, inicioAt);
    }
    removeCarro(carro_indice){
        return this.carros.splice(carro_indice, 1);
    }
    addEscala(carro_indice, options){
        options.nome = this.escalaBaptize(carro_indice, this.carros[carro_indice].escalas.length);
        let r = this.carros[carro_indice].addEscala(options)
        return r;
    }
    nextViagem(viagem){ // Retorna proxima viagem (no mesmo sentido) indiferente de carro, alem do indice do referido carro e viagem
        let bestMatch = null;
        let carIndex = null;
        for(let i = 0; i < this.carros.length; i++){
            let curViagems = this.carros[i].viagens.filter((el) => el != viagem && el.sentido == viagem.sentido);
            for(let j = 0; j < curViagems.length; j++){
                if(!bestMatch && ![INTERVALO, ACESSO, RECOLHE, RESERVADO].includes(curViagems[j].tipo) && curViagems[j].inicio >= viagem.inicio || ![INTERVALO, ACESSO, RECOLHE, RESERVADO].includes(curViagems[j].tipo) && curViagems[j].inicio < bestMatch?.inicio && curViagems[j].inicio >= viagem.inicio){
                    bestMatch = curViagems[j];
                    carIndex = i;
                }
            }            
        }
        return bestMatch ? [carIndex, this.carros[carIndex].viagens.indexOf(bestMatch), bestMatch] : false;
    }
    previousViagem(viagem){ // Retorna viagem anterior (no mesmo sentido) indiferente de carro, alem do indice do referido carro e viagem
        let bestMatch = null;
        let carIndex = null;
        for(let i = 0; i < this.carros.length; i++){
            let curViagems = this.carros[i].viagens.filter((el) => el != viagem && el.sentido == viagem.sentido);
            for(let j = 0; j < curViagems.length; j++){
                if(!bestMatch && ![INTERVALO, ACESSO, RECOLHE, RESERVADO].includes(curViagems[j].tipo) && curViagems[j].inicio <= viagem.inicio || ![INTERVALO, ACESSO, RECOLHE, RESERVADO].includes(curViagems[j].tipo) && curViagems[j].inicio > bestMatch?.inicio && curViagems[j].inicio <= viagem.inicio){
                    bestMatch = curViagems[j];
                    carIndex = i;
                }
            }            
        }
        return bestMatch ? [carIndex, this.carros[carIndex].viagens.indexOf(bestMatch), bestMatch] : false;
    }
    getHeadway(viagem){ // Retorna minutos entre a viagem atual e anterior (mesmo sentido)
        let t = this.previousViagem(viagem);
        return t ? viagem.inicio - t[2].inicio : false;
    }
    getJourney(car_indice=null){ // Retorna a soma da jornada do carro informado
        if(car_indice != null){
            return this.carros[car_indice].getJourney(this.somar_intervalo_entre_viagens);
        }
        let sum = 0;
        for(let i = 0; i < this.carros.length; i++){
            sum += this.carros[i].getJourney(this.somar_intervalo_entre_viagens);
        }
        return sum;
    }
    autoGenerateEscalas(){
        for(let i = 0; i < this.carros.length; i++){
            let blocks = this.carros[i].getCarroEscalasBlock(this.linha);
            this.carros[i].escalas = []; // Limpa as escalas do carro
            for(let j = 0; j < blocks.length; j++){
                this.carros[i].escalas.push({inicio: blocks[j].inicioIndex, fim: blocks[j].fimIndex, nome: this.escalaBaptize(i, j), deltaStart: 0, deltaEnd: 0, previous: null, next: null})
            }
        }
        return true;
    }
    escalaBaptize(carro_indice, new_seq){ // Define nome automatico para tabela
        let seq = ['A', 'B', 'C', 'D', 'E', 'F'];
        return `${String(carro_indice + 1).padStart(2,'0')}${seq[new_seq]}`;
    }
    deleteEscala(carro_indice, escala_indice){
        let chain = [];
        if(this.carros[carro_indice].escalas[escala_indice].next && !this.carros[carro_indice].escalas[escala_indice].next.externalProject){
            chain.push(this.carros[carro_indice].escalas[escala_indice].next.carro);
            this.carros[this.carros[carro_indice].escalas[escala_indice].next.carro].escalas[this.carros[carro_indice].escalas[escala_indice].next.escala].previous = null;
        }
        if(this.carros[carro_indice].escalas[escala_indice].previous && !this.carros[carro_indice].escalas[escala_indice].previous.externalProject){
            chain.push(this.carros[carro_indice].escalas[escala_indice].previous.carro);
            this.carros[this.carros[carro_indice].escalas[escala_indice].previous.carro].escalas[this.carros[carro_indice].escalas[escala_indice].previous.escala].next = null;
        }
        this.carros[carro_indice].deleteEscala(escala_indice);
        return chain;
    }
    getIntervs(car_indice=null){ // Retorna a soma de intervalos do carro informado
        if(car_indice != null){
            return this.carros[car_indice].getIntervs(this.somar_intervalo_entre_viagens);
        }
        let sum = 0;
        for(let i = 0; i < this.carros.length; i++){
            sum += this.carros[i].getIntervs(this.somar_intervalo_entre_viagens);
        }
        return sum;
    }
    getFirstViagem(sentido=IDA){ // Retorna primeia viagem no sentido informado
        if(this.carros.length == 0){return false}
        let first, carro_indice, viagem_indice;
        for(let i = 0; i < this.carros.length;i++){
            for(let j = 0; j < this.carros[i].viagens.length; j++){
                if(![ACESSO, RECOLHE, INTERVALO].includes(this.carros[i].viagens[j].tipo) && this.carros[i].viagens[j].sentido == sentido && (this.carros[i].viagens[j].inicio < first?.inicio || !first)){
                    first = this.carros[i].viagens[j];
                    carro_indice = i;
                    viagem_indice = j;
                }
            }
        }
        return [first, carro_indice, viagem_indice];
    }
    getLastViagem(sentido=VOLTA){ // Retorna ultima viagem no sentido informado
        if(this.carros.length == 0){return false}
        let last, carro_indice, viagem_indice;
        for(let i = 0; i < this.carros.length;i++){
            for(let j = 0; j < this.carros[i].viagens.length; j++){
                if(![ACESSO, RECOLHE, INTERVALO].includes(this.carros[i].viagens[j].tipo) && this.carros[i].viagens[j].sentido == sentido && (this.carros[i].viagens[j].inicio > last?.inicio || !last)){
                    last = this.carros[i].viagens[j];
                    carro_indice = i;
                    viagem_indice = j;
                }
            }
        }
        return [last, carro_indice, viagem_indice];
    }
    moveViagems(carroOriginIndex, carroDestinyIndex, inicioViagemIndex, fimViagemIndex){ // Movimenta viagens de um carro para outro
        if(this.carros[carroOriginIndex].viagens.length <= fimViagemIndex - inicioViagemIndex + 1){return false}
        let conflict = false;
        let i = inicioViagemIndex;
        while(!conflict && i <= fimViagemIndex){ // Verifica de todas as viagens podem ser movimentadas
            if(!this.carros[carroDestinyIndex].__viagemIsValid(this.carros[carroOriginIndex].viagens[i])){
                conflict = true;
            }
            i++;
        }
        if(conflict){return false}
        // Se nenhum conflito encontrado, remove as viagens do carro de origem e move para o destino
        this.carros[carroDestinyIndex].viagens = this.carros[carroDestinyIndex].viagens.concat(this.carros[carroOriginIndex].viagens.splice(inicioViagemIndex, fimViagemIndex - inicioViagemIndex + 1));
        this.carros[carroDestinyIndex].viagens.sort((a, b) => a.inicio > b.inicio ? 1 : -1); // Reordena viagens pelo inicio
        return true;
    }
    addToTransferArea(carro_indice, viagem_inicio_indice, viagem_fim_indice){ // Adiciona viagem's a area de transferencia
        if(this.area_transferencia.length > 0 || viagem_fim_indice - viagem_inicio_indice + 1 == this.carros[carro_indice].viagens.length){return false} // Area de transferencia armazena apenas um grupo de linhas de cada vez
        this.area_transferencia = this.carros[carro_indice].removeViagem(viagem_inicio_indice, false, viagem_fim_indice - viagem_inicio_indice + 1)[0];
        return this.area_transferencia;
    }
    pasteTransfer(carro_indice){ // Move as viagens da area de transfeencia para o carro informado
        for(let i = 0; i < this.area_transferencia.length; i++){ // Valida todas as viagens se nao gera conflito com a carro de destino
            if(!this.carros[carro_indice].__viagemIsValid(this.area_transferencia[i])){return false}
        }    
        for(let i = 0; i < this.area_transferencia.length; i++){ // Adiciona as viagens no carro alvo
            this.carros[carro_indice].viagens.push(this.area_transferencia[i]);
        }
        this.carros[carro_indice].viagens.sort((a, b) => a.inicio > b.inicio ? 1 : -1); // Reordena viagens pelo inicio
        this.area_transferencia = []; // Limpa area de trasnferencia
        return true;
    }
    generate(metrics){ // Gera planejamento baseado nas metricas definidas
        return new Promise(resolve => {
            this.carros = []; // Limpa planejamento atual
            let faixa = min2Range(metrics.inicio);
            let ciclo;
            if(this.linha.circular){ciclo = this.linha.param[faixa].ida + this.linha.param[faixa].intervalo_ida}
            else{ciclo = this.linha.param[faixa].ida + this.linha.param[faixa].volta + this.linha.param[faixa].intervalo_ida + this.linha.param[faixa].intervalo_volta}
            let freq = Math.ceil(ciclo / metrics.carro);
            INICIO_OPERACAO = metrics.inicio; // Ajusta inicio de operacao para hora informada
            for(let i = 0; i < metrics.carro; i++){
                let c = this.addCarro({linha: this.linha, freq: freq});
                let j = 0;
                while(c.viagens[j].inicio < metrics.fim){
                    c.addViagem(this.linha);
                    j++;
                }
            }
            if(metrics?.addAccess){
                for(let i = 0; i < metrics.carro; i++){ // Adiciona acesso para todos os carros
                    this.carros[i].addAccess(0, this.linha.metrics);
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
        project.linha.origem = new Localidade(project.linha.origem); // Cria instancia Localidade para origem
        project.linha.destino = new Localidade(project.linha.destino); // Cria instancia Localidade para origem
        let origemRefs = [], destinoRefs = [];
        for(let i = 0; i < project.linha.refs.origem.length;i++){ // Cria instancias para referencias de ida
            project.linha.refs.origem[i].local = new Localidade(project.linha.refs.origem[i].local); // Cria instancia de Localidade
            origemRefs.push(new Referencia(project.linha.refs.origem[i]))
        }
        for(let i = 0; i < project.linha.refs.destino.length;i++){ // Cria instancias para referencias de volta
            project.linha.refs.destino[i].local = new Localidade(project.linha.refs.destino[i].local); // Cria instancia de Localidade
            destinoRefs.push(new Referencia(project.linha.refs.destino[i]))
        }
        project.linha.refs.origem = origemRefs;
        project.linha.refs.destino = destinoRefs;
        // ----------
        this.linha = new Linha(project.linha); // Cria instancia da linha
        this.carros = [];
        for(let i = 0; i < project.carros.length;i++){ // Cria instancias para todos os carros do projeto
            let viagens = [];
            for(let j = 0; j < project.carros[i].viagens.length;j++){ // Cria instancias para todas as viagens
                viagens.push(new Viagem(project.carros[i].viagens[j]))
            }
            project.carros[i].viagens = viagens; // Substitui o carros.viagens (array simples) pelo viagens (array de instancias Viagem)
            this.carros.push(new Carro(project.carros[i]));
        }
        this.area_transferencia = [];
        for(let i = 0; i < project.area_transferencia.length;i++){ // Cria instancias para viagens na area de transferencia
            this.area_transferencia.push(new Viagem(project.area_transferencia[i]))
        }
    }
    reset(){ // Limpa planejamento e escalas
        this.carros = [];
        this.viewStage = 1;
        this.area_transferencia = [];
        return true;
    }
    countViagens(){ // Retorna a quantidade de viagens geral do projeto ou do carro se informado carro_indice
        let counter = {origem: 0, destino: 0, expresso: 0, semiexpresso: 0, lazyFrom: 0, lazyTo: 0, accessFrom: 0, accessTo: 0, recallFrom: 0, recallTo: 0};
        for(let i = 0; i < this.carros.length; i++){
            for(let j = 0; j < this.carros[i].viagens.length; j++){
                if(this.carros[i].viagens[j].tipo == INTERVALO){continue}
                else if(this.carros[i].viagens[j].tipo == ACESSO){if(this.carros[i].viagens[j].sentido == IDA){counter.accessFrom ++}else{counter.accessTo ++}}
                else if(this.carros[i].viagens[j].tipo == RECOLHE){if(this.carros[i].viagens[j].sentido == IDA){counter.recallFrom ++}else{counter.recallTo ++}}
                else if(this.carros[i].viagens[j].tipo == RESERVADO){if(this.carros[i].viagens[j].sentido == IDA){counter.lazyFrom ++}else{counter.lazyTo ++}}
                else{
                    if(this.carros[i].viagens[j].tipo == EXPRESSO){counter.expresso ++;}
                    else if(this.carros[i].viagens[j].tipo == SEMIEXPRESSO){counter.semiexpresso ++;}
                    // ---
                    if(this.carros[i].viagens[j].sentido == IDA){counter.origem ++;}
                    else if(this.carros[i].viagens[j].sentido == VOLTA){counter.destino ++;}
                }
            }
        }
        return counter;
    }
    countOperatores(){
        let full = 0, half = 0, horas_normais = 0, horas_extras = 0, escalas = [];
        for(let i = 0; i < this.carros.length; i++){
            for(let j = 0; j < this.carros[i].escalas.length; j++){
                if(this.carros[i].escalas[j].previous && !this.carros[i].escalas[j].previous.externalProject){continue}
                if(!this.carros[i].escalas[j].previous){full++} // Se escala nao tiver apontamento anterior, conta motorista
                else{half++;}
                let c = 0, p = 0, n = 0, nt = 0, ot = 0, chain = this.carros[i].escalas[j].next; // Current sched, previous e next, normal_time e overtime, chain marca proxima escala encadeada
                c = this.carros[i].getEscalaJourney(j);
                while(chain){ // Corre escalas procurando proximo elo
                    n += this.carros[i].escalas[j].next.externalProject ? hour2Min(chain.journey) : this.carros[chain.carro].getEscalaJourney(chain.escala);
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
                if(![ACESSO, RECOLHE, INTERVALO, RESERVADO].includes(this.carros[i].viagens[j].tipo)){ // Se for viagem produtiva
                    if(this.carros[i].viagens[j].sentido == IDA){
                        od[faixa].viagens_ida++; // Incrementa contador de viagens da faixa/sentido
                        od[faixa].oferta_ida += classificacaoLoad[this.carros[i].classificacao]; // Incrementa contator de oferta para faixa/sentido
                    }
                    else if(this.carros[i].viagens[j].sentido == VOLTA){
                        od[faixa].destinoViagems++; // Incrementa contador de viagens da faixa/sentido
                        od[faixa].oferta_volta += classificacaoLoad[this.carros[i].classificacao]; // Incrementa contator de oferta para faixa/sentido
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
        let filenome = `${this.nome}.json`;
        let btn = document.createElement('a');
        btn.classList = 'd-none';
        btn.setAttribute('href', dataUri);
        btn.setAttribute('download', filenome);
        btn.click();
        btn.remove();
    }
}