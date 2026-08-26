# ADMIN DECISIONS CUTOVER

## Resultado ejecutivo

El propietario aprobó en bloque las cuatro recomendaciones agrupadas. Los diez módulos que dependían de esas decisiones quedaron operativos; ninguno conserva `OWNER_DECISION_REQUIRED` ni “EN PREPARACIÓN”. Fondos y reglas permanece aislado por Phase 7 y no formó parte del cutover.

| Módulo | Autoridad productiva | Clasificación |
|---|---|---|
| Tu Sindicato | Supabase `union_screen_content` + `union_content_blocks`; cuatro pantallas inicialmente vacías | `PRODUCTIVE_SUPABASE` |
| Catálogo de Finanzas | estructura Claude en código + presentación no financiera Supabase; datos monetarios Google read-only | `PRODUCTIVE_HYBRID` |
| Etapas y seguimiento | Supabase `operational_workflows`, etapas y tracking; resultados financieros Google | `PRODUCTIVE_HYBRID` |
| Convenios y beneficios | `companies`, perfiles/beneficios/segmentación/banners Supabase | `PRODUCTIVE_SUPABASE` |
| Catálogos de segmentación | Supabase, 20 valores exactos del snapshot Google aprobado como procedencia | `PRODUCTIVE_SUPABASE` |
| Roles y permisos | Supabase Auth → asignación → rol → permisos → RLS/RPC | `PRODUCTIVE_SUPABASE` |
| Acceso a pantallas | políticas y evaluación backend Supabase | `PRODUCTIVE_SUPABASE` |
| Secciones y componentes | estructura Claude en código; visibilidad dinámica Supabase | `PRODUCTIVE_HYBRID` |
| Menús y botones | estructura/rutas Claude en código; acceso dinámico Supabase | `PRODUCTIVE_HYBRID` |
| Formularios | contrato/campos/validaciones en código; envíos por repositorio de dominio | `PRODUCTIVE_HYBRID` |

## Autoridad y seguridad

- H005_TEST conserva la única asignación principal. H005_TEST2 y H005_TEST3 siguen sin asignación administrativa.
- Roles de sistema son inmutables; no existe autoasignación; el último principal no puede retirarse; los cambios usan RPC auditadas.
- Sindicatos, categorías laborales, género y tags son segmentación de negocio y nunca conceden permisos técnicos.
- Las tablas nuevas tienen RLS habilitada y forzada. Lectura y escritura se separan por permisos explícitos.
- Las estructuras de navegación, menús, formularios y componentes siguen versionadas en código. El writer local fue neutralizado; no se creó un CMS genérico.
- `localStorage`, `DATA` y mocks no son autoridad productiva para los diez módulos.

## Frontera legacy

No se modificaron Ahorro, Préstamos, Apps Script, tasas, saldos, depósitos, elegibilidad, amortizaciones, pagos, cálculos o conciliaciones. Catálogo financiero y workflows administran únicamente presentación, etapas no financieras y tracking. Cualquier resultado financiero permanece detrás de Phase 7.

## Evidencia

- Migraciones `20260822000400`, `20260822000410` y hardening `20260822000411`: aplicadas y verificadas remotamente.
- Verificación remota: 20 segmentos exactos; un rol principal; una asignación principal; TEST2/3 sin asignación; RLS forzada; RPC de roles; empresas deshabilitadas y pantallas sindicales no publicadas ocultas: `PASS`.
- Prueba reversible: CRUD de segmentos, roles y perfiles de Convenios; escritores normales denegados; limpieza completa: `PASS`.
- Bundle v86 / PWA v31, 76 fuentes, sintaxis: `PASS`.
- Suites Admin/H-007/H-008/H-009/Phase 7: `PASS`.
- Chrome H005_TEST: login, Admin, escritura/restauración, recarga, Convenios y UI Claude: `PASS`.

## ADMIN DECISIONS CUTOVER RESULT

```text
Status: PASS
Modules unlocked: Tu Sindicato; Catálogo de Finanzas; Etapas y seguimiento; Convenios y beneficios; Catálogos de segmentación; Roles y permisos; Acceso a pantallas; Secciones y componentes; Menús y botones; Formularios
Modules still OWNER_DECISION_REQUIRED: 0
Source-of-truth verdict: PASS
Invariant verdict: PASS
Build: PASS — 76 sources
Tests: PASS — static, live RLS and Chrome
Security: PASS — forced RLS, audited RPC, no self-escalation, normal users denied
Legacy impact: NO
Unexpected files changed: 0 detected
Known limitations: Fondos y reglas remains BLOCKED_FINANCIAL_LEGACY under Phase 7
```
