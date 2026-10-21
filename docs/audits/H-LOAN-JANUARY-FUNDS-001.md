# H-LOAN-JANUARY-FUNDS-001

## PRE-CHANGE AUDIT

- Objective: implement the owner's confirmed 2027/2028 advance catalog without duplicate funds or rules.
- Authorization: owner supplied 48 Base conditions (16 funds x 3 unions), plus Eventuales/SUTISSSTESON/2026-11-30; excluded six absent April funds and confirmed April 15 means Incentivos trimestrales. Subsequent `continua` authorizes this implementation.
- Planned business delta: only January 15, 2027 and 2028 Incentivos trimestrales are missing from the Base list: two funds, six Base rules (SUTISSSTESON, SUEISSSTESON, SITISSSTESON), maximum 10000, rate 6%, one payment, AUTO, exact maturity dates. Verify all 42 existing Base rules and the Eventuales condition before any write. Do not duplicate or silently overwrite a conflicting existing rule.
- Preserve: existing calculations, calendar, administrative fees, cutoff one calendar month before maturity, opening horizon, document requirements, security and all historical requests. No Google/Apps Script or financial balance writes.
- Authority: public.financial_programs / financial_funds / financial_rules, active Supabase authority. Session snapshots are derived and invalidated by existing writers.
- Readers: financial-legacy catalog/overview/session; get_financial_admin_catalog; funds-store; Suti Prestamo.
- Intended writers: existing permission-checked save_financial_fund, save_financial_rule_draft and publish_financial_rule. Verify live definitions, audit events, uniqueness, active-batch projection and recovery first.
- Initial file scope: this audit, .tmp/loan-january-funds/ private preparation/backup, docs/qa/evidence/loan-january-funds/ sanitized results; final task entry in docs/AGENT_CHANGELOG.md. Expand before any additional code/schema change if a demonstrated compatibility defect prevents the authorized addition.
- Risks: duplicate normalized names/audiences, wrong rate normalization, fixed-size runtime guard, native rule identity collisions, partial publication, stale session. Inspect and test before production mutation.
- Verification: live read-only preflight, isolated integration with actual definitions, idempotency, existing-rule equivalence, explicit recovery, backend/admin readback and focused UI reads. No synthetic loans or other business fixtures in production.
- Recovery: durable audit and exact private before-state; withdraw only newly created offerings using existing controls, preserve history and audit. Test recovery before activation.
- Initial architecture lookup: FRESH, financial_rules; no structural change was planned at that stage.
- Initial audit status, before implementation: AUDIT in progress; no production mutation had yet been performed. Final applied status and verification are recorded below.

## Scope constraints

Do not create January/April alternatives other than the two authorized January funds. Specifically excluded: April 8/15 Años de servicio and April 30 Incentivos trimestrales in both 2027 and 2028. Existing April 15 Incentivos trimestrales remain unchanged. The initial implementation did not include commit/push; the later explicit publication authorization is recorded below. Unrelated deployment or UI redesign remains excluded.

## Audited compatibility expansion

Live preflight confirms the Eventuales condition already matches exactly; no change is needed. It also confirms three native-catalog defects affecting the authorized additions: get_financial_runtime_rules rejects any total other than the imported 146; native rules share projected identifiers when their version numbers match; the visibility writer/Edge only accepts legacy identities. Preserve legacy identifiers and all formulas while allowing real native UUID identities, retain a nonempty/authoritative catalog guard, and retain existing writer permissions/audit/invalidation.

Expanded file scope before implementation: supabase/migrations/20261020000100_native_financial_rules.sql and matching recovery (subject to live numbering check); supabase/functions/financial-criteria-admin/index.ts; scripts/test-native-financial-rules.js; scripts/test-financial-criteria-native-identity.js; scripts/fixtures/native-financial-rules-baseline.json (schema/functions only, no personal data); docs/MIGRATION_RULES.md, docs/AGENT_CHANGELOG.md. No browser source, shared helper, financial engine, historical row or imported provenance changes. Existing function signatures/ACLs remain unchanged. Native UI/financial behavior will be verified through existing readers.

Deployment is limited to the necessary database function-body correction and financial-criteria-admin Edge validation, plus the two funds/six rules. No unrelated dirty workspace source will be published. Source updates and recoveries are guarded against live definition drift and tested in isolated PostgreSQL before production use. The change is within the owner's requested ability to create functional rules; no new financial-policy choice is introduced.

Operational payload scope: scripts/operations/20261020-loan-january-funds.sql. It will call existing audited writers under the authenticated administrator's verified identity, atomically with duplicate/conflict checks and before/after preservation checks; rerunning is a no-op. It contains only the explicitly authorized two funds/six rules. All 42 existing Base conditions and the Eventuales condition match the owner's table in live preflight and require no mutation.

Governance scope addition: docs/DECISIONS.md, docs/SOURCE_OF_TRUTH.md and docs/INVARIANTS.md. INV-110's 146/35/3 counts describe the certified imported baseline; the owner's explicit new offerings authorize six native additions without altering that historical import/provenance. Document this distinction rather than rewriting the imported counts.

## Implementation and live verification

- Live comparison: all 42 existing Base conditions and the Eventuales/SUTISSSTESON November 30, 2026 condition match the supplied table. No changes to those rows.
- Migration 20261020000100 applied with the two-fund/six-rule payload in one repeatable-read transaction. The caller authenticated with the configured administrator and independently verified its token/user and five permissions before using that same JWT context for the audited database writers. No role assignments or security policies changed.
- The transaction preserves all pre-existing funds and rule rows, and exact fingerprints of financial_programs, financial_criteria_authority, financial_criteria_import_batches and all 419 program_requests. OIDs, owners and ACLs of the three changed functions remain unchanged. Native additions create 14 existing-format audit events; derived snapshots are invalidated by existing writers.
- A second execution in the same transaction creates zero funds/rules/audit events. Publication results: 37 funds, 193 total rule versions, 152 runtime rules. The six excluded April offerings remain absent.
- All 187 prior rule rows and 35 prior funds are identical in readback. Of the prior 146 runtime rules, 141 are legacy and remain identical, while five already-native rules (Caja Chica/Caja de Ahorro) receive their stable UUID-based technical selector IDs. Their other projected fields and complete database rows remain identical. This corrects a pre-existing collision (five native rules previously produced only four distinct IDs). The initial all-runtime-equal verification correctly flagged this intended selector change; verification and the isolated fixture now explicitly check this distinction. No business conditions or request snapshots were rewritten.
- financial-criteria-admin source was recovered from deployed ESZIP. The only candidate source change is native UUID identity validation. Compilation did not activate the candidate (v28 remained active); explicit deployment activated v29, JWT enabled. Source readback matches candidate and all 21 bundled dependencies match; only deployment-version bytes change in runtime metadata.
- Authenticated admin RPC and Edge catalog expose both funds, each with three Base rules. On October 20, 2026, January 2027 is AVAILABLE and January 2028 is SCHEDULED. Read-only quotes for all three unions return principal 10000, interest 3600, administrative fees 90, total 13690, one repayment, using ADVANCE_PAYROLL_INTEREST_V1. This is an observed quote for this date, not a new constant or policy.
- Live native UUID validation reaches the existing backend fingerprint boundary (nonexistent record HTTP409); anonymous request HTTP401. No test configuration changes or synthetic records.

## Verification evidence

- `node scripts/test-native-financial-rules.js`: isolated actual schema/definitions, migration, operational payload and recovery; synthetic identities only. Includes native pre-existing identities, legacy equivalence, duplicate/conflict rejection, missing-union atomicity, rate/calendar fields, permission denials, audit, snapshot invalidation and retry.
- `node scripts/test-financial-criteria-native-identity.js`: PASS, 70 checks against the actual Edge validator.
- `node scripts/test-financial-program-visibility.mjs`: PASS.
- `node scripts/test-financial-supabase-cutover.js`: PASS (historical cutover contract; historical counts in its output are not current runtime counts).
- `node scripts/test-loan-advance-interest.js`: PASS, 129 checks, financial formula and history preserved.
- `node scripts/test-loan-dated-fund-cutoff.js`: PASS, 140 checks.
- Evidence: [isolated](../qa/evidence/loan-january-funds/isolated.json), [activation](../qa/evidence/loan-january-funds/activation.json), [live](../qa/evidence/loan-january-funds/live.json), [security](../qa/evidence/loan-january-funds/security.json). Private exact source/schema/catalog backups are in `.tmp/loan-january-funds/` and contain no plaintext credentials.
- Frontend build and global image regression: NOT APPLICABLE; no browser source, bundle, shared app helper, auth, routing, service worker, asset, viewer or storage change. Existing screen structure and readers are preserved. Focused published browser verification is tracked separately.
- Registry: no structural architecture change; existing function signatures, repositories, routes and authority are unchanged. Body/test/document changes do not require a falsely refreshed structural registry.

## Recovery

Use the existing permission-checked fund writer to disable only the two new January offerings (match their exact code and captured UUID). Preserve all six rule rows, audit events and any request history. Then apply the guarded recovery SQL only if the runtime returns to 146; recovery refuses a larger catalog so that it cannot restore the old fixed-size gate over active additions. Restore the exact previous Edge source from private backup only if withdrawing native management support is appropriate. The isolated test verifies rejection before withdrawal and exact function/OID/ACL restoration afterward. No production recovery or withdrawal was executed.

## Published browser and UI preservation

PASS on sutiapp.com in a fresh browser context: both administrative fund cards,
three rendered rules per year with the approved values, January 2027 visible and
selectable in Suti Préstamo, January 2028 absent from available options, and
successful refresh of both flows. The quote uses the existing interest/fee
contracts. No request was submitted and no business writer was invoked. Three
temporary derived loan sessions were created by normal screen loading.

Existing sections, filters, tabs, fund carousel and selection remain; no UI source
or styling was changed. Admin navigation used the existing DOM click handlers
because the test runner's desktop pointer actionability timed out; loan opening
and fund selection used Playwright clicks. This is a focused rendering/controller
verification, not a general pointer-hitbox or service-worker regression audit.
Browser evidence has no screenshots or personal data:
[browser.json](../qa/evidence/loan-january-funds/browser.json).

## H-LOAN-JANUARY-FUNDS-001 RESULT

Status: PASS — authorized catalog additions applied and published readers verified.
Files changed: focal migration/recovery, operational SQL, financial-criteria-admin validator, two focused tests, schema-only fixture, this audit, sanitized evidence, governance clarification and AGENT_CHANGELOG entry. Private preparation/backups in the declared .tmp path.
Source-of-truth verdict: SAFE — same Supabase authority; no fallback or fabricated legacy provenance.
Invariant verdict: PASS — scope, exclusions, no duplicates, preserved conditions/history, native IDs and owner-authorized INV-110 clarification verified.
Build: PASS — Edge compile/deployed-source/dependency parity; frontend build NOT APPLICABLE.
Tests: PASS — 166 SQL integration assertions, 70 validator checks, visibility/cutover suites, 129 interest checks, 140 cutoff checks, authenticated live catalog/quotes/security and published Admin/loan refresh.
Security: PASS — prior RLS/ACL/OIDs/owners unchanged, authenticated actor and writer permissions verified, native missing identity 409 and anonymous 401; no credentials in evidence.
Legacy impact: no Google, Apps Script, formulas, balances, payments or historical request edits; all 419 requests unchanged during activation.
Unexpected files changed: none by this H; pre-existing dirty workspace changes preserved and excluded from deployment.
Known limitations: no real loan submitted; tests use isolated synthetic identities for destructive/error/recovery cases. Browser service workers blocked and Admin navigation uses existing DOM handlers; global assets/UI hitboxes are outside this backend/configuration change.
Evidence: docs/qa/evidence/loan-january-funds/{isolated,activation,live,security,browser}.json; exact private backups .tmp/loan-january-funds/.

## Independent architect review

APPROVED after independent read-only production verification and focal documentary
correction. Reviewer confirmed prior data/fingerprints, six prior snapshots retained
and invalidated, exact authorized additions, absence of excluded funds, artifact
hashes and published-browser evidence. No pending findings or owner decision.
Next instruction: close this H and report the configured offerings; do not start
another task. Missing WORK_QUEUE_HISTORY.md does not authorize automatic continuation.

## Owner-authorized repository publication

The subsequent instruction `haz push comit y publica` explicitly authorizes
committing, pushing and publishing this completed H. Prepare a clean worktree
under `.tmp/loan-january-funds/release` from the latest origin/main; transfer only
the H's source/migration/tests/fixture/operation/audit/evidence and exact H-specific
governance entries. Preserve the main workspace and exclude all unrelated dirty
changes, private backups, credentials and temporary scripts. The backend is
already active; publication must not rerun business writes or withdraw offerings.
Run focal tests and the public artifact build on the exact publication tree,
review the diff, push normally (no force), and verify GitHub Pages/production.
Publication evidence scope: `docs/qa/evidence/loan-january-funds/release*.json`.

## Repository publication result

PASS. Source commit `8d598dbd26e80e6f86c73f7904a513ebc448a601` was pushed normally to main from
the isolated worktree based on `46b714a4c8b544827c9be319b02940ba2eff8d5b`. The
18-file implementation package excludes all unrelated workspace changes.
Both GitHub workflows passed: Pages 39530393218 and Membership 39530393216.
The exact release tree passed the focal gates and 31-file public build; all 30
servable public files match https://sutiapp.com/ after text line-ending normalization.
The existing interest test passed after using the unchanged Git LF fixture bytes;
no historical migration or test modification was committed.
Post-deployment Auth/request compatibility and focused published browser checks
passed, including both administrative funds, six rules and loan visibility/refresh.
No business operations or migrations were reapplied and no real loan was submitted.
The final evidence-only commit records these results and uses [skip ci] because
it changes no deployed source. Prior frontend and main workspace remain intact.
Evidence: [release.json](../qa/evidence/loan-january-funds/release.json) and
[release-browser.json](../qa/evidence/loan-january-funds/release-browser.json).
