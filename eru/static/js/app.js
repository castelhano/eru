const appModalConfirm = new bootstrap.Modal(document.getElementById('appModalConfirm'), {});
// const appModalLoading = new bootstrap.Modal(document.getElementById('appModalLoading'), {keyboard: false});


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
  e.innerHTML = options?.i18n ? i18n.getEntry(options.i18n) : mensagem; 
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
  e.innerHTML = options?.i18n ? i18n.getEntry(options.i18n) : mensagem; 
  e.appendChild(b);
  document.getElementById('notify_container').appendChild(e); 
  if(options.autodismiss){setTimeout(function() {e.remove()}, 4500);} 
}
// function appNotify(tipo, mensagem, autodismiss=true){
//   let e = document.createElement('div'); 
//   e.classList = `alert alert-${tipo} alert-dismissible slideIn mb-2`; 
//   let b = document.createElement('button'); 
//   b.classList = 'btn-close'; 
//   b.setAttribute('data-bs-dismiss','alert'); 
//   e.innerHTML = mensagem; 
//   e.appendChild(b);
//   document.getElementById('notify_container').appendChild(e); 
//   if(autodismiss){setTimeout(function() {e.remove()}, 4500);} 
// }

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

// Exibe modal para confirmacao no evento click para elementos com data-appConfirm="true"
function confirmOnClick(options){
  if(options?.href){document.getElementById('appModalConfirm_link').href = options.href}
  appModalConfirm.show()
}

// Script executado logo antes de fazer logout no sistema (rotinas de limpeza, dentre outros)
function appOnLogout(url){
  let removeOnLocalStorage = ['i18nLanguage', 'i18nApps', 'i18nDB']
  removeOnLocalStorage.forEach((el)=>{localStorage.removeItem(el)})
  location.href = url;
}

// Exibe modal de carregamento antes de sair da pagina
// var appModalLoadingTimeLimit = 8000; // Tempo limite em milisegundos para alteracao da mensagem do modal
// var appModalLoadingTimeLimitIcon = '<i class="bi bi-exclamation-octagon-fill text-danger h2"></i>'
// var appModalLoadingTimeLimitMessage = '<b class="text-danger"></b>Este processo esta demorando mais que o normal...'

// window.onbeforeunload = (ev) => {
//   appModalLoading.show();
//   window.setTimeout(()=>{ // Se servidor demorar mais tempo que o definido, altera mensagem 
//     document.getElementById('appModalLoadingIcon').innerHTML = appModalLoadingTimeLimitIcon;
//     document.getElementById('appModalLoadingMessage').innerHTML = appModalLoadingTimeLimitMessage;
//   }, appModalLoadingTimeLimit);
// }

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

// Codigo a ser executado apos carregamento completo da pagina
document.addEventListener("DOMContentLoaded", function(event) {

  // Exibe modal de confirmacao para elementos com atributo data-appConfirm='true'
  document.querySelectorAll('[data-appConfirm=true]').forEach((el)=>{
    let timeout, interv, span;
    el.onclick = (e)=>{
      e.preventDefault();
      if(span){
        clearInterval(interv);
        clearTimeout(timeout);
        span.remove();
      }
      if(el.hasAttribute('data-appConfirmTitle')){document.getElementById('appModalConfirm_title').innerHTML = el.getAttribute('data-appConfirmTitle')}
      if(el.hasAttribute('data-appConfirmMessage')){document.getElementById('appModalConfirm_message').innerHTML = el.getAttribute('data-appConfirmMessage')}
      if(el.hasAttribute('href')){
        document.getElementById('appModalConfirm_link').classList.remove('d-none');
        document.getElementById('appModalConfirm_button').classList.add('d-none');
        document.getElementById('appModalConfirm_link').href = el.href;
        if(el.hasAttribute('data-appConfirmColor')){document.getElementById('appModalConfirm_link').classList = `btn btn-sm btn-${el.getAttribute('data-appConfirmColor')}`}
        if(el.hasAttribute('data-appConfirmText')){document.getElementById('appModalConfirm_link').innerHTML = el.getAttribute('data-appConfirmText')}
        setTimeout(()=>{document.getElementById('appModalConfirm_link').focus();}, 500);
      }
      else if(el.hasAttribute('onclick')){
        if(el.hasAttribute('data-appConfirmColor')){document.getElementById('appModalConfirm_button').classList = `btn btn-sm btn-${el.getAttribute('data-appConfirmColor')}`}
        if(el.hasAttribute('data-appConfirmText')){document.getElementById('appModalConfirm_button').innerHTML = el.getAttribute('data-appConfirmText')}
        document.getElementById('appModalConfirm_link').classList.add('d-none');
        document.getElementById('appModalConfirm_button').classList.remove('d-none');
        document.getElementById('appModalConfirm_button').onclick = options.onclick;
        setTimeout(()=>{document.getElementById('appModalConfirm_button').focus();}, 500);
      }
      if(el.hasAttribute('data-appConfirmDelay')){
        span = document.createElement('span');
        let counter = el.getAttribute('data-appConfirmDelay');
        span.innerHTML = ' ' + counter;
        if(el.hasAttribute('href')){
          document.getElementById('appModalConfirm_link').classList.add('disabled');
          document.getElementById('appModalConfirm_link').appendChild(span);
        }
        else{
          document.getElementById('appModalConfirm_button').disabled = true;
          document.getElementById('appModalConfirm_button').appendChild(span)
        } 
        timeout = setTimeout(()=>{
          span.parentNode.classList.remove('disabled');
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