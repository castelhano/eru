import { metrics as $, defaultParam } from './DM_metrics.js';
import { Locale } from './DM_locale.js';

class Route{
    constructor(options){
        this.id = options?.id || null;
        this.codigo = options?.codigo || '0.00';
        this.nome = options?.nome || 'Linha indefinida';
        this.circular = options?.circular || options?.circular == true;
        this.garagem = options?.garagem || new Locale({}); // Garagem de referencia da linha
        this.origem = options?.origem || new Locale({}); // Ponto inicial da linha (PT1)
        this.destino = options?.destino || new Locale({}); // Ponto final da linha (PT2)
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

export { Route }