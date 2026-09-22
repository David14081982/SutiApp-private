# H-PROGRAM-PRODUCT-FINANCING-001

## PRE-CHANGE AUDIT — 2026-09-22

Status: PASS (implementation authorized by owner: «hazlo de forma quirurgica»).
Objective: per-program-catalog-item optional interest overrides, audience rules and
required minimum down payment; preserve Caja Chica eligibility, maximum, fees,
calendar, documents, workflow and historical requests.

Authority: `program_catalog_items` remains the product master; additive financial
configuration belongs to each item in Supabase. `financial_rules` remains the
default Caja Chica authority. Overrides apply only when explicitly configured.
`program_requests.financial_submission_snapshot` seals the effective conditions;
Google Historial de solicitudes is the existing derived delivery, not a rate master.

Declared files: this audit; app/program-catalog-repository.js;
app/screens-admin-program-products.jsx; app/screens-program-product-payment.jsx;
supabase/functions/financial-legacy/index.ts; one additive migration and recovery
named program_product_financing (number selected after read-only live inventory);
scripts/program-product-financing-admin.js (inspection/apply tooling);
scripts/test-program-product-financing*.js; scripts/build-program-product-financing.js;
generated app/bundle.js and associated SutiApp.html cachebusters;
docs/SOURCE_OF_TRUTH.md, docs/INVARIANTS.md, docs/DECISIONS.md,
docs/AGENT_CHANGELOG.md; derived architecture Registry artifacts;
docs/qa/evidence/program-product-financing-20260922/* and ignored private
.tmp/program-product-financing/* (schema snapshots and isolated test artifacts).
Expand this declaration before editing additional files.

No changes to financial_rules, ordinary loan rates, historical requests, Google
formulas/triggers, financial processing in Apps Script, Storage, global Auth or
the shared viewer. Existing product UI sections, gallery, modes, sort, active/sold,
save/cancel and simulator/documents/signature/calendar remain intact.

Risk: financial consistency and concurrency. One server resolver must select rate,
enforce down payment, invalidate changed sessions and revalidate at atomic submit.
No browser-supplied rate is trusted. Saving uses existing catalog write permission
and backend audit; no new broad grants or browser financial authority.

Policy: combined audience rule precedes individual audience rules, then item
default, then Caja Chica. Conflicting individual matches must fail visibly unless
owner explicitly selects a precedence. Down payment is a minimum; effective minimum
is max(product requirement, price minus existing financing maximum). Percentage is
of authorized price. Periodicity remains the current affiliate payroll periodicity.

Tests planned: isolated PostgreSQL migration/recovery, RLS/permission denials,
inheritance/zero/custom/audience rates, down-payment amount/percentage/max limits,
stale/concurrent confirmation, immutable approval and Google snapshot projection,
browser editor save/reload and simulator transitions, targeted bundle preservation.
Shared repository classification and global regression applicability will be
reassessed from actual diff. No production DDL tests or synthetic Google requests.

Recovery: back up exact replaced function definitions/ACLs before installation;
restore code while preserving configuration, audit and submitted history. Deploy
backend before frontend. Never restore an old calculator over active custom
contracts without explicitly disabling new submissions safely.

Initial evidence: Registry STALE for previous finance readability work; direct
inspection of catalog editor/repository and financial-legacy confirms target code.
Legacy classification: READ ONLY during audit; owner authorizes new product rates
and down payments and their existing request projection, not external formula edits.

Audit extension: scripts/test-program-product-financing-baseline.json contains only
read-only schema/function definitions (no rows, credentials or PII), necessary for
reproducible isolated execution against the actual installed writer/math. New
migration number verified unused: 20260922000200. ProgramCatalogRepository is a
shared catalog reader, so the mandatory global image regression applies to local
build and Pages. sw.js cache versions may be updated as generated cachebusters;
worker logic is outside scope. Browser fixtures and test server stay isolated.

## Implementation and verification evidence

The migration adds one nullable item column and five focal RPC/helpers. Catalog
save remains atomic with the original writer (including original media/section
checks), a stale-config comparison and an audit event. The installed payment writer
is patched at three exact locations under an MD5 drift gate; OID/ACL and intervening
identity/document fixes are preserved. The existing quote engine is unchanged.

One SQL resolver chooses conditions. Edge stores them inside the existing private
session, checks them on every quote and submits the expected result/conditions to
the transaction wrapper. SQL recalculates, seals and compares; only the diagnostic
resolved_at timestamp is excluded from equality. A mismatch rolls back request,
documents and any transactional delivery/audit. No browser-supplied rate is accepted.

- `node scripts/test-program-product-financing.js`: PASS, 36 assertions/cases using
  PostgreSQL/WASM, the installed quote engine, current request/approval writers and
  actual Edge product resolver. Inheritance, zero, generic, union/category/combined,
  conflicting and unmatched rates; fixed/percentage minimums; limit, cent rounding,
  permissions, stale save/quote/confirmation, recovery/drift/history preservation,
  fixed and approved quote, JUB monthly calendar, sealed approval and Google E/F/H/I
  projection covered. No external calls or production fixtures in this test.
- `node scripts/test-program-product-financing-browser.js`: PASS, Chrome 390/1280;
  real editor controls with isolated transport, exact repository RPC payload,
  save/reload/reset, audience selectors, down-payment mode, direct-contact controls,
  simulator minimum/error/retry/calendar. Zero page errors. Screenshots contain
  only synthetic records; they are UI evidence, not production requests.
- `node scripts/build-program-product-financing.js`: PASS, three focal chunks;
  all 127 other published modules preserved. HTML bundle v278, worker cache v216
  are cachebusters only. No global worker logic, image helper or Auth change.
- `node scripts/test-global-image-regression-production-live.js`: PASS against
  existing GitHub Pages v277/v215, 190 app assets, 226 program assets / 118 products,
  29 historical images, affiliate/admin photos and documents, membership/loan,
  Marketplace, galleries, fullscreen, real PDF, refresh, with/without service worker.
  Zero business mutations and page errors. This is production baseline evidence;
  it does not assert the new feature is deployed.
- `node scripts/test-program-product-financing-live.js`: PASS on candidate build
  v278/v216 with production read-only backend at http://localhost:8080. Same full
  global asset matrix including legitimate PDF and worker comparison. Receipt:
  `docs/qa/evidence/program-product-financing-20260922/global-local.json`.
  Initial random localhost port failed DOCUMENT_PREVIEW_UNAVAILABLE because that
  origin is not admitted; preserved in global-local-initial-origin-failure.json.
  Retest uses the already established :8080 test origin, without changing CORS.

## Guardians

SOURCE OF TRUTH: SAFE for candidate. Same product master, existing Caja rule for
inheritance, per-item configuration for explicit exception, immutable request for
accepted contract; Google remains derived. No production cutover has occurred.
DATABASE: PASS isolated. Nullable additive column, no backfill; private RLS-forced
definition backup; same writer OID/ACL; column read only for browser, helpers service
only, admin RPCs explicitly granted. Recovery restores exact code only without
configuration/history; otherwise refuses to discard it.
SECURITY: PASS isolated. Anonymous/affiliate cannot configure or invoke service
resolver/confirmation; original catalog permission checks and audit reused. No
secret, identity master, Storage policy or global authorization changes. Actual
installed grants/denials for the new RPCs await authorized installation.
LEGACY: SAFE CHANGE candidate for owner-requested product conditions. Existing
math/fee/calendar unchanged; new rate is the only intended financial difference.
Google row builder reads the sealed result; no Apps Script/formula/trigger edits,
no synthetic loans appended and no historical request changes.
CLAUDE UI: PASS. Original images, mode, price, order, active/sold, provenance,
save/cancel, responsive scroll, simulator fields, schedule, documents and signature
preserved. Adds one financial configuration section, rate in confirmation summary,
exact-cent minimum and retry for changed conditions. No unauthorized redesign.

## Production approval boundary

Owner explicitly authorized production installation and publication on 2026-09-22:
"Si hazlo y publicalo". The prior approval boundary below is historical. Release
scope includes the reviewed migration, financial Edge, frontend, read-only live
verification and sanitized deployment receipts. No real product rate or business
request is created by this release.

Release verification scope: update the existing Edge deploy verifier's obsolete
direct-writer marker to the new atomic wrapper/resolver markers; add
`scripts/verify-program-product-financing-live.js` for authenticated inherited-rate
quotes, installed permissions and sanitized receipts. Ordinary simulation sessions
are ephemeral; no confirmation, product edit or Google write is performed.

Automatic approval review rejected `node scripts/deploy-financial-legacy.js bundle`
because it POSTs to a Supabase deployment endpoint and could publish the Edge
Function without explicit production authorization. The command did not execute.
No alternate deployment path was attempted. Migration, Edge and frontend remain
local. Local compilation and tests completed independently of that restriction.

After explicit owner approval: verify unchanged migration number/function digest;
run `node scripts/program-product-financing-admin.js --apply` (one protected-data
transaction, no test DDL), deploy the reviewed Edge, verify real authenticated
inheritance/denials, publish the reviewed frontend and rerun the global Pages test.
Do not invent a real rate, change an actual product for QA, or append a synthetic
Google request; live custom-rate acceptance requires an owner-designated real case.

## H-PROGRAM-PRODUCT-FINANCING-001 RESULT

Status: BLOCKED — backend installed and verified; frontend publication acceptance in progress.
Files changed: declared catalog repository/editor/simulator, product-only Edge branch,
additive migration/recovery, focal tests/tooling, generated bundle/cachebusters,
governance, registry and evidence. Full list available through git diff/status.
Source-of-truth verdict: PASS; additive authority installed, all initial configurations NULL.
Invariant verdict: PASS local, focal OWNER exception recorded as ADR-113 / INV-239–242.
Build: PASS local, three modules changed / 127 preserved.
Tests: 36 isolated SQL/Edge cases + mobile/desktop browser PASS; global local and
existing Pages asset checks PASS. Updated backend live inheritance and ACL checks PASS;
local global regression repeated successfully against Edge v50 (worker v216).
Security: isolated denials and installed ACLs PASS; anonymous options denied 401,
authenticated service resolver denied 403. Non-admin save denial covered isolated;
only the admin QA credential is available for live verification.
Legacy impact: intended per-product rate only; no real product/rule/request changes.
Unexpected files changed: none at scope review.
Known limitations: frontend publication pending; no new production request or actual-rate save tested.
Evidence: this audit; test sources and sanitized schema fixture; browser.json and
global-local.json plus synthetic screenshots in docs/qa/evidence/program-product-financing-20260922/.

## SUTIAPP ARCHITECT REVIEW

Task: H-PROGRAM-PRODUCT-FINANCING-001.
Verdict: BLOCKED for final Pages acceptance; backend installation and live checks PASS.
Critical findings: no uncorrected local defect found in the reviewed candidate;
owner explicitly resolved the initial automatic-review authorization boundary.
Source of truth: one item configuration + inherited Caja rule + immutable submission.
Architecture: same engine, original writers reused, three frontend modules changed.
Security: permission checks, service-only helpers and atomic stale-contract rejection.
Data: nullable initial configuration; existing products/rules/requests preserved.
Legacy: Google projection tested without external writes; math/calendar preserved.
Owner decision: NO — installation and publication explicitly authorized.
Next action: publish the reviewed frontend and complete live verification.
WORK_QUEUE_HISTORY.md absent; task-orchestrator and
h-gate-supervisor are not installed skills. No autonomous next H is authorized.
Response generated for Codex: YES.

### RESPONSE TO CODEX

Complete only this authorized release: publish the reviewed frontend and verify
Pages v278/v216 with the mandatory global regression, then record the final result.
No new H or production business-data edits are authorized by this review.

### Installed backend evidence — 2026-09-22

`migration-apply.json`: version 20260922000200, protected-data fingerprints equal
inside the installation transaction, zero non-NULL configurations.
`backend-live.json`: real authenticated product quote inherits 3%, matches ordinary
Caja Chica rate/interest/total/payments, preserves minimum, and makes zero Google
writes. Two ordinary ephemeral simulation sessions; no request confirmation.
Edge deployment returned HTTP 201, version 50 ACTIVE, verify_jwt true. Remote compiled
body SHA256 ae660c2412eeb1c906d9b30655309ea8e81283782b4fd18d68e7d1338e7589b7;
all 16 expected markers verified after updating the obsolete writer-name check.
