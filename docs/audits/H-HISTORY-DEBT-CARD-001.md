# H-HISTORY-DEBT-CARD-001 release audit

AUDIT / AUTHORITY / PLAN / RISK - 2026-11-25

Owner explicitly authorized surgical implementation, commit, push and publication.
Release starts from remote main 70e7f2ac51d4b62c9a5499906cf7c48dad9cf334 in an isolated clone; original dirty workspace preserved.
The earlier candidate used older sources. Transplant only debt projection/card and hero replacement; retain newer snapshot, approval, PDF and detail behavior.

Scope: app/history-loans-repository.js, app/history-loans.jsx, app/screens-historial.jsx; only their compiled chunks in app/bundle.js; bundle cachebuster in SutiApp.html; scripts/test-history-debt*.js and scripts/build-history-debt.js; this audit, task changelog entry, docs/qa/evidence/history-debt/; derived five architecture index JSON files if updated. Private build/release helpers under .tmp/history-debt/.

Authority: Google HISTORIAL P V2 financial values through existing private complete published observation and loan-history LOAD. Supabase owns identity and confirmed approvals; approvals never invent installments. C exact loan ID; D exact Folio enforced by existing backend. K counted once per loan; A/B at Hermosillo cutoff determine paid amounts. Preserve decimal precision until display rounding. No new request, writer, cache, fallback, permission or schema.

Plan: derive when existing summary updates; composed pending approvals explicitly unresolved. Preserve snapshot/context/refresh. Replace only hero; keep six filters, list, tracking, PDF and detail.

Tests: exact remote diff; decimals, per-ID grouping, user isolation; responsive card and current snapshot/approval/pending/paid-total regressions; standard Pages build, production hash and read-only browser checks. Global image suite NOT APPLICABLE: no shared runtime/auth/assets/SW logic changes.

Recovery: revert this release commit and redeploy existing workflow; no business data writes.

Original workspace packaging error EXPLICIT_BACKEND_REGISTRATION_REQUIRED:inversores belongs to unrelated pending work. Clean remote build previously passed; no guard bypass or Inversores changes. Prior remote run failed later at Pages artifact retrieval. Navigator remote index is preexisting STALE changed=50 added=50; directed source inspection verified History.

Status: verification in progress.

## Verification scope adjustment

The existing snapshot browser harness supplies a literal synthetic token, incompatible with the current shared request coordinator JWT/session validation. Existing suites fail before any history/native read. Update only that isolated fixture in scripts/test-history-snapshot-browser.js to encode matching synthetic sub/session_id claims and rotation nonce; no runtime/auth change and no assertion weakening. Re-run dependent snapshot, paid-total, approval and native-pending suites.

The same harness also expected token renewal to invalidate same-session requests, superseded by the current coordinator. Its token test now asserts no redundant reload and verifies that a real publication refresh stays pending across rotation, preserving rows/scroll until completion. Runtime remains unchanged.

## VERIFY / EVIDENCE and pre-publication review

All scoped arithmetic tests passed (11), as did current snapshot, immediate-approval, native-pending (12), and paid-total (15) runtime suites. New card browser checks passed at 320/390/1440 with pointer/keyboard accordion, cents, all filters, source errors, identity race and logout. Current snapshot, paid-total, immediate-approval and native-pending browser suites passed at all three widths, including PDF rows, scroll, token continuity and backend-denial purge. Their synthetic evidence is under docs/qa/evidence/history-debt/regression/.

Standard scripts/build-pages-site.js and unchanged permission gate PASS on the isolated release. Generated bundle changes exactly 3 of 179 chunks. Protected Google, Edge, shared auth/demand, operations, PDF generator and service worker match remote HEAD (normalized line endings). No other product section changed.

H-HISTORY-DEBT-CARD-001 RESULT
Status: PASS for implementation and release candidate; production verification follows deployment.
Files changed: 3 History sources, generated bundle/cachebuster, focal build/tests, isolated fixture compatibility, audit/changelog/evidence, scoped derived registry.
Source-of-truth verdict: PASS; existing private Google-derived publication remains sole financial observation.
Invariant verdict: PASS; exact IDs, no future-as-paid, no cross-loan credit offset, no unknown-as-zero, source decimals retained.
Build: PASS, normal Pages gate retained.
Tests: PASS, listed above.
Security: existing ownership/context boundary preserved; isolated denial/races pass.
Legacy impact: no writes or code changes.
Unexpected files changed: none; original dirty workspace preserved.
Known limitations: preexisting unrelated registry stale entries retained honestly; live populated-account verification not yet claimed.
Evidence: docs/qa/evidence/history-debt/.

SUTIAPP ARCHITECT REVIEW
Task: H-HISTORY-DEBT-CARD-001
Verdict: APPROVED for authorized release.
Critical findings: earlier local branch and published branch differ; release explicitly preserves published snapshot/approval/PDF behavior. Original Inversores build blocker is absent from this clean candidate; no permission bypass.
Architecture: focal presentation projection with no new backend authority, persistence or requests.
Security/data/legacy: unchanged boundaries and protected files; no business writes.
Owner decision required: NO; commit/push/publication explicitly authorized.
Response to Codex: Publish only this reviewed candidate through the existing workflow, then verify deployed bytes and the authenticated own card with and without service worker plus reload. Do not advance unrelated work.
