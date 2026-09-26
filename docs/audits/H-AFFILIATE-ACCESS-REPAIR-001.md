# H-AFFILIATE-ACCESS-REPAIR-001 — Diagnóstico y reparación de acceso en Admin › Afiliados

Fecha: 2026-09-26. Estado: `PRODUCCIÓN PASS` (publicado por autorización OWNER).

## Origen

Auditoría del caso control 13838. Producción, solo lectura:

- La importación marcó `duplicate_email` en la segunda fila con el mismo correo (`import-affiliates.py:190`).
  La fila #836 (control 6614, otra persona) tenía el correo del afiliado 13838 y quedó `eligible`. La #838 (13838) quedó bloqueada.
- El 2026-09-04 la cuenta Auth del afiliado 13838 se reclamó sobre la fila #836 y veía datos ajenos.
  La reparación `H-AFFILIATES-CSV-AUTH-LINK-REPAIR-001` omitió el caso porque el control 6614 estaba duplicado.
- El 2026-09-22 se borró el correo de la #836. La cuenta siguió unida a esa fila, lo que produce `IDENTITY_MISMATCH` al iniciar sesión,
  y la #838 conservó `duplicate_email`: la elegibilidad se guarda y ningún writer ni trigger recalcula la fila hermana, por lo que al activar devuelve `NOT_ELIGIBLE`.
- Mismo patrón: 7370 y una fila sin control (cuentas unidas a filas cuyo correo se borró) y 12 filas `duplicate_email` sin activar.

## Decisiones OWNER

- Permiso: se reutilizan `affiliates.read` (diagnóstico) y `affiliates.write` (reparación). Sin permiso nuevo.
- El caso 13838 se repara con la herramienta ya publicada, no por separado.
- Cambio quirúrgico, con punto de restauración previo.

## Punto de restauración

- Git: tag `restore/pre-affiliate-access-repair-20260926` (HEAD `7fa614b`) y
  `restore/pre-affiliate-access-repair-20260926-worktree` (cambios sin commit de archivos rastreados ajenos a esta H).
- Base de datos: la migración solo **agrega** objetos. `supabase/recovery/20260926000100_affiliate_access_repair_recovery.sql`
  los elimina y deja idénticas las funciones, permisos y triggers existentes (verificado en `ROLLBACK`).
  Antes de ejecutar el recovery, cada reparación de datos se revierte con `revert_affiliate_access_repair(id)` (solo `service_role`).

## Cambios

Base de datos (`20260926000100_affiliate_access_repair.sql`), aditiva, sin DML de negocio:

| Objeto | Uso |
|---|---|
| `affiliate_access_repairs` | Evidencia de cada reparación, manual o automática, con estado antes/después. RLS forzada, sin grants browser. |
| `get_admin_affiliate_access_diagnosis(uuid)` | Diagnóstico de solo lectura (`affiliates.read`). |
| `list_admin_affiliate_access_issues()` | Lista de trabajo «Problemas de acceso» (`affiliates.read`). |
| `admin_relink_affiliate_account` | Pasa la cuenta Auth confirmada cuyo correo coincide de forma única con esta ficha. Rechaza correo compartido y reparación certificada. |
| `admin_release_affiliate_account` | Separa una cuenta cuyo correo no corresponde a la ficha. Rechaza vínculos sanos y certificados. |
| `admin_recalculate_affiliate_access` | Solo retira un bloqueo que ya no aplica; nunca agrega uno. |
| trigger `affiliates_release_stale_duplicate_email` | Al cambiar o borrar un correo, libera la ficha que quedó única y bloqueada como duplicada. |
| `revert_affiliate_access_repair(bigint)` | Deshacer técnico, solo `service_role`; se niega si la fila cambió después. |

Todas las RPC admin: `SECURITY DEFINER`, `search_path=''`, `auth.uid()`, versión optimista, motivo opcional de hasta 400 caracteres,
evento `UPDATE` en `affiliate_admin_events` (campo `acceso_app`). `anon` sin ejecución.
No se modificaron `get_current_affiliate_access_state`, `get_effective_affiliate_id`, `claim_affiliate_identity`,
`get_affiliate_activation_status` ni los writers de Afiliados.

Frontend (solo 2 chunks del bundle, v293 / worker v227):

- `admin-affiliates-repository.js`: `accessDiagnosis`, `accessIssues`, `accessRepair`.
- `screens-admin-affiliates.jsx`: panel «Diagnóstico de acceso» en la pestaña Acceso; botón «Problemas de acceso»;
  aviso en «Editar información» al cambiar el correo de una ficha con cuenta unida.

## Verificación

| Prueba | Resultado |
|---|---|
| `scripts/test-affiliate-access-repair.js` (producción dentro de `ROLLBACK`) | 41/41 PASS |
| Igual, con recovery | 44/44 PASS: objetos eliminados, funciones y permisos existentes idénticos |
| `scripts/apply-affiliate-access-repair.js --dry-run` | Sobre de despliegue PASS, nada persistido |
| `scripts/test-affiliate-access-repair-browser.js` (Chrome, backend aislado, personas ficticias) | 8/8 PASS, 0 errores; 390/1024/1440 px sin scroll horizontal |
| Regresión `test-affiliates-edit-documents-browser.js` (copia con evidencia en scratch) | PASS: edición, documentos, seis formularios, cinco tamaños |
| `scripts/build-affiliate-access-repair.js` | La receta reproduce byte a byte los chunks de HEAD; 132/134 chunks intactos |
| Carga completa de `SutiApp.html` HEAD vs nuevo | Mismo comportamiento; única diferencia: las 3 funciones nuevas |

Casos probados con datos reales en `ROLLBACK` (resueltos por número de control, sin datos personales en el repositorio): el afiliado 13838 queda en `ACTIVE` y su sesión resuelve la ficha 13838 y ve solo su fila por RLS;
su correo pasa a `ALREADY_ACTIVATED`; la fila errónea queda sin cuenta (`missing_email`); el deshacer técnico restaura el estado exacto;
la ruta alterna (separar → quitar bloqueo → unir) llega al mismo estado; la edición existente libera sola al duplicado.
También se comprobaron las negaciones: versión vieja, vínculo sano, reparación certificada, correo compartido, afiliado sin permiso y anónimo.

No ejecutado: `test-admin-affiliates-browser.js` (prueba en vivo) porque requiere `H005_TEST3_*`, que no existe en `supabase.env`.

## Publicación

- Migración aplicada con `scripts/apply-affiliate-access-repair.js --apply`: dry-run previo PASS y sobre sin cambios en filas, funciones, permisos ni triggers existentes.
  Read-back: 8 funciones, trigger activo, RLS forzada, 0 reparaciones; `anon` sin ejecución y `revert` no ejecutable por `authenticated`; 988 afiliados; caso 13838 intacto.
- Commit `fdd23cc` en `main`; Actions `36261058669` SUCCESS.
- sutiapp.com sirve bundle v293 (SHA-256 `7100efe4…9962`, idéntico al local) y worker `sutiapp-v227`.
- Tag `restore/pre-affiliate-access-repair-20260926` publicado en origin.
- Pendiente OWNER: reparar el caso 13838 desde Admin › Afiliados › Problemas de acceso › «Pasar la cuenta a este afiliado».
