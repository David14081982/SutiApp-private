# H-ADMIN-FINANCIAL-REQUESTS-WORKBENCH-001 — Evidence

Date: 2026-08-26
Status: **PASS**

## Scope and authority

- Scope: `Admin → Finanzas → Solicitudes`, desktop workbench plus preservation of the existing mobile branch.
- Request authority: Supabase `program_requests`, immutable `financial_submission_snapshot` and `financial_approval_snapshot`.
- Read boundary: the applied least-privilege RPCs `list_admin_financial_request_queue`, `get_admin_financial_request_detail` and `list_admin_financial_requests_mobile`.
- Financial rules authority: existing Google/Edge contracts; unchanged and blocked from this read-only certification.
- Documents: `request_documents` and existing private Document Workflow; signed preview on demand.
- Terms: linked `program_terms_versions`; no reinterpretation with a newer version.
- Existing actions: `update_program_request` RPC and `financial-legacy` approve/handoff. They were statically verified but not mutated because the owner authorization for this cutover is read-only.
- Bulk and per-request ownership: `BULK_NOT_AUTHORIZED`; no ownership authority exists for this financial queue.

## Applied read model

The owner explicitly authorized applying and certifying `supabase/migrations/20260826000200_admin_financial_requests_read_model.sql`. The controlled harness produced:

```text
Migration dry run: PASS — persistent_changes=0
Recovery dry run: PASS — persistent_changes=0
Apply: PASS — protected_rows_changed=0
Final status: PASS
Queue/detail/mobile RPC present: 3/3
Authenticated execute grants: 3/3
Anonymous execute grants: 0/3
Direct requested_amount/submission_snapshot/approval_snapshot grants: 0/3
```

The migration creates no table, column, trigger, writer or business row. Recovery revokes only the three authenticated grants and drops only the three functions. No production recovery was executed after the successful cutover; its transaction-scoped dry run verified the recovery path without persistent changes.

## Browser and responsive evidence

Real Chrome loaded three live financial requests through the applied RPC boundary. The test covered search, status/program/stage/age/date filters, order, selection, persistent lazy detail, previous/next, keyboard navigation and refresh. It also proved:

- 1024: compact two-panel workbench, three queue columns, no horizontal overflow.
- 1280: two-panel workbench with six filter columns and compact queue, no horizontal overflow.
- 1440: full comparative queue columns and persistent detail, no horizontal overflow.
- 430×932: existing sequential cards, tabs and bottom navigation; desktop workbench absent.
- Queue metadata loads once; detail/documents load for the selected request; no financial N+1 and no 50-document eager load.
- Legacy live rows without a stored financial snapshot render `Snapshot contractual no disponible`; they are never recalculated with current rules.
- Screenshots mask names, control numbers, folios, request cards, snapshots and financial amounts.

Machine evidence: `docs/qa/evidence/admin-financial-requests-workbench-20260826/playwright-result.json` and the four masked PNG files in that directory.

## Security matrix

```text
Super Admin / program_requests.read: ALLOWED
Authorized finance Admin: ALLOWED by program_requests.read capability
Authenticated user without capability: DENIED live on queue/detail/mobile RPCs
Unauthorized Admin: DENIED by the same backend capability gate
Anonymous: DENIED live on queue/detail/mobile RPCs
Cross-user direct read: DENIED by RLS
Admin direct financial table columns: DENIED
Read-model RPC INSERT/UPDATE/DELETE: 0
Browser writes during certification: 0
```

There is no distinct financial-responsible authority in the current domain, so no responsible role or ownership UI was invented. The live normal-user denial exercises the same backend `has_admin_permission('program_requests.read')` branch that denies any Admin assignment without that capability.

## Mutation and legacy audit

- Supabase business-row writes: 0.
- Financial fixtures created/restored: 0 / 0; cleanup `NOT_APPLICABLE_READ_ONLY`.
- Background `financial-legacy` bootstrap calls: intercepted and aborted by the test harness.
- Google interactive reads introduced by the workbench: 0.
- Google writes: 0.
- Apps Script changes/writes: 0.
- Financial formulas, criteria, rates, simulator, personalized snapshots, approval snapshots and final validation changes: 0.
- Browser `pageerror`: 0. Console denials are expected fail-closed signals from negative-role checks and the deliberately blocked legacy bootstrap; the Admin shell regression reports `exceptions: []`.

## Verification

```text
Bundle build: PASS — 90 source files
Bundle syntax: PASS
Financial workbench static contract: PASS
Static suite: PASS — 47/47
Financial workbench Chrome: PASS
Admin Desktop Shell Chrome regression: PASS — 0 productive writes, 0 exceptions
Visual inspection 430/1024/1280/1440: PASS
Architecture Registry: UPDATED / FRESH
```

## Result matrix

```text
ADMIN FINANCIAL REQUESTS WORKBENCH RESULT

Desktop queue: PASS
Shared queue components: NOT_APPLICABLE — local approved workbench components
Search: PASS
Status filter: PASS
Program filter: PASS
Stage filter: PASS
Age/date filters: PASS
Detail panel: PASS
Financial snapshot display: PASS — stored values only; controlled unavailable state on legacy rows
Historical values immutable: PASS
Timeline: PASS
Documents: PASS
Terms acceptance: PASS
Previous/next: PASS
Keyboard: PASS
Inline feedback: PASS — static contract; no unauthorized mutation
Safe action persistence: NOT_LIVE_MUTATED — outside read-only cutover authorization
Frontend History reflection: N/A_NO_CONTROLLED_OWNER_FINANCIAL_ROW
Safe bulk: NOT_AUTHORIZED
Technical IDs primary: 0
Google interactive reads introduced: 0
Google writes: 0
Apps Script changes: 0
Financial formulas changed: NO
Financial rules changed: NO
Cross-user: DENIED
Normal user: DENIED
Unauthorized Admin: DENIED by backend capability gate
Anonymous: DENIED
Direct financial table access: 0
Read-model writes: 0
Mobile preserved: PASS
1024: PASS
1280: PASS
1440: PASS
Unexpected writes: 0
Fixture cleanup: PASS — no fixture created
Migration dry run: PASS
Recovery dry run: PASS
Migration apply/status: PASS
Playwright: PASS
Static suite: PASS — 47/47
Regression — Requests Workbench: PASS
Regression — Documents Workbench: PASS
Regression — Admin Shell: PASS
Regression — Loan Simulator/snapshots: PASS
Architecture Registry: UPDATED / FRESH
Final verdict: PASS
```
