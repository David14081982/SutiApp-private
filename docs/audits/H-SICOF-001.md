# H-SICOF-001 — SICOF y trazabilidad del ahorro por periodo

Se preparó y verificó un candidato local de SICOF. Cada retiro conserva su fecha de entrega y los periodos de origen del capital o rendimiento consumido; el informe y Ahorro consultan el mismo saldo canónico. El Excel histórico conserva sus valores y exclusiones originales. Los escenarios permiten elegir la participación de rendimientos anteriores, pero no acreditan dinero automáticamente. La revisión independiente aprobó el candidato; su activación, migraciones e importación histórica privada siguen pendientes. No se modificaron saldos ni datos financieros productivos.

## PRE-CHANGE AUDIT — 2026-10-03

Status: PASS for the implemented and verified local candidate. Production activation remains pending. No production migration, deployment, import, or financial write executed by this task.

Owner request: implement the complete SICOF experience in the administrative sidebar with existing authenticated administrative access, loan income from SutiApp Final / HISTORIAL P V2, canonical Savings from Supabase, configurable participation of prior yield, costs, saved scenarios, reports, loan payment behavior in Finance requests, and exact-format historical Excel reporting. Every withdrawal must appear in its corresponding report period and in the same affiliate Savings balance. Preserve all existing functionality. The latest implementation instruction supersedes earlier proposal-only instructions.

Historical instruction: preserve the 2025 amounts and historical policy outcomes in `Reporte Final Ahorro JC (3 reglas) .xlsx`. This is reference evidence, not authority to double-credit current certified balances. Do not reinterpret row 92 as a capture error or infer a cause absent evidence. Do not infer historical capital/yield withdrawal allocations.

Authorities: Google owns recorded loan payments and loan statuses; Supabase `savings_transactions` owns canonical Savings movements and component balances, `savings_yield_periods` / `savings_yield_allocations` own approved yield, existing settlement owns payouts. SICOF scenarios and historical report evidence cannot become another account balance. Match exact text Folio with resolved participant identity; no email/name joins.

Navigator: FRESH; Savings and Finance lookup plus targeted code/schema discovery. Existing workspace contains substantial unrelated modifications. Preserve these and record baseline hashes before editing any existing source.

Initial production read-only aggregate check: 844 Savings transactions, zero yield periods, zero yield allocations, zero settled Savings requests. These are observations, not authorization to backfill or modify existing balances.

Planned bounded files (subject to confirmed contracts):

- New `app/sicof-repository.js`, `app/sicof-report.js`, `app/sicof-admin.jsx`, `app/sicof-payment-behavior.jsx`, `app/savings-period-breakdown.jsx`.
- Focal integration in `app/screens-admin.jsx`, `app/screens-admin-finanzas.jsx`, `app/screens-savings.jsx`, `app/savings-runtime-admin.jsx`, existing Savings repositories only if necessary after dependency audit.
- New `supabase/functions/sicof/` and shared SICOF calculation/read contracts; additive migration/recovery `20261003000100_sicof` after the schema/security/authority audit passes.
- Google read-only transport only if required; no financial writer, amortization, formula, trigger, cell or status changes.
- Dedicated inspection/build/import-preparation/verification scripts, isolated fixtures and sanitized evidence under `docs/qa/evidence/sicof/`.
- Exact Excel template held privately, never public frontend data; 2025 evidence import must be idempotent and create no balance movements.
- Build list, generated bundle/cachebusters, and architecture Registry only when architecture changes. Local private backup under `.tmp/sicof/`.
- This audit and append-only task notes in governance/changelog where necessary.

Outside scope: deleting/rewriting historical records, automated approvals based on score, assuming punctuality without due/receipt-date evidence, changing existing loan terms or Google formulas, making test financial transactions in production, importing Excel balances as new money, replacing canonical account readers with independent SICOF totals.

Risk: financial and shared Admin routing. Require backend authorization/RLS, actor/context audit, idempotency, immutable approved calculations, exact component and period reconciliation, concurrency checks, no negative available component, recovery retaining new financial history. Unknown historical period allocations remain explicit evidence gaps, not fabricated periods.

Verification: isolated SQL and calculation tests, per-period partial/full withdrawals and reversals, duplicate retries, historical opening conservation, simple/compound scenarios, identical screen/CSV/XLSX/acta amounts, anonymous/self/admin access, preservation of original UI controls, focused browser checks, source/bundle correspondence. Shared Admin routing requires the repository global image regression against local build and GitHub Pages; no global PASS without every required surface passing.

Implementation gate: resolve live schema, existing policy differences and period attribution before modifying financial functions. Configuration of a future scenario does not silently revise current eligibility policies. No deployment or financial data action is represented as complete without direct evidence.

Recovery: private source hashes/backups; reversible additive schema or exact function definition backups; disable new entry points while retaining immutable audit and financial records; never drop newly created financial history as rollback.

## Loan reader and calculation scope — 2026-10-03

Bounded implementation: new `supabase/functions/sicof/loan-source.mjs`,
`loan-calculation.mjs`, `scripts/test-sicof-loans.js`, and
`scripts/test-sicof-loan-receiver.js`; additive fixed `read_sicof_financial`
action in `google-apps-script/financial-handoff/Code.gs` and its README.
Existing `read_loan_status` and all writers remain unchanged. No live deployment,
Google writes, formulas, triggers, or financial migrations in this subtask.
Google HISTORIAL P V2 remains the sole payment/status authority; local workbook
is inspection evidence only. Reuse existing receiver OAuth and server secret;
no browser secret, source cache, or alternate-source fallback.

Confirmed local workbook contract: B is Cuotas, O is scheduled discount, N is
scheduled charges including administrative fee Z where M=AB+AA and K=J+M.
In the local snapshot, 414 rows have zero B and positive N. Financial components
are recognized only after row and loan identities reconcile at a bounded
rounding tolerance. Partial/overpayments retain unallocated amounts; no assumed
proportional allocation. Duplicate loan/date rows are ambiguous, never summed
silently. A is an amortization date, not proved receipt timestamp; the output
explicitly labels this limitation and cannot certify punctuality or cash-date
income. Current compliance uses the authoritative uniform X status.

Verification: fixed target/allowlist, wrong-secret rejection before any read,
unchanged existing loan guard, source consistency, exact text identity, date and
money validation, rounding, duplicates, future dates, zero/partial/overpayment,
component conservation, grouping/filtering, and OAuth failures without fallback.
Recovery is removal of the new fixed entry point and new modules; preserve all
existing writer and loan-status source. Status: PASS for bounded local work;
productive financial certification remains subject to explicit data quality.

## Server exports scope — 2026-10-03

Add `supabase/functions/sicof/exports.mjs` and `scripts/test-sicof-exports.js`.
Export adapters receive only the authenticated server calculation/context, never
read independently from Google or change account balances. ExcelJS is injected
from the existing server dependency. The historical-download path returns the
private original workbook bytes unchanged, preserving 2025 values and historical
policy outcomes. Current-period exports use server-provided report columns and
explicit canonical balances, with separate movement/period sheets; unknown values
remain visibly unresolved. They must not compute current balances by adding the
historical reference to Supabase again. CSV neutralizes spreadsheet formulas;
acta HTML escapes every untrusted value. Exported calculation formulas and cached
results must conserve the same cent rounding, costs and retention as the scenario.
Verify original byte identity, Excel styles/headers where template is adapted,
filters, formula injection, HTML escaping, null handling and financial totals.
No template content, PII or source workbook is embedded in public code or bundle.

Export verification additionally uses ExcelJS 4.4.0 only under private
`.tmp/sicof/deps`, with install scripts disabled. New preparation helper
`scripts/extract-sicof-history.js` extracts the original workbook to private
`.tmp/sicof/historical-report.json` (rows A:M, original bytes/base64 and SHA-256).
This is preparation evidence only, with no Supabase import or balance credit.
Original source and historical policy outcomes remain unchanged; logs contain
only counts/hash, never personal row values.

Loan presentation adapter scope additionally includes only `decorateLoans` and
`behaviorFor` in `supabase/functions/sicof/projection.mjs`, plus
`scripts/test-sicof-loan-projection.js`. These derive comparison labels and
cumulative amounts server-side; duplicate/invalid rows interrupt completeness,
future installments cannot be counted as missed, and unresolved owner identity
cannot produce a falsely reassuring no-history indicator. They do not change
the Savings report or account calculation sections of the same file.

Later authorized refinement extends the derived `makeReports` section of
`projection.mjs` to classify reversals by the linked original transaction.
Reversal of a withdrawal changes net delivered money; it never becomes a new
contribution. Contribution/yield reversals remain in their category, including
cross-period reversals. Missing/cyclic/component-inconsistent reversal links
produce explicit report review and unknown affected report totals; canonical
ledger balances remain unchanged. Add isolated tests for linked partial/full
withdrawal reversals and unknown links. Also preserve loan metadata already read
by the fixed source only when every loan row agrees; any conflict remains visible.

## Export parity refinement — 2026-10-03

Reopen only `supabase/functions/sicof/exports.mjs`, its isolated export tests and
sanitized evidence. Restore the original printable acta's liquidity scenarios,
bank declaration, signature spaces and print action using the server liquidity
DTO. Unknown cash, dates or portfolio remain unresolved; current receivables are
never presented as guaranteed collection. Add the original formulated workbook's
Pagos and Desglose sheets, with formulas linking verified source interest and
server-provided balance/day intervals to the same costs, basis and cent-rounded
allocation. Missing intervals are not inferred. Original 2025 workbook bytes and
historical outcomes remain unchanged. No engine, UI, projection, Google source,
database mutation or production operation is in this refinement's scope.

Refinement verification: PASS for nine isolated scripts recorded with commands
in `docs/qa/evidence/sicof/loan-export-tests.json`. Real ExcelJS serialization and
reload verify Pagos/Desglose/Parámetros/Reparto formulas and cached values against
the actual server motor, including weighted withdrawals, source reconciliation,
filters, cost rounding, unknown intervals and mismatches. Actual motor liquidity
tests cover cash-covered, collection-dependent, shortfall and unknown states for
10/25/50/100 percent withdrawals. Original historical bytes and cells remain
unchanged. Matrix year filtering now matches the UI and retains unknown-date
records for review. No desktop Excel recalculation or production deployment is
claimed; no external financial writes occurred.


## Final scope refinements and findings

The candidate uses migrations 20261003000100_savings_period_composition and 20261003000200_sicof_workspace, each with a history-preserving recovery. The originally tentative app/sicof-report.js was not needed. Neither existing Savings repository was modified by this task. Integration is limited to the four audited screen/runtime files, four new frontend modules, their build registration and generated artifacts. Verification tooling, schema-only fixtures, architecture semantic overrides and derived Registry are included. Existing unrelated workspace changes remain outside this release.

The original static loan view mixed scheduled charges and collected interest. Zero recorded payment cannot produce income. The new fixed reader preserves B as the recorded payment, O as scheduled installment, and reconciles interest separately from administrative fees. Partial/overpayments, duplicate rows and inconsistent loan headers require review. The original matrix also mislabeled transfer/discount dates as request/authorization and charges/principal-plus-interest as other principal fields; source-correct labels are used. Neither current due dates nor payroll deduction prove punctuality or guaranteed recovery.

Liquidity preserves the four 10/25/50/100 percent withdrawal scenarios, bank declaration, costs, reserve and backing view. Cash comes only from an explicit bank declaration; contractual Caja de Ahorro receivables remain distinct and contingent on collection. A cash deficit is displayed and cannot become a positive donut slice. Fund recovery charts use contractual outstanding balances; the cumulative collection chart uses the selected amortization interval. Both scopes are labeled. Projected net pool and its rate use confirmed eligible balances and the configured costs; they do not promise future collections or future contributions.

Canonical opening entries observed in production are dated 2026-09-06. A certified aggregate opening does not prove daily balances before that date or its year/semester composition. Historical average-balance calculations therefore remain explicitly unresolved until sufficient authoritative evidence exists. Final-balance simulations after the certified opening are possible under their explicit selected method. Do not substitute the Excel report or legacy raw rows for missing certified history.

The 2025 workbook is preserved byte-for-byte for original download, including original zero yield outcomes. Its 214 rows are prepared privately; no import occurred. Current report downloads retain the original reference and add period/movement/availability information from the canonical ledger. Historical values must never be posted again. The exact original workbook SHA-256 is e9dc173869188990e23d71694a99af008d2b9190a301d1d71c90ff2764d18837.

Withdrawals are reported by effective delivery date and separately by consumed origin/component. Linked reversals restore the provable origins; an ambiguous partial multi-origin reversal stays unresolved. Credit uncertainty cannot cancel debit uncertainty. Global available balance includes existing holds; period remaining balances are never mislabeled individually withdrawable. Opening/withdrawal attribution records metadata only and uses permission, evidence, version and idempotency guards. It never adds a second credit or debit.

SICOF determines and compares proposed rates. It does not replace the existing approved yield-credit process. Accrued, simulated, paid and retained yields remain distinguishable. The original policy exclusions are retained from the canonical policy preview; absence of evidence means review, not an invented exclusion reason or an awarded return.

Local UI regression tests use synthetic fixtures with network blocked. Existing finance-queue evidence regenerated by its test was copied into this H and its previously clean files restored byte-for-byte from HEAD. Existing untracked savings-individual-withdrawal evidence was not deleted or reverted. The protected Admin authorization contract was checked; no parallel role registry or extra SICOF password is introduced.

Activation has not occurred. A coherent release must verify production drift/migration numbers, capture recovery evidence, apply migrations 001 then 002, update only the fixed authenticated GAS reader, deploy SICOF Edge with the existing OAuth/source secrets and ALLOWED_APP_ORIGINS, import the exact workbook as private evidence without ledger DML, then publish only the reviewed frontend artifacts. Do not deploy the frontend alone or publish the entire dirty workspace. Production write validation must use legitimate owner-authorized activity, never fabricated financial transactions.

## Verification result — local candidate

Final source is frozen in `docs/qa/evidence/sicof/source-manifest.json`. Bundle SHA-256: `fe8e56e0e87c9119a613548363e747acaff708284d3e6365385f2316c08e6484`. The focal builder proves equivalence to the pre-task sources and preserves 139 unrelated bundle chunks exactly.

- `node scripts/test-sicof-candidate.js`: PASS, 14 suites. Includes 17 PostgreSQL composition groups and 10 workspace groups; exact historical workbook export, formula-linked Excel, original acta options, server calculations, read-only Google receiver, report reversals, actual Admin/Finance/Savings component integration and protected Admin contract.
- `node scripts/test-sicof-candidate.js --ui`: PASS after the final UI freeze; all three browser suites rerun. Synthetic fixtures only, network blocked. Original UI coverage: `docs/qa/evidence/sicof/ui-contract.json` (16 areas).
- `node scripts/build-sicof.js`: PASS. Four focal integrations and four new frontend modules; no unrelated bundle rebuild.
- `node scripts/test-global-image-regression-production-live.js`: PASS on the final local bundle and on GitHub Pages. Local evidence verifies the exact build hash; production evidence covers the existing deployment, not an installed SICOF module. Legitimate images/PDF, login/profile/Admin, membership/loan documents, catalogue/marketplace, fullscreen, refresh and with/without service worker pass. Zero browser errors or test business-data writes.
- Read-only conservation: all seven protected Savings tables retain exact pre-task fingerprints (844 transactions, 26 requests, 354 participants, 352 enrollments, zero holds/yield periods/allocations). Candidate migrations and schemas are absent in production; their version numbers are unoccupied.
- Secret boundary scan, focal whitespace checks and workspace scope: PASS. Original HTML matches the attachment byte-for-byte and was not edited. No unexpected changes attributable to this task; unrelated dirty workspace retained.
- `python scripts/test-architecture-registry.py`: PASS for generation, freshness, stale detection, lookup, reverse mappings, permissions, tests, fallback, incremental updates, secret exclusion and determinism. SICOF mappings explicitly describe a local candidate. Task-owned preview servers were stopped after verification.

Evidence: `docs/qa/evidence/sicof/`. Independent review: `docs/audits/H-SICOF-001-ARCHITECT-REVIEW.md`. Architecture semantic metadata marks all new entry points as local candidates and does not claim deployed authority.

```text
H-SICOF-001 RESULT
Status: PASS — implemented and verified local candidate; production activation pending.
Files changed: focal Admin/Finance/Savings/settlement integration; four new UI/repository modules; SICOF server engine/reader/projection/export; additive GAS read action; two migrations and two recoveries; bounded build/test/schema fixtures; audits, authority notes and derived architecture index. See source-manifest.json and workspace-scope.json.
Source-of-truth verdict: PASS — canonical Savings ledger/writers and fixed HISTORIAL P V2 retained. Private historical evidence and simulations create no money.
Invariant verdict: PASS in isolated checks — exact identity, cents, origin/component separation, idempotency, context guards, historical zeros and reversals preserved.
Build: PASS — final SHA above; 139 unrelated chunks unchanged.
Tests: PASS — 14 focused suites including 27 SQL groups; final UI repeat; final local and deployed-site global regression.
Security: PASS candidate review — backend/module/session permissions, private forced-RLS metadata, no extra password or frontend server secrets. New production authorization endpoints are not installed or live-certified.
Legacy impact: additive read-only action prepared; existing reader/writers unchanged. No Google deployment or financial/source writes.
Unexpected files changed: none outside declared scope attributable to this task. Regenerated finance evidence restored to baseline bytes; unrelated work preserved.
Known limitations: not deployed/imported; simulations cannot credit yield; missing historical daily/origin evidence remains unresolved; mutable amortization dates cannot certify punctuality; declared bank amounts and receivables do not guarantee cash. No actual financial transaction created for testing.
Evidence: docs/qa/evidence/sicof/, period composition audit, independent architect review.
```
