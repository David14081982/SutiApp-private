# Reglas de migración

No ejecutar una migración por intuición. El protocolo obligatorio es:

```text
AUDIT → SOURCE OF TRUTH → DEPENDENCIAS → PLAN → RIESGOS
→ BACKUP/RECOVERY → IMPLEMENTACIÓN → TEST → POST-AUDIT
```

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
