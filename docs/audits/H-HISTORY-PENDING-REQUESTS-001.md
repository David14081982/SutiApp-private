# H-HISTORY-PENDING-REQUESTS-001

## Pre-change audit — 2026-10-26

Owner scope: include own Historial de solicitudes rows with A=SR-* and Y=Pendiente in En proceso. Preserve all existing screens, filters, loans, amortizations, financial calculations and Google content. Commit and push authorized. Baseline: 293d4d41c5538f3a184da98c0ac48a0d481f6fc1 in an isolated worktree.

Navigator: existing registry is stale; directed inspection of history.mjs, snapshot.mjs, history-loans-repository.js and screens-historial.jsx confirms ownership. No new architecture or authority is proposed.

Cause: projectHistory already recognizes SR/Pendiente, but first skips every matching native request whose context financial flag is false. That flag can be false while financial_processing_status is null before Finance authorization. Read-only production aggregate inspection found six SR/Pendiente source rows, including one excluded for this exact condition. No request/affiliate identifiers or financial amounts were logged. Padded SR identifiers did not occur in the inspected pending rows.

Declared files: supabase/functions/loan-history/history.mjs; scripts/test-history-pending-requests.js; this audit; append-only docs/AGENT_CHANGELOG.md; sanitized evidence under docs/qa/evidence/history-pending-requests. Private baseline, remote Edge backup, read-only inspection, build output and release receipts stay under .tmp/history-pending-requests. Frontend/bundle/PDF, Google Apps Script, migrations, SQL functions, RLS, sync worker, schedule and source records remain unchanged.

Plan: retain the nonfinancial approval-link exclusion, but allow an explicitly SR/Pendiente source row to produce its existing request card. Preserve sourceId and covered-request deduplication so native tracking continues. Other statuses and numeric legacy request IDs keep their current behavior. No loan classification or approval timestamp change.

Authority: Google A/B/Y through the existing private published observation; exact effective Folio from the existing authenticated SQL reader. No alternate store, fallback or extra runtime read. READ ONLY for legacy/data; SAFE for the scoped projection change. Security boundary, JWT, context resolution and cross-user denial are unchanged. Migration review NOT APPLICABLE.

Risks and checks: reproduce omission before editing; verify pending with/without native financial flag, deduplication, native tracking, own identity, zero extra queries, unchanged other categories and input data. Run existing snapshot runtime/source and focused browser regressions. Compare entire frontend and unrelated backend files against baseline. Back up deployed Edge code, verify baseline parity, deploy only loan-history with the same settings, and verify exact source readback. No impersonation or new user session required.

Recovery: redeploy the backed-up loan-history source. No data rollback; no business records changed. Browser memory may retain the previous response until the app reloads; no new polling or forced navigation is introduced.

Pre-change status: PASS for this bounded change and verification.

## Verification and result

The pre-fix focused test reproduced `SR/Pendiente with no internal financial flag must appear`. The same test passes after the scoped condition change. Isolated Chrome tests use real HistorialScreen and LoanHistory.merge with synthetic inputs: En proceso/Todas, deduplication, native tracking and En pago pass at 320/390/1440. These are functional browser checks; no new visual design is introduced and no real user session is claimed.

Read-only comparison against the affected published observation: one additional pending card, three existing entries exactly equal, source/context inputs unchanged. Only aggregate results are retained. Existing snapshot runtime/source tests and Pages/PWA test pass. The source fixture includes 20,000 loan rows and 2,800 request rows; production runtime still makes one own snapshot RPC, with no new polling or source reads.

Production loan-history v4 was backed up privately and compared by AST with all three baseline modules before deployment. Published v5 is ACTIVE with verify_jwt=true. All three deployed modules match the candidate AST; only history.mjs changes. Anonymous invocation returns 401. No SQL, source rows, Google documents or other functions were changed. Recovery uses the three private baseline module backups and the same deployment metadata.

H-HISTORY-PENDING-REQUESTS-001 RESULT
Status: PASS
Files changed: history.mjs, focused regression test, this audit, append-only changelog, sanitized evidence.
Source-of-truth verdict: PASS; existing Google-derived own observation and native request context preserved.
Invariant verdict: PASS; exact owner, financial values, other statuses, tracking and deduplication preserved.
Build: PASS; deployed Edge modules compile and match local AST; Pages/PWA packaging passes. Frontend regeneration NOT APPLICABLE, no frontend changes.
Tests: PASS; focused browser/projection, existing snapshot runtime/source, live read-only before/after comparison.
Security: PASS; unchanged JWT/authenticated RPC/RLS, foreign owners and forged selectors rejected, anonymous HTTP 401.
Legacy impact: READ ONLY; no Google changes, synchronization changes or financial writes.
Unexpected files changed: none in isolated worktree.
Known limitations: an already-loaded browser can retain the old response until reload; normal snapshot freshness rules still apply. No new impersonation or physical-device test.
Evidence: docs/qa/evidence/history-pending-requests. Publication receipts remain private outside the committed source.
