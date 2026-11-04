# H-CASH-FLOW-PV2-SOURCE-20261104

## PRE-CHANGE AUDIT

Status: PASS — implementation authorized by owner after read-only diagnosis.

Objective: repair the common monthly cash-flow report and its Excel source bases. Google SutiApp Final is strictly read-only. Column AE is excluded from every cash-flow read, calculation and export.

Authority: original Google installment A/B and loan C; Z administration, AB interest, AC interest plus principal, AD principal. Approved/started/settled requests use request date as placement date. Supabase remains authoritative for savings/investor originals. No financial writer, trigger or Apps Script change is authorized here. SICOF is obsolete and out of scope.

Scope / files: reports-jc cash-flow-google.mjs, cash-flow.mjs, cash-flow-consolidated.mjs, cash-flow-investors.mjs; new cash-flow-loans.mjs and cash-flow-savings.mjs and focal source/bases helpers if required; app/cash-flow-export.js and app/cash-flow-report.jsx; focal tests and read-only verification/release helpers; this audit and scoped architecture index updates. Additive report reader migrations/recovery 20261104000100 and 20261104000200 only if source fields require them; financial tables/values and permissions remain unchanged. Generated bundle and focal cachebuster/build artifacts may change only with scoped packaging.

Baseline: existing workspace contains many unrelated changes; preserve all of them. Private file snapshots/hashes are kept under .tmp/cash-flow-source-20261104/before. No blanket staging, reset or cleanup.

Invariants: one placement per C; A <= Hermosillo cutoff is paid, later A programmed; all future installments included irrespective of origination year; no new late interest/admin; source terms preserved; no silent zero/fallback for ambiguous components or identities; read-only source queries; UI and Excel consume same response; original and derived base values distinguished; investor renewal principal not duplicated; savings presentation reconciliation never creates cash or changes a saver balance.

Risks: financial aggregation, ambiguous duplicated request IDs, unresolved component markers, imported investor continuity and savings historic/current transitions. Display traceable partials/residuals rather than fabricate a complete allocation. No automatic selection between contradictory historical amounts.

Plan: parallel focal loan/investor/savings implementations; integrate source bases/export; execute original and added financial tests, source parity checks, UI/export verification; review exact diff; package only this feature; independent architect review.

Tests: 48 program/month 2026 B controls; no AE dependency or Google write; source component and cent-level conservation; approved request date/capital/count; years 2027/2028; identity ambiguity; investor continuity and maturity; savings balance bridges; seven Excel sheets, understandable traceability and no cell notes; access controls unchanged; focal UI/build checks.

Recovery: restore exact scoped code/reader definitions from private verified baseline. No financial data recovery is needed because none is modified. Global image regression is NOT APPLICABLE to focal modules/generated bundle alone per AGENTS.md; reassess if shared runtime code actually changes.

## Verification

Implementation, candidate and production UI/Excel verified. Live source queries for 2026, 2027 and 2028 pass. Public bundle/worker hashes match the reviewed candidate, and the real production Excel download passed.

### Runtime scope expansion: verified Edge CPU limit

Candidate v13 reproduced HTTP 546 under authorized H005_TEST; unchanged v12 had the same failure. A local profile without investors produces 49 MB and more than four CPU seconds. Repeated micro-optimizations cannot establish capacity for subsequent years.

The authorized Edge reader will return an explicit, versioned, allowlisted input snapshot after the existing before/after context checks. The exact existing pure projection will run in a disposable dedicated browser worker. UI and Excel share its single result; neither raw inputs nor derived results are persisted in browser storage. Worker failure is visible, never a source fallback. No additional source, formula, financial write or permission is introduced.

Additional focal files: reports-jc/index.ts (CASH_FLOW dispatch only), cash-flow-inputs.mjs (field allowlist); app/cash-flow-projection-worker.js (generated pure artifact); scripts/build-cash-flow-projection-worker.js and focal worker tests; build-pages-site.js (one static artifact in allowlist). Existing repository/authentication/app shell/service-worker logic remain unchanged. The worker artifact must exclude Google OAuth/readers, secrets, network and persistence operations. Context changes, navigation and stale queries terminate/discard the worker. Validate exact projection equivalence, source immutability, malformed payload rejection, no AE and real 2026/2027/2028 execution before publication closure.

Only this disposable administrative projection moves to a worker. Quotation SUTI_LOAN_QUOTE_V1, eligibility, approvals and all financial writers remain in their existing backend authorities (INV-088/095/107, ADR-064/065).

### Reader timeout scope expansion

The live 2026 UI/Excel and 2027 query passed. The 2028 source reader returned SQLSTATE 57014 after 8.173 seconds, before returning data. This is a database statement timeout, not absent financial information. Add migration/recovery `20261104000300_reports_jc_cash_flow_timeout.sql`: set only `public.get_admin_reports_jc_cash_flow(date)` to a bounded 30-second statement timeout. Preserve function body, authorization, OID/owner/ACL/security/search_path and every financial table/value. Do not alter role/global settings or duplicate the scheduled-contribution rules. PostgREST applies function-local settings to the request transaction: [official Supabase timeout documentation](https://supabase.com/docs/guides/database/postgres/timeouts). Require guarded recovery, isolated metadata/source invariants, and a successful real 2028 read before closure.

## Verified behavior

- PV2 A/B determines paid versus scheduled by the backend Hermosillo consultation date. Original Z/AB/AC/AD supplies the breakdown; no tariff or amortization is invented. One authorized capital/count per C uses request J, with documented U/AG evidence only for eligible orphan calendars. AE is neither requested nor consumed nor exported.
- April 2026 Caja Chica: 29 loans and 269,800 pesos placed, previously absent. Independent sums of B and component conservation passed 288 program/month/phase controls across 2026, 2027 and 2028.
- Savings uses accepted Supabase balances. Opening balances, stock-basis changes and future balances are explicit and do not create cash. Investor continuity counts renewed capital once; current November capital in the verified snapshot is 24,006,000 pesos. No historical withdrawal date or new investment is invented.
- Seven Excel sheets share the same consulted snapshot: Flujo mensual, Base PV2, Base Solicitudes, Base Ahorro, Base Inversores, Base Contratos and Base Cálculo. Names/control numbers, original rows, dates, programs and amounts are readable; internal IDs remain available for tracing. Empty unavailable cells, no cell comments, no invented spreadsheet formulas.
- Candidate H005_TEST browser verification: 1,512 displayed/exported cells matched, 90,984 calculation rows and all five source bases matched; actual download succeeded. Eight existing JC tabs and seventeen original cash-flow concepts retained. Original private download deleted after verification.
- 113 financial/transport/worker test entries passed. Separate worker UI checks cover exact result/export equivalence, session/period/navigation cancellation, late-result rejection, invalid versions and worker failure without fallback. All seven workers terminated; zero external requests in isolated UI tests. Exact module reproduction and synthetic 2026–2028 parity passed.
- Scope isolation: 175 bundle modules; 173 unrelated modules byte-preserved. Only cachebuster changes in sw.js; global image regression remains NOT APPLICABLE under AGENTS.md. Existing Auth, repository, shell and document/viewer implementations remain unchanged.

## Source limitations retained visibly

Some original breakdowns contain REVISAR or incompatible components. Their B recovery is preserved and the undistributed amount remains explicit. Contradictory request capital for a repeated loan ID is not selected arbitrarily. Undated original investor withdrawals remain in the evidence without invented payment dates. Treasury cash cannot be inferred from loan/savings balances. These conditions do not block downloading the known values and their source bases.

An earlier private source snapshot differs from later live PV2 values in several Caja Chica months. Live checks use the original A/B of the same current authorized response; the earlier snapshot is never substituted as production data. Source values were not written by this work.

## Release verification

Edge reports-jc v14 is active with JWT validation. The 2027 and 2028 live queries return HTTP 200 (9.38 and 12.80 seconds respectively), with 96 financial controls each, exact worker/direct parity, readable bases and resolved references. The savings reader timeout change passed 24 isolated checks and an independent rerun; body, permissions and data are unchanged. Roll back 003 before 001 to preserve exact definition guards.

Candidate bundle SHA256: `885e09fb542024983e4ff958642132d462198d8e297462f1c1289c262d913121`. Pure worker SHA256: `1e28653ba5a8b8d64e48158cf4423efab3182859ba9bbc42d8f4a57d744603dd`. BuildPages PASS. Evidence contains aggregates only; no source snapshots, tokens or private downloaded workbooks are published.

## Production closure

Implementation commit `f1b13587efee3bc137686c3481d75eda694a329c` was pushed to main. GitHub Pages run `41880058089` reports completed/success. Both public artifacts at https://sutiapp.com match the candidate hashes above.

The H005_TEST production browser run on 2026-11-04T17:51:07Z passed without a static overlay or financial API mocks. LOAD and CASH_FLOW returned HTTP 200. The UI and actual downloaded workbook matched all 1,512 concept/month cells, 90,984 calculation rows, and all five source bases. It checked 10,014 original PV2 quotas, component/percentage values, blank unavailable cells and absence of Excel comments. The private workbook was deleted. No financial writes, blocked write attempts, browser errors, persisted tokens or persisted personal records occurred.

This verification does not convert unresolved original-source breakdowns, duplicate capital evidence or undated investor withdrawals into determined values. Those limitations remain explicit and do not prevent exporting known values. No original Google/Supabase financial value was changed; AE remains excluded.

```text
H-CASH-FLOW-PV2-SOURCE-20261104 RESULT
Status: PASS
Files changed: 67 scoped implementation/release/evidence files in f1b1358; final closure evidence committed separately.
Source-of-truth verdict: PASS; Google original quotas/components and Supabase original savings/investor values retained.
Invariant verdict: PASS; one placement per loan, paid/scheduled date rule, original components, cross-year quotas, no invented cash.
Build: PASS; reviewed bundle and Worker hashes equal public artifacts.
Tests: PASS; 113 focal entries, 24 timeout checks, Worker UI checks, 2026-2028 source controls, real candidate and production Excel downloads.
Security: PASS; existing backend authorization/JWT and reader permissions preserved, no financial writes or persisted credentials.
Legacy impact: Read-only Google; no AE, Apps Script, trigger or original financial data changes. Scoped Supabase read RPCs/configuration only.
Unexpected files changed: None in isolated published scope; unrelated root workspace changes preserved.
Known limitations: Original REVISAR/ambiguous components and undated records remain visible; no arbitrary allocation. Registry globally STALE in sparse checkout, 56 focal files FRESH.
Evidence: docs/qa/evidence/cash-flow-source-20261104/ including browser-live-production.json, public-artifacts.json, deployment-production.json and architect-production.json.
```
