const __sw = screen?.width || null;
const __ss = __sw == null ? null : __sw >= 1400 ? 'xxl' : __sw >= 1200 ? 'xl' : __sw >= 992 ? 'lg' : __sw >= 768 ? 'md' : 'sm' ;

const appModalLoading = new bootstrap.Modal(document.getElementById('appModalLoading'), {keyboard: false});

/*
* appAlert  Gera um alerta (bootstrap alert), somente um alerta aberto a cada momento
* appNotify Gera uma notificação (stackable), na caixa de notificação do sistema
*
* @author   Rafael Gustavo ALves {@email castelhano.rafael@gmail.com }
* @param    {String} tipo Tipo do alerta (info, danger, warning, success, primary, etc..)
* @param    {String} mensagem Mensagem do alerta
* @param    {Bool} autodismiss [Opcional] Remove automaticamente alerta apos 4,5 segundos se setado para true (default), altere para false para exigir remocao manual
* @example  appAlert('warning', 'Este eh um <b>alerta de exemplo</b>')
* @example  appNotify('danger', 'Este eh um <b>alerta de exemplo</b>')
*/

function appAlert(tipo, mensagem, autodismiss=true){
    try {document.querySelector('[data-type="appAlert"]').remove();}catch(e){}let e = document.createElement('div');e.setAttribute('data-type','appAlert');e.style.zIndex = 100;let b = document.createElement('button');b.classList.add('btn-close');b.setAttribute('data-bs-dismiss','alert');e.classList.add('alert','slideIn','appAlert',`alert-${tipo}`,'alert-dismissible','fade','show','mb-0');e.innerHTML = mensagem;e.appendChild(b);document.body.appendChild(e);if(autodismiss){setTimeout(function() {e.remove()}, 5000);}}
  
function appNotify(tipo, mensagem, autodismiss=true){
  let e = document.createElement('div'); e.classList = `alert alert-${tipo} alert-dismissible slideIn mb-2`; let b = document.createElement('button'); b.classList = 'btn-close'; b.setAttribute('data-bs-dismiss','alert'); e.innerHTML = mensagem; e.appendChild(b);document.getElementById('notify_container').appendChild(e); if(autodismiss){setTimeout(function() {e.remove()}, 4500);} }

// Limpa area de notificacao
function cleanNotify(){document.getElementById('notify_container').innerHTML = '';}



// Busca dados no servidor (espra um json como resposta), retorna promise
// Ex: appGetData({url: '...'}).then(()=>{...do something})
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



// Ativa bootstrap tooltip
function tooltipActivate(){let tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));let tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {return new bootstrap.Tooltip(tooltipTriggerEl)})}


// dataToday({})                        Retorna data atual no formato dd/mm/aaaa
// dataToday({native: true})            Retorna data atual no formato aaaa-mm-dd  
// dataToday({days: 2, months:1})       Retorna data atual somando 2 dias e 1 mes
// dataToday({target: element})         Altera o elemento informado (no value ou innerHTML) com a data atual
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
// timeNow({hours: 3})                Retorna hora atual somando 3 horas
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

// Adiciona botao para copiar para clipboard conteudo dentro das tags pre > code (integracao com prism.js)
function addOnCopyToClipboard(selector='pre'){
  document.querySelectorAll(selector).forEach((el) => {
    if(navigator.clipboard && __ss != 'sm'){
      let container = document.createElement('div');container.style.position = 'relative';container.style.height = '1px';container.style.zIndex = '1000';
      let btn = document.createElement('span');
      btn.title = 'Copiar';
      btn.classList.add('code-btn-copy');
      btn.innerHTML = '<i class="bi bi-clipboard"></i>';
      btn.addEventListener('click', code_copy_clipboard);
      container.appendChild(btn);
      el.before(container);
    }
  });

  function code_copy_clipboard(e){ // Funcao auxiliar ao componente prism
    let copyLabel = '<i class="bi bi-clipboard"></i>';
    let doneLabel = '<i class="bi bi-check-lg"></i>';
    let b = e.target.tagName == 'SPAN' ? e.target : e.target.parentElement;
    let t = b.parentNode.nextSibling.innerText;
    navigator.clipboard.writeText(t);
    b.innerHTML = doneLabel;
    setTimeout(()=>{b.innerHTML = copyLabel;}, 2000)
  }
}


// Listeners / Configuracoes gerais
// **

// Exibe modal de carregamento antes de sair da pagina
window.onbeforeunload = () => {appModalLoading.show()}