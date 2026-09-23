# H-ADMIN-LOGIN-HISTORY-001

## Published release — 2026-09-23

Frontend v280, commit `7e9033437bea0d2310ab7ea97febbb377afd5ae8`.
Pages run https://github.com/David14081982/SutiApp-private/actions/runs/35898491035
completed successfully. Published HTML/cachebuster and bundle SHA-256 match the
reviewed candidate (`deployment.json`). Production browser PASS: administrative
sidebar, recorded real login rows, deep-link refresh and mobile layout. Native audit
is enabled and capturing; previous BLOCKED sections below are historical evidence.
Owner's unrelated savings audit and changelog changes remain uncommitted/intact.

### H-ADMIN-LOGIN-HISTORY-001 FINAL RESULT

Status: PASS
Files changed: declared feature, additive migration/recovery, tests, release docs/index.
Source-of-truth verdict: SAFE; native Auth history, linked affiliate confirmed/historical phone.
Invariant verdict: PASS; no identity, historical record or permission assignment rewritten.
Build: PASS; v280 published, exact reviewed SHA-256.
Tests: PASS isolated PostgreSQL, fixtures, local/live browser, new native event,
production browser and global regression repeated after deployment.
Security: admin-only backend checks; anon REST and real non-admin DB role denied.
Legacy impact: NONE.
Unexpected files changed: NONE; owner's prior changes preserved outside both commits.
Known limitations: detailed history starts at activation; no reconstruction of earlier
events; current contact data, not a historical phone snapshot; module reserved to
administrators with authorization.read, not automatically granted to limited admins.
Evidence: live.json, browser-production.json, deployment.json,
global-production-after-release.json and preceding isolated/local evidence.

Final architect verdict: APPROVED. Production verification resolves the candidate's
remaining release step. Next action: owner may use Admin → Acceso y control →
Historial de accesos. No new H or additional production change is authorized here.

## Resumption — owner enabled native auditing

2026-09-23: `node scripts/admin-login-history-release.js verify` PASS: native audit
enabled, real login captured, 318 previously signed-in accounts, anon REST denied,
real non-admin database-role denied, admin REST allowed. The previous external
activation blocker below is historical and resolved.
Scope extends only to production-mode verification in the existing browser test,
release evidence and publication of these reviewed files. No unrelated savings
audit/changelog changes are part of the release. Existing isolated/global results
remain applicable: application sources are unchanged since those passing tests.
The release registry excludes the owner's unrelated untracked savings audit and
indexes only this H's changelog entry; the owner's working files remain intact.

## Candidate close and architect review — 2026-09-23

Implementation Status: PASS. Native capture and live local rendering of the recorded
event now PASS. All previous functional, security, build, recovery and global-image
checks remain applicable. Publication verification is the remaining release step.
UI preservation: PASS; existing sections/controls/navigation retained with additive module.

SUTIAPP ARCHITECT REVIEW
Task: H-ADMIN-LOGIN-HISTORY-001 candidate
Verdict: APPROVED (candidate; verify deployment before claiming published)
Critical findings: previous native-audit blocker resolved by owner and live verification.
Source of truth: Auth is the sole event writer; latest access and events stay distinct.
Architecture: dedicated reader; new Admin module; no shared repository changes.
Security: backend authorization.read + module boundary, anon/non-admin denial,
no Auth table grants or tokens/PII in evidence. Limited admins gain no automatic access.
Data: notification_phone and historical phone remain explicitly separate; no backfill.
Legacy: unchanged. WORK_QUEUE_HISTORY.md and task-orchestrator skill are absent;
this review authorizes no new task. Current owner-requested implementation continues.
Owner decision: NO
Next action: publish this candidate and verify the real production screen.
Response generated for Codex: YES

### RESPONSE TO CODEX

Candidate approved. Complete publication of this H only; exclude unrelated working
changes, verify Pages deployment and live history rows, preserve all backend/legacy
boundaries, then record final release evidence. Do not advance to another H.

## PRE-CHANGE AUDIT — 2026-09-23

Status: PASS (implementation authorized by owner: history + phone, administrators only).
Objective: Admin access screen with paginated latest sign-ins and recorded login history,
search, Sonora date filters, phone, explicit loading/empty/error and refresh.
Registry stale only for pre-existing unrelated changelog/savings audit; directed Auth/Admin
inspection and read-only live schema/config verification completed.

Scope/files: this audit; app/login-history-repository.js; app/screens-admin-login-history.jsx;
app/screens-admin.jsx (additive module/menu/route only); scripts/build-bundle.js;
app/bundle.js (generated); SutiApp.html (bundle cachebuster);
supabase/migrations/20260923000100_admin_login_history.sql and matching recovery;
scripts/test-admin-login-history.js, scripts/test-admin-login-history-browser.js,
scripts/admin-login-history-release.js; docs/qa/evidence/admin-login-history-20260923/;
docs/SOURCE_OF_TRUTH.md, docs/AGENT_CHANGELOG.md, architecture registry generated files.
Existing unrelated changes will be preserved. No financial/Google/Storage/domain writers.
Generated isolated public build: tmp/login-history-site/ (ignored), including publishable-only
Supabase config. Workspace has no app/supabase-config.js; live browser tests use this build.

Authority: auth.users.last_sign_in_at for latest sign-in; auth.audit_log_entries for events,
written only by Supabase Auth. Live preflight: audit table empty and
audit_log_disable_postgres=true. Enable native storage for future history; no invented
backfill or duplicate event store. Latest access and event history remain separate views.
public.affiliates.auth_user_id is the join; numero_control stays text.
affiliates.notification_phone is confirmed contact; phone_raw shown separately and explicitly
as historical contact when present, never silently substituted as current phone.

Security: new SECURITY DEFINER read-only RPC, fixed search_path, authenticated execute only,
auth.uid required + authorization.read + existing module boundary; module total-only like
Administrators. No new assignments/grants to people. No direct Auth table grants, raw
payloads, IP, sessions, tokens or credentials returned. Existing support-context restrictions
remain in force. Frontend gating is convenience, backend is authoritative.

Plan: implement additive RPC + module catalog entry and reversible removal; isolated PostgreSQL
matrix with synthetic data; browser fixture tests; build; apply tested backend and enable
native audit storage; real read-only checks; global image regression local + Pages due to
Auth config change. No test DDL or synthetic rows in production.
Risk: Auth storage grows; read query timeout bounded. No sign-in code or Auth schema changes.
Recovery: remove new RPC/catalog entry only if no responsibilities; retain all Auth history;
native storage setting can be restored to prior true without deleting captured events.
Tests: anon/non-admin/revoked/module-limited denials, authorized read, pagination >100,
filters, stable sort, date timezone, malformed audit actor safe, null/unlinked users,
confirmed/historical phone separation, loading/error/empty/stale response/unmount,
desktop/mobile integration, generated bundle consistency, global image regression.

UI preservation: existing Admin gate, groups, menu, routes, cards, permissions and navigation
retained; additive Historial de accesos item in Acceso y control. New screen follows Admin
header/theme, supports back, mobile horizontal table scrolling and accessible controls.

## Source-of-truth / migration / security verdict

SAFE / PASS for candidate scope. Additive reader and catalog only; no historical business
data rewrite; Auth is sole event writer. Production release remains subject to completed
verification. Read-only preflight max installed migration: 20260922000300.

## Verification and release state

- `node scripts/test-admin-login-history.js`: PASS. Isolated PostgreSQL; 131 synthetic
  accounts across six pages, 152 events, denied roles, malformed actor, literal search,
  Sonora date boundaries, phone separation, recovery/reapply. Hash tied to applied SQL.
- `node scripts/test-admin-login-history-browser.js`: PASS. Synthetic fixtures only;
  pagination, filters, tabs, empty/error/loading, stale response cancellation and mobile.
- `node scripts/admin-login-history-release.js build`: PASS. Two new chunks and one
  Admin chunk; 129 existing chunks preserved byte-for-byte. Full builder also compiled.
- `node scripts/admin-login-history-release.js apply`: PASS. Live additive migration;
  existing affiliates and assignments unchanged inside repeatable-read transaction.
- Live matrix: anon REST denied, real non-admin database role denied, admin REST read
  PASS (318 signed-in accounts). No personal data persisted in evidence.
- `node scripts/test-admin-login-history-browser.js --live`: PASS. Actual local public
  artifact + real backend: sidebar, route, rows, history empty state, refresh and mobile.
- `node scripts/test-global-image-regression-production-live.js`: PASS on GitHub Pages.
- `node scripts/admin-login-history-release.js global-local`: PASS on local candidate
  and real backend, including legitimate PDF, image documents, Login seal, profile,
  Admin affiliates, Membership, loan documents, gallery, Marketplace, fullscreen,
  refresh and with/without service worker. Zero business-row rewriting.

Initial local runs found Windows CRLF/SRI mismatch in existing vendor working files;
the ignored public artifact now uses canonical LF bytes verified against the existing
SRI hashes (matches Linux Pages build). An ephemeral test origin was rejected by the
existing document-access CORS policy; final test used already-authorized localhost:8080.
No vendor source, CORS, Storage or document-access implementation was changed.

Native audit activation is BLOCKED: Management PATCH returned success but GET still
reports `audit_log_disable_postgres=true`, even after subsequent real login. Events
remain zero. Asked owner to activate Authentication → Configuration → Audit Logs →
Write audit logs to the database. No substitute event writer or fake backfill was added.
Docs: https://supabase.com/docs/guides/auth/audit-logs .

Frontend is local, not committed/published. Complete capture verification before release.
Existing H005_TEST3 credentials are unavailable (validation_failed); non-admin live test
therefore uses a real existing principal under authenticated database role in a read-only
transaction, not an invented REST token or a production fixture.

## H-ADMIN-LOGIN-HISTORY-001 RESULT (pending external activation)

Status: BLOCKED
Files changed: declared implementation, tests, migration/recovery, evidence and registry.
Source-of-truth verdict: SAFE; native Auth + linked affiliate contact, no fallback.
Invariant verdict: PASS; identity, text control, history and assigned permissions preserved.
Build: PASS; focal candidate and public artifact.
Tests: PASS isolated + browser + real local screen + global local/Pages.
Security: admin REST allowed; anon REST/non-admin DB denied; no direct Auth grants.
Legacy impact: NONE; no Google/financial changes or reads for feature implementation.
Unexpected files changed: NONE; pre-existing savings audit and changelog entry retained.
Known limitations: audit option still disabled; no new event capture certified; frontend
not published; no previous unrecorded login reconstruction; full-access administrative
module (authorization.read), not automatically granted to limited module administrators.
Evidence: docs/qa/evidence/admin-login-history-20260923/.

Next action within same H: after owner enables native Postgres auditing, run
`node scripts/admin-login-history-release.js verify` and confirm a new successful login
appears in Historial. Update evidence/status, complete architect review, then publish
the reviewed frontend through the normal release process. Do not claim operational
history or close PASS before that check.
