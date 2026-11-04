# H-AFILIADOS-ELIMINACION-INDIVIDUAL-DOCUMENTOS-001

## PRE-CHANGE AUDIT — 2026-11-04

Status: PASS (implementation authorized; release requires focused verification).
Objective: remove one explicitly confirmed document and its linked predecessor versions from Admin Afiliados, with server authorization identical to effective access to that screen.
Authority: existing affiliate_documents, affiliate_files, private_assets and private-assets Storage. A private retirement journal records withdrawal and recovery metadata, not another document authority. No financial or Google authority changes.
Existing mechanism: can_delete_unreferenced_affiliate_document_object only cleans orphan uploads; no existing complete withdrawal mechanism. Existing replacements use replaces_document_id. Historical documents and audit have restrictive foreign keys and must not be physically deleted from SQL.
Scope: additive retirement RPCs/journal/restrictive policies and reference guards; exact filters on existing documentary readers, preview authorization and upload predecessor selection; private Storage quarantine through a focal Edge; per-card action and confirmation in existing Afiliados UI.
Files: app/admin-affiliates-repository.js; app/screens-admin-affiliates.jsx; supabase/functions/affiliate-document-delete/{index.ts,handler.mjs}; supabase/migrations/20261104000400_affiliate_document_retirement.sql; matching supabase/recovery file; scripts/{inspect,generate,test,release,verify,prepare}-affiliate-document-retirement*; scripts/fixtures/affiliate-document-retirement-schema.json; docs/qa/evidence/affiliate-document-retirement/*; this audit; appended sections in docs/{SOURCE_OF_TRUTH,DECISIONS,DATA_GOVERNANCE,AGENT_CHANGELOG}.md; derived docs/architecture registry files. app/bundle.js, SutiApp.html and sw.js cachebuster are generated artifacts only. Private baseline/isolated release/build under .tmp/affiliate-document-retirement/.
Outside scope: global permission/role changes, affiliate deletion, financial functions/calculations, Google, unrelated pending workspace changes, real document deletion as a test.
Readers: Afiliados workbench/roster, document lists/Workbench, preview authorizers, availability, affiliate-files/private-assets/Storage RLS. Writers: existing upload/review RPCs and new focal retirement operation. Existing financial references are checked only to prevent damage, never rewritten.
UI contract: existing profile header, six tabs, counters, two-column cards, viewer, upload/replacement, review, navigation, responsive styling and audit remain. Add discreet removal action and modal with document/affiliate/version scope, mandatory reason and explicit confirmation. Reload authoritative list/detail after success; errors remain visible.
Risk: shared references, concurrent upload/linking, interrupted Storage move, previously signed URLs, schema drift, existing dirty workspace. Mitigation: server-derived linked ancestry, explicit fingerprint/confirmation, fail closed on references outside selected scope, reference locks/guards, atomic logical withdrawal/audit, retryable quarantine, exact live catalog baseline, isolated release from published main.
Retention/recovery: preserve SQL history and move the original object into an inaccessible quarantine path (no downloadable audit copy). Logical withdrawal first; Storage failure remains pending and retryable, never reported complete. Rollback must not resurrect retired documents; before any retirement exact function/policy recovery is allowed, thereafter disable writer and preserve restrictions/history.
Tests: isolated PostgreSQL from live schema, permission matrix including read-only module collaborator, target manipulation, linked ancestry, shared references, audit atomicity/idempotency, recovery, upload after retirement, direct readers/new signing, Edge interruption/retry, browser confirmation/cancel/counters/layout, production read-only checks. No production fixtures or business deletions.
Owner exception: the explicit attached instruction says no global suites; only focused tests and direct dependencies are run, superseding the repository default global-image suite for this H.
Registry: previously STALE with unrelated financial changes; targeted live catalog/code inspection is required and used. Update only demonstrated new architecture.

## Guardian decisions

Source of truth: SAFE within declared design; journal is immutable withdrawal metadata, no fallback/copy authority. Security/migration release gates pending tests. Legacy: READ ONLY reference discovery; zero Google or financial writes. Owner authorization is the current explicit task, including publication and effective Afiliados permission rule; no additional super-admin gate.

## Implementation decisions

- Only actual linked ancestors (`replaces_document_id`) of the selected document are included; no same-type heuristic or descendant deletion. The confirmation lists every included row. External document/file/request/catalog references block the entire operation before writes. Historical provenance and immutable access logs remain.
- Original private asset SHA-256 is retained in the private journal and released from the active deduplication field only for withdrawn assets. That field becomes nullable for DISABLED assets; a check still requires hashes for active assets. This permits correcting an association by uploading the same bytes as a new object without reviving the retired reference. Recovery restores NOT NULL only when no retirement exists.
- Existing metadata rows remain unchanged except retiring their private asset (status DISABLED/hash retained privately). The Edge moves the original object, without copying its contents into audit evidence, to `retired-documents/<operation>/<asset>`. Restrictive Storage RLS excludes both original and quarantine paths from all authenticated users. No product RPC returns quarantine keys.
- Existing signed URLs are bearer capabilities; during an interrupted move they may remain usable until their original expiry. The UI reports PENDING_STORAGE, offers retry and reconstructs pending operations after reload. After move the original Storage path is absent; already downloaded/browser/CDN-cached bytes cannot be recalled. No longer TTL or new signed URL is issued for a retired asset.
- Required-document denominator now comes from the enabled authoritative catalog, so deleting a required document cannot incorrectly reduce the denominator. Existing card count and pending count reload from current canonical documents.

## Verification before publication

- `node scripts/test-affiliate-document-retirement.js`: PASS, ten focused PostgreSQL/Edge cases using captured production function definitions and synthetic isolated records. Exact installation/empty recovery, screen-access collaborator, no-access/anon denial, affiliate mismatch, stale confirmation, shared references, audit failure rollback, idempotency, hidden readers, protected neighbors, reupload, interrupted Storage, recovery history guard.
- `node scripts/test-affiliate-document-retirement-browser.js`: PASS; confirmation/cancel/reason, exact linked versions, empty upload card, counters, mobile collaborator without write permissions, pending resume, shared blocker and retained Workbench navigation. Synthetic before/after images inspected.
- Existing `test-affiliates-edit-documents-browser.js`: PASS for upload/replacement, editor, preview/context, errors, and five desktop/mobile viewports. Evidence under `existing-upload/`.
- Isolated published-base assembly: PASS; exactly two frontend modules changed, 173 other bundle modules preserved byte-for-byte. Build PASS, 34 public files, bundle SHA-256 in `assembly.json`.
- Backend apply: PASS, migration `20261104000400`; 16 protected tables unchanged (including 5,398 documents, 14,872 private assets, 12,928 affiliate-file relations); zero business-row writes and unchanged global permission functions. An initial comparison-query precedence error aborted the first transaction; the corrected comparison passed and only the successful installation committed.
- Edge compile/deploy/readback PASS; four restrictive RLS filters, seven reference guards, no anonymous deletion grant or authenticated Storage-worker grant; zero retirements after installation.
- Authenticated candidate against live backend: PASS, 8 document cards, selected scope of 2 linked versions, 8 catalog requirements, legitimate document preview HTTP 200, cancel/refresh preserved, anonymous RPC/Edge 401. No real deletion was performed. A second controlled account's credentials were not configured; collaborator/no-access matrix is verified in isolated PostgreSQL/browser rather than falsely reported as a live second-user test.
- Physical move/interruption is verified in isolated SQL/Edge tests; no production document is moved as a test. Supabase documents moving/renaming as URL revocation. Smart CDN invalidation can take up to 60 seconds, and already cached/downloaded bytes cannot be recalled: https://supabase.com/docs/guides/storage/serving/downloads ; https://supabase.com/docs/guides/storage/cdn/smart-cdn .

## CLAUDE UI PRESERVATION REVIEW

Screen: Admin Afiliados / Expediente.
Original/current sections: profile header; six tabs; three counters; upload/Workbench actions; two-column document cards; replacement; viewer; audit.
Missing sections: none. Added: per-card delete, explicit confirmation, retired-type upload state, retryable pending retirement notice.
Interactions/navigation/visual structure preserved: PASS. Unauthorized redesign: NO.

## SUTIAPP ARCHITECT REVIEW — candidate

Verdict: APPROVED for the explicitly authorized publication, subject to final production readback.
Source of truth: existing canonical documents/assets; retirement journal is private lifecycle/audit metadata. No DATA/mock/browser storage fallback.
Architecture/security: server module visibility reused unchanged; exact affiliate and version scope; no cross-reference destruction; no new role/general affiliate-delete grant. Secret keys remain only in Edge/local ignored environment. Pending operation can be completed after interruption by an authorized screen user; deletion actor and completion actor are audited separately.
Data/legacy: rows and historical relationships retained; original hash retained privately for correction/recovery; financial reference guards prevent attaching retired documents without changing financial workflows or Google.
Limitations: historical links not represented by replaces_document_id are not guessed into a deletion; shared legitimate references block removal. Pre-existing offline copies are not revocable. Production destructive tests were deliberately not run.
Owner decision: NO; current owner task explicitly authorizes implementation, publication, focused verification and stop. No next H or inferred task-orchestrator authorization.
Response generated for Codex: YES — Publish only this isolated candidate, verify exact production bundle, authenticated Afiliados confirmation/cancel/preview and refresh, record evidence, then stop.
