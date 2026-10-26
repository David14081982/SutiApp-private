# H-HISTORY-IMMEDIATE-APPROVAL-001

## Pre-change audit

Owner authorizes immediate own approval visibility, unchanged daily/manual amortization publication, a 24-hour approval window including blank X, and real source status after expiry. No Google, financial values, installments or historical record changes. Baseline d9000fad58393a6ea9084dd2f0cb1a66d356f8e0; isolated worktree.

Navigator is stale; directed discovery confirms the focal history reader, context SQL, history repository and existing approval writer. No changes to the approval writer or Google export are required: the approval transaction already stores its authoritative immutable contract and financial_approved_at.

Authority: Supabase confirmed approval event/immutable approval display fields govern only immediate approval presentation. Google/published observation remains sole authority for amortization, balances and real loan status. This is an explicit owner-authorized approval channel, not a source-error fallback. No new financial calculations, synthesized quotas or copied loan tables. Exact effective authenticated identity remains mandatory; no browser owner selector.

Plan: additive metadata-only per-affiliate approval revision and trigger on actual approval changes; authenticated own lightweight RPC; extend existing context with approved display fields/revision. LOAD remains own snapshot; APPROVALS transfers only own approved-card metadata. Targeted realtime and mount/foreground metadata checks update approval metadata without loading/replacing schedules. Local request events also use the lightweight path. Daily/manual publication and Google worker stay byte-identical. Preserve persisted clock; settled states win; active states become En pago on expiry; blank/unknown becomes Estado por revisar. Never infer an active status from absent X.

Declared product files: supabase/functions/loan-history/history.mjs and snapshot.mjs; additive migration/recovery 20261026000200_loan_history_approvals.sql; app/history-loans-repository.js; approval clock/preparation copy only in app/history-loans.jsx if required. Generated app/bundle.js, SutiApp.html and sw.js version references only. No shared Auth, routing, asset/viewer, general request/finance repositories or Google changes.

Declared verification/governance files: scripts/test-history-immediate-approval*.js; focused existing history tests only when fixture contracts need the new channel; docs/audits/H-HISTORY-IMMEDIATE-APPROVAL-001.md; append-only SOURCE_OF_TRUTH/INVARIANTS/DECISIONS/SECURITY_RULES/MIGRATION_RULES/AGENT_CHANGELOG; architecture registry/overrides for demonstrated new RPC/table/trigger edges; sanitized docs/qa/evidence/history-immediate-approval. Private scripts/backups/live receipts under .tmp/history-immediate-approval. Tests use isolated synthetic approvals; no productive approval/loan/session creation.

UI contract: preserve list filters/cards/controls, detailed loan cards/quotas/PDF/support, styles and scroll. Targeted approval never clears an open amortization. When a confirmed SR becomes a published loan, resolve detail via its validated sourceId within the same identity; no guessed links or persistent alias/cache.

Risk controls: reject foreign/mixed owners and ambiguous transfers; anonymous/other-user RLS denial; unchanged requests and financial inputs before/after. Notifications are metadata only, one affected affiliate, no global publication update, no cron/job dispatch, no browser polling or per-user Google reads. Coalesce concurrent approval reads and guard identity/revisions; on access denial purge, on transport failure show explicit error without replacing financial data. No stale source resurrection after a complete publication.

Verification: baseline regression evidence before edits; projector expiry boundaries/blank/settled/unknown states; real SQL trigger/RPC/RLS/recovery in local PostgreSQL; source hashes and writer/history row preservation; browsers 320/390/1440, no schedule refetch/remount/scroll reset on approval, duplicate and cross-context races; focal build/chunk parity and Pages/PWA checks. Global image regression NOT APPLICABLE: only the focal Historial module and generated references change. Independent architect review before publication.

Recovery: retain exact baseline Edge modules and context SQL; deploy DB first, Edge second, frontend last. Rollback frontend/Edge before removing new RPC/signal infrastructure and restoring context. Never change business records, global snapshot state or Google. RLS, grants and realtime publication membership verified before/after. Existing metadata only may be dropped by recovery; no loan data is stored in it.

Pre-change status: PASS for scoped implementation and local tests; production installation requires verified preflight, migration/recovery and code parity evidence, not additional owner approval for the already authorized scope.

Scope refinement: existing scripts/test-loan-history.js needs its former unknown-status-with-recent-approval expectation aligned to the explicitly authorized approval window; add a configurable local PGlite dependency path for the isolated checkout. Production read-only preflight confirms 276 approved financial contracts have numeric amounts, the new table is absent, baseline Edge v5 and active 22:00 UTC cron. Exact current SQL definitions/ACLs and Edge body are backed up privately.

## Verification and installation

Native PostgreSQL isolated tests pass 15 groups, including actual RLS/grants, atomic own revision, no publication on handoff/no-op, cascade behavior and exact recovery with drift rejection. The migration was installed at 2026-10-26T22:09:45Z in a repeatable-read transaction that asserted unchanged hashes of all program_requests, observations, global state/publication and daily cron before commit. Context OID/owner/ACL and both original snapshot/identity helper definitions were preserved. The exact prior context definition is backed up privately in the database and locally. No business-row backfill or Google call occurred.

Edge loan-history v6 is ACTIVE with JWT required. Its three deployed modules are AST-equivalent to the reviewed sources; anonymous LOAD and APPROVALS return 401. Existing Google writer, snapshot worker, daily/manual controls, PDF and approval writer remain byte-identical. Read-only inspection of the affected real case returns one Aprobadas and two No aprobadas, with twelve existing cuotas; its lightweight approval response is 347 bytes versus 2882 bytes for the history fixture constructed from current actual records. This is a per-case payload measurement, not a general latency or billing guarantee. No productive approval or impersonation was created for testing.

Runtime, original loan-history/PGlite, snapshot worker/reader and pending-request regressions pass. Browser tests at 320/390/1440 pass own/foreign/duplicate signals, exact 24-hour expiry, blank/settled states, revocation, concurrent revisions, errors, identity changes, SR-to-loan detail continuity and unchanged DOM/scroll/financial values. The independent reviewer reproduced a missed notification between initial LOAD and SUBSCRIBED; the final fix keeps one pending version reconciliation and its independent reproduction now produces only LOAD, APPROVALS and one metadata read. Both initial-load and reload/reconnect variants are covered. No polling or additional schedule read is introduced. Existing PDF download regression also passes, including 210 rows.

Bundle build and Pages/PWA packaging pass. Only two of 163 generated module chunks change; HTML and service worker differ only in version 2026102606. The 320px detail screenshot was reviewed: preserved structure/geometry and no overlap. Registry outputs are refreshed because the new RPC/table/trigger changes architecture; the generator is unchanged. Registry test and independent review receipts accompany this audit. Frontend public delivery is the subsequent commit/Pages release step and must be verified against the same bundle hash; backend installation is already verified here.

## H-HISTORY-IMMEDIATE-APPROVAL-001 RESULT

Status: PASS for implementation, focal verification and backend installation; frontend publication verified separately after this commit.
Files changed: focal history reader/projector/repository and clock wording; additive SQL/recovery; targeted tests; generated bundle/version references; audit/governance/derived registry and sanitized evidence.
Source-of-truth verdict: PASS. Confirmed native approval supplies immediate presentation only; published Google observation retains amortization and real status authority.
Invariant verdict: PASS. Exact identity, 24-hour persisted clock, settled precedence, no inferred active state, no financial/history mutation, no global refresh on approval.
Build: PASS. 163 modules; 161 unchanged. Pages/PWA PASS.
Tests: PASS. Runtime, PostgreSQL/PGlite, pending and snapshot regressions, browser widths 320/390/1440; registry receipt and independent review in evidence directory.
Security: PASS. Own effective identity/RLS, authenticated no-argument RPC, anonymous denial, no browser writes, no credentials or personal records in committed evidence.
Legacy impact: No Google writes or financial recalculation; existing worker, schedule and manual button unchanged.
Unexpected files changed: None in isolated worktree; root work preserved.
Known limitations: Websocket delivery tested with isolated browser transport; no real approval transaction was created. Production network latency is not guaranteed. No physical-device or full application visual-regression claim.
Evidence: docs/qa/evidence/history-immediate-approval; private production rollback backups and release receipts under .tmp/history-immediate-approval (not published).
