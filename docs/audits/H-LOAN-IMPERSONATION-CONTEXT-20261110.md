# H-LOAN-IMPERSONATION-CONTEXT-20261110

## PRE-CHANGE AUDIT

- Objetivo: reproducir y corregir el rechazo `IMPERSONATION_CONTEXT_INVALID` al confirmar un prestamo mediante asistencia administrativa valida.
- Base: `origin/main` 66cfbccfa7496ed806fdda6039a173778e02ce0d; rama aislada `fix/document-impersonation-context`.
- Autoridad: instruccion de correccion quirurgica del propietario, apartado 13 (implementacion y publicacion autorizadas), y reporte actual del bloqueo. No autoriza solicitudes reales de prueba ni cambios de permisos.
- Evidencia inicial: dos eventos productivos 2026-11-11 02:34:31Z / 02:35:05Z, 42501, fase COMPLETE. El contexto PostgreSQL localiza el origen en `capture_program_request_impersonation`, dentro del writer bancario. Estos eventos no incluyen un identificador de empleado y no se atribuyen individualmente a una cuenta.
- Causa a reproducir: el trigger consulta `is_active_admin()`, que durante asistencia exige que tanto el actor como el afiliado atendido sean administradores. La autorizacion de iniciar asistencia utiliza el permiso del actor real.
- Alcance: cuerpo del trigger existente; preservacion del actor real, afiliado objetivo, sesion, motivo y auditoria. No modificar `is_active_admin()` global ni writers/calculos financieros.
- Archivos previstos: este informe; `scripts/test-loan-impersonation-context.cjs`; `scripts/fixtures/loan-impersonation-context-before.json`; una migracion y su recovery en `supabase/migrations/` y `supabase/recovery/` (numero sujeto a verificacion de catalogo); evidencia sanitizada en `docs/qa/evidence/loan-impersonation-context/`; entradas de cierre en `docs/AGENT_CHANGELOG.md` y `docs/MIGRATION_RULES.md`. Helpers operativos solo en `.tmp/impersonation-diagnosis/`.
- Datos: exclusivamente fixtures sinteticos locales. Produccion: consultas de catalogo/logs y, solo tras verificar correccion, sustitucion del cuerpo de funcion autorizada. Sin DML de negocio, sesiones reales creadas, documentos/Storage, recuperación historica ni solicitudes reales.
- Fuentes de verdad: Auth para actor/sesion; `impersonation_sessions` y permisos administrativos vigentes para asistencia; `program_requests` y evidencia documental existentes para solicitudes. No fuente alternativa ni fallback.
- Lectores/escritores: Edge `financial-legacy` deriva contexto; finalizador documental verifica bytes y llama al writer; trigger captura actor/objetivo al insertar solicitudes. El trigger es compartido por los INSERT de `program_requests`, incluidos otros tipos de solicitudes; esos writers conservan sus propias autorizaciones. Todos salvo el cuerpo indicado permanecen intactos.
- Legacy: sin Google, Apps Script, reglas, tasas, plazos, capacidad ni importes cambiados. Equivalencia financiera por diff de funcion y prueba del writer real.
- Riesgo: alto por frontera de autorizacion. Publicacion condicionada a pruebas negativas de acceso cruzado, permiso revocado, sesion invalida y revision independiente.
- Pruebas: mismo caso antes/despues, prestamo propio y asistido con documentos, folio e idempotencia, denegaciones, metadatos de funcion/ACL/owner/search_path, reversión exacta y ausencia de cambios de filas por migracion. No se aceptara un caso sintetico como prueba de solicitud real productiva.
- Recovery: respaldo legible de definicion original y script inverso con guardas de deriva; ensayo local obligatorio antes de aplicar.
- Estado: PASS para reproduccion aislada. Publicacion pendiente de evidencia y revision.

## Guardians

Navigator: indice stale en workspace principal; inspeccion dirigida de fuente publicada y catalogo vigente. No cambio arquitectonico propuesto.

Source of truth: SAFE; autoridades existentes preservadas, fixtures solo locales.

Supabase / migracion: BLOCKED para publicacion hasta pruebas de actor/objetivo, aislamiento y recovery. No grants ni RLS nuevos.

Legacy: READ ONLY durante diagnostico; candidato SAFE CHANGE solo si se prueba equivalencia de writer/calculos y trazabilidad.

## Hallazgos adicionales, sin tocar

- `currentLoanSessionContext` no comprueba `impersonationResult.error`. No explica los dos eventos observados y no se corrige en esta intervencion.
- La UI agrupa varios rechazos bajo el mensaje de sesion cambiada. Este informe distingue el codigo real sin redisenar la pantalla.
- Las pruebas anteriores cubrian solicitud propia y carga administrativa, pero no la confirmacion asistida hasta el trigger final.
- El selector historico del trigger no filtra por `actor_auth_session_id`. La ruta financiera documental valida el SID y el afiliado efectivo antes de invocarlo; se prueba esa frontera. No se modifica el selector ni se declara validada toda ruta de INSERT directa.

## Bitacora

- 2026-11-11 02:43Z: catalogo productivo recuperado mediante SELECT en transaccion READ ONLY terminada con ROLLBACK. Cero filas de usuarios consultadas en este paso; cero escrituras productivas.
- Antes de implementar: alcance registrado; reproduccion y revision independiente delegadas en el worktree aislado.
- Catalogo consultado antes de numerar: `20261111000100` libre. Forward/recovery preparados con un solo reemplazo, guardas de definicion y comprobacion de todos los metadatos `pg_proc` salvo el cuerpo y del binding original.
- `node scripts/test-admin-access-protected-contract.js`: PASS, tres migraciones protegidas y diez invariantes conservadas. Suite estatica focal; no se presenta como prueba productiva de una solicitud.

## Resultado probado

El rechazo no exige perder un documento ni renovar un token. La asistencia valida activa `admin_support_private.context()`. `is_active_admin()` limita las acciones administrativas mediante la interseccion actor/afiliado; el trigger de alta de solicitudes confundia esa interseccion con el permiso de asistir del actor. ADR-051/ADR-097 permiten la solicitud asistida y exigen `affiliates.impersonate`; no exigen que el afiliado sea administrador.

Diff efectivo del unico cuerpo runtime cambiado:

```diff
- if not public.is_active_admin() or new.affiliate_id is distinct from ctx.usuario_contexto_affiliate_id then
+ if public.admin_actor_can_impersonate() IS NOT TRUE or new.affiliate_id is distinct from ctx.usuario_contexto_affiliate_id then
```

Se conservan identidad, sesion, motivo y captura de auditoria; los helpers globales, los writers financieros, RLS y los controles documentales no cambian. El resultado NULL del permiso tambien se rechaza.

`node scripts/test-loan-impersonation-context.cjs`: **16/16 PASS**, finalizado 2026-11-11 02:55:42Z. Un cluster PostgreSQL local con schema sin filas productivas; definiciones relevantes contrastadas con 15 funciones vigentes. El cliente privilegiado de prueba no incluye sub ni SID, y el finalizador real restaura el contexto original.

- Antes: `42501 / IMPERSONATION_CONTEXT_INVALID / COMPLETE`, mismo trigger y writer bancario del log productivo, cero solicitudes creadas.
- Despues: solicitud propia y asistida, afiliado ordinario con y sin Auth, folio, banco, documento/hash, actor/afiliado/sesion/motivo correctos. Retry devuelve la misma solicitud y una sola evidencia documental.
- Rechazo conservado para permiso revocado, asignacion o rol deshabilitado, asistencia terminada o vencida, otro SID y otro actor. Trigger compartido rechaza otro objetivo y administrador sin permiso de impersonacion.
- Recovery reproduce el error original y restaura exactamente cuerpo, metadatos y binding. Reaplicacion valida. Las demas definiciones y metadatos del catalogo local (4.369 funciones) permanecen intactos.
- Un primer setup de revocacion sintetica incumplia un CHECK de coherencia; se corrigio el fixture con la metadata de revocacion requerida, sin desactivar constraints ni cambiar runtime. Evidencia previa preservada.

Evidencia: [matriz](../qa/evidence/loan-impersonation-context/synthetic-sql.json), [antes](../qa/evidence/loan-impersonation-context/before.json), [contrato protegido](../qa/evidence/loan-impersonation-context/protected-contract.json), [pila productiva sanitizada](../qa/evidence/loan-impersonation-context/postgres-context-path.json).

## Recovery y limites

Script: `supabase/recovery/20261111000100_loan_impersonation_actor.sql`. Se ejecuta solo contra el hash corregido; restaura la expresion original sin tocar filas ni historia. Revertir solamente el commit de Git no revierte la funcion instalada. La reversión reinstaura tambien la limitacion original de confirmacion asistida.

El runner requiere el laboratorio PostgreSQL local existente y su schema-only; no es una suite portable ejecutada por CI. La prueba funcional descrita es sintetica. No se han creado solicitudes reales, iniciado sesiones de usuarios ni descargado documentos reales en esta intervencion. La coincidencia de codigo/pila identifica el defecto, pero los logs sanitizados no atribuyen los dos eventos a un empleado concreto.

El preflight productivo es READ ONLY: respaldo legible de la funcion, OID/owner/ACL/search_path/binding y 15 definiciones comprobadas; solo conteos/huellas agregados de siete tablas. No modifica datos. La version `20261111000100` estaba libre. El registro de migraciones termina en `20261109000300` aunque existen definiciones de 100 MB: discrepancia de metadata preexistente, sin reparar.

Revision independiente: APPROVED, sin hallazgos altos/criticos bloqueantes, vinculada a hashes exactos en [independent-review.json](../qa/evidence/loan-impersonation-context/independent-review.json). PR14 fusionado como `e6d6b55e6c04be88b7de9386c0bc3dde9163b229`; CI del PR 42949927236, contrato main 42950045628 y Pages 42950045631 terminaron success. Build frontend/regresion global de imagenes adicionales: NOT APPLICABLE; no se modifica frontend, Auth global, Storage, viewer, service worker ni repositories/helpers compartidos. El unico runtime candidato es este trigger SQL.

## Bloqueo historico antes de la autorizacion posterior

La revision automatica de aprobacion rechazo `release-trigger.cjs apply --authorized-after-review` antes de crear el proceso: falta evidencia de la compuerta previa de despliegue y regresion en preproduccion. No se ejecuto el SQL ni se intento eludir el rechazo por otro mecanismo. Las pruebas sinteticas locales no se presentan como despliegue en un entorno de preproduccion designado.

Readback de solo lectura, 2026-11-11 03:07:48Z: hash original `74ddf62f8613d5dc100e6bda7a5c213a`, cero filas para la migracion `20261111000100`. En ese momento el codigo estaba fusionado en GitHub y la correccion de base de datos no estaba aplicada. [Evidencia historica](../qa/evidence/loan-impersonation-context/release-blocked.json).

Comprobacion agregada de las tres cuentas autorizadas, sin nombres, UUIDs ni correos en evidencia publica: A/B/C tienen un unico afiliado no archivado y vinculo Auth confirmado. A/B carecen de asignacion administrativa habilitada; C tiene una. La causa de exigir que el afiliado sea administrador concuerda con A/B; no se atribuye ese mismo motivo a C. No demuestra elegibilidad, vigencia de asistencia ni resultado de una solicitud real. [Evidencia](../qa/evidence/loan-impersonation-context/accounts-readonly.json).

### Decisiones pendientes para el usuario

Ninguna para esta correccion puntual. La decision previa sobre la compuerta de preproduccion quedo resuelta por la instruccion posterior explicita de aplicar en produccion. No se extiende esta autorizacion a otras migraciones ni fases anteriores.

### Autorizacion posterior de aplicacion

Despues de explicar el alcance de las pruebas sinteticas y la compuerta de preproduccion, el propietario interrumpio la preparacion de preproduccion e instruyo expresamente: **"APLICALA EN PRODUCCION"**. Esta instruccion posterior autoriza aplicar exclusivamente el guard revisado. No autoriza datos de prueba productivos, solicitudes reales, cambios de permisos globales, documentos, reglas financieras ni infraestructura. El bloqueo previo queda registrado como historico; no se presenta la preproduccion como realizada. Se renovaron preflight/backup y pruebas de merge/CI antes de aplicar. La revision automatica aprobo la aplicacion bajo esta nueva instruccion.

## Produccion: aplicada y verificada

- 2026-11-11 03:26:15.740Z: inicio de aplicacion de `20261111000100`, contra main `e79bfd1434003c894b00cdc894c8b3e2bd2ae098`. PR14 contiene la correccion; PR15 conserva el bloqueo historico. PR15, contrato main y Pages tenian CI exitoso; hashes de SQL, recovery y pruebas coincidian con los revisados.
- 2026-11-11 03:26:21.323Z (10 de noviembre, 20:26:21 en Hermosillo): COMMIT completado y lectura posterior PASS. Una funcion y una fila tecnica de registro de migracion; cero filas de negocio modificadas por la liberacion.
- Hash de definicion normalizada: `74ddf62f8613d5dc100e6bda7a5c213a` -> `db1410e3a55d25934bc79a19db784111`. OID 20730, propietario, permisos, search_path y binding conservados; las otras 14 funciones capturadas permanecieron iguales.
- Conteos y huellas de siete tablas coinciden antes/despues dentro de la misma transaccion REPEATABLE READ: solicitudes, documentos de solicitud, snapshots bancarios, sesiones de asistencia, documentos de afiliados, assets privados y submissions. Esto acredita ausencia de escrituras de negocio por la liberacion; no afirma ausencia de actividad concurrente de otros usuarios.
- Respaldo de definicion original y catalogo legible y verificado; recovery ensayado en el laboratorio local. No hubo rollback productivo ni cambios de flags, infraestructura, objetos Storage o documentos.
- Revision independiente posterior: APPROVED. Confirma instalacion y preservacion de metadatos/huellas, sin afirmar ejecucion de una solicitud real.

Evidencia: [aplicacion y readback](../qa/evidence/loan-impersonation-context/release-applied.json), [revision posterior](../qa/evidence/loan-impersonation-context/post-deploy-independent-review.json). SHA-256 del comprobante de aplicacion: `99c0823e7f205d6a4efbec8e3bcb9b7f62bfb559ea829bb2fed542f9aff8d969`.

Resultado funcional respaldado por 16 pruebas sinteticas: un administrador con permiso vigente puede confirmar una solicitud asistida para un afiliado ordinario; no se exige que el afiliado sea administrador. Siguen aplicando las condiciones financieras y documentales existentes. Pendiente de observacion en uso real: confirmacion completa en navegador productivo; no se envio ninguna solicitud en nombre de 12376, 11905, 1412 ni de otro usuario. No se declara resuelto todo el programa documental ni cumplida su antigua Fase G.

## Cierre

```text
H-LOAN-IMPERSONATION-CONTEXT-20261110 RESULT
Status: PASS (correccion puntual instalada y readback verificado; sin solicitud real de prueba)
Files changed: trigger migration/recovery, fixture, prueba, auditoria y evidencia declaradas
Source-of-truth verdict: SAFE
Invariant verdict: PASS
Build: NOT APPLICABLE (SQL focal)
Tests: 16/16 SQL local; contrato administrativo protegido PASS
Security: denegaciones y atribucion PASS; revisiones independientes antes/despues APPROVED
Legacy impact: sin cambios de calculos, datos financieros ni Google
Unexpected files changed: ninguno
Known limitations: sin confirmacion real de usuarios; runner requiere laboratorio local; selector historico cross-SID sin modificar
Evidence: docs/qa/evidence/loan-impersonation-context/
```
