# H-SICOF-SOURCE-PERIOD-XLSX-001

## PRE-CHANGE AUDIT

Status: PASS

- Objective: correct base_calculo to respect the applied start/end dates, inclusive, and selected funds. One HISTORIAL P V2 sheet, original A:O values.
- Authority: owner's explicit correction after the previous export included 2025 through 2027-04-30 for a 2026-07-01..2026-12-31 scenario. This supersedes the mistaken all-dates interpretation in H-SICOF-SOURCE-AO-XLSX-001.
- Baseline: b6a71c5dfc4b857623469dfa6587fe66538ed082, clean isolated release checkout. Architecture Navigator: FRESH; lookup sicof confirmed scope.
- Scope: exports.mjs date validation/filter only; sicof-admin.jsx help; dedicated XLSX and UI browser tests; generated bundle and SutiApp.html/sw.js bundle URL; this audit, evidence JSON, AGENT_CHANGELOG and derived architecture registry.
- Files: supabase/functions/sicof/exports.mjs; app/sicof-admin.jsx; scripts/test-sicof-calculation-base-export.js; scripts/test-sicof-ui-browser.js; app/bundle.js; SutiApp.html; sw.js; docs/audits/H-SICOF-SOURCE-PERIOD-XLSX-001.md; docs/qa/evidence/sicof-source-period-xlsx.json; docs/AGENT_CHANGELOG.md; docs/architecture/SUTIAPP_ARCHITECTURE_REGISTRY.json and generated registry companions.
- Data/domain: read-only loan payment export. The existing authenticated Google source is authoritative. Column A is normalized source row.date. No new reader/writer, query, cache or persisted data.
- APIs/tables: existing SICOF export action only; no schema/table/RPC/Google/API contract change. Current actor permissions and source/context/settings fingerprint are preserved.
- Outside scope: financial engine, savings/withdrawals, other exports, Google Sheets or Apps Script edits, synchronization, migrations, shared repositories/auth/assets/SW logic.
- Invariants: exact original scalar values and order; A:O only; selected funds; start <= date <= end. Unknown or invalid dates excluded. Future rows inside the selected period included. Invalid financial amounts retained as source values when date belongs to period. No silent date defaults.
- Risk: low, bounded export correction. Independent review confirms UI/repository/handler already transport and validate dates. No production financial queries are needed for tests.
- Tests: actual XLSX readback for boundaries, 2025/2027 exclusion, all source modes, alternate periods, invalid dates, raw cells and one-sheet contract; existing Edge/export tests; browser export arguments and draft gating; focal build, deployment tests and static publication checks.
- Recovery: revert focal commit and redeploy previous SICOF function bundle; no data recovery required.
- Global image regression: NOT APPLICABLE, only focal SICOF help and generated bundle URL change; no shared runtime or service-worker logic changes.

## PLAN

Validate applied period; filter raw rows by column A and fund; correct help; verify actual XLSX and existing paths; independent review; deploy Edge, commit/push frontend and verify static publication. Evidence records results separately.

## H-SICOF-SOURCE-PERIOD-XLSX-001 RESULT

Status: PASS

- Files changed: declared export, help, two focal tests, generated bundle/URLs, audit/evidence/changelog and derived registry only.
- Source-of-truth verdict: PASS; authenticated Google source unchanged. Original source order/types remain intact. Period selection changes no stored record.
- Invariant verdict: PASS; single sheet A:O; inclusive applied dates and funds; no unrelated financial logic changes. Eight protected modules verified unchanged against baseline.
- Build: PASS; focal v319; every unrelated bundle chunk unchanged; JavaScript compilation verified.
- Tests: PASS; actual XLSX read/write with 609/611/613 rows for caja/sel/todos; July 1 and December 31 included; 2025/2027-04-30 and invalid dates excluded. Different years, single-day and cross-year intervals checked. 18002 source rows -> 18000 in-period rows. Existing Edge and financial export suites PASS. Isolated browser and Pages validation PASS.
- Browser test correction: explicit recalculation completes before measuring the no-extra-workspace-query assertion; successful rerun recorded. No product timing change.
- Security: PASS; existing permissions and fingerprint gates retained, JWT verification enabled. No credentials or additional source data exposed to frontend.
- Legacy impact: read-only export filtering; no Google/Apps Script, calculation, savings, schema or migration edits.
- Unexpected files changed: none; original mixed line endings restored in UI source/test to preserve minimal diff.
- Independent review: sicof_base_xlsx_review APPROVED after final diff, XLSX/browser/build evidence inspection.
- Deployment: SICOF Edge v9 ACTIVE; previous v8; no production financial reads/writes during verification. Frontend publication follows commit/push, with static checks recorded privately.
- Known limitations: column A determines the period; blank/invalid dates cannot be assigned to a period and are excluded. Local stress test does not certify Edge quotas. Existing source-change protection still requires recalculating if data changed.
- Evidence: docs/qa/evidence/sicof-source-period-xlsx.json; private build/deployment/static receipts in .tmp/sicof-source-period.

## CLAUDE UI PRESERVATION REVIEW

Screen: SICOF. All eight sections, fields, buttons, cards, scenarios, modals, loading/error states, tabs and navigation preserved. Only export help changed to reflect the period. Browser checks at 320/430/1440px PASS. Unauthorized redesign: NO. Verdict: PASS.
