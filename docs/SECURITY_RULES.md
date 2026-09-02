# Reglas de seguridad

## Archivo reversible y Expediente Digital Admin — ADR-093

`archive_admin_affiliate` y `restore_admin_affiliate` son RPC `SECURITY DEFINER` con `search_path=''`, `auth.uid()`, `affiliates.write`, motivo y versión optimista. `anon` no ejecuta. La tabla técnica de recuperación fuerza RLS y no concede lectura al browser. El padrón normal y “Eliminados” son proyecciones separadas sobre `public.affiliates`; no existe tabla paralela ni `DELETE` de identidad o historia.

`get_effective_affiliate_id()` excluye archivados tanto para Auth directo como para impersonación. El inicio y la consulta de impersonación también los excluyen, y `program_requests_guard_archived_affiliate` deniega toda alta nueva incluso si otro writer intenta omitir la UI. La cuenta Auth se conserva; un administrador técnico puede seguir entrando a Administración, pero un afiliado archivado no obtiene identidad funcional de autoservicio. Restaurar no concede elegibilidad nueva: vuelve a aplicar el contrato vigente.

El Expediente Digital usa `list_admin_affiliate_documents` y `document-access` con objetivo y propósito explícitos. No devuelve rutas ni URLs en el listado; cada thumbnail/visor firma temporalmente un solo objeto privado. Reemplazo Admin crea versión enlazada, conserva la anterior y registra actor/motivo. Apply y verificación productiva confirmaron permisos, RLS, exclusión, `ARCHIVED_MATCH`, bloqueo de impersonación y recovery con `ROLLBACK`; 947 afiliados, 3,434 documentos, 15 solicitudes y 5 eventos quedaron idénticos, con 0 archivados y 0 escrituras de prueba persistentes.

## Tarjeta OR CLABE en Depósito — ADR-092

`save_affiliate_deposit_account` conserva `SECURITY DEFINER`, `search_path=''` e identidad derivada mediante `auth.uid()`/`get_effective_affiliate_id()`. El browser no elige afiliado ni titular: acepta únicamente Banco + Tarjeta válida o Banco + CLABE válida y valida ambas cuando ambas se proporcionan. `card_number` y `clabe` permanecen separados; la auditoría registra sólo presencia, nunca números completos.

La función revoca ejecución a `anon` y mantiene `authenticated` exclusivamente detrás de la validación backend. `affiliate_bank_accounts` conserva RLS habilitada/forzada y el listado de Depósito sigue limitado al afiliado efectivo, incluso para un actor con permisos Admin globales. La matriz productiva confirmó propietario permitido, cross-user/anónimo denegados, snapshot privado denegado y cero residuos de fixtures. El respaldo técnico de `20260901000100` tiene RLS habilitada/forzada y cero grants browser.

## Contrato delta-aware de guardado — ADR-091

La migración preparada mantiene `SECURITY DEFINER`, `search_path=''`, `auth.uid()`, `program_catalog.write`, allowlist, auditoría y DML directo revocado. `anon` no ejecuta; `authenticated` sólo cruza el writer si el permiso backend pasa. El respaldo de migración tiene RLS habilitada/forzada y cero grants para browser.

La tolerancia histórica es por fila y campo exactos, no una relajación global: sólo permite conservar el valor previo inválido o reducirlo. Assets nuevos siguen sujetos al trigger de ownership `program-products/<actor_real>/`. La matriz live confirmó RPC sin identidad denegada, DML directo cerrado, RLS forzada, grants mínimos, policies Storage, errores específicos y cero persistencia transaccional. `20260831000800` está activo y auditado.

## Modalidad comercial y Vendido — ADR-089

`commercial_mode`, `sold` y `sold_at` son lectura autenticada; `sold_by` permanece oculto al browser. DML directo sobre `program_catalog_items` sigue revocado y toda mutación Admin usa `save_program_catalog_item`, `program_catalog.write`, allowlist y auditoría antes/después. Ni modalidad ni vendido permiten editar `record_origin`, hoja, ordinal, hash o payload histórico.

`program_requests_catalog_requestability` protege toda inserción, incluso si un cliente evita la UI: vendido devuelve `PROGRAM_PRODUCT_SOLD`, contacto directo devuelve `PROGRAM_PRODUCT_DIRECT_CONTACT_ONLY`, cotización sólo admite su solicitud inicial y un beneficio financiero exige `PROGRAM_PRODUCT_PAYMENT_V1`. `financial-legacy` v32 repite vendido/contacto antes de abrir sesión. La matriz live confirmó DML directo Admin denegado, `sold_by` no legible y solicitud/Edge de Casa denegados; no se expone `service_role`.

## Bootstrap vacío de Suti Cirugías — ADR-088

`create_first_cirugias_program_catalog_item` es `SECURITY DEFINER` con `search_path=''`, exige `auth.uid()` y `program_catalog.write`, limita campos y `program_key`, y usa un advisory lock antes de comprobar que Cirugías siga vacío. `anon` no ejecuta; `authenticated` sólo alcanza una escritura efectiva si el permiso backend pasa. DML directo continúa revocado y el writer general no cambió. La matriz real confirmó anónimo, afiliado sin permiso y DML directo denegados, sin crear productos.

## Cuenta bancaria opcional en Depósito — ADR-085

Omitir cuenta no abre acceso bancario: el navegador envía `bank_account_id=NULL` y el writer service-only congela únicamente el celular propio confirmado. Si se proporciona un UUID, la rama ADR-081 revalida cuenta completa y pertenencia al afiliado efectivo antes del alta atómica. La tabla privada conserva RLS habilitada/forzada y cero grants browser; el helper bank-required tampoco es ejecutable directamente por `service_role`.

La matriz live mantiene autoservicio efectivo, cross-user denegado por RLS/RPC, anónimo denegado y snapshot privado denegado. Edge v30 conserva JWT y allowlist; frontend, logs, auditoría y screenshots contienen cero número bancario completo en el flujo opcional.

## Visibilidad del catálogo financiero — ADR-083

`finance_catalog_presentation` mantiene RLS habilitada y forzada. `authenticated` puede leer la configuración global de presentación; `anon` no tiene grant ni policy. La lectura global no contiene identidad, PII, reglas, tasas, fondos ni resultados financieros. Las escrituras continúan exclusivamente bajo la policy que exige `has_admin_permission('workflow.write')`; ocultar controles en UI no concede autoridad.

La prueba live confirmó dos lectores autenticados, anónimo denegado, identidad autenticada sin rol con UPDATE de cero filas y writer Admin autorizado. El frontend no contiene Secret Key, `service_role` ni segunda autoridad local.

## Notificaciones reales — ADR-082

`list_self_marketplace_quote_notifications()` y `mark_marketplace_quote_seen(uuid)` son `SECURITY DEFINER`, usan `search_path=''` y derivan `get_effective_affiliate_id()` sin aceptar selector de afiliado. El lector expone una proyección allowlisted de cotizaciones propias; el writer sólo acusa una respuesta propia completada. Ambos revocan `anon`; el `SELECT` directo de `program_requests` permanece revocado y su RLS continúa habilitada y forzada.

La UI no contiene secretos, `service_role`, PII de otros usuarios ni autorización basada sólo en estado local. La matriz live confirmó lectura/escritura propia, persistencia e idempotencia; H005_TEST3 no pudo leer ni marcar la cotización de H005_TEST2 y anónimo fue denegado. Los fixtures temporales se eliminaron por ID exacto.

## Plataforma central de requisitos documentales — ADR-078

`resolve_effective_document_requirements` acepta sólo contexto de entidad validado server-side y requiere Auth. `anon` no ejecuta el resolver. Catálogo y reglas revocan `INSERT/UPDATE/DELETE` directos a `authenticated`; las RPC administrativas vuelven a exigir `documents.write`, usan `SECURITY DEFINER`, `search_path=''`, validan destino/tipo/efecto/orden/motivo y escriben auditoría durable.

La carga exige ahora `p_source=CAMERA|FILE`; la firma antigua sin origen fue eliminada para impedir bypass de capacidades. El backend valida origen, MIME, tamaño, hash, propiedad y ruta privada. Autoservicio continúa derivando el afiliado efectivo y Administración continúa requiriendo objetivo explícito; el resolver de requisitos nunca amplía el expediente ni firma objetos. El browser no contiene `service_role`, secretos, rutas privadas o URLs persistentes.

## Bitácora administrativa de solicitudes financieras — ADR-076

`program_request_admin_events` tiene RLS habilitada y forzada, y `anon`/`authenticated` no reciben grants directos sobre la tabla. La lectura ocurre exclusivamente mediante `get_program_request_admin_events`, que exige `program_requests.read`, limita el dominio a solicitudes financieras y no proyecta UUID del actor ni claves de idempotencia. La escritura browser usa `record_program_request_admin_action`, exige `program_requests.write`, deriva el actor desde `auth.uid()`, valida transición y motivo, y deduplica por `client_action_id`.

La aprobación continúa detrás de Edge `financial-legacy`: JWT, origen y permisos se validan antes de invocar la sobrecarga service-only de `approve_financial_program_request`, que agrega el evento `APPROVE` atómicamente con el snapshot contractual. El frontend no contiene `service_role`, secretos ni autorización basada sólo en UI. Los documentos permanecen en el bucket privado; cada vista requiere permisos documentales y una URL firmada temporal.

## Admin Afiliados — ADR-071

Leer padrón/perfil exige `affiliates.read`; crear, editar o cambiar estado exige `affiliates.write`; atención asistida exige `affiliates.impersonate`; exportar XLSX exige `data_exports.read`. Los controles de UI sólo reflejan capacidades: cada RPC vuelve a autorizar con `has_admin_permission()`, `SECURITY DEFINER` y `search_path=''`. Anónimo y usuario normal fueron denegados en la matriz live.

Los writers aceptan campos allowlisted, motivo de 8–500 caracteres y `updated_at` esperado para evitar pérdida de cambios. RFC, CURP y número de control pasan por revisión de duplicados; el correo duplicado se marca para revisión y no crea identidad Auth. `affiliate_admin_events` tiene RLS forzada, lectura restringida y cero grants directos de INSERT/UPDATE/DELETE. La baja es administrativa y preserva documentos, solicitudes, Auth e histórico. La exportación permanece detrás del Edge allowlisted y `no-store`; el navegador no puede enviar SQL, tabla o columnas arbitrarias.

## Estado PROFILE PHOTO CUTOVER

Las 487 fotos `Photo/DK` se leen exclusivamente desde `affiliate_files` y el bucket privado `private-assets`. `AffiliateRepository` solicita una URL firmada de una hora después de que RLS autoriza la relación; el caché de 50 minutos se indexa por principal Auth + `affiliate.id`, vive solo en memoria y se vacía en login/logout. H005_TEST2 y H005_TEST3 no pueden leer metadata ni firmar el objeto del otro; anónimo es denegado. H005_TEST puede hacerlo solo por su permiso Admin `assets.read`. La matriz real no detectó fuga cruzada y no expone `source_url`, Secret Key ni `service_role` al frontend.

- Secretos, claves privadas y `service_role` nunca se exponen en frontend, bundle, repositorio o logs.
- Autorización y permisos se validan en backend/RLS; ocultar controles en UI no protege datos.
- Aplicar mínimo privilegio y denegación por defecto. Usuarios normales no elevan sus roles.
- Separar autenticación de identidad de negocio: Auth puede faltar; `numero_control` permanece.
- Validar acceso cruzado entre usuarios y organizaciones en backend.
- Acciones sensibles generan auditoría íntegra, durable y no controlada solo por el cliente.
- La futura impersonación requiere autorización específica, duración/acotación, motivo, audit log y separación de `actor_real`/`usuario_contexto`; nunca usa la contraseña del afiliado.
- RLS, roles, funciones y APIs se revisan conjuntamente; una policy aislada no basta.
- Errores no revelan secretos ni habilitan una autoridad alternativa.

## Estado H-000

El frontend tiene autenticación y roles simulados en `localStorage`; cualquier contraseña de al menos tres caracteres permite entrar a paneles. Esto es aceptable únicamente como prototipo explícito y es `FAIL` como control productivo. No hay Supabase, backend ni RLS que auditar todavía.

## Estado H-004

Supabase y `public.affiliates` están activos. La tabla tiene RLS habilitada y forzada; `anon` no tiene `SELECT` y `authenticated` solo puede leer la fila donde `(select auth.uid()) = auth_user_id`. No existen policies de escritura para clientes. H-004 creó 0 cuentas Auth y 0 vínculos. La Secret Key moderna se usa exclusivamente en el importador administrativo mediante `apikey`; no está en frontend, bundle, documentación ni archivos versionables.

## Estado H-005

El login de afiliados usa email/contraseña de Supabase Auth, persistencia y refresh del cliente oficial, y logout remoto. La identidad se resuelve por `auth.uid()` y `auth_user_id`; `numero_control`, email, `DATA.user`, viewer y estado propio del navegador no eligen al afiliado. Las pruebas reales de tres cuentas controladas confirmaron fila propia permitida, resolución exacta por sesión y logout; la cuenta base también conserva verificación de fila ajena filtrada por RLS y anónimo denegado. La activación masiva, recuperación de contraseña, administración e impersonación no fueron implementadas. Las credenciales H-005 y claves administrativas permanecen exclusivamente en `supabase.env` ignorado.

## Estado H-006

TopBar, Inicio, Perfil y Credencial reciben una única proyección en memoria de la fila autorizada por RLS. No consultan por `numero_control`, email ni UUID aportado por la UI y no recurren a mocks cuando Supabase falla. Se retiraron de estas áreas la foto y los datos bancarios persistidos localmente; sin foto autoritativa se muestra placeholder. El correo histórico se presenta únicamente como dato de contacto. No se cachean respuestas Supabase/PII en el service worker y no se incorporaron secretos ni nuevas cuentas Auth.

## Estado H-007

Las cuatro tablas de contenido público tienen RLS habilitada y forzada. `anon` y `authenticated` reciben únicamente `SELECT` mediante una policy pública por tabla; no existen grants ni policies cliente de `INSERT`, `UPDATE` o `DELETE`. Las escrituras futuras requieren otra H y un canal administrativo autorizado. Los repositorios frontend usan solo la clave publicable. El importador usa `SUPABASE_SECRET_KEY` desde `supabase.env` ignorado, con `service_role` únicamente como compatibilidad legacy; no registra secretos. La tabla informativa de Finanzas excluye datos de inversión/rendimiento y no concede acceso a sistemas financieros Google.

## Estado H-007.2

Los registros visuales y sus tres buckets (`app-assets`, `company-assets`, `documents`) son de lectura pública porque el alcance importado contiene exclusivamente banners, imágenes institucionales, branding y documentos públicos. Las seis tablas tienen RLS habilitada y forzada; cinco exponen solo `SELECT`, mientras `asset_sources` conserva procedencia y URL histórica sin grant al navegador. No existen grants ni policies de escritura para clientes y Storage solo permite lectura de objetos públicos. El importador administrativo valida firma/MIME, tamaño y SHA-256 antes de subir, usa `SUPABASE_SECRET_KEY` solo en proceso local y no incorpora credenciales al frontend, bundle, logs o documentación. No se importó contenido privado ni se crearon cuentas Auth.

## Estado H-007.3

El directorio público expone datos históricos de presentación e imágenes públicas mediante `CompaniesRepository`; la consulta runtime no solicita campos de contacto, identidad legal, Auth, planes ni permisos. `companies`, `company_assets` y `popups` conservan RLS habilitada y forzada, sin grants de escritura para `anon` o `authenticated`. Las 33 empresas se vinculan a 35 objetos existentes de `company-assets`; no se copiaron URLs Glide al runtime. Los tres popups permanecen deshabilitados y la lectura pública devuelve cero. La importación administrativa usó la Secret Key sólo desde `supabase.env` ignorado y no creó cuentas Auth; el conteo sigue en tres cuentas controladas. Ahorro, Préstamos y Google financiero no fueron leídos ni modificados.

## Estado Ícono e instalación

`public.app_settings` tiene RLS habilitada y forzada, policy pública exclusiva de `SELECT` y cero grants/policies de escritura para `anon` o `authenticated`. Storage conserva únicamente su policy pública de lectura H-007.2. Como el acceso Admin del prototipo acepta cualquier contraseña de tres caracteres, ningún control de esa pantalla puede escribir; ocultar o mostrar un botón no se considera autorización. Las escrituras autorizadas usan exclusivamente el sincronizador server-side y la Secret Key local ignorada. La prueba reversible confirmó upload, registro `app_assets`, lectura desde dos clientes, persistencia y restauración, y eliminó el asset temporal. Auth mantuvo tres cuentas; ningún secreto pasó a bundle, logs o documentación.

## Estado H-008

H-008 sustituye el estado anterior: Supabase Auth es la única autoridad de sesión administrativa. `public.admin_assignments` contiene exactamente una asignación habilitada, vinculada al `auth_user_id` de H005_TEST, con diez permisos visuales explícitos; H005_TEST2 y H005_TEST3 no tienen asignación. El cliente solo puede leer su propia asignación y no tiene grants ni policies para promoverse. Las tablas y buckets administrativos validan cada escritura mediante `has_admin_permission()` y RLS; `admin_audit_log` es escrito por triggers y no por autoridad del cliente.

Pruebas reales confirmaron H005_TEST Admin/settings/Storage/instalación `PASS`; H005_TEST2, H005_TEST3 y anónimo `DENIED`; dos clientes adicionales observaron el cambio y el estado original fue restaurado. No se modificaron credenciales ni se expusieron Secret Key, `service_role`, DB password o Access Token. Los módulos sin repositorio Supabase seguro permanecen bloqueados.

## Estado H-009

El CRUD de branding, banners, popups, empresas, logos/portadas y documentos/PDF usa la sesión H-008 y policies backend por permiso. Los grants de `app_settings`, `companies`, `banners`, `popups` e `institutional_documents` están limitados por columna; el navegador no puede alterar coordenadas históricas ni asignaciones administrativas. Usuarios normales conservan lectura pública de filas activas y reciben denegación de tablas/Storage al escribir.

Las pruebas reversibles confirmaron create/update/replace/deactivate para cuatro dominios, Storage, dos clientes, filtros de desactivados y auditoría; H005_TEST2/H005_TEST3 fueron denegados. Chrome validó los cuatro módulos, un ciclo UI real de popup y branding, refresh y logout. Secret Key se usó solo por arneses locales ignorados para schema/cleanup y no ingresó al frontend o bundle.

## Estado MASTER Phase 1

La activación gradual vincula únicamente un email Auth confirmado con una sola fila `eligible` por coincidencia normalizada; no usa `numero_control`, no inventa email y no borra afiliados inelegibles. La recuperación usa `resetPasswordForEmail`, evento `PASSWORD_RECOVERY` y `updateUser`; la respuesta visible no confirma si una cuenta existe.

La impersonación se autoriza en backend con `affiliates.impersonate`, motivo de 8–500 caracteres, TTL máximo de 30 minutos, sin anidamiento y con cierre explícito. RLS permite leer únicamente el afiliado efectivo. Auditoría separa el principal `actor_real_auth_user_id` del `usuario_contexto_affiliate_id`; credenciales, Auth, permisos e históricos no se sustituyen. Solo H005_TEST recibió permisos; H005_TEST2/3 y anónimo permanecen denegados. La reconciliación mantuvo 947 afiliados y 3 cuentas Auth.

## Estado MASTER Phase 3

Las nueve tablas comerciales tienen RLS habilitada y forzada. Lectura pública expone solo catálogo habilitado/aprobado; favoritos y solicitudes personales se aíslan por `auth.uid()` y afiliado efectivo. Un miembro de `marketplace_company_memberships` puede operar únicamente su `company_id`, leer su bandeja y responder cotizaciones; no puede escribir productos o promociones de otra empresa. El cliente no puede autoasignar membresías.

Las pruebas reversibles con tres usuarios confirmaron Admin CRUD, usuario normal denegado, favoritos privados, bandeja empresarial visible, respuesta de cotización, denegación cross-company y denegación de inserts/updates directos sobre solicitudes. Creación, respuesta y marca de visto usan RPC; firma y aceptación se validan en backend. Todos los fixtures y membresías se eliminaron; la reconciliación final dejó cero productos, solicitudes, cotizaciones y membresías productivas. Secret Key se utilizó solo en arneses locales de schema/cleanup y no entró al bundle.

## Estado MASTER Phase 4

`membership_offerings` tiene RLS habilitada y forzada. Usuarios normales solo leen ofertas activas; H005_TEST administra por `memberships.read/write`. Grants por columna impiden modificar hoja, ordinal, Row ID, hash y origen; RLS permite borrar únicamente filas `ADMIN_PHASE4`. La suite reversible confirmó lectura 6/6, seis assets Storage, writer normal denegado, desactivación oculta, CRUD administrativo y cleanup.

`Solicitudes membresía` no se importó ni se escribió: PII, documentos, estados y descuento por nómina permanecen Google legacy. Ningún secreto ni documento personal ingresó al frontend, snapshot Phase 4 o Supabase.

## Estado MASTER Phase 5

Mi Historial consulta solo las filas que RLS Phase 3 permite al afiliado efectivo en `marketplace_benefit_requests` y `marketplace_quote_requests`. `operationsStore` es memoria descartable; no acepta IDs aportados por la UI para ampliar acceso ni conserva PII en browser storage. Chrome confirmó una solicitud real, tracking y timeline con H005_TEST2; el fixture fue eliminado y la reconciliación volvió a cero.

## Estado MASTER Phase 6

`company_portal_plans` y `company_portal_subscriptions` tienen RLS habilitada y forzada. H005_TEST administra mediante permisos `company_portal.read/write`; usuarios normales no escriben y un miembro empresarial solo puede leer el plan y la suscripción de su `company_id`. Las altas, cambios y bajas de `marketplace_company_memberships` requieren el mismo permiso administrativo y no habilitan autoasignación.

La aplicación remota verificó dos tablas vacías, cuatro policies del portal, tres policies administrativas de membresía, cuatro triggers de timestamp/auditoría, dos índices y ocho grants autenticados. La prueba multiusuario usó tres sesiones y dejó cero registros; Chrome confirmó el módulo de Planes con 33 empresas y estado pendiente. Afiliados, Auth, empresas e históricos conservaron sus conteos.

## Estado MASTER ASSET EVACUATION

`historical_file_columns`, `private_assets`, `historical_asset_sources` y `affiliate_files` tienen RLS habilitada y forzada. `private-assets` es privado y solo permite lectura al afiliado propietario o admin autorizado; acceso cruzado, anónimo y escrituras normales fueron denegados con tres sesiones reales. `source_url` permanece oculto a usuarios normales y se conserva únicamente como procedencia administrativa.

El importador valida HTTP, firma/MIME real, tamaño y SHA-256, rechaza HTML/error pages, deduplica por hash y no sobrescribe objetos con contenido distinto. Ningún secreto entra al repositorio o navegador. Los archivos de Ahorro/Préstamos se preservan como `PENDING_DOMAIN_LINK` sin modificar Google ni crear un runtime financiero Supabase. Los tres archivos inaccesibles no recibieron sustitutos inventados.

## Writer final de préstamo aprobado

`financial_request_export_audit` tiene RLS habilitada y forzada; browser solo puede leerla con `program_requests.read` y nunca ejecutar las RPC de transición, concedidas exclusivamente a `service_role`. Edge valida JWT, origen, `program_requests.write` y `workflow.write`; deriva solicitud, afiliado, perfil, documentos y snapshot sin aceptar flags financieros del frontend. Secrets de Apps Script/Supabase se configuraron en cloud y no se imprimieron ni versionaron.

Los documentos permanecen en `private-assets`; Google recibe solo referencias opacas `private_asset_id + SHA-256`, sin `source_url`, signed URL persistente ni cambio de policy/bucket. Apps Script valida secreto, workbook/sheet IDs, 38 headers y payload bajo `LockService`. El registry técnico evita doble append y no contiene documento, firma, nombre o teléfono adicionales fuera de la fila legacy autorizada.

## Snapshot financiero personalizado de sesión

`financial_session_snapshots` usa RLS habilitada y forzada, cero policies/grants para `anon` o `authenticated` y CRUD sólo para `service_role`. La RPC `resolve_current_loan_snapshot_quote` es `authenticated`-only y `SECURITY DEFINER` con `search_path=''`; deriva actor desde `auth.uid()`, afiliado desde `get_effective_affiliate_id()` e impersonación desde backend antes de leer internamente una sola fila. La tabla nunca se expone. Una sesión de otro afiliado, actor o impersonación devuelve `SNAPSHOT_INVALID`; el intento cruzado no invalida la fila legítima del propietario.

Cada cotización verifica TTL, `financial_profile_version`, fingerprints de perfil/política/batch, personalización completa y versión de cálculo. El browser sólo envía `snapshot_id`, criterio/fondo, monto y plazo; intentos de enviar tasa, máximo, elegibilidad o perfil no coinciden con la firma y se rechazan. El resolver matemático interno sólo es ejecutable directamente por `service_role`; la RPC autenticada lo invoca tras todos los controles. Confirmar revalida contra criterios Supabase activos y usa una RPC de alta ejecutable únicamente por service role; el trigger bloquea el alta financiera antigua por browser y hace inmutable `financial_submission_snapshot`.

## Autoridad de criterios financieros Supabase — ADR-065

Las tablas `financial_criteria_import_batches`, `financial_criteria_authority`, `financial_programs`, `financial_funds`, `financial_rules` y `financial_configuration_audit` tienen RLS habilitada y forzada y niegan acceso directo a `anon`/`authenticated`. El runtime completo sólo se proyecta por `get_financial_runtime_rules()` a `service_role`; el browser no puede descargar reglas globales. Las RPC Admin son `SECURITY DEFINER`, `search_path=''`, validan permisos granulares, confirmación y motivo, crean versiones y auditoría e invalidan snapshots. Responsable no autorizado, usuario normal y anónimo quedan denegados. El Edge canary y su RPC shadow fueron eliminados después del corte.

## Exportaciones operativas Admin

La exportación no concede acceso por existir una tarjeta UI. `data-exports` exige JWT válido, origen permitido y `data_exports.read` o la acción granular exacta `export`; leer, editar o publicar una sección no implica descargarla. Afiliados, solicitudes, membresías, catálogos maestros y auditoría son dominios reservados al permiso técnico global.

La consulta privilegiada ocurre sólo después del permiso y usa un registro server-side inmutable de tabla, columnas y filtros. El navegador no envía SQL, tabla, columnas, orden ni URL Storage. Se excluyen `auth_user_id`, firmas, claves de idempotencia, `source_payload`, hashes/rutas internas, tokens y credenciales. CSV/XLSX neutraliza celdas que podrían interpretarse como fórmulas. Las respuestas usan `private, no-store`, no se guardan en Storage y la auditoría persiste actor, dominio, filtros validados, conteo, formato y fecha, no las filas.

## Nómina declarada para simulación de préstamo

`affiliate_payroll_declarations` y su auditoría tienen RLS habilitada y forzada, sin grants directos para `anon` o `authenticated`. Las tres RPC derivan identidad desde `auth.uid()`; sólo el afiliado Auth vinculado puede escribir y la existencia del afiliado sigue sin depender de Auth. La escritura queda denegada si existe contexto de impersonación, conserva `actor_real_auth_user_id`, valida rangos y usa versión optimista.

ADR-051 sustituye esa última restricción sólo para asistencia válida: cualquier asignación administrativa activa puede abrir una sesión no anidable, con motivo y TTL de 30 minutos, y solicitar préstamo/capturar nómina declarada para el afiliado contexto. RPC y triggers registran actor real, contexto, sesión y motivo; anónimo y usuario normal no pueden impersonar. Ningún secreto, `service_role` ni autorización sólo UI entra al frontend.

La proyección de impacto se ejecuta server-side con el pago previamente resuelto por Google. El frontend no recibe secretos ni puede elegir otro afiliado. La matriz live confirmó lectura/escritura propia, aislamiento H005_TEST2/H005_TEST3, anónimo denegado y tabla directa denegada; la prueba restauró el estado y dejó cero declaraciones QA. El 30% no concede permiso ni decisión de negocio.

## Expediente, banco, solicitudes y QR — 2026-08-25

`affiliate_documents`, `request_documents`, `affiliate_bank_accounts`, `program_terms_versions`, `credential_qr_settings`, `credential_qr_tokens` y `sensitive_change_audit` usan RLS habilitada y forzada. Los writers sensibles son RPC `security definer` con `search_path=''`, identidad derivada desde Auth/contexto y permisos administrativos existentes; `credential_qr_tokens` no concede lectura directa al cliente.

Los archivos siguen en `private-assets`; afiliado y Admin autorizado reciben únicamente URL firmada temporal. La bandeja de revisión firma por 300 segundos y no expone paths públicos. La matriz bancaria final confirmó: anónimo 401, cruce A↔B 0, cada afiliado ve sólo su fila y Admin ve 504 exclusivamente por `bank_accounts.read`; los CRUD de prueba fueron reversibles. El listado enmascara identificadores y la auditoría conserva acciones/booleanos, nunca números completos.

Para el flujo documental de solicitudes, las RPC de autoservicio son `SECURITY DEFINER`, usan `search_path=''`, derivan el afiliado efectivo y no aceptan selector de afiliado. Las RPC Admin son distintas, exigen `documents.read` y objetivo explícito. El listado devuelve metadatos y disponibilidad sin bucket, path ni URL; `document-access` valida JWT, modo, propósito y pertenencia, firma exactamente un objeto por 300 segundos con secreto sólo server-side y falla cerrado si no puede auditar. Anónimo, cruce entre afiliados y elevación Admin dentro de autoservicio quedan denegados. `request_documents_require_available_object` conserva el gate final backend.

`document_access_audit_log` tiene RLS habilitada y forzada, escritura browser revocada y lectura limitada a `documents.read`. Cada evento conserva actor real, afiliado efectivo/objetivo, documento, propósito, modo, sesión de impersonación y fecha; `access_context` usa allowlist técnica y prohíbe URL firmada, token o ruta Storage. La Edge responde `private, no-store` y el frontend no contiene `service_role`, Secret Key ni firma directa de Storage.

La URL del QR se construye localmente desde una ruta validada y un token de 64 caracteres; no usa API externa ni introduce nombre, CURP, número de control, banco o documento. El servicio no admite redirects arbitrarios porque `destination_path` está restringido por constraint y sólo Admin `content.write` puede cambiar la política.

## Timeline versionado de solicitudes — 2026-08-30

Las tablas de workflows y tracking conservan RLS. Un usuario autenticado normal no puede enumerar la configuración global; el afiliado sólo obtiene la proyección de solicitudes propias mediante RPC `SECURITY DEFINER` con `search_path=''` e identidad derivada en backend. Administración requiere `workflow.read` para lectura y `workflow.write` para mutación; la UI no concede autoridad.

`program_requests.workflow_snapshot` es inmutable. Los triggers validan resolución única, etapa inicial, estados canónicos y tracking perteneciente al snapshot. `operational_workflow_change_audit` fuerza RLS y conserva actor real, razón y valores antes/después; `anon` y browser normal no escriben directamente. El frontend no contiene `service_role`, secretos ni una segunda autoridad local.

## Carga documental desde Admin Afiliados — 2026-08-27

`register_admin_affiliate_document` es `SECURITY DEFINER` con `search_path=''`, exige `documents.write` y deriva al actor desde `auth.uid()`. El UUID del afiliado sólo selecciona el expediente destino después de validación backend; tipo, ruta, owner, MIME, tamaño, hash y motivo se vuelven a validar. El objeto vive únicamente en `private-assets`, entra como `PENDING_REVIEW`, no sustituye un `VERIFIED` y deja auditoría durable sin secretos.

La policy Storage usa `can_admin_upload_affiliate_document_path(text)`, un guard booleano que comprueba permiso y existencia del UUID sin proyectar campos ni conceder `SELECT` directo sobre el padrón. `can_delete_unreferenced_affiliate_document_object(text)` comprueba referencias con privilegio backend, por lo que una policy nunca confunde una fila oculta por RLS con un objeto huérfano. Usuario normal, anónimo y el borrado de un objeto referenciado fueron denegados; una carga real reversible confirmó persistencia privada y restauró documentos/assets/objetos/auditoría a sus conteos iniciales. `service_role` y Secret Key permanecen fuera del frontend y del bundle.

## Gate de compatibilidad Auth previo a Pages — 2026-09-01

Toda dependencia RPC obligatoria de la resolución de sesión debe verificarse contra el backend productivo antes de construir o desplegar GitHub Pages. El probe usa exclusivamente la publishable key y debe obtener denegación explícita de ejecución anónima; `404/PGRST202`, respuesta de infraestructura inesperada o `2xx` bloquean el despliegue. El gate nunca recibe credenciales elevadas ni sustituye las pruebas autenticadas de RLS.
