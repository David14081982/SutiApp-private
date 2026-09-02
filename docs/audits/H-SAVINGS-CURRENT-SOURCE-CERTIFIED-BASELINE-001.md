# H-SAVINGS-CURRENT-SOURCE-CERTIFIED-BASELINE-001

Fecha: 2026-09-02
Estado: `PASS`
Clasificacion publica: reporte redactado; PII y valores financieros completos permanecen exclusivamente en `tmp/savings-current-baseline-20260902/`, ignorado por Git.

## Alcance autorizado

- Lectura `READ ONLY` de nueve hojas de `SutiApp Final`.
- Lectura de Supabase limitada estrictamente a `public.affiliates.id` y `public.affiliates.numero_control`.
- Escritura permitida solamente en archivos privados locales ignorados por Git.
- Google writes: `0`.
- Supabase writes: `0`.
- Importacion, reapply, cutover, activacion de rendimientos, commit y push: `NO`.

El propietario sustituyo la captura forense de A:DW por un baseline financiero reducido. No se conserva el texto masivo de formulas; se conserva el valor financiero, su procedencia `FORMULA`, `MANUAL` o `EMPTY`, y hashes deterministas.

## Authority y guardians

- Source of truth productivo/historico de Ahorro: Google Sheets `SutiApp Final`.
- `public.affiliates`: autoridad de identidad consultada solamente por `id` y `numero_control`.
- El manifiesto local es evidencia derivada privada; no es autoridad runtime ni fallback productivo.
- Legacy Google: `READ ONLY`; formulas, triggers y Apps Script sin modificaciones.
- Supabase: `READ ONLY`; RLS, policies, schema y datos sin cambios.
- Migracion: no consultada ni modificada por los snapshots finales de esta H. El estado `MIGRATION_OBJECTS_PRESENT / TRACKING_RECORD_PENDING` procede de la verificacion separada previamente autorizada; no se reaplico ni se altero tracking.

## Captura financiera reproducible

Las dos capturas logicas produjeron el mismo SHA-256:

`AF10C2D8FC591E430AA70EE9BBBD8BFF9DC1236FF298CEBF93D76874FD3821D6`

El `modifiedTime` global fue distinto entre ejecuciones, pero el alcance financiero completo fue identico. Cada ejecucion fue internamente estable y la igualdad logica incluye valores, tipos de celda, filas, Folios y hashes del alcance autorizado.

- Run 1 `modifiedTime`: `2026-09-02T16:59:53.982Z`.
- Run 2 `modifiedTime`: `2026-09-02T17:06:58.035Z`.
- Folios en Ahorro: `364`.
- Identidad visible: dos lecturas `Ahorro!A1:A366` identicas; `364/364` Folios coinciden exactamente con el manifiesto, sin faltantes, discrepancias ni perdida por ceros iniciales.
- Identidad: `356 RESOLVED`, `5 AMBIGUOUS`, `2 ORPHAN`, `1 INVALID_TEST`, `0 OTHER_INVALID`.
- Fecha de inicio: `329 CERTIFIED`, `0 INFERRED`, `34 MISSING`, `0 CONFLICT`.
- PROCESS: `13 JUB`, `287 PROCESS_1`, `51 PROCESS_3`, `0 UNKNOWN`, `5 INVALID`, `7 CONFLICT`.

Los Folios exactos de identidad, reportes y excepciones permanecen en el manifiesto privado; este reporte publica solamente conteos.

## Evidencia exacta conservada

Por Folio de Ahorro:

- identidad legacy, fecha de inicio y evidencia de PROCESS;
- monto vigente, nuevo monto, fecha/estado del cambio y estado de ahorro;
- retiros parciales/completos, continuidad, categoria, fecha y estado;
- `Q` como `legacy_reported_balance`, con valor, `cell_kind` y hash;
- AA:DO como `legacy_folio`, fecha, valor, `cell_kind` y hash: `33,852` registros;
- DP:DW agrupado en 2025, 2026 y acumulado 2025-2026, con capital, rendimiento, subtotal, `cell_kind` por componente y hash: `1,092` registros;
- hash del registro financiero principal.

Hojas operativas:

| Hoja | Filas hasheadas | Folios unicos |
|---|---:|---:|
| Ingreso ahorro | 397 | 390 |
| Solicitud de Ahorro | 344 | 340 |
| Solicitud Cambio ahorro | 126 | 112 |
| Solicitud de retiro | 228 | 220 |
| Saldo manual | 1 | 0 |
| Reporte Ahorro | 4,049 | 317 |
| Reporte - RH | 320 | 320 |
| Conciliacion | 0 | 0 |

`Conciliacion` conserva actualmente solo el encabezado. Se guardo su hash; no se incorporo la fila antigua de una proyeccion previa.

Topologia financiera relevante:

- Q: `1 FORMULA`, `363 MANUAL`.
- AA:DO: `26,546 FORMULA`, `6,543 MANUAL`, `763 EMPTY`.
- Componentes DP:DW: `1,858 MANUAL`, `1,418 EMPTY`, `0 FORMULA`.
- Texto de formulas persistido: `0`.

Los dos snapshots Supabase finales seleccionan exclusivamente `id` y `numero_control`: `947` filas y SHA-256 identico `090382CE58EC57BE02C5E8313869F441413558C872374C0BA0B1A4A5EC28F521`. Un capturador intermedio habia ampliado indebidamente la lectura a conteos/metadata; se corrigio antes del cierre y esos campos fueron eliminados de los snapshots, manifiesto, pruebas y claims de esta H. No hubo mutacion externa.

## Reduccion de volumen

- Nueve fragmentos exhaustivos ya obtenidos (`Ahorro!A:BT`): `9,523,644` bytes.
- Evidencia reutilizada equivalente por hashes: `1,146,634` bytes, reduccion `87.96%`.
- Manifiesto financiero final: `5,599,040` bytes, `41.21%` menor que esos fragmentos parciales, aun incluyendo el historico completo y evidencia operativa.
- Limpieza de intermedios: `29,349,106` bytes eliminados; despues se agregaron las evidencias dirigidas estrictas. Conjunto privado final: `6,938,309` bytes; reduccion neta del working set: `29,340,658` bytes (`80.88%`).
- Se eliminaron todos los archivos intermedios que conservaban texto de formulas. Recuperacion posible solamente repitiendo la captura `READ ONLY`.

## Artefactos privados

- `tmp/savings-current-baseline-20260902/manifest.json`
- `tmp/savings-current-baseline-20260902/summary.json`
- `tmp/savings-current-baseline-20260902/reused-evidence.json`
- `tmp/savings-current-baseline-20260902/supabase-before.json`
- `tmp/savings-current-baseline-20260902/supabase-after.json`
- `tmp/savings-current-baseline-20260902/folio-display-evidence.json`

Todos quedan cubiertos por `.gitignore: tmp/`.

Manifest SHA-256:

`3552A321C0864460A9B202AB0783750166935078C604BFF88DD90B9D9D9275B1`

## Verificacion

- `node --check` sobre builder, ingestor y prueba: `PASS`.
- `node scripts/test-savings-current-baseline.js`: `PASS`.
- Hash logico run 1 = run 2: `PASS`.
- Snapshots Supabase antes/despues: `947` filas de identidad, solo `id/numero_control`, SHA-256 identico: `PASS`.
- Dos lecturas visibles de Folio: SHA-256 identico `8645BCFCE460BC7C633F4696CD354677B8BAC0A29DE7FAB121209BDD47D3CEE4`; equivalencia manifiesto `364/364`.
- Escaneo de los seis JSON privados restantes: `formula_text_files=0`.
- `git check-ignore`: los seis artefactos privados estan ignorados por `tmp/`.
- Architecture Registry: `FRESH`; lookup `finance` + `identity`, `fallback_required=false`.

## Cierre

```text
H-SAVINGS-CURRENT-SOURCE-CERTIFIED-BASELINE-001 RESULT
Status: PASS
Files changed: builder/ingestor/test read-only; Registry derivado; auditoria/changelog; artefactos PII privados ignorados
Source-of-truth verdict: PASS - Google sigue autoritativo; manifest es evidencia derivada privada
Invariant verdict: PASS - sin fallback, importacion, ledger, autoridad duplicada ni mutacion historica
Build: NOT APPLICABLE - frontend/runtime no modificados por esta H
Tests: PASS - dos capturas logicas identicas; manifest y guards verificados
Security: PASS - PII privada; snapshots finales Supabase limitados a id/numero_control; Google/Supabase writes 0; secretos no persistidos
Legacy impact: READ ONLY - formulas/triggers/Apps Script sin cambios
Unexpected files changed: 0 atribuibles a esta H fuera del alcance declarado; dirty tree preexistente preservado
Known limitations: 34 fechas faltantes; 5 PROCESS invalidos; 7 conflictos; Conciliacion sin filas actuales; no autoriza import/cutover
Evidence: docs/audits/H-SAVINGS-CURRENT-SOURCE-CERTIFIED-BASELINE-001.md
```
