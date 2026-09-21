# H-SAVINGS-P0-WITHDRAWAL-SETTLEMENT-001

## Release continuation — OAuth blocker resolved

Owner authorized restoration of the existing dedicated OAuth client in project
expanded-talon-506522-r7 (842095692451). Google consent completed as
soporte.sutiapp@gmail.com with the existing drive.file scope and explicit Picker
selection of SutiApp Final. Read returned HTTP 200 before replacing the three
GOOGLE_VISIBILITY_OAUTH secrets. Local client JSON removed; credentials not logged.
Production savings-settlement/source-status now returns HTTP 200, status PASS,
read_only true, sheetId 1245291756, 14927 scanned rows and 44 overdue loans.
The SERVICE_DISABLED blocker recorded below is historical and resolved.
Migration and Edge already installed; neither reapplied. No financial operations,
Google writes, new QA files or fixtures. Publishing validated frontend next;
deployment completion verified below.

### Final production closure — 2026-09-21

P0 WITHDRAWAL SETTLEMENT: PASS / PRODUCTION / CLOSED.
Push a70aff2cae1e1608e3341ad4f75e5142a03cde8d completed. GitHub Pages run
35577162916 SUCCESS, including Auth/request compatibility, public artifact build
and critical request production verification. https://sutiapp.com returns HTTP 200
and app/bundle.js?v=267 returns HTTP 200 with exactly the validated SHA-256
65cd96a857307ea21e841e8c1c8285fa8e66b895972ff35829b8f1a6e45ac617.
Financial readback remains 738 transactions, 0 yield periods, 0 allocations.
OAuth helper completed successfully, including temporary Picker key cleanup.

Migration: PASS (previous production readback; not repeated).
Edge / Google READ-ONLY / HISTORIAL P V2: PASS (live HTTP 200 above).
Overdue guard / withdrawal override / yield override: PASS (installed contracts
and prior isolated validation; no real financial action used to exercise them).
Source of truth / invariants / security: PASS; unchanged authority, no frontend
credentials, no real enrollment date mutation, authenticated service-only probe.
Legacy impact: Google reads only. Real financial testing operations: 0.
QA files added: 0. QA residual data: 0. Unexpected changed files: 0.
Architect closure verdict: APPROVED against the existing validated candidate,
production readback, successful workflow and exact live bundle hash.
Next instruction: STOP. No additional stage of #1 and no automatic #2/#3 work.

## Production release authorization — 2026-09-21

Owner now explicitly authorizes applying validated commit 132196b to production,
deploying savings-settlement, verifying Google read-only, pushing and publishing the
validated frontend, and closing this same H. This supersedes the earlier isolated-only
delivery boundary below. No real withdrawal, yield credit, fake period, enrollment
date change or Google write is authorized. No new permanent QA files or repeated
matrices. Scope: existing migration/recovery, Edge deployment, existing bundle,
release evidence in existing governance documents and derived deployment metadata.
Only minimum compatibility/readback and live smoke checks are required. Preflight:
nine relevant function definitions and permission constraint match the isolated
baseline; remote main remains 321880b; migration version is unused. Recovery already
validated; the migration stores prior definitions transactionally and bounds locks.
Status: BLOCKED — Google Sheets API SERVICE_DISABLED. Migration applied and immediate readback
PASS: 738 transactions, 0 settled withdrawals/periods/allocations; enrollment-date
digest unchanged. The only release adaptation is GET /source-status on the existing
Edge, authenticated with its service credential, returning aggregate source health
without requests, fixtures, financial RPCs or writes. This is necessary to verify
live OAuth without creating a withdrawal; all validated financial POST routes stay
unchanged. Validate just this addition, not the prior matrices.

### Production execution result — 2026-09-21

Migration 20260920000100_savings_settlement_exceptions applied and registered.
Readback PASS: five recovery definitions, both exception capabilities/modules,
withdrawal guard and yield exception installed; service access granted and browser
attestation access denied. Financial aggregates and enrollment-date digest unchanged:
738 transactions, 0 settled requests, 0 yield periods, 0 allocations; publication
PRIVATE; enrollment-date digest f2c06747488548ac9f63a473ee03870d.

Edge savings-settlement v4 ACTIVE, verify_jwt enabled. Authenticated read-only
source-status reaches Google after successful OAuth refresh, but Sheets metadata
returns HTTP 403 SERVICE_DISABLED; Edge returns HTTP 503
SAVINGS_LOAN_VERIFICATION_UNAVAILABLE, stage SHEET_METADATA. Anonymous source-status
and financial PREVIEW both return 401. Focal isolated reader/Edge checks PASS;
the previously validated financial matrices were not repeated.

BLOCKER: enable Google Sheets API (sheets.googleapis.com) in the Google Cloud project
associated with GOOGLE_VISIBILITY_OAUTH_CLIENT_ID. No available Cloud administration
access was established. No Google write or real financial operation was performed.

Frontend publication and push stopped at this dependency. sutiapp.com and its bundle
return HTTP 200; published v266 bundle matches remote baseline 321880b. Candidate
frontend remains unpublished. Migration and fail-closed Edge remain installed.
New QA files: 0. QA residual data: 0. Real financial test operations: 0.
P0 WITHDRAWAL SETTLEMENT: BLOCKED; no production PASS or definitive closure claimed.
No additional H or P1 started.

## Pre-change audit — 2026-09-20

Owner authorizes live loan verification and independent, audited withdrawal and
yield-tenure exceptions. These decisions supersede the earlier unresolved loan
rule and the PDF interpretation for this implementation.

Authority: SutiApp Final / HISTORIAL P V2, sheetId 1245291756. D is exact text
Folio, C loan ID, A amortization date, G fund, X uniform current status per loan.
LIQUIDADO, PAGÓ DE MÁS and AL CORRIENTE do not block. SALDO ATRASADO blocks unless
an authorized exception applies to this withdrawal and the reviewed loan set.
Unknown/missing/conflicting status, ambiguous identity or unreadable source deny.
All loans are inspected; closed loans never cancel an overdue loan.

Google classification: READ ONLY. No sheet, formula, Apps Script or trigger writes.
No parallel loan master/cache. Reads occur server-side, never via a browser token.
Existing savings_audit_events stores immutable exception/verification evidence;
savings_requests, savings_transactions and savings_yield_periods retain authority.

Scope: new savings-settlement Edge (index.ts and loan-status.js); additive migration
20260920000100_savings_settlement_exceptions and recovery; savings-panel-repository.js,
savings-runtime-admin.jsx, savings-yield-admin.jsx; existing focal browser test;
isolated SQL/reader/Edge test harnesses in %TEMP% only; this audit, authority,
decisions/changelog, migration/security/legacy rules, derived registry, generated
bundle and cache versions. The shared savings-repository.js is unchanged.
Permission definitions are extended through existing roles/module metadata; no
shared authentication helper, Storage, viewer or unrelated program is changed.

Yield exception bypasses only six-month tenure, individual/global per period.
Enrollment dates remain immutable to this operation. Other eligibility checks stay.
Copy: “Autorizar excepción de permanencia” / “Permite calcular rendimientos para
este periodo sin modificar la fecha real de ingreso de los ahorradores.”

UI preserves existing list/search, request actions, reports, publication controls,
period selector, preview and confirmation. Add exception controls, explanations and
explicit confirmations; no redesign. No financial publication or real settlement,
yield credit or test period creation. Synthetic fixtures must ROLLBACK.

Risk HIGH: accidental bypass, stale approval, duplicate debit, identity mismatch.
Verify source failures, conflicting X, scoped permission denial, separate overrides,
period boundaries, dates unchanged, writer idempotency/state checks and readback.
Recovery restores prior function definitions; preserves all immutable business
events and refuses unsafe removal after use. Production remains PRIVATE.

## Owner validation boundary

Owner explicitly rejected production DDL tests, including ROLLBACK, and selected
isolated verification. No production migration, deployment, push, financial action,
or production fixture is authorized in this delivery. A later production release
requires separate explicit authorization and its own preflight/recovery. Read-only
catalog queries supplied current contracts, without copying business rows.

## Implemented contract

The Edge authenticates the caller, resolves the request's participant in SQL, reads
all A:D/G:G/X:X ranges in one Sheets batch and groups every loan by C. No newest-row
shortcut. The grouping key is (D Folio, C loan ID), not globally unique C.
Unknown/missing/conflicting X, missing loan owner, unavailable provider or mismatched
exact Folio deny. No Google writes.

Only service_role can invoke the attested settlement wrapper. The authenticated
actor/session and effective context are revalidated in SQL; the loan observation
expires after 60 seconds. Browser RPCs cannot supply attestations. The original
writer retains amount/component/available-balance/window/status/idempotency checks.
The request list requires live verification; PREVIEW returns the current can_settle.
SETTLE always repeats the source read and SQL checks.

Withdrawal overrides bind the request, affiliate, amount and overdue loan snapshot.
New/different overdue loans require a new authorization. AUTHORIZE, REVOKE and USED
events remain immutable in savings_audit_events. Revoking a later authorization
does not resurrect an older authorization for the same scope. Principal full-access
roles receive the two explicit capabilities; ordinary savings.approve roles do not.
The existing module permission registry supports separately delegated capabilities.

Yield overrides change only the minimum-tenure gate for one selected period,
individually or globally. Real enrollment dates and other eligibility gates remain.
The preview fingerprint includes active exception evidence. Confirmation and
exception changes serialize by period. A period with allocations cannot receive
new overrides or revocations. Used withdrawal exceptions cannot be revoked.

## Evidence and limits

Isolated engine: PGlite 0.5.8 / PostgreSQL 18.3, in memory. Current metadata mirror:
191 tables, 411 SQL/PLpgSQL functions, 284 policies, 1,812 privilege statements and
217 nonconstraint indexes, with current enums, constraints and focal triggers.
No production business rows or real user identities are in the fixtures. Auth
sessions/users, affiliates, requests, periods and credits are synthetic and rolled
back locally; the in-memory database is then closed.

Live Google read-only shape audit (2026-09-21): 14,927 populated rows, 754 Folios,
1,907 distinct C values; no missing owner/loan ID/fund, unknown status or inconsistent
status/fund per loan. Row counts: LIQUIDADO 7,505; PAGÓ DE MÁS 160; AL CORRIENTE 6,701;
SALDO ATRASADO 561. One C appears under two distinct Folios, both overdue. The reader
therefore follows the owner-defined D→C grouping; it does not merge or infer owners
from global C uniqueness. No identity or source row is repaired. These are row
counts, not counts of people owing money. Connected Sheets access does not prove the
new Edge's OAuth scope; that remains a separate deployment verification.

Temporary evidence (outside the repository):
- `%TEMP%/sutiapp-savings-p0-schema.json`: catalog-only schema mirror.
- `%TEMP%/sutiapp-test-savings-settlement-exceptions.cjs`: reader/SQL harness.
- `%TEMP%/sutiapp-savings-p0-isolated-result.txt`: isolated result.
- `%TEMP%/sutiapp-p0-edge-checks.cjs`: Edge and repository contract harness.
- `%TEMP%/sutiapp-savings-p0-browser/browser-result.json`: browser checks.

Checks: ordinary six months; individual/global exception and different-period
isolation; unchanged real date; ordinary approver denied both exceptions; revocation
without older-grant resurrection; no loans/closed/current/overdue; closed loan does
not cancel overdue; stale/unavailable source; mismatched Folio; inconsistent loan;
explicit override reason/confirmation/snapshot; direct RPC bypass denied; settlement
retry adds one debit; changed retry/new second payout rejected; balance respected;
immutable evidence and used-period protection; anonymous/direct-table access denied.
Synthetic yield confirmation records override evidence and freezes further edits.

Recovery comparison verifies byte-identical definitions and ACLs of all four
replaced functions. Recovery disables new writers and preserves audit evidence.
With no exception history it restores the original permission constraint and
removes capability/module additions, refusing to orphan delegated permissions.
The outer isolated ROLLBACK additionally restores all 191 table digests and removes
the candidate RPCs. Recovery deliberately retains backup definitions and, after
business use, immutable evidence; it is not a destructive schema purge.

Browser: `node scripts/test-savings-runtime-browser.js`, network blocked, existing
requests/reports/publication/settings preserved; new withdrawal modal and exact
tenure copy; confirmation, retry key, missing permission and failed-read states;
viewports 320/430/1440. Existing `test-savings-balance-sync.js` and
`test-savings-read-work.js` preserve shared financial readers (19 cache/context cases).
The local build changes only three Savings admin bundle chunks; unrelated published
chunks remain byte-identical. Cache numbers are generated release artifacts only.

Limits: isolated SQL/Edge/browser contracts do not establish deployed PostgREST,
Google OAuth access from the new Edge, hosting JWT gateway behavior, multi-session
lock timing, or physical-device behavior. Those remain future release preflight
items. No claim of production P0 resolution is made by this local delivery.

## Result — 2026-09-21

H-SAVINGS-P0-WITHDRAWAL-SETTLEMENT-001 RESULT

Status: PASS for the owner-authorized isolated implementation/validation scope.
Production activation is NOT APPLICABLE to this delivery; it is not authorized.

| Check | Result |
|---|---|
| ISOLATED FORWARD MIGRATION | PASS |
| ISOLATED RECOVERY | PASS |
| RLS/SECURITY | PASS, isolated current-contract mirror |
| FINANCIAL RULES | PASS, synthetic fixtures only |
| LOAN AUTHORITY | HISTORIAL P V2, exact D then C |
| LOAN STATUS READER | PASS, synthetic contract + live read-only source shape |
| SALDO ATRASADO BLOCK | PASS, isolated |
| WITHDRAWAL OVERRIDE / PERMISSION / AUDIT | PASS, isolated |
| SAVINGS_RUNTIME_ASSERT_PAYOUT / CAN_SETTLE / FAIL CLOSED | PASS, isolated |
| YIELD ORDINARY 6 MONTH RULE | PASS, isolated |
| YIELD INDIVIDUAL / PERIOD OVERRIDE / PERMISSION | PASS, isolated |
| PRODUCTION DDL EXECUTED | 0 |
| PRODUCTION LOCKS CAUSED | 0 DDL/test locks; catalog reads only |
| REAL FINANCIAL OPERATIONS | 0 |
| REAL YIELD ACCREDITATIONS EXECUTED | 0 |
| REAL WITHDRAWALS SETTLED IN TEST | 0 |
| QA RESIDUAL DATA | 0 |
| FILES CREATED | 5: Edge entrypoint/reader, migration, recovery, this audit |
| PERMANENT QA FILES / TEST FILES ADDED | 0; one existing browser test extended |
| SUPABASE SCHEMA CHANGE | YES in candidate and isolated mirror; NO in production |
| DEPLOYMENT / PRODUCTION | NOT APPLICABLE; not executed, not certified PASS |

Files changed: 24 (including five derived registry artifacts and three generated
bundle/cache artifacts). Unexpected files changed: 0. Source-of-truth verdict: PASS.
Invariant verdict: PASS. Legacy impact: read-only Google inspection; zero writes.
Build: PASS (`build-savings-release.js` and isolated `build-pages-site.js`, 25 files).
Security: PASS for isolated SQL grants/roles and Edge/repository contracts; gateway
integration deferred. Tests: isolated SQL/reader, 12 Edge/repository assertions,
extended runtime browser, shared balance projection, 19 read-context cases and
`test-admin-access-protected-contract.js` PASS.

Bundle SHA-256: `65cd96a857307ea21e841e8c1c8285fa8e66b895972ff35829b8f1a6e45ac617`.
Temporary SQL/reader harness SHA-256:
`225ee49f987ec7f3ad9c6b8b6bbc4f4347011c2f48c6089ef073109b87ba2b06`.
Temporary Edge harness SHA-256:
`5645fe47011269f7548e831521c6907767cb6a5d59a2858039447e9bfafd20c3`.

CLAUDE UI PRESERVATION REVIEW: PASS. Requests, review/cancel/settlement, reports,
publication, settings, period selection, calculation table and credit confirmation
remain present. Added only requested loan/exception controls and explicit states.
No unauthorized redesign. Global image regression: NOT APPLICABLE; no shared
assets/auth/viewer/router/helper or service-worker logic changed. The shared Savings
reader and 126 unrelated bundle chunks are identical to the baseline.

ARCHITECT REVIEW: APPROVED for isolated delivery; production readiness is not
asserted. Authority and owner boundaries match code and evidence. No further H is
authorized by this review. `WORK_QUEUE_HISTORY.md` is absent; the current owner
instruction expressly controls this task and prohibits production test DDL.
Next instruction, NOT AUTOCONTINUABLE: stop after local delivery. A separately
authorized production release must validate live OAuth/gateway, current schema
drift, deployment ordering and recovery before any backend/frontend publication.
