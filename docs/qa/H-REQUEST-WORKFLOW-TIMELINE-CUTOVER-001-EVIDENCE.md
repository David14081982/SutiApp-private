# H-REQUEST-WORKFLOW-TIMELINE-CUTOVER-001 — Evidence

Date: 2026-08-30
Scope: connect Admin → Finanzas → Etapas y seguimiento to the real timeline shown after submission, in Mi Historial and in Admin request details.

## Audit and authority

- Initial live inventory: 0 workflows, 0 workflow stages, 0 tracking rows, 6 existing controlled `program_requests`, 8 `request_documents`, and 0 requests outside H005_TEST/H005_TEST2/H005_TEST3.
- Root cause: the Admin editor read empty Supabase tables while request success/history used independent hardcoded arrays. Therefore Admin changes governed no real timeline.
- Unique authorities after cutover:
  - current definitions: `operational_workflows` + `operational_workflow_stages`;
  - immutable historical definition: `program_requests.workflow_snapshot` + `workflow_version`;
  - dated facts: `operational_request_tracking`;
  - shared projection: `resolve_program_request_workflow_state()`.
- Google Sheets, Apps Script, financial rules, rates, funds, eligibility, amortization and reconciliation were excluded. Recorded interaction: Google reads 0, writes 0.

## Risk controls

- Additive/versioned migration with a guarded recovery script.
- Exactly one workflow must resolve before insert; missing or ambiguous mappings fail closed.
- Existing requests were backfilled only with workflow metadata/snapshot and an initial tracking fact; original request and document rows were not rewritten.
- Workflow snapshots are immutable. Admin edits increment the live version and affect only future requests.
- Stage/workflow physical delete is revoked; retirement is reversible and ordering is atomic.
- RLS/RPC derive the self affiliate server-side. Normal users cannot enumerate workflow tables; Admin requires `workflow.read/write`.
- Durable audit records actor real, reason and before/after data.

## Migration and live certification

Artifacts:

- `supabase/migrations/20260830000400_request_workflow_timeline_cutover.sql`
- `supabase/recovery/20260830000400_request_workflow_timeline_cutover_recovery.sql`
- `supabase/migrations/20260830000410_harden_request_workflow_assignment.sql`
- `supabase/recovery/20260830000410_harden_request_workflow_assignment_recovery.sql`
- `scripts/apply-request-workflow-timeline-cutover.js`
- `scripts/audit-request-workflow-timeline-live.js`
- `scripts/test-request-workflow-timeline-live.js`

Forward dry-run, recovery dry-run and live apply: `PASS`. The follow-up assignment hardening also passed forward/recovery dry-run and live apply; Admin cannot publish two enabled workflows for the same context.

Final live result:

```json
{"status":"PASS","workflows":4,"stages":20,"requests":6,"snapshots":6,"tracking":6,"outsideControlled":0,"requestDocumentsUnchanged":8,"anonymousDenied":true,"regularWorkflowRls":true,"adminProjection":true,"browserAdminAudit":true,"immutableSnapshots":true,"oldRequestsPreserved":true,"piiPrinted":false,"googleReads":0,"googleWrites":0}
```

## UI and E2E

The shared success screen retains real folio, confirmed amount when applicable, full-screen WOW treatment, 42 confetti pieces when motion is allowed, `Seguir mi solicitud` to Historial and `Volver al inicio`. It receives the server workflow projection; no hardcoded stage authority remains.

Principal Chrome flow at 1280×900:

1. Admin UI changed a real loan-stage description.
2. The app submitted a real loan through the productive Edge path (exactly one HTTP 200).
3. Success displayed the edited marker and a real folio.
4. Historial displayed the same snapshot.
5. Admin UI restored the definition.
6. The already-created request continued displaying its original marker, proving snapshot immutability.
7. The exact QA request was removed and live counts returned to baseline.

Result: `docs/qa/evidence/request-submission-e2e/latest-result.json` = `PASS`; Admin edit/restore audit present; cardinality matrix 3/4/6/8/10 stages and long text `PASS`; Google writes 0; no PII printed.

Responsive evidence:

- 390×844, motion: `PASS`, confetti 42.
- 430×932, reduced motion: `PASS`, confetti 0 by accessibility policy.
- 768×1024 tablet: `PASS`, confetti 42.
- 1280×900 desktop: `PASS`, confetti 42.

Screenshots are under `docs/qa/evidence/request-submission-e2e/` for Success and Historial at each viewport. They were visually inspected for overflow, fixed CTA, scroll and contract preservation.

## Build and regression

- Bundle rebuilt deterministically from 92 sources.
- `node --check app/bundle.js`: `PASS`.
- Bundle SHA-256: `21BB789599B6CCAE14C09FC019F64916E42EFF5DAC563BF0B866DE8C08D3C47A`.
- `node scripts/test-request-workflow-timeline-cutover.js`: `PASS`; hardcoded stage authorities 0, productive request mocks 0, localStorage fallbacks 0, service-role frontend 0, confetti pieces 42, Google reads/writes 0.
- `node scripts/test-static-suite.js`: 64/64 `PASS`.
- `git diff --check`: `PASS`.
- `git diff -- google-apps-script`: empty.

## Recovery and limitations

The recovery dry-run restores the predecessor without deleting historical requests. Once incompatible post-cutover history exists, recovery intentionally fails closed. Financial processing after approval remains under its existing protected legacy boundary and was neither invoked nor changed.

## Owner result matrix

```text
Current requests classified as test: 6/6
Non-test requests discovered: 0
Test requests normalized: 6
Test requests deleted: 0
Real user/document data modified: NO
Existing Admin workflow authority reused: YES
Duplicate workflow authority created: 0
Workflows / stages: 4 / 20
Workflow versioning: PASS
Request workflow snapshot/version: PASS
New request workflow assignment: PASS
Current/completed/pending stage resolver: PASS
Admin edit name/description/responsibility/estimated time: PASS
Admin reorder/add/deactivate/preview: PASS
workflow.write: ENFORCED
Admin audit: PASS
operations-store / Historial / Success hardcoded stage authority: 0 / 0 / 0
Success timeline dynamic / Historial timeline dynamic: PASS / PASS
Success/History same authority: YES
Loan / membership / program / product / benefit / quote: PASS
Legacy requests fallback: N/A — controlled unavailable state, no fallback
Historical real request reinterpretation: 0
Submission / folio / confetti / follow-my-request regressions: PASS
Unified Document Phase regression: PASS
History self-service / cross-user / anonymous / Admin / impersonation security: PASS
Long text and 3/4/6/8/10-stage rendering: PASS
Mobile 390 / mobile 430 / tablet 768 / desktop: PASS
Performance: PASS — history receives batch workflow_state; no per-row workflow fetch
Static suite / browser E2E: PASS / PASS
Google reads / writes / Apps Script changes / financial rules changed: 0 / 0 / 0 / 0
Data loss / unexpected files: 0 / 0
Architecture Registry: FRESH / UPDATED
Owner decisions remaining: none
Final verdict: PASS
```
