# DATA COVERAGE & UI CUTOVER

Fecha: 2026-08-22  
H: `H-DATA-CUTOVER-001`  
Estado del bloque ejecutable: `PASS`  
Fuente read-only: `SutiApp Final` (`1Vxy84N7mzbuioTmWhjRD2QFboDx--rG3iUwmLuyeY80`)  
Snapshot canónico: `37FA2B489B0E33E56E833FD0854AF87FE542705BB739228E27DF7946ACC43D00`

## Auditoría y autoridad

La instrucción explícita del propietario autoriza Supabase como autoridad de los catálogos maestros no financieros claramente mapeados. Google conserva procedencia read-only. Solicitudes, tasas, plazos, enganches, amortizaciones, elegibilidad, nómina, compras de rifa y demás procesos financieros/transaccionales existentes no se migran ni se reescriben.

```text
SOURCE OF TRUTH AUDIT
Domain: catálogos maestros por programa
Authority: program_catalog_items + program_catalog_item_assets + Supabase Storage
Readers: ProgramCatalogRepository → catalogStore → pantallas Claude Finanzas/producto/detalle
Writers: importador server-side autorizado; create_program_benefit_request únicamente para Farma
Alternative sources: Google histórico, DATA, listings mock y URLs Glide
Fallbacks: NONE
Caches: estado React en memoria; reemplazable
Conflicts: solicitudes/cálculos separados como legacy_pending; Suti Market/Balam y Cirugías UNRESOLVED
Verdict: SAFE para los 134 registros importados; BLOCKED por dominio para autoridades no reconciliadas
```

## Matriz de programas Claude

`Rows` cuenta filas significativas, no capacidad de grilla ni encabezados. `Assets` cuenta relaciones lógicas; deduplicación física no reduce el numerador.

| Domain | Historical sheet(s) | Rows imported | Assets linked | Repository | Frontend consumes | Claude structure/interactions | Requests / legacy boundary | Cutover |
|---|---|---:|---:|---|---|---|---|---|
| Suti Farma | `8 Suti Farma` | 50/50 | 1/1 | YES | YES | hero, Por qué te conviene, Disponibles ahora, cards, detail, CTA | Supabase request RPC; no cálculo financiero | **COMPLETE** |
| Suti Tours | `7 Suti Tours`; solicitudes separadas | 17/17 | 24/24 | YES | YES | estructura completa; CTA transaccional pending | solicitudes/financiamiento legacy | **LEGACY** |
| Suti Auto | `1 Vehículos SutiAuto`; solicitudes/amortización separadas | 3/3 | 27/27 | YES | YES | catálogo/detalle completo | tasas/plazos/solicitudes legacy | **LEGACY** |
| Renta Car | `2 Vehículos en renta`; solicitudes separadas | 1/1 | 6/6 | YES | YES | catálogo/detalle completo | solicitud legacy | **LEGACY** |
| Suti Casa | `Suti Casa`; dos flujos de solicitud separados | 35/35 | 180/180 | YES | YES | catálogo/detalle completo | solicitudes legacy | **LEGACY** |
| Paneles Solares | filas categoría `Paneles Solares`; solicitudes separadas | 4/4 | 4/4 | YES | YES | catálogo/detalle completo | crédito/solicitudes legacy | **LEGACY** |
| Aires Acondicionados | filas categoría en `Paneles Solares` | 16/16 | 16/16 | YES | YES | catálogo/detalle completo | plazos/enganche legacy | **LEGACY** |
| Puertas de Seguridad | filas categoría en `Paneles Solares` | 3/3 | 3/3 | YES | YES | catálogo/detalle completo | plazos/solicitud legacy | **LEGACY** |
| Equipos de Cómputo | fila categoría en `Paneles Solares` | 1/1 | 1/1 | YES | YES | catálogo/detalle completo | plazos/solicitud legacy | **LEGACY** |
| Donativos | `10 Donativos`; solicitudes separadas | 1/1 | 1/1 | YES | YES | tarjeta añadida por instrucción; detalle completo | writer histórico no demostrado | **LEGACY** |
| Suti Terrenos | `6 Suti Terrenos`; solicitudes/Lotes separados | 3/3 | 6/6 | YES | NO: ruta dedicada no corresponde al schema histórico | pantalla dedicada preservada sin rediseño | cálculo/solicitud legacy | **UI_NOT_CONNECTED / UNRESOLVED** |
| Membresías | `Membresias`; solicitudes separadas | 6/6 | 6/6 | YES | YES | Phase 4 preservada | solicitudes/nómina legacy | **COMPLETE (catalog)** |
| Suti Market | `Categorías SutiMarket`; `Productos Balam` sin filas | 0/0 productos | 0/0 | NO | explicit empty | estructura preservada | identidad Balam↔Market no demostrada | **UNRESOLVED** |
| Suti Rifas | `Rifa`, compradores, Choice | 0/500 tickets | 0/N/A | NO | explicit pending | estructura preservada | compra, disponibilidad y concurrencia legacy | **LEGACY** |
| Suti Cirugías | sin hoja inequívoca | 0/0 | 0/0 | NO | explicit empty | estructura preservada | autoridad/writer desconocidos | **UNRESOLVED** |
| Ahorro | 9 hojas legacy | 0/N/A | N/A | FinancialLegacyRepository | endpoint pendiente de configuración | estructura preservada | Google/App Script autoridad | **LEGACY** |
| Préstamos | historiales, fondos, amortizaciones, queries | 0/N/A | N/A | FinancialLegacyRepository | endpoint pendiente de configuración | estructura preservada | Google/App Script autoridad | **LEGACY** |
| Adelanto / Caja chica / Portafolio | hojas/configs legacy según DATA_MAPPING | 0/N/A | N/A | FinancialLegacyRepository | pending | estructura preservada | reglas financieras legacy | **LEGACY / UNRESOLVED** |

## Reconciliación técnica

- Filas nuevas esperadas/migradas: `134/134`.
- Referencias de archivo esperadas/vinculadas: `268/268`.
- Objetos físicos descargados o duplicados por esta H: `0`.
- Farma: `50/50` productos; `1/1` asset. Filas vacías de la grilla no se inventaron como productos.
- `Suti Casa!AE8` es URL de video externa: se conserva en `source_payload`, no cuenta como archivo Storage.
- `source_payload` conserva todos los campos históricos y no tiene grant al navegador.
- Precio runtime es exclusivamente precio de contado/lista histórico: `65/65` filas con ese campo fueron tipadas y reconciliadas; tasa, crédito, plazo, enganche, pago y amortización no se proyectan.
- Assets clasificados conservadoramente como privados se reutilizan mediante policy RLS limitada a productos habilitados y URL firmada para el afiliado autenticado.
- `window.DATA.finanzasGroups` y el antiguo `listingsFor()` no alimentan el catálogo; fallo Supabase muestra error/reintento sin fallback.

## Resumen solicitado

```text
DATA COVERAGE & UI CUTOVER

Domains inspected: 37 dominios de H-DATA-001; 20 superficies/programas Finanzas reconciliados en detalle

COMPLETE: Suti Farma; Membresías (catálogo)
DATA_NOT_MIGRATED: ninguno entre los 134 registros autorizados
ASSETS_NOT_LINKED: 0 entre 268 referencias de archivo autorizadas
REPOSITORY_MISSING: Suti Market, Rifas, Cirugías y dominios legacy sin catálogo Supabase autorizado
UI_NOT_CONNECTED: Suti Terrenos (pantalla dedicada no equivalente)
UI_REGRESSION: corregida — navegación financiera y “Disponibles ahora” restaurados
LEGACY: Tours, Auto, Renta, Casa, Solar, Aires, Puertas, Cómputo, Donativos, Rifas, Ahorro, Préstamos, Adelanto/Caja/Portafolio en su frontera transaccional o financiera
UNRESOLVED: Suti Market/Balam, Cirugías, equivalencia de Terrenos dedicado y Caja chica sin hoja inequívoca

Source rows expected: 134 (bloque catalogal autorizado)
Source rows migrated: 134
Assets expected: 268
Assets linked: 268
Claude screens expected: 20 superficies/programas Finanzas
Claude screens connected: 11 a autoridad catalogal Supabase, incluidas Membresías y 10 rutas de esta H
Claude structural parity: 20/20 conservadas con estados explícitos cuando falta backend
Runtime DATA dependencies: 0 en el camino program-catalog
Runtime Glide dependencies: 0
Domains fully production-ready: 1 nuevo (Suti Farma); Membresías ya estaba completa
```

## Evidencia

- `node scripts/test-program-catalog-cutover.js`: `PASS`.
- `python scripts/test-program-catalog-live.py`: `PASS`; 134 items, 268 joins, firma Storage individual y por lote real, anon 401, escritura directa 403, payload interno 403, solicitudes/favoritos cross-user 0 y request legacy 400.
- Importación live: `134` items, `268` assets linked y `65/65` precios catalogales tipados, `PASS`.
- Chrome y Edge headless: `BLOCKED` por timeout del puerto CDP antes de navegar; la suite Phase 4 de control falla igual en `connect`, por lo que no se atribuye al frontend. Evidencia visual nueva no disponible en este entorno.

## CLAUDE UI PRESERVATION REVIEW

```text
CLAUDE UI PRESERVATION REVIEW

Screen: Finanzas → programas; Suti Farma; detalle de producto
Original sections: resumen, búsqueda/filtro, grupos, hero, información, acciones rápidas, Por qué te conviene, Disponibles ahora, cards, detalle, CTA sticky
Current sections: mismas secciones; Donativos añadido por instrucción explícita; loading/error/empty visibles
Missing sections: NONE
Added sections: NONE; solo estados explícitos dentro de Disponibles ahora
Interactions preserved: navegación, búsqueda/filtro, cards, detalle, favorito y CTA Farma; acciones legacy quedan pending/disabled
Navigation preserved: YES
Visual structure preserved: YES por inspección estática; browser real BLOCKED antes de navegar
Unauthorized redesign: NO

Verdict:
PASS
```

## H-DATA-CUTOVER-001 RESULT

```text
Status: PASS con limitación visual ambiental documentada
Files changed: migration/recovery 00100–00102; snapshot/import/tests; ProgramCatalogRepository/store; pantallas catálogo; bundle/PWA; gobierno y reporte
Source-of-truth verdict: PASS para 134 filas autorizadas; LEGACY/UNRESOLVED explícito fuera del bloque
Invariant verdict: PASS — INV-001–INV-062 aplicables
Build: PASS — bundle de 67 fuentes, v78, PWA v23
Tests: PASS — estático, regresión Phases 3–7, live RLS, join Repository y firma Storage; browser BLOCKED en connect por entorno
Security: PASS — RLS forced, anon denied, payload interno denied, cross-user denied, actor/contexto backend, fixtures 0
Legacy impact: PASS — Google read-only; cero cambios a fórmulas, triggers, solicitudes o cálculos
Unexpected files changed: ninguno detectado; metadata Git no disponible
Known limitations: browser CDP no abre; Terrenos dedicado UI_NOT_CONNECTED; Market/Balam y Cirugías UNRESOLVED; requests no Farma permanecen legacy
Evidence: este informe, comandos y suites versionadas
```
