# H-ADMIN-REQUEST-DELETE-001

## PRE-CHANGE AUDIT — PASS

Owner explicitly requests an Admin Finance request delete button, removing that request and its sent
documents/images while preserving the current affiliate dossier and shared assets. Owner confirms
including its Google record. This authorizes the feature, not deletion of an arbitrary existing request.

Authority: public.program_requests and request_documents; affiliate_documents/affiliate_files/private_assets
remain the dossier authority. Live schema proves all 397 request documents have NOT NULL dossier links
and protected asset FKs. Deleting request attachments means deleting those links, never their shared
files. Signature and request-specific captures are removed with the request, with private recovery audit.

Scope: screens-admin-finanzas.jsx only; new focal admin deletion repository; bundle builder/module list
and generated bundle/cachebuster; new request-delete Edge; existing GAS receiver delete operation and
tombstone guard; migration/recovery 20260908000400; focused SQL/GAS/browser/live deployment checks;
governance/registry and this evidence. Existing approval/workflow callbacks, shared document preview,
Auth, Storage, AssetRepository and DocumentWorkflowRepository sources remain unchanged.

Deletion is authenticated/permission checked server-side. Prepare snapshots request-owned relations,
blocks competing request writes and sync deliveries, then validates/removes Google A:AG by UUID/folio,
control/date/hash. Clear only the matched record's A:AG to preserve AH+, row positions and other references.
Google retains a minimal technical tombstone to reject delayed/repeated sync, not a readable business row.
Finalize deletes request-owned children and request atomically only after Google confirmation. On failure
the request remains present with an explicit retry; no silent success. A private forced-RLS deletion journal
retains actor/reason/recovery snapshots; no browser access or runtime fallback. Dependent live requests
prevent deleting their source quotation. Historical audit moves into the private deletion snapshot.

Risk: cross-system interruption, stale sync, duplicate identity, shared assets, request dependencies.
Tests: exact SQL rollback tests including shared asset preservation, permission/idempotency/conflicts;
actual GAS fixtures including interruption/retry/identity/AH+; desktop/tablet/mobile button/cancel/error/
success/navigation tests; production backend/source checks and authenticated read-only preview.
No arbitrary live request deletion, no global suites. Shared-image regression NOT APPLICABLE because no
Storage/assets/shared viewer/repositories are modified; generated artifacts retain focal classification.
Recovery: exact live source/functions backup; private full request/children and Google cell snapshots;
migration recovery refuses to remove infrastructure after any deletion journal exists, preserving history.
No automatic restoration or background business execution.

UI contract: existing modal header, central sections, sticky footer, filters, viewer, X/Escape and previous/
next retained. Add one danger action inside the existing footer, explicit folio confirmation and busy/error
states. No other layout or approval callback changes.

## Implementation and focused verification

- Migration 20260908000400 applied; claim RPC OID/grants preserved. Exact forward/test/recovery
  transaction PASS with zero persistent test writes; request/attachment typed reconstruction PASS.
- GAS16 deployed on the same receiver/manifest. Five isolated actual-receiver cases PASS: identity,
  A:AG boundary, duplicates/formulas, interruption before/after clear, retry and no resurrection.
- Edge request-delete v1 ACTIVE with JWT verification. Eight actual-source orchestration cases PASS.
  Live admin preview, anonymous denial, invalid confirmation and browser journal denial PASS.
- 25 isolated browser cases PASS, including all existing callbacks/confirmations compared with
  ed19f77, complete visible information, cancel/error/success/retry, readonly and six viewport sizes.
- Local deployed-style build against real backend PASS: loan/membership/quote/benefit document
  sections, 70 decoded image placements, 0 preview errors, fullscreen, five viewport sizes, sticky
  controls, no horizontal overflow, and real deletion confirmation dismissed with 0 business writes.
- Scope/build verification proves only the focal screen and new deletion module differ in the bundle.
  Shared Auth/document/viewer sources are identical. HTML/SW changes are cachebuster values only.

Local test corrections: use port 8080 already authorized by document-access; 8094 is denied. Restore
vendor bytes from exact Git blobs in the private local build because Windows checkout CRLF differs
from SRI hashes. Browser driver disables HTTP2/QUIC and allows slow live Auth; application unchanged.
No production request was deleted. Live hashes were compared within the verification window;
independent user uploads between the initial backup and final checks are not overwritten/reconciled.

## H-ADMIN-REQUEST-DELETE-001 RESULT — candidate

Status: PASS — implementation/backend/local acceptance; public rollout verification follows publication.
Files changed: focal screen/repository, generated bundle/cachebusters, request-delete Edge,
  migration/recovery, existing GAS receiver, focused tests/release scripts, governance and derived registry.
Source-of-truth verdict: PASS — same request/dossier authorities; private journal never read as fallback.
Invariant verdict: PASS — ADR-108 / INV-218/219; history retained privately, shared files preserved.
Build: PASS — 110 modules; only two focal modules differ; exact vendor Git blobs for local SRI.
Tests: PASS — SQL/recovery, GAS 5, Edge 8, browser 25, bridge 9, live negatives and real modal preview.
Security: PASS — backend permission, JWT, forced RLS, no journal browser access, no leaked secrets.
Legacy impact: authorized verified A:AG clear only; AH+ and financial writers/calculations unchanged.
Unexpected files changed: none; isolated release worktree, primary workspace preservation recorded separately.
Known limitations: no destructive end-to-end test against an existing production request; real confirmation
  is cancelled. Unverifiable legacy identity or a dependent quotation fails closed. A prepared deletion
  locks transitions until resumed. Private audit/recovery snapshots intentionally remain; no automatic restore.
Evidence: docs/qa/evidence/admin-request-delete-20260908 (JSON receipts and synthetic screenshots only).

## Final review scope refinement

Review identifies reverse parent/outbox lock order when an ordinary sync worker updates an existing
outbox row while a request writer holds the parent. Migration/recovery 20260908000401 will refine only
the newly introduced child guard: unchanged outbox identities already serialize with prepare through
the outbox row lock, so they do not need a second parent lock. Inserts/identity changes retain parent
locking. Validate concurrent rollback-only updates and the complete deletion matrix before applying.

## Final delivery - PASS

Runtime commit 740767a8bf439057219ab61b85637c0834185c5a pushed to main; Pages run 34277616430
completed successfully, including Auth/request backend compatibility and production artifact checks.
Public HTML/bundle/SW match the candidate hashes exactly. Authenticated production modal acceptance
PASS: all four request types, 70 image placements decoded, zero preview/storage errors, fullscreen,
five responsive sizes, sticky controls and real delete preview cancelled; zero business writes.

Final review reproduced a lock inversion between a parent request writer and an existing outbox update.
Migration 20260908000401 refines only the new deletion guard: an unchanged outbox identity is serialized
by its row lock already taken by prepare, avoiding the redundant reverse parent lock. INSERT and
identity changes keep parent locking. Exact forward/recovery plus full deletion matrix PASS in ROLLBACK;
both concurrent no-op transactions then PASS with identical request/outbox hashes. Same OID/grants.

Final status: PASS. Existing approval/workflow persistence and all shared image/Auth sources remain
unchanged. No production request was deleted by the implementation or verification. The isolated
release contains only declared files; primary source changes were merged without changing its HEAD,
index or 2,259 unrelated files. Derived registry is finalized with the closure evidence.
