# H-REQUESTS-GOOGLE-REFERENCE-RECONCILIATION-001

## PRE-CHANGE AUDIT — PASS

Owner explicitly authorizes reconciling synchronization references and continuing delivery. Scope:
Google receiver Code.gs; additive migration/recovery for finish_program_request_google_sync only;
focused receiver/SQL/live release tests and scripts; previous format test relocation expectation;
Google README; governance addenda (DECISIONS, INVARIANTS, SOURCE_OF_TRUTH, LEGACY_GOOGLE_SYSTEMS,
MIGRATION_RULES, AGENT_CHANGELOG); this audit/evidence/reference-reconciliation-20260908; derived registry.
No frontend, Edge source, workflow/approval states, calculations, documents, financial processing state,
RLS/grants, amounts, identity, or AH+ changes. Existing Edge41 already validates receiver identity/hash.

Authority: request UUID/folio and immutable initial_row in Supabase; Google actual row is a derived
locator verified by exact UUID or folio plus control/date and registry hash. Row number is not identity.
Writers: existing service-only finish RPC and existing authenticated Apps Script receiver/lock.
One-off reconciliation repairs 3 outbox row numbers, 2 existing request legacy_reference locators,
and 3 Google registry references. A fourth real request (SR-2026-000196) is already correctly at2320.
Nine prior QA rows are absent in Google: preserve source/history, label transport missing visibly,
never recreate rows or bind to another occupant. Re-read before application; no fixed-row assumptions.

Migration plan: retain same RPC signature/OID/grants; permit verified row relocation only for active
matching delivery lease, unchanged immutable payload and current revision; audit old/new row using
existing sensitive_change_audit. Repair equal-revision retry completion so it clears its lease and
records transport success/error without changing workflow. Stale leases cannot overwrite locators.
Receiver: unique identity lookup can supersede obsolete row locator; confirmed missing rows fail
closed, while unconfirmed empty reservations retain interruption recovery. Validate control/date/formulas
before metadata relocation. Status writes keep existing monotonic revision behavior.

External data: program_request_google_sync transport metadata, program_requests.legacy_reference only
where it equals the verified old locator, sensitive_change_audit append-only, Google technical registry
L (locator) and K/O/P (explicit missing errors). No target-sheet cell writes in one-off reconciliation.
Risk: stale replies, duplicate folios, missing rows, reused row positions and partial cross-system write.
Recovery: exact private source/registry snapshots, original RPC definition, receiver14 source/deployment
in C:/tmp/sutiapp-reference-reconcile-20260908; transaction guard and rollback dry run before apply.
Financial equivalence: all request fields except explicitly repaired locator compare identical; no
status transitions/financial processing triggered. Row correction audit contains UUID and locator only.
Tests: isolated actual GAS relocation/duplicate/missing/reservation cases; real SQL transaction with
ROLLBACK for lease/identity/security/audit; production metadata readback and equal-revision retry on an
existing real request. No new QA requests, business transitions or global suites.
Audit refinement before implementation: existing audit tables require a real non-null Auth user and
cannot represent the service worker without false attribution. Add one private append-only
program_request_google_reference_audit table, RLS forced, SELECT only for service_role, no browser grants;
the SECURITY DEFINER writer records WORKER, owner reconciliation records OWNER_RECONCILIATION.
Recovery restores previous RPC and retains audit history. This replaces the proposed use of
sensitive_change_audit; no human actor is invented or impersonated.
Legacy classification: SAFE CHANGE, expressly authorized technical references only.
Source-of-truth verdict: SAFE. Migration/security verdict: PASS subject to dry-run and current backup.

## RESULT — BLOCKED, not deployed

Status: BLOCKED by actual Supabase DB and REST UNHEALTHY. Repeated Management SQL544, including
SELECT1, prevented current RPC backup and live dry-run. No external writes have been attempted.
Files changed: Code.gs; migration/recovery20260908000300 candidates; receiver/local PostgreSQL/SQL
tests; release and plan scripts; prior format test relocation expectation; this audit/focal evidence.
Source-of-truth verdict: SAFE in candidate; canonical UUID/folio/initial_row remain unchanged.
Invariant verdict: PASS isolated; 3 moved locators, 9 missing QA rows, 1 already-correct locator identified.
Build: candidate function/table compiled in isolated PostgreSQL18; Apps Script executed in fixture.
Tests: 6 receiver scenarios + 9 existing bridge scenarios PASS; real local Postgres migration/recovery,
lease/immutability/security and business-field preservation PASS with ROLLBACK. Live dry-run BLOCKED.
Security: private audit table forced RLS/no browser grants; server-only RPC signature unchanged.
Legacy impact: production zero; candidate never recreates confirmed missing rows or resets Iniciado.
Unexpected files changed: none. No frontend/Edge or global regression changes.
Known limitations: production references remain unchanged until the database is reachable. No PASS,
commit/push/publication claim for this H. Existing prior format publication2253f10 remains current.
Evidence: receiver-tests.json, bridge-tests.json, local-sql-tests.json, availability-blocker.json.
Recovery: candidate old RPC from committed baseline verified locally; live definition comparison still
required. Exact one-off SQL and Google inverse plans prepared privately. Audit history never deleted.
Registry update: deferred until live baseline verification; no production architecture changed yet.
Next: restore Supabase availability (restart affects whole project, outside focal scope), run backup,
dry-run, apply-sql, deploy-google, fresh Google reread, exact registry/SQL reconciliation, live retry,
readback, governance/registry/evidence review, scoped commit/push and stop. No permission to widen
financial logic, delete/recreate rows or change business status is inferred.

## Owner direction — restart deferred

The owner explicitly states: "no reiniciaremos en este momento". Do not restart, pause/resume,
resize or otherwise cycle the Supabase project. The reference repair remains authorized and prepared;
resume its backup/dry-run/application only after connectivity recovers. A fresh read-only health
check still reports DB and REST UNHEALTHY. No external writes or restart were performed.
This direction supersedes the restart recommendation in the earlier review; do not ask again unless
the owner reopens that decision. No background monitoring or automatic restart is scheduled.

## Owner direction — commit and push authorized

The owner explicitly requests commit/push of the prepared work. Commit and push are authorized
while production application remains BLOCKED and unperformed. This does not authorize restart,
SQL application, Google deployment or unverified data changes. Project status ACTIVE_HEALTHY is
not a claim that every access path works: the observed blocker is repeated administrative SQL544
and DB/REST health-check failures. Preserve the prepared repair and its validation limits in Git.
