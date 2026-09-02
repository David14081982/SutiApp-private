# H-SAVINGS-RAW-SHADOW-IMPORT-001

Fecha: 2026-09-02
Estado: `PASS`
Batch productivo: `9b20b0cc-456b-4ad7-8058-c8ebe551dc31`

## AUDIT / AUTHORITY

La autorización se limitó a importar el baseline financiero certificado en las 17 tablas `public.savings_*` como historia `SHADOW`, sin importar movimientos canónicos, sin cutover, sin escrituras en Google, sin habilitar acciones y sin acreditar rendimientos.

- Autoridad histórica/productiva: Google Sheets + Apps Script, sin cambios.
- Destino: Supabase `SHADOW_ONLY`; no es autoridad de saldos productivos.
- Baseline privado: `SAVINGS_CURRENT_BASELINE_20260902`.
- SHA-256 autorizado: `3552A321C0864460A9B202AB0783750166935078C604BFF88DD90B9D9D9275B1`.
- Captura financiera reproducible: `AF10C2D8FC591E430AA70EE9BBBD8BFF9DC1236FF298CEBF93D76874FD3821D6`.
- Manifest de transporte: `E624D6DCA18A234ED939B14093AE5F3118D2381405906AF499F873484632C3CC`.
- Payload: `5B34AEC6E07EF8DE67332981D5DB82CE6E0529A8B2E6DEA49C9E13047EF6B8B2`.
- PII y valores completos permanecen en `tmp/`, ignorado por Git; la evidencia versionada sólo publica hashes y conteos.

## PLAN / RISK

1. Verificar hash, conteos, clasificación de identidad y estado cero de las 17 tablas.
2. Verificar RLS + FORCE RLS, ausencia de DML directo para `anon/authenticated` y permisos exclusivos de servicio.
3. Construir un payload determinista que conserve historia como evidencia y deje en cero las tablas canónicas.
4. Ejecutar dry-run, aplicar un único batch, verificar conteos/hashes/invariantes y repetir la misma aplicación para demostrar idempotencia.
5. Mantener recuperación exacta preparada, sin ejecutarla si el postflight pasa.

Riesgos controlados:

- Q se conserva sólo como `LEGACY_REPORTED_BALANCE`; nunca se convierte en transacción o saldo canónico.
- AA:DO conserva fecha, valor, `FORMULA/MANUAL/EMPTY`, hash y procedencia; no se transforma en aportaciones.
- DP:DW conserva periodo, capital, rendimiento, subtotal y clase de celda; no crea `YIELD_CREDIT`.
- Las cinco identidades ambiguas y dos huérfanas conservan `affiliate_id=null`.
- El Folio TEST conserva evidencia RAW y no crea participante.
- Los 363 participantes quedan `PENDING_REVIEW`; por ello el lector de usuario no certifica ni muestra un falso saldo cero antes de cutover.

## IMPLEMENT

El RPC monolítico existente fue probado dos veces con `p_apply=false`. Los payloads de 22.67 MiB y 13.94 MiB terminaron con PostgreSQL `57014` por el límite de 60 segundos; ambas pruebas produjeron cero escrituras.

La aplicación se realizó con un cargador local de backend `service_role`, en 85 lotes de 500 evidencias, sobre un único `import_batch_id`. El batch permaneció `VALIDATED` y los participantes `PENDING_REVIEW` durante la carga; sólo después de comprobar los conteos quedó `APPLIED`. Las claves únicas permiten reanudar sin duplicar. No se agregó ni reaplicó schema.

El manifest importado contiene:

| Objeto | Filas |
|---|---:|
| `savings_import_batches` | 1 |
| `savings_participants` | 363 |
| `savings_legacy_evidence` | 42,229 |
| `savings_audit_events` | 1 |
| Las otras 13 tablas `savings_*` | 0 |

Identidad: `356 RESOLVED`, `5 AMBIGUOUS`, `2 ORPHAN`; el Folio TEST conserva `101` evidencias y `0` participantes.

Evidencia financiera:

| Grupo | Registros | Folios |
|---|---:|---:|
| Ahorro AA:DO | 33,852 | 364 |
| Ahorro DP:DW | 1,092 | 364 |
| Ahorro participante/inscripción/plan/retiro/Q | 1,820 | 364 |
| Ingreso ahorro | 397 | 390 |
| Solicitud de Ahorro | 344 | 340 |
| Solicitud Cambio ahorro | 126 | 112 |
| Solicitud de retiro | 228 | 220 |
| Saldo manual | 1 | 0 |
| Reporte Ahorro | 4,049 | 317 |
| Reporte - RH | 320 | 320 |

No se crearon `savings_enrollments`, planes, requests ni transacciones porque la evidencia legacy no demuestra de forma suficiente las aprobaciones/semántica necesarias para volverlas entidades operativas. Sus filas permanecen íntegramente como evidencia estructurada.

## VERIFY / EVIDENCE

- Preflight productivo: 17/17 tablas presentes y vacías; RLS + FORCE RLS; DML directo de navegador `false`; RPC de importación sólo `service_role`.
- Dry-run local: hashes, 363 participantes, 42,229 evidencias y cero entidades operativas/canónicas, `PASS`.
- Aplicación: batch `9b20b0cc-456b-4ad7-8058-c8ebe551dc31`, `PASS`.
- Postflight: conteos por tabla/grupo/Folio, hashes de fila, identidad y duplicados, `PASS`.
- Reapply del mismo manifest: `ALREADY_APPLIED`, `writes=0`.
- Duplicados de evidencia: `0`.
- `savings_transactions`: `0`; `YIELD_CREDIT`: `0`; rendimientos productivos: `0`; acciones habilitadas: `0`.
- Google writes: `0`; cutover: `false`; schema reapply: `false`; commit/push: `NO`.
- Tests locales: builder determinista 2/2, baseline, foundation y recovery estático, `PASS`.

Recovery preparada: `supabase/recovery/20260902000200_savings_raw_shadow_import_recovery.sql`. Está fijada al SHA y batch exactos, aborta si detecta entidades canónicas y no elimina schema ni otros dominios. No se ejecutó porque la aplicación y el postflight pasaron.

## RESULTADO OBLIGATORIO

```text
SAVINGS RAW SHADOW IMPORT RESULT
Manifest: SAVINGS_CURRENT_BASELINE_20260902
Manifest SHA: 3552A321C0864460A9B202AB0783750166935078C604BFF88DD90B9D9D9275B1
Import batch: 9b20b0cc-456b-4ad7-8058-c8ebe551dc31
Folios expected: 364
Folios imported: 364 en evidencia / 363 participantes SHADOW
Resolved: 356
Ambiguous: 5
Orphan: 2
Invalid TEST: 1 preserved RAW / 0 active account
AA:DO expected/imported: 33852 / 33852
DP:DW expected/imported: 1092 / 1092
Reporte Ahorro expected/imported: 4049 / 4049
Reporte RH expected/imported: 320 / 320
Withdrawals: 228 solicitudes estructuradas + 364 snapshots por Folio
Plan changes: 126 filas estructuradas
Requests: 1095 filas operativas (397 + 344 + 126 + 228)
Duplicate rows: 0
Idempotency: PASS — ALREADY_APPLIED / writes 0
Data loss: 0
Google writes: 0
Supabase authority changed: NO
Cutover: NO
Yield credits created: 0
Canonical transactions created: 0
RLS/security: PASS
Recovery: READY / NOT EXECUTED
SAFE_TO_BEGIN_LEDGER_RECONSTRUCTION: YES, only as a separately authorized reconciliation/dry-run
SAFE_TO_MAKE_SUPABASE_AUTHORITATIVE: NO
NEXT EXACT STEP: authorize H-SAVINGS-LEDGER-RECONCILIATION-DRY-RUN-001; reconcile RAW evidence without writes, cutover or yield credits
Commit: NOT REQUESTED
Push: NO
```

## CIERRE

```text
H-SAVINGS-RAW-SHADOW-IMPORT-001 RESULT
Status: PASS
Files changed: builder/importers/verifier/test/recovery; auditoría y documentación de autoridad
Source-of-truth verdict: PASS - Google continúa productivo; Supabase contiene historia SHADOW solamente
Invariant verdict: PASS - Q/evidencia no promovidos; ledger/yields/actions/cutover en cero
Build: NOT APPLICABLE - frontend no modificado por esta H
Tests: PASS - determinismo, preflight, apply, postflight y reapply idempotente
Security: PASS - service_role local; RLS forzada; navegador sin DML; secretos/PII no versionados
Legacy impact: READ ONLY en Google; historia copiada sin modificar el origen
Unexpected files changed: 0 atribuibles a esta H fuera del alcance declarado; dirty tree previo preservado
Known limitations: participantes permanecen PENDING_REVIEW; no hay ledger, inscripción operativa ni saldo canónico
Evidence: docs/audits/H-SAVINGS-RAW-SHADOW-IMPORT-001.md
```
