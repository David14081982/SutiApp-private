# H-SUTIFINANZAS-EXPORT-004

## PRE-CHANGE AUDIT

Status: PASS for implementation; verification pending.
Objective: owner requests Excel export of the current expanded/collapsed folders and subfolders in SUTIFINANZAS.
Scope: app/sutifinanzas-admin.jsx, app/sutifinanzas-repository.js, scripts/test-sutifinanzas-export.js, focal generated bundle chunks, isolated release HTML/sw cache versions only, this audit and existing changelog/derived registry. Existing same-origin vendored ExcelJS 4.4.0 is already in the published artifact; no new dependency or shared helper edits.
Authority: Gasto por secretaría in the existing fixed Google workbook remains authoritative. Export is an explicitly requested downloadable derivative of the authorized in-memory report, never an input/fallback or persisted app store. User owns the downloaded file. No Google reads on export, no Google or Supabase financial writes, no backend/credentials/SutiApp Final changes.
Plan: centralize the existing visible pivot row projection, reuse it for both screen and XLSX. Capture current filters, sort, configured row fields, period columns, expansion set and source consultation time at click. Export only visible aggregate/leaf/subtotal rows plus the existing grand total, no hidden branch children or extra details worksheet. Keep amounts numeric, preserve decimal values and display MXN, use text cells for source labels including formula-like strings; freeze row dimensions and headers. Include readable source/filter context and export time. Lazy-load existing integrity-pinned ExcelJS; explicit busy/error states, no success on failure. Cancel download if session/context, source generation or mounted module changes during asynchronous generation.
UI contract: keep Nunito, filters/KPIs, drag and keyboard field ordering, inline expansion, detail, subtotal layout, frozen dimensions/month scrolling and refresh behavior. Add one Exportar a Excel button and a concise scope hint. Desktop field columns remain separate in XLSX even when the narrow UI uses a compact hierarchy.
Risks/tests: exact row selection/merges under mixed expanded branches and reordering, duplicate labels with distinct IDs, missing fields, zero dimensions/empty filters, monthly/yearly/total modes, fractional cents, formula injection, async snapshot/state changes and library failure, source reads unchanged. Test actual XLSX readback and browser download with synthetic rows; real public checks only sanitized metrics and in-memory buffers, no real row fixtures persisted.
Recovery: revert focal source/generated chunks and cache versions. No data rollback required. Global image regression NOT APPLICABLE: no shared runtime/auth/storage/service-worker logic changes. Root unrelated changes preserved; release from existing isolated checkout.
Guardians: Navigator FRESH, pre-change, source-of-truth SAFE, legacy READ ONLY, UI preservation, post-change and independent architect review.


## Implementation / pre-publication verification

Shared visibleRows projection is unchanged from the existing grid traversal and now feeds both screen and XLSX. Closed branches contribute only their aggregate row; expanded branches preserve visible children, parent merges and subtotals. Exported monetary columns, active row order, filters and sorting match the clicked view. Includes consultation/export timestamps, numeric original amounts with MXN formatting, exact text labels, Nunito, long-label row heights and frozen identification/header panes. One worksheet only; no hidden detailed records. No regrouping or financial recalculation added.

Verification PASS: real ExcelJS XLSX serialization/readback (visible mixed branches, exact merges, hidden-node exclusion, duplicate labels with distinct identities, negative/fractional amounts, formula-like source text, long labels, nine fields, zero fields/empty, all column modes, reorder); library integrity/failure/timeout/retry; original report contract. Independent synthetic browser13 actual downloads matches rendered DOM rows/labels/amounts/merges, compact390px exports full configured hierarchy, empty export disabled, click snapshot survives filter change, generation/library failure and retry, refresh/unmount/context changes cancel3 stale downloads. Initial read1; export reads0. Existing pivot functional and frozen geometry suites PASS. No production row fixtures saved.

Build PASS:31 public files; existing vendored ExcelJS reused, no new dependency or shared helper changes. Isolated bundle changed only sutifinanzas-repository.js and sutifinanzas-admin.jsx, preserving152 other chunks. Cache2026100406; SHA256312e3bdf529a524d97885af6175ccd52fd0bcded937a90cf67a4d0c0bdca6b76. SRI test uses published LF bytes, matching existing vendor normalization in the public build; root and isolated roundtrip suites PASS. Pages guard PASS.

Real local/public acceptance and publication receipt pending. No backend/schema/credentials/Google writes.


## H-SUTIFINANZAS-EXPORT-004 RESULT

Status: PASS.
Files changed: app/sutifinanzas-admin.jsx, app/sutifinanzas-repository.js, scripts/test-sutifinanzas-export.js; two focal generated bundle chunks; isolated release HTML/sw cache versions only; this audit, existing changelog and derived architecture index.
Source-of-truth verdict: SAFE. Same authorized Google-only report. Download is an explicitly requested derivative of the clicked in-memory view, with consultation/export timestamps; never an alternative source or app-persisted copy.
Invariant verdict: PASS. Visible rows, hierarchy order, filters, sorting, period columns, original decimal amounts, parent/subtotal merges and independently derived grand total preserved. Closed descendants excluded; no hidden detail sheet or formula execution. Export never sums subtotal rows to obtain totals.
Build: PASS.31 public files, no private files.152 unrelated bundle chunks unchanged. Both public domains match SHA256312e3bdf529a524d97885af6175ccd52fd0bcded937a90cf67a4d0c0bdca6b76, cache2026100406. Existing vendored ExcelJS bytes/integrity verified; no new library or shared runtime edit.
Tests: PASS. Original parser/model/security contracts; actual XLSX roundtrip suite including numeric fractional/negative amounts, formula-safe strings, identity distinction, long labels, nine fields, zero fields/empty, all period modes, reorder and lazyloader error/timeout/retry. Existing pivot functional and frozen geometry suites PASS. Independent browser13 actual XLSX downloads matched rendered labels/amounts/rows/merges, including compact mobile and empty filter;3 stale-export cancellation scenarios PASS. Real local and sutiapp.com readback verified4 downloads each:19 collapsed visible rows,94 rows with5 levels open,125 rows after field reordering,125 in total-only mode. All exported numeric displays equal the corresponding UI cells and total; source returns1224 records. Initial read1, report interactions/exports0 additional reads, explicit refresh1. Browser errors0; business writes0. Global image regression NOT APPLICABLE under focal-generated-artifact rule.
Security: existing backend gate unchanged; asynchronous export canceled on source generation/session/context change or unmount. Source text remains Excel string, including leading equals. Explicit export failures permit retry; no stale download or fallback. No credentials changed or exposed.
Legacy impact: NONE. No backend deployment, Google writes, Apps Script, schema or SutiApp Final changes. Auth/request compatibility and Membership Google contract passed.
Unexpected files changed: NONE in isolated release. Root unrelated work preserved.
Known limitations: XLSX is a snapshot of visible branches at click; hidden children are not embedded for later expansion. Scroll position does not limit export rows/months. Compact screen layout becomes the full configured field columns in Excel. Current local-only file can be kept by its downloader but is never read back by SutiApp. Existing report refresh and global shell breakpoint remount behavior unchanged.
Evidence: release06c5bb471e9859d53c07c6cb1c88c4a1160fa0a8; Pages37253866112 SUCCESS; Membership37253866058 SUCCESS; both domain public hash/cache checks PASS. scripts/test-sutifinanzas-export.js, scripts/test-sutifinanzas.js, scripts/test-pages-deployment.js; ignored export-browser.cjs, export-live.cjs, export-public.cjs, pivot-browser.cjs and frozen-browser.cjs. Actual downloaded workbooks inspected in ephemeral memory, no financial row snapshots added to repository. Local preview stopped.

## SUTIAPP ARCHITECT REVIEW

Task: H-SUTIFINANZAS-EXPORT-004.
Verdict: APPROVED.
Critical findings: no unresolved implementation defect. Independent reviewer validated exact visible projection, safe XLSX text/numbers, async guards, UI preservation and isolated scope. The unit test normalizes vendor line endings consistently with the existing public builder; root/release tests and actual browser integrity loading passed.
Source of truth: unchanged Google authority. Architecture: focal visible-view XLSX derivative. Security: existing authorized report, cancellation guards and no formula injection. Data: unchanged values; no financial persistence. Legacy: untouched.
Owner decision: NO.
Next action: close this H and explain Exportar a Excel and the opened/closed branch behavior.
Response generated for Codex: YES.

### RESPONSE TO CODEX

Close H-SUTIFINANZAS-EXPORT-004 with PASS. Report that the published Excel button exports the current filters, field order, periods and visible hierarchy, with closed branches summarized. Preserve source-only reading and SutiApp Final. Do not advance to unrelated work.
