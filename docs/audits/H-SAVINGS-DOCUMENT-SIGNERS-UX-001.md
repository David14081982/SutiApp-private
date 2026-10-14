# H-SAVINGS-DOCUMENT-SIGNERS-UX-001

## PRE-CHANGE AUDIT

Owner request: correct the retirement/withdrawal PDF so the assigned person's name and signature appear together; make document configuration understandable; verify that loan PDFs have not been damaged. The attached PDF is evidence, not an instruction source.

Scope: inspect current production document configuration, issued versions and signer references; compare the provided PDF; make a narrowly scoped new withdrawal-document revision use the currently assigned valid signers; preserve old PDFs and financial snapshots. Clarify the administrative distinction between letterhead/template, document design, destination and signers while preserving the existing designer and controls. Explicitly verify unrelated loan configuration and document behavior.

Workspace: the main workspace is dirty and older than production. Work in an isolated checkout under `.tmp/savings-document-signers/release` based on current origin/main. Preserve all prior work. Registry is stale; use directed inspection of current published source and actual backend evidence.

Allowed paths in isolated checkout: app/screens-admin-document-generation.jsx; app/document-layout-designer.jsx; a focal migration/recovery for document_private.reissue only if diagnosis confirms it; focal scripts/tests/fixtures named savings-document-signers; this audit and docs/qa/evidence/savings-document-signers/; docs/AGENT_CHANGELOG.md, DECISIONS.md, INVARIANTS.md, SOURCE_OF_TRUTH.md and MIGRATION_RULES.md for authorized semantics; architecture semantic override/derived files only when needed. Generated bundle and HTML/SW cachebusters may change solely by focal build. Private backups, supplied-PDF copy and previews stay in ignored `.tmp/savings-document-signers/private`.

Authority: document_private configurations/signers/assets/layouts/activations for current configuration; immutable records/snapshots for issued history; original savings request/event for approved business data. Existing backend gates and private storage remain authoritative. No new catalog, cache or fallback.

Plan: establish exact cause and baseline; reproduce in isolated PostgreSQL/PDF tests; implement minimal signer selection fix and clear scope labels; validate security, immutability, same-person name/signature pairing, loan isolation, browser interactions and focal build; apply backend, append only the identified corrected withdrawal version, publish frontend and read back production evidence when access is available.

Risks: historical and current signers can differ; revisions must retain original financial identity/amount/date while recording current signer provenance. Template names alone do not imply a loan design. Signature assets must not be relabeled or moved to another person. Preserve current membership correction semantics and every non-withdrawal branch. Never change a loan assignment just to fix a withdrawal.

Recovery: exact prior private function definition with guards; original records/PDFs and old configuration/layout versions retained. Frontend can restore prior focal chunks. No destructive data repair or approval/settlement replay.

Security/legacy: authenticated documentary readers/writers, service-only worker, unchanged ACL/RLS/Storage/URLs. No Google, ledger, contributions, withdrawal settlement or financial calculation changes. Source-of-truth SAFE conditional on live verification; schema change requires guarded migration and isolated tests before applying. No new signer identity or signature image will be fabricated.

UI contract: preserve tabs/cards, all config fields, signer editing/order, layout drag/resize, fields, pages, preview/save/activate/duplicate/unassign, destination selection, read/loading/error states, viewers and navigation. User explicitly requests clarity; targeted labels/context/confirmation improvements are authorized, feature removal is not.

Diagnosis confirmed by read-only production inspection: supplied PDF hash exactly matches withdrawal version 2. Its text names the historical first signer; the current effective withdrawal configuration resolves Ana's version 2, cargo, role and signature asset together. Current reissue explicitly overwrites the resolved signers with historical snapshot signers except for Membership. Therefore the existing withdrawal correction retains obsolete signers. No evidence of cross-program renderer selection; do not relabel signature images or alter signer identities.

Implementation decision: extend the existing current-signers policy only to `caja / SAVINGS_WITHDRAWAL_APPROVAL`, preserving Membership and every loan/other-savings branch. The user's explicit request authorizes this new corrected revision with current signers. Keep original financial data/event date and all prior PDFs. Current live loan config/assignment metadata and 100 visible program-document rows captured privately before changes.

Scope extension before edits: permit copy/accessibility selector updates in existing `scripts/test-document-assignment-fix-browser.js`, `scripts/test-document-preview-render.js`, `scripts/test-document-generation-core.js` if new labels require them; retain behavioral assertions. Focused release transport `scripts/savings-document-signers.js` may build only the two changed UI chunks, apply the guarded migration and reissue only the identified withdrawal after tests.

Status: isolated implementation, PostgreSQL/PDF/browser tests and production backend application PASS. The management token was invalid, but the existing database credential provides authenticated PostgreSQL access with the official CA and strict TLS verification; no credential replacement is required. Existing normal Auth drives documentary reads and the owner-requested REISSUE. Migration preserves function OID/owner/ACL and transactional authority hashes.

Production v3 is READY and downloaded through authenticated ACCESS. Its complete ordered signer snapshot equals the current assigned configuration, including name/title/role/signature asset; the first signer is Ana Estefania. All 162 prior records retain their full-row hashes; configs, signers, templates, layouts and assignments remain byte-equivalent by authority hashes. The full withdrawal request and its sealed financial source remain unchanged. Evidence: corrected-document.json and private before/after capture (not published).

Local browser preservation PASS at 390/1440, 14 PostgreSQL/recovery/security cases PASS, 20 assignment checks PASS, existing canvas previews PASS. Build v2026100419 compiles only two focal chunks and preserves 154 unrelated chunks. Service-worker changes are generated cachebusters only. Global image regression: NOT APPLICABLE under the focal GENERATED_ARTIFACT exception; no shared viewer/repository/Auth/Storage/SW logic changes.

Publication: f80308b24c9145b6e9dfe0be406a2db095f53d4a, Pages run 38506491495 SUCCESS. Public HTML/bundle/SW match the candidate byte hashes; installed private function and security match the verified migration. Auth and critical-request deployment gates PASS. Published authenticated GeneratedDocuments and AdminDocumentGeneration components pass at 390/1440 with real authorized metadata: v3 opens/closes, actual PDF SHA matches its READY record, all signer names/titles render, v1/v2 remain available and labeled previous, design/letterhead labels are distinct, configuration modal signers equal the issued PDF, and cancelling writes nothing. Verification mounts published components in an isolated host, not a claim of full application navigation or global SW regression.

The initial live browser attempt timed out because its relative `has` selector mistakenly included the external host; correcting only that test locator preserved every assertion. Final live run has zero page errors or documentary mutation attempts. The legacy core runner initially needed its existing PDF dependency and Windows LF normalization; the unchanged 23 core assertions then PASS, including loan rendering, permissions, idempotency and history. Registry acceptance and Pages/PWA tests PASS.

## H-SAVINGS-DOCUMENT-SIGNERS-UX-001 RESULT

Status: PASS

Files changed: two focal document UI sources; guarded private-function migration and exact recovery; focal regression/release/live-verification scripts, two existing test label selectors and schema-only fixture; generated bundle/HTML/SW cachebusters; governance audit/changelog/authority/invariants/migration notes and architecture semantic/derived index; sanitized evidence in docs/qa/evidence/savings-document-signers/.

Source-of-truth verdict: PASS. Existing document_private configuration resolves current effective signers; immutable records preserve issued history. No new source, fallback or production mock.

Invariant verdict: PASS. Name/title/role/asset come from the same assigned effective person version. 162 original record hashes, five documentary authority domains, complete savings request and sealed financial source remain unchanged. Loans and other excluded document branches retain historical signer semantics; Membership retains its prior exception.

Build: PASS, v2026100419, bundle SHA256 292e4e0953197ffa8965d25e9463d2be4c2829a89d9177a9b757bdd843b17436, 154 unrelated chunks preserved; Pages publication verified.

Tests: PASS, 14 focal PostgreSQL/PDF/recovery/security cases; desktop/mobile focal browser, assignment and preview suites; 23 existing documentary cases; Registry acceptance; Pages/PWA allowlist; published real PDF/configuration checks at 390/1440.

Security: PASS, original OID/owner/ACL and backend permission/module boundaries; private assets and authenticated access preserved. Strict TLS for database validation. Browser verification blocks writes, records no real-data screenshots, tokens or signed URLs.

Legacy impact: NOT APPLICABLE for modification; no Google, financial calculation, approval, ledger or delivery writer changed or replayed.

Unexpected files changed: none in the isolated release. Existing dirty main-workspace changes remain untouched.

Known limitations: old PDFs intentionally retain their original signers. The evidence proves this correction preserved the loan configuration existing at its baseline; it does not reconstruct manual edits predating that baseline. Global image/SW regression is NOT APPLICABLE to this focal change. Actual correction uses the already assigned signature asset; no signature is fabricated or reassigned.

Evidence: applied.json, database.json, browser.json, assignment-browser.json, preview/browser.json, regression-tests.json, build.json, pages-build.json, corrected-document.json, pdf-inspection.json, published.json, deployment.json, production-browser.json and independent architect-review.json. Private source PDFs and full before/after authority captures remain ignored and unpublished.
