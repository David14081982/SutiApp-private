# H-CONVENIOS-CATEGORIES-001

## PRE-CHANGE AUDIT

Objetivo: permitir al Admin agregar categorías desde las fichas de Convenios, Empresas y Educación y desde Convenios → Catálogos. Corregir el selector limitado a cuatro valores visibles sin una entrada de administración cercana.
Autorización: solicitud del propietario en continuación de la unificación; corregir, verificar y publicar conservando su trabajo previo.
Alcance: app/screens-admin-catalogo.jsx (reutilizar CategoryEditor y catálogo), app/screens-admin-convenios.jsx, app/screens-admin-visual-crud.jsx, app/screens-company-modules.jsx y app/screens-convenios.jsx. Bundle/cachebusters app/bundle.js, SutiApp.html, sw.js sólo regeneración. Este documento, evidencia categories-20260909, scripts/test-convenios-categories*.js/sql, SOURCE_OF_TRUTH, AGENT_CHANGELOG y Registry derivado por componentes/conexiones nuevas.
Fuera de alcance: migraciones/schema/RLS/grants, Auth, repositories/stores compartidos, assets/viewer/Storage, lógica SW, Google/finanzas, categorías laborales, planes, altas de cuentas y limpieza del workspace.
Datos/autoridad: marketplace_categories ya es el catálogo autoritativo compartido por Marketplace/Convenios. Asignaciones originales permanecen en company_benefit_profiles.category_label y companies.category_raw. Educación agrega clasificación opcional en educational_resources.public_details.category_label; mantiene siempre el grupo Educación. Ninguna tabla, copia maestra ni lista hardcode nueva.
Lectores/escritores: MarketplaceRepository y catalogStore existentes; CategoryEditor sobre el mismo writer. Formularios usan writers existentes de cada dominio. Permiso de categoría marketplace.create/update/publish según acción, validado por RLS y enforce_section_row_action; responsables Convenios/Educación pueden seleccionar, pero no reciben poderes para alterar el catálogo global por este cambio.
Hallazgo: cuatro filas activas reales (Electrónica, Compras, Moda, Salud y belleza). Marketplace ya tiene Nueva categoría, pero requiere slug manual y la edición depende de clic derecho. Convenios no se suscribe a la carga de categorías y su pestaña Catálogos sólo contiene segmentación. Educación carece de clasificación opcional.
Preservación: todas las secciones, carruseles, filtros, favoritos, detalle, campos, tabs y CTA existentes. Sólo añadir administración cercana, opción vacía explícita y conservar selección histórica fuera del catálogo activo. El filtro Educación sigue incluyendo todas sus instituciones; categorías específicas también son filtros públicos.
Riesgo: bajo/medio; evitar perder el formulario al crear categoría, evitar elección visual implícita de la primera opción, error visible, duplicados, guardar categoría y después ficha. No renombrar/reclasificar masivamente datos históricos.
Tests: browser 390/1440 con fixtures aislados y código real; browser producción read-only; SQL transaccional ROLLBACK para catálogo/educación/privilegios; build y dependencias directas. Regresión global de imágenes NOT APPLICABLE: no se alteran helpers/repositories compartidos ni infraestructura de imágenes/Auth/routing; componentes visuales focales reutilizan las APIs existentes.
Recovery: backups exactos original/release en C:/tmp/sutiapp-categories-20260909; reversión de fuentes, cero schema modificado y cero datos de prueba persistidos.
Status: PASS.

## SOURCE OF TRUTH / SECURITY

Ampliación previa demostrada por SQL real: el segundo INSERT administrativo falla por marketplace_categories_source_snapshot_hash_source_sheet_so_key, UNIQUE NULLS NOT DISTINCT. Las altas ADMIN_PHASE3 tienen obligatoriamente tres coordenadas de procedencia NULL; el índice trata todas como la misma fila. Añadir migración/recovery 20260909000200_marketplace_category_admin_creation.sql y scripts/prepare-convenios-categories.js. Sustituir únicamente la unicidad de procedencia por un índice único NULLS NOT DISTINCT filtrado a HISTORICAL_IMPORT. Mantener slug único, PK/FK, CHECK de procedencia, RLS, triggers y todos los datos. Recovery restaura el constraint original sólo si no hay más de una alta administrativa; si ya hay nuevas categorías, aborta sin borrar nada. Dry-run forward/tests/savepoint/recovery y hashes completos antes/después obligatorios. SQL histórico es metadata read-only; no se consulta ni modifica Google. La exclusión previa de migraciones queda ampliada únicamente a este defecto.

SAFE: autoridad existente, sin fallback productivo. Catálogos de sindicatos/categorías de empleado siguen independientes. Categorías inactivas no se ofrecen a nuevas selecciones; el valor histórico de una ficha se conserva. Las categorías comerciales se comparten deliberadamente con Marketplace como antes. Etiquetas asignadas conservan su texto histórico al renombrar el catálogo; no hay cascadas implícitas.

Discovery adicional: 20260821000901 intentó retirar un nombre de constraint distinto al real con IF EXISTS y creó marketplace_categories_historical_source_idx. Se conserva ese índice existente, ajustando NULLS NOT DISTINCT para mantener exactamente la protección de origen, y se elimina el constraint real. No se crea un índice duplicado ni se toca marketplace_products. La única fila administrativa actual es Compras; las otras tres son históricas. Recovery restaura también la definición anterior del índice. Protección de slug, CHECK histórico y procedencia auditados sin cambios.
RLS live inspeccionado: lectura enabled o marketplace.read, escritura y triggers granulares para create/update/publish; la empresa no puede administrar categorías globales. Sin cambios de permisos. Migration guardian: PASS tras la ampliación: forward/recuperación exacta en ROLLBACK, constraint residual retirado, protección histórica preservada, cuatro filas intactas.

## Implementación verificada

- CategoryEditor existente reutilizado; nombre y descripción, identificador interno automático, duplicados visibles, error conserva captura, permisos por acción. No DELETE ni borrado histórico nuevo.
- CommercialCategoryField conectado a useCatalogStore: carga/reintento y suscripción real, opción Sin categoría explícita, conserva valor histórico/inactivo y selecciona la categoría recién creada sin cerrar la ficha.
- Convenios → Catálogos muestra la administración comercial; los catálogos laborales siguen separados y sujetos a segmentation.read.
- Admin Empresas, Educación y Panel Empresarial usan el mismo selector. La empresa sólo selecciona categorías y no recibe creación global.
- Educación conserva su categoría general y permite otra clasificación opcional; filtros y detalle público muestran ambas sin duplicar institución.
- Migración 20260909000200 APPLIED / VERIFIED. Se halló un nombre incorrecto en el intento histórico 20260821000901; sólo se corrige marketplace_categories. No se alteró marketplace_products ni sus constraints.

| Verificación | Evidencia | Resultado |
|---|---|---|
| Forward / recuperación exacta | migration-dry-run.json | PASS |
| Aplicación sin cambios de filas | migration-apply.json | PASS, cuatro categorías intactas |
| Escritura real, slug/importación duplicados, permisos, asignaciones | sql.json y test-convenios-categories.sql | PASS, ROLLBACK |
| UI real con escrituras aisladas 390/1440 | browser.json y isolated-*.png | PASS; crear/error/reintentar/duplicado/conservar ficha/guardar Educación/filtros |
| Convenios, Educación y planes con backend real | local-live-regression.json | PASS, sin escrituras comerciales |
| Nueve módulos empresariales | isolated-panel-regression.json | PASS, fixtures sólo browser |
| Build | build-scope.json | Resultado registrado antes de publicar |

Evidencia: docs/qa/evidence/categories-20260909. Publicación y verificación completas, ver cierre.

Límites: las categorías se comparten con Marketplace como antes. El permiso para crear/editar el catálogo sigue siendo el de Marketplace; ser responsable de Convenios o Educación no lo concede automáticamente. Renombrar/desactivar no reescribe etiquetas históricas de las fichas. Recovery aborta si existen nuevas categorías administrativas; jamás las elimina para recuperar la antigua restricción.

## H-CONVENIOS-CATEGORIES-001 RESULT

Status: PASS
Files changed: cinco pantallas focales, bundle/HTML/cachebusters generados, migración/recovery 20260909000200, cuatro scripts focales, gobierno, Registry y evidencia. Diff e297d6940b7a0a8e6f3dfd942699785dbb04ed50.
Source-of-truth verdict: PASS. Catálogo Supabase único existente; asignaciones originales y clasificación educativa en su propia entidad.
Invariant verdict: PASS. Educación conserva agrupación; categorías laborales independientes; históricos intactos; cero mocks productivos.
Build: PASS. 113 módulos publicados; 116 en workspace original con sus cambios previos. Artefacto Pages de 23 archivos; bundle237/worker185.
Tests: PASS. SQL forward/rollback/recovery exacto, rechazo de duplicado histórico y slug, permisos; browser aislado 390/1440; regresión focal pública/Admin y nueve módulos de empresa; producción read-only 390/1440.
Security: PASS. Mismos RLS, grants, Auth y triggers. La empresa no crea/edita categorías globales; responsables mantienen sus permisos originales.
Legacy impact: NOT APPLICABLE para Google/finanzas. Únicamente metadata de procedencia Supabase inspeccionada; unicidad histórica conservada.
Unexpected files changed: ninguno. Comparación contra baseline original: diez archivos preexistentes cambiados dentro del alcance; fuentes anteriores preservadas. Registry derivado actualizado por los componentes/conexiones nuevos.
Known limitations: catálogo compartido; renombrados sin cascada histórica; recovery protegido tras nuevas altas. No se publicaron categorías de ejemplo.
Evidence: migration-dry-run.json, migration-apply.json, sql.json, browser.json, local-live-regression.json, isolated-panel-regression.json, build-scope.json, production-browser.json, production-artifact.json, deployment.json, original-scope.json y capturas correspondientes.

Código publicado: e297d6940b7a0a8e6f3dfd942699785dbb04ed50.
Despliegue: https://github.com/David14081982/SutiApp-private/actions/runs/34334571430 — success.
Producción: https://sutiapp.com/ y https://david14081982.github.io/SutiApp-private/ coinciden byte a byte con HTML, bundle y SW del commit. Browser de producción no escribió datos comerciales. El commit posterior sólo registra evidencia/cierre.

## ARCHITECT REVIEW

Task reviewed: H-CONVENIOS-CATEGORIES-001
Verdict: APPROVED
What Codex did correctly: reutilizó CategoryEditor, catálogo, readers/writers, permisos y UI; encontró y corrigió el bloqueo SQL real, no sólo el selector.
Important findings: el intento histórico de retirar el constraint usaba otro nombre; la unicidad NULLS NOT DISTINCT global bloqueaba una segunda alta administrativa. Se preservó la semántica histórica con el índice existente.
Problems detected: ninguno pendiente en el alcance solicitado.
Architecture implications: dos componentes visuales focales nuevos, sin helpers de infraestructura ni repositorios nuevos; Registry derivado actualizado.
Source-of-truth implications: no duplicación de catálogos ni instituciones; etiquetas históricas conservadas.
Security implications: no elevación de privilegios; SQL negativo con otro principal y guards existentes; categorías globales no editables por empresa.
Data implications: cuatro categorías previas intactas; cero fixtures persistidos; ninguna fila histórica modificada por la migración.
Owner decision required: NO.
Recommended next action: entregar rutas de uso y evidencia; detenerse sin iniciar otra H.

## RESPONSE TO CODEX

Aprobar H-CONVENIOS-CATEGORIES-001. Registrar este cierre documental, comprobar que su despliegue conserva el mismo artefacto probado y explicar al propietario dónde agregar categorías. No modificar datos comerciales ni iniciar otra H. No se avanza WORK_QUEUE ni se atribuye autorización de otra tarea a este reviewer.

## SUTIAPP ARCHITECT REVIEW

Task: H-CONVENIOS-CATEGORIES-001
Verdict: APPROVED
Critical findings: ninguno abierto.
Source of truth: PASS.
Architecture: PASS.
Security: PASS.
Data: PASS.
Legacy: PASS, sin cambios externos/financieros.
Owner decision: NO.
Next action: entregar evidencia e instrucciones de uso y detenerse.
Response generated for Codex: YES.
