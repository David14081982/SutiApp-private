# H-COMPANY-CREATE-SAVE-001

## Publicación autorizada — 2026-10-05

Owner: «publicalo y haz commit push». Autoriza commit, push a main y despliegue GitHub Pages de esta corrección. Se amplía el alcance a `scripts/package-company-create-save.js`, `scripts/verify-company-create-save-live.js`, evidencia de release/publicación y checkout aislado `.tmp/company-create-save/release`. No requiere confirmación adicional. La entrega parte del main remoto vigente, conserva los chunks ajenos y regenera su propio Registry (no copia el índice del workspace con trabajo no publicado). Se validará el artefacto servido y el formulario autenticado con writers de empresas bloqueados en la prueba; no se crearán fichas de prueba productivas. Recovery: revertir únicamente el commit de esta H mediante un nuevo commit, conservando datos.

## PRE-CHANGE AUDIT

- Objetivo: reparar el alta de Empresas que devuelve «No fue posible guardar los cambios».
- Alcance: rama Empresas del editor visual; reutilizar `ConveniosRepository.saveCompany` y `attachImage`, RPC existentes con autorización backend.
- Archivos: `app/screens-admin-visual-crud.jsx`; pruebas y build focal `scripts/test-company-create-save.js`, `scripts/test-company-create-save-browser.js`, `scripts/build-company-create-save.js`; este documento, `docs/AGENT_CHANGELOG.md`, evidencia `docs/qa/evidence/company-create-save/`; chunk generado en `app/bundle.js`, cachebusters en `SutiApp.html`/`sw.js`; índices derivados `docs/architecture/registry-*.json` y `SUTIAPP_ARCHITECTURE_REGISTRY.json` si cambia el mapping.
- Fuera de alcance: cambios SQL/schema/RLS/grants/Auth/planes, cuentas o empresas creadas por el agente, datos históricos, Google y finanzas; publicación remota no realizada.
- Autoridad: Supabase `companies`, `company_assets`, `app_assets`. Lectores: AdminRepository y ConveniosRepository; escritores existentes: `save_company_ficha`, `attach_company_ficha_image`. Sin fuente alternativa ni caché persistente.
- Hallazgo: saveManaged inserta categoría/contacto directamente, pero los grants INSERT de companies solo cubren campos básicos. La RPC existente admite la ficha completa. La portada debe usar la RPC de ficha, compatible con company_assets sin columna id.
- Inspección productiva: GET por API de companies para el nombre reportado devolvió cero coincidencias. Management API devolvió HTTP 401; no se alteraron credenciales. Cero escrituras de negocio.
- Registry: STALE por cambios ajenos a esta pantalla; código y schema focal inspeccionados directamente.
- Invariantes: no autoasignar membresías/planes; conservar UUID/origen; fallo visible y formulario recuperable; autorización real en backend.
- Riesgo: bajo, cambio frontend focal. Guardado parcial de portada debe conservar ID para reintento sin duplicados.
- Tests: reproducción aislada con grants/schema reales; navegador aislado con fuentes y bundle, alta/edición/contactos/logo/portada/reintento/denegación; paridad de controles y no cambio en otros módulos.
- Recovery: copia privada de archivos antes de editar en `.tmp/company-create-save/before/`; revertir únicamente este diff/chunk, sin borrar datos.
- Estado pre-change: PASS.

## Contrato visual

Empresas conserva listado, herramientas de orden/publicación/edición, responsabilidades, editor, todos los campos de contacto y categoría, logo, portada, activo, Guardar, Volver, scroll y estados. Sin rediseño. Error de guardado explícito únicamente en Empresas.

## Verificación

### Candidato de publicación autorizado

Paquete sobre main `f36fdd5b3e4db15644a5e4721ee561e2b9d470d8`: PASS. Solo el chunk focal cambia; 155 chunks productivos ajenos intactos. Build Pages real: PASS, 31 archivos públicos. Navegador autenticado contra candidato local 1440/390: PASS, controles completos, llamada a `save_company_ficha` con contactos, rechazo interceptado conserva draft, cancelación y refresh. Cero escrituras de negocio. Versión 2026100411, SHA256 937f05de1fa9750b6029ca573942042def823c9eb60dd744292b91742498ac8e. Ver `release-package.json` y `release-local.json`. Revisión focal del paquete APPROVED; commit/push autorizados expresamente por owner. La verificación de producción se registrará después del despliegue.

`node scripts/test-company-create-save.js`: PASS. PostgreSQL aislado reproduce SQLSTATE 42501 del INSERT anterior y guarda ficha completa por la RPC existente. Edición conserva UUID/orden; reintento de portada deja un vínculo; caller sin permisos rechazado. Helpers de autorización son fixtures aisladas: no equivale a una certificación nueva de RLS productiva.

`node scripts/build-company-create-save.js`: PASS. Cambió únicamente `screens-admin-visual-crud.jsx` entre 154 chunks; 153 preservados byte a byte. Cachebuster 2026100411; lógica de HTML/SW sin cambios. Artefactos generados, no modificación global de helpers ni de repositorios compartidos: regresión global de imágenes NOT APPLICABLE conforme AGENTS.md.

`node scripts/test-company-create-save-browser.js`: PASS. Chrome aislado, toda conexión bloqueada; 390/1440 px; fuente y chunk compilado. Reproduce mensaje anterior, compara controles antes/después, valida payload completo, logos/portada, error de permisos con formulario intacto, guardado parcial con reintento sin duplicación, edición, error de refresh separado y rama Pop-ups sin cambios. El harness valida estructura/interacción; no afirma comparación pixel-perfect con producción. El baseline del navegador se conserva en `.tmp/company-create-save/before/`.

`git diff --check -- app/screens-admin-visual-crud.jsx` y `node --check` de los tres scripts: PASS.

`python scripts/test-architecture-registry.py`: PASS (generación, freshness, stale, lookup, relaciones, permisos, secretos, incremental y determinismo). Lectura OpenAPI productiva confirmó presencia de `save_company_ficha` y `attach_company_ficha_image`; cero escrituras.

Intento inicial de reutilizar `admin-permission-test-db` abortó en su preparación por `ROLE_PERMISSION_OUTSIDE_ASSIGNMENT_CHECK`, antes de probar esta H. No se modificó ese arnés ni sus fixtures preexistentes. La prueba focal usa schema/constraints capturados y las definiciones originales de las dos RPC con dependencias Auth aisladas explícitas.

## Guardians y revisión focal

- Source of truth: SAFE. Mismas tablas/RPC canónicas; sin fallback, store nuevo, datos inventados o escrituras productivas.
- Seguridad: PASS para el diff. Sin cambios de Auth, grants, RLS, límites empresariales, planes o membresías; campos del formulario enviados por allowlist; columnas de procedencia y metadata de UI excluidas. Rechazos backend visibles sin divulgar errores crudos.
- Claude UI: PASS estructural. Ningún control, campo, sección o navegación eliminado. Única adición visual: texto de error recuperable en Empresas.
- Legacy: NOT APPLICABLE, cero archivos o datos Google/financieros tocados.
- Migración: NOT APPLICABLE, no se propone ni aplica SQL.
- Archivos inesperados: ninguno de esta H; trabajo previo extenso preservado. Build valida identidad de chunks ajenos.

## H-COMPANY-CREATE-SAVE-001 RESULT

Status: PASS (corrección local; publicación pendiente)
Files changed: pantalla focal, bundle/cachebusters generados, scripts de prueba/build, este informe, AGENT_CHANGELOG, evidencia y Registry derivado.
Source-of-truth verdict: SAFE
Invariant verdict: PASS para el alcance local
Build: PASS
Tests: PASS, PostgreSQL y Chrome aislados
Security: backend existente conservado; sin ampliación de permisos
Legacy impact: ninguno
Unexpected files changed: ninguno de esta H
Known limitations: no publicado; no se creó Empresa P ni se probaron escrituras de negocio productivas. Management API HTTP 401; lectura REST autorizada sí disponible.
Evidence: docs/qa/evidence/company-create-save/{database,build,browser}.json

## SUTIAPP ARCHITECT REVIEW

Task: H-COMPANY-CREATE-SAVE-001, revisión focal del diff y resultados locales.
Verdict: APPROVED para el candidato local, no una declaración de reparación publicada.
Critical findings: INSERT directo incompatible con grants de contacto; RPC existente resuelve sin ampliar seguridad. company_assets usa clave compuesta, la RPC de ficha evita la ruta antigua que asume id. ID conservado después del primer guardado permite reintento de portada sin duplicación.
Source of truth: Supabase, intacta.
Architecture: editor Empresas → ConveniosRepository → RPC existentes; resto del editor preservado.
Security: autorización permanece backend; limitación de pruebas Auth documentada.
Data: cero escrituras productivas; nombre reportado no encontrado mediante lectura autorizada.
Legacy: sin impacto.
Owner decision: NO para esta corrección técnica.
Next action: publicar únicamente el candidato focal cuando exista autorización de publicación y verificar su artefacto servido; no crear cuentas, pagos, planes ni empresas de prueba en producción.
Response generated for Codex: YES.

### RESPONSE TO CODEX

Aprueba el candidato local de H-COMPANY-CREATE-SAVE-001. Para publicación, prepara una entrega aislada desde la revisión remota vigente que reemplace solo este chunk y sus cachebusters, conservando los demás. Comprueba fuente/bundle y formulario servido sin escrituras ficticias. No declares resuelto en producción antes de verificar el despliegue. Esta revisión no autoriza tareas adicionales ni publicación por sí misma.
