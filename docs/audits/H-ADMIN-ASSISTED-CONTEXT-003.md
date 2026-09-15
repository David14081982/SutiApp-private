# H-ADMIN-ASSISTED-CONTEXT-003

## PRE-CHANGE AUDIT / AUTHORITY / PLAN / RISK

Owner requests Admin visibility while using Tomar control with the attended user's assigned screens, and explicitly confirms executing that user's authorized actions. Existing commit/push/publication authorization continues for this correction. Base 983e3d0, isolated release worktree; dirty root changes excluded.

Scope: app/admin-repository.js and app/app.jsx; app/admin-cutover-store.jsx only if invalidation requires support subject binding. New migration/recovery 20260915000100_admin_assisted_context.sql; scripts with admin-assisted-context prefix for preparation, SQL/browser/global verification and controlled deployment; focal evidence/audit; appendices to SOURCE_OF_TRUTH, SECURITY_RULES, DECISIONS, AGENT_CHANGELOG and derived registry. Bundle and HTML/SW version strings generated only.

Backend authority: existing admin roles/assignments/responsibilities and impersonation_sessions. No parallel user, role or permission table. A private schema contains parameterized copies of installed pure permission readers over those same tables and exact function-definition recovery; it cannot be called by browser roles. Stored impersonation session selects the attended Auth UUID; no caller-selected subject or rewritten JWT. auth.uid() remains the real operator in all writers.

Effective administrative permissions during valid assistance are bounded by both real operator and attended user. Session identity/start/stop and assisted self-service identity validation continue to check the real operator's independent impersonation capability. Existing no-assistance branches preserve exact installed behavior. No target Auth assignment means no target Admin. Revocation, expiry, wrong session, archived/ambiguous target fail closed. Direct RPC/RLS authorization must match visible scope; frontend hiding alone is insufficient.

Public authorization helpers affected: has_admin_permission, has_section_action, get_admin_access_context, is_module_admin, has_admin_module, module_effective_permissions, is_active_admin, savings_admin_access_allowed. Existing module editor RPC guards that directly use prior permission helpers are brought through the current helper. Session identity functions replace only their impersonation-capability check with a real-actor helper (get_effective_affiliate_id, get_current_affiliate_access_state, get_impersonation_context, start/stop/search impersonation, and resolve_current_loan_snapshot_quote if its identity guard requires it). No financial calculation or writer body is changed. Audit triggers enrich existing admin/identity audit details with the valid assistance session and actor/context identifiers without overwriting existing provenance.

UI contract: preserve sidebar groups, module screens, actions, normal Admin and affiliate navigation, banner/stop/expiry, exact account assignment editor, all other UI. Admin tab becomes available for the attended administrative account; banner return exits assistance before returning to the real operator's Admin. Published bundle chunks outside declared sources remain byte-identical.

Security risks: inheriting full operator permissions, privilege escalation to a stronger target, recursive permission/session checks, invalidation leaks, nested assistance, disabled exit, stale context after expiry, direct helper bypass, broken existing self-service. Controls: private subject readers, actor/target intersection, no grant to private schema, server-owned session binding, guards retained, SQL matrix and real Chrome tests, metadata-bound frontend context, exact no-assistance parity.

Legacy guardian: SAFE CHANGE limited to pure authorization readers/identity predicates. No formula, Google/Apps Script, financial calculation, request state, ledger, Storage object or history edits. Captured definitions/hashes and tests demonstrate unchanged no-assistance behavior. Protected ADR-098 migrations remain byte-identical; this is an additive owner-authorized extension.

Recovery: save exact installed definitions and applied hashes; transactional forward/recovery rehearsal with rollback. Recovery refuses drift or assisted-write history; then forward repair, no business/audit deletion. Installation preserves assignments, identities, responsibilities and business-row hashes/counts.

Tests: baseline hashes, protected static contract, old module matrix, new operator/target SQL permission/RLS/identity/write-audit matrix with ROLLBACK, normal/assisted/exit/expiry/limited/no-Auth browser cases, one normal operator real browser; mandatory unchanged global image regression local and GitHub Pages due shared auth/helpers/routing. No real target permissions altered and no customer writes during tests.

Status: PASS for implementation scope; Navigator FRESH and directed live helper inspection completed. All new authority remains derived from existing source tables. No additional owner decision required.


Audit refinement before editing: affiliate edits already write affiliate_admin_events rather than admin_audit_log. Add an AFTER INSERT bridge only during valid assistance, referencing the original event ID in existing admin_audit_log so real operator and attended account are explicit. No existing affiliate event is altered. Test a real update_admin_affiliate RPC against a newly inserted rollback-only fixture, then assert actor/context audit.

## Verification before publication

- Additive migration installed with exact original-definition guards; before/after hashes of all assignments, responsibilities, role permissions, affiliates and requests match. Existing asset/object counts match. Zero permission or business rows changed during installation.
- New and existing module SQL matrices PASS before installation and after installation. Additional installed checks prove a weak operator cannot borrow a full target's permissions and operator revocation removes authority. Real affiliate UPDATE and audit verified only in a transaction that rolls back.
- Chrome isolated tests PASS: ordinary 33 screens, attended Afiliados, enabled edit form, denied route, mobile, failed/successful stop, mismatched support session closed. Expiry and no-Auth checks are SQL cases.
- Real backend + local new build PASS against the owner-indicated existing target: read/write Afiliados, no governance, edit form opens, assistance ends and operator Admin returns. Test opens but does not save customer edits; only authorized support session/audit records persist. Tests refuse an already-active operator session.
- UI preservation: same controls, groups, layout, motion, scroll and screen source; only Admin visibility/context and banner action change. 119/122 bundle chunks byte-identical to 983e3d0.
- Protected ADR-098 contract script PASS; three protected migrations unchanged. No business/financial calculation or Storage writer change.
- First global run reported catalog image timeouts; evidence retained. Global rerun and published-site verification must finish before full PASS.

Known maintenance constraint: private parameterized permission readers are derived from installed authorization code; future permission changes must update/review both assisted and ordinary behavior against the same authoritative tables. Recovery is now intentionally unavailable because legitimate support audit history exists; any required correction proceeds forward, preserving history.

WORK_QUEUE_HISTORY.md is absent in the baseline. This delivery follows the user's explicit scope and publication authorization; it does not advance the unrelated loan work queue.

Global local final: PASS using unchanged official suite against bundle v259 / SW v203 with installed backend. All assets, Login, profile, Admin Afiliados, image/PDF, Membership, loan documents, catalog/gallery, Marketplace, fullscreen, refresh and with/without SW passed. Two prior timeout runs retained as evidence. Published verification is recorded in the final result below. SQL migration intentionally retains exact applied bytes (including captured definition CR/LF whitespace); editable-source whitespace check passes excluding this immutable applied snapshot.



## H-ADMIN-ASSISTED-CONTEXT-003 RESULT

Status: FAIL for full verification; requested commit/push/deployment and assisted Admin behavior PASS.
Files changed: three frontend sources, generated bundle/HTML/SW versions, additive migration/recovery, focal scripts/evidence/audit, authority appendices and derived Registry. No unrelated workspace/vendor changes committed.
Source-of-truth verdict: PASS; existing Supabase authorities retained.
Invariant verdict: PASS in SQL and focused browser checks; real actor and attended account remain separate. Protected migrations unchanged.
Build: PASS; 119/122 chunks preserved; published bundle v259 / SW v203 matches local SHA-256 exactly.
Tests: PASS SQL rehearsal/recovery, installed new/previous module matrices, browser fixtures, real attended account Admin/edit form/exit locally and on sutiapp.com. Official global local PASS. Official global Pages FAIL after four unchanged runs: catalog image load timeouts persist. Never represent this result as overall PASS.
Security: PASS; all 19 installed function hashes match reviewed definitions; private subject readers inaccessible to authenticated/anon. Backend actor/target intersection, revocation, session binding, no Auth, stronger-target denial and rollback-only UPDATE audit verified.
Legacy impact: pure authorization/identity predicates only; financial calculations, Google, ledger, Storage objects and business writer bodies unchanged.
Unexpected files changed: none committed. Dirty root and three pre-existing LF-only vendor files excluded.
Known limitations: two existing JPEGs (163556 and 89784 bytes) stall in the mass browser run. Direct normal-user signing/fetch returns HTTP 200, exact bytes and valid MIME in about 0.5 s; isolated unmodified Chrome decodes both in under 0.6 s. Observation-only instrumentation records aborted Storage requests near 40 s, without authorization errors; root cause under mass load remains unresolved. One earlier global run also reported a loan-document preview error, absent from later failure lists. No assets or acceptance criteria changed to obtain a pass. Applied SQL preserves its exact installed bytes and captured CR/LF whitespace; recovery remains guarded against legitimate audit history.
Evidence: docs/qa/evidence/admin-assisted-context-20260915: deployed, workflows, real-browser-pages, deployed-backend, global-local, global-pages, all retained attempts, storage diagnostics and network diagnostics.
Publication: owner explicitly authorized the exact destination after the automatic rejection. Commit 8f9ec65 pushed to David14081982/SutiApp-private main. Pages run 34932649824 and Membership contract run 34932649826 both success. Functional verification used the owner-indicated existing account; edit form opened but no customer edits saved.

## SUTIAPP ARCHITECT REVIEW

Task: H-ADMIN-ASSISTED-CONTEXT-003
Verdict: NEEDS_FIX (global verification only; publication and focused behavior confirmed)
Critical findings: code/diff, installed function hashes, unchanged data proof, SQL matrices, real browser and local global evidence support the implemented behavior. Published global verification remains FAIL; healthy individual files do not substitute for the required full suite. WORK_QUEUE_HISTORY.md is absent in the baseline; no unrelated queue advanced.
Source of truth: PASS; no alternative data authority.
Architecture: existing authorities and server-bound context; private derived permission readers require parity maintenance in future changes.
Security: real actor unchanged; target privileges cannot elevate an operator; backend and UI subject boundary checked.
Data: zero installed business/permission changes; persistent test activity limited to authorized support/audit sessions. Historical and physical assets retained.
Legacy: no financial calculation or Google changes.
Owner decision: NO; the destination approval is now resolved.
Next action: investigate the reproducible mass-load browser timeout with legitimate existing assets; preserve source/data/UI, do not weaken the official suite, and do not mark H PASS until the required production regression passes. No new business decision is requested.
Response generated for Codex: YES.

## RESPONSE TO CODEX

No cierres H-ADMIN-ASSISTED-CONTEXT-003 como PASS. El commit, push y despliegue solicitados estan completos y Admin asistido funciona en produccion. Conserva el resultado FAIL de la regresion global y la evidencia de cuatro intentos; las pruebas individuales de archivos no sustituyen la suite requerida. La siguiente correccion debe resolver o explicar con evidencia el timeout bajo carga sin alterar datos, UI, autorizaciones o criterios de prueba. No avances a otra H.
