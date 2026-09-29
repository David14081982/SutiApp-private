# H-LOAN-APPROVAL-432-DIAGNOSIS-001

## PRE-CHANGE AUDIT — 2026-09-28

Status: PASS. Owner requested the cause of the approval error for SR-2026-000432.
Scope: read-only production diagnosis and local evidence. Files: this audit,
scripts/audit-loan-approval-432.js and docs/qa/evidence/loan-approval-432-20260928/diagnosis.json.
No runtime, migration, financial rule, request, approval, Google, UI or deployment changes.
Existing dirty files belong to prior work and are outside this task.

Authority: program_requests owns the request and immutable submission;
financial_rules owns versioned criteria; get_financial_runtime_rules projects
published criteria; financial-legacy approveRequest is the specialized writer.
Readers inspected: app/screens-admin-finanzas.jsx, app/financial-legacy-repository.js,
supabase/functions/financial-legacy/index.ts and current production SQL/source.
The investigation never invokes approveRequest or any business writer.
Read-only management queries and service-only criteria reads use existing local
credentials without printing them. Evidence excludes personal identity, documents,
signature, banking data and credentials.

Navigator check: STALE only for unrelated SutiFarma audit/evidence; the solicitudes
lookup resolved an unrelated company surface. Directed discovery established the
actual path using the exact error string. No architecture changes or Registry update.
Source-of-truth guardian: SAFE for reads, no authority change or fallback.
Legacy guardian: READ ONLY; zero Google requests or financial writes.
Supabase guardian: read-only inspection; no Auth/RLS/grants/permissions changes.
Risk: interpreting a deliberate version guard as a transient error, or silently
approving above the currently published limit. Do neither.
Verification: exact criterion match against current runtime, rule version timeline,
deployed approval guard, and request fingerprint before/after the investigation.
Recovery: remove the three local diagnostic artifacts; no production recovery needed.

## Findings

Production reads show the request was submitted at 2026-09-28 21:02:55 UTC
(14:02:55 America/Hermosillo) with rule version 6, amount 50,000, 12 fortnightly
payments, 1.5% per period, interest 9,000, fees 180 and total 59,180.
Version 6 allowed 50,000. Version 7 was published at 21:06:08 UTC with a 30,000
maximum. Versions 8 and 9 restored 50,000 temporarily; version 10, published at
21:15:16 UTC, is the current published version and allows 30,000.

The request retains SUPABASE_RULE:4b1e26a7-727c-46dd-a347-279c69ea7c7c.
That row still exists, but lifecycle_status is EXPIRED. Current runtime does not
return it. approveRequest compares the captured criterion identity with the
published runtime rules and throws CONDITIONS_CHANGED unless exactly one matches.
This happens before quote resolution, document reads and the approval writer.
Reloading or retrying does not change that captured identity. Restoring just the
maximum also does not restore the previous rule UUID.

The earlier advance repair (8ebf0ca, H-LOAN-ADVANCE-ADMIN-FEE-001; subsequent interest
repair 720c2e1) preserves submitted results for dated advances with one payment.
It executes after the same identity guard and does not cover this 12-payment loan.
It cannot solve this case. We cannot establish that this is the particular earlier
repair the owner remembers; no broader historical-frozen-rule repair is claimed.

The UI maps CONDITIONS_CHANGED to a generic conditions message and unconditionally
adds a retry suggestion. For this persistent version mismatch that suggestion is
not a remedy. No evidence indicates a missing submission or successful approval.

## Result

H-LOAN-APPROVAL-432-DIAGNOSIS-001 RESULT
Status: PASS (diagnosis only; approval remains unresolved)
Files changed: the three diagnostic artifacts listed above
Source-of-truth verdict: SAFE; existing authorities read without modification
Invariant verdict: request and historical criteria preserved
Build: NOT APPLICABLE; no application source changed
Tests: node --check scripts/audit-loan-approval-432.js PASS; live read-only diagnostic 9/9 checks PASS
Security: no credentials/PII in evidence; no permission changes
Legacy impact: zero Google calls or writes
Unexpected files changed: prior workspace changes preserved
Known limitations: diagnosis only; no real approval attempted; unrelated later approval guards not exercised
Evidence: docs/qa/evidence/loan-approval-432-20260928/diagnosis.json

## Verification and review

Read-only verification confirmed the deployed identity guard occurs before the
advance preservation helper and approval writer. All nine assertions passed,
including identical full-request fingerprints before/after. No approval was
attempted; no claim is made about later guards passing. The deployed bundle hash
is in the evidence. The three runtime files inspected have no local diff.
Build/UI/global-image regression: NOT APPLICABLE to these diagnostic artifacts.
The pre-existing dirty workspace was not reverted or included in this change.
Repository-wide git diff --check reports pre-existing trailing whitespace in
supabase/migrations/20260915000100_admin_assisted_context.sql, which this task
did not edit. This is not recorded as a clean repository-wide check.

SUTIAPP ARCHITECT REVIEW

Task: diagnose SR-2026-000432, not authorize it or implement financial policy.
Verdict: APPROVED for the bounded diagnosis.
Critical findings: expired captured rule is excluded from current runtime;
the exact deployed guard returns CONDITIONS_CHANGED; the current cap is 30,000;
the earlier located repair does not cover this case.
Source of truth: Supabase request capture and versioned criteria retained.
Architecture: no runtime or Registry change.
Security: credentials used only by local read-only harness; no secrets in output.
Data: request fingerprint unchanged; no business writes.
Legacy: zero Google calls/writes.
Owner decision: NO for accepting this diagnosis. Changing approval behavior for
already-submitted loans is a separate financial-policy scope, not inferred here.
Next action: report the cause and distinguish diagnosis from repair. A repair must
establish the applicable policy for submitted conditions versus later published
limits, preserve historical captures, and cover rule replacement in its tests.
Response generated for Codex: YES.

### RESPONSE TO CODEX

Accept H-LOAN-APPROVAL-432-DIAGNOSIS-001 as a verified read-only diagnosis.
Report the captured 50,000 limit, subsequent 30,000 replacement, expired UUID,
and deployed identity guard. Do not claim the loan is fixed or approved. Do not
change rule IDs, rewrite the capture, force approval or create Google test rows.
Any subsequent repair must explicitly resolve the historical-conditions policy
and test replaced versions, changed caps, unchanged caps with new UUIDs, ordinary
installment loans and dated advances while preserving permissions and idempotency.
