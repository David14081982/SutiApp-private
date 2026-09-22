# H-LOAN-ADVANCE-ADMIN-FEE-001

## PRE-CHANGE AUDIT — 2026-09-22

Status: PASS for implementation; production release is not yet authorized.
Owner: a dated advance is repaid once but accrues $15 for each payroll period
until its due date. Three months / six fortnightly periods costs $90. Owner
confirmed TODAY means the date the affiliate submits the request, not approval,
delivery or a later viewing date. Simulation uses today's provisional date;
submission fixes the date and amount permanently. Years 2026 onward are in scope; 2025
and historical requests are preserved.

Interpretation: count actual payroll dates strictly after today through the
event date inclusive. Active employees: 15 and 30, February 28 even in leap
years; retired/pensioned employees: day 05 monthly. Today uses America/Hermosillo.
An event before today cannot produce a new quote. A same-day event has zero
remaining periods. Interest, capital, limits and one final payment are unchanged.

Authority: Supabase financial_programs/financial_funds/financial_rules; the date
comes from available_on and the employee calendar from the authoritative category.
The server derives the fee. program_requests snapshots preserve agreed amounts.
No new financial master, Google reader/writer, persistent client cache or fallback.

Evidence: deployed resolve_suti_loan_quote_contract_v1_engine multiplies 15 by
p_term and never reads available_on (read-only inspection 2026-09-22).
Git baseline 1b1fd90 (2026-08-25) already has the same JavaScript formula;
80ae7a3 moves it into SQL on 2026-08-26. fe6fa60 excludes column L on 2026-08-27.
Google SutiApp Final / Criterios de fondos!L79:L84 and Criterios Simuladores!L40:L48
retain TODAY-based half-month formulas. They are historical evidence, not a runtime
authority, and do not enumerate the payroll dates explicitly required by the owner.
The exact earlier regression date cannot be established from this Git history.

Scope/files: this audit; a new 20260922000300 loan advance fee migration and
matching recovery; financial-legacy/index.ts; scripts/test-loan-advance-fee.js,
scripts/test-loan-advance-fee-baseline.json, scripts/capture-loan-advance-fee-baseline.js;
docs/AGENT_CHANGELOG.md; docs/SOURCE_OF_TRUTH.md, docs/INVARIANTS.md and docs/DECISIONS.md
for the owner-confirmed exception and prepared/deployed distinction; architecture
Registry outputs for the new internal functions/trigger. Add a date-consistency
trigger on program_requests so a midnight race cannot save a prior-day quote.
Tests may use existing isolated PostgreSQL/WASM dependencies. No real loan fixtures.

Plan: preserve the certified V1 engine for other loans; correct only dated
single-payment advances in the existing server resolver; carry explicit period
count/calendar/date evidence; invalidate old/day-crossing loan sessions; preserve
submitted advance amounts at approval; compile migration/recovery against actual
function definitions and test calendars, money, scope, grants and recovery.

Risk: financial under/overcharge, stale quotes, historical repricing and effects
on other callers. Test zero/one/multiple periods, three months, month/year boundaries,
February 2028, monthly retirees, past events, 2025 exclusion, ordinary loans/products,
rounding, snapshot version/date checks and approval preservation.
No existing business rows will be rewritten. Recovery restores exact definitions
and refuses to erase the contract after new advance request history exists.

Guardians: source-of-truth SAFE; Google READ ONLY; migration and Supabase security
review required before apply; UI preservation NOT APPLICABLE (no frontend edits).
Architecture lookup financial: STALE only due to already-committed savings summary
files; targeted code inspection used. Initial git working tree clean.

## Verification

`node scripts/test-loan-advance-fee.js`: PASS, 110 checks. Reproduced $15 with
the captured production engine, then verified six fortnightly charges = $90,
three monthly charges = $45, one final payment, unchanged interest, calendar
boundaries including February 2028, 2025/ordinary-product equivalence, request-date
INSERT guard, midnight/old-session/cross-actor rejection, exact recovery and
refusal after new history. Actual SQL definitions run in isolated PostgreSQL/WASM;
Edge helpers execute from the actual TypeScript source. Approval months later
and criteria changes preserve the captured amount and original request date.
The last three checks cover release compatibility: new Edge rejects an old
database's advance quote, accepts the corrected result and retains ordinary
product compatibility. Release order: reviewed Edge first, then this SQL; the
short transition fails closed, never silently confirms the old $15 calculation.

`node scripts/test-program-product-financing.js`: PASS, 36 checks.
`node scripts/test-savings-loan-eligibility.js`: PASS, SQL and Edge checks.
`node scripts/test-financial-supabase-cutover.js`: PASS.
Full financial-legacy TypeScript stripped and parsed with `node --check`: PASS.
`node scripts/build-pages-site.js .tmp/loan-advance-fee/site`: PASS, 25 files.
The Windows checkout uses CRLF in vendor files; only the temporary build's three
vendor files were normalized to LF after verifying exact existing SHA-384 SRI.
No vendor source, integrity string, frontend or service worker was changed.

`node scripts/test-global-image-regression-production-live.js`: PASS on GitHub
Pages and LOCAL_BUILD_WITH_PRODUCTION_BACKEND at http://localhost:8080/.
Both cover 190 app assets, 226 catalog assets, profile, Login seal, Admin affiliate,
image/PDF documents, Membership, Loan, Marketplace, galleries/fullscreen, refresh
and comparison with/without service worker. Zero reported production data mutations.
These are current frontend/backend regression checks, not proof the new fee is
deployed. Initial local attempts failed due to directory URL, missing generated
configuration and Windows SRI bytes; the final generated build passed.

Supplemental `test-loan-simulator-ui-cutover.js` reaches a pre-existing PWA version
assertion: HTML 279 vs sw.js 278. `git show HEAD:sw.js` confirms this before the H;
both files are untouched. This UI-only assertion does not invalidate the isolated
financial checks or the successful global browser regression, but is a known
release-maintenance issue. No frontend bundle regeneration is needed for this H.

`git diff --check`: PASS. No real loan, financial row, Google cell, Storage object,
role, permission or production function was modified. Source capture was read-only.
The full registry regeneration was stopped for runtime cost before writing outputs;
the exact incremental set includes existing committed savings-summary stale entries.

## H-LOAN-ADVANCE-ADMIN-FEE-001 RESULT

Status: PASS — local implementation and focused verification only; not deployed.
Files changed: financial-legacy/index.ts; new migration/recovery; baseline capture
and isolated test/baseline; this audit; SOURCE_OF_TRUTH, INVARIANTS, DECISIONS,
AGENT_CHANGELOG; derived architecture Registry artifacts.
Source-of-truth verdict: SAFE — same Supabase authorities; immutable submission date.
Invariant verdict: PASS — one final payment, historical amounts and identity preserved.
Build: PASS — SQL compile/recovery, Edge syntax, local Pages artifact.
Tests: PASS — 110 focal + 36 product + savings/criteria + both global browsers;
supplemental UI cachebuster assertion has the documented pre-existing failure.
Security: PASS in isolated scope — unchanged public function grants/owners;
private calendar and forced-RLS backup inaccessible to browser roles;
anonymous/cross-actor/stale sessions rejected by actual RPC guards.
Legacy impact: READ ONLY investigation; no Google/runtime reader or writer added.
Unexpected files changed: none; temporary build/test artifacts under ignored .tmp.
Known limitations: production installation and Edge deployment pending; existing
missing future funds are not fabricated/imported, and 2025 is excluded.
Evidence: commands and source references above, scripts/test-loan-advance-fee-baseline.json.

## SUTIAPP ARCHITECT REVIEW

Task: local implementation against the owner's confirmed request-date contract.
Verdict: APPROVED for the local candidate; not a production release approval.
Critical findings: server calendar separates fee periods from paymentCount;
INSERT enforces request date and Edge rejects a quote that crosses midnight;
approval preserves both older advance snapshots and the new immutable contract.
Source of truth: unchanged Supabase; Google formulas are historical evidence only.
Architecture: one existing public resolver; private deterministic calendar and
date-consistency trigger; no new financial master or productive fallback.
Security: existing Auth/identity/impersonation gates and grants retained.
Data: no production business edits, backfill, new funds or historical repricing.
Legacy: no Apps Script, formula, amortization, balance or reconciliation writes.
Owner decision: NO for the already-confirmed calculation.
Next action: complete the release separately when deployment is authorized;
compare live definition hashes before applying and verify real reads afterward.
Response generated for Codex: YES.

### RESPONSE TO CODEX

Accept the local candidate within its documented scope. Do not mark production
fixed. A release must deploy the corresponding Edge source first, then only this migration,
preserve all business rows and verify date-bound quotes without fabricated loans.
Do not bulk-push migrations or reimport missing funds. The dated WORK_QUEUE does
not authorize a new productive test loan; WORK_QUEUE_HISTORY.md is absent.

## Release authorization - 2026-09-22

Owner explicitly instructed "haz commit publicalo". This authorizes committing,
pushing main, deploying financial-legacy and applying only migration
20260922000300 after live hash preflight. Extend verification scope to read-only
production quote checks, business-row fingerprints, deployed Edge markers and
Pages workflow. Temporary release scripts/receipts stay under ignored .tmp.
No historical migration reconciliation, new loans or business-data updates.
Deployment order: Edge compatibility guard first, then exact reviewed SQL.
Recovery: checked-in exact-definition restoration, prohibited after new history.


## Production release verification - supersedes local-only status

Owner authorized commit/publication on 2026-09-22. Live preflight matched all
three reviewed function hashes. Supabase compiled the candidate, financial-legacy
v51 deployed ACTIVE with verify_jwt=true, then migration 20260922000300 applied
at 2026-09-22T19:39:09Z. Only its new tracking row was registered in the same
transaction; no reconciliation of earlier migration tracking.
Migration SHA256: c1b767ce2bf6629200af8c6557007012b707565d4bca103da5ad3e03d8a0a50b.

Authenticated loanSessionQuote and resolve_current_loan_snapshot_quote agreed on
all three currently available real advance funds: 2026-10-15 = $30 (2 dates),
2026-11-30 = $75 (5 dates), 2026-12-15 = $90 (6 dates), with one repayment each.
Anchor 2026-09-22 America/Hermosillo. No loan was submitted. Opening a simulator
uses the existing ephemeral session cache; the before/after fingerprints of all
3 programs, 35 funds, 170 rules and 120 requests were identical.
An initial parallel quote check was invalidated by another browser test opening
a replacement session. Repeating sequentially passed; no code change required.

Both required global image regressions passed AFTER backend deployment: local
build and GitHub Pages, 190 app assets / 226 catalog assets / 29 legacy images,
legitimate PDF, seal, profile, Admin, Membership/Loan documents, program gallery,
Marketplace, fullscreen, refresh and service-worker comparison. Browser errors=0;
business mutations=0. The 110 isolated calculation/security/recovery checks passed
again before deployment. The pre-existing supplemental UI cachebuster assertion
remains outside this change and is not reported as passing.

H-LOAN-ADVANCE-ADMIN-FEE-001 RESULT
Status: PASS - production backend verified; Git publication follows this evidence.
Files changed: only declared financial function, migration/recovery, test/capture,
governance/audit and derived Registry files; no frontend source or bundle changes.
Source-of-truth verdict: SAFE - existing Supabase authorities only.
Invariant verdict: PASS - one repayment, actual request date, historical amounts.
Build: PASS - Supabase compilation; existing public artifact unchanged.
Tests: PASS - 110 focal and both post-deploy global browser suites; live quotes agree.
Security: PASS - JWT required; private calendar denied to browser; exact backups.
Legacy impact: no Google writes or productive Google dependency introduced.
Unexpected files changed: none; temporary support/evidence under ignored .tmp.
Known limitations: existing UI cachebuster assertion and absent future funds unchanged.
Evidence: sanitized live receipt below; checked-in regression and recovery scripts.

SUTIAPP ARCHITECT REVIEW
Task: owner-authorized production release of request-date administrative fees.
Verdict: APPROVED for backend installation and production validation.
Critical findings: exact live preflight; immutable history; Edge/RPC agreement;
shared-screen regression passed; private backup/grants and trigger verified.
Owner decision required: NO - explicit commit/publication instruction applies.
Response to Codex: commit the declared files, push main, verify Pages workflow and
remote commit. Do not create a test loan, backfill funds or reconcile old tracking.

```json
{
  "status": "PASS",
  "at": "2026-09-22T19:43:55.212Z",
  "quotes": [
    {
      "due": "2026-10-15",
      "anchor": "2026-09-22",
      "dates": [
        "2026-09-30",
        "2026-10-15"
      ],
      "periods": 2,
      "fee": 30,
      "paymentCount": 1,
      "edgeRpcMatch": true
    },
    {
      "due": "2026-11-30",
      "anchor": "2026-09-22",
      "dates": [
        "2026-09-30",
        "2026-10-15",
        "2026-10-30",
        "2026-11-15",
        "2026-11-30"
      ],
      "periods": 5,
      "fee": 75,
      "paymentCount": 1,
      "edgeRpcMatch": true
    },
    {
      "due": "2026-12-15",
      "anchor": "2026-09-22",
      "dates": [
        "2026-09-30",
        "2026-10-15",
        "2026-10-30",
        "2026-11-15",
        "2026-11-30",
        "2026-12-15"
      ],
      "periods": 6,
      "fee": 90,
      "paymentCount": 1,
      "edgeRpcMatch": true
    }
  ],
  "preservedBusinessCounts": {
    "financial_programs": 3,
    "financial_funds": 35,
    "financial_rules": 170,
    "program_requests": 120
  },
  "guards": {
    "exact_backups": 2,
    "tracking": 1,
    "active_trigger": 1,
    "browser_execute": false,
    "engine_hash": "d2cc0ef9e84d7cad725a14ac5a79d162"
  },
  "deployedBundleSha256": "e409ac56bf1870c20adb16f0529f9c2759048fe253b21057d48b29f87280c3a2",
  "newLoanRequests": 0
}
```
