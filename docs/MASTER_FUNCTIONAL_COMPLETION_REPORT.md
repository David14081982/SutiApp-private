# H-MASTER-FUNCTIONAL-COMPLETION-001 — evidencia de cierre

Fecha: 2026-08-25

## Resultado por dominio

| Dominio | Estado | Evidencia principal |
|---|---|---|
| Catálogo documental 8/8 + 4 tipos de aval | PASS | 12 `document_types`; nombres históricos exactos; CRUD, activación y orden persistente. |
| Expediente general | PASS | 3,421 relaciones canónicas sobre 12,901 archivos; 0 cargas/duplicados masivos. |
| Revisión Admin | PASS | filtro, preview firmado, aprobar/rechazar/recarga y auditoría backend. |
| Datos bancarios nuevos | PASS | tabla/RLS/RPC multiaccount; inicia vacía. |
| Importación bancaria histórica | OWNER_DECISION_REQUIRED | autoridad documental `UNRESOLVED`; 0 filas importadas. |
| QR de credencial | PASS | token efímero, hash backend, destino allowlisted y QR estándar local sin PII. |
| Requisitos de préstamo/membresía | PASS | 29 reglas, reutilización verificada y snapshots por solicitud. |
| Solicitud de membresía | PASS_WITH_OWNER_CONTENT_REQUIRED | UI y RPC completas; falla cerrada hasta publicar términos legales. |
| Préstamo — documentos/firma/finalización | PASS_WITH_OWNER_CONTENT_REQUIRED | flujo conectado; cotización legacy intacta; términos reales obligatorios. |
| Confetti de confirmación | PASS | tres pasadas y navegación sin autoridad financiera local. |
| Aislamiento y seguridad | PASS | RLS live A/B/Admin/anon; 0 fixtures; tabla QR oculta. |
| Google/Apps Script/finanzas | NOT APPLICABLE / NO CHANGE | no se modificaron cálculos, tasas, saldos, fórmulas ni conciliaciones. |

## Reconciliación live

`already_applied=true`; afiliados 947; archivos históricos 12,901; solicitudes existentes 2; documentos canónicos 3,421; tipos 12; requisitos 29; cuentas bancarias 0; términos 0. RLS forzada confirmada en expediente y banco.

## Verificación ejecutada

- Bundle construido desde 90 archivos y `node --check` PASS.
- `test-completion-queue.js`, `test-affiliate-expediente.js`, `test-phase4.js`, `test-phase7.js` y `test-loan-simulator-ui-cutover.js`: PASS.
- Chrome odómetro: 100/1,000/3,000 ms, duración exacta y máxima 1,000 ms, A→B→A, reduced/frozen/accessibilidad: PASS.
- Chrome Perfil/Credencial con H005_TEST/H005_TEST2/H005_TEST3: PASS; cero fuga de fotografía y refresh vuelve a resolver Supabase.
- RLS live read-only: anónimo 401, cruce documental 0, banco aislado, Admin sin capacidad bancaria 0, tokens QR 403, fixtures 0.

## Riesgos y decisiones pendientes

1. El propietario debe aprobar/publicar el primer texto legal para préstamo y para cada membresía. Hasta entonces la ausencia de términos es visible y bloquea el envío.
2. La importación de datos bancarios históricos requiere identificar y aprobar su autoridad, mapping, integridad, backup y recuperación. No se inferirá desde el Excel ni desde campos de presentación.

## Recuperación

La migración tiene script de recuperación que deshabilita configuración y writers sin destruir solicitudes, snapshots, auditoría o historia. Los 12,901 archivos/relaciones históricas no fueron reescritos.
