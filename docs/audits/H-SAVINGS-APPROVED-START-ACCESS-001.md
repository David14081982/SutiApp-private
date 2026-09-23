# H-SAVINGS-APPROVED-START-ACCESS-001

PRE-CHANGE AUDIT
Objective: complete owner-authorized zero-month access for approved JOIN whose enrollment starts on a future first deduction date.
Evidence: targeted read-only account lookup returned NOT_ACTIVE_SAVER despite approved ACTIVE canonical enrollment and positive plan. Runtime approval intentionally writes enrollment_started_at=first expected contribution; approved_at is actual approval. Prior migration skipped only receipt guard and missed future enrollment guard.
Scope: additive migration/recovery 20260923000400_savings_approved_start_access.sql; existing test-savings-loan-eligibility.js/.sql; this audit, SOURCE_OF_TRUTH, own changelog entry. No frontend/Edge/financial engine change. Preserve unrelated uncommitted files.
Authority: existing canonical savings_enrollments.approved_at, enrollment status and policy. For 0/ENROLLMENT only, an approved_at not in the future can establish immediate access despite planned enrollment date. Pending/unapproved/future approvals stay denied; other bases/months/status/identity/plan/loan controls unchanged.
No historical dates, plans, balances or requests are rewritten. Use approval date only for zero-month eligibility threshold, keeping enrollment_date truthful in returned evidence.
Migration: exact definition patch + existing private backup; recovery drift guard; bounded transaction; invalidate disposable LOAN snapshots. No grants/schema/table changes.
Tests: isolate exact reported future start + approved/no receipt; pending/future approval, 1 month, FIRST_DEDUCTION, cancelled/expired/uncertified controls and quote/request path. Production targeted readback and matching fund/profile availability required before closure.
Risk: broaden access only as explicitly requested. Source/security/legacy verdict: SAFE within scope. Pre-change PASS.


## Owner scope update before implementation

Owner explicitly broadened zero-month access to everyone who has submitted a JOIN, including pending approval. Add migration/recovery 20260923000500_savings_pending_join_access.sql, explanatory Admin copy/reason in app/savings-loan-eligibility.js, generated bundle/HTML, existing browser test as needed and derived architecture index (new function dependency on savings_requests). Keep already-applied 004 immutable.
Authority remains savings_requests: newest canonical JOIN with exact participant/effective affiliate, SUBMITTED/UNDER_REVIEW, valid amount and past submission time. Rejected/cancelled/latest replacement must not qualify. Approved accounts use existing 004 branch, so an old approved JOIN cannot resurrect terminated savings. No participant or enrollment must be invented. Pending access does not approve savings, certify a receipt or exempt other loan requirements.
Snapshot validation and final quote/submit already recompute eligibility; cancellation/rejection closes subsequent access through the same backend guard. Migration 005 backed up/recoverable independently. No productive loan test.


## Verification and applied backend

Existing SQL baseline plus both new migrations/recoveries PASS in isolated PGlite: actual quote and INSERT request guard allow approved future-start and submitted JOIN; rejection/cancellation prevents subsequent submission; latest status, wrong affiliate, future/invalid/legacy request, absent enrollment/request, positive months, FIRST_DEDUCTION, certification, expired plan and terminated approved accounts remain guarded. Both recovery definitions match exactly; ACL/RLS and old one-use exceptions tests PASS.
Existing Admin browser at 390/1440 and personalized session snapshot contract PASS. Only copy/reason added to UI. Build:132 modules; 131 unrelated chunks byte-identical to HEAD. Global image regression NOT APPLICABLE: focal copy/generated artifacts, no shared infrastructure.
Production 004 and 005 applied separately with exact-definition drift guard, migration history, 2s lock/60s timeout and repeatable-read protected hashes. Policy remains 0/ENROLLMENT/version3. Enrollment/history/savings ledger/program requests/ACL unchanged; 005 additionally hashes savings_requests unchanged. Exact prior/installed definitions retained in forced-RLS private backup. Anonymous/direct authenticated private RPC remain denied.
Targeted readback for the owner-provided Folio: eligible=true, ordinary_eligible=true; approved and enrollment dates unchanged. Exactly one matching Caja de Ahorro runtime rule matches the financial profile and term minimum; AUTO visibility with no scheduled date means AVAILABLE. One current pending JOIN also qualifies. No names or Folios stored here, no real loan submitted.

H-SAVINGS-APPROVED-START-ACCESS-001 RESULT
Status: PASS / PRODUCTION / CLOSED.
Source-of-truth: PASS; original policy/requests/enrollments only.
Invariants/security: PASS; no fabricated dates/payments, exact identity/ACL retained.
Build/tests/recovery: PASS focal SQL, existing browser, common Edge paths and session contract.
Legacy impact: authorized access broadening only. No Google/rates/balance changes.
Unexpected files: none; preexisting audit/changelog work preserved separately.
Known limitations: no real loan submitted and no user-password session used. User-specific eligibility and available rule checked read-only at authority; production UI artifact checked after publication.

CLAUDE UI PRESERVATION REVIEW: no section/control/navigation lost; copy accurately states pending request eligibility. PASS.
SUTIAPP ARCHITECT REVIEW
Task: H-SAVINGS-APPROVED-START-ACCESS-001 including explicit pending-JOIN extension.
Verdict: APPROVED
Critical findings: planned enrollment date previously prevented approved accounts; removed only under zero/enrollment approval condition. Pending requests now qualify by explicit subsequent owner instruction.
Source/architecture: same private decision; new authoritative savings_requests dependency, no alternate data store.
Security/data/legacy: unchanged grants, no business mutations, no Google writes.
Owner decision: NO
Next action: publish verified copy and registry evidence, verify artifact and close.
Response generated for Codex: YES

### RESPONSE TO CODEX
Approve the full owner-authorized scope. Preserve pending/approved distinctions and existing financial guards. Publish, record evidence, do not start another H.


## Verified publication

Product commit `f649b391f197bad1188ac255d04c43279987d8f2` pushed.
[Pages run 35919127361](https://github.com/David14081982/SutiApp-private/actions/runs/35919127361): SUCCESS, including backend compatibility, build and production gates.
Public sutiapp.com serves v282; normalized SHA256 `edcdf58534804e9fd38ff0cbd3de7905df529de0d7e923a36ab8272e06db235b` equals tested bundle.
Compiled-bundle Admin browser PASS at 390/1440. Financial Supabase cutover and personalized snapshot static contracts PASS.
The user's exact eligibility and available matched rule were checked at production authority; no real loan or authenticated user-password session was created for QA. Close/reopen of Suti Prestamo invokes existing session validation; prior snapshots were invalidated by both migrations.
Registry refresh uses generator analysis/build functions for changed task files while excluding the unrelated preexisting audit and changelog. It deliberately retains stale fingerprints for those unrelated edits rather than indexing/staging their contents. Final publication prose is nonstructural.
Final reviewer verdict APPROVED; no next H.
