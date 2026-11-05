# H-AFFILIATE-DOCUMENT-UPLOAD-REGRESSION-001

## Pre-change audit and diagnosis

Owner requests investigation before application changes, then trustworthy expediente upload/replacement tests without deleting any file. Diagnostic phase completed before implementation: production logs show eight SQLSTATE23505 failures at register_admin_affiliate_document, constraint affiliate_documents_current_review_idx. Seven retired pending documents remain in the old status-only unique index. Existing writers correctly skip retired history, so insertion collides. Four isolated scenarios using all 17 real indexes and nine real triggers reproduce this: admin/self x image/PDF; first upload and normal replacement pass, upload after retired pending fails. No production document writes/deletions during diagnosis.

Earlier evidence correction: 5,394 integrity checks concerned historical copies, not end-to-end uploads. The 12 prior isolated cases omitted independent indexes and pre-existing triggers; prior production browser verification was read-only. Those checks cannot certify upload/replacement. This H supersedes that unsupported conclusion with complete schema and live flow coverage.

Scope: migration/recovery 20261105000200_affiliate_document_review_slots.sql; scripts/test-affiliate-document-review-slots.js; scripts/fixtures/affiliate-document-review-slots-schema.json; scripts/release-affiliate-document-review-slots.js; scripts/verify-affiliate-document-upload-live.js; this audit and docs/qa/evidence/document-upload-regression; appended SOURCE_OF_TRUTH/DATA_GOVERNANCE/DECISIONS/AGENT_CHANGELOG; derived architecture registry if relationships change. Private diagnostic/backups remain .tmp/document-upload-diagnosis. Root has unrelated changes; publish only isolated release delta.

Authority: affiliate_documents and document_retirement_private.documents remain canonical. Replace the status-only unique reservation with a private derived review_slots enforcement table, real database UNIQUE(affiliate_id,document_type_id), populated only from active pending/review/reupload documents and maintained atomically by document and retirement triggers. It is an integrity index, never a user-facing data source or fallback. Preserve original status, timestamps, assets, all rows and historical audit. Existing upload RPC bodies, UI, roles and Storage policies unchanged.

Risk/control: concurrent duplicate review reservations require real uniqueness, not a query-only trigger. RLS forced and no API grants on derived table. Migration locks affected tables, fingerprints originals before/after, checks exact installed index/schema, backfills slots and verifies parity before dropping obsolete index. Recovery restores prior index only when original-history duplicates permit it; otherwise fail closed without modifying history. No financial/Google writes or logic changes. No private_assets/AssetRepository/shared viewer modification; focused dependencies appropriate.

Tests: reproduce original failure first; exact schema indexes/triggers parity; active and post-retirement uploads, replacements, admin/self, PNG/JPEG/PDF, pending/under-review/reupload/verified states, same bytes independent ownership, uniqueness and permission denials, history preservation, recovery. Live tests use authenticated controlled account and its own valid existing document bytes, unique new Storage paths, no fixture business documents in other affiliates. Any DELETE or destructive RPC/Edge is intercepted before network; no cleanup or deletion scripts. Retain every test-created version/object with private receipts. If PDF is unavailable in controlled account, do not manufacture a document in production: use the isolated matrix with captured actual schema and report the production coverage limit. No PDF rollback test was executed against production. Do not claim end-to-end cases not exercised.

Source-of-truth guardian: SAFE for proposed derived integrity index. Migration/security: PASS for design, implementation/tests pending. UI preservation: no frontend edits; existing upload dialogs and flows will be exercised. Legacy: no writes/logic changes; protected table fingerprints only. Architecture lookup stale only for unrelated loan availability changes; targeted published source/current schema inspected directly.

## Implementation and production evidence

The correction was installed at 2026-11-05T20:22:13.142Z. The migration preserved exact fingerprints of all 16 original tables and eight existing writer/permission definitions and ACLs. Seven retired pending documents no longer reserve review slots. Post-upload verification reports 1,569 active slots, zero mismatches, zero retired reservations, forced RLS and no API grants. Installation did not change document statuses, timestamps, content, asset ownership, upload RPC bodies, global permissions or any frontend file.

Isolated PostgreSQL tests: 21 check groups and 24 upload/replacement scenarios PASS (admin/self x PNG/JPEG/PDF x pending/under-review/reupload/verified retirement). Captured 17 index definitions, nine trigger definitions and actual writer functions were checked before reproducing four original failures. Permissions, cross-owner denial, real unique constraint conflicts, profile photo history, retry idempotency and guarded recovery pass. This is PGlite PostgreSQL 18.3 in one connection; no multi-session concurrency test is claimed.

Published UI tests: three real JPEG uploads PASS using a controlled account's own legitimate existing document: Admin general upload, per-document replacement and self-service replacement. Each completed Storage POST, registration RPC and byte-verified preview with HTTP 200. Refresh verified. Three new independent assets and versions remain stored. Resumed tests reused completed steps, never repeating completed uploads. Two Admin replacement audit entries include the reason. A normal notification popup initially intercepted self-navigation; the harness now dismisses it through the existing UI. This required no application change.

Server-side comparison after these tests: all 18 original documents and 18 assets still exist; all original objects remain present. Only the target type's normal replacement review status/metadata changed. The comparison affiliate and other document types are unchanged. No production file deletion was sent or executed. Every DELETE/destructive request was blocked before network; no cleanup ran. The document test excluded telemetry and financial-legacy loanSessionOpen before network and never mocked success. It does not certify unrelated financial initialization.

No legitimate PDF exists in the controlled account, so production PDF upload is NOT TESTED. PNG/PDF behavior is covered by the isolated database matrix. The live account has existing admin access; an ordinary affiliate without admin permissions was exercised in the isolated matrix, not with a second live credential.

The isolated release built 34 public files. Its canonical LF bundle SHA256 equals the published bundle: 3a2c20c4eefcdc553e6ff6fe9d8ea3b923e88e08ebcd84001fc6445190fa8ce9. Windows CRLF explains the different raw local hash. No frontend redesign or runtime change is included. Global image regression is NOT APPLICABLE: no shared repository, viewer, routing, Auth, Storage policy, private_assets schema or service worker was modified.

## H-AFFILIATE-DOCUMENT-UPLOAD-REGRESSION-001 RESULT

Status: PASS; backend correction applied, scoped source published, deployment and production verified.
Files changed: only the declared migration/recovery, test fixture/scripts, audit/evidence, four governance appendices and derived architecture index in the isolated release.
Source-of-truth verdict: PASS; affiliate_documents and the retirement ledger remain authoritative; review_slots is private derived integrity enforcement.
Invariant verdict: PASS; historical rows preserved, active review uniqueness enforced, document/affiliate ownership isolated.
Build: PASS, 34 public files; frontend byte-equivalent after canonical line-ending normalization.
Tests: PASS, 21 isolated check groups, 24 matrix cases, three actual published JPEG upload flows, refresh/preview and server-side preservation.
Security: PASS; existing authorization functions/ACLs unchanged, forced RLS/no API grants for derived slots, cross-owner denial verified, no secrets or private document content in public evidence.
Legacy impact: NOT APPLICABLE to runtime; no financial or Google writes/code changes. Background financial initialization was explicitly excluded from the UI document test.
Unexpected files changed: none in the isolated release; unrelated root workspace edits excluded.
Known limitations: no live PNG/PDF upload or separate ordinary-user credential; no multi-session stress test; live browser used blocked service workers for full request interception. Recovery refuses overlapping historical pending slots or schema drift instead of altering history.
Evidence: docs/qa/evidence/document-upload-regression/{diagnosis,reproduction,database,preflight,backend-applied,backend-verified,build,live-production,live-preservation}.json. Migration SHA256 6affb20b2864026f1986ad4da4e942a18cfee1fcb66ce59de33b045c74639fc2; recovery SHA256 c308f4dceaad44e41fae773aa497c4ce556b8c7e887d02797be9a553ffa0b6ba; database test SHA256 5abf0b9394faefa9cf2ca43b9c4ce166718a6d343e928f7644e63a9c7233937d.

## Publication and independent architectural review

Source commit: f43516fc19d636231e36d0aedeab7c61b7205b37. Only 25 declared files were published from the isolated release; zero frontend files and zero unrelated root changes. Staged migration/recovery/test hashes matched the tested/applied hashes. Syntax, JSON, credential scan, diff checks and source/evidence copy parity passed. Both workspace and isolated release architecture indexes were regenerated separately and checked FRESH. The final deployment receipt and this closure only change documentation; they are intentionally not another architecture regeneration and must not be described as a newly fresh content snapshot.

GitHub Pages workflow [42105949117](https://github.com/David14081982/SutiApp-private/actions/runs/42105949117) succeeded, including Auth compatibility, request backend compatibility, public artifact build and post-deployment request verification. Final read-only fetch from https://sutiapp.com/ returned the unchanged tested bundle with HTTP 200 and SHA256 3a2c20c4eefcdc553e6ff6fe9d8ea3b923e88e08ebcd84001fc6445190fa8ce9. See docs/qa/evidence/document-upload-regression/deployment.json.

SUTIAPP ARCHITECT REVIEW
Task: H-AFFILIATE-DOCUMENT-UPLOAD-REGRESSION-001
Verdict: APPROVED.
Critical findings: exact schema reproduced the omitted old-index failure; tested/applied source hashes match. Three real JPEG UI flows and server-side preservation passed. No new decision or unresolved implementation defect identified. Coverage limits above remain explicit.
Source of truth: unchanged canonical documents and retirement ledger; private derived review reservations only.
Architecture: scoped database integrity fix; no shared frontend/repository/viewer changes.
Security: forced RLS, no API grants, original writers/permissions unchanged.
Data: 16 original table fingerprints preserved at install; 18 original documents/assets/objects preserved through real uploads; three new independent versions retained.
Legacy: no financial/Google writes; background financial initialization excluded from document tests.
Owner decision: NO.
Next action: record publication evidence and stop; no next H.
Response generated for Codex: YES.

RESPONSE TO CODEX: Approve this H. Publish only reviewed source, evidence, governance appendices and derived registry; verify deployment read-only, retain all test versions/private recovery records, then stop. These actions are complete; this final documentary receipt records their closure. No further runtime action or live upload is required.
