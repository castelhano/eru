const appModalConfirm = new bootstrap.Modal(document.getElementById('appModalConfirm'), {});
const appModalLoading = new bootstrap.Modal(document.getElementById('appModalLoading'), {keyboard: false});
var pageshow_persisted = false;      // flag informa se pagina foi construida pelo cache do navegador (em geral no history back)

String.prototype.captalize = function(){ return this.charAt(0).toUpperCase() + this.slice(1) }

// exibe modal de carregameto ao sair da pagina
appModalLoading._element.addEventListener('shown.bs.modal', ()=>{ if(pageshow_persisted){ appModalLoading.hide() } })

// trata erro de modal permanecer aberto ao usar o history back do navegador
window.addEventListener('pageshow', (event) => { pageshow_persisted = event.persisted });
window.onbeforeunload = (ev) => { 
  appModalLoading.show();
  const monitorDownload = setInterval(() => {
    // Se o cookie de download aparecer, o servidor respondeu com o arquivo
    if (document.cookie.indexOf("fileDownload=true") !== -1) {
      
      // 1. Esconde o modal que o onbeforeunload abriu
      appModalLoading.hide();
      
      // 2. Limpa o cookie (importante para o próximo clique)
      document.cookie = "fileDownload=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      
      // 3. Para o vigia
      clearInterval(monitorDownload);
    }
  }, 500);
  
  // Se em 10 segundos nada acontecer (download falhar ou internet lenta), 
  // paramos o vigia para não gastar processamento
  setTimeout(() => clearInterval(monitorDownload), 10000);

}

/*
* appAlert  Gera um alerta (bootstrap alert), somente um alerta aberto a cada momento
* appNotify Gera uma notificaçao (stackable), na caixa de notificaçao do sistema
*
* @author   Rafael Gustavo ALves {@email castelhano.rafael@gmail.com }
* @param    {String} tipo Tipo do alerta (info, danger, warning, success, primary, etc..)
* @param    {String} mensagem Mensagem do alerta
* @param    {Bool} autodismiss [Opcional] Remove automaticamente alerta apos 4,5 segundos se setado para true (default), altere para false para exigir remocao manual
* @example  appAlert('warning', 'Este eh um <b>alerta de exemplo</b>')
* @example  appNotify('danger', 'Este eh um <b>alerta de exemplo</b>')
*/

function appAlert(tipo, mensagem, options={}){
  try {document.querySelector('[data-type="appAlert"]').remove()}
  catch(e){}
  if(!options.hasOwnProperty('autodismiss')){options.autodismiss = true}
  let e = document.createElement('div');
  e.setAttribute('data-type','appAlert');
  e.style.zIndex = 100;
  let b = document.createElement('button');
  b.classList.add('btn-close');
  b.setAttribute('data-bs-dismiss','alert');
  e.classList.add('alert','slideIn','appAlert',`alert-${tipo}`,'alert-dismissible','fade','show','mb-0');
  e.innerHTML = mensagem; 
  e.appendChild(b);
  document.body.appendChild(e);
  if(options.autodismiss){setTimeout(function() {e.remove()}, 5000)}}
  
function appNotify(tipo, mensagem, options={}){
  if(!options.hasOwnProperty('autodismiss')){options.autodismiss = true}
  let e = document.createElement('div'); 
  e.classList = `alert alert-${tipo} alert-dismissible slideIn mb-2`; 
  let b = document.createElement('button'); 
  b.classList = 'btn-close'; 
  b.setAttribute('data-bs-dismiss','alert'); 
  e.innerHTML = mensagem; 
  e.appendChild(b);
  document.getElementById('notify_container').appendChild(e); 
  if(options.autodismiss){setTimeout(function() {e.remove()}, 4500);} 
}

// Limpa area de notificacao
function cleanNotify(){document.getElementById('notify_container').innerHTML = '';}


// Busca dados no servidor (espera um json como resposta), retorna promise
// Ex: appGetData({url: '...'}).then((resp)=>{...do something})
function appGetData(options) {
  return new Promise(function(resolve, reject) {
    let xhr = new XMLHttpRequest();
    xhr.onload = function() {
      let d = JSON.parse(this.responseText);
      if(typeof d != 'object'){d = JSON.parse(d)}
      resolve(d);
    };
    xhr.onerror = reject;
    xhr.open(options?.method || 'GET', options.url + options.params || '');
    xhr.send();
  });
}

function formatCur(value, precision=2){return value.toLocaleString('pt-br', {minimumFractionDigits: precision});}


// Ativa bootstrap tooltip
function tooltipActivate(){let tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));let tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {return new bootstrap.Tooltip(tooltipTriggerEl)})}


// dateToday({})                        Retorna data atual no formato dd/mm/aaaa
// dateToday({native: true})            Retorna data atual no formato aaaa-mm-dd  
// dateToday({days: 2, months:1})       Retorna data atual somando 2 dias e 1 mes
// dateToday({target: element})         Altera o elemento informado (no value ou innerHTML) com a data atual
function dateToday(opt={}){
  let today = new Date();
  if(opt.days){today.setDate(today.getDate() + opt.days)}
  if(opt.months){today.setMonth(today.getMonth() + opt.months)}
  if(opt.years){today.setFullYear(today.getFullYear() + opt.years)}
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const yyyy = today.getFullYear();
  if(!opt.target){return opt.native == true ? `${yyyy}-${mm}-${dd}` : `${dd}/${mm}/${yyyy}`;}
  else{
    if(opt.target.hasAttribute('value')){opt.target.value = opt.native == true ? `${yyyy}-${mm}-${dd}` : `${dd}/${mm}/${yyyy}`;}
    else{opt.target.innerHTML = opt.native == true ? `${yyyy}-${mm}-${dd}` : `${dd}/${mm}/${yyyy}`;}
  }
}

// timeNow({})                        Retorna hora atual hh:mm
// timeNow({hours: 3, minutes: 22})   Retorna hora atual somando 3 horas e 22 minutos
// timeNow({showSeconds: true})       Retorna hora atual no formado hh:mm:ss
// timeNow({target: element})         Altera o elemento informado (no value ou innerHTML) com a hora atual
function timeNow(opt={}){
  let today = new Date();
  if(opt.hours){today.setHours(today.getHours() + opt.hours)}
  if(opt.minutes){today.setMinutes(today.getMinutes() + opt.minutes)}
  const hh = String(today.getHours()).padStart(2, '0');
  const ii = String(today.getMinutes()).padStart(2, '0');
  const ss = String(today.getSeconds()).padStart(2, '0');
  if(!opt.target){return opt.showSeconds == true ? `${hh}:${ii}:${ss}` : `${hh}:${ii}`;}
  else{
    if(opt.target.hasAttribute('value')){opt.target.value = opt.showSeconds == true ? `${hh}:${ii}:${ss}` : `${hh}:${ii}`;}
    else{opt.target.innerHTML = opt.showSeconds == true ? `${hh}:${ii}:${ss}` : `${hh}:${ii}`;}
  }
}

/*
* getCookie Busca no arquivo de cookie pela chave informada e retorna o valor
*
* @version  1.0
* @since    31/08/2022
* @author   Rafael Gustavo ALves {@email castelhano.rafael@gmail.com }
* @param    {String} name
* @returns  {String} Valor da chave (se encontrada) ou null caso nao encontrado
* @example  let token = getCookie('csrftoken');
*/
function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== ''){
    const cookies = document.cookie.split(';');
    for(let i = 0; i < cookies.length; i++){
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')){
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

// Exibe modal para confirmacao no evento click para elementos com data-appConfirm="true"
function confirmOnClick(options){
  if(options?.href){document.getElementById('appModalConfirm_link').href = options.href}
  appModalConfirm.show()
}

function isObject(item) { return (item && typeof item === 'object' && !Array.isArray(item))}

// dictIsEqual Recebe dois objetos (dict) e compara se sao iguais, levando em consideracao nao somente primtivos, mais apontadores e objetos
function dictIsEqual(obj1, obj2, seen = new WeakMap()) {
  if (obj1 === obj2) {return true} //para comparacao de valores primitivos, como strings e numeros
  if (obj1 instanceof HTMLElement && obj2 instanceof HTMLElement) {return obj1 === obj2} // Verifica se sao elementos DOM, retorna true apenas se for a mesma instancia de elemento
  if (typeof obj1 !== 'object' || obj1 === null || typeof obj2 !== 'object' || obj2 === null) { return false } // Verifica se nao sao objetos ou se um deles eh nulo
  if (seen.has(obj1) || seen.has(obj2)) {return seen.get(obj1) === obj2} // Trata referencias circulares
  seen.set(obj1, obj2);

  // Obtém as chaves de ambos os objetos
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  
  if (keys1.length !== keys2.length) {return false} // Compara o numero de chaves

  // Percorre as chaves e compara os valores recursivamente
  for (const key of keys1) {
    if (!keys2.includes(key) || !dictIsEqual(obj1[key], obj2[key], seen)) {
      return false;
    }
  }
  return true;
}

// faz deep merge de dois ou mais objetos, uso: deepMerge({}, obj1, obj2)
function deepMerge(target, ...sources) {
  if (!sources.length) return target;
  let source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (let key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        deepMerge(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }
  return deepMerge(target, ...sources);
}
function appNavigateTable(el, options){
// implementa navegacao na tabela (linhas e paginas), adicione data-navigate="true" na tabela para habilitar
// Atencao!! apenas uma tabela por pagina deve usar este recurso para evitar conflito com os atalhos
  let rowIndex = -1;
  let rows = [];
  const table = el.tagName == 'TABLE' ? el : null;
  const actionSelector = options?.actionSelector || '.btn';
  const nav = document.querySelector(`nav[data-target="${table.id}"]`);
  if(!table){return}
  const nextRow = ()=>{
    document.activeElement.blur();
    if (rowIndex < rows.length - 1) {
      rowIndex++;
      highlightRow();
    }
  }
  const previousRow = ()=>{
    document.activeElement.blur();
    if (rowIndex > 0) {
      rowIndex--;
      highlightRow();
    }
  }
  const nextPage = ()=>{
    document.activeElement.blur();
    const nextBtn = nav?.querySelector('.next a');
    if (nextBtn) nextBtn.click();
  }
  const previousPage = ()=>{
    const prevBtn = nav?.querySelector('.previous a');
    if (prevBtn) prevBtn.click();
  }
  const runAction = ()=>{
    let row = rows[rowIndex];
    if (row) { row.querySelector(actionSelector)?.click() }
  }
  const highlightRow = ()=>{
    rows.forEach(r => r.classList.remove('selected'));
    if (rows[rowIndex]) {
      rows[rowIndex].classList.add('selected');
      rows[rowIndex].scrollIntoView({ block: 'nearest' }); // mantem a linha visivel no caso de scroll da tela
    }
  }
  const bindListeners = ()=>{
    let context = table.dataset?.context || 'default';
    appKeyMap.bind('ctrl+arrowdown', ()=>{nextRow()}, {icon: 'bi bi-grid-1x2-fill text-purple', desc:'Tabela: Navega para próxima linha', context: context})
    appKeyMap.bind('ctrl+arrowup', ()=>{previousRow()}, {icon:'bi bi-grid-1x2-fill text-purple', desc:'Tabela: Navega para linha anterior', context: context})
    appKeyMap.bind('ctrl+enter', ()=>{runAction()}, {icon:'bi bi-grid-1x2-fill text-purple', desc:'Tabela: Acessa registro em foco', context: context})
    if(nav){
      appKeyMap.bind('ctrl+arrowright', ()=>{nextPage()}, {icon:'bi bi-grid-1x2-fill text-purple', desc:'Tabela: Exibe próxima página da tabela', context: context})
      appKeyMap.bind('ctrl+arrowleft', ()=>{previousPage()}, {icon:'bi bi-grid-1x2-fill text-purple', desc:'Tabela: Exibe página anterior da tabela', context: context})

    }
  }
  const init = ()=>{
    rows = Array.from(table.querySelectorAll('tbody tr')); // pre carrega as linhas
    bindListeners();
  }
  init();
}



// Codigo a ser executado apos carregamento completo da pagina
document.addEventListener("DOMContentLoaded", function(event) {

  // retorna context para anterior a abertura do modal de confirmacao
  appModalConfirm._element.addEventListener('hide.bs.modal', ()=>{appKeyMap.setContext()})
  if(document.querySelector('[data-appConfirm="true"]')){
    appKeyMap.bind('alt+c', ()=>{document.getElementById('appModalConfirm_button').click()}, {context: 'appConfirmModal', icon: 'bi bi-floppy-fill text-primary', desc: 'Confirma operação'})
  }

  // implementa navegacao em tabela com data-navigate="true"  
  document.querySelectorAll('table[data-navigate="true"]').forEach(t => appNavigateTable(t, t.dataset));

  
  // Exibe modal de confirmacao para elementos com atributo data-appConfirm='true'
  document.querySelectorAll('[data-appConfirm="true"]').forEach((el)=>{
    let timeout, interv, span;
    el.onclick = (e)=>{
      e.preventDefault();
      appKeyMap.setContext('appConfirmModal');
      if(span){
        clearInterval(interv);
        clearTimeout(timeout);
        span.remove();
      }
      if(el.hasAttribute('data-appConfirmTitle')){document.getElementById('appModalConfirm_title').innerHTML = el.getAttribute('data-appConfirmTitle')}
      if(el.hasAttribute('data-appConfirmMessage')){document.getElementById('appModalConfirm_message').innerHTML = el.getAttribute('data-appConfirmMessage')}
      if(el.hasAttribute('data-appConfirmColor')){document.getElementById('appModalConfirm_button').classList = `btn btn-sm btn-${el.getAttribute('data-appConfirmColor')}`}
      if(el.hasAttribute('data-appConfirmText')){document.getElementById('appModalConfirm_button').innerHTML = el.getAttribute('data-appConfirmText')}
      if(el.hasAttribute('href')){
        document.getElementById('appModalConfirm_button').onclick = ()=>{ location.href = el.href };
      }
      else if(el.hasAttribute('onclick')){
        document.getElementById('appModalConfirm_button').onclick = options.onclick;
      }
      if(el.hasAttribute('data-appConfirmDelay')){
        span = document.createElement('span');
        let counter = el.getAttribute('data-appConfirmDelay');
        span.innerHTML = ' ' + counter;
        document.getElementById('appModalConfirm_button').disabled = true;
        document.getElementById('appModalConfirm_button').appendChild(span);
        timeout = setTimeout(()=>{
          span.parentNode.disabled = false;
          clearInterval(interv);
          span.remove();
        }, counter * 1000);
        interv = setInterval(()=>{counter--;span.innerHTML = ` ${counter}`}, 1000);
      }
      appModalConfirm.show();
    }
  })
});