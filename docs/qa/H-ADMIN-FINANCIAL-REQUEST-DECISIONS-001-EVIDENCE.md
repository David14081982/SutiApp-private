# H-ADMIN-FINANCIAL-REQUEST-DECISIONS-001 — Evidencia

Fecha: 2026-08-29
Resultado: `PASS`

## Alcance y autoridad

- Pantallas existentes: Admin Finanzas desktop y móvil.
- Solicitud/estado: `public.program_requests`.
- Nota del solicitante: `program_requests.notes`, sin escrituras administrativas.
- Decisiones administrativas: `public.program_request_admin_events`, append-only.
- Documentos enviados: `public.request_documents`.
- Expediente vigente: `public.affiliate_documents` + `private_assets` + `private-assets`, mostrado por separado.
- Aprobación: Edge `financial-legacy` → RPC service-only → handoff Google posterior ya existente.

No se agregaron mocks, fallbacks, browser storage, cálculos ni fuentes paralelas.

## Migración y recuperación

- Forward: `supabase/migrations/20260829000200_financial_request_admin_events.sql`.
- Recovery: `supabase/recovery/20260829000200_financial_request_admin_events_recovery.sql`.
- Dry-run forward con `ROLLBACK`: `PASS`, cambios persistentes `0`.
- Dry-run recovery con `ROLLBACK`: `PASS`, cambios persistentes `0`.
- Apply: `PASS`; tabla, funciones, grants y RLS verificados; conteos protegidos sin cambio.
- Matriz Auth con `COMMENT` + retry idéntico, `MARK_IN_REVIEW → REJECT` y `CANCEL`: idempotencia/transiciones válidas, `notes` intacto, transacción revertida, cambios persistentes `0`.
- Recovery falla cerrado cuando existe historia administrativa.

## Seguridad

- RLS habilitada y forzada en la bitácora.
- `anon` y `authenticated`: sin `SELECT`/`INSERT` directo.
- Lectura RPC: exige `program_requests.read` y no devuelve UUID de actor ni clave idempotente.
- Escritura RPC: exige `program_requests.write`, deriva `auth.uid()`, valida transición/motivo e idempotencia.
- Aprobación: RPC sobrecargada ejecutable sólo por `service_role`, invocada detrás de Edge con JWT.
- Documentos: bucket privado y firma temporal sólo al abrir.
- Secretos/service role en frontend o bundle: `0`.

## Frontend y preservación

- Se conservaron cola, detalle, solicitante, estado, condiciones, términos, timeline, navegación, responsive y acciones existentes.
- Se añadió “Documentos enviados con esta solicitud” y “Expediente actual del afiliado” con advertencia semántica explícita.
- La bitácora distingue nota del solicitante de observaciones/decisiones del personal.
- Desktop y móvil admiten comentario, revisión, rechazo, cancelación y aprobación según transición válida.
- Veredicto Claude UI Preservation Guardian: `PASS`; no hubo rediseño ni secciones eliminadas.

## Verificación reproducible

```text
node scripts/build-bundle.js C:\tmp\babel-standalone-7.29.0.min.js
  Built app\bundle.js from 92 files.

node scripts/test-static-suite.js
  {"status":"PASS","total":60,"failures":[]}

node scripts/test-admin-financial-requests-workbench-browser.js
  PASS: 430/1024/1280/1440, live rows=5, no overflow, no N+1,
  access denials correct, networkWrites=[], directGoogleRequests=[], pageErrors=[]

python scripts/apply-financial-request-admin-events.py --dry-run
  {"migration_dry_run":true,"persistent_changes":0,"status":"PASS"}

python scripts/apply-financial-request-admin-events.py --recovery-dry-run
  {"recovery_dry_run":true,"persistent_changes":0,"status":"PASS"}

python scripts/apply-financial-request-admin-events.py --matrix-dry-run
  {"cancel_transition":true,"idempotency":true,"persistent_changes":0,
   "request_notes_unchanged":true,"review_reject_transition":true,"status":"PASS"}
```

Edge `financial-legacy`: versión `26`, estado `ACTIVE`, `verifyJwt=true`. Respaldo previo local: `C:\tmp\financial-legacy-pre-admin-events-20260829.zip`, SHA-256 `ad8dfc3df58ea3b00680923dd16317f3d9384ef8f063c796383df0d4f17ab69e`.

## Legacy y límites

- Google writes de QA: `0`.
- Apps Script changes: `0`.
- Reglas, fórmulas, elegibilidad, tasas, plazos, saldos y amortización: sin cambios.
- No se ejecutó aprobación productiva de prueba; la validación append-only de Phase 7 sigue requiriendo autorización separada del propietario.
- Una solicitud histórica sin filas en `request_documents` no puede reconstruirse de forma confiable; la UI lo declara y sólo muestra el expediente actual en una sección separada.
