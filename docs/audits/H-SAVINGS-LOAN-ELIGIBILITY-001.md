# H-SAVINGS-LOAN-ELIGIBILITY-001 — pre-change audit

OWNER 2026-09-22 authorizes configurable integer months and enrollment/first actual deduction as the starting date; non-savers and new savers require an audited exception. A specific exception permits one submission; other financial/document/profile controls remain intact.

Scope: new private Supabase policy, grants and events; canonical Savings enrollment/actual receipt reader; Edge eligible-fund filter; current SQL quote and atomic submission guards; additive collapsible administrative controls. No invented initial period: ordinary access fails closed until configured. No Google, Apps Script, historical data, balances, rates, amortization, Caja Chica, Auth or Storage changes.

Files: this audit; supabase/migrations/20260922000100_savings_loan_eligibility.sql and matching supabase/recovery file; supabase/functions/financial-legacy/index.ts and savings-eligibility.ts; app/savings-loan-eligibility.js; app/screens-admin-fondos.jsx; app/screens-admin-finanzas.jsx; scripts/build-bundle.js; scripts/test-savings-loan-eligibility.js/.sql/-browser.js; app/bundle.js (GENERATED_ARTIFACT); SutiApp.html (cachebuster); docs/SOURCE_OF_TRUTH.md; docs/AGENT_CHANGELOG.md; generated architecture registry/index files.

Authority: existing canonical savings_participants/enrollments, contribution_overrides and certifications supply status/dates; financial_funds/rules supply fund identity and financial conditions. New policy/grants are authoritative only for access. Affiliate UUID and exact numero_control, never email or browser state. No new cache/fallback.

Permissions: financial_rules.write OR the existing finance-approval pair (program_requests.write AND workflow.write) for policy, so the Finance responsible can configure it as requested. The approval pair is required for exceptional authorization. Actor from Auth, beneficiary separate. RLS forced, no browser table access, minimal RPC grants, reason, optimistic version, idempotency, atomic one-use consumption. No automatic role assignments.

Risk: high financial impact, explicitly authorized. Legacy SAFE CHANGE limited to access; mathematical equivalence and unchanged remaining funds required. Calendar months in America/Hermosillo; no projected discount counted as real. Migration additive and recovery restores backed-up quote function; never deletes history after use.

Verification: isolated PostgreSQL only, no production test DDL/fixtures; date boundaries, policy edits, saver/no-saver/new-saver, exception/revocation/consumption, anonymous/cross-user/DML denials, 100000→80000, browser, build and focal regression. Existing Inicio/Finanzas/Loan layouts and all admin filters, queue, details and actions preserved. Only eligibility-derived list/total changes; admin gains a collapsible block.

Navigator STALE (11 changed/1 added preexisting); code/schema inspected directly. Registry is derived, never runtime authority. Source-of-truth design SAFE. Pre-change status PASS for local implementation; runtime/security verdict pending tests. Not deployed.

Scope update: scripts/build-savings-loan-release.js and scripts/deploy-financial-legacy.js are included to produce a reproducible scoped bundle and package the Edge imports. A full baseline build also reformats two unrelated published modules; the scoped builder must preserve those exact original chunks. Temporary dependencies, captured schema definitions and synthetic browser receipts stay under .tmp/savings-loan-eligibility (no PII/secrets). Production schema reads are read-only and contain definitions/column names only. Installed PostgreSQL crashes on initdb; isolated PGlite 0.5.8 provides real PostgreSQL execution without production DDL.

Verification scope update: sw.js cache name/CORE bundle query only (GENERATED_ARTIFACT, no worker logic); scripts/test-personalized-financial-session-snapshot.js must assert the new eligibility-filtered rules instead of the former unfiltered assignment. Baseline HTML/worker query versions differed (275/270); this release aligns both to 276. No unrelated source fixes.

Test maintenance: scripts/test-loan-simulator-ui-cutover.js has an obsolete literal repository query v10 although both existing runtime references are v11. Replace this one assertion with exact HTML/worker version equality, preserving the cache contract and avoiding unrelated source changes.

Review refinements: reuse savings_enrollment_effective_status and the current canonical savings_contribution_plans, respecting a future termination date and excluding expired/paused plans. Restriction is bound to the stable fund code caja-de-ahorro (verified read-only), not its editable display name. Used request UUIDs are durable audit references, validated atomically on INSERT but intentionally without a deletion-blocking FK: the existing authorized request-archive workflow must retain exception history and must never restore a consumed authorization.

A zero-opening certification whose first date was future at its cutoff is a plan, not actual payment evidence. For that case, only latest-version positive confirmed contribution_overrides establish the first deduction; elapsed time and a zero/corrected receipt never qualify. Future next-payment plans for already-certified savers remain valid, matching the existing savings summary.

Evidence scope: docs/qa/H-SAVINGS-LOAN-ELIGIBILITY-001.json contains sanitized receipts and source hashes. Browser screenshots remain synthetic under .tmp. No production test data or test DDL was created.

## Verification evidence

- `node scripts/test-savings-loan-eligibility.js`: PASS in PGlite 0.5.8. Real PostgreSQL executes the migration, exact quote-function recovery and refusal after history; configurable months and origins, boundary dates, stopped/paused/future-termination accounts, no deductions, projected/zero/corrected deductions, authorization/revocation, one-use consumption, retention after request deletion, renamed fund, unknown criterion, actor/beneficiary separation, permission pair, anonymous/direct-table/private-RPC denials and forced RLS. Existing total helper verifies 100000 -> 80000 with other rule objects unchanged.
- `node scripts/test-savings-loan-eligibility-browser.js`: PASS, Chrome 390px/1440px, isolated RPC fixtures only. Free numeric input, date basis, save, exact control, mandatory reason, same-key retry, authorization/revocation, clearing previous beneficiary and responsive layout. No browser errors.
- `node scripts/build-savings-loan-release.js C:/tmp/sutiapp-babel-7.28.4.min.js`: PASS; 130 modules, exactly the new access module and two additive admin integrations changed. Existing Fincat/Program Products published chunks preserved byte-for-byte. Node validates the executable bundle.
- `test-financial-supabase-cutover.js`, `test-personalized-financial-session-snapshot.js`, `test-loan-simulator-ui-cutover.js`: PASS. Existing mathematical resolver, four-step loan composition, cancellation and cache-version contracts retained. New Edge modules parse successfully with Node TypeScript stripping + SourceTextModule.
- `test-global-image-regression-production-live.js`: PASS against GitHub Pages and the local generated build at **http://localhost:8080/**. Public branding, Login seal, profile, Admin affiliate, image/PDF documents, Membership, Loan, catalog/gallery, Marketplace, fullscreen, refresh and with/without worker all verified. No business data mutations; ordinary access/security audit effects are not financial writes.
- Local verification preparation: Windows checkout CRLF in vendor JS caused SRI failure; normalize **only temporary site vendor files** to verified original LF/SHA-384. `127.0.0.1` is not the allowed document Edge origin; localhost succeeds. Neither issue required changing production security, vendor source or document helpers.
- Registry regenerated. Its full acceptance run detected one stale file edited while the long generation was running; final freshness/lookup verification follows the frozen source update. The generator itself is unchanged.

## CLAUDE UI PRESERVATION REVIEW

Screen: Inicio, Finanzas, Préstamo, Admin Finanzas/Fondos.
Original/current sections: all retained. Missing sections: none.
Added sections: collapsible administrative policy/exception block only.
Interactions/navigation/visual structure preserved: YES (additive diffs, synthetic browser, complete live image regression).
Unauthorized redesign: NO. Verdict: PASS.

## H-SAVINGS-LOAN-ELIGIBILITY-001 RESULT

Status: PASS — local implementation/isolated validation; production release NOT APPLIED.
Files changed: declared UI module/integrations, Edge filter, SQL forward/recovery, build/deploy packaging, tests, generated bundle/cachebusters, authority/evidence and architecture index.
Source-of-truth verdict: SAFE; canonical Savings and financial criteria retained; access policy/authorization are private focal authorities; no browser or Google fallback.
Invariant verdict: PASS for tested scope; numero_control retained as text, no historical financial modifications, immutable decision evidence.
Build: PASS, scoped bundle and deployable public site.
Tests: PASS focused SQL/browser/financial regression and live global images; final Registry freshness tracked separately.
Security: PASS isolated PostgreSQL ACL/RLS/permission tests; real production schema definitions inspected read-only; new RPCs not yet installed or gateway-tested.
Legacy impact: access restriction expressly requested; no rates, amounts, ledger, yields, Google, Apps Script or amortization edits.
Unexpected files changed: none after preserving unrelated generated chunks.
Known limitations: migration/Edge/frontend have not been deployed; actual minimum months/origin must be saved by the responsible administrator. No real loan was submitted. PGlite tests use synthetic dependency rows, not a production financial clone.
Evidence: scripts above, docs/qa/H-SAVINGS-LOAN-ELIGIBILITY-001.json, synthetic images in .tmp/savings-loan-eligibility.

## SUTIAPP ARCHITECT REVIEW

Task: H-SAVINGS-LOAN-ELIGIBILITY-001, local delivery.
Verdict: APPROVED for local implementation, not a production release certificate.
Critical findings: original category/union-only gate omitted Savings; direct quote and request-time checks are now covered. Stable fund identity, planned-versus-real payment, future termination, idempotency and retained one-use evidence were explicitly checked.
Source of truth: single access policy; existing Savings/financial authorities unchanged.
Architecture: additive administrative controls; common backend decision; existing total and calculation engines reused.
Security: real actor and beneficiary separated, no direct browser DML, scoped privileges and immutable journal.
Data: no changes to historical or live financial data.
Legacy: Google/formulas untouched.
Owner decision: NO for implementation; no new business choice required beyond ordinary administration of the configurable rule.
Next action: coordinate an explicitly authorized production release (SQL -> Edge -> frontend), then verify gateway permissions and have Finanzas save the intended initial rule. Do not create a test productive loan or reuse historical consent.
Response generated for Codex: YES.

### RESPONSE TO CODEX

Approve the local feature only. Preserve evidence and all existing data. On authorized publication, recheck current quote-definition compatibility, apply only migration 20260922000100 with backup/recovery and bounded locks, deploy financial-legacy with all imports, publish the scoped frontend and perform read-only post-release verification. Never run db push or assume the initial month count/date origin. WORK_QUEUE still prohibits creating an unapproved productive test loan; missing WORK_QUEUE_HISTORY/task-orchestrator cannot authorize automatic next tasks.

## Authorized publication — 2026-09-22

OWNER instruction: “publicar los cambios.” Scope extends the approved local release to production: only migration 20260922000100, financial-legacy and the prepared GitHub Pages artifact; commit/push of the declared files and release evidence. No additional migrations, business settings, authorizations or financial transactions are authorized or required for verification.

Preflight: origin/main equals local HEAD 6be567c; Registry FRESH; Edge bundle compilation PASS. Production migration version and tables absent; exact current quote definition accepts the reviewed insertion and is backed up in .tmp/savings-loan-eligibility/release-before.json. Previous Edge bundle retained in edge-before.eszip. Forward transaction uses 2s lock/60s statement timeout and records only this version in schema_migrations atomically; function backup also persists in a private forced-RLS table. Recovery was tested locally and refuses deletion after audited use. Pre-change release verdict: PASS. Post-release checks pending below.

### Production release RESULT

Status: PASS — migration applied, Edge v49 ACTIVE with JWT verification, frontend commit 44fd10a50bfb5a1a4aaaea6ca2535c60f60a0131 published.
Files changed: declared implementation plus release updates to this audit, SOURCE_OF_TRUTH, AGENT_CHANGELOG, existing QA receipt and derived Registry hashes.
Source-of-truth / invariants: PASS; initial rule still unconfigured; zero exceptional grants/events created by deployment. Existing financial data untouched.
Build / tests: GitHub Pages run 35706486877 SUCCESS, including Auth, request compatibility, public build and post-deploy request checks; Membership contract run 35706487004 SUCCESS. Focal finance/static contracts PASS again before publication.
Security: four new tables have forced RLS; exact installed quote backup matches; anon admin read and private eligibility return 401; authenticated admin read 200 with both capabilities. Published Edge overview 200 excludes ineligible Savings fund. No real request submitted.
UI: served bundle v276 exactly matches reviewed local source after line-ending normalization. Published mobile Finance panel loads the month field and both date bases without errors. Navigation uses the existing regression's DOM click because the mobile menu overlay intercepted the initial pointer-click attempt; no assertion of general menu pointer behavior is made. The new panel's own click works normally.
Images: complete production live regression PASS, zero browser errors and zero business mutations, including legitimate PDF, fullscreen, refresh and service-worker variants.
Legacy impact: access only; no Google, rates, ledger or historical changes.
Unexpected files changed: none.
Known limitations: responsible administrator must save the initial month count and date basis; until then ordinary Savings loan access is disabled and explicit one-request exceptions remain possible. No production write tests were performed.
Evidence: docs/qa/H-SAVINGS-LOAN-ELIGIBILITY-001.json productionRelease; GitHub Actions runs above; local private recovery captures under .tmp/savings-loan-eligibility.

### Post-publication architect review

Verdict: APPROVED. Compared production DB ACL/RLS/backup readback, gateway responses, active Edge markers, exact served frontend, CI results and live browser receipts against the authorized release. All requested code is deployed; business configuration is intentionally left to Finance. No additional implementation or production test loan is authorized by this review. Next instruction: close this release and have the responsible administrator choose and save the real minimum period and date basis through the published panel.
