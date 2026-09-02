# H-SAVINGS-SHADOW-IMPORT-CERTIFIED-DRY-RUN-001

Fecha de lectura: 2026-09-02 (America/Hermosillo)

## PRE-CHANGE AUDIT

```text
PRE-CHANGE AUDIT
H: H-SAVINGS-SHADOW-IMPORT-CERTIFIED-DRY-RUN-001
Objetivo: ejecutar dos veces el importador histórico de Ahorro en DRY-RUN sobre una proyección reproducible de la fuente Google real, generar manifest y demostrar cero escrituras.
Alcance: lectura acotada de nueve hojas de SutiApp Final; SELECT de id/numero_control/categoría financiera en public.affiliates; builder, validación local, manifest sensible ignorado y evidencia agregada sin PII innecesaria.
Fuera de alcance: aplicar 20260902000100, RPC productiva, inserts/updates/deletes, Google writes, Apps Script, Auth, Storage, cutover, rendimiento, resolución automática de identidad, commit y push.
Archivos a tocar: scripts/import-savings-shadow.js; scripts/build-savings-shadow-certified-manifest.js; scripts/test-savings-shadow-certified-dry-run.js; scripts/test-savings-shadow-foundation.js; este documento; docs/AGENT_CHANGELOG.md; Registry derivado estrictamente para indexar el nuevo mapping. tmp/savings-shadow-certified-dry-run/* será evidencia local sensible ignorada por Git.
Datos afectados: ninguno; sólo lecturas y artefactos locales derivados.
Fuentes de verdad: Google Sheets SutiApp Final para historia de Ahorro; public.affiliates para candidatos de identidad; manifest local es derivado y no autoridad.
Tablas: public.affiliates SELECT-only; public.savings_* no existen en producción y no se consultarán por RPC de importación.
APIs: Google Drive/Sheets metadata + bounded range reads; Supabase REST GET de tres columnas.
Legacy involucrado: Ahorro, fórmulas AA:DO, saldos G/O/P/Q, retiros, cambios, Reporte Ahorro, Reporte - RH y DP:DW; todo READ ONLY.
Invariantes: INV-174..182; Q sólo evidencia; expected separado de actual; ambiguous/orphan con affiliate_id null; rendimiento no acreditado.
Riesgo: alto por identidad, saldos no autoritativos, cambios de fuente y PII; controles fail-closed, clasificación PENDING_REVIEW, proyección local ignorada y salida agregada.
Tests: builder repetido, importador repetido, hashes/conteos idénticos, validaciones negativas, git diff/status y snapshots read-only antes/después.
Recovery: NOT APPLICABLE para datos; no habrá mutaciones. Los artefactos tmp son regenerables desde una nueva lectura certificada.
Status: PASS para DRY-RUN READ ONLY; cualquier escritura permanece BLOCKED.
```

## AUTHORITY

```text
SOURCE OF TRUTH AUDIT
Domain: previsualización de importación histórica de Caja de Ahorro
Authority: Google Sheets SutiApp Final (historia productiva); public.affiliates (identidad candidata)
Readers: builder/importador local y esta auditoría
Writers: ninguno
Alternative sources: auditoría forense previa sólo como baseline; HTML, mocks, fixtures, DATA, JSON runtime y localStorage prohibidos
Fallbacks: 0
Caches: snapshot local efímero/ignorado, derivado de una lectura exacta y nunca runtime
Conflicts: saldo vigente continúa UNRESOLVED; enlaces 1:N quedan AMBIGUOUS y 0:N quedan ORPHAN
Verdict: SAFE únicamente para lectura y DRY-RUN; importación productiva BLOCKED sin autorización separada
Evidence: ADR-095, INV-174..182 y H-SAVINGS-LEGACY-SYSTEM-FORENSIC-AUDIT-001
```

```text
LEGACY GOOGLE AUDIT
Systems/domains: nueve hojas core de Ahorro en SutiApp Final
Reads: metadata y rangos limitados a grids declaradas
Writes: 0
Calculations/triggers: fórmulas leídas, ninguna ejecutada por Apps Script; triggers no invocados
Authority: Google conserva autoridad histórica/productiva
Equivalence: no asumida; el manifest distingue RAW_LEGACY/PENDING_REVIEW y no promueve saldos
Recovery: NOT APPLICABLE; lectura pura
Classification: READ ONLY
Decision: autorizado por la H exclusivamente para dry-run
```

```text
DATABASE MIGRATION AUDIT
Domain: destino SHADOW preparado de Ahorro
Authority before/after: sin cambio; Google permanece productivo
Schema checks: 20260902000100 permanece PREPARED_NOT_APPLIED
RLS/security: no se invoca el RPC ni se concede acceso nuevo
Historical data: cero filas persistidas
Compatibility: el manifest conserva el contrato local preparado, sin afirmar equivalencia legacy
Backup/recovery: NOT APPLICABLE para esta ejecución; no hay write
Tests/reconciliation: local, repetible y sin conexión de importación
Verdict: PASS para dry-run; APPLY no autorizado
```

```text
SUPABASE SECURITY REVIEW
Scope: GET read-only de public.affiliates para id, numero_control y categoría financiera
Auth/business identity: numero_control sólo agrupa candidatos; Auth no decide existencia ni desempata
RLS/grants: credencial de servidor sólo en proceso local y archivo ignorado; no browser
Roles/privilege escalation: ninguna escritura ni concesión
Frontend exposure: 0 secretos y 0 manifest sensible en app/bundle.js
Cross-user access: no se expone información de afiliados en la evidencia pública; sólo conteos y folios legacy requeridos
Impersonation/audit: NOT APPLICABLE
Tests: comparar conteo live y no registrar credenciales
Verdict: PASS para lectura; APPLY bloqueado
```

## SOURCE_CHANGED

La metadata y los rangos live del 2026-09-02 no son idénticos al corte forense del 2026-09-01. No se asumió equivalencia:

- `Ingreso ahorro`: 394 filas con Folio / 390 Folios únicos, antes 393 / 389.
- `Solicitud de Ahorro`: 343 filas con Folio / 340 Folios únicos, antes 341 / 338.
- `Ahorro`: 364 Folios, antes 363; la fila adicional está marcada `(TEST)` y se clasifica `INVALID`, por lo que el universo importable conserva 363.
- `Reporte Ahorro`: 4,049 movimientos, antes 4,047.
- `Solicitud Cambio ahorro`, `Solicitud de retiro`, `Saldo manual`, `Reporte - RH` y `Conciliacion`: conteos materiales sin cambio.

El manifest de esta H corresponderá únicamente al fingerprint actual. Los dos movimientos nuevos no se promoverán a aportaciones canónicas; permanecerán como candidatos legacy pendientes de revisión.

## PLAN / RISK

1. Construir una proyección local sin nombre, email ni URLs/documentos crudos; conservar hashes de fila y referencias.
2. Clasificar folios, fechas, proceso, planes, matriz AA:DO, Q, aportaciones candidatas, retiros, cambios y DP:DW sin reinterpretar historia.
3. Generar manifest certificado para revisión con SHA-256 del snapshot y SHA-256 del manifest.
4. Ejecutar builder e importador dos veces sobre el mismo input y exigir igualdad byte a byte, conteos y hashes.
5. Repetir snapshots read-only y cerrar con cero escrituras y revisión arquitectónica.

El saldo autoritativo, las 21 diferencias históricas, la semántica de `Reporte Ahorro`, fechas efectivas dudosas y rendimiento continúan sin decisión. Esta H sólo los describe; no los corrige.

## IMPLEMENT

- `build-savings-shadow-certified-manifest.js` transforma la proyección acotada real, omite nombre/email de Ahorro y nombres de retiro/RH, hashea referencias documentales y produce un manifest determinista.
- El source fingerprint cubre los campos financieros utilizados, fórmulas, valores efectivos, estructura y sheet IDs; `modifiedTime` se conserva como provenance pero se excluye del hash porque el libro cambia por otras pestañas/Glide.
- `import-savings-shadow.js` exige hash del manifest, versiones y fingerprint; `--apply` falla con `SAVINGS_MANIFEST_NOT_READY_FOR_APPLY` antes de cualquier red.
- Ningún candidato de `Reporte Ahorro`, retiros o rendimiento se coloca en `snapshot.transactions`. El payload exacto importable contiene 363 participantes y 41,751 evidencias; ledger, planes, solicitudes y movimientos autorizados son cero.
- Las 4,049 aportaciones, 226 retiros y 395 registros de rendimiento se conservan en el análisis del manifest como candidatos `PENDING_REVIEW`/`RAW_LEGACY_YIELD`, sin promoverse a autoridad.

## RESULTADO DETALLADO

```text
SAVINGS CERTIFIED SHADOW IMPORT DRY-RUN RESULT

Source workbook:
SutiApp Final — 1Vxy84N7mzbuioTmWhjRD2QFboDx--rG3iUwmLuyeY80

Sheets used:
Ingreso ahorro; Solicitud de Ahorro; Ahorro; Solicitud Cambio ahorro; Solicitud de retiro; Saldo manual; Reporte Ahorro; Reporte - RH; Conciliacion

Source read timestamp:
2026-09-02T13:30:39.647Z (06:30:39 America/Hermosillo)

Source fingerprint:
49D6AF5E14329677D8AD32842BE2756746D8859EC75AFC914726AB6843BDFFED

Identity snapshot SHA-256:
E0400146274CEBF4EB6776E3EBCD61E9912B7D812280FF53D223F18B182283C2

Source changed since forensic audit:
YES — Ingreso 393→394 rows with Folio; Solicitud 341→343; Ahorro 363→364 including one TEST invalid; Reporte Ahorro 4,047→4,049.

Total folios:
364 found / 363 importable

Resolved:
356 — exact list in analysis.folios.resolved

Ambiguous:
5 — 2307, 10786, 11678, 12823, 13590

Orphan:
2 — 4037, 14009

Duplicate source:
0

Invalid:
1 — 1234009 (TEST); plus one non-Folio formula row excluded

Start date certified:
329

Start date inferred:
0

Start date missing:
34

Start date conflict:
0

Process JUB:
13

Process 1:
291

Process 3:
51

Process UNKNOWN:
1

Process conflicts:
7 — 815, 1061, 7887, 10317, 11288, 11411, 13260

Contribution plans:
453 candidates; 428 certified segments; 453 effective dates known; 0 dates uncertain; 24 process/other conflicts; 1 duplicate

Plan changes:
123 requests — 104 certified; 18 conflicts; 1 duplicate; 0 missing effective dates

Historical dated values AA:DO:
33,945 cells — 17,729 non-zero; 15,403 zero; 26,622 formula cells; 50 formula blank outputs; 6,560 manual values; 763 physical blanks

Legacy Q rows:
363 with Q / 0 without Q; total 1,986,073.50; negative 0; zero 66; unexpected 0

Candidate contributions:
4,049; exact list in analysis.contribution_candidates; duplicates 0; invalid 0; ledger authorized 0

Candidate withdrawals:
226 from 228 records; 31 partial; 195 total; 0 duplicates; 0 missing dates; 0 missing amounts; 2 unknown-category records excluded; 2 ambiguous identity linkages

Candidate yield records:
395 (131 for 2025 + 264 for 2026-H1); credits authorized 0

Beneficiaries:
No demonstrable source; records 0; invented 0

Balance MATCH:
343 arithmetic matches only; not canonical

Balance MISMATCH:
20

Pending review:
20 mismatches; all candidate transactions remain non-authorized

Previous 21 mismatches still present:
NO as a count (current 20). Exact case continuity is NOT_VERIFIABLE because the prior audit did not retain the 21-Folio set and the source added two Reporte rows.

Current mismatch folios/difference:
7976 -1750; 10665 -2500; 8791 -1000; 10554 -2500; 8167 -2000; 11402 -1500; 2303 -2000; 11101 -2500; 1685 -2500; 2641 +300; 11686 -2000; 4935 -1000; 230581 -4000; 226290 -500; 2625 -500; 10390 -1000; 13301 -2500; 12207 +200; 7144 +500; 12721 +1000.

Manifest path:
tmp/savings-shadow-certified-dry-run/manifest-run-1.json

Source snapshot SHA-256:
339A8E60AB4B65CECD91C87D631670ED6ECFDD7EA4D4FFC71E5A34A501A7139C

Manifest SHA-256:
E0480AD0C0B6E17FAC54930C4834380787AE161DA9563C885FFC03C62206C907

Manifest file SHA-256:
BF7B0EAA4272A6E59C4E63C3BF8CD02720C65DD7509AAD443513319F49D918C4

Dry-run #1:
PASS

Dry-run #2:
PASS

Idempotent:
PASS — same bytes, manifest hash, snapshot hash, counts and dry-run output

Supabase writes:
0

Google writes:
0

Storage writes:
0

Auth writes:
0

Git commit/push:
0 / 0

Production migration applied:
NO — 0 public.savings_* tables; import RPC absent

Cutover:
NO

Yield credited:
0

READY_FOR_OWNER_REVIEW:
YES

READY_FOR_APPLY:
NO

EXACT NEXT AUTHORIZATION REQUIRED:
AUTORIZO APLICAR EN PRODUCCIÓN ÚNICAMENTE LA MIGRACIÓN 20260902000100_savings_shadow_foundation.sql, SIN IMPORTAR DATOS, SIN CUTOVER, SIN ESCRIBIR GOOGLE Y SIN ACTIVAR RENDIMIENTOS; VERIFICA Y DETENTE.
```

## VERIFY / EVIDENCE

- Google bounded read #2: las nueve hojas fueron idénticas al primer snapshot.
- Google final bounded read `2026-09-02T13:39:53.151Z`: idénticas al manifest aun cuando el `modifiedTime` global cambió de `13:27:05.010Z` a `13:38:51.007Z` durante la lectura; esto demuestra cambio fuera de la proyección financiera acotada, no una alteración de los nueve rangos.
- `public.affiliates` leído dos veces: 947 filas y snapshot exacto sin cambios; 938 controles, 923 distintos, 13 grupos duplicados.
- `node scripts/test-savings-shadow-certified-dry-run.js`: `PASS`; dos builds y dos dry-runs, bytes/hashes/conteos iguales; apply guard `PASS`.
- `node scripts/test-savings-shadow-foundation.js`: `PASS`.
- `node scripts/test-static-suite.js`: `83/83 PASS`.
- Architecture Registry incremental: `FRESH`; lookup `savings certified dry run` localiza builder/test/evidencia en `finance + identity`; `python scripts/test-architecture-registry.py`: `PASS` incluido freshness, incremental y determinismo.
- SQL SELECT-only posterior: `savings_tables=0`, `import_rpc_present=false`.
- `git diff --check`: exit 0; sólo avisos LF/CRLF configurados. `HEAD` permaneció `83fee15e26de8b2279ff48563218789ce1bec689`; no commit ni push.
- Evidencia sensible local ignorada: `source-projection.json`, `manifest-run-1.json`, `manifest-run-2.json`, `dry-run-1.json`, `dry-run-2.json`, `idempotency-result.json`.

```text
H-SAVINGS-SHADOW-IMPORT-CERTIFIED-DRY-RUN-001 RESULT
Status: PASS — dry-run certificado y reproducible; importación productiva no autorizada
Files changed: builder/importer/tests; auditoría/changelog; Registry derivado; artefactos sensibles sólo en tmp ignorado
Source-of-truth verdict: PASS READ ONLY — Google sigue productivo; manifest es derivado y no runtime
Invariant verdict: PASS — INV-174..182; Q/evidencia/candidatos no se convirtieron en ledger
Build: NOT APPLICABLE — no cambió frontend ni bundle; node --check PASS
Tests: PASS — 2/2 dry-runs; idempotencia; apply guard; foundation; 83/83 static
Security: PASS — secretos no expuestos; GET/SELECT-only; PII omitida de evidencia pública
Legacy impact: READ ONLY — Google writes 0; fórmulas/triggers/Apps Script sin cambios
Unexpected files changed: 0 atribuibles a esta H fuera del alcance actualizado; worktree previo preservado
Known limitations: fuente cambió; saldo/aportación siguen UNRESOLVED; exacto set histórico de 21 no disponible; manifest ready_for_apply=false
Evidence: este documento + tmp/savings-shadow-certified-dry-run/idempotency-result.json
```
