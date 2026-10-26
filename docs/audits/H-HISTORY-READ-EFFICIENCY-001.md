# H-HISTORY-READ-EFFICIENCY-001

PRE-CHANGE AUDIT — 2026-10-25

- Objective: repair Historial loading and minimize redundant requests/egress, preserving all six filters, cards, tracking, approval clock and amortization.
- Authority: owner requests surgical implementation of the recommendation, no flow changes and no Google Sheets edits. Existing Google history remains authoritative; Supabase owns identity, workflows and exact approval timestamp.
- Scope: own-history read path only. Google reader code may read selected own rows, never write cells. No writer, formula, trigger, approval, amortization generation, schema, RLS or business data modifications.
- Files: app/history-loans-repository.js, app/history-loans.jsx, app/screens-historial.jsx, app/operations-store.jsx; supabase/functions/loan-history/{index.ts,history.mjs,source.mjs}; google-apps-script/financial-handoff/Code.gs (readSelfHistory_ only); focused test/build/release scripts named *history*efficiency*; focal existing history tests if required; this audit, docs/qa/evidence/history-read-efficiency/*, architecture index for changed API dependencies; generated app/bundle.js, SutiApp.html and sw.js version strings only. Local private baseline/release artifacts under .tmp/history-read-efficiency.
- Out of scope: all Sheet contents and metadata, Google permissions, all write functions, other programs, financial decisions, native workflow semantics, new replicas, scheduled synchronization and persistent financial caches.
- Baseline: .tmp/history-read-efficiency/baseline.json and before/. Large unrelated dirty worktree preserved. Navigator FRESH; focused code inspection is authoritative.
- Problems demonstrated: full-sheet values/display/re-read before exact Folio filter; blank A/Y own request rows abort entire source; null source hides unrelated native requests; 60-second loan polling plus 15-second native request polling and Realtime; detail reloads every loan schedule.
- Plan: retain authenticated Apps Script transport (direct Sheets read API preflight denied with existing scope; no permission expansion). Narrow reader to exact own Folio ranges, retain consistency and ownership checks. Add summary and one-entry detail projection; retain legacy LOAD compatibility for old clients. Blank-ID/blank-status/no-receipt incomplete rows excluded only from presentation. Preserve true duplicate/ownership failures. Remove mounted polling/Realtime from history-owned operations reader; retain mount/context/mutation/retry reads and in-flight coalescing. No settled response cache across mounts or source-error fallback.
- UI contract: original header, authorization notice, Farma section, active tracker, six filter order, card styling, badge colors, countdown, request timeline, detail quota list, advisor link, back navigation, loading/error/empty states retained. Unrelated native requests need not wait for the Google source; financial classification remains Google-authoritative.
- Security: exact TEXT numero_control derived on backend, no caller Folio; actor/context rechecked after source; DETAIL key only selects among authorized own data; frontend context races discard responses. No service_role or Google token exposed.
- Risk: selecting rows must detect insert/move/concurrent changes and preserve all quotas; summary must not multiply principal or infer missing values; financial/nonfinancial separation must preserve cash rentals and notifications.
- Tests: focused backend/receiver/browser contracts, incomplete rows, duplicate IDs, raw-control leading zeros, own/foreign detail, context race, source errors, no idle/filter calls, summary bytes versus full schedules, UI widths, source/bundle parity. Shared operations reader change requires existing global image regression against local build and Pages; report actual results, never infer PASS.
- Recovery: restore exact prechange reader/frontend/Edge code and prior Google deployment version if unchanged; no data recovery required because business writes are forbidden.
- Status: PASS for implementation scope; verification pending.

SOURCE OF TRUTH AUDIT

- Domain: affiliate request/loan history and installment display.
- Authority/readers: Google HISTORIAL P V2 and Historial de solicitudes through authenticated own-context Edge; Supabase approval timestamp/workflow/identity remain unchanged.
- Writers: existing finance workflows and staff, unchanged.
- Alternatives/fallbacks/caches: none added; only component memory and pending-promise coordination. Failure removes affected source data and displays error.
- Verdict: SAFE within declared scope.

LEGACY GOOGLE AUDIT

- Reads: fixed workbook, sheet IDs 1245291756 and 10616270; owner D/B, loan C, request A and transfer note; same financial columns as baseline.
- Writes/calculations/triggers: zero; existing writers and financial formulas remain byte-identical.
- Classification: SAFE CHANGE to read-only adapter, subject to equivalence tests; external Sheet READ ONLY.

SUPABASE SECURITY REVIEW

- No schema/grant/RLS changes. Existing own-context RPC and JWT authentication retained.
- Authorization, identity, anonymous, forged-target and context-race tests required before completion.
- Verdict: verification pending.

## Implementation and local verification

Scope update before edit: docs/SECURITY_RULES.md requires a dated additive contract note because the earlier H-HISTORY-LOAN-PAYMENTS-001 text lists LOAD as the only accepted action. This documentation update records the already authorized SUMMARY/DETAIL reader; it does not change permissions or historical decisions. Apply only this new section to the isolated release, preserving unrelated working-tree documentation.

- Added SUMMARY card-only and DETAIL single-owned-entry responses. Existing LOAD retains compatibility for clients already open. No schema or authorization change.
- Incomplete own source rows are presentation-excluded only when ID, status and receipt are all empty. Actual duplicate IDs, foreign owners and malformed transfer links still fail closed. Source rows are untouched.
- Both history readers are demand-driven: mount/context/mutation/retry. Filters and approval expiry are local; no history timer polling or extra Realtime connection. Native requests and Google history remain separate authorities. A mutation revision discards obsolete pending responses before publishing them.
- Google financial reader selects exact formatted D/B owner rows before reading financial values/notes, groups contiguous rows and rechecks selected values/display/notes, owner membership, headers and row count. All functions outside readSelfHistory_ remain identical; no Sheet writes.
- Local build b96656248e0130d77f365c9f628bbf5a9d94d6884ae753fefb902a66ea9bde9b contains only three changed chunks: history-loans-repository.js, history-loans.jsx, operations-store.jsx. Other bundle chunks and UI markup preserved. Version markers only in HTML/service worker.
- PASS: original core/receiver/browser compatibility checks, focused backend and receiver efficiency checks, browser at 320/390/1440, overlapping mounted Historial/Tracking/detail, pending mutation and context/logout races.
- PASS: global image regression against local build with legitimate production assets; all required families, legitimate PDF, refresh and with/without service worker checked. See global-local.json.
- PASS: real local Historial using controlled own account, both service worker modes, all six filters, zero filter-triggered history calls. Account has zero loans; populated cards/details are isolated fixtures, not a live populated-account claim.
- Installed backend: Google reader version 21 (previous 20), loan-history Edge version 2 (previous 1), exact readbacks and JWT verification confirmed. No database migration or business writes.
- Measured one controlled live read: 34,567 ms before and 16,598 ms after, both empty account. This is not a latency guarantee. Synthetic 120-quota full JSON 12,685 bytes versus summary 958 bytes; neither compressed traffic nor billed egress measured.
- Registry regeneration/test initially raced concurrent evidence creation. Re-run after evidence stabilizes; do not call stale index FRESH.
- Frontend publication and final published regression pending at this checkpoint.

## Initial publication gate and result (historical)

The application commit is `21046e4` on remote review branch `codex/history-read-efficiency`. Automatic approval review rejected direct push to `main`: implementation authorization did not explicitly confirm publishing to that shared branch. No bypass or merge was attempted. A separate review branch is the approved safer alternative; the currently published frontend remains unchanged. Google reader 21 and loan-history Edge 2 are already installed and backwards-compatible with its LOAD requests.

The isolated release passed the complete Architecture Registry regression (generation, freshness, lookup, stale detection, incremental updates, secret exclusions and determinism). Earlier root attempts interfered with concurrent evidence/fixture writes; they are not used as PASS evidence. Final documentation-only index changes receive an exact incremental refresh and freshness check.

```text
H-HISTORY-READ-EFFICIENCY-001 RESULT
Status: BLOCKED — frontend publication requires explicit approval after automatic review rejection; local implementation PASS
Files changed: three frontend source files and generated bundle/version strings; own-history backend projector; Google readSelfHistory_ only; focal tests/package/release/verification scripts; audit/security/evidence/derived architecture index
Source-of-truth verdict: PASS — existing authorities retained, no replica or persistent financial fallback
Invariant verdict: PASS — own Folio, immutable workflow and financial values retained
Build: PASS — isolated local Pages build, exact three-chunk parity
Tests: PASS — focused/compatibility, browser including overlays, local-live, local global images/documents and isolated Registry suite
Security: PASS locally and deployed own/anonymous/forged-target Edge checks; controlled live account empty, populated cases isolated
Legacy impact: read adapter only; Sheet cells/formulas/quotas/statuses/triggers/writers unchanged
Unexpected files changed: none introduced outside declared scope; pre-existing unrelated work preserved
Known limitations: first source load still measured 16.6 seconds in one empty-account observation; no billing savings or concurrent-user capacity claim; updated frontend/publication checks pending
Evidence: docs/qa/evidence/history-read-efficiency/ and isolated commit 21046e4
```

## Explicit publication authorization — 2026-10-25

After the explanation of merging PR #2 and publishing its reviewed changes, the owner explicitly replied "si hazlo". This authorizes merging PR #2 into main and the resulting Pages deployment. The earlier publication gate is resolved; Google Sheets contents and financial workflows remain outside the mutation scope. Merge is guarded by the reviewed head 35af6267e5d60d48c286be5e087559eaa1b99660. Published-bundle verification and global Pages regression remain required before final PASS.

## Final published verification — 2026-10-25

The owner-authorized PR #2 was merged as `7852980652de852ceae43eb3bf143799e9f46925`, preserving the exact reviewed tree of `35af626`. Pages run [40276927559](https://github.com/David14081982/SutiApp-private/actions/runs/40276927559) and the Membership contract run both completed successfully. All deployment steps, including Auth/request compatibility and the production request contract, passed.

The published frontend version is `2026102507`; the actual public bundle SHA-256 is `b96656248e0130d77f365c9f628bbf5a9d94d6884ae753fefb902a66ea9bde9b`, identical to the verified candidate. The earlier BLOCKED result above is historical and is superseded by this published result.

- `node scripts/verify-history-efficiency-live.js https://sutiapp.com/`: PASS, both service-worker modes, all six filters, SUMMARY without schedules, zero extra history calls from changing filters, zero page errors. Controlled own account: zero history entries; no populated-production detail claim.
- `scripts/test-global-image-regression-production-live.js` against GitHub Pages with the exact expected bundle hash: PASS. Legitimate assets, login seal, profile, Admin photos/document thumbnails, Membership/loan documents, catalog/gallery, Marketplace, fullscreen, refresh, with/without service worker and a legitimate PDF passed. Deployed editorial authority; no data substitution. Zero production business mutations.
- No application code changed during this publication turn. Final additions are authorization/publication/test evidence and derived index freshness only. Existing unrelated root work remains excluded from the isolated release.
- Financial source, raw Folio ownership checks, approval rules, Sheet contents/formulas/triggers and existing workflows remain unchanged. Previous backend deployment remains Google reader 21 and Edge 2; no redeployment or database migration was needed.
- Limits: the one measured empty-account read of 16.6 seconds remains a single observation; this work does not guarantee immediate first load, populated-account latency, 1,000-user capacity or billed Supabase savings. Populated loans and detail behavior are covered by isolated tests.

```text
H-HISTORY-READ-EFFICIENCY-001 RESULT
Status: PASS
Files changed: reviewed PR #2 implementation; final audit/publication/evidence and derived architecture index
Source-of-truth verdict: PASS — existing Google/Supabase authorities retained
Invariant verdict: PASS — exact own Folio, filters, workflows and financial display rules preserved
Build: PASS — reviewed bundle identity verified in published production
Tests: PASS — focal and compatibility, local/global/browser, Pages/global production and workflow contracts
Security: PASS — existing own/anonymous/forged-target/context-race checks; no new permissions or business writes
Legacy impact: read adapter only; no Google Sheets contents/formulas/triggers/writer changes
Unexpected files changed: none in isolated release; unrelated root changes excluded
Known limitations: controlled live history account empty; populated cases isolated; first load not instant; no billed-egress or concurrency benchmark
Evidence: publication.json, production-live.json, global-production.json, verification.json and prior evidence in docs/qa/evidence/history-read-efficiency/
```
