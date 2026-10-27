# H-LOAN-AVAILABLE-CREDIT-001

Current status: publication authorized by the owner; backend installed and verified, frontend publication and final verification in progress. The earlier approval block below is historical.

## AUDIT / AUTHORITY / PLAN / RISK

Owner authorizes a surgical update after a restoration point. For each eligible
visible loan fund, subtract the sum of outstanding installments for the exact
affiliate from its existing profile-specific maximum. Use the same HISTORIAL P V2
installments and Hermosillo date rule as Historial/Amortización: A <= today is paid,
future A is pending. Pending installments include the contract's interest/fees;
do not substitute original principal. This explicit decision extends the existing
display convention to available credit; it does not change accounting/SICOF.
Current production inspection further fixes the precise formula: the existing
paidThrough(A/B, today) sums recorded B through today; a past zero is "No se
descontó". Each loan's pending balance is max(0, K - paidThrough), exactly as
Amortización displays it. Do not release debt by treating a past zero as paid,
nor round each individual quota before the existing decimal sum.

Example approved: Aguinaldos maximum 25,000 less pending installments 6,260 yields
18,740. Availability is clamped at zero. Fund cards show this amount; Inicio and
Finanzas show the sum for the same visible funds. Existing categories, unions,
eligibility, rates, terms, documents, bank steps, approval and financial processing
remain. Unknown source data is not zero debt and never falls back to the maximum.

Admin Finanzas gains an audited global switch (initially OFF), and an individual
affiliate/fund authorization. ON grants the applicable full maximum without debt
reduction; OFF resumes the normal calculation while retaining individual grants.
Neither exception changes underlying debt or grants a different profile's limit.

Authority: financial_programs/funds/rules in Supabase own criteria; affiliates
owns exact identity; Google HISTORIAL P V2 owns installments; existing immutable
program_requests submission contracts own requests not yet represented in Google.
New Supabase policy/authorization records own only the debt-reduction exceptions.
The availability snapshot is derived, private, expiring and validated server-side.
Pending committed requests reserve their requested principal until represented by
Google amortization, then their real pending installments replace the reservation
without double counting. This does not redefine the existing maximum principal
input as a maximum including the new loan's charges.

Availability consumes the exact existing published Historial projection through
get_self_loan_history_snapshot, preserving its daily 15:00 Hermosillo sync and
manual Admin refresh. It introduces no interactive Google reads or replacement
authority. Distinct source rows are summed even when their dates, numbers and
amounts match. Settled labels do not erase a displayed positive balance; an actual
zero balance consumes no capacity, including a retired historical fund name.
The exception switches require valid identity/source and bypass only debt reduction.

Declared files:
- supabase/functions/financial-legacy/index.ts and new loan-capacity.mjs;
- new migration/recovery for loan available credit, inspection and focused tests;
- app/financial-legacy-repository.js, app/screens-loan.jsx;
- app/app.jsx and app/screens-financiera.jsx: only the available-credit money
  formatter so fractional availability is not rounded up in Inicio/Finanzas;
- new app/loan-availability-admin.js; app/screens-admin-finanzas.jsx;
- scripts/build-bundle.js, generated app/bundle.js and cache literals only in
  SutiApp.html/sw.js;
- scripts/inspect-loan-available-credit.js, backup-loan-available-credit.js,
  test-loan-available-credit*.js, release-loan-available-credit.js;
- existing test-finance-credit-consistency.js, test-loan-amount-term-ui.js and
  test-loan-simulator-ui-cutover.js: adapt their fixture/contract to the new
  explicit available_amount field and integer-cent aggregation, retain other assertions;
- this audit, docs/qa/evidence/loan-available-credit/*, scoped append to
  SOURCE_OF_TRUTH, DECISIONS, INVARIANTS, SECURITY_RULES, LEGACY_GOOGLE_SYSTEMS,
  MIGRATION_RULES, AGENT_CHANGELOG; architecture index for new architecture only;
- private .tmp/loan-available-credit backup, isolated fixtures/build/release files.

Excluded: Google writes, Apps Script edits, real test requests, historical data
rewrites, rates/formulas, SICOF, savings financial writers, unrelated local edits.

UI contract: preserve loan header, progress steps, simulator, fund carousel,
amount editor, deposit/documents/summary/confirmation and navigation; preserve
Inicio/Finanzas structure and existing Admin tabs/workbench. Zero availability
retains the fund card and shows an explicit exhausted state. Add only the requested
administrative controls alongside existing Finance settings.

Risk: shared financial repository requires global image regression against local
build and Pages under AGENTS.md. Additional checks: exact identity/fund mapping,
one loan vs many rows, money cents, date rollover, zero/over-limit debt, partial
source failures, stale sessions, backend quote/submit, concurrent submissions,
override permissions/revocation/audit, isolated PostgreSQL recovery, UI parity.
No new infrastructure or permission claim is considered verified without tests.

## Restoration point before implementation

Local checkpoint: `.tmp/loan-available-credit/restore-20261026-223210-0700`.
4,134 files, all archive bytes SHA-256 checked, ZIP integrity checked, Git bundle
verified. Original HEAD: `91a6d6f1e25a4a112f498e490c7c5a559ffc6d50`.
Workspace ZIP SHA-256:
`98916d496d0b99184106dd48ae536ec1512225e8f33807c76c614bbad2ca5897`.
Includes tracked/untracked nonignored workspace, private runtime config, staged
and unstaged patches and original Git index. Dependencies/caches and older private
backups excluded. Restore into a separate directory first using manifest/RESTORE.txt;
no automatic destructive reset. External baselines are captured before deployment.
Recovery of this feature must preserve intervening business records and audit events.

## Verification / evidence

Implementation uses isolated `.tmp/loan-available-credit/release` based on current
published main `dad2cdfbc3c6bd86806faebd1a6c3f09b503b7ba` (shell 2026102608).
Existing workspace edits remain intact; copying older local modules over newer
published history is prohibited. New files may be prepared locally and copied
into that candidate. External function baselines, not old local migrations,
govern forward/recovery definitions.

Local evidence is in the isolated candidate's
`docs/qa/evidence/loan-available-credit/`:

- `build.json`: version 2026102609, bundle SHA-256
  d22be38a3bf4992922450a856eff30c87579fcc4c9f9b2b4c65720d3307f40ab;
  generated blocks outside the five focal modules are byte-preserved.
- `projection.json`: eight groups compare the real history projector and UI
  metrics, including charges, past zero, dates, duplicate source identity and
  legitimate distinct rows sharing date/number/amount.
- `edge-local.json`: five groups exercise actual Edge orchestration offline.
  Node strips TypeScript and parses/runs handlers with isolated dependencies;
  this is not Deno semantic type-checking or a cloud bundle/integration test.
- `sql.json`: PostgreSQL/PGlite verifies permissions, reserves, transfers,
  quote/submission boundaries, both exemptions, revocation and exact recovery.
- `concurrency.json`: native PostgreSQL 18, six scenarios with independent
  connections and observed lock waits; overspending/revocation/publication races.
- UI suites and `isolated-ui-browser.json`: 18 Chrome component cases, seven
  freshness/context cases, existing amount/term, total and flow contracts PASS.
- `global-images-local.json`: official required global image regression PASS
  against the exact local bundle on allowed `http://localhost:8080/`, with real
  existing backend assets/PDF, zero browser errors and zero business data writes.
  The first run at 127.0.0.1:8789 failed ORIGIN_DENIED; its evidence is retained.
  Only the test origin changed; no CORS, product or fixture rewrites were made.
- `global-images-production-baseline.json`: existing Pages baseline PASS before
  this deployment, plus `pdf-focused-allowed-origin.json` for local/Pages PDF.
  Postdeployment candidate verification on Pages remains required.
- `workspace-preservation.json`: all 4,134 baseline files remain byte-identical.
- `restore-external.json`: function sources/config, Pages artifact, repository
  source and unchanged Google receiver captured; hashes and ZIP CRC verified.

Final migration SHA-256:
`203826dd3e9a703785495dced45bcfb86a6a5294a5e07ae0478014ebf84c60ff`.
Backend permission boundary uses the existing `update` action and separately
requires `financial_rules.write`; no new administrative grant is introduced.

## H-LOAN-AVAILABLE-CREDIT-001 RESULT

Status: BLOCKED only for external publication; local candidate tests PASS.
Files changed: isolated release's scoped source/test/migration/governance files;
exact file list and hashes in `.tmp/loan-available-credit/package-2026102609/manifest.json`.
Source-of-truth verdict: PASS; existing published Google projection and canonical
Supabase requests/criteria retained; new policy stores only exemptions.
Invariant verdict: PASS locally; original amortization/eligibility/flow preserved.
Build: PASS local bundle and Pages artifact; cloud Edge bundle pending approval.
Tests: PASS focal, SQL, true concurrency, UI, local global images and Pages baseline.
Security: local grants/RLS/actor/context tests PASS; production application pending.
Legacy impact: no Google or financial legacy writers changed; same daily/manual
publication; debt is derived using the existing paidThrough rule.
Unexpected files changed: none; original workspace baseline unchanged.
Known limitations: source refresh cadence remains unchanged; stale sessions may
require reopening the simulator at deployment; no new full production integration
test is claimed before applying SQL/Edge. A failed or unknown source never grants
credit, including when an exemption is enabled.
Evidence: paths above, independent `architect-review.md`, and `deployment-plan.md`.

Automatic approval review rejected sending financial source to Supabase's cloud
compilation endpoint, citing insufficient explicit authorization for the payload,
destination and possible remote effects despite bundleOnly. No bypass was used.
The final approval request covers this exact migration, Edge package and Pages
version. The deploy/recovery plan is concrete; no further routine confirmation
is required for local/read-only work already authorized.

## Authorized publication continuation — 2026-10-26

The owner responded to the concrete publication request with: "al terminar haz
commit, push y publicalo". This authorizes the prepared migration, financial Edge
package and GitHub/Pages release described above. The prior automatic-review
block is resolved by this explicit instruction; it is retained as historical
evidence, not a new approval requirement. Current phase: production preflight,
deployment and verification in progress, without a product PASS claim yet.
The release helper gains explicit atomic migration/Edge deployment operations;
the migration registration and SQL apply are one transaction. Product hashes
remain the approved candidate. Postdeployment evidence and the final independent
review extend the already declared docs/evidence scope. No real loan request or
policy-toggle test is authorized by this verification plan.

Backend deployment completed 2026-10-27 06:12 UTC. Migration 20261027000100 and its
exact SQL registration committed together. Edge financial-legacy v65 is ACTIVE
with JWT verification; GET body readback matches all six compiled source hashes.
Production SQL verification confirms prior function definitions/OID/ACL/owners
and table metadata, the exact modified quote, 11 new function bodies/grants, RLS,
immutable audit, source publication and unchanged daily cron. Global policy OFF,
zero individual exceptions; no historical business records rewritten.
Evidence: migration-applied.json, edge-deployed.json, edge-readback.json,
production-sql-preflight.json and production-sql-verify.json.
