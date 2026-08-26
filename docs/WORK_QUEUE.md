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
| PHASE 7 | PARTIAL — EDGE v18 + APPS SCRIPT v6 DEPLOYED; A–J ISOLATED PASS; PERSONALIZED SESSION SNAPSHOT ACTIVE; LIVE APPEND OWNER ACTION REQUIRED |
| PHASE 8 | PLANNED |

This file is only the operational queue for the MASTER PLAN. It does not reconstruct historical H tasks.

Phase 7 conserva Opción A. El read cutover previo permanece congelado. El owner autorizó el writer final y posteriormente el snapshot financiero personalizado de sesión: migraciones/auditoría/RLS aplicadas, `financial-legacy` cloud v18 activo con JWT, Apps Script deployment v6, secrets sincronizados y A–J aislada PASS. La migración del snapshot preservó 3 solicitudes financieras preexistentes y sus pruebas crearon 0 solicitudes persistentes; tampoco escribieron Google. No iniciar Phase 8 ni ejecutar el append productivo hasta que el owner autorice una solicitud controlada completa que pueda permanecer en `Historial de solicitudes`.

Pendiente no bloqueante: recuperar los originales de `Íconos!B2:B4`. No se autorizan sustitutos ni fallback.
