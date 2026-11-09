# H-LOAN-DOCUMENT-SUBMIT-001

## Current owner authorization: 100 MB end to end

The subsequent explicit owner instruction authorizes 100 MB for BOTH existing originals and new documentary uploads, all necessary PostgreSQL/Storage/RPC/Edge/frontend changes, publication and deployment. This supersedes the prior pending decision and the previous new-upload limit. Do not change financial calculations, Google, historical bytes or unrelated features. No additional general audit/phases: extend this scoped repair only.

Runtime scope: document upload/read/attachment. Exact published baseline e8b54c0241973689d565b67183490fbcb7531b91; isolated candidate .tmp/document-100mb/candidate, no wholesale dirty-root publication. Source files: app/document-integration.js, document-workflow-repository.js, admin-affiliates-repository.js, screens-admin-affiliates.jsx, screens-admin-documents.jsx; new document-transfer source/bundle for chunked hashing and resumable upload; scripts/build-bundle.js plus generated bundle/cachebusters; shared document-integration/verifier/stream modules and their document-operation, document-access, financial-legacy deployments. SQL: documentary size constraints, configuration/RPC size guards, existing-document enrollment before attachment, document_types size configuration, Storage global/bucket documentary limits. Keep all permissions, MIME authorization per type, actor/session checks and protected historical references.

Performance: one server download per verification, incremental SHA-256, bounded format inspection without allocating decoded pixel arrays, chunked browser hashing and resumable upload. The viewer performs actual rendering; server continues MIME/format, dimensions, SHA-256 and exact length checks. Existing originals use the established hash/length contract. No browser-provided verification receipts are trusted.

Live preflight: private-assets already allows 100 MiB; Storage global cap is 50 MiB; all 13 document types and operation/asset constraints still cap 10 MiB. Other MIME types in private Storage are retained; current document-type catalogs allow JPEG/PNG/WebP/PDF and JFIF normalizes to JPEG. Existing HEIC/Office originals must remain usable regardless of new-upload codec lists.

Verification limited to essentials requested: size boundaries and permissions in restored PostgreSQL, streaming/hash/format cases and memory bounds, actual authenticated 100 MiB upload/read on the existing explicitly synthetic test affiliate, historical fingerprints, focused browser controls and published build/readback. Owner limits verification to indispensable checks; broad unrelated financial/Google regressions are excluded. UI structure and interactions remain intact.

Recovery: exact pre-change function/configuration backups, transactional SQL and hash guards, prior Edge artifacts and published frontend; no removal or rewriting of existing documents. Restoring a smaller cap must refuse if it would invalidate subsequently accepted files.

## PRE-CHANGE AUDIT

### Current 100 MB implementation and essential evidence

The current authorization supersedes all earlier BLOCKED / OWNER_DECISION_REQUIRED statements below. They describe the previous loan-only boundary, not the current authorization.

Migration `20261109000400_document_100mb.sql` is active. All 13 document types, documentary integrity operations/assets and the documentary Storage buckets accept up to 104857600 bytes. Global Storage was increased from 52428800 to 104857600; other Storage configuration, visibility and MIME policies were compared unchanged. No document bytes or historical request rows were migrated. The migration transaction compared fingerprints of all four canonical document/request tables, function ACLs/owners and public/Storage/integrity policies.

Browser uploads use incremental SHA-256 in 2 MiB reads and authenticated TUS uploads in 6 MiB chunks. Originals selected from files retain their bytes; camera compression retains its existing behavior. Server verification downloads once, hashes incrementally and inspects format containers without allocating full decoded pixel arrays. PNG CRC32 uses pinned hash-wasm 4.12.0; PDF scanning avoids repeated string conversion once required structural markers have been found. New-file validation is structural/container validation, not full codec decoding or malware scanning. Existing originals retain their prior mandatory SHA-256 and exact-length contract, including already-authorized Office/HEIC originals.

The real 100 MiB trial exposed a Supabase CPU limit that local tests alone did not reveal. It was fixed by removing unnecessary PDF processing and using the bounded CRC implementation. Submission batches above 16 MiB now verify each original in a separate invocation of the existing document-operation endpoint. The parent validates every receipt, rechecks context and only then invokes the existing atomic writer. Internal requests require a short-lived HMAC over the entire payload, constant-time comparison and a server-only DOCUMENT_VERIFIER_SECRET; ordinary authenticated callers are denied. This avoids cumulative CPU exhaustion for multiple large originals. No financial formula/writer or Google source was changed.

Evidence under `docs/qa/evidence/document-100mb/`: database boundary/permissions/recovery tests, four-format 100 MiB streaming tests and peak RSS, exact production SQL readback and preserved historical fingerprints, Storage configuration, real upload/read checks, two-large-document internal-verification tests, bundle isolation, public artifact build and deployed Edge source comparisons. Real live tests use only the previously authorized synthetic affiliate. The financial handoff test uses real verification services with a non-writing parent RPC harness; it does not create a production loan.

The WebP fixture initially placed an ancillary chunk before its required image/container chunk. The browser correctly rejected that synthetic container. The fixture was corrected and independently decoded at 100 MiB; the server now rejects the invalid first-chunk order. No real document was altered to fix a test. The isolated test objects are retained.

The architecture index is updated only for the declared files and dependencies from the exact GitHub baseline; unrelated stale entries remain explicitly stale. The public bundle retains all unrelated chunks byte-for-byte. Service-worker changes are cache-version-only. General unrelated regressions are excluded by the owner's explicit indispensable-verification instruction; focused upload/view/history/auth tests apply.

Publication status: PASS. Backend and frontend are published and exact deployed bytes were checked; published PDF/PNG viewers, SHA-256, oversized-file rejection and the historical request original passed. Code commit: 7beffb00d44b857b52702fceed87ddd76f21cf2e.

Owner requests a surgical repair of loan confirmation error 161BE45C for all users, approximately five virtual tests, commit/push and deployment if successful. Authorized 2026-11-09.

Status: implementation authorized; verification pending.
Navigator: prepare_document_submission lookup reports stale registry; inspected deployed v71 and live PostgreSQL definitions instead. Architecture unchanged.

Root cause: prepare_document_submission calls lock_document before the existing Edge byte verifier. Historical READY documents have no document_lab_integrity.assets row. Reference log reports PHYSICAL_ASSET_NOT_VERIFIED at this exact call. 4,995 eligible-status READY document rows lacked integrity enrollment at diagnosis; this is not a count of users.

Scope: two existing SQL functions, limited to create_validated_financial_program_request. Preparation locks canonical document/asset metadata without requiring prior enrollment; service-only completion validates byte receipts and unchanged canonical metadata, then enrolls missing integrity rows atomically with the existing writer. Existing unavailable/quarantined assets must remain rejected. Financial formulas, writer, history, Google, UI, Edge and permissions remain unchanged.

Files: new migration 20261109000300_loan_document_submission.sql and matching recovery SQL; scripts/loan-document-submit.cjs and scripts/test-loan-document-submit.cjs; scripts/fixtures/loan-document-submit-baseline.json (function definitions only); this audit and docs/qa/evidence/loan-document-submit/*.json. Number 20261109000200 was already occupied by documentary_legacy_file_access; inspection selected the next free number before generating SQL. Private task artifacts under .tmp/loan-document-submit are not committed. Scope expansion must be recorded here first.

Authority: affiliate_documents / affiliate_files / private_assets and private Storage remain canonical. document_lab_integrity.assets is the existing integrity registry, populated only after server verification. No fallback or alternate authority. Writers/readers: authenticated preparation, financial Edge physical verifier, service-only completion, unchanged financial writer and evidence guards.

Risk: incorrect enrollment or concurrent replacement. Preserve existing unavailable states; compare current document, owner, asset id, bucket/path, size/hash/MIME under locks at completion. No historical changes or blanket backfill; installation performs no business DML. No new grants, schema, tables, roles or policies.

Recovery: exact live predecessor definitions/ACL backed up, hash guards for forward and reverse, transactional installation, no deletion of verification/request history. Isolated recovery and reapplication test required.

Five tests: (1) reproduce old failure then complete an existing-document loan; (2) already verified documents and repeated confirmation/idempotency; (3) foreign/stale documents and unauthenticated completion rejected; (4) missing/altered bytes, quarantine and metadata drift rejected atomically; (5) exact recovery/reapplication, grants and unrelated functions/data preserved. Real PostgreSQL local restore and existing Edge verifier, synthetic bytes only, rollback all local business writes. No test loans sent to production or Google.

Guardians: source-of-truth SAFE; migration/security conditional on tests; legacy SAFE CHANGE (document gate only, existing formulas/writers unchanged). Frontend/global image regression NOT APPLICABLE: SQL-only loan submission branch; no shared image helpers, Storage policy, viewer, Auth or frontend changes.

## Result

Migration 20261109000300 applied and read back at 2026-11-09T20:24:35.485Z; all five tests passed. Installation preserved five canonical table fingerprints and both function owners/ACLs.

## Scope update: existing-document compatibility

Read-only compatibility inspection found current imported documents that cannot be treated as new uploads: nine over 10 MiB and two MIME types outside the new-upload codec list (HEIC and DOCX). Relevant loan types include payroll and identification. These are previously registered originals; the existing access handler already verifies their canonical SHA-256 and byte length without imposing new-upload decoding rules. The original physical-integrity failure is repaired, but closing an all-user repair requires retaining that existing-original contract on loan submission too.

Additional scoped files authorized by the same all-user repair: financial-legacy/index.ts and financial-legacy/loan-document-verification.mjs, isolated from the stale root checkout; scripts/loan-document-submit-compatibility.cjs; migration/recovery 20261109000400_loan_existing_document_size.sql. Shared helpers, other financial writer names, UI, Storage/RLS and new-upload limits remain unchanged. The integrity registry's private-assets size ceiling aligns with canonical private_assets (100 MiB); other buckets keep 10 MiB. No backfill or rewrite. Recovery refuses if an enrolled original exceeds the previous ceiling, retaining history.

Repeat the same five groups against the full candidate, including original HEIC/DOCX/oversize bytes, altered bytes, existing-new-upload restrictions and reverse recovery. Compile/deploy only financial-legacy from exact active v71 source plus the two focal changes. Verify deployed artifact source hashes. Global image regression remains NOT APPLICABLE: no shared helper, viewer, Auth, Storage policy or frontend change.

## Authorization boundary

Automatic approval review rejected execution of `node scripts/loan-document-submit-compatibility.cjs size-deploy`: changing the shared document_lab_integrity.assets ceiling from 10 to 100 MiB for private-assets was considered outside the explicitly authorized loan-only boundary. No constraint change or compatibility Edge deployment occurred. An explicit owner decision is pending. The candidate and its five passing tests remain reviewable; the original two-function repair is already active.

Prepared-only files are under `supabase/migrations/prepared/loan-document-submit/`, `supabase/recovery/prepared/loan-document-submit/` and `supabase/functions/prepared/loan-document-submit/`. The active financial-legacy/index.ts is not changed in this publication. The deployment script additionally requires SUTIAPP_APPROVE_EXISTING_PRIVATE_SIZE=100_MIB after explicit owner approval; setting a variable is not itself authorization. No schema/Edge deployment is triggered by committing these prepared files.

## H-LOAN-DOCUMENT-SUBMIT-001 RESULT

Status: core repair PASS / full original-document compatibility BLOCKED pending explicit owner approval of the shared size constraint.
Files changed: two-function migration/recovery, exact predecessor fixture, scoped test/release scripts, audit/evidence; additional compatibility files are PREPARED ONLY.
Source-of-truth verdict: SAFE; existing canonical document/asset/Storage authorities unchanged.
Invariant verdict: PASS for tested core and prepared candidate. No historical rewrite, no fallback, exact actor/effective affiliate and numero_control preserved.
Build: SQL execution PASS in restored PostgreSQL; Node syntax PASS; compatibility Edge cloud compile PASS, NOT DEPLOYED. Frontend build NOT APPLICABLE.
Tests: five groups PASS on the two-function repair before compatibility expansion; same five groups PASS on complete prepared candidate, including imported VERIFIED and PENDING_REVIEW documents, legacy null owner/file association, HEIC/DOCX and 11 MiB original, idempotency, access denial, withdrawal, forged receipts, changed/missing bytes, quarantine, rollback and unchanged new-upload restrictions.
Security: real authenticated/service_role SQL permissions exercised; no grants/RLS/Auth/Storage-policy change. Original physical bytes remain mandatory; no browser-controlled verifier options.
Legacy impact: zero Google calls or formula changes. Existing financial writer and trigger executed only inside rolled-back local tests. No production test loans.
Unexpected files changed: none included from the preexisting dirty checkout; remote commit is built on current GitHub main from an explicit allowlist.
Known limitations: no real final loan submission executed in production. Local confirmation timings exclude network/Storage and do not establish a production latency SLA. Historical codec and size compatibility is prepared, not active; affected originals can still fail until authorized deployment. Five groups validate the scoped paths, not every production account.
Evidence: docs/qa/evidence/loan-document-submit/; deployment.json proves two-function live readback, exact ACL/owners and unchanged fingerprints of five tables; tests.json describes the complete prepared candidate, edge-compile.json is compile-only.

## SUTIAPP ARCHITECT REVIEW

Task: H-LOAN-DOCUMENT-SUBMIT-001.
Verdict: OWNER_DECISION_REQUIRED for the remaining shared size change; core fix APPROVED.
Review method: direct read-only reconstruction from function predecessors, generated SQL, exact inverse of the two-line Edge patch, source hashes, test output and live deployment evidence; no separate reviewer agent used.
Critical findings: original error confirmed at prepare-before-verify ordering; core migration active. Broad size constraint deployment was explicitly rejected by automatic review and remains unapplied. Ten existing Edge dependencies are byte-identical. Prepared loan adapter reuses the established existing-original hash/length contract only for the loan writer; other writers and new uploads keep original validation.
Source of truth / Architecture / Security / Data / Legacy: preserved within tested scope; no additional authority or business-data migration.
Owner decision: YES, whether to align existing private original integrity size with canonical 100 MiB maximum while retaining new-upload limits.
Next action: after explicit approval, set the release marker, run size-deploy and deploy modes, verify active artifact hashes, and update evidence. If declined, keep the shared constraint and prepared files inactive.
Response generated for Codex: NO; approval-dependent operations must not continue automatically.


## Current authorized 100 MB closure

H-LOAN-DOCUMENT-SUBMIT-001 RESULT
Status: PASS (current authorized 100 MB scope).
Files changed: explicit GitHub publication manifest, documentary sources, scoped migration/recovery, tests/evidence and derived index only.
Source-of-truth verdict: PASS; existing Supabase document, private-asset and Storage authorities retained.
Invariant verdict: PASS; no historical document/request rewrite, mandatory SHA-256, immutable versions and atomic financial attachment retained.
Build: PASS; unrelated frontend chunks byte-identical; Pages deployment and exact public hashes checked.
Tests: PASS; 100 MiB format/boundary/memory tests, SQL permissions/recovery, all four real-format uploads and verified reads, actual internal multi-file verification, published PDF/PNG view and historical request access.
Security: PASS; backend permissions, JWT settings, policies and ACLs retained; HMAC internal invocation denies ordinary users and altered/expired payloads. No credentials published.
Legacy impact: no Google changes, no financial calculation/writer changes, no production test loan.
Unexpected files changed: no preexisting dirty-root changes included.
Known limitations: network duration depends on connection; structural validation is not malware scanning/full codec decoding. Actual financial writer exercised in prior isolated tests; the large-file handoff test deliberately uses a non-writing parent RPC harness. An unrelated Membership Google contract CI failure is identical to the preceding deployment and remains outside this request.
Evidence: docs/qa/evidence/document-100mb/.

SUTIAPP ARCHITECT REVIEW
Verdict: APPROVED for the current 100 MB authorization.
Method: read-only comparison of exact published baseline, scoped source reversals, SQL readback, deployed artifacts, historical fingerprints, actual tests and public hashes; no independent subagent.
Findings: CPU exhaustion observed in the initial real trial was corrected; large submission batches isolate verification per original. Invalid WebP fixture ordering was corrected and now rejected by the new-file parser. No weakened Auth/RLS or browser-trusted receipt.
Owner decision required: NO.
Recommended next action: close this authorized scope. Do not expand into unrelated legacy CI, Google or financial work.
