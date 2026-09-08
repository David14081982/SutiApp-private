# H-REQUESTS-WORKFLOW-HISTORY-GOOGLE-SYNC-001

## PRE-CHANGE AUDIT — 2026-09-08

Owner authorizes a surgical correction of request creation, Admin actions, persisted workflow/tracking,
self history/timeline and the existing Google bridge, including focused validation, publish and production check.
The explicit new contract supersedes approval-only append restrictions only for this request projection:
Supabase first, real request UUID in A, PENDIENTE on creation, APROBADO on approval, Rechazado on rejection/cancel.
All other available fields must use their actual header meaning; absent facts remain empty.

Baseline: 435fc47, isolated worktree. Main workspace contains unrelated uncommitted work and is not the release.
Navigator: registry stale only for prior modal UI/generated evidence; inspected actual request repository,
financial Edge, workflow SQL, operations store and bridge directly. Structural registry update after changes.

Declared scope (edit only when the targeted investigation demonstrates need):
- app/program-request-repository.js; app/financial-legacy-repository.js; app/operations-store.jsx;
  app/screens-historial.jsx; app/screens-admin-finanzas.jsx.
- supabase/functions/financial-legacy/index.ts and a focused helper within that function for request export.
- Existing google-apps-script/financial-handoff/Code.gs and its README.
- One focused migration/recovery pair for workflow/transition/tracking and durable request export as needed.
- Focused audit/apply/deploy/test scripts named for requests-workflow-google-sync.
- Generated bundle/version references; architecture registry derived artifacts only for changed dependencies.
- This evidence, docs/AGENT_CHANGELOG.md, SOURCE_OF_TRUTH.md, INVARIANTS.md, LEGACY_GOOGLE_SYSTEMS.md,
  DECISIONS.md and docs/qa/evidence/requests-workflow-google-sync-20260908/.

Excluded: savings, amortization, disbursement execution, balances, criteria/rates/formulas, other Sheets/tabs,
document/security shared components, unrelated modules, global suites, fabricated timelines, historical rewrites.

Authority: program_requests + immutable workflow_snapshot + operational_request_tracking and admin events.
Google is a derived required register, never a workflow writer. Reuse the backend bridge and its lock/recovery.
Readers: Admin queue/detail, self history and timeline. Writers: authenticated existing repositories/RPCs,
service-only financial confirmation/approval and server-to-server bridge. Real actor/context preserved.

Google target confirmed by connector metadata: SutiApp Final, spreadsheet
1Vxy84N7mzbuioTmWhjRD2QFboDx--rG3iUwmLuyeY80, Historial de solicitudes sheetId 10616270,
38 columns A:AL, frozen row 1. Exact headers read live. The initial AK/AL mapping question was resolved
by the later owner instruction excluding AH onward; those columns are outside the write contract.

Scope refinement before schema edits: add a transport-only `program_request_google_sync` outbox, RLS denied
to direct browser writes, scoped claim/finish/status RPCs, `pg_net` + `pg_cron` wakeup using Vault credentials,
and publish only program_requests events through the existing Realtime publication. This is durable delivery
for the same persisted request, not a second workflow. Existing financial_request_export_audit requires approval
identity and immutable approval hashes; reinterpreting it for pre-approval memberships would corrupt its meaning.
New exports reuse the existing Apps Script deployment, target sheet and technical lock/registry.
No historical request or financial snapshot is rewritten. Queues start only for new writes after activation;
explicit synchronization of an existing request may enqueue that ID under the owner-authorized contract.

Targeted findings: SR-2026-000121 MARK_IN_REVIEW is persisted; the immutable workflow maps submitted,
requires_financial_processing and in_review to the same review stage. Approval incorrectly passes generic
`prestamo` instead of the snapshot criterion's unique runtime id. Correcting that lookup passes the existing
approval writer in a rolled-back transaction. The self store never refreshed after first load and the tracking
route rendered params.s directly. Fix those consumers without manufacturing stages or changing configured flows.

Risks: old tracking overrides versus status, missing rejection stage in immutable old snapshots,
financial approval tied to obsolete imported-file prerequisites, retained self-history cache, export retries,
out-of-order Google status updates and duplicate rows. Inspect exact live evidence before changing.

Recovery: capture existing backend function definitions/deployed bridge source before modification;
transactional migration dry-run and rollback; revert frontend/Edge/bridge version. No deletion of historical rows.
Tests: focused per-family creation/review/advance/final approval/reject/cancel, persisted self projection,
Google A/Y and idempotency, actor/permission denial, browser UI refresh. No global suites, per owner instruction.

Focused test scope: loan, membership and an existing PAYROLL_QUOTE service use controlled QA inputs inside
a transaction that rolls back. No product/company change is committed. Sequence-generated folios may have
normal rollback gaps. This is candidate evidence, not a claim of production end-to-end delivery.

Scope refinement from concrete service test: `create_program_request` retains the obsolete legacy flag for
non-loan quote intents, incorrectly producing financial_processing_status=pending without a financial
submission. The current configured workflow already selects request:quote for those requests, and ADR-087 /
INV-150 define approved quotation before a separate financing request. Correct only that creation
classification and allow the existing transition RPC to approve such unfunded quote intents with an explicit
amount. Existing immutable workflow/profile/submission snapshots remain unchanged; only the obsolete pending
processing flag is cleared during the authorized quote approval. Real loan/product-payment approvals retain
their specialized writers. Before bodies and snapshot guards are in before-quote-functions.json.

Owner clarification, 2026-09-08: exclude AH and every later column. New registration writes only A:AG (33
columns); subsequent updates still write only Y. There is no AK/AL mapping decision left. The owner completed
Google's script authorization; the existing authenticated receiver now returns the expected JSON on a
no-write, invalid-secret probe. See release-backup.json; remote source/manifest match release baseline.

Runtime configuration refinement: the first retained QA request exposed stale server OAuth credentials,
then UNAUTHORIZED from the correct Google deployment. Refresh credentials were reconciled with the locally
authorized owner credentials, server-side only. Inspect/reconcile the existing shared secret through a
temporary owner-only Apps Script administrative deployment (MYSELF), restore HEAD immediately and delete
that temporary deployment in finally. No secret appears in source, logs, evidence or frontend. The existing
production receiver and its access level are preserved. If the Script Property is empty, initialize it with
a cryptographically random key and set the same existing Supabase secret; preserve any nonempty value.
The first owner-only read found no usable existing property. This is configuration repair,
not another workflow or data writer. Confirm an authenticated invalid-secret probe still fails afterward.

Status: implementation and focused live verification in progress. Both owner clarifications are resolved.

Live-validation scope refinement: the current frozen loan v16 maps approved to Authorization with outcome
process, whereas the older v13 snapshot used success. The existing tracking validator rejected this explicit
mapping (REQUEST_TRACKING_STATUS_MISMATCH). Add a second reversible migration for exactly the validator
and projection: permit approved on a process stage only when that same frozen stage explicitly references
approved; mark that approval stage done while leaving unperformed later deposit stages upcoming. No catalog,
snapshot, historical request or financial writer is edited. Validate the real controlled approval in ROLLBACK
before installing the two-function fix. Both migrations have independent before-function recovery.

## Focused verification

- `test-requests-workflow-google-sync-sql.js --installed`: 17 checks PASS on the installed backend,
  including real three-family creation/review/transitions, immutable snapshots, grants/unlinked identity,
  delivery leases and recovery inside ROLLBACK. No request writes from this suite commit.
- `audit-requests-workflow-google-sync-approval.js --controlled --tracking-migration`: real Edge reads,
  existing SQL approval writer and v16 projection PASS under ROLLBACK before the second migration.
- `test-requests-workflow-google-sync-bridge.js`: 9 checks PASS, duplicate/stale/crash recovery, exact A:AG/Y
  boundary, formulas protected and inherited unchecked checkbox handled only in an otherwise empty reserved row.
- `test-requests-workflow-google-sync-browser.js`: 20 checks PASS, current persisted projection, explicit
  rejection reason, foreground recovery, context switch/logout, error/retry, responsive History/Tracking.
- `test-requests-workflow-google-sync-admin.js`: 24 checks PASS, prior modal content preserved, callbacks
  unchanged except the authorized Google confirmation, keyboard/navigation/sticky controls and responsive layout.
- Real local modal acceptance: four existing request families, 71 image instances decoded, zero preview errors,
  zero Storage failures, fullscreen, X/Escape and 320/390/768/1024/1440 widths PASS. No business writes.
- `test-requests-workflow-google-sync-realtime-live.js review`: nine persisted reviews observed through real
  Realtime and real self RPC/store, 190–1456 ms after the event; three actual TrackingScreen components updated.
- `test-requests-workflow-google-sync-security-live.js`: anonymous summary/Edge, browser outbox/claim and
  invalid worker secret rejected with 401/403. Unlinked identity tested by installed SQL functions.

Recovery order: apply `20260908000200_request_snapshot_status_validation_recovery.sql`, then
`20260908000100_requests_workflow_google_sync_recovery.sql` if reverting the whole H. This stops the cron
and transport writes, restores prior function definitions and retains request/audit/Google/transport history.
Apps Script production deployment can be returned to version 9 from the private pre-change backup; Edge
version 36 metadata/ESZIP backup is retained outside the repo. No data deletion is part of recovery.
The temporary MYSELF configuration deployments were removed and project HEAD restored; production access
remains authenticated ANYONE / USER_DEPLOYING. Both SQL migrations are registered without reapplying them.

Build: 109 release sources, bundle 229 / worker 176. Shared worker logic is unchanged; version references are
generated release artifacts. The unrelated dirty main-workspace savings/H08 work is excluded from publication.
WORK_QUEUE remains an older master-plan checkpoint; this H is authorized directly by the later owner request
and ADR-105. No continuation to another H or Phase 8 is authorized. WORK_QUEUE_HISTORY.md is absent.

## Live acceptance — PASS

Three retained branches per family (approval, rejection, cancellation), folios SR-2026-000167–000175,
Google rows 2317–2325. `live-requests.json` identifies each real request and persisted action.

| Check | Loan | Membership | Distinct service workflow |
|---|---|---|---|
| Supabase creation and idempotency | PASS | PASS | PASS |
| Same UUID in Google A, initial Y=PENDIENTE | PASS | PASS | PASS |
| Review, audit, self history/timeline | PASS | PASS | PASS |
| Final approval / Y=APROBADO | PASS | PASS | PASS |
| Rejection and cancellation / Y=Rechazado | PASS | PASS | PASS |
| Automatic live frontend refresh | PASS | PASS | PASS |
| Duplicate Google rows | 0 | 0 | 0 |

Independent connector readback compared A:AL before review and after decisions: review changed no cells;
decisions changed only Y, same UUID, exactly one occurrence in A, all other compared values unchanged.
AH onward remain excluded from writing. `google-live-readback.json` stores only IDs/status/check results.
The service cancellation was delivered by the scheduled worker without calling Edge sync from the test;
`automaticCronDelivery=PASS`. No payment, amortization, catalog rewrite or historical deletion was performed.
The original reported request SR-2026-000121 was used for read/ROLLBACK diagnostics and was not approved by QA.

`closure-checks.json`: 109 release modules, exactly four altered bundle sections plus the separate financial
repository (cache version 11); no shared worker logic change, no unexpected file, no known secret exposure.
Both recovery scripts passed rollback validation. Mobile/tablet checks use Chromium viewport emulation.

```text
H-REQUESTS-WORKFLOW-HISTORY-GOOGLE-SYNC-001 RESULT
Status: PASS — focused implementation and live backend acceptance; production frontend verification follows publication
Files changed: exact scoped inventory in evidence/requests-workflow-google-sync-20260908/closure-checks.json
Source-of-truth verdict: PASS — Supabase request/snapshot/tracking/events; Google derived register only
Invariant verdict: PASS — immutable snapshots, existing specialized approvals, UUID idempotency, A:AG then Y
Build: PASS — 109 modules; bundle 229, worker 176, financial repository 11
Tests: PASS — 17 installed SQL, 9 bridge, 20 History/Tracking, 24 Admin, real nine-branch acceptance and modal
Security: PASS — RLS/grants and 401/403 denials; owner-only configuration; no browser secrets
Legacy impact: authorized register only; no calculations, criteria, balances, financial execution or AH+ writes
Unexpected files changed: 0
Known limitations: retained QA rows; responsive browser emulation, not physical-device testing
Evidence: docs/qa/evidence/requests-workflow-google-sync-20260908/
```

Architecture index regenerated from the isolated release and structurally inspected: outbox columns/RPCs,
both migrations, repositories and request consumers are present. Final freshness is explicitly STALE only
for the later HTML cache reference, recovery-test mode and closure/evidence documents/tests; none changes
runtime architecture. The unchanged generator's full global acceptance suite was not run (owner requests
focused validation). No claim of a FRESH final documentation fingerprint is made.
