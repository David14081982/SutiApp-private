# H-ADMIN-USER-MODULES-001 — asignación administrativa por usuario

## AUDIT / AUTHORITY / PLAN / RISK

Autorización: el propietario pidió implementar quirúrgicamente la auditoría de permisos, preservando flujos y UI. No se cambia ninguna asignación productiva existente como parte de la instalación.

Dominio: autorización administrativa por cuenta Auth. Autoridades conservadas: admin_assignments, admin_roles, admin_role_permissions, admin_section_definitions y admin_section_responsibilities. Se extiende el catálogo de secciones con metadata de módulos y capacidades; las asignaciones individuales siguen siendo responsabilidades. Un rol técnico de sistema sin privilegios propios identifica el acceso limitado. No existe otro padrón de usuarios, privilegio por email, localStorage ni fallback de autorización.

Alcance declarado: app/screens-admin-access.jsx, app/screens-admin.jsx, app/admin-repository.js, app/admin-cutover-repository.js, app/admin-cutover-store.jsx, app/app.jsx si el enlace directo exige seleccionar el tab; app/section-responsibility.jsx solo para respetar acciones backend. Migración/recovery nuevos 20260914000200_admin_user_modules.sql; scripts de preparación, pruebas SQL, frontend y navegador con prefijo admin-user-modules; evidencia focal; docs de autoridades/seguridad/decisiones/changelog; Registry derivado; bundle y cachebusters generados. Se amplía antes de editar otra superficie.

Backend: nuevos RPC de catálogo, consulta y guardado atómico por UUID resuelto desde correo confirmado; contexto incorpora módulos efectivos. Helpers existentes se conservan mediante definiciones de recuperación y extensiones que mantienen exactamente la rama de roles previos. Se protegen operaciones compartidas (solicitudes/finanzas, workflow/catálogo, segmentación/acceso, popups/aprobaciones) a nivel RLS/RPC, no con el origen enviado por el navegador.

Fuera de alcance: rediseños, fórmulas, tasas, saldos, Google, Apps Script, historia financiera, identidad de afiliados, eliminación de datos de negocio. La autorización de operaciones no reimplementa esas operaciones.

UI a preservar: encabezado, alta total, listado, fechas/asignador, revocación protegida, card style, responsive, sidebar, Resumen y orden existente. Adición: editor de acceso por cuenta, selección de módulos, estados de carga/error, confirmación persistida y conflicto concurrente. El resto de pantallas conserva su implementación.

Riesgos: capacidades compartidas, escalamiento, pérdida de última cuenta principal, revocación parcial, stale context, selección por URL, sobrescritura concurrente y contaminación de artefactos con cambios preexistentes. Controles: barreras backend, allowlist, cuenta principal protegida, escritor transaccional, versión esperada, regresión aislada y pruebas rollback-only; comparación local/productiva.

Recuperación: conservar definiciones previas; recovery debe negarse después de asignaciones reales nuevas. Después de uso, reparación hacia delante; jamás eliminar historia. Primero dry-run transaccional, luego instalación solo con pruebas satisfactorias.

Verificación prevista: total conserva 33 módulos; limitado ve exactamente su selección en Resumen/sidebar/ruta; llamada API ajena denegada; selección de cuatro módulos no incluye Finanzas; persistencia, concurrencia, identidad, revocación y anónimo; paridad visual desktop/móvil. Regresión global de imágenes obligatoria por helpers compartidos, local y Pages. No se declarará PASS si falta evidencia requerida.

Estado inicial: Registry STALE, discovery focal realizado. Árbol de trabajo contiene múltiples cambios previos; no se atribuyen a esta H. Sitio publicado v256; fuentes locales/bundle previo no son idénticos. No publicar cambios ajenos.

Ampliación de alcance antes de implementación: la capacidad assets.write requerida por la carga existente de logos de Membresías también permite branding. Se agregan límites restrictivos solo para nuevas cuentas module_admin en app_assets, asset_sources y Storage; las cuentas previas conservan sus policies. La carga de logos limitada usa una ruta membership/UUID propia. También se acotan RPC compartidas con request_id y writers específicos de branding/aprobaciones/convenios. No se cambia el contenido de documentos ni objetos existentes; se exige la regresión global ya declarada.

Ampliación focal de lectura: app/program-request-repository.js incorpora una rama exclusiva para module_admin que lee la bandeja/detalle general mediante proyección RPC allowlisted. Evita conceder affiliates.read completo para obtener el nombre de un solicitante y evita leer columnas financieras fuera de la selección. Las ramas existentes de otros roles y autoservicio no se sustituyen.


Ampliaci?n final de dependencias dentro del alcance: los editores hijos de Tu Sindicato siguen UNION_SCREEN_REGISTRY, con contexto interno expl?cito y sin mostrar tarjetas adicionales. Las lecturas RPC de seguimiento se separan de la edici?n del cat?logo financiero. No cambian etapas, f?rmulas ni datos.

L?mite de entrega: implementaci?n local, migraci?n/recovery preparados, no instalados ni publicados. No se solicit? publicaci?n y las fuentes locales incluyen modificaciones ajenas ya existentes; no se ejecuta un despliegue amplio. Los casos de navegador usan fixtures aisladas ?nicamente para los RPC nuevos, con login y lectores reales. La matriz backend ejecuta la migraci?n completa contra el schema vigente y revierte todo. No se confunde la regresi?n del sitio vigente con una prueba de la nueva funci?n instalada.

Registry: el modo incremental rechaz? la actualizaci?n focal por cambios ajenos anteriores. Se regenera el ?ndice derivado desde el ?rbol actual; esto no modifica autoridades ni acredita como probadas esas otras features.


## H-ADMIN-USER-MODULES-001 RESULT

Status: PASS ? candidato local verificado; no instalado/publicado.
Files changed: los ocho fuentes declarados; bundle; cachebusters HTML/sw (sin cambio adicional de l?gica SW); migraci?n/recovery nuevos; scripts focales; evidencia; cuatro documentos normativos con ap?ndices; este informe e ?ndice derivado. candidate-hashes.json identifica los artefactos de aplicaci?n.
Source-of-truth verdict: PASS. Responsabilidades/roles existentes, contexto derivado, UUID Auth confirmado; no autoridad paralela.
Invariant verdict: PASS. Contrato protegido y sus tres migraciones intactos; identidad hist?rica y actor real conservados.
Build: PASS ? node scripts/build-bundle.js C:/tmp/babel-standalone-7.29.0.min.js, 121 fuentes; bundleSyntax PASS.
Tests: PASS ? cuatro suites est?ticas; Chrome con ocho casos; matriz backend que recorre los 30 m?dulos seleccionables; recuperaci?n transaccional; regresi?n global local y Pages.
Security: PASS para el candidato contra el schema vigente, con instalaci?n y casos SQL dentro de ROLLBACK. Gobernanza reservada, an?nimo denegado, selecci?n exacta, concurrencia, revocaci?n, l?mites de operaciones compartidas.
Legacy impact: ninguna modificaci?n de c?lculos, Google, Apps Script ni filas financieras persistida. Los cuerpos actuales de RPC conservan su l?gica y s?lo reciben predicados de autorizaci?n.
Unexpected files changed: no cambios manuales fuera del alcance de esta H; el diff Git completo incluye numerosos cambios preexistentes, que no se atribuyen a esta entrega. El Registry derivado indexa tambi?n ese estado previo.
Known limitations: NO APPLIED / NO DEPLOYED. El navegador simula s?lo los RPC nuevos; el backend se verifica separadamente en transacciones reales. No existe todav?a prueba de una cuenta limitada productiva persistente. No se publica el bundle completo sobre el sitio vigente porque contiene fuentes ajenas. WORK_QUEUE_HISTORY.md no existe; WORK_QUEUE.md es de otra tarea financiera y no autoriza una continuaci?n de esa tarea.
Evidence: docs/qa/evidence/admin-user-modules-20260914/{backend,frontend,browser,global-local,global-pages,static-checks,candidate-hashes}.json; editor-desktop.png; limited-mobile.png. Ver registry-check.json para el control final del ?ndice.

## ARCHITECT REVIEW

Task reviewed: H-ADMIN-USER-MODULES-001, implementaci?n local quir?rgica.
Verdict: APPROVED para el candidato local, sin afirmar activaci?n productiva.
What Codex did correctly: reutiliz? las autoridades existentes, mantuvo los m?dulos y controles originales, a?adi? l?mites backend y conserv? las definiciones vigentes para recuperaci?n.
Important findings: paridad del acceso total; exactitud de selecci?n; dependencias internas de Tu Sindicato; separaci?n de lectores y escritores de cat?logo/etapas/solicitudes; recuperaci?n se niega despu?s de uso.
Problems detected: los primeros fallos de la prueba global se resolvieron usando el origen local autorizado y repitiendo la carga productiva; ambas ejecuciones finales PASS sin reescribir assets.
Architecture implications: ocho fuentes focales y una migraci?n aditiva; contexto administrativo derivado con module_keys. No nueva autoridad de negocio.
Source-of-truth implications: roles/responsabilidades Supabase siguen siendo los ?nicos escritores autoritativos.
Security implications: los m?dulos incluyen sus dependencias funcionales; las tablas p?blicas siguen siendo p?blicas. No se confunde ocultar tarjetas con impedir toda lectura de datos p?blicos.
Data implications: cero mutaciones persistidas en producci?n; instalaci?n no cambia asignaciones existentes.
Owner decision required: NO para esta implementaci?n. La revisi?n no autoriza tareas adicionales ni publicaci?n.
Recommended next action: conservar el candidato y su evidencia; para publicar, preparar exclusivamente este cambio sobre la versi?n vigente, aplicar la migraci?n y verificar el resultado instalado dentro de una tarea de publicaci?n.

### RESPONSE TO CODEX

Aprobar la implementaci?n local H-ADMIN-USER-MODULES-001 con el l?mite expl?cito NO APPLIED / NO DEPLOYED. Entregar el resultado sin atribuir cambios productivos ni pruebas con usuarios limitados reales persistentes. No incluir modificaciones previas ajenas en un despliegue. No avanzar a otra H.

SUTIAPP ARCHITECT REVIEW
Task: H-ADMIN-USER-MODULES-001
Verdict: APPROVED ? candidato local.
Critical findings: publicaci?n separada del estado local por divergencia preexistente; ning?n cambio productivo aplicado.
Source of truth: conservada.
Architecture: extensi?n de autoridades existentes.
Security: matriz transaccional y barreras backend verificadas.
Data: sin mutaciones persistidas.
Legacy: c?lculos y Google intactos.
Owner decision: NO para la implementaci?n entregada.
Next action: entrega local; sin autocontinuaci?n.
Response generated for Codex: YES.


## Publicaci?n autorizada ? 2026-09-14

El propietario ordena commit, push y publicaci?n. Se ampl?a el alcance a una copia aislada basada en origin/main 6a4b5fb, preparaci?n de release, registro de migraci?n en supabase_migrations.schema_migrations, Git y GitHub Pages. Se mantienen todos los cambios publicados ajenos, incluidos tama?o de texto, grupos de men? y correcciones anteriores. S?lo se trasplantan los ocho fuentes focales o sus cambios exactos y se reemplazan sus chunks compilados; no se regenera el resto del bundle publicado. Antes de aplicar SQL se cotejan hashes del candidato y se repiten pruebas con ROLLBACK. Instalaci?n conserva conteos/hashes de asignaciones, responsabilidades, roles/permisos existentes y datos de negocio. Recovery probado y definiciones previas archivadas en DB. Verificaci?n local del release, backend instalado, Actions y regresi?n global publicada antes de cerrar. No se asignan permisos reales a ninguna cuenta durante el despliegue.


### Release aislado e instalaci?n

Base publicada confirmada por bytes normalizados: 6a4b5fb002c1669182cc031d3dca11fe458adc6e, bundle v256. Release v257/SW v201 conserva los 114 chunks ajenos y modifica s?lo los ocho declarados. Tipograf?a adaptable, grupos de men? y c?digo ajeno publicados se conservan. Build de Pages y browser focal del artefacto: PASS.

Migraci?n 20260914000200: APPLIED, registrada en schema_migrations. Instalaci?n at?mica comprob? hashes de asignaciones, responsabilidades, roles/permisos existentes, afiliados y solicitudes, y conteos de app_assets/private_assets/Storage: sin cambios. Matriz con backend instalado: PASS, pruebas revertidas mediante ROLLBACK. Prueba de navegador contra nuevos RPC reales: PASS; cat?logo 33, consulta de la propia cuenta confirmada, protecci?n self y cuenta inexistente controlada. Cero permisos asignados persistentemente en pruebas.

La autorizaci?n expresa posterior de commit, push y publicaci?n sustituye el l?mite de entrega local del informe anterior. El estado final de publicaci?n se registra tras verificar GitHub Pages.


Prepublicaci?n: regresi?n global del artefacto v257 con backend instalado PASS. La versi?n publicada anterior v256 present? IMAGE_TIMEOUT en una o dos im?genes del cat?logo en las repeticiones; el artefacto local carg? las 248 im?genes. No hay cambio de filas, objetos ni de los repositorios de cat?logo entre ambas versiones. Se publica el candidato validado y se mantiene la verificaci?n global de la versi?n nueva pendiente hasta ejecutarla; no se atribuye PASS productivo a las ejecuciones con timeout.


## Final publication verification - 2026-09-14

This section supersedes the historical local-only and pending-publication verdicts above. Code commit f130ff563b565403e372dbc7b9dffb252cc66a41 is pushed to main and deployed by successful Pages run 34889134243. The public https://sutiapp.com/ returns bundle v257 and SW v201; the fetched bundle hash matches release-build.json exactly. Backend migration 20260914000200 is applied.

The unmodified official global regression passed against the deployed v257: 167 public assets, 29 legacy images, 248 program images, profile, Admin Afiliados, Membership, loan documents, Marketplace, fullscreen, refresh, fresh profile without service worker and a legitimate protected PDF. No production data writes. Previous v256 timeouts remain in prepublication-global-pages.json; they are not represented as passing runs. The underlying runner labels custom domains as local; test-admin-user-modules-global.js explicitly uses https://sutiapp.com/ for the pages result.

### H-ADMIN-USER-MODULES-001 RESULT - deployed

Status: PASS.
Files changed: 52 files in f130ff5, including exactly eight focal application sources, their bundle/cachebusters, additive migration/recovery, focal scripts, evidence and declared governance/derived index. Follow-up evidence commit changes only documentation/evidence and derived registry.
Source-of-truth verdict: PASS; existing Supabase roles/assignments/responsibilities remain authoritative.
Invariant verdict: PASS; protected administrative contract, confirmed Auth UUID and legacy identities preserved.
Build: PASS; 122 chunks, 114 unchanged; live artifact hash matches the isolated release. GitHub Pages build, backend compatibility gates and postdeployment request check succeeded.
Tests: PASS; focal static and eight browser cases, installed SQL matrix with ROLLBACK, real production editor reads, global local and production regression.
Security: PASS within verified scope; backend module boundaries, governance/self protection and optimistic concurrency. No secrets committed. No new permission assignments made by deployment.
Legacy impact: no Google, formulas, financial history, existing business rows or assets rewritten.
Unexpected files changed: none in the published commit. Preexisting root workspace changes excluded. Vendor files have local line-ending normalization only and are absent from the commit diff.
Known limitations: limited-user browser behavior uses isolated fixtures; SQL access matrix uses real installed backend and rolls back. No persistent test administrator was created. Production validation is a point-in-time check.
Evidence: deployment.json, production-browser.json, global-pages.json, global-local.json, release-build.json, release-sql-applied.json, backend.json, browser.json, static-checks.json and registry-release.json in docs/qa/evidence/admin-user-modules-20260914/.

### ARCHITECT REVIEW - published release

Task reviewed: authorized commit, push and publication of H-ADMIN-USER-MODULES-001.
Verdict: APPROVED.
What Codex did correctly: isolated the release from unrelated workspace changes; compared the actual commit scope, preserved chunk hashes, migration before/after hashes, installed backend tests and published browser evidence.
Important findings: exactly eight focal sources changed; 114 unrelated bundle chunks preserved; all required current global checks pass without modifying the runner or replacing assets.
Problems detected: no unresolved defect within this delivery. Historical prepublication timeouts remain disclosed. WORK_QUEUE_HISTORY.md is absent; WORK_QUEUE.md concerns a separate financial task and does not authorize continuing it.
Architecture implications: existing repositories and authoritative tables extended; no duplicate data authority.
Source-of-truth implications: assignments/responsibilities remain authoritative, module context is derived.
Security implications: backend enforcement complements visible module selection; public catalog data remains public by existing policy.
Data implications: installation proofs show existing assignments and business rows unchanged; test mutations rolled back.
Owner decision required: NO.
Recommended next action: deliver the published result and stop; do not advance another H.

### RESPONSE TO CODEX

Approve the published H-ADMIN-USER-MODULES-001. Commit only final evidence and the refreshed derived index; communicate the deployed site and verification result. Do not assign real users, rewrite data or begin another H.

SUTIAPP ARCHITECT REVIEW
Task: H-ADMIN-USER-MODULES-001 publication.
Verdict: APPROVED.
Critical findings: none unresolved within this scope.
Source of truth: preserved.
Architecture: eight focal sources; unrelated public UI preserved.
Security: installed matrix and production read verification PASS.
Data: existing assignments and business rows preserved.
Legacy: unchanged.
Owner decision: NO.
Next action: final evidence delivery, no task continuation.
Response generated for Codex: YES.
