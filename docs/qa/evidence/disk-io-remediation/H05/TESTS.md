# H05 — Verificación

| Verificación | Evidencia | Estado actual |
|---|---|---|
| Preconditions H01–H04 | Sus VERIFICATION.md, comprobados antes de H05 | PASS |
| Definiciones, owner/ACL/SECURITY/search_path, RLS, índices y schema live | BASELINE.json y backend-after.json | PASS |
| Dos índices candidatos y equivalencia completa | benchmark.cjs, plan-A/B, equivalence-A/B | PASS; sólo B aplicado |
| Diez casos reales sin alterar entradas | conditional-equivalence.json, conditional-equivalence-live.json | PASS, 40 checks en cada etapa |
| Seguridad backend antes/live | security.json, security-live.json | PASS, seis escenarios por etapa |
| Invalidación de dependencias | invalidation-backend.json | PASS, cuatro escenarios transaccionales |
| Reutilización sin ejecutar proyección completa | conditional-warm-calls-live.json | PASS, cero llamadas al getter en warm |
| Memoria/identidad/errores/escrituras/concurrencia cliente | unit-tests.json | PASS, 19 casos aislados |
| Balance selector y foundation | release-focal-tests.json | PASS |
| Navegación real vacía y participante con impersonación | browser-local*.json, browser-equivalence.json | PASS, payload y HTML iguales |
| Históricos y datos completos | financial-table-equivalence.json | PASS, 24 tablas iguales |
| Rollback | recovery-rehearsal.json | PASS, diez casos y cliente abierto |
| Build aislado | release-build.json | PASS, sólo dos chunks entre 108 módulos |
| Regresión global local | global-local.json | PASS |
| Regresión global publicada y cierre de entrega | Se añaden tras publicar el build verificado | PENDING |

Los ensayos backend usan timeouts y transacciones revertidas. La captura de hashes de tablas es read-only. No se ejecutaron requests, retiros, liquidaciones, recálculos, imports ni escrituras financieras productivas para probar H05.

`focal-tests.json` conserva un fallo del workspace en una aserción preexistente de identidad pendiente del Admin Savings no publicado. H05 no modifica `screens-admin-savings.jsx`; su hash se verifica contra workspace-before. La variante publicada anterior pasa foundation, y el release H05 pasa después de actualizar únicamente la aserción del nombre de RPC para comprobar delegación. No se debilita la aserción de identidad ni se publica el trabajo pendiente del workspace.

Los tests live históricos que requieren H005_TEST2/TEST3 no se ejecutan con credenciales inventadas: sólo existe H005_TEST en este entorno. H05 aporta diez principales reales mediante transacciones SQL y navegación con impersonación autorizada, además de la cuenta real vacía. No se declara que se hayan ejecutado suites históricas que no se ejecutaron.
