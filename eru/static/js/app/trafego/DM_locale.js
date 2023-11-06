class Locale{ // Class para locais
    constructor(options){
        this.id = options?.id || null;
        this.nome = options?.nome || 'Local indefinido';
        this.garagem = options?.garagem || options?.garagem == true;
        this.ponto_de_controle = options?.ponto_de_controle || options?.ponto_de_controle == true;
        this.troca_turno = options?.troca_turno || options?.troca_turno == true;
    }
}

// class Reference{ // Classe das referencias
//     constructor(options){
//         this.local = options?.local || new Locale({}); // Deve referenciar um local
//         this.delta = options?.delta || 1; // Armazena o tempo em minutos em relacao a origem (origem ou to)
//     }
// }

export { Locale }