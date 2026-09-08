# SUTIAPP ARCHITECT REVIEW

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
