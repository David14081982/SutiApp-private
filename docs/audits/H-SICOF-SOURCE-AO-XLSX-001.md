# H-SICOF-SOURCE-AO-XLSX-001

## PRE-CHANGE AUDIT

Status: PASS. Owner explicitly replaces the multi-sheet calculation-backing export
with one worksheet containing HISTORIAL P V2 columns A through O, filtered by the
applied source-of-pool funds. Standing publication/commit/push authorization applies.
Navigator: FRESH at ec8b78d; directed SICOF lookup and source inspection completed.

Scope: this button's XLSX only. Export all source rows for the applied funds, in
source order; no additional date, search, screen-pagination or reconciliation filter.
The latest request specifies fund filtering only. Caja means Caja de Ahorro; selected
means the existing Caja plus additional selected funds; todos means all source funds.
One header row with original validated headers, exactly 15 columns, no other sheets,
metadata tables, computed allocations or replacement projected values.

Declared files: supabase/functions/sicof/loan-source.mjs, handler.mjs, exports.mjs;
scripts/test-sicof-loans.js, test-sicof-edge.js, test-sicof-calculation-base-export.js;
this audit, docs/qa/evidence/sicof-source-ao-xlsx.json, docs/AGENT_CHANGELOG.md and
derived architecture Registry if the raw source dependency changes the mapping.
Private helpers under .tmp/sicof-source-ao. Existing root work is preserved; release
checkout remains isolated at .tmp/sicof/release.

Authority: existing authenticated SutiApp Final / HISTORIAL P V2 GAS observation.
Retain validated headers and column mapping from that observation, and pass it only
to the authorized export. Source scalar values are not reconstructed from loan
analysis, rounded, corrected, recalculated or replaced by pending/projection labels.
One existing source read per requested export; no extra Google call or persistent copy.
Current actor/module/export authorization and calculation/source fingerprint recheck
remain. Other export formats, calculations, saved scenarios and savings are unchanged.

Risk: wrong A:O order; using derived interest instead of original M/N; zero/blank or
formatted identity loss; executable formula-looking strings; accidental extra sheets;
wrong selected-funds semantics; unnoticed source change. Verify with actual ExcelJS
readback, 600+ rows, all fund modes, pre/post-period rows, raw M/N values, leading
zeros, dates, null/zero/boolean/text preservation, error rows, no source mutation,
exact one source read and unchanged authorization/fingerprint rejection.

Migration: NOT APPLICABLE. Financial writers/rows, Google deployment/credentials,
RPCs, schema and permissions unchanged. Legacy classification: SAFE CHANGE to read
projection/export only, with output contract explicitly replaced by owner request.
Recovery: redeploy baseline Edge v7 package; no data recovery required.
Global image regression: NOT APPLICABLE; no shared component or SW logic change.
Use source-of-truth, legacy Google, security and post-change verification guardians;
independent architect review before publication. No production financial queries
required for validation; synthetic exact-source fixtures exercise the format.

Scope clarification before copy edit: independent review found existing button help
still promised projections, savings and costs. Add app/sicof-admin.jsx and the existing
UI test for that exact help text, plus generated bundle/SutiApp.html/sw.js v318.
Only this explanatory sentence changes; button action, disabled/loading states,
eight tabs, sections, layouts and all other controls remain. Apply the UI preservation
guardian and existing isolated browser test. No shared runtime change; generated
artifacts do not trigger global image regression under AGENTS.md.

## Result and evidence

Implemented exactly one HISTORIAL P V2 worksheet with original validated A:O headers
and typed source values. No additional worksheets, summaries, incident columns,
financial transformations, period clipping or screen limits are added. Original
M/N amounts and H fractional rate are not reconstructed from calculated components.
Leading-zero identities remain text; null stays blank, while zero, false, empty text
and formula-looking strings preserve their types. Source headers are retained privately
from the same existing read; they do not enter WORKSPACE or change financial analysis.

Dedicated actual ExcelJS round-trip PASS for Caja (608 rows), selected (610), all
(613), empty matches, raw errors/old/future dates and all scalar cases. One 18,000-row
fixture produced a 1,026,714-byte XLSX and preserved all rows. That local process
includes earlier workbooks and readback; its memory/time is not an Edge quota test.
Tests also verify source immutability, missing raw source and mismatching fingerprints,
and reject unrelated presentation filters. Existing export, historical/continuous,
source-reader and Edge tests PASS. Backend tests preserve authorization before source,
one source read per export, denied/stale rejection and no financial writes.

UI browser PASS for the corrected help text and all existing tabs, controls, dialogs,
errors, export commands and responsive viewports. Build v318 replaces only the focal
SICOF admin chunk; other chunks are identical. Pages allowlist PASS. No shared runtime,
service-worker logic, schema, migration, financial writer or Google deployment change.

Edge v8 is ACTIVE with verify_jwt=true; the deployed package hashes are recorded in
qa/evidence/sicof-source-ao-xlsx.json. No production financial query/download was used
for testing. The independent architect approved the backend/output contract and
identified the stale helper sentence, which was corrected and tested before closure.

```text
H-SICOF-SOURCE-AO-XLSX-001 RESULT
Status: PASS
Files changed: three focal backend modules, four focused tests, button help,
 generated v318, audit/evidence/changelog and derived Registry
Source-of-truth verdict: SAFE; original authenticated source observation
Invariant verdict: PASS; financial engine, policies and other reports preserved
Build: PASS; focal bundle and Edge v8 active
Tests: PASS; exact ExcelJS A:O round-trip, 18000 rows, source/Edge/exports/UI
Security: PASS focal; existing permissions and source/context check retained
Legacy impact: read metadata retained; Google transport/formulas/writers unchanged
Unexpected files changed: 0; unrelated root work retained
Known limitations: local volume test does not certify Edge quotas; no live export
Evidence: docs/qa/evidence/sicof-source-ao-xlsx.json
```
