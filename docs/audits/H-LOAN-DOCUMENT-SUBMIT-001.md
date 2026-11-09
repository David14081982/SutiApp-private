# H-LOAN-DOCUMENT-SUBMIT-001

## PRE-CHANGE AUDIT

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
