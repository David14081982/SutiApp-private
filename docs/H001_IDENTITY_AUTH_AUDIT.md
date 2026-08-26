# H-001 — Identity & Auth Architecture Audit

Fecha: 2026-08-21. Estado del documento: **APROBADO COMO AUDITORÍA Y DISEÑO**. Las decisiones fueron resueltas por el propietario el 2026-08-21 y se registran como ADR-011 a ADR-016 en `DECISIONS.md`. Esta H no instala Supabase, no define SQL, no crea tablas y no modifica comportamiento.

## Resumen ejecutivo

El frontend no tiene una sesión de afiliado real. Mezcla tres conceptos incompatibles:

1. un afiliado demo completo en `DATA.user`;
2. un “espectador” editable que simula cargo/sindicato/nivel/sesión;
3. sesiones administrativas y empresariales controladas por `localStorage`.

La futura arquitectura debe separar el **afiliado de negocio** de la **identidad Auth**. Está aprobada una sola entidad conceptual `affiliate`, con UUID interno, `numero_control` histórico TEXT y vínculo Auth opcional. H-003/ADR-017 sustituyeron la hipótesis inicial de unicidad: `UNIQUE(numero_control)` permanece bloqueado por anomalías. No se justifica una segunda entidad `profiles` hoy: duplicaría ciclo de vida e identidad sin aportar una frontera real.

## A. Current identity map

| Archivo / evidencia | Símbolo | Entidad representada | Lectura | Escritura | Persistencia | ¿Ejecutable en producción estática? | Autoridad aparente | Riesgo |
|---|---|---|---|---|---|---|---|---|
| `app/data.jsx:1-49,275` | `user`, `window.DATA.user` | Afiliado demo con identidad, contacto, empleo, sindicato y finanzas | Directa por pantallas | Solo editando código/bundle | Código y bundle | Sí | Mock presentado como usuario actual | **CRÍTICO** |
| `app/admin-store.jsx:143-154,223-225` | `viewer` / `suti_admin_viewer_v1` | Espectador de segmentación: `cargo`, `sindicato`, `nivel`, `registrado` | Stores, pantallas y gates | `setViewer()` desde varios paneles | `localStorage` | Sí | Contexto de usuario simulado | **CRÍTICO**: se confunde con sesión/atributos reales |
| `app/finance-store.jsx:33-46` | `userContext()` | Identidad compuesta para financiamiento | Solicitudes, historial, cotizaciones | Se reconstruye desde `DATA.user + viewer` | En memoria; luego snapshot local | Sí | “Usuario actual” canónico del prototipo | **CRÍTICO**: mezcla dos fuentes |
| `app/finance-store.jsx:79-124` | `req.usuario` | Snapshot de solicitante | Historial, Finanzas, empresas | `build()` y `submit()` | `suti_finanzas_solicitudes_v1` | Sí | Snapshot transaccional local | **ALTO**: `id` usa `u.num`, no `numero_control` |
| `app/quotes-store.jsx:54-83` | `userCtx()`, `req.usuario` | Snapshot de afiliado interesado | Afiliado, Finanzas, empresa | `solicitar()` | `suti_cotizaciones_v1` | Sí | Derivado de financeStore | **ALTO** |
| `app/company-store.jsx:57-76` | `seedSolicitudes()`, `solicitudes` | Personas mock en solicitudes empresariales | Panel empresa | Seed/reset/estado/comentario | `suti_company_solicitudes_v1` | Sí | Fuente local paralela | **ALTO** |
| `app/admin-store.jsx:144,154,226-229` | `auth` / `suti_admin_auth_v1` | Sesión administrativa booleana | `AdminScreen` | `login()`/`logout()` | `localStorage` | Sí | Auth admin simulada | **CRÍTICO** |
| `app/admin-store.jsx:157-179,234-272` | `roles`, `actingRoleId` | Roles y rol técnico actuante | Todos los módulos admin | CRUD de roles y `setActingRole()` | `localStorage` | Sí | Autorización técnica local | **CRÍTICO** |
| `app/admin-store.jsx:394-428` | `screenAccess` | Reglas de acceso por perfil simulado | Router/gates | Panel Pantallas | `localStorage` | Sí | Autorización de pantalla local | **CRÍTICO**: UI no es seguridad |
| `app/copy-store.jsx:13-20,61-88` | `editors`, `db.me` | Personas autorizadas y editor activo | Live text | CRUD/select desde Roles | `suti.copy.v1` | Sí | Autorización técnica paralela | **CRÍTICO** |
| `app/company-store.jsx:40-55,74-120` | `companies`, `authId` | Empresa actual y sesión empresarial | Panel empresa | Login, logout y formulario Mi Empresa | `localStorage` | Sí | Identidad empresarial simulada | **CRÍTICO** |
| `app/app.jsx:6-31` | `suti_user_photo` | Foto del afiliado visible | TopBar, Perfil, Credencial | Cargar/cambiar/quitar | `localStorage` data URL | Sí | Preferencia/copia de perfil | **ALTO** por PII y falta de asociación a usuario |
| `app/screens-credencial.jsx:24-30,95-101` | `bank`, `suti_bank_v1` | Datos bancarios del afiliado demo | Credencial | Formulario BankSheet | `localStorage` | Sí | Fuente local aparente | **CRÍTICO** por dato financiero sin identidad ni backend |
| `app/data.jsx:187-213` | `comite` | Directorio de personas/cargos | Inicio y Tu Sindicato | Código/admin de contenido | Código/store local | Sí | Contenido/directorio, no cuenta | **MEDIO**: no migrar como usuarios Auth automáticamente |
| `app/company-store.jsx:44-55` | empresas/contactos | Identidad y contacto organizacional | Paneles/convenios | Mi Empresa | `localStorage` | Sí | Entidad empresarial, no afiliado | **ALTO** si se mezcla con identidad personal |
| `app/bundle.js` | copias compiladas | Todas las anteriores | Runtime real | Build manual | Archivo | Sí; es lo ejecutado | Artefacto | **ALTO** por divergencia posible con `.jsx` |

No se encontraron React Contexts de identidad, `sessionStorage`, IndexedDB, cliente Supabase, `.env`, SDK, API de negocio ni Auth real. Evidencia: búsqueda global de `DATA.user`, `viewer`, `userContext`, almacenamiento y Auth en `app/*.{js,jsx}`.

## B. User readers

### Afiliado demo y snapshots

| Pantalla/componente | Cadena exacta | Datos consumidos | Evidencia |
|---|---|---|---|
| `TopBar` | `TopBar → D().user → window.DATA.user` y `useUserPhoto → localStorage` | nombre corto, crédito, ahorro, avatar | `app/app.jsx:65-69,114-122` |
| `PerfilScreen` | `Perfil → D().user / useUserPhoto → DATA/localStorage` | nombre, sección, número, foto | `app/app.jsx:229-261` |
| Inicio, tres heroes | `Hero* → D().user → DATA.user` | nombre, rol, afiliado, vigencia, ahorro/crédito | `app/screens-home-r2.jsx:7-29,41-75` |
| Mi Financiera | `SummaryCard → D().user → DATA.user` | crédito, ahorro, nómina | `app/screens-financiera.jsx:5-22` |
| Préstamo | `LoanScreen/perfilLimites → viewer/fundsStore; fallback DATA.user` | perfil de segmentación, crédito, nómina | `app/screens-loan.jsx:7-14,67-74,237-250` |
| Financiamiento Marketplace | `FinanceSimSheet → D().user → DATA.user → financeStore.build()` | crédito, nómina y snapshot | `app/screens-marketplace.jsx:336-358` |
| Credencial | `CredentialScreen → D().user + useUserPhoto + bank local` | identidad completa, email, estatus, foto y banco | `app/screens-credencial.jsx:24-76,95-101,140-172` |
| Historial | `HistorialScreen → financeStore.mine() → userContext() → DATA.user/viewer`, agregado con `DATA.solicitudes` | solicitudes propias aparentes y mocks | `app/screens-historial.jsx:14-23`; `app/finance-store.jsx:33-46,134` |
| Cotizaciones/notificaciones | `quoteStore.mine/latest/readyUnseen → userCtx → financeStore.userContext` | filtrado por `u.num` | `app/quotes-store.jsx:54-56,100-110`; `app/app.jsx:68-69` |
| Panel Finanzas | `FinanzasModule → financeStore/quoteStore → req.usuario` | nombre, afiliado, sindicato, cargo/categoría | `app/screens-admin-finanzas.jsx:55-70,115-123,168-173` |
| Panel Empresa | `CoSolicitudes/CoCotizaciones → companyStore/quoteStore → snapshots` | persona solicitante y sindicato | `app/company-store.jsx:129-142`; `app/screens-company-modules.jsx:249-280` |

### Espectador de segmentación

```text
Paneles admin
  → adminStore.setViewer()/viewer()
  → suti_admin_viewer_v1
  → audienceMatch / screenAllowed / finCatStore / sindicatoStore / fundsStore
  → contenido, pantallas y límites mostrados al supuesto usuario
```

Lectores comprobados:

- Inicio: acciones, noticias, secciones y pop-ups (`screens-home-r2.jsx:106-142,287-297`; `app.jsx:385-398`).
- Convenios/anuncios/beneficios (`screens-convenios.jsx:8-9,112-175`).
- Catálogo financiero y recomendaciones (`fincat-store.jsx:20-54`).
- Contenido sindical (`sindicato-store.jsx:21-23,116-119`).
- Préstamos/fondos (`screens-loan.jsx:7-13`).
- Gates de pantalla (`admin-store.jsx:394-428`; `app.jsx:402-428`).

### Resultados negativos importantes

- `DocumentosScreen` lee `DATA.docs`, no identidad (`screens-documentos.jsx:4,13`).
- Membresías no filtra por afiliado; lee `membershipStore` (`screens-membresias.jsx:16`).
- “Configuración” no existe como pantalla: Perfil solo muestra un toast (`app/app.jsx:239`).
- El botón “Cerrar sesión” del afiliado solo muestra un toast y no cambia estado (`app/app.jsx:261`).

## C. User writers

| Escritor | Qué modifica | Destino | Evidencia | Riesgo |
|---|---|---|---|---|
| Selector/recorte de foto | avatar | `suti_user_photo` | `app/app.jsx:6-31,247-255` | PII sin clave de usuario; persiste entre supuestos usuarios |
| BankSheet | banco, cuenta, CLABE | `suti_bank_v1` | `screens-credencial.jsx:30,95-101` | Dato financiero controlado por cliente |
| Viewer bars de Admin/Contenido/Sindicato/Pantallas | cargo, sindicato, nivel, `registrado` | `suti_admin_viewer_v1` | `screens-admin.jsx:118-184`; `screens-admin-content.jsx:143-157`; `screens-admin-sindicato.jsx:141-146`; `screens-admin-pantallas.jsx:149-167` | Cambia segmentación y acceso aparente |
| RolesModule/RoleEditor | rol, matriz de permisos, rol actuante | `suti_admin_roles_v1`, `suti_admin_acting_v1` | `screens-admin-roles.jsx:23,77,99-125`; `admin-store.jsx:234-272` | Elevación local de privilegios |
| PantallasModule | reglas de acceso | `suti_admin_screen_access_v1` | `screens-admin-pantallas.jsx:62,195`; `admin-store.jsx:394-407` | Gate solo UI |
| Copy editors | personas autorizadas/editor activo | `suti.copy.v1` | `screens-admin-roles.jsx:225-238`; `copy-store.jsx:61-88` | Segundo sistema de permisos |
| Finance/quote submit | snapshot del supuesto afiliado, firma, términos | solicitudes/cotizaciones locales | `finance-store.jsx:79-124`; `quotes-store.jsx:65-83` | Snapshot nace de fuentes conflictivas |
| Finanzas/empresa | estado, observaciones, comentarios, cotización | stores locales | `finance-store.jsx:138-140`; `company-store.jsx:141-142`; `screens-company-modules.jsx:274` | Actores son strings, no identidades verificadas |
| Company login/Mi Empresa | `authId`, email/contacto empresarial | `suti_company_auth_v1`, `suti_company_data_v1` | `company-store.jsx:116-120`; `screens-company-modules.jsx:38-62` | Cualquier contraseña de 3+ caracteres |
| Edición de código/build | todos los campos `DATA.user` | código/bundle | `data.jsx:3-49`; `CLAUDE.md` build | Único escritor del afiliado demo completo |

No existe formulario que actualice nombre, email histórico, `numControl`, afiliación o estatus del afiliado. Esos valores solo cambian editando el mock.

## D. Current authentication

### Afiliado

- No hay validación de credenciales, sesión ni usuario autenticado.
- La aplicación siempre presenta `DATA.user` (`data.jsx:3-49`).
- `viewer.registrado` simula sesión, pero cualquier panel admin puede alternarlo y persiste en `localStorage` (`admin-store.jsx:153,225`; `screens-admin.jsx:182-184`).
- “Cerrar sesión” no ejecuta logout (`app.jsx:261`).
- Al refrescar, vuelve el mismo `DATA.user`; foto/banco/viewer reaparecen desde `localStorage`.

### Administrador

1. `AdminGate` muestra el literal `superadmin`.
2. Acepta cualquier contraseña cuya longitud, tras `trim`, sea al menos 3 (`screens-admin.jsx:13-34`).
3. `adminStore.login()` guarda `suti_admin_auth_v1=1` (`admin-store.jsx:226-229`).
4. El refresh restaura ese booleano (`admin-store.jsx:154`).
5. El rol actuante se restaura independientemente desde `suti_admin_acting_v1`; si no existe usa `superadmin` (`admin-store.jsx:177-178`). Un ID de rol inexistente también cae a `superadmin` (`admin-store.jsx:238`).
6. Existe `adminStore.logout()`, pero no se encontró un control UI que lo invoque; el botón “Salir” de `ActingBanner` solo restablece el rol actuante (`screens-admin-roles.jsx:16-23`).

### Empresa

1. Se selecciona una empresa de un `<select>` y se escribe cualquier contraseña de 3+ caracteres (`screens-company.jsx:15-38`).
2. `companyStore.login()` comprueba solo que el ID exista y la longitud de contraseña; el campo seed `pass: 'demo'` nunca se compara (`company-store.jsx:40-55,116-119`).
3. La sesión es el ID en `suti_company_auth_v1`; refresh la restaura si aún existe la empresa.
4. Logout sí está conectado en el header y elimina la clave (`screens-company.jsx:43-51`; `company-store.jsx:119`).

### Manipulación de `localStorage`

Permite activar admin, elegir empresa, declararse registrado, cambiar segmentación, seleccionar/fabricar roles, modificar permisos y sustituir datos. Por tanto, autenticación, autorización, sesión y auditoría actuales tienen veredicto productivo **FAIL**.

## E. Roles and permissions

### Rol de negocio — no usar directamente como autorización técnica

- `DATA.user.role`, `puestoSuti`, `puestoIsssteson`, afiliación y estatus (`data.jsx:6,33-40`).
- `viewer.cargo`, sindicato, nivel y registrado (`admin-store.jsx:32-48,153`).
- Empresa, plan y vigencia comercial (`company-store.jsx:26-37,81-86`).

Estos atributos pueden determinar experiencia o elegibilidad de negocio cuando procedan de una autoridad, pero no conceden permisos administrativos por sí solos.

### Permiso técnico actual

- Roles seed: `superadmin`, `admin`, `editor`, `consulta` (`admin-store.jsx:164-175`).
- Acciones: `ver`, `crear`, `editar`, `eliminar`, `reordenar` (`admin-store.jsx:53-59`).
- Recursos: módulos y pantallas enumerados en `admin-store.jsx:60-90`.
- Evaluación: `adminStore.can(action, resource)` en cliente (`admin-store.jsx:264-272`).
- Sistema paralelo: editores autorizados de textos en `copyStore.canEdit()` (`copy-store.jsx:61-88`).
- Restricción de pantallas: reglas de audiencia y `screenAllowed()` (`admin-store.jsx:394-428`).

### Modelo futuro propuesto

```text
principal autenticado
  → asignaciones técnicas administradas en backend
  → roles técnicos
  → permisos explícitos sobre recursos/acciones
  → autorización backend + RLS

afiliado de negocio
  → sindicato/categoría/cargo/estatus
  → reglas de negocio o audiencia
  ≠ permiso administrativo automático
```

Administradores y miembros de empresas deben ser principales autenticados con asignaciones propias. No deben representarse mediante `viewer`, `cargo` ni un ID editable en el navegador.

## F. Source-of-truth conflicts

1. **Afiliado actual:** `DATA.user` vs Excel maestro externo aún no identificado durante H-001; H-002 lo resolvió posteriormente como `Usuarios SUTIAPP.xlsx`.
2. **Identificador:** UI usa `num` y `numControl`; `financeStore` filtra por `u.num`, mientras el invariante exige `numero_control` (`data.jsx:7,17`; `finance-store.jsx:38-40,134`). El mapeo sigue `UNRESOLVED`.
3. **Contexto:** `financeStore.userContext()` fusiona afiliado demo y viewer (`finance-store.jsx:33-46`).
4. **Sesión:** `viewer.registrado`, admin auth y company auth son estados independientes.
5. **Roles:** matriz de `adminStore` y editores de `copyStore` son autoridades técnicas paralelas.
6. **Solicitantes:** `DATA.solicitudes`, `financeStore`, `quoteStore` y `companyStore.seedSolicitudes()` contienen personas/snapshots paralelos.
7. **Perfil:** foto y datos bancarios no están asociados a una identidad; sobreviven al supuesto logout.

```text
SOURCE OF TRUTH AUDIT
Domain: Identidad, autenticación y autorización
Authority: SOURCE OF TRUTH CONFLICT / UNRESOLVED
Readers: UI afiliado, financiamiento, historial, Admin, empresas, segmentación
Writers: código, localStorage, paneles admin/empresa y stores locales
Alternative sources: DATA, viewer, snapshots, company seeds, copy editors
Fallbacks: defaults de viewer/userContext, DATA.solicitudes, fallbacks de stores
Caches: localStorage y CacheStorage del service worker
Conflicts: 7 enumerados arriba
Verdict: BLOCKED para integración o migración; SAFE para continuar diseño/auditoría
Evidence: secciones A-E
```

## G. Proposed user architecture

### Recomendación: una entidad de afiliado; no `users + profiles`

Usar conceptualmente `affiliate` (nombre final por aprobar) como único agregado de negocio:

```text
affiliate
- internal_uuid
- numero_control                     TEXT raw, permanente; no unique todavía
- historical_email_raw              nullable; nunca “limpiado” destructivamente
- historical_email_normalized       derivado, nullable
- auth_user_id                       nullable y único
- auth_eligibility                   eligible | missing | invalid | duplicate | disabled
- auth_ineligibility_reason          nullable
- original_source_ordinal            preserva orden histórico
- affiliate_status y datos de negocio
- provenance / timestamps
```

Esto es modelo conceptual, no schema. El estado de sesión no pertenece al afiliado: se deriva de Auth. Una vista/DTO `UserProfile` puede servir a la UI sin convertirse en segunda autoridad.

Separar `profiles` solo tendría sentido si aparece una frontera real de ciclo de vida, sensibilidad o permisos distinta. H-001 no encontró esa necesidad. Separar por costumbre agregaría joins, riesgo de registros huérfanos y dos lugares aparentes para “el usuario”.

Los administradores y miembros de empresas no deben insertarse artificialmente como afiliados. Deben relacionarse con el principal Auth mediante asignaciones técnicas/organizacionales conceptualmente separadas.

## H. Auth relationship

Cardinalidad propuesta:

```text
affiliate 1 ───── 0..1 Auth identity
Auth identity 1 ─ 0..1 affiliate
```

Flujo:

```text
email de credencial + contraseña
  → Supabase Auth valida
  → sesión/JWT identifica auth_user_id
  → vínculo servidor busca affiliate
  → verifica estado de acceso
  → establece contexto por internal_uuid + numero_control
```

- `numero_control` nunca se usa como contraseña ni se confía desde un parámetro del frontend.
- `auth_user_id` es vínculo técnico; no sustituye `numero_control`.
- Un Auth sin vínculo de afiliado recibe estado controlado `AUTH_IDENTITY_WITHOUT_AFFILIATE` y cero datos personales.
- Un afiliado deshabilitado conserva registro histórico y vínculo, pero la autorización niega acceso.
- Logout elimina/termina la sesión según alcance aprobado; refresh usa el mecanismo de sesión de Auth, no un booleano propio.
- El email de credencial puede diferir del email histórico solo mediante política aprobada; el histórico no se sobrescribe.
- Recuperación de contraseña opera únicamente para cuentas Auth elegibles y evita revelar si el email existe.

Supabase documenta que Auth emite JWT, se integra con RLS y mantiene `auth.users` en un schema no expuesto; los datos de aplicación deben vivir en entidades propias protegidas. Véanse [Auth](https://supabase.com/docs/guides/auth), [arquitectura de Auth](https://supabase.com/docs/guides/auth/architecture) y [gestión de datos de usuario](https://supabase.com/docs/guides/auth/managing-user-data).

## I. Users without Auth

El universo exacto que demuestre la fuente autoritativa se representará como entidades de negocio independientemente de elegibilidad Auth. El aproximado inicial de 947 no constituye un conteo auditado. Quienes no tengan correo válido/único:

- existen, conservan `numero_control` y datos históricos;
- pueden ser consultados por procesos autorizados y legacy mediante el puente de negocio;
- no reciben credenciales falsas ni email inventado;
- no generan fila/cuenta Auth;
- pueden ser `usuario_contexto` de una impersonación autorizada;
- solo obtienen Auth después de un proceso futuro de corrección/verificación aprobado, sin alterar el histórico.

## J. Duplicate emails

1. Preservar el email raw de cada fila.
2. Validar y normalizar de forma derivada y reproducible.
3. Agrupar por email normalizado.
4. Hacer candidato Auth solo al primer registro según `original_source_ordinal` de la fuente autoritativa aprobada.
5. Marcar los posteriores como `duplicate`, conservarlos y no crear Auth.
6. Registrar evidencia del ganador y grupo; no reasignar automáticamente si cambia una copia secundaria.

La definición exacta de la fuente y de su orden original es una decisión bloqueante de H-002. No puede usarse el orden de un export reordenado.

## K. Admin impersonation

```text
admin autenticado (actor_real)
  → solicita impersonación en backend
  → backend verifica permiso affiliate.impersonate
  → exige target, motivo, alcance y expiración
  → crea concesión corta ligada a actor + sesión
  → backend/RLS deriva usuario_contexto
  → cada acción registra ambas identidades
```

Reglas:

- Nunca pedir, conocer ni restablecer la contraseña del afiliado.
- El target se selecciona por ID interno; `numero_control` puede servir para búsqueda, no como autorización.
- El frontend no puede mandar libremente un `numero_control` y obtener acceso.
- Concesión revocable, de corta duración, sin delegación y vinculada al `session_id` real.
- Audit log durable: actor real, contexto, motivo, permiso, sesión, inicio/fin, recurso, acción, resultado y metadatos de solicitud.
- Acciones sensibles deben tener denylist o step-up explícito: cambiar credenciales, modificar roles, iniciar otra impersonación, borrar históricos, pagos/desembolsos y cambios financieros.
- El banner UI es informativo; la seguridad permanece en backend/RLS.

La documentación de sesiones de Supabase describe JWT de acceso, refresh token y `session_id`, útiles para correlacionar la concesión con la sesión real: [User sessions](https://supabase.com/docs/guides/auth/sessions).

## L. Preliminary RLS model

Sin SQL:

| Actor | Contexto verificable | Acceso conceptual |
|---|---|---|
| Anónimo | sin principal | Solo recursos expresamente públicos; cero identidad/finanzas |
| Afiliado | `auth.uid()` vinculado a affiliate | Sus filas y dominios propios según autoridad |
| Admin | principal + permisos backend | Solo acciones/filas cubiertas por permiso explícito |
| Admin impersonando | principal real + concesión activa y scoped | Filas del target dentro del scope; auditoría doble |
| Empresa | principal + membresía organizacional | Datos de su empresa y solicitudes asignadas, con minimización de PII |

Principios:

- Denegar por defecto; políticas separadas por operación.
- Derivar propiedad desde el vínculo Auth en backend, no desde payload del cliente.
- No usar metadata editable por el usuario para autorización. La guía oficial advierte que `raw_user_meta_data` es modificable por el usuario; la autorización debe apoyarse en datos/claims no editables y políticas: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
- Roles/claims aceleran decisiones, pero permisos críticos se administran en backend y requieren estrategia de revocación/refresco. Supabase ofrece custom claims mediante Auth Hook para RBAC: [Custom Claims & RBAC](https://supabase.com/docs/guides/api/custom-claims-and-role-based-access-control-rbac).
- Ninguna `service_role` en frontend; ningún bypass genérico para administración.
- Probar aislamiento propio/ajeno, usuarios sin vínculo, deshabilitados, claims obsoletos, grants expirados, impersonación fuera de scope y accesos de empresa.

```text
SUPABASE SECURITY REVIEW
Scope: diseño conceptual Auth/RLS/roles/impersonación
Auth/business identity: separadas; vínculo opcional
RLS/grants: denegación por defecto y contexto derivado en backend
Roles/privilege escalation: permisos técnicos no editables por cliente
Frontend exposure: ningún secreto/service_role propuesto
Cross-user access: prohibido salvo autorización o concesión scoped
Impersonation/audit: actor_real y usuario_contexto preservados
Tests: definidos conceptualmente; no ejecutables en H-001
Verdict: PASS para diseño preliminar; BLOCKED para implementación hasta decisiones, schema y tests
Evidence: secciones G-L y documentación oficial enlazada
```

## M. DATA/mock retirement plan

1. **Inventario congelado:** mantener lista de todos los lectores/escritores actuales.
2. **Contrato único:** aprobar interfaz conceptual `AffiliateRepository`; aún sin implementación.
3. **Adaptador mock explícito:** permitir `DATA.user` solo en preview/test aislado, imposible en build productivo.
4. **Adaptador autoritativo:** conectar después de aprobar fuente, schema y seguridad.
5. **Migración por consumidores:** TopBar/Perfil → Inicio/Credencial → Financiera/Préstamo/Marketplace → Historial/Admin/Empresa.
6. **Retirar snapshots falsos:** preservar snapshots transaccionales reales, eliminar agregación con `DATA.solicitudes` solo en una H autorizada.
7. **Eliminar fallbacks:** fallo de autoridad produce estado controlado; nunca `remote || DATA.user`.
8. **Gate productivo:** auditoría estática + pruebas runtime.

```text
USERS MIGRATED
→ 0 lectores productivos de DATA.user
→ 0 lectores productivos de viewer como identidad/sesión
→ 0 fallbacks a usuario demo o user_local
→ 0 localStorage como autoridad de identidad, Auth, rol o permiso
→ 0 snapshots nuevos sin internal_uuid/numero_control trazable
→ pruebas de borrado: un dato no reaparece desde cache/mock
→ build falla si importa/admite adaptador mock en producción
```

No eliminar mocks en H-001.

## N. localStorage/cache risks

| Clave/sistema | Clasificación | Motivo y riesgo de reaparición |
|---|---|---|
| `suti_user_photo` | `PREFERENCE` + `UNSAFE` | PII sin user key; reaparece en refresh y cruza supuestos usuarios |
| `suti_bank_v1` | `SOURCE OF TRUTH` aparente + `UNSAFE` | Banco/CLABE solo local; persiste tras logout ficticio |
| `suti_admin_viewer_v1` | `SOURCE OF TRUTH` del prototipo + `UNSAFE` | Controla perfil, segmentación y supuesto login |
| `suti_admin_auth_v1` | `SESSION` + `UNSAFE` | Booleano editable; activa admin |
| `suti_admin_roles_v1` | `SOURCE OF TRUTH` + `UNSAFE` | Matriz de autorización editable |
| `suti_admin_acting_v1` | `SESSION` + `UNSAFE` | Selecciona rol; fallback a superadmin |
| `suti_admin_screen_access_v1` | `SOURCE OF TRUTH` + `UNSAFE` | Reglas de acceso solo cliente |
| `suti_admin_catalogs_v1` | `SOURCE OF TRUTH` del prototipo + `UNSAFE` | Define categorías usadas para segmentar |
| `suti_admin_audit_v1` | `CACHE/LOG` + `UNSAFE` | Alterable/borrable; no es auditoría confiable |
| `suti.copy.v1` | `SOURCE OF TRUTH` + `UNSAFE` | Segunda autorización y editor activo |
| `suti_company_auth_v1` | `SESSION` + `UNSAFE` | ID editable selecciona empresa |
| `suti_company_data_v1`, `suti_company_plans_v1` | `SOURCE OF TRUTH` del prototipo + `UNSAFE` | Identidad/entitlements empresariales locales |
| `suti_company_solicitudes_v1` | `SOURCE OF TRUTH` paralela + `UNSAFE` | Personas seed pueden reaparecer tras reset/storage vacío |
| `suti_finanzas_solicitudes_v1` | `SOURCE OF TRUTH` local + `UNSAFE` | Snapshots con identidad compuesta; reset/borrado local |
| `suti_cotizaciones_v1` | `SOURCE OF TRUTH` local + `UNSAFE` | Snapshots filtrados por ID mock |
| CacheStorage `sutiapp-v5` | `CACHE` | Hoy cachea app-shell/GET; futuras respuestas con PII deben excluirse o invalidarse explícitamente (`sw.js:1-38`) |

No se encontró `sessionStorage` ni IndexedDB. Ninguna de estas claves puede seguir como autoridad productiva después de migrar identidad.

## Google legacy

`numero_control` será el puente de negocio hacia los sistemas legacy. H-001 no inspeccionó ni modificó Google Sheets, Apps Script, Ahorro o Préstamos.

```text
LEGACY GOOGLE AUDIT
Systems/domains: identidad como puente futuro hacia Google; Ahorro/Préstamos fuera de alcance
Reads: ninguno sobre sistemas externos
Writes: ninguno
Calculations/triggers: no inspeccionados
Authority: exacta fuente histórica de afiliados UNRESOLVED
Equivalence: NOT APPLICABLE
Recovery: NOT APPLICABLE
Classification: READ ONLY
Decision: PASS para H-001; cualquier integración futura REQUIRES AUDIT
Evidence: no hubo conexión ni cambio externo
```

## Database migration guard

No se produjo schema, SQL, migración, PK/FK ni RLS ejecutable. H-003/ADR-017 aprobaron `numero_control` como TEXT raw y bloquearon su unicidad; la opcionalidad/unicidad de `auth_user_id` y la preservación del orden histórico siguen siendo requisitos para una H futura, no DDL aprobado.

```text
DATABASE MIGRATION AUDIT
Domain: afiliados/Auth
Authority before/after: H-001 no la conocía; H-002 resolvió posteriormente `Usuarios SUTIAPP.xlsx`; arquitectura futura aprobada conceptualmente
Schema checks: solo requisitos conceptuales
RLS/security: modelo preliminar, sin políticas
Historical data: preservar el universo exacto que pruebe H-002, emails y orden autoritativo
Compatibility: lectores/escritores inventariados
Backup/recovery: por diseñar antes de migrar
Tests/reconciliation: definidos para H-002/perfilado
Verdict: decisiones conceptuales APPROVED; ejecución BLOCKED hasta fuente, schema, recuperación y pruebas
Evidence: secciones A-N
```

## O. Decisions resolved

1. **Fuente histórica y orden:** resuelta posteriormente como `Usuarios SUTIAPP.xlsx`, hoja `Usuarios`; `numero_control` permanente y orden físico del Excel autoritativo para esta migración.
2. **Entidad única:** `affiliate` aprobada como entidad conceptual única, sin `profiles` inicial duplicado.
3. **Semántica de email:** aprobada la separación raw/normalizado/Auth, con preservación y procedimiento futuro autorizado para cambiar credencial.
4. **Principales técnicos:** aprobada la separación principal→asignaciones→roles→permisos, independiente de cargo/sindicato/puesto.
5. **Impersonación/sesión admin:** aprobados backend, motivo, auditoría, revocación, TTL máximo inicial de 30 minutos y denylist; MFA/step-up queda habilitable por arquitectura, no obligatorio globalmente.

No requieren nueva decisión: `numero_control` histórico, usuarios sin Auth, preservación de emails inválidos/duplicados, primer registro elegible por orden original, separación `actor_real`/`usuario_contexto` y prohibición de fallbacks; ya son reglas aprobadas o explícitas de H-001.

## P. Proposed H-002

**H-002 — Perfilado read-only de la fuente histórica de afiliados.** Después de aprobar las decisiones 1-3:

- localizar y autorizar la fuente histórica exacta;
- exportar/inspeccionar en modo read-only;
- verificar conteo aproximado de 947;
- perfilar unicidad/nulos/formato de `numero_control`;
- clasificar email válido, vacío, inválido y duplicado preservando orden;
- producir reconciliación, riesgos y propuesta de mapeo;
- no crear Supabase, tablas, SQL ni migraciones todavía.

## H-001 RESULT

```text
Status: PASS
Source-of-truth status: RESOLVED posteriormente por H-002 — Excel maestro del propietario
Auth architecture status: diseño preliminar PASS; implementación BLOCKED
Impersonation compatibility: PASS conceptualmente, sin implementación
Security verdict: actual FAIL; propuesta PASS como diseño, pendiente de pruebas
Legacy impact: NOT APPLICABLE — cero lecturas/escrituras externas
Files changed: documentación de gobierno únicamente
Functional behavior changed: NO
Decisions resolved: 5; H-002 fue reanudada y completada con el Excel autorizado
Recommended H-002: perfilado read-only de la fuente histórica de afiliados
```
