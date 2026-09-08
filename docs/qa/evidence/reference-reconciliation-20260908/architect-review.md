# SUTIAPP ARCHITECT REVIEW

## Final review after authorized application

Task reviewed: H-REQUESTS-GOOGLE-REFERENCE-RECONCILIATION-001.
Verdict: APPROVED.
What Codex did correctly: verified live backups and original RPC; tested migration/recovery against
actual PostgreSQL with ROLLBACK; verified identity before correcting only transport locators; deployed
GAS15 to the existing authenticated deployment; preserved every captured business field.
Important findings: 3 moved references, 9 absent prior QA targets, 1 already correct. Missing targets
retain source/history and explicit transport error; no recreated row. Their old reference is provenance,
not confirmation of a present target. Current SR-2026-000121/194/195/196 references are correct.
Problems detected: no unresolved defect in this authorized scope. WORK_QUEUE is historical master-plan
scope; its older GAS/Edge versions do not override later explicit owner instructions or live readback.
WORK_QUEUE_HISTORY.md is absent. No new phase/task is inferred or authorized by this review.
Architecture implications: one private provenance table, same finish RPC OID/signature/ACL, same receiver.
Source-of-truth implications: Supabase retains request identity/business/capture; row number is derived.
Security implications: live security-readback confirms forced RLS, denied browser access, service read-only
audit access and unchanged service-only RPC. No frontend secrets or permission changes.
Data implications: 13 business hashes unchanged except the 2 authorized legacy_reference values;
12 append-only provenance events. Exact target-sheet CellData unchanged after repair and real retry.
Legacy implications: 30 technical registry cells only; A/J formatting retained, Iniciado retained, no
duplicates/new requests, AH+ writes zero. No financial calculations, triggers or business transitions.
Verification: backup/sql-dry-run/reference-recovery-dry-run/sql-apply/google-deploy/references-apply/
sql-readback/google-readback/live-retry/retry-google-readback/security-readback/closure all PASS.
Native rendered spreadsheet inspection unavailable; CellData/format/validation equality used.
Owner decision required: NO.
Recommended next action: commit/push the reviewed scoped closure under existing owner authorization;
stop after publication verification. Do not apply another migration or advance to another H.

# RESPONSE TO CODEX

Approve this H. Preserve scope and private backups. Complete the derived registry verification and
scoped commit/push already authorized by the owner; report the 3 repaired references and 9 preserved
missing-target errors. Do not recreate rows or alter workflow/financial data. No next-H auto-advance.

SUTIAPP ARCHITECT REVIEW
Task: H-REQUESTS-GOOGLE-REFERENCE-RECONCILIATION-001
Verdict: APPROVED
Critical findings: no unresolved in-scope defect; missing historical QA targets deliberately retained.
Source of truth: SAFE; Architecture: same boundaries plus private provenance; Security: PASS live.
Data: PASS 13 business rows; Legacy: PASS exact cell equality and actual same-revision retry.
Owner decision: NO
Next action: scoped publication verification and stop.
Response generated for Codex: YES

## Historical review before connectivity recovered (superseded)

Task: H-REQUESTS-GOOGLE-REFERENCE-RECONCILIATION-001
Verdict: BLOCKED — external DB/REST unavailable, live baseline/validation inaccessible.

Candidate inspected against actual receiver/finish RPC diff, isolated GAS tests and PostgreSQL18
execution. Identity/folio/control/date/initial hash supersede positional assumptions; confirmed
missing rows fail closed; unconfirmed reservation recovery remains. SQL relocation requires a current
matching lease, immutable payload and records a private transport event. Equal-revision completion
clears retry lease without invoking business processing. No frontend or financial calculation change.

Production state: zero mutations by this H. Three moved references and nine missing QA rows still
require reconciliation. Supabase health API directly reports db and rest UNHEALTHY, independently of
the coarse ACTIVE_HEALTHY project label; repeated SQL544 also affects SELECT1. Do not declare PASS.

Source of truth: SAFE candidate. Architecture: one private transport audit table, same service-only RPC.
Security: local forced-RLS/grant checks pass; live backup/grant equality remains pending.
Data/legacy: exact privately backed-up locator plans, no target A:AG/AH+ writes, no row recreation.
Recovery: locally compiled candidate; exact live RPC recovery cannot be certified until DB returns.
Owner decision: YES only for a project-wide restart, which exceeds the focal authorized repair.
Next action: obtain restart authorization or resume when service recovers naturally; then complete
live backup, dry-run, reconciliation and evidence before committing/publishing. No global suites.

# OWNER DECISION REQUIRED

Decision: authorize restart of the unavailable Supabase project to restore database/REST connectivity.
Why: all productive validation and repair are blocked; restart affects all application modules.
Option A: authorize restart, verify health, then continue the prepared focal repair.
Option B: wait for service recovery and resume the same prepared repair without restart.
Recommendation: authorize one controlled restart after acknowledging the whole-project impact.
Response generated for Codex: NO (no unapproved restart or irreversible continuation).
