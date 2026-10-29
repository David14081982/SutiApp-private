# H-ADMIN-INVERSIONISTAS-001

## PRE-CHANGE AUDIT — 2026-10-29

Status: PASS (implementation authorized; release requires focal verification).
Objective: isolated administrative Inversores module, directly below Reportes JC.
Authority: owner request establishes Supabase as sole productive authority for this new domain; JC Inversiones.xlsx is immutable historical migration evidence. Existing Suti Inversión presentation and all other financial domains remain unchanged.

Scope/files: new `app/investors-repository.js`, `app/investors-admin.jsx`, `app/investors-model.js`; additive `supabase/migrations/20261029000100_investors.sql` and matching recovery; `scripts/*investors*` for extraction, migration, build, release and focal tests; this audit, `docs/qa/evidence/investors/` (aggregate evidence only), appended domain entry in `docs/SOURCE_OF_TRUTH.md` and `docs/AGENT_CHANGELOG.md`; architecture registry derived files. Minimal integration in `app/screens-admin.jsx` (one module/group/render branch with existing Finanzas access), `scripts/build-bundle.js`; generated bundle and cachebuster references only in `SutiApp.html`/`sw.js`. Private baseline, original workbook, extraction, SQL responses and release checkout under ignored `.tmp/inversores/`.

Excluded: changes to existing financial tables, roles, grants, authorization helpers, Storage policies, shared repositories, app shell, Google, other modules, consolidated finance reports. Existing dirty working tree is baseline, not part of this H. Baseline hashes and copies saved privately before implementation.

Plan: reconcile four sheets; preserve source cells/formulas/cached values and source hashes; create private module schema and guarded RPCs; implement investors/contracts/movements/schedules/documents/review/history; focal SQL/browser/import/security/build tests; isolated release from production source, preserving every unrelated bundle section; publish only on PASS.

Risk: workbook lists duplicate contracts, renewals and addenda; numbered folders are not unique investor IDs; Pagos is a schedule, not a dated ledger. Never count scheduled amounts as paid. Missing/contradictory facts remain review items. Historical rates and obligations are immutable; changes affect explicitly future periods. Financial corrections retain previous revisions and actor identity. Retry IDs are checked with payload equality. No browser financial persistence or fallback.

Recovery: installation is transactional and additive. Recovery revokes new RPCs and retains private historical tables, audit and document bytes. Original workbook SHA256 and all imported evidence retained. Restore prior frontend artifact if necessary. No destructive rollback or deletion of existing business data.

SOURCE OF TRUTH AUDIT: investors/contracts/movements/obligations/documents are Supabase-only; readers InvestorsRepository; writers guarded module RPCs and one-off owner-authorized idempotent importer. Excel has historical provenance only, no runtime reads. Verdict SAFE.

DATABASE MIGRATION AUDIT: new private schema only, UUID PKs/FKs, immutable audit, version checks, action IDs, source locator uniqueness, numeric money/rate, date checks, forced RLS, no direct browser grants. Existing backend definitions untouched. Verdict PASS for design; execution subject to SQL/security tests.

SUPABASE SECURITY REVIEW: reuse `program_requests.read/write` and `admin_module_boundary(['finanzas'], action)` without modifying them. Real auth actor and effective affiliate recorded independently. No Auth account required for investors. Private documents accessed only through guarded RPCs; no changes to existing document or Storage contracts. Test anon, ordinary user, wrong module, read-only admin, direct table access, stale context and optimistic concurrency.

LEGACY GOOGLE AUDIT: READ ONLY historical workbook extraction; no Google/API reads or writes and no Ahorro/Préstamos calculations. Owner explicitly authorizes the new investment domain. Existing Suti Inversión remains informational.

UI contract: preserve every existing Admin module/group/order/control, responsive layout, header, scroll, access predicate and view transitions. Add only Inversores after Reportes JC and its isolated body. Generated bundle changes do not trigger global testing; owner explicitly requests focal tests only.

## Workbook reconciliation

SHA256: `28b35c451ec8892c0c3b1b9b5d300f8af457177448daf7dbe6fa3b610d90ef20`.
Four sheets, 274 populated source rows retained byte-for-byte at workbook level and cell-for-cell
with formulas/cached values in private provenance. Cartera Inicial: 107 business rows; Pagos: 52;
Retiro: 44; comisión: 44. Identity grouping uses exact case/whitespace-normalized name only,
preserving every raw alias. Folder numbers repeat across unrelated people and are not identity.
52 investment identities; 88 contract-period records; 205 contract references converge onto those
records. Addenda remain separate evidence awaiting an explicit base-contract link, never extra
capital-bearing contracts. Non-investment payees remain evidence, not fabricated investors.

35 active, nonconflicting contract snapshots qualify for future schedules. Checks include status,
current capital, rate versus monthly amount, term versus dates, payment day versus anniversary,
cross-sheet discrepancies and unresolved active addenda. Nine contract records have explicit
conflicts. Observed-on 2026-10-29 is migration observation, not an asserted receipt/payment date.
Opening balances are stocks; the import creates zero cash movements. Monthly matrices, formula
totals and commission percentages are not paid evidence. Upcoming obligations derive from the
recorded monthly agreement; historical obligations and payments are not invented. UI explicitly
discloses partial coverage. Historical contributed capital sums the source's Monto ingresado once
per master document/date and remains distinguishable from post-cutover cash movements.

Financial convention for new manual contracts: simple monthly yield on full calendar anniversary
periods. Rates and capital changes affect subsequent full periods. Partial periods require an
explicit agreed obligation; early closure requires an agreed partial-period yield when applicable.
No automatic daily convention, compounding or cross-program projection is introduced.

## Verification and release boundary

Scope extension (derived discovery only): add an Inversores alias/node and demonstrated links in
`docs/architecture/architecture-overrides.json`, because the generator cannot infer the Spanish
feature name from the isolated English filenames. No runtime or authorization change.

New private schema only: 11 forced-RLS tables, guarded public RPCs; no existing backend object is
replaced. Documents stay in this private domain, retaining all versions; existing document/Storage
contracts remain untouched. Local metadata has two pre-existing Reportes JC registration gaps;
before/after errors are identical. The isolated checkout of published main has complete metadata
and its existing screen-permission build guard must pass unchanged.

SQL tests use actual PostgreSQL (PGlite), with synthetic identities. Browser tests call that engine
through the real repository and UI. Live verification separately checks real helpers in ROLLBACK,
then authenticated reads. No global suites are authorized or run. Original private baseline and
published source are preserved; unrelated bundle blocks are compared exactly.

Management API token returned 401. A configured direct PostgreSQL connection was verified using
the Supabase CA and hostname validation, retaining `rejectUnauthorized:true`. No credentials are
printed, committed or included in artifacts. This maintenance transport does not affect runtime.

## H-ADMIN-INVERSIONISTAS-001 RESULT — release candidate

Status: PASS for implementation, backend installation, migration and focal candidate verification.
Frontend publication/readback is the remaining release step.
Files changed: three new app modules; four additive lines in Admin; build list; additive migration
and non-destructive recovery; focal scripts; authority entry, this audit and sanitized evidence.
Release bundle/cachebusters are generated artifacts. Architecture Registry updated as derived index.
Source-of-truth verdict: SAFE, Supabase only; workbook is immutable migration provenance.
Invariant verdict: PASS; no existing authorities, roles, protected repositories or financial rows changed.
Build: PASS, isolated published main `72f48a67939deb11351e3a934a9c17a85dd79232`,
169 unrelated published bundle modules preserved. Existing screen-permission build guard PASS.
Tests: SQL, idempotent import/original-file recovery, browser/actual SQL, Admin integration, scope,
live ROLLBACK with existing helpers, and authenticated candidate readback PASS.
Security: 11 forced-RLS private tables; direct access revoked; anonymous/ordinary-user denial;
read-only and wrong-module denial; real actor/effective context separated; no frontend secrets.
Legacy impact: none. No global suite run; no existing Google/Ahorro/Préstamos writes.
Unexpected files changed: none against private initial baseline.
Known limitations: 70 historical review items, including nine contract records with discrepancies;
unlinked addenda and non-investment concepts are retained without invented relations. Prior yield
payments/generated obligations are not certified by monthly columns. Coverage is visible in UI.
Partial-period interest needs an explicit agreed amount. Documents accept PDF/JPG/PNG up to 5 MB.
Evidence: `docs/qa/evidence/investors/{sql,import,browser,scope,build,release-candidate,backend-dry-run,backend-applied,backend-verified,import-live,live-candidate}.json`.

## CLAUDE UI PRESERVATION REVIEW

Screen: Admin.
Original/current sections: original 43 modules and ten groups unchanged; Inversores adds one.
Missing sections: none. Added sections: Inversores after Reportes JC, seven module views.
Interactions/navigation/visual structure preserved: PASS, structural comparison and browser.
Unauthorized redesign: NO. Verdict: PASS.

## SUTIAPP ARCHITECT REVIEW — pre-publication

Task: H-ADMIN-INVERSIONISTAS-001.
Verdict: APPROVED for the authorized publication step.
Critical findings: earlier local Reportes JC metadata gaps were pre-existing; release checkout has
valid metadata and passes its unchanged structural guard. Local and published bundles differ in
unrelated baseline modules, so release is built from published main and only scoped insertions.
The direct database connection avoids the expired management token without disabling TLS.
Source of truth: one Supabase domain; no productive Excel or browser fallback.
Architecture: isolated schema/repository/UI; inherited Finanzas access without changing permissions.
Security: local and real-helper denial tests plus authenticated HTTP readback passed.
Data: 52 investors, 88 contract-period records, 35 active snapshots, 214 future obligations,
274 source rows, 70 review items, zero inferred cash movements. Duplicate import leaves identical
counts/hashes and workbook recovery is byte-identical. Historical rates are not rewritten.
Legacy: unchanged.
Owner decision: NO; ambiguous historical items stay in the expressly requested review workflow.
Next action: publish only the isolated candidate and verify deployed bytes and Inversores access.
Response generated for Codex: YES.

### RESPONSE TO CODEX

Publish only H-ADMIN-INVERSIONISTAS-001 from the prepared isolated checkout. Preserve unrelated
source and compiled modules, original Admin permissions, existing business data and private workbook.
Verify production bundle, sidebar position, authenticated read and anonymous denial. Record the
deployment result and stop; do not begin another H or run global suites.
