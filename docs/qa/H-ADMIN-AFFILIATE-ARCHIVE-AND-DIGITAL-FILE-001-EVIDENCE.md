# H-ADMIN-AFFILIATE-ARCHIVE-AND-DIGITAL-FILE-001 — Evidence

Fecha: 2026-09-01
Estado de implementación: `PASS`
Estado productivo: `APPLIED_VERIFIED`

## AUDIT → AUTHORITY → PLAN → RISK

- Architecture Navigator confirmó que Admin Afiliados usa `AdminAffiliatesRepository` y las RPC de `20260827001200`; el expediente vigente usa `affiliate_documents`, `document_types`, `private_assets/private-assets`, `DocumentWorkflowRepository` y `document-access`.
- Consulta productiva agregada y sin PII: 947 afiliados, 3 Auth vinculados, 3,434 documentos, 15 solicitudes, 5 eventos Admin al aplicar, RLS activa y 0 archivados.
- Autoridad canónica: `public.affiliates`. “Eliminados” es una proyección, no una tabla. Auth, documentos, solicitudes, workflows, snapshots, ahorro e historia conservan sus autoridades existentes.
- Escritura productiva autorizada: infraestructura de `20260901000200`; DML de negocio y escrituras de prueba persistentes: 0. Google/Apps Script: 0 lecturas, 0 escrituras, 0 cambios.
- Riesgo: alto por identidad y control de acceso. Mitigación: migración aditiva, control optimista, RPC/RLS, identidad efectiva central, trigger de altas, eventos append-only y recovery fail-closed.

## IMPLEMENT

- `is_archived` y metadata coherente de archivo/restauración sobre la misma fila de `public.affiliates`.
- RPC `archive_admin_affiliate` / `restore_admin_affiliate`, lista activa separada de `list_admin_archived_affiliates` y duplicados `ACTIVE_MATCH|ARCHIVED_MATCH`.
- `get_effective_affiliate_id`, claim e impersonación excluyen archivados. `program_requests_guard_archived_affiliate` protege cualquier alta nueva.
- Admin conserva acceso técnico aunque su afiliación vinculada esté archivada; un afiliado normal archivado recibe estado controlado y se cierra su sesión funcional.
- La UI mantiene header, toolbar, búsqueda, siete filtros del padrón activo, tabla, panel lateral, seis tabs, modales y responsive originales. Agrega el selector `Afiliados | Eliminados` y separa Cambio de estado de Archivo.
- Expediente Digital integra metadata canónica, miniaturas privadas, viewer interno de imagen/PDF, firma temporal, versión/procedencia y carga/reemplazo no destructivo con `replaces_document_id`.
- El writer documental respeta `file_upload_allowed`, MIME y tamaño del tipo; conserva la versión anterior y audita `ADMIN_REPLACEMENT_UPLOAD`.

## VERIFY

### Build y estática

```text
node scripts/build-bundle.js C:\tmp\sutiapp-babel-7.29.0.min.js
Built app\bundle.js from 95 files.
SHA-256: BDA114074AEAFCB7EF81B403E0808956F245C707737D13508C1E768725F32A0C

node scripts/test-static-suite.js
PASS 78/78 (el único mock H-004 se actualizó al nuevo RPC de estado)

node scripts/test-admin-affiliates.js
Admin affiliates productive workbench static contract PASS

node scripts/test-claude-ui-preservation.js
PASS

node scripts/test-global-document-image-ux-consistency.js
PASS — shared viewer, no raw document navigation

git diff --check
PASS
```

### Migración, recovery y matriz productiva no persistente

Comando:

```text
node scripts/test-admin-affiliate-archive-and-digital-file-live.js
```

Resultado:

```json
{"status":"PASS","mode":"DRY_RUN_FORWARD_RECOVERY_AND_LIFECYCLE","migration":"20260901000200","before":{"applied":false,"affiliates":947,"documents":3434,"requests":15,"events":4,"archived":0},"after":{"applied":false,"affiliates":947,"documents":3434,"requests":15,"events":4,"archived":0},"persistentWrites":0}
```

La matriz transaccional certificó:

- archivo con motivo, mismo UUID/control y perfil histórico intacto;
- exclusión del padrón normal y presencia en Eliminados;
- `ARCHIVED_MATCH` y no alta duplicada;
- impersonación archivada denegada en backend;
- restauración con mismo UUID/control y reevaluación actual de `auth_eligibility`;
- forward/recovery compilados contra el esquema real;
- RLS forzada en respaldo, sin grants browser, `anon` sin RPC y `authenticated` sujeto a permisos;
- 0 cambios persistentes.

No se creó afiliado, documento, solicitud, ahorro ni movimiento sintético. No se modificó evidencia productiva legítima.

### Apply, recovery posterior y login público

```json
{"status":"PASS","mode":"APPLIED","migration":"20260901000200","before":{"applied":false,"affiliates":947,"documents":3434,"requests":15,"events":5,"archived":0},"after":{"applied":true,"affiliates":947,"documents":3434,"requests":15,"events":5,"archived":0},"persistentTestWrites":0}
{"status":"PASS","mode":"RECOVERY_DRY_RUN_APPLIED_STATE_PRESERVED","migration":"20260901000200","before":{"applied":true,"affiliates":947,"documents":3434,"requests":15,"events":5,"archived":0},"after":{"applied":true,"affiliates":947,"documents":3434,"requests":15,"events":5,"archived":0},"persistentWrites":0}
{"status":"PASS","mode":"VERIFY_APPLIED","migration":"20260901000200","state":{"applied":true,"affiliates":947,"documents":3434,"requests":15,"events":5,"archived":0},"persistentTestWrites":0}
{"status":"PASS","target":"GITHUB_PAGES_PRODUCTION","phase":"authenticated","errorCode":null,"adminOnly":false,"pageErrors":[]}
```

GitHub Actions run `33578359153` desplegó correctamente el commit `dfa9d9016531f2175c78a15b26e2e6925a0135cc`. El E2E mínimo productivo confirmó que el desfase frontend–RPC quedó cerrado y el acceso llega a `authenticated` sin el mensaje genérico de conexión.

### Secret / PII preflight

- 22 archivos cambiados o nuevos, todos dentro del alcance declarado.
- Marcadores reales de JWT, `sb_secret_*` o private key: 0.
- Coincidencias contra los valores secretos configurados en `supabase.env`: 0; ningún valor fue impreso.
- Emails literales nuevos en líneas agregadas, excluyendo el bundle derivado: 0.
- `supabase.env` trackeado: 0.

### Architecture Registry

```text
python scripts/generate-architecture-registry.py check
FRESH

python scripts/test-architecture-registry.py
PASS generation freshness stale lookup screen table column reverse admin permissions tests fallback incremental secrets determinism
```

## Architect review

Revisión posterior al apply: `APPROVED`. Autoridad, migración/recovery, RLS, bloqueo central, login productivo, UI preservada, expediente versionado y límites legacy coinciden con la autorización; no se encontró una segunda autoridad ni una escritura persistente de prueba.

## Recovery

`20260901000200_admin_affiliate_archive_and_digital_file_recovery.sql` restaura las definiciones exactas capturadas al aplicar y elimina sólo objetos aditivos. Aborta si encuentra un archivo/restauración, evento, documento, solicitud, sesión de impersonación o cualquier otro conteo legítimo posterior distinto del baseline. No debe ejecutarse después de actividad administrativa real.

## Limitaciones

- No se archivó/restauró una persona real de forma persistente ni se reemplazó un documento legítimo sólo para certificar; ambas rutas quedaron probadas transaccionalmente con `ROLLBACK`.
- El E2E con archivo documental legítimo permanece diferido hasta disponer de un insumo autorizado. No se inventaron datos ni se alteró evidencia real.

## ADMIN AFFILIATE ARCHIVE AND DIGITAL FILE RESULT

```text
Canonical affiliate authority: public.affiliates
Archive model: SOFT_DELETE / ARCHIVE
Second affiliate table: NO
Hard delete: NO
Archived screen: PASS (local/build + backend productivo)
Archive action: PASS (transactional rollback)
Restore: PASS (transactional rollback)
Same affiliate_id preserved: PASS
numero_control preserved: PASS
Documents preserved: PASS
Requests preserved: PASS
Savings history preserved: PASS — no interaction
Auth preserved safely: PASS
Archived self-service blocked: PASS — central backend contract
Backend enforcement: PASS
Archived duplicate detection: PASS
Active duplicate detection: PASS
Digital expediente: PASS (local/build + backend productivo; archivo legítimo diferido)
Image thumbnails: PASS (implementation/static; archivo legítimo diferido)
Image viewer: PASS (shared viewer/static; archivo legítimo diferido)
PDF viewer: PASS (shared viewer/static; archivo legítimo diferido)
Document upload: PASS (existing authority preserved)
Document replacement: PASS (writer/recovery dry-run; legitimate-file E2E pending authorization)
Audit trail: PASS
RLS/security: PASS applied/live
Cross-user: DENIED by existing separate admin/self document contracts
Data loss: 0
Google writes: 0
Unexpected files: 0
Migration required: APPLIED — 20260901000200
Production authorization required: NO — authorization consumed for exact migration
Commit: see final handoff SHA
origin/main: see final handoff SHA
Push: see final handoff
Final verdict: PASS
```
