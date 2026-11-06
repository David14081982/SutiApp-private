# H-FINANCIAL-MOSTRAR-OVERRIDE-001

> Estado vigente 2026-11-06: backend PASS (SQL + Edge v68, tres reglas disponibles).
> Frontend enviado en 3841619; GitHub Pages falló en despliegue tras build/contratos PASS.
> Las secciones de preflight HTTP401 se conservan como evidencia histórica resuelta.

## PRE-CHANGE AUDIT

Owner request 2026-11-06 explicitly authorizes MOSTRAR overriding automatic date
unavailability for selected criteria, while preserving eligibility and existing
functionality. This supersedes only the MOSTRAR prohibition in the October 5
cutoff decision. AUTO and OCULTAR retain existing behavior.

Scope: financial-legacy/visibility-policy.js; screens-admin-fondos.jsx; new
20261106000100_financial_mostrar_override.sql migration/recovery; existing
visibility/cutoff tests; new scripts/test-financial-mostrar-override.js and
scripts/test-financial-mostrar-override-browser.js; generated app/bundle.js;
DECISIONS, INVARIANTS, SOURCE_OF_TRUTH, MIGRATION_RULES, AGENT_CHANGELOG; this audit;
docs/qa/evidence/financial-mostrar-override/ and .tmp/financial-mostrar-override/.
No changes to business rows, financial math, shared frontend repositories,
authentication, assets, routing, SW logic, Google, or unrelated dirty work.

Authority: existing Supabase financial_programs/funds/rules; visibility_mode is
still written through audited set_financial_rule_visibility with permissions,
mandatory reason and snapshot invalidation. No new source, writer or fallback.
Readers: Admin catalog, financial overview/session/quote/confirmation.
MOSTRAR never overrides profile, savings eligibility, enabled/publication state,
valid financial terms or existing calculation validation.

Navigator: stale only for unrelated affiliate document evidence and changelog;
directed inspection confirms focal path. No structural Registry changes planned.
UI: preserve tabs, matrix, filters, sorting, comparison, detail, existing editors,
mobile cards, navigation and errors. Add desktop access to VisibilityEditor.
Risk: list/quote disagreement and stale snapshots; test actual Edge and SQL,
wrong profiles, permissions, invalidation, recovery and unchanged quotes/history.
Migration: patch existing guard only, preserve OID/owner/ACL/signature/engine,
reject drift, isolated forward and exact inverse recovery before release.
Legacy: no Google access/writes. Financial policy exception explicitly authorized.
Build and focal browser tests required. Global image regression NOT APPLICABLE:
no shared app helper/assets/auth/routing/SW logic change; bundle generated only.
Production activation/verification reported separately; previous management
read returned HTTP401. No production test fixtures or pretend deployment PASS.

Status: PASS for local implementation, release not yet verified.

Scope extension: scripts/test-admin-program-criteria-matrix.js must now expect
the authorized desktop visibility editor instead of asserting mobile-only.
No additional production surface is changed.

Scope extension: scripts/test-financial-supabase-cutover.js contains the same
obsolete mobile-only visibility assertion; update it to the authorized shared
desktop/mobile editor and preserve the remaining cutover assertions.

Build scope extension: scripts/build-financial-mostrar-override.js reproduces
only screens-admin-fondos.jsx inside the existing bundle. Full builder dry-run
found pre-existing source/bundle differences in nine other modules and one added
module. Those are not part of this H and must remain byte-identical. No cache or
service worker change before a separately verified publication.

## IMPLEMENT / VERIFY / EVIDENCE

Implemented a single policy exception: MOSTRAR precedes the automatic calendar
cutoff in Edge; SQL exempts only the same explicit authoritative mode from its
existing cutoff guard. SQL does not turn an already UNAVAILABLE snapshot into
AVAILABLE, skip eligibility or change the mathematical engine. Existing native
visibility writer preserves permission, identity, mandatory reason, audit and
snapshot invalidation. No API, table, column, grant or business writer added.

Desktop has Administrar visibilidad in the selected criterion detail; it opens
the same editor as mobile and only with financial_criteria.visibility.write.
Financial rule edit/publish permissions remain separate. All tabs, matrix,
filters, comparison and financial fields are preserved. The editor explains the
exception and the return to AUTO. No criteria were selected or changed in live.

The current workspace already had many unrelated edits. Captured focal baseline
bytes/hashes under .tmp/financial-mostrar-override/before. Full build dry-run
revealed nine unrelated differing modules and an additional module; the focal
builder updates only screens-admin-fondos.jsx. All other 165 existing bundle
modules remain byte-identical. No service worker or cachebuster was changed;
those release-only artifacts must be managed when publishing a clean candidate.

Commands and results:

- node scripts/test-loan-dated-fund-cutoff.js: PASS, 170 checks. Actual quote
  engine, date boundaries including 2026-11-30/2026-10-30, AUTO/MOSTRAR/OCULTAR,
  missing/invalid modes, wrong union/category, owned/anonymous/cross-actor
  snapshot access, invalidated snapshots, unchanged permitted calculations and
  historical captured contract, exact recovery, unrelated definition drift and
  CRLF. Isolated PGlite only; no remote DDL or business writes.
- node scripts/test-native-financial-rules.js: PASS, 166 assertions. Existing
  native criterion identity/writer, targeted changes, audits, invalidation,
  grants, denied mutations, unchanged other rows and exact recovery. Existing
  suite uses synthetic schema/auth dependency stubs, not live RLS certification.
- node scripts/test-financial-mostrar-override.js: PASS, 25 checks. Real policy
  and Edge overview with synthetic Eventuales, Suplentes variables and Suplentes
  fijos profiles. Only matching/selected rules appear; total and terms preserved.
- node scripts/test-financial-program-visibility.mjs: PASS.
- node scripts/test-admin-program-criteria-matrix.js: PASS.
- node scripts/test-financial-supabase-cutover.js: PASS.
- node scripts/test-authenticated-loan-snapshot-rpc.js: PASS.
- node scripts/test-financial-criteria-native-identity.js: PASS, 70 checks.
- node scripts/build-financial-mostrar-override.js: PASS, syntax-valid complete
  bundle with exactly one regenerated module. 166-module inventory unchanged.
- node scripts/test-financial-mostrar-override-browser.js --bundle: PASS, 25
  assertions on the compiled module in real Chrome at 1440, 1024 and 390 px.
  Baseline/current tabs, headers, filters and sections match. Search, category,
  comparison, targeted save, mandatory reason, confirmation cancellation, save
  failure, AUTO reversal, OCULTAR, mobile and read-only roles covered. The test
  uses an isolated repository transport; zero external requests. It is not live
  authentication or a full production application E2E test. Source-module test
  also passed before compiling. Screenshots inspected visually.
- Scoped git diff --check: PASS; only expected Git LF/CRLF notices.

Initial browser comparison sampled the baseline before its selection effect;
fixed the test to wait for the actual detail before comparing. No application
change was made for that timing issue. Two historical static assertions mandated
mobile-only visibility; updated them for the explicitly authorized desktop action
while retaining the rest of the contracts. Initial full build without Babel
failed syntax validation before writing; compiled with the existing Babel 7.29.0
and used the focal build to preserve unrelated work.

### Release boundary

Read-only Management API preflight again returned HTTP401. No SQL, Edge, Pages,
credentials, financial row, historical request or Google data was changed. The
migration number is a candidate: verify it against live migration history before
activation. Verify deployed quote hash/current Edge, retain exact private backup,
apply SQL, deploy only visibility-policy.js within the current Edge bundle, then
publish the focal frontend with release cachebusters. Do not deploy this dirty
workspace wholesale. Verify runtime for the three profiles and refresh. Do not
activate existing rows as part of a deployment; the owner selects exceptions.
Recovery is the supplied inverse SQL plus prior Edge/UI; preserve all history.
No approval question is required to implement the already authorized policy.
The unresolved requirement is working administration access, not a new business
decision. Implementation is ready locally; production closure remains BLOCKED.

## CLAUDE UI PRESERVATION REVIEW

Screen: Fondos y reglas / Configuración financiera.
Original/current sections: tabs, matrix, filters, sort, comparison, financial
and visibility details, editors, mobile cards and navigation preserved.
Missing sections: none. Added control: desktop Administrar visibilidad.
Interactions preserved: PASS in isolated Chrome; writer-only permission tested.
Navigation preserved: no route/shell change. Visual structure preserved: PASS.
Unauthorized redesign: NO.
Verdict: PASS for focal source and compiled module; no live browser claim.

## H-FINANCIAL-MOSTRAR-OVERRIDE-001 RESULT

Status: BLOCKED for production activation; local implementation/verification PASS.
Files changed: the declared focal policy/UI, two SQL files, build/test scripts,
five governance entries, this audit and evidence/financial-mostrar-override.
Source-of-truth verdict: SAFE; existing Supabase authority and audited writer.
Invariant verdict: PASS for owner-authorized amendment; other protections retained.
Build: PASS; only one existing bundle module replaced, all others preserved.
Tests: PASS for listed isolated/focal suites and compiled Chrome UI.
Security: PASS in isolated checks; backend permissions/ACLs unchanged. Live
security verification unavailable; no credentials or service role in frontend.
Legacy impact: zero Google/Apps Script/financial-data writes; math unchanged.
Unexpected files changed: none introduced by this task outside declared evidence
and private preparation; existing unrelated workspace changes preserved.
Known limitations: Management API HTTP401; migration number/live source drift
and deployment require verification once access is restored. No live PASS.
Evidence: ../qa/evidence/financial-mostrar-override/{isolated,policy,browser,
build,release-preflight,verification}.json and baseline/current PNGs.

## SUTIAPP ARCHITECT REVIEW

Task: H-FINANCIAL-MOSTRAR-OVERRIDE-001.
Verdict: BLOCKED (production), local candidate reviewed and verified.
Critical findings: only authoritative MOSTRAR bypasses the automatic date guard;
existing writer invalidates temporary snapshots and audits the selected rule.
Wrong profiles stay excluded, quote math/history are preserved, exact SQL
recovery passes. Compiled UI maintains the original structure. No global frontend
repository/helper/auth/assets/routing/SW change; global image suite NOT APPLICABLE.
Source of truth: SAFE. Architecture: existing components and dependencies;
Registry not regenerated because no structural change occurred.
Security: unchanged permissions/grants, isolated denial checks pass; live pending.
Data: no business writes. Legacy: no Google/Apps Script changes.
Owner decision: NO; the requested exception already authorizes the amendment.
Next action: restore administration access, then run live drift/version preflight
and publish only the verified focal candidate; maintain BLOCKED until verified.
Response generated for Codex: YES.

### RESPONSE TO CODEX

Keep production activation BLOCKED while the read-only Supabase Management
preflight returns HTTP401. Preserve the verified local candidate and unrelated
work. After access is restored, verify migration numbering and deployed source,
capture exact backup, apply the guarded SQL and focal Edge/UI release, then
verify targeted visibility/quote/refresh without creating business fixtures.
Do not claim publication from isolated tests and do not advance to another H.


## Explicit publication request — continuation

The owner now explicitly requests publication ("subelo"). Deployment is authorized;
no further approval question is needed. Read-only Management API preflight still
returns HTTP401. The configured token has the expected PAT prefix and no whitespace;
no process token or standard Supabase CLI token file is configured. No credential
value was printed. Current tools provide no node_repl runtime for the Computer Use
skill; no alternate logged-in dashboard session was accessed. Pages workflow only
deploys frontend and cannot install this required SQL/Edge change.

Prepare a narrow patch/manifest in .tmp/financial-mostrar-override/release from the
captured pre-task baseline. Verify prior tested file hashes before packaging. This
adds no production changes and does not authorize wholesale dirty-workspace release.
Asked the owner to renew SUPABASE_ACCESS_TOKEN in local supabase.env, never in chat.
Until a successful preflight, preserve the prepared candidate and production state.

Publication credential continuation: owner supplied renewed management access.
Scope includes replacing only SUPABASE_ACCESS_TOKEN in untracked supabase.env;
never package/log its value. Publication remains authorized. Backup/preflight,
activation helpers and clean release preparation remain under the focal .tmp
directory; public evidence is sanitized.

Release preflight now PASS with renewed access: installed quote hash matches
2f621bc02e9e0919a00fb63c7a5032be; latest migration 20261105000200; candidate
20261106000100 is free. Scope extends release artifacts SutiApp.html/sw.js only
for cachebuster tokens, never service-worker logic; clean publication checkout
under .tmp/financial-mostrar-override/publish from remote main ea3e602.
Use deployed Edge module backup as base, preserve every other module, and require
seven protected-table fingerprints unchanged during guarded SQL installation.

## Activación backend comprobada — 2026-11-06

La credencial renovada resolvió el bloqueo histórico HTTP401. Respaldo privado
exacto de Edge v67 y definiciones SQL antes del cambio. Migración 20261106000100
aplicada transaccionalmente: siete tablas conservan conteos y fingerprints,
OID/owner/ACL y RPC autenticado intactos. Edge v68 ACTIVE, verify_jwt=true;
se preservaron los siete módulos fuente salvo visibility-policy.js. El compilador
reconstruyó una expresión de auth-js 2.71.1 de `600*1e3` a `10*60*1e3`: igualdad
de 600000 ms y resto del módulo completo comprobados; inventario y redirects
intactos. No hubo cambio de dependencia ni lógica Auth.

Catálogo autenticado: 154 reglas, exactamente tres nuevas AVAILABLE/VISIBLE
(SUTISSSTESON, 30/11/2026, MOSTRAR); 151 no seleccionadas y 47 sin fecha intactas.
Cotizaciones de las tres reglas aceptadas en lectura; AUTO conserva corte y dos
muestras permitidas conservan importes/resultados. Cero solicitudes creadas.
Evidencia: activation-backup/candidate/compile/sql/edge/runtime.json.

Publicación frontend desde main ea3e602; bundle de 175 módulos con sólo
screens-admin-fondos.jsx regenerado. Chrome aislado contra ese bundle PASS 25,
1440/1024/390 px. SutiApp.html y sw.js cambian sólo tokens a 2026110601.
