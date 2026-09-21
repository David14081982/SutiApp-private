# H-SAVINGS-BENEFICIARIES-FRONTEND-DELIVERY-001

## Pre-change audit
Base: cee6f2a75d958dc6e82db45a4aa5e7d91da24bd9, matched origin/main.
Owner authorizes focal frontend, isolated tests/rollback fixtures, surgical commit, push,
automatic Pages deployment and public verification only after required checks pass.
Runtime scope: app/savings-repository.js, app/savings-request-form.jsx,
app/screens-savings.jsx. Generated: app/bundle.js, SutiApp.html and sw.js cache references.
Support: two recovered isolated tests, synthetic rollback SQL test, focal build wrapper,
one direct read/cache test adaptation, this audit, evidence, pending plan, authority/changelog,
and derived Architecture Registry. No other savings method or screen workflow is changed.
No migration, import, tracking modification, business-data backfill or historical-file replacement.

## Authority and backend
Supabase beneficiary versions/distributions are the sole authority; import rows preserve
historical provenance. Signed authorizations and private Storage signatures implement consent.
get_self_savings_beneficiaries -> prepare_self_savings_beneficiaries -> upload PNG without
upsert -> commit_self_savings_beneficiaries. Identity derives from effective affiliate and
real actor; expected owner/version, SHA256, size and idempotency key are checked by backend.
Frontend rejects responses from a changed context and malformed success responses.
No localStorage, DATA, JSON, cached dashboard or Google fallback for beneficiary distributions.
Signed URLs have a 300-second lifetime and are requested only when a signature is opened.

## Behavior
Read/add/edit/remove, optional historical relationship with explicit unknown label,
positive percentages with at most two decimals and total <=100 (including an empty signed
replacement). Every successful modification creates a new version, preserving old rows.
Signature and consent are mandatory. Editing invalidates both; resizing the signature canvas
requires signing again. Uncertain saves retain the same idempotency key for retry.

## Preservation
The four historical patch hunks were applied to current files after SHA256 and apply checks.
Subsequent robustness changes are confined to beneficiary methods/components.
All 126 unrelated bundle chunks are unchanged; only three beneficiary chunks differ.
Other repository methods and other request forms are byte-equivalent after LF normalization.
The complete bundle is rebuilt from all 129 CURRENT source files with Babel 7.29.0;
two JSX-named raw-JS modules preserve established formatting directly from current source.
No historical bundle is consumed. SW logic is unchanged; only CACHE and bundle URL advance.
Build command: node scripts/build-savings-beneficiaries-release.js C:/tmp/babel-standalone-7.29.0.min.js

## Validation
Repository isolated VM: context, actor/owner, invalid signatures, malformed responses,
SHA256, same-key retry, duplicate upload, committed retry and stale versions.
Browser sources and actual compiled bundle: read/add/edit/remove, <=100 and >100 rejection,
relationship, signature/consent, retries, history fixture, remount/relogin, errors/pending,
320/390/1440 pixels x normal/large/largest, touch input, rotation, clear button.
19 existing read/cache/context tests pass; the generic-write case uses releaseHold in its
isolated fake RPC harness because the old unsigned beneficiary writer is intentionally retired.
Backend test: two NEW synthetic Auth/affiliate/participant identities inside BEGIN/ROLLBACK;
real installed functions and RLS verify signing, history, version races, cross-user denial,
old unsigned writer denial and raw-table isolation. No real affiliate is selected or edited.
Before/after counts, full four-table hashes and panel definitions match. Auth/affiliate/
participant/Storage-object/audit-event counts restored. No permanent fixtures or Storage bytes.
Tracking remains 20260918120000 / savings_beneficiaries, entire tracking snapshot unchanged.
Protected totals: 112 active beneficiaries, 101 versions, 98 PENDING_REVIEW, 210 import rows,
162 signature_path. Private baseline/readback evidence remains under ignored .tmp/beneficiaries-frontend.

## Build and global regression
Local Pages artifact is built by scripts/build-pages-site.js. On Windows its three SRI vendor
files are normalized to canonical Git blob bytes to match Linux CI; no vendor source changes.
Full shared-repository image regression is required locally and on GitHub Pages; results are
recorded separately. Do not infer a pass from the mere existence of a test command.

## UI preservation review
Screen: affiliate Ahorro and beneficiary sheets.
Original/current sections: header/back/refresh/info, balance, annual detail, request actions,
enrollment, retirement notice, history/withdrawals/beneficiaries navigation and sheets.
Missing sections: none. Added: authoritative loading/error/pending beneficiary states,
signature preview, signed authorization controls. Navigation/scroll/layout preserved.
Unauthorized redesign: NO. Focal browser matrix: PASS.

## Recovery and release
Revert only this frontend commit and rebuild/redeploy its parent if release regression occurs.
Never execute a backend recovery or undo imported history/tracking for a frontend rollback.
Evidence represents release validation; final deployment/production readback is checked after push.
No other savings work is authorized by this H.

## Release gate and architect review
Local global image regression: PASS (global-local.json), on the existing allowed origin
http://localhost:8080. Includes legitimate PDF, all image families, Admin, fullscreen,
refresh and service worker on/off. The initial Windows SRI and unallowed-origin issues
were confined to the local test setup and resolved without backend or shared-source changes.
Status: PASS / READY_FOR_PUBLICATION. Owner already authorizes commit/push/deployment.
Source of truth: PASS. Invariants: PASS. Security: PASS. Legacy: unchanged.
Build: PASS. Backend synthetic rollback: PASS. Source and compiled-browser matrices: PASS.
Unexpected functional files: none. Full registry generator acceptance suite is not a release
requirement here; derived registry structure/privacy/freshness are checked directly.
Architect verdict: APPROVED for the authorized frontend release. Backend, import and tracking
are installed and preserved. After push, verify Pages success, deployed bytes, frontend fixture
matrix and global production image regression; do not start another savings task.
