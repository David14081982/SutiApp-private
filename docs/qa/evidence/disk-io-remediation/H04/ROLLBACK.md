# H04 — Recuperación

Ejecutar `supabase/recovery/20260907000400_private_storage_rls_work.sql` sobre el mismo proyecto mediante conexión administrativa autorizada. Es una transacción acotada con lock_timeout 2 s, statement_timeout 15 s y search_path vacío. Conserva el objeto policy y repone únicamente USING; no elimina ni recrea tablas, funciones, grants, datos o índices.

Hash original del predicado normalizado: `be9066257c7206214dcf5cbc4038984d`. Hash H04: `767fe699b0dc607481bfbb0e68ca1680`. Si la policy, roles, comando, permisividad, WITH CHECK, RLS o bucket difieren de lo previsto, el guard aborta. No forzar el guard ni sustituir una definición posterior desconocida.

El backup lógico exacto está en policy-definitions.json y BASELINE.json. recovery-rehearsal.json registra apply → apply idempotente → recuperación → recuperación idempotente → reapply → ROLLBACK. Los guards verificaron ambos hashes dentro del ensayo. No hubo datos persistentes que recuperar.

Después de recuperar: comprobar hash original, las 227 policies restantes, funciones/ACL/RLS y bucket privado; ejecutar matriz de acceso y regresión global. La recuperación restituye el coste anterior de la autorización. No necesita rollback frontend porque H04 no cambia JavaScript, contratos, URLs ni worker.

Los fixtures SQL tienen BEGIN/ROLLBACK y timeouts. No son seeds productivos. La consulta de reconciliación en backend.cjs verifica cero assets, objetos, roles y elementos de catálogo H04 persistentes. Los accesos legítimos del navegador mantienen su auditoría operativa habitual.
