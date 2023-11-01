import { metrics as $, defaultParam, min2Hour, min2Range, hour2Min } from './marcha_metrics.js';
import { Car } from './marcha_model_car.js';

var nextTripId = 0;

class Locale{ // Class para locais
    constructor(options){
        this.id = options?.id || null;
        this.nome = options?.nome || 'Local indefinido';
        this.garagem = options?.garagem || options?.garagem == true;
        this.ponto_de_controle = options?.ponto_de_controle || options?.ponto_de_controle == true;
        this.troca_turno = options?.troca_turno || options?.troca_turno == true;
    }
}

class Reference{ // Classe das referencias
    constructor(options){
        this.local = options?.local || new Localidade({}); // Deve referenciar um local
        this.delta = options?.delta || 1; // Armazena o tempo em minutos em relacao a origem (origem ou to)
    }
}

class Route{
    constructor(options){
        this.id = options?.id || null;
        this.codigo = options?.codigo || '0.00';
        this.nome = options?.nome || 'Linha indefinida';
        this.circular = options?.circular || options?.circular == true;
        this.garagem = options?.garagem || new Localidade({}); // Garagem de referencia da linha
        this.origem = options?.origem || new Localidade({}); // Ponto inicial da linha (PT1)
        this.destino = options?.destino || new Localidade({}); // Ponto final da linha (PT2)
        this.extensao_ida = options?.extensao_ida || 0; // Extensao de ida (em km)
        this.extensao_volta = options?.extensao_volta || 0; // Extensao de volta (em km)
        this.param = options?.param || defaultParam(); // Parametros de operacao (tempo de ciclo, acesso, recolhe, km, etc..)
        this.acesso_origem_minutos = options.acesso_origem_minutos || $.ACESSO_PADRAO;
        this.acesso_destino_minutos = options.acesso_destino_minutos || $.ACESSO_PADRAO;
        this.recolhe_origem_minutos = options.recolhe_origem_minutos || $.RECOLHE_PADRAO;
        this.recolhe_destino_minutos = options.recolhe_destino_minutos || $.RECOLHE_PADRAO;
        this.acesso_origem_km = options.acesso_origem_km || 0;
        this.acesso_destino_km = options.acesso_destino_km || 0;
        this.recolhe_origem_km = options.recolhe_origem_km || 0;
        this.recolhe_destino_km = options.recolhe_destino_km || 0;
        this.refs = options?.refs || {origem:[], destino:[]}; // Armazena os pontos de referencia por sentido
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
   getSurrenderRefs(sentido){
    if(sentido == $.IDA){return this.refs.origem.filter((el) => el.local.troca_turno == true)}
    else{return this.refs.destino.filter((el) => el.local.troca_turno == true)}
   }
}

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

class jsMarcha{
    constructor(options){
        
    }
        
}

export { jsMarcha }










class March{
    constructor(options){
        this.version = '1.1.322';
        this.id = options?.id || 'new';
        this.nome = options?.nome || 'Novo Projeto';
        this.desc = options?.desc || '';
        this.linha = options?.linha || new Linha({});
        this.param = options?.param || null;
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
        options.param = this.param || this.linha.param;
        this.carros.push(new Carro(options));
        return this.carros.slice(-1)[0]; // Retorna carro inserido 
    }
    addViagem(car_indice, inicioAt=null){
        return this.carros[car_indice].addViagem(this.linha, inicioAt, this.param || this.linha.param);
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
            let param = this.param ? this.param : this.linha.param; // Se parametros para o planejamento atual usa este, se nao usa os da linha
            if(this.linha.circular){ciclo = param[faixa].ida + param[faixa].intervalo_ida}
            else{ciclo = param[faixa].ida + param[faixa].volta + param[faixa].intervalo_ida + param[faixa].intervalo_volta}
            let freq = Math.ceil(ciclo / metrics.carro);
            INICIO_OPERACAO = metrics.inicio; // Ajusta inicio de operacao para hora informada
            for(let i = 0; i < metrics.carro; i++){
                let c = this.addCarro({linha: this.linha, freq: freq});
                let j = 0;
                while(c.viagens[j].inicio < metrics.fim){
                    c.addViagem(this.linha, false, this.param || this.linha.param);
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
                    n += this.carros[i].escalas[j].next.externalProject ? chain.journey : this.carros[chain.carro].getEscalaJourney(chain.escala);
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