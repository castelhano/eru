# Keywatch.js — Manual de Uso

Este documento descreve a biblioteca `Keywatch` presente em `static/js/keywatch.js`.
Ele inclui visão geral, API pública, opções configuráveis, exemplos de uso, detalhes de compatibilidade e problemas conhecidos.

**Versão:** 6.3+

**Autor:** Rafael Alves `castelhano.rafael@gmail.com`

---

**Índice**

- Visão Geral
- Instalação / Inclusão
- Conceitos Principais
- API Pública
  - Construtor
  - `.bind()`
  - `.unbind()` / `.unbindGroup()` / `.unbindContext()` / `.unbindAll()`
  - `.run()`
  - `.showKeymap()`
  - Contextos: `.addContext()`, `.setContext()`, `.getContext()`
  - `.avail()`
- Opções (handler e default)
- Eventos Internos Relevantes
- Comportamento para teclas "composed"
- Compatibilidade de navegadores e teclados
- Troubleshooting (problemas comuns)
- Migrando / Changelog resumido

---

**Visão Geral**

`Keywatch` é uma biblioteca para gerenciar atalhos de teclado além de implementar tabulação via tecla Enter em formulários quando desejado. Ela suporta atalhos múltiplos, trigger para eventos keydown e/ou keyup, contextos, teclas communs operando como modificador, grupos e integração com i18n.

Foi desenhada para tratar eventos de teclado em elementos de formulário (aceita por padrão atalhos com foco em `inputs`) e opera com `event.key` (normalizado) como padrão para garantir compatibilidade entre layouts de teclado e navegadores.

Implementa de maneira automática lista de atalhso disponíveis na página / contexto.


**Instalação / Inclusão**

Basta incluir o arquivo `static/js/keywatch.js` no bundle da sua aplicação ou importar no HTML:

```html
<script src="/static/js/keywatch.js"></script>
<script>
  const appKeyMap = new Keywatch(options);
</script>
```

Se você usa bundler (webpack/rollup), importe o arquivo como módulo se estiver exportado, ou simplesmente inclua no bundle.


**Conceitos Principais**

- `pressed`: array com as teclas atualmente pressionadas (normalizadas via `_normalize`).
- `handlers`: objeto com os atalhos registrados separados por `keydown`/`keyup`, `context` e `scope`.
- `context`: contexto ativo, `default` e `all` criados pela lib, atalhos no contexto `all` são executados indiferente do contexto ativo. 
- `contextPool`: pilha de contextos gerenciada de maneira automática pela lib.
- `composedMatch` / `composedTrigger`: mecanismo para lidar com atalhos que usam modificadores não convencionais quando o foco está em um `input`, `select` ou `textarea`.


**API Pública**

Construtor

```js
const appKeyMap = new Keywatch(options = {});
```

- `options` aceita chaves definidas em `defaultOptions` (veja seção Opções) e sobrepõe valores padrões.

Principais métodos

- `bind(scope, method, options = {})`
  - `scope`: string que descreve o atalho, ex: `'ctrl+e'`, `'g+i;alt+i'` (vários escopos separados por `;`).
  - `method`: função chamada quando atalho é acionado. Recebe `(ev, eventObject)`.
  - `options`: sobrepõe `handlerOptions` (context, keydown/keyup, element, preventDefault, etc.). Exemplo:
    ```js
    appKeyMap.bind('ctrl+s', (ev, info) => { save() }, {context: 'editor', preventDefault: false})
    ```

- `unbind(scope, options = {})`
  - Remove um atalho. `options.type` pode ser `'keydown'` ou `'keyup'`. Se omitido, remove ambos. `options.context` para limitar o contexto.

- `unbindGroup(group)`
  - Remove todos os atalhos que pertencem a `group`.

- `unbindContext(context)`
  - Remove todos os atalhos de um `context`.

- `unbindAll()`
  - Remove todos os atalhos registrados.

- `run(scope, options = {})`
  - Executa o handler registrado para `scope` (útil para testes). `options` pode especificar `type` (keydown/keyup), `context` e `element`.
Exemplo:
```js
appKeyMap.run('ctrl+s')
```

- `showKeymap()`
  - Exibe o modal com a lista de atalhos (se o atalho `shortcutMaplist` estiver definido, default `alt+k`, altere para `null` para desabilitar criação do modal ). Ao abrir modal trava execução de atalhos (`this.locked`). Por padrão exibe somente atalhos do contexto ativo, altere `options.shortcutMaplistOnlyContextActive` para `false` ao instanciar classe para exibir todos os atalhos cadastrados. Ao criar um abalho `.bind()` adicione {display: false} caso queira omitir atalho no modal.

- Context APIs
  - `addContext(context)` — cria novo contexto (não altera contexto ativo) .
  - `setContext(context)` — empilha contextos, e a chamada sem argumento volta ao contexto anterior. `setContext` cria automaticamente contexto caso esse ainda não exista.
  - `getContext()` — retorna contexto ativo 

- `avail(scope, options={})`
  - Retorna booleano se um `scope` está livre (não usado). Útil para detectar colisões antes de registrar. Pode ser definido contexto em options para filtrar análise.


**Opções**

Handler options (cada `bind` recebe cópia de `handlerOptions`):

- `context` (string) default: `'default'`
- `desc` (string) descrição usada no modal de atalhos
- `icon` (string) classe para icone usado no modal de atalhos
- `element` (element DOM) onde o handler é aplicável, default: `document`
- `origin` (string) optional, usado para facilitar rastreio do atalho
- `group` (string) grupo de atalho, default: null
- `display` (boolean) se `false` não exibe atalho no modal, default: `true`
- `preventDefault` (boolean) previne comportamento padrão do atalho, default: `false`
- `useCapture` (boolean) se true atalho terá prioriade de execução em relação a demais atalhos, default: `false`
- `keydown` (boolean) se true atalho será acionado no evento keydown, default: `true`
- `keyup` (boolean) se true atalho será acionado no evento keydown, default: `false`
- `composed` (boolean) marcado automaticamente para atalhos que usam modificadores não convencionais
- `data-i18n` (string) string com chave de integração com lib `i18n`

Default options (no construtor `options`):
- `splitKey`: `'+'`
- `separator`: `';'`
- `tabOnEnter`: `true`
- `shortcutMaplist`: `'alt+k'` (pode ser setado para `null`)
- `composedTrigger`: `';'` — caractere que confirma atalhos `composed` quando foco está em input
- `composedListener`: `(type, scope)=>{}` — callback chamado quando composed inicia/finaliza
- `i18nHandler`: null — integração com i18n

Opções de estilização:
- `shortcutModalClasslist`: 'w-100 h-100 border-2 border-secondary bg-dark-subtle mt-3',
- `searchInputClasslist`: 'form-control form-control-sm',
- `searchInputPlaceholder`: 'Criterio pesquisa',
- `contextLabelClasslist`: 'fs-8 text-body-tertiary position-absolute',
- `contextLabelStyle`: 'top: 22px; right: 25px;',
- `modalTableClasslist`: 'table table-sm table-bordered table-striped mt-2 fs-7',
- `modalTableLabelClasslist`: 'border rounded py-1 px-2 bg-dark-subtle text-body-secondary font-monospace',
- `shortcutModalTableDetailClasslist`: 'fit text-center px-3',
- `shortcutModalTableDetailText`: '<i class="bi bi-question-lg"></i>',
- `shortcutModalTableDetailItemText`: '<i class="bi bi-list d-block text-center pointer"></i>'

---

**Comportamento para teclas "composed"**

- Atalhos `composed` (que usam teclas que geram caracteres, ou teclas básicas como modificador) quando acionados com foco em `input/textarea/select` não são acionados de maneira automática, e aguardam o `composedTrigger` (padrão `;`) como próxima tecla para confirmar o acionamento.
- A interação de composed usa `this.composedMatch` para armazenar estado entre eventos e chama `this.composedListener(true, scope)` quando composed é iniciado, e `this.composedListener(false, scope)` quando finalizado., podendo ser usado para resposta visual ao usuário (por exemplo).


**Compatibilidade de navegadores e teclados**

- A biblioteca usa `event.key` como base — isso garante compatibilidade entre layouts de teclado e navegadores modernos.
- `event.code` é usado apenas como *fallback* para detectar e remover modificadores (`Alt`, `Control`, `Shift`, `Meta`) no `keyup` quando `event.key` não identifica corretamente o modificador (caso de composições com caracteres).
- `Optional chaining` (`?.`) está presente no código; se for necessário suportar IE11, substitua por verificações tradicionais ou transpile com Babel.

Suporte esperado (sem transpiler): Chrome 60+, Firefox 60+, Safari 12+, Edge 79+. Para IE11, há features modernas no código que requerem transpile/polyfill.


**Troubleshooting (Problemas Comuns)**

- Biblioteca trata eventos acionados em formulários porém teclas ainda podem ficar *'presas'* em `this.pressed` ao interagir com elementos `select`. Precione a tecla `Escape` a qualquer momento para destravar e limpar `this.pressed`.
- "Alt + número gera caractere e quebra remoção do `alt` no keyup": solucionado com `_removeKeyFromPressed(ev)` que usa `event.code` como fallback para modificadores.
- "Modal de atalhos lento ao renderizar muitos itens": verifique se a versão do arquivo contém a otimização com `DocumentFragment` — a renderização deve estar O(n) com n atalhos.
- "Atalho não disparou dentro de um input": se o atalho usa teclas comuns como modificador (ex: `c+o`) e o foco está no input, por segurança a biblioteca espera o `composedTrigger` para evitar acionamentos acidentais. Você pode ajustar `composedTrigger` ou desabilitar comportamento alterando a opção `composed` no handler.
- "Compatibilidade com IE11": transpile com Babel e inclua polyfills para `String.prototype.replaceAll`, `Object.hasOwn`, `Optional chaining` e `DocumentFragment` se necessário.


**Exemplos Práticos**

1) Atalho global para salvar (Ctrl+S):  
alias `ctrl` pode ser usado ao invés de `control`
```js
const keywatch = new Keywatch();
keywatch.bind('control+s', (ev, info) => {
  saveDocument();
}, {context: 'all', desc: 'Salvar documento'});
```

2) Atalho que responde tanto a `g+i` quanto `alt+i`:

```js
keywatch.bind('g+i;alt+i', () => { openUserModal() }, {desc: 'Abre modal de usuario', preventDefault: false});
```

3) Atalho somente no keyup:

```js
keywatch.bind('ctrl+shift+x', (ev)=>{doSomething()}, {keyup: true, keydown: false});
```

4) Verificar disponibilidade antes de bind:

```js
if(keywatch.avail('ctrl+k', {context: 'default'})){
  keywatch.bind('ctrl+k', handler, {context: 'default'})
}
```


**Changelog resumido (relevante para esta análise)**

- `6.3` — adicionado tratamento para atalhos composed quando foco está em inputs; remoção de suporte para teclas de acento; melhorias em i18n; otimizações de performance aplicadas ao modal de atalhos.


---

Arquivo original: `static/js/keywatch.js`