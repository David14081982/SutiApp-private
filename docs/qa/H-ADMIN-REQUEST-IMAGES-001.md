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

## Delivered production verification

Published commit `5f2a1447b46befe7a4a5801ee229026d3d145293`, bundle **227**, worker **174**.
[Pages deployment](https://github.com/David14081982/SutiApp-private/actions/runs/34240156243): success.
Both sutiapp.com and GitHub Pages serve the exact reviewed bundle SHA-256
`9790df67b2e5f3f3b43c2c979b9364d2a3590cd797bd1496eff28ad518a6d0e8`.
The follow-up commit only restores UTF-8 punctuation in loading/error copy; the verified lifecycle is unchanged.

- Production focal: **55/55 images decoded**, 0 image/Storage errors, 36 document-access calls,
  19 loan + 10 membership + 9 quote + 17 benefit document rows. Both documentary sections, workflow,
  history, fullscreen and mobile PASS. No business writers invoked.
- Production global: **PASS**, 156 app assets, 248 catalog images, 8 Admin thumbnails, login/profile,
  Membership/Loan/Marketplace/gallery/fullscreen, refresh, fresh profile and with/without service worker.
  A legitimate private PDF was found, downloaded as application/pdf and opened in the shared viewer.
- Workspace preservation: **PASS**, 944 pre-existing modified/untracked files fingerprinted; no changes
  outside declared files. Published bundle changes only the financial requests screen, not pending H08
  projections, savings code or any other workspace module.
- Canonical documents/private Storage/RLS/Edge/Auth and financial writers remain unchanged. Normal
  login/document-access audit records are expected; no document upload, replacement, deletion or business edit.

Fresh receipts: `production.json`, `global-production.json`, `deployment.json`, `workspace-preservation.json`.
The implementation and live delivery are verified; derived Registry acceptance is recorded separately.

## Guardian closure

```text
CLAUDE UI PRESERVATION REVIEW
Screen: Admin / Finanzas / Solicitudes, including embedded affiliate workbench
Original sections: filters, queue, request detail, workflow, submission documents, current expediente, history, actions
Current sections: same
Missing sections: none
Added sections: none
Interactions preserved: navigation, search/filter/sort, request selection, document/PDF opening, fullscreen
Navigation preserved: YES
Visual structure preserved: YES (existing CSS unchanged; isolated mobile capture and live responsive check)
Unauthorized redesign: NO
Verdict: PASS

SUPABASE SECURITY REVIEW
Scope: local lifecycle of individually authorized document previews
Auth/business identity: existing actor and affiliate context preserved
RLS/grants: unchanged
Roles/privilege escalation: no new privilege
Frontend exposure: no new credentials or storage paths; signed URL ephemeral only
Cross-user access: target/purpose still checked by existing backend; selection/logout/permission races tested
Impersonation/audit: existing PrivateResourceDemand context invalidation, normal document-access audit retained
Tests: isolated denied/context cases; actual authorized documents and global regression
Verdict: PASS for unchanged security boundary and focal consumer

H-ADMIN-REQUEST-IMAGES-001 RESULT
Status: PASS — correction deployed and verified with legitimate production assets
Files changed: screen; generated bundle/HTML/SW cache references; focal tests; evidence/changelog; derived Registry
Source-of-truth verdict: SAFE (canonical document relationships and private Storage unchanged)
Invariant verdict: PASS (protected finance guard and diff)
Build: PASS (109-module isolated release; only one runtime module changed; 112-module workspace build)
Tests: 11 isolated browser scenarios; protected four-suite guard; local/production 55-image focal; global local/Pages
Security: PASS for focal scope; no backend/grant/Auth/secret changes
Legacy impact: no Google, calculation, submission, approval, balance or history changes
Unexpected files changed: 0 (944 pre-existing files checked)
Known limitations: external service outages can still prevent download; UI exposes the failure and bounded recovery
Evidence: qa/evidence/admin-request-images-20260908; exact public bundle and successful Actions run above
```
