# H-ADMIN-REQUEST-BANK-REFERENCE-001

## PRE-CHANGE AUDIT — PASS

Owner requests bank references inside Solicitante in Admin Finance Requests and explicitly chooses
the account selected when submitting that request. No current-account substitution is authorized.

Authority: loan_request_deposit_snapshots is immutable request-time evidence; affiliate_bank_accounts
remains the current master and is not read by this feature. Account number, card and CLABE are distinct.
The captured schema contains bank, holder, card and CLABE, not account_number; never infer that field.
Live metadata confirms the pictured SR-2026-000195 has a selected bank/card snapshot and no CLABE.
No real banking numbers are written to logs, evidence, screenshots or documentation.

Scope: add a conditional minimal bank-reference projection to the existing
get_admin_finance_request_flow_detail(uuid), retaining signature/OID/grants and all existing data.
Reuse existing hydration without editing shared repositories. Display it only within Solicitante in
screens-admin-finanzas.jsx. Add migration/recovery 20260908000500, focused SQL/browser/live tests,
release verification, governance/derived registry and generated bundle/HTML/SW version values.

Backend requires existing program_requests.read and bank_accounts.read for full banking references.
No banking permission yields an explicit restricted state without numbers. Missing snapshot and an
explicitly unselected account are distinct empty states. Query binds both request and affiliate IDs.
No new permissions, grants to private tables, mutable account reads, writers, triggers or business changes.

UI contract: preserve all existing sections, header, footer actions, navigation, document viewer,
scroll/focus and responsive behavior. Only add the requested reference block; no new flow or editing.
Approval/rejection/deletion callbacks, requests/documents/banking data, Auth and Storage remain unchanged.
Google, calculations and financial execution: NOT APPLICABLE; no Google or financial writer invoked.
Global image regression: NOT APPLICABLE; no shared image/Auth/repository source or SW logic changes.

Risks: current account mistaken for historical; exposing another affiliate or to unauthorized role;
missing data presented as zero; horizontal overflow; PII in evidence. Focused tests cover each risk.
Recovery: exact prior live RPC backup and transactional restoration; no rows modified by migration.
Deployment: reader first, frontend after verification, real read-only acceptance and scoped commit/push.
The earlier interrupted report about session verification is not claimed fixed by this presentation change.

## VERIFY — candidate PASS

- `node scripts/build-bundle.js C:/tmp/babel-standalone-7.28.4.min.js`: 110 modules.
- `node scripts/verify-admin-request-bank-reference.js`: transactional migration/recovery PASS;
  52 original responses identical after excluding the new field; 23 selected, 24 missing, 5 unselected.
  Every projected value compared inside PostgreSQL against its exact request/affiliate snapshot.
  Real permission removal inside a reverted savepoint confirms no bank leakage. Anonymous/unassigned
  denied, private table privileges preserved, business hashes identical. No test data persisted.
- `--apply` installed the reader; a trailing newline mismatch in the test comparison was corrected.
  `--verify-installed` confirms exact live definition, original OID and grants. No second installation.
- `node scripts/test-admin-request-bank-reference-browser.js`: 27 focused cases PASS, synthetic only.
  Reuses the released modal fixture and compares all original content and nine writer callbacks.
  Captured fields, card-only, CLABE-only, denied/empty/error states, selection isolation, documents,
  footer, X/Escape, previous/next, draft retention, deletion controls and six viewport sizes covered.
  Test harness realm mismatch corrected by compiling the shared fixture in the Node module realm.
- `node scripts/test-admin-request-bank-reference-live.js http://localhost:8080`: real login,
  selected SR-2026-000195 and three other request types PASS. Exact bank strings compared in browser;
  receipts contain booleans only. Five viewports, 71 decoded images across four details, fullscreen,
  zero storage failures, zero business writers. Private static vendor copies use exact Git LF bytes
  to preserve existing SRI; no vendor/Auth/CORS source changes.
- `node scripts/verify-admin-request-bank-reference-scope.js`: source/build parity PASS,
  only screens-admin-finanzas.jsx changes within bundle, all writer/shared sources unchanged,
  cachebusters only, secret scan PASS, no unexpected files.

## CLAUDE UI PRESERVATION REVIEW

Screen: Admin Finance Requests, existing large detail modal.
Original/current sections: Solicitante, Resumen, workflow, Google registration, conditions,
request documents, current affiliate dossier, history, sticky header/footer; all preserved.
Missing sections: none. Added: requested bank reference within Solicitante only.
Interactions/navigation/visual structure: PASS (actual browser, before/after content and callbacks).
Synthetic screenshots at 1440x1000 and 390x844 inspected; readable, no clipping or horizontal overflow.
Unauthorized redesign: NO. Verdict: PASS.

## DATABASE MIGRATION AUDIT

Domain/authority: captured request evidence, unchanged private snapshot table.
Schema: no table/column/index/constraint/trigger/policy changes. Existing reader signature preserved.
Security: joint request/banking permission in backend, request+affiliate binding, no browser grants.
Historical data: zero changes, all three domain hashes identical during dry run.
Compatibility: every existing JSON field and all writers identical; reader deployed before frontend.
Recovery: versioned exact prior reader; tested in transaction, original definition verified after rollback.
Verdict: PASS. Evidence: sql.json, migration.json, scope-build.json.

## Candidate result

H-ADMIN-REQUEST-BANK-REFERENCE-001 RESULT
Status: PASS (candidate; production acceptance recorded after publication)
Files changed: focal screen, generated bundle/cachebusters, one reader migration/recovery,
four focal scripts, governance, QA/evidence and derived architecture index at final closure.
Source-of-truth verdict: PASS — captured account only, no fallback or master-account lookup.
Invariant verdict: PASS — ADR-109 / INV-220, existing workflow and dossier untouched.
Build: PASS. Tests: 27 isolated cases + 52 SQL comparisons + real read-only local acceptance PASS.
Security: PASS — real backend permission checks, private snapshot grants preserved, no PII evidence.
Legacy impact: NOT APPLICABLE — no Google or financial execution changes/calls.
Unexpected files changed: none.
Known limitations: historical requests without a captured selection cannot show invented references;
unrelated earlier session-verification report remains outside this H, although test login succeeded.
Evidence: docs/qa/evidence/admin-request-bank-reference-20260908/.
