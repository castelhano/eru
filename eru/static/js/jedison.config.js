




/**
 * applyLayout(schema, overrides, path)
 * 
 * Mescla configurações de apresentação (layout) do Jedison em um schema JSON
 * gerado pelo servidor, sem modificar os dados de validação originais.
 * 
 * ─── CHAVES ESPECIAIS ────────────────────────────────────────────────────────
 * 
 *  __root__   Aplicado apenas no nó raiz do schema
 *  __all__    Aplicado em todos os nós e todas as properties em todos os níveis
 *  __node__   Aplicado apenas nos nós que contêm properties (objetos/grupos), em todos os níveis
 *  __props__  Aplicado apenas nos fields (filhos diretos de um nó)
 *  
 *  Exemplo: 
 *  {'__root__': {'description': 'Cadastro Geral'}, '__node__': {'x-format': 'grid'}, ....}
 * 
 * ─── PATHS ESPECÍFICOS ───────────────────────────────────────────────────────
 * 
 *  Paths usam notação de ponto espelhando a estrutura do schema.
 *  Sempre prevalecem sobre as chaves especiais.
 * 
 *  Exemplos:
 *    'folha'                   → nó folha
 *    'folha.dia_fechamento'    → field dentro de folha
 *    'folha.sub.campo'         → field em nível mais profundo
 * 
 * ─── PRECEDÊNCIA (menor para maior) ─────────────────────────────────────────
 * 
 *  __all__ → __node__ / __props__ → path específico
 * 
 *  Propriedades mais específicas sempre sobrescrevem as mais genéricas.
 * 
 * ─── EXEMPLO DE USO ──────────────────────────────────────────────────────────
 * 
 *  const layoutOverrides = {
 *      '__root__': {
 *          'description': 'Configure os parâmetros desta filial.',
 *      },
 *      '__all__': {
 *          'x-enableCollapseToggle': true,
 *      },
 *      '__node__': {
 *          'x-format': 'grid',
 *      },
 *      '__props__': {
 *          'x-grid': {'columns': 6},
 *      },
 *      'folha.dia_fechamento': {
 *          'x-format': 'range',
 *          'x-grid': {'columns': 12},     // sobrescreve __props__
 *          'description': 'Dia do fechamento da folha.',
 *      },
 *      'folha.permite_adiantamento': {
 *          'x-containerAttributes': {'data-switch': 'true'},
 *      },
 *  }
 * 
 *  const editor = new Jedison.Create({
 *      container: document.getElementById('editor_holder'),
 *      theme: new Jedison.ThemeBootstrap5(),
 *      schema: applyLayout(schema, layoutOverrides),
 *      data: startval,
 *  });
 */
function applyLayout(schema, overrides, path = '') {
    if (path === '' && overrides['__root__']) {
        Object.assign(schema, overrides['__root__']);
    }

    if (schema.properties) {
        // __all__ e __node__ aplicados no nó atual
        if (overrides['__all__']) Object.assign(schema, overrides['__all__']);
        if (overrides['__node__']) Object.assign(schema, overrides['__node__']);

        for (const [key, field] of Object.entries(schema.properties)) {
            const fieldPath = path ? `${path}.${key}` : key;

            // __all__ e __props__ aplicados em cada field filho
            if (overrides['__all__']) Object.assign(field, overrides['__all__']);
            if (overrides['__props__']) Object.assign(field, overrides['__props__']);

            if (overrides[fieldPath]) Object.assign(field, overrides[fieldPath]);

            if (field.properties) {
                applyLayout(field, overrides, fieldPath);
            }
        }
    }
    return schema;
}