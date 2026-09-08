# H04 — Verificación final

H04 RESULT

Status: PASS.

Preconditions: H01/H02/H03 PASS comprobados antes de iniciar. Protocolo Maestro y guardians aplicados. No se inicia otra H.

Files changed: migración/recovery 20260907000400_private_storage_rls_work.sql; evidencia y harness H04/**; Registry derivado, índice de remediación y apéndice AGENT_CHANGELOG. Ninguna fuente frontend, bundle, worker, Edge Function ni función SQL productiva cambia.

Source-of-truth verdict: SAFE. Supabase mantiene autoridad, relaciones, writers y autorización. Sin fuente paralela, fallback, caché de permisos ni dependencia nueva.

Invariant verdict: PASS. Misma autorización por owner, Admin, actor, sesión e impersonación; permisos documentales y de catálogo conservados. Sin cambios de negocio, estados, numero_control, finanzas o históricos por H04. La baseline coincidió con altas documentales anteriores al despliegue: no se afirma igualdad falsa de hashes iniciales. Se reconciliaron los deltas y los hashes son estables entre dos capturas posteriores.

Build: PASS. Artefacto público allowlist desde el commit publicado 4be7986b62f77c893150c710f98b362ba01e2e41, con los bytes exactos Git de sus 19 archivos fuente públicos y tres archivos de salida adicionales. La conversión CRLF de vendors del primer checkout se corrigió sólo en la preparación. Sin reconstrucción ni cambio del bundle productivo.

Tests: PASS. 192 comparaciones antes/candidato y 192 comparaciones contra la baseline sobre el despliegue; recuperación exacta, idempotencia y rechazo de drift ensayados. Regresión global local y GitHub Pages completa PASS: sello/Login, perfil, Admin Afiliados, documentos imagen/PDF legítimos, Membership, Préstamo documental, catálogo/galería, Marketplace, fullscreen, refresh y SW/noSW. Cero errores JavaScript. Registry: generation, freshness, stale, lookup, relaciones, permisos, incremental, secretos y determinismo PASS en checkout congelado.

Security: PASS. Sólo cambia USING de master_private_storage_authorized_read. Las 252 funciones, las otras 227 policies, RLS/owners/ACL, columnas, constraints y 29 definiciones de índices permanecen iguales. Bucket privado; ninguna ampliación o reducción de acceso. Helpers STABLE evaluados por statement, sin cachear entre requests. Vencimiento de firma real y de impersonación conserva rechazo.

Legacy impact: READ ONLY en dependencias. Sin Google, cálculos financieros, saldos o alteración histórica. Los accesos legítimos mantienen su auditoría operativa. Fixtures y sus triggers/auditoría se revierten; cero filas H04 persistentes.

Unexpected files changed: ninguno pendiente. El manifiesto contrasta 1.577 archivos previos; se conserva el trabajo ajeno. Dos SQL inicialmente generados fuera del repo por un error de raíz fueron retirados tras comparar sus hashes exactos; el incidente consta en TESTS.md. No se sustituyen archivos ajenos en la entrega aislada.

Performance: la consulta exacta pasa de 3.044 a 0 documentos examinados y de 28.164 a 757 buffer hits (−97,31 %), sin índices nuevos. Las tres muestras live son 29,344 / 36,197 / 82,092 ms frente a 2.035,627 ms en la baseline fresca. has_admin_permission: 6.172→106 llamadas; get_effective_affiliate_id: 3.113→81. Scans de catálogo independientes conservados.

Observation: 89,134 s después de las pruebas: 336 commits, cero rollbacks/deadlocks, cero lock waiters en los extremos y cero eventos ERROR devueltos por logs. Hubo tres temporales globales (13.469.087 bytes); no se atribuyen a la consulta focal ni se declara resuelto el I/O del host. La ingesta de logs puede tener retraso.

Rollback: disponible y probado con los archivos definitivos. Repone exclusivamente el predicado original, con guards de hash/roles/RLS/bucket, lock timeout 2 s y statement timeout 15 s. No requiere rollback frontend ni recuperación de datos. Ver ROLLBACK.md, recovery-final.json y drift-rejection.json.

Known limitations:

- No existe estado/fecha documental EXPIRED: NOT APPLICABLE como regla documental. Se probaron documento VERIFIED antiguo, expiración real de impersonación y URL firmada.
- Buffers no equivalen a bytes físicos. La aceleración corresponde a esta consulta; no demuestra una solución de memoria/swap ni del Disk IO Budget global.
- La matriz combina identidades reales y fixtures transaccionales; las regresiones HTTP/Chrome usan assets legítimos. No se presentan fixtures como datos productivos.
- Los fallos de preparación, timeout de metadata y actividad concurrente anterior al despliegue están documentados en TESTS.md. No se alteró ningún dato para hacer pasar un assert.
- WORK_QUEUE_HISTORY.md falta; WORK_QUEUE gobierna otro plan legacy. La autoridad H04 es la solicitud explícita; no se inventa aprobación de un orquestador ni continuidad a otra H.
- La revisión automática bloqueó la limpieza de las carpetas vacías Documentos/supabase/migrations y recovery creadas durante la preparación; no dio una razón más específica. Los SQL erróneamente ubicados ya se retiraron. Es una limitación local sin efecto en H04 productivo.

Evidence: [baseline](BASELINE.md), [implementación y equivalencia](IMPLEMENTATION.md), [matriz](SECURITY_MATRIX.md), [tests](TESTS.md), [before/after](BEFORE_AFTER.md), [backend](backend-equivalence.json), [global local](global-local.json), [global publicada](global-production.json), [performance](performance-live.json), [observación](observation-summary.json), [guardians](GUARDIAN_REVIEWS.md), [rollback](ROLLBACK.md), [revisión arquitectónica](ARCHITECT_REVIEW.md).

H04 STATUS: PASS

STATUS: PASS
