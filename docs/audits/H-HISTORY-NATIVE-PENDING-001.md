# H-HISTORY-NATIVE-PENDING-001

## Pre-change audit

The owner explicitly authorizes the diagnosed correction: own pending requests must appear immediately in Todas and En proceso using the native request record already loaded by the screen, without waiting for the independent Google observation. Preserve source financial data, existing approval/amortization flows, synchronization and low transfer volume. Existing session authority covers publishing the focused repair to the already-published Historial work.

Baseline: published main 5460d8267b7d1ae95032091939c8146c0bef9f56, frontend2026102607, Edge loan-history v7. New isolated branch fix/history-native-pending; unrelated root edits remain untouched. Navigator check/lookup Historial on the identical published tree is FRESH and identifies the own native store, LoanHistory merger, Historial screen and snapshot/approval boundary. The new Windows checkout may require Registry regeneration for line endings; source inspection takes precedence.

Verified cause: a native own pending financial request created after the daily publication is returned by list_self_program_request_history and projected as revision. LoanHistory.merge removes all native loan/financial rows before filters, while the old observation and approved-only overlay have no replacement. The previous SR/Pendiente repair applies only to rows already in the observation. Private targeted production inspection and independent real-module VM reproductions confirm this; no customer identifiers or records belong in public evidence.

Authority: program_requests remains canonical for the own pending lifecycle and tracking through the existing authenticated no-target reader. This owner-approved presentation exception permits retaining an explicitly pending native SR while no published/confirmed-approval entry represents its sourceId. It does not claim a fresh Google Y read, create a loan, infer approval, synthesize quotas or replace loan/financial authority. Canonical pending does not expire merely because another complete Google publication still lacks its row. Native terminal state/removal or current-context purge removes eligibility. Published source-only records and loans still obey complete-observation absence; no old observation/browser fallback is permitted.

Declared product scope: app/history-loans-repository.js merge eligibility/deduplication only. Keep app/operations-store.jsx, native repository/RPC, Historial/detail/PDF UI, approval clocks, Total pagado, Google/backend/schema/sync, shared auth/routing/assets and every other domain unchanged. Generated app/bundle.js and SutiApp.html/sw.js version references only (2026102608).

Declared verification/governance scope: new scripts/test-history-native-pending-runtime.js and scripts/test-history-native-pending-browser.js; existing focal history tests only if an explicitly superseded expectation needs alignment; this audit; append-only SOURCE_OF_TRUTH, INVARIANTS, DECISIONS, AGENT_CHANGELOG and LEGACY_GOOGLE_SYSTEMS; focused authority metadata in architecture-overrides and generated Registry; sanitized docs/qa/evidence/history-native-pending. Private probes/receipts/scripts live in .tmp/history-native-pending.

Plan: permit native financial/loan rows only with a real sourceId, SR identity, revision presentation and explicit canonical requestStatus in submitted/requires_financial_processing/in_review. Unknown, absent and terminal statuses never inherit eligibility from the generic revision default. Reuse the existing authenticated native result even while the independent source is loading/unavailable; preserve the source's visible error state and never invent its data. Prefer existing projected/source/approval representations by sourceId; all confirmed approval IDs suppress stale native pending, including old approvals no longer rendered. Do not use stale financial_request_ids as a gate for a request created after an earlier LOAD.

Risks/tests: reproduce old omission before editing; real own native repository/store path; cold source loading, explicit source failure, warm create event with old LOAD/financial IDs, before/after daily cut and delayed export, duplicate suppression on later publication, explicit unknown/terminal denial, source-only removal, confirmed approval overlay/expiry, native tracking, exact context and logout/revocation, unchanged nonfinancial requests, monetary progress/PDF, mobile320/390 and desktop1440, no extra RPC/timer/channel and stable open amortization/scroll. Read-only replay of the actual requested row must show one pending card without changing its fields or source. Independent review before publication.

Recovery: revert the single merger/frontend version; no backend deployment or data rollback. Global image regression NOT APPLICABLE: the focal history repository is not a shared cross-surface infrastructure helper; no shared assets/Auth/routing/SW logic is changed. Existing native own-context guards remain untouched and are exercised in browser tests.

Pre-change status: PASS for the scoped owner-authorized correction. Source systems READ ONLY; presentation change SAFE after the defined tests and independent review.

## Implementation and verification

The implementation changes only nativePending eligibility and merge precedence in app/history-loans-repository.js. operationsStore already retained canonical requestStatus, so its existing own reader and context guards needed no modification. No extra RPC, timer, channel, Google call or synchronization was added. All confirmed approval source IDs suppress stale native pending, even when the approval is no longer projected after its existing 24-hour period.

The new runtime suite reproduces the baseline omission and passes 12 groups with the candidate, using the real native repository/store and merger. The new browser suite uses those real modules and the existing UI with isolated transport; it verifies initial independent-source loading/failure, a request created after an old LOAD, stale financial ID lists, explicit canonical status eligibility, deduplication, removal, tracking, late responses across identity changes, logout, unchanged open-detail scroll and PDF. No production fixtures are introduced.

Read-only inspection and replay of the actual requested case through the real native repository/store and both mergers produced zero pending cards before and one after, in Todas and En proceso. Native fields and tracking remained exact. The publication still predated creation. This was not a live impersonated browser session and did not write any request or refresh the source. Public evidence contains only sanitized assertions; private identifiers and source records are excluded.

Commands and evidence (all PASS):

- node scripts/test-history-native-pending-runtime.js — 12 groups; runtime.json.
- node scripts/test-history-native-pending-browser.js — 320/390/1440 px; browser.json.
- node scripts/test-history-snapshot-browser.js — 320/390/1440 px; snapshot-browser.json. Only superseded assertion changed from one to two existing native cards during initial source loading; all financial/source assertions preserved. The 210-row PDF case runs at 390 px; other widths use smaller fixtures.
- node scripts/test-history-immediate-approval-browser.js — 320/390/1440 px; immediate-approval-browser.json.
- node scripts/test-history-total-paid-browser.js — 320/390/1440 px; total-paid-browser.json.
- node scripts/build-bundle.js C:/tmp/babel-standalone-7.28.4.min.js — 163 modules. Exact source chunk and syntax verified; only history-loans-repository.js changes, 162 chunks remain exact; build.json.
- node scripts/test-pages-deployment.js and git diff --check — PASS.
- Actual-case replay — actual-case.json; no source/data writes and no extra request.

Existing screens/components/styles remain byte-equivalent after line-ending normalization. Private screenshots at 320/390/1440 and focal browser checks preserve the existing native card, tracking, source error, filters and detail layout. The header/hero and horizontal filter behavior belong to the unchanged baseline UI. No redesign or new component is introduced.

Entire supabase and google-apps-script trees are unchanged, along with operations-store, native request repository, Historial/detail/PDF, sync/admin, private context, Auth and app shell. SutiApp.html/sw.js differ only in the two existing version references, 2026102607 to 2026102608. Rollback requires the frontend change only; backend loan-history v7 and source observations are unchanged.

Registry evidence is finalized after all source/evidence files are frozen: generate, complete registry tests, focused lookup, final generate and FRESH check. The separate registry.json records actual results. Independent implementation review is recorded in architect-review.md. Publication is a subsequent gate requiring clean commit, branch CI, expected-head merge, successful Pages and exact public artifact hashes; its receipt stays private so no post-publication source rewrite is needed.

## H-HISTORY-NATIVE-PENDING-001 RESULT

Status: PASS — focused implementation and behavioral verification; publication gates recorded separately.
Files changed: one focal product source, generated bundle/version references, two new tests, one superseded test assertion, this audit, five append-only governance documents, focused architecture override/generated Registry and sanitized evidence.
Source-of-truth verdict: PASS — canonical own pending lifecycle is shown through the existing own reader; published financial authority and confirmed approval precedence remain independent.
Invariant verdict: PASS — no inferred approval, duplicate source ID, financial change, browser/source fallback, historical deletion or new synchronization.
Build: PASS — exact one-module change; 162 other generated chunks unchanged.
Tests: PASS — runtime 12 groups, four browser suites at 320/390/1440, actual-case replay, Pages/PWA, diff validation. Registry results in registry.json.
Security: PASS — unchanged authenticated own-reader/backend; identity switch/logout and late-response purging exercised. No selectors or credentials exposed.
Legacy impact: NOT APPLICABLE to writes — Google, backend, source observations, financial calculation and schedules unchanged.
Unexpected files changed: none in isolated checkout; unrelated root worktree left untouched.
Known limitations: isolated Chromium transport tests are not physical Android/iPhone tests; actual-case replay is read-only, not a live signed-in user session. This repair does not accelerate or change independent amortization publication. Existing source errors remain visible.
Evidence: docs/qa/evidence/history-native-pending; private .tmp/history-native-pending receipts include original read-only reproduction, screenshots/PDFs and post-publication hashes.
