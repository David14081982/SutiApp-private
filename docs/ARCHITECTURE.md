# Arquitectura

## Admin Afiliados — ADR-071

```text
Admin Afiliados UI
  → AdminAffiliatesRepository
  → RPC con permiso + versión + motivo
  → public.affiliates (maestro único)
  → affiliate_admin_events / affiliate_profile_audit_log (auditoría)

Perfil → Document Workbench / Requests Workbench / Financial Workbench
Carga documental → AdminAffiliatesRepository → Storage privado → RPC auditada
Exportar Excel → DataExportRepository → Edge data-exports → XLSX temporal
```

El listado pagina, busca, ordena y filtra en servidor; el navegador no descarga las 947 filas para construir el padrón. El perfil compone proyecciones de documentos, solicitudes y acceso, pero no copia sus autoridades. Los enlaces abren los workbenches productivos existentes con `affiliate_id` como contexto y vuelven al mismo perfil. `documents.write` permite cargar un archivo al expediente seleccionado: Storage acepta sólo rutas UUID existentes, la RPC valida archivo/actor/motivo y registra `affiliate_documents`, `private_assets` y auditoría. Alta, edición y cambio de estado nunca crean, revocan ni eliminan una cuenta Auth.

## Architecture Registry y Navigator

```text
User task → Navigator → Registry lookup/freshness → targeted inspection
          → guardians → implementation/tests → Registry update if architectural
```

El Registry bajo `docs/architecture/` es una proyección técnica particionada del repositorio. El manifiesto conserva hashes de repo/schema y referencia índices de código, datos, grafo y búsqueda. Cada relación automática incluye evidencia; los overrides semánticos están marcados como declarados. Ante stale o contradicción, el código/schema vigente prevalece y se ejecuta discovery dirigido. Esta capa no se carga en la PWA ni llama servicios externos.

## Profile Photo Cutover global

```text
AffiliateAuth / Admin autorizado
        → affiliate.id
AffiliateRepository.getProfilePhoto()
        → affiliate_files(file_key=profile_photo, Photo/DK)
private_assets + private-assets Storage/RLS
        → URL firmada temporal, caché por principal en memoria
Avatar compartido → Header / Perfil / Credencial / Admin
```

`affiliate_files` conserva la relación exacta creada por MASTER ASSET EVACUATION; no se creó tabla, columna ni copia física. La URL firmada es derivada y nunca autoridad. El caché se separa por `auth.uid()`, se limpia en login/logout y no persiste tras refresh. Una relación ausente muestra las iniciales Claude; una relación ambigua o un fallo de Supabase no elige otra fuente.

## Estado observado en H-000

Sutiapp es una PWA/frontend estático. `SutiApp.html` carga React 18.3.1 y ReactDOM desde CDN y ejecuta únicamente `app/bundle.js`; los archivos `.jsx` son fuentes para regenerar ese bundle mediante un proceso externo descrito en `CLAUDE.md`. No existen `package.json`, configuración de bundler, backend, Supabase ni tests automatizados en el repositorio.

La aplicación usa globals en `window` para componentes, stores y datos. El router es interno y mantiene seis tabs (`home`, `financiera`, `convenios`, `historial`, `credencial`, `admin`) y rutas apiladas. Los stores son síncronos y la mayoría persiste en `localStorage`. El service worker usa red primero y caché como respaldo offline del app-shell y respuestas GET.

## Límite actual

No hay una frontera de datos consistente entre pantalla y persistencia. Algunas pantallas leen `window.DATA`, otras stores globales y otras ambas. H-000 no cambia este diseño: lo registra para una evolución controlada.

## Frontera Supabase implementada en H-004

```text
Pantalla → `AffiliateRepository` → cliente Supabase → `public.affiliates`
```

H-004 implementó el cliente y `AffiliateRepository` como scripts aislados cargados antes del bundle, sin migrar pantallas ni alterar `DATA.user`. La configuración pública se genera desde entorno en un archivo ignorado; Secret Key, token y contraseña nunca entran al navegador. Las demás fronteras siguen pendientes según autoridad y H propia.

## Autenticación de afiliados implementada en H-005

```text
Login UI → `AffiliateAuth` → Supabase Auth
                         ↓ sesión/JWT
`AffiliateRepository.getCurrentAffiliate()` → RLS → `auth.uid() = affiliates.auth_user_id`
```

El shell solo se monta en estado `authenticated` después de resolver una fila elegible. Carga, credenciales incorrectas, conexión fallida, principal sin vínculo e inelegibilidad producen estados controlados; nunca activan `DATA.user`. La sesión persistente y su renovación pertenecen al cliente oficial de Supabase, no a una sesión propia de SutiApp. Logout desmonta inmediatamente el shell y revoca la sesión mediante Supabase Auth.

## Proyección de identidad implementada en H-006

```text
AffiliateRepository.getCurrentAffiliate() → affiliate raw autoritativo
                                      ↓ una vez por sesión
                         AffiliateAuth.affiliateView (memoria)
                                      ↓
                      TopBar / Inicio / Perfil / Credencial
```

`affiliate-view-model.js` sólo adapta nombres de campos y presenta ausencias como `—`; no persiste, corrige ni inventa datos. `numero_control` se conserva como texto raw y `historical_email_raw` sólo se muestra como contacto, nunca como selector de sesión. Sin URL autoritativa de foto se usa el avatar placeholder. Fallo de Supabase mantiene el shell desmontado y muestra el estado controlado de H-005. Lectores de identidad mock en `finance-store.jsx`, `screens-financiera.jsx`, `screens-loan.jsx` y `screens-marketplace.jsx` son `PENDING H-LATER`; no alimentan las cuatro áreas migradas.

## Fronteras obligatorias futuras

- Cada repositorio expone una autoridad, sus errores y reglas de invalidación; no mezcla autoridades como fallback.
- Adaptadores de Google quedan aislados y sujetos a `legacy-google-guardian`.
- Adaptadores de Supabase quedan sujetos a migración y revisión de seguridad.
- Cachés son reemplazables e invalidables; nunca escritores maestros.
- El bundle generado debe regenerarse solo cuando una H autorice cambios funcionales en `app/`.

## H-ADMIN-DATA-EXPORT-001 — exportación operativa

```text
Admin Auth → data-exports Edge Function → allowlist de dominio/columnas/filtros
                                      ↓
                           Supabase productivo (lectura)
                                      ↓
                  XLSX/CSV privado en respuesta `no-store`
                                      ↓
                     data_export_audit_log (metadatos)
```

`data_exports.read` concede exportación global; un responsable editorial necesita la acción independiente `export` en su sección. La Edge Function vuelve a validar JWT y permiso en backend, consulta con `service_role` sólo después de autorizar, limita el resultado a 20,000 filas y nunca acepta nombres de tabla o columna del navegador. Auth, secretos, firmas, payloads internos, rutas Storage y binarios quedan fuera. El archivo no se persiste: la respuesta privada expira al terminar la descarga. El backup técnico continúa separado mediante dump/CLI/SQL.
## H-007 — Contenido institucional público

Cuatro dominios independientes usan una frontera única `Repository → Supabase` y un estado en memoria compartido. `DirectoryRepository`, `MinutesRepository`, `InstitutionalDocumentsRepository` e `InstitutionalProgramsRepository` realizan lecturas ordenadas; `institutional-content.js` proyecta esas filas al contrato visual existente. Una falla produce `SOURCE_ERROR` y reintento explícito, nunca fallback.

La migración `20260821000200_create_supabase_now_content.sql` crea cuatro tablas normalizadas con UUID, coordenada histórica única, hash de snapshot, orden, timestamps, constraints, índices y RLS público read-only. La importación proviene del snapshot bounded `data/h007-supabase-now-source.json`; Google no es consultado por el runtime. Los módulos no migrados continúan aislados en sus stores previos.

`Secretaría de Finanzas` se modela como contenido institucional, no como ledger ni producto financiero. Su snapshot omite `T:V`; Ahorro, Préstamos, nómina, amortizaciones, fondos, reportes, queries, conciliaciones, Apps Script y fórmulas permanecen intactos en Google legacy. Catálogos no recibió tabla porque su agrupación mezcla autoridades y requiere una H/decisión posterior.

## H-008/H-009 — Administración visual real

```text
Supabase Auth → admin_assignments → has_admin_permission() / RLS
                                      ↓
AdminScreen → AdminRepository → tablas visuales + app_assets + Storage
                                      ↓
                              admin_audit_log
```

`AdminScreen` solo enruta a los escritores productivos autorizados: branding, banners, popups, empresas, documentos y contexto de identidad. Los módulos prototipo restantes no pueden abrirse como writers. `VisualCrudModule` conserva el lenguaje visual existente, pero todo estado maestro proviene de Supabase. Los lectores públicos solicitan exclusivamente filas `enabled`; el admin puede ver también desactivadas por policy técnica.

El registro de assets usa rutas derivadas de SHA-256, contrato MIME/tamaño por bucket y procedencia administrativa. Un reemplazo cambia relaciones autoritativas; las copias estáticas de favicon/manifest siguen siendo derivados que requieren sync/deploy reproducible.

## MASTER Phase 1 — Activación, recuperación y contexto administrativo

```text
Supabase Auth email confirmado → claim_affiliate_identity()
                                  ↓ coincidencia única/elegible
                         affiliates.auth_user_id

actor Auth → admin_assignments/RLS → impersonation_sessions (motivo + TTL)
                                      ↓
                             afiliado efectivo único
                                      ↓
                       actor_real / usuario_contexto auditados
```

`AffiliateRepository` obtiene el UUID efectivo desde backend y la policy de `affiliates` expone solo esa fila. Sin contexto activo conserva la relación propia H-005; con contexto activo requiere el permiso `affiliates.impersonate`. La UI muestra un banner global hasta el cierre y nunca sustituye la frontera RLS. Recuperación usa el flujo nativo de Supabase Auth y no confirma públicamente si un correo tiene cuenta.

## MASTER Phase 3 — Comercio y Convenios

```text
Claude Marketplace / Convenios / Admin / Empresa
                    ↓ stores de estado en memoria
          MarketplaceRepository + repositorios visuales
                    ↓ sesión Supabase + RLS
categories → products → assets/promotions → companies
                    ↓
favorites / quote_requests / benefit_requests
```

La estructura de navegación y componentes permanece en código. Las tablas representan entidades comerciales, no secciones visuales. `marketplace_company_memberships` concede capacidad tenant y no sustituye Auth ni planes. Las funciones de creación capturan actor real y afiliado efectivo; las respuestas se limitan a la empresa destino o al Admin con permiso. `category_raw`/`subcategory_raw` preservan ambigüedad histórica sin crear una autoridad catalogal falsa.

## MASTER Phase 4 — Membresías y descomposición de Programas

```text
Finanzas / Membresías / Admin
              ↓
MembershipRepository → membership_offerings → app_assets / Storage
```

`membershipStore` conserva solo proyección en memoria y estados loading/error. Las solicitudes con PII/documentos/nómina no cruzan esta frontera. “Programas” se resuelve por dominio: Marketplace/Convenios en Phase 3, institucional en Phase 2, rutas/tarjetas estructurales en código y sistemas financieros en Google legacy hasta Phase 7.

## MASTER Phase 5 — Operación no financiera

```text
marketplace requests/quotes (RLS)
              ↓
operationsStore (memoria, proyección de estado)
              ↓
Mi Historial → Tracking/Timeline Claude
```

La proyección no persiste ni configura etapas; deriva presentación desde el estado autoritativo. Historial financiero no cruza esta frontera y se declara `PENDING LEGACY`.

## MASTER Phase 7 — adaptador financiero Google legacy

```text
apertura/confirmación → FinancialLegacyRepository → Edge Function financial-legacy
  → auth.uid() / affiliate efectivo / numero_control derivado en backend
  → perfil financiero Supabase → Google Sheets read-only → filtro por perfil
  → financial_session_snapshots (derivado, personalizado, TTL 15m, service-only)

interacción monto/fondo/plazo → RPC autenticada resolve_current_loan_snapshot_quote
  → valida actor / afiliado efectivo / impersonación / TTL / perfil / política / contrato
  → resolver certificado SUTI_LOAN_QUOTE_V1 → FinancialSimulationResult (0 Google, 0 Edge)
```

`loanSessionOpen` hace la única lectura inicial Google necesaria y persiste sólo el subconjunto aplicable. `loanSessionValidate` comprueba contexto/TTL sin Google. La interacción llama directamente la RPC autenticada con sólo snapshot/fondo/monto/plazo; ésta no expone la tabla y usa el mismo resolver SQL que Edge emplea al confirmar y en rutas legacy. La ruta Edge `loanSessionQuote` permanece únicamente como superficie de equivalencia/compatibilidad y no es llamada por el frontend. No existe calculadora paralela ni fallback RPC→Edge→Google. `ensureLoanSession()` permite que Home, Finanzas y Loan compartan la misma sesión válida y vuelve a validar el afiliado efectivo, incluido cambio de impersonación.

El browser no puede elegir afiliado, perfil ni `numero_control`, y no tiene grants sobre la tabla temporal. La Edge liga snapshot a actor real, afiliado e impersonación; `financial_profile_version`, fingerprints y expiración se verifican en cada operación. La confirmación relee el batch Supabase activo, recalcula y llama `create_validated_financial_program_request()` como frontera transaccional service-only. `program_requests.financial_submission_snapshot` queda inmutable; el snapshot de sesión se invalida. Ninguna consulta/refresh de afiliado escribe Google.

```text
OPEN/HOME → Google > 0 → snapshot READY
amount/fund/term → Edge → snapshot → mismo motor → Google 0
CONFIRM → perfil actual + Google actual + política actual → mismo motor
        → coincide → RPC atómica → program_requests + request_documents
        → cambió  → 409 CONDITIONS_CHANGED + snapshot invalidado + 0 inserts
```

La superficie informativa de nómina usa una frontera independiente y no altera el contrato financiero:

```text
admin Auth activo → impersonation_sessions (motivo/TTL) → afiliado contexto
Supabase loan_term_policy ─┐
Google Criterios de fondos ├→ financial-legacy Edge → cotización completa → UI
Supabase nómina declarada ─┘                            ↓
                                      program_requests + auditoría actor/contexto
```

La política Supabase sólo define opciones de plazo; no duplica tasa, fondo, máximo financiero ni cálculo Google. Reglas legacy sin ningún plazo válido no se ofrecen. La ruta visual `loan` durante impersonación no reemplaza RPC, Edge, triggers ni RLS.

```text
Affiliate Auth → PayrollDeclarationRepository → RPC Supabase → affiliate_payroll_declarations
Google quote payment → financial-legacy → get_current_declared_payroll_impact() → presentación Claude
```

La primera ruta escribe únicamente importes declarados por el propio afiliado con versión y auditoría. La segunda combina server-side el pago Google ya resuelto con esa declaración y devuelve una proyección informativa; no reimplementa tasas, plazos, elegibilidad ni aprobación.

## ADR-038 — frontera única de solicitudes iniciales

```text
CTA Claude → ProgramRequestRepository → RPC autenticada → program_requests
                                             ↓
                         auth.uid() → afiliado efectivo → numero_control

program_requests (revisión pendiente)
                         ↓ aprobación Admin backend explícita
program_requests (aprobada pendiente de exportar)
                         ↓ writer server-to-server + LockService + UUID
Google `Historial de solicitudes` (append one row)
                         ↓ fin de automatización SutiApp
                 proceso legacy manual actual
```

`program_requests` es la única autoridad posterior al corte para registrar intención, beneficio o cotización inicial. La RPC deriva identidad en backend, exige firma/términos, protege reintentos con `(affiliate_id,idempotency_key)` y no ejecuta cálculos ni escrituras Google. RLS limita lectura al afiliado efectivo, empresa destino o Admin autorizado; los grants por columna excluyen firma, idempotencia y contexto interno del navegador. Historial y Admin son proyecciones de esta misma frontera, sin `DATA`, `localStorage` ni tablas de solicitud alternativas.

Mi Historial usa exclusivamente `list_self_program_request_history()`, una proyección `SECURITY DEFINER` sin parámetro de afiliado. El backend deriva `get_effective_affiliate_id()` para autoservicio o impersonación auditada y devuelve sólo los campos de presentación; firma, términos, snapshots, `numero_control`, actor e idempotencia quedan excluidos. Al pulsar `Seguir mi solicitud`, el store descartable invalida su promesa anterior y vuelve a leer la autoridad, por lo que el folio confirmado aparece sin caché local ni reload manual.

La corrección de frontera 2026-08-22 prohíbe también que Historial, refresh o retry del afiliado ejecuten el export. Solo la aprobación Admin backend puede iniciarlo. `Historial de solicitudes` es el único destino de negocio y solo mediante append. La aprobación congela A:AL+SHA; Supabase audita la transición y Apps Script reserva UUID/hash/fila bajo `LockService`, verifica 38 headers y hace read-back antes de `handed_off`. Proceso 3 sin aval autoritativo falla cerrado. No existe procesamiento automático después del append.

## ADR-076 — decisiones Admin y evidencia documental financiera

```text
Admin Finanzas → get_program_request_admin_events → bitácora autorizada
               → record_program_request_admin_action → COMMENT / REVIEW / REJECT / CANCEL
               → financial-legacy → aprobación + evento atómicos → handoff legacy existente

request_documents       → documentos enviados con la solicitud
affiliate_documents     → expediente vigente separado → private_assets → URL firmada al abrir
```

`program_requests` conserva la solicitud, estado y nota original del afiliado. Las decisiones del personal se agregan a `program_request_admin_events`, con identidad backend, idempotencia y transiciones válidas; no se concatenan en `notes`. La tabla no tiene acceso browser directo y sus RPC exigen `program_requests.read/write`. Una aprobación se audita en la misma transacción del snapshot contractual y una solicitud aprobada no puede cancelarse.

`request_documents` es la única evidencia de qué archivos acompañaron un envío. Admin puede consultar el expediente vigente del mismo afiliado en una sección separada, pero una solicitud antigua sin vínculos queda explícitamente no reconstruible. Las vistas siguen usando Storage privado y firma temporal bajo permiso documental.

## H-REQUEST-WORKFLOW-TIMELINE-CUTOVER-001 — timeline versionado de solicitudes

La configuración operativa vive únicamente en `operational_workflows` y `operational_workflow_stages`. Admin → Finanzas → Etapas y seguimiento lee y escribe esa autoridad con permisos `workflow.read/write`; retirar conserva historia y reordenar usa una RPC atómica. Cada mutación deja auditoría durable con actor real y motivo.

```text
Admin Etapas y seguimiento
        ↓ definición versionada
operational_workflows + operational_workflow_stages
        ↓ trigger de alta: resolución única y snapshot inmutable
program_requests.workflow_id/version/snapshot
        ↓ resolver central + operational_request_tracking
Éxito ── Mi Historial ── detalle Admin
```

`resolve_program_request_workflow_state()` es la única semántica de presentación. Una solicitud creada conserva su snapshot aunque la definición cambie; las ediciones sólo afectan altas futuras. El afiliado obtiene exclusivamente sus solicitudes mediante `get_self_request_workflow_state()`/`list_self_program_request_history()`, mientras Admin usa una proyección protegida. Cero coincidencias, ambigüedad, etapa o estado inválidos y lectura no disponible fallan cerrados, sin arrays locales, `DATA`, mocks, `localStorage` ni fallback.

Los cuatro flujos iniciales —préstamo, membresía, cotización y beneficio— cubren toda alta productiva actual. Sus etapas describen seguimiento operativo y no calculan tasas, elegibilidad, saldos, amortización ni resultado financiero; Google y Apps Script permanecen fuera de esta lectura y escritura.

## H-SUTI-INVERSION-SCREEN-001 — simulador presentacional aislado

```text
Mi Financiera → route `investment` → InvestmentScreen
                                      ↓
                    estado React efímero (monto/plazo)
                                      ↓
          proyección simple aprobada; CTA informativo interno
```

La ruta full-screen reutiliza el stack y `app.back` del shell. El HTML del propietario se convirtió a componentes/estilos internos sin iframe, navegador externo ni segunda app. `InvestmentScreen` no cruza Repository: no consulta ni escribe Google, Supabase, Edge, RPC, Financial Resolver o `program_requests`; tampoco persiste en `localStorage`. Su cálculo local es exclusivamente la proyección presentacional acotada por ADR-070 e INV-115 y no pertenece a Suti Préstamo ni a la inversión operativa legacy.
