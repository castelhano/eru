// Adiciona botao para copiar para clipboard conteudo dentro das tags pre > code (integracao com prism.js)
document.querySelectorAll('pre').forEach((el) => {
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