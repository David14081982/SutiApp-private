# H-DATA-001 — UI ↔ Google Sheets Data Mapping Audit

Status: **PASS — READ ONLY**  
Fecha de evidencia: 2026-08-21  
Google workbook: [SutiApp Final](https://docs.google.com/spreadsheets/d/1Vxy84N7mzbuioTmWhjRD2QFboDx--rG3iUwmLuyeY80/edit)  
Spreadsheet ID: `1Vxy84N7mzbuioTmWhjRD2QFboDx--rG3iUwmLuyeY80`  
Metadata actualizada en Drive: `2026-08-21T08:53:59.690Z`

## Alcance y método

Auditoría read-only del frontend fuente —no del bundle como fuente primaria—, sus stores, seeds, `DATA`, persistencia y rutas, contrastada con metadata y `userEnteredValue` de las 98 pestañas del workbook en vivo. Se escanearon todas las grillas declaradas para distinguir capacidad de grilla de extensión realmente escrita y contar fórmulas.

- `Used input` significa última fila/columna con valor o fórmula escrita; incluye encabezado. No cuenta resultados derramados de `QUERY` como filas maestras.
- `Grid` es capacidad declarada, no número de registros.
- Fórmulas significa celdas con `formulaValue` verificadas; 12 pestañas contienen fórmulas.
- La API de Sheets no expone el inventario completo de Apps Script/triggers asociados. Su dependencia queda `UNKNOWN` salvo evidencia documental; no se infiere ausencia.
- No se leyeron ni copiaron valores personales al repositorio. Solo nombres de columnas, dimensiones, conteos de fórmulas y estructura.
- No se modificó Google, Apps Script, frontend, datos, Supabase, SQL ni configuración.
- `affiliate` queda fuera del diseño de esta H: ninguna hoja de `SutiApp Final` es autoridad del padrón. Las columnas de control solo se registran como puentes de negocio hacia la autoridad separada `Usuarios SUTIAPP.xlsx`.
- Los componentes puramente presentacionales (`ui.jsx`, motion, press, iconos y helpers visuales) fueron revisados como dependencias de sus pantallas; no poseen fuente de datos independiente. No existen servicios/API/repositorios productivos: los objetos llamados repositorio son stores síncronos del navegador.

## Fase A — Inventario del frontend

Se inventariaron 48 pantallas/módulos lógicos. `R`=read, `C/U/D`=create/update/delete.

| # | Screen / Module | Frontend file | Route / entry point | Purpose | Current data source | Reads / Writes | Scope / sensitivity |
|---:|---|---|---|---|---|---|---|
| 1 | Shell, TopBar, navegación | `app/app.jsx` | raíz | tabs, rutas, perfil, notificaciones | `DATA.user`, `DATA.notifs`, admin/quote stores | R | user-specific |
| 2 | Inicio | `screens-home-r2.jsx` | `home` | resumen, accesos, banner, noticias | `DATA`, `adminStore`, branding | R | user-specific |
| 3 | Comité | `screens-home-r2.jsx` | sección Inicio | directorio visual | `DATA.comite`, `comite-photos.js` | R | contenido |
| 4 | Módulo institucional | `screens-marketplace.jsx`, `sindicato-store.jsx` | `modulo` | contenido/bloques sindicales | `sindicatoStore` seed desde `DATA.institucional` | R; Admin C/U/D/reorder | contenido |
| 5 | Noticias / artículo | `screens-home-r2.jsx`, `screens-marketplace.jsx` | Inicio / `articulo` | listado y detalle | `adminStore.newsLive` fallback `DATA.noticias` | R; Admin C/U/D | contenido |
| 6 | Mi Financiera | `screens-financiera.jsx` | `financiera` | catálogo y resumen financiero | `finCatStore`, `membershipStore`, `quoteStore`, `DATA.user` | R | legacy-sensitive |
| 7 | Solicitud de préstamo | `screens-loan.jsx` | `loan` | simulador y envío | `fundsStore`, `financeStore`, `DATA.user/docs` | R/C | CRITICAL LEGACY |
| 8 | Producto/servicio | `screens-marketplace.jsx` | `product` | detalle, cotización, simulación | `catalogStore`, `finCatStore`, `quoteStore`, `financeStore` | R/C | transactional |
| 9 | Catálogo/detalle | `screens-catalogo.jsx` | `catitem` | catálogo de producto | `catalogStore`, `quoteStore` | R/C quote | transactional |
| 10 | Convenios | `screens-convenios.jsx` | `convenios` | búsqueda, categorías, anuncios | `adminStore` fallback `DATA.convenios/anuncios` | R | contenido |
| 11 | Detalle convenio | `screens-convenios.jsx` | `convenio` | beneficio y productos | `adminStore`, `catalogStore` | R | contenido/transacción |
| 12 | Historial | `screens-historial.jsx` | `historial` | solicitudes propias | `financeStore`; fallback `DATA.solicitudes` | R | user-specific/legacy |
| 13 | Seguimiento | `screens-historial.jsx` | `tracking` | timeline y estado | `flowStore`/solicitud | R | user-specific |
| 14 | Credencial | `screens-credencial.jsx` | `credencial` | identidad, QR, banco | `DATA.user`, foto/banco local | R/U local | PII |
| 15 | Mis Documentos | `screens-documentos.jsx` | `documentos` | checklist/carga simulada | `DATA.docs` + state local | R/U temporal | PII |
| 16 | Suti Terrenos | `screens-terreno.jsx` | `terreno` | mapa/listado hardcodeado | constantes `LOTS/STREETS/AREAS` | R; CTA toast | design-only |
| 17 | Membresías embebidas | `screens-membresias.jsx` | sección financiera | catálogo | `membershipStore` | R | transactional |
| 18 | Admin gate/menu | `screens-admin.jsx` | `admin` | acceso y menú | `adminStore/localStorage` | R/U auth local | admin-only/security FAIL |
| 19 | Admin pop-ups/aprobaciones | `screens-admin.jsx`, `admin-popup-editor.jsx` | Admin | campañas por pantalla | `adminStore` | C/U/D/reorder/status | admin-only |
| 20 | Admin Finanzas | `screens-admin-finanzas.jsx` | Admin Finanzas | solicitudes/estados | `financeStore`, `quoteStore` | R/U status/comments | CRITICAL LEGACY |
| 21 | Admin cotizaciones | `screens-admin-finanzas.jsx` | submódulo | responder cotizaciones | `quoteStore` | R/U | transactional |
| 22 | Admin fondos | `screens-admin-fondos.jsx` | Admin Fondos | reglas financieras | `fundsStore` | C/U/D | CRITICAL LEGACY |
| 23 | Admin catálogo financiero | `screens-admin-fincat.jsx` | Admin Catálogo | grupos/productos/recomendaciones | `finCatStore` | C/U/D/reorder | legacy-sensitive |
| 24 | Admin flujos | `screens-admin-flujos.jsx` | Admin Flujos | etapas, SLA, tracking | `flowStore` | C/U/D/reorder | legacy-sensitive |
| 25 | Admin marketplace | `screens-admin-catalogo.jsx` | Admin Marketplace | productos | `catalogStore` | C/U/D/reorder | admin-only |
| 26 | Admin contenido | `screens-admin-content.jsx` | Admin contenido | nodos por pantalla | `adminStore` | C/U/D/reorder | admin-only |
| 27 | Admin noticias | `screens-admin-news.jsx` | Admin Noticias | artículos | `adminStore` | C/U/D/reorder | admin-only |
| 28 | Admin convenios | `screens-admin-convenios.jsx` | Admin Convenios | convenios/anuncios | `adminStore` | C/U/D/reorder | admin-only |
| 29 | Admin catálogos | `screens-admin-convenios.jsx` | Admin Catálogos | segmentación | `adminStore`, seed `DATA.conveniosCats` | C/U/D | admin-only |
| 30 | Admin pantallas | `screens-admin-pantallas.jsx` | Admin Pantallas | acceso UI | `adminStore` | R/U | admin-only/security |
| 31 | Admin membresías | `screens-admin-membresias.jsx` | Admin Membresías | catálogo | `membershipStore` | C/U/D | admin-only |
| 32 | Admin sindicato | `screens-admin-sindicato.jsx` | Admin Sindicato | módulos institucionales | `sindicatoStore` | C/U/D/reorder | admin-only |
| 33 | Admin roles | `screens-admin-roles.jsx` | Admin Roles | permisos simulados | `adminStore` | C/U/D | admin-only/security FAIL |
| 34 | Admin textos | `screens-admin-roles.jsx`, `copy-store.jsx` | Admin Textos | copy en vivo | `copyStore/localStorage` | C/U/reset | admin-only |
| 35 | Admin branding | `screens-admin-branding.jsx` | Admin Branding | nombre/ícono | `localStorage` | R/U | admin-only; hallazgo histórico sustituido por ADR-025 y `ICON_INSTALLATION_SUPABASE_AUDIT.md` |
| 36 | Admin planes | `screens-admin-planes.jsx` | Admin Planes | planes comerciales | `companyStore` | C/U/D/assign | admin-only |
| 37 | Empresa gate/dashboard | `screens-company.jsx` | panel empresa | auth/resumen | `companyStore/localStorage` | R/U auth | company-only/security FAIL |
| 38 | Empresa perfil | `screens-company-modules.jsx` | Empresa | datos empresa | `companyStore` | R/U | company-only |
| 39 | Empresa productos | `screens-company-modules.jsx` | Empresa | catálogo propio | `catalogStore/companyStore` | C/U/D | company-only |
| 40 | Empresa promociones | `screens-company-modules.jsx` | Empresa | promociones | `companyStore` | C/U/D | company-only |
| 41 | Empresa pop-ups | `screens-company-modules.jsx` | Empresa | solicitud de campaña | `adminStore` | C/U/submit | company-only |
| 42 | Empresa solicitudes | `screens-company-modules.jsx` | Empresa | solicitudes recibidas | `companyStore + financeStore` | R/U | company-only |
| 43 | Empresa cotizaciones | `screens-company-modules.jsx` | Empresa | presupuestos | `quoteStore` | R/U | company-only |
| 44 | Empresa estadísticas | `screens-company-modules.jsx` | Empresa | KPIs | `companyStore.stats` seed | R | DESIGN_ONLY |
| 45 | Empresa notificaciones | `screens-company-modules.jsx` | Empresa | avisos derivados | stores + hardcode | R | DERIVED/DESIGN_ONLY |
| 46 | Empresa bitácora | `screens-company-modules.jsx` | Empresa | actividad | `adminStore.auditLog` local | R | security-sensitive |
| 47 | Perfil | `app/app.jsx` | `perfil` | ficha personal y foto | `DATA.user`, `suti_user_photo` | R/U local | user-specific / PII |
| 48 | Notificaciones | `app/app.jsx` | `notifs` | avisos y cotizaciones listas | `DATA.notifs`, `quoteStore.mine()` | R | user-specific / DERIVED |

## Fase B — Inventario de las 98 hojas

| # | Sheet name | Used input R×C | Grid R×C | Formula cells | Likely derived | User-specific | numero_control | Domain | Likely type |
|---:|---|---:|---:|---:|---|---|---|---|---|
| 0 | Secretaría de finanzas | 18×23 | 18×39 | 0 | NO/UNKNOWN | NO | NO | Contenido institucional | MASTER |
| 1 | Hoja 87 | 0×0 | 1000×26 | 0 | NO/UNKNOWN | NO | NO | UNRESOLVED | UNKNOWN |
| 2 | Categorías | 11×3 | 1000×27 | 0 | NO/UNKNOWN | NO | NO | Catálogos | CATALOG |
| 3 | Historial de solicitudes | 2225×38 | 2225×38 | 0 | NO/UNKNOWN | YES | YES | Préstamos / finanzas | TRANSACTION |
| 4 | HISTORIAL P V2 | 13784×35 | 13784×35 | 0 | YES | YES | NO | Préstamos / finanzas | LEGACY_PROCESS |
| 5 | HISTORIAL DE PRESTAMOS | 1555×18 | 1555×18 | 0 | NO/UNKNOWN | YES | NO | Préstamos / finanzas | TRANSACTION |
| 6 | AMORTIZACIONES | 1×21 | 2×21 | 0 | YES | YES | NO | Préstamos / finanzas | CALCULATION |
| 7 | Reportee Prestamos | 2×315 | 3×315 | 0 | YES | YES | NO | Préstamos / finanzas | REPORT |
| 8 | JURIDICO | 160×35 | 1003×35 | 0 | NO/UNKNOWN | YES | NO | Préstamos / finanzas | TRANSACTION |
| 9 | Amortización V2 | 2×20 | 966×26 | 0 | YES | YES | YES | Préstamos / finanzas | CALCULATION |
| 10 | Query fondos | 1×1 | 12600×24 | 1 | YES | NO | NO | Préstamos / finanzas | QUERY |
| 11 | Query Reporte RH | 1×1 | 13094×6 | 1 | YES | YES | NO | Préstamos / finanzas | QUERY |
| 12 | Conciliación Programas | 1×6 | 1×23 | 0 | YES | YES | NO | Préstamos / finanzas | REPORT |
| 13 | INFORME FINANZAS 2025 (Juan Carlos) | 1×1 | 29×26 | 1 | YES | NO | NO | Préstamos / finanzas | REPORT |
| 14 | Reporte Otros Programas - RH | 1×6 | 1218×6 | 0 | YES | YES | NO | Préstamos / finanzas | REPORT |
| 15 | Reporte Otros Programas - QUERY | 500×12 | 500×12 | 9 | YES | YES | NO | Préstamos / finanzas | QUERY |
| 16 | Información educativa | 29×13 | 29×23 | 0 | NO/UNKNOWN | NO | NO | Educación | CATALOG |
| 17 | Tutoriales | 5×6 | 5×29 | 0 | NO/UNKNOWN | NO | NO | Educación | CATALOG |
| 18 | Adelanto de Nómina | 10×3 | 10×26 | 0 | NO/UNKNOWN | NO | NO | Adelanto de nómina | CONFIG |
| 19 | 1 Vehículos SutiAuto | 4×61 | 4×66 | 3 | YES | YES | NO | Suti Auto | CATALOG |
| 20 | 1 Solicitudes Suti Auto | 8×32 | 8×40 | 0 | NO/UNKNOWN | YES | YES | Suti Auto | TRANSACTION |
| 21 | Amortización SutiAuto | 1×5 | 2×74 | 0 | YES | YES | NO | Suti Auto | CALCULATION |
| 22 | 2 Vehículos en renta | 2×54 | 2×73 | 0 | NO/UNKNOWN | NO | NO | Renta Car | CATALOG |
| 23 | 2 Solicitudes Renta Car | 7×32 | 7×40 | 0 | NO/UNKNOWN | YES | YES | Renta Car | TRANSACTION |
| 24 | 3 Portafolio de Inversión | 1×28 | 2×36 | 0 | NO/UNKNOWN | YES | YES | Portafolio de inversión | MASTER |
| 25 | 3 Criterios Portafolio de Inversión | 3×6 | 3×6 | 0 | NO/UNKNOWN | NO | NO | Portafolio de inversión | CONFIG |
| 26 | 3 Solicitudes de Inversión | 5×28 | 5×36 | 0 | NO/UNKNOWN | YES | YES | Portafolio de inversión | TRANSACTION |
| 27 | 6 Suti Terrenos | 5×10 | 5×24 | 0 | NO/UNKNOWN | NO | NO | Suti Terrenos | CATALOG |
| 28 | 6 Solicitudes Suti Terrenos | 7×32 | 7×40 | 0 | NO/UNKNOWN | YES | YES | Suti Terrenos | TRANSACTION |
| 29 | 7 Suti Tours | 33×25 | 33×39 | 0 | NO/UNKNOWN | NO | NO | Tours | CATALOG |
| 30 | 7 Solicitudes Tours | 18×33 | 21×41 | 0 | NO/UNKNOWN | YES | YES | Tours | TRANSACTION |
| 31 | 8 Suti Farma | 91×6 | 91×27 | 0 | NO/UNKNOWN | YES | NO | Suti Farma | CATALOG |
| 32 | 10 Donativos | 2×13 | 2×27 | 0 | NO/UNKNOWN | NO | NO | Donativos | CATALOG |
| 33 | 10 Solicitudes Donativos  | 1×31 | 2×39 | 0 | NO/UNKNOWN | YES | YES | Donativos | TRANSACTION |
| 34 | Suti Casa | 53×31 | 53×31 | 0 | NO/UNKNOWN | NO | NO | Suti Casa | CATALOG |
| 35 | Solicitudes Suti Casa | 2×32 | 2×40 | 0 | NO/UNKNOWN | YES | YES | Suti Casa | TRANSACTION |
| 36 | Paneles Solares | 26×11 | 26×24 | 0 | NO/UNKNOWN | NO | NO | Paneles solares | CATALOG |
| 37 | Solicitudes Paneles Solares | 11×31 | 11×39 | 0 | NO/UNKNOWN | YES | YES | Paneles solares | TRANSACTION |
| 38 | Estatus | 3×2 | 3×26 | 0 | NO/UNKNOWN | NO | NO | Catálogos | CATALOG |
| 39 | Etiquetas usuarios | 22×2 | 22×26 | 0 | NO/UNKNOWN | NO | NO | Catálogos | CATALOG |
| 40 | Anuncio principal | 2×12 | 2×35 | 0 | NO/UNKNOWN | NO | NO | Contenido / promociones | MASTER |
| 41 | Cargos en App | 15×2 | 15×26 | 0 | NO/UNKNOWN | NO | NO | Catálogos | CATALOG |
| 42 | Minutas de acuerdos | 7×5 | 7×27 | 0 | NO/UNKNOWN | NO | NO | Minutas | MASTER |
| 43 | Convenios2 | 46×9 | 46×28 | 0 | NO/UNKNOWN | YES | NO | Convenios | CATALOG |
| 44 | Escalafón | 8×4 | 8×24 | 0 | NO/UNKNOWN | NO | NO | Documentos institucionales | MASTER |
| 45 | Descargas2 | 17×4 | 17×27 | 0 | NO/UNKNOWN | NO | NO | Documentos institucionales | CATALOG |
| 46 | Auto Willy | 3×4 | 3×25 | 0 | NO/UNKNOWN | NO | NO | UNRESOLVED | CATALOG |
| 47 | Convenios Suti | 1×5 | 2×27 | 0 | NO/UNKNOWN | NO | NO | Convenios | MASTER |
| 48 | Categorías SutiCompras | 4×3 | 4×55 | 0 | NO/UNKNOWN | NO | NO | Marketplace / SutiCompras | CATALOG |
| 49 | Empresas Suticompras | 2×26 | 2×28 | 0 | NO/UNKNOWN | YES | NO | Marketplace / SutiCompras | MASTER |
| 50 | Historial Presupuestos | 7×8 | 7×20 | 0 | NO/UNKNOWN | YES | NO | Marketplace / SutiCompras | TRANSACTION |
| 51 | Productos SutiCompras | 1×19 | 52×26 | 0 | NO/UNKNOWN | YES | NO | Marketplace / SutiCompras | CATALOG |
| 52 | Subcategorías SutiCompras | 1×4 | 72×56 | 0 | NO/UNKNOWN | NO | NO | Marketplace / SutiCompras | CATALOG |
| 53 | Banner SutiCompras | 14×6 | 14×6 | 0 | NO/UNKNOWN | YES | NO | Marketplace / SutiCompras | CATALOG |
| 54 | Choice Suticompras | 20×5 | 22×5 | 0 | NO/UNKNOWN | NO | NO | Marketplace / SutiCompras | CONFIG |
| 55 | Giros Económico | 4×2 | 4×66 | 0 | NO/UNKNOWN | NO | NO | Suti Market | CATALOG |
| 56 | Categorías SutiMarket | 6×3 | 6×66 | 0 | NO/UNKNOWN | NO | NO | Suti Market | CATALOG |
| 57 | Productos Balam | 1×4 | 6×66 | 0 | NO/UNKNOWN | NO | NO | Suti Market | CATALOG |
| 58 | Descarga de formatos | 1×4 | 2×26 | 0 | NO/UNKNOWN | NO | NO | Documentos institucionales | CATALOG |
| 59 | Normas y Reglamentos | 3×4 | 3×27 | 0 | NO/UNKNOWN | NO | NO | Documentos institucionales | CATALOG |
| 60 | Rifa | 501×23 | 502×38 | 0 | YES | YES | NO | Rifas | LEGACY_PROCESS |
| 61 | Compradores de boletos rifa | 2×20 | 2×34 | 0 | NO/UNKNOWN | YES | NO | Rifas | TRANSACTION |
| 62 | Choice Rifa | 4×4 | 4×28 | 0 | NO/UNKNOWN | NO | NO | Rifas | CONFIG |
| 63 | Votacion | 11×4 | 11×27 | 10 | YES | NO | NO | Votación | CALCULATION |
| 64 | Categoría de empleados | 7×4 | 7×27 | 0 | NO/UNKNOWN | NO | NO | Catálogos | CATALOG |
| 65 | Genero | 3×1 | 3×26 | 0 | NO/UNKNOWN | NO | NO | Catálogos | CATALOG |
| 66 | Membresias | 7×6 | 9×27 | 0 | NO/UNKNOWN | NO | NO | Membresías | CATALOG |
| 67 | Solicitudes membresía | 468×24 | 468×32 | 0 | NO/UNKNOWN | YES | YES | Membresías | TRANSACTION |
| 68 | Lotes | 1×18 | 3×27 | 0 | NO/UNKNOWN | YES | YES | Suti Terrenos | TRANSACTION |
| 69 | Estatus afiliados | 3×1 | 3×26 | 0 | NO/UNKNOWN | NO | NO | Catálogos | CATALOG |
| 70 | Criterios Simuladores | 146×15 | 147×86 | 68 | YES | NO | NO | Préstamos / finanzas | CALCULATION |
| 71 | Criterios de fondos | 151×15 | 151×86 | 73 | YES | NO | NO | Préstamos / finanzas | CALCULATION |
| 72 | Fondos Configuracion | 62×2 | 67×2 | 0 | NO/UNKNOWN | YES | NO | Préstamos / finanzas | CONFIG |
| 73 | Fondos para prestamos | 44×5 | 45×5 | 0 | NO/UNKNOWN | NO | NO | Préstamos / finanzas | CONFIG |
| 74 | Conciliacion - Otros Programas | 2×5 | 734×5 | 1 | YES | YES | NO | Préstamos / finanzas | REPORT |
| 75 | Log de Asignación IDs 2/25/2025, 12:24:49 AM | 64×6 | 1000×26 | 0 | NO/UNKNOWN | NO | NO | Préstamos / finanzas | LOG |
| 76 | Sindicatos | 6×4 | 6×4 | 0 | NO/UNKNOWN | YES | NO | Catálogos | CATALOG |
| 77 | Promociones | 88×5 | 88×5 | 0 | NO/UNKNOWN | YES | NO | Contenido / promociones | CATALOG |
| 78 | Ingreso ahorro | 393×3 | 393×3 | 0 | NO/UNKNOWN | NO | NO | Ahorro | TRANSACTION |
| 79 | Solicitud de Ahorro | 339×10 | 339×10 | 3 | YES | NO | NO | Ahorro | CALCULATION |
| 80 | Ahorro | 361×127 | 361×127 | 32970 | YES | YES | NO | Ahorro | LEGACY_PROCESS |
| 81 | Solicitud Cambio ahorro | 127×6 | 127×7 | 0 | NO/UNKNOWN | NO | NO | Ahorro | TRANSACTION |
| 82 | Solicitud de retiro | 229×12 | 229×12 | 0 | NO/UNKNOWN | YES | NO | Ahorro | TRANSACTION |
| 83 | Saldo manual | 2×7 | 2×7 | 0 | NO/UNKNOWN | NO | NO | Ahorro | TRANSACTION |
| 84 | Reporte Ahorro | 3768×4 | 3771×4 | 0 | YES | NO | NO | Ahorro | REPORT |
| 85 | Reporte - RH | 316×7 | 316×7 | 0 | YES | YES | NO | Ahorro | REPORT |
| 86 | Conciliacion | 2×9 | 253×9 | 1 | YES | YES | NO | Ahorro | REPORT |
| 87 | Directorio | 31×4 | 31×4 | 0 | NO/UNKNOWN | YES | NO | Directorio | MASTER |
| 88 | Nomina | 2×6 | 2×6 | 0 | NO/UNKNOWN | YES | NO | Préstamos / finanzas | TRANSACTION |
| 89 | Amortización | 1×3 | 1×26 | 0 | NO/UNKNOWN | NO | NO | Préstamos / finanzas | CONFIG |
| 90 | Plazo de pagos Meses | 28×2 | 28×26 | 0 | NO/UNKNOWN | NO | NO | Préstamos / finanzas | CONFIG |
| 91 | Íconos | 4×3 | 4×27 | 0 | NO/UNKNOWN | NO | NO | Catálogos | CATALOG |
| 92 | Cargos Extras (notas) | 0×0 | 5×9 | 0 | NO/UNKNOWN | NO | NO | UNRESOLVED | UNKNOWN |
| 93 | Choice | 12×8 | 12×8 | 0 | NO/UNKNOWN | NO | NO | Catálogos | CONFIG |
| 94 | Solicitudes de comprar o vender casas | 1×4 | 5×26 | 0 | NO/UNKNOWN | YES | NO | Suti Casa | TRANSACTION |
| 95 | App: Logins | 190×3 | 190×26 | 0 | NO/UNKNOWN | YES | NO | Sistema Glide | LOG |
| 96 | Error 404 | 2×4 | 1000×26 | 0 | NO/UNKNOWN | YES | YES | Sistema Glide | LOG |
| 97 | App: Metadata | 2×2 | 2×26 | 0 | NO/UNKNOWN | NO | NO | Sistema Glide | CONFIG |

### Resultado estructural Google

- 98 hojas inventariadas; 2 sin valores escritos: `Hoja 87` y `Cargos Extras (notas)`.
- 12 hojas con fórmulas: `Query fondos` (1), `Query Reporte RH` (1), `INFORME FINANZAS 2025 (Juan Carlos)` (1), `Reporte Otros Programas - QUERY` (9), `1 Vehículos SutiAuto` (3), `Votacion` (10), `Criterios Simuladores` (68), `Criterios de fondos` (73), `Conciliacion - Otros Programas` (1), `Solicitud de Ahorro` (3), `Ahorro` (32,970) y `Conciliacion` (1).
- 45 hojas contienen encabezados probablemente personales; 14 incluyen `Número de control`, `Numero de control`, `# Control` o `CONTROL`.
- Las hojas `QUERY`, `REPORT`, `CALCULATION` y `LEGACY_PROCESS` son derivadas/procesales; no se recomiendan como tablas maestras.

## Fases C–D — Mapping pantalla/campos ↔ hoja

| Frontend / field | Current prototype source | Historical sheet | Historical column | Transform / state | Confidence |
|---|---|---|---|---|---|
| Comité `name` | `DATA.comite[].name` | `Directorio` | `Nombre` | MAPPED | HIGH |
| Comité `role` | `DATA.comite[].role` | `Directorio` | `Cargo` | MAPPED | HIGH |
| Comité `img` | `comite-photos.js` | `Directorio` | no existe | UNRESOLVED | HIGH |
| Minuta `titulo` | sindicatoStore block | `Minutas de acuerdos` | `Título` | MAPPED | HIGH |
| Minuta `texto` | sindicatoStore block | `Minutas de acuerdos` | `Descripción` | MAPPED | HIGH |
| Minuta `url/file` | sindicatoStore block | `Minutas de acuerdos` | `Url` | MAPPED | HIGH |
| Minuta `slotId/image` | asset/local | `Minutas de acuerdos` | `Imagen` | MAPPED | HIGH |
| Minuta `date` | no campo estable en store | `Minutas de acuerdos` | `Fecha` | MAPPED; agregar al modelo futuro | HIGH |
| Normas `titulo/texto/url/image` | sindicatoStore | `Normas y Reglamentos` | `Título`, `Descripción`, `Url`, `Imagen` | MAPPED | HIGH |
| Formatos `titulo/texto/url/image` | sindicatoStore | `Descarga de formatos` | `Título`, `Descripción`, `Url`, `Imagen` | MAPPED | HIGH |
| Descargas `titulo/texto/file/image` | sindicatoStore | `Descargas2` | `Título`, `Descripción`, `PDF`, `Imagen` | MAPPED | HIGH |
| Educación `name/address/web/levels/image/price/phone` | sin pantalla dedicada | `Información educativa` | `INSTITUCIÓN ACADÉMICA`, `DIRECCIÓN`, `PÁGINA WEB`, `Niveles educativos`, `Imagen`, `Precio Normal`, `Precio con descuento`, `TELÉFONO OFICINA`, `CEL. WHATSAPP` | NO_FRONTEND_MAPPING | HIGH |
| Tutorial `category/title/description/url/image` | sin pantalla dedicada | `Tutoriales` | `Categoría`, `Título`, `Descripción`, `URL`, `Imagen` | NO_FRONTEND_MAPPING | HIGH |
| Convenio `name` | `adminStore/DATA.convenios[].name` | `Convenios2` | `Nombre` (duplicada) / `Título` | requiere reconciliar semántica | MEDIUM |
| Convenio `cat` | store/`DATA` | `Convenios2` | `Categoría` | MAPPED | HIGH |
| Convenio `disc` | store/`DATA` | `Convenios2` | `Descuento` | parse numérico, sin limpiar raw | HIGH |
| Convenio `addr` | store/`DATA` | `Convenios2` | no existe; candidato en educativa | UNRESOLVED | LOW |
| Convenio `web/tel/image/desc` | store/companyStore | `Convenios2` | `WEB`, `Teléfono`, `Imagen`, `Descripción` | MAPPED | HIGH |
| Membresía `empresa/concepto/logo/monto/pagos` | membershipStore | `Membresias` | `Empresa`, `Concepto`, `Logotipos`, `Monto`, `Pagos` | MAPPED | HIGH |
| Solicitud membresía | no submit específico conectado | `Solicitudes membresía` | fechas, empresa, concepto, monto, pagos, `Numero de control`, PII, documentos, estatus | MULTI_SOURCE / future transaction | HIGH |
| Marketplace `nombre/categoría/subcategoría/desc/precio` | catalogStore | `Productos SutiCompras` | `Nombre Producto`, `Categoría`, `SubCategoría`, `Descripción`, `Precio` | MAPPED | HIGH |
| Marketplace `badge/stock/rating/image/options` | catalogStore parcial | `Productos SutiCompras` | `Descuento (%)`, `Stock Disponible`, `Rating`, `URL Imagen`, `Tallas Disponibles`, `Colores` | MULTI_SOURCE; ampliar contrato | HIGH |
| Marketplace category | finCat/catalogStore | categorías/subcategorías SutiCompras | columnas homónimas e imágenes | MAPPED | HIGH |
| Cotización `folio/cliente/concepto/precio/empresa` | quoteStore | `Historial Presupuestos` | `🔒 Row ID`, `Email Cliente`, `Concepto`, `Precio`, `Email Empresa` | IDs/modelos no equivalentes | MEDIUM |
| Suti Auto catálogo | catalogStore seed mínimo | `1 Vehículos SutiAuto` | 61 columnas: Marca…Precio, fotos, financiación, tasa/plazo/enganche | MULTI_SOURCE; no copiar monolíticamente | HIGH |
| Suti Auto solicitud | finance/quoteStore | `1 Solicitudes Suti Auto` | fechas, título, monto, `Numero de control`, PII, documentos, estatus | MULTI_SOURCE | HIGH |
| Renta Car catálogo/solicitud | catalog/quoteStore | `2 Vehículos en renta`, `2 Solicitudes Renta Car` | vehículo + fechas/días/precio; solicitud + `Numero de control` | MULTI_SOURCE | HIGH |
| Portafolio `monto/tasa/plazo/rendimiento` | simulador genérico | criterios/solicitudes de inversión | columnas homónimas | CALCULATED / MULTI_SOURCE | HIGH |
| Tours catálogo | catalogStore seed | `7 Suti Tours` | `Título`, `Categoría`, `Ciudad`, `Dirección`, coordenadas, descripción, precios, fechas e imágenes | MAPPED; galería normalizada | HIGH |
| Tours solicitud | finance/quoteStore | `7 Solicitudes Tours` | fechas, concepto, monto, precios, `Numero de control`, PII, estatus, plazo | MULTI_SOURCE | HIGH |
| Terrenos catálogo genérico | catalogStore | `6 Suti Terrenos` | título, observaciones, imagen, precios, enganche, cuota, amortización, ubicación | MAPPED parcial | HIGH |
| Terreno dedicado `LOTS` | constantes JSX | ninguna hoja equivalente | id/zona/m²/frente/fondo/precio/vendido/geometría | DESIGN_ONLY / UNRESOLVED | HIGH |
| Casa catálogo/solicitud | catalogStore | `Suti Casa`, `Solicitudes Suti Casa` | inmueble, precio, ubicación, características, imágenes; solicitud + control/PII | MULTI_SOURCE | HIGH |
| Solar catálogo/solicitud | catalogStore | `Paneles Solares`, `Solicitudes Paneles Solares` | título, descripción, ciudad, precios, plazo/enganche; solicitud + fondo/tasa/control | MULTI_SOURCE / CALCULATED | HIGH |
| Donativo catálogo/solicitud | sin UI inequívoca | `10 Donativos`, `10 Solicitudes Donativos ` | contenido/precio/imágenes + solicitud/control/PII | NO_FRONTEND_MAPPING | HIGH |
| Farma catálogo | catalogStore seed | `8 Suti Farma` | `NOMBRE`, `CANTIDAD`, `GRAMOS`, `Imagenes`, `Categoria`, `URL Whatsapp` | MAPPED parcial | HIGH |
| Rifa catálogo/compra | catalogStore seed | `Rifa`, `Compradores de boletos rifa`, `Choice Rifa` | boleto/precio/sorteo/comprador/vendedor/comprobantes/estatus/plazo | MULTI_SOURCE | HIGH |
| Ahorro `user.ahorro` | `DATA.user.ahorro` | `Ahorro` | `Saldo (HOY)` candidato calculado | CALCULATED; no conectar sin adapter legacy | HIGH |
| Ahorro historial | `DATA.solicitudes` mock | conjunto Ahorro | folio, fechas, montos, estado | MULTI_SOURCE | HIGH |
| Préstamo request | financeStore | `Historial de solicitudes` | ID/control/proceso/fondo/tasa/plazo/montos/fecha/estado/docs/firma | MAPPED conceptual; modelos no equivalentes aún | HIGH |
| Préstamo timeline | flowStore / derivación estado | hojas históricas | `Estado`, fechas/observaciones; no catálogo de etapas | DERIVED / UNRESOLVED | MEDIUM |
| Fondo `fondo/montoMax/tasa/plazo` | fundsStore seed/local | criterios/fondos | `Fondo`, `Monto Maximo`, `Tasa`, `Plazos` y segmentación | CALCULATED / MULTI_SOURCE | HIGH |
| Noticias `tag/title/date/read/body` | DATA/adminStore | ninguna hoja inequívoca | — | DESIGN_ONLY / UNRESOLVED | HIGH |
| Banner Inicio | texto hardcodeado | `Anuncio principal` | encabezados `1…10` sin semántica de UI | UNRESOLVED | HIGH |
| Pop-up/campaña | adminStore | `Promociones` candidato | nombre, imagen, descripción, URL, título link | MULTI_SOURCE | MEDIUM |
| Documentos `id/status/note` | `DATA.docs` | columnas dispersas en solicitudes | INE, talones, PDF, firma, comprobantes | UNRESOLVED; no maestro documental | HIGH |

## Fase E — Lectura y escritura

- Contenido simple: Minutas, Normas, Descargas, Directorio, educación y tutoriales son lectura pública en UI; sus editores actuales escriben solo copias locales.
- Catálogos: Convenios, Marketplace, membresías y productos se leen en afiliado y se crean/editan/eliminan desde Admin/Empresa, hoy en `localStorage`.
- Transacciones: solicitudes, cotizaciones, compras y cambios de estado se crean/modifican en stores locales; no llegan a Google.
- Documentos: la UI simula selección/carga o guarda data URL local; no existe repositorio durable.
- Finanzas: simuladores ejecutan cálculos y crean snapshots locales. Cualquier proceso real permanece en Google legacy.
- Eliminación local no invalida seeds/fallbacks: varios dominios pueden reaparecer tras reset o por otra store. Es un conflicto de autoridad, no una estrategia de recuperación.

## Fase F — Fórmulas y Apps Script

| Domain | Classification | Evidence |
|---|---|---|
| Ahorro | FORMULA_DEPENDENT; Apps Script UNKNOWN | 32,970 fórmulas en `Ahorro`, 3 en `Solicitud de Ahorro`, conciliación |
| Préstamos | FORMULA_DEPENDENT; Apps Script UNKNOWN | queries, reportes, criterios, conciliaciones y amortizaciones |
| Fondos/simuladores | FORMULA_DEPENDENT | 68 fórmulas en `Criterios Simuladores`, 73 en `Criterios de fondos` |
| Suti Auto | FORMULA_DEPENDENT parcial | 3 fórmulas en catálogo; amortización separada |
| Votación | FORMULA_DEPENDENT | 10 fórmulas |
| Contenido simple | NO_LEGACY_LOGIC observado | cero fórmulas en hojas mapeadas; Apps Script no inspeccionable |
| Resto transaccional | UNKNOWN | cero fórmulas no demuestra ausencia de automatizaciones |

`APPS_SCRIPT_DEPENDENT` o `FORMULA_AND_SCRIPT_DEPENDENT` no se afirma sin inventario del proyecto, triggers y propietarios.

## Fases G–H — Destino y prioridad

Conteo sobre los 37 dominios de la matriz autoritativa:

| Recommendation | Count | Domains |
|---|---:|---|
| SUPABASE_NOW | 5 | Directorio, Minutas, Descargas/Normas, Secretaría Finanzas informativa, catálogos de segmentación |
| SUPABASE_LATER | 11 | Afiliados (H separada), Perfil/Credencial, Educación/Tutoriales, Convenios, Empresas, Donativos, Farma, Cotizaciones, Flujos, Admin/branding, Votación |
| GOOGLE_LEGACY | 4 | Ahorro, Préstamos, Adelanto de nómina, Fondos/criterios |
| HYBRID | 10 | Marketplace, membresías, Tours, Suti Auto, Renta Car, Inversión, Casa, Solar, Rifas, Solicitudes/seguimiento |
| DERIVED_VIEW | 2 | Notificaciones; reportes/queries/conciliaciones |
| UNRESOLVED | 5 | Noticias, anuncios/pop-ups, Terreno dedicado, Suti Market/Balam, documentos |

Complejidad:

- LOW: contenido y catálogos simples.
- MEDIUM: contenido administrable, catálogos relacionados y módulos sin UI.
- HIGH: CRUD multi-actor, PII, solicitudes, empresas y cotizaciones.
- CRITICAL LEGACY: Ahorro, Préstamos, Adelanto de nómina, fondos/criterios, Suti Auto financiero, Portafolio, Terrenos, Solar y reportes/conciliaciones.

## Fase J — Datos DESIGN_ONLY

Quince grupos no tienen evidencia histórica suficiente como datos productivos:

1. Perfil y cifras de `DATA.user`, incluidos ahorro, crédito y nómina.
2. Recomendaciones personalizadas de `DATA.recommended`.
3. Notificaciones de `DATA.notifs`.
4. Noticias de `DATA.noticias`.
5. Solicitudes/timelines de `DATA.solicitudes`.
6. Banner textual fijo de Inicio.
7. Favoritos locales de convenios.
8. Catálogos seed de aires, puertas, cómputo y cirugías sin hoja reconciliada.
9. Mapa `LOTS/STREETS/AREAS` de Suti Terrenos.
10. Pop-ups, audiencias y prioridades de adminStore.
11. Flujos, etapas y SLA de flowStore.
12. Roles, permisos, viewer e impersonación simulada.
13. Planes, stats y conversiones de empresas.
14. Branding, copy, assets y slots locales.
15. Estados de documentos y datos bancarios locales.

No deben seedear producción ni completar huecos de Google.

## Fase K — Google sin representación directa en frontend

Trece grupos `NO_FRONTEND_MAPPING`:

1. `Hoja 87` y `Cargos Extras (notas)` vacías.
2. `JURIDICO`.
3. Reportes/query/conciliaciones financieras como pantallas propias.
4. `Información educativa` como pantalla dedicada.
5. `Tutoriales` como pantalla dedicada.
6. Donativos.
7. Votación.
8. Nómina.
9. `Auto Willy`.
10. `Solicitudes de comprar o vender casas`.
11. Log de asignación de IDs.
12. `App: Logins` / `App: Metadata`.
13. `Error 404`.

No mapear no autoriza eliminar.

## Fase L — Repositorios conceptuales

- Simple/read: `MinutesRepository`, `DirectoryRepository`, `InstitutionalDocumentsRepository`, `EducationRepository`.
- Catálogo/CRUD: `AgreementsRepository`, `CompaniesRepository`, `MarketplaceRepository`, `MembershipRepository`.
- Programas: `ToursRepository`, `VehiclesRepository`, `RentalsRepository`, `PropertiesRepository`, `SolarRepository`, `RafflesRepository`.
- Transacción: `RequestsRepository`, `QuotesRepository`, `DocumentsRepository`.
- Derivado: `NotificationsQuery`, `FinancialReportsQuery`.
- Legacy adapters: `SavingsRepository → GoogleSavingsAdapter`; `LoansRepository → GoogleLoansAdapter`.
- `AffiliateRepository` queda regido por H-003; no se redefine.

## Source of truth audit

```text
SOURCE OF TRUTH AUDIT
Domain: 37 dominios listados en DATA_MAPPING.md
Authority: Afiliados=Excel maestro; Ahorro/Préstamos=Google legacy; restantes, autoridad productiva no se promueve sin escritor/owner demostrado
Readers: 48 pantallas/módulos inventariados
Writers: stores/localStorage del prototipo; escritores Google no inventariados
Alternative sources: DATA, seeds, adminStore, companyStore, catalogStore, financeStore, snapshots, localStorage y JSON/assets
Fallbacks: varios fallbacks activos en prototipo; no autorizados para producción
Caches: localStorage, CacheStorage/service worker y assets locales
Conflicts: 10 familias documentadas: perfil, noticias, anuncios, convenios, empresas, marketplace, catálogos financieros, solicitudes, documentos y flujos
Verdict: SAFE para auditoría read-only; BLOCKED para conexión/migración
Evidence: código fuente, metadata/rangos live de SutiApp Final y documentos de gobierno
```

Si se elimina un registro de Google, hoy no cambia la app porque esta consume seeds/stores locales. Esas copias podrían seguir mostrándolo; deben retirarse de la ruta productiva por dominio cuando exista una migración autorizada, sin fallback silencioso.

## Legacy Google audit

```text
LEGACY GOOGLE AUDIT
Systems/domains: SutiApp Final; Ahorro, Préstamos, fondos, amortizaciones, queries, reportes y conciliaciones
Reads: metadata, encabezados, userEnteredValue y fórmulas, read-only
Writes: NONE
Calculations/triggers: 12 hojas con fórmulas; Apps Script/triggers UNKNOWN
Authority: Google legacy para Ahorro/Préstamos; referencia histórica para mapping de otros dominios
Equivalence: NOT DEMONSTRATED
Recovery: NOT APPLICABLE; no hubo escrituras
Classification: READ ONLY / REQUIRES AUDIT
Decision: ninguna decisión de migración solicitada ni tomada
Evidence: scan live 98/98 y conteos de formulaValue
```

## Riesgos y preguntas abiertas

- No se conoce el inventario de Apps Script, triggers, propietarios, frecuencias ni errores.
- Varias hojas mezclan catálogo, PII, documentos, financiación y estado; no deben copiarse a una tabla monolítica.
- `🔒 Row ID` es ID técnico de Glide, no sustituto automático de UUID ni de `numero_control`.
- Encabezados duplicados o ambiguos —por ejemplo `Nombre` en `Convenios2`— requieren reconciliación.
- `Anuncio principal` usa encabezados numéricos sin contrato semántico verificable.
- `Productos Balam` no se equipara a Suti Market sin decisión/evidencia.
- Las fórmulas escritas y los resultados derivados requieren pruebas de equivalencia antes de cualquier traslado.
- La seguridad actual Admin/Empresa depende del navegador y no habilita escritores productivos.
- No existen `WORK_QUEUE.md` ni `WORK_QUEUE_HISTORY.md`; esta H no autoriza continuidad automática.

## Reconciliación con invariantes

- INV-001/017: `numero_control` solo es puente TEXT raw; no se normaliza ni presume único.
- INV-002/003/012/014: se identifican fallbacks/copias; quedan bloqueados para producción.
- INV-004/016: `DATA`, seeds y cálculos UI quedan marcados no autoritativos.
- INV-007/008: Ahorro y Préstamos permanecen Google legacy.
- INV-010: cero modificación de históricos.
- INV-011: lectores frontend inventariados; escritores Google faltantes quedan explícitamente `UNKNOWN`.
- INV-015: ningún archivo funcional cambió; fuente y bundle conservan baseline.

## Orden de migración recomendado, no autorizado

1. Contenido simple: Minutas, Directorio, Normas, Descargas y Secretaría de Finanzas informativa.
2. Catálogos no financieros y de segmentación, con escritor/owner confirmado.
3. Convenios y empresas, eliminando copias locales por corte explícito.
4. Marketplace y membresías separando catálogo de transacción.
5. Programas híbridos por dominio, con requests/documentos aparte.
6. Ahorro, Préstamos, fondos, cálculos y conciliaciones al final, solo tras auditoría/equivalencia financiera.

No iniciar ninguna conexión ni la siguiente H desde este documento.

H-DATA-001 RESULT

Status: PASS — READ ONLY

Frontend screens/modules inventoried: 48

Google sheets inventoried: 98/98

Mapped domains: 37 audited; 32 classified with a proposed destination and 5 UNRESOLVED

High-confidence mappings: 27 domain rows in the master matrix

Unresolved mappings: 5 — Noticias; anuncio principal/promociones/pop-ups; Terreno dedicated UI; Suti Market/Productos Balam; affiliate documents

Design-only data found: YES — 15 groups

Google domains without frontend mapping: 13 groups

SUPABASE_NOW: 5

SUPABASE_LATER: 11

GOOGLE_LEGACY: 4

HYBRID: 10

CRITICAL_LEGACY modules: 9 — Ahorro; Préstamos; Adelanto de nómina; fondos/criterios; Suti Auto financiero; Portafolio de Inversión; Terrenos; Paneles Solares; reportes/queries/conciliaciones

Source-of-truth conflicts found: 10 families, documented and blocked for production connection

Functional files changed: NO

Google changed: NO

Supabase changed: NO

Recommended migration order: contenido institucional simple → catálogos no financieros → convenios/empresas → marketplace/membresías → programas híbridos por dominio → legacy financiero después de equivalencia autorizada
