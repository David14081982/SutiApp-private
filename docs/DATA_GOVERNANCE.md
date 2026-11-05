# Gobierno de datos

## Ahorro sin proyecci?n ? H-SAVINGS-P1-DATA-CERTIFICATION-CLOSURE-001

La autorizaci?n OWNER posterior permite eliminar s?lo registros de Ahorro que jam?s
tuvieron proyecci?n ni movimientos, inscripciones o solicitudes. Nunca elimina
Afiliados ni Google. Los dos lotes autorizados, con 38 registros en total, conserva snapshot exacto de
sus dependencias de Ahorro en savings_registration_removal_archive, privado, inmutable,
con RLS forzada y sin grants API. La recuperaci?n expl?cita conserva UUIDs y rechaza
conflictos; no es fallback ni fuente financiera alternativa. El borrado comprob? ledger
y Afiliados id?nticos, y restaur? controles de historial antes de confirmar.

## Versiones de foto de perfil — H-PROFILE-PHOTO-EDIT-001

La foto vigente es una relación `affiliate_files` marcada explícitamente, no un archivo sobrescrito. Al reemplazarla se conserva el objeto anterior, su relación, status y vínculos documentales; solo cambia el marcador vigente y su fecha de actualización. La auditoría enlaza nueva relación y anterior con actor real y afiliado. Los nuevos registros identifican procedencia `supabase://private-assets/...`; Photo/DK es la clave semántica compatible, sin escritura en Google. Cargas cuyo resultado de registro sea ambiguo no se borran automáticamente; quedan privadas y sin autoridad mientras no tengan relación, sujetas a conciliación administrativa. La UI comprime y elimina metadata de cámara al convertir a JPEG; URLs firmadas siguen temporales.


## Eliminación explícita de solicitudes — ADR-108

La autorización posterior del propietario permite retirar una solicitud confirmada y sus vínculos
documentales del dominio operacional, preservando el expediente y los archivos compartidos.
Prevalece sólo para esta operación sobre la prohibición de borrar eventos/referencias operacionales:
la historia íntegra se conserva en program_request_deletions.snapshot, con actor real y motivo.
El journal privado fuerza RLS, sólo permite lectura service y escritura mediante RPC restringidas.
No caduca ni funciona como fallback o restauración automática. Contiene datos privados de la
solicitud y el respaldo Google; no debe exportarse a evidencia pública, logs ni frontend.

Lectores: Edge request-delete y recuperación administrativa autorizada. Escritores: prepare,
record y finish RPC. Origen: filas canónicas bloqueadas y celdas Google verificadas antes del borrado.
Retención: durable para auditoría/recuperación, sin purge automático. AH+ y datos financieros
externos no se incluyen ni se modifican. La instalación no borra datos de negocio.

## Clasificaciones

- **Fuente autoritativa:** sistema oficialmente autorizado para decidir el valor vigente de un dominio.
- **Fuente derivada:** transformación reproducible de una autoridad; no decide el dato maestro.
- **Caché:** copia temporal con origen, caducidad e invalidación explícitos. `cache != fuente de verdad`.
- **Mock:** dato ficticio para desarrollo, preview o QA aislado.
- **Fixture:** conjunto estable para pruebas reproducibles.
- **Legacy:** sistema productivo existente que conserva obligaciones y compatibilidad.
- **View:** consulta derivada sin autoridad de escritura propia.
- **Dato calculado:** resultado de reglas/fórmulas reproducible desde entradas autorizadas. `dato derivado != fuente de verdad`.
- **Dato histórico:** registro cuyo contexto temporal y trazabilidad deben preservarse.

## Copias permitidas

Una copia requiere propósito, origen, entorno, propietario, lectores, caducidad/invalidación, prohibición de escritura maestra y conducta ante error documentados. Mocks y fixtures deben estar separados del camino productivo.

Una copia se convierte en segunda fuente de verdad cuando puede aceptar escrituras independientes, sobrevivir a la eliminación en la autoridad, ser elegida por fallback, o no puede reconciliarse determinísticamente con su origen. En ese caso: `SOURCE OF TRUTH CONFLICT`.

## Borrado

Eliminar en la autoridad obliga a invalidar copias. Está prohibido reconstruir el dato desde `localStorage`, CacheStorage, `DATA`, mock, fixture, JSON o legacy no autorizado. Los borrados históricos requieren decisión, auditoría y recuperación; no se usan como reparación rápida.

## Errores

Ante fallo de autoridad: estado de carga, error controlado, reintento seguro u offline explícito. Mostrar `ERROR DE FUENTE AUTORITATIVA` es preferible a información falsa. Un respaldo solo puede operar si está diseñado, autorizado y etiquetado semánticamente; nunca mediante fallback silencioso.

## Cambio de datos

Toda H declara dominio, autoridad, lectores, escritores, copias, cachés, datos derivados, retención, borrado, recuperación e invariantes. Si algo es desconocido, usar `UNRESOLVED`; si compiten fuentes, usar `SOURCE OF TRUTH CONFLICT`.

## Decisiones administrativas de solicitudes financieras

`program_request_admin_events` es historia operacional retenida: cada fila conserva solicitud, actor, acción, transición, comentario opcional y tiempo. No se edita ni se borra para corregir una solicitud; una acción posterior se agrega como otro evento válido. `client_action_id` evita duplicados por retry sin convertir el navegador en autoridad. El recovery de la infraestructura aborta si existe al menos un evento, de modo que ningún rollback técnico elimine decisiones reales.

Los adjuntos históricos se gobiernan por vínculo, no por disponibilidad actual. Sólo `request_documents` demuestra qué acompañó una solicitud; mostrar `affiliate_documents` actuales es una consulta separada y etiquetada, sin copia, backfill ni reconstrucción implícita.

## Nómina declarada para simulación

`affiliate_payroll_declarations` es una autoridad de declaración del usuario, no una copia de nómina oficial ni de un talón. Conserva el valor vigente y una auditoría de cambios; no tiene fallback ni caché persistente. El afiliado puede actualizar su declaración, pero la eliminación no está expuesta en UI y cualquier recuperación destructiva exige preservar filas existentes. Las proyecciones de neto, remanente, barras y 30% son derivados informativos y nunca datos maestros financieros.

## Snapshot financiero personalizado de sesión

`financial_session_snapshots` es la excepción temporal autorizada por ADR-043/064 y conservada por ADR-065. Origen: el batch activo Supabase de criterios financieros después de aplicar el perfil autoritativo y `loan_term_policy`. Propietario/escritor: Edge `financial-legacy` con service role. Lectores: Edge service-only y, únicamente para una cotización interactiva propia, la función `SECURITY DEFINER` autenticada que valida el contexto completo antes de leer internamente; el browser conserva cero acceso directo. Retención lógica: máximo 15 minutos; `expires_at` vencido siempre es inválido aunque cleanup aún no borre la fila.

No admite escrituras independientes, fallback, uso cruzado ni PII innecesaria. Cambiar perfil, versión, actor, afiliado, impersonación, política, contrato o batch financiero invalida. El fingerprint de fuente incluye todos los campos Supabase que afectan elegibilidad y visibilidad. La solicitud confirmada conserva una evidencia contractual separada e inmutable; por ello el caché puede eliminarse sin afectar historia.

## Archivo de banners — H-ADMIN-BANNERS-DELETE-001

La eliminación solicitada por el propietario retira el banner de lectores browser y preserva íntegramente su fila original y archivos. banner_deletions es metadata durable, privada y 1:1, con FK restrictiva; no tiene purge ni writer browser directo. admin_audit_log registra BANNERS_DELETE atómicamente con actor real y tiempo backend. Reintentos no duplican metadata ni auditoría. Recovery técnico sólo funciona sin historia de archivo; después corresponde reparación hacia adelante o recuperación de datos explícitamente autorizada, nunca resurrección automática.

## H-SUTIAPP-PRODUCTION-SOURCE-REINTEGRATION-001 — 2026-09-20

PRIVATE_BACKUP_REQUIRED: the old .tmp/beneficiaries-20260918 source CSV, signatures, plans, inventory and before/ backup remain outside Git and are not moved. The 98 pending rows are not automatically activated or repaired. History must survive rollback: beneficiary recovery revokes new writing capabilities rather than deleting distributions/provenance/files. Source reintegration does not authorize another import or any tracking/data repair.

## H-SICOF-RESPONSE-LATENCY-001 — retención de observación derivada

Contrato autorizado; migración 006 aplicada, corrección de cadencia 007 y activación pendientes. La copia privada de préstamos conserva únicamente la observación completa activa y su metadata de vigencia, versión, intento, éxito, error controlado y lease. El reemplazo es atómico y completo; no acumula versiones retiradas ni resucita filas eliminadas en Google. No copia el ledger de Ahorro, no acredita dinero y no sustituye el Excel histórico privado.

Un fallo puede conservar físicamente la última observación para diagnóstico, pero al cumplir 300 segundos desde `observed_at` deja de estar disponible para cálculos y XLSX. Retenerla no renueva su validez. La recuperación puede eliminar esta copia desechable después de detener su job y restaurar explícitamente el lector anterior; no elimina movimientos, periodos, escenarios ni historia financiera. Los payloads, datos personales y secretos no se incorporan a Git, capturas públicas o registros de diagnóstico.


Estado verificado de esta adenda (SICOF latency activation receipt): migraciones 006 y 007 aplicadas, cada una conservando 23 tablas y 182 funciones financieras existentes. Edge SICOF v11 ACTIVE con JWT; copia inicial verificada y job privado único cada cuatro minutos activado. Lectura y XLSX reales usan la copia vigente, sin repetir la consulta a Google; 8.368 s y 7.774 s en las muestras medidas, sin promesa de carga instantánea. Evidencia: `qa/evidence/sicof-response-latency.json`; cierre y límites: `audits/H-SICOF-RESPONSE-LATENCY-001.md`. Este estado sustituye las menciones de activación pendiente anteriores en esta adenda.

## H-SICOF-INSTANT-FILTERS-001 — entrada efímera de simulación

La entrada del simulador y sus resultados se conservan sólo en memoria de la sesión/pantalla, con vigencia máxima de 300 segundos y sin superar el vencimiento de la observación de préstamos. No se persisten en localStorage, sessionStorage, IndexedDB ni un nuevo almacén de saldos. Vencimiento, cambio de contexto/sesión o de día impiden reutilizarla; una carga canónica posterior la sustituye. No existe fallback a una vista previa vencida.

La simulación no modifica aportaciones, retiros, rendimientos acreditados, históricos ni políticas. Guardar un escenario utiliza el escritor existente y sus comprobaciones, separado del derivado efímero. El servidor no acepta participantes ni resultados financieros aportados por el navegador como autoridad. La modificación de filtros compatibles no agrega polling ni lecturas periódicas; se conserva la actualización compartida de préstamos previamente autorizada.

## Historical loan review operational evidence

H-LOAN-AMBIGUOUS-MANUAL-REVIEW-GUARD-001 registers twelve cases without modifying historical obligations, balances, identities or rules. Case rows and events are immutable, private, RLS-forced and denied direct browser/service-role DML. Initial registration is an audited deployment with verified administrative actor. No fund selection or untraced dismissal is exposed. Future RESOLVE events require actor, date, reason, nonempty documentary evidence, previous state and adopted decision, plus a separately validated authorized writer; a resolution event alone must never invent the underlying mapping. Recovery preserves cases/events and the safety guard.


## H-AFILIADOS-ELIMINACION-INDIVIDUAL-DOCUMENTOS-001 - 2026-11-04

Owner authorizes individual document withdrawal for every user with effective access to Admin Afiliados, including collaborators. The operation delegates to the existing server module visibility function, without modifying global roles/permissions or granting affiliate deletion. Explicit confirmation includes the selected document and its linked predecessor versions; reason and actor are mandatory.

Existing affiliate_documents/private_assets/affiliate_files remain authoritative. document_retirement_private stores withdrawal metadata and original hash/status for recovery, not another operational document store. Shared references outside the confirmed scope block withdrawal. Immutable SQL rows/provenance remain; the original Storage object moves to a private, RLS-inaccessible quarantine path and no downloadable copy enters audit evidence. Active assets still require SHA-256; a withdrawn hash is preserved privately so correct reassociation can use a new object.

Logical withdrawal and audit are atomic. Existing readers, RLS and signing authorizers exclude withdrawn records; concurrent reference guards prevent reattachment. Failed Storage moves remain PENDING_STORAGE with explicit retry after reload. Original URLs may remain usable while a move is pending, until original expiry; moving removes the original key. CDN/browser copies already cached can outlive origin removal and downloaded bytes cannot be recalled. Supabase documents up to 60 seconds for Smart CDN invalidation: https://supabase.com/docs/guides/storage/cdn/smart-cdn ; URL invalidation by move: https://supabase.com/docs/guides/storage/serving/downloads .

Migration 20261104000400 is APPLIED. Installation preserved fingerprints of all 16 protected tables and global permission function definitions; no real document was deleted as a test. Recovery is exact before retirement and refuses to resurrect access after history exists. Focused PostgreSQL/Edge/browser tests and release evidence: [audit](audits/H-AFILIADOS-ELIMINACION-INDIVIDUAL-DOCUMENTOS-001.md). No Google or financial data changes; owner explicitly excludes global suites for this H. Publication verification is recorded in the audit and evidence directory.


## H-AFFILIATE-DOCUMENT-ISOLATION-001 - 2026-11-05

Owner authorizes independent physical files for every expediente upload, including admin/self image/PDF documents, replacement versions and self profile photos. Existing hash-only lookup across people is removed from exactly three server writers. SHA-256 remains integrity metadata; owned uploads may have identical hashes. A partial unique index preserves the legacy unowned hash domain. Server reference guards enforce matching affiliate ownership and prohibit reuse across independent document/file units. Existing upload permissions and all global roles remain unchanged.

The canonical authority remains affiliate_documents / affiliate_files / private_assets with private-assets Storage. Existing shared units receive independently copied objects after full source and destination SHA-256 verification. Original assets, objects, provenance and request/financial attachments are retained unchanged. Before rows and actor/reason/old-new mapping are kept in RLS-forced document_isolation_private without API access; sensitive_change_audit records each switch. Failed or interrupted preparation leaves pointers unchanged; transactions reject source/record drift and retries do not duplicate audit. This does not decide whose photograph is correct.

Migration 20261105000100 is applied with existing rows and global permission fingerprints preserved. Physical separation status, focused tests, production reads and exact limitations are recorded in [audit](audits/H-AFFILIATE-DOCUMENT-ISOLATION-001.md). Schema recovery refuses after isolated history; retained originals and exact private snapshots support controlled forward recovery. No frontend, Edge, Storage-policy, financial or Google code changes. Historical raw import scripts are not runtime writers and require this ownership contract for any separately authorized future import.


## H-AFFILIATE-DOCUMENT-UPLOAD-REGRESSION-001 - 2026-11-05

The owner requires working expediente uploads/replacements and tests without deleting files. Root cause: the status-only affiliate_documents_current_review_idx kept reserving retired pending documents. Canonical authority remains affiliate_documents and document_retirement_private.documents; migration 20261105000200 replaces that obsolete index with private DERIVED review_slots enforced by true UNIQUE(affiliate_id,document_type_id), synchronized atomically by document/retirement triggers. This table is an integrity index, never a runtime document source or fallback. Original document/file/asset rows, statuses, timestamps, retirement history, upload RPCs, permissions and Storage policies are unchanged by installation. No frontend or financial/Google changes.

Installation preserved complete fingerprints of 16 original tables and eight writer/permission functions. Exact original 17 indexes and nine triggers/function bodies are included in the revised isolated tests, which reproduce the old failure and verify 24 admin/self image/PDF scenarios. Earlier isolation tests omitted independent indexes and production browser checks never uploaded; prior copy/hash counts must not be described as end-to-end upload tests. Recovery refuses schema drift or historical overlap; it never rewrites history to fit the old index. Live upload evidence, retained test versions and precise limits are recorded in [audit](audits/H-AFFILIATE-DOCUMENT-UPLOAD-REGRESSION-001.md).
