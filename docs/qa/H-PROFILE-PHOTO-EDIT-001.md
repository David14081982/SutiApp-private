# H-PROFILE-PHOTO-EDIT-001

## PRE-CHANGE AUDIT
Status: PASS (implementation authorized by the owner's current request).
Objective: change one's profile photo by pressing the circular avatar, with a camera badge on its right.
Scope: PerfilScreen in app/app.jsx; app/affiliate-repository.js; generated app/bundle.js and SutiApp.html cachebuster; new photo migration/recovery; focused scripts and evidence; architecture registry and governance documentation.
Existing unrelated workspace changes are preserved. No financial, Google, authentication or shared routing changes.
Authority: Supabase affiliate_files -> private_assets -> private-assets. Keep original rows and objects; select the current photo explicitly instead of overwriting historical files.
Readers: existing AffiliateRepository photo consumers. Writer: new self-only RPC, authenticated owner derived server-side; no target affiliate parameter.
Plan: additive current-photo marker, audited upload registration, accessible avatar button, upload/error states, cache invalidation and existing context refresh.
Risk: private Storage ownership, concurrency, historical document preservation, stale photo cache. Serialize writes per affiliate; retain history; never introduce public URLs or browser persistence.
Tests: transaction rollback with owner/cross-user/anonymous cases, focused browser/UI failure tests, existing photo tests, build and global image regression against local build and GitHub Pages.
Recovery: remove new writer and marker only before any successful upload; preserve all history after activity. Restore frontend from task-specific baseline.

## Visual contract
Preserve header/back, avatar circle, name, section, status/control, eight facts, five navigation rows, logout and scrolling. Only the avatar becomes a button with a camera badge and explicit upload feedback.

## Architecture discovery
Registry stale only in screens-home-r2.jsx and voting review evidence. Inspected current PerfilScreen, AffiliateRepository, Auth photo projection, document upload writer, Storage policy and original asset schema directly. Document uploads are not the profile-photo authority.

## SOURCE OF TRUTH AUDIT
Domain: current profile photograph. Authority remains affiliate_files and private-assets. Existing photo rows remain intact; an additive marker selects exactly one current photo per affiliate. Signed URLs and principal-scoped memory cache remain derived. No mock, localStorage or legacy fallback. Verdict: SAFE design, backend verification pending.

## DATABASE MIGRATION / SECURITY
Additive marker and self-only audited RPC. No existing Storage policy changes. Preserve numero_control, historical metadata, documents and original objects. Only the linked authenticated owner may register a photo; impersonation is rejected. RLS continues to control reads. Migration/recovery and live security matrix PASS with ROLLBACK; migration applied. Historical initialization preserves timestamps.

## Verification evidence

- `migration-check.json`: forward/recovery compilation in ROLLBACK.
- `security.json`, `live-security.json`: owner/idempotency/history/documents/audit; cross-user read/path/hash/Storage isolation; metadata validation, direct-DML and anon denial. Zero persistent fixtures.
- `browser.json`, `profile-mobile.png`: actual PNG decoding and JPEG upload in an isolated browser; avatar picker, refresh, invalid file, upload and registration errors, persisted-but-signing-failed message, navigation preservation.
- `build-scope.json`: compiled app.jsx matches bundle; all code outside PerfilScreen matches the pre-task baseline.
- `global-production.json`, `global-local.json`: required global regression PASS for local build and GitHub Pages, legitimate image/PDF assets, fullscreen, refresh and with/without service worker; zero production data rewrites.
- Initial random-port local checks failed due to Edge CORS. Confirmed allowed origin `http://localhost:8080`, reran successfully without modifying CORS or security policies. The failed attempt and diagnosis are retained.
- `node scripts/test-profile-photo.js`: PASS. `git diff --check` scoped files: PASS.

## CLAUDE UI PRESERVATION REVIEW

Screen: Mi Perfil.
Original/current sections: header/back, avatar, name/section/status/control, eight facts, five navigation rows, logout, scrolling.
Missing sections: none. Added: camera badge, accessible photo button, upload/error feedback.
Interactions/navigation/visual structure preserved: YES. Unauthorized redesign: NO.
Verdict: PASS.

## H-PROFILE-PHOTO-EDIT-001 RESULT

Status: PASS for implementation/backend; frontend publication pending.
Files changed: app/app.jsx (PerfilScreen only), app/affiliate-repository.js, generated app/bundle.js, SutiApp.html cachebusters; migration/recovery; photo tests and evidence; governance and derived architecture registry.
Source-of-truth verdict: SAFE — same Supabase authority, explicit current marker, no fallback.
Invariant verdict: PASS — historical rows/objects and documents retained; one current photo.
Build: PASS — 124 modules, syntax and exact source/bundle check.
Tests: PASS — focused unit/browser/security and global local/Pages images.
Security: PASS — self-only audited RPC, existing RLS, cross-user denial, no browser secrets.
Legacy impact: NOT APPLICABLE — no Google/financial readers or writers changed.
Unexpected files changed: no manual changes outside declared scope; unrelated existing workspace modifications retained. Bundle rebuilt from current workspace sources.
Known limitations: UI is local, not yet published. No real user's profile photo was changed for testing. Recovery refuses to remove the current-photo marker after actual user edits. Interrupted full Registry regeneration/tests are not claimed PASS; targeted registry validation is recorded separately. Uploads with ambiguous registration responses are retained privately for later reconciliation.
Evidence: docs/qa/evidence/profile-photo-edit-20260916/.

## SUTIAPP ARCHITECT REVIEW

Task: H-PROFILE-PHOTO-EDIT-001.
Verdict: APPROVED for implemented scope; no claim of frontend deployment.
Critical findings: backend and local UI satisfy the request. Global local failure was CORS test-origin configuration and passed from the already-authorized origin. Existing unrelated dirty work is not authorization to publish it.
Source of truth: same Supabase relations/storage, unique current marker.
Architecture: existing repository and photo projections; no parallel profile store.
Security: owner-derived writer, isolation tests and audit evidence inspected.
Data: retains prior files and document links. Legacy: unchanged.
Owner decision: NO for implementation. Publication remains a separate release action.
Next action: prepare a scoped frontend release from the approved production baseline and verify its exact diff before publication; preserve unrelated workspace work.
Response generated for Codex: YES.

### RESPONSE TO CODEX

Accept the implemented profile-photo feature and the applied backend migration. Do not claim the new camera button is already live. Any subsequent publication must isolate this H's frontend changes, retain existing unrelated work, and verify the published artifact; do not auto-advance the unrelated master-plan queue. WORK_QUEUE_HISTORY.md is absent; no orchestration authorization is inferred from it.

## RELEASE CORRECTION — 2026-09-16 (publication)

Publication baseline: `origin/main` 4a6ace20b2035fa45850d2298fbf5f81ee49a5db.

The app.jsx carried in the task workspace was derived from a stale checkout and would have reverted
`SettingsScreen` and the `--text-*` accessibility tokens shipped by H-USER-TEXT-SIZE-SMALL-001. The
earlier build-scope check compared that file against the same stale workspace baseline, so the
regression was invisible to it.

Correction applied before publication: the PerfilScreen changes were re-applied onto the production
app.jsx. Verified after re-application — `SettingsScreen` retained, `TextSizeSettings` retained,
`app.push('settings')` retained, `var(--text-*)` tokens 30 -> 32 (only the two new feedback lines
added, reusing the existing `--text-12` token). The app.jsx diff against production removes exactly
the two lines of the old avatar wrapper.

Shipped `app/bundle.js` is the production artifact with exactly one chunk replaced (`app.jsx`); the
other 124 chunks are byte-identical to 4a6ace2. A full rebuild additionally reformatted
`screens-credencial.jsx`, `screens-admin-fincat.jsx` and `screens-admin-program-products.jsx`
(whitespace only, no behaviour change, pre-existing drift between the committed bundle and its
sources); that drift was deliberately NOT shipped in this release.

`node scripts/test-profile-photo.js`: PASS. Bundle syntax and exact compiled-app.jsx containment: PASS.
Backend migration `20260916000100` was already applied; this release publishes the frontend only.
