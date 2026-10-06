# H-HISTORY-PRIVATE-DOCUMENTS-001

## PRE-CHANGE AUDIT

Objective: remove the authorization-document section from affiliate History/Tracking and deny affiliate access to program authorization PDFs; retain existing administrative access in Finance Requests.
Authorization: owner explicitly requested this correction, commit, push and publication.
Scope: app/screens-historial.jsx (one component invocation); document_private.visible (program self-access only); focal migration/recovery and tests; generated focal bundle chunk and version tokens; audit/evidence and appended changelog/security decision; derived architecture index for removed dependency/permission mapping.
Files: app/screens-historial.jsx; app/bundle.js; SutiApp.html; sw.js (version only); supabase/{migrations,recovery}/20261005000200_history_private_documents.sql; scripts/{inspect,release,test,package,verify}-history-private-documents*.js; docs/audits/H-HISTORY-PRIVATE-DOCUMENTS-001.md; docs/qa/evidence/history-private-documents/*; docs/{AGENT_CHANGELOG,DECISIONS,SOURCE_OF_TRUTH,SECURITY_RULES}.md (append only); docs/architecture/registry-*.json and SUTIAPP_ARCHITECTURE_REGISTRY.json (derived only). Temporary baseline, candidate and isolated release under .tmp/history-document-private/.
Outside scope: existing dirty changes, savings authorization documents, financial data/calculations, Google/Apps Script, document generation/rendering, Storage policies, shared image viewers and global Auth.
Authority: document_private.records + private generated-documents bucket remain sole document authority; program_requests remains request authority. Readers: document_generation_command LIST/ACCESS and authenticated document-generation Edge; writers unchanged.
Risk: owner access currently allowed by visible(r,false); hiding UI alone is insufficient. Preserve admin permission and module boundary checks and savings branch exactly. Existing signed URLs expire after 120 seconds.
Recovery: exact function definition backup before installation; guarded reverse patch; revert focal frontend commit. No historical rows/files deleted or rewritten.
Tests: isolated PostgreSQL permission matrix, migration/recovery equality and metadata preservation; browser tracking approved/rejected/loading/error/unavailable and admin document viewer; source/bundle parity; deployment readback. Shared visibility helper receives global image regression against local build and Pages under AGENTS.md.
Status: PASS for preparation; release requires successful evidence.

## SCREEN CONTRACT

History list, filters, active tracker, request notice, navigation and scrolling unchanged. Tracking summary/status/amount/term/date, rejection reason, timeline, support/reapply controls and unavailable/loading/error states preserved. Only GeneratedDocuments invocation in Tracking is removed as explicitly requested. Administrative GeneratedDocuments invocations and savings view unchanged.

## Guardian findings

Scope update: docs/architecture/architecture-overrides.json also requires its existing document-access description to reflect program admin-only access; no other mapping changes authorized.

Navigator: STALE preexisting index; directed inspection confirmed screens-historial.jsx → GeneratedDocuments → DocumentGenerationRepository → document_generation_command → document_private.visible → private bucket signed by Edge. Never infer authority from the stale registry.
Source-of-truth: SAFE; no new source, cache, mock or fallback.
Legacy: READ ONLY code inspection; no external reads/writes or calculations required.
Migration: one existing function body, no table/schema/ACL/owner changes; program self-access denied, administrative and savings checks preserved.
Security: enforce visibility in backend, including LIST and ACCESS; admin:true supplied by client grants nothing without backend permission and module boundary.

## H-HISTORY-PRIVATE-DOCUMENTS-001 RESULT — implementation/release gate

Status: PASS (implementation and production backend; Pages post-publication checks follow).
Files changed: declared focal source, guarded migration/recovery, generated single bundle chunk/version tokens, verification scripts, append-only governance and derived registry.
Source-of-truth verdict: SAFE; same Supabase document/request authorities and private bucket.
Invariant verdict: PASS; 84 existing records unchanged; source identity, history and financial calculations untouched.
Build: PASS; published baseline b9cd79e, 155 unrelated bundle chunks preserved, candidate v2026100412 / SHA256 e2ac100ad0b69e36351841eedc460a171aecda9e3dd3215f5772b8799216957c.
Tests: PASS; 22 PostgreSQL/PDF/browser integration checks; 12 mobile/desktop Tracking state comparisons with identical remaining DOM; real-account History and refresh; Architecture Registry full suite.
Security: PASS; migration 20261005000200 installed; same function OID/owner/ACL/search_path/security-definer; self LIST empty and Edge ACCESS 403, admin Edge ACCESS 200 with valid existing PDF; forged admin/cross-user/module boundary negatives tested in isolated PostgreSQL; savings behavior preserved; recovery and reapply verified.
Legacy impact: no Google, Apps Script, financial calculation or business-record writes. Global regression reads existing legitimate legacy images only.
Unexpected files changed: none in isolated release; dirty working-tree changes excluded. Generated artifacts are focal, sw.js logic unchanged.
Known limitations: signed links already issued expire under existing 120-second TTL. Initial local global test used unapproved origin localhost:8766 and failed; diagnosis proved ORIGIN_DENIED; same suite passed at approved localhost:8080 without backend configuration changes. A workspace registry run became stale during concurrent evidence writes; isolated full registry suite passed.
Evidence: docs/qa/evidence/history-private-documents/{build,pages-build,browser,database-tests,architecture-tests,backend-applied,backend-verified,local-history,global-local,global-pdf-diagnosis}.json.

## CLAUDE UI PRESERVATION REVIEW

Screen: History/Tracking.
Original/current sections: identical except explicitly authorized removal of authorization document section.
Missing sections: only owner-requested document block. Added sections: none.
Interactions/navigation/visual structure: PASS; support, reapply, retry, back, timeline and summary preserved; six states at 390/1440px compared directly.
Unauthorized redesign: NO. Verdict: PASS.

## SUTIAPP ARCHITECT REVIEW

Task: H-HISTORY-PRIVATE-DOCUMENTS-001 implementation and release candidate.
Verdict: APPROVED for the already authorized publication; final live evidence required after Pages deployment.
Critical findings: none in runtime diff. One removed component invocation and one guarded predicate change; no shared repository/viewer/Storage policy or financial writer change. Inspecting the isolated diff confirms unrelated published modules remain byte-identical. Backend readback and permission/recovery tests support the security claim.
Source of truth: preserved. Architecture: removed user document consumer; existing backend authority retained. Security: server-side restriction, never UI-only. Data: existing records preserved. Legacy: no mutations.
Owner decision: NO.
Next action: publish this isolated release and verify Pages hash, real History, administrative PDF access, and the required global image regression. Record final receipts, then stop; no further H authorized here.
Response generated for Codex: YES.

### RESPONSE TO CODEX

The implementation is approved. Complete the owner's explicit commit/push/publication instruction using the isolated release. Do not include unrelated workspace changes or alter business data. Close only after deployment and live verification evidence; do not advance to another H.
