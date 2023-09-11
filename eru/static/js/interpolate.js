/*
* appPlot Javascript interpolation
*
* @version  1.0
* @since    07/04/2022
* @author   Rafael Gustavo ALves {@email castelhano.rafael@gmail.com }
* @desc     Implementa interpolacao (simplificada) direto no document, buscando attr data-itKey
* @param    {Dict} map Dicionario com nome da variavel e valor para interpolar bo doc
* @example  var map={'foo':55,'fei':22}; appPlot(map); ou appPlot(map, '--'); no html: <label data-itKey="foo" mask="cur" data-itTranslate='{"180":"06 meses"}' data-itDefault="feii" prefix="R$" posfix="real-BR"></label>
* @info     !! Pode gerar conflito com urlPlot() use uma OU outra
* @see      {@link https://stackoverflow.com/questions/62382939/vanilla-htmljs-dynamic-interpolation}
*/
function appPlot(map, if_null=''){
    let data = if_null;
    document.querySelectorAll("[data-itKey]").forEach(el => {
      data = map[el.getAttribute('data-itKey')];
      if(data == undefined){ // Caso nao informado valor
        if(el.getAttribute('data-itDefault') != undefined){data = el.getAttribute('data-itDefault');} // Verifica se elemenento tem valor data-itDefault
        else{data = if_null;}
      }
      if(el.getAttribute('data-itTranslate') != undefined){ // Verifica se valor precisa ser 'traduzido', se sim tenta fazer a traducao
        try{
          let translate_map = JSON.parse(el.getAttribute('data-itTranslate'));
          if(translate_map[data] != undefined){data = translate_map[data];}
        }catch(e){} 
      }
      if(el.getAttribute('data-itMask') != undefined){data = dataMask(data, el.getAttribute('data-itMask'))} // Verifica se valor precisa ser mascarado, caso sim chama funcao auxiliar
      if(el.getAttribute('data-itPrefix') != undefined){data = `${el.getAttribute('data-itPrefix')} ${data}`}
      if(el.getAttribute('data-itPosfix') != undefined){data = `${data} ${el.getAttribute('data-itPosfix')}`}
      el.innerText = data;
     })
  }
  
  /*
  * urlPlot Javascript interpolation buscando variaveis na url
  *
  * @version  1.0
  * @since    07/04/2022
  * @author   Rafael Gustavo ALves {@email castelhano.rafael@gmail.com }
  * @example  urlPlot(); ou urlPlot('--') no html: <label data-itKey="foo" mask="cur" data-itTranslate='{"180":"06 meses"}'></label>
  * @info     !! Pode gerar conflito com appPlot() use uma OU outra
  * @see      {@link https://stackoverflow.com/questions/62382939/vanilla-htmljs-dynamic-interpolation}
  */
  function urlPlot(if_null=''){
    let list = window.location.search.replace('?','').split('&').filter(n => n);
    let map = {};
    for(i=0;i < list.length;i++){map[list[i].split('=')[0]] = list[i].split('=')[1];}
    appPlot(map, if_null);
  }
  
  /*
  * dataMask Funcao auxiliar para maskarar dados
  *
  * @version  1.0
  * @since    08/04/2022
  * @author   Rafael Gustavo ALves {@email castelhano.rafael@gmail.com }
  * @param    {Generic} data Valor a ser mascarado
  * @param    {String} format Formato da mascara
  * @example  dataMask(value, 'cur');
  * @depend   vendor/mask.js
  */
  function dataMask(data, mask=''){
    try {
      let isNumber = /^\d+(?:\.\d+)?$/.test(data);
      if(mask == 'cur' && isNumber){return VMasker.toMoney(parseFloat(data).toFixed(2))}
      else if(mask.match(/^0/) && mask.replace(/0/g,'') == '' && isNumber){return String(data).padStart(mask.length,'0');} // ZFILL n times 00 ou 000 ou 00000
      return data; //Caso nao achar formato compativel retorna a data_raw
    }catch(e){return data;} 
  }