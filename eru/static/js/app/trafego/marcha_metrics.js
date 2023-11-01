const metrics = {
    UTIL: 'U',
    SABADO: 'S',
    DOMINGO: 'D',
    ESPECIAL: 'E',
    FERIAS: 'F',
    IDA: 'I',
    VOLTA: 'V',
    PRODUTIVA: '1',
    EXPRESSO: '2',
    SEMIEXPRESSO: '3',
    EXTRA: '4',
    ACESSO: '5',
    RECOLHE: '6',
    INTERVALO: '7',
    RESERVADO: '9',
    ACESSO_PADRAO: 20,
    RECOLHE_PADRAO: 20,
    CICLO_BASE: 50,
    FREQUENCIA_BASE: 10,
    INTERVALO_IDA: 5,
    INTERVALO_VOLTA: 1,
    INICIO_OPERACAO: 290,
    MICROONIBUS: 'MC',
    CONVENCIONAL: 'CV',
    PADRON: 'PD',
    ARTICULADO: 'AT',
    BIARTICULADO: 'BI',
    CAPACIDADE_CARREGAMENTO: {
        'MC': 35,
        'CV': 80,
        'PD': 90,
        'AT': 120,
        'BI': 200
    }
}
function defaultParam(value=50){ // Retorna dicionario com patamares de operacao
    let d = {};
    for(let i = 0; i < 24; i++){
        d[i] = {
            ida: value,
            volta: value,
            intervalo_ida: metrics.INTERVALO_IDA,
            intervalo_volta: metrics.INTERVALO_IDA,
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

export { metrics, defaultParam, min2Hour, min2Range, hour2Min };