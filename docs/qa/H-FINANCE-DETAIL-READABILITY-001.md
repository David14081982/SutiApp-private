# H-FINANCE-DETAIL-READABILITY-001

## PRE-CHANGE AUDIT / AUTHORITY / PLAN / RISK

Owner authorization: 2026-09-22, explicit approval to enlarge request-detail typography, show submitted images large in a vertical flow, and collapse the current affiliate dossier.
Scope: app/screens-admin-finanzas.jsx; app/bundle.js (GENERATED_ARTIFACT); scripts/test-finance-detail-readability-browser.js; this report; docs/AGENT_CHANGELOG.md; docs/qa/evidence/finance-detail-readability-20260922/.
Navigator: check FRESH; lookup finanzas identified the screen and focal tests. No architectural mapping, authority, route or dependency changed; no Registry regeneration required for presentation-only changes.
ADR-100 impact: owner-authorized visual exception for larger previews and collapsed current dossier. Workflow snapshots, financial writers and private preview authorization preserved.
Sources: program_requests and immutable financial/workflow snapshots; request_documents for submitted evidence; affiliate_documents for current dossier; document-access for temporary authorized URLs. No new reader, writer, cache, fallback, schema or migration.
Legacy: SAFE CHANGE, presentation only. Calculations, Sheets, Apps Script and external records unchanged. Recovery: revert this screen and its generated bundle chunk together.
Risks: wrapping/overflow, image proportions, keyboard navigation, loss of sections. Validate with real Chrome and isolated synthetic fixtures; no backend calls or writes.
Status: PASS (authorized presentation scope).

## Screen contract

Preserve request conditions, approved conditions when present, accepted product/payment plan, workflow, applicant/bank reference, summary, Google status, accepted terms, timeline, submitted documents, current dossier, action controls, previous/next, close, image viewer and error/loading states.
Authorized layout change: submitted documents follow the two context columns and span full width; current dossier follows them as a native details/summary accordion, initially closed and reset per request. Signed URL lifecycle and original preview requests unchanged.
Submitted images are full width and proportional, with the existing enlarge action. Submitted PDFs have a large native iframe plus existing PDF viewer action. Browser-native PDF support remains browser-dependent.
Typography: values 18px; labels and supporting text 16px; card titles 21px; increased field spacing. CSS scoped to request-detail modal. Queue typography untouched.

## VERIFY / EVIDENCE

- Focal Babel build and vm.Script bundle parse: PASS. Full builder was inspected, and unrelated regenerated chunks were excluded from final artifact.
- Bundle comparison with HEAD: only screens-admin-finanzas.jsx differs.
- Protected source comparison with HEAD: preview lifecycle, workbench loading/actions, condition/workflow rendering and other Finanzas modules identical (line endings normalized).
- node scripts/test-finance-detail-readability-browser.js: PASS. Chrome at 1440x1000, 1024x768, 390x844 and 320x667; no horizontal overflow; computed font sizes checked; full-width proportional images; accordion mouse/keyboard; nested image viewer; zero writer calls; zero page errors.
- Screenshots and structured results: docs/qa/evidence/finance-detail-readability-20260922/.
- node scripts/test-finance-requests-flow-protected-contract.js: FAIL. Existing child test test-admin-financial-requests-workbench.js expects the absent string ?Admin y afiliado ya muestran la etapa vigente?. Re-executing its assertions with the HEAD screen reproduces the same failure. Historical guard was not weakened or rewritten.
- Production browser checks / backend status / PDF page navigation: not executed. No deployment performed.
- Global image regression: NOT APPLICABLE. No shared repository, viewer, URL signer, service worker logic, shell or Auth changes.

## CLAUDE UI PRESERVATION REVIEW

Screen: Admin / Finanzas / request detail.
Original/current sections: all preserved, documented owner-authorized relocation and accordion.
Missing sections: none. Added sections: none.
Interactions/navigation: preserved; native summary added to modal focus controls.
Unauthorized redesign: NO.
Verdict: PASS for verified presentation scope.

## H-FINANCE-DETAIL-READABILITY-001 RESULT

Status: BLOCKED (full historical regression gate; local implementation and targeted browser verification completed).
Files changed: declared scope only.
Source-of-truth verdict: SAFE; unchanged authorities and access lifecycle.
Invariant verdict: no financial/data changes; protected implementation blocks identical.
Build: PASS, focal generated chunk and syntax.
Tests: new focused browser PASS; historical guard FAIL on baseline too.
Security: no authorization, RLS, Storage or secrets changes; live security testing NOT APPLICABLE to this CSS/layout scope.
Legacy impact: none.
Unexpected files changed: none after limiting bundle generation to focal chunk.
Known limitations: historical guard unresolved; not deployed; native PDF page navigation not browser-verified.
Evidence: paths and commands above.

## SUTIAPP ARCHITECT REVIEW

Task: H-FINANCE-DETAIL-READABILITY-001.
Verdict: BLOCKED for unconditional release approval; requested local presentation implemented.
Critical findings: historical protected-contract gate fails on HEAD as well; no causal regression attributed to this change. Review based on diff, normalized protected-block comparisons, browser receipts and screenshots, not implementation summary alone.
Source of truth / Architecture / Security / Data / Legacy: unchanged.
Owner decision: NO.
Next action: resolve stale historical guard in its own audited scope, then run the release gates before publication. Do not claim production verification.
Response generated for Codex: YES.

### RESPONSE TO CODEX

Keep the requested local presentation changes and their evidence. Do not declare unconditional release PASS or publish based on the focused test alone. Reconcile the historical guard against the current protected contract under a declared audit, without modifying financial behavior or weakening authority/security assertions. No next H is auto-authorized by this review.


## Publication continuation ? 2026-09-22

PRE-CHANGE AUDIT: owner explicitly authorizes deployment and correction of the historical test if needed. Extend scope to scripts/test-admin-financial-requests-workbench.js (stale source assertions only), scripts/test-finance-detail-readability-live.js (read-only local/production verification), SutiApp.html and sw.js (bundle/cache versions only), existing H report/changelog/evidence. No financial runtime, backend, schema, records or shared media logic changes. Navigator staleness matches this H presentation/evidence; directed source inspection confirms mapping remains valid. Release from main only if remote matches inspected HEAD; no force push. Recovery: previous bundle and cache version with a new forward release. Re-run protected gate, browser tests, deployment compatibility gates and read-only published verification. Status: PASS for implementation/publication plan.

Audit extension: scripts/test-request-workflow-timeline-cutover.js also hardcodes legacy repository cache v10, while HEAD HTML/worker already use v11. Replace that stale assertion with numeric version presence and equality to worker; keep all authority/secret/workflow checks. No runtime repository change.


## Updated verification before release ? supersedes previous BLOCKED status

- Historical guard corrected without runtime changes: current readback failure and success ordering replace obsolete message; quote condition matches existing can_quote authority; repository version checked against worker rather than obsolete v10.
- Protected-contract suite: PASS, all four child tests. Its older production evidence remains historical; fresh browser checks are separately recorded below.
- Isolated Chrome readability suite: PASS.
- Read-only local build with live backend: PASS at 1395 and 390 px; measured 18/16/21 px, proportional full-width images, accordion and viewer, zero business writes/errors. Evidence: local-live.json. On resize the existing app remounts its workbench; the test reopens the detail. Local server normalizes Windows CRLF to GitHub LF to preserve vendor SRI, without bypassing integrity.
- Auth deployment compatibility: PASS, five restricted RPCs deny anonymous access and activation remains minimal/public.
- Request submission backend contract: PASS, SUTI_REQUEST_SUBMISSION_V2 ready.
- Pages artifact build: PASS, 25 public files in ignored tmp/readability-pages-277.
- git diff --check: PASS. Only finance bundle chunk plus HTML bundle v277 and worker cache v215 versions; no worker logic modification.
- Security/authority/legacy: unchanged. Screenshots use synthetic fixtures only; live receipts exclude names, bank details, tokens and URLs.

H-FINANCE-DETAIL-READABILITY-001 RESULT: PASS for pre-publication checks; deployment/post-publication verification pending.
Architect review: APPROVED to publish within explicit owner authorization, based on actual diff and receipts. No new owner decision. RESPONSE TO CODEX: publish inspected commit normally to main, wait for Pages and compatibility checks, compare deployed bundle and verify the detail read-only; record results. Do not alter backend or financial records.


## Final published result ? supersedes all pending/blocked statuses above

H-FINANCE-DETAIL-READABILITY-001 RESULT
Status: PASS.
Files changed: audited screen/generated artifacts, two historical tests, two focal browser scripts, H evidence and changelog.
Source-of-truth verdict: SAFE, unchanged.
Invariant verdict: PASS; protected-contract regression suite and readback assertions passed.
Build: PASS, local artifact and GitHub Pages workflow.
Tests: protected suite, isolated browser, local/live real-data browser and deployed real-data browser PASS; backend deployment gates PASS.
Security: existing private document access; no policy/auth/secret changes. Production browser reports zero business writes and zero page errors.
Legacy impact: none.
Unexpected files changed: none.
Known limitations: native inline PDF page navigation not independently exercised; images and their viewer verified on real records. Registry freshness reflects presentation/evidence changes, no architecture change.
Evidence: production-live.json and local-live.json; deploy https://github.com/David14081982/SutiApp-private/actions/runs/35729960951 completed successfully, including production request verification.
Published: https://sutiapp.com/ ; commit 43f2760ba859eb5d8c5485afbdc092b40f56ad96 ; bundle v277 ; worker cache v215. Published bundle bytes matched local artifact before browser checks.
Production checks: 1395px and 390px; 18px values, 16px labels, 21px titles; no overflow; full-width proportional loaded images; collapsed dossier with mouse/keyboard; image viewer preserved.

SUTIAPP ARCHITECT REVIEW
Task: H-FINANCE-DETAIL-READABILITY-001 publication.
Verdict: APPROVED.
Critical findings: historical test staleness resolved; current production evidence PASS.
Source of truth / Architecture / Security / Data / Legacy: unchanged.
Owner decision: NO.
Next action: task complete; no additional work automatically authorized.
Response generated for Codex: YES.
RESPONSE TO CODEX: Close this H with PASS and tell the owner the three requested changes are published. Preserve the documented PDF verification limit; do not claim financial/backend modifications.
