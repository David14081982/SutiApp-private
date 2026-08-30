# H-REQUEST-SUBMISSION-E2E-REMEDIATION-001 — Evidencia

Fecha: 2026-08-30
Estado: `PASS`

## Causa raíz demostrada

La confirmación de préstamo llama desde Edge al RPC service-only `create_validated_financial_program_request`. El trigger `capture_document_requirements_snapshot` agregado por la plataforma documental invocaba `assert_document_requirement_scope`, cuya primera condición exigía `auth.uid()`. En una transacción legítima `service_role`, `auth.uid()` es nulo aunque `auth.role()` sea `service_role`; el trigger abortaba con SQLSTATE `42501 / AUTH_REQUIRED` y Edge lo convertía en 409 genérico.

Prueba previa: sonda service-role sobre la función desplegada → HTTP 400, `AUTH_REQUIRED`, caller `capture_document_requirements_snapshot`.
Prueba posterior: la misma sonda → HTTP 201; anónimo continúa `AUTH_REQUIRED`.

## Corrección aplicada

- Migración `20260830000300`: acepta sólo usuario autenticado o `service_role` en la validación de scope; no cambia filas.
- RPC `list_self_program_request_history()`: afiliado efectivo derivado en backend, ejecución sólo `authenticated`, sin selector cliente ni `SELECT` amplio.
- Edge `financial-legacy` v27: contrato de éxito con `request_id`, `folio`, `status`, `confirmed_amount`, `correlation_id`; errores públicos allowlisted y log interno sanitizado por etapa/código/SQLSTATE.
- Frontend: conserva `RequestSubmissionSuccess`; invalida exclusivamente la proyección descartable de Historial al seguir la solicitud; préstamo se proyecta como préstamo aun cuando su `request_type` interno sea `quote`.
- Cache cutover: bundle v170, repository v7, PWA v114.

## Seguridad y autoridad

| Control | Resultado |
|---|---|
| Anónimo ejecuta Historial self | `DENIED` |
| Afiliado A intenta leer solicitud de B | `DENIED` |
| Cliente intenta enviar `p_affiliate_id` | `DENIED` / firma RPC inexistente |
| Admin en contexto propio | `PASS` |
| Admin bajo impersonación transaccional | `PASS`, rollback |
| Campos excluidos | afiliado, `numero_control`, actor, firma, términos, snapshots, idempotencia |
| Error 409 conocido | `REQUIRED_DOCUMENTS_MISSING` + UUID de correlación; sin message/detail/hint/stack/SQL |
| Persistencia del 409 técnico | 0 solicitudes |

## E2E real y reversible

Se recorrió en Chrome real: login → Finanzas → préstamo → monto/plazo → destino → 8 documentos → resumen → firma → términos → confirmar → Edge 200 → fila y snapshots Supabase → pantalla aprobada → folio → Historial refrescado. Cada ejecución usó un marcador único; se verificó que no existieran eventos Admin/export y se eliminó exactamente su fila, documentos ligados por cascada y snapshot de sesión. Las tres fixtures técnicas se eliminaron; conteo final: 0.

| Matriz | Resultado |
|---|---|
| 390×844, movimiento normal | `PASS`; exactamente 1 confirmación 200; 42 piezas de confeti |
| 430×932, movimiento reducido | `PASS`; exactamente 1 confirmación 200; confeti 0 |
| 1280×900, desktop | `PASS`; exactamente 1 confirmación 200; 42 piezas de confeti |
| Folio/monto/status/snapshots | `PASS`, valores autoritativos coincidentes |
| `Seguir mi solicitud` | `PASS`, abre Historial principal y muestra el folio sin reload |
| Clasificación | `PASS`, `Suti Préstamo`, monto y plazo; no “Cotización comercial” |
| Google / Apps Script | 0 lecturas, 0 escrituras, 0 cambios |

Capturas:

- `docs/qa/evidence/request-submission-e2e/success-390x844-motion.png`
- `docs/qa/evidence/request-submission-e2e/history-390x844-motion.png`
- `docs/qa/evidence/request-submission-e2e/success-430x932-reduced.png`
- `docs/qa/evidence/request-submission-e2e/history-430x932-reduced.png`
- `docs/qa/evidence/request-submission-e2e/success-1280x900-desktop.png`
- `docs/qa/evidence/request-submission-e2e/history-1280x900-desktop.png`

## Comandos verificables

```text
node scripts/apply-request-submission-e2e-remediation.js
  PASS DRY_RUN_FORWARD_RECOVERY; dataRowsChanged=0
node scripts/apply-request-submission-e2e-remediation.js --apply
  PASS APPLIED; dataRowsChanged=0
node scripts/test-request-submission-history-live.js
  PASS anonymous/cross-user/selector/admin-self/impersonation
node scripts/test-request-submission-error-contract-live.js
  PASS 409/correlation/no raw DB details/persistedRequests=0
node scripts/test-request-submission-e2e-browser.js
  PASS 390×844/motion/fixtureCleanup
node scripts/test-request-submission-e2e-browser.js --reduced
  PASS 430×932/reduced/fixtureCleanup
node scripts/test-request-submission-e2e-browser.js --desktop
  PASS 1280×900/desktop/fixtureCleanup
node scripts/test-loan-submission-success-browser.js
  PASS shared loan/benefit/quote/membership success
node scripts/test-static-suite.js
  PASS 63/63
node scripts/build-bundle.js C:\tmp\sutiapp-babel-7.29.0.min.js
  PASS 92 files
node --check app/bundle.js app/financial-legacy-repository.js sw.js
  PASS
```

Bundle SHA-256: `522019A0E7F6C8ED6EFBB54441061BD6A4DC070AF4B9BDB32F9F9DE781D9194C`.
Edge source SHA-256 local: `C5FCE19709D460229FA2E9CC39BC1D86A4F9013F8371060E8BA6F5028E7E8C17`; bundle desplegado con policy: `14ef3160dc6c2964091b434d2cd3c831fd6f94607edc9af80d585a36c54c3fb0`.

## Revisión arquitectónica independiente

`sutiapp-architect-reviewer`: `APPROVED`. La H, el diff, la autoridad, la migración/recovery, la matriz live, los tres E2E reales y las capturas coinciden; no hay simplificación visual, segunda autoridad, apertura amplia de `program_requests`, fallback, escritura Google ni fixture persistente. `docs/WORK_QUEUE_HISTORY.md` no existe en el repositorio; se contrastaron `WORK_QUEUE.md`, `DECISIONS.md`, `DATA_MAPPING.md`, `SOURCE_OF_TRUTH.md`, invariantes, seguridad, legacy y changelog. Instrucción siguiente exacta: ejecutar preflight final, commit lógico, push a `origin/main` y verificar igualdad del SHA remoto.

```text
H-REQUEST-SUBMISSION-E2E-REMEDIATION-001 RESULT
Status: PASS
Files changed: migration/recovery; financial-legacy; request/history repositories and store; loan error mapping; shared success navigation; bundle/cache; tests; governance/evidence; Registry
Source-of-truth verdict: PASS — program_requests/request_documents remain authoritative; operationsStore is disposable projection only
Invariant verdict: PASS — financial calculations, document gate, real folio, shared success, identity context and UI contract preserved
Build: PASS — 92 sources; syntax valid; deterministic bundle hash recorded
Tests: PASS — static 63/63; migration forward/recovery; security/error live; three full real E2E matrices; shared success browser
Security: PASS — service-only writer retained; anon/cross-user denied; effective affiliate server-side; minimal projection; correlation sanitized
Legacy impact: NO INTERACTION — Google read 0 / write 0 / Apps Script change 0 / 146 rules, 35 funds, 3 programs preserved
Unexpected files changed: 0
Known limitations: productive Google append after Admin approval remains a separate owner-authorized Phase 7 action
Evidence: this file and four PNGs under docs/qa/evidence/request-submission-e2e/
```
