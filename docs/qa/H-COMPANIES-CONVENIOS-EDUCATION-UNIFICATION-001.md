# H-COMPANIES-CONVENIOS-EDUCATION-UNIFICATION-001

## PRE-CHANGE AUDIT — 2026-09-08

Objetivo: completar la proyección pública de empresas, convenios e instituciones educativas reutilizando sus autoridades y UI.
Autorización: solicitud owner adjunta, implementación automática; publicación condicionada a todos los checks PASS.
Alcance: Convenios/lista/detalle, Admin Convenios/Empresas/Educación, módulos y store empresarial, readers/writers comerciales y educativos.
Archivos a tocar: app/screens-convenios.jsx, app/screens-admin-convenios.jsx, app/screens-admin-visual-crud.jsx, app/screens-admin.jsx, app/screens-company.jsx, app/screens-company-modules.jsx, app/company-store.jsx, app/marketplace-repository.js, app/admin-cutover-store.jsx, app/admin-repository.js; nuevo app/convenios-repository.js; scripts/build-bundle.js para incluirlo; app/bundle.js y SutiApp.html/cachebusters exclusivamente generados. SQL/recovery focal 20260908000900_companies_convenios_education.sql. Scripts prepare/test-companies-convenios-education*.js/sql. Este documento, evidencia bajo docs/qa/evidence/companies-convenios-education-20260908, docs/AGENT_CHANGELOG.md, docs/SOURCE_OF_TRUTH.md, docs/INVARIANTS.md, docs/DECISIONS.md y Registry derivado si cambia arquitectura.
Fuera de alcance: Auth global, app shell/routing compartido, lógica service worker, AssetRepository, private_assets, documentos privados, Google/finanzas, términos comerciales inventados, limpieza del workspace previo.
Datos: companies/company_assets, company_benefit_profiles/company_benefits/company_audience_rules, educational_resources, marketplace_products/promotions, company_portal_plans/subscriptions/memberships. Sin duplicar instituciones como companies.
Autoridad: mismas tablas Supabase; nuevo lector es proyección descartable. app_assets/Storage conserva autoridad de imágenes.
Riesgo: alto en permisos tenant y escritura granular; medio en preservación UI. Cambios previos numerosos se preservan y se comparan contra baseline privado, no sólo HEAD.
Tests: SQL transaccional con ROLLBACK, RLS granular/cross-company, proyección de tres clases, guardar/leer, límites por plan, focal browser móvil/desktop, build. Si se cambian repositories compartidos realmente: regresión global de imágenes local y Pages conforme AGENTS.md.
Recovery: baseline privado de fuentes; snapshot de definiciones/ACL antes de migrar; recuperación aditiva sin borrar historia. No aplicar SQL sin dry-run/recovery y reconciliación.
Status: PASS. Owner autoriza crear planes/precios/límites y establece que Admin acredita pagos presenciales y habilita pop-ups en Inicio según plan; no pago electrónico.

Ampliación autorizada: tres planes MXN Esencial 299/mes (5 productos), Impulso 599/mes (15, pop-ups), Destacado 999/mes (50, pop-ups e historial). Anual=12 mensualidades. No asignar suscripciones/pagos/membresías ficticias a empresas reales. La instalación de planes es configuración administrativa expresamente autorizada, no fixture. Certificación de tenant con fixtures transaccionales revertidos.
Ampliación técnica previa: policies de Storage focales para imágenes de ficha bajo tenant/permiso existente, RPC de registro y enlace sobre app_assets/company_assets; favoritos educativos con FK al recurso original. No alterar AssetRepository ni Storage privado. Se incluye prueba global de imágenes porque hay backend/Repository compartido afectado.
Ampliación previa: app/screens-admin-planes.jsx para acreditación explícita de pago presencial y asignación opcional de una cuenta Auth existente al tenant. RPC valida Admin, plan, ciclo, importe y cuenta; nunca crea Auth ni atribuye pago a una empresa por instalar planes.
Ampliación previa por gap demostrado: app/affiliate-auth.js y app/app.jsx. resolveSessionOnce rechaza !affiliate&&!isAdmin aunque exista membresía empresarial. Añadir rama companyOnly verificada por RPC self de membresía + plan, con CompanyPortalRoot independiente y selector de entrada empresarial; no relajar identidad/archivo/impersonación del afiliado ni conceder Admin. Auth/global-image son checks obligatorios. Baseline adicional privado antes de tocar ambos archivos.
Dependencia directa del login: scripts/verify-auth-deployment-contract-live.js incorpora get_current_company_access al gate obligatorio previo a publicar. Cambio técnico necesario para impedir publicar frontend contra RPC inexistente.

## Gap audit inicial — evidencia código y Supabase real

| Capacidad | Clasificación | Evidencia |
| --- | --- | --- |
| UI empresarial y nueve módulos | PARTIAL | Pantallas presentes; RPC perfil guarda sólo descripción/contacto, pierde nombre/historia/sucursales; logo/galería siguen image-slot. |
| Planes/suscripciones | PARTIAL | Schema y Admin existen, cero planes/suscripciones/membresías reales. ADR-033 prohíbe inventarlos. |
| Productos/promociones | PARTIAL | Repositories y RLS tenant presentes; cero filas; max_products no aplicado en policy actual. |
| Propuestas popup | ALREADY_WORKING (contrato backend) | Policy exige membresía, suscripción activa, fechas y allows_popups. Falta certificación con contratación real. |
| Directorio empresas | ALREADY_WORKING | 33 filas; CompaniesRepository y assets existentes. |
| Beneficios/descuentos/destacados públicos | DISCONNECTED | Admin usa company_benefit_profiles/benefits; público no consulta esas tablas. Cero perfiles/beneficios reales al auditar. |
| Ficha Admin Convenios | PARTIAL | Nombre/categoría/dirección/audiencia/beneficios; descripción escrita erróneamente desde dirección; guardado cierra sin esperar resultado. |
| Educación | DISCONNECTED | 28 instituciones (9 publicadas), 4 tutoriales no publicados. Público Convenios no las consulta. |
| Ficha educativa completa | MISSING | Recursos tienen título/descripción/imagen/enlace; falta portada/contacto/requisitos/servicios estructurados. |
| Bitácora empresarial | DISCONNECTED | UI filtra bitácora Admin por nombre; no lector tenant propio. |

## Contrato de pantallas preservado

Convenios: TopBar/campana, carrusel patrocinado con swipe/posición/dots/zoom, buscador/filtros/chips, Destacados, tarjetas/favoritos, Todos, detalle, galería/viewer, credencial y CTA contacto; scroll y bottom navigation existentes.
Admin Convenios: tabs Convenios/Anuncios/Catálogos, drag/order, editor, audiencia/beneficios, destacado/visibilidad/acento; ampliar ficha sin reconstruir.
Educación: editor/listado y tabs Educación/Tutoriales; cambia etiqueta del menú y se amplía únicamente ficha educativa.
Empresa: gate, dashboard/plan/KPIs y nueve módulos; conservar campos e interacciones y conectar persistencia real.

## SOURCE OF TRUTH / SECURITY / LEGACY

Supabase es única autoridad; no fuentes DATA/localStorage/Google fallback. UUID original por registro y tipo de origen evita colisión en proyección; no replicar datos educativos en companies. Categoría educativa derivada por backend del resource_kind; categorías comerciales desde campos existentes, sin parsear textos históricos.
RLS y RPC son barrera: responsable Educación no recibe Companies; Convenios no crea membresías; empresa no altera plan, aprobación ni otro tenant. Permisos por acción y assets deben mantenerse.
Tutoriales Ahorro: preservación de contenido exclusivamente, sin lectura Google, sin fórmulas/writers/triggers financieros. Legacy classification: READ ONLY en inspección de metadata; sin cambios legacy autorizados ni necesarios.
Registry inicial STALE sólo por cuatro archivos de evidencia de otra H; discovery dirigido verificó código y schema live.

## Resultado

Ampliación previa 2026-09-09: el browser real demuestra que company-store no carga porque el lector heredado usa SELECT sobre program_requests, revocado en producción. Añadir RPC focal list_company_commercial_requests sobre la misma autoridad, proyección explícita sin documentos, firmas ni snapshots financieros, filtrada por tenant con plan activo o permiso administrativo existente y excluyendo tombstones. No conceder SELECT de tabla. Reutilizar escritores canónicos existentes sin alterar fórmulas, Google ni estados financieros. Nueva migración/recovery 20260909000100_company_commercial_completion, prepare/tests focales y app/popup-proposal-repository.js para resolver imagen de propuesta desde app_assets. Añadir guard focal de aprobación de promociones para exigir publish en backend y limitar creación de propuestas a owner/editor. Completar proyección social/promoción sin reescribir la migración ya aplicada. Recovery restaura definiciones previas, elimina sólo objetos nuevos, sin borrar filas. SQL tests transaccionales + snapshot de definiciones/hash de datos antes/después. Clasificación legacy: READ ONLY en proyección operativa comercial; escritores existentes intactos. Global de imágenes utiliza localhost:8080, origen CORS ya autorizado; no cambia configuración de seguridad ni datos documentales.

Implementación publicada y verificada. Resultado final PASS; evidencia y SHA al cierre.

## Implementación y evidencia verificable

- **Tres clases / autoridad:** `list_public_convenios` proyecta empresas pagadas vigentes, convenios gratuitos e instituciones educativas publicadas con UUID y tipo originales. No hay copias de instituciones en companies. Prueba SQL y Chrome: 42 fichas únicas, 9 en Educación, Tutoriales preservado.
- **Perfil / imágenes:** Mi Empresa guarda nombre, información, contacto, historia, horarios, sucursales, redes, video/mapa y logo/portada/galería mediante los campos y assets canónicos. Admin Convenios guarda atómicamente descripción, condiciones, audiencia y beneficios separados de dirección. El primer upload crea una ficha despublicada y conserva su UUID ante fallo/reintento.
- **Educación:** menú Educación, pestaña Tutoriales preservada, oferta/descuentos/requisitos/contacto/portada y listas estructuradas. El editor conserva espacios y saltos de línea durante captura; normaliza sólo al guardar. Las fichas públicas usan valores reales.
- **Comercio:** productos opcionales reutilizan CatalogEditorList/MarketplaceRepository. Backend aplica cupo serializado y tenant. Promociones guardan/recuperan imagen, sólo publican aprobadas/en vigencia; aprobar por API exige publish. Pop-ups conservan el flujo existente propuesta → revisión → borrador → publicación por Admin y requieren plan.
- **Login / planes:** entrada `?company_portal=1`; Auth verificado sin obligación de afiliación, membresía y plan vigentes. Admin acredita pago presencial con confirmación, referencia e importe backend; puede asignar correo de Auth existente verificado. Esencial 299/5; Impulso 599/15+pop-ups; Destacado 999/50+pop-ups+historial (MXN mensual, anual ×12).
- **Operación:** solicitudes/cotizaciones desde una proyección mínima de program_requests sin reabrir SELECT de tabla, sin firmas ni snapshots financieros. KPI y avisos derivan de operaciones propias. Bitácora sólo del tenant; historial mensual según plan. Writers canónicos de solicitudes y Google permanecen intactos.

| Verificación | Evidencia | Resultado |
|---|---|---|
| Forward y recovery 20260908000900 | sql-dry-run.json, recovery-dry-run.json, sql-apply.json | PASS; tres planes añadidos, filas originales intactas |
| Complemento 20260909000100 | completion-test.json, completion-apply.json, completion-verify.json | PASS; filas originales intactas |
| SQL funcional / permisos | prepare-companies-convenios-education-completion.js verify | PASS; transacción ROLLBACK, tenants A/B, upload/registro/enlace, cupo, roles, educación/tutoriales, proyección, vigencia, anonimato y aprobación |
| Auth actual y entrada empresarial | focused-auth-tests.json, auth-deployment.json | PASS; sesión/restauración/logout, no afiliado, rechazo sin plan, fallo backend cerrado, cinco RPC protegidas |
| Chrome real 390/1440 | local-live.json y local-*.png | PASS; backend real, 42/9, contenido/tutoriales, tres planes, pago requiere confirmación, multilinea, cero escrituras comerciales |
| Panel nueve módulos 390/1440 | isolated-panel.json y isolated-*.png | PASS; fixtures exclusivamente browser, guardado, error conserva formulario, imágenes, pop-ups según plan |
| Build bundle / Pages | scripts/build-bundle.js, scripts/build-pages-site.js, scope.json | PASS; candidato de 113 módulos, artefacto público de 23 archivos |
| Regresión global requerida | global-local-final.json | PASS; sello, perfil, Admin Afiliados, imagen/PDF legítimos, Membership, Préstamo, catálogos/galería, Marketplace, fullscreen, refresh y con/sin SW |
| Alcance y secretos | scope.json + baseline privado tracked-hashes.json | PASS; sólo archivos de la H; ningún source financiero/Google/DocumentWorkflow/AssetRepository modificado; sin secretos frontend |

Directorio de evidencia: `docs/qa/evidence/companies-convenios-education-20260908/`. Datos iniciales y firmas de migración: `before.json`, `sql-apply.json`. Backups técnicos privados: `C:/tmp/sutiapp-companies-convenios-education-20260908/`.

### Límites operativos explícitos

No existe aún una contratación empresarial real: producción conserva cero suscripciones/membresías y se crearon únicamente los tres planes autorizados. No se atribuyó pago a ninguna empresa. El primer alta real debe usar un pago efectivamente recibido y una cuenta Auth existente verificada. La certificación positiva de empresa pagada combina SQL real reversible y UI en browser aislado, no una contratación ficticia en producción.

La H no publica automáticamente las 19 instituciones restantes ni inventa información comercial ausente. Pop-up aprobado conserva publicación administrativa posterior. No se crean métricas ficticias de visitas/clics; se muestran operaciones reales. Recovery de la migración principal aborta después de actividad comercial nueva para preservar historia.

El workspace original tenía numerosas H previas modificadas; el candidato se construyó en `C:/tmp/sutiapp-company-unification-release` sobre origin/main `315f9b27e7b01830734318a1ea7bf657822fe995`. Los módulos de Ahorro sin publicar se excluyeron del candidato; el bundle original sigue correspondiendo a sus propias fuentes de 116 módulos.

### Revisión arquitectónica

Ampliación previa por prueba fallida: `scripts/generate-architecture-registry.py` y `docs/architecture/architecture-overrides.json`. El test obligatorio demuestra que lookup Convenios devuelve muchas migraciones y excluye app/screens-convenios.jsx del top 10. Priorizar únicamente archivos de pantallas cuyo nombre/alias coincide exactamente, antes de la puntuación acumulada de dependencias; conservar discovery/cross-domain. Actualizar el vínculo semántico obsoleto CompaniesRepository al nuevo ConveniosRepository. Sin cambio runtime, fuentes, datos ni permisos; validar con test-architecture-registry.py.

La misma prueba detectó que el extractor confundía el sufijo `_push` de una función de una prueba SSRF existente con navegación `push`, incorporando una URL técnica con userinfo al índice. Acotar la coincidencia al identificador de navegación completo; no editar la prueba SSRF ni sus reglas. Es corrección del índice derivado dentro del alcance ampliado.

Reconstrucción read-only desde solicitud, ADR-111, fuentes, diff, schema real y evidencia; corpus normativo registrado en review-inputs.json. WORK_QUEUE_HISTORY.md no existe. WORK_QUEUE.md pertenece al MASTER Phase 7 y no autoriza una H posterior; la autorización de esta implementación/publicación procede de la solicitud expresa del propietario. No se avanzó dicha cola.

No se detectaron autoridades paralelas, pérdida de contenido Claude ni mezcla de permisos; los controles nuevos tienen backend probado. Los gates de Registry, despliegue y producción terminaron PASS; ver cierre.

Gate previo a publicación: `python scripts/test-architecture-registry.py` terminó con exit 0 (PASS). Verifica generación, freshness/stale, búsquedas de pantallas/tablas/columnas, relaciones inversas/Admin/permisos/tests, fallback técnico, ciclo incremental, ausencia de secretos y determinismo. Evidencia: `registry-suite.json`. Todos los controles locales están PASS; continúa exclusivamente la publicación y comprobación productiva autorizadas por el propietario.

Las firmas de los recibos SQL corresponden a los bytes aplicados originalmente. Git normaliza CRLF a LF sin alterar SQL; SHA-256 canónico LF: migración principal `60adb7d78bd5d8b64a8a3e0f06e7a6fa05dc96acbb0e433bbb409a4c2fd6aa5a`; complemento `5336baad7984011ede8db5740df021f8a68126a0ffd29b6dcfb24d099d7c9f53`.

## H-COMPANIES-CONVENIOS-EDUCATION-UNIFICATION-001 RESULT

Status: PASS
Files changed: fuentes focales, dos migraciones/recovery, pruebas, gobierno y Registry declarados; inventario exacto en el diff del commit 19722ccb65d4e4f9304761a495c333ed9239736e.
Source-of-truth verdict: PASS. Companies, recursos educativos, catálogo, planes, operaciones y assets conservan sus autoridades Supabase. Ninguna copia maestra o fallback productivo.
Invariant verdict: PASS. INV-223 a INV-227; tenant, plan vigente, permisos por acción, UUID original y separación Educación/Convenios/Empresa.
Build: PASS. Bundle 113 módulos; Pages 23 archivos. Bundle v236, cache v184; los tres archivos publicados coinciden byte a byte con Git.
Tests: PASS. SQL forward/recovery y aislamiento; Auth; Chrome 390/1440 real y panel aislado; Registry completo; imagen global local y Pages con PDF legítimo, fullscreen, refresh y comparación con/sin service worker.
Security: PASS. Backend/RLS, RPC mínimas, sin SELECT directo reabierto, sin secretos ni privilegios de Admin para la empresa. Cinco RPC de Auth protegidas y gates de solicitudes.
Legacy impact: NOT APPLICABLE para escrituras/cálculos financieros o Google. Sólo proyección comercial read-only sobre program_requests; escritores existentes intactos.
Unexpected files changed: ninguno en el candidato. Trabajo previo del propietario preservado en el workspace original.
Known limitations: primera contratación real pendiente de pago presencial efectivo y cuenta Auth verificada; cero suscripciones/membresías inventadas. Las nueve instituciones publicadas aparecen; las 19 no publicadas y los cuatro tutoriales mantienen su estado.
Evidence: docs/qa/evidence/companies-convenios-education-20260908/. production-live.json y production-*.png; global-production-final.json; production-artifact.json; registry-suite.json; deployment.json; demás comprobantes de la tabla anterior.

Código publicado: 19722ccb65d4e4f9304761a495c333ed9239736e
Despliegue: https://github.com/David14081982/SutiApp-private/actions/runs/34328660484
Sitios comprobados: https://sutiapp.com/ y https://david14081982.github.io/SutiApp-private/.
La evidencia posterior se registra en un commit documental; no modifica el bundle verificado.

## ARCHITECT REVIEW

Task reviewed: H-COMPANIES-CONVENIOS-EDUCATION-UNIFICATION-001
Verdict: APPROVED
What Codex did correctly: reutilizó pantallas y autoridades; completó los tres lectores/escritores administrativos diferenciados y el tenant empresarial; instaló únicamente planes autorizados; aisló el candidato del trabajo previo.
Important findings: no había planes ni contratación real; la decisión expresa del propietario autoriza precios/límites y acreditación presencial. La certificación positiva de contratación usa SQL reversible y browser aislado, indicada como tal.
Problems detected: ninguno pendiente dentro de la H. Los defectos de lookup y extracción de rutas fueron corregidos y la suite completa pasó.
Architecture implications: ConveniosRepository es proyección derivada; entrada empresarial autenticada independiente; Registro técnico actualizado con evidencia.
Source-of-truth implications: autoridades previas conservadas, sin replicar instituciones en companies ni resucitar registros desde mocks.
Security implications: pruebas negativas cross-company, plan vencido, cupo, publicación, lector anónimo y responsables por módulo; controles backend.
Data implications: tres planes nuevos autorizados; filas comerciales históricas reconciliadas. Ningún pago, membresía, suscripción ni contenido comercial ficticio persistido.
Owner decision required: NO.
Recommended next action: detenerse; no iniciar otra H ni activar una empresa sin contratación real.

## RESPONSE TO CODEX

Aprobar y cerrar H-COMPANIES-CONVENIOS-EDUCATION-UNIFICATION-001 con el SHA y evidencia de producción. Registrar únicamente este cierre documental, comprobar su despliegue y la identidad del artefacto ya validado, entregar el resultado al propietario y detenerse. No avanzar otra H, modificar históricos ni crear pagos/membresías ficticias. Esta instrucción no autoriza una continuación de WORK_QUEUE ni sustituye task-orchestrator.

## SUTIAPP ARCHITECT REVIEW

Task: H-COMPANIES-CONVENIOS-EDUCATION-UNIFICATION-001
Verdict: APPROVED
Critical findings: ninguno abierto; limitación operativa de primera contratación documentada.
Source of truth: PASS, Supabase canónico.
Architecture: PASS, proyección derivada y Registry verificado.
Security: PASS, backend y aislamiento comprobados.
Data: PASS, históricos preservados y tres planes autorizados.
Legacy: PASS, sin escrituras ni cálculos Google/financieros.
Owner decision: NO
Next action: entregar SHA/evidencia y detenerse.
Response generated for Codex: YES
