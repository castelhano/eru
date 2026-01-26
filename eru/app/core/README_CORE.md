# 📖 Documentação Técnica do Sistema

Este documento centraliza as instruções de uso do ecossistema de Tabelas, Filtros, Mixins, Widgets e demais componentes customizados do projeto.

---

## 🏗 1. TableCustomMixin
Mixin integrado ao `django-table2`, automatiza o visual Bootstrap 5, responsividade, normalização de campos e geração da coluna de ações.

### Configurações no `class Meta` da Tabela:

| Atributo | Tipo | Descrição |
| :--- | :--- | :--- |
| `edit_url` | `str` | Nome da rota (URL) para o botão de edição padrão. |
| `action_innerhtml` | `str/html` | (Opcional) Ícone ou texto para o botão de edição. |
| `action_classlist` | `str` | (Opcional) Classes CSS para o botão de edição (ex: `btn-primary`). |
| `extra_actions` | `list` | Lista de dicionários para botões extras. |
| `responsive_columns` | `dict` | Mapeamento de colunas e classes de breakpoint (ex: `{"id": "d-none"}`). |
| `export_csv` | `bool` | Se `True`, exibe o botão de exportação no formulário de filtro. |

### Exemplo de Uso:
```python
class GrupoTable(TableCustomMixin, Table):
    class Meta:
        model = Group
        fields = ("id", "name")
        edit_url = "grupo_update"               # Botão padrão de ação
        extra_actions = [                       # Insere botões adicionais
            {
                'action': 'users',              # Chave do componente btn_tag
                'url_name': 'usuario_grupo',    # Nome da URL de destino
                'url_params': {'edit': 'id'},   # Injeta parametros na url
                'label': mark_safe('<i class="bi bi-people"></i>'),
                'class': 'btn btn-sm btn-info',
                'use_pk': True,                  # Envia o ID do registro para a URL (default: True)
                # 'use_pk': 'funcionario_id'     # Ou especifique campo diferente do id do registro
            }
        ]
        attrs = {
            "class": "table table-sm",          # Classes da tabela
            "data-navigate": "false",           # Habilita navegação
            'data-action-selector': '.btn-info' # Altera seletor para acesso a linha
        }
```
<br><br>
---
# 🔍 Guia do Sistema de Filtros Dinâmicos

Esta seção descreve como configurar e personalizar os formulários de pesquisa utilizando o sistema de **CSS Grid Flexível** integrado ao `TableCustomMixin`, usando `auto_filter_form.html` como template.

---

## 📐 1. Lógica de Grid (Layout)

O formulário de filtros organiza os campos automaticamente. Diferente do sistema de 12 colunas do Bootstrap, este utiliza **CSS Grid** para uma distribuição mais fluida.

### Atributos Customizados (no Widget do Campo)

| Atributo | Valor | Função |
| :--- | :--- | :--- |
| `class_cols` | `'n'` | Define quantas "colunas" de espaço o campo deve ocupar (Span). |
| `class` | `form-control-sm` | Gerenciado pelo `TableCustomMixin` para padronizar o tamanho. |

### Exemplo de Implementação no `FilterSet`:

```python
class SeuFilter(django_filters.FilterSet):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        
        # Campo 'nome' ocupará o dobro do espaço dos demais
        self.filters['nome'].field.widget.attrs.update({'class_cols': '2'})     
```
<br>

## 📱 2. Responsividade e Comportamento

O sistema de filtros utiliza uma lógica adaptativa baseada em **CSS Grid**, garantindo que o formulário seja funcional em qualquer dispositivo sem necessidade de configurações manuais por campo.

### Regras de Dimensionamento
- **Largura Mínima (`minmax: 250px`)**: Garante que nenhum campo de entrada fique tão estreito a ponto de esconder o conteúdo (como datas e selects).
- **Limite de Expansão (`max-width: 450px`)**: Aplicado a campos de coluna única (`span 1`) para evitar que inputs fiquem excessivamente largos em monitores Ultra-Wide.
- **Distribuição de Espaço (`1fr`)**: O espaço restante na linha é distribuído igualmente entre os campos visíveis.

### Comportamento Mobile (Quebra Forçada)
O sistema detecta telas menores que **600px** e aplica automaticamente as seguintes regras via Media Query:
- **Força Coluna Única**: Todos os campos passam a ocupar `grid-column: span 1`, ignorando qualquer configuração de `class_cols` definida no Python.
- **Largura Total**: O `max-width` é resetado para `100%`, otimizando a área de toque para usuários em dispositivos móveis.

---
<br>

## 🔗 3. Selects Encadeados (AJAX)

Para configurar campos onde as opções dependem de uma seleção anterior (ex: Empresa -> Filial ou Setor -> Cargo), utilize os atributos de dados no widget do filtro.

### Atributos Necessários:
| Atributo | Descrição |
| :--- | :--- |
| `data-chained-field` | O ID HTML do campo "Pai" (Ex: `id_empresa`). |
| `data-url` | A URL da view/API que retorna o JSON filtrado. |
| `class` | Classes do controle, recomenda incluir `select-chained` para futuras implementações. |

### Exemplo no `__init__`:
```python
self.filters['cargo'].field.widget.attrs.update({
    'data-chained-field': 'id_setor',
    'data-url': reverse_lazy('pessoal:cargo_list'),
    'class': 'form-select form-select-sm select-chained'
})
```
<br>

# 🛠️ Form BootstrapMixin

Este Mixin é utilizado em classes `Form` e `ModelForm` para automatizar a compatibilidade com o **Bootstrap 5**, injetando classes CSS, normalizando campos de data e sincronizando validações de back-end com o HTML5.

---

## ⚙️ 1. Funcionalidades Principais

| Recurso | Descrição |
| :--- | :--- |
| **Normalização de Data** | Converte `DateField` para o tipo HTML `date`, garantindo o seletor nativo do navegador. |
| **Mapeamento CSS** | Atribui automaticamente `form-select` para seletores e `form-control` para inputs comuns. |
| **Floating Labels** | Garante que todo campo possua um `placeholder`, requisito para o efeito *Floating Label* do Bootstrap. |
| **Sincronização HTML5** | Transpõe atributos de validação do Django (`max_length`, `min_value`) para atributos HTML (`maxlength`, `min`). |
| **Label i18n** | Injeta um método no bound field para renderização de label customizada integrada com i18n do django. |

<br>

## 🚀 2. Como Utilizar no Template

O Mixin permite renderizar o campo e o label separadamente de forma elegante:

```html
<div class="form-floating mb-3">
    {{ form.nome }}
    {{ form.nome.i18n_label }}
</div>
```
<br>

## 🔍 3. Detalhes de Implementação

### Mapeamento Automático de Classes
O Mixin identifica o tipo de widget utilizado e aplica a classe CSS correspondente do Bootstrap 5. Caso o campo já possua classes definidas manualmente, elas são **preservadas** e concatenadas.

- **`form-check-input`**: Aplicado a Checkboxes e Radios.
- **`form-select`**: Aplicado a Selects simples ou múltiplos.
- **`form-control`**: Aplicado a todos os demais inputs (text, number, email, etc).

### Normalização de Campos de Data
Para campos do tipo `DateField`, o Mixin força:
1. `input_type = 'date'`: Ativa o calendário nativo do navegador.
2. `format = '%Y-%m-%d'`: Garante a compatibilidade do valor entre o Django e o padrão exigido pelo HTML5.

<br>

## 🛡️ 4. Sincronização de Validadores (HTML5)

O Mixin realiza a transposição automática das regras de validação definidas no modelo/formulário para o navegador:

| Atributo Django | Atributo HTML5 | Função |
| :--- | :--- | :--- |
| `max_length` | `maxlength` | Limita a quantidade de caracteres. |
| `min_length` | `minlength` | Exige uma quantidade mínima de caracteres. |
| `max_value` | `max` | Define o valor numérico máximo. |
| `min_value` | `min` | Define o valor numérico mínimo. |

<br>

## 🏷️ 5. Renderização de Labels (i18n_label)

O Mixin injeta dinamicamente o atributo `i18n_label` em cada campo vinculado (*BoundField*). Isso facilita a construção de layouts customizados, especialmente para **Floating Labels**.

**Estrutura gerada:**
```html
<label for="id_do_campo">Nome do Label (translate)</label>
```
<br>

# 📥 CSVExportMixin

Mixin adiciona a capacidade de exportação de dados para o formato CSV diretamente a partir de qualquer `ListView` que utilize o **Django-Tables2**.

---

## ⚙️ 1. Funcionamento Técnico

O Mixin intercepta a requisição quando detecta o parâmetro `_export=csv` na URL. Ele utiliza a própria estrutura da **Table** definida na View para determinar quais colunas devem ser exportadas, garantindo que o CSV seja fiel ao que o usuário vê na tela.

### Recursos Integrados:
- **Codificação UTF-8 com BOM**: Garante que caracteres especiais (acentos) abram corretamente no Microsoft Excel.
- **Delimitador `;`**: Padronizado para o sistema regional brasileiro.
- **Processamento de QuerySets Grandes**: Utiliza `.iterator()` para processar milhares de registros sem estourar a memória do servidor.
- **Cookie de Controle**: Define `fileDownload=true`, útil para scripts de front-end que gerenciam estados de carregamento.

<br>

## 🚀 2. Configuração na Tabela (`Table.Meta`)

Você pode controlar o comportamento da exportação diretamente na classe `Meta` da sua tabela:

| Atributo | Tipo | Descrição |
| :--- | :--- | :--- |
| `export_csv` | `bool` | Ativa a visibilidade do botão de exportação no formulário de filtro. |
| `exclude_from_export` | `list` | Lista de nomes de colunas que NÃO devem ir para o CSV (Ex: `['id', 'foto']`). |

*Nota: As colunas `actions` e `acoes` são excluídas automaticamente.*

<br>

## 🔍 3. Lógica de Extração de Dados

O Mixin possui uma lógica de busca de valores em cascata para cada coluna:
1. **Atributo Direto**: Tenta encontrar o valor direto no objeto (`obj.campo`).
2. **Acessor Dinâmico**: Resolve caminhos complexos (Ex: `contratos__cargo__nome`).
3. **Display de Choices**: Detecta campos com `choices` e exporta o texto amigável em vez do código.
4. **Métodos Render**: Se a tabela possuir um método `render_coluna`, o Mixin o utiliza para formatar o valor.

<br>

## 📅 4. Formatação de Tipos de Dados

| Tipo de Dado | Formatação no CSV |
| :--- | :--- |
| **Data e Hora** | `DD/MM/AAAA HH:MM` |
| **Data Simples** | `DD/MM/AAAA` |
| **Relacionamentos (M2M)** | Transforma a lista de objetos em uma string separada por `;` |
| **HTML** | Todas as tags HTML são removidas (`strip_tags`) para manter o CSV limpo. |

<br>

## 💡 Exemplo de Uso na View

```python
class FuncionarioListView(CSVExportMixin, BaseListView):
    model = Funcionario
    table_class = FuncionarioTable
    # O Mixin cuidará do resto assim que o botão CSV for clicado
```