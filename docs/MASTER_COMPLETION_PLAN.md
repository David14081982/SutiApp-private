# MASTER COMPLETION PLAN

| Fase | Capacidad | Estado | Dependencia | Bloqueo | Evidencia | Decisión requerida |
|---|---|---|---|---|---|---|
| 0 | Gobierno, autoridades y baseline | DONE | H-001–H-009 | — | `DECISIONS.md`, `INVARIANTS.md`, `SOURCE_OF_TRUTH.md` | — |
| 1 | Login y vínculo Auth existentes | DONE | H-005 | — | 3 cuentas de prueba reconciliadas | — |
| 1 | Permisos técnicos administrativos | DONE | H-008 | — | RLS: H005_TEST admin; TEST2/TEST3 denied | — |
| 1 | Activación gradual de afiliados | DONE | Auth elegible + email histórico único | — | `claim_affiliate_identity`; verificación email; suite live | — |
| 1 | Recuperación de acceso | DONE | Supabase Auth | — | reset nativo + `PASSWORD_RECOVERY`; suite UI | — |
| 1 | Impersonación administrativa segura | DONE | `affiliates.impersonate` | — | TTL 30 min, motivo, no anidada, actor/contexto | — |
| 1 | Multiusuario y regresión Auth/RLS | DONE | Capacidades Phase 1 | — | 3 cuentas; normal denied; browser/Auth/RLS PASS | — |
| 2 | Assets, branding, instalación y PWA | DONE | H-007.2–H-009 | Phase 1 DONE | Storage/app_settings, CRUD, sync PWA, browser PASS | — |
| 2 | Banners, popups, empresas y documentos administrables | DONE | H-009 | Phase 1 DONE | Supabase/RLS/audit; históricos preservados | — |
| 2 | Contenido institucional público | DONE | H-007/H-009 | — | 60/60 + assets; sin fallback | — |
| 2 | Noticias y artículos | DONE | ADR-029 | — | Supabase vacío + CRUD/RLS/Storage; browser PASS | — |
| 2 | Educación y tutoriales | DONE | H-DATA-001 + ADR-029 | — | 32/32 despublicados; 12 assets-source / 11 objetos verificados | — |
| 2 | Copy administrable y estructura Claude | DONE | ADR-029 / INV-041 | — | overrides Supabase; menús/rutas/formularios en código | — |
| 3 | Comercio, empresas y convenios | DONE | H-007.3 + ADR-030 | — | catálogo/solicitudes/membresías Supabase; RLS multiempresa y navegador PASS | — |
| 4 | Programas y membresías | DONE | ADR-031 | — | 6/6 membresías + Storage/RLS/Admin/Chrome; programas descompuestos por autoridad | — |
| 5 | Operación y solicitudes no financieras | DONE | Phase 3/4 | — | Historial/Tracking Supabase, RLS y Chrome con fixture reversible | — |
| 6 | Portal de empresas | DONE | Phase 5 | — | Supabase vacío, RLS multiusuario y Chrome real PASS | — |
| 7 | Ahorro, Préstamos y legacy financiero | IN_PROGRESS — OPTION A | Auditoría y equivalencia legacy | Configurar endpoint/secretos Apps Script y validar casos reales | `docs/PHASE7_FINANCIAL_LEGACY_AUDIT.md`, ADR-036 | — |
| 8 | QA integral, despliegue y cierre | PARTIAL | Fases 1–7 | — | suites acumuladas | — |
| T | MASTER ASSET EVACUATION — Glide → Supabase | OPERATIONALLY COMPLETE | Fuentes históricas aprobadas + Storage/RLS | `HISTORICAL_ASSET_RECOVERY_PENDING=3` no bloqueante | `docs/MASTER_ASSET_EVACUATION.md` | Recuperar `Íconos!B2:B4` si aparecen; no inventar sustitutos |
| D | DATA COVERAGE & UI CUTOVER | PARTIAL — CATALOG BLOCK PASS | H-DATA-001 + ADR-037 | legacy y dominios UNRESOLVED por fila | `docs/DATA_COVERAGE_UI_CUTOVER_REPORT.md` | — |
| A | ADMIN FULL PRODUCTIZATION | DONE | H-008/H-009 + Phases 1–6 + ADR-038 | — | `docs/ADMIN_FULL_PRODUCTIZATION_REPORT.md`; 12 módulos productivos + 13 estados explícitos | — |
| A2 | ADMIN REMAINING MODULES | OWNER_DECISION_REQUIRED | ADR-040 + autoridades por dominio | 10 decisiones reales de autoridad/arquitectura | `docs/ADMIN_REMAINING_MODULES_REPORT.md`; 1 Supabase + 1 híbrido + 1 legacy bloqueado; 0 “EN PREPARACIÓN” | Cinco decisiones agrupadas en el reporte |

## ADMIN FULL PRODUCTIZATION — 2026-08-22

El panel conserva las 25 tarjetas Claude. Las doce herramientas con autoridad Supabase y permisos backend son operativas; las trece que dependen de dominios unresolved o legacy permanecen visibles como `EN PREPARACIÓN` y no abren writers locales. Planes valida `company_portal.write` y espera cada escritura antes de confirmar. El copy técnico fue retirado de las rutas habilitadas. Bundle `v84`, PWA `v29`, 22 suites estáticas y navegador real: `PASS`. Phase 7 continúa pausada en su punto de reanudación y Google financiero tuvo `NO INTERACTION`.

## ADMIN REMAINING MODULES — 2026-08-22

Los 13 estados genéricos fueron eliminados. Aprobación de Pop-ups quedó `PRODUCTIVE_SUPABASE` mediante tabla/RLS/RPC tenant; Finanzas · Solicitudes quedó `PRODUCTIVE_HYBRID` sobre `program_requests` con depósito financiero bloqueado; Fondos quedó `BLOCKED_FINANCIAL_LEGACY`. Diez módulos quedaron `OWNER_DECISION_REQUIRED` por conflictos reales de autoridad, seguridad o INV-041, no por trabajo técnico pendiente. Bundle `v85`, PWA `v30`, migración live y navegador profundo: `PASS`; Google financiero no fue modificado.

## DATA COVERAGE & UI CUTOVER — 2026-08-22

Se reconciliaron los 37 dominios de H-DATA-001 y 20 superficies de Finanzas. El bloque autorizado importó `134/134` filas catalogales y vinculó `268/268` assets ya evacuados sin copiar objetos. Suti Farma queda `50/50`, con `1/1` asset, Repository, pantalla Claude, detalle y solicitud Supabase; navegación financiera y `Disponibles ahora` fueron restaurados sin `DATA` ni listings mock. Las solicitudes/cálculos existentes continúan separados en Google legacy; Suti Market/Balam, Rifas, Cirugías y la pantalla dedicada Terrenos conservan estado explícito `LEGACY/UNRESOLVED/UI_NOT_CONNECTED` en vez de inventar autoridad.

## Tarea transversal — MASTER ASSET EVACUATION

Antes de cancelar Glide, toda columna histórica con archivos identificables debe conservar semántica, archivo físico validado, procedencia y relación Supabase. `source_url` es exclusivamente provenance; runtime usa `asset_id` o `storage_bucket + storage_path`. Los documentos privados se almacenan en buckets privados con RLS y nunca tienen URL pública permanente. El objetivo de cierre es `RUNTIME_GLIDE_FILE_DEPENDENCIES = 0` y `UNMAPPED_FILE_COLUMNS = 0`.

## MASTER Phase 3 — 2026-08-21

**Decisión:** Supabase es autoridad comercial productiva y Claude Design permanece contrato funcional/visual. Solo se descompuso el catálogo SutiCompras semánticamente claro; los demás catálogos H-007.1 y todo legacy financiero permanecen aislados.

**Implementación:** nueve tablas comerciales con RLS forzada, RPCs exclusivas de creación/respuesta/visto, membresía empresarial tenant, categorías históricas y assets Storage; repositorios y stores en memoria conectan Marketplace, Convenios, Admin y Panel Empresarial sin `DATA`, mock o browser storage productivo. Productos, solicitudes y membresías iniciaron vacíos. La revisión cerró un bypass de mutación directa mediante `20260821000902` y exige firma/términos en backend.

**Validación:** bundle de 69 fuentes, `v73`, PWA `v18`; pruebas estáticas y live multiusuario/RLS reversibles `PASS`; Chrome real confirmó Marketplace, Admin y Panel Empresarial. Reconciliación final: 3 categorías, 0 productos, 0 solicitudes/cotizaciones/membresías y cero fixtures.

**Legacy/seguridad:** Ahorro, Préstamos, Apps Script, fondos, amortizaciones y cálculos tuvieron `NO INTERACTION`. No hay escrituras anónimas, autoasignación empresarial ni secretos en navegador.

## MASTER Phase 6 — 2026-08-22

**Decisión:** Supabase es la autoridad de planes y suscripciones del Portal Empresarial. Ambas tablas inician vacías y una empresa sin términos comerciales autorizados conserva estado `pending`; no se infieren precios, beneficios, contratos o membresías.

**Implementación:** dos tablas con RLS forzada, permisos Admin explícitos, lectura tenant, auditoría, recovery completo, Repository/store sin fallback y módulo Claude de Planes conectado. Se corrigió la recarga del store al entrar al módulo Admin para proyectar las 33 empresas después de resolver permisos.

**Validación:** preflight remoto estricto, reconciliación 0/0/0, tres sesiones multiusuario, Chrome real y regresión estática acumulada `PASS`. Conteos protegidos: 947 afiliados, 3 Auth y 33 empresas.

**Legacy/seguridad:** Ahorro, Préstamos, Google Sheets, Apps Script, fórmulas, amortizaciones, saldos y conciliaciones tuvieron `NO INTERACTION`. No se persistieron fixtures ni registros inventados.
