# H-REQUESTS-GOOGLE-REGISTER-FORMAT-001

## PRE-CHANGE AUDIT — PASS

Objective: owner-requested Google Historial de solicitudes presentation: A canonical SR folio, J dd/MM/yyyy, Y exact Aprobado. AH onward excluded.
Authority: program_requests.folio and original creation timestamp; immutable UUID/initial_row/hash and canonical workflow states remain unchanged. Google remains a derived register with subsequent legacy processing preserved.
Scope/files: financial-legacy/request-google-sync.js; financial-handoff/Code.gs; focused bridge fixture/test and format release/correction scripts; financial-handoff/README.md; this audit and evidence/register-format-20260908; additive current-contract notes in SOURCE_OF_TRUTH, INVARIANTS, DECISIONS, LEGACY_GOOGLE_SYSTEMS, AGENT_CHANGELOG; architecture registry only if structural change requires it.
External writes: same Apps Script deployment and Edge function; exact proven target A/J cells, uppercase APROBADO cells only, J number format, technical registry M folio metadata. No SQL/data/workflow/permission/frontend mutation.
Reads: metadata and bounded A/J/Y, target A:AG for identity verification, technical registry A:P, read-only canonical UUID/folio/outbox lookup.
Risks: raw UUID/ISO are immutable transport and hash inputs; changing them would break retries. Preserve them and transform only visible cells. Native date serial preserves original ISO calendar day. Do not reset later Google states such as Iniciado. Protect formulas, checkbox validation, unrelated cells.
Live finding: target now has 2319 rows; nine prior QA rows are absent, three real rows moved from 2326..2328 to 2317..2319; two A values became numeric and Y became Iniciado. No reconstruction/deletion authorized. Existing immutable outbox row references are stale; their fail-closed relocation behavior is outside this presentation correction. Identify surviving rows using exact UUID or unique immutable timestamp plus control and captured fields before correcting A.
Tests: isolated actual GAS V1/V2, raw hash persistence, date/leap-day validation, title-case status, duplicate/identity/formula rejection, retry and stale delivery, boundary A:AG. Compile Edge only, deployment source readback, exact Google cells/format readback and unrelated A:AG comparison. No global suites or frontend build.
Recovery: private current GAS/Edge and cell snapshots in C:/tmp/sutiapp-register-format-backup-20260908; precise rollback requests before cell writes. Restore same deployment version/Edge source only if needed; never erase history.
Legacy classification: SAFE CHANGE within owner-authorized presentation fields after identity and formula verification. No financial calculations, formulas, triggers, amounts, terms, documents, or other modules changed.

## PLAN

1. Preserve raw REQUEST_REGISTER_V1 row; introduce versioned folio presentation envelope compatible with existing deliveries.
2. Validate against actual GAS with isolated sheet fixtures; prepare current production backups.
3. Deploy same receiver and Edge, correct existing exact cells, verify independently.
4. Record focal evidence, review, commit/push and stop.

## H-REQUESTS-GOOGLE-REGISTER-FORMAT-001 RESULT

Status: PASS (requested presentation scope).
Files changed: two runtime files (request-google-sync.js and Code.gs), bridge test fixture,
five scoped release/test/verification scripts, Google README, five governance addenda, this audit,
focal evidence and derived architecture registry. No frontend/generated app bundle changes.
Source-of-truth verdict: SAFE; canonical program_requests.folio, original timestamp, unchanged UUID/hash/outbox.
Invariant verdict: PASS; owner clarification supersedes only visible UUID/ISO/uppercase approval.
Build: Edge bundle-only compile PASS, production receiver14/Edge41 source readback PASS.
Tests: 9 existing bridge scenarios, 5 format scenarios and 4 delivery assertions PASS; live cells/native
format readback PASS; unauthenticated Edge401 and authenticated Google invalid-secret rejection PASS.
Security: same authentication, deployment, JWT verification, secret names and backend authorization;
no credentials committed or printed, no SQL/RLS/grant changes.
Legacy impact: three A values corrected, three J ISO strings converted preserving calendar day;
J2:J2319 number format updated; registry M adds folio to three existing records. Y had zero exact
APROBADO values at correction time; writer emits Aprobado for future approvals. Iniciado preserved.
AH+: zero reads/writes by correction; receiver boundary protected by isolated tests.
Unexpected files changed: none in isolated release worktree; unrelated primary workspace preserved.
Known limitations: existing row relocation (2326..2328 → 2317..2319) and nine absent QA rows invalidate
immutable transport references. No references repaired, requests recreated or statuses reset here.
Future updates of those relocated requests remain subject to the existing fail-closed reference check;
this is a preexisting transport issue, not a claim of complete synchronization health.
Evidence: docs/qa/evidence/register-format-20260908/{format-tests,bridge-tests,delivery-tests,backup,
edge-compile,google-deploy,edge-deploy,deployment-readback,correction-plan,live-readback}.json.
Recovery: private cell snapshots and exact rollback requests; receiver13 and Edge40 bodies backed up.
Edge40 drift audit: source-map index.ts and both JS modules extracted from ESZIP and matched baseline
sources exactly; deployment version increased since prior H without a runtime source difference.
Frontend build/UI/image regression: NOT APPLICABLE; no frontend, shared asset/routing/Auth code changed.
Global suites: not run, per owner focal-validation constraint.
