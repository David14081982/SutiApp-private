# Registro de decisiones arquitectónicas

| ADR | Decisión | Estado |
|---|---|---|
| ADR-090 | Todo reemplazo de expediente usa `UnifiedDocumentPhase → DocumentRequirementList → DocumentWorkflowRepository`; todo fullscreen de imagen usa el viewer o comportamiento modal compartido con safe-area, cierre por overlay/Escape, foco y scroll restaurables. | Aceptada / ACTIVE |
| ADR-086 | Los productos propios de programas permanecen en `program_catalog_items`; todo `price_cash` histórico no nulo es precio fijo salvo evidencia específica y el writer Admin escribe la misma autoridad mediante RPC. | Aceptada |
| ADR-087 | El plan universal de productos deriva precio, cálculo, calendario y solicitud desde las autoridades vigentes; JUB paga una vez al mes el día 5 y la aprobación queda sólo en Supabase. | Aceptada |
| ADR-085 | La cuenta bancaria es opcional en Depósito; el celular permanece requerido y una cuenta proporcionada conserva validación completa. | Aceptada |
| ADR-082 | Notificaciones y badge derivan sólo eventos reales con visto durable en su autoridad; no existe tabla ni mock de notificaciones. | Aceptada |
| ADR-081 | El depósito de Suti Préstamo usa cuenta/celular Supabase y congela evidencia privada en la alta atómica. | Aceptada |
| ADR-001 | `numero_control` es identificador histórico de negocio. | Aceptada |
| ADR-002 | Email no es identificador de negocio. | Aceptada |
| ADR-003 | Los usuarios pueden existir sin Auth. | Aceptada |
| ADR-004 | Existe una fuente autoritativa por dominio. | Aceptada |
| ADR-005 | No hay fallbacks productivos silenciosos. | Aceptada |
| ADR-006 | Ahorro permanece temporalmente en Google. | Aceptada |
| ADR-007 | Préstamos permanece temporalmente en Google. | Aceptada |
| ADR-008 | Google Sheets no se modifica durante las primeras fases. | Aceptada |
| ADR-009 | La migración será incremental e híbrida. | Aceptada |
| ADR-010 | La futura impersonación conserva `actor_real` y `usuario_contexto`. | Aceptada |
| ADR-011 | La autoridad histórica de afiliados es `Usuarios SUTIAPP.xlsx` proporcionado por el propietario; `numero_control` es su identificador permanente y el orden físico del Excel es autoritativo para esta migración. | Aceptada |
| ADR-012 | `affiliate` es la entidad conceptual única del afiliado; no se crea `profiles` si solo duplica sus datos. | Aceptada |
| ADR-013 | Email histórico raw, email histórico normalizado y email Auth son conceptos distintos; ninguno sustituye `numero_control`. | Aceptada |
| ADR-014 | Identidad de negocio y autorización técnica se separan mediante principal, asignaciones, roles y permisos validados en backend/RLS. | Aceptada |
| ADR-015 | La impersonación es backend, revocable, auditada, con motivo y TTL máximo inicial de 30 minutos; conserva actor y contexto. | Aceptada |
| ADR-016 | Todo dominio migrable deberá contar con trazabilidad Pantalla→dominio→modelo UI→fuente histórica→fuente futura en `DATA_MAPPING.md`. | Aceptada |
| ADR-017 | `numero_control` se almacena como `TEXT / STRING` preservando exactamente el valor histórico; no se convierte ni corrige automáticamente y esta decisión no aprueba todavía su unicidad. | Aceptada |
| ADR-018 | Tras la importación reconciliada 947/947 de H-004, `public.affiliates` es la autoridad productiva de Afiliados; el Excel fijado por hash permanece como procedencia histórica inmutable. | Aceptada |
| ADR-019 | Supabase Auth es la única autoridad de autenticación del afiliado; el contexto se deriva de `auth.uid()` → `affiliates.auth_user_id`, con activación gradual y sin crear cuentas masivas ni contraseñas inventadas. | Aceptada |
| ADR-020 | TopBar, Inicio, Perfil y Credencial consumen una sola proyección en memoria del afiliado autenticado; no usan fallback de identidad, foto o banco local. | Aceptada |
| ADR-021 | Los cuatro dominios institucionales independientes H-007 hacen cutover de Google histórico read-only a Supabase público read-only; Catálogos queda bloqueado hasta separar sus autoridades y semánticas. | Aceptada |
| ADR-022 | Catálogos se separa por subdominio/semántica; se prohíbe una tabla genérica, cargo sindical no equivale a rol técnico y todo catálogo financiero permanece Google legacy. | Aceptada |
| ADR-023 | `app_assets` + Supabase Storage es la autoridad visual de los dominios migrados; categorías bloqueadas se conservan solo como `category_raw`, URLs históricas son procedencia y empresas de prueba no se promueven. | Aceptada |
| ADR-024 | `Convenios2` es la autoridad histórica del directorio público de empresas/convenios; Supabase `companies` + `company_assets` es su autoridad runtime, sin extender la decisión a Marketplace, catálogos, planes o Auth empresarial. | Aceptada |
| ADR-025 | `app_settings` + `app_assets` + Storage es la autoridad única de Ícono e instalación; PWA usa copias de build reproducibles y la escritura browser queda bloqueada hasta Auth administrativa real. | Aceptada |
| ADR-026 | Supabase Auth + `admin_assignments` y permisos explícitos validados por RLS constituyen la autoridad administrativa; H005_TEST es el único admin H-008. | Aceptada |
| ADR-027 | El CRUD visual H-009 escribe exclusivamente las autoridades Supabase existentes, separa origen histórico/administrativo y usa desactivación sin borrado histórico. | Aceptada |
| ADR-028 | La activación gradual exige email Auth confirmado y coincidencia única/elegible; recuperación usa Supabase Auth e impersonación aplica permiso backend, motivo, actor/contexto, no anidamiento y TTL de 30 minutos. | Aceptada |
| ADR-029 | Phase 2 usa Supabase para contenido dinámico administrable, conserva Claude Design en código, inicia Noticias vacía y migra Educación/Tutoriales históricos despublicados con procedencia. | Aceptada |
| ADR-030 | Phase 3 usa Supabase para comercio/Convenios, importa solo categorías inequívocas, conserva textos raw cuando falte reconciliación y aplica membresía empresarial tenant por RLS. | Aceptada |
| ADR-031 | Phase 4 migra únicamente el catálogo histórico de membresías; separa solicitudes con PII/nómina y descompone Programas por autoridad sin tabla genérica. | Aceptada |
| ADR-032 | Phase 5 proyecta en Mi Historial solo operaciones comerciales Supabase y mantiene el historial financiero fuera hasta un adaptador legacy autorizado. | Aceptada |
| ADR-033 | Phase 6 usa Supabase para planes y suscripciones del Portal Empresarial, inicia ambos dominios vacíos y mantiene empresas/membresías existentes sin datos comerciales inventados. | Aceptada |
| ADR-034 | MASTER ASSET EVACUATION establece Supabase Storage como autoridad física de archivos migrados, conserva URLs históricas solo como provenance y exige relación semántica por columna, privacidad por defecto y cero fallback Glide. | Aceptada |
| ADR-035 | MASTER ASSET EVACUATION queda `OPERATIONALLY COMPLETE / HISTORICAL RECOVERY PENDING`; tres originales inaccesibles no bloquean el MASTER PLAN, no se sustituyen y solo se reintentan por orden explícita. | Aceptada |
| ADR-036 | Phase 7 adopta Opción A: Google Sheets + Apps Script conservan autoridad financiera operacional; SutiApp accede solo mediante adaptador backend autenticado y read-only, sin cálculos ni escrituras financieras en navegador. | Aceptada |
| ADR-037 | H-DATA-CUTOVER-001 establece Supabase como autoridad de los catálogos maestros no financieros claramente mapeados, reutiliza assets evacuados y conserva solicitudes/cálculos legacy como frontera separada. | Aceptada |
| ADR-038 | Las solicitudes iniciales de programas, productos y cotizaciones se registran en Supabase `program_requests`; cualquier procesamiento financiero posterior permanece en Google legacy y requiere handoff explícito, sin doble escritura. | Aceptada |
| ADR-039 | El handoff técnico previo queda supersedido: solo una aprobación Admin puede autorizar append idempotente en `Historial de solicitudes`, sujeto a contrato completo y fail-closed. | Supersedida / writer bloqueado |
| ADR-040 | Las propuestas empresariales de pop-ups se registran en Supabase, se revisan por RPC administrativa y una aprobación solo crea un borrador deshabilitado; los demás módulos Admin pendientes conservan clasificación explícita hasta resolver su autoridad. | Aceptada |
| ADR-046 | Noticias activa el primer enforcement de responsabilidad editorial granular por UUID y acción exacta; las demás secciones permanecen `DESIGN_ONLY`. | Aceptada |
| ADR-047 | El patrón granular aprobado se replica a las secciones administrables restantes; Minutas se registra como frontera propia y las 11 definiciones quedan `ENFORCED`. | Aceptada |
| ADR-054 | `home.header.collapsed` es un recurso declarativo administrable con override Supabase y default local versionado para disponibilidad offline; Inicio nunca referencia su archivo directamente. | Aceptada |
| ADR-056 | La activación positiva por correo se difiere hasta URL/dominio/callback productivos; Fase 1 queda `PASS_WITH_DEFERRED_PRODUCTION_ACTIVATION_TEST` y se autoriza Fase 2 únicamente como dry run read-only. | Aceptada |
| ADR-057 | Fase 2 queda `PASS / CLOSED`; el expediente runtime consume exclusivamente Supabase/RLS/Storage y Fase 3 se certifica end-to-end en Chrome real sin writes documentales. | Aceptada |
| ADR-064 | La cotización interactiva usa una RPC autenticada sobre snapshot personalizado y el mismo resolver certificado que Edge; su autoridad Google original fue supersedida por ADR-065. | Aceptada / autoridad supersedida |
| ADR-065 | Supabase es la autoridad única de programas, fondos y reglas financieras; Google `Criterios de fondos` queda sólo como histórico/procedencia sin dual-read ni fallback. | Aceptada / ACTIVE |
| ADR-072 | Se retira del runtime la edición global de textos; `managed_copy_overrides` y sus filas se conservan como histórico inactivo, sin lectores ni writers frontend. | Aceptada / ACTIVE |
| ADR-074 | Una solicitud pendiente o revisada no bloquea otra del mismo afiliado para el mismo programa/producto ni para otro; Ahorro Voluntario y Portafolio de Inversión quedan fuera de esta habilitación. | Aceptada / ACTIVE |
| ADR-075 | El expediente exige versión documental más reciente y objeto privado existente; cada vista firma de nuevo y un reemplazo crea historia enlazada sin mutar el `VERIFIED` anterior. | Aceptada / ACTIVE |
| ADR-076 | Las decisiones administrativas de solicitudes financieras usan una bitácora inmutable separada; `program_requests` conserva estado/solicitud, `notes` conserva la nota del solicitante y el expediente actual nunca se presenta como evidencia histórica enviada. | Aceptada / ACTIVE |
| ADR-077 | Autoservicio documental y Administración usan contratos separados; cada preview privado se autoriza y firma individualmente con auditoría. | Aceptada / ACTIVE |
| ADR-078 | Catálogo, requisitos, herencia, snapshot y UI documental convergen en una plataforma central; `SERVICE` permanece fail-closed hasta existir entidad productiva. | Aceptada / ACTIVE |
| ADR-079 | La confirmación financiera service-only es compatible con el snapshot documental; Mi Historial usa una proyección self mínima y siempre se refresca tras una solicitud confirmada. | Aceptada / ACTIVE |

No se infieren autoridades para los demás dominios. Registrar nuevas decisiones con contexto, opciones, consecuencia, fecha y aprobación; nunca reescribir silenciosamente una ADR aceptada.

### ADR-090 — Contrato global de reemplazo documental y visor de imagen

- **Decisión:** préstamo, membresías, expediente, solicitudes de productos y gates documentales reutilizan el mismo selector por capacidades; un documento reemplazable muestra una sola acción que ofrece únicamente cámara y/o archivo cuando `document_types` lo permite.
- **Integridad:** la UI no elimina la versión vigente. `DocumentWorkflowRepository.upload` conserva el writer transaccional existente, que crea una fila nueva con `replaces_document_id`; un fallo previo al registro deja intacto el documento anterior.
- **Viewer:** `ImageViewer`/`DocumentViewer` son fixed, usan una capa global, safe areas, touch target de 48 px, Escape, bloqueo reversible de scroll y devolución de foco. Tap fuera cierra sólo si el gesto comienza y termina en el overlay; tocar, mover, ampliar o pellizcar la imagen no cierra.
- **Administración:** los workbenches de sólo lectura/revisión no adquieren capacidad de reemplazo. Sus previews móviles permanecen internos y los inspectores reutilizan el comportamiento modal global.
- **Aprobación:** propietario, `H-GLOBAL-DOCUMENT-IMAGE-UX-CONSISTENCY-001`, 2026-08-31.

### ADR-038 — Solicitud inicial Supabase, procesamiento financiero separado

- **Contexto:** los CTA de catálogos ya conectados se deshabilitaban cuando una fase posterior podía tocar finanzas, aunque el primer acto solo registraba intención. El propietario ordenó eliminar esa dependencia y los mensajes técnicos al usuario.
- **Decisión:** `program_requests` es la única autoridad de toda solicitud inicial posterior al corte. El backend deriva `auth.uid() → affiliate_id → numero_control`; el navegador no elige identidad. `program_item_id` o `product_id` identifican exactamente un destino y `company_id` es opcional.
- **Idempotencia:** cada apertura del formulario genera una clave; el backend aplica `UNIQUE(affiliate_id,idempotency_key)` y devuelve el registro existente ante repetición. La UI añade bloqueo síncrono al envío.
- **Finanzas:** una fila puede iniciar como `requires_financial_processing`, pero crearla no calcula ni modifica tasa, saldo, préstamo, amortización, pago o descuento. `financial_processing_status` y `legacy_reference` quedan reservados para un handoff futuro explícito y auditado; no existe doble escritura a Google.
- **Histórico:** `marketplace_*_requests` y `program_benefit_requests` conservan registros anteriores y pueden concluir su workflow previo; sus RPC de alta dejan de estar disponibles para nuevas solicitudes.
- **Aprobación:** propietario, instrucción explícita `PRIORIDAD MASTER PLAN — SOLICITUDES REALES EN SUPABASE` del 2026-08-22.

### ADR-037 — Catálogo por programa sin mezclar transacciones ni finanzas

- **Contexto:** el propietario detectó que Storage contenía assets sin entidad ni cutover, usando `8 Suti Farma` como control, y autorizó una reconciliación masiva de catálogos con UI Claude existente.
- **Decisión:** `program_catalog_items` y `program_catalog_item_assets` son autoridad Supabase de cada catálogo no financiero inequívoco. No se crea una entidad `programs` monolítica: `program_key` delimita consumidores y `source_payload` conserva campos históricos sin grant al browser.
- **Assets:** se reutilizan objetos de MASTER ASSET EVACUATION por hoja/fila/columna/hash. Objetos conservadoramente privados reciben lectura RLS solo cuando están ligados a un producto habilitado; no se copian ni se vuelven públicos.
- **Legacy:** precio de contado puede proyectarse; tasas, crédito, plazo, enganche, pago, amortización, elegibilidad y solicitudes históricas no. La solicitud Supabase se habilita únicamente para Farma, que no tiene writer transaccional histórico separado demostrado.
- **UI:** la navegación Claude permanece en código; Repository entrega las filas. `Disponibles ahora`, cards, detalle, CTA y estados loading/error/empty se conservan. Terrenos dedicado queda `UI_NOT_CONNECTED` porque su geometría hardcodeada no equivale a la hoja.
- **Aprobación:** propietario, instrucción explícita `PRIORIDAD MASTER PLAN — DATA COVERAGE & UI CUTOVER` del 2026-08-22.

### ADR-035 — Cierre operativo con recuperación histórica pendiente

- **Contexto:** 14,477/14,480 URLs únicas fueron recuperadas; no quedan dependencias Glide runtime, columnas sin mapear, objetos faltantes ni huérfanos. `Íconos!B2:B4` ya no es recuperable desde las fuentes o respaldos disponibles.
- **Decisión:** aceptar la tarea como `OPERATIONALLY COMPLETE / HISTORICAL RECOVERY PENDING`, mantener `HISTORICAL_ASSET_RECOVERY_PENDING = 3` y permitir que el MASTER PLAN continúe.
- **Restricciones:** los tres registros permanecen documentados como no recuperados; no se inventan, sustituyen ni usan sus URLs Glide/Firebase como fallback. Una ejecución normal no vuelve a descargar URLs fallidas; únicamente `--retry-failed`, después de recibir originales recuperables, puede reabrirlas.
- **Cierre futuro:** subir los tres originales a Supabase Storage, vincularlos con sus coordenadas históricas, ejecutar `--retry-failed` y reconciliar 14,480/14,480.
- **Aprobación:** propietario, instrucción explícita del 2026-08-22.

### ADR-034 — Evacuación física y semántica de archivos Glide

- **Contexto:** cancelar Glide eliminaría archivos todavía referenciados por el Excel maestro, las 98 hojas de `SutiApp Final` y otras fuentes históricas. Guardar solo la URL histórica no preserva el archivo ni su función.
- **Decisión:** cada referencia identificable se descarga y valida, se deduplica por SHA-256 cuando sea seguro, se almacena físicamente en Supabase Storage y conserva todas sus relaciones de origen/semántica. `source_url` es provenance; runtime usa la relación Supabase. Las columnas con valores parciales también quedan catalogadas.
- **Identidad:** archivos del Excel maestro se vinculan por `affiliate.id` después de una coincidencia exacta e inequívoca de `numero_control` TEXT raw. Una ambigüedad bloquea solo esa fila/archivo.
- **Seguridad:** PII y documentos personales se almacenan en bucket privado con RLS para propietario o admin autorizado. Clasificación incierta usa privado/PENDING, nunca público por inferencia.
- **Legacy:** leer URLs en hojas financieras no cambia autoridad, fórmulas, triggers ni writers. Esos archivos pueden preservarse físicamente, pero permanecen `PENDING_DOMAIN_LINK` y fuera de runtime hasta decisión Phase 7.
- **Consecuencia:** no existe fallback `Supabase → Glide`; un fallo muestra placeholder/error. No se puede cerrar mientras queden dependencias Glide runtime en dominios migrados o columnas de archivos sin mapear.
- **Aprobación:** propietario, instrucción “MASTER ASSET EVACUATION — GLIDE → SUPABASE” del 2026-08-22 y ampliación adjunta obligatoria.

### ADR-033 — Phase 6: portal empresarial sin términos comerciales inventados

- **Contexto:** Phase 3 estableció Auth y membresía tenant para el Panel Empresarial, pero no autorizó planes, precios ni suscripciones. Phase 6 fue autorizada expresamente con aplicación estricta, RLS forzada, cero registros inventados y preservación de empresas, Auth, afiliados, históricos y legacy.
- **Decisión:** `company_portal_plans` y `company_portal_subscriptions` son las autoridades Supabase del catálogo comercial y la suscripción empresarial. Ambas inician vacías. Una empresa sin suscripción conserva el estado explícito `pending`; una membresía técnica no crea ni implica un plan.
- **Seguridad:** H005_TEST administra mediante `company_portal.read/write`; miembros empresariales leen únicamente su tenant; usuarios normales no escriben; RLS queda habilitada y forzada. Las policies administrativas de membresía no permiten autoasignación del cliente.
- **Legacy:** no se leen ni escriben Ahorro, Préstamos, Google Sheets, Apps Script, fórmulas, saldos, amortizaciones o conciliaciones.
- **Consecuencia:** el Portal Empresarial proyecta métricas comerciales reales y muestra configuración pendiente cuando faltan términos autorizados, sin recurrir a `DATA`, mocks o almacenamiento del navegador.
- **Aprobación:** propietario, autorización explícita de `python scripts/apply-phase6.py` del 2026-08-22.

### ADR-032 — Phase 5: operación no financiera sin mezclar historial legacy

- **Contexto:** Mi Historial combinaba `financeStore/localStorage` con `DATA.solicitudes` mock. Phase 3 ya creó solicitudes de beneficio y cotizaciones comerciales reales; las demás hojas de solicitudes contienen PII y, en su mayoría, nómina, financiamiento, fondos o cálculos.
- **Decisión:** `operationsStore` proyecta exclusivamente `marketplace_benefit_requests` y `marketplace_quote_requests` autorizadas por RLS hacia el contrato Claude de Historial/Tracking. Los estados backend derivan el timeline; no se crea configuración local de flujos.
- **Consecuencia:** se retiran mocks productivos de Historial. La UI informa que el historial financiero está pendiente de su sistema legacy y no lo sustituye.
- **Aprobación:** propietario, continuación automática del MASTER PLAN del 2026-08-21.

### ADR-031 — Phase 4: membresías catalogales separadas de nómina y programas

- **Contexto:** `Membresias` contiene seis ofertas claramente mapeadas al diseño; `Solicitudes membresía` contiene 467 transacciones históricas con PII, documentos, estatus y decisiones de suficiencia/descuento por nómina. Las tarjetas llamadas “programas” mezclan navegación, comercio, contenido institucional y legacy financiero.
- **Decisión:** Supabase `membership_offerings` + Storage es la autoridad del catálogo. Solicitudes históricas permanecen Google legacy sin cutover. No se crea `programs` genérica: cada consumidor conserva la autoridad de su dominio y la navegación Claude sigue en código.
- **Seguridad:** lectura pública solo habilitada; Admin H005_TEST escribe por permisos/RLS. Procedencia histórica es inmutable y solo filas `ADMIN_PHASE4` pueden borrarse. No hay writer anónimo ni secretos browser.
- **Consecuencia:** el seed, `localStorage`, data URLs y URLs externas dejan de ser autoridad de Membresías. Los programas financieros no se desbloquean ni se reinterpretan.
- **Aprobación:** propietario, continuación automática del MASTER PLAN del 2026-08-21.

### ADR-030 — Phase 3: comercio real sin inventar catálogo ni rediseñar Claude

- **Contexto:** el propietario autorizó completar Marketplace y Convenios con Supabase, manteniendo Claude Design. Google contiene tres categorías comerciales claras, pero las hojas de subcategorías/productos están vacías y las filas empresariales/presupuestos restantes no demuestran autoridad productiva suficiente.
- **Decisión:** `marketplace_categories`, `marketplace_products`, assets, promociones, favoritos, cotizaciones, solicitudes y membresías empresariales son autoridades separadas en Supabase. Solo se importan las tres categorías inequívocas. Productos, membresías, cotizaciones y solicitudes inician vacíos; texto no reconciliado puede conservarse en `category_raw`/`subcategory_raw` sin crear catálogo falso.
- **Seguridad:** RLS forzada separa afiliado, Admin y empresa destino; un miembro empresarial escribe solo su tenant. H005_TEST conserva permisos administrativos explícitos. No hay escrituras anónimas ni Secret Key en navegador.
- **Legacy:** `Choice`, los catálogos no comerciales, Ahorro, Préstamos, Apps Script, fondos, amortizaciones y cálculos no se migran ni modifican.
- **Consecuencia:** stores locales y `DATA` dejan de ser autoridad comercial. La UI Claude conserva tarjetas, filtros, carruseles, detalle, sheets, tabs y paneles; una ausencia se representa como vacío o pendiente.
- **Aprobación:** propietario, decisión PHASE 3 del 2026-08-21.

### ADR-029 — Phase 2: contenido dinámico sin convertir la UI en base de datos

- **Contexto:** el propietario autorizó Supabase como autoridad productiva para contenido administrable y mantuvo Claude Design como contrato visual/funcional. Noticias carece de fuente histórica inequívoca; H-DATA-001 demostró las hojas `Información educativa` y `Tutoriales`.
- **Decisión:** crear autoridades separadas `news_articles/news_settings`, `educational_resources` y `managed_copy_overrides`. Noticias inicia vacía. Las 32 filas educativas se importan exactas como procedencia, despublicadas, con assets Storage. Menús, rutas, secciones visuales y formularios no se vuelven database-driven.
- **Seguridad:** H005_TEST escribe mediante permisos `news/content` y RLS forzada; usuarios normales solo leen publicado/habilitado; anónimo no escribe; no existe Secret Key en navegador.
- **Legacy:** cuatro tutoriales describen Ahorro, pero solo se migra contenido audiovisual; saldos, solicitudes, fórmulas, triggers y cálculos permanecen Google legacy.
- **Consecuencia:** `DATA`, `adminStore`, `copyStore/localStorage` y URLs Glide dejan de ser autoridades de estos dominios; estados vacío/error/pending preservan la UI.
- **Aprobación:** propietario, decisión PHASE 2 del 2026-08-21.

### ADR-027 — CRUD visual y empresarial sin procedencia inventada

- **Contexto:** H-008 autorizó el principal y RLS, pero solo branding tenía UI de escritura. Banners, popups, empresas y documentos conservaban módulos locales o no tenían editor productivo; sus tablas exigían coordenadas de importación incompatibles con contenido creado directamente por Admin.
- **Decisión:** mantener las autoridades `app_settings`, `app_assets`, `banners`, `popups`, `companies`, `company_assets` e `institutional_documents`. Las filas históricas usan `HISTORICAL_IMPORT`; las nuevas usan `ADMIN_H009` y coordenadas históricas nulas. Empresas/documentos reciben `enabled`; desactivar oculta al público sin borrar. No se crea una tabla genérica de contenido.
- **Seguridad:** grants de escritura por columna, policies por los diez permisos H-008, RLS forzada, Storage por bucket y auditoría trigger. `asset_sources` sigue sin lectura browser. Ningún rol se deriva de cargo, sindicato, puesto o control.
- **Consecuencia:** el panel actual permite crear, editar, reemplazar assets y desactivar los cinco dominios autorizados sin `DATA`, Glide o `localStorage`. Marketplace, planes/Auth empresarial, documentos privados del afiliado y todo legacy financiero permanecen fuera.
- **Aprobación:** propietario, autorización H-009 del 2026-08-21.

### ADR-026 — Autenticación y autorización administrativa H-008

- **Contexto:** el propietario autorizó H-008 y designó exclusivamente a H005_TEST; H005_TEST2 y H005_TEST3 deben seguir como usuarios normales. El gate anterior era estado simulado del navegador y no podía autorizar escrituras.
- **Decisión:** Supabase Auth autentica al principal y `public.admin_assignments`, `has_admin_permission()` y RLS autorizan diez permisos visuales mínimos. La asignación se vincula al `auth_user_id` ya existente de H005_TEST. No se deriva ningún permiso de `cargo`, sindicato, puesto o `numero_control`.
- **Seguridad:** clientes autenticados solo leen su propia asignación y no pueden crearla, editarla ni promoverse. Las escrituras autorizadas en tablas y Storage se verifican con RLS; triggers registran actor, recurso, acción, target, timestamp y resultado exitoso. No hay Secret Key, `service_role` ni contraseña administrativa en frontend o bundle.
- **Consecuencia:** H005_TEST puede administrar los recursos visuales permitidos; H005_TEST2, H005_TEST3 y anónimo quedan denegados por backend. Una identidad puede ser afiliado, admin o ambas y la arquitectura mantiene `actor_real` separado de un futuro `usuario_contexto`. El CRUD avanzado de los otros módulos no forma parte de H-008.
- **Aprobación:** propietario, autorización H-008 y designación de H005_TEST del 2026-08-21.

### ADR-025 — Autoridad única de ícono, instalación y PWA

- **Contexto:** la pantalla administrativa guardaba textos en `localStorage`, cinco imágenes mediante `image-slot` y tenía textos/iconos PWA hardcodeados, mientras H-007.2 ya había creado `app_assets` y Storage. El acceso Admin continúa simulado y no puede autorizar escrituras productivas desde navegador.
- **Decisión:** crear únicamente el singleton mínimo `public.app_settings` para textos y relaciones a assets; reutilizar `brand.pwa.512`, `brand.favicon-pwa-192`, `brand.pwa.apple-touch` y `brand.pwa.maskable-512`, y registrar `brand.institutional-seal`. Las posiciones de instalación 1/2/3 son relaciones nullable y explícitas. Favicon/manifest/PWA se sincronizan desde Supabase mediante un proceso server-side reproducible.
- **Seguridad:** `app_settings` tiene RLS habilitada y forzada, sólo `SELECT` para `anon`/`authenticated`, cero policies/grants cliente de escritura y ningún secreto en frontend. El proceso administrativo local usa `SUPABASE_SECRET_KEY`; la pantalla permanece read-only hasta existir Auth administrativa real y autorización backend/RLS.
- **Consecuencia:** Home, Admin y el sello consumen una única proyección Supabase sin fallback. Las tres pantallas permanecen no configuradas hasta recibir archivos autorizados. La escritura y Storage fueron probados de forma reversible y el estado original se restauró.
- **Aprobación:** propietario, solicitud “Admin → Ícono e instalación” del 2026-08-21.

### ADR-024 — Directorio empresarial real y popups sin reglas inventadas

- **Contexto:** H-007.3 autoriza identificar la fuente empresarial real usando la infraestructura H-007.2. La lectura acotada confirmó 33 filas significativas en `Convenios2`, mientras `Convenios Suti` sólo tiene encabezados y `Empresas Suticompras` conserva una única fila de prueba incompleta.
- **Decisión:** `Convenios2!A1:I46` es la procedencia histórica autoritativa del directorio público mostrado en Convenios. El orden físico y las celdas raw se preservan en el snapshot `41871AE58415B5654F37058BF361350E598B93DD8AFF9EF3BA07BC94ECA4718F`; Supabase `public.companies` y `public.company_assets` son la autoridad runtime. `Imagen` se vincula como `cover`, no como logo; las dos imágenes adicionales de `WEB` se conservan como `gallery`. No se parsean nombres, descuentos, categorías ni beneficios.
- **Límite:** esta autoridad no incluye Marketplace completo, productos, planes, usuarios/Auth de empresa, segmentación o catálogos administrativos. Los tres candidatos de `Promociones` permanecen deshabilitados porque no existen reglas históricas de título, cuerpo, acción, audiencia, vigencia o publicación.
- **Consecuencia:** la UI pública usa `CompaniesRepository` sin `DATA`, stores locales ni URL Glide. Los sistemas financieros y Google legacy quedan intactos.
- **Aprobación:** propietario, instrucción H-007.3 del 2026-08-21.

### ADR-023 — Autoridad visual, deduplicación y bloqueo aislado de Empresas

- **Contexto:** H-007.2 autoriza assets y empresas independientemente de H-007.1, exige Storage reproducible y prohíbe fallback a Glide. La única fila de `Empresas Suticompras` no representa una empresa productiva válida.
- **Decisión:** `public.app_assets` + Storage decide el archivo runtime; `asset_sources` conserva procedencia histórica sin acceso browser. Los buckets se separan por app, empresa y documentos, y el contenido idéntico reutiliza una ruta SHA-256. `category_raw` no se convierte en catálogo. La fila de prueba empresarial no se migra.
- **Consecuencia:** Home y contenido institucional usan Storage sin fallback. Marketplace banners y popups se preservan deshabilitados hasta tener cutover/semántica; Empresas queda bloqueado sin bloquear los demás assets. Favicon/PWA mantiene copia estática necesaria, vinculada por hash/procedencia.
- **Aprobación:** propietario, instrucción H-007.2 del 2026-08-21.

### ADR-022 — Separación catalogal y gate de autoridad

- **Contexto:** `Choice`, `Íconos` y las hojas catalogales agregaban segmentación, configuración, Marketplace, reglas de programa, inversión, pago/cobro y helpers Glide bajo una sola etiqueta.
- **Decisión:** cada grupo recibe exactamente una clasificación H-007.1; no se crea una tabla genérica `catalogs`. Cargo sindical, categoría laboral, rol operativo Glide y permiso técnico permanecen conceptos distintos. Inversión, pago, cobro, nómina, plazo y estados financieros permanecen `FINANCIAL_LEGACY`.
- **Consecuencia:** una tabla solo puede crearse con owner/escritor, autoridad y consumidor reconciliados, sin escritores paralelos ni dependencia financiera. H-007.1 documenta 27 subdominios pero no migra ninguno porque los writers Google siguen desconocidos y los candidatos con consumidor conocido están acoplados a writers locales o filtros financieros.
- **Aprobación:** propietario, instrucción H-007.1 del 2026-08-21.

### ADR-021 — Cutover de contenido institucional H-007

- **Contexto:** H-DATA-001 clasificó cinco dominios `SUPABASE_NOW`. El perfilado bounded confirmó cuatro dominios institucionales independientes y reveló que el agregado “Catálogos de segmentación” mezcla segmentación, catálogos comerciales y estados de pago/cobro.
- **Decisión:** después de reconciliar 60/60 filas significativas, `public.directory_members`, `public.minutes`, `public.institutional_documents` y `public.institutional_programs` son las únicas autoridades productivas de esos cuatro dominios. Google conserva procedencia histórica read-only. Catálogos no se divide ni migra sin una decisión posterior por subdominio.
- **Consecuencia:** los lectores migrados fallan de forma controlada y no vuelven a mocks, `DATA`, `localStorage`, JSON o Google. Las URLs históricas permanecen referencias; no se copian archivos. La tabla informativa de Finanzas excluye expresamente las columnas `T:V` y no altera Ahorro, Préstamos o lógica financiera legacy.
- **Aprobación:** propietario, autorización H-007 del 2026-08-21, incluida la regla de bloquear solo el dominio no preparado y continuar los independientes.

### ADR-020 — Proyección única de identidad para la demo

- **Contexto:** H-006 requiere mostrar la misma fila real en las cuatro áreas prioritarias sin consultas repetidas ni mezclar identidad real con montos o datos locales ficticios.
- **Decisión:** `AffiliateAuth` deriva una proyección in-memory inmediatamente después de `AffiliateRepository.getCurrentAffiliate()`. TopBar, Inicio, Perfil y Credencial sólo consumen esa proyección. La foto local, banco local y valores financieros mock no se presentan como parte del afiliado.
- **Consecuencia:** una falla de Supabase bloquea el shell con el error controlado existente; no hay fallback. Los consumidores de `DATA.user` fuera del alcance quedan `PENDING H-LATER`, y Google legacy permanece intacto.
- **Aprobación:** propietario, autorización H-006 del 2026-08-21.

### ADR-019 — Login real y activación gradual

- **Contexto:** H-005 sustituye el acceso simulado del afiliado por Supabase Auth y valida el circuito con una única cuenta real expresamente controlada por el propietario.
- **Decisión:** Supabase Auth decide sesión y credenciales. `AffiliateRepository.getCurrentAffiliate()` resuelve la identidad de negocio exclusivamente por el principal autenticado y `auth_user_id`; el frontend no selecciona `numero_control`. No se crean en esta H las 904 cuentas elegibles ni se inventan contraseñas.
- **Consecuencia:** los afiliados sin Auth permanecen en `public.affiliates`; `DATA.user` puede seguir alimentando pantallas todavía no migradas, pero nunca autenticación, acceso ni sesión. Recuperación de contraseña, administración e impersonación quedan para sus H autorizadas.
- **Aprobación:** propietario, autorización H-005 y Option A del 2026-08-21.

### ADR-018 — Cutover de Afiliados a Supabase

- **Contexto:** H-004 aplicó la migración versionada e importó el universo aprobado desde `Usuarios SUTIAPP.xlsx`.
- **Decisión:** `public.affiliates` queda como autoridad productiva del dominio Afiliados después de reconciliar 947 fuente = 947 destino y fingerprint completo. El Excel conserva procedencia, hash y orden histórico; no opera como fallback ni segundo escritor.
- **Consecuencia:** ninguna pantalla migrada podrá volver a `DATA.user`, mocks o `localStorage`. Las pantallas actuales siguen siendo prototipo no migrado hasta su H correspondiente. `numero_control` continúa nullable, no unique y TEXT; Auth continúa opcional.
- **Aprobación:** propietario, instrucción H-004 del 2026-08-21.

## Resoluciones H-001 — 2026-08-21

### ADR-011 — Fuente histórica de afiliados

- **Contexto:** el prototipo presenta `DATA.user`, viewer, snapshots y `localStorage`, ninguno productivo.
- **Decisión:** la autoridad de negocio es `Usuarios SUTIAPP.xlsx`, hoja `Usuarios`, SHA-256 `F4BA18ABE82B148ED65737DB16074303627F96D37FA6F9F025E0A10649BD9591`; `Número de control` es el identificador histórico permanente. El orden físico actual del Excel es el orden autoritativo para esta migración.
- **Consecuencia:** `SutiApp Final`, Google Sheets, CSVs anteriores, mocks, frontend y archivos de diseño quedan clasificados como no autoritativos para el padrón. En email duplicado, el primer registro por ordinal del Excel conserva candidatura Auth y los posteriores no, sin eliminar ni alterar afiliados.
- **Aprobación:** propietario, instrucción final H-002 del 2026-08-21 que sustituye las designaciones previas de SutiApp/Glide y CSV.

### ADR-012 — Entidad única `affiliate`

- **Contexto:** separar `users` y `profiles` duplicaría hoy una misma identidad y ciclo de vida.
- **Decisión:** una entidad conceptual `affiliate`, con UUID interno, `numero_control` histórico, emails separados, vínculo Auth opcional, elegibilidad, estado, procedencia y timestamps. La afirmación previa de unicidad queda sustituida expresamente por ADR-017: no se aprueba `UNIQUE(numero_control)` mientras existan anomalías históricas.
- **Consecuencia:** un afiliado puede existir sin Auth; el nombre físico final se decidirá durante diseño de schema autorizado.
- **Aprobación:** propietario, instrucción H-002 del 2026-08-21.

### ADR-013 — Semántica de email

- **Contexto:** el email histórico puede estar vacío, ser inválido, duplicado o diferir del email de credencial.
- **Decisión:** preservar `historical_email_raw`, derivar `historical_email_normalized` y mantener el email Auth como credencial separada. En duplicados, solo el primer registro según orden autoritativo demostrado puede ser candidato Auth.
- **Consecuencia:** no inventar emails, eliminar afiliados ni sobrescribir el histórico; el cambio de credencial requiere un procedimiento futuro autorizado y verificable.
- **Aprobación:** propietario, instrucción H-002 del 2026-08-21.

### ADR-014 — Principales y autorización técnica

- **Contexto:** afiliado, administrador, miembro de empresa, cargo, puesto, sindicato y rol técnico no son equivalentes.
- **Decisión:** principal autenticado→asignaciones técnicas/organizacionales→roles→permisos; validación backend/RLS.
- **Consecuencia:** una persona puede acumular relaciones sin duplicarse; cargo, sindicato, puesto, viewer, UI y `localStorage` no conceden permisos técnicos.
- **Aprobación:** propietario, instrucción H-002 del 2026-08-21.

### ADR-015 — Impersonación administrativa

- **Contexto:** soporte administrativo sin conocer contraseña ni confundir al administrador con el afiliado.
- **Decisión:** autorización backend con permiso específico, motivo obligatorio, revocación, auditoría completa y TTL máximo inicial de 30 minutos; renovar exige nueva autorización.
- **Consecuencia:** se prohíben cambios de credencial, Auth, roles, permisos, auditoría, históricos, identidad principal, `numero_control`, impersonación anidada y cualquier operación financiera sensible no auditada por módulo. La arquitectura permitirá step-up/MFA futuro.
- **Aprobación:** propietario, instrucción H-002 del 2026-08-21.

### ADR-016 — Data mapping obligatorio

- **Contexto:** migrar una pantalla sin trazar su fuente real crea autoridades implícitas y fallbacks.
- **Decisión:** mantener `DATA_MAPPING.md` como gate previo por dominio, sin convertir H-002 en el mapeo total de la app.
- **Consecuencia:** ninguna migración general avanza sin lectores, escritores, columnas, fuente futura, riesgo y dependencia legacy documentados.
- **Aprobación:** propietario, instrucción H-002 del 2026-08-21.

### ADR-017 — Tipo y preservación de `numero_control`

- **Contexto:** H-002 confirmó que el campo es un identificador de negocio y contiene vacíos, duplicados y valores textuales/no numéricos.
- **Decisión:** almacenar `numero_control` como `TEXT / STRING` y preservar exactamente el raw histórico. Se prohíbe convertirlo a número, retirar ceros iniciales, eliminar caracteres, expandir notación o corregirlo por iniciativa del sistema.
- **Consecuencia:** los tres valores no numéricos siguen siendo representables. Esta decisión no autoriza `UNIQUE(numero_control)` ni permite inventar valores para las nueve filas vacías; la identidad interna futura usa UUID.
- **Aprobación:** propietario, instrucción H-003 del 2026-08-21.

### ADR-028 — Activación gradual, recuperación e impersonación operativa

- **Contexto:** el MASTER COMPLETION PLAN autorizó completar Phase 1 reutilizando H-005/H-008, sin aprovisionamiento masivo ni permisos derivados de datos laborales.
- **Decisión:** la activación autoservicio requiere principal Supabase Auth con email confirmado y una coincidencia única `eligible` contra `historical_email_normalized`; recuperación usa exclusivamente Supabase Auth. La impersonación usa permiso backend `affiliates.impersonate`, motivo obligatorio, sesión no anidable, cierre explícito y TTL máximo de 30 minutos.
- **Consecuencia:** los 947 afiliados siguen existiendo con o sin Auth; `numero_control` nunca es credencial. `actor_real_auth_user_id` y `usuario_contexto_affiliate_id` permanecen separados en auditoría. Solo H005_TEST recibe los dos permisos de identidad; H005_TEST2/3 continúan normales.
- **Aprobación:** propietario, autorización de ejecución continua del MASTER COMPLETION PLAN del 2026-08-21.
### ADR-036 — Google legacy como autoridad operacional

- **Decisión:** Ahorro, Préstamos, políticas, tasas, plazos, elegibilidad, amortizaciones, saldos, pagos y conciliaciones permanecen en Google legacy. No se autoriza migración financiera a Supabase en Phase 7.
- **Frontera:** el browser invoca una Edge Function autenticada. La función deriva el afiliado efectivo y su `numero_control`; rechaza selectores de identidad del payload y llama al Apps Script privado con secreto server-side.
- **Operaciones autorizadas:** `overview` y `quote`, ambas de solo lectura. Nuevas solicitudes/escrituras siguen bloqueadas hasta demostrar writer, trigger, autorización, conciliación y prevención de doble escritura.
- **Fallo:** se muestra `PENDING/ERROR`; nunca se usa `DATA`, seed, JSON, `localStorage`, caché persistente o fórmula local.
- **ADR-039 supersedida — corrección de frontera 2026-08-22:** crear o consultar una solicitud nunca invoca Google. La aprobación administrativa explícita es el único evento que puede autorizar un append de una fila en `Historial de solicitudes`. `SutiApp Financial Handoff` puede conservar la idempotencia y el resultado técnico por `program_request_id`, pero no sustituye la fila legacy.
- **Writer permitido:** bajo `LockService`, verificar export previo, validar encabezados exactos, localizar la siguiente fila disponible dentro del lock, escribir un payload completo en las columnas existentes y registrar fila/timestamp/resultado. Solo `Historial de solicitudes`; append-only; ninguna fila histórica, columna, fórmula, encabezado, hoja, trigger o proceso posterior puede cambiar.
- **Gate de activación:** D Proceso, M afiliación, Y estado inicial, documentos obligatorios por tipo y semántica exacta de plazo deben demostrarse antes de activar el writer. Un campo `UNKNOWN` bloquea la exportación; no se rellena con inferencias históricas.
- **Estados equivalentes:** `status` + `financial_processing_status` deben distinguir revisión pendiente, aprobada pendiente de exportar, aprobada exportada y fallo de exportación. Supabase no marca exportado hasta confirmar Google; un fallo conserva la solicitud y admite retry idempotente.
- **Recovery:** deshabilitar el endpoint/secret detiene nuevos exports sin borrar solicitudes Supabase ni filas ya confirmadas. El UUID permite recuperar un timeout consultando el registro técnico antes de cualquier nuevo append.
### ADR-040 — Propuestas empresariales y clasificación estricta de Admin

- **Contexto:** el contrato Claude permite que empresas con plan adecuado propongan pop-ups y que Admin los apruebe o rechace. El prototipo almacenaba la cola localmente, mientras otros módulos Admin mezclaban autoridades no aprobadas.
- **Decisión:** `company_popup_proposals` es autoridad Supabase tenant-scoped. La revisión exige permiso backend y una aprobación crea `popups.enabled=false`, separando revisión de publicación. Ningún módulo unresolved usa store, mock o código como autoridad sustituta.
- **Seguridad/recuperación:** RLS forzada, membresía/plan/asset validados, RPC auditada y rollback condicionado a ausencia de aprobaciones.
- **Consecuencia:** Aprobaciones es productivo; Finanzas es híbrido; Fondos queda en la frontera Phase 7; diez módulos requieren decisiones de autoridad o arquitectura enumeradas en `ADMIN_REMAINING_MODULES_REPORT.md`.

### ADR-041 — Cutover de las decisiones Admin agrupadas

- **Contexto:** el propietario aprobó las cuatro recomendaciones agrupadas posteriores a ADR-040: segmentación Supabase; roles técnicos Supabase; frontera híbrida financiera; contenido Supabase para cuatro pantallas de Sindicato; estructura Claude versionada en código.
- **Decisión:** `segmentation_catalog_entries` y asignaciones de tags son autoridad no financiera; Auth → asignación → rol → permisos → RLS/RPC es autoridad técnica; catálogo/presentación/workflows no financieros viven en Supabase; las cuatro pantallas restantes de Sindicato inician vacías; navegación, menús, formularios y estructura permanecen en código con visibilidad backend. Convenios usa empresas, perfiles, beneficios y banners Supabase.
- **Seguridad:** H005_TEST es el único principal inicial; TEST2/3 continúan normales. Se prohíben autoasignación, mutación del rol de sistema y eliminación del último principal. Segmentación nunca concede permisos. RLS queda forzada y la auditoría separa actor y objetivo.
- **Legacy:** tasas, saldos, depósitos, elegibilidad, amortización, pagos, cálculos, conciliación y Apps Script financiero no se modifican y permanecen Phase 7.
- **Consecuencia:** los diez módulos quedan productivos; `OWNER_DECISION_REQUIRED` y “EN PREPARACIÓN” quedan en cero. Fondos y reglas conserva `BLOCKED_FINANCIAL_LEGACY`.
- **Aprobación:** propietario, aprobación explícita de las cuatro recomendaciones del 2026-08-22.

### ADR-042 — Contrato visual StepSimulatorV2 para Suti Préstamo

- **Contexto:** el propietario autorizó sustituir exclusivamente la presentación del paso Monto por el diseño `StepSimulatorV2`; el harness adjunto contenía fórmulas, límites, plazos, fondo y nómina de demostración no autoritativos.
- **Decisión:** `StepSimulatorV2` es el contrato visual vigente. Solo presenta un `FinancialSimulationResult` completo recibido por la frontera Phase 7; no calcula, completa ni reconstruye valores. Soporta `LOADING`, `READY`, `NOT_ELIGIBLE`, `ERROR` y `UNAVAILABLE`. Impacto y talón conservaron estado desactivado hasta la autorización posterior de ADR-050.
- **Gasto administrativo:** la UI soporta la regla confirmada de `$15 × número de pagos`, pero el total y el valor por pago deben llegar en el resultado autoritativo; esta decisión no asigna el cálculo a SutiApp ni cambia Google.
- **Consecuencia:** Monto cambia de contrato visual; Destino, Documentos, Resumen y el flujo posterior se preservan. Una respuesta incompleta falla de forma controlada, sin cálculo local, `localStorage`, mock o fallback.
- **Aprobación:** propietario, instrucción explícita de rediseño quirúrgico del 2026-08-22.

### ADR-043 — Autoridad mutable del expediente financiero del afiliado

- **Contexto:** `CHOICE Categoría de Empleado (pantalla inicio)` y `CHOICE SINDICATO (pantalla inicio)` son semillas iniciales, pero sindicato, categoría, tipo y estatus cambian durante la vida laboral. Los raw previamente importados no representan este contrato financiero.
- **Decisión:** el Excel exacto SHA-256 `F4BA18ABE82B148ED65737DB16074303627F96D37FA6F9F025E0A10649BD9591` puede sembrar una sola vez columnas 58/60. Después, `public.affiliates` es la autoridad productiva actual, editable en la superficie Admin existente mediante `affiliates.write` + RPC/RLS + auditoría por campo y control de concurrencia. No existe sync de regreso al Excel.
- **Derivados (actualizado por ADR-065):** fondo, tasa, plazo máximo, monto máximo y resultado nunca son atributos permanentes del afiliado. Se consultan de nuevo con el perfil vigente más el batch financiero Supabase activo.
- **Excepción de sesión autorizada (2026-08-25, origen actualizado por ADR-065):** `financial_session_snapshots` puede conservar durante un máximo absoluto de 15 minutos únicamente reglas Supabase ya filtradas para el afiliado efectivo. Es una copia `DERIVED`, temporal, personalizada, expirable y generada server-side; no es autoridad financiera ni fallback.
- **Binding e invalidación:** cada snapshot liga `affiliate_id`, actor Auth real, sesión de impersonación cuando existe, `financial_profile_version`, fingerprint completo del perfil, fingerprint del batch Supabase usado —incluida visibilidad—, fingerprint de `loan_term_policy` y versión del contrato de cálculo. TTL vencido, perfil/contexto/política/batch distintos o invalidación explícita impiden su uso aunque la fila siga presente.
- **Cálculo y confirmación (actualizado por ADR-064/065):** monto/fondo/plazo interactivos se resuelven por RPC autenticada contra el snapshot mediante el resolver certificado compartido con Edge, con cero consultas Google, cero llamadas Edge y cero fórmulas frontend. Confirmar vuelve a leer perfil, criterios Supabase y política, usa el mismo resolver y crea `program_requests` en un único flujo backend. Un cambio devuelve `409 CONDITIONS_CHANGED`, invalida la sesión y nunca confirma condiciones nuevas automáticamente.
- **Persistencia y seguridad:** RLS está habilitada y forzada; browser tiene cero lectura/escritura directa y sólo Edge/service role administra filas. La RPC autenticada puede leer internamente una fila propia después de validar todo el contexto, sin grant de tabla. La solicitud creada conserva su propio `financial_submission_snapshot` inmutable y no depende del snapshot de sesión. La recuperación puede retirar el caché sólo mientras no destruya historia contractual.
- **Histórico (origen actualizado por ADR-065):** cada solicitud financiera conserva un snapshot inmutable del perfil al solicitar y exige un snapshot completo de los criterios Supabase vigentes al aprobar, incluida regla/versión de gasto administrativo. Una edición posterior no cambia solicitudes previas.
- **Seguridad/recuperación:** segmentación laboral nunca concede permisos; los writers se pueden revocar sin borrar perfiles, auditoría ni snapshots. La aprobación común queda bloqueada si falta snapshot.
- **Aprobación:** propietario, corrección crítica del 2026-08-22 y `OWNER DECISION — AUTHORIZE TEMPORARY PERSONALIZED FINANCIAL SNAPSHOT`, 2026-08-25.

### ADR-044 — Writer final append-only de préstamo aprobado

- **Decisión:** una aprobación Admin con `program_requests.write` + `workflow.write` congela el payload A:AL y habilita el único write Google: append de una fila en `Historial de solicitudes`.
- **Idempotencia/recuperación:** Supabase serializa `ready_for_handoff → in_progress → handed_off|failed`; Apps Script usa `LockService` y reserva UUID/hash/fila en `SutiApp Financial Handoff` antes del append para recuperar timeouts sin duplicar.
- **Seguridad:** Edge/service-only; JWT y CORS vigentes; documentos permanecen privados y se proyectan como referencias opacas UUID+SHA, no URLs públicas. Proceso 3 falla cerrado sin documentos de aval autoritativos.
- **Límite:** `handed_off` solo tras read-back exacto. No amortización, pagos, conciliación, estados posteriores, triggers ni cambios a `Criterios de fondos`.
- **Validación:** A–J aislada PASS; Auth/RLS productivo negativo PASS y 0 Google writes. El append productivo requiere una solicitud controlada autorizada que pueda permanecer en el histórico.
- **Aprobación:** propietario, instrucción `FINAL APPROVED LOAN EXPORT WRITER` del 2026-08-23.

### ADR-045 — Responsabilidad editorial granular fail-closed

- **Contexto:** la migración local `20260823000200` mezclaba responsabilidad con autorización técnica, persistía email, convertía cualquier capacidad en `.write`, no separaba recursos compartidos y tenía recovery incompleto.
- **Decisión:** conservar `has_admin_permission` como autoridad técnica independiente y modelar responsabilidad con UUID durable de Auth + sección + acción exacta. Email sólo resuelve un usuario confirmado; no se almacena como autoridad. Autoasignación queda prohibida y todo cambio exige `authorization.write` backend con auditoría del actor real.
- **Fronteras:** Educación y Tutoriales se discriminan por `resource_kind`; Empresas mantiene ficha/assets base y Convenios mantiene perfiles/beneficios/audiencia con lectura de empresa. Publicar, ordenar y assets son capacidades separadas de update; borrar conserva la protección por origen.
- **Activación:** toda sección nace `DESIGN_ONLY`. Ninguna asignación tiene efecto hasta que una migración específica sustituya policies, valide cambios `OLD/NEW`, aísle Storage, conecte el contexto Admin y pase pruebas Admin/responsable/normal/anónimo. La foundation no se despliega sola.
- **Recovery:** el fundamento es aditivo y reversible; cada enforcement futuro debe restaurar exactamente policies, grants y triggers sustituidos.
- **Aprobación:** solicitud maestra de remediación y seguridad del propietario del 2026-08-23; despliegue de ownership todavía no autorizado en este corte.

### ADR-046 — Piloto de responsabilidad granular en Noticias

- **Contexto:** el propietario autorizó continuar después del corte de seguridad aprobado y exigió un piloto completo, backend/RLS real, limitado a Noticias.
- **Decisión:** desplegar la foundation y marcar únicamente `news` como `ENFORCED`. El principal H005_TEST resuelve email confirmado a UUID y asigna acciones independientes; el responsable no recibe roles técnicos ni acceso a otros módulos. Policies por operación, triggers `OLD/NEW`, rutas Storage por usuario y el contexto Admin son las barreras reales.
- **Revocación y auditoría:** asignar/revocar exige `authorization.write`, prohíbe autoescalación, registra actor real y tiene efecto en solicitudes posteriores y tras nueva sesión. El frontend sólo refleja el contexto backend.
- **Históricos:** `record_origin` no cambia; borrar requiere acción exacta y conserva el límite administrativo previo. La prueba no crea ni elimina históricos.
- **Recovery:** `00502 → 00501 → 00500 → 00400` restaura las policies Phase 2 y elimina foundation/enforcement sin DML; la cadena completa fue validada en una transacción con `ROLLBACK`.
- **Límite:** las otras nueve secciones permanecen `DESIGN_ONLY`; esta decisión no las activa ni modifica Google, Ahorro, Préstamos, fórmulas, triggers financieros o conciliaciones.
- **Aprobación:** instrucción `SECTION OWNERSHIP PILOT ENFORCEMENT` del propietario, 2026-08-23.
## ADR-081 — Depósito bancario obligatorio e inmutable en Suti Préstamo

La obligatoriedad bancaria de esta decisión queda sustituida únicamente por ADR-085. Autoridad, seguridad, validación de cuentas proporcionadas, celular, snapshot privado y atomicidad permanecen vigentes.

- **UX:** el wizard productivo queda `Monto → Depósito → Documentos → Resumen`. “Destino” y su nota libre dejan de formar parte del flujo; el afiliado selecciona una cuenta registrada o captura banco, tarjeta y CLABE, confirma el celular y revisa exclusivamente valores enmascarados.
- **Autoridad bancaria:** `affiliate_bank_accounts` sigue siendo la única autoridad mutable. `card_number` se agrega separado de `account_number`; el titular se deriva server-side del afiliado efectivo, la selección no cambia `is_primary` y toda escritura usa RPC autenticada/auditada.
- **Celular:** `affiliates.notification_phone` conserva el valor actual confirmado. `phone_raw` no cambia y sólo puede presentarse como sugerencia histórica explícita.
- **Solicitud:** `loan_request_deposit_snapshots` congela banco, titular, tarjeta, CLABE y celular dentro de la misma transacción service-only que crea `program_requests`. Es evidencia privada, sin acceso browser e inmutable; `financial_submission_snapshot` y la auditoría conservan sólo máscaras/últimos cuatro.
- **Seguridad:** la cuenta debe pertenecer al afiliado efectivo y seguir completa al confirmar. RLS/RPC niegan lectura/escritura cruzada y anónima; no hay `service_role` en frontend, fallback, mock, estado local autoritativo ni log de datos completos.
- **Legacy:** no cambian elegibilidad, 146 reglas, 35 fondos, 3 programas, tasas, fórmulas, amortización, conciliación, Google ni Apps Script. El handoff posterior a aprobación mantiene su frontera protegida.
- **Recovery:** `20260830000500_loan_deposit_step_recovery.sql` sólo revierte si no existe historia nueva de depósito/tarjeta/celular; de otro modo falla cerrado y preserva datos.
- **Aprobación:** `H-LOAN-DEPOSIT-STEP-001`, instrucción quirúrgica y autorización explícita de migración, despliegue Edge, E2E, commit y push, propietario, 2026-08-30.

## ADR-085 — Cuenta bancaria opcional en Depósito de Suti Préstamo

- **Decisión owner:** Banco, número de tarjeta bancaria y CLABE interbancaria no bloquean avanzar ni confirmar. El celular válido para notificaciones continúa requerido.
- **Cuenta proporcionada:** guardar o elegir una cuenta conserva sin relajación banco, titular server-side, tarjeta de 16 dígitos, CLABE con checksum, ownership y auditoría de ADR-081. Nunca se persiste una cuenta parcial.
- **Solicitud sin cuenta:** el writer service-only crea atómicamente `program_requests` y `loan_request_deposit_snapshots` con `source_bank_account_id`, banco, titular, tarjeta y CLABE en `NULL`; celular permanece presente. La proyección sólo expone `NULL` y máscara telefónica.
- **Autoridad y seguridad:** no se crea otra fuente. `affiliate_bank_accounts` sigue siendo la única autoridad bancaria; RLS, autoservicio efectivo, anónimo/cross-user denegados y cero secretos frontend permanecen.
- **Recovery:** `20260831000300_optional_loan_deposit_account_recovery.sql` restaura la obligatoriedad sólo mientras no exista historia con cuenta omitida; después aborta sin borrar ni reinterpretar solicitudes.
- **Aprobación:** `H-LOAN-DEPOSIT-OPTIONAL-BANK-001`, instrucción explícita del propietario, 2026-08-31.

## ADR-082 — Notificaciones derivadas y acuse durable en la autoridad

- **Autoridad:** no se crea tabla de notificaciones. El único aviso activo se deriva de `program_requests` para cotizaciones Marketplace posteriores al corte; `marketplace_quote_requests` permanece histórico y `DATA.notifs` deja de existir.
- **Lectura:** `list_self_marketplace_quote_notifications()` deriva el afiliado efectivo sin selector cliente y proyecta sólo folio, destino, estado, respuesta, fechas y `seen_at`. El `SELECT` directo sobre `program_requests` continúa revocado.
- **Escritura:** `mark_marketplace_quote_seen` es idempotente, acepta únicamente una cotización propia `approved` y conserva el writer del histórico previo. Cada nueva respuesta pone `seen_at=NULL`, por lo que el badge reaparece sólo ante un evento backend nuevo.
- **Cobertura:** cotización solicitada se muestra como estado real informativo y cotización respondida como evento leído/no leído. Requests generales, workflow/tracking, documentos, membresías, programas y beneficios no emiten avisos hasta tener contrato durable de evento/visto en su autoridad.
- **Seguridad y UI:** anónimo/cross-user denegados; RLS forzada permanece; cero `service_role` browser. Se preservan header, campana, badge, lista, tarjetas, navegación y responsive sin rediseño.
- **Recovery:** el lector puede retirarse sin datos. La columna `seen_at` sólo puede retirarse sin acuses o después de backup explícito; el recovery falla cerrado si ya existe historia.
- **Aprobación:** `H-NOTIFICATIONS-AUTHORITY-CUTOVER-001`, migración/E2E/commit/push solicitados explícitamente por el propietario, 2026-08-31.

## ADR-047 — Rollout masivo de responsabilidad granular por sección

- **Decisión:** reutilizar sin nueva arquitectura el modelo UUID + `section_key` + acción exacta de ADR-046 en Educación, Tutoriales, Empresas, Convenios, Banners, Popups, Documentos, Minutas, Programas y Marketplace.
- **Fronteras:** Educación ≠ Tutoriales; Empresas ≠ Convenios; Banners ≠ Popups; Documentos ≠ Minutas. Marketplace cubre sólo catálogo/productos/promociones/assets y no solicitudes, cotizaciones ni finanzas.
- **Seguridad:** RLS más trigger `OLD/NEW`, auditoría por acción, revocación inmediata, rutas de assets `<section>/<auth.uid()>/*` y denegación cruzada. Convenios no recibe `assets`.
- **Borrado:** filas existentes y relaciones sin origen previo se clasifican `HISTORICAL_IMPORT`; sólo orígenes administrativos explícitos son eliminables por responsable. Recovery conserva columnas/orígenes para no destruir procedencia posterior.
- **Activación:** 11 `ENFORCED`, cero `DESIGN_ONLY`; Minutas se añadió porque ya era una autoridad Supabase independiente omitida en el inventario inicial.
- **Exclusiones:** Google legacy, Apps Script, Finanzas, criterios de fondos y datos históricos: `NO INTERACTION`.

### ADR-048 — Centro de exportación operativa Admin

- **Contexto:** el propietario solicitó XLSX/CSV por dominio sin convertir el navegador en un selector irrestricto de Supabase ni confundir exportación con backup.
- **Decisión:** una Edge Function mantiene el registro explícito de dominios, tablas, columnas y filtros. El rol principal recibe `data_exports.read`; los responsables requieren una acción `export` independiente y sólo sobre su sección. Afiliados, solicitudes, membresías, catálogo maestro y auditoría permanecen globales.
- **PII/seguridad:** el padrón puede incluir PII autorizada bajo permiso global y aviso visible; se excluyen Auth, secretos, firmas, tokens, payloads y metadatos Storage. Límite 20,000, protección contra fórmulas, origen/JWT, descarga `no-store` y auditoría metadata-only.
- **Backup:** XLSX/CSV es una proyección temporal sin persistencia. Recuperación técnica sigue exclusivamente por dump/CLI/SQL.
- **Legacy:** `program_requests` puede proyectarse desde Supabase; no se consulta ni modifica Google, Apps Script, fórmulas, cálculos o conciliaciones.
- **Aprobación:** propietario, autorización explícita `AUTORIZACIÓN DEL PROPIETARIO — ADMIN DATA EXPORT CENTER`, 2026-08-23.
- **Estado:** `ACTIVE`. Migración y Edge desplegadas. Matriz live confirma Super Admin, responsable sin/con `news.export`, aislamiento cross-domain, usuario normal/anónimo, revocación, XLSX, CSV, filtros, conteo y auditoría. Cero grants automáticos y cleanup exacto.

# ADR-049 — Dashboard canónico Tu Sindicato y assets relacionales

- **Decisión:** `app/union-screen-registry.js` es el registro estructural único de las nueve experiencias visibles. Home y Admin lo consumen sin duplicar listas. El registro no contiene contenido de negocio ni sustituye ninguna autoridad Supabase.
- **Rutas autoritativas:** Comité → `directory_members`; Normas/Formatos → `institutional_documents` filtrado; Minutas → `minutes`; Finanzas informativa → `institutional_programs`; Convenios → pantalla/repositorios reales de empresas y beneficios; las tres pantallas restantes → `union_screen_content` + `union_content_blocks`.
- **Comité:** reutiliza el CRUD visual bajo la frontera de ownership `documents`, con origen histórico inmutable, publicación, orden y fotos por `app_assets`/Storage. No se crea un segundo sistema de permisos.
- **Assets union:** cabecera y bloques guardan UUID (`header_asset_id`/`asset_id`); se prohíben `image-slot`, `.image-slots.state.json`, `localStorage`, `FileReader.dataUrl` y URLs locales como autoridad.
- **Emergencias:** `OBSOLETE`; no existe ruta ni consumidor frontend verificable. Se retira del dashboard canónico sin borrar filas ni evidencia.
- **Despliegue:** `20260823000800` aplicada con autorización explícita del propietario el 2026-08-23. Matriz reversible de RLS, CRUD, procedencia, Storage y browser real en `PASS`; fixtures eliminados y 30/30 filas históricas preservadas.

## ADR-050 — Autoridad de nómina declarada e impacto informativo

- **Contexto:** el contrato Claude de Suti Préstamo contiene “Impacto en tu quincena” y “Tu talón de pago”, pero su harness usaba `DATA`, `nominaStore` y persistencia local de demostración. El propietario autorizó explícitamente el 2026-08-24 una autoridad de nómina declarada en Supabase y el 30% sólo informativo.
- **Decisión:** `affiliate_payroll_declarations` conserva exclusivamente percepciones y deducciones quincenales capturadas por el afiliado. No representa un talón oficial, no almacena el documento y no sustituye Google, Apps Script, reglas financieras ni un sistema de nómina.
- **Cálculo derivado:** `get_current_declared_payroll_impact(payment)` se ejecuta server-side después de que Google resuelve el pago vigente. Devuelve neto declarado, remanente, porcentajes de barra y comparación con 30%. La UI sólo formatea y representa esos valores.
- **Límite del 30%:** es una referencia visual informativa aportada por decisión del propietario. No concede ni deniega elegibilidad, aprobación, export, suficiencia, descuento de nómina, saldo, amortización o conciliación.
- **Seguridad:** tablas sin acceso directo; RLS forzada; RPC autenticadas; `auth.uid()` se vincula a `affiliates`; edición durante impersonación denegada; actor real auditado; control de versión evita sobrescritura.
- **Recuperación:** la migración es removible únicamente cuando no existan declaraciones. Si existen, el recovery falla cerrado y exige export/backup antes de eliminar la autoridad.

## ADR-051 — Plazos flexibles y solicitud asistida de préstamo (autoridad supersedida por ADR-065)

- **Contexto:** el propietario ordenó las tarjetas 6/12/18/24/“Otro” del diseño aprobado y autorizó que cualquier administrador activo tramite un préstamo para un afiliado, especialmente en atención a personas mayores.
- **Decisión:** Supabase conserva sólo la política de selección de plazo. Google `Criterios de fondos` conserva fondo, tasa, monto máximo, máximo de pagos y reglas financieras. La Edge Function intersecta ambas autoridades y calcula server-side; el navegador sólo representa respuestas completas.
- **Asistencia:** cualquier asignación y rol administrativos habilitados pueden iniciar un contexto de 30 minutos con motivo obligatorio. Solicitudes y nómina asistida conservan actor real, afiliado contexto, sesión y motivo.
- **Nómina:** sustituye únicamente la prohibición de escritura impersonada de ADR-050/INV-086. Una sesión válida permite capturar la declaración Supabase del afiliado; no crea talón oficial ni modifica Google.
- **Solicitud:** `program_requests` continúa como autoridad única del alta inicial. El ítem `prestamo` sólo enruta y no replica tasas ni cálculos.
- **Seguridad:** sin credenciales del afiliado, sin anidamiento, con RLS/RPC backend. La excepción visual sólo permite `loan` bajo contexto activo.
- **Aprobación:** decisión explícita vigente del propietario, 2026-08-24; supersede restricciones anteriores sólo en estos puntos.

## ADR-052 — Mínimo personalizado de un pago (autoridad supersedida por ADR-065)

- **Contexto:** el propietario determinó que “Otro” debe permitir liquidar un préstamo en un solo pago.
- **Decisión:** el mínimo autoritativo de plazo personalizado cambia de 6 a 1 pago; las sugerencias visibles 6/12/18/24 permanecen sin cambios. Google conserva el máximo por fondo, la tasa y todos los cálculos.
- **Implementación:** `loan_term_policy.custom_min_term=1`; la Edge intersecta `1..máximo Google` y cotiza server-side. El navegador sólo aplica el rango recibido.
- **Aprobación:** decisión explícita del propietario, 2026-08-24.

## ADR-053 — Visibilidad temporal administrable de criterios financieros (autoridad/writer supersedidos por ADR-065)

- **Autoridad:** Google `Criterios de fondos` conserva elegibilidad, categoría, sindicato, fondo, tasa, monto, plazo y fecha. La primera columna completamente libre después de O es P y su único contrato nuevo es `VISIBILIDAD SUTIAPP`; M `MOSTRAR PROGRAMA` permanece histórico y sin cambios.
- **Modos:** vacío o `AUTO` aplica la política automática; `MOSTRAR` fuerza visibilidad y `OCULTAR` fuerza ocultamiento, siempre después de cumplir categoría y sindicato. Un override no altera elegibilidad, tasa, cálculo, fecha ni solicitud.
- **Política AUTO:** criterios permanentes sin fecha permanecen visibles todo el año. Un criterio fechado es visible desde la fecha de negocio actual hasta el último día del cuarto mes calendario incluido; fechas pasadas o posteriores a esa ventana quedan ocultas. La fecha estructurada N tiene prioridad, H es fallback y el nombre sólo es fallback histórico.
- **Administración:** `Fondos y reglas` muestra política, configuración y estado efectivo. Cambiar P exige permiso específico, JWT, Edge Function, Sheets API con identidad técnica `drive.file`, fingerprint de A:O, motivo para excepciones, confirmación, snapshot A:O, read-back, rollback y auditoría durable del actor real. El navegador nunca escribe Google ni recibe secretos.
- **Recuperación:** revocar permisos y restaurar las funciones desactiva el control; la auditoría se conserva y P puede ignorarse sin tocar A:O. No existe réplica de overrides en Supabase.
- **Estado operativo:** `PASS`. El proyecto aislado `expanded-talon-506522-r7` y la identidad dedicada `soporte.sutiapp@gmail.com` conceden únicamente `drive.file` al workbook seleccionado con Picker. `financial-criteria-admin` escribe P por Sheets API; la prueba reversible `AUTO → MOSTRAR → OCULTAR → AUTO` dejó A:O/M intactas y tres auditorías confirmadas. La antigua ruta Web App HTTP 403 fue sustituida sin ampliar scopes ni usar identidad personal productiva.
- **Aprobación:** política explícita del propietario `OWNER DECISION — POLÍTICA DE VISIBILIDAD DE FONDOS EN SUTIAPP`, 2026-08-24.

## ADR-054 — Foto administrable del header colapsado de Inicio

- **Contexto:** el propietario solicitó una foto visible durante el colapso reversible de Inicio, administrable sin tocar código y disponible sin red.
- **Decisión:** `home.header.collapsed` es la única clave consumida por Inicio y Branding. Un registro `app_assets` READY con esa clave es el override Admin; `VisualContent` lo proyecta de forma descartable al store de recursos. Sin override, la resolución continúa por slot de usuario, default local versionado e icono.
- **Offline:** la foto aprobada del Comité Ejecutivo Estatal 2022–2028 se incluye en el app-shell y service worker. Es un default de producto explícitamente autorizado, no una autoridad que acepte escrituras ni una reconstrucción de datos eliminados.
- **Administración:** upload/reemplazo exige sesión Admin, permiso `assets.write`, RLS y Storage existentes. “Restaurar la original” cambia el asset a `DISABLED`, conserva procedencia y vuelve al default sin borrar historia.
- **UI/motion:** el progreso de imagen se deriva de scroll; sólo escribe `transform` y `opacity`, conserva el contrato Claude, no captura eventos y no añade velo o degradado.
- **Aprobación:** solicitud explícita del propietario del 2026-08-24.

## ADR-055 — Blur exclusivo del odómetro financiero

- **Contexto:** el propietario rechazó los skeletons opacos de la tarjeta de resultado y solicitó un odómetro slot-machine visible durante la carga y al revelar importes reales.
- **Decisión visual:** los cinco importes de `StepSimulatorV2` usan carretes verticales de glifos. Cada transición recorre seis vueltas y todos los carretes terminan en 1 segundo como máximo; no se añade tiempo por columna. Cada cambio válido de fondo, importe o plazo reinicia inmediatamente los carretes con glifos de carga neutrales; una cotización anterior que no coincide con la selección actual no se presenta como importe ni como destino accesible. Al llegar la nueva cotización, únicamente ese resultado autoritativo ejecuta su propio ciclo. Durante una espera más larga, los glifos permanecen visibles y estáticos al completar ese único ciclo. Un error controlado conserva la estructura y los carretes neutrales, pero no expone importes de una selección distinta; nunca existe un intervalo sin dígitos.
- **Excepción motion:** se autoriza `filter: blur()` exclusivamente en el track interno de glifos del odómetro y de forma proporcional a su velocidad. La misma animación WAAPI es el único escritor de `transform + filter` de ese track; contenedores, tarjeta y demás pantallas conservan la regla general `transform/opacity`.
- **Accesibilidad/estado:** con reduced motion o documento oculto no hay giro ni blur; cuando existe resultado se muestra directamente el valor final. Los carretes de carga no anuncian cifras y el valor confirmado conserva `role=img` + `aria-label` real.
- **Finanzas:** el efecto no calcula, interpola ni inventa importes de negocio. El valor final proviene exclusivamente de `FinancialSimulationResult`; Google, Edge, Repository y reglas permanecen sin cambio.
- **Aprobación:** autorización explícita del propietario para usar `filter blur` exclusivamente en los glifos internos del odómetro, 2026-08-24; duración máxima global de 1 segundo solicitada explícitamente el 2026-08-25; continuidad visible sin intervalo vacío aprobada explícitamente el 2026-08-25; la solicitud de corregir la mezcla de cotizaciones en Suti Préstamo aclara el 2026-08-27 que continuidad visual no autoriza mostrar importes de una selección anterior.

## ADR-056 — Activación productiva diferida y dry run documental

- **Contexto:** SutiApp continúa en desarrollo local y aún no tiene URL, dominio, Site URL, Redirect URLs, callback y entrega de correo productivos definitivos.
- **Decisión Auth:** no enviar correo, crear Auth, modificar Site URL ni configurar localhost para certificar activación. La arquitectura de activación queda verificada y la prueba positiva se registra como `AUTH-PROD-ACTIVATION-CERT / DEFERRED_UNTIL_ONLINE`.
- **Estado:** Fase 1 queda `PASS_WITH_DEFERRED_PRODUCTION_ACTIVATION_TEST`, pero no `CLOSED` hasta completar el flujo real online.
- **Continuidad:** el pendiente no bloquea trabajo independiente. Se autoriza Fase 2 exclusivamente `DRY RUN ONLY`, sin insertar, actualizar, borrar, reasignar o mover relaciones/assets/objetos.
- **Matching:** UUID existente; `numero_control` TEXT exacto y único; identificador histórico único demostrado. Nombre no identifica y email ambiguo nunca resuelve una asociación.
- **Duplicados:** 13 grupos/28 filas de control y 7 grupos/16 filas de email permanecen intactos; no fusionar, reasignar ni borrar.
- **Aprobación:** decisión explícita del propietario `DEFER REAL ACTIVATION UNTIL ONLINE`, 2026-08-24.

## ADR-057 — Cierre documental y certificación end-to-end del expediente

- **Decisión de Fase 2:** 12,901 relaciones existentes están correctamente vinculadas; no existen writes deterministas, relaciones ambiguas/incorrectas ni huérfanos en `private-assets`. Fase 2 queda `PASS / CLOSED` y solo se reabre ante regresión demostrable.
- **Frontera separada:** cinco huérfanos de `app-assets` no pertenecen al expediente privado. Quedan inmóviles bajo `APP-ASSETS-ORPHAN-AUDIT` y no bloquean Identidad/Expediente.
- **Autoridad runtime:** `AffiliateRepository.getDocuments()` lee `affiliate_files` bajo RLS y genera URLs temporales de 300 segundos para objetos `PRIVATE`; la pantalla no usa `DATA`, almacenamiento del navegador, JSON, mock o fallback.
- **Aislamiento:** sesiones reales A/B/Anonymous y Admin prueban UUID, relaciones y rutas privadas exclusivas. Los assets físicos compartidos por deduplicación no se presentan falsamente como exclusivos.
- **Admin e impersonación:** acceso directo exige `assets.read`; la impersonación conserva `actor_real auth.uid()` y separa `usuario_contexto`, crea/cierra únicamente su sesión auditada y no cambia Auth ni documentos.
- **Estado de dominio:** Identidad y Expediente queda `PASS_WITH_DEFERRED_PRODUCTION_ACTIVATION_TEST`; no `CLOSED` hasta `AUTH-PROD-ACTIVATION-CERT` online.
- **Aprobación:** instrucción explícita del propietario `CONTINÚA — FASE 3 EXPEDIENTE END-TO-END`, 2026-08-24.

## ADR-058 — Architecture Registry derivado y Navigator automático

- **Decisión:** `docs/architecture/SUTIAPP_ARCHITECTURE_REGISTRY.json` y sus particiones son un índice técnico derivado, reproducible y Observatory-ready. No participan en runtime ni sustituyen código, migrations, RLS, repositories, Storage, Google legacy o documentos normativos.
- **Generación:** `scripts/generate-architecture-registry.py` analiza archivos, llamadas Supabase literales, schema SQL estructurado, FK, policies, tests y evidencia documental sin red ni escrituras productivas. `architecture-overrides.json` queda limitado a aliases, autoridad semántica y relaciones no deducibles con seguridad.
- **Operación:** toda futura implementación, corrección, auditoría o modificación activa `sutiapp-architecture-navigator` antes de los guardians. El flujo obligatorio es lookup → freshness → inspección focalizada → guardians → implementación/tests → actualización solo ante cambio arquitectónico.
- **Fallback:** feature ausente, stale, evidencia insuficiente o contradicción obliga discovery dirigido y confirmación contra repo. Registry-first no significa Registry-only.
- **Seguridad:** los artefactos excluyen archivos sensibles, valores de filas, PII, documentos y secretos; solo almacenan metadata técnica, paths, nombres de schema y evidencia.
- **Aprobación:** solicitud explícita del propietario `CREATE SUTIAPP ARCHITECTURE REGISTRY + NAVIGATOR SKILL` y activación automática, 2026-08-25.

## ADR-059 — Finalización funcional de documentos, credencial y solicitudes

- **Decisión documental:** crear una capa canónica sobre los archivos ya migrados, preservando `affiliate_files`/`private_assets`. El backfill relaciona por identidad histórica demostrada; no duplica archivos ni altera los 12,901 vínculos existentes.
- **Solicitudes:** requisitos configurables por programa reutilizan documentos verificados cuando el contrato lo permite y fijan snapshots inmutables al enviar. Membresías y préstamo comparten el mismo modelo, historial y revisión administrativa.
- **Banco:** la tabla nueva inicia vacía. La afirmación de que los campos históricos estaban migrados contradice `SOURCE_OF_TRUTH.md`; se bloqueó cualquier importación hasta resolución del propietario.
- **Términos:** se versionan y publican desde Admin, pero no se inventa contenido legal. Con cero versiones aprobadas, el CTA falla cerrado. Publicar el primer texto es `OWNER_DECISION_REQUIRED`.
- **QR:** política global allowlisted, token aleatorio de corta duración, hash backend y QR estándar generado dentro del bundle MIT; no hay proveedor externo ni PII codificada.
- **Legacy:** cero cambios en Google, Apps Script, reglas, fórmulas, tasas, amortización, saldos o conciliación.
- **Recuperación:** `supabase/recovery/20260825000100_complete_documents_credentials_membership_requests_recovery.sql` deshabilita writers/configuración sin borrar solicitudes, auditoría ni historia.
- **Aprobación:** instrucción explícita del propietario “Hazlo de forma quirúrgica” sobre la cola maestra del 2026-08-25; decisiones legales y autoridad bancaria histórica no se infieren.

## ADR-060 — Autoridad legal y seed bancario histórico resueltos

- **Términos:** Supabase es la autoridad productiva por programa. Cada préstamo y membresía admite texto o PDF, versión, publicación, fecha de vigencia e historial. La solicitud exige versión publicada/vigente y conserva inmutablemente `program_id`, `terms_version_id`, `accepted_at`, `affiliate_id` y `request_id`. Cambios futuros no alteran solicitudes históricas. El propietario publicará el contenido; Codex no lo inventa.
- **Banca histórica:** `Usuarios SUTIAPP.xlsx`, hoja `Usuarios`, es sólo fuente de seed. El matching permitido es `numero_control` TEXT exacto y único hacia `public.affiliates`; nombre, similitud y email están prohibidos. Ambiguos/no-match no se importan.
- **Banca productiva:** después del seed, la autoridad única es `affiliate_bank_accounts`; Excel no es runtime. Se soportan 0..N cuentas y ningún seed sobrescribe datos productivos actuales. Coincidencia exacta es `NO OP`; diferencia es `CONFLICT`.
- **Gate:** todo seed requiere dry run con `Writes: 0`, hash fijado, clasificación determinística, RLS/capability y reconciliación. La autorización actual ordena detenerse antes de importar.
- **Aprobación:** `OWNER DECISIONS — MASTER FUNCTIONAL COMPLETION`, 2026-08-25.

## ADR-061 — Banca histórica parcial y autogestión del afiliado

- **Decisión:** importar por campo sólo valores demostrables del snapshot autorizado; un campo degradado se vuelve NULL/pendiente sin descartar sus campos hermanos seguros. Reconstrucción, heurística, fusión y overwrite permanecen prohibidos.
- **Titular:** `account_holder` histórico no se infiere. Toda fila seed queda `INCOMPLETE_HISTORICAL_DATA` hasta que el afiliado complete titular, banco y cuenta válida.
- **Operación:** Supabase es autoridad única; Credencial permite ADD/EDIT/DELETE/SET PRIMARY sobre 0..N cuentas propias. CLABE es TEXT opcional exacto de 18 dígitos.
- **Seguridad/auditoría:** RLS por afiliado, Anonymous denegado, Admin por `bank_accounts.read`; auditoría usa cuatro acciones específicas sin números completos.
- **Resultado:** 504 inserts seguros, 8 ambiguos y 1 irrecuperable omitidos; 0 reconstrucciones, heurísticas, updates u overwrites.
- **Aprobación:** `OWNER DECISION — BANKING DATA USER-MAINTAINED`, 2026-08-25.

## ADR-062 — Higiene documental y ocultamiento histórico no destructivo

- **Decisión:** `affiliate_files.expediente_classification` separa `CURRENT_DOCUMENT`, versiones históricas, legacy, no clasificados y `HISTORICAL_NON_DOCUMENT`. HTML, b1…b10, código/condición de popup, imagen principal y logotipo son técnicos, no expediente.
- **Visibilidad:** el afiliado efectivo sólo puede leer `CURRENT_DOCUMENT`; RLS de relación, activo privado y Storage aplica el mismo corte. Administración requiere `assets.read` y conserva una bandeja de auditoría histórica.
- **Ciclo de vida:** un trigger deriva la versión vigente desde el documento canónico más reciente por afiliado/tipo; la clasificación no crea una segunda autoridad.
- **Borrado:** ocultar no elimina relaciones, procedencia ni objetos. Un objeto sólo puede borrarse con referencias cero, backup y manifest reproducible. La auditoría actual autorizó cero eliminaciones.
- **UX:** expediente y auditoría son galerías con estado visible, visor interno imagen/PDF, navegación, filtros y revisión administrativa.
- **Aprobación:** `OWNER DECISION — EXPEDIENTE HISTÓRICO + DEPURACIÓN SEGURA`, 2026-08-25.

## ADR-063 — Retiro de impacto quincenal y talón en Suti Préstamo

- **Decisión visual:** retirar de `StepSimulatorV2` las cards “Impacto en tu quincena” y “Tu talón de pago”, incluido el editor de declaración accesible desde esta última. El resto del paso Monto, los otros tres pasos y el flujo de solicitud permanecen sin rediseño.
- **Autoridad:** esta decisión no borra ni modifica `affiliate_payroll_declarations`, sus RPC, RLS, auditoría o la proyección server-side existente. Tampoco cambia el `FinancialSimulationResult`, Google financiero, elegibilidad, aprobación, solicitudes o cálculos.
- **Pruebas:** el contrato UI debe exigir la ausencia de ambas cards y dejar de escribir/restaurar declaraciones de nómina durante las pruebas del simulador.
- **Aprobación:** instrucción explícita del propietario tras pruebas con usuarios que indicaron que no usarían estas superficies, 2026-08-25.

## ADR-064 — RPC autenticada para cotización interactiva sobre snapshot (autoridad supersedida por ADR-065)

- **Autoridad actualizada por ADR-065:** Supabase conserva elegibilidad, fondo, tasa, máximo y plazo. `financial_session_snapshots` sigue siendo `DERIVED`, personalizado, expirable y no autoritativo.
- **Motor único:** `resolve_suti_loan_quote_contract` implementa `SUTI_LOAN_QUOTE_V1` con `numeric` y redondeo a centavos. La RPC de sesión y Edge para confirmación/legacy delegan al mismo resolver; no existe un cálculo financiero en frontend ni dos motores activos.
- **Seguridad:** la RPC pública a PostgREST acepta sólo snapshot/fondo/monto/plazo, exige Auth y valida internamente actor, afiliado efectivo, impersonación, TTL, perfil/fingerprints, política y contrato. `financial_session_snapshots` mantiene cero acceso directo browser y el resolver interno es service-role-only.
- **Flujo actualizado por ADR-065:** apertura es Edge→criterios Supabase→snapshot. Interacción es browser→RPC con 0 Google/0 Edge y sin fallback. Confirmación es Edge→perfil/criterios Supabase/política actual→mismo resolver→alta atómica; la cotización de sesión nunca autoriza el alta final.
- **Gate:** el corte requiere forward/recovery transaccionales, equivalencia Edge↔RPC exacta, matriz de seguridad y pruebas pública/móvil. Una regresión obliga a revertir frontend/Edge antes de retirar las funciones.
- **Aprobación:** `OWNER DECISION — AUTHORIZE AUTHENTICATED SUPABASE RPC FOR INTERACTIVE LOAN QUOTES`, propietario, 2026-08-26.

## ADR-065 — Cutover autoritativo de criterios financieros a Supabase

- **Autoridad única:** Supabase `financial_programs`, `financial_funds`, `financial_rules` y `financial_criteria_authority` sustituyen Google `Criterios de fondos` para elegibilidad, programa, fondo, tasa, monto, plazo, fechas y visibilidad. No existe dual-read ni fallback productivo.
- **Importación certificada:** el batch activo conserva exactamente 146 reglas, 35 fondos, 3 programas, 2 grupos duplicados, 1 grupo conflictivo y hash `174F940E195DE5DAE595AAF798CC1B49976AA899E76D6CF141FB9D711A6E9C8A`. Sólo A/B/C/D/E/F/H/N/P son parte del contrato; G/I/J/K/L/M/O quedan excluidos. L es un cálculo auxiliar legacy no consumido por producción.
- **Motor y sesiones:** `SUTI_LOAN_QUOTE_V1` permanece como motor server-side único. Apertura, cotización interactiva y confirmación consumen criterios Supabase; `financial_session_snapshots` se conserva como caché personalizado TTL 15m, nunca autoridad. Google calls de apertura/interacción/confirmación = 0.
- **Administración:** Programas, fondos y reglas usan RPC auditadas, versiones `DRAFT/PUBLISHED/SCHEDULED/EXPIRED`, motivo y confirmación explícita. La UI no autoriza; permisos/RLS/backend deniegan responsable no autorizado, usuario normal y anónimo.
- **Legacy y recovery:** Google queda intacto como histórico/procedencia y el append posterior a aprobación permanece separado. Google writes 0 y Apps Script changes 0 durante el corte. Recovery puede devolver explícitamente autoridad a Google conservando el batch, pero jamás opera automáticamente como fallback.
- **Gate:** canary A/B Edge exacto, equivalencia de perfiles/cotizaciones, RLS, CRUD transaccional con rollback, navegador real, regresiones protegidas y suite estática pasaron. El Edge/RPC canary temporal se eliminó tras el corte.
- **Aprobación:** `H-FINANCIAL-SUPABASE-CUTOVER-AUTONOMOUS-001`, autorización autónoma explícita del propietario, 2026-08-27.

## ADR-069 — Remediación de rendimiento del simulador de préstamo

- **Alcance:** exclusivamente rendimiento y orquestación de `StepSimulatorV2`, `motion.spinSlot`, el store financiero y sus consumidores. Cero cambios en reglas financieras, tasas, montos máximos, elegibilidad, fórmula certificada `SUTI_LOAN_QUOTE_V1`, autoridad Supabase o composición visual aprobada.
- **Odómetro sin remount:** el motor (`SmoothMoney`) permanece montado durante una recotización y conserva la forma del último importe válido; deja de sustituirse por `LoadingReels`. Las ruedas se identifican por posición decimal (desde la derecha), no por índice de cadena: ganar o perder un dígito ya no re-monta las ruedas existentes. Sigue vigente la regla fail-closed: mientras gira el nodo va `aria-hidden`, sin `aria-label`, y no presenta ningún importe legible.
- **Pista modular:** `spinSlot` anima `turns` vueltas sobre `slot.cycle + 1` glifos (el último repite el primero, así el reinicio de vuelta es invisible). 11 nodos por dígito en vez de `turns*10+delta`. Medido: 1 647 → 297 glifos, 1 741 → 377 nodos en la tarjeta de resultado.
- **Blur y duración:** el `filter: blur()` deja de interpolarse por dígito y por frame; se aplica estático mientras gira y se retira al asentar (una rasterización, no una por frame). La duración de asentamiento pasa de 1000 ms al token existente de 480 ms. `willChange` queda en `transform`.
- **Selección atómica:** fondo, monto y plazo se derivan en una sola transición (`deriveSelection`), de modo que `selectionKey` cambia una vez por intención. Se elimina la bandera `immediate` por ref, que se consumía sobre la selección intermedia y provocaba una cotización desechada más 320 ms de debounce. Un plazo personalizado válido para el fondo nuevo se conserva en vez de reiniciarse.
- **Debounce por intención:** toque discreto (card de fondo, plazo, monto rápido, fin de arrastre, salida del campo) cotiza de inmediato; sólo el arrastre continuo y el tecleo mantienen los 320 ms.
- **Plazo sugerido instantáneo:** al tocar un plazo estándar la UI proyecta el renglón correspondiente de `termOptions`, que el servidor ya resolvió para ese fondo y ese monto en la respuesta vigente, y confirma en segundo plano. Cero aritmética en el navegador: cada importe se copia verbatim. La respuesta autoritativa siempre reemplaza a la proyección. Plazos fuera de `standardTerms` siguen requiriendo cotización completa.
- **Propagación de estado:** la cotización interactiva deja de emitir un `status: 'loading'` global (el overview ya está cargado y ese emit re-renderizaba TopBar y Financiera, montadas detrás de la ruta apilada). `useFinancialLegacy` acepta un selector opcional con comparación superficial; la API sin selector permanece intacta. Medido: 2 → 1 emisión por cotización, y `status`/`overview` estables durante una cotización, por lo que las pantallas ocultas no re-renderizan.
- **Sesión y snapshot:** `ensureLoanSession` queda deduplicada (App, Financiera y Préstamo la invocan al montar y se invalidaban el snapshot entre sí). `SNAPSHOT_INVALID` tiene exactamente un ciclo de recuperación silenciosa por intención. El TTL absoluto de 15 minutos **no se extiende jamás**: si el snapshot está a menos de 60 s de vencer se abre uno nuevo antes de cotizar. Esta es la alternativa más simple y además la única compatible con INV-107 y con el check `expires_at<=created_at+interval '15 minutes'`, que prohíben que la RPC escriba la tabla.
- **Lock:** `resolve_current_loan_snapshot_quote` sólo lee la fila del snapshot. `for share` entraba en conflicto con el `for no key update` del `update ... invalidated_at` de la invalidación de sesiones, serializando «abrir sesión» contra «cotizar». Pasa a `for key share`, que sólo entra en conflicto con `for update` (DELETE): la fila sigue sin poder desaparecer a mitad de la cotización y desaparece la contención.
- **Reintentos:** la ruta usa PostgREST, no Edge Function. Se retira la clasificación de errores de Edge y se adoptan fallos de transporte reales más códigos transitorios de PostgreSQL (57014, 40001, 40P01, 55P03, 08006, 53300) y 502/503/504. `SNAPSHOT_INVALID` nunca se reintenta aquí. Presupuesto por evidencia (latencia medida contra Supabase en vivo: mediana 178 ms, p90 250 ms, máximo 364 ms): 2 intentos × 4 s + 300 ms ≈ 8.3 s en el peor caso, frente a los ~32 s anteriores.
- **Continuar:** la simulación se publica al padre en `useLayoutEffect`, de modo que el botón se habilita en el mismo frame pintado que los importes. Sólo puede permanecer habilitado si existe cotización válida para la selección vigente (`quoteMatchesSelection` sobre fondo, monto y plazo).
- **No aplicables verificados:** el riesgo de `payrollImpact` `READY` con `version` nula no existe — la columna es `integer not null default 1` con `check (version > 0)`. Las divisiones de `get_current_declared_payroll_impact` tampoco pueden anularse: `check (gross_pay_per_fortnight > 0)` y `check (deductions_per_fortnight < gross_pay_per_fortnight)` garantizan denominadores positivos. No se añadió código defensivo redundante.
- **Aplicación del lock:** la migración se aplicó a la base productiva el 2026-08-27 con autorización explícita del propietario y es reversible con `--recover`. Evidencia de no-impacto: en toda la superficie de seguridad (conteos, digest de las 146 reglas, fuente de 8 funciones financieras, grants, ACL de ejecución, RLS, políticas y constraints) la **única** diferencia es el `md5(prosrc)` de la función declarada, cuyo cuerpo difiere en exactamente 2 líneas frente a la migración original. Una matriz determinista de 51 cotizaciones a través de la RPC autenticada en navegador real conserva el mismo SHA-256 antes y después: `e35edd06d7a651803384df35e05475b36e2446a47ebb5675ea1b2abe81305cfe`.
- **Aprobación:** `H-LOAN-SIMULATOR-PERFORMANCE-REMEDIATION-001`, autorización autónoma explícita del propietario, 2026-08-27.

## ADR-070 — Suti Inversión como simulador presentacional local

- **Decisión visual:** el HTML completo entregado por el propietario es el contrato visual e interactivo de la ruta full-screen `Mi Financiera → Invertir`; no se abre iframe, navegador externo, modal ni segunda app.
- **Límite de autoridad:** la inversión operativa, sus saldos, contratos, elegibilidad, pagos, solicitudes y rendimientos reales continúan en legacy protegido. Esta pantalla no los lee ni los sustituye.
- **Cálculo autorizado:** sólo para la proyección ilustrativa se fijan `2.5%` mensual simple, monto `$50,000–$2,000,000`, paso `$10,000`, presets aprobados y `6/12/18/24` meses. Capital final equivale al principal y no existe interés compuesto.
- **Estado y writers:** monto/plazo viven únicamente en estado React efímero. Se prohíben `localStorage`, caché, mock como autoridad, Google, Supabase, Edge, RPC, registro productivo, transferencia y WhatsApp. El CTA muestra una confirmación informativa interna.
- **Separación:** Suti Préstamo, su resolver, snapshot, odómetro, RPC, selección, reglas y Admin financiero quedan fuera de alcance e intactos.
- **Aprobación:** `H-SUTI-INVERSION-SCREEN-001`, contrato visual, copy, constantes, fórmula y comportamiento autorizados expresamente por el propietario, 2026-08-27.

## ADR-071 — Módulo productivo Admin Afiliados y exportación Excel

- **Autoridad:** `public.affiliates` permanece como padrón único. El módulo no introduce otra tabla maestra, copia local, mock o fallback. Las altas nuevas se distinguen mediante `record_origin=ADMIN_AFFILIATES` sin fabricar procedencia histórica.
- **Operación:** el listado usa búsqueda, filtros, orden y paginación server-side. Perfil, expediente, solicitudes, acceso y auditoría se componen desde las autoridades existentes; Document, Requests y Financial Workbench se reutilizan con contexto de afiliado.
- **Escritura:** crear, editar, baja o reactivación exigen `affiliates.write`, motivo, validación backend, control optimista y auditoría before/after. No existe DELETE productivo y el cambio de estado no altera Auth, documentos, solicitudes o historia.
- **Auth y asistencia:** Auth es separada y nullable. El módulo sólo informa el vínculo y reutiliza la impersonación backend existente con `affiliates.impersonate`; nunca usa contraseña del afiliado ni concede acceso por UI.
- **Excel:** “Exportar Excel” reutiliza `data-exports`, exige `data_exports.read`, genera XLSX temporal `no-store` desde columnas allowlisted y audita metadatos. No persiste la base ni crea una fuente de verdad adicional.
- **Migración y recovery:** `20260827001200_admin_affiliates_workbench.sql` conservó 947/947 históricos y 3 Auth. El recovery falla cerrado si ya hay altas Admin o auditoría, para impedir pérdida de operación real.
- **Aprobación:** `H-ADMIN-AFFILIATES-MODULE-001` y solicitud explícita “dales funcionalidad, además agrega que puedan exportar en excel la base de datos”, propietario, 2026-08-27.

## ADR-072 — Retiro de la edición global de textos

- **Decisión visual:** retirar el botón flotante `Editar textos`, el modo que convertía nodos del frontend en editables, su acceso en Roles y el control pendiente homónimo de Convenios. Los editores administrativos específicos de cada dominio permanecen intactos.
- **Autoridad e histórico:** `public.managed_copy_overrides` deja de tener lectores y writers frontend. La tabla y sus filas se conservan sin borrado como histórico recuperable; no se activa `DATA`, mock, `localStorage` ni otra fuente alternativa.
- **Runtime:** `ManagedCopyRepository`, `copyStore`, `LiveText`, `TextEditBar`, `saveCopy` y `removeCopy` quedan fuera del bundle. El copy estructural vuelve a ser exclusivamente código versionado.
- **Recuperación:** revertir el cambio de código puede volver a conectar la tabla existente; ninguna recuperación exige restaurar filas ni ejecutar SQL.
- **Aprobación:** solicitud explícita del propietario “elimina el botón y sus funciones de editar texto”, confirmada para continuar el 2026-08-27.

## ADR-073 — Edición, baja reversible y carga documental en Admin Afiliados

- **Identidad:** editar continúa sobre `public.affiliates` mediante `update_admin_affiliate`, con `affiliates.write`, versión optimista, motivo y auditoría. “Eliminar usuario” significa baja administrativa reversible mediante el writer de estado existente; no existe DELETE físico ni se alteran Auth, documentos, solicitudes o historia.
- **Documentos:** el perfil permite cargar a `affiliate_documents`/`private_assets` y `private-assets` mediante `register_admin_affiliate_document`. Exige `documents.write`, archivo máximo 10 MB, MIME allowlisted, SHA-256, ruta bajo el UUID objetivo, owner igual al actor y motivo; el alta queda `PENDING_REVIEW`.
- **Inmutabilidad:** un `VERIFIED` no se reemplaza. Duplicación por hash reutiliza el asset canónico y el frontend intenta limpiar el objeto no referenciado; ningún fallo activa Storage público, fallback local o segunda autoridad.
- **Seguridad Storage:** `can_admin_upload_affiliate_document_path` sólo devuelve un booleano para permiso + UUID existente. `can_delete_unreferenced_affiliate_document_object` verifica referencias fuera del filtrado RLS antes de permitir cleanup. Ninguno otorga lectura directa ni expone PII; normal, anónimo y el borrado de objetos referenciados quedan denegados.
- **Migración/recovery:** `20260827001300–01320` son aditivas; forward y recovery pasaron en rollback y aplicación sin filas de negocio. Los recovery preservan todo documento registrado.
- **Aprobación:** solicitud explícita del propietario de editar, eliminar y cargar documentos guardados en Supabase desde Afiliados, 2026-08-27.

## ADR-074 — Solicitudes concurrentes por afiliado y programa

- **Decisión:** una solicitud previa, incluso pendiente o en revisión, no bloquea una nueva solicitud del mismo afiliado para el mismo programa, producto o para otro destino. Cada intención nueva recibe una `idempotency_key` nueva y crea una fila distinta en `program_requests`; sólo el reintento técnico de la misma intención reutiliza su fila.
- **Documentos:** un documento canónico `PENDING_REVIEW`, `UNDER_REVIEW` o `VERIFIED` puede adjuntarse conforme al requisito vigente. Que la revisión documental de otra solicitud siga abierta no constituye un bloqueo global ni por programa.
- **UX:** los estados y folios existentes siguen visibles, pero son informativos. Una cotización pendiente o lista conserva una acción para abrir otra solicitud sin cancelar, reemplazar ni alterar la anterior.
- **Excepciones:** esta habilitación no crea writers ni cambia el comportamiento de Ahorro Voluntario o Portafolio de Inversión. Ambos permanecen bajo sus contratos y fronteras legacy vigentes.
- **Autoridad y seguridad:** `program_requests`, sus RPC, RLS, identidad derivada, auditoría e idempotencia permanecen sin cambios. No se toca Google, Apps Script ni ningún cálculo financiero.
- **Aprobación:** instrucción explícita del propietario, 2026-08-29.

## ADR-075 — Disponibilidad física y versionado del expediente de préstamo

- **Autoridad:** `affiliate_documents` + `document_types` permanecen canónicos; `private_assets` y la existencia en `storage.objects/private-assets` son condición de disponibilidad. Metadata sin objeto no satisface un requisito.
- **Vista:** ninguna URL firmada se persiste ni se reutiliza como autoridad. Cada acción `Ver` consulta disponibilidad y genera una URL privada nueva de 300 segundos; el fallo se presenta dentro de SutiApp, sin abrir la respuesta JSON de Storage.
- **Reemplazo:** una fila `VERIFIED` continúa inmutable. El afiliado puede crear una nueva versión `PENDING_REVIEW` enlazada por `replaces_document_id`; no se sobrescribe ni elimina historia. La versión más reciente del tipo prevalece y se audita como `REPLACEMENT_UPLOAD`.
- **Solicitud:** UI y trigger backend exigen que cada versión elegida sea la más reciente, tenga estado aceptable y objeto físico disponible. Si falta, se enumera el nombre exacto y el usuario vuelve a Documentos conservando simulación, destino, firma y aceptación.
- **Captura:** cámara y archivo/galería son intenciones separadas. Las imágenes grandes se preparan en el dispositivo con orientación EXIF, límite de dimensión y compresión antes de la carga; el backend conserva el límite máximo de 10 MB, MIME y hash.
- **Seguridad y legacy:** bucket privado, RLS, identidad derivada y auditoría se preservan. No cambia cálculo, elegibilidad, tasa, plazo, rol, regla legal, Google ni Apps Script.
- **Recovery:** `20260829000100_loan_document_flow_recovery_recovery.sql` aborta si existe historia de reemplazo; nunca borra documentos para facilitar un rollback.
- **Aprobación:** instrucción explícita del propietario de corregir quirúrgicamente el flujo documental de préstamo, 2026-08-29.

## ADR-076 — Bitácora administrativa y separación documental de solicitudes financieras

- **Solicitud y estado:** `program_requests` continúa como autoridad. Las notas originales del afiliado permanecen en `program_requests.notes`; revisión, comentario, rechazo, cancelación y autorización se registran en `program_request_admin_events` y no reescriben ese campo.
- **Writer:** `record_program_request_admin_action` exige `program_requests.write`, valida transiciones, obliga motivo para rechazo/cancelación y usa `client_action_id` idempotente. La aprobación sigue en `financial-legacy`; el RPC service-only agrega el evento `APPROVE` dentro de la misma transacción que el snapshot autorizado.
- **Documentos:** `request_documents` es la única evidencia de archivos enviados con una solicitud. `affiliate_documents/private_assets/private-assets` puede mostrarse como expediente vigente separado, nunca como reconstrucción o backfill de una solicitud antigua sin vínculos.
- **Seguridad:** leer la bitácora exige `program_requests.read`; la tabla tiene RLS habilitada/forzada, cero acceso directo browser y no proyecta UUID de actor ni claves de idempotencia. Las vistas privadas continúan requiriendo permisos documentales y URL firmada temporal.
- **Cancelación:** sólo está permitida antes de la aprobación; una solicitud con snapshot de aprobación conserva su estado inmutable.
- **Legacy:** aprobar conserva el handoff append-only vigente y la confirmación UI lo declara explícitamente. Esta decisión no autoriza ejecutar una aprobación QA ni escribir una fila de prueba en Google.
- **Aprobación:** autorización explícita del propietario `sí` a la corrección quirúrgica propuesta, 2026-08-29.

## ADR-077 — Frontera documental por contexto y firma individual auditada

- **Problema:** el repositorio compartía un listado que aceptaba afiliado opcional, ampliaba resultados por permiso Admin y firmaba múltiples objetos al cargar. Esto permitía mezclar contexto de autoservicio con contexto administrativo y presentar documentos ajenos o capacidades temporales obsoletas.
- **Decisión:** autoservicio usa `list_effective_affiliate_documents` y `authorize_self_document_preview`, siempre ligados al afiliado efectivo server-side. Administración usa `list_admin_affiliate_documents` y `authorize_admin_document_preview`, con `documents.read` y afiliado objetivo obligatorio. Ningún contrato es intercambiable.
- **Firma:** los listados contienen cero URLs y cero rutas. `document-access` valida JWT, propósito y contexto, firma exactamente un objeto privado durante 300 segundos y sólo devuelve la capacidad después de insertar auditoría. No existe firmado masivo, fallback local ni firma directa desde repository.
- **Impersonación:** el afiliado efectivo cambia conforme a la sesión válida, pero `actor_auth_user_id` conserva siempre al administrador real. Autoservicio impersonado no puede volver al expediente propio del actor ni ampliar por permisos globales.
- **Histórico:** no se reescriben filas `VERIFIED`. Cuando una fila importada carece de revisor y fecha, la UI aclara `Histórico importado`; la decisión de reclasificar estados históricos queda fuera de esta H.
- **Recovery:** la migración es aditiva y su recovery sólo puede retirar frontera y bitácora antes de que exista historia de acceso; después falla cerrado. La función Edge puede retirarse independientemente mediante el script de despliegue.
- **Legacy:** cero cambios o lecturas nuevas en Google, Apps Script, Ahorro, reglas, tasas, fondos, elegibilidad o cálculo financiero. El gate backend final de `request_documents` permanece vigente.
- **Aprobación:** instrucción explícita del propietario de remediar quirúrgicamente el incidente de privacidad documental, 2026-08-30.

## ADR-078 — Plataforma central de requisitos y fase documental única

- **Autoridad:** se evoluciona `program_document_requirements` en lugar de crear otra fuente. `document_types` define capacidades y `scope_type + scope_key` enlaza `PROGRAM`, `COMPANY`, `PRODUCT`, `SERVICE` o `MEMBERSHIP`; toda lectura efectiva pasa por una RPC server-side.
- **Herencia:** sólo se implementa la relación real `companies.id → marketplace_products.company_id`. Un producto hereda requisitos de empresa, puede agregar o excluir y restaura herencia eliminando su override. No se inventa jerarquía para programas o servicios; `SERVICE` conserva el contrato extensible y devuelve no disponible hasta que exista entidad autorizada.
- **Historia:** cada nueva solicitud congela los requisitos efectivos en `program_requests.document_requirements_snapshot`. Las solicitudes anteriores permanecen sin snapshot y no se reconstruyen. `request_documents` sigue siendo la única evidencia de archivos enviados y el expediente actual permanece separado.
- **Operación y seguridad:** catálogo/configuración sólo cambian mediante RPC con `documents.write`, razón y auditoría durable; escrituras directas quedan revocadas. Cámara y archivo son orígenes explícitos validados por backend, Storage sigue privado y los contratos de aislamiento/firma individual de ADR-077 permanecen intactos.
- **UI:** `UnifiedDocumentPhase` es el único componente compartido para préstamo, membresía, programas y productos compatibles. El HTML entregado por el propietario es referencia visual/funcional, no fuente de datos; se excluyen su demo local, `DATA`, `localStorage` y base64 persistente.
- **Legacy:** no cambia Google, Apps Script, reglas financieras, tasas, fondos, cálculos, solicitudes históricas ni semántica `VERIFIED`. El workbench Admin de revisión permanece separado de la fase autoservicio.
- **Aprobación:** `H-DOCUMENT-REQUIREMENTS-PLATFORM-AND-UNIFIED-UI-001` e instrucción explícita “hazlo de forma quirúrgica; incluye tomar foto o adjuntar archivo”, propietario, 2026-08-30.

## ADR-079 — Confirmación transaccional compatible y Historial self mínimo

- **Incidente:** `capture_document_requirements_snapshot` llamó `assert_document_requirement_scope`, que rechazaba `auth.uid() is null`. El escritor legítimo `create_validated_financial_program_request` es exclusivamente `service_role`, por lo que toda confirmación alcanzaba el trigger y terminaba `AUTH_REQUIRED`/409 antes de insertar.
- **Decisión quirúrgica:** `assert_document_requirement_scope` acepta únicamente usuario autenticado o `auth.role()='service_role'`; anónimo continúa denegado. No cambian requisitos, documentos, reglas financieras, cálculos, snapshots, estados ni writers.
- **Historial:** `list_self_program_request_history()` deriva `get_effective_affiliate_id()` sin aceptar selector cliente y proyecta sólo campos necesarios. No concede `SELECT` amplio ni expone afiliado, control, actor, firma, términos, snapshots o idempotencia.
- **UX y errores:** la confirmación conserva la pantalla compartida aprobada, folio real y política de movimiento. `Seguir mi solicitud` invalida sólo la proyección en memoria y abre Historial con lectura fresca. Edge devuelve códigos conocidos o fallo temporal con `correlation_id`; logs internos contienen únicamente etapa, código allowlisted y SQLSTATE sanitizado.
- **Legacy y prueba:** criterios siguen en Supabase (146 reglas/35 fondos/3 programas); Google y Apps Script tuvieron 0 lecturas/escrituras. Las fixtures E2E completas se crearon por la UI real y se eliminaron por identidad exacta; solicitudes reales e historial permanecieron intactos.
- **Aprobación:** `H-REQUEST-SUBMISSION-E2E-REMEDIATION-001` e instrucción explícita “hazlo de forma quirúrgica”, propietario, 2026-08-30.

## ADR-080 — Workflow versionado y timeline único por solicitud

- **Problema:** Admin mostraba un editor desconectado mientras Éxito, Historial y detalles usaban arrays locales diferentes. Las tablas productivas estaban vacías, por lo que editar textos o etapas no gobernaba ninguna solicitud real y una futura lectura de configuración vigente habría reescrito semánticamente la historia.
- **Autoridad:** `operational_workflows` y `operational_workflow_stages` son la única configuración vigente; `program_requests.workflow_id`, `workflow_version` y `workflow_snapshot` congelan la definición aplicable al crear cada solicitud; `operational_request_tracking` conserva hechos fechados.
- **Resolución:** el backend elige exactamente un workflow por destino real, priorizando identificadores específicos sobre claves canónicas. Ambigüedad, ausencia, etapa inicial o estado canónico inválidos abortan el alta. `resolve_program_request_workflow_state()` proyecta la misma semántica a Éxito, Historial y Admin.
- **Historia:** toda edición incrementa versión y afecta sólo solicitudes futuras. Las existentes preservan orden, título, descripción, responsable, SLA y mapeo original; snapshot y tracking se validan e impiden mutación/reinterpretación. El retiro es lógico y el borrado físico queda revocado.
- **Seguridad y auditoría:** lectura/mutación Admin exige `workflow.read/write`; autoservicio deriva al afiliado efectivo y no enumera catálogos. Cada cambio Admin registra actor real, motivo y antes/después en auditoría durable con RLS forzada.
- **UI:** Admin → Finanzas → Etapas y seguimiento administra los cuatro flujos reales de préstamo, membresía, cotización y beneficio. Éxito conserva folio, monto cuando aplica, efecto WOW/confeti y CTA a Historial. No existe `DATA`, mock, array hardcodeado, localStorage ni fallback silencioso.
- **Legacy:** cero lecturas/escrituras Google, cero cambios Apps Script y cero modificación de reglas, tasas, fondos, elegibilidad, cálculo, amortización o conciliación financiera.
- **Recovery:** `20260830000400_request_workflow_timeline_cutover_recovery.sql` restaura el predecesor sólo si no existe historia posterior incompatible; de lo contrario falla cerrado y conserva datos. La protección aditiva/reversible `20260830000410` impide publicar dos workflows habilitados para el mismo contexto.
- **Aprobación:** `H-REQUEST-WORKFLOW-TIMELINE-CUTOVER-001` e instrucción explícita “hazlo de forma quirúrgica”, propietario, 2026-08-30.

## ADR-083 — Catálogo financiero visible gobernado por Admin

- **Autoridad:** se preserva `finance_catalog_presentation`; no se crea v2, flag local ni tabla paralela. La estructura y rutas continúan versionadas en código y la tabla sólo gobierna presentación.
- **Precedencia:** visibilidad administrativa se aplica antes de elegibilidad. Elegibilidad puede restringir un producto visible, pero nunca reactivar uno oculto.
- **Consumo:** `finCatStore` proyecta orden y copy; `FinancieraScreen` filtra productos, secciones vacías y recomendaciones del catálogo inferior. Conforme a ADR-084, el resumen superior no es consumidor de `enabled`. Membresías permanece en `membershipStore` como dominio distinto.
- **Fallo/refresh:** el lector falla cerrado con estado y reintento visibles. Focus/visibility y el retorno del writer recargan la autoridad sin polling ni limpieza manual de caché.
- **Seguridad/migración:** lectura global sólo para `authenticated`; anónimo permanece sin grant y writers siguen bajo `workflow.write`. `20260831000200` agrega únicamente la policy faltante, conserva 6/6 filas y su recovery retira sólo esa policy.
- **Legacy:** cero cambios en Google, Apps Script, 146 reglas, 35 fondos, 3 programas, elegibilidad, cálculos, préstamo, depósito, documentos, workflow o historial.
- **Aprobación:** `H-FINANCE-CATALOG-VISIBILITY-CUTOVER-001`, propietario, 2026-08-31.

## ADR-084 — Resumen financiero permanente separado del catálogo

- **Decisión owner:** Mostrar/Ocultar de Admin → Catálogo de Finanzas gobierna exclusivamente secciones y productos del catálogo inferior. No gobierna la tarjeta superior “Mi Financiera”.
- **Resumen permanente:** crédito/préstamo, “Mi ahorro”, “Mi inversión”, Ahorrar e Invertir permanecen visibles aunque `prestamo`, `ahorro` o `inversion` estén ocultos abajo.
- **Autoridad:** no se crea otra fuente. El resumen conserva su estructura/rutas versionadas y sus valores siguen viniendo del lector financiero aprobado; `finance_catalog_presentation` continúa intacta para el catálogo inferior.
- **Alcance:** cero cambios en Admin, store, Supabase, cálculos, Suti Préstamo, Suti Inversión, Ahorro o legacy.
- **Aprobación:** `H-FINANCE-SUMMARY-ACTIONS-SEPARATION-001`, instrucción explícita del propietario, 2026-08-31.

## ADR-086 — Catálogo administrativo de productos propios por programa

- **Autoridad:** `program_catalog_items` y `program_catalog_item_assets` permanecen como única autoridad de productos propios SutiApp. `marketplace_products` conserva su dominio empresarial separado y recibió cero escrituras.
- **Precio:** para los históricos, `price_cash IS NOT NULL` implica por defecto `requires_quote=false`; sólo evidencia específica de cotización obligatoria puede conservar la combinación contraria. La matriz aprobada contenía 65 conflictos y ninguna excepción demostrable.
- **Writer:** Admin usa `ProgramCatalogRepository → save_program_catalog_item/reorder_program_catalog_items → program_catalog_items`. No reutiliza `MarketplaceRepository`, no acepta procedencia desde browser y registra antes/después en `admin_audit_log`.
- **Assets:** las imágenes reutilizan `program_catalog_item_assets`, `app_assets` y `app-assets`. Altas nuevas quedan bajo `program-products/<actor>/`; el trigger de ownership impide enlazar el asset de otro actor y la baja del vínculo es lógica.
- **Seguridad:** `program_catalog.read/write` son permisos específicos; lectura afiliada incluye sólo productos activos, escritura directa queda revocada y los RPC/Storage exigen permiso backend. Anónimo permanece denegado.
- **Historia y recovery:** los 65 precios se preservan exactamente; procedencia histórica no cambia. La tabla de reconciliación conserva valores previos y timestamp para recovery. Si existe actividad Admin posterior, recovery falla cerrado y nunca elimina historia legítima.
- **Límites:** no cambia Panel Empresarial, Marketplace, simulador, documentos, Google, Apps Script, tasas, fondos, plazos, reglas ni cálculos financieros.
- **Aprobación:** `H-SUTIAPP-PROGRAM-PRODUCTS-ADMIN-CUTOVER-001` y autorización productiva explícita del propietario, 2026-08-31.

## ADR-087 — Simulador universal y solicitud de plan de pago de productos propios

- **Autoridad de precio:** `program_catalog_items.price_cash` gobierna productos fijos. Un producto `requires_quote=true` exige la cotización propia aprobada, vigente y más reciente en `program_requests.quoted_amount`; no se inventa un precio para probar la rama cuando no existe cotización válida.
- **Autoridad financiera:** se reutilizan exclusivamente el perfil actual, el criterio activo de Caja Chica, `loan_term_policy` y el resolver certificado `SUTI_LOAN_QUOTE_V1` de Supabase. El frontend no reproduce tasas, reglas, elegibilidad, totales ni calendario.
- **Calendario:** la función service-only `generate_program_product_payment_schedule` fija el contrato `PROGRAM_PRODUCT_PAYROLL_CALENDAR_V1`. Procesos 1 y 3 usan 15/30 —28 en febrero—. JUB usa un solo descuento mensual el día 5; el primero es el primer día 5 `>= fecha_inicio + 30 días`, y 12 pagos son 12 meses.
- **Alta:** `financial-legacy` abre/cotiza/confirma; la confirmación revalida producto, precio, perfil, criterio, plazo, documentos y términos, y llama al writer atómico `create_validated_program_product_payment_request`. El snapshot inmutable `PROGRAM_PRODUCT_PAYMENT_V1` permite reconstruir exactamente la decisión.
- **Documentos y términos:** se reutiliza el alcance vigente `PROGRAM/prestamo`, `UnifiedDocumentPhase`, expediente privado y versión publicada de términos. No se crea una autoridad documental específica del simulador.
- **Admin:** `approve_program_product_payment_request` exige `program_requests.write`, es idempotente y auditada, y termina en `approved/completed`. La proyección Admin expone sólo el snapshot financiero sanitizado. Esta ruta no crea handoff ni exportación Google.
- **Seguridad y recovery:** snapshots de sesión y generadores internos permanecen service-only; RLS, actor real, afiliado efectivo e impersonación se validan backend. Recovery fue verificado antes de actividad legítima y después falla cerrado para preservar historia; no se ejecuta recovery real tras el alta/approval QA.
- **Límites:** cero cambios a `marketplace_products`, Panel Empresarial, ahorro, préstamos operativos, documentos maestros, Google, Apps Script, tasas, fondos, plazos o fórmulas. La única extensión financiera es el consumidor explícito de autoridades ya certificadas.
- **Aprobación:** `H-UNIVERSAL-PROGRAM-PRODUCT-PAYMENT-SIMULATOR-001`, precondición `ceec42d90a873fc5f47bec28bce3fa8f2208c1cf` y precisión JUB explícita del propietario, 2026-08-31.
- **Cierre owner:** el propietario autorizó `PASS_WITH_OWNER_DECISION` con evidencia no destructiva suficiente. Quedan marcados `DEFERRED_PRODUCTIVE_E2E` el recorrido posterior a una cotización productiva real y el reemplazo documental con archivo legítimo autorizado; no se crean cotizaciones, documentos ni datos sintéticos para certificar pruebas.

## ADR-088 — Bootstrap administrativo vacío de Suti Cirugías

- **Decisión owner:** Suti Cirugías debe aparecer en `Programas · Productos` aunque todavía no tenga productos. Market, Rifas y Terrenos quedan fuera de este cambio.
- **Autoridad:** la tarjeta vacía es estructura versionada; no es un producto ni una fuente paralela. Todo producto futuro existe exclusivamente en `program_catalog_items` y sus assets en `program_catalog_item_assets`/Storage.
- **Primer alta:** `create_first_cirugias_program_catalog_item` es una RPC dedicada que sólo acepta `program_key=cirugias`, exige `program_catalog.write`, bloquea concurrencia, valida la misma allowlist contractual, registra auditoría y crea procedencia `ADMIN_PROGRAM_CATALOG` sin hoja, ordinal o hash falsos. Después de la primera fila, el writer general vigente vuelve a ser el único writer CRUD.
- **Historia:** la activación agrega cero productos, cero assets y cero auditorías. La fuente histórica de Cirugías continúa sin demostrarse; no se inventa ni se importa contenido.
- **Recovery:** puede retirar únicamente la RPC dedicada mientras no exista fila ni auditoría de Cirugías; después aborta para preservar actividad administrativa legítima.
- **Límites:** cero cambios en Market, Rifas, Terrenos, `marketplace_products`, Google, Apps Script, documentos, tasas, fondos, plazos, cálculos o solicitudes.
- **Aprobación:** instrucción explícita del propietario “Sí, hazlo sólo para Cirugías”, 2026-08-31.

## ADR-089 — Modalidad comercial y estado Vendido de productos propios

- **Autoridad:** se extiende `program_catalog_items`; no se crea tabla de productos, copia Marketplace ni autoridad de UI. La representación mínima es `commercial_mode` con `PAYROLL_FIXED`, `PAYROLL_QUOTE` y `DIRECT_CONTACT`.
- **Semántica:** fijo conserva precio y plan universal; cotización conserva `requires_quote=true` y exige `quoted_amount` válido antes del mismo plan; contacto directo puede mostrar precio, pero carece de nómina, plazo, enganche, simulador y `program_request`.
- **Vendido:** `sold` es ortogonal a modalidad y `enabled`. Una fila activa sigue visible con badge y detalle, pero todas las acciones quedan bloqueadas. `sold_at/sold_by` conservan estado actual y `admin_audit_log` conserva transiciones y reactivaciones sin alterar `record_origin`.
- **Casa:** la auditoría de 35/35 filas demostró inmuebles de venta/renta con pago contado o crédito ajeno a SutiApp. Se clasificaron `DIRECT_CONTACT` conservando exactamente precio, procedencia, assets y disponibilidad; el contacto se resuelve por el contrato institucional existente de Suti Casa.
- **Backend:** un trigger `BEFORE INSERT` sobre `program_requests` deniega vendido/contacto directo y exige el snapshot `PROGRAM_PRODUCT_PAYMENT_V1` para una solicitud financiera. `financial-legacy` repite el bloqueo antes de crear sesión. Admin conserva el único writer RPC allowlisted.
- **Recovery:** backup privado conserva IDs, hash y definiciones previas de ambos writers. Recovery aborta ante filas, contenido, modalidad, vendido o historia Admin posterior y se verificó con `ROLLBACK`; no debe ejecutarse después de actividad Admin legítima.
- **Límites:** cero cambios en Marketplace, Panel Empresarial, Google, Apps Script, fórmulas, JUB/Proceso, fondos, tasas, plazos, amortización, documentos, resumen, firma, éxito o Historial.
- **Aprobación:** autorización productiva explícita del propietario para `H-PROGRAM-PRODUCT-COMMERCIAL-MODE-AND-SOLD-001` con el alcance completo de 135 filas, 2026-08-31.
