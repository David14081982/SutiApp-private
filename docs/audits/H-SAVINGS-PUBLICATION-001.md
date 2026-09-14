# H-SAVINGS-PUBLICATION-001 — prepared publication boundary

## Audit and authority

Owner authorizes completing Savings only, preserving the current UI and other programs. Publication follows the owner's physical tests; this change prepares the button and never operates it. `Ahorro!Q` remains the certified opening reference, with officer corrections captured separately and promoted by the certification writer. Historical summaries and dated records are presentation evidence, never duplicate financial postings.

Navigator lookup `ahorro` on 2026-09-13: STALE (six changed and 28 added files, mainly unrelated surfaces/evidence). Directed inspection confirms all three self surfaces share `SavingsRepository.getSelfDashboard` -> `get_self_savings_if_changed` -> `get_self_savings_live_readonly`; `SavingsBalanceReadModel` reads `balances.total`. No Inicio, Finanzas, shell or loan code needs modification.

## Scope and plan

Only new migration/recovery `20260913000200_savings_publication`, focused `scripts/test-savings-publication-live.js`, and this audit. Dependencies: pending Savings operations/retirement/yield/certification migrations, existing private review and self-read optimization. No Google/API writes, production switch, certification of real accounts, or other program changes.

Add a private-by-default global publication state and immutable events; preserve exact prior self-reader functions in a private backup. Provide a compatible canonical Savings DTO and administrator preview, then an explicit versioned/idempotent publish command. The command checks every Ahorro record, exact identity, certification freshness, actual receipts and stable financial inputs under locks. Public reads select a single global authority; never fall back to the historical mirror for an individual after publication.

## Risks and verification

The private branch preserves H05 version revalidation through an internal copy with recorded reader/action hashes. Future dependency drift still disables reuse. The published branch always returns fresh validated context. Old authenticated helper grants remain revoked. Readiness must not compare pre-certification participant metadata verbatim, because certification updates that metadata; validate exact identity links and current state instead. Historical AR includes yield already and must remain one historic row, never a new credit. Future captured cells never become historical receipts as time passes.

SQL tests use one transaction ending ROLLBACK, including isolated fixtures. Check private reader equivalence, admin/anonymous/cross-user permissions, all-record readiness, changed preview, idempotency, no partial state, date boundary, UI DTO fields, preserved source/ledger and exact reader recovery. Recovery refuses after any publication event. Loan checking is explicitly outside this task; no loan writer or financial approval rule is replaced here.

## Verification result ? 2026-09-13

Status: PASS for prepared backend boundary; not applied and not published.

`node scripts/test-savings-publication-live.js` passed against Supabase in two complete transactions ending ROLLBACK. Exact recovery compares original reader definition hashes, owner, ACL, security-definer flag, volatility and search_path. Functional checks cover unchanged private DTO, H05 validated reuse, every existing Ahorro record in the publication gate, optional private correction staleness, internal/grant/RLS restrictions, anonymous denial, accepted historical source only, Q opening preservation, no second AR/DT credit, no second subtraction of old withdrawals, preserved retirement detail, separate closed/current periods, and captured future cells never becoming receipts. Publication confirmation, stale fingerprint, retry conflict and history-preserving recovery pass with an isolated readiness fixture.

No real account was certified and no publication persisted. The successful state-machine switch used a deterministic isolated readiness fixture after the real complete-record gate was verified to reject pending accounts; this does not certify all real balances. User/session frontend acceptance is not claimed. Build is NOT APPLICABLE for these SQL/test-only files; parent owns the combined frontend validation.

Prepared DTO fields `label`, `subtotal_label`, `closed` allow the existing year-card markup to preserve its layout while displaying the correct period. Historical presentation reads the latest accepted certification/adjustment snapshot, so an unaccepted private proposal cannot change user details. Conditional source-observation/acceptance fingerprints and table locks protect against a concurrent refresh during publication. All Google, loan and other program systems remain unchanged.

Files changed: this audit; `supabase/migrations/20260913000200_savings_publication.sql`; its matching recovery; `scripts/test-savings-publication-live.js`. Unexpected files changed: none by this subtask.
