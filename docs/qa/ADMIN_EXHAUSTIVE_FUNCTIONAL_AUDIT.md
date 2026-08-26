# SutiApp — Admin Exhaustive Functional Audit

Fecha: 2026-08-26
Alcance: Dashboard/Admin completo, incluidos accesos visibles, vistas internas y rutas condicionadas.
Modo: auditoría de solo lectura; **0 escrituras productivas y 0 cambios de aplicación**.

## Executive summary

El Admin no puede declararse seguro ni funcionalmente completo. Los 28 módulos principales abren para Super Admin y la barrera de acceso negó correctamente el panel a dos usuarios normales y a una sesión anónima. Sin embargo, la correlación UI → handler → autoridad → consumidor encontró un riesgo de pérdida de datos y seis fallas de flujo críticas.

El hallazgo más grave es el botón **“Restaurar contenido original”** de Tu Sindicato: no restaura una fuente original; elimina todos los bloques y deja la pantalla vacía y despublicada. También hay editores que aparentan ser productivos pero no guardan lo que muestran: Secciones, Menús y Formularios; recomendaciones y atributos avanzados del Catálogo de Finanzas; la clave de catálogos; e imágenes respaldadas únicamente por `localStorage`.

Las cifras usan tres denominadores distintos para evitar precisión falsa:

- **36 contextos de pantalla** descubiertos: menú, 28 módulos principales y 7 vistas internas/condicionadas.
- **2,268 instancias de control** observadas en 46 superficies renderizadas; 2,251 visibles y 2,217 habilitadas.
- **387 constructores interactivos** encontrados en los 20 archivos `screens-admin*.jsx`: 261 botones/`Btn`, 104 `input`/`select`/`textarea` y 22 `Toggle`. Los controles repetidos por cada registro cuentan una sola vez en este inventario estático.

| Métrica solicitada | Resultado | Criterio |
|---|---:|---|
| Admin screens discovered | 36 | 28 módulos + menú + 7 contextos internos |
| Admin primary modules tested | 28/28 | apertura real con Playwright |
| Browser surfaces captured | 46 | pantallas y diálogos seguros |
| Controls discovered | 2,268 runtime / 387 constructores | evidencia automática + código |
| Controls inspected | 2,268 | visibilidad, habilitación, etiqueta y contexto |
| Safe activation paths tested | 45 | 28 aperturas de módulo + 17 aperturas de editor |
| WORKING | 44 | rutas activadas que abrieron la superficie prevista |
| PARTIALLY_WORKING | 5 | familias con escritura parcial o cobertura incompleta |
| BROKEN | 1 | vista “Quién puede editar textos” |
| DEAD_CONTROL | 8 | familias no-op o sin apertura/persistencia real |
| UI_ONLY | 3 | Secciones, Menús, Formularios |
| LOCAL_ONLY | 2 | imágenes de Convenios y Catálogo de Finanzas |
| WRONG_AUTHORITY | 2 | `localStorage` de imágenes y fallback `DATA` |
| STUCK demonstrated | 0 | no se observó bloqueo persistente |
| PURPOSE_CONFIRMED | 31 | contextos con cadena coherente |
| PURPOSE_INFERRED | 2 | recomendaciones y autorización individual de textos |
| PURPOSE_UNKNOWN | 1 | significado de “contenido original” sindical |
| PURPOSE_CONFLICT | 7 | UI y comportamiento/autoridad contradicen |
| MISSING_ADMIN_CAPABILITY | 5 | capacidades declaradas sin writer productivo |
| ADMIN_ORPHAN_CAPABILITY | 1 | editor individual de textos sin autoridad/consumidor demostrable |
| Permission defects | 2 | acciones destructivas sin guard de UI específico |
| Persistence defects | 8 | familias de cambios que no guardan lo ofrecido |
| Frontend reflection defects | 5 | UI promete reflejo que no puede ocurrir |
| UX problems | 13 | operabilidad, feedback, accesibilidad o claridad |
| Design opportunities | 8 | propuestas no implementadas |

`WORKING` no significa que se haya mutado producción: significa que la ruta segura ejercitada abrió y respondió. Toda escritura no ejecutada está marcada `CODE_VERIFIED / NOT_LIVE_MUTATED`. La evidencia runtime completa está en [admin-playwright-20260826.json](evidence/admin-playwright-20260826.json).

**Final Admin status: CRITICAL.** Existe un control destructivo etiquetado como restauración y varios controles productivos que no persisten o persisten solo localmente.

## Método y límites

Se aplicó Architecture Registry first, navegación real y lectura dirigida únicamente cuando apareció un fallo, contradicción, autoridad sensible o riesgo alto.

- Architecture Registry: el lookup ubicó Admin, documentos, permisos y repositories. El registro estaba `STALE` por documentación ajena al enrutamiento Admin; el código actual fue la evidencia prevalente.
- Navegador: Playwright Core con Google Chrome, viewport 430 × 932, sesión Super Admin, dos usuarios normales y sesión anónima.
- `agentic-browser-testing`: la skill solicitada no está instalada/disponible en este entorno; no se simuló su uso. Playwright realizó el recorrido humano equivalente disponible.
- Escrituras: no se ejecutaron guardar, eliminar, restaurar, publicar, upload ni drag/drop sobre producción. El repositorio prohíbe usar datos financieros/Google sin auditoría y no existía un dataset desechable autorizado.
- Persistencia: `SAVE → REFRESH → VERIFY` queda `NOT_LIVE_MUTATED` salvo donde la cadena está demostrada por repository, test y consumidor. Un toast nunca se aceptó como prueba.
- Origen local: las Edge Functions de exportaciones y Google legacy rechazaron `http://127.0.0.1:<puerto>` por CORS. Esto limita esas pruebas live, pero no prueba un fallo en el origen productivo permitido.

## Architecture and authority map

| Dominio | UI → handler/repository | Autoridad | Consumidor |
|---|---|---|---|
| Identidad/expediente | `IdentityAccessModule` → `AdminRepository`/`DocumentWorkflowRepository` | Supabase DB + Storage + RPC | Perfil, expediente, credencial e impersonación |
| Exportaciones | `DataExportsModule` → `DataExportRepository` → Edge Function | Supabase DB + Edge | Descarga administrativa auditada |
| Contenido visual | módulos visuales → `AdminRepository.saveManaged` | Supabase DB + Storage | Noticias, educación, convenios, banners, empresas, documentos, minutas, programas |
| Autorización | Roles/Pantallas/Catálogos → `AdminCutoverRepository` | Supabase DB + RLS | Gate Admin y segmentación frontend |
| Solicitudes no financieras | Requests/Flujos → repositories productivos | Supabase DB | Seguimiento operativo y frontend de solicitudes |
| Finanzas | Admin financiero → Edge/Google controlado; presentación → Supabase | Google legacy protegido + Supabase presentation | Finanzas y seguimiento |
| Estructura app | Secciones/Menús/Formularios | Código versionado | Frontend estático; **no writer Admin** |
| Slots genéricos de imagen | `<image-slot>` | **`localStorage`** | Solo el mismo navegador; no autoridad productiva |

## Admin screen inventory

Todas las rutas comparten `#admin`; la navegación interna usa `view:<id>` y no URLs independientes.

| ID | Pantalla | Ruta interna | Nav | Permiso de entrada | Propósito | Autoridad primaria | Consumidor | Estado |
|---|---|---|---|---|---|---|---|---|
| admin_menu | Panel de administración | `#admin` | sí | asignación Admin | PURPOSE_CONFIRMED | Supabase authorization | Admin | WORKING |
| identity_access | Identidad y expediente | `view:identity_access` | sí | `affiliates.read` o asignación amplia | PURPOSE_CONFIRMED | SUPABASE_DB/STORAGE | perfil, expediente, credencial | PARTIALLY_WORKING |
| data_exports | Datos y respaldos | `view:data_exports` | sí | `data_exports.read` | PURPOSE_CONFIRMED | EDGE/SUPABASE_DB | archivos XLSX/CSV | BROWSER_LIMITED |
| popups | Pop-ups por pantalla | `view:popups` | sí | `popups.read` | PURPOSE_CONFIRMED | SUPABASE_DB/STORAGE | popup renderer | WORKING_CODE_VERIFIED |
| sindicato | Tu Sindicato | `view:sindicato` | sí | `union_content.read` | PURPOSE_CONFIRMED | SUPABASE_DB/STORAGE | nueve destinos sindicales | **BROKEN_RISK** |
| requests | Solicitudes | `view:requests` | sí | `program_requests.read` | PURPOSE_CONFIRMED | SUPABASE_DB | seguimiento de trámites | WORKING_CODE_VERIFIED |
| finanzas | Finanzas · Solicitudes | `view:finanzas` | sí | `program_requests.read` | PURPOSE_CONFIRMED | SUPABASE_DB + GOOGLE_LEGACY | operación financiera | PARTIALLY_WORKING |
| fondos | Fondos y reglas | `view:fondos` | sí | `financial_criteria.visibility.read` | PURPOSE_CONFIRMED | GOOGLE_LEGACY controlado | visibilidad financiera | BROWSER_LIMITED |
| fincat | Catálogo de Finanzas | `view:fincat` | sí | `workflow.read` | PURPOSE_CONFLICT | código + SUPABASE_DB + LOCAL | pantalla Finanzas | **BROKEN/PARTIAL** |
| flujos | Etapas y seguimiento | `view:flujos` | sí | `workflow.read` | PURPOSE_CONFIRMED | SUPABASE_DB | solicitudes/timeline | PARTIALLY_WORKING |
| marketplace | Marketplace | `view:marketplace` | sí | `marketplace.read` | PURPOSE_CONFIRMED | SUPABASE_DB/STORAGE | marketplace | WORKING_CODE_VERIFIED |
| aprobaciones | Aprobación de Pop-ups | `view:aprobaciones` | sí | `popups.read` | PURPOSE_CONFIRMED | SUPABASE_DB/STORAGE | popups de empresa | PARTIALLY_WORKING |
| planes | Planes de empresas | `view:planes` | sí | `company_portal.read` | PURPOSE_CONFIRMED | SUPABASE_DB | portal de empresa | WORKING_CODE_VERIFIED |
| membresias | Membresías | `view:membresias` | sí | `memberships.read` | PURPOSE_CONFIRMED | SUPABASE_DB | oferta y solicitud de membresías | WORKING_CODE_VERIFIED |
| noticias | Noticias del sindicato | `view:noticias` | sí | `news.read` | PURPOSE_CONFIRMED | SUPABASE_DB/STORAGE | noticias frontend | WORKING_CODE_VERIFIED |
| education | Educación y tutoriales | `view:education` | sí | `content.read`/sección | PURPOSE_CONFIRMED | SUPABASE_DB/STORAGE | educación/tutoriales | WORKING_CODE_VERIFIED |
| convenios | Convenios y beneficios | `view:convenios` | sí | `companies.read`/sección | PURPOSE_CONFLICT | SUPABASE_DB/STORAGE + LOCAL | convenios frontend | PARTIALLY_WORKING |
| catalogos | Catálogos de segmentación | `view:catalogos` | sí | `segmentation.read` | PURPOSE_CONFIRMED | SUPABASE_DB | políticas y audiencias | PARTIALLY_WORKING |
| roles | Roles y permisos | `view:roles` | sí | `authorization.read` | PURPOSE_CONFLICT | SUPABASE_DB | gate Admin | **BROKEN_SUBVIEW** |
| pantallas | Acceso a pantallas | `view:pantallas` | sí | `segmentation.read` | PURPOSE_CONFIRMED | SUPABASE_DB/RLS | navegación frontend | WORKING_CODE_VERIFIED |
| secciones | Secciones y componentes | `view:secciones` | sí | `content.read` | PURPOSE_CONFLICT | CODE_STATIC | frontend | **UI_ONLY** |
| banners | Banners | `view:banners` | sí | `banners.read` | PURPOSE_CONFIRMED | SUPABASE_DB/STORAGE | campañas frontend | WORKING_CODE_VERIFIED |
| companies_admin | Empresas | `view:companies_admin` | sí | `companies.read` | PURPOSE_CONFIRMED | SUPABASE_DB/STORAGE | directorio/convenios | WORKING_CODE_VERIFIED |
| documents_admin | Documentos y credencial | `view:documents_admin` | sí | `documents.read` | PURPOSE_CONFIRMED | SUPABASE_DB/STORAGE | expediente, descargas y credencial | PARTIALLY_WORKING |
| minutes_admin | Minutas | `view:minutes_admin` | sí | `minutes.read` | PURPOSE_CONFIRMED | SUPABASE_DB/STORAGE | pantalla sindical | WORKING_CODE_VERIFIED |
| programs_admin | Programas institucionales | `view:programs_admin` | sí | `programs.read` | PURPOSE_CONFIRMED | SUPABASE_DB/STORAGE | programas sindicales | WORKING_CODE_VERIFIED |
| menus | Menús y botones | `view:menus` | sí | `content.read` | PURPOSE_CONFLICT | CODE_STATIC | navegación frontend | **UI_ONLY** |
| formularios | Formularios | `view:formularios` | sí | `content.read` | PURPOSE_CONFLICT | CODE_STATIC | formularios frontend | **UI_ONLY** |
| branding | Ícono e instalación | `view:branding` | sí | `assets.read` | PURPOSE_CONFIRMED | SUPABASE_DB/STORAGE + build assets | instalación/PWA | WORKING_CODE_VERIFIED |

### Hidden and conditional contexts

| ID | Nombre | Entrada | Visible en menú | Permiso | Autoridad | Estado |
|---|---|---|---|---|---|---|
| directory_admin | Comité | Tu Sindicato → Comité | no | `union_content.read`/directory | SUPABASE_DB/STORAGE | CODE_VERIFIED |
| documents_regulation | Normas y reglamentos | Tu Sindicato → Normas | no | documents por sección | SUPABASE_DB/STORAGE | CODE_VERIFIED |
| documents_download_form | Descarga de formatos | Tu Sindicato → Formatos | no | documents por sección | SUPABASE_DB/STORAGE | CODE_VERIFIED |
| union_categoria | Información por categoría | Tu Sindicato | no | union content | SUPABASE_DB/STORAGE | CODE_VERIFIED |
| union_antiguedad | Información por antigüedad | Tu Sindicato | no | union content | SUPABASE_DB/STORAGE | CODE_VERIFIED |
| union_jubilados | Información para jubilados | Tu Sindicato | no | union content | SUPABASE_DB/STORAGE | CODE_VERIFIED |
| roles_textos | Quién puede editar textos | Roles y permisos | no | content/authorization write | UNKNOWN | **BROKEN** |

## Control inventory and technical chains

El ledger runtime guarda para cada instancia `screenId`, superficie, ordinal, tag/type, label/icon/aria-label, visibilidad, habilitación, placeholder, estado y coordenadas. La tabla siguiente agrupa controles repetidos que comparten handler y cadena de autoridad; no oculta botones de ícono.

| Screen | Controles inventariados | UI → handler → backend/authority → consumer | Persistencia / permiso / test |
|---|---|---|---|
| identity_access | buscar, Enter, seleccionar afiliado, inputs de perfil, selects, motivo, guardar, impersonar, tabs documentales, preview, aprobar/rechazar/recargar | handlers locales → `AdminRepository`/`DocumentWorkflowRepository` → Supabase/RPC/Storage → perfil/expediente | CODE_VERIFIED; entrada Super Admin PASS; mutación NOT_LIVE_MUTATED |
| data_exports | details, filtros text/date/boolean, XLSX, CSV, reintentar | `run()`/`load()` → `DataExportRepository` → Edge → DB/audit/download | CORS_LIMITED en origen de prueba; permisos en Edge/RLS |
| popups | nuevo, editar, toggle, duplicar, eliminar, ordenar, asset, preview, guardar/cancelar | editor → `AdminRepository.saveManaged` → DB/Storage → popup frontend | CODE_VERIFIED; diálogo abrió |
| sindicato | nueve cards, volver, header, agregar bloque, tipo, inputs, audiencias, upload, guardar, duplicar, toggle, ordenar, eliminar, restaurar | `sindicatoStore` → `AdminCutoverRepository` → DB/Storage → union screens | CRUD principal CODE_VERIFIED; restaurar **WRONG_BEHAVIOR/P0** |
| requests | filtro, cards, detalle, estados y acciones disponibles | `ProgramRequestRepository` → DB → seguimiento/usuario | READ path observado; writes NOT_LIVE_MUTATED |
| finanzas | tabs/listas, filtros, detalle, acciones financieras | operations/funds repositories → Supabase + Edge/Google → flujo financiero | BROWSER_LIMITED por CORS; fallback `DATA` prohibido |
| fondos | búsqueda/filtros, reglas/toggles/guardar/reintentar | funds store → Edge → Google legacy → visibilidad Finanzas | READ_ONLY_AUDIT; no se tocó legacy |
| fincat | editar producto, nombre, tagline, detalle, imagen, popular, visible, audiencia, orden, recomendaciones, reset | `finCatStore` → presentation DB o no-op/local → Finanzas | solo label/tagline/visible/order persisten; demás FAIL/LOCAL |
| flujos | tabs, nuevo, inputs, tipo, servicios, etapas, estados, fechas, toggles, orden, eliminar, restore | `flowStore` → workflow/tracking DB → solicitudes | CRUD CODE_VERIFIED; restore no restaura |
| marketplace | búsqueda/filtros, categoría, nuevo, editor, imágenes, precio, stock, publish, order, delete | repository → DB/Storage → marketplace | CODE_VERIFIED; diálogo abrió |
| aprobaciones | cards, preview, aprobar/rechazar, asset | popup proposal repository → DB/Storage → popup | CODE_VERIFIED; raw company ID fallback |
| planes | nuevo, editor, precio/ciclo, beneficios, toggle, order, delete | admin/company repository → DB → company portal | CODE_VERIFIED; diálogo abrió |
| membresias | nuevo, editor, monto/cuotas, publish, order, delete | membership repository → DB → membresías | CODE_VERIFIED; diálogo abrió |
| noticias | nueva, edit, imagen, responsable, fechas, publicar, order, delete | visual repository → DB/Storage → noticias | CODE_VERIFIED; diálogo abrió |
| education | tabs, editar, links/assets, publish, order, delete | visual repository → DB/Storage → educación/tutoriales | CODE_VERIFIED; diálogo abrió |
| convenios | tabs, catálogo, clave, nuevo/edit, beneficios, audiencias, imágenes, publish, order/delete | cutover store/repository → DB/Storage; `<image-slot>` → localStorage | clave NO-OP; algunos uploads LOCAL_ONLY |
| catalogos | agregar, nombre, clave, edit, delete, order | cutover store → segmentation DB → políticas/audiencias | create/rename/delete CODE_VERIFIED; editar clave NO-OP |
| roles | actuar como, nuevo/edit/duplicate/delete, matriz por íconos, guardar, subvista textos | admin store/repository → authorization DB → Admin gate | roles CODE_VERIFIED; subvista textos BROKEN |
| pantallas | filtros, cards, audience mode, sindicatos/categorías, mensaje, save/reset | cutover store → screen policies DB/RLS → frontend gate | CODE_VERIFIED |
| secciones | nuevo, edit, inputs, toggle, duplicate, delete, order/drag, reset | handlers → `structural()` toast → no writer → frontend estático | UI_ONLY/DEAD; no persistencia |
| banners | nuevo/edit, assets, fechas, CTA, publish, order, delete | managed repository → DB/Storage → banners | CODE_VERIFIED; diálogo abrió |
| companies_admin | nuevo/edit, logos/portadas, links, publish, order, delete | managed repository → DB/Storage → empresas/convenios | CODE_VERIFIED; diálogo abrió |
| documents_admin | 5 tabs, review, catálogo, drag/order, required, active, delete, requirements, publish terms, QR policy | document/terms/QR repositories → DB/Storage/RPC → expediente/credencial | CODE_VERIFIED; semantic/operational findings |
| minutes_admin | nuevo/edit, file, fecha, publish, order, delete | managed repository → DB/Storage → minutas | CODE_VERIFIED; diálogo abrió |
| programs_admin | nuevo/edit, category/contact/social, asset, publish/order/delete | managed repository → DB/Storage → programas | CODE_VERIFIED; diálogo abrió |
| menus | nuevo, edit, label/route/icon, toggle, duplicate/delete/order/reset | handlers → `structural()` → no writer | UI_ONLY/DEAD |
| formularios | nuevo, edit, tipo/validación, required, duplicate/delete/order/reset | handlers → `structural()` → no writer | UI_ONLY/DEAD |
| branding | upload/replace/remove/preview/install-related controls | asset repository → Storage/DB → branding/PWA | CODE_VERIFIED; destructive upload NOT_LIVE_MUTATED |

## Admin functional coverage matrix

Leyenda: `P` code/repository productivo; `L` legacy controlado; `U` UI-only/no writer; `—` no aplica; `N/T` no mutado live.

| Screen | Purpose | Create | Edit | Delete | Publish | Order | Upload | Preview | Search | Filter | Permissions | Persistence | Frontend reflection | UX | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| identity_access | perfil/expediente | — | P | — | review | — | — | P | P | — | backend/RLS | P, N/T | P | media | PARTIAL |
| data_exports | exportar dominios | — | — | — | — | — | — | — | — | P | Edge/RLS | descarga | N/A | media | LIMITED |
| popups | avisos | P | P | P | P | P | P | P | — | — | RLS | P, N/T | P | buena | PASS_CODE |
| sindicato | contenido sindical | P | P | P | P | P | P | P | — | audiencia | RLS + UI parcial | **riesgo** | P | media | FAIL |
| requests | solicitudes | — | P | — | estado | — | — | P | — | P | RLS | P, N/T | P | pobre a volumen | PARTIAL |
| finanzas | operación financiera | — | P/L | — | estado | — | — | P | P | P | Edge/RLS | P/L, N/T | P | media | LIMITED |
| fondos | reglas financieras | — | L | — | — | — | — | P | P | P | Edge/Google | L, N/T | L | media | LIMITED |
| fincat | presentación Finanzas | missing | partial | reset | partial | P | **LOCAL** | P | — | audiencia | UI parcial/RLS | **FAIL** | **FAIL parcial** | engañosa | FAIL |
| flujos | etapas/tracking | P | P | P | toggle | P | — | P | — | tab | RLS | P, N/T | P | media | PARTIAL |
| marketplace | productos | P | P | P | P | P | P | P | P | P | RLS | P, N/T | P | buena | PASS_CODE |
| aprobaciones | propuestas popup | — | aprobar | rechazar | P | — | P | P | — | P | RLS | P, N/T | P | media | PARTIAL |
| planes | planes empresa | P | P | P | P | P | — | P | — | — | RLS | P, N/T | P | buena | PASS_CODE |
| membresias | ofertas | P | P | P | P | P | — | P | — | — | RLS | P, N/T | P | buena | PASS_CODE |
| noticias | noticias | P | P | P | P | P | P | P | — | — | RLS | P, N/T | P | buena | PASS_CODE |
| education | recursos | P | P | P | P | P | P | P | — | tabs | RLS | P, N/T | P | buena | PASS_CODE |
| convenios | empresas/beneficios | P | P | P | P | P | partial | P | — | tabs/audiencia | RLS | partial | partial | media | PARTIAL |
| catalogos | segmentación | P | partial | P | toggle | P | — | P | — | tipo | RLS | partial | partial | media | PARTIAL |
| roles | RBAC | P | P | P | — | — | — | actuar como | — | grupos | RLS | P; textos FAIL | P | media | FAIL |
| pantallas | acceso frontend | — | P | reset | P | — | — | P | — | audiencia | RLS | P, N/T | P | buena | PASS_CODE |
| secciones | estructura | U | U | U | U | U | — | P | — | — | UI | **FAIL** | **FAIL** | engañosa | FAIL |
| banners | campañas | P | P | P | P | P | P | P | — | — | RLS | P, N/T | P | buena | PASS_CODE |
| companies_admin | empresas | P | P | P | P | P | P | P | — | — | RLS | P, N/T | P | buena | PASS_CODE |
| documents_admin | expediente/credencial | P | P | P limitada | P | P | workflow | P | — | P | RLS/RPC | P, N/T | P | media | PARTIAL |
| minutes_admin | minutas | P | P | P | P | P | P | P | — | — | RLS | P, N/T | P | buena | PASS_CODE |
| programs_admin | programas | P | P | P | P | P | P | P | — | P | RLS | P, N/T | P | buena | PASS_CODE |
| menus | navegación | U | U | U | U | U | — | P | — | — | UI | **FAIL** | **FAIL** | engañosa | FAIL |
| formularios | schemas UI | U | U | U | U | U | — | P | — | — | UI | **FAIL** | **FAIL** | engañosa | FAIL |
| branding | branding/PWA | — | P | P | P | — | P | P | — | — | RLS | P, N/T | P/build | media | PASS_CODE |

## Top 20 Admin issues

| Rank / ID | Priority | Classification | Finding and exact chain |
|---|---|---|---|
| 1 · ADM-FUNC-001 | **P0** | PURPOSE_UNKNOWN / WRONG_BEHAVIOR | Tu Sindicato “Restaurar contenido original” confirma restaurar, pero `resetModule` elimina cada bloque y guarda cabecera vacía/despublicada. No existe fuente “original” identificada. [`screens-admin-sindicato.jsx:112`](../../app/screens-admin-sindicato.jsx#L112) → [`sindicato-store.jsx:26`](../../app/sindicato-store.jsx#L26). Riesgo: pérdida de contenido productivo. |
| 2 · ADM-FUNC-002 | **P1** | LOCAL_ONLY / WRONG_AUTHORITY | `<image-slot>` fuerza `editable=true` y guarda en `localStorage`; se usa en editores productivos de Convenios y Catálogo de Finanzas. El cambio solo aparece en ese navegador y no crea relación DB/Storage. [`image-slot.js:81`](../../app/image-slot.js#L81), [`image-slot.js:113`](../../app/image-slot.js#L113), [`image-slot.js:621`](../../app/image-slot.js#L621). |
| 3 · ADM-FUNC-003 | **P1** | BROKEN | Roles → “Quién puede editar textos” llama `cs.all()`, inexistente, y luego `cs.addEditor()`, también inexistente. La vista rompe antes de renderizar. [`screens-admin-roles.jsx:204`](../../app/screens-admin-roles.jsx#L204), [`screens-admin-roles.jsx:231`](../../app/screens-admin-roles.jsx#L231), [`copy-store.jsx:27`](../../app/copy-store.jsx#L27). |
| 4 · ADM-FUNC-004 | **P1** | UI_ONLY / DEAD_CONTROL | Secciones, Menús y Formularios ofrecen crear, editar, guardar, ocultar, duplicar, eliminar, ordenar y restaurar. Todos los writers se sustituyen por un toast que informa que la estructura vive en el código. [`admin-cutover-store.jsx:113`](../../app/admin-cutover-store.jsx#L113). |
| 5 · ADM-FUNC-005 | **P1** | DEAD_CONTROL / PURPOSE_INFERRED | Catálogo de Finanzas ofrece “Agregar recomendación”; `blankRec()` devuelve `null` y `saveRec/removeRec/toggleRec/moveRec` son no-op. El click no abrió editor en Playwright. [`screens-admin-fincat.jsx:58`](../../app/screens-admin-fincat.jsx#L58) → [`fincat-store.jsx:21`](../../app/fincat-store.jsx#L21). |
| 6 · ADM-FUNC-006 | **P1** | PARTIALLY_WORKING / PERSISTENCE_FAIL | El editor de producto financiero permite Detalle, POPULAR, audiencia e imagen, pero `saveItem` solo escribe label, tagline, visible y order. Los demás cambios se pierden/reflejan solo localmente. [`screens-admin-fincat.jsx:149`](../../app/screens-admin-fincat.jsx#L149), [`fincat-store.jsx:18`](../../app/fincat-store.jsx#L18). |
| 7 · ADM-FUNC-007 | **P1** | PERMISSION_UI_DEFECT | Los resets destructivos de Sindicato y Fincat se renderizan sin condicionar específicamente el botón a permiso de escritura. RLS puede negar a lectores, pero la UI no debe ofrecer la acción y Super Admin sí puede ejecutar la eliminación. |
| 8 · ADM-FUNC-008 | **P2** | PURPOSE_CONFLICT | “Restaurar flujos base” solo vuelve a cargar el estado actual de Supabase y muestra “Flujos restaurados”; no restaura una base. [`flow-store.jsx:19`](../../app/flow-store.jsx#L19) → [`screens-admin-flujos.jsx:277`](../../app/screens-admin-flujos.jsx#L277). |
| 9 · ADM-FUNC-009 | **P2** | PARTIALLY_WORKING / DEAD_CONTROL | Editar la “Clave” de catálogos llama `setCatalogClave`, implementado como no-op. El nombre puede persistir; la clave editada no. [`screens-admin-convenios.jsx:97`](../../app/screens-admin-convenios.jsx#L97) → [`admin-cutover-store.jsx:93`](../../app/admin-cutover-store.jsx#L93). |
| 10 · ADM-FUNC-010 | **P2** | WRONG_AUTHORITY | Finanzas tiene un fallback productivo a `window.DATA.finanzasGroups` si `finCatStore` no está disponible. Aunque el orden normal de bundle lo vuelve latente, contradice la fuente única y falla silenciosamente hacia datos estáticos. [`screens-admin-finanzas.jsx:89`](../../app/screens-admin-finanzas.jsx#L89). |
| 11 · ADM-FUNC-011 | **P2** | PERFORMANCE / AUTH_NOISE | Stores Supabase ejecutan `setTimeout(load,0)` antes de autorización y vuelven a cargar al autorizar. Playwright observó 13 respuestas 4xx y 22 eventos de consola, principalmente 401/403 pre-auth. [`admin-cutover-store.jsx:117`](../../app/admin-cutover-store.jsx#L117), [`fincat-store.jsx:22`](../../app/fincat-store.jsx#L22). |
| 12 · ADM-FUNC-012 | **P2** | OPERATIONAL_UX / SEMANTIC | Catálogo documental solicita por `prompt()` que el operador invente un código técnico; además muestra orden numérico crudo y “Cuenta para el 100% del expediente”. [`screens-admin-documents.jsx:18`](../../app/screens-admin-documents.jsx#L18). |
| 13 · ADM-FUNC-013 | **P2** | SEMANTIC / MISSING_BUSINESS_LABEL | Los filtros de exportación convierten claves internas sustituyendo `_` por espacios. Campos como `financial_processing_status`, `program_id` o `audience_mode` siguen siendo lenguaje técnico. [`screens-admin-data-exports.jsx:6`](../../app/screens-admin-data-exports.jsx#L6). |
| 14 · ADM-FUNC-014 | **P2** | PURPOSE_CONFLICT | Flujos indica “Al conectar Supabase” y que la base se conectará en el futuro, aunque `flowStore` ya usa Supabase productivo. [`screens-admin-flujos.jsx:84`](../../app/screens-admin-flujos.jsx#L84), [`screens-admin-flujos.jsx:250`](../../app/screens-admin-flujos.jsx#L250). |
| 15 · ADM-FUNC-015 | **P2** | WRONG_DATA_DISPLAYED | Identidad expone el enum crudo `auth_eligibility`; Solicitudes puede usar `program_id` como título; Aprobaciones puede usar el UUID de empresa como nombre. [`screens-admin-identity.jsx:30`](../../app/screens-admin-identity.jsx#L30), [`screens-admin-requests.jsx:27`](../../app/screens-admin-requests.jsx#L27), [`screens-admin.jsx:374`](../../app/screens-admin.jsx#L374). |
| 16 · ADM-FUNC-016 | **P2** | PURPOSE_CONFLICT | La tarjeta “Documentos y PDF” promete descargas/formatos/normas, pero abre “Documentos y credencial” con revisión, catálogo, requisitos, términos y QR. La navegación no comunica el alcance real. [`screens-admin.jsx:53`](../../app/screens-admin.jsx#L53), [`screens-admin-documents.jsx:14`](../../app/screens-admin-documents.jsx#L14). |
| 17 · ADM-FUNC-017 | **P2** | OPERATIONAL_UX_POOR | Revisión documental y varias altas/bajas usan `prompt()`/`confirm()` y operación uno-a-uno. Para 100 documentos no existen selección múltiple, cola con teclado ni batch review. |
| 18 · ADM-FUNC-018 | **P2** | PERMISSION_UX | `identity_access` se hace visible para cualquier asignación administrativa amplia aunque el usuario no tenga `affiliates.read`; los controles internos protegen, pero se puede exponer una superficie inoperable. No es bypass de backend. |
| 19 · ADM-FUNC-019 | **P3** | VISUAL/A11Y | Los iconos `book`, `edit`, `warning` y `alert` no existen en el registro y caen al icono genérico `grid`; además varios botones icon-only no tienen nombre accesible. Playwright registró los warnings. |
| 20 · ADM-FUNC-020 | **P3** | BROWSER_LIMITATION | Exportaciones y Google legacy fallaron por CORS desde `127.0.0.1:<puerto>`. Debe repetirse desde el origen allowlisted; no se clasifica como defecto productivo sin esa repetición. |

## Dead / broken controls

| ID | Screen | Control | Expected purpose | Actual behavior | Root cause | Priority | Suggested fix |
|---|---|---|---|---|---|---|---|
| DEAD-001 | fincat | Agregar recomendación | crear regla segmentada | no abre editor | `blankRec() => null` | P1 | retirar de productivo o crear autoridad/consumer aprobados |
| DEAD-002 | fincat | guardar/eliminar/mostrar/ordenar recomendación | CRUD de reglas | funciones vacías | store sin implementación | P1 | decisión de dominio antes de implementar |
| DEAD-003 | secciones | CRUD/order/reset | modificar componentes | solo toast | writers reemplazados por `structural` | P1 | modo read-only honesto o infraestructura aprobada |
| DEAD-004 | menus | CRUD/order/reset | modificar navegación | solo toast | igual | P1 | igual |
| DEAD-005 | formularios | CRUD/order/reset | modificar schemas | solo toast | igual | P1 | igual |
| DEAD-006 | catalogos/convenios | Guardar Clave | modificar clave | no-op | `setCatalogClave=()=>{}` | P2 | bloquear campo o writer seguro con análisis de referencias |
| DEAD-007 | roles_textos | abrir/administrar editores | autorización individual | excepción `cs.all is not a function` | contrato store/UI divergente | P1 | decidir modelo RBAC vs allowlist y alinear API |
| DEAD-008 | flujos | Restaurar flujos base | reponer baseline | solo reload + toast de éxito | no existe baseline/restore | P2 | renombrar “Recargar” o implementar restore auditable |

## Unknown purpose controls

No se inventó propósito para estos controles.

| ID | Screen / control | Evidence | Handler/data | Consumer | Confidence | Owner clarification |
|---|---|---|---|---|---|---|
| UNKNOWN-001 | Tu Sindicato → Restaurar contenido original | label y confirm hablan de “original” | borra bloques y guarda cabecera vacía; Supabase | una pantalla sindical vacía | alta sobre comportamiento, cero sobre “original” | ¿Cuál es la fuente exacta que debe restaurarse: seed aprobado, versión anterior o simplemente vaciar? |
| UNKNOWN-002 | Roles → Quién puede editar textos | UI describe personas concretas y prueba “como persona” | store devuelve listas vacías/no-op y la pantalla llama métodos inexistentes | `LiveText` sí consume overrides, pero no se demostró consumidor de allowlist individual | media | ¿Debe existir autorización individual adicional a `content.write`, o esta vista es un prototipo que debe quedar fuera de productivo? |
| UNKNOWN-003 | Fincat → Recomendaciones | editor define producto, razón, CTA y audiencia | todas las funciones de persistencia son no-op | no se encontró reader productivo de reglas | media | ¿Qué pantalla debe consumirlas y cuál será la autoridad? |

## Missing Admin capabilities

| Frontend/business feature | Expected Admin control | Coverage | Evidence |
|---|---|---|---|
| Recomendaciones financieras segmentadas | CRUD/publish/order persistente | NONE | UI presente, store no-op |
| Presentación avanzada de producto financiero | guardar detalle, POPULAR, audiencia e imagen | PARTIAL | `saveItem` omite campos; imagen local |
| Estructura de secciones | edición persistente o pantalla explícitamente read-only | NONE | todos los writers son toast |
| Navegación/menús | edición persistente o pantalla explícitamente read-only | NONE | todos los writers son toast |
| Definición de formularios | edición persistente o pantalla explícitamente read-only | NONE | todos los writers son toast |

## Admin orphan capability

`roles_textos` presenta un modelo de editores individuales y “actuar como persona”, pero no existe autoridad ni reader demostrable para esa allowlist. Puede ser legacy, prototipo o feature incompleta; no debe eliminarse hasta decisión del propietario.

## Upload audit

| Uploader family | Select/preview | Upload | DB relation | Refresh/consumer | Verdict |
|---|---|---|---|---|---|
| Managed visual assets | código y tests presentes | Supabase Storage | `asset_id`/managed entity | consumer productivo | CODE_VERIFIED, NOT_LIVE_MUTATED |
| Expediente de afiliado | repository/RPC y signed preview | Storage privado | documento/afiliado | expediente/credencial | CODE_VERIFIED, NOT_LIVE_MUTATED |
| Branding | UI/repository | Storage | asset registry | PWA/frontend | CODE_VERIFIED, NOT_LIVE_MUTATED |
| `<image-slot>` en Convenios/Fincat | preview local | **no upload productivo** | **sin relación DB** | solo navegador local | WRONG_AUTHORITY/HIGH |

## Permissions and security

| Actor | Browser result | Backend evidence | Verdict |
|---|---|---|---|
| SUPER_ADMIN | `authorized`, 28 módulos visibles | 39 permisos cargados | PASS para acceso |
| AUTHORIZED_RESPONSIBLE | no hubo credencial live dedicada | filtros/section actions y RLS inspeccionados | CODE_VERIFIED / NOT_LIVE_RETESTED |
| UNAUTHORIZED_RESPONSIBLE | no hubo credencial live dedicada | gate/section filtering inspeccionados | CODE_VERIFIED / NOT_LIVE_RETESTED |
| NORMAL_USER A | gate “sin asignación administrativa”, 0 módulos | sin autorización Admin | PASS |
| NORMAL_USER B | igual | igual | PASS |
| ANONYMOUS | login requerido, 0 módulos | sesión ausente | PASS |

No se observó exposición de `service_role` ni autorización exclusivamente visual en los repositories auditados. Los resets sin guard específico son un defecto de UX/least-privilege en frontend; RLS sigue siendo la frontera real y no fue eludida.

## Console, network and performance

- 22 eventos de consola relevantes y 13 respuestas 4xx durante el recorrido. La mayoría son cargas Supabase iniciadas antes de que el estado Admin llegue a `authorized`; luego se repiten.
- 2 requests fallaron por CORS desde el origen efímero de Playwright: exportaciones y financial legacy.
- Service Worker bloqueado por el harness de Playwright: limitación de prueba, no defecto del producto.
- Warnings de iconos faltantes y un `<image-slot> without id`; este último no se atribuye a una pantalla concreta sin trace estable.
- No se midió una acción lenta con umbral repetible; por eso no hay finding HIGH de performance. Sí existe trabajo duplicado pre-auth verificable.

## Operational UX and design opportunities

| ID | Current workflow | Problem | Proposed UX | Expected improvement | Complexity |
|---|---|---|---|---|---|
| UX-001 | revisar documentos uno a uno | volumen de 100 requiere muchos modales/prompts | cola con preview lateral, atajos y batch seguro | menos tiempo y error | M |
| UX-002 | reordenar tipos guarda todas las filas | N escrituras por drop | RPC transaccional de reorder | consistencia y menor latencia | M |
| UX-003 | resets destructivos al pie | jerarquía insuficiente y copy engañoso | danger zone, resumen de impacto, permiso write y backup/version | reduce pérdida | M |
| UX-004 | estructuras editables sin writer | induce trabajo falso | read-only con origen “versión de la app” o writer aprobado | expectativa correcta | S/L |
| UX-005 | filtros raw de exportación | obliga conocer schema | catálogo de labels, selects de enums, ayuda | operación autónoma | M |
| UX-006 | solicitudes sin bulk | mala escala para 50+ | filtros persistentes, selección/batch con auditoría | productividad | M/L |
| UX-007 | IDs técnicos como fallback | confunde o expone UUID | nombre de negocio + detalles técnicos expandibles | claridad | S |
| UX-008 | pantallas híbridas mezclan fuentes | no se ve qué campo vive dónde | indicador de autoridad y guardado por bloque | menos errores | M |

## Screen scorecard

Los scores son heurísticos de priorización, no una métrica científica. `Perm` mide seguridad del diseño completo, no solo que el menú se oculte.

| Screen | Funcional | Persistencia | Perm | UX operativa | Claridad visual |
|---|---:|---:|---:|---:|---:|
| identity_access | 82 | 88 | 90 | 62 | 78 |
| data_exports | 72 | 85 | 90 | 68 | 55 |
| popups | 88 | 88 | 90 | 78 | 84 |
| sindicato | 54 | 42 | 70 | 55 | 58 |
| requests | 80 | 86 | 90 | 58 | 70 |
| finanzas | 72 | 72 | 88 | 64 | 72 |
| fondos | 74 | 72 | 88 | 64 | 75 |
| fincat | 38 | 24 | 65 | 45 | 74 |
| flujos | 72 | 78 | 88 | 64 | 68 |
| marketplace | 88 | 88 | 90 | 76 | 84 |
| aprobaciones | 78 | 84 | 88 | 68 | 72 |
| planes | 86 | 88 | 90 | 75 | 82 |
| membresias | 86 | 88 | 90 | 74 | 82 |
| noticias | 88 | 88 | 90 | 76 | 84 |
| education | 86 | 88 | 90 | 75 | 82 |
| convenios | 68 | 58 | 86 | 66 | 70 |
| catalogos | 72 | 68 | 88 | 68 | 66 |
| roles | 55 | 62 | 84 | 58 | 76 |
| pantallas | 84 | 88 | 92 | 72 | 80 |
| secciones | 28 | 10 | 78 | 35 | 78 |
| banners | 86 | 88 | 90 | 75 | 82 |
| companies_admin | 86 | 88 | 90 | 74 | 82 |
| documents_admin | 78 | 84 | 90 | 58 | 61 |
| minutes_admin | 86 | 88 | 90 | 74 | 82 |
| programs_admin | 84 | 86 | 90 | 72 | 80 |
| menus | 28 | 10 | 78 | 35 | 76 |
| formularios | 28 | 10 | 78 | 35 | 76 |
| branding | 82 | 86 | 90 | 70 | 80 |

## Owner clarifications required

### Q1

- Screen: Tu Sindicato
- Control: Restaurar contenido original
- What we know: elimina bloques y deja cabecera vacía/despublicada.
- What is unknown: cuál es el “original” y si vaciar era realmente la intención.
- Why it matters: riesgo P0 de pérdida de contenido.
- Possible interpretations: restaurar un seed aprobado; volver a una versión previa; vaciar contenido. No son equivalentes.

### Q2

- Screen: Roles → Quién puede editar textos
- Control: editor individual y “probar como persona”
- What we know: el RBAC ya concede `content.write`; la UI individual está rota y el store no tiene autoridad.
- What is unknown: si la allowlist individual debe coexistir con roles.
- Why it matters: implementar una segunda autoridad violaría el modelo actual.
- Possible interpretations: reemplazo del RBAC, restricción adicional o prototipo legacy.

### Q3

- Screen: Catálogo de Finanzas → Recomendaciones
- Control: CRUD de recomendaciones segmentadas
- What we know: la intención visual es clara, pero el store es no-op y no se halló consumer.
- What is unknown: frontend destino, modelo de datos y responsabilidad de aprobación.
- Why it matters: no puede conectarse arbitrariamente a presentation, workflow o Google.
- Possible interpretations: carrusel “Recomendado”, elegibilidad calculada o campaña editorial.

## Final verdict

### ADMIN EXHAUSTIVE AUDIT RESULT

| Campo | Resultado |
|---|---:|
| Screens | 36 contextos / 28 módulos |
| Controls | 2,268 instancias / 387 constructores |
| Working activation paths | 44 |
| Broken | 1 |
| Dead control families | 8 |
| Stuck | 0 demostrado |
| Unknown purpose | 1 |
| Purpose conflicts | 7 |
| Missing capabilities | 5 |
| Orphan capabilities | 1 |
| Persistence failures | 8 |
| Permission failures demonstrated | 0; 2 defectos UI |
| Frontend reflection failures | 5 |
| UX findings | 13 |
| Design opportunities | 8 |
| P0 | 1 |
| P1 | 6 |
| P2 | 11 |
| P3 | 2 |
| Browser coverage | 100% módulos principales; 80.6% contextos de pantalla |
| Architecture correlation | 100% contextos |
| Destructive production writes | **0** |
| Final Admin status | **CRITICAL** |

## Verification evidence

- Browser ledger: [admin-playwright-20260826.json](evidence/admin-playwright-20260826.json)
- Screenshot: `screenshots/admin-audit-20260826/00-admin-menu.png`
- Static suite: **44/44 PASS**, incluido `test-claude-ui-preservation` y todos los tests Admin estáticos.
- Syntax parse dirigido de siete archivos críticos: PASS.
- Architecture Registry check: `STALE changed=1 added=3 removed=0` (un documento previo cambió y los tres artefactos QA son nuevos); no es fallo de sintaxis ni de Admin. No se actualizó el Registry porque esta auditoría no cambió arquitectura.
- Build: NOT APPLICABLE; no existe `package.json` y ejecutar `scripts/build-bundle.js` escribiría `app/bundle.js`, fuera del alcance read-only.

## Closure

```text
H-ADMIN-AUDIT-20260826 RESULT
Status: PASS (audit delivered); product verdict CRITICAL
Files changed: docs/qa/ADMIN_EXHAUSTIVE_FUNCTIONAL_AUDIT.md; docs/qa/ADMIN_SEMANTIC_CLARITY_AUDIT.md; docs/qa/evidence/admin-playwright-20260826.json
Source-of-truth verdict: BLOCKED for affected controls (localStorage image slots, DATA fallback, missing writers); audit itself read-only
Invariant verdict: PASS for the audit; 0 product/data mutations
Build: NOT APPLICABLE (documentation-only; no package.json; bundle builder would write app/bundle.js)
Tests: 44/44 static suites PASS; critical-source parse PASS; Architecture Registry check reports pre-existing/current staleness
Security: Super Admin PASS; two normal users denied; anonymous denied; responsible-role live matrix not re-executed
Legacy impact: READ ONLY; no Google/financial write
Unexpected files changed: none after cleanup
Known limitations: no agentic-browser-testing skill; no reversible production dataset; CORS on ephemeral 127.0.0.1 origin
Evidence: docs/qa/evidence/admin-playwright-20260826.json
```
