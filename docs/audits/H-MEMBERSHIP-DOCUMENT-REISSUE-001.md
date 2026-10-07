# H-MEMBERSHIP-DOCUMENT-REISSUE-001

## PRE-CHANGE AUDIT

Owner authority: after confirming that updating the PDF from an affiliate request retains the original signers, the owner explicitly instructed "corrijelo". This authorizes a new Membership document revision with current configured signer order, names, titles, roles and signature assets. It supersedes the historical-signer requirement only for new revisions whose program is membership and document_type is MEMBERSHIP_APPROVAL. Existing PDFs, authorized business values and every other program retain their contract.

Navigator: release checkout at 92b2a02 is clean; Registry check FRESH; lookup document reissue followed by directed source inspection. Root workspace contains unrelated changes and is not edited. Evidence: document_private.reissue explicitly overwrites resolved current signers with old.document_snapshot.signers; GeneratedDocumentsBody invokes REISSUE and its confirmation describes historical signers. resolve_scoped_layout already resolves the current configuration and layout. No alternate data source is necessary.

Objective: a deliberate new revision from the request uses current valid Membership configuration, while the original record and PDF remain intact. This is not an automatic backfill or a replay of request approval.

Allowed files: this audit; docs/DECISIONS.md, SOURCE_OF_TRUTH.md, INVARIANTS.md, MIGRATION_RULES.md, AGENT_CHANGELOG.md; app/screens-admin-document-generation.jsx; generated app/bundle.js, SutiApp.html and sw.js cachebusters; supabase/migrations/20261007000300_membership_document_reissue.sql and matching recovery; scripts/membership-document-reissue.js, scripts/test-membership-document-reissue.js, scripts/test-membership-document-reissue-browser.js, scripts/verify-membership-document-reissue-live.js; scripts/fixtures/membership-document-reissue-schema.json; docs/qa/evidence/membership-document-reissue/; architecture-overrides and five derived Registry files if confirmed semantics change. Private temporary schema captures/build/browser profiles only under .tmp/membership-document-reissue/. No other source edits.

Authority/domain: document_private.configurations + signers/assets are current document configuration; document_private.records remains immutable revision history. Existing request event and sealed source_snapshot remain the business authority. Reader/renderer: document-generation Edge and existing repositories. Writer: existing permission-gated REISSUE appends one record plus audit. No new API, schema/table, privilege, persistent cache or productive fallback.

Migration: replace only the signature selection in private reissue with an exact program/type branch; append non-PII policy provenance to the existing audit event. Capture the actual function definition/OID/owner/ACL before generating a guarded migration. Recovery restores the precise previous definition and retains every old and new record. Apply backend before the explanatory frontend text. Migration application must preserve row hashes and security, with no synthetic production business writes.

UI contract: preserve request document section, version rows, existing reissue button, confirmation/cancel, loading/error/retry/open controls, styles and shared viewer. Change only Membership confirmation text to describe current signers. Other programs retain their exact confirmation. No shared viewer/repository/auth/routing/Storage/SW logic changes; global image regression NOT APPLICABLE under the focal generated-artifact exception.

Legacy: no financial recalculation, writer, Google read/write, approval event replay or profile refresh. Non-Membership revisions retain historical signers. Prove equivalence with isolated SQL cases and unchanged definitions/data hashes.

Tests: isolated PostgreSQL actual baseline + migrations; ordered current signer versions/cargos/roles/assets; historical records preserved; subsequent config changes and repeat revisions; idempotency and stale-parent rejection; current validity failures; missing permission and cross-domain denial; all non-Membership branches unchanged; exact recovery/reapply; real PDF rendering of the resulting synthetic revision; browser Membership/non-Membership confirmation and cancel/idempotent request flow at mobile/desktop; focal bundle, public publication and authenticated read-only checks.

Risk: applying signatures to an existing authorization must always produce a separately auditable new revision. Never replace an old PDF or repeat financial authorization. Production verification may read only aggregate/hash metadata and synthetic previews; it must not create a real revision without an identified user-requested target.

Status: PASS. The owner-authorized exception is implemented and published; completion evidence follows.

## Verified candidate and backend

Eleven isolated PostgreSQL cases PASS: current ordered names/titles/roles/assets, immutable business values and originals, five non-target branches, invalid-current fail-closed, permissions/module boundaries, idempotency/latest-parent checks, real renderer, exact recovery/reapply. Browser 390/1440 PASS: current-signers confirmation, cancel without mutation, same UUID after a failed attempt, old-version retention, unchanged non-target copy and actual resulting PDF text/order/canvas. Both synthetic PDF captures inspected.

Backend migration 20261007000300 APPLIED: reissue md5 dbfb7bb11deca7837ef4b5e0c184b6eb, original OID/owner/ACL preserved. In one repeatable-read transaction, records, configs, signers, layouts, assignments, requests, approval events, document audit, all other functions and function security remained identical. No document was reissued in production by this task.

Build v2026100418 PASS: one focal source chunk, 155 unrelated chunks preserved, service-worker logic unchanged, Pages/PWA allowlist passes. Publication and authenticated read-only checks PASS (see closure).


## Published closure

Runtime commit 5f7c12cb264143ce395c5f09cf002c3f33eada7b; Pages run 37672841167 SUCCESS; version 2026100418. The deployed private-function definition matches the isolated tested migration exactly, with its original OID/owner/ACL. Public HTML/bundle/service-worker hashes match the candidate. The existing Edge renderer was not changed.

Authenticated production verification at 390/1440 mounts the published GeneratedDocuments request component with real authorized Membership operation metadata and the original repository. It finds the current eligible revision, opens the native correction confirmation, checks the new wording, and cancels. Two metadata reads per viewport; zero browser errors, mutation attempts, issued-PDF accesses, personal screenshots or business writes. This is a direct component integration probe, not a claim that a production document was reissued. Full successful reissue and real resulting-PDF contents are verified with isolated synthetic PostgreSQL fixtures and the actual renderer.

The operator must refresh the app, choose Emitir version corregida on the desired request and open the newly numbered version. Previously emitted versions retain their original contents by design. No unspecified real operation was revised automatically.

H-MEMBERSHIP-DOCUMENT-REISSUE-001 RESULT
Status: PASS
Files changed: one focal frontend source plus generated bundle/cachebusters; one guarded private-function migration/recovery; dedicated QA/release scripts, schema-only fixture, governance, audit/evidence and Architecture Registry. Full runtime inventory: scope.json.
Source-of-truth verdict: PASS. Current document_private configuration/signers govern only newly requested Membership revisions; records retain immutable per-revision snapshots. No competing authority, browser cache or productive fallback.
Invariant verdict: PASS. Explicit owner exception recorded in DECISIONS/INVARIANTS/SOURCE_OF_TRUTH. Original business event/identity/authorized values/old PDFs, idempotency, latest-parent checks and non-target branches preserved.
Build: PASS. One changed module; 155 unrelated chunks identical. v2026100418; Pages/PWA allowlist and exact public hashes pass.
Tests: PASS. Eleven isolated PostgreSQL/security/history/recovery/rendering checks; synthetic current PDF text/order/assets/canvas; mobile/desktop request-control tests; read-only published component at 390/1440.
Security: PASS. Same private function OID/owner/ACL, existing public gate and module boundary. No privilege, RLS, Storage or Auth change. Migration transaction verifies unchanged rows and all other functions/security.
Legacy impact: NOT APPLICABLE to financial execution. Five non-target document branches retain historical signatures; no financial writer, recalculation, approval replay, Edge modification or Google access.
Unexpected files changed: none in the isolated release checkout. Unrelated root workspace preserved.
Known limitations: no real production document was reissued by QA; a desired document gets current signatures when its authorized operator deliberately creates the new revision. Global image regression NOT APPLICABLE because shared viewers/repositories/assets/security and service-worker logic are untouched.
Evidence: docs/qa/evidence/membership-document-reissue/ (baseline, database, browser, applied, build, pages-build, scope, deployment, published, live-browser and synthetic PDF captures); final evidence-based architecture review stored alongside.
