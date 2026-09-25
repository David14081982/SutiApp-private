# Reglas de migración

## 20260924000400 — motivo opcional en Afiliados — APPLIED

Autorización: solicitud expresa del propietario en H-AFFILIATES-OPTIONAL-REASON-001.
Siete RPC conservan firmas/OIDs/ACL/owners y todos sus controles excepto mínimo
del motivo. Cinco CHECKs permiten longitud 0–500; NOT NULL, PK/FK, triggers, RLS,
auditoría, identidad y datos permanecen intactos. Sin DML de negocio.
Forward/recovery comparan definiciones exactas y fallan ante deriva. Recovery
restaura CHECKs antiguos sólo si toda la historia los satisface; de otro modo
revierte la transacción completa, sin borrar ni inventar motivos. Backup de
catálogo sin datos personales: scripts/fixtures/affiliates-optional-reason-20260924.json.
Pruebas PostgreSQL aisladas y navegador: docs/qa/evidence/affiliates-optional-reason-20260924/.
Estado de aplicación y limitaciones: docs/audits/H-AFFILIATES-OPTIONAL-REASON-001.md.
Aplicación transaccional PASS: trece tablas con conteos/huellas intactos; mismos
OIDs, owners, ACL, RLS y grants. No se ejecutaron operaciones sintéticas en producción.

## 20260921000300 / 20260921000400 ? certification/receipt compatibility ? APPLIED

Owner-authorized all-Q certification: three certification/review functions accept
one exact active identity despite archived duplicates and zero openings before genuine
future starts. Receipt-specific private identity helper applies the same rule to
receipt/reconciliation entry points. Shared runtime/payout/P0 guards are unchanged.
Existing private function backup table, exact recovery/ACL/owner tests PASS; no new
permissions. Both migrations applied with 2s lock / 60s statement timeouts. Positive
future opening and two active identities remain rejected. Final Q readback 328/328.

## 20260921000100 / 20260921000200 ? Savings reconciliation/removal recovery ? APPLIED / VERIFIED

Add two authenticated admin RPCs delegating to existing financial/review writers and
one private immutable recovery table with forced RLS/no API grants. Backend verifies
bank confirmation, versions, permissions and idempotency. Isolated migration and
exact data recovery including beneficiary dependencies PASS. Lock timeout 2s,
statement timeout 60s. No existing P0 function or permission changed. Owner explicitly authorized both migrations and removal; production application
and readback PASS. One initial removal transaction rolled back fully on a history
guard; isolated recovery coverage was extended before the successful retry. Recovery drops additive RPCs
without deleting receipt evidence; the removal recovery restores the specific archived
batch with original UUIDs and refuses conflicts. Archive remains private evidence.

## 20260920000100 — excepciones de Ahorro — PREPARED, NOT APPLIED

Validación sólo aislada por decisión OWNER: prohibido DDL de prueba en producción,
incluso con ROLLBACK. Reutiliza `savings_audit_events` para excepciones/evidencia,
agrega RPCs y capacidades específicas mediante el registro de permisos existente,
respalda cuatro definiciones y el constraint de permisos antes de sustituirlos.
No crea tablas ni reescribe historia. Permanencia real, ledger y publicación conservan
su autoridad. `lock_timeout=2s`, `statement_timeout=60s` para una eventual aplicación
explícitamente autorizada; estas sentencias no se han ejecutado en producción.

Forward y recovery pasan en PostgreSQL aislado con contratos actuales, constraints,
índices, RLS/grants y fixtures sintéticos. Recuperación: restaura definiciones/ACLs
anteriores, inhabilita nuevas RPCs y conserva evidencia/backup. Retira metadatos de
capacidades sólo sin uso ni delegaciones que quedarían huérfanas. El ROLLBACK exterior
del ensayo restaura datos y esquema previos. Evidencia y límites:
[auditoría P0](audits/H-SAVINGS-P0-WITHDRAWAL-SETTLEMENT-001.md).

Release futuro, separadamente autorizado: verificar deriva y número de migración,
respaldo/recuperación y ventana; comprobar OAuth Sheets del nuevo Edge sin operaciones
financieras; aplicar backend antes del frontend; verificar JWT/grants/denegaciones y
readback. Un PASS aislado no autoriza ejecutar esa secuencia en producción.

## 20260917000300 — copy editorial de Suti Inversión

APPLIED / VERIFIED — 2026-09-17. Crea `public.investment_screen_copy` con 25 filas sembradas: las cadenas exactas ya publicadas en `screens-inversion.jsx`, de modo que aplicar la migración no cambia un solo píxel de la pantalla. Aditiva pura: ninguna tabla, columna, constraint, índice, política o función existente se toca; reutiliza los triggers ya instalados `set_h0072_updated_at()` y `audit_admin_write()`.

Contrato de llaves cerrado por diseño: `authenticated` recibe `select,update` y **nunca** `insert` ni `delete`, así que el panel puede cambiar valores pero no inventar ni destruir llaves. Una llave nueva (por ejemplo un cuarto paso de «Cómo funciona») exige otra migración. `update` exige `has_admin_permission('workflow.write')`; `select` es público como el resto del contenido de pantalla. `check` de formato en `id` y de longitud 1–400 en `value`.

Registra además el módulo `inversion` en `admin_section_definitions` (`module_order` 36, lectura `workflow.read`, escritura `workflow.write`) para que sea delegable como cualquier otro panel, y una política `restrictive` de `update` acotada a ese módulo. La lectura permanece abierta a propósito: una política restrictiva de `select` dejaría sin pantalla de inversión a un administrador acotado que además es afiliado.

No almacena ningún número que consuma la simulación: `RATE`, `MIN`, `MAX`, `STEP`, `TERMS` y la fórmula permanecen en código por ADR-070, enmendado sólo para el texto por ADR-111. Recovery: `drop table public.investment_screen_copy cascade` más `delete from public.admin_section_definitions where section_key='admin_inversion'` — sin efecto sobre otras autoridades; la pantalla queda sin copy y muestra su estado de reintento hasta reponer la tabla.

**Numeración.** El candidato nació como `20260917000200` y hubo que renumerarlo: ese número ya estaba instalado por `voting_vote_admin`. El árbol de trabajo del propietario estaba 102 commits detrás de `origin/main` y no tenía esa migración ni `voting_live` ni `banners_audience`. Antes de numerar una migración hay que consultar `supabase_migrations.schema_migrations`, no el directorio local. Por lo mismo el módulo se registró con `module_order` 36: producción ya tenía 35 módulos.

Verificación: ensayo completo con ROLLBACK (matriz de grants, RLS forzada, 3 políticas con la restrictiva, 2 triggers, módulo registrado, digest de la semilla y prueba de que ninguna otra autoridad cambia) y aplicación en transacción `repeatable read` con snapshot antes/después — `otherAuthoritiesChanged: 0`. Post-apply contra el camino real de la app: lectura anónima por PostgREST 200 con las 25 filas, `PATCH`/`DELETE` anónimos 401, y bajo ROLLBACK un administrador con `workflow.write` actualiza 1 fila mientras un afiliado sin permiso actualiza 0, con auditoría registrada. Ninguna de esas pruebas persistió: digest y `hero.title` intactos, 0 filas de auditoría. Local sin red: `node scripts/test-investment-copy-admin.js`. Evidencia: `docs/qa/evidence/investment-copy-admin-20260917/`.

## 20260917000100 — audiencia y color de banners

APPLIED / VERIFIED. Aditiva: columnas de audiencia (modelo `company_benefits`) y `accent_hue` con checks y defaults («Todos», sin acento), grants por columna, política `banners_public_read` con `matches_current_affiliate_audience` y RPC `list_public_banners`. No modifica filas existentes ni archivos. Punto de restauración previo: `ads_restore_private` (banners, archivos, políticas, grants) y tag `restore/pre-anuncios-segmentados-20260917`. Forward, matriz y recovery con `ROLLBACK`; producción idéntica tras la prueba. Recovery `supabase/recovery/20260917000100_banners_audience.sql` elimina la RPC y restaura la política anterior, conservando columnas y valores como dato inerte. Evidencia: `docs/qa/evidence/anuncios-convenios-20260917/`.

## 20260916000200 — votación en vivo

APPLIED / VERIFIED. Aditiva: tabla `voting_live_state` (una fila por consulta, FK compuestas a preguntas, RLS forzada, SELECT browser filtrado por audiencia y publicación Realtime), constraint `electorate` relajada a `>= 0`, seis funciones reemplazadas con guardas md5 contra la línea base y cinco funciones nuevas. No modifica consultas, preguntas, votos ni bitácora existentes; sólo agrega la fila en vivo vacía por consulta. Punto de restauración previo: esquema privado `voting_restore_private` (copias y definiciones con md5) y tag `restore/pre-votacion-en-vivo-20260916`. Forward, matriz y recovery se ejecutaron juntos con `ROLLBACK`; la aplicación conservó conteos y huella de votos. Recovery `supabase/recovery/20260916000200_voting_live.sql` retira la publicación y funciones nuevas, restaura las definiciones exactas y eleva a 1 sólo los totales en 0 antes de restaurar `electorate > 0`; conserva `voting_live_state` inerte. Evidencia: `docs/qa/evidence/voting-live-20260916/`.

## 20260916000100 — edición de foto de perfil

APPLIED / backend VERIFIED. Marcador aditivo `affiliate_files.is_current_profile_photo`, índice único parcial y RPC self-only. Inicializa el marcador desde el contrato histórico Photo/DK sin cambiar timestamps de importación; el trigger de timestamps se deshabilita solo durante ese backfill dentro de la misma transacción y se reactiva antes de commit. No cambia políticas Storage ni borra objetos, relaciones o documentos. La matriz live se ejecutó con ROLLBACK; recovery compilado/revertido antes de apply. Recovery de schema aborta si hay una edición de foto auditada para evitar perder la selección vigente. Evidencia: `docs/qa/evidence/profile-photo-edit-20260916/`.


## 20260908000500 — referencia bancaria de la solicitud

APPLIED / VERIFIED. Modifica sólo la proyección del lector existente; firma, OID, ACL y todos los
campos previos idénticos. Backup privado en C:/tmp/sutiapp-request-banking-20260908/before.json.
Recovery versionado restaura exactamente la función anterior. Dry-run/recovery con ROLLBACK y
comparación de las 51 solicitudes de la ejecución final PASS; hashes de solicitudes, capturas y cuentas intactos.
Pruebas de denegación bancarias usan un savepoint revertido, sin persistir cambios de permisos.
No cambia tablas, constraints, índices, políticas, triggers ni writers de negocio.

## 20260908000300 — referencias de sincronización verificadas

APPLIED / VERIFIED — PASS. Conserva firma, OID 48657 y ACL de finish_program_request_google_sync;
añade auditoría privada con RLS forzada y SELECT service-only. No cambia writers de aprobación/workflow.
Backup del RPC real y GAS14 en C:/tmp/sutiapp-reference-reconcile-20260908. Dry-run de migración y
recuperación del RPC PASS con ROLLBACK; aplicación y reversión de los 13 registros también PASS,
conservando las 12 entradas de auditoría dentro de la prueba antes del ROLLBACK final.
La recuperación versionada restaura exactamente el RPC anterior y conserva la tabla/historia de auditoría.
El plan inverso de localizadores/errores y las celdas Google previas son privados, con guardas de revisión.
Aplicados 3 localizadores, 2 legacy_reference y 9 errores de destino ausente; 0 estados de negocio alterados.
GAS15 usa el deployment previo. Reintento real de igual revisión libera lease y conserva Iniciado.
Evidencia: docs/qa/evidence/reference-reconciliation-20260908.

## 20260904000300 — reparación certificada de vínculos Auth por CSV

Estado: `APPLIED / VERIFIED — PASS`. La migración agrega manifest, snapshot y reparación auditada service-only; no modifica filas al instalarse. El writer fija el CSV de 947 filas por SHA-256, bloquea `public.affiliates`, toma locks de los principals vinculados y recalcula dentro de la transacción la unicidad de email/control CSV, control Supabase, elegibilidad, archivo y ocupación del target. Cualquier carrera produce `LIVE_PREFLIGHT_CHANGED` y cero escrituras.

El lote `8ebd3cd8-1f57-5054-953d-c2a7fe12af66` conservó los 84 UUID Auth existentes, guardó snapshot de 21 afiliados y movió 11 vínculos mediante clear/assign transaccional. No actualizó `auth.users`, email histórico, nombres ni controles. Resultado: 65→76 vínculos correctos, 15 cruces detectados, 8 ambiguos omitidos y 0 cruces determinísticos restantes. Las tablas fuerzan RLS y carecen de grants browser; el resolvedor sólo admite evidencia activa exacta UUID+email confirmado+afiliado+control.

Forward y schema recovery compilaron juntos en `ROLLBACK`; el recovery de datos también restauró los 11 vínculos dentro de `ROLLBACK`. Recovery real queda bloqueado si cualquiera de las 21 filas cambió después del apply. El schema recovery sólo procede con cero historia y nunca elimina auditoría aplicada.

## 20260903000140 — corrección focal de workflow en Admin Finanzas

La migración es aditiva y no reescribe solicitudes ni snapshots históricos: agrega referencias de etapa a la bitácora, RPC de lectura/transición, sincronización continua de tracking y validación estado/etapa. Corrige únicamente la prioridad para altas futuras: membresía por offering, préstamo por `program_id=prestamo`, cotización no-préstamo por tipo y beneficio como rama restante; las claves configuradas específicas siguen teniendo precedencia.

Forward y recovery deben compilar juntos dentro de `ROLLBACK`; la matriz de préstamo, membresía, cotización y beneficio también se ejecuta transaccionalmente y debe restaurar conteos exactos. El recovery restaura las funciones anteriores y queda bloqueado desde la primera transición con historia de etapa; nunca borra eventos para facilitar rollback.

## 20260903000130 — corte documental de Tu sindicato

Estado: `APPLIED / VERIFIED — PASS`. El corte reconcilió exactamente 8 filas históricas de `SutiApp Final` (`Normas y Reglamentos`: 2; `Descargas2`: 6) contra `institutional_documents`, comprobó `app_assets` `READY`, bucket `documents`, objeto físico, MIME PDF, tamaño, SHA-256 y procedencia privada. No descargó ni subió copias nuevas porque los 7 binarios únicos ya estaban correctamente evacuados; reutilizarlos evita duplicados.

La migración anuló `document_url` e `image_url` en las 8 filas y despublicó de forma reversible `Descargas2!15`, cuyo contenido coincide exactamente con `Descargas2!17`; no eliminó filas, assets ni objetos. Forward + recovery pasaron juntos con `ROLLBACK` antes del apply. El recovery rehidrata únicamente las URL históricas desde `asset_sources` y reactiva la fila 15, pero sólo debe ejecutarse junto con la reversión del frontend y una decisión explícita.

## 20260902000300 — lector self Ahorro live read-only

Estado: `APPLIED / VERIFIED — PASS`. La migración agrega exclusivamente `get_self_savings_live_readonly()` y su grant autenticado; no crea ni altera tablas, filas, triggers, writers, ledger, rendimientos o datos importados. El lector deriva identidad efectiva, no acepta objetivo y proyecta Q/AA:DO/DP:DW/retiros/cambios/beneficiarios desde la evidencia SHADOW certificada.

Forward y recovery compilaron juntos dentro de una transacción con `ROLLBACK`; la aplicación productiva dejó idénticos los conteos de las 17 tablas y cero filas modificadas. La matriz live confirmó self, no-savings, anónimo/cross-user/target denegados y cero DML. Recovery `20260902000300_savings_user_ui_live_readonly_recovery.sql` revoca/elimina sólo esta función; no fue ejecutada en producción.

## 20260902000100 — fundación Ahorro SHADOW

Estado: `MIGRATION_OBJECTS_PRESENT / TRACKING_RECORD_PENDING / RAW_SHADOW_IMPORT_APPLIED / VERIFIED — PASS`. La migración aditiva fue ejecutada con autorización separada y sus 17 tablas `savings_*`, RPCs self/Admin/importación, seis permisos mínimos, RLS forzada, ledger/evidencia append-only y evento de revisión están físicamente presentes. El 2026-09-02 se aplicó el batch RAW SHADOW certificado `9b20b0cc-456b-4ad7-8058-c8ebe551dc31`: 363 participantes `PENDING_REVIEW`, 42,229 evidencias y un evento de auditoría. Las otras 13 tablas continúan en cero; no se reaplicó el schema ni se corrigió su tracking, no hubo cutover y el rendimiento productivo permanece bloqueado.

Forward, matriz funcional y recovery se ejecutaron juntos contra el backend dentro de `BEGIN + SAVEPOINT + ROLLBACK`. Se comprobaron componentes de saldo, retenciones, calendarios JUB/Proceso, override global/participante, aislamiento entre afiliados, lectura Admin, importador certificado en dry-run y rechazo de mutación del ledger. Resultado: 17 tablas verificadas y cero filas persistidas.

Recovery de schema: `supabase/recovery/20260902000100_savings_shadow_foundation_recovery.sql` sólo puede retirar una instalación vacía y ahora queda bloqueada por la historia importada. Recovery del batch: `supabase/recovery/20260902000200_savings_raw_shadow_import_recovery.sql` está fijada al SHA autorizado, aborta si encuentra entidades canónicas y elimina únicamente ese batch/participantes/evidencias/auditoría; no fue ejecutada porque el postflight pasó. Revertir historia o activar cutover requieren autorización separada.

## 20260901000200 — archivo reversible de afiliados y Expediente Digital Admin

Estado: `APPLIED / VERIFIED — PASS`. La migración agregó metadata de archivo sobre la misma fila de `public.affiliates`, RPC auditadas de archivo/restauración/listado, exclusión de identidad efectiva e impersonación, guard backend de nuevas solicitudes y reemplazo documental versionado. No archivó afiliados, no modificó filas de negocio y preservó 947 afiliados, 3,434 documentos, 15 solicitudes y 5 eventos administrativos.

Forward, RLS/permisos, matriz de archivo/restauración y recovery completo pasaron en transacciones con `ROLLBACK`; las pruebas persistentes quedaron en cero. GitHub Pages sobre `dfa9d9016531f2175c78a15b26e2e6925a0135cc` autenticó correctamente contra producción después del apply. El recovery restaura las definiciones previas y retira sólo objetos aditivos mientras no exista actividad posterior; no debe ejecutarse después de un archivo, restauración, reemplazo documental u otra actividad administrativa legítima.

## 20260901000100 — validación Tarjeta OR CLABE en Depósito

Estado: `APPLIED / VERIFIED — PASS`. La migración no modificó ninguna de las 504 cuentas: amplía sólo el constraint para admitir altas CLABE-only y reemplaza `save_affiliate_deposit_account` con Banco + (Tarjeta OR CLABE), validando ambos cuando ambos existen. El backup técnico privado conserva definición y constraint previos.

Forward, matriz funcional, seguridad y recovery dry-run pasaron antes de actividad. La prueba productiva posterior creó y retiró dos cuentas QA por UUID exacto, restauró el celular y conservó la auditoría; por ello no se ejecutará recovery real. Seis filas históricas ya tienen Banco + CLABE válida y 498 permanecen incompletas, sin backfill ni reclasificación.

## 20260831000800 — contrato delta-aware de guardado de productos

Estado: `APPLIED / VERIFIED — PASS`. No modificó filas. Amplía únicamente el constraint de `program_key` para hacer efectiva la alta ya autorizada de `cirugias`, reemplaza los dos writers por validación específica y delta-aware, y guarda las definiciones/constraint/hashes exactos para recuperación.

Forward, matriz de 54 casos, denegaciones, seguridad y recovery dry-run pasaron: 135 productos, 268 vínculos y 65 precios intactos. Se permiten 9→9, 9→8 y 8→8; se rechazan 8→9 y 9→10. Chrome certificó un save no-op real sobre un Auto de nueve imágenes y dejó una auditoría legítima. No ejecutar recovery real: ahora debe abortar ante esa historia administrativa.

## 20260831000700 — modalidad comercial y Vendido

Estado: `APPLIED / VERIFIED — PASS`. La migración agrega `commercial_mode`, `sold`, `sold_at` y `sold_by`, dos constraints, un guard central de solicitudes y evoluciona los dos writers Admin. El backfill explícito dejó 80 `PAYROLL_FIXED`, 20 `PAYROLL_QUOTE` y 35 Casa `DIRECT_CONTACT`; `sold=false` en las 135 filas. Conservó 65 precios con hash `2ba16e15407a83d630a6294469ff68b3`, 135 productos, assets, solicitudes y Marketplace.

Forward/runtime/recovery compilaron en transacciones separadas con `ROLLBACK`. Las pruebas transaccionales activaron y quitaron Vendido, desactivaron/reactivaron y comprobaron que la modalidad original no cambia; los intentos de insertar solicitudes vendidas o directas fueron denegados. El recovery compara IDs y hash completo, restaura definiciones exactas de writers y aborta ante cualquier cambio o auditoría Admin posterior. No ejecutar recovery real después de actividad administrativa legítima.

## 20260831000600 — bootstrap vacío de Suti Cirugías

Estado: `APPLIED / VERIFIED — PASS`. La migración agrega exclusivamente `create_first_cirugias_program_catalog_item`; no reemplaza el writer general, no crea productos/assets/auditorías y no cambia tablas, RLS o policies. La RPC exige `program_catalog.write`, sólo acepta `cirugias`, serializa la primera alta con advisory lock, conserva la allowlist y registra procedencia administrativa y auditoría.

Forward y recovery compilaron juntos dentro de una transacción con `ROLLBACK`. La aplicación conservó 135 productos, 268 vínculos, 65 precios fijos, tres Terrenos y cero productos Cirugías. El recovery retira sólo la RPC mientras no exista fila ni auditoría Cirugías; después aborta con `RECOVERY_BLOCKED_CIRUGIAS_ADMIN_HISTORY_EXISTS`.

No ejecutar una migración por intuición. El protocolo obligatorio es:

```text
AUDIT → SOURCE OF TRUTH → DEPENDENCIAS → PLAN → RIESGOS
→ BACKUP/RECOVERY → IMPLEMENTACIÓN → TEST → POST-AUDIT
```

## Cuenta bancaria opcional en Depósito — ADR-085

Estado: `APPLIED / CERTIFIED — PASS`. `20260831000300` vuelve nullable exclusivamente las cinco columnas bancarias de `loan_request_deposit_snapshots` y agrega una constraint all-null/all-complete; `notification_phone` permanece `NOT NULL`. No cambia filas, autoridades, RLS, grants, cálculos ni tablas bancarias. El mismo RPC service-only delega intacto al writer ADR-081 cuando existe cuenta y usa la rama opcional sólo con `bank_account_id=NULL`.

Forward y recovery compilaron juntos dentro de una transacción con `ROLLBACK`, preservando seis solicitudes y cero snapshots. El recovery restaura función/nullability anteriores sólo mientras no exista historia opcional; si existe aborta con `RECOVERY_BLOCKED_OPTIONAL_DEPOSIT_HISTORY_EXISTS`. E2E con y sin cuenta creó/eliminó únicamente sus solicitudes QA y restauró seis solicitudes/cero snapshots.

## Notificaciones reales — ADR-082

Estado: `APPLIED / CERTIFIED — PASS`. `program_requests.seen_at` es nullable y no reinterpreta filas existentes; el índice parcial sólo cubre respuestas de cotización no vistas. `respond_program_request_quote` reinicia el acuse al producir una respuesta real y `mark_marketplace_quote_seen` conserva compatibilidad separada con la tabla histórica anterior al corte. La proyección self-only no reabre grants directos ni crea una tabla de notificaciones.

Forward y recovery compilaron dentro de transacciones con `ROLLBACK`; la aplicación preservó seis solicitudes y seis cotizaciones existentes. El recovery retira la proyección y restaura los writers anteriores, pero aborta antes de eliminar `seen_at` cuando existe cualquier acuse durable que requiera backup. Live y Chrome crearon y eliminaron sólo fixtures identificados, con anónimo/cross-user denegados.

## Gate previo

1. Identificar dominio, autoridad actual/futura, lectores, escritores y propietarios.
2. Inventariar PK, FK, `UNIQUE`, índices, nullability, RLS, triggers, functions y views.
3. Distinguir datos maestros, derivados, calculados e históricos.
4. Medir duplicados, nulos, formatos, volúmenes y compatibilidad.
5. Auditar dependencias de UI, APIs, procesos, Sheets, Apps Script, fórmulas y conciliaciones.
6. Definir backup, rollback o recuperación, reconciliación y criterios de abortar.
7. Diseñar transición sin dos escritores maestros. Cualquier doble escritura requiere decisión explícita y reconciliación demostrable.

## Implementación y cierre

Aplicar cambios pequeños, idempotentes cuando sea posible y observables. Probar permisos/RLS, integridad, reintentos, fallos parciales, reversión y lectores antiguos. La post-auditoría compara conteos, invariantes y autoridad; conserva evidencia.

Sin recuperación verificable, autoridad resuelta o equivalencia legacy: `BLOCKED — DECISIÓN REQUERIDA`.

## 20260825000400 — snapshot financiero personalizado

La migración crea sólo infraestructura derivada vacía, no importa reglas ni modifica históricos. Antes/después conserva conteos de afiliados, solicitudes financieras y documentos. `financial_session_snapshots` exige TTL máximo 15m, RLS forzada, cero grants browser y service-only CRUD. La RPC de confirmación es service-only y el trigger retira el alta escalonada antigua de préstamo.

Recovery: `supabase/recovery/20260825000400_personalized_financial_session_snapshots_recovery.sql` puede retirar tabla/RPC/trigger y restaurar el writer anterior únicamente mientras no exista `financial_submission_snapshot` contractual. Si existe historia confirmada, aborta antes de borrar columna o datos. La prueba de migración y la prueba de creación atómica se ejecutan dentro de transacciones con `ROLLBACK` antes de cualquier activación.

## 20260826000100 — RPC autenticada de cotización sobre snapshot

La migración crea únicamente funciones y grants; no agrega ni modifica filas. `resolve_current_loan_snapshot_quote` admite sólo Auth y cuatro parámetros, deriva identidad efectiva y valida ownership, impersonación, TTL, versión/fingerprints y contrato antes de leer internamente el snapshot. La tabla mantiene cero grants/policies browser. `resolve_suti_loan_quote_contract` es el único motor matemático `SUTI_LOAN_QUOTE_V1` y su ejecución directa queda reservada a service role.

Recovery: revertir primero frontend/Edge al commit anterior y luego ejecutar `supabase/recovery/20260826000100_authenticated_loan_snapshot_quote_rpc_recovery.sql`, que revoca grants y elimina las tres funciones sin tocar snapshots, solicitudes, afiliados ni históricos. Forward y recovery deben probarse juntos dentro de una transacción con `ROLLBACK`; el cutover sólo procede con equivalencia y seguridad en PASS.

## 20260826000200 — read model Admin de solicitudes financieras

Estado: `APPLIED / CERTIFIED — PASS`. Con autorización explícita del propietario, la migración creó sólo tres funciones de lectura y sus grants; no agregó tablas, columnas, triggers, writers ni filas. Las funciones conservan `program_requests` como autoridad, exigen `program_requests.read`, limitan la cola a 250 filas de metadata y proyectan los snapshots inmutables sin perfil financiero, firma, payload de exportación o referencia legacy. La proyección móvil se resuelve en una sola consulta y no ejecuta un detalle por fila.

La lectura directa de `requested_amount` y snapshots continúa denegada al browser por los grants vigentes. El frontend depende de estas RPC para no ampliar acceso directo a la tabla. Dry-run, recovery dry-run, apply y status cerraron `PASS`; las tres funciones y grants autenticados están activos, anónimo permanece denegado y los conteos de solicitudes/documentos protegidos no cambiaron.

Recovery: `supabase/recovery/20260826000200_admin_financial_requests_read_model_recovery.sql` revoca los tres grants y elimina exclusivamente las funciones. Su dry run transaccional con `ROLLBACK` cerró `PASS` y dejó cambios persistentes 0. No se ejecutó recovery productivo después del cutover exitoso.

## 20260827000100–00700 — cutover de criterios financieros a Supabase

Estado: `APPLIED / CERTIFIED — PASS`. El modelo importó un batch exacto de 146 reglas, 35 fondos y 3 programas desde los campos productivamente consumidos A/B/C/D/E/F/H/N/P; preservó 2 grupos duplicados y 1 grupo conflictivo y excluyó G/I/J/K/L/M/O. La activación atómica cambió `financial_criteria_authority` de `GOOGLE_SHADOW` a `SUPABASE` sólo después de equivalencia exacta y canary A/B. No existe dual authority ni fallback Google.

Las migraciones 00200–00400 corrigieron equivalencia de tasa, frontera service-role e identidad determinista de fondos antes del corte. 00500/00510 habilitaron exclusivamente el canary shadow reversible; 00600 realizó el retry atómico autorizado; 00700 retiró el RPC canary después del PASS. Cada forward tiene recovery y los pares se probaron dentro de transacciones con `ROLLBACK`. El recovery primario devuelve autoridad a Google y conserva el batch importado para diagnóstico; sólo puede ejecutarse como rollback explícito, nunca como fallback runtime.

## 20260827001200 — Admin Afiliados

Estado: `APPLIED / CERTIFIED — PASS`. La migración es aditiva sobre el maestro existente: agrega `record_origin`, sustituye la restricción de procedencia para distinguir importación histórica de alta Admin, añade índices parciales, crea `affiliate_admin_events` y seis RPC con permisos. Conservó 947 afiliados históricos, 3 cuentas Auth, sus hashes/coordenadas y cero filas Admin tras aplicar.

Forward y recovery compilaron juntos dentro de una transacción con `ROLLBACK`. La matriz CRUD creó, editó, cambió estado y reactivó un afiliado únicamente dentro de otra transacción y terminó con `persistent_writes=0`. El recovery aborta si existen afiliados `ADMIN_AFFILIATES` o eventos de auditoría; no borra historia para facilitar un rollback. Si ya hay operación real, retirar la funcionalidad requiere conservar datos/auditoría y una nueva decisión de recuperación, no ejecutar el drop destructivo.

## 20260827001300–01320 — carga documental desde Admin Afiliados

Estado: `APPLIED / CERTIFIED — PASS`. `01300` agrega exclusivamente `register_admin_affiliate_document` y amplía las policies de inserción/cleanup del bucket privado; no agrega tablas, columnas ni filas. La RPC exige `documents.write`, afiliado/tipo/ruta/owner/MIME/tamaño/hash/motivo válidos, conserva `VERIFIED` inmutable y registra actor/acción en `sensitive_change_audit`. `01310` introduce un guard booleano `SECURITY DEFINER` para que Storage pueda validar que el UUID objetivo existe sin conceder al admin lectura directa de `public.affiliates`. `01320` mueve la comprobación de “objeto sin referencia” a otro guard backend, evitando que RLS o una combinación futura de permisos oculte `private_assets` a la policy de cleanup.

Los tres pares forward/recovery compilaron dentro de transacciones con `ROLLBACK` y se aplicaron preservando 947 afiliados, 3,425 documentos, 13,048 assets y 13,051 objetos privados. La prueba real reversible creó exactamente un documento/asset/objeto/auditoría `PENDING_REVIEW`, denegó usuario normal, anónimo y el borrado del objeto mientras estaba referenciado, y restauró los cuatro conteos. Los recovery retiran únicamente RPC/helpers/policies; documentos ya registrados permanecen como historia canónica y nunca se borran.

## 20260829000100 — disponibilidad física y reemplazo documental

Estado: `APPLIED / CERTIFIED — PASS`. La migración agrega `replaces_document_id`, índices de versión/revisión, el read model mínimo `get_affiliate_document_availability`, versionado en `register_affiliate_document` y un trigger de integridad sobre `request_documents`. No importa ni modifica filas de negocio. La fila `VERIFIED` anterior permanece inmutable; el reemplazo es una fila nueva auditada.

Forward y recovery compilaron en una transacción con `ROLLBACK`; la aplicación preservó 947 afiliados, 3,425 documentos, 0 adjuntos de solicitud, 13,048 assets, 13,051 objetos privados y 26 auditorías. La prueba real reversible cargó, verificó, reemplazó, volvió a firmar y eliminó exclusivamente sus artefactos QA, restaurando los conteos exactos; además confirmó anónimo denegado y cruce entre afiliados en cero filas.

Recovery: `supabase/recovery/20260829000100_loan_document_flow_recovery_recovery.sql` restaura función e índice anteriores sólo cuando `replaces_document_id` no tiene historia. Si existe al menos un reemplazo, aborta con `RECOVERY_BLOCKED_REPLACEMENT_HISTORY_EXISTS`; no elimina ni aplana versiones.

## 20260829000200 — bitácora administrativa de solicitudes financieras

Estado: `APPLIED / CERTIFIED — PASS`. La migración agrega exclusivamente `program_request_admin_events`, dos RPC browser con permisos explícitos y una sobrecarga service-only del RPC de aprobación existente. No copia solicitudes, no modifica notas históricas, no reconstruye adjuntos y no cambia reglas financieras. La tabla tiene RLS habilitada/forzada, cero grants directos browser, `client_action_id` único y una sola aprobación auditable por solicitud.

Forward y recovery compilaron dentro de transacciones con `ROLLBACK`; la aplicación conservó los conteos protegidos de `program_requests`, solicitudes financieras, `request_documents` y auditoría de exportación. La matriz autenticada ejecutó comentario/retry, revisión/rechazo y cancelación dentro de otra transacción, comprobó idempotencia, transiciones válidas, notas intactas y `persistent_changes=0`. Anónimo, lectura e inserción directa quedaron denegados.

Recovery: `supabase/recovery/20260829000200_financial_request_admin_events_recovery.sql` retira sólo la infraestructura nueva mientras la tabla esté vacía. Si existe cualquier evento aborta con `RECOVERY_BLOCKED_PROGRAM_REQUEST_ADMIN_HISTORY_EXISTS`; nunca elimina historia administrativa para facilitar un rollback.

## 20260830000100 — aislamiento de contexto documental

Estado: `APPLIED / CERTIFIED — PASS`. La migración agrega una bitácora y cuatro RPC sin copiar, reclasificar ni modificar documentos. Autoservicio deriva el afiliado efectivo; Administración exige `documents.read` y objetivo explícito. Los listados omiten rutas/URLs y las RPC de autorización limitan cada intención a un documento existente del contexto correcto. `document_access_audit_log` tiene RLS habilitada/forzada y cero escrituras browser.

Forward y recovery compilaron dentro de transacciones con `ROLLBACK` antes de generar eventos. La aplicación conservó 947 afiliados, 3,425 documentos, 0 `request_documents`, 146 reglas, 35 fondos y 3 programas. La matriz viva confirmó tres cuentas, Admin sin afiliado mediante prueba transaccional, impersonación con actor real, cruce/anónimo denegados, tres firmas individuales de 300 segundos y cero URLs en listados.

Recovery: `20260830000100_loan_document_context_isolation_recovery.sql` retira exclusivamente funciones/bitácora mientras no exista historial de acceso. Desde el primer evento aborta con `RECOVERY_BLOCKED_DOCUMENT_ACCESS_HISTORY_EXISTS`; nunca elimina auditoría para facilitar un rollback. La Edge puede retirarse por separado con `scripts/deploy-document-access.js delete`, pero no se ejecutó ese modo tras el cutover exitoso.

## 20260830000200–00220 — plataforma central de requisitos documentales

Estado: `APPLIED / CERTIFIED — PASS`. `00200` evoluciona la autoridad existente, agrega capacidades de carga, scopes, herencia/exclusión, auditoría y snapshot de requisitos sin copiar ni reescribir documentos o solicitudes. `00210` elimina la sobrecarga de upload que no declaraba `CAMERA|FILE`; `00220` corrige únicamente dos definiciones de función para usar la columna canónica `membership_offerings.concept`.

Los tres forward y recovery se validaron dentro de transacciones con `ROLLBACK`. La aplicación conservó 32 reglas configuradas, 13 tipos, 3,425 documentos, cinco solicitudes históricas sin reinterpretar, cero `request_documents` y 146/35/3 filas financieras. La recuperación principal falla cerrada si ya existe auditoría/configuración/snapshot que pudiera perderse; la recuperación del hotfix mantiene deliberadamente la última definición válida porque restaurar la referencia a una columna inexistente rompería membresías.

## 20260831000200 — lectura autenticada de presentación financiera

Estado: `APPLIED / CERTIFIED — PASS`. La migración agrega únicamente `finance_presentation_authenticated_read` sobre la tabla existente `finance_catalog_presentation`; no crea tablas/columnas, no ejecuta DML, no cambia grants ni writers y preservó el hash de sus 6 filas. `authenticated` lee configuración global, `anon` permanece sin acceso y UPDATE sigue exigiendo `workflow.write`.

Forward y recovery compilaron juntos dentro de una transacción con `ROLLBACK`. El recovery elimina sólo la policy nueva y no toca filas, histórico ni autoridad financiera. No modifica reglas, fondos, programas, cálculos o Google legacy.

## 20260903000150 — preflight de activación Auth

Estado: `APPLIED / VERIFIED — PRODUCTIVE CERT BLOCKED BY SMTP`. La migración agrega una sola función `STABLE SECURITY DEFINER search_path=''`, sin tablas, columnas ni DML. Sólo retorna un estado mínimo sobre `public.affiliates`; anónimo no puede leer la tabla ni obtener PII. Forward/recovery se probaron en `ROLLBACK` y el apply conservó conteos de afiliados y vínculos.

El recovery elimina únicamente la función después de revertir el frontend que la consume. No modifica afiliados, Auth, auditoría ni configuración. La actividad QA posterior se conserva por las reglas de archivo/auditoría vigentes y no autoriza ejecutar recovery destructivo sobre historia.

## 20260908000400 - Admin request deletion

Additive deletion journal/RPC/guards, with the existing claim RPC excluding prepared deletions.
Forward, role checks, finalization, preservation hashes and exact claim/schema recovery pass in one
transaction ending ROLLBACK. Request/document snapshots pass typed reconstruction. The recovery SQL
refuses to remove infrastructure when any journal entry exists. Live claim definition/OID/ACL and GAS15
source are privately backed up in C:/tmp/sutiapp-request-delete-20260908. Installation deletes no business
rows. Deployment receipts, source hashes and final status: docs/qa/evidence/admin-request-delete-20260908.
For post-use recovery retain the journal, inspect the private request/children/Google backup, verify all
foreign keys and current Google identity, and prepare a separate operation-specific recovery transaction.
Never run empty-schema recovery after real deletion or automatically replay business sync/workflows.

## 20260908000401 - Request delete sync lock order

APPLIED / VERIFIED - PASS. Refines only the new child deletion guard, preserving OID/grants. Ordinary
updates to an existing outbox identity use its already-held row lock; inserts/identity changes still
lock the parent. The baseline deadlock was reproduced with concurrent rollback-only no-op updates.
The refined guard passed the same two transactions, the complete deletion matrix and exact function
recovery in ROLLBACK. No request, outbox payload or business state was changed. See lock-*.json evidence.

## H-FINANCE-REQUESTS-CONFIRMATION-NOTIFICATIONS-UX-001 ? release autorizado

Owner separa Web Push a H-WEB-PUSH-REQUEST-EVENTS-001. La migraci?n 20260908000600 est? APPLIED / VERIFIED: eventos Supabase como autoridad; acuses ?nicos por evento con actor Auth, RLS forzada y RPC self-only. Cero writers de solicitudes/workflow/c?lculos modificados. Recovery conserva acuses. La publicaci?n frontend se verifica en la evidencia de esta H; los estados PREPARED/NOT APPLIED anteriores son hist?ricos y quedan supersedidos.

## 20260908000800 — archivo de banners

APPLIED / VERIFIED. Aditiva: tabla privada de metadata, dos funciones focales y tres filtros RLS restrictivos; no reemplaza permisos ni triggers existentes. Dry-run y recovery vacío PASS con ROLLBACK; recovery con historia aborta con BANNER_ARCHIVE_HISTORY_MUST_BE_PRESERVED. Pruebas SQL sobre backend real se revierten completas, incluidos cambios de permisos y restricción temporal para simular fallo de auditoría. Apply conservó hash y 23 banners, 176 assets y 13,377 objetos Storage; cero filas de negocio modificadas. Recovery versionado: supabase/recovery/20260908000800_admin_banners_archive.sql.

## H-SUTIAPP-PRODUCTION-SOURCE-REINTEGRATION-001 — 2026-09-20

The three restored migrations (20260907000200, 20260909000300, 20260918120000) describe already-installed production changes. Do not run them against production to reconcile Git. Beneficiary tracking still uses 20260918000100, colliding with the canonical savings_panel_single_projection filename; see ../docs/plans/TRACKING_RECONCILIATION_PLAN.md. Aval/Disk IO exact tracking rows are absent. This is source reconciliation only, not permission for db push/migration up or automatic repair. Aval supersedes four Disk IO definitions while retaining their PT409 changes. Historical recoveries are preserved unchanged: Aval pins OIDs/history; Disk IO refuses definition drift; beneficiary recovery keeps data and only disables new writes.


## Savings affiliate publication correction - 20260921

20260921000500 is APPLIED. Three publication/read functions accept the exact
unique active affiliate while preserving archived history. Current production
contracts were checked before apply; forward/recovery and ACL/identity denials
passed in isolated PostgreSQL. Existing private function backup enables exact
function recovery without deleting publication events or money. Owner-authorized
publication used the existing fingerprint/version RPC after 334/334 projections
matched ledger and pending=0. No production test DDL or test financial operations.
