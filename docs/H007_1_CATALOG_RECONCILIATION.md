# H-007.1 — Reconciliación y separación de Catálogos

## Resultado ejecutivo

Se auditaron read-only 19 hojas catalogales/configuración de `SutiApp Final` mediante rangos bounded y se separaron 27 subdominios conceptuales. Las ocho clasificaciones solicitadas están representadas. Ningún subdominio cumple hoy simultáneamente autoridad clara, escritor conocido, ausencia de conflicto, consumidor seguro y ausencia de dependencia financiera; por tanto se crearon **0 tablas**, se migraron **0 filas** y no se modificó Google.

Esto no es una tabla genérica `catalogs`: `Choice`, `Íconos` y `Choice Suticompras` fueron descompuestas por columna/semántica. El perfil estructurado reproducible está en `data/h0071-catalog-profile.json` y está marcado explícitamente `audit_only_non_authoritative`; ningún runtime lo lee.

## Evidencia fuente

Spreadsheet: `SutiApp Final`, ID `1Vxy84N7mzbuioTmWhjRD2QFboDx--rG3iUwmLuyeY80`. Hojas/rangos leídos: `Categorías!A1:D12`, `Estatus!A1:C3`, `Etiquetas usuarios!A1:C22`, `Cargos en App!A1:C15`, `Categoría de empleados!A1:E7`, `Genero!A1:B3`, `Estatus afiliados!A1:B3`, `Sindicatos!A1:E6`, `Íconos!A1:D4`, `Choice!A1:I12`, `Categorías SutiCompras!A1:F4`, `Subcategorías SutiCompras!A1:F72`, `Choice Suticompras!A1:F22`, `Giros Económico!A1:C4`, `Categorías SutiMarket!A1:D6`, `Choice Rifa!A1:E4`, `Auto Willy!A1:E3`, `Cargos Extras (notas)!A1:J5` y `Plazo de pagos Meses!A1:C28`.

No se leyeron transacciones, PII, fórmulas, Apps Script, reportes ni conciliaciones. No hubo escrituras.

## Matriz de subdominios

| Subdominio | Fuente | Clasificación | Consumidor actual | Escritor/autoridad actual | Destino futuro | Migrado | Motivo |
|---|---|---|---|---|---|---|---|
| Navegación institucional | `Categorías` | CONTENT_CONFIGURATION | `DATA.institucional` + descriptores H-007 | Google writer desconocido; config en código; conflicto | Supabase content config tras contrato común | NO | Mezcla módulos migrados y no migrados. |
| Estatus de negocio | `Estatus` | UNRESOLVED | Ningún lector de lista; afiliado expone raw | Writer desconocido; compite con `Estatus afiliados` | UNRESOLVED | NO | `Vigente/Baja` y `Activo/Baja` no están reconciliados. |
| Etiquetas de usuarios | `Etiquetas usuarios` | AFFILIATE_SEGMENTATION | Sin consumidor catalogal demostrado | Writer desconocido; Google candidato histórico | Taxonomía Supabase futura | NO | Mezcla namespaces y duplica etiquetas de categoría laboral. |
| Roles operativos Glide | `Cargos en App` | APP_CONFIGURATION | Sin equivalente; `ADMIN.CARGOS` usa otros valores | Writer/autoridad desconocidos | Roles técnicos solo tras diseño de seguridad | NO | Cargo operativo, cargo sindical y rol técnico no son equivalentes. |
| Categorías laborales | `Categoría de empleados` | AFFILIATE_SEGMENTATION | `ADMIN.NIVELES`, audiencias y filtros financieros prototipo | Google writer desconocido + escritor `localStorage` | Catálogo Supabase futuro | NO | Cutover tocaría consumidores financieros protegidos. |
| Género | `Genero` | AFFILIATE_SEGMENTATION | Vista presenta `gender_raw`, no consume lista | Writer desconocido; valores raw viven en `affiliates` | Catálogo de validación futuro | NO | No debe sobrescribir históricos raw; falta contrato de edición. |
| Estatus del afiliado | `Estatus afiliados` | UNRESOLVED | Vista presenta `affiliate_status_raw`, no consume lista | Writer desconocido; conflicto con `Estatus` | UNRESOLVED | NO | Vocabularios no reconciliados. |
| Sindicatos | `Sindicatos` | AFFILIATE_SEGMENTATION | `ADMIN.SINDICATOS`, audiencias y filtros financieros prototipo | Google writer desconocido + escritor `localStorage` | Catálogo Supabase futuro | NO | Cutover tocaría consumidores financieros protegidos. |
| Tipo de propiedad | `Choice!B` | MARKETPLACE_CATALOG | Flujos históricos Casa/Terrenos | Marketplace local y Google sin owner reconciliado | Catálogo property/Marketplace | NO | Autoridad Marketplace no resuelta. |
| Comprar/rentar | `Choice!C` | MARKETPLACE_CATALOG | Candidato de flujos property | Writer/consumer contractual desconocido | Catálogo property/Marketplace | NO | Falta contrato de uso. |
| Impedimentos de venta | `Choice!D` | PROGRAM_CATALOG | Sin consumidor demostrado | Regla de programa/owner desconocidos | Configuración programa property | NO | Puede ser regla de negocio, no lista visual inocua. |
| Inversión inmobiliaria | `Choice!E` | FINANCIAL_LEGACY | Flujos históricos inversión/property | Google legacy | Google legacy | NO | Inversión explícita. |
| Estado de propiedad | `Choice!F` | MARKETPLACE_CATALOG | Candidato property | Autoridad Marketplace no resuelta | Catálogo property/Marketplace | NO | Marketplace fuera de cutover. |
| Materiales | `Choice!G` | MARKETPLACE_CATALOG | Candidato property | Autoridad Marketplace no resuelta | Catálogo property/Marketplace | NO | Marketplace fuera de cutover. |
| Modelos de empresa | `Choice!H` | MARKETPLACE_CATALOG | Candidato Empresa/Marketplace | Owner y writer desconocidos | Taxonomía de empresas | NO | Empresa/Marketplace no reconciliados. |
| Asset “activa” | `Íconos` fila 2 | APP_CONFIGURATION | Sin lookup frontend demostrado | Config visual/estado ambiguo | Asset registry futuro | NO | No se conoce el estado de negocio representado. |
| Assets pago/cobro | `Íconos` filas 3–4 | FINANCIAL_LEGACY | Lookup legacy desconocido | Google legacy | Google legacy | NO | “pendiente de pago” y “SIN COBRO”. |
| Categorías SutiCompras | hoja homónima | MARKETPLACE_CATALOG | Mapping Marketplace; runtime usa seeds distintos | Google writer desconocido + `catalogStore` local | Tablas Marketplace futuras | NO | Conflicto de escritores y cutover fuera de alcance. |
| Subcategorías SutiCompras | hoja homónima | MARKETPLACE_CATALOG | Mapping Marketplace | Sin filas de negocio | Tabla Marketplace si se puebla | NO | 0 entidades fuente. |
| Choice categorías SutiCompras | `Choice Suticompras!A` | MARKETPLACE_CATALOG | Seeds Marketplace/Finanzas | Autoridad conflictiva | Tablas Marketplace futuras | NO | Algunas categorías están embebidas en UI financiera. |
| Row IDs huérfanos | `Choice Suticompras!E` | GLIDE_HELPER | Glide | Glide/UNKNOWN | Retirar tras inventario Glide | NO | 13 IDs técnicos sin valor de negocio. |
| Giros económicos | `Giros Económico` | MARKETPLACE_CATALOG | Candidato Empresa/SutiMarket | Consumer y writer desconocidos | Taxonomía Marketplace futura | NO | Falta contrato. |
| Categorías SutiMarket | hoja homónima | MARKETPLACE_CATALOG | Ítem genérico `market` | Relación con Productos Balam unresolved | Marketplace tras decisión SutiMarket/Balam | NO | Identidad del catálogo no resuelta. |
| Formas/estado de rifa | `Choice Rifa` | FINANCIAL_LEGACY | Compra/pago de rifa | Google legacy | Google legacy hasta auditoría transaccional | NO | Efectivo, nómina, transferencia, plazo y estado final. |
| Ofertas Auto Willy | `Auto Willy` | UNRESOLVED | Sin mapping frontend | Owner/consumer desconocidos | UNRESOLVED | NO | Son ofertas con precio, no taxonomía reusable. |
| Cargos extra | `Cargos Extras (notas)` | UNRESOLVED | Ninguno | Hoja vacía | UNRESOLVED | NO | Sin contenido ni semántica. |
| Plazos de pago | `Plazo de pagos Meses` | FINANCIAL_LEGACY | Condicionales de préstamo candidatas | Google legacy | Google legacy | NO | Semántica explícita de pagos/préstamos. |

## Conteo por clasificación

| Clasificación | Subdominios |
|---|---:|
| AFFILIATE_SEGMENTATION | 4 |
| APP_CONFIGURATION | 2 |
| CONTENT_CONFIGURATION | 1 |
| MARKETPLACE_CATALOG | 10 |
| PROGRAM_CATALOG | 1 |
| FINANCIAL_LEGACY | 4 |
| GLIDE_HELPER | 1 |
| UNRESOLVED | 4 |

## Autoridad y gate de migración

Los escritores Google siguen `UNKNOWN`, tal como H-DATA-001 advirtió. En los dos catálogos que sí tienen consumidores directos de segmentación (`Sindicatos` y `Categoría de empleados`), `adminStore` permite C/U/D en `localStorage` y sus arrays alimentan también `fundsStore`, `financeStore` y pantallas de fondos. Migrarlos o conectar esos lectores dentro de H-007.1 violaría el aislamiento de Ahorro/Préstamos/fondos y dejaría autoridades múltiples.

Marketplace tampoco pasa el gate: `catalogStore`, `companyStore`, `finCatStore`, `DATA` y Google mantienen taxonomías/copias distintas y escritores locales. Crear tablas sin cutover produciría una nueva copia sin autoridad productiva.

Por estas razones, `Can migrate now = NO` en 27/27 subdominios. No se diseñó ni aplicó schema, RLS, repository o UI. Esto es cumplimiento del gate, no una pérdida de filas.

## Legacy e invariantes

- Inversión inmobiliaria, pago/cobro, elecciones de pago de rifa y plazos permanecen `FINANCIAL_LEGACY`.
- `Cargos en App` no se promueve a rol técnico ni se mezcla con cargo sindical/segmentación.
- `Genero` y estatus no normalizan ni reescriben campos históricos de `public.affiliates`.
- Row IDs de Glide no se convierten en UUIDs de negocio.
- Google permaneció read-only; Auth, `affiliate`, impersonación y H-008 no fueron tocados.

## Decisiones que desbloquearían trabajo futuro

1. Confirmar owner/escritor y vigencia de cada hoja que se pretenda promover.
2. Separar el futuro cutover de Segmentación de los consumidores financieros; requiere contrato para que fondos/finanzas sigan legacy sin depender del nuevo catálogo.
3. Resolver la autoridad Marketplace completa antes de migrar categorías aisladas.
4. Definir cuál vocabulario de estatus corresponde a cada campo histórico sin modificar raw.

No se solicita una decisión para cerrar esta auditoría; esas decisiones solo son necesarias antes de una migración posterior.
