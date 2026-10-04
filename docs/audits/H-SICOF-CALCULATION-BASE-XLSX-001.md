# H-SICOF-CALCULATION-BASE-XLSX-001

## PRE-CHANGE AUDIT

Status: PASS. Owner narrowed scope to XLSX download of data used for the selected
source-of-pool calculation. Mirror/synchronization redesign explicitly rejected.
Navigator: FRESH, release 4f5755c; SICOF files and fixed source inspected.
Scope/files: app/sicof-admin.jsx; supabase/functions/sicof/exports.mjs;
scripts/test-sicof-calculation-base-export.js (new), scripts/test-sicof-ui-browser.js,
scripts/test-sicof-edge.js; generated app/bundle.js, SutiApp.html and sw.js version;
derived architecture registry, this audit and docs/qa/evidence/sicof-calculation-base-xlsx.json.
No changes to repositories, synchronization, schemas, SQL, financial engine, Google
reader, permissions, financial writers, historic workbook or existing reports.
Authority: same get_admin_sicof_context and fixed HISTORIAL P V2 reader; EXPORT
revalidates source/context fingerprint against the on-screen calculation before
generating a file. Changed data rejects export visibly; no cache or stored version.
APIs: existing authenticated SICOF EXPORT path, one new report kind base_calculo.
Legacy: READ ONLY; export projects existing calculation and validated analysis only.
Source-of-truth: SAFE, same authorities, no alternative persistence or new writer.
Security: backend can_export plus actor/session/effective-affiliate guards unchanged.
UI: preserve eight tabs, all parameters, metrics, dialogs, filters and downloads;
add one XLSX button under source selector, disabled for unapplied/failed/loading drafts.
Risk: wrong selected funds, partial pagination, projected/collected confusion, stale
draft fingerprint, formula-injection and spreadsheet totals not matching the engine.
Tests: isolated actual XLSX readback for Caja/selected/all, full rows beyond UI limit,
amounts/unknowns/costs/projection, backend fingerprint and permission rejection;
Chrome download command, disabled drafts and visible source-changed error; prior exports.
Production validation: deployment metadata and static bundle only. No repeated paid
financial queries, no artificial financial transactions. Exact Edge package hashes.
Recovery: redeploy prior Edge v5 and revert focal frontend to 4f5755c; no data rollback.

## IMPLEMENTATION AND VERIFICATION

The new button below Fuente de la bolsa submits base_calculo through the existing
authorized EXPORT command. It includes applied settings, costs, bank declaration
and fingerprint. Draft, failed or loading calculations cannot be downloaded.
The backend preserves its source/context reread and rejects changed fingerprints.
No persisted calculation version, mirror or synchronization changes were added.

The workbook includes Resumen, Pagos, Reparto formulado, Desglose, Costos,
Parametros, contracts, savings composition and rules, relevant source incidents
and source/fingerprint metadata. Actual and projected income remain separate.
All selected rows are included; screen pagination and search filters do not limit
the file. Loans affecting saver rules from other funds are explicitly separated.
The existing report kinds and historical workbook were preserved.

Validation used the actual calculation engine and ExcelJS readback: Caja 608 rows,
selected funds 610, all funds 611. The tests check 98 percent distribution, costs,
reserve spill, unknowns, exact Folio, formula safety, rejected mismatches and input
immutability. A reviewed omission of prior-period contract incidents was fixed;
source row 801 is retained and unrelated incidents excluded by the test.
Existing exports and Edge tests passed. Chrome used blocked network and checked
all eight tabs, the three pool selections, disabled unapplied changes, source-change
errors and widths 320/430/1440. The new button fits without horizontal overflow.

The focal v316 bundle build verifies every other compiled component is unchanged.
Pages packaging passed with zero forbidden files. Edge SICOF v6 is ACTIVE with
JWT verification enabled; package hashes are recorded in the structured evidence.
Production verification uses only deployment metadata and static frontend files;
there are no financial queries or transactions for validation.

Independent architect review: APPROVED. No unresolved technical findings; no owner
decision required. Source-of-truth SAFE, security focal PASS, legacy READ ONLY.
The review required final evidence, focal Registry update and authorized release.
Architecture Registry generation and its validator are mandatory release gates;
their command output is recorded during release, after these evidence files settle.

## H-SICOF-CALCULATION-BASE-XLSX-001 RESULT

Status: PASS (implementation and isolated verification).
Files changed: declared focal files above, dedicated test, evidence and derived Registry.
Source-of-truth verdict: SAFE; protected source and financial readers unchanged.
Invariant verdict: PASS; no ledger, historic data, policy or financial engine edits.
Build: PASS, frontend v316, other bundle chunks unchanged.
Tests: PASS dedicated XLSX, prior exports, Edge, isolated Chrome and Pages packaging.
Security: PASS focal; backend authorization and fingerprint validation unchanged.
Legacy impact: READ ONLY; no Google, formula, trigger, SQL or migration modifications.
Unexpected files changed: none in isolated release scope.
Known limitations: export rereads the existing sources; changed data requires updating
the on-screen calculation. No authenticated production download was exercised.
Global image regression: NOT APPLICABLE; generated artifacts do not broaden this H.
Evidence: docs/qa/evidence/sicof-calculation-base-xlsx.json and release command output.
