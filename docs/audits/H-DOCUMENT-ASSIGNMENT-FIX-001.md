# H-DOCUMENT-ASSIGNMENT-FIX-001

Publication: commit 252e0af57fac35e4e8ca335f69d19d8920a1d544, Pages run 37657278503 SUCCESS. Public HTML/bundle/service-worker match the local v2026100416 artifact exactly. The final read-only historical check observed three new real LOAN_APPROVAL records generated concurrently by normal system use; all 107 rows present at baseline retain their exact full-row hash. The verification now compares the captured baseline cohort by timestamp, count and full hash, allowing subsequent appends without ignoring any historical mutation. No QA document was issued or reissued.

Verification scope extension before implementation: scripts/verify-document-assignment-fix-live.js may authenticate the controlled admin to read the published documentary screen and request synthetic preview at 390/1440. No SAVE, ISSUE, REISSUE or business write. Evidence is aggregated, excludes personal data, document contents and signatures. Publication verification covers actual HTML/bundle/service-worker hashes and refresh.

Scope extension before edits: recover renderer.mjs and layout.mjs byte-for-byte from deployed Edge v18 (employee category support previously deployed but absent from origin/main). Classified RECOVERED_DEPLOYED_SOURCE; no runtime change versus production. ESZIP backup and module comparisons stay in private working files; public evidence contains hashes only. index.ts/layout-service.mjs deployed bases match origin/main; render-layout.mjs matches exactly. Preserve all five modules through deployment readback. Also repair preexisting mobile overflow only in Configurar footer via optional Dialog footer wrapping: all existing buttons remain, no shared CSS change. Separate template-margin preview from effective-layout configuration preview; reset saved draft baseline before opening designer.

## PRE-CHANGE AUDIT

Owner: «corrijelo hazlo de forma quirurgica», después de H-DOCUMENT-ASSIGNMENT-AUDIT-001. Autoriza corregir el sistema auditado y la asignación de Membresías a Solicitudes de préstamo; preservar programas ajenos y documentos históricos.

Scope: partir de origin/main/publicación vigente en checkout aislado `.tmp/document-assignment-fix/release`; corregir proyección efectiva, preview y guardado atómico por ámbito. Crear versión de Membresías que conserve sus elementos y use el membrete ya seleccionado. No copiar el diseño de Préstamos ni reemitir documentos existentes.

Files allowed: este informe, docs/AGENT_CHANGELOG.md, docs/qa/evidence/document-assignment-fix/, scripts/test-document-assignment-fix.js, scripts/document-assignment-fix.js; app/screens-admin-document-generation.jsx; supabase/functions/document-generation/layout-service.mjs e index.ts; una migración/recovery focal de document_generation_command/document_layout_persist; bundle y cachebusters GENERATED_ARTIFACT; Registry únicamente si cambian contratos/dependencias. Archivos de trabajo/backup/build en .tmp/document-assignment-fix/. Fuentes recuperadas se mantienen en checkout aislado; cambios locales previos no se sobrescriben.

Authority: document_private layouts/layout_activations gobiernan formato efectivo; configurations gobierna vigencia/firmantes. Template versions, layouts y snapshots inmutables. Estado frontend derivado sin persistencia/fallback. Lectores/writers canónicos existentes por RPC/Edge; grants service-only de persistencia conservados.

Plan: recuperar fuentes desplegadas; introducir metadata de asignaciones en DASHBOARD; preview del mismo candidato; validar/renderizar en Edge y aplicar configuración/versionado/asignación en una transacción con control de versión e idempotencia; tests aislados y navegador; revisión independiente; aplicar corrección focal verificada y preservar huellas de otros ámbitos e históricos.

Risk: versiones compartidas, fondos específicos, desasignación explícita, modificación concurrente y drift productivo. Guardas por baseline y scope; no actualizaciones destructivas, no cambio de template_default, no alteración de negocio o datos financieros.

Recovery: funciones previas/ACL preservadas y recovery verificable; asignación previa conservada append-only. Versiones previas y documentos no se eliminan. Una restauración documental usa nueva activación, no borrado.

Skills: Navigator (STALE; discovery directo), pre-change/source-of-truth/database/security/UI/post-change; legacy READ ONLY documental; architect-reviewer antes del cierre. Sin Google, fórmulas, saldos, aprobaciones ni cálculos nuevos.

Tests: CAS configuración/asignación, retry/conflicto, rollback, aislamiento, preview/plantilla efectiva, geometría, RLS/grants, históricos. Cambios focales de módulo documental; si el diff alcanza infraestructura compartida global aplicar su regresión obligatoria.

Scope expansion (before edit): `scripts/test-document-assignment-fix-browser.js` in release for isolated Chrome checks. Existing document designer/repositories remain unchanged. Two source surfaces only: Admin document screen and its focal Edge layout service; worker/renderers, signed URL handling, shared viewer/auth/storage remain byte-identical. Cachebusters only in generated publication artifacts.

Backend scope refinement: existing `document_layout_context` gains a read-only, permission-checked lookup of the expected immutable assignment for safe retries; migration/recovery includes it and an installation backup column for exact function/ACL recovery. No new domain, authority, exposed private asset or writer permission. A metadata-only index update will reflect the action contract.

Status: PASS para implementación focal autorizada. Publicación/corrección se ejecutan sólo tras verificar candidato concreto.

## Implementación y backend verificados, publicación frontend pendiente

La implementación parte del checkout aislado `a8f779fea0bec3ef4813c6bf17ac1314dcf6c0ec`. La selección de plantilla y el diseño efectivo ya no se presentan como una misma entidad cuando difieren: la tarjeta obtiene la plantilla/version del diseño realmente asignado, y la configuración general prepara una operación atómica sobre esa asignación.

### Contratos verificados en código

- `DASHBOARD.layout_assignments` devuelve una fila latest por `program/document_type/fund_key`, ordenada por `created_at,id`. Proyecta IDs, nombres/versiones de diseño y plantilla; incluye `layout_id=null` para desasignación explícita, sin definición ni datos personales.
- `LAYOUT_CONFIGURE_PREVIEW` usa plantilla seleccionada, firmantes del borrador y definición inmutable de la asignación esperada. Renderiza datos sintéticos con el renderer real sin escribir configuración, Storage ni documentos.
- `LAYOUT_CONFIGURE` valida el mismo candidato y llama una sola vez al writer service-only `document_layout_persist('CONFIGURE',...)`. Dentro de la transacción verifica configuración y asignación esperadas, agrega configuración con `follow_active=false`, clona el diseño sólo si cambia la plantilla, conserva sus elementos y agrega únicamente la asignación general de ese programa/tipo.
- `document_layout_context('ASSIGNMENT',...)` conserva los gates backend y recupera el diseño de la asignación histórica esperada. Permite repetir el mismo operation ID después de un commit exitoso sin renderizar accidentalmente una versión posterior. Actor/contexto se derivan del gate autenticado.
- El writer verifica idempotencia antes de CAS y devuelve los IDs del resultado previo cuando el payload coincide; un payload distinto falla. `SAVE_CONFIGURATION` legado participa en el mismo lock y usa timestamp posterior a adquirirlo. Las activaciones ya tienen `clock_timestamp()` como default; no se cambia ese contrato.
- La operación exige vigencia que incluya hoy en Hermosillo. Una configuración futura no activa anticipadamente un membrete con otra configuración vigente. Sin diseño asignado se conserva el flujo existente: guardar configuración y activar explícitamente el diseño.
- No se modifica `template_default`, asignaciones específicas por fondo, diseños compartidos anteriores, snapshots ni PDF emitidos. La corrección preparada de Membresías reutiliza exactamente sus firmantes y definición, cambiando únicamente la plantilla efectiva solicitada y la versión/asignación necesarias.

### Archivos y preservación

Runtime focal: `app/screens-admin-document-generation.jsx`, `supabase/functions/document-generation/index.ts` y `layout-service.mjs`. Infraestructura SQL focal: migración/recovery `20261007000200_document_assignment_consistency.sql`; modifica tres funciones existentes y agrega en la instalación privada el backup de sus definiciones/identidad/ACL.

`renderer.mjs` y `layout.mjs` son `RECOVERED_DEPLOYED_SOURCE`: se recuperan del bundle Edge v18 para conservar soporte de categoría laboral ya productivo, ausente en origin/main. Su diferencia frente al checkout no representa un cambio de lógica productiva autorizado por esta H. `render-layout.mjs` coincide con producción. La publicación debe comparar nuevamente los cinco módulos contra el candidato y la base recuperada; no sustituir el renderer productivo por una versión más antigua.

`app/bundle.js` y cachebusters en `SutiApp.html`/`sw.js` son `GENERATED_ARTIFACT`: cambia sólo el bloque de pantalla documental y sus versiones de publicación. La lógica de service worker, viewer compartido, repositories, Auth, URLs firmadas, Storage, `AssetRepository` y `DocumentWorkflowRepository` permanecen fuera del diff runtime focal. Conforme a AGENTS.md, la regresión global de imágenes es `NOT APPLICABLE` por este diff; se ejecutan pruebas documentales y PWA pertinentes.

La pantalla conserva pestañas, secciones, tarjetas, firmantes, filtros, controles y diseñador. Configurar usa la plantilla efectiva; los cambios pendientes sobreviven a vista previa y al retorno del diseñador, sin rebasar silenciosamente los IDs CAS si otro operador cambió la asignación. El footer de Configurar permite wrap en móvil para mantener accesibles todos sus botones. La vista previa de márgenes de Plantillas conserva su propósito separado del preview del diseño efectivo.

### Evidencia disponible antes de despliegue

| Verificación | Resultado y límite |
| --- | --- |
| `node scripts/test-document-assignment-fix.js` | PASS, 15 casos aislados PostgreSQL/PDF: permisos, proyección, preview, clon, retries/conflictos, firmantes, CAS, rollback, geometría, vigencia, aislamiento, transacción antigua, fondos, históricos y recovery. Sin red/producción. |
| `node scripts/test-document-assignment-fix-browser.js` | PASS aislado en 390/1440 px; paridad estructural, controles, borradores, CAS, retorno del diseñador y acciones móviles. Sin peticiones externas ni datos reales. |
| Suite documental y PWA | Evidencia `regression-tests.json`: 23 checks core y PWA PASS; runner temporal normaliza CRLF de migraciones históricas en memoria. |
| Build focal | Evidencia `build.json`/`pages-build.json`; preserva chunks ajenos y valida sintaxis de bundle. Debe corresponder al último hash candidato al publicar. |
| Preview real de plantilla | `candidate-preview.json` confirma PDF con datos sintéticos y misma definición; bytes privados de trabajo no se incorporan al repositorio. |
| Regresión global de imágenes | NOT APPLICABLE según clasificación de artefactos y límites del diff, sin tocar infraestructura compartida listada en AGENTS.md. |
| Backend productivo | PASS: migración aplicada conservando OID/owner/ACL; Edge v19 con readback exacto de cinco módulos y tres módulos renderer conservados; Membresías usa diseño v2 con Solicitudes de préstamo. 107 registros históricos, firmantes, elementos, otros programas y plantilla global preservados. Anónimo: 401. |
| Publicación frontend | Pendiente: comprobar que GitHub Pages sirve el bundle candidato v2026100416 y verificar su pantalla. Build conserva 155 chunks ajenos, cambia sólo la pantalla documental y no cambia lógica de service worker. |

La evidencia publicable está en `docs/qa/evidence/document-assignment-fix/`: `schema-applied.json`, `deploy-edge.json`, `membership-corrected.json` y `production-verified.json` acreditan el backend. La corrección creó diseño v2 conservando los 23 elementos y sus firmantes; retry idéntico devolvió el mismo resultado. Cero reemisiones. Backups Edge, baseline técnico privado, payload de operación y PDF candidato están bajo `.tmp/document-assignment-fix/private/`, fuera del paquete Git. No registrar tokens, firmas, URLs firmadas ni contenido de PDF reales en evidencias publicables.

### Guardians, alcance del dictamen

SOURCE OF TRUTH: SAFE para el candidato. Supabase conserva las mismas autoridades; la proyección de UI deriva de la asignación efectiva y el borrador es efímero. No hay fallback productivo, caché persistente ni autoridad adicional.

DATABASE MIGRATION: PASS aislado. Baselines exactos de las tres funciones reales, OID/owner/ACL preservados por `CREATE OR REPLACE`, backup privado y recovery exacto verificados. Recuperar código no elimina configuraciones, diseños, activaciones ni históricos agregados.

SECURITY: PASS para gates aislados y verificaciones productivas realizadas. Configuración/preview requieren gates backend; persistencia sigue limitada a service_role; identidad no viene del navegador; permisos, RLS y Storage existentes no se amplían. Recibo live confirma OID/owner/ACL conservados, readback Edge y rechazo anónimo 401.

LEGACY: NOT APPLICABLE a escrituras financieras. Sólo configuración/presentación documental; no Sheets, Apps Script, cálculos, saldos, solicitudes ni aprobaciones. No se reabre la autoridad permanente de Ahorro.

UI PRESERVATION: PASS aislado para estructura/interacciones verificadas; no rediseño ni eliminación de componentes. Comparación publicada pendiente.

ARCHITECTURE: actualización necesaria por nuevos contratos de acciones, metadata y columna de recovery. El Registry sigue siendo índice derivado sin autoridad runtime. Navigator inicial encontró STALE; discovery dirigido confirmó las fuentes antes de incorporar únicamente relaciones demostradas. La generación también reconcilia hashes/evidencia de cambios previos del checkout; no autoriza cambios de esos sistemas.

### Cierre verificado

Membresías usa la plantilla seleccionada “Solicitudes de préstamo” mediante su diseño v2, conservando sus 23 elementos y sus firmantes. Configurar, tarjeta y vista previa concuerdan con la asignación efectiva. El guardado se valida y aplica de forma atómica, con detección de ediciones simultáneas y reintentos idempotentes. No se alteraron asignaciones de otros programas, destinos específicos ni la plantilla global.

La comprobación publicada autenticada verifica tarjeta, selector, PDF sintético, cierre y recarga a 390/1440. Chrome/CDP no entregó el cuerpo de la respuesta PDF al verificador; se validó el Blob real consumido por el iframe: MIME application/pdf, encabezado %PDF- y contenido no vacío. Esto no requirió cambios en el producto. No se capturaron imágenes ni contenidos privados.

El checkout de implementación está en .tmp/document-assignment-fix/release y el cambio funcional publicado es 252e0af57fac35e4e8ca335f69d19d8920a1d544. Los cambios previos del workspace raíz permanecen intactos. Las evidencias finales y verificadores adicionales son documentación/QA sin cambios del artefacto publicado.

```text
H-DOCUMENT-ASSIGNMENT-FIX-001 RESULT
Status: PASS
Files changed: pantalla documental focal; Edge index/layout-service; renderer/layout recuperados exactos de producción; migración/recovery; verificadores y evidencia; Registry derivado; bundle/cachebusters generados; auditoría/changelog.
Source-of-truth verdict: PASS. Misma autoridad Supabase document_private; sin mocks, fallbacks ni cachés productivos nuevos.
Invariant verdict: PASS. 107 registros históricos idénticos por huella completa; 3 registros nuevos legítimos de Préstamos distinguidos de cambios históricos. Firmantes, 23 elementos, otras asignaciones y plantilla global preservados.
Build: PASS. v2026100416; 155 módulos ajenos preservados; HTML/bundle/SW publicados idénticos. Pages 37657278503 SUCCESS.
Tests: PASS. 15 PostgreSQL/PDF, 23 core, 20 checks aislados UI, build Pages y navegador autenticado 390/1440.
Security: PASS. OID/owner/ACL preservados; RLS y actor real backend; persistencia service-only; anónimo 401; Edge v19 readback exacto; cero secretos nuevos.
Legacy impact: NOT APPLICABLE a cambios financieros. No Google, fórmulas, saldos, aprobaciones ni eventos de negocio modificados.
Unexpected files changed: NONE en checkout aislado. Todos los cambios pertenecen al alcance auditado; workspace raíz previo preservado.
Known limitations: los PDF ya emitidos conservan su versión y no se reemiten; no se creó una solicitud o documento productivo de prueba. Regresión global de imágenes NOT APPLICABLE: no cambios reales en assets, viewer, auth, repositories compartidos ni lógica del SW; renderizadores coinciden con producción previa.
Evidence: docs/qa/evidence/document-assignment-fix/ y revisión independiente APPROVED. Registry actualizado con discovery dirigido; freshness final mediante generación incremental.
```
