# H-LOAN-ADVANCE-INTEREST-001

## Pre-change audit - 2026-09-23

Owner explicitly confirms simple interest on principal for the same payroll dates
as administrative fees: 10000 * 0.06 * 6 = 3600 interest; 6 * 15 = 90 fees;
13690 in exactly one final repayment. Request date remains the anchor, dates in
(request day, maturity], 15/30 (February 28) or monthly 05 for retirees.
2025 and existing submitted contracts remain excluded. No interest capitalization.

Status: PASS for implementation and verification. This H prepares the correction;
it does not rewrite existing requests or authorize a productive test loan.
Initial HEAD 64b82d1. Pre-existing unrelated edits: AGENT_CHANGELOG savings audit
entry and untracked H-SAVINGS-SEP15-READONLY-AUDIT-001.md; preserve exactly.
Navigator: STALE solely for those unrelated documentation files; financial source
and installed prior migration inspected directly.

Scope/files: financial-legacy/index.ts (session contract and compatibility guard);
new 20260923000200_loan_advance_interest migration/recovery after live numbering
preflight; scripts/test-loan-advance-interest.js; narrow compatibility adjustment
to scripts/test-loan-advance-fee.js; this audit; additive SOURCE_OF_TRUTH,
INVARIANTS, DECISIONS and AGENT_CHANGELOG entries; derived architecture registry
files if architecture metadata changes. Ignored .tmp/loan-advance-interest holds
test artifacts, read-only deployment baseline and temporary public build.

Authority: financial_programs/funds/rules hold eligibility, maturity and rate;
public.resolve_suti_loan_quote_contract is the single calculator. The existing
private payroll_periods calendar supplies both charges. program_requests stores
the immutable confirmed result. Edge and authenticated snapshot RPC are readers;
existing guarded submission/approval are the only business writers. No new cache,
fallback, Google reader, rate master or client calculation.

Plan: back up exact current quote/snapshot definitions, owner and ACL in a forced
RLS private table; retain certified engine for eligibility and ordinary products.
Replace only advance interest with round(principal * rule.rate_factor * periods,2),
round once after multiplying, update totals/term option interest and include
interest version/period metadata. V3 loan sessions and a matching Edge guard reject
old calculations; captured approval results already preserve old and new advances.
Deploy sequence, when released: guarded Edge first, then only this migration.

Risks/tests: 0/1/6 periods, monthly retirees, February/leap-year/year boundary,
non-whole-cent rounding, rate 0, all advance dates/categories, same-day/past dates,
2025/ordinary products, exact repayment and term option agreement, actual old-session
rejection, immutable prior approvals, ACL/owner equivalence and exact recovery.
Run focal product/savings tests and required local/Pages shared-function regression.
No financial data, Google formulas, amortization, ledger, profiles, permissions,
frontend design, assets, app bundle or historical migrations may be changed.

Recovery: restore exact saved functions only if installed definitions/privileges
still match and no new interest-version request history exists. Keep prior fee
calendar/trigger and original backup intact. No business-row deletion or backfill.
Source-of-truth: SAFE. Legacy: authorized financial correction, no Google changes;
equivalence required outside the explicit advance-interest exception. Security:
existing Auth/identity/impersonation/RLS guards retained; private backup has no API
grants. UI preservation: NOT APPLICABLE (no screen changes).

## Verification evidence

Read-only live preflight confirmed migration 20260923000200 is available.
Quote wrapper MD5 d7206f79c562115aa04287f609bfbc33; authenticated RPC
b59cd24cd6ed5473aac8934d1930c67c; engine d2cc0ef9e84d7cad725a14ac5a79d162.
The migration guards these exact definitions before replacing either function.

- `node scripts/test-loan-advance-interest.js`: PASS, 130 checks. Actual SQL,
  authenticated RPC with real pgcrypto/SHA256 profile/policy fingerprints and
  actual extracted Edge helpers. Acceptance: 10000 + 3600 + 90 = 13690, one
  payment. Rounding: 1234.56 * .06 * 6 = 444.44, not 444.42 from prematurely
  rounding each period. Zero interest, 0/1/6/12 periods, all six categories,
  named event types/dates from 2026-28, monthly retirees, February/year boundaries,
  2025 exclusions, caps, other products and term-option agreement covered.
  Existing requests and approvals retain their captured result months later and
  after rate changes. Exact recovery, private backup RLS/ACL, and refusal after
  new history/privilege drift verified. Existing request-date trigger unchanged.
- `node scripts/test-loan-advance-fee.js`: PASS, 111 checks. Final compatibility
  test installs the actual new interest migration and rejects old fee-only SQL.
- `node scripts/test-program-product-financing.js`: PASS, 36 checks.
- `node scripts/test-savings-loan-eligibility.js`: PASS, SQL/Edge checks.
- `node scripts/test-financial-supabase-cutover.js`: PASS.
- Full Edge TypeScript stripped and parsed with `node --check`: PASS.
- Public artifact build: PASS, 25 files. Only temporary vendor CRLF bytes were
  normalized after verifying exact existing SHA384 integrity. Source unchanged.
- Required global image regression: PASS local build and GitHub Pages; legitimate
  assets/PDF, Login seal, profile, Admin, documents, Loan/Membership, program
  galleries, Marketplace, fullscreen, refresh and service-worker comparison.
  These test existing surfaces/current backend, not a deployed interest candidate.
- Supplemental `test-loan-simulator-ui-cutover.js`: pre-existing FAIL at HTML
  v280 vs service-worker bundle v278. Both match HEAD and are untouched; prior H
  already recorded this mismatch (then HTML v279). Not reported as passing.
- `git diff --check`: PASS. No production DDL, business rows or Google modified.

## H-LOAN-ADVANCE-INTEREST-001 RESULT

Status: PASS - local implementation/verification; NOT DEPLOYED.
Files changed: declared Edge guard/version, migration/recovery, tests, audit,
governance and derived architecture registry files.
Source-of-truth verdict: SAFE - existing Supabase criteria and captured requests.
Invariant verdict: PASS - one payment; simple interest; same dates; history intact.
Build: PASS - SQL forward/recovery, Edge syntax and public artifact.
Tests: PASS - 130 interest + 111 fee + 36 product, savings/cutover and both global
browser suites; supplemental existing cachebuster failure recorded above.
Security: PASS - exact owner/ACL preservation, forced RLS backup inaccessible to
API roles; authenticated RPC rejects old sessions/date, cross-actor and hash drift.
Legacy impact: authorized calculation exception only; no Google/ledger changes.
Unexpected files changed: none; initial unrelated savings audit edits preserved.
Known limitations: not deployed; existing cachebuster mismatch; absent future
funds are not fabricated; no historical request is repriced.
Evidence: executable tests, read-only preflight hashes and browser summary below.

## SUTIAPP ARCHITECT REVIEW

Task: surgical implementation of owner-confirmed advance interest.
Verdict: APPROVED for local candidate, not a claim of production installation.
Review compared actual diff, SQL/Edge checks, live baseline and browser receipts.
WORK_QUEUE does not authorize a productive test loan; none created.
WORK_QUEUE_HISTORY.md is absent, as previously documented.
Critical findings: exact owner example and complete authenticated RPC pass; Edge
rejects old SQL; V3 rejects old sessions; old/new submitted results are preserved.
The new rate-period label follows the existing administrative calendar.
Source of truth: SAFE. Architecture: existing calculator plus private backup.
Security: existing permissions retained. Data/legacy: zero productive changes.
Owner decision: NO for the confirmed calculation and completed implementation.
Next action: release exact Edge/migration pair with fresh live drift checks.
Response generated for Codex: YES.

### RESPONSE TO CODEX

Accept this local candidate. Do not describe production as fixed. For publication,
deploy guarded Edge first, then only this migration; verify read-only quotes and
historical fingerprints afterward. Preserve unrelated savings-audit work. Do not
submit a test loan, import missing funds or bulk-push migrations.


```json
[
  {
    "target": "GITHUB_PAGES_PRODUCTION",
    "status": "PASS",
    "appAssets": {
      "status": "PASS",
      "checked": 193,
      "passed": 193
    },
    "programCatalogAssets": {
      "status": "PASS",
      "checked": 226,
      "passed": 226,
      "items": 118
    },
    "legitimatePdf": "PASS",
    "browserErrors": 0,
    "productionDataMutations": 0
  },
  {
    "target": "LOCAL_BUILD_WITH_PRODUCTION_BACKEND",
    "status": "PASS",
    "appAssets": {
      "status": "PASS",
      "checked": 193,
      "passed": 193
    },
    "programCatalogAssets": {
      "status": "PASS",
      "checked": 226,
      "passed": 226,
      "items": 118
    },
    "legitimatePdf": "PASS",
    "browserErrors": 0,
    "productionDataMutations": 0
  }
]
```

## Publication authorization - 2026-09-23

Owner explicitly requests PUBLICALO and lists 33 dated funds for 2026-2028.
Release scope: reviewed financial-legacy source, only migration 20260923000200,
new migration tracking in same transaction, commit/push and Pages verification.
Live discovery found 22/33 funds configured; missing 11: years-of-service April08
and April15 in 2026/2027/2028; quarterly incentives April30 in all three years and
January15 in 2027/2028. Conditions were requested; no category, rate or limit may
be invented. Formula covers all correctly configured single-payment advances;
missing catalog rows are not a deployed offering. Historical requests remain intact.
Temporary release drivers and sanitized receipts are under .tmp/loan-advance-interest.
Unrelated savings audit remains excluded from commit/publication.


## Production release - supersedes candidate-only status

Owner authorized publication and will supply an Excel for the 11 missing funds.
Financial-legacy v52 ACTIVE/JWT enabled deployed first; migration 20260923000200
applied 2026-09-23T19:11:19Z with only its own tracking row in the transaction.
SQL SHA256 6a6cc40439f1a3c51fbc3e3be4d1709b134ddf589eb4f6847be49bc8f02d2270.
Live Edge and authenticated RPC agree for all three currently available advances:
10000 principal, 6% rate, single repayment. October15: 1200 interest + 30 fees;
November30: 3000 + 75; December15: 3600 + 90 => 13690 total. Anchor September23.
Before/after fingerprints identical for 3 programs, 35 funds, 170 rules and all
136 requests. No loan submitted, no Google write. Two exact private backups,
original engine hash, active request-date trigger and private execute denial verified.

Coverage is 22 existing named funds across 2026-2028. The 11 absent offerings
remain pending authoritative Excel conditions, not silently created or published.
Past events remain expired; historical requests are never repriced.

Commit scope excludes the pre-existing Savings audit entry/document. Architecture
artifacts are generated from that publication projection, without mutating the
unrelated working files. A working-tree registry check may report those two
unpublished documentation changes; this is expected and not financial drift.

Final backend verdict: PASS. Catalog completeness: pending owner Excel (11 funds).
Architect release verdict: APPROVED for the existing 22 configured funds and
shared calculation; do not claim that all 33 offerings have been created.
Response to Codex: push only this release and verify Pages; preserve the pending
Excel follow-up and all unrelated Savings audit work.

```json
{
  "status": "PASS",
  "at": "2026-09-23T19:12:07.486Z",
  "quotes": [
    {
      "due": "2026-10-15",
      "anchor": "2026-09-23",
      "dates": [
        "2026-09-30",
        "2026-10-15"
      ],
      "periods": 2,
      "interest": 1200,
      "total": 11230,
      "fee": 30,
      "paymentCount": 1,
      "edgeRpcMatch": true
    },
    {
      "due": "2026-11-30",
      "anchor": "2026-09-23",
      "dates": [
        "2026-09-30",
        "2026-10-15",
        "2026-10-30",
        "2026-11-15",
        "2026-11-30"
      ],
      "periods": 5,
      "interest": 3000,
      "total": 13075,
      "fee": 75,
      "paymentCount": 1,
      "edgeRpcMatch": true
    },
    {
      "due": "2026-12-15",
      "anchor": "2026-09-23",
      "dates": [
        "2026-09-30",
        "2026-10-15",
        "2026-10-30",
        "2026-11-15",
        "2026-11-30",
        "2026-12-15"
      ],
      "periods": 6,
      "interest": 3600,
      "total": 13690,
      "fee": 90,
      "paymentCount": 1,
      "edgeRpcMatch": true
    }
  ],
  "preservedBusinessCounts": {
    "financial_programs": 3,
    "financial_funds": 35,
    "financial_rules": 170,
    "program_requests": 136
  },
  "guards": {
    "exact_backups": 2,
    "tracking": 1,
    "active_trigger": 1,
    "browser_execute": false,
    "engine_hash": "d2cc0ef9e84d7cad725a14ac5a79d162"
  },
  "deployedBundleSha256": "756961675da3355bf04d95cf57626fc31d1272b7f89c009410de92d689c573de",
  "newLoanRequests": 0
}
```


## Owner workbook comparison

Owner supplied Adelanto de nomina.xlsx, Hoja1, 104 physical rows. Read-only
comparison shows the same 22 distinct funds for 2026-2028. The missing 11
do not appear in the workbook either. Awaiting owner scope clarification; no
conditions inferred from 2025 or formula-only blank rows. Cached column G is
legacy evidence, not the request-date runtime calculator. No workbook changes.

```json
{
  "excelSha256": "c44143e33122026d9a0d0d4e0e48b5c1400e18ca20e78b9d9f3f03aed0d4e0eb",
  "sheet": "Hoja1",
  "physicalRows": 104,
  "selectedConditionRows": 67,
  "distinctFunds": 22,
  "matchingRows": 67,
  "mismatchedRows": [],
  "ignored2025Rows": 30,
  "notImported": "legacy computed periods, show flags or formula-only blank rows"
}
```
