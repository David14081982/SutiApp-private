# WORK QUEUE

Operational priority: `docs/MASTER_COMPLETION_PLAN.md`

CURRENT_PHASE: PHASE 7 — WRITER DEPLOYED / PRODUCTIVE APPEND VALIDATION OWNER ACTION REQUIRED
ADVANCE_MODE: READ CUTOVER ACTIVE; WRITER FAIL-CLOSED; NO PHASE 8
STOP_CONDITION: NO AUTHORIZED TEST LOAN EXISTS; DO NOT CONTAMINATE PRODUCTIVE HISTORIAL
RESUME_POINT: owner supplies/authorizes one controlled complete loan request that may remain in Historial; run the productive idempotency verification and stop after confirmed append

TRANSVERSAL_PRIORITY: MASTER ASSET EVACUATION — OPERATIONALLY COMPLETE / HISTORICAL RECOVERY PENDING = 3

TRANSVERSAL_PRIORITY_2: DATA COVERAGE & UI CUTOVER — CATALOG BLOCK PASS / LEGACY + UNRESOLVED TRACKED

| Phase | Status |
|---|---|
| PHASE 0 | DONE |
| PHASE 1 | DONE |
| PHASE 2 | DONE |
| PHASE 3 | DONE |
| PHASE 4 | DONE |
| PHASE 5 | DONE |
| PHASE 6 | DONE |
| PHASE 7 | PARTIAL — EDGE v20 + APPS SCRIPT v6 DEPLOYED; AUTHENTICATED SNAPSHOT RPC ACTIVE; A–J ISOLATED PASS; LIVE APPEND OWNER ACTION REQUIRED |
| PHASE 8 | PLANNED |

This file is only the operational queue for the MASTER PLAN. It does not reconstruct historical H tasks.

Phase 7 conserva Opción A. El read cutover previo permanece congelado. El owner autorizó el writer final, el snapshot personalizado y la RPC autenticada interactiva: migraciones/auditoría/RLS aplicadas, `financial-legacy` cloud v20 activo con JWT, resolver certificado único, Apps Script deployment v6 y A–J aislada PASS. La RPC no cambia autoridad: apertura/confirmación siguen Edge→Google y monto/fondo/plazo usan el snapshot propio con 0 Google/0 Edge. Las pruebas crearon 0 solicitudes persistentes y escribieron 0 filas Google. No iniciar Phase 8 ni ejecutar el append productivo hasta que el owner autorice una solicitud controlada completa que pueda permanecer en `Historial de solicitudes`.

Pendiente no bloqueante: recuperar los originales de `Íconos!B2:B4`. No se autorizan sustitutos ni fallback.
