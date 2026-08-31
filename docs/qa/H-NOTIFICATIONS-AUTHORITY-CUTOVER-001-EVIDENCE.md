# H-NOTIFICATIONS-AUTHORITY-CUTOVER-001 — Evidencia

## Resultado

`PASS`. Notificaciones y badge consumen exclusivamente cotizaciones reales de `program_requests`; `DATA.notifs` fue retirado y no se creó tabla de notificaciones.

## AUDIT → AUTHORITY → RISK

- `main` inicial: `95ad5c1d5aa5e2cc045d30379dfa68d384366fab`; `origin/main` igual; Registry `FRESH`.
- Hallazgo: 5 avisos sintéticos en `DATA.notifs`; badge = 3 mocks no leídos + `quoteStore`; proyección vigente forzaba `visto:false`; `markQuoteSeen()` devolvía `true` sin RPC.
- Autoridad vigente: `program_requests` para solicitudes/cotizaciones posteriores a ADR-038. `marketplace_quote_requests` conserva sólo histórico previo.
- Hardening respetado: `SELECT` directo de `program_requests` continúa revocado. La lectura usa RPC self-only allowlisted y la escritura deriva afiliado efectivo.
- Fallo controlado: carga, error con reintento y vacío son estados visibles; ninguno se cuenta ni se presenta como aviso.
- Recovery: migración y recovery compilaron juntos con rollback. El rollback de `seen_at` aborta si existen acuses sin backup.
- Legacy: `NO INTERACTION`; Google/Apps Script/Ahorro/Préstamo/cálculos tuvieron 0 lecturas, 0 escrituras y 0 cambios.

## Inventario de fuentes reales

| Fuente | Hecho real disponible | Visto durable | Aviso activo |
|---|---|---:|---:|
| `program_requests` / cotización `submitted` | solicitud recibida | no requerido; informativo | sí, leído |
| `program_requests` / cotización `approved` + `responded_at` | respuesta de cotización | `seen_at` | sí, no leído hasta acuse |
| `operational_request_tracking` + workflow snapshot | etapa/fechas reales | no | no |
| `request_documents` / `affiliate_documents` | envío y revisión documental | no | no |
| `program_requests` de membresía | solicitud/estado real | no | no |
| `program_requests` generales/beneficios/préstamo | solicitud/estado real | no | no |
| `program_request_admin_events` | decisiones administrativas reales | no | no |
| `marketplace_quote_requests` | histórico pre-corte | `seen_at` histórico | no lo consume el frontend actual |

No se simula ningún tipo sin autoridad de evento y visto durable.

## Evidencia ejecutada

```text
node scripts/build-bundle.js C:\tmp\sutiapp-babel-7.29.0.min.js
Built app\bundle.js from 92 files.

node scripts/test-notifications-authority-cutover.js
PASS — syntheticNotifications=0; mockUnreadBadgeSources=0; newNotificationTables=0

node scripts/apply-notifications-authority-cutover.js
PASS — DRY_RUN_FORWARD_RECOVERY / DRY_RUN_PROJECTION_RECOVERY; rowsChanged=0

node scripts/apply-notifications-authority-cutover.js --apply
PASS — request_count 6→6; quote_count 6→6; rowsChanged=0

node scripts/test-notifications-authority-cutover-live.js
PASS — quote request > response > seen; persistence; idempotence;
cross-user DENIED; anonymous DENIED; RLS forced; fixture cleanup PASS

node scripts/test-notifications-authority-cutover-browser.js
PASS — Chrome real; badge 1→0; seen persiste tras refresh;
mobile 390×844; desktop 1280×900; 0 browser exceptions; 0 screenshots persisted
```

Bundle SHA-256: `DA8AAEAAAC619F5B1C90E45D804DC54D18D15939EEED8CF8E63A23A947308133`.

## Guardians

- Source of truth: `SAFE` — una autoridad vigente; histórico separado; cero fallback.
- Database migration: `PASS` — aditiva, nullable, indexada, sin DML, recovery cerrado ante historia.
- Supabase security: `PASS` — self derivado, proyección mínima, RLS forzada, direct select cerrado, anon/cross-user denegados.
- Legacy Google: `READ ONLY / NO INTERACTION`.
- Claude UI preservation: `PASS` — estructura e interacciones preservadas; adaptación sólo de datos y atributos no visuales.

## Cierre

```text
H-NOTIFICATIONS-AUTHORITY-CUTOVER-001 RESULT
Status: PASS
Files changed: frontend/repositories; bundle/cache; SQL/recovery; apply/tests; ADR/SOT/mapping/evidence; Registry
Source-of-truth verdict: PASS — program_requests único para cotizaciones vigentes; histórico aislado; DATA.notifs eliminado
Invariant verdict: PASS — cero avisos inventados; acuse durable; request/workflow/documentos/legacy preservados
Build: PASS — 92 fuentes; bundle SHA-256 documentado
Tests: PASS — static; migration/recovery; live; Chrome mobile/desktop
Security: PASS — self-only; direct select revocado; cross-user/anonymous denied; sin secretos
Legacy impact: NO INTERACTION / Google read 0 / write 0 / Apps Script change 0
Unexpected files changed: 0
Known limitations: sólo cotizaciones tienen hoy contrato durable de evento/visto; los demás dominios no emiten avisos
Evidence: este documento
```
