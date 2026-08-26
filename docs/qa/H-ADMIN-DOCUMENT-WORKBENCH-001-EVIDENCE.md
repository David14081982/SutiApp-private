# H-ADMIN-DOCUMENT-WORKBENCH-001 — Evidencia de implementación

Fecha: 2026-08-26

## Alcance realizado

- Se transformó únicamente `Admin → Documentos y credencial` en un workbench desktop para `>=1024px`.
- El shell aprobado en `H-ADMIN-DESKTOP-SHELL-001` no fue rediseñado. Sólo se incrementó la versión del bundle/PWA para publicar esta H.
- Operación quedó separada de Configuración. La operación contiene cola, preview persistente, decisión y navegación continua; Configuración conserva Catálogo, Requisitos, Términos y QR.
- A `1024px` la bandeja usa dos columnas sin overflow; a `1280px` y `1440px` usa tres columnas.
- La UI móvil conserva las cinco pestañas, cards, acciones secuenciales y navegación inferior existentes.

## Contrato funcional

| Área | Evidencia |
|---|---|
| Cola | búsqueda, estado, documento, afiliado, antigüedad, orden, selección visible y navegación `↑/↓` + `Enter` |
| Preview | carga bajo demanda del registro seleccionado; imagen/PDF; metadata, estado e historial relevante |
| Contexto | afiliado o referencia no ambigua, tipo, estado y posición siempre visibles |
| Decisión | `Verificado` / `Requiere nueva carga`, observación, feedback inline, reintento y `Guardar y siguiente` |
| Navegación | anterior/siguiente, contador y flechas `↑/↓`; `Enter` activa la selección sin ejecutar writes |
| Catálogo | label humano primario, código técnico dentro de detalle cerrado, drag/drop y orden numérico persistente |
| Configuración | Requisitos separa tipo documental de regla por programa/trámite; Términos y QR permanecen secundarios |

## Autoridad, privacidad y rendimiento

| Control | Resultado |
|---|---|
| Autoridad documental | Sin cambio: `DocumentWorkflowRepository`/`AffiliateRepository`, `affiliate_documents`, `affiliate_files`, `private_assets`, Storage privado y catálogo canónico |
| Lectura inicial | Sólo metadata y thumbnails disponibles; no firma ni descarga todos los documentos |
| Preview | `reviewPreview(id)` consulta una fila autorizada y crea una signed URL de 300 segundos sólo al seleccionar |
| Writes | RPC `review_affiliate_document` y persistencia actual de `document_types.sort_order`; no hay escritor paralelo |
| Permisos | UI exige `documents.write`; RPC/RLS negó usuario normal, anónimo y acceso cruzado en prueba real |
| PII | control enmascarado; si la proyección de nombre/control es nula se muestra una referencia corta del expediente |
| Fallbacks/autoridad local | 0 `localStorage`, `DATA`, mocks o fallback productivo en los archivos de producto de esta H |
| Schema/migrations | 0 |
| Auth bindings | Sin cambios |
| Google/Apps Script/finanzas | `NO WRITE / NO CHANGE`; sólo se sincronizó una aserción global de versión de caché en un test |

Los históricos técnicos no documentales continúan excluidos por el contrato canónico vigente de `affiliate_documents`; la bandeja sólo consulta estados operativos documentales. La prueba introdujo dos fixtures documentales explícitos y obtuvo contaminación histórica `0`.

## “100% del expediente”

La implementación existente usa `required_by_default` como campo booleano de configuración del tipo documental, pero la evidencia normativa disponible no demuestra que equivalga a “100% del expediente”. Se conserva el control existente y se añade contexto factual; no se cambió su semántica ni su autoridad.

`OWNER_CLARIFICATION_REQUIRED`: confirmar el significado de negocio y el label definitivo de “100% del expediente”.

## Prueba Playwright real y reversible

El harness creó dos tipos documentales, dos `affiliate_documents`, sus activos privados y un PNG sintético. Ejecutó:

- cola, selección, preview, anterior/siguiente, búsqueda y filtros;
- aprobación y solicitud de nueva carga mediante la RPC real;
- persistencia tras refresh;
- drag/drop y orden numérico del catálogo con read-back;
- RLS/Storage para Admin autorizado, usuario normal, anónimo y afiliado cruzado;
- viewports `1024×768`, `1280×900`, `1440×1000` y móvil `430×932`.

Todos los writes quedaron allowlisted: dos llamadas de revisión y dos actualizaciones de orden. `unexpectedWrites = []`. En `finally`, el harness eliminó auditoría sensible del fixture, documentos, tipos, activos y objeto Storage, y verificó `cleanup.clean = true`.

Los mensajes de consola registrados proceden de inicializaciones globales preexistentes que fallan cerradas para `anon` o por CORS financiero; no hubo excepciones de página (`pageErrors = []`) ni afectación del workbench. No se silencenciaron ni se clasificaron como éxito.

Evidencia visual y de ejecución:

- [`playwright-result.json`](evidence/admin-document-workbench-20260826/playwright-result.json)
- [`workbench-1024x768.png`](evidence/admin-document-workbench-20260826/workbench-1024x768.png)
- [`workbench-1280x900.png`](evidence/admin-document-workbench-20260826/workbench-1280x900.png)
- [`workbench-1440x1000.png`](evidence/admin-document-workbench-20260826/workbench-1440x1000.png)
- [`documents-mobile-430x932.png`](evidence/admin-document-workbench-20260826/documents-mobile-430x932.png)

## Verificación ejecutada

```text
node scripts/build-bundle.js C:\tmp\babel-standalone-7.29.0.min.js
PASS — bundle reproducible desde 90 fuentes

node scripts/test-admin-document-workbench.js
PASS

node scripts/test-admin-document-workbench-browser.js
PASS — Chrome/Supabase real; fixtures reversibles; cleanup verificado

node scripts/test-admin-desktop-shell-browser.js
PASS — shell 1024/1280/1440 y preservación 430/768

node scripts/test-static-suite.js
PASS — 45/45

python scripts/test-architecture-registry.py
PASS — generation/freshness/lookup/reverse/tests/fallback/incremental/secrets/determinism

python scripts/generate-architecture-registry.py check
FRESH

powershell -File scripts/audit.ps1 all
PASS / REVIEW REQUIRED — hallazgos globales clasificados; ninguno crea autoridad, fallback, secreto o cambio legacy en esta H

git diff --check
PASS — sin errores de whitespace; sólo avisos CRLF del worktree Windows
```

## Resultado solicitado

```text
ADMIN DOCUMENT WORKBENCH RESULT

Desktop queue: PASS
Persistent preview: PASS
Decision panel: PASS
Previous/next: PASS
Save and next: PASS
Search: PASS
Status filter: PASS
Document filter: PASS
Affiliate filter: PASS
Keyboard navigation: PASS
Human labels: PASS
Technical IDs primary: 0
Catalog: PASS
Drag/drop order: PASS
Refresh persistence: PASS
Historical contamination: 0
Private asset handling: PASS
RLS: PASS
Cross-domain: DENIED
Mobile preserved: PASS
1024: PASS
1280: PASS
1440: PASS
Playwright: PASS
Static suite: PASS
Architecture Registry: UPDATED / FRESH
Final verdict: PASS
```

```text
H-ADMIN-DOCUMENT-WORKBENCH-001 RESULT
Status: PASS
Files changed: document repository/workbench source; generated bundle/cache versions; two task tests; evidence/changelog; derived Architecture Registry
Source-of-truth verdict: PASS — same Supabase document/catalog authorities; no duplicate store, cache or fallback
Invariant verdict: PASS — private assets, RLS, historical integrity, mobile contract and cross-domain boundaries preserved
Build: PASS — bundle reproducible from 90 source files
Tests: PASS — task static test, canonical suite 45/45, Registry suite, desktop-shell regression and real Chrome/Supabase workbench matrix
Security: PASS — selected-only signed URL; documents.write UI gate plus backend/RLS denial for normal, anonymous and cross-user access
Legacy impact: NOT APPLICABLE / NO WRITE / NO CHANGE
Unexpected files changed: 0 attributable to this H; pre-existing dirty Admin-shell/audit files preserved
Known limitations: OWNER_CLARIFICATION_REQUIRED for the business meaning/label of “100% del expediente”; no semantic invention was made
Evidence: docs/qa/H-ADMIN-DOCUMENT-WORKBENCH-001-EVIDENCE.md; docs/qa/evidence/admin-document-workbench-20260826/
```
