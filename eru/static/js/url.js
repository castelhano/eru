// Funcoes para manipulacao e captura da url

/*
* urlUpdate Adiciona (ou atualiza) parametro na url (metodo GET) 
*
* @version  1.0
* @since    10/02/2022
* @author   Rafael Gustavo ALves {@email castelhano.rafael@gmail.com }
* @param    {String} uri URL alvo
* @param    {String} key Nome do parametro a ser atualizado na url
* @param    {String} value Valor do parametro
* @returns  {String} URL formatada com o novo parametro
* @example  urlUpdate('foo.com', 'nome', 'rafael'); Retorna: foo.com?nome=rafael
*/
function urlUpdate(uri, key, value) {
    var re = new RegExp("([?&])" + key + "=.*?(&|$)", "i");
    var separator = uri.indexOf('?') !== -1 ? "&" : "?";
    if (uri.match(re)) {
      return uri.replace(re, '$1' + key + "=" + value + '$2');
    }
    else {
      return uri + separator + key + "=" + value;
    }
  }
  
  /*
  * urlFilter Funcao atualiza URL com parametro e recarrega pagina
  *
  * @version  1.0
  * @since    10/02/2022
  * @author   Rafael Gustavo ALves {@email castelhano.rafael@gmail.com }
  * @param    {String} filter Nome do parametro a ser atualizado na url
  * @param    {String} value Valor do parametro
  * @example  urlFilter('nome', 'rafael')
  */
  function urlFilter(filter, value){location.href = urlUpdate(window.location.href, filter, value);}
  
  /*
  * urlCleanNFilter Limpa filtros atuais e submete pagina com novos filtros
  *
  * @version  1.0
  * @since    10/02/2022
  * @author   Rafael Gustavo ALves {@email castelhano.rafael@gmail.com }
  * @param    {Array} filters Lista com nome dos filtros
  * @param    {Array} values Lista com valores dos filtros
  * @example  urlCleanNFilter(['id','status'], [22, 1])
  */
  function urlCleanNFilter(filters, values){
    let h = window.location.href.split('?')[0];
    for(i=0;i < filters.length; i++){ h = urlUpdate(h , filters[i], values[i]);}
      location.href = h;
  }
  
  /*
  * urlFilterTo Semelhante a urlFilter() porem nao atualiza pagina corrente, deve ser informado nova url para adicionar parametro
  *
  * @version  1.0
  * @since    12/03/2022
  * @author   Rafael Gustavo ALves {@email castelhano.rafael@gmail.com }
  * @param    {String} url URL para redirecionamento
  * @param    {String} filter Nome do parametro a ser atualizado na url
  * @param    {String} value Valor do parametro
  * @example  urlFilterTo('fei.com', 'nome', 'rafael')
  */
  function urlFilterTo(url, filter, value){location.href = urlUpdate(url, filter, value);}
  
  /*
  * urlFilters() Atualiza url corrente com multiplos parametros 
  *
  * @version  1.0
  * @since    10/02/2022
  * @author   Rafael Gustavo ALves {@email castelhano.rafael@gmail.com }
  * @param    {Array} filters Lista [] com parametros a serem adicionados na url
  * @param    {Array} values Lista [] com valores dos parametros
  * @example  urlFilters(['nome', 'email'], ['rafael', 'foo@gmail.com'])
  */
  function urlFilters(filters, values){let h = window.location.href;for(i=0;i < filters.length; i++){h = urlUpdate(h , filters[i], values[i]);}location.href = h;}
  
  /*
  * urlFilterToogle() Atualiza url corrente com multiplos parametros 
  *
  * @version  1.0
  * @since    12/08/2022
  * @author   Rafael Gustavo ALves {@email castelhano.rafael@gmail.com }
  * @param    {String} filter Nome do parametro
  * @param    {Array } values Valores para serem alterados para o parametro (sempre aciona o proximo valor apos ao valor atual)
  * @example  urlFilterToogle('ativo', ['true', 'false'])
  */
  function urlFilterToogle(filter, values){let atual = urlGet(filter, false);if(atual){let atual_id = values.indexOf(atual);let next = atual_id < values.length - 1 ? values[atual_id + 1] : values[0];urlFilter(filter, next);}else{urlFilter(filter, values[0])}}
  
  /*
  * filtersClean() Remove parametros da URL
  *
  * @version  1.0
  * @since    09/06/2022
  * @author   Rafael Gustavo ALves {@email castelhano.rafael@gmail.com }
  * @param    {Array} filters Lista [] com parametros a serem removidos da url
  * @example  filtersClean(['nome', 'email'])
  */
  function urlClean(filters){let h = window.location.href.split('?')[0];let p = new URLSearchParams(window.location.search);for(i=0;i < filters.length; i++){p.delete(filters[i]);}location.href = p.toString() != '' ? `${h}?${p.toString()}` : h;}
  
  /*
  * urlRedirect Carrega os filtros na url atual para uma nova url
  *
  * @version  1.0
  * @since    01/04/2022
  * @author   Rafael Gustavo ALves {@email castelhano.rafael@gmail.com }
  * @param    {String} url URL para redirecionamento
  * @example  urlRedirect('fei.com')
  */
  function urlRedirect(url){location.href = url + window.location.search;}
  
  /*
  * urlHasParam Retorna se o parametro esta informado na url
  *
  * @version  1.0
  * @since    10/02/2022
  * @author   Rafael Gustavo ALves {@email castelhano.rafael@gmail.com }
  * @param    {String} param Nome do parametro
  * @returns  {Bool} Retorno true se parametro estiver na url ou false caso nao
  * @example  let param = urlHasParam('nome')
  */
  function urlHasParam(param){
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.has(param);
  }
  
  /*
  * urlMap Retorna dicionario com todas as variaveis na url
  *
  * @version  1.0
  * @since    07/04/2022
  * @author   Rafael Gustavo ALves {@email castelhano.rafael@gmail.com }
  * @returns  {Dict} Dicionario com parametros da url
  * @example  let map = urlMap()
  */
  function urlMap(){
    let list = window.location.search.replace('?','').split('&').filter(n => n);
    let dict = {};
    for(i=0;i < list.length;i++){dict[list[i].split('=')[0]] = list[i].split('=')[1];}
    return dict;
  }
  
  /*
  * urlGet Retorna o valor do parametro na url
  *
  * @version  1.0
  * @since    07/04/2022
  * @author   Rafael Gustavo ALves {@email castelhano.rafael@gmail.com }
  * @param    {String} param Nome do parametro
  * @returns  {Generic} Retorno caso parametro nao seja encontrado na url, default = null
  * @example  let param = urlGet('nome')
  */
  function urlGet(param, if_null=null){
    const urlParams = new URLSearchParams(window.location.search);
    let value = urlParams.get(param);
    if(value == null){return if_null}
    else{return value}
  }
  
  /*
  * urlParams Retorna string com todos os parametros da url
  *
  * @version  1.0
  * @since    10/02/2022
  * @author   Rafael Gustavo ALves {@email castelhano.rafael@gmail.com }
  * @returns  {String} String com os parametros da url
  * @example  let params = urlParams()
  */
  function urlParams(){return window.location.search;}
  
  /*
  * urlSetFiltersActive | Para todos os paramentros da url, adiciona a classe 'active' ao classList do elemento correspondente
  *
  * @version  1.0
  * @since    10/02/2022
  * @author   Rafael Gustavo ALves {@email castelhano.rafael@gmail.com }
  * @param    {Dict} filters Dicionario com key sendo o parametro a ser analizado e value sendo o id do elemento a ser estilizado
  * @example  urlSetFiltersActive({'nome':'id_nome_label','email':'id_email_label'})
  */
  function urlSetFiltersActive(listMap){
    for(i in listMap){
      if(i.includes('=') && urlParams().includes(i)){document.getElementById(listMap[i]).classList.add('active');}
      else {if(urlHasParam(i)){document.getElementById(listMap[i]).classList.add('active');}}}}