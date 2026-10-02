# H-SAVINGS-ADMIN-UX-IMPLEMENTATION-001

## PRE-CHANGE AUDIT — 2026-10-01

Owner authorizes implementation with: «haz tus recomendaciones, entregame el sistema de ahorro funcional al 100%», following H-SAVINGS-ADMIN-UX-IA-DATA-AUDIT-001. This authorizes the proposed application/backend work and delivery; it does not certify unobserved payroll receipts or authorize changing yield rules.

Objective: automatic valid self-service JOIN, one administrative saver list with inline detail, current-period exceptions, a unified contribution history and focused database/network reads. Preserve the approved list visual language and every legitimate withdrawal/configuration/audit capability through secondary disclosure.

Navigator: lookup `ahorro`; STALE only because of three unrelated report artifacts, no indexed feature hash changes. Directed source/installed-SQL audit completed before implementation. The previous audit established PUBLISHED v2, 328 historical records, 25 native records, 333 active plans, and 294 missing receipts on 2026-09-30. Missing receipt is not proof of missing payroll deduction. Screenshots mentioned in the original request were not attached.

Authority: affiliates/numero_control for identity; canonical savings_enrollments and savings_contribution_plans for enrollment/scheduling; savings_transactions and holds for money/availability; current savings_contribution_overrides for receipts; accepted certification snapshots for pre-cutoff history; savings_requests and audit events for operations. No alternate master, Google fallback, browser persistence or financial mock in production.

Declared implementation files:

- app/savings-panel-admin.jsx, app/savings-runtime-admin.jsx, app/savings-panel-reference.jsx, app/savings-request-form.jsx, app/savings-panel-repository.js.
- supabase/migrations/20261001000100_savings_auto_enrollment.sql and its matching recovery.
- supabase/migrations/20261001000200_savings_admin_workspace.sql and its matching recovery.
- Focused isolated SQL, browser, adapter, build/release/verification scripts named savings-auto-enrollment or savings-admin-workspace / savings-admin-ux; private working evidence under .tmp/savings-admin-ux-20261001 and sanitized results under docs/qa/evidence/savings-admin-ux-20261001.
- This audit, docs/SOURCE_OF_TRUTH.md, docs/DECISIONS.md, docs/AGENT_CHANGELOG.md and derived architecture registry files.
- GENERATED_ARTIFACT: focal chunks in app/bundle.js and associated version references in SutiApp.html/sw.js. Service-worker behavior, shared viewers/assets/auth/routing/document helpers are outside this implementation scope.

Documents are made lazy at the Savings integration point; shared GeneratedDocuments and document repositories are not modified. If shared behavior must change, expand this audit and run the required global image regression.

Financial boundaries: no fabricated receipts, no historical rewrites, no yield calculation/period/eligibility changes, no bulk approval of existing pending JOINs, no Google/Apps Script writes. Existing legitimate withdrawal checks stay backend-enforced. A deficiency in extraordinary dual approval is tracked; real role authority must be demonstrated before changing that policy.

Risk: unintended enrollment authority, altered historical sums, period misclassification, identity leakage, loss of controls and unrelated dirty-worktree deployment. Mitigation: private helpers/no new role grants; authenticated RPC permission checks; exact text identity; existing writers/idempotency; isolated SQL/browser tests; source-to-bundle verification; release assembled over published code with unrelated chunks preserved.

Baseline: exact pre-existing focal sources, bundle and cachebuster/governance files copied to .tmp/savings-admin-ux-20261001/before before edits. The workspace was already dirty. Only this H's delta may be packaged.

Verification plan: isolated enrollment transaction/retry/identity/date/permission tests; history/summary/list/detail contracts and query scope; browser inline/context/error/lazy-document/mobile/desktop checks; generated-artifact equivalence; installed metadata and authenticated read checks without synthetic financial writes; independent architect review. No production test transactions or claim impersonation.

Recovery: preserve installed function definitions/ACL/owners before migration, supply recovery that retains all newly created real history; restore focal published frontend chunks without reverting unrelated work. No data deletion rollback.

PRE-CHANGE AUDIT Status: PASS for scoped implementation. Receipt reconciliation waits for real external evidence, requested separately while independent work continues. Final functional/release status remains unverified until evidence is appended.

## Implementation and verification

Backend installed and candidate frontend verified. Final browser, publication and independent-review evidence are recorded below as completed.

### Delivered behavior

- New, valid self-service JOIN validates identity and rules, creates exactly one enrollment and plan, records the real actor and creates the existing documentary final event. The first expected contribution remains the existing request-plus-30-days calendar rule. No receipt, money or yield is created. Existing pending and assisted registrations keep their existing review.
- Resumen, Personas, Atencion and Programa replace the primary fragmented navigation. Personas includes historical and native participants, preserves the approved list, and opens one account inline. Initial load requests only the summary; listing and detail are lazy and paginated. The detail cache is memory-only, 30 seconds / 8 entries, bound to identity and data revision; failures are visible and no fallback exists.
- One history uses accepted certification snapshots through cutoff and authoritative receipts/dated ledger thereafter. Pending and future dates cannot appear as received. Balance uses the existing canonical balance function independently of the history projection. Uncertified people cannot acquire a confirmed balance by merely having an enrollment.
- Attention groups missing evidence by period. The eight historical zero-review artifacts and the 354 imported request/review records remain accessible in secondary audit history, outside routine tasks. Approved terminations no longer count as pending work.
- Correction, projection, report, publication, access and individual withdrawal controls remain available under secondary disclosure. Request documents mount only when opened and unmount with their parent, removing hidden polling from ordinary account browsing.

### Verified evidence

| Check | Result / evidence |
|---|---|
| Automatic enrollment isolated SQL | `node scripts/test-savings-auto-enrollment.js`: PASS; six categories, calendar, permissions, retry, atomic rollback/document event, manual changes/withdrawal/termination preserved and exact recovery after real isolated use |
| Workspace isolated SQL | `node scripts/test-savings-admin-workspace.js`: PASS; snapshots, cutoff, ledger/receipt conflicts, zero corrections, missing Sep30, future Oct15, exact identity, pending enrollment, pagination, permissions, recovery/reinstall |
| Repository | `node scripts/test-savings-admin-workspace-repository.js`: PASS; identity, cancellation contract, deduplication, mutation invalidation and no fallback |
| Isolated browser | `node scripts/test-savings-admin-workspace-browser.js`: PASS, 12 checks with synthetic data and network blocked; keyboard/inline, cache expiry and context cancellation, pagination/errors, real document mount/poll cleanup, history reset/status, period navigation and JOIN capability; captures inspected at 320/430/1440 |
| Actual-schema forward + recovery | `preflight.json`: PASS; both migrations exercised and reverted in a single transaction, exact definitions/owners/ACL restored |
| Installation | `apply.json`: PASS; security and row-hash guards ran BEFORE COMMIT; 17 protected tables unchanged, including documentary records |
| Authenticated reads | `rpc.json`: PASS with normal configured login; all three new RPCs deny anonymous access; no financial writes |
| Candidate browser + real backend | `local.json`: PASS; exactly one initial summary, one opened-person request, cached reopening, list context preserved, 320/430/1440 without horizontal overflow or JS errors |
| Generated artifacts | `build.json`, `release-build.json`: only five Savings chunks rebuilt, 138 other modules byte-for-byte preserved; cachebuster changes only, no service-worker behavior change |
| Public artifact packaging | `scripts/build-pages-site.js`: PASS, 28 files in isolated release `_site` |

Production verification creates only normal authentication sessions and logs them out; no synthetic business data, transaction rollbacks with test financial rows, JWT claim impersonation or Google writes. Credentials and installed-definition backups remain private under `.tmp`, outside the release.

Measured authenticated HTTP samples: summary 2,650-2,680 ms; focal detail 141-287 ms. These are observations, not service guarantees. The summary still calls the established global projection once and is a remaining performance limitation. Normal listing computes only the requested page and opening a person does not repeat the global summary.

### Authority, security and recovery verdicts

Source of truth: PASS. Existing identity, financial, calendar and accepted-certification authorities remain unchanged; the new model is derived and read-only. No localStorage, mock, Google or fallback authority was added.

Invariants/security: PASS for the scoped change. Four helpers have no PUBLIC/anon/authenticated/service_role EXECUTE; three admin readers require real Auth plus savings.read, empty search_path and SECURITY DEFINER. Existing function owners/ACL remain exact. The definition-backup table has forced RLS and no browser/service-role grants. The JOIN helper reuses existing writer locks and validation; no new global role or approval privilege.

Legacy impact: no changes to existing financial rows, Google or yield rules. The future self-service enrollment policy/writer changes intentionally as authorized. Historical records and receipts are preserved. No change to yield calculation, periods, eligibility, or settlement loan checks.

Recovery: first restore the five previous frontend chunks and associated versions; apply workspace recovery then automatic-enrollment recovery. The latter checks installed-definition drift before restoring the four backed-up functions. Both retain every enrollment, request, plan, receipt, ledger entry, audit event and document created during use. Private baseline: `.tmp/savings-admin-ux-20261001/before` and `installed-before.json`.

Global image regression: NOT APPLICABLE. Shared assets/repositories/viewer/auth/routing/document source and service-worker behavior were not modified. Only focal Savings sources plus their generated chunks/cachebusters changed; local integration controls document mounting.

### Explicit limits

The software change does not certify financial completeness. The unchanged database has 353 participants, 333 plans and a total balance of 2,236,214.89; 294 expected contributions from 2026-09-30 (231,891.39 expected) have no receipt. An authoritative payroll/conciled-bank source was requested; none was supplied during implementation. The missing source is visible as one pending period, never silently confirmed. Existing two pending JOINs are preserved, not mass-approved.

Extraordinary withdrawal remains subject to its pre-existing restriction; this H does not introduce a payout path or assert that its legacy dual-approval role mechanism is sufficient. No authoritative mapping from Auth users to both required union offices exists in the inspected schema. Its correction needs a dedicated, documented authority decision. Yield automation is explicitly outside the original owner request.

The workspace already contained unrelated changes. Release is assembled over remote main `ecdf8b0aa38d2a88d21de6edb322cfcc21bef3c2`; no other dirty source, legacy function or shared component is included. Root workspace generated bundle version can differ from the release version because the two baselines differ; `release-build.json` is the publication authority.

### Final delivery

Independent `sutiapp-architect-reviewer`: APPROVED for this focal implementation. Review found and verified fixes for reset/removed history fields, before/after status and 320px tab layout. It explicitly distinguishes software delivery from missing financial evidence and the pre-existing extraordinary-approval limitation.

Published commit: `f42bb4b21ee533ab8cb95b60f2f03fcbea7a03c1`. GitHub Pages run `36957400509`: SUCCESS. Production: https://sutiapp.com/ ; bundle v307, normalized SHA256 `af153e96f47599aed10a11f6a651ed944dc4257d91d9c70c74c2e8b5855ddaf7`.

`node scripts/verify-savings-admin-ux-live.js production`: PASS against the exact public bundle. Real administrative login, initial single summary, 20-row paginated list, one inline-person request, cached reopen, mobile/desktop and navigation to Program passed without browser errors or business writes. Anonymous access to all three readers denied. This run measured summary 2,715 ms and individual detail 202 ms. Production contains the final context-remount guard and all reviewed UI fixes; `production.json` supersedes the earlier candidate hash in `local.json`.

`python scripts/test-architecture-registry.py`: PASS in both the root workspace and isolated release, covering generation, freshness, stale detection, lookup, incremental add/remove, secret exclusion and determinism. Early runs during file edits reported STALE and were rerun after freezing sources. A temporary local disk-full condition interrupted Git staging; only two generated site copies were removed, preserving source and recovery backups, and commit/push completed normally.

```text
H-SAVINGS-ADMIN-UX-IMPLEMENTATION-001 RESULT
Status: PASS
Files changed: five Savings sources; two migrations and their recoveries; focal tests/build/release/verification scripts; governance/audit/evidence/derived registry; generated bundle and version references.
Source-of-truth verdict: PASS; original authorities retained, no invented income or fallback.
Invariant verdict: PASS for scoped implementation; financial rows and protected yield/legacy rules preserved.
Build: PASS; five source/bundle chunks equivalent, 138 unrelated modules preserved, Pages deployment successful.
Tests: PASS; isolated SQL/adapter/browser, actual-schema recovery, authenticated production readers and final public browser.
Security: PASS for changed surfaces; private helpers, permission-gated readers, existing ACL/owners preserved.
Legacy impact: existing financial rows, Google, yield rules and payout checks unchanged; authorized future JOIN policy changed.
Unexpected files changed: none in the 39-file application release; unrelated root work retained.
Known limitations: 294 missing September 30 receipts awaiting external evidence; previous two JOINs retain review; pre-existing extraordinary role/dual-approval restriction unresolved; summary approximately 2.7 seconds; browser viewports are emulated, no physical-device or financial production-write test.
Evidence: docs/qa/evidence/savings-admin-ux-20261001/ and the commands/commit/workflow above.
```

This PASS accepts the scoped software delivery. It does not declare the entire savings domain financially reconciled or the separate extraordinary-withdrawal authority issue resolved. To close those limits, obtain actual receipt evidence and separately document the authoritative assignment of the required union offices before implementing the protected extraordinary flow.
