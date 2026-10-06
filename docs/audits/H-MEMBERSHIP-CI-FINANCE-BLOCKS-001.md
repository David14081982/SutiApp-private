# H-MEMBERSHIP-CI-FINANCE-BLOCKS-001

## PRE-CHANGE AUDIT

- Objective: fix the stale Membership Google contract CI guard while preserving
  financial, historical and other-program protections. Direct owner instruction
  authorizes the correction; existing session authorizes commit/push/publication.
- Scope: tests and evidence only. Primary files:
  `scripts/test-membership-payment-contract.js`, new
  `scripts/test-program-request-finance-block-contract.js`, this audit,
  `docs/AGENT_CHANGELOG.md` (one H section), focused evidence under
  `docs/qa/evidence/membership-ci-finance-blocks/`; private preparation and clean
  release checkout under `.tmp/membership-ci-finance-blocks/`.
- Outside scope: app/repositories, UI, bundle/SW, Google/Apps Script, migrations,
  backend permissions, finance calculations, other pending local Hs.
- Navigator: membership/payment lookup confirms the existing contract test and
  shared request repository. Registry stale entries relate to the preceding H;
  directed inspection verifies current code. No architecture change expected.
- Baseline: CI fails at the strict historical source comparison, line 43.
  Only the approved H-FINANCE-BLOCKS-001 additions differ after already accepted
  module-read and membership changes are accounted for.
- Authority: program_requests/membership_offerings and existing membership
  quote RPC; finance_blocks is the existing restriction authority. Unchanged.
- Legacy: READ ONLY review; isolated fake transports only, no live writes or
  actual request, loan, financial register or Google calls.
- Security: preserve actual FinanceBlocksRepository behavior; isolated tests
  must exercise denial before write, raced denial and ordinary error propagation.
- Plan: recognize only exact approved source additions, retain full comparison
  for unrelated code, and exercise real request/block repositories in an isolated
  VM against explicit synthetic RPC responses. Keep all original payment,
  Google-projection, historical-request and UI assertions.
- Risk: overbroad ignore could mask writer regressions; mitigate with exact
  fragment counts, preserved baseline comparison, payload assertions and negative
  mutation checks. Marketplace must remain outside financial preflight.
- Recovery: revert only this test/documentation commit; no data recovery needed.
- Status: PASS for authorized test-only implementation.

## Guardian conclusions

Source of truth: SAFE; no new production reader/writer/cache/authority.
Legacy: READ ONLY; no production Google/financial changes.
Supabase security: no RLS, grant, Auth or function edits; synthetic RPCs test the
existing browser boundary, never substitute for the backend's access enforcement.
UI preservation: NOT APPLICABLE to modifications; no UI/production file changes.
Global image regression: NOT APPLICABLE; shared repositories are read/tested,
not modified. Frontend build/deployment content must remain identical.

## IMPLEMENT → VERIFY → EVIDENCE

The historic guard still compares all non-membership source against the same
audited baseline. It now accounts for exactly one conditional program preflight,
one membership preflight and two error-handler substitutions. Counts are required;
missing/duplicated guards and any other shared-code changes remain failures.

New test loads the actual request and restriction repositories into an isolated
VM with synthetic transport only. Fourteen scenario groups cover program and
membership denials, permitted exact payloads/idempotency, source failure/malformed
responses, concurrent server denial, original error identity, affiliate-context
change, invalid membership quote hash and unaffected ordinary Marketplace.
Five in-memory mutations prove detection of removed preflights, unwanted
Marketplace blocking, lost concurrent-denial handling and altered quantity.
The main CI test invokes both the behavioral suite and mutation checks.

Verification commands, all PASS:

- `node scripts/test-membership-payment-contract.js` (focal evidence directory).
- `node scripts/test-program-request-finance-block-contract.js`.
- `node scripts/test-membership-google-company-z.js`: six companies, unchanged
  other 32 columns, other programs, history, approval and retry behavior.
- `node scripts/test-finance-blocks-read-boundary.js`: loan reads/confirmations.
- Both test files pass `node --check`; focal `git diff --check` passes.
- Actual `scripts/build-pages-site.js` using the existing public configuration
  passes from the clean release checkout.

Release prepared in a clean worktree at remote main
`2f7803867c81a428624395a7cda48e0d704de9bb`. The two workflow scripts were executed
there against baseline `9f880bf0fcea96ecfc57cd1f80ef43cbd254cc8a`. The Google
test's historical output was copied to focal evidence and its identical generated
file restored; it is not part of this commit. Unrelated governance bytes and all
runtime source/asset hashes are preserved. Public checks on both domains verify
the existing bundle, SW and financial repository match the candidate. The
existing automatic Pages workflow can run without changing deployed app content.

## SUTIAPP ARCHITECT REVIEW

Task: H-MEMBERSHIP-CI-FINANCE-BLOCKS-001.
Verdict: APPROVED for the verified test-only candidate.
Critical findings: none.
Independent review executed both tests and independently mutated the historical
source guard: changed quantity, unrelated update RPC, removed/duplicated program
preflight and removed administrative read boundary were all rejected.
Source of truth: unchanged.
Architecture: unchanged; no structural Registry update required.
Security: actual existing guards preserved; isolated browser tests do not claim
to replace backend RLS enforcement.
Data / Legacy: zero production writes; Google and financial calculations intact.
Owner decision: NO.
Next action: push only this test/evidence scope and verify both GitHub workflows.
Response generated for Codex: YES.

### RESPONSE TO CODEX

Approve the focal candidate. Complete commit/push under the owner's existing
authorization; require Membership Google contract and Pages success and preserve
runtime hashes. Do not alter application code, permission boundaries, financial
calculations, Google or other Hs to resolve the CI comparison.

## H-MEMBERSHIP-CI-FINANCE-BLOCKS-001 RESULT

Status: local verification PASS; GitHub CI/publication pending.
Files changed: two tests, this audit, one AGENT_CHANGELOG section and focal evidence.
Source-of-truth verdict: SAFE, unchanged production authorities.
Invariant verdict: PASS; exact shared-code gate and original financial assertions retained.
Build: PASS public Pages artifact and JS syntax checks.
Tests: PASS four suites; 14 behavioral groups and five negative mutations.
Security: PASS for unchanged boundary/isolated assertions; no security configuration edits.
Legacy impact: none; zero external/production requests or data changes.
Unexpected files changed: none included; prior work preserved.
Known limitations: CI/publication still to be verified; no claim of new financial live transactions.
Evidence: ../qa/evidence/membership-ci-finance-blocks/ (contracts, projection, package, build, public hashes).
