# H-ADMIN-REQUEST-IMAGES-001

## PRE-CHANGE AUDIT

Status: PASS (implementation authorized by owner: «requiero lo soluciones»).
Objective: stop intermittent blank document thumbnails in Admin / Solicitudes.
Baseline: production/main 4c60c41; isolated worktree avoids publishing unrelated workspace work.
Scope: app/screens-admin-finanzas.jsx; focal browser test scripts/test-admin-request-images-browser.js;
scripts/test-admin-financial-requests-workbench.js (only assertions affected by preview extraction);
generated app/bundle.js, SutiApp.html/sw.js version references; derived docs/architecture registry files;
this evidence, docs/AGENT_CHANGELOG.md; evidence directory docs/qa/evidence/admin-request-images-20260908/.
Scope clarification before QA: add scripts/test-admin-request-images-live.js for actual image decoding,
read-only financial queue coverage, and sanitized receipts. Temporary allowlisted site server and runner
are evidence tools inside the declared evidence directory; no runtime server or production config changes.
No repository, shared viewer, Auth, RLS, Edge, SQL, business data, or financial writer changes.
Recovery: revert this isolated release; no data recovery needed.

## Authority, risk and plan

ADR-100 impact: only private preview lifecycle. Preserve queue/filter/sort, detail, workflow,
actions, history, request evidence versus current expediente, thumbnails, PDF and fullscreen.
Authority: request_documents links submission evidence; affiliate_documents/private_assets/private-assets
hold document metadata/objects. DocumentWorkflowRepository.adminPreview -> document-access remains the
only authorizer/signer, with existing actor/target/purpose checks and audit. URLs are ephemeral in memory.
No fallback, storage copy, fixture or browser persistence in production. Source-of-truth verdict: SAFE.
Legacy: SAFE CHANGE, presentation only; zero Google reads/writes, formulas, triggers or finance changes.
Security: invalidate on context/target/permission changes; discard late responses; reauthorize explicit opening.
Risk: async race, retry storms, expiry, duplicated sections, transient image failures and changed permissions.
Plan: stable document identity; three concurrent loads; confirm image download before ready;
one bounded recovery on image failure; visible error/manual retry; fresh explicit opening; cleanup.
Tests: isolated Chrome with real image responses, delayed/broken image, rerenders, duplicate document,
context/selection races, denied access, expired opening, PDF/layout. Protected finance regression guard.
Run global image regression against isolated local build and Pages because signed-source lifecycle changes;
never mark an unavailable live gate PASS. Live tests use existing legitimate assets, no business writes.
Registry: workspace STALE; direct source and production-baseline inspection used instead. Incremental
update only for the screen dependency on the existing PrivateResourceDemand context invalidation.

## Verification before publication

- Isolated Chrome: PASS, 11 scenarios. Before: 1 signing request becomes 4 after three unchanged
  parent renders; after: remains 1 and the existing image DOM node survives. Slow downloads are not
  labelled ready; failed/hung images recover once, then explicit error/manual retry. Sixteen rows
  sharing eight documents produce eight authorizations with at most three loads in flight.
- Selection race: a late first-affiliate response cannot replace the second affiliate. Logout and
  permission removal clear previews/viewer. Expiry refresh and explicit opening reauthorize. A second
  rendered-image failure clears expiry timers as well, so an error cannot restart periodic retries.
- Local candidate with production backend: all 55 image rows decoded, zero errors, four request types,
  original workflow/history/two documentary sections, fullscreen and mobile PASS. Zero business writes.
- Global local build: PASS, legitimate existing assets, 156 app assets, 248 catalog links, Admin thumbnails,
  login/profile, Membership/Loan/Marketplace, fullscreen, real PDF, refresh and with/without service worker.
  The final timer-cleanup line is additionally covered by the final focal browser test; shared modules
  exercised globally are byte-identical. No global viewer/repository/Auth/Storage policy code changed.
- Protected finance guard: PASS (four static suites; its historical browser record is not treated as a
  fresh run). Read-only --status: RPC and trigger present, 48 requests / 30 tracking records.
- Build: 109 modules; the only changed runtime module is screens-admin-finanzas.jsx. Other browser
  assets are exact Git bytes in the local artifact, avoiding Windows CRLF changes to SRI-protected vendors.
- Architecture index: baseline already stale from H07; targeted incremental refused the incomplete set.
  Full regeneration used; only derived index, no runtime/data/schema authority changes.

Receipts: [evidence directory](evidence/admin-request-images-20260908/).
Publication and final Pages verification remain pending at this checkpoint.
