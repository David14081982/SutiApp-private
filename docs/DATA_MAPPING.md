# Data Mapping autoritativo

## PROFILE PHOTO CUTOVER

```text
DOMAIN: Foto de perfil del afiliado
Historical source: Usuarios SUTIAPP.xlsx / Usuarios / Photo / DK / 487 filas
Historical hash: F4BA18ABE82B148ED65737DB16074303627F96D37FA6F9F025E0A10649BD9591
Runtime authority: affiliate_files(file_key=profile_photo) + private_assets + private-assets Storage
Join: source coordinate + numero_control TEXT raw -> affiliate.id; nunca nombre/email
Reader: AffiliateRepository.getProfilePhoto()
Projection: AffiliateAuth.affiliateView.photoUrl, solo memoria
Consumers: TopBar, Perfil, Credencial, Admin identity search, impersonación via effective affiliate
Fallback: iniciales Claude solo si no existe foto o falla la carga visual; nunca otra fuente
Counts: 487 relaciones / 487 afiliados con foto / 460 sin foto / 0 ambiguas
Status: SUPABASE_ACTIVE
```

Estado base: **H-DATA-001 — AUDITED / READ ONLY**; estado runtime incorporado hasta **ADR-038 / 2026-08-22**. Este documento registra de dónde obtiene hoy sus datos cada pantalla y cuál es su relación demostrable con la fuente histórica. No autoriza nuevas implementaciones, schema, migraciones ni escrituras en Google.

## Reglas de lectura

- `SutiApp Final` es la referencia histórica autorizada para dominios no afiliados; no es autoridad del padrón `affiliate`.
- Afiliados usa `public.affiliates` como autoridad productiva desde H-004; `Usuarios SUTIAPP.xlsx` conserva la procedencia histórica reconciliada. Cualquier referencia Google a una persona usa `numero_control` como puente, no redefine identidad.
- `MAPPED`, `DERIVED`, `CALCULATED`, `MULTI_SOURCE` y `UNRESOLVED` describen evidencia, no autorización de migración.
- Una hoja no equivale a una tabla y una fórmula/query no equivale a un maestro.
- `SUPABASE_NOW`, `SUPABASE_LATER`, `GOOGLE_LEGACY`, `HYBRID`, `DERIVED_VIEW` y `UNRESOLVED` son recomendaciones conceptuales; solo `SUPABASE_ACTIVE` representa un cutover ejecutado y reconciliado.
- `SUPABASE_ACTIVE` indica un dominio ya implementado y reconciliado; no implica que todas sus pantallas consumidoras estén migradas.
- Una pantalla futura tendrá una sola autoridad productiva. No se permite fallback silencioso `Supabase → DATA/localStorage/Google`.

## Matriz maestra

| # | Domain | Frontend | Historical sheet(s) | Relationship | Legacy | Future source | Complexity | Confidence |
|---:|---|---|---|---|---|---|---|---|
| 1 | Afiliados | Login/Auth H-005; TopBar, Inicio, Perfil y Credencial migrados en H-006; consumidores financieros/marketplace pendientes | Fuera de `SutiApp Final`; Excel maestro `Usuarios SUTIAPP.xlsx` | MIGRATED 947/947 por H-004; sesión/vínculo H-005; proyección UI H-006 | Puente Google por `numero_control` | SUPABASE_ACTIVE | HIGH | HIGH |
| 2 | Perfil y credencial | `AffiliateAuth.affiliateView` desde `AffiliateRepository`; foto privada por `getProfilePhoto()` con iniciales si no existe; banco local retirado | Excel maestro `Photo/DK` para foto; referencias personales dispersas para otros datos | SUPABASE_ACTIVE para identidad y foto; banco no implementado | PII | SUPABASE_ACTIVE | MEDIUM | HIGH |
| 3 | Directorio / Comité | Inicio · Comité | `Directorio` | MIGRATED 30/30 por H-007 | No | SUPABASE_ACTIVE | LOW | HIGH |
| 4 | Minutas | Tu sindicato · Minuta | `Minutas de acuerdos` | MIGRATED 5/5 significativas por H-007 | No | SUPABASE_ACTIVE | LOW | HIGH |
| 5 | Descargas y normas | Tu sindicato · Formatos/Normas; Mis documentos no equivale | `Descargas2`, `Descarga de formatos`, `Normas y Reglamentos` | MIGRATED 8/8 significativas por H-007 | No | SUPABASE_ACTIVE | LOW | HIGH |
| 6 | Información educativa / Tutoriales | Admin preservado; pantalla pública futura pendiente | `Información educativa`, `Tutoriales` | MIGRATED 32/32, 0 publicadas | Contenido de Ahorro sin operaciones | SUPABASE_ACTIVE | LOW | HIGH |
| 7 | Secretaría de Finanzas informativa | Tu sindicato · Finanzas | `Secretaría de finanzas` A:S y W; T:V excluidas | MIGRATED 17/17 por H-007, solo contenido | Frontera legacy financiera | SUPABASE_ACTIVE | LOW | HIGH |
| 8 | Noticias / artículos | Inicio, artículo, Admin Noticias | Sin hoja inequívoca | Supabase `news_articles/news_settings` + Storage; ownership UUID por acción exacta | No | SUPABASE_ACTIVE / NEWS_OWNERSHIP_ENFORCED | MEDIUM | HIGH |
| 9 | Anuncio principal / promociones / pop-ups | Banner Home migrado; popups productivos en repository | `Anuncio principal`, `Promociones` | Home SUPABASE_ACTIVE 10/10; 3 popups preservados inactivos | No | SUPABASE_ACTIVE parcial | MEDIUM | HIGH para Home |
| 10 | Directorio público de empresas/convenios | Convenios Claude Design: publicidad, búsqueda/filtro, chips, destacados pendiente, favoritos, listado y detalle | `Convenios2!A1:I46`; banners visuales según H-007.2 | Supabase `companies` + `company_assets` y `banners`; 33 filas y 35 assets, sin inventar destacados/descuentos | No | SUPABASE_ACTIVE | HIGH | HIGH |
| 11 | Empresas, planes y CRUD administrativo | Admin/empresa | `Empresas Suticompras`, stores locales | Separado del directorio; fila fuente de prueba | No | NOT_MIGRATED | HIGH | HIGH para límite |
| 12 | Marketplace / SutiCompras | Catálogos, producto, Admin/Empresa | `Categorías SutiCompras`, `Subcategorías SutiCompras`, `Productos SutiCompras`, `Banner SutiCompras`, `Empresas Suticompras`, `Historial Presupuestos` | MULTI_SOURCE | Transacción separada | HYBRID | HIGH | HIGH |
| 13 | Membresías | Mi Financiera, Admin Membresías | `Membresias`, `Solicitudes membresía` | MULTI_SOURCE: catálogo + transacción | Solicitudes con PII | HYBRID | HIGH | HIGH |
| 14 | Tours | Producto/catálogo/cotización | `7 Suti Tours`, `7 Solicitudes Tours` | MULTI_SOURCE | Solicitud/financiamiento | HYBRID | HIGH | HIGH |
| 15 | Suti Auto | Producto/catálogo/cotización | `1 Vehículos SutiAuto`, `1 Solicitudes Suti Auto`, `Amortización SutiAuto` | MULTI_SOURCE / CALCULATED | Fórmulas y financiamiento | HYBRID | CRITICAL LEGACY | HIGH |
| 16 | Renta Car | Producto/catálogo/cotización | `2 Vehículos en renta`, `2 Solicitudes Renta Car` | MULTI_SOURCE | Transacción | HYBRID | HIGH | HIGH |
| 17 | Portafolio de Inversión | Producto/simulador genérico | `3 Portafolio de Inversión`, `3 Criterios Portafolio de Inversión`, `3 Solicitudes de Inversión` | MULTI_SOURCE / CALCULATED | Financiero | HYBRID | CRITICAL LEGACY | HIGH |
| 18 | Suti Terrenos | Pantalla dedicada + producto genérico | `6 Suti Terrenos`, `6 Solicitudes Suti Terrenos`, `Lotes` | UI dedicada no corresponde a columnas históricas | Financiamiento | UNRESOLVED | CRITICAL LEGACY | LOW |
| 19 | Suti Casa | Producto/catálogo/cotización | `Suti Casa`, `Solicitudes Suti Casa`, `Solicitudes de comprar o vender casas` | MULTI_SOURCE | Transacción | HYBRID | HIGH | HIGH |
| 20 | Paneles Solares | Producto/catálogo/simulador | `Paneles Solares`, `Solicitudes Paneles Solares` | MULTI_SOURCE / CALCULATED | Financiamiento | HYBRID | CRITICAL LEGACY | HIGH |
| 21 | Donativos | Sin módulo frontend inequívoco | `10 Donativos`, `10 Solicitudes Donativos ` | NO_FRONTEND_MAPPING | No demostrado | SUPABASE_LATER | MEDIUM | MEDIUM |
| 22 | Suti Farma | Producto genérico | `8 Suti Farma` | MAPPED parcial | No demostrado | SUPABASE_LATER | MEDIUM | HIGH |
| 23 | Suti Market / Productos Balam | Producto genérico `market` | `Categorías SutiMarket`, `Productos Balam` | Nombre/contrato no reconciliado | No demostrado | UNRESOLVED | MEDIUM | LOW |
| 24 | Rifas | Producto genérico `rifas` | `Rifa`, `Compradores de boletos rifa`, `Choice Rifa` | MULTI_SOURCE | Compra y comprobantes | HYBRID | HIGH | HIGH |
| 25 | Ahorro | Resumen Inicio/Financiera e historial | `Ingreso ahorro`, `Solicitud de Ahorro`, `Ahorro`, `Solicitud Cambio ahorro`, `Solicitud de retiro`, `Saldo manual`, `Reporte Ahorro`, `Reporte - RH`, `Conciliacion` | MULTI_SOURCE / CALCULATED | FORMULA_DEPENDENT; legacy protegido | GOOGLE_LEGACY | CRITICAL LEGACY | HIGH |
| 26 | Préstamos | Mi Financiera, solicitud, historial, Admin Finanzas | `Historial de solicitudes`, `HISTORIAL P V2`, `HISTORIAL DE PRESTAMOS`, amortizaciones, fondos, reportes, queries y conciliaciones | MULTI_SOURCE / CALCULATED | Legacy financiero protegido | GOOGLE_LEGACY | CRITICAL LEGACY | HIGH |
| 27 | Adelanto de nómina | Ítem financiero genérico | `Adelanto de Nómina` | MAPPED parcial | Regla financiera | GOOGLE_LEGACY | CRITICAL LEGACY | HIGH |
| 28 | Fondos y criterios financieros | `fundsStore`, `finCatStore`, simuladores/Admin | `Criterios Simuladores`, `Criterios de fondos`, `Fondos Configuracion`, `Fondos para prestamos`, `Categorías` | MULTI_SOURCE / CALCULATED | Fórmulas/reglas | GOOGLE_LEGACY | CRITICAL LEGACY | HIGH |
| 29 | Solicitudes, historial y seguimiento | Historial, tracking, Admin/Empresa | `Historial de solicitudes` y hojas `Solicitudes …` por programa | MULTI_SOURCE | Estados y PII; finanzas cuando aplica | HYBRID | HIGH | HIGH |
| 30 | Cotizaciones / presupuestos | Producto, Admin Finanzas, Panel Empresa | `Historial Presupuestos`; otras hojas de solicitudes contienen montos | MULTI_SOURCE | Puede preceder financiamiento | SUPABASE_LATER | HIGH | MEDIUM |
| 31 | Notificaciones | Campana y Panel Empresa | Sin maestro; derivadas de stores y `DATA.notifs` | DERIVED / DESIGN_ONLY | No | DERIVED_VIEW | MEDIUM | HIGH |
| 32 | Documentos del afiliado | Mis Documentos y solicitud de préstamo | Columnas de documentos dispersas en solicitudes | UNRESOLVED; no hay maestro documental | PII/documentos | UNRESOLVED | HIGH | LOW |
| 33 | Flujos y etapas | Tracking y Admin Flujos | Estados/fechas por transacción; no existe catálogo histórico de etapas | DESIGN_ONLY / DERIVED | Puede tocar finanzas | SUPABASE_LATER | HIGH | MEDIUM |
| 34 | Catálogos reconciliados | Admin Catálogos/filtros; candidatos Marketplace/App/Programa | 19 hojas/rangos H-007.1 | AUDITED: 27 subdominios en 8 clases; ninguno supera aún gate de writer/autoridad | Sí: inversión, pago/cobro, rifa y plazos | UNRESOLVED por subdominio; FINANCIAL_LEGACY donde aplica | HIGH | HIGH |
| 35 | Admin, roles, branding y copy | Supabase Auth/RLS; roles técnicos, segmentación y writers visuales Supabase; estructura Claude en código | `admin_roles`, `admin_role_permissions`, `admin_assignments`, tablas de cutover, `app_assets`, Storage y auditoría | H005_TEST único principal inicial; RPC/RLS; normales denegados | Solo frontera de presentación/workflow con Phase 7 | ADR-041 ACTIVE | HIGH | HIGH |
| 36 | Reportes, queries y conciliaciones | Stats/Admin parcialmente; mayormente sin UI | Hojas `Reporte…`, `Query…`, `Conciliación…`, `INFORME…` | DERIVED / CALCULATED / NO_FRONTEND_MAPPING | Financiero | DERIVED_VIEW | CRITICAL LEGACY | HIGH |
| 37 | Votación | Sin pantalla correspondiente | `Votacion` | NO_FRONTEND_MAPPING / CALCULATED | Fórmulas | SUPABASE_LATER | MEDIUM | HIGH |

### Corte transversal vigente de solicitudes — ADR-038

Las relaciones históricas de la matriz anterior siguen describiendo catálogos, cálculos y procesamiento posterior; ya no describen la autoridad del alta inicial. Desde ADR-038, toda intención inicial habilitada de programa o producto se crea exclusivamente en `public.program_requests`. Supabase deriva `affiliate_id` y `numero_control` desde Auth/RLS, y la UI lee la misma frontera para Historial y Admin. Las tablas de solicitudes anteriores quedan preservadas para el flujo previo al corte y no reciben nuevas altas.

Cuando el programa requiere tasa, saldo, préstamo, amortización, descuento o aprobación financiera, la fila inicial se registra como `requires_financial_processing`; Google legacy conserva únicamente el procesamiento financiero posterior. No existe doble escritura ni handoff implícito.

## Contrato compacto de los 37 dominios

La tabla siguiente completa, para cada dominio de la matriz, los campos normativos que no deben inferirse de la recomendación. Las columnas históricas exactas están en el informe H-DATA-001 enlazado por nombre de hoja.

| # | DOMAIN | Current prototype source | Historical source | Reads | Writes | Transforms | Legacy dependency | Current authority | Future proposed authority | Recommendation | Confidence / open questions |
|---:|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Afiliados | H-006 usa proyección Supabase en TopBar/Inicio/Perfil/Credencial; otros lectores mock pendientes | Excel maestro; Google solo referencias | identidad por repositorio/RLS | importador administrativo H-004 | presentación neutral, control raw | puente Google | `public.affiliates` | `public.affiliates` | SUPABASE_ACTIVE | HIGH; 947/947; `finance-store`, Financiera, Loan y Marketplace `PENDING H-LATER` |
| 2 | Perfil/credencial | proyección in-memory; foto privada firmada; sin banco local | Excel maestro `Photo/DK`; columnas personales dispersas | ficha, credencial y avatar | ninguno desde UI | nombres UI, iniciales para ausencia y URL firmada temporal | PII | `public.affiliates` para identidad; `affiliate_files/private_assets/Storage` para foto; banco no resuelto | mismas autoridades actuales; repositorio bancario separado si se autoriza | SUPABASE_ACTIVE | HIGH para identidad/foto; banco pendiente |
| 3 | Directorio/Comité | `DirectoryRepository` | `Directorio` | lista | importador H-007 | avatar/nombre/cargo | none | Supabase único; Google procedencia | `public.directory_members` | SUPABASE_ACTIVE | 30/30; mock retirado del runtime |
| 4 | Minutas | `MinutesRepository` | `Minutas de acuerdos` | lista/documento | importador H-007 | URL/imagen/fecha | none | Supabase único; Google procedencia | `public.minutes` | SUPABASE_ACTIVE | 5/5; 1 fila vacía clasificada |
| 5 | Descargas/normas | `InstitutionalDocumentsRepository` | tres hojas documentales | lista/archivo | importador H-007 | URL/PDF/imagen | none | Supabase único; Google procedencia | `public.institutional_documents` | SUPABASE_ACTIVE | 8/8; 11 filas vacías clasificadas |
| 6 | Educación/tutoriales | `EducationalRepository` + Admin CRUD | hojas homónimas | Admin; lector público futuro | importador + H005_TEST | Storage + enlaces HTTPS | 4 tutoriales informativos de Ahorro | Supabase; Google procedencia | `educational_resources` | SUPABASE_ACTIVE | 32/32 despublicados |
| 7 | Finanzas informativa | `InstitutionalProgramsRepository` | `Secretaría de finanzas` A:S/W | contenido | importador H-007 | imágenes/contacto | none | Supabase único; T:V siguen Google legacy | `public.institutional_programs` | SUPABASE_ACTIVE | 17/17; sin campos financieros |
| 8 | Noticias | `NewsRepository` / `EditorialContent` | no evidenciada | Inicio/artículo/Admin | Principal técnico o responsable UUID por acción exacta, RLS/trigger | Storage aislado `news/<uid>/`, fechas y ventana | none | Supabase único | `news_articles/news_settings/app_assets` | SECTION_OWNERSHIP_ENFORCED | sin mock fallback; las 11 fronteras administrables están `ENFORCED` por ADR-047 |
| 9 | Anuncios/promos/pop-ups | `BannerRepository`/`PopupRepository` en runtime migrado | rangos bounded H-007.2 | Home/banner; popup global futuro | importador admin; sin escritura cliente | URLs por AssetRepository | none | Supabase para Home; popup sin publicación | `banners`/`popups` + assets | SUPABASE_ACTIVE parcial | 10 banners activos; 3 popups deshabilitados |
| 10 | Directorio público de empresas/convenios | `CompaniesRepository` + proyección `VisualContent` | `Convenios2` | lista, búsqueda y detalle | importador H-007.3 | 35 relaciones Storage | none | Supabase | `companies` + `company_assets` | SUPABASE_ACTIVE | 33/33; sin productos/catálogos |
| 11 | Empresas/planes/CRUD | `CompaniesRepository` + `CompanyStore` Supabase para Marketplace y Portal | `Convenios2`; `Empresas Suticompras` no promovida | Admin/empresa/Marketplace | Admin + membresía tenant por RLS | perfil, acceso, planes y suscripción pendiente explícita | none | Supabase por subdominio | `companies` + `marketplace_company_memberships` + `company_portal_plans` + `company_portal_subscriptions` | SUPABASE_ACTIVE | 33 empresas; 0 membresías, 0 planes y 0 suscripciones inventadas |
| 12 | Marketplace | `MarketplaceRepository` + stores en memoria | conjunto SutiCompras acotado | catálogo/detalle/Admin/empresa | Admin + empresa tenant por RLS | assets/galería/precio/descuento/stock/raw | solicitudes no financieras separadas | Supabase único | tablas `marketplace_*` | SUPABASE_ACTIVE | 3 categorías; 0 productos inventados; snapshot trazable |
| 13 | Membresías | `MembershipRepository` + store en memoria | `Membresias`; solicitudes separadas | catálogo público/Admin | H005_TEST por RLS | monto/pagos/logo Storage/activo | solicitudes con PII y nómina permanecen legacy | Supabase catálogo; Google solicitudes | `membership_offerings` | SUPABASE_ACTIVE catálogo | 6/6; solicitudes NO MIGRATED |
| 14 | Tours | catalog/quote/finance stores | catálogo + solicitudes Tours | catálogo/simulación | solicitudes locales | galería/precios/fechas | financiamiento | Google histórica; UI local | catálogo + adapter requests | HYBRID | HIGH; reglas financieras |
| 15 | Suti Auto | catalog/quote/finance stores | vehículos/solicitudes/amortización | catálogo/simulación | solicitudes locales | fórmulas/financiamiento | formula dependent | Google legacy parcial | catálogo + adapter legacy | HYBRID | HIGH; equivalencia |
| 16 | Renta Car | catalog/quote stores | vehículos + solicitudes | catálogo/cotización | solicitudes locales | fechas/total | transaccional | Google histórica | catálogo + requests | HYBRID | HIGH; writer |
| 17 | Portafolio | simulador genérico | maestro/criterios/solicitudes | simulación | solicitudes locales | tasa/rendimiento | financiero | Google legacy candidata | adapter legacy + catálogo | HYBRID | HIGH; equivalencia |
| 18 | Terrenos | constants + catalogStore | catálogo/solicitudes/Lotes | mapa/catálogo | CTA local | geometría/precios | financiero | SOURCE OF TRUTH CONFLICT | UNKNOWN | UNRESOLVED | LOW; UI no corresponde |
| 19 | Casa | catalog/quote stores | catálogo + dos solicitudes | catálogo/cotización | solicitudes locales | inmueble/galería | transaccional | Google histórica | catálogo + requests | HYBRID | HIGH; unir flujos |
| 20 | Solar | catalog/finance stores | catálogo + solicitudes | catálogo/simulación | solicitudes locales | tasa/plazo/enganche | financiero | Google legacy candidata | catálogo + adapter | HYBRID | HIGH; equivalencia |
| 21 | Donativos | sin módulo inequívoco | catálogo + solicitudes | ninguno directo | Google UNKNOWN | media/monto | UNKNOWN | Google histórica | módulo futuro | SUPABASE_LATER | MEDIUM; owner/UI |
| 22 | Farma | catalogStore seed | `8 Suti Farma` | catálogo genérico | Admin local | cantidad/gramos/link | UNKNOWN | conflicto semilla/Google | catálogo | SUPABASE_LATER | HIGH; stock/writer |
| 23 | Suti Market/Balam | catalogStore seed | categorías Market/productos Balam | catálogo genérico | Admin local | categoría/precio/link | UNKNOWN | UNRESOLVED | UNKNOWN | UNRESOLVED | LOW; identidad Balam |
| 24 | Rifas | catalogStore seed | rifa/compradores/choice | catálogo genérico | compra no conectada | disponibilidad/pago | transaccional | Google histórica | catálogo + compra | HYBRID | HIGH; control de concurrencia |
| 25 | Ahorro | `DATA.user.ahorro`, mocks | conjunto Ahorro | saldo/historial mock | legacy externo | saldos/rendimientos | FORMULA_DEPENDENT | Google legacy | UNRESOLVED | GOOGLE_LEGACY | HIGH; scripts/equivalencia |
| 26 | Préstamos | `FinancialLegacyRepository` + Edge + estado in-memory | conjunto préstamos | apertura personalizada, simulación snapshot, historial/Admin | Edge service-only; confirmación atómica backend; legacy posterior | filtro de perfil + motor financiero existente; timeline/queries separados | Google authority + snapshot derivado TTL 15m | Google reglas + Supabase perfil/política; snapshot no autoritativo | mismas autoridades vigentes | GOOGLE_LEGACY + ADR-043 SESSION SNAPSHOT | HIGH; source version global Google mitigada por TTL/revalidación |
| 27 | Adelanto nómina | finCat seed | `Adelanto de Nómina` | ítem financiero | solicitud local genérica | fechas/monto máx. | financiero | Google legacy candidata | UNRESOLVED | GOOGLE_LEGACY | HIGH; reglas |
| 28 | Fondos/criterios | fundsStore/finCatStore | criterios/config/fondos | resolver perfil | Admin local; legacy externo | tasas/límites/plazos | FORMULA_DEPENDENT | Google legacy | UNRESOLVED | GOOGLE_LEGACY | HIGH; equivalencia |
| 29 | Solicitudes/seguimiento | `operationsStore` para comercial; financiero aislado | tablas Marketplace Supabase; Google por programa financiero | Mi Historial/Tracking | RPC/RLS Phase 3 | timeline derivado de estado backend | financiero permanece legacy | Supabase para no financiero | `marketplace_quote_requests` + `marketplace_benefit_requests` | SUPABASE_ACTIVE parcial por dominio | sin DATA/localStorage; financiero PENDING LEGACY |
| 30 | Cotizaciones Marketplace | `MarketplaceRepository` + `quoteStore` en memoria | `Historial Presupuestos` no importado por semántica/PII insuficiente | afiliado/empresa/Admin | RPC autenticada; empresa destino/Admin responde | actor/contexto, vigencia y respuesta | explícitamente no financiera | Supabase único | `marketplace_quote_requests` | SUPABASE_ACTIVE | filas históricas ambiguas no promovidas |
| 31 | Notificaciones | DATA + derivación stores | ninguna maestra | afiliado/empresa | estados locales | query derivada | none | derivada, no autoridad propia | view/query | DERIVED_VIEW | HIGH; eventos origen |
| 32 | Documentos de afiliado | `DocumentosScreen` → `AffiliateRepository.getDocuments()` | `Usuarios SUTIAPP.xlsx` + inventario histórico reconciliado | `affiliate_files.affiliate_id` UUID + asset registry | RLS owner/Admin; URLs firmadas privadas 300 s | lista/preview/empty/error/retry read-only | PII; sin cálculo financiero | Supabase `affiliate_files` + `private_assets`/`app_assets` + Storage | mismo | SUPABASE_ACTIVE / PHASE 2 CLOSED / PHASE 3 E2E PASS | HIGH; 12,901 correctas, cero autoridad local/fallback |
| 33 | Flujos/etapas | flowStore seed | estados/fechas, sin catálogo | tracking/Admin | CRUD local | timeline/SLA | puede tocar finanzas | prototipo local | workflow config | SUPABASE_LATER | MEDIUM; proceso real |
| 34 | Catálogos separados H-007.1 | `adminStore`, `catalogStore`, `companyStore`, `finCatStore`, `DATA` según subdominio | 19 hojas Google bounded | audiencias/config/Marketplace/programas | CRUD local; Google writer UNKNOWN | ninguna normalización; `Choice`/`Íconos` descompuestos | cuatro grupos FINANCIAL_LEGACY | conflicto o unresolved por subdominio | ninguna tabla creada | AUDITED / NOT MIGRATED | 27 subdominios; matriz en `H007_1_CATALOG_RECONCILIATION.md` |
| 35 | Admin/roles/branding/copy | `AdminRepository` + `AdminCutoverRepository` + módulos Claude | Auth, roles/asignaciones, segmentación, workflows, contenido Sindicato, Convenios y tablas/Storage | Admin y lectores filtrados | H005_TEST por RLS/RPC; importadores autorizados | Storage + sync PWA | security-sensitive | Supabase por dominio; estructura versionada en código | tablas específicas ADR-041 | SUPABASE_ACTIVE | roles locales retirados como autoridad; copy explícito migrado; sin CMS genérico |
| 36 | Reportes/queries/conciliaciones | stats parciales | hojas derivadas | Admin/legacy | fórmulas/procesos externos | aggregation/reconciliation | CRITICAL LEGACY | derivado de Google | views/functions solo con equivalencia | DERIVED_VIEW | HIGH; lineage |
| 37 | Votación | sin UI | `Votacion` | ninguno | Google UNKNOWN | conteos formula | formula dependent | Google histórica | módulo futuro | SUPABASE_LATER | HIGH estructura; reglas UNKNOWN |

## H-DATA-CUTOVER-001 — reconciliación vigente 2026-08-22

Los renglones 14–24 anteriores se conservan como evidencia de H-DATA-001. El estado vigente para el catálogo maestro autorizado es `ProgramCatalogRepository → program_catalog_items/program_catalog_item_assets → Storage`: 134/134 filas y 268/268 assets. Solicitudes y campos financieros continúan en sus adaptadores/hojas legacy. Suti Market/Balam, Rifas, Cirugías y la equivalencia de la pantalla dedicada Terrenos permanecen `UNRESOLVED/LEGACY/UI_NOT_CONNECTED`; ver `DATA_COVERAGE_UI_CUTOVER_REPORT.md`.

## Contratos autoritativos por dominio

### Minutas

```text
DOMAIN: Minutas
Frontend: Home → módulo institucional `minuta` → ModuloScreen
Current productive source: `MinutesRepository` → `public.minutes`
Historical source: SutiApp Final
Historical sheets: Minutas de acuerdos
Historical columns: Título, Descripción, Url, Imagen, Fecha
Reads: lista y detalle/documento
Writes: importador administrativo H-007; cliente sin escritura
Transforms: Url→documentUrl; Imagen→imageUrl; Fecha→date
Legacy dependency: NO_LEGACY_LOGIC
Current authority: Supabase `public.minutes`; Google conserva procedencia histórica
Future proposed authority: Supabase `public.minutes`
Migration recommendation: SUPABASE_ACTIVE
Confidence: HIGH
Open questions: CRUD administrativo y política de archivos requieren H futura
```

### Convenios

```text
DOMAIN: Convenios
Frontend: ConveniosScreen y ConvenioDetail; Admin/Empresa quedan fuera de este cutover
Current runtime source: CompaniesRepository → Supabase `companies` + `company_assets`
Historical source: SutiApp Final
Historical sheet: Convenios2!A1:I46; Convenios Suti vacío y Empresas Suticompras de prueba quedan descartados como autoridades
Historical columns: Título, Categoría, Nombre, WEB, Imagen, Descripción, Descuento, Teléfono
Reads: búsqueda, lista y detalle público
Writes: importador administrativo H-007.3; sin escritura browser
Transforms: celdas raw preservadas; E→cover, D adicional→gallery; no parseo semántico
Legacy dependency: NO_LEGACY_LOGIC
Current authority: Supabase `public.companies` + `public.company_assets`
Future proposed authority: mismo repositorio; productos/Marketplace separados
Migration recommendation: SUPABASE_ACTIVE
Confidence: HIGH
Open questions: CRUD administrativo, catálogo, descuentos estructurados y publicación requieren H futura explícita
```

### Marketplace / SutiCompras

```text
DOMAIN: Marketplace
Frontend: CatalogGrid, CatalogItemScreen, ProductScreen, Admin Marketplace, Panel Empresa
Current runtime source: MarketplaceRepository → Supabase; stores solo estado en memoria
Historical source: SutiApp Final
Historical sheets: Categorías SutiCompras, Subcategorías SutiCompras, Productos SutiCompras, Banner SutiCompras, Empresas Suticompras, Historial Presupuestos
Historical columns: ID, Empresa, Email Empresa, Nombre Producto, Categoría, SubCategoría, Descripción, Precio, Descuento (%), Stock Disponible, Rating, Condición, Envío Gratis, URL Imagen, Tallas Disponibles, Colores, Whatsapp cliente
Reads: catálogo, detalle, galería, precio, empresa
Writes: Admin por permisos; empresa por membresía tenant; afiliado crea favorito/cotización/solicitud
Transforms: assets por Storage; descuento/stock tipados; categoría no reconciliada conserva `category_raw`/`subcategory_raw`
Legacy dependency: NO_LEGACY_LOGIC; Google es procedencia read-only acotada
Current authority: Supabase `marketplace_*` + `companies` + `app_assets`/Storage
Future proposed authority: misma
Migration recommendation: SUPABASE_ACTIVE
Confidence: HIGH
Reconciliation: 3 categorías históricas importadas; subcategorías/productos vacíos; filas empresariales/presupuestos ambiguas no importadas; `Productos Balam` permanece fuera
```

### Ahorro

```text
DOMAIN: Ahorro
Frontend: DATA.user.ahorro, Financiera, Historial
Current prototype source: mock/localStorage; no conexión productiva
Historical source: SutiApp Final / conjunto Ahorro
Historical sheets: Ingreso ahorro, Solicitud de Ahorro, Ahorro, Solicitud Cambio ahorro, Solicitud de retiro, Saldo manual, Reporte Ahorro, Reporte - RH, Conciliacion
Historical columns: Folio, Proceso, Estado, montos, retiros, saldo, plazo, fechas y columnas quincenales
Reads: saldo y estado; hoy solo mock
Writes: solicitudes/cambios/retiros en legacy; frontend actual no conectado
Transforms: saldos y rendimientos calculados; `Ahorro` contiene 32,970 fórmulas escritas
Legacy dependency: FORMULA_DEPENDENT; Apps Script/triggers no inventariados, por tanto UNKNOWN
Current authority: Google legacy
Future proposed authority: UNRESOLVED
Migration recommendation: GOOGLE_LEGACY
Confidence: HIGH
Open questions: scripts, triggers, propietarios, conciliación y equivalencia financiera
```

### Préstamos y solicitudes financieras

ADR-051 y ADR-052 añaden relaciones sin mover la autoridad financiera: `loan_term_policy` aporta únicamente las sugerencias 6/12/18/24 y el plazo personalizado desde 1 pago; la Edge intersecta esa política con `Criterios de fondos`. ADR-043 autoriza la única excepción de copia: `financial_session_snapshots`, subconjunto derivado que se filtra por perfil antes de persistir, se liga a afiliado/actor/impersonación, caduca en 15 minutos y sólo puede leer/escribir Edge. No existe cálculo financiero frontend ni catálogo global Supabase de tasas Google. `program_requests` registra el alta confirmada y conserva su propio snapshot contractual inmutable.

```text
DOMAIN: Préstamos
Frontend: LoanScreen, Historial/Tracking, Admin Finanzas, Panel Empresa
Current runtime source: FinancialLegacyRepository -> Edge financial-legacy -> personalized financial_session_snapshots; stores sólo mantienen estado descartable en memoria
Historical source: SutiApp Final / conjunto préstamos
Historical sheets: Historial de solicitudes, HISTORIAL P V2, HISTORIAL DE PRESTAMOS, AMORTIZACIONES, Amortización V2, Reportee Prestamos, Query fondos, Query Reporte RH, conciliaciones y fondos
Historical columns: ID, Número de control, Nombre, Proceso, Fondo, Tasa, Plazo, Monto a solicitar, Total a Pagar, Fecha solicitud, Estado, Observaciones, documentos, firma, intereses y TGA
Reads: una resolución Google inicial personalizada; simulaciones posteriores por Edge/snapshot; historial, seguimiento y panel desde sus autoridades declaradas
Writes: snapshot temporal exclusivamente service-role; confirmación atómica exclusivamente backend; el navegador no escribe snapshots ni solicitudes financieras por pasos
Transforms: filtro de elegibilidad y cálculo mediante resolveQuote()/quoteForTerm() existentes; timeline/queries/conciliaciones permanecen separados
Legacy dependency: Google Criterios de fondos continúa como autoridad; Apps Script y procesamiento posterior permanecen legacy protegido
Current authority: Google para reglas financieras; Supabase affiliates para perfil; loan_term_policy para selección; financial_session_snapshots sólo derivado temporal no autoritativo
Future proposed authority: mismas autoridades mientras no exista otro cutover expresamente autorizado
Migration recommendation: GOOGLE_LEGACY + ADR-043 TEMPORARY DERIVED SESSION SNAPSHOT
Confidence: HIGH
Open questions: source_version global Google no disponible; se mitiga con TTL 15m y revalidación Google al confirmar
```

### Afiliados y puente `numero_control`

```text
DOMAIN: Afiliados
Frontend: Login/Auth por `AffiliateAuth` y `AffiliateRepository`; TopBar, Inicio, Perfil y Credencial por `AffiliateAuth.affiliateView`; consumidores financieros/marketplace pendientes
Current prototype source: `public.affiliates` en las cuatro áreas H-006; DATA.user/viewer/localStorage siguen NO AUTORITATIVOS y fuera de esas áreas
Historical source: Usuarios SUTIAPP.xlsx / Usuarios — fuera de SutiApp Final
Historical sheets: ninguna hoja de SutiApp Final es autoridad del padrón
Historical columns: referencias de solicitudes usan Número de control/Numero de control
Reads: identidad propia autorizada por RLS y asociación futura de solicitudes
Writes: ninguno desde UI; importador administrativo H-004 es el único escritor registrado
Transforms: proyección de presentación en memoria; ninguno sobre numero_control, preservar TEXT raw
Legacy dependency: puente de negocio con Google
Current authority: Supabase public.affiliates; Excel maestro como procedencia histórica
Future proposed authority: Supabase public.affiliates
Migration recommendation: SUPABASE_ACTIVE; cuatro áreas prioritarias migradas, lectores restantes `PENDING H-LATER`
Confidence: HIGH
Open questions: dominios sensibles distintos de la foto y activación Auth masiva no autorizada; foto autoritativa resuelta por PROFILE PHOTO CUTOVER
```

## Repositorios conceptuales pendientes

### Ícono e instalación

```text
DOMAIN: Branding / instalación / PWA
Frontend: Admin BrandingModule; Home InstallButton; SutiSeal; HTML/manifest/service worker
Previous sources: suti.branding.v1/localStorage, image-slot, .image-slots.state.json and hardcoded manifest/HTML
Current authority: public.app_settings + public.app_assets + Supabase Storage
Reads: BrandingRepository.get() and shared AssetRepository URL boundary; one in-memory VisualContent projection
Writes: scripts/sync-icon-installation.py with local administrative Secret Key only; browser writes disabled
Text fields: app_name, short_name, description
Asset relationships: app_icon, institutional_seal, favicon, apple_touch, pwa_192, pwa_512, pwa_maskable_512, install_screen_1/2/3
Transforms: public Storage URL projection; reproducible static synchronization for pre-React/PWA files
Error behavior: visible loading/error state; no fallback to local or hardcoded branding
Migration recommendation: SUPABASE_ACTIVE for reads/server administration; browser editing BLOCKED until Admin Auth
Confidence: HIGH
Open questions: provision authorized install-screen files; implement real administrative principal/permissions before enabling UI upload/replace/remove
```

### H-008 — Administración técnica y escritura visual

```text
Authentication authority: Supabase Auth
Authorization authority: public.admin_assignments + has_admin_permission() + RLS
Authorized principal: H005_TEST auth_user_id (one enabled assignment)
Denied principals tested: H005_TEST2, H005_TEST3 and anonymous
Reads: AdminRepository reads only the current principal's assignment
Writes: app_settings, app_assets, asset_sources and scoped visual tables/Storage according to explicit permission
Audit: public.admin_audit_log populated by write triggers
Local alternatives: adminStore/copyStore roles, viewer and localStorage are non-authoritative and cannot open the H-008 writer
Error behavior: visible denied/error phase; no fallback or local promotion
PWA derivative rule: runtime Storage changes are immediate; static manifest/icon copies require reproducible sync and deploy
Legacy boundary: no Ahorro, Préstamos, formulas, Apps Script or financial Google interaction
Status: SUPABASE_ACTIVE
```

Fuera de los repositorios ya implementados hasta H-007.3, permanecen pendientes:

- `MinutesRepository`, `DirectoryRepository`, `InstitutionalDocumentsRepository`, `EducationRepository`.
- `AgreementsRepository`, `MarketplaceRepository`, `MembershipRepository`; `CompaniesRepository` ya está implementado para el directorio público y no cubre esos dominios.
- `ToursRepository`, `VehiclesRepository`, `RentalsRepository`, `PropertiesRepository`, `SolarRepository`, `RafflesRepository`.
- `RequestsRepository`, `QuotesRepository`, `NotificationsRepository`, `DocumentsRepository`.
- `SavingsRepository` permanece orientado al adaptador Google legacy. Préstamos usa `FinancialLegacyRepository` + Edge y el snapshot temporal ADR-043; no existe reimplementación ni calculadora frontend.
- `AffiliateRepository` fue implementado en H-004 y es la única frontera permitida para nuevos consumidores del dominio Afiliados.

### H-LOAN-PAYROLL-IMPACT-003 — Nómina quincenal declarada

```text
DOMAIN: Nómina declarada para impacto informativo de préstamo
Authority: public.affiliate_payroll_declarations
Business key: affiliate_id UUID FK; numero_control permanece únicamente en affiliates y no se duplica
Inputs: gross_pay_per_fortnight NUMERIC(14,2); deductions_per_fortnight NUMERIC(14,2)
Fixed semantics: payment_period='quincenal'
Derived server-side: netPayPerFortnight, remainingNetPay, loanToNetPercent and three bar percentages
Informational constant: guidelinePercent=30; never eligibility, approval or payroll execution
Reader: get_current_declared_payroll; financial-legacy via get_current_declared_payroll_impact
Writer: save_current_declared_payroll, own linked Auth only, optimistic version
Audit: affiliate_payroll_declaration_audit with actor_real and old/new amounts
Impersonation: contextual read allowed by effective affiliate; write denied
Fallback/cache: NONE; no DATA, nominaStore, localStorage or browser calculation
Recovery: destructive removal requires empty declarations; otherwise backup/export required
Status: SUPABASE_ACTIVE / ADR-050
```

## Gate previo a conexión

Un dominio solo puede conectarse cuando tenga autoridad vigente, lectores, escritores, criterio de error, invalidación de copias, política de borrado, columnas verificadas y tests. `HIGH` en este documento significa confianza en el mapping, no permiso para migrar.

## MASTER ASSET EVACUATION

```text
Historical sources: Usuarios SUTIAPP.xlsx (hash aprobado) + 98 hojas de SutiApp Final
Columns mapped: 163/163; semantic title, letter, source row and URL order preserved
Runtime authority: public.app_assets or private_assets + Supabase Storage
Logical relations: historical_asset_sources; affiliate_files; existing domain foreign keys where authorized
Affiliate mapping: source_file_hash + source_row_ordinal + exact numero_control_raw -> affiliate.id UUID
Private access: owner/admin RLS; no public bucket for PII
Pending domains: 12,299 references remain provenance/ownership pending and are not runtime authority
Failed source files: Íconos!B2:B4, Firebase HTTP 402; no replacement inferred
Fallback: NONE; Storage failure produces placeholder/error
Status: OPERATIONALLY COMPLETE; HISTORICAL_ASSET_RECOVERY_PENDING=3; UNMAPPED_FILE_COLUMNS=0
```
