# H-SAVINGS-WITHDRAWAL-HISTORY-001

## PRE-CHANGE AUDIT

Owner request: add Historial beside the existing main Savings tabs. List people requesting a withdrawal and people whose withdrawal was completed; selecting a row opens their existing Savings detail with the corresponding request and its authorization PDF. Each withdrawal remains a separate operation when one person has several.

Scope: focal additive UI in app/savings-panel-admin.jsx using existing SavingsPanelRepository runtimeRequests/people/person and existing InlinePerson/SavingsRequestsAdmin/GeneratedDocuments. Search and explicit state filters separate requested, authorized and delivered money. Preserve existing tabs and all their interactions. No new approval, settlement, reissue, signer configuration or financial calculation.

Allowed paths: app/savings-panel-admin.jsx; scripts named savings-withdrawal-history or test-/verify-/release-savings-withdrawal-history; this audit, docs/qa/evidence/savings-withdrawal-history/, docs/AGENT_CHANGELOG.md; architecture semantic/derived files only for demonstrated dependency changes. app/bundle.js, SutiApp.html and sw.js may change solely by focal generation/cachebusters. Private readback records, screenshots and auth fixtures stay under ignored .tmp/savings-withdrawal-history/private. Expand audit before touching an additional runtime/backend file.

Workspace: isolated checkout .tmp/savings-withdrawal-history/release based on published origin/main bc3ec240caa401f603c5858a14722aa549526b84. Main workspace contains extensive earlier work and is not used for packaging. Initial current Registry FRESH; broad human query absent, directed lookup and source inspection locate SavingsPanelAdmin, runtime requests, person readers and existing documentary component.

Authority: public.savings_requests and its established backend request projection for current requests/status/approved and delivered amounts; existing Savings workspace readers for participant identity and current account detail; document_private records/configuration and authenticated document API for PDFs. Historical import/review records are not interpreted as completed current withdrawals. Existing Programa > Auditoria y solicitudes anteriores remains available. No new table or alternative authority.

Security/legacy: reuse authenticated savings.read readers and current private-document access gates. No changes to Auth, permissions, RPC, RLS, Storage, shared viewer/repositories or Google. List availability is not approval or delivery. Exact Folio mapping must reject ambiguous/missing identities without associating another account. Stored monetary values remain authoritative under the standing owner instruction.

UI contract: retain Resumen, Personas, Atencion, Programa, Reporte RH, KPI cards, filters, pagination, inline details, all contribution/reconciliation/settings controls, unsaved-edit guards, loading/error/empty behavior and responsive layout. Historial is additive. Reuse InlinePerson instead of creating a second account-detail implementation. Use each request ID for its documents, never a program-wide or person-wide guess.

Risks/verification: confirm the existing request reader has no hidden truncation or excluded final states; distinguish withdrawal requests from JOIN/CHANGE_AMOUNT/TERMINATE; include ordinary and extraordinary withdrawals where present. Verify old/new requests, repeated person, exact identity, pending/approved/settled/rejected/cancelled, no-document state, loading/error/retry, search/filter, dirty navigation and mobile/desktop. Regress existing Savings flows and document access using isolated fixtures; read-only real verification must not create approvals/payments/QA documents. Focal build preserves unrelated chunks and SW logic. Global image regression NOT APPLICABLE if no shared component is modified.

Recovery: restore the focal source/chunk/cachebusters. No data migration or financial rollback is needed.

Status: PASS for audit and owner-authorized additive UI scope; implementation/read API completeness verification in progress.

## Scope extension before implementation

Directed audit proves get_admin_savings_runtime_requests has a global 500-operation cap, and its per-person route can also omit an old selected request. An additive paginated reader is necessary for complete Historial; do not alter the shared reader or financial writers. Permit supabase/migrations/20261014000200_savings_withdrawal_history.sql, its exact recovery, app/savings-withdrawal-history-repository.js, the focal addition to scripts/build-bundle.js load order, docs/SOURCE_OF_TRUTH.md and docs/MIGRATION_RULES.md. The new repository serves only this tab. No existing shared repository is modified.

New RPC get_admin_savings_withdrawal_history(search,status,offset,limit): same authenticated savings.read permission as workspace; empty fixed search_path; reject invalid filters/page sizes; canonical operational savings requests/participants, existing current-name helper; only WITHDRAW and EXTRAORDINARY_WITHDRAWAL; stable submitted_at/id ordering, total before pagination. Requested amount and decision/settlement dates remain distinct. If displayed, delivered capital/yield/total must come only from the established settlement columns after SETTLED, with missing values preserved as null; no balance, yield, schedule or eligibility calculation. Explicit tests prove the existing settlement-column semantics.

Selecting a row uses its authoritative participant_id for InlinePerson, never a partial Folio search. The selected operation and its GeneratedDocuments are shown directly by request ID so its PDF remains accessible even beyond the old 500-row per-person list. Existing account detail and operation controls remain reused and unchanged. Pending requests and extraordinary requests without generated authorization retain explicit empty documentary state.

Migration audit: one new readonly function only, no table/index/trigger/financial-writer change or data rewrite. Existing owners, grants, policies, functions and source rows are fingerprinted before/after installation. Recovery drops only the exact added signature after frontend rollback; all requests/PDFs/history remain intact. Require isolated PostgreSQL security/pagination/identity/null/recovery tests and schema/read-only production verification before frontend publication. Owner authorization is the requested functional Historial; this minimal infrastructure does not change authority or business rules.


## Candidate verification and additive backend application

Status: PASS for implementation, isolated regression, local build and backend application; published browser acceptance pending.

- Canonical reader: 15 isolated PostgreSQL checks with 522 synthetic withdrawals. Proves paging beyond 500, states, literal search, repeated people, identity ambiguity, null delivery components, readonly transactions, deny/grants and exact recovery/reapply.
- Frontend: 11 check groups at 390/1440 px, including an old selected request outside the legacy 500-row reader. Exact participant opens the existing detail; exact request opens its PDF. Dirty-edit guards, stale context/revision, invalid DTO, error/retry and no-result states pass. Synthetic screenshots inspected.
- Existing panel: 10 automatic-contribution/person/self-view regression groups at 320/430/1440 px pass with zero browser errors and network blocked.
- Focal build 2026100420: one existing module rebuilt and one new reader added; 155 unrelated chunks preserved; service-worker logic unchanged. Pages build and deployment allowlist pass (PWA true; forbiddenFiles 0).
- Additive backend installed transactionally: function MD5 dca55accf3a419447dfa8a022b4558d0, STABLE SECURITY DEFINER, fixed search_path, authenticated-only with savings.read. Fingerprints preserve 59 savings/document tables and all preexisting public/document functions. No business/document writes.
- Shared AssetRepository, DocumentWorkflowRepository, viewer, Auth, Storage and SW logic unchanged. Mandatory global image regression is NOT APPLICABLE to this focal feature; shared generated bundle/cachebusters are GENERATED_ARTIFACT.

Evidence: docs/qa/evidence/savings-withdrawal-history/{database,browser,build,pages-build,applied}.json and existing-panel-regression/browser.json. Only synthetic screenshots are committed. Production readback and PDF checks must log no private names, IDs, signed URLs, tokens or real screenshots.


## Published acceptance

Runtime commits: f5d10dd (feature) and 3a6662013576a2a46e1309cc06b0c0dd13446d26 (test EOF normalization and derived freshness). GitHub Pages 38510543481 SUCCESS; Auth/backend compatibility and critical request production checks PASS. Public HTML, bundle and service-worker bytes match local Pages build 2026100420 exactly. The required source/chunk changes preserve all 155 unrelated bundle chunks.

Published SavingsPanelAdmin was mounted from the real bundle with the existing authenticated account and actual read-only repositories at 1440 and 390 px. All six tabs remain; lazy history, state/search, exact participant detail, timestamps, exact authorization PDF v3, open/close/collapse/Resumen navigation and overflow checks PASS. PDF SHA256 b8ef32911e178a2f5010d234ec42c882bdf01b798723f872386b978810d94544 matches the previously corrected real document; no regeneration was used. Browser page errors and mutation attempts: zero. Independent live SQL readback matches the canonical source and verifies permissions. No real-data screenshots or private IDs/names/URLs/tokens enter evidence.

Known verification limits: production currently contains one qualifying operational withdrawal; scale/paging beyond 500 is proven with 522 isolated synthetic rows. The published component is mounted in an inspection overlay with service workers blocked and unrelated background calls denied; this does not claim a full app-shell/SW/global-image regression. SW logic and shared surfaces were not changed. Original Google/import review-only antecedents keep their existing Programa location and are not invented as operational withdrawals. Requests without an issued document retain their actual empty document state.

Architecture: full Registry suite PASS (generation, lookup, permissions, incremental, stale detection, secrets and determinism); Historial aliases resolve to its reader, existing detail and documents. Derived index refreshes after final evidence writes.

H-SAVINGS-WITHDRAWAL-HISTORY-001 RESULT
Status: PASS (implementation and published verification complete; independent final review recorded separately).
Files changed: focal Savings panel and new withdrawal-history repository; additive SQL reader/recovery; build manifest; focal release/tests/live verification; generated bundle/cachebusters; scoped authority/migration/audit/changelog/evidence and derived architecture files.
Source-of-truth verdict: PASS; existing canonical requests/participants, financial detail and private document authority retained.
Invariant verdict: PASS; exact request/participant identity, nulls, dates and recorded monetary values preserved; no new business writer or fallback.
Build: PASS; version 2026100420, local Pages and live bytes identical.
Tests: PASS; database15; browser11 groups at two widths; existing panel10 groups at three widths; Pages allowlist; Registry suite; independent live backend; published browser at two widths.
Security: PASS; authenticated savings.read-gated stable reader; scoped documents and existing backend controls reused; explicit deny tests; no leaked credentials/PII.
Legacy impact: NOT APPLICABLE to Google, loan formats, formulas or financial writers; no changes to those sources.
Unexpected files changed: NONE in isolated release; dirty primary workspace preserved.
Known limitations: verification limits above; no-document operations stay explicit.
Evidence: docs/qa/evidence/savings-withdrawal-history/ including applied.json, published.json, production-browser.json and live-backend-review.json; independent final architectural verdict recorded in architect-review.json.

Independent final review: APPROVED; see architect-review.json. No outstanding defect or owner decision. Final evidence and derived index are committed separately without a new runtime deployment.
