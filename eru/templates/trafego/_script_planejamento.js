var patamares = [], frequencia = [], carros = [];


function buildPatamares(){
  let tbody = document.getElementById('patamares_tbody');  
  tbody.innerHTML = '';
  for(i=0;i < patamares.length;i++){
    tbody.innerHTML += `<tr><td class="table-secondary">${patamares[i][0]}</td><td class="table-secondary">${patamares[i][1]}</td><td id="${i}_2" contenteditable="true" oninput="setPatamar(this.id, this.innerHTML)">${patamares[i][2]}</td><td id="${i}_3" contenteditable="true" oninput="setPatamar(this.id, this.innerHTML)">${patamares[i][3]}</td><td id="${i}_4" contenteditable="true" oninput="setPatamar(this.id, this.innerHTML)">${patamares[i][4]}</td><td id="${i}_5" class="table-emphasis text-truncate">${patamares[i][5]}</td></tr>`;
  }
}


{% if planejamento.patamares == '' %}
{% for patamar in planejamento.linha.patamares %}
patamares.push([{{patamar.inicial}}, {{patamar.final}}, {{patamar.ida}}, {{patamar.volta}},0,0]);
{% endfor %}
{% else %}
patamares = {{planejamento.patamares}};
buildPatamares();
{% endif %}




// TODO VERIFICAR AQUII
function submitForm(){
  document.getElementById('id_patamares').value = JSON.stringify(patamares);
  return true;
}
function setPatamar(id, value){
  let x = id.split('_')[0], y = id.split('_')[1];
  patamares[x][y] = parseInt(value);
  patamares[x][5] = calculaFrequencia(patamares[x][2] + patamares[x][3], patamares[x][4]);
  document.getElementById(`${x}_5`).innerHTML = patamares[x][5]; //Ajusta valor da frequencia calculada
}
function patamarAdd(){patamarUpdate(document.getElementById('patamar_add_inicio').textContent.trim(),document.getElementById('patamar_add_fim').textContent.trim(),document.getElementById('patamar_add_ida').textContent.trim(),document.getElementById('patamar_add_volta').textContent.trim());patamarCleanForm();}
function patamarCleanForm(){document.getElementById('patamar_add_inicio').innerHTML = '';document.getElementById('patamar_add_fim').innerHTML = '';document.getElementById('patamar_add_ida').innerHTML = '';document.getElementById('patamar_add_volta').innerHTML = '';}
function patamarUpdate(inicio, fim, ida, volta){
  inicio = parseInt(inicio);fim = parseInt(fim);ida = parseInt(ida);volta = parseInt(volta);
  if(!Number.isInteger(inicio) || !Number.isInteger(fim) || !Number.isInteger(ida) || !Number.isInteger(volta) || inicio < 0 || fim > 23){dotAlert('warning', 'Valores <b>inválidos</b>')}
  else{
    let pool = [];
    for(i = 0; i < patamares.length; i++){
      let changed = false;
      if(patamares[i][0] >= inicio && patamares[i][0] <= fim){patamares[i][0] = fim + 1;changed = true;}
      if(patamares[i][1] >= inicio && patamares[i][1] <= fim){patamares[i][1] = inicio - 1;changed = true;}
      if(patamares[i][0] <= inicio && patamares[i][1] >= fim){
        if(patamares[i][0] > patamares[i][1] || (patamares[i][0] < 0 || patamares[i][1] < 0) || (patamares[i][0] > 23 || patamares[i][1] > 23)){}
        else{pool.push([fim + 1, patamares[i][1], patamares[i][2], patamares[i][3], 0, 0]);changed = true;}
        patamares[i][1] = inicio - 1;
      }
      
      if(changed){
        let has_errors = false;
        if(patamares[i][0] > patamares[i][1]){has_errors=true;};
        if(patamares[i][0] < 0 || patamares[i][1] < 0){has_errors=true;};
        if(patamares[i][0] > 23 || patamares[i][1] > 23){has_errors=true;};
        if(!has_errors){pool.push(patamares[i]);}
      }
      else{pool.push(patamares[i]);}
    }
    pool.push([inicio, fim, ida, volta,0,0]);
    patamares = pool;
    patamares.sort(sortPatamares);
    buildPatamares();
  }
}

function sortPatamares(a, b){if (a[0] === b[0]) {return 0;}else {return (a[0] < b[0]) ? -1 : 1;}}
function calculaFrequencia(ciclo, frota){return frota > 0 ? parseFloat(ciclo / frota) : 0;}
function getFaixa(hora){return parseInt(hora.split(':')[0]) < 24 ? parseInt(hora.split(':')[0]) : parseInt(hora.split(':')[0]) - 24;}
function getPatamar(faixa){for(i=0;i < patamares.length;i++){if(faixa >= patamares[i][0] && faixa <= patamares[i][1]){return [patamares[i][2], patamares[i][3], patamares[i][2] + patamares[i][3], patamares[i][4], patamares[i][5]]}}}

function format2Digits(numero){return ("0" + numero).slice(-2)};
function horaAdd(hora, freq){try {let h = parseInt(hora.split(':')[0]), m = parseInt(hora.split(':')[1]) + parseInt(freq);while(m > 59){ m = m - 60; h++;}return `${format2Digits(h)}:${format2Digits(m)}`;} catch(e){console.log(e);}}
function horaSub(hora, freq){try {let h = parseInt(hora.split(':')[0]), m = parseInt(hora.split(':')[1]) - parseInt(freq);while(m < 0){ m = m + 60; h--;}return `${format2Digits(h)}:${format2Digits(m)}`;} catch(e){console.log(e);}}