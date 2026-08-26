# SutiApp — Admin Semantic Clarity & Business Language Audit

Fecha: 2026-08-26
Alcance: los 28 módulos Admin y 7 contextos internos, correlacionados con su propósito, autoridad y consumidor.
Resultado: **NEEDS_ATTENTION**.

## Executive summary

El Admin usa lenguaje humano en la mayoría de títulos, acciones y estados visuales, pero todavía expone nomenclatura de implementación en flujos operativos importantes. Los focos principales son Datos y respaldos, Tu Sindicato, Documentos y credencial, Identidad, Solicitudes y Aprobaciones.

La pantalla documental citada en el objetivo ya muestra `document_type.label` como nombre principal y mantiene `document_type.code` como texto secundario; por tanto, valores como `ine_back` no son hoy el label principal en el componente auditado. El problema restante es que el alta obliga al operador a inventar el código técnico y que otros conceptos (`100% del expediente`, `Ruta allowlisted`, orden numérico) carecen de lenguaje de negocio suficiente.

| Métrica | Resultado |
|---|---:|
| Screens audited | 36 contextos / 28 módulos |
| Technical terms visible | 39 patrones únicos confirmados |
| Confusing technical terms | 35 |
| Missing business labels | 31 |
| Unknown meanings | 3 |
| Wrong/irrelevant data displayed | 1 familia |
| Raw IDs exposed | 3 rutas de fallback |
| Raw enums exposed | 1 |
| Unlabeled numeric fields | 1 |
| Suggested label/presentation fixes | 37 |
| Owner clarifications | 3 |
| P1 | 3 |
| P2 | 9 |
| P3 | 4 |
| Final semantic quality | **NEEDS_ATTENTION** |

Los 39 términos son patrones únicos, no ocurrencias repetidas por registro: 27 claves de filtro exportable, 4 identificadores de autoridad sindical y 8 términos/enums/IDs técnicos adicionales. El ledger renderizado está en [admin-playwright-20260826.json](evidence/admin-playwright-20260826.json).

## Semantic principles applied

- La clave interna se conserva; el Admin recibe un nombre de negocio y, si aporta valor, un bloque secundario “Detalles técnicos”.
- No se propone renombrar enums, keys, tablas, buckets, RPCs ni contratos.
- Un ID crudo nunca sustituye silenciosamente al nombre principal.
- No se crea un label cuando el significado no está demostrado.
- La claridad se evaluó después de confirmar el propósito y la fuente de cada pantalla.

## Screen-by-screen semantic inventory

| Screen | ¿Qué administra? | Lenguaje observado | Clasificación | Acción recomendada |
|---|---|---|---|---|
| identity_access | identidad, perfil y expediente | labels de perfil claros; `auth_eligibility` crudo en resultados | TECHNICAL_VISIBLE_CONFUSING | mapear enum a estado humano |
| data_exports | exportaciones por dominio | 27 filter keys, `public.affiliates`, Supabase, HTTP/code | MISSING_BUSINESS_LABEL | catálogo de labels y detalles técnicos secundarios |
| popups | avisos por pantalla | nombres y CTAs humanos | TECHNICAL_OK_HIDDEN | conservar |
| sindicato | destinos y contenido sindical | cuatro authority IDs crudos y copy de Storage/asset | TECHNICAL_VISIBLE_CONFUSING | mostrar nombre de pantalla y ocultar autoridad |
| requests | solicitudes de programas | `program_id` puede ser título y siempre aparece en secundario | TECHNICAL_VISIBLE_CONFUSING | resolver nombre; ID solo en detalles |
| finanzas | solicitudes financieras | lenguaje operativo mayormente claro | TECHNICAL_VISIBLE_BUT_ACCEPTABLE | retirar fallback raw cuando falte catálogo |
| fondos | visibilidad por criterio | conceptos financieros requieren contexto pero son del negocio | TECHNICAL_VISIBLE_BUT_ACCEPTABLE | helper sobre efecto y fuente |
| fincat | presentación de productos financieros | “Tagline”, “Detalle”, “POPULAR”; propósito de algunos campos no coincide con persistencia | TECHNICAL_VISIBLE_CONFUSING | español operativo y distinguir campos realmente guardables |
| flujos | etapas y seguimiento | buen mapping de enums; mensajes obsoletos “al conectar Supabase” | WRONG_DATA_DISPLAYED | actualizar estado real de la función |
| marketplace | catálogo comercial | labels de negocio | TECHNICAL_OK_HIDDEN | conservar |
| aprobaciones | propuestas de popup | UUID de empresa puede ser nombre principal | WRONG_DATA_DISPLAYED | fallback humano + detalle técnico |
| planes | planes de empresa | conceptos de negocio | TECHNICAL_OK_HIDDEN | conservar |
| membresias | ofertas de membresía | conceptos de negocio | TECHNICAL_OK_HIDDEN | conservar |
| noticias | publicaciones | claro | TECHNICAL_OK_HIDDEN | conservar |
| education | recursos y tutoriales | claro; icono faltante degrada semántica visual | TECHNICAL_OK_HIDDEN | corregir icon registry por separado |
| convenios | empresas, beneficios y catálogos | campo “Clave” protagonista y copy Storage/asset | TECHNICAL_VISIBLE_CONFUSING | nombre humano primero; detalles técnicos secundarios |
| catalogos | segmentación | “Clave” técnica editable sin explicación | MISSING_BUSINESS_LABEL | “Código interno” solo si realmente editable |
| roles | roles y permisos | matriz usa nombres humanos; subvista individual es conceptualmente ambigua | UNKNOWN_MEANING | decidir modelo de autorización |
| pantallas | reglas de acceso | audiencia y mensaje son claros | TECHNICAL_OK_HIDDEN | conservar |
| secciones | estructura versionada | UI afirma edición aunque el origen es código | WRONG_DATA_DISPLAYED | estado read-only explícito |
| banners | campañas | claro | TECHNICAL_OK_HIDDEN | conservar |
| companies_admin | directorio de empresas | claro | TECHNICAL_OK_HIDDEN | conservar |
| documents_admin | expediente, requisitos, términos y QR | code técnico secundario aceptable; alta técnica, frase 100%, ruta allowlisted y orden crudo | TECHNICAL_VISIBLE_CONFUSING | view model + helpers de negocio |
| minutes_admin | minutas | claro | TECHNICAL_OK_HIDDEN | conservar |
| programs_admin | programas institucionales | claro | TECHNICAL_OK_HIDDEN | conservar |
| menus | navegación versionada | UI promete mutar una fuente que no puede escribir | WRONG_DATA_DISPLAYED | indicar origen y modo lectura |
| formularios | formularios versionados | igual | WRONG_DATA_DISPLAYED | indicar origen y modo lectura |
| branding | activos de instalación | propósito comprensible | TECHNICAL_VISIBLE_BUT_ACCEPTABLE | separar branding editable de artefactos de build |

## Detailed findings

### SEM-ADMIN-001 — filtros de exportación sin labels de negocio

- Screen: Datos y respaldos
- Current: la UI usa `name.replaceAll('_', ' ')`.
- Technical source: allowlist de la Edge Function.
- Terms confirmed: `affiliation_raw`, `employment_level_raw`, `affiliate_status_raw`, `financial_affiliation_status`, `financial_employment_status`, `program_id`, `request_type`, `status`, `financial_processing_status`, `created_at`, `enabled`, `company_id`, `audience_mode`, `tag`, `published`, `placement`, `kind`, `published_on`, `category`, `requires_quote`, `program_key`, `request_mode`, `domain`, `format`, `resource`, `action`, `result`.
- Problem: reemplazar guiones bajos no traduce schema a lenguaje administrativo ni traduce enums.
- Impact: el operador necesita conocer tablas y campos internos para filtrar datos sensibles.
- Recommendation: el contrato Edge debe entregar `{key,label,help,type,options}`; el request conserva `key` y la UI muestra `label`/opciones humanas.
- Classification: MISSING_BUSINESS_LABEL
- Priority: **P1**
- Evidence: [`screens-admin-data-exports.jsx:6`](../../app/screens-admin-data-exports.jsx#L6), [`supabase/functions/data-exports/index.ts:24`](../../supabase/functions/data-exports/index.ts#L24).

### SEM-ADMIN-002 — identificadores de autoridad sindical visibles

- Screen: Tu Sindicato
- Current: `directory_members`, `institutional_documents:regulation`, `institutional_programs`, `institutional_documents:download/form` aparecen como texto visible de cards.
- Technical source: `UNION_SCREEN_REGISTRY.admin_editor.authority`.
- Business meaning: el destino de edición sí es conocido, pero la authority key no es un concepto operativo.
- Problem: el Admin parece consola técnica.
- Recommendation: mostrar una frase como “Se refleja en Comité” o “Se refleja en Normas y reglamentos”; mover la authority a detalles técnicos opcionales.
- Classification: TECHNICAL_VISIBLE_CONFUSING
- Priority: **P1**

### SEM-ADMIN-003 — el alta documental exige inventar una clave interna

- Screen: Documentos y credencial → Catálogo
- Current: `prompt('Código técnico (minúsculas y guiones bajos):')`.
- Technical source: `document_types.code`.
- Business meaning: identificador estable usado por consumidores.
- Problem: un administrador funcional puede crear claves inconsistentes o desconocer el contrato.
- Recommendation: generar una clave candidata controlada en backend, validar unicidad/referencias y mostrarla solo en “Detalles técnicos”; si debe ser decidida por Owner, convertir el alta en workflow de aprobación.
- Classification: MISSING_BUSINESS_LABEL / OPERATIONAL_RISK
- Priority: **P1**
- Evidence: [`screens-admin-documents.jsx:18`](../../app/screens-admin-documents.jsx#L18).

### SEM-ADMIN-004 — “Cuenta para el 100% del expediente” es ambiguo

- Screen: Documentos y credencial → Catálogo
- Current: checkbox junto a cada tipo.
- Technical source: `required_by_default`.
- What is known: el cálculo de completitud cuenta tipos globalmente obligatorios y documentos verificados.
- What is unclear: si el lenguaje histórico “100%” debe conservarse o si el concepto de negocio aprobado es “Documento obligatorio”.
- Recommendation: pendiente de Owner; no renombrar sin confirmar. Agregar helper que explique efecto sobre completitud.
- Classification: UNKNOWN_MEANING
- Priority: **P2**
- Evidence: [`screens-admin-documents.jsx:19`](../../app/screens-admin-documents.jsx#L19).

### SEM-ADMIN-005 — “Ruta allowlisted” y path técnico editables

- Screen: Documentos y credencial → QR
- Current: label híbrido inglés/técnico y valor `/SutiApp.html#credencial`.
- Technical source: `credential_qr_policy.destination_path`.
- Business meaning: pantalla a la que lleva el QR.
- Recommendation: selector “Destino del QR: Credencial del afiliado”; path en detalles técnicos. Mantener allowlist en backend.
- Classification: TECHNICAL_VISIBLE_CONFUSING
- Priority: **P2**
- Evidence: [`screens-admin-documents.jsx:22`](../../app/screens-admin-documents.jsx#L22).

### SEM-ADMIN-006 — orden numérico sin contexto visual

- Screen: Documentos y credencial → Catálogo
- Current: input numérico de 42 px, aria-label “Orden accesible”, junto a drag handle.
- Technical source: `sort_order`.
- Problem: el valor no explica “posición” y duplica drag/drop.
- Recommendation: ocultar el input si drag/drop es suficiente; en accesibilidad mostrar “Posición en el expediente: N” con subir/bajar.
- Classification: MISSING_BUSINESS_LABEL
- Priority: **P2**

### SEM-ADMIN-007 — jerga de infraestructura en ayuda de uploads

- Screen: Tu Sindicato → editor de bloque
- Current: “Supabase Storage” y “relación de asset”.
- Technical source: implementación de archivo gestionado.
- Business meaning: el archivo se guarda y queda asociado a la publicación.
- Recommendation: “El archivo quedará asociado a esta pantalla. Podrás reemplazarlo o quitarlo después.” Infraestructura en detalles técnicos.
- Classification: TECHNICAL_VISIBLE_CONFUSING
- Priority: **P2**
- Evidence: [`screens-admin-sindicato.jsx:349`](../../app/screens-admin-sindicato.jsx#L349).

### SEM-ADMIN-008 — enum de elegibilidad crudo

- Screen: Identidad y expediente → resultados
- Current: `row.auth_eligibility` se concatena al número de control.
- Technical source: resultado de búsqueda de afiliado.
- Business meaning: elegibilidad/estado de acceso; no se demostró mapping exhaustivo en este componente.
- Recommendation: view model autorizado de enum → label/tone; valor interno en detalles técnicos si es necesario.
- Classification: WRONG_DATA_DISPLAYED
- Priority: **P2**
- Evidence: [`screens-admin-identity.jsx:30`](../../app/screens-admin-identity.jsx#L30).

### SEM-ADMIN-009 — `program_id` como título o metadato principal

- Screen: Solicitudes
- Current: `productoNombre || program_id`; además `program_id` siempre aparece en la segunda línea.
- Technical source: `program_requests.program_id`.
- Problem: si falla el join/catalog lookup, la clave técnica pasa a ser el nombre visible.
- Recommendation: resolver por catálogo autoritativo; si no existe, mostrar “Programa sin nombre” con warning y key en detalles técnicos.
- Classification: TECHNICAL_VISIBLE_CONFUSING
- Priority: **P2**
- Evidence: [`screens-admin-requests.jsx:27`](../../app/screens-admin-requests.jsx#L27).

### SEM-ADMIN-010 — UUID de empresa como fallback de nombre

- Screen: Aprobación de Pop-ups
- Current: `empresaNombre || companyStore.name || id`.
- Technical source: `ownerCompany`.
- Problem: un UUID puede convertirse en el label de negocio.
- Recommendation: “Empresa sin nombre” + estado de integridad; ID solo con acción “Copiar ID”.
- Classification: WRONG_DATA_DISPLAYED
- Priority: **P2**
- Evidence: [`screens-admin.jsx:374`](../../app/screens-admin.jsx#L374).

### SEM-ADMIN-011 — descripciones de exportación muestran tablas/plataforma

- Screen: Datos y respaldos
- Current: “Padrón actual autorizado de public.affiliates”, “registradas en Supabase”, “Supabase CLI/SQL”.
- Technical source: especificación de dominios y backup.
- Problem: mezcla el propósito de negocio con la infraestructura.
- Recommendation: “Padrón vigente de afiliados”, “Solicitudes registradas”, “El respaldo completo lo gestiona el equipo técnico”; tabla/plataforma en detalles.
- Classification: TECHNICAL_VISIBLE_CONFUSING
- Priority: **P2**

### SEM-ADMIN-012 — detalle de error técnico como mensaje principal secundario

- Screen: Datos y respaldos
- Current: `CORS_OR_NETWORK_BLOCKED · HTTP NNN` en tipografía mono.
- What is acceptable: puede ayudar a soporte.
- Problem: no explica al administrador qué hacer salvo reintentar.
- Recommendation: mensaje humano y acción; código bajo “Detalles para soporte”.
- Classification: TECHNICAL_VISIBLE_BUT_ACCEPTABLE
- Priority: **P3**

### SEM-ADMIN-013 — navegación documental subrepresenta la pantalla

- Screen: menú Admin / Documents
- Current: tarjeta “Documentos y PDF — Descargas, formatos y normas”; destino “Documentos y credencial” con revisión, catálogo, requisitos, términos y QR.
- Recommendation: nombre común estable, por ejemplo “Expediente, documentos y credencial”, validado por Owner.
- Classification: PURPOSE_CONFLICT
- Priority: **P2**

### SEM-ADMIN-014 — copy obsoleto de Supabase

- Screen: Etapas y seguimiento
- Current: “Al conectar Supabase…” cuando la autoridad ya es Supabase.
- Recommendation: describir lo que hoy está conectado y separar automatizaciones aún no implementadas.
- Classification: WRONG_DATA_DISPLAYED
- Priority: **P3**

### SEM-ADMIN-015 — anglicismo “Tagline”

- Screen: Catálogo de Finanzas
- Current: “Tagline (línea principal)”.
- Recommendation: “Texto principal” o el nombre aprobado por negocio; conservar `description_override` internamente.
- Classification: TECHNICAL_VISIBLE_BUT_ACCEPTABLE
- Priority: **P3**

### SEM-ADMIN-016 — iconos técnicos faltantes degradan el significado

- Screen: menú Admin y estados de error
- Current: `book`, `edit`, `warning`, `alert` caen al icono `grid`.
- Impact: una señal visual deja de representar educación, edición o alerta.
- Classification: WRONG_DATA_DISPLAYED
- Priority: **P3**

### SEM-ADMIN-017 — código documental secundario correctamente separado

- Screen: Documentos y credencial → Catálogo
- Current: `t.label` es input principal y `t.code` aparece debajo en tipografía secundaria.
- Verdict: mantener; opcionalmente plegarlo bajo “Detalles técnicos” para perfiles no técnicos.
- Classification: TECHNICAL_VISIBLE_BUT_ACCEPTABLE
- Priority: informativo

## Suggested business-label mapping

Estos mapeos se derivan de labels ya presentes en el producto o de significado técnico inequívoco. Los que dependen de negocio se dejan como pregunta.

| Internal key/current | Admin display | Presentation rule |
|---|---|---|
| `program_id` | Programa | mostrar nombre del catálogo; key secundaria |
| `request_type` | Tipo de solicitud | selector de labels aprobados |
| `financial_processing_status` | Estado de procesamiento financiero | enum traducido |
| `created_at` | Fecha de registro | control de fecha |
| `enabled` | Activo | Sí/No o toggle según contexto |
| `company_id` | Empresa | selector por nombre |
| `audience_mode` | Público destinatario | Todos / Registrados / Segmento |
| `published` | Publicado | Sí/No |
| `placement` | Ubicación del banner | selector por pantalla/posición |
| `kind` | Tipo de documento | selector de nombres |
| `published_on` | Fecha de publicación | fecha |
| `requires_quote` | Requiere cotización | Sí/No |
| `program_key` | Programa | nombre del programa |
| `request_mode` | Forma de solicitud | enum traducido |
| `resource` | Módulo afectado | nombre de recurso RBAC |
| `action` | Acción realizada | Ver / Crear / Editar / Eliminar / Reordenar |
| `result` | Resultado | Exitoso / Denegado / Fallido |
| `destination_path` | Destino del QR | selector por pantalla |
| `sort_order` | Posición | drag/drop o “Posición N” |
| `auth_eligibility` | Estado de acceso | mapping pendiente de catálogo exacto |

Los cinco campos `*_raw` financieros/afiliación no deben recibir una traducción automática genérica: su nombre de negocio y catálogo autorizado deben venir de la autoridad financiera/perfil, no del frontend.

## Admin terms with unknown meaning

| Screen | Displayed term/value | Technical source | Likely category | Confidence | Why unclear | Owner question |
|---|---|---|---|---|---|---|
| Documents → Catalog | “Cuenta para el 100% del expediente” | `required_by_default` | obligatoriedad/completitud | media | el booleano es conocido, el lenguaje de negocio aprobado no | ¿Debe llamarse “Documento obligatorio” o conserva una regla histórica distinta? |
| Tu Sindicato | “contenido original” | `resetModule` | restauración/versionado | baja | no hay seed/version/backup asociado | ¿Qué versión/fuente se considera original? |
| Roles → Textos | “personas autorizadas” además de roles | copyStore no-op | autorización | baja | contradice/duplica potencialmente `content.write` | ¿Existe allowlist individual aprobada? |

## Admin wrong / irrelevant data display

| Screen | Expected business data | Actual data | Source | Why it does not belong as primary | Recommended separation |
|---|---|---|---|---|---|
| Tu Sindicato | nombre/destino de la pantalla | authority/repository IDs | registry | describe implementación, no tarea | texto humano + detalles técnicos |
| Identity | estado humano de acceso | raw enum | search result | requiere conocer contrato | badge traducido + code secundario |
| Requests | nombre del programa | `program_id` fallback | request row | key no es nombre | integridad visible + detalles |
| Approvals | nombre de empresa | UUID fallback | proposal | ID no identifica para un humano | “Empresa sin nombre” + copy ID |
| Secciones/Menús/Formularios | capacidad real de administrar | edición aparente sobre código estático | cutover store | presenta una capacidad inexistente | modo lectura/origen versionado |
| Flujos | estado actual de integración | “al conectar Supabase” | copy estático | información obsoleta | copy de estado actual |

## Context and hierarchy review

Fortalezas:

- Los módulos principales tienen title/subtitle y acción primaria identificable.
- Los editores visuales suelen usar labels humanos, preview y estados de publicación.
- Roles traduce recursos y acciones a nombres legibles; no muestra códigos de permiso como label principal.
- Documentos ya separa `label` principal de `code` secundario.

Problemas transversales:

- Los detalles técnicos aparecen mezclados con la explicación operativa, sin nivel secundario.
- Algunos fallbacks convierten IDs en nombres y ocultan una falla de integridad.
- `prompt()` transfiere decisiones de schema al operador.
- Varias pantallas dicen que modifican el frontend cuando su writer está deshabilitado.
- Botones icon-only sin nombre accesible y fallbacks de icono reducen la claridad para lectores de pantalla y usuarios visuales.

## Owner clarifications required

1. Confirmar el nombre de negocio de `required_by_default`: ¿“Documento obligatorio”, “Requerido para completar expediente” u otra regla histórica?
2. Definir qué es “contenido original” en Tu Sindicato y cuál es su fuente/version recuperable.
3. Definir si la autorización individual de edición de textos existe además de RBAC o si la vista es legacy/prototipo.

## Final result

### ADMIN SEMANTIC CLARITY RESULT

```text
Screens audited: 36 contexts / 28 primary modules
Technical terms visible: 39
Confusing technical terms: 35
Missing business labels: 31
Unknown meanings: 3
Wrong data displayed: 1 cross-screen family (6 manifestations)
Raw IDs exposed: 3 fallback paths
Raw enums exposed: 1
Unlabeled numeric fields: 1
Suggested label fixes: 37
Owner clarifications: 3
P1: 3
P2: 9
P3: 4
Final semantic quality: NEEDS_ATTENTION
Destructive production writes: 0
```

No se renombró ninguna clave interna, enum, API, tabla o contrato. Las recomendaciones separan presentación administrativa de identidad técnica.
