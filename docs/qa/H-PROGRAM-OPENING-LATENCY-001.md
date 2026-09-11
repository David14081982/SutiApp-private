# H-PROGRAM-OPENING-LATENCY-001

## PRE-CHANGE AUDIT

Objective: display already loaded program information from Finanzas in <200 ms; load cover/catalog independently; eliminate transparent loading overlay. Owner explicitly requests only three paired performance cases and six functional checks.

Scope: `app/fincat-store.jsx` (session-bound presentation snapshot and deduplicated refresh), `app/program-general-info.jsx` (public header reader and independent cover; preserve Admin editor reader), `app/screens-marketplace.jsx` (use public reader and opaque loading/error shell). Generated `app/bundle.js`, HTML bundle cachebuster; `scripts/test-program-opening-latency.js`; this report, `docs/qa/evidence/program-opening-latency-20260911/*`, changelog appendix. Derived architecture registry JSON parts may be regenerated because the public reader now uses the existing finance presentation store. No changes to source-of-truth declarations, SQL, backend, global Auth/router/viewer/asset helpers, program products, prices, quotes, financial calculation, Google, or deployment.

Authority: existing Supabase `finance_catalog_presentation` for editorial information; `app_assets` for cover metadata. `program_catalog_items` and its current repository/store remain unchanged. Existing `save_program_general_info` payload and permissions retained. No persistent storage, invented public data or fallback on errors.

Plan: expose the same loaded presentation rows to the public program view, scoped to PrivateResourceDemand context. Keep Admin `useInfo(..., false)` and Terrenos' distinct screen behavior intact. Read cover metadata separately with deduplication per presentation revision/session; report cover errors separately. A single store-owned focus handler coordinates updates. A save invalidates pending old reads; a session change clears rows and cover results. Preserve the original favorite behavior (program header toggle is component-local; item favorites retain existing backend).

Risk: stale reads after save/logout, unintended draft reset, layout regression, duplicate focus subscriptions. Controls: request/context identity, unchanged editor reader and writers, isolated browser checking real compiled UI/store/shell, exact bundle-module parity.

Tests: exactly three performance scenarios (normal, slow responses, repeated opening), one before/after sample each; six functional checks (Back scroll; favorites; focus; Admin update; error/retry; session reset). Build/syntax and diff/registry inspection are artifact checks, not additional functional suites. No new global suite under the owner's explicit cap.

Recovery: baseline bytes and workspace SHA256 manifest at `C:/tmp/sutiapp-program-opening-before-20260911`. Restore only this task's deltas, preserving all preexisting modifications.

Navigator: check/lookup performed; Registry initially STALE, so code and declared authority inspected directly. Primary reader `program-general-info.jsx` was an unindexed addition, traced from exact loading text and callers.

Legacy guardian: READ ONLY classification for existing Finance shell references; no financial or Google runtime operated. Source-of-truth verdict: SAFE for design. Security: existing backend/RLS/identity remain authoritative; frontend memory is not authorization.

Status: PASS to implement locally.

## UI contract

Finanzas retains summaries, search, filters, memberships, grouped program cards, scroll/header/bottom navigation. Public program retains cover, Back/heart, icon, title/breadcrumb, description, quote status, Call/WhatsApp/Save, benefits and available catalog, product navigation, modals and existing motion. Loading/error covers the route; failed cover offers its own retry. No section or control removed. No changes to Terrenos map, Admin forms, products/prices or request flows.

## Result

H-PROGRAM-OPENING-LATENCY-001 RESULT

Status: PASS (local, isolated validation).
Files changed: three declared source modules, generated bundle and HTML token, focal test script, this report/evidence, changelog appendix and derived Registry artifacts.
Source-of-truth verdict: PASS. Public header reads the existing finance presentation snapshot; covers read existing app_assets under current permissions. No alternate authority or persistent browser storage. Removing the authoritative row makes the header fail visibly; it cannot reappear from a prior snapshot.
Invariant verdict: PASS within the declared scope; product repository, product data, payment/quote logic, global Auth, router, shared image viewer and service worker are unchanged.
Build: PASS; compiled syntax valid, three changed modules, 115 unrelated modules byte-identical. Final bundle matches the browser-tested SHA256 in build.json.
Tests: PASS; exactly three paired performance cases, followed by six functional checks. One before/after sample per case; no statistical percentile claim.
Security: PASS for inspected frontend boundary and isolated session cleanup; zero external requests and zero production writes. Backend/RLS unchanged and not re-certified by these tests.
Legacy impact: NOT APPLICABLE; no financial or Google operation or modification.
Unexpected files changed: see workspace-preservation.json, compared with pre-task hashes rather than the already dirty Git HEAD.
Known limitations: timings are from desktop Chrome with a 390x844 viewport and controlled HTTP delays. They are not production/mobile-device guarantees. Terrenos retains its separate map reader. Program-header favorites retain their existing component-local behavior; no new persistence is claimed. No deployment in this H.
Evidence: docs/qa/evidence/program-opening-latency-20260911/.

### Cause and correction

ProductScreen previously called useInfo on each opening, querying finance_catalog_presentation again with the cover join before rendering its content. Finanzas had already read the same program_info columns. The waiting route had a transparent background, exposing the previous Finance screen behind the clock/message.

usePublicInfo now consumes that existing presentation revision immediately. Cover metadata and image loading proceed independently. Focus reads share one listener and in-flight request. A general-information save forces a fresh revision so an older refresh cannot overwrite it; session changes discard rows and pending results. Admin's draft reader and payload remain unchanged. Loading and error routes now have an opaque background and retain Back/retry.

### Three performance cases

Milliseconds from actual card click to a rendered description and a hit-testable Back button. Image completion and catalog product availability are recorded independently from the same click.

| Case | Information before | Information after | Image before / after | Products before / after |
|---|---:|---:|---:|---:|
| Normal, Auto | 463.7 | 28.3 | 726.7 / 427.2 | 463.7 / 374.9 |
| Slow HTTP responses, Aires | 966.8 | 49.0 | 1774.1 / 1441.6 | 1229.3 / 1231.0 |
| Reopening, Puertas | 396.9 | 14.5 | 397.0 / 14.6 | 397.0 / 14.6 |

All three already-loaded information measurements meet <200 ms. Each opening eliminates one presentation-single request; reopening issues zero requests. The slow catalog still takes about 1.23 s, which demonstrates that it no longer blocks the usable header.

### Six functional checks

1. PASS: Back retained the same Finance scroll node and position, 1371 px.
2. PASS: header heart and Guardar stayed synchronized; existing component-local behavior preserved. Product favorite repository is unchanged.
3. PASS: repeated focus/visibility during an active read produced one presentation-list and one independent cover read, zero presentation-single reads.
4. PASS: actual Admin Editor preserved an unsaved draft on focus; save updated public header and Finance card despite an older pending refresh. Removing the row did not resurrect old content.
5. PASS: text failure remained visible and opaque, retry recovered; cover failure/retry was independent; catalog failure/retry preserved the header.
6. PASS: logout removed prior rows; the next actor saw only their session's fixture content, including after a delayed old presentation response completed.

Execution: node scripts/test-program-opening-latency.js; the verifier initially stopped during check 5 because it observed the preexisting missing-row error before the failed refresh completed. Corrected the verifier to wait for the store error, and corrected a pending-read setup to avoid awaiting the promise it was meant to leave pending. node scripts/test-program-opening-latency.js --resume-pending completed only checks 5 and 6; the three performance results and first four checks were retained. browser-initial.json preserves the original partial run. No runtime correction was needed for that verifier failure.

### Preservation and review

CLAUDE UI PRESERVATION REVIEW

Screen: Finanzas and public ProductScreen.
Original sections / Current sections: cover, Back/heart, heading/breadcrumb, description, contact/save, quote status, benefits, product catalog and existing navigation are retained. Finance source is unchanged.
Missing sections: none in the inspected diff and equal-viewport captures.
Added sections: independent cover status/retry only.
Interactions preserved: six checks above; unchanged product/quote/modal code verified by diff.
Navigation preserved: PASS, actual App/Root and Back scroll exercised.
Visual structure preserved: PASS, normal-before.png and normal-after.png inspected at the same viewport.
Unauthorized redesign: NO.
Verdict: PASS.

SUTIAPP ARCHITECT REVIEW

Task: H-PROGRAM-OPENING-LATENCY-001.
Verdict: APPROVED for the bounded local change, based on source/bundle diffs, browser evidence and workspace hashes. This is a separate review pass in the same agent, not an external review or full historical governance audit.
Critical findings: no unresolved defect found in this scope. docs/WORK_QUEUE_HISTORY.md is absent; the current WORK_QUEUE concerns a separate legacy phase and does not authorize a next task. Initial Registry staleness predates this H; regeneration only updates the derived index from local code.
Source of truth: existing Supabase presentation and asset authorities retained.
Architecture: one presentation snapshot per private context; public reader now subscribes to it; no parallel data writer.
Security: existing backend permissions retained; stale actor results rejected; production authorization tests outside these isolated checks.
Data: no production mutations, schema changes or historical cleanup.
Legacy: unchanged.
Owner decision: NO.
Next action: close this local task; do not start a new H or publish as part of this review.
Response generated for Codex: YES.

RESPONSE TO CODEX: Accept H-PROGRAM-OPENING-LATENCY-001 within the stated evidence limits. Preserve existing workspace changes, report the three measured timings and six checks, and stop after recording the local result. No further functional suites or production operations are part of this H.


## Authorized release - 2026-09-10

Owner explicitly requested commit and push after local acceptance. PRE-CHANGE AUDIT: prepare only the three tested source deltas on current origin/main in C:/tmp/sutiapp-program-opening-latency-release; preserve published typography and unrelated source/bundle modules. Publish this report, the focal script and evidence; append only this H to the published changelog. Regenerate the release-derived Registry rather than copying the dirty workspace index. Synchronize generated HTML/bundle/service-worker version tokens only; no worker logic change. No data/backend/SQL/financial changes. Validation reuses the three paired cases and six checks already recorded, plus release syntax/module parity, diff, deployment status and public artifact readback; no additional functional suites. Recovery: revert the isolated release commit if needed, retaining all prior history and the original workspace. Status: PASS to prepare/commit/push under the owner's current instruction.


Release verification: PASS. Prepared on origin/main 556598d; only fincat-store.jsx, program-general-info.jsx and screens-marketplace.jsx changed in the published bundle, with 113 other published modules byte-identical. The published typography tokens are preserved; after normalizing only those existing typography expressions, all three sources match the locally tested implementation. Syntax and diff checks PASS. HTML/bundle248 and worker194 are synchronized; service-worker logic is unchanged. Source-of-truth/security/legacy conclusions remain as in the local review. No additional functional tests were run. The released artifact is validated by source parity, existing three-case/six-check evidence and the deployment workflow; local timing numbers are not a production benchmark. The preceding local-only status is historical; this appendix records the owner's later publication authorization.

ARCHITECT RELEASE REVIEW: APPROVED for this bounded commit/push. Source deltas and generated output preserve the existing published application. No data/backend or unrelated workspace edits included. RESPONSE TO CODEX: commit this isolated release, push without force to origin/main, then verify the exact deployment and published artifact; preserve the original workspace.
