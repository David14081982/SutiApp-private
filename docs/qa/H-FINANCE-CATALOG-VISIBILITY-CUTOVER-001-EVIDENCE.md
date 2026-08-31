# H-FINANCE-CATALOG-VISIBILITY-CUTOVER-001 — Evidencia

## Autoridad y alcance

Cadena certificada: Admin Catálogo de Finanzas → `AdminCutoverRepository` → `finance_catalog_presentation` → `finCatStore` → `FinancieraScreen`. La tabla conserva sólo presentación; estructura/rutas quedan en código, Membresías conserva `membershipStore` y elegibilidad/cálculos permanecen en el backend financiero protegido.

Preflight: Registry FRESH; 6 filas vigentes, 3 ocultas; RLS habilitada/forzada; writer `workflow.write`; la policy de lectura autenticada declarada históricamente no estaba aplicada. Google, Apps Script, préstamo, depósito, documentos, envío, workflow e Historial quedaron fuera del diff.

## Cambio

- Filtrado `visible !== false` antes de resolver elegibilidad.
- Secciones sin productos visibles, recomendaciones y accesos rápidos respetan el mismo gate.
- Orden 0 se preserva; títulos/subtítulos y label/tagline se proyectan desde Admin.
- Carga/error/reintento visibles; foco/visibility y retorno del writer refrescan sin polling.
- Policy `authenticated SELECT using(true)` aditiva; anónimo sin grant; writer sin cambios.

## Evidencia ejecutada

```text
node scripts/test-finance-catalog-visibility-cutover.js
PASS — authority, precedence, empty sections, copy/order, shortcuts, fail-closed, refresh, cache

node scripts/apply-finance-catalog-visibility-cutover.js
PASS — DRY_RUN_FORWARD_RECOVERY; rowsChanged=0; rowCount=6

node scripts/apply-finance-catalog-visibility-cutover.js --apply
PASS — APPLIED; rowsChanged=0; rowCount=6

node scripts/test-finance-catalog-visibility-cutover-live.js
PASS — two authenticated readers; unprivileged writer DENIED; Admin writer ALLOWED; anonymous DENIED

node scripts/test-finance-catalog-visibility-cutover-browser.js
PASS — Admin frontend writer; visible/hide/show/all-hidden; hidden-but-eligible; visible-but-ineligible; order; section/product copy; refresh; mobile 390×844; desktop 1280×900; browser exceptions 0
```

La elegibilidad del caso browser provino de `financial-legacy` consumido por Chrome con token afiliado real desde el origen local allowlisted `http://localhost:8080`; no se inventó overview ni se activó fallback. La fixture alteró sólo overrides de presentación y el `finally` restauró las filas originales o eliminó las temporales por `item_key` exacto.

## Cierre

- Bundle: 92 fuentes; SHA-256 `BFD90AF0B37E32FD3858D1EF3216C188E878889728DF43D3735E5EBE3B9D0EF8`.
- Datos financieros: 146 reglas, 35 fondos y 3 programas sin modificación.
- Google read/write: 0/0. Apps Script change: 0.
- Secret/PII: no secretos frontend; salidas E2E sin identidad ni PII.
- Recuperación: retirar exclusivamente `finance_presentation_authenticated_read`; 0 filas afectadas.
