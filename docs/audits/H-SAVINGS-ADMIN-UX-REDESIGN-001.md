# H-SAVINGS-ADMIN-UX-REDESIGN-001

## Audit / authority / plan / risk

Base: `da46ae8`, clean worktree; architecture lookup `ahorro`: FRESH. Owner authorizes UI/information architecture and conditional production release; no backend/business changes.

Purpose: Administrar la situación de cada ahorrador, resolver solicitudes y controlar las operaciones generales del programa sin perder el contexto de la persona.

Scope: `app/savings-panel-admin.jsx`, `app/savings-runtime-admin.jsx`; required generated `app/bundle.js` and existing HTML cachebuster; this audit, `docs/AGENT_CHANGELOG.md`, architecture registry derived files if component dependencies change. Existing focal test scripts may be adapted to authorized navigation changes; no new permanent QA files. Temporary browser harnesses/output belong in TEMP. No migrations, repository/writer changes, Google, permissions, Auth, shared shell/viewer, Storage or service-worker logic.

Authority: current SOURCE_OF_TRUTH publication entry supersedes historical SHADOW descriptions. Canonical balances: Supabase savings_transactions through existing financial-account readers; plans: savings_enrollments/contribution plans; requests: savings_requests; reviews: savings_review_records/events; exceptions: savings_audit_events; publication: savings_publication_state. Historical Google records remain evidence. HISTORIAL P V2 remains the settlement loan guard authority through existing Edge transport. No alternative source/cache/fallback introduced.

Legacy classification: READ ONLY for inspection; no direct external reads/writes by this H. All financial command payloads, authorization capabilities, P0 confirmation/exception controls and readback remain existing. Security boundary: backend RPC/RLS; UI consumes can_create/can_review/can_settle/can_cancel/can_write/can_confirm. Exact textual Folio/UUID only; no name-based identity resolution.

Risk: losing access to hidden controls; routing requests to the wrong person; stale results/draft loss; extra queries. Mitigation: complete old/new map, exact-match ambiguity failures, retain search/filter/scroll, reuse forms, demand-load detail. Recovery: revert focal UI commit and regenerate its artifact; no data recovery necessary because QA cannot write production data.

Pre-change verdict: PASS within declared UI scope. No migration guardian needed (no SQL/schema generated or applied).

## Affiliate capabilities verified in source

| Capability / UI | Existing backend | Status / admin counterpart |
| --- | --- | --- |
| Balance, capital, yield, schedule / SavingsScreen | SavingsRepository self dashboard | Available according to publication; account certification/receipts |
| Join / SavingsJoinAccess + SavingsRequestForm JOIN | join context + self request writer | Backend eligibility; runtime request review |
| Change contribution / CHANGE_AMOUNT | self request writer | Backend availability; runtime review |
| Withdraw / WITHDRAW | self request writer | Backend availability; review/settlement + loan guard |
| Stop saving / TERMINATE | self request writer | Backend availability; review, separate from payout |
| History, withdrawals, requests | self projection + SavingsRequestHistory | Read; admin financial/review/request history |
| Beneficiaries / SavingsBeneficiariesExperience | versioned signed self beneficiary APIs | Self management; no new admin writer authorized |

Evidence: screens-savings.jsx:41–83; savings-request-form.jsx; savings-repository.js. No affiliate redesign.

## Current information architecture and inventory

| Existing function / location | Purpose, information/actions | Frequency (design inference) | New location |
| --- | --- | --- | --- |
| Cobranza | Period expected/received, zero-discount exceptions, open person/correct | High | Programa → Descuentos del periodo; person → discounts |
| Ahorradores + native accounts | Search/filter/page, identity, balance, contribution, previous/next | High | Ahorradores → expediente |
| Conciliación | Date-level bank comparison, amounts, explicit row selection/confirmation | High | Programa → Conciliar por fecha |
| Confirmar saldos | Batch review/preview/certification using existing functions | Occasional | Programa → Confirmación por lote |
| Retiros y cambios / folded runtime requests | JOIN, CHANGE_AMOUNT, WITHDRAW, TERMINATE, exceptional withdrawal; review/cancel/settle | High | Pendientes → solicitudes; same form in expediente |
| Retiros y cambios / imported requests | Historical corrections, status and observation | Low | Pendientes → archivo de solicitudes |
| Revisión | Identity/data incidents, mark reviewed/reopen | Medium | Pendientes → expedientes por revisar |
| Publication under Revisión | Preview readiness, exact confirmation/publish | Exceptional | Programa → Publicación |
| Reports under Cobranza | Date-range server totals and CSV | Medium | Programa → Reportes |
| Retiros y rendimientos + settings under Revisión | Windows, periods, rates, retirement and yield rules/overrides | Low/exceptional | Programa → Configuración |
| Accesos y datos anteriores | Existing access controls and read-only historical review | Exceptional | Programa → Accesos y archivo |
| Person corrections/review/audit | Exact identity, observation/history, discount corrections/reset | Contextual | Same expediente, disclosed sections |
| Person certification/receipts/projection | Account summary, correction, confirmation, retirement | Contextual | Same expediente → saldo y descuentos |
| P0 withdrawal/yield overrides | Permission-scoped existing exception forms | Exceptional | Request context / period configuration, unchanged |

Duplication: publication/settings were repeated navigation destinations; eliminate that duplicate primary entry. Review status, bank reconciliation and financial certification are distinct operations, not interchangeable states. Batch confirmation remains a collective task. Historical requests never authorize new requests.

Proposed primary destinations: Ahorradores / Pendientes / Programa. A prominent search opens existing account records; requests use the same command form in their person context. New JOIN requests remain visible before a saver has an account. Backend supplies statuses/counts; no invented KPI or financial calculation.

## Verification plan

Reuse runtime, certification, access, reference-panel and self-service browser tests with isolated data and blocked network. Adapt navigation assertions only where authorized redesign changed them. Representative 1440/768/390 widths; focus/overflow, empty/error, search/return context, new JOIN request visibility, exact-identity ambiguity, existing P0 actions and permission gating. Build from sources; compare bundle chunks to base. Generated-only changes do not trigger global image regression. Production checks read-only; never approve or settle a real request for QA.

## Result

Candidate implementation / focal verification: PASS. Production deployment remains pending at this checkpoint.

- Reference-panel browser regression: PASS at 390/768/1440, preserving paginated search, keyboard entry, previous/next, corrections/reset, review/reopen, imported requests, error/retry and return context.
- Certification browser regression: PASS at 320/430/1440: exact participant/enrollment, source conflict, invalidated preview, confirmed zero vs blank, future receipts blocked, projection/readback, idempotency, native accounts and read-only capabilities.
- Runtime browser regression: PASS: original operation commands, P0 withdrawal checks/exceptions/revocation, yield exception permissions, scope, justification, confirmation, retries, CSV and publication.
- Control-access browser regression: PASS on source and bundle: windows/rates, individual/global scopes, Escape and read-only controls.
- Temporary request-context harness reusing reference-panel fixtures: PASS at 390/768/1440: JOIN visible before account creation, filter preserved on return, request-state readback, existing dossier route, ambiguous exact Folio rejected, three text scales; no production writes.
- Existing Admin access browser regression: PASS. Its two overwritten tracked evidence artifacts were restored byte-for-byte/checkout line endings; no new evidence in that directory.
- Affiliate JOIN regression: original test has a pre-existing obsolete assertion expecting a disabled join CTA after submission; current unchanged source returns a pending-request section instead. A TEMP copy checking unavailable-or-disabled passed the remaining complete flow (preview, retry identity, history, closed intake, responsive). No affiliate code/test changed.
- Public build: PASS using build-bundle.js with Babel 7.28.4. Two already-compiled unrelated source modules were emitted directly from their current source to preserve the established representation. All 129 modules were generated from source; only savings-panel-admin.jsx and savings-runtime-admin.jsx differ from base, 127 unrelated chunks byte-identical. SutiApp.html changes only v270 → v271.
- Five command.run ASTs in runtime are identical before/after; financial writers, repositories, backend, schema, Auth/RLS, settlement Edge, yield and certification modules are unchanged.
- Actual session on production baseline: PASS, 7 JOIN requests awaiting review, no writes.
- Actual session against local public artifact: PASS, three destinations, JOIN filter, exact-Folio search, dossier/account/requests readers, no page errors, zero blocked/attempted financial writes. TEMP vendor files normalized to Linux LF and verified against all three unchanged SRI hashes, matching Pages checkout; no repository/vendor change.
- Visual evidence: exactly three synthetic captures in `%TEMP%/sutiapp-savings-redesign/visual` (main desktop, record desktop/mobile). No PII screenshots.

FUNCTIONALITY LOST: 0 mapped existing functions. UNMAPPED OLD FUNCTIONS: 0. DUPLICATED PRIMARY WORKFLOWS: 0 (inbox opens the same request component; batch operations remain collective).
BACKEND / SCHEMA / FINANCIAL RULES / PERMISSIONS CHANGED: NO.
GLOBAL REGRESSION: NOT REQUIRED, focal components plus GENERATED_ARTIFACT only.
PERMANENT QA FILES ADDED: 0. QA RESIDUAL DATA: 0. TEMPORARY TEST FILES IN REPO: 0.

Known limits: existing runtime reader returns at most 500 requests; counters explicitly refer to the current query. Physical devices were not used. Beneficiary management remains the existing signed affiliate workflow; no new admin action. Exact-Folio ambiguity stays fail-closed. No production financial mutation is used as a test.

### Guardian / architect review

Source of truth: SAFE; invariant/security/legacy: PASS for this UI diff. Claude preservation: authorized redesign, all existing actions mapped and reachable; no unauthorized screen changes. Work queue/history: current owner instruction authorizes this H; WORK_QUEUE_HISTORY.md is absent. Historical SHADOW/P0 preparation text is superseded by the explicit publication and receiver-completion entries and this owner's scope. No authority decision is introduced.

Architect verdict for the release candidate: APPROVED. Direct diff, command AST comparison, isolated browser evidence and authenticated read-only local artifact support the result. Next instruction: publish only this reviewed scope, verify the deployed artifact and authenticated Admin Ahorro read-only, record outcome, and stop; do not start another H. Production closure is conditional on that verification.

File classifications: PRODUCT_CODE = two savings UI modules; GENERATED_REQUIRED = bundle, HTML cachebuster and derived architecture index partitions; REQUIRED_TEST = three updated existing browser regressions; REQUIRED_DOCUMENTATION = this audit and AGENT_CHANGELOG. TEMPORARY = external TEMP harnesses/artifact/captures only.

Scope update: existing scripts/test-savings-control-access-browser.js and scripts/test-savings-certification-browser.js require navigation assertions to follow Programa and contextual sections. Financial assertions stay intact. No new permanent test.

Scope update before edit: scripts/test-savings-reference-panel-browser.js also follows the three primary destinations and disclosed record sections; its isolated fixtures are reused, with no new permanent QA file.
