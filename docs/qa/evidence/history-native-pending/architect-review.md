# ARCHITECT REVIEW

Task reviewed: H-HISTORY-NATIVE-PENDING-001, verified implementation candidate based on published main `5460d8267b7d1ae95032091939c8146c0bef9f56`.

Verdict: APPROVED.

Review boundary: approval of the implemented and locally verified candidate. Registry regeneration/freshness, commit/CI and public deployment verification remain separate release gates. This report does not assert that this candidate is already deployed.

Reviewer: independent `/root/approval_safety_review`, 2026-10-26 America/Hermosillo. Product and external systems were read-only during this review; only this report was written.

## What Codex did correctly

- Fixed the diagnosed pre-filter omission in `LoanHistory.merge` instead of changing six filters, source ingestion or financial calculations. Existing own native requests become visible when the authenticated native load completes, even while the independent source observation is loading or unavailable.
- Limited eligibility to a loan or explicitly financial native SR row with a nonempty source identity, `revision` presentation and an explicit canonical status in `submitted`, `requires_financial_processing`, `in_review`. Unknown, missing and terminal states cannot inherit eligibility from the store's generic presentation default.
- Retained the original native object and tracking route. No amortization, loan approval, source status, amount, schedule or history key is invented.
- Deduplicated by `sourceId` against covered source identities, rendered projections and every confirmed approval identity. This last set also prevents an old approved request, omitted from a later complete publication, from reappearing as a stale native pending request.
- Avoided a creation-date cutoff and a stale `financial_request_ids` eligibility gate. Neither can invalidate an independently current canonical pending request.

## Important findings and evidence

The reviewed product file SHA-256 is `67156ca8941df38c4970e3386ee9a8a74a6ad2cb22f565b389bb3e51d6b0a1ef`. The reviewer independently compared the four browser evidence manifests with the current source/test files and confirmed every recorded hash. The generated bundle SHA-256 matches `build.json`: `7262a8951f0ec618c040c2c8ba901ae95d4d16ed73c0fc341277e6fef47c69fb`.

Evidence inspected, including the actual test assertions rather than only their summaries:

- `runtime.json`: 12 passing groups using the real native repository, operations store, merger and backend projectors. Coverage includes all explicit pending states, null source, stale financial IDs, older/newer publication dates, invalid eligibility, source/approval deduplication, old nonrendered approval suppression, native cancellation/removal, source-only removal, unchanged nonfinancial rows and exact financial values. Repeated merges issue no additional calls and leave frozen inputs unchanged.
- `browser.json`: passing 320, 390 and 1440 px cases. Real focal modules exercise source loading/error visibility, the existing own RPC, native tracking, a creation event while the previous source response lacks its ID, later source deduplication, old approval suppression, expiry, removal and cancellation. A deliberately late response for identity A is discarded after changing to B; logout purges rows. Updating native requests preserves an open amortization's DOM, scroll, quotas and downloaded statement. The existing event reads remain one native read and one lightweight approval read; there is no new full-history read, timer or channel.
- `snapshot-browser.json`, `immediate-approval-browser.json`, `total-paid-browser.json`: all three widths pass their focal regressions, including source deletion, identity/impersonation, approval subscription races, denial purge, 24-hour classification, monetary precision, Hermosillo midnight, PDF download and scroll. The 210-row PDF case is exercised at 390 px; it is not claimed at every width.
- `actual-case.json`: a read-only replay of the requested existing record through the real native modules changes visibility from zero to one card in Todas/En proceso without changing fields, tracking, source data or native read count. This is replay evidence, not a newly executed production loan transaction.
- `build.json`: 163 bundle modules, only `history-loans-repository.js` changed; HTML/service-worker differences are version references only, and the Pages/PWA check passes. The reviewer independently verified no diff in the 13 declared protected paths, including the entire Supabase and Google Apps Script trees, native reader/store, history UI/PDF, Finance sync/admin, auth and app shell. `git diff --check` passes.

The isolated 320 px error-state screenshot was inspected: the native pending card and existing tracking section remain present alongside the explicit source error. This is focal browser evidence; it is not a claim of an end-to-end production mobile-device test.

## Problems detected

No functional, security, data-authority or scope defect was found in the reviewed candidate. No product change is requested by this review.

Registry was expected to be stale during the coordinated source/documentation work. It must be regenerated and verified FRESH after this report and the audit are frozen; this known pending release step is not a functional defect in the candidate. `docs/WORK_QUEUE_HISTORY.md` is absent. The existing WORK_QUEUE concerns the separate master-plan productive-append gate; this review does not authorize that append, advance its phase or infer permission for another H.

## Architecture implications

The sole handwritten runtime change is a pure predicate and filtering/deduplication within the focal history merger. No new store, persistent cache, transport, migration, dependency, backend deployment, shared helper, authorization boundary or synchronization cadence is introduced. Existing projected/source rows keep their precedence and navigation. Recovery is the focused frontend revert; it requires no business-data rollback.

Global image regression is NOT APPLICABLE under the repository's generated-artifact exception: shared assets, repositories, routing, Auth and service-worker logic are unchanged. The existing snapshot suite's initial-loading expectation changed from one to two cards solely because the newly authorized canonical pending card is now visible; later source-backed expectations remain intact.

## Source-of-truth implications

SAFE for the owner-authorized, explicitly documented presentation exception. `program_requests` is the authority for an unmatched own native pending card and its native tracking. The existing authenticated native result is independent of Google publication and is not a substitute observation on source failure. The source error remains visible. No browser storage, mock or old observation is promoted into authority.

Native terminal state/removal withdraws native eligibility when the next existing canonical load supplies it. Published records still follow the published source observation; source-only deletion does not resurrect them. Confirmed approvals suppress stale native pending by their canonical source identity. Source-only pending/rejected entries, financial status, loan ownership, payment totals and amortizations retain their existing authorities. These boundaries are recorded in the appended authority/invariant/decision documentation.

## Security implications

PASS for this frontend change. The unchanged `ProgramRequestRepository.listHistory()` calls `list_self_program_request_history` without an owner argument. The SQL definition requires `auth.uid()`, resolves `get_effective_affiliate_id()` on the server and selects only that affiliate's request rows. The merge predicate is not treated as authorization.

The unchanged private-demand/operations guards invalidate on context change and reject stale generations/revisions. The reviewer inspected those guards and the native reader; the new browser evidence exercises a late native response across identities and logout, while existing suites cover impersonation and authorization denial. There are no new grants, policies, secrets, client-supplied owner selectors or privileged frontend capabilities. This review did not perform a new live cross-user database test or change a production session.

## Data and legacy implications

PASS / READ ONLY. Google Sheets, Apps Script, existing backend/schema, source observations, approval writers, schedules, financial calculations, source amounts, dates, quotas, historical records, the 15:00 synchronization and manual Finance action are unchanged. The native fields already loaded by the existing reader are reused without transformation. No extra Google access or production write was made for this repair's tests.

## UI preservation

PASS. Historial/detail/PDF source files are identical to the baseline. The existing sections, six filters, card styles, native tracking, source loading/error state, amortization controls, scroll and downloads are retained. The authorized addition is visibility of the previously discarded own canonical pending card. No redesign or new screen was introduced.

Owner decision required: NO. The pending-card authority exception and focused implementation are already explicitly authorized. This review creates no additional publication or business-data authorization.

Recommended next action: freeze this candidate, finish the Registry/audit release gates, and publish only through the already authorized release process. Verify successful CI and exact public artifact hashes before reporting publication complete. No new feature, financial transaction or productive append is part of that action.

# RESPONSE TO CODEX

Accept the implementation and test result of H-HISTORY-NATIVE-PENDING-001. Do not modify the reviewed product further without a concrete new defect. Regenerate/check the Architecture Registry after the finalized audit/report, confirm the declared diff and FRESH evidence, then complete the authorized commit/CI/publication workflow. Keep Google, Supabase/backend, source values, workflows and unrelated workspace edits unchanged. Record public artifact version/hash and CI success separately; until those checks pass, describe this as a verified candidate, not a completed production release. This instruction does not advance WORK_QUEUE phases or authorize a productive loan transaction.

# SUTIAPP ARCHITECT REVIEW

Task: H-HISTORY-NATIVE-PENDING-001.

Verdict: APPROVED, verified implementation candidate.

Critical findings: None. Registry and publication verification remain explicit release gates.

Source of truth: SAFE, narrow canonical native pending authority exception documented.

Architecture: Focal pure merger change; no new transport/cache/backend.

Security: PASS for scope; server-owned reader and context isolation preserved.

Data: PASS; no source/business-value mutation.

Legacy: READ ONLY; source/sync/financial logic unchanged.

Owner decision: NO.

Next action: Finish Registry and authorized release verification, then report the actual published result.

Response generated for Codex: YES.
