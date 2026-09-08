# H05 RESULT

Status: PASS

H01/H02/H03/H04 PASS comprobados antes de iniciar y reconfirmados en `preconditions.json`. H05 se ejecutó bajo la solicitud explícita y el Protocolo Maestro. No se inicia H06.

## Resultado demostrado

Un índice de 770.048 bytes acota historia/futuro de 42.229 a 93 filas examinadas en la muestra; sus buffer hits pasan de 1.676 a 9. La RPC original completa pasa de 11.523 a 1.227 hits en la muestra live. Las validaciones estables usan 75 hits y cero llamadas al getter completo. Tiempos y límites de comparación en BEFORE_AFTER.md.

Finanzas → Ahorro → Finanzas: dos RPC totales antes y después; dos proyecciones completas pasan a una más una validación. Con participante real, 32.100 → 16.751 bytes. El retorno ya conservaba Finanzas montada. No se promete una reducción de tres RPC a una que no se haya medido.

FINANCIAL_EQUIVALENCE = PASS

- Diez casos reales: payload JSONB completo idéntico antes/después, todos los campos y orden de arrays. Cuarenta checks del endpoint candidato y otros cuarenta live.
- Conteos y hashes de filas completas de las 24 tablas Savings idénticos.
- Getter certificado y helper de acciones exactamente iguales; ninguna regla financiera, histórico, saldo, rendimiento, periodo o evidencia recalculado.
- Seguridad backend equivalente: owner/otro, anon, actor ausente, Admin e impersonación. La versión no selecciona objetivo ni sustituye autorización.
- Invalidación por datos relevantes, fecha/zona, identidad, sesión, contexto, impersonación, escrituras y errores. Diecinueve pruebas aisladas; navegación real local/publicada, refresh y fallo controlado PASS.
- Payload y HTML de Ahorro/detalles coinciden antes/local/publicado para cuenta vacía y participante certificado.
- Regresión global local/GitHub Pages PASS: sello/Login, foto, Admin Afiliados, documentos imagen/PDF, Membership, Préstamo, programas/galería, Marketplace, fullscreen, refresh y comparación con/sin service worker.
- Recovery ensayado: diez resultados completos idénticos, retiro del índice y endpoint fresco compatible con clientes abiertos. Idempotencia y rechazo de drift PASS.

Files changed: dos fuentes Savings, tres tests focales (uno actualizado), migración/recovery H05, bundle/versiones generados, Registry derivado, changelog/índice de evidencia y carpeta H05. Detalle en release-staged-files.txt y workspace-preservation.json.

Source-of-truth verdict: PASS — Google legacy autoritativo, Supabase SHADOW certificado, memoria efímera derivada validada en backend; sin cutover ni fallback financiero.

Invariant verdict: PASS — 24 tablas y 252 funciones existentes sin cambio; 228 policies existentes idénticas. No Google/Apps Script/ledger/cálculo financiero modificado.

Build: PASS — release aislado desde 19eb53d, sólo dos chunks modificados entre 108; bundle 222 / worker 169. El bundle del workspace conserva sus cambios previos, demostrados por reconstrucción/hash.

Tests: PASS — release-focal-tests.json, conditional-equivalence-live.json, security-live.json, invalidation-backend.json, browser-production-equivalence.json, global-local.json, global-production.json y registry-tests.txt.

Security: PASS — backend/RLS/owner/grants existentes conservados, sin secretos en archivos cambiados ni service role browser; contexto financiero no persiste en almacenamiento cliente.

Legacy impact: cero DML financiero/histórico. Fixtures nuevos exclusivamente transaccionales revertidos. Browser usa sólo identidad start/stop auditada para leer el participante real.

Unexpected files changed: ninguno frente a 1.670 archivos de baseline. Cambios pendientes de otros trabajos preservados y excluidos del release.

Delivery: commit funcional `099a40fcddaee295d6b38f4ad7ad8e91b195b592`; workflow `34177450122` SUCCESS. Veintiún archivos públicos comprobados byte por byte. El commit posterior de evidencia no modifica el build funcional.

Known limitations: muestra de rendimiento finita y host con presión variable; no se declara resuelto el paging de H02. El estado vacío añade 51 bytes en la navegación medida. No hay caso Q nulo en la población real elegible; el selector nulo se prueba aislado. Un fallo preexistente del test foundation en Admin Savings no publicado se conserva en el workspace; el baseline publicado y el release H05 pasan. Observación global: temporales ajenos a las ejecuciones HTTP de la RPC H05 y una denegación en program_requests sin caller atribuido; ver OBSERVATION.md.

Evidence: esta carpeta, IMPLEMENTATION.md, BEFORE_AFTER.md, SECURITY_MATRIX.md, TESTS.md, OBSERVATION.md, ROLLBACK.md y ARCHITECT_REVIEW.md.

H05 STATUS: PASS
