# ARCHITECT REVIEW

Task reviewed: H-ADMIN-REQUEST-DELETE-001
Verdict: APPROVED

What Codex did correctly: preserved the existing modal and approval callbacks, added backend-gated
deletion with explicit confirmation, retained the affiliate dossier and shared files, and removed
only the verified request register in Google A:AG. No production request was deleted during QA.

Important findings: all current request attachments reference dossier documents/assets; physical
file removal would violate the owner's instruction. SQL therefore removes request links only.
Google row numbers are locators, never identity. Delayed sync/handoff is rejected by the tombstone.
The private journal retains full recovery/history, never serves UI fallback, and denies browser reads.

Problems detected and resolved: concurrent parent/outbox updates reproduced a deadlock in the initial
child guard. Migration 20260908000401 removes the redundant parent lock only for existing unchanged
outbox identities; prepare already takes that outbox row lock. Baseline conflict, exact recovery,
full deletion matrix and conflict-free concurrent rollback transactions are evidenced in lock-*.json.
Local SRI/origin test setup was corrected without changing vendor files, Auth or document policies.

Architecture implications: one focal repository and Edge coordinate canonical RPCs; no duplicate
workflow, source or shared image implementation. Bundle module comparison proves only the Admin
Finance screen and new deletion repository changed; SW/HTML changes are version values only.
The derived registry is updated for the new repository/Edge/table/RPC/guards and has no runtime role.

Source-of-truth implications: program_requests/request_documents remain canonical. The journal is
private audit and recovery evidence; dossier authority remains affiliate_documents/files/assets.
ADR-108 explicitly permits removal of operational request history while retaining it privately.

Security implications: verified Auth, program_requests.write, forced RLS, service-only finalization,
server-derived coordinates, permission negatives, source secret scan and preserved existing grants.
Data implications: exact preservation hashes and typed snapshots in rollback-only SQL tests;
Google backup precedes clear, Google confirmation precedes SQL DELETE, retries are idempotent.
Legacy implications: same authenticated receiver; only matched A:AG content cleared, no row shift,
AH+ writes, financial scripts, payments, calculations, balances or reconciliation.

Evidence inspected: scope-build.json; sql-dry-run/sql-apply; lock-before/dry-run/apply/after;
google-tests/deploy; edge-tests/compile/deploy; bridge-regression; isolated-browser and synthetic
desktop/mobile screenshots; backend-live; modal-live/local_candidate and production;
public-artifact; workspace-preservation. Public runtime commit: 740767a; Pages run: 34277616430.

Limits: no destructive production E2E against an existing request. End-to-end components are tested
with isolated GAS/Edge/browser fixtures and real rollback SQL; production preview is cancelled.
Unverifiable legacy identities and dependent quotations fail closed. Pending deletion requires retry;
private audit remains intentionally retained. WORK_QUEUE governs a separate master plan;
WORK_QUEUE_HISTORY is absent. No unrelated phase or task is authorized by this review.

Owner decision required: NO
Recommended next action: record final evidence/registry, push the closure and stop this H.

# RESPONSE TO CODEX

Approve H-ADMIN-REQUEST-DELETE-001. Publish only the reviewed lock-order refinement and final
evidence/derived registry, verify the final Pages run and unchanged public runtime hashes, then stop.
Do not delete any production request as a test or advance to another H.

SUTIAPP ARCHITECT REVIEW

Task: H-ADMIN-REQUEST-DELETE-001
Verdict: APPROVED
Critical findings: initial lock inversion resolved and verified; no open critical finding.
Source of truth: PASS
Architecture: PASS
Security: PASS
Data: PASS
Legacy: PASS within explicit owner-authorized deletion scope
Owner decision: NO
Next action: final evidence push and stop; no automatic continuation to another task.
Response generated for Codex: YES
