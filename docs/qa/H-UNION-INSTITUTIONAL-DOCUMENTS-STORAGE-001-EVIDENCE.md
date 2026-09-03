# H-UNION-INSTITUTIONAL-DOCUMENTS-STORAGE-001 — Evidence

Fecha: 2026-09-03
Resultado: `PASS`

## Alcance y autoridad

- Superficies exclusivas: `Tu sindicato → Normas y Reglamentos` y `Tu sindicato → Descarga de formatos`.
- Fuente histórica leída en vivo y sin escrituras: libro Google Sheets `SutiApp Final` (`1Vxy84N7mzbuioTmWhjRD2QFboDx--rG3iUwmLuyeY80`), pestañas exactas `Normas y Reglamentos` (gid `1653817531`, `A1:AA3`) y `Descargas2` (gid `1287305322`, `A1:AA17`).
- Filas significativas: normas 2–3; formatos 7, 12, 13, 15, 16 y 17. Google writes: `0`.
- Autoridad runtime: `institutional_documents → app_assets → Supabase Storage documents`. `asset_sources` conserva únicamente procedencia privada de migración.
- No se tocaron otras pantallas, repositories compartidos, buckets, policies, Auth, documentos privados, Ahorro, Préstamos, Apps Script, fórmulas ni conciliaciones.

## Auditoría y reconciliación

- Preflight: 8 filas fuente = 2 normas + 6 formatos; las 8 enlazaban assets `READY`, PDFs existentes en `documents`, con tamaño y SHA-256 válidos.
- `Descargas2!15` y `Descargas2!17` resolvían el mismo asset y el mismo SHA-256. Se mantuvo la fila 17, que contiene la descripción vigente 2026–2027; la fila 15 quedó despublicada de forma reversible, no borrada.
- Estado final: 8 filas trazables, 7 visibles, 7 objetos físicos únicos, 2 normas + 5 formatos, 0 duplicados visibles.
- Los archivos ya estaban evacuados correctamente. Reutilizar los 7 objetos verificados evitó reuploads y duplicados; no se crearon assets ni objetos nuevos.

## Implementación

- `20260903000130_union_institutional_documents_storage_cutover.sql` anuló las URL legacy de las 8 filas y despublicó sólo la copia más antigua.
- El forward no elimina filas, metadata, assets ni objetos. El recovery recompone las URL desde `asset_sources` y reactiva la fila histórica sólo junto con una reversión explícita del frontend.
- `InstitutionalDocumentsRepository` ya omitía los campos URL legacy y proyectaba URLs desde `app_assets`; se preservó.
- `ModuloBlock` ahora abre el PDF `b.url` antes que la portada `b.imageUrl`. No cambió estructura, contenido, estilos, navegación ni diseño.
- `app/bundle.js` se regeneró desde las 100 fuentes; `SutiApp.html` usa `v=199` y el service worker `sutiapp-v143`.

## Evidencia ejecutada

```text
node scripts/test-union-institutional-documents-storage-cutover.js
PASS — 8 source rows; 2 regulations; 6 source download rows; expected 7 unique visible; Google runtime dependencies 0; redesign false

node scripts/apply-union-institutional-documents-storage-cutover.js
PASS — DRY_RUN_FORWARD_RECOVERY; targetRows 8; persistentWrites 0

node scripts/apply-union-institutional-documents-storage-cutover.js --apply
PASS — APPLIED; rowsCleaned 8; duplicateRowsDisabled 1; metadataOrAssetLinksChanged 0

node scripts/test-union-institutional-documents-storage-cutover-live.js
PASS — sourceRecords 8; visible 7; regulations 2; downloads 5; physicalObjects 7; hashes 7; productiveGoogleUrls 0; publicProvenance false

node scripts/test-union-institutional-documents-storage-cutover-browser.js
PASS — Chrome real local; 2/5 tarjetas; 2 PDFs abiertos/descargados desde Supabase; runtimeExceptions 0

node scripts/build-pages-site.js .tmp/pages-union-docs-v199
PASS — 16 archivos públicos

GitHub Actions run 33737697667
PASS — commit c5ad12ea876465131949e519447b2698e676ec14; build, deploy y verificación crítica de Pages

node scripts/test-union-institutional-documents-storage-cutover-browser.js https://david14081982.github.io/SutiApp-private/
PASS — Chrome real producción; 2 normas; 5 formatos; ambos PDFs Supabase descargables; Google URLs 0; duplicados 0; runtimeExceptions 0
```

## Cierre de guardians

- Source of truth: `PASS`; una autoridad runtime por metadata y archivo.
- Migration: `PASS`; preflight, forward, recovery y reconciliación probados; no hay borrado histórico.
- Google legacy: `PASS / READ ONLY`; dos rangos acotados, cero escrituras, ninguna interacción financiera.
- Supabase security: `PASS`; sin nuevos grants/policies/roles, `asset_sources` no público y ningún secreto en frontend.
- UI preservation: `PASS`; diff funcional de una condición, sin rediseño ni sección perdida.
- Global regression: `NOT APPLICABLE`; no cambió `AssetRepository`, `DocumentWorkflowRepository`, schemas/policies Storage, viewer, shell, Auth ni repository compartido. `bundle.js` y cachebusters son artefactos generados del módulo focal. Además, el propietario ordenó no ejecutar suites globales.
- Architecture Registry: arquitectura sin cambio; no se regeneró. Los tres archivos Registry ya modificados antes de esta H permanecieron fuera de ambos commits.

## Architect review

`sutiapp-architect-reviewer`: `APPROVED`. La solicitud, diff, tablas productivas, objetos/hashes, migración/recovery, repositorios, bundle, UI, tests y deploy demuestran el corte completo sin autoridad paralela, pérdida histórica, exposición de procedencia o impacto fuera de alcance. `docs/WORK_QUEUE_HISTORY.md` no existe. `docs/WORK_QUEUE.md` mantiene Phase 7 bajo acción owner ajena; por tanto, la respuesta a Codex es cerrar esta H y detenerse, sin iniciar otra.

```text
H-UNION-INSTITUTIONAL-DOCUMENTS-STORAGE-001 RESULT
Status: PASS
Files changed: pantalla documental focal; bundle/cache; migration/recovery; pruebas focales; contratos/evidencia
Source-of-truth verdict: PASS — institutional_documents → app_assets → documents; Google sólo procedencia privada
Invariant verdict: PASS — 8 filas trazables; 7 documentos únicos visibles; 2 normas + 5 formatos; UI abre PDF
Build: PASS — bundle de 100 fuentes; Pages artifact de 16 archivos; deploy workflow PASS
Tests: PASS — static; forward/recovery; apply; live 7 hashes; Chrome local y producción
Security: PASS — asset_sources no público; sin grants/RLS/policies nuevos; cero secretos frontend
Legacy impact: READ ONLY no financiero — 2 rangos Google; 0 escrituras; Apps Script/finanzas sin interacción
Unexpected files changed: 0 de esta H; 3 Registry preexistentes preservados y excluidos
Known limitations: la fila histórica Descargas2!15 permanece despublicada porque duplica byte a byte la fila 17
Evidence: docs/qa/H-UNION-INSTITUTIONAL-DOCUMENTS-STORAGE-001-EVIDENCE.md; Actions 33737697667
```
