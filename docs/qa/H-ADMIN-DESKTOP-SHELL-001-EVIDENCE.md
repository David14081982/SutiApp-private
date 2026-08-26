# H-ADMIN-DESKTOP-SHELL-001 — Evidencia de implementación

Fecha: 2026-08-26

## Alcance realizado

- Se tomó `Panel administrativo.dc.html` únicamente como contrato visual/UX.
- Se preservó el Admin móvil existente por debajo de `1024px`.
- Se creó `AdminDesktopShell` para `>=1024px` con sidebar oscuro, header, workspace fluido, panel contextual opcional y foundations reutilizables de drawer/modal.
- El sidebar se deriva del catálogo Admin actual y de `AdminRepository -> get_admin_access_context -> permissions/sectionActions`; no crea rutas, pantallas ni autoridades paralelas.
- Mobile y desktop comparten el mismo estado `view`, componentes, repositories y contratos backend. Sólo se monta el módulo activo.
- No se rediseñó ningún workbench, tabla o módulo interno.

## Autoridad y seguridad

| Control | Resultado |
|---|---|
| Autoridad Admin | Sin cambio: Supabase Auth, permisos técnicos, section ownership y RLS existentes |
| Lectores | `AdminRepository` y módulos existentes |
| Escritores nuevos | 0 |
| Cachés/fallbacks nuevos | 0 |
| Datos demo copiados | 0 |
| Schema/migrations | 0 |
| Auth/RLS/Storage/Edge | Sin cambios |
| Google/Apps Script/finanzas | `NO INTERACTION` |
| Seguridad sólo UI | No: el shell sólo proyecta el acceso backend ya resuelto |

## Matriz responsive Playwright

| Viewport | Shell desktop | Sidebar/header/workspace | Bottom nav | Root |
|---|---:|---:|---:|---|
| 430×932 | No | No | Visible | 430×932 |
| 768×900 | No | No | Visible | marco móvil existente de 430px |
| 1024×768 | Sí | Sí | Oculta | 1024×768 |
| 1280×900 | Sí | Sí | Oculta | 1280×900 |
| 1440×1000 | Sí | Sí | Oculta | 1440×1000 |

El breakpoint explícito es `1024px`. En desktop, el atributo `data-admin-desktop` elimina únicamente para Admin la restricción global de teléfono; el resto de SutiApp conserva su comportamiento vigente.

## Navegación y permisos

- Se proyectaron 28 módulos reales para el principal Admin autorizado.
- Playwright abrió y regresó al panel desde 12 módulos: Identidad y expediente, Datos y respaldos, Pop-ups, Tu Sindicato, Solicitudes, Finanzas, Fondos, Catálogo de Finanzas, Etapas, Marketplace, Aprobaciones y Planes.
- En móvil se recorrieron Marketplace, Documentos y PDF, Fondos y Datos y respaldos.
- Una proyección con sólo `news.read` mostró exclusivamente Noticias.
- Una proyección de responsabilidad de sección `news` mostró exclusivamente Noticias.
- Una opción sin acceso no se renderiza en el sidebar desktop.

## Accesibilidad de infraestructura

- Grupos del sidebar: `aria-expanded`, `aria-controls` y navegación nativa por botón.
- Opción activa: `aria-current="page"`.
- Acciones sólo icono: `aria-label`.
- Drawer y modal: `role="dialog"`, `aria-modal`, nombre/descripción accesibles, backdrop, foco inicial seguro, trap de foco, `Escape`, cancelación y restauración del foco.
- Modal destructivo: acción danger explícita sin recibir foco inicial.

## Verificación ejecutada

Build:

```text
node scripts/build-bundle.js C:\tmp\babel-standalone-7.29.0.min.js
Built app\bundle.js from 90 files.
```

Regresión estática:

```text
test-admin-productization.js PASS
test-admin-content-consistency.js PASS
test-h009.js PASS
test-master-phase1.js PASS
test-phase6.js PASS
test-admin-remaining.js PASS
test-section-ownership-mass.js PASS
test-union-canonical-cutover.js PASS
test-data-exports.js PASS
screens-admin.jsx syntax PASS
bundle.js syntax PASS
test-static-suite.js PASS — 44/44
test-architecture-registry.py PASS — freshness/stale/lookup/incremental/secrets/determinism
audit.ps1 -Check all PASS — findings classified / REVIEW REQUIRED
```

Playwright:

```text
Status: PASS
Viewports: 430 / 768 / 1024 / 1280 / 1440 PASS
Desktop modules navigated: 12
Mobile critical modules: 4
Drawer/modal accessibility: PASS
Permission projection: PASS
Productive writes: 0
Exceptions: 0
```

Evidencia:

- [`playwright-result.json`](evidence/admin-desktop-shell-20260826/playwright-result.json)
- [`admin-430x932.png`](evidence/admin-desktop-shell-20260826/admin-430x932.png)
- [`admin-1024x768.png`](evidence/admin-desktop-shell-20260826/admin-1024x768.png)
- [`admin-1440x1000.png`](evidence/admin-desktop-shell-20260826/admin-1440x1000.png)

## Limitaciones conocidas

- El panel contextual, drawer y modal quedan como infraestructura reusable; ningún módulo se migró a ellos en esta H.
- Las superficies internas de cada módulo conservan su layout vigente. Sus rediseños desktop son H independientes.
- `768px` conserva deliberadamente el contrato móvil/tablet actual.

```text
H-ADMIN-DESKTOP-SHELL-001 RESULT
Status: PASS
Files changed: app shell/Admin source, executable bundle/PWA cache, five compatible static assertions, browser harness, evidence, changelog and derived Architecture Registry
Source-of-truth verdict: PASS — same AdminRepository/backend authorities; 0 duplicates, caches or fallbacks
Invariant verdict: PASS — INV-002/003/012/013/015/036/041 preserved
Build: PASS — bundle reproducible from 90 source files
Tests: PASS — canonical static suite 44/44, Registry suite, source/bundle syntax and Playwright responsive/navigation/accessibility matrix
Security: PASS — permission-aware UI projection; backend/RLS remains authoritative; no secret or productive write
Legacy impact: NOT APPLICABLE / NO INTERACTION
Unexpected files changed: 0 produced by this H; pre-existing untracked Admin audit artifacts preserved without modification
Known limitations: module-level desktop workbenches remain separate future work
Evidence: docs/qa/H-ADMIN-DESKTOP-SHELL-001-EVIDENCE.md and docs/qa/evidence/admin-desktop-shell-20260826/
```
