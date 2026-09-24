# H-ADMIN-REVOCATION-001 — APPLIED / VERIFIED

Latest status: PASS. Owner-authorized migration installed on 2026-09-24 at
15:15 UTC (08:15 Sonora). No real administrator was revoked during installation.
Earlier preparation-only statuses below are historical and superseded for deployment.

## Authorized application continuation — 2026-09-24

Owner instruction following the prepared migration proposal: "hazlo de forma
quirurgica". This authorizes applying exactly the tested migration and verifying
its installed state. Earlier NOT APPLIED/read-only scope describes preparation.
It does not authorize revoking a real person, changing account records, publishing
unrelated frontend edits, or running production mutation fixtures.

PRE-CHANGE AUDIT: application runner `scripts/apply-admin-revocation-release.js`,
this audit, AGENT_CHANGELOG, and sanitized preflight/application/post-install
evidence in the existing evidence directory. Production changes: exactly reviewed
CHECK/RPC/technical recovery table plus migration tracking, in one transaction.
Before/after fingerprints cover administrative assignments, roles, grants, audit,
sessions, Auth, affiliates and document metadata; no row-level exports. Installed
function definitions/backups are retained privately in ignored tmp storage.
Use the unchanged SQL SHA-256 recorded by the 23-check passing isolated matrix.
Recheck live baseline, collision, grants and functions; stop on drift. Read-back
checks installed definitions, ACL/OID/owner, RLS and tracking. No runtime authority
changes. Recovery remains no-use only. Existing unrelated work is preserved.

## AUDIT / AUTHORITY / PLAN / RISK

Owner requests confirmation against production using reads only, an isolated tested
repair, effective revocation of total/module/independent administrative grants,
preservation of Auth/affiliate/history and protected principal, guarded recovery,
and repair of the existing focal regression. No deployment or live revocation is authorized.

Authority remains Supabase admin_assignments/admin_roles/admin_role_permissions,
admin_section_responsibilities, impersonation_sessions and existing audit logs.
No new runtime authority, frontend permissions, business-data copy or fallback.

Declared files: candidate migration/recovery 20260924000100 (existing untracked
files, not applied as far as currently established), scripts/admin-revocation-readonly.js,
scripts/test-admin-revocation-isolated.js and supporting synthetic SQL, focal
build verification if needed, sw.js cachebuster only, this audit, scoped evidence
under docs/qa/evidence/admin-revocation-20260924, AGENT_CHANGELOG, and derived
architecture registry only for demonstrated architectural changes. Private schema
baseline under ignored tmp/admin-revocation; no production user rows are exported.
Existing SutiApp.html/bundle/screens-admin-access edits are baseline, not ours.
No changes to financial writers, Google, assets, shared authentication, routing,
or service-worker logic. Expand audit before any additional scope.

Plan: read installed definitions/catalog and existing error logs; reproduce in
isolated PostgreSQL with synthetic identities; widen only the permissions check;
extend the existing revocation RPC to retire independent responsibilities with
audit; preserve protected/self/last-principal guards and assistance termination;
test authenticated existing-session denial, grants, audit atomicity, no-use
recovery and refusal after use/drift; align generated bundle cache reference.

Risks: lost updates/concurrent grants, stale migration baseline, recovery after
new voting permissions occur in assignments, independent section privileges,
unproven historical error logs. Never manufacture a live error by invoking a
mutating RPC. Fail closed on schema drift and on recovery after operational use.

Baseline: Navigator STALE; direct code inspection required. Existing protected
contract test fails because HTML references bundle v284 and sw CORE references
v283. Both are generated artifact cache references; no SW logic change planned.

## Verification boundary

Production is read-only throughout this H. A successful isolated test does not
establish a deployed repair or production acceptance.

Scope extension for verification: temporary PostgreSQL cluster on loopback port
55494 under ignored tmp/admin-revocation/pgdata, for concurrent writer tests;
scripts/test-admin-revocation-isolated.js supports this explicit local-only mode.
No production connection or credentials are loaded by the isolated tests.
Optional isolated browser harness and generated build checks are in scope.

Legacy guardian: READ ONLY inspection of installed permission helpers containing
the historical savings prefix, solely to reconstruct authorization dependencies.
No financial/Google data read or writer, calculation, trigger or formula changed.

Verification scope extension: versioned schema-only fixture
`scripts/fixtures/admin-revocation-20260924.json` (installed definitions, constraints,
ACL/RLS and permission catalog; synthetic role labels, no account/assignment rows),
`scripts/test-admin-revocation-browser.js`, and
`scripts/verify-admin-revocation-build.js`. These are isolated test inputs, never
application authorities. Tests must run without production credentials/network.

## Production evidence (READ ONLY)

Installed constraint MD5: `2d001f1a4f3f0b8e4a3c8ae948647051`. Exactly seven
`votaciones.*` role permissions fall outside it. Eight assignments, one protected,
four active assignments also holding enabled section grants. Candidate state table
absent and migration version not registered at capture time.

Logs retrieved through the Management API `logs` endpoint confirm SQLSTATE `23514`:
`new row for relation "admin_assignments" violates check constraint "admin_assignments_permissions_check"`.
Latest matching record: `2026-09-24T13:20:59.474000` UTC (06:20:59 Sonora).
Fifteen returned records have `revoke_admin_assignment` and `assign_admin_role` in
log attributes; one additional record has only the assignment function. Only
timestamp, exact error sentence, SQLSTATE, attribute key names and context-presence
booleans are saved. No failed row, query payload, account identity or token exported.
An initial logs backend error and retired endpoint response were resolved by retrying
the supported endpoint. No mutating RPC was called against production.
API reference: https://supabase.com/docs/guides/observability/advanced-log-filtering

## IMPLEMENT

The uninstalled candidate now changes only the existing permission CHECK and the
existing `revoke_admin_assignment(uuid)` RPC. It adds the seven already-authorized
permissions to the CHECK, preserving the rest verbatim. Exact definition hashes
guard the baseline; unexpected role permissions abort the transaction.

Revocation calls the unchanged `assign_admin_role`, then disables every currently
enabled section responsibility for that subject, preserves grant metadata, and
records complete before/after section-grant evidence in the existing admin audit.
Assignment, section grants, operator support-session closure and audits commit or
fail together. Self, attended subject, protected principal and last-principal guards
remain canonical. Function signature/OID/owner/ACL are preserved. Existing Auth
account and affiliate/dossier data are not written or deleted.

Table locks serialize assignment/section writers with the revoke transaction.
A subsequent explicit authorized grant is a new access decision; this repair is
not a permanent account ban. Direct callers of `assign_admin_role(...,false)` keep
their existing role-only semantics; the panel's Revocar uses the strengthened RPC.

Recovery metadata has forced RLS and no PUBLIC/anon/authenticated/service_role
table privileges. It is not a new authority for permissions. Installation writes
only this technical backup metadata, not business data.

`sw.js` changes only CACHE v217→v218 and CORE bundle v283→v284 to match existing
HTML. No cache/fetch/push logic changed. Existing screen and bundle edits from the
previous task were preserved. The canonical build runs into ignored temp storage:
all 132 bundle chunks match source semantically; three preexisting differences are
formatting-only, so no unrelated bundle chunks were overwritten.

## Recovery guarantees and limits

This is **NO-USE schema recovery**, not business-operation undo. Before any
authorization activity it restores the exact CHECK and RPC definition. It refuses
constraint/function drift (`RECOVERY_BLOCKED_DEFINITION_DRIFT`) and assignment,
responsibility, role catalog, role permission or related audit history changes
(`RECOVERY_BLOCKED_AUTHORIZATION_HISTORY`).
That includes a revoked module admin without voting permissions and an added total
admin. It never erases audit, strips historical permissions or re-enables accounts.
After use, retain the installed fix and prepare a separate forward repair from the
current state. The old restriction cannot be promised compatible after new voting
permissions have entered any assignment, including disabled assignments.

## Reproducible verification

1. Optional authorized production read refresh: `node scripts/admin-revocation-readonly.js`.
   It regenerates the private baseline and sanitized schema-only test fixture.
2. Existing logs only: `node scripts/admin-revocation-readonly.js --logs`.
3. Offline SQL + Chrome: `node scripts/test-admin-revocation-isolated.js --browser`.
4. Build/parity/protected contract: `node scripts/verify-admin-revocation-build.js`.

The isolated suite uses actual captured functions (46), constraint definitions,
triggers, table RLS/policies/grants and permission catalog. Auth identities,
assignments, affiliate and dossier rows are synthetic. All function and CHECK
hashes match the captured production definitions before applying the candidate.
Chrome loads the actual UI, icons, primitives and repository, with all browser
network requests blocked; an allowlisted local bridge executes the real SQL.

23 checks PASS, including baseline failure reproduction; total-admin add;
total/module revocation; independent responsibilities; unrelated admin retention;
same-session denial; operator support-session closure; self/protected/last-principal/
attended-account denial; anon/normal denial; direct-table escalation denial;
atomic rollback on audit failure; schema drift and unexpected role permission
rejection; no-use recovery; repeat installation refusal; recovery refusal after
use; identity/history preservation; actual Add/Revocar controls and an already-open
browser session denied after revocation. Desktop and mobile screenshots are synthetic.

Limits: JWT signature verification/PostgREST transport are not exercised by the
isolated bridge. Multi-connection contention was not exercised: the additional
native PostgreSQL 18 initdb attempt crashed with `0xC0000005`; initdb removed its
incomplete data directory and no server was started. Sequential PostgreSQL/WASM
transaction and browser checks passed. No performance claim under contention.
Already-issued downloads/tokens are not recalled; subsequent permission-checked
operations are denied. No production end-to-end revocation is claimed.

## Guardian verdicts

SOURCE OF TRUTH: SAFE. Existing Supabase authorities, same readers/writers; recovery
metadata and schema fixture are non-runtime evidence. No mock/cache/fallback enters
production. No access can reappear from these artifacts.

MIGRATION: PASS for isolated candidate. Exact baseline guards, single transaction,
no business rewrite, protected constraints maintained, no-use recovery demonstrated.
Deployment requires a fresh drift/version check and separate owner authorization.

SECURITY: PASS within isolated scope. Backend authorization, same-session denial,
cross-account targeting guards, least privilege, forced RLS for backup, no frontend
secrets or new API grants. Auth and business identity remain separate.

LEGACY: READ ONLY inspection of unchanged permission helpers. No Google transport,
financial data, balance, loan, formula, calculation or financial writer touched.

CLAUDE UI PRESERVATION REVIEW
Screen: Administradores.
Original/current sections: header, add total admin, account module editor, assignments.
Missing/added sections: none.
Controls/interactions: Add, Pantallas, Revocar, active/revoked cards preserved.
Navigation/visual structure: unchanged screen source; isolated desktop/mobile exercised.
Unauthorized redesign: NO. Verdict: PASS.

Global image regression: NOT APPLICABLE. No shared asset/auth/routing/helper or SW
logic changed; cache name/CORE reference are generated artifact version alignment.

## H-ADMIN-REVOCATION-001 RESULT

Status: PASS — preparation and isolated verification only; NOT APPLIED.
Files changed: candidate migration/recovery; read-only capture, isolated SQL/browser
and build-verification scripts; schema-only fixture; sw.js version references;
this audit, evidence, AGENT_CHANGELOG and derived architecture registry.
Source-of-truth verdict: SAFE.
Invariant verdict: PASS, including INV-189–198 and retained historical metadata.
Build: PASS, 132 source chunks, semantic source/bundle parity.
Tests: PASS, 23 isolated checks + protected-contract focal guard + browser desktop/mobile.
Security: PASS within explicitly stated isolated boundary.
Legacy impact: no writes, no financial behavior changes.
Unexpected files changed: none by this task; preexisting dirty files retained.
Known limitations: no live application/production revocation, no JWT gateway validation,
no multi-connection contention measurement; no-use recovery only.
Evidence: `docs/qa/evidence/admin-revocation-20260924/{production-readonly,production-error-logs,isolated,browser,build}.json`
and synthetic desktop/mobile PNGs; exact SQL/fixture hashes in evidence.

## SUTIAPP ARCHITECT REVIEW

Task: H-ADMIN-REVOCATION-001, candidate preparation requested by owner.
Verdict: APPROVED for this scope, not a production deployment approval.
Critical findings: root cause confirmed in installed CHECK and matching production
error logs; role-only revocation was insufficient for independent responsibilities;
the candidate fixes both without changing shared permission helpers or business data.
Source of truth: retained. Architecture: existing RPC strengthened, private technical
backup added. Security: tested backend denials, no API grant expansion. Data: history
retained. Legacy: untouched. Owner decision: NO for completed preparation.
Missing governance file: WORK_QUEUE_HISTORY.md absent. Existing WORK_QUEUE concerns
unrelated financial cutover; it does not authorize this deployment or automatic advance.
Next action: deliver the exact candidate and evidence for a separately authorized
application. Recheck current baseline/version immediately before application. No
automatic live admin revocation or deployment follows from this review.
Response generated for Codex: YES.

### RESPONSE TO CODEX

Approve the completed preparation of H-ADMIN-REVOCATION-001. Preserve the candidate
SQL and evidence. Do not apply or publish under this request. On a later explicit
application authorization, recheck production baseline hashes and migration version,
apply only this candidate in a transaction, verify the resulting CHECK/RPC/ACL and
unchanged business rows, and report the outcome. Any real account revocation must
name its intended target and remain separately authorized. Never force recovery
after authorization history exists; use a scoped forward repair.

## Application result — supersedes preparation-only closure

The owner subsequently authorized application with "hazlo de forma quirurgica".
`node scripts/apply-admin-revocation-release.js apply` completed successfully.
The runner checked the exact migration and recovery hashes against the passing
23-check isolated evidence, verified all 46 captured live function definitions
and ACLs, confirmed the prior CHECK and absence of the migration/state table,
then installed the unchanged SQL with migration tracking in one transaction.

The transaction asserted equal before/after fingerprints for all eleven checked
tables before committing: 338 Auth accounts, 976 affiliates, 8 admin assignments,
3 roles, 66 role permissions, 93 section responsibilities, 200 support sessions,
5,820 admin audit events, 788 identity audit events, 3,921 affiliate documents and
871 request documents. No real access was revoked, granted or otherwise modified.
Only the reviewed CHECK/RPC, protected recovery metadata and migration tracking
were installed. No frontend publication or unrelated change was included.

Independent read-back at `2026-09-24T15:15:23.079Z` confirmed:

- Migration SHA-256 `14b95208f648e178b3ba1fe2209a31b85901d631133dcfd679b88c98deb8a64d`.
- Installed CHECK MD5 `84bd913504580b5c06407738655e3c9a`.
- Installed revoke RPC MD5 `5f2df81496993a2885ecc26c3e1eba75`.
- All 46 function OIDs/owners/ACLs retained; all other function definitions retained.
- Exact migration source stored in tracking, one protected recovery record, forced
  RLS, and no recovery table SELECT/write privileges for anon/authenticated/service_role.
- Zero role permissions outside the assignment CHECK.

The installed function is the exact isolated/browser-tested definition. A live
account revocation was deliberately not used as a deployment test: no target was
authorized. No no-use recovery was executed after installation. Future authorized
revocations preserve historical rows, and post-use repair must respect recovery guards.

Navigator: architecture was already indexed from this exact SQL before application.
No new structural implementation was introduced in this continuation. Freshness is
now STALE only for deployment audit/evidence/changelog and the application runner;
direct SQL/hash/read-back verification remains authoritative. No false FRESH marker
or unnecessary structural regeneration was written.

H-ADMIN-REVOCATION-001 RESULT
Status: PASS — APPLIED / VERIFIED.
Files changed in this continuation: application runner, this audit, AGENT_CHANGELOG,
application-preflight.json, application-applied.json, application-verified.json.
Source-of-truth verdict: SAFE; existing administrative authorities retained.
Invariant verdict: PASS; before/after equality across eleven tables, protected guards retained.
Build: NOT APPLICABLE to backend-only application; prior focal build PASS, same SQL hashes.
Tests: 23 prior isolated checks remain applicable; live baseline/application/read-back PASS.
Security: OID/owner/ACL retained; no privilege expansion, recovery forced RLS/API denial PASS.
Legacy impact: none; no financial/Google writers, calculations or records changed.
Unexpected files changed: none; preexisting local frontend/other work left intact.
Known limitations: no live-account revocation performed; no multi-connection load test;
no frontend publication; no-use recovery only. Existing tested reader/writer signature unchanged.
Evidence: `docs/qa/evidence/admin-revocation-20260924/application-{preflight,applied,verified}.json`.

SUTIAPP ARCHITECT REVIEW
Task: owner-authorized application of the exact prepared H-ADMIN-REVOCATION-001 SQL.
Verdict: APPROVED.
Critical findings: installed CHECK/RPC match independently derived canonical hashes;
tracking matches exact source; eleven business/history tables unchanged in installation.
Source of truth: retained. Architecture: same previously reviewed migration.
Security: unchanged caller grants, enforced backup isolation. Data: preserved.
Legacy: unchanged. Owner decision: NO for this completed application.
Next action: owner can use Revocar on the intended administrator in the existing panel.
Response generated for Codex: YES.

RESPONSE TO CODEX: Close the authorized installation as PASS. Do not revoke any real
account, publish unrelated frontend work, reapply the migration or force recovery.
Report the installed correction and evidence. Any later requested account operation
must identify its intended target and use the canonical administrative workflow.
