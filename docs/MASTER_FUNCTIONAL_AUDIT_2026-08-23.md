# Auditoría funcional maestra y remediación — 2026-08-23

Estado: `IN_PROGRESS`  
H: `H-MASTER-REM-001`  
Método: `AUDIT → AUTHORITY → PLAN → RISK → IMPLEMENT → VERIFY → EVIDENCE`

## Alcance y autoridades

Se contrastaron las 25 herramientas visibles de Admin, las superficies señaladas en el PDF y los contratos vigentes de `SOURCE_OF_TRUTH`, `DATA_MAPPING`, seguridad, legacy y preservación Claude. Esta H no cambia autoridades: contenido visual continúa en Supabase; Ahorro, Préstamos, criterios, fórmulas y conciliaciones continúan en Google legacy protegido. No hubo escritura de datos ni interacción Google.

La auditoría transversal sigue abierta. Este corte documenta el inventario inicial y cierra localmente las primeras capacidades seguras: `BANNERS`, `IMAGE_VIEWER` y `DELETE_STANDARD`. La delegación por responsable queda bloqueada porque la migración local preexistente `20260823000200_section_ownership_and_public_reads.sql` no separa correctamente permisos por operación/sección y su recovery no restaura todas las policies anteriores.

## Matriz Admin inicial

| Módulo Admin | Autoridad vigente | Estado de control | Riesgo o deuda siguiente |
|---|---|---|---|
| Identidad y expediente | Supabase | PRODUCTIVE | Verificar cobertura total de consumidores |
| Pop-ups por pantalla | Supabase | PRODUCTIVE_WITH_FIX_PENDING_DEPLOY | Borrado seguro preparado; requiere deploy remoto |
| Tu Sindicato | Supabase | PRODUCTIVE | Continuar matriz campo por campo de 9 pantallas |
| Solicitudes | Supabase | PRODUCTIVE | Sin ampliar frontera financiera |
| Finanzas · Solicitudes | Supabase + Google posterior | PRODUCTIVE_HYBRID | Writer financiero gobernado por Phase 7 |
| Fondos y reglas | Google legacy | PRODUCTIVE_READONLY | Prohibido reimplementar cálculo |
| Catálogo de Finanzas | Supabase + legacy | PRODUCTIVE_HYBRID | Revisar reflection por perfil sin tocar reglas |
| Etapas y seguimiento | Supabase + legacy | PRODUCTIVE_HYBRID | Verificar cobertura de estados reales |
| Marketplace | Supabase | PRODUCTIVE | Auditoría CRUD/orden/assets pendiente |
| Aprobación de Pop-ups | Supabase | PRODUCTIVE | Sin cambio en esta H |
| Planes de empresas | Supabase | PRODUCTIVE | Auditoría reflection pendiente |
| Membresías | Supabase + Google solicitudes | PRODUCTIVE | Histórico protegido |
| Noticias | Supabase | PRODUCTIVE | Editor enriquecido seguro conectado al campo autoritativo `body` |
| Educación y tutoriales | Supabase | PRODUCTIVE_PARTIAL | Vistas Admin separadas; comparten permiso técnico actual |
| Convenios y beneficios | Supabase | PRODUCTIVE_PARTIAL | Visor global conectado; revisar chips/segmentación |
| Catálogos de segmentación | Supabase | PRODUCTIVE | Reproducir caso live del PDF por usuario |
| Roles y permisos | Supabase | PRODUCTIVE | No usar UI como seguridad |
| Acceso a pantallas | Supabase | PRODUCTIVE | Verificación multiusuario pendiente en este ciclo |
| Secciones y componentes | Supabase + estructura versionada | PRODUCTIVE_HYBRID | Ownership preexistente inseguro: BLOCKED |
| Banners | Supabase | PRODUCTIVE_WITH_FIX_PENDING_DEPLOY | Rotación/acción/zoom conectados; delete DB pendiente deploy |
| Empresas | Supabase | PRODUCTIVE_WITH_FIX_PENDING_DEPLOY | Delete DB pendiente deploy |
| Documentos y PDF | Supabase | PRODUCTIVE_WITH_FIX_PENDING_DEPLOY | Delete DB pendiente deploy |
| Menús y botones | Supabase + código | PRODUCTIVE_HYBRID | Preservar INV-041; no CMS genérico |
| Formularios | Supabase + código | PRODUCTIVE_HYBRID | Estructura no se delega sin contrato |
| Ícono e instalación | Supabase + derivados PWA | PRODUCTIVE | Sin cambio en esta H |

## Observaciones del PDF

| Observación | Evidencia encontrada | Estado |
|---|---|---|
| Segmentación por perfil no disponible | ADR-041 y repositorios existen; falta reproducir caso live | `PENDING_LIVE_REPRODUCTION` |
| Responsable por sección mediante email y CRUD acotado | Migración local preexistente mezcla operaciones y secciones; AdminRepository no incorpora responsables | `BLOCKED_SECURITY_REDESIGN` |
| Noticias con texto enriquecido | Editor y renderer seguro sobre el mismo `body`; sin HTML crudo | `FIXED_LOCAL` |
| Orden configurable en todas las listas | Noticias ya tenía drag; CRUD visual ahora muestra subir/bajar en cada recurso | `FIXED_LOCAL`, atomicidad backend pendiente |
| Educación separada de Tutoriales | Autoridad conserva `resource_kind`; Admin ahora filtra y crea por dos ámbitos explícitos | `FIXED_LOCAL` |
| Imágenes de encabezado no reflejan Admin | Assets Supabase existen; Home estaba fijado a `[0]` | `PARTIALLY_FIXED` |
| Zoom/pinch global de imágenes | Había implementaciones aisladas | `FIXED_LOCAL` |
| Convenios Admin vacío/chips faltantes | Reader tiene 33 empresas; visor preservado; chips requieren prueba live | `PENDING_LIVE_REPRODUCTION` |
| Banner Home estático/sin click/zoom/delete | Home fijaba primer banner y no compartía visor | `FIXED_LOCAL`, delete `PENDING_DEPLOY` |
| Admin Empresas faltante | Tarjeta y CRUD existen; reflection requiere sesión live | `PENDING_LIVE_REPRODUCTION` |
| Botón Convenios Suti vacío/redirección | `Convenios2` es autoridad; “Convenios Suti” fue descartada por estar vacía | `AUTHORITY_RESOLVED`, reflection pendiente |

## Remediación implementada en este corte

1. Home consume todos los banners autoritativos, rota automáticamente, permite swipe/dots, abre acción HTTPS segura y amplía la imagen.
2. Un visor reutilizable aporta zoom, pan, rueda, doble click, pinch de dos puntos, reset, navegación y cierre por teclado.
3. Convenios —anuncios, portada y galería—, artículos/noticias y catálogo reutilizan el visor sin eliminar secciones Claude.
4. Admin ofrece borrar recursos creados desde la consola y mantiene oculto el borrado de `HISTORICAL_IMPORT`.
5. La migración `20260823000300` reemplaza policies `FOR ALL`, concede `DELETE` y limita el borrado backend a `record_origin='ADMIN_H009'`. Su recovery revoca el grant y restaura el estado anterior.
6. Noticias edita títulos, negrita, cursiva, listas y enlaces seguros en el mismo `body`; el frontend lo interpreta como nodos React y nunca inyecta HTML.
7. Los CRUD visuales exponen orden ascendente/descendente para banners, pop-ups, empresas, documentos, Educación y Tutoriales.
8. Educación y Tutoriales conservan una tabla/autoridad, pero se administran en pestañas separadas y cada alta recibe el `resource_kind` de su ámbito.

## Reflection matrix del corte

| Cambio Admin | Autoridad | Frontend consumidor | Evidencia |
|---|---|---|---|
| Orden/estado/imagen/acción de banner | `banners + app_assets + Storage` | Home | Rotación, dots, swipe, acción segura y visor conectados |
| Imagen de anuncio Convenios | misma autoridad visual | Carrusel Convenios | Visor global conectado |
| Portada/galería de empresa | `companies + company_assets + app_assets` | Detalle Convenio | Visor global conectado |
| Imagen de artículo | `news_articles + app_assets` | Artículo | Visor global conectado |
| Imagen de catálogo | autoridad catalogal existente | Detalle catálogo | Visor global conectado |
| Borrado de contenido Admin | tabla de dominio + RLS | Admin Visual CRUD | UI preparada; aplicación remota `BLOCKED` por acceso de gestión 403 |
| Formato de noticia | `news_articles.body` | Artículo | Editor/preview/renderer seguro conectados |
| Orden visual | `sort_order` de cada tabla | Listas consumidoras existentes | Controles Admin conectados a `reorderManaged` |
| Tipo educativo | `educational_resources.resource_kind` | Admin Educación/Tutoriales | Pestañas y altas separadas sin duplicar autoridad |

## Verificación

- `test-master-remediation-ui.js`: `PASS`.
- `test-h0072.js`, `test-phase2.js`, `test-admin-productization.js`, `test-phase3.js`, `test-claude-ui-preservation.js`, `test-phase7.js`: `PASS`.
- `node --check app/bundle.js`: `PASS`.
- Bundle reproducido desde 78 fuentes; HTML `v93`, PWA cache `v38`.
- `scripts/audit.ps1`: exit `0`, `309` coincidencias, `REVIEW REQUIRED`; son deuda transversal clasificable, no prueba de autoridad productiva.
- Navegador real: rotación Home, zoom y detalle Convenios alcanzaron `PASS`; el borrado live reprodujo el bloqueo SQL y quedó sin fixtures residuales.
- Supabase remoto: consulta de gestión devolvió `403`; no se aplicó ninguna migración ni se alteraron datos.

## Veredictos guardian

- Source of truth: `PASS`; sin nueva autoridad ni fallback.
- Invariantes: `PASS` local; históricos no borrables por UI/RLS diseñada.
- Seguridad: `PASS` para diseño local de `20260823000300`; deploy `BLOCKED` hasta inspección/aplicación remota verificable.
- Migración: `PASS` local, reversible y sin DML; deploy `BLOCKED`.
- Legacy Google: `NOT APPLICABLE / NO INTERACTION`.
- Preservación Claude: `PASS` estático; contratos Home/Convenios conservados y extendidos.

## Próximo bloque autorizado

1. Recuperar acceso de gestión Supabase, inspeccionar policies/grants reales, aplicar `20260823000300`, ejecutar prueba reversible de borrado Admin/histórico y recovery dry-run.
2. Rediseñar `section_ownership` antes de deploy: permisos por operación, recursos disjuntos, entrada Admin autorizada, auditoría y recovery completo.
3. Continuar `SEGMENTATION_REPRODUCTION → SECTION_OWNERSHIP_REDESIGN → REFLECTION_LIVE` con una H por capacidad y evidencia multiusuario.

## Revisión arquitectónica independiente

Veredicto general: `NEEDS_FIX`.

- `APPROVED`: autoridad única, Home/banner, visor global, formato seguro de Noticias, separación visual Educación/Tutoriales, controles de orden, preservación Claude, bundle y fronteras legacy.
- `BLOCKED_REMOTE`: inspección/aplicación de `20260823000300` y prueba reversible live; Supabase Management devuelve `403`.
- `NEEDS_FIX`: `20260823000200_section_ownership_and_public_reads.sql` no debe desplegarse. Un único permiso `.write` eleva crear/editar/eliminar, Educación/Tutoriales comparten policy y Empresas/Convenios comparten entidad sin discriminador de ownership. Su recovery tampoco repone todas las policies sustituidas.

Instrucción exacta siguiente para Codex: **con acceso Supabase Management restaurado, inspeccionar primero schema/policies/grants live; no ejecutar `apply-master-remediation.py`; aplicar y probar sólo `20260823000300`; después sustituir `20260823000200` por un contrato de capabilities por operación y recurso, con módulos compartidos resueltos explícitamente, RPC de contexto Admin, RLS multiusuario, auditoría y recovery equivalente antes de cualquier deploy.**

## Actualización — H-MASTER-REM-NEWS-001

El primer piloto editorial quedó `ENFORCED` exclusivamente para Noticias. Se desplegaron la foundation `00400`, el enforcement `00500` y las correcciones estrechas `00501/00502`; las otras nueve definiciones permanecen `DESIGN_ONLY`.

- Autoridad: `news_articles`, `news_settings`, `app_assets` y Storage continúan siendo la única fuente de contenido; las responsabilidades sólo autorizan acciones y persisten UUID, no email.
- Seguridad: policies por operación y triggers `OLD/NEW` exigen `read/create/update/delete/publish/order/assets` de forma independiente. `service_role` sólo cruza el trigger como frontera backend verificada; no se expone al navegador.
- UI: H005_TEST administra asignaciones; el responsable ve sólo Noticias y controles correspondientes. La estructura Claude, tarjeta de responsable, editor, orden y reflejo público se conservaron.
- Pruebas: matriz reversible principal/responsable/dos normales/anónimo, autoescalación, aislamiento transversal, assets, auditoría, revocación inmediata/nueva sesión, reflexión pública y Chrome real: `PASS`.
- Históricos y cleanup: cero históricos creados/borrados; `record_origin` protegido; conteo final de fixtures `NEWS_OWNER_*`/`NEWS_BROWSER_*` igual a cero.
- Recovery: cadena `00502 → 00501 → 00500 → 00400` validada completa en una transacción con `ROLLBACK`; cero escrituras persistentes.
- Legacy: Google, Ahorro, Préstamos, fórmulas, triggers financieros y conciliaciones: `NOT APPLICABLE / NO INTERACTION`.

Veredicto del piloto: `PASS`. No autoriza activar otra sección.

## Actualización de seguridad live — H-MASTER-REM-SEC-001/002

Esta sección sustituye los estados `403`, `PENDING_DEPLOY` y `BLOCKED_REMOTE` anteriores; se conservan arriba únicamente como cronología del primer corte.

### Acceso y estado real

- El token local de Management fue validado contra el proyecto vinculado `ACTIVE_HEALTHY`. El `403` previo no requería crear ni copiar otro secreto: el problema efectivo fue de contexto de proceso/red y precedencia de credenciales.
- La inspección read-only confirmó RLS habilitada y forzada en `companies`, `banners`, `popups`, `institutional_documents`, `news_articles` y `educational_resources`.
- Antes del hardening existían tres policies amplias `FOR ALL`; Noticias/Educación conservaban grants de borrado y las cuatro tablas H-009 no. No existía ningún objeto de ownership live.
- El inventario protegido era 67 filas `HISTORICAL_IMPORT` y dos filas `ADMIN_H009`; no se alteró ninguna fila histórica.

### DELETE_STANDARD productivo

- Se aplicó exclusivamente `20260823000300_harden_admin_content_delete.sql` (SHA-256 `A4E5D4E9811E9AE266D0FF882A41CF660FA4389B453E4FD7D8F085FD30915197`).
- Estado reconciliado: cuatro policies DELETE restringidas por `record_origin='ADMIN_H009'`, cuatro grants DELETE, cero policies amplias anteriores y cero objetos del diseño rechazado.
- Prueba reversible: Admin borró su fixture; el histórico permaneció; dos usuarios normales y anónimo fueron denegados; `admin_audit_log` registró el DELETE exitoso; el conteo de pop-ups quedó restaurado.
- Navegador real: `h009_ui_confirmed_delete=true`; la UI reflejó el borrado y no dejó fixtures.
- Migration + recovery ejecutadas dentro de transacción y revertidas: `PASS`. La ruta de recuperación no se aplicó persistentemente.

### Ownership granular local, no desplegado

- `20260823000200_section_ownership_and_public_reads.sql` permanece `REJECTED / DO NOT DEPLOY` y no figura live.
- `scripts/apply-master-remediation.py` fue clasificado `FORBIDDEN_AS_IS` y convertido en tombstone fail-closed: siempre informa cero escrituras y sale bloqueado.
- El reemplazo local `20260823000400_granular_section_capability_foundation.sql` separa usuario UUID, sección y acción (`read/create/update/delete/publish/order/assets`), no modifica `has_admin_permission`, bloquea autoasignación y audita actor real.
- Educación/Tutoriales y Empresas/Convenios tienen fronteras explícitas y distintas aun cuando comparten autoridades físicas. Todas las secciones nacen `DESIGN_ONLY`; por tanto no aceptan asignaciones ni conceden acceso.
- Compilación live de migration + recovery dentro de una transacción con `ROLLBACK`: `PASS`, cero escrituras persistentes y cero residuos.
- El contrato y el gate por sección están en `GRANULAR_SECTION_RESPONSIBILITY_DESIGN.md`. Falta una H independiente para policies/trigger por columnas, paths Storage, adaptación de `AdminRepository`, tests multiusuario y activación `ENFORCED`; no se simula como terminado.

### Veredictos actualizados

- Management access: `PASS`.
- DELETE_STANDARD live: `PASS`.
- Fuente de verdad e históricos: `PASS`; 67 históricos preservados.
- Seguridad Supabase: `PASS` para el hardening desplegado; ownership `PASS_DESIGN_ONLY / NOT DEPLOYED`.
- Migraciones: `00300 PASS LIVE`; `00400 PASS TRANSACTIONAL_COMPILE / NOT DEPLOYED`; `00200 REJECTED`.
- Google/finanzas legacy: `NOT APPLICABLE / NO INTERACTION`.
- Preservación Claude: `PASS`; este corte de seguridad no modificó pantallas.

Próxima instrucción exacta: **abrir una H separada por la primera sección editorial; sustituir sus policies amplias por operación, añadir enforcement `OLD/NEW` y Storage aislado, conectar `get_admin_access_context`, ejecutar matriz Admin/responsable/normal/anónimo y sólo entonces marcar esa sección `ENFORCED`. No desplegar la foundation sola.**

### Revisión arquitectónica de cierre del corte

Veredicto: `APPROVED` para `H-MASTER-REM-SEC-001/002`; el MASTER general continúa `IN_PROGRESS`.

- La revisión exigió que la resolución por email demostrara coincidencia confirmada única. El RPC ahora falla explícitamente ante cero o múltiples resultados y persiste sólo UUID.
- Evidencia suficiente: estado live, hash, matriz multiusuario/anónimo, protección histórica, auditoría, cleanup, compilación y recovery con rollback, tombstone y ausencia de cambios frontend/Google.
- La aprobación cubre DELETE_STANDARD productivo y el artefacto local `DESIGN_ONLY`. No autoriza deploy de `00400`, activación `ENFORCED` ni ownership productivo.
