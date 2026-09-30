# H-SAVINGS-INDIVIDUAL-WITHDRAWAL-UX-001

## Release authorization — 2026-09-30

Owner explicitly instructs “hazlo y haz commit y publica”. This supersedes the
local-only release status below. Release scope: install only migration 20260930000100,
commit the focal change in an isolated checkout of current main, publish through the
existing Pages workflow, and verify actual deployed UI/RPC without enabling or
submitting a real withdrawal. Extend file scope to release/package/live verification
scripts named `savings-individual-withdrawal` and release evidence. Compare aggregate
financial hashes within the apply transaction; retain every existing row. No other
dirty workspace work is included. Existing permissions and recovery remain unchanged.

## AUDIT / AUTHORITY / PLAN / RISK

Owner requests enabling an individual withdrawal directly in the saver account, without changing money, other screens, or existing functionality. Previous instructions to configure yield periods exposed an unnecessary dependency for this individual action.

PRE-CHANGE AUDIT
- Scope: individual withdrawal availability in historical and native Admin Savings accounts; explicit configuration permission; immediate authoritative readback; direct entry to the existing withdrawal request form.
- Files: new `app/savings-individual-withdrawal-repository.js`, `app/savings-individual-withdrawal.jsx`; `app/savings-panel-admin.jsx`, `app/savings-runtime-admin.jsx`, `scripts/build-bundle.js`; generated `app/bundle.js`; new focal SQL migration/recovery `20260930000100_savings_individual_withdrawal.sql`; new inspect/build/SQL/browser verification scripts with `savings-individual-withdrawal` names; this audit, `docs/AGENT_CHANGELOG.md`, `docs/SOURCE_OF_TRUTH.md`, generated architecture registry files; `.tmp/savings-individual-withdrawal/` and `docs/qa/evidence/savings-individual-withdrawal/` evidence.
- Authority: existing Supabase `savings_action_availability` is the sole authority for WITHDRAW availability. `savings_audit_events` retains actor, subject, reason and idempotency. New narrowly scoped RPCs read/write only this individual availability. No additional business authority or browser persistence.
- Excluded: balances, ledger, holds, yield periods/rates/allocations, contribution plans, requests, approval, settlement, loan checks, Google, Auth, shared assets/routing/service worker, global opening settings and other modules.
- New backend API avoids writing or inventing a yield period just to open an individual withdrawal. It only appends participant-scoped availability and audit, using the existing configuration permission and configuration lock. Migration adds functions and grants only; no existing data DML, no replacement of existing financial functions.
- UI contract: preserve account header/back/previous/next, balances, certification, requests/history, discounts, beneficiaries, review, original data and configuration. Add visible individual-withdrawal card in each account. Person fixed by exact Folio; display clear effective status and expiry. Only reason and expiry are requested when enabling; disabling remains explicit. Direct request entry reuses existing form/writer, no automatic request/payment.
- Read-only legacy classification. No Google reads/writes required; payment guard unchanged.
- Risk: availability authorizes accepting requests; prevent global scope, wrong person, stale response, retry duplication, permission escalation and false success. Existing individual-over-global priority remains unchanged.
- Tests: isolated PostgreSQL with actual relevant contracts; role denial, exact identity, zero periods, expiry, idempotency, no unrelated financial changes, recovery preservation. Offline browser: account navigation, both account types, permissions, errors/retries, duplicate click, fixed Folio, direct request entry, responsive layout and existing savings regressions. Build checks restricted to changed chunks; unchanged bundle chunks must remain byte-identical to pre-task workspace.
- Recovery: revoke/drop only the new endpoints and revert focal UI; preserve every availability/audit row. No financial rollback/deletion. Pre-task file hashes/backups distinguish already-dirty workspace from this H.
- Status: PASS for implementation and isolated verification. Production state/deployment must be reported separately; do not create a real withdrawal or authorization during tests.

## Verification

Implementation complete locally. The new card sits outside the collapsed sections
in both historical and native saver accounts. It reads the exact Folio and current
server permission/status, allows participant-only enable/disable, proposes an
editable seven-day expiry, requires a reason, and re-reads before reporting success.
Expiry is inclusive through the selected day in Hermosillo. Enabling does not
register a request; “Registrar retiro” opens the existing request form with WITHDRAW
selected and the Folio locked. Reusing that button preserves an existing withdrawal
draft; changing from another capture requires explicit discard confirmation.

SQL migration is additive and **NOT APPLIED**. There are no new tables, replacements
of existing functions, financial recalculations or edits to existing rows. It uses
the existing `savings-config` transaction lock and canonical identity guard, optimistic
version and immutable idempotent audit. It appends only individual availability
when an authorized operator confirms. The recovery removes only these two functions
and retains all existing and future audit/availability records.

Production read-only inspection confirmed zero yield periods, zero openings and
zero availability records, explaining the reported empty selector. Ledger (844),
requests (23) and plans (333) were fingerprinted, not modified. Current audit triggers
were inspected: the document trigger ignores the new event resource; append-only
history protections remain unchanged. No personal account data or credentials were
copied into evidence.

### Commands and evidence

- `node scripts/test-savings-individual-withdrawal.js`: PASS; real current column/check
  contracts, availability/identity functions and audit triggers in PostgreSQL/WASM.
  Covers no-period enable, another account unchanged, exact text Folio, permission/anon
  denial, changed actor/payload idempotency, stale versions, invalid dates, rollback
  on audit failure, disable, global precedence, expiry, identity/certification and recovery.
- `node scripts/test-savings-individual-withdrawal-browser.js`: source PASS.
- `SAVINGS_TEST_BUNDLE=1 node scripts/test-savings-individual-withdrawal-browser.js`:
  compiled bundle PASS including historical/native direct entry and external back,
  fixed Folio, denied controls, double-click, retry, failed readback, late responses and
  viewports 320/430/1440. Network blocked; synthetic identities only.
- `node scripts/test-savings-individual-withdrawal-regressions.js runtime`: PASS;
  all existing approval, payment, cancellation, loan-exception, reporting, publication
  and yield scenarios. The harness supplies the missing isolated GeneratedDocuments
  component; the original standalone fixture predates that dependency and initially
  failed before rendering. Assertions were not weakened.
- `node scripts/test-savings-individual-withdrawal-regressions.js panel`: PASS;
  unchanged existing assertions for paging, search, account detail, discount correction,
  review, return context, errors and responsive geometry. New card receives a read-only
  synthetic reader to keep this existing suite focused on its original contracts.
- `node scripts/test-savings-control-access-browser.js`: PASS, existing general controls.
- `node scripts/build-savings-individual-withdrawal.js`: PASS, only two replaced chunks
  and two added chunks; **139 other pre-task workspace chunks byte-identical**.
- Standard `build-bundle.js` with Babel in isolated source copy: PASS, 143 files.
- `build-pages-site.js .tmp/savings-individual-withdrawal/site`: PASS, 28 public files.
- `git diff --check`: PASS for focal sources. Production writes: zero.

### Guardians

Source of truth: SAFE. Existing availability and audit only; no new business authority.
Legacy: READ ONLY; no Google reads/writes or loan logic changes.
Security: PASS in isolated tests; production role provider is preserved, not simulated
in the application. Full live role integration is a deployment verification item.
Migration: PASS as a candidate; existing schema/ACLs unchanged; recovery retains history.
Global image regression: NOT APPLICABLE. No shared assets, routing, Auth, service
worker logic or cross-surface helpers changed; dedicated new repository is account-only.

CLAUDE UI PRESERVATION REVIEW
- Screen: Admin Savings account (historical/native).
- Original/current sections: header, balance, previous/next, certification, requests,
  discounts, registered withdrawals, audit, review and original data retained.
- Missing sections: none.
- Added: individual withdrawal card; direct entry into existing request section.
- Interactions/navigation/structure preserved: PASS by existing panel regression.
- Unauthorized redesign: NO; changes limited to owner-requested individual withdrawal.
- Verdict: PASS.

H-SAVINGS-INDIVIDUAL-WITHDRAWAL-UX-001 RESULT
- Status: PASS — local implementation and isolated verification; NOT DEPLOYED.
- Files changed: declared focal sources, new migration/recovery/repository/component,
  build/test/inspection helpers, sanitized schema fixture, governance and registry evidence.
- Source-of-truth verdict: PASS.
- Invariant verdict: PASS; no historic or financial values rewritten.
- Build: PASS, full isolated build and focal compiled artifact.
- Tests: PASS as listed above.
- Security: PASS isolated; existing live permission function untouched.
- Legacy impact: none.
- Unexpected files changed: none; tracked-file hashes and pre-task dirty status verified.
- Known limitations: no production apply/release or physical-device testing; expiry
  still governs request and payment per the existing backend; enabling is not payment.
- Evidence: `docs/qa/evidence/savings-individual-withdrawal/`.

## ARCHITECT REVIEW

Task reviewed: local individual withdrawal UX correction; user prohibits financial
data damage and unrelated regressions. Verified against diffs and actual test output,
not against implementation claims alone. `WORK_QUEUE_HISTORY.md` is absent; the
existing WORK_QUEUE is a separate legacy master plan and does not authorize release.

Verdict: APPROVED for local candidate. Explicit deployment is a separate next action.
Critical findings: original opening forced period setup despite individual scope;
new narrow writer changes only participant availability with existing permissions.
Source of truth / architecture / security / data / legacy: preserved as above.
Owner decision: NO new financial or UX decision required for the implemented scope.
Response generated for Codex: YES. Autocontinuation: NO; no orchestrator release grant.

RESPONSE TO CODEX
Approve the verified local candidate. For an authorized release, apply only migration
20260930000100 after live-definition/grant preflight and aggregate data fingerprints,
then publish only the focal chunks and required cachebusters. Do not enable a real
account or submit/pay a real request as a test. Verify the installed RPC permissions,
unchanged financial data and compiled account UI, including the empty-period case.
Preserve the dirty workspace and all unrelated deployed chunks. Do not alter periods,
rates, balances, loan verification or historical rows.

Scope clarification: add the sanitized, schema-only `scripts/fixtures/savings-individual-withdrawal-schema.json` so SQL tests are repeatable without production access. Regression harness supplies only missing isolated component dependencies to the existing Savings browser suites; it does not alter their assertions or production modules. Current production schema was read to verify compatibility; no production test writes are authorized or performed. Deployment remains separate from local implementation.

Generated-artifact scope: `SutiApp.html` and `sw.js` only receive associated bundle/cache
version increments (300→301, 234→235). No shell, caching, routing or service-worker
logic is modified. Existing dirty content is preserved from the pre-task workspace.
These are GENERATED_ARTIFACT under AGENTS.md and do not trigger global image tests.


## Installed release candidate ? 2026-09-30

This section supersedes the historical local-only status above. Migration
20260930000100 is APPLIED with explicit owner authorization. All 12 protected
tables have identical before/after counts and complete row hashes inside the
installation transaction. Existing six financial/permission function definitions
match the preflight exactly. No business row was inserted, changed or removed.
Authenticated reader confirms the affected account is ready and the administrator
can configure and create. Anonymous access is denied; the two function grants are
authenticated-only with security definer and empty search_path.

Release is isolated from current published main 857e96ab3eb6c7ba962d9f68eceec5a79da50fed.
139 unrelated published bundle chunks are byte-identical; two focal chunks changed
and two dedicated chunks added. Compiled browser suite passed on this exact release.
Evidence: apply.json, installed-rpc.json, release-package.json.
Publication and deployed-browser verification follow the authorized commit.


## Final production result ? 2026-09-30

This is the current status and supersedes the local candidate history above.

H-SAVINGS-INDIVIDUAL-WITHDRAWAL-UX-001 RESULT
Status: PASS ? installed, committed, published and verified in production.
Files changed: declared individual Savings sources, additive migration/recovery, focal
bundle/cachebusters, build/verification scripts, metadata fixture, governance/evidence
and derived architecture registry.
Source-of-truth verdict: PASS; existing availability and audit remain authoritative.
Invariant verdict: PASS; identical hashes in all 12 protected tables during installation.
Build: PASS; 28-file public artifact, compiled browser tests and actual Pages workflow.
Tests: PASS; SQL, source/compiled browser, existing panel/runtime/control regressions;
full architecture registry suite; deployed hash and real account navigation.
Security: PASS; real authenticated read/configure context; anonymous reader denied;
SQL tests validate writer permissions, identity, versions and idempotency.
Legacy impact: none; existing financial functions and Google untouched.
Unexpected files changed: none; isolated release retains 139 unrelated published chunks
and the original dirty workspace remains intact.
Known limitations: no physical-device testing; real availability/request/payment writes
were deliberately not performed as QA. Existing request and payment checks still apply.
Evidence: deployment.json, production.json, apply.json, installed-rpc.json,
release-package.json and existing isolated regression reports.

Commit ee6ddc7c2ff969635881d7096d45aa1b29bb82d1 deployed successfully in workflow
36763291837. Browser on https://sutiapp.com/ used the real administrator and the
affected account: Ahorro > Ahorradores > account > Habilitar retiro. Motivo and
vigencia appear without a period or person selector; cancel performed no write.
The initial navigation test mistakenly remained on the existing default Pendientes
tab. Correcting the test to open Ahorradores passed without an application change.

SUTIAPP ARCHITECT REVIEW
Task: authorized individual withdrawal release.
Verdict: APPROVED.
Critical findings: none unresolved; deployed byte hash matches the tested release.
Source of truth: single existing authority. Architecture: additive account-only RPCs.
Security: backend permissions and exact identity enforced. Data: preserved. Legacy: unchanged.
Owner decision: NO.
Next action: close this authorized release; no new task is authorized by this review.
Response generated for Codex: YES.

RESPONSE TO CODEX
Approve and close H-SAVINGS-INDIVIDUAL-WITHDRAWAL-UX-001. Report the published commit
and the account-level path. Retain all evidence and the unrelated dirty workspace.
Do not create a real withdrawal or change any financial data as part of verification.
