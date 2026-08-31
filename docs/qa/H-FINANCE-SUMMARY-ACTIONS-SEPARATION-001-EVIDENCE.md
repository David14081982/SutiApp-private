# H-FINANCE-SUMMARY-ACTIONS-SEPARATION-001 — Evidencia

## Alcance

Corrección exclusiva del consumidor `FinancieraScreen`: el resumen superior deja de recibir `visibleItemIds`; el filtro `item.visible !== false`, la omisión de secciones vacías, orden y copy permanecen en el catálogo inferior. No se modificaron `finCatStore`, Admin, Supabase, migraciones, Edge, cálculos, Suti Préstamo, Suti Inversión, Ahorro, documentos o workflow.

## Contrato owner certificado

- Ocultar `inversion`: card inferior ausente; “Mi inversión” y botón Invertir presentes.
- Ocultar `ahorro`: card inferior ausente; “Mi ahorro” y botón Ahorrar presentes.
- Ocultar `prestamo`: card inferior ausente; crédito y acceso préstamo superiores presentes.
- Mostrar nuevamente: las tres cards inferiores reaparecen.
- Secciones sin productos visibles continúan omitidas.

## Evidencia ejecutada

```text
node scripts/test-finance-summary-actions-separation.js
PASS — resumen sin visibleItemIds; cinco elementos permanentes; gate inferior intacto

node scripts/test-finance-catalog-visibility-cutover.js
PASS — visibilidad, empty sections, orden/copy, refresh y autoridad preservados

node scripts/test-finance-catalog-visibility-cutover-browser.js
PASS — Admin frontend writer; afiliado reader; hidden catalog items 0; resumen permanente; show restore; mobile 390×844; desktop 1280×900; browser exceptions 0
```

El navegador consumió el Edge financiero real desde `http://localhost:8080`. La fixture alteró sólo los overrides exactos de presentación y restauró cada fila original o eliminó la temporal por `item_key` en `finally`.

## Cierre

- Bundle: 92 fuentes; SHA-256 `2E420610C30617BD011865934E8E1FECD088C9944FFB1E79E4191470957C01C0`.
- Cálculos financieros modificados: 0.
- Google read/write: 0/0. Apps Script change: 0.
- Backend/schema/RLS/grants: sin cambios.
- Secret/PII: no secretos frontend; salidas E2E sin identidad ni PII.
