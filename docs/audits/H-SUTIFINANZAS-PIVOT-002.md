# H-SUTIFINANZAS-PIVOT-002

## PRE-CHANGE AUDIT

Status: PASS; implemented, published and verified.
Owner requests an interactive pivot table matching the supplied image: expand/collapse branches inline, hierarchical row fields, monthly monetary columns, subtotals, and interactively reordered/added/removed dimensions including the real expense-type field.

Scope: app/sutifinanzas-admin.jsx, app/sutifinanzas-repository.js, supabase/functions/sutifinanzas/report.mjs only for the discovered header, scripts/test-sutifinanzas.js, focal generated bundle, HTML/sw cache versions only, this audit and existing governance/architecture index. Isolated test/release helpers remain in .tmp/sutifinanzas. Preserve other dirty workspace changes.

Authority: same fixed Google workbook/tab, dedicated read-only service account and existing Admin backend permissions. Discover exact expense-type header from live authorized source before mapping. No Google writes, no financial Supabase copies, no new credentials, no SutiApp Final changes. All pivot interactions aggregate already-loaded source rows in memory; only opening/refresh reads Google. Amount remains a measure, never a grouping field.

UI contract: preserve Nunito, existing header, filters, KPIs, quality messages, refresh, loading/error/empty states and product details. Replace only the report's sequential list with the explicitly requested configurable pivot grid. Keep monetary precision and show missing dimension/date values explicitly. Expanded parents and subtotals must not double-count rows. Support pointer and keyboard reordering/expansion and accessible horizontally scrollable mobile table.

Risks/tests: arbitrary field ordering, duplicated labels across parents, missing dates/years, fractional-cent totals, subtotals, month totals, duplicate counting, long names, expansion state after filter/order change, zero extra fetches, headers moved/missing. Synthetic model/browser tests plus real read-only local/public report checks. Shared shell/helpers/auth/storage unchanged; generated focal bundle/cachebusters alone do not trigger global-image regression per AGENTS.md. Recovery: revert focal source/bundle and optional additive expense-type response field; no data rollback required.

Guardians: architecture navigator FRESH; pre-change audit; Google legacy READ ONLY; source-of-truth SAFE; backend security boundaries unchanged; UI preservation with owner-authorized report replacement; post-change verification and architect review before closure.


## Implementation and current evidence

Real source header row 1, exact TIPO DE GASTOS at observed zero-based index15; mapping uses name, not position. Backend adds expenseType, keeps it nullable when cells are blank and fails closed if header is absent. Dedicated reader v14: authorized HTTP200/1224 records, anonymous401; no credentials changed or source writes.

Configurable row fields: Secretariat, expense type, project, budget item, requisition, product, status, payment method, authoritative year. Drag/drop plus accessible move buttons; add/remove fields, restore layout, expand one level, collapse all. Parent cells remain visible with rowspans; expanded branches end in subtotal; general total always uses each filtered source record once. Monetary columns: actual expense-date month/year, authoritative A?O, or total-only. Missing periods explicit; different calendar years never merged. Existing filters/KPIs/quality states preserved. Terminal group opens all original product details plus expense type. Layout stays in component memory and survives explicit refresh; filtering/reordering clears stale branch/detail selection.

Verification so far: existing contractual suite PASS including exact/moved/missing new header, normalized expense-type search, arbitrary field order, same labels under different parents, missing fields/dates, month/year identity, decimal precision, partition counts and invalid configuration. Independent model review validates 258 hierarchy/expansion combinations without grid gaps, overlaps or duplicated records. Isolated browser PASS: five expansion levels, parent spans/subtotals, detail dialog, pointer drag, keyboard reorder, add/remove, column modes, zero row fields, contained mobile scrolling at1440/1024/768/390, touch targets44px, missing-header clears stale totals. Initial read1; all pivot actions0; refresh1. Screenshots contain synthetic fixtures only.

Release build preserves every other published bundle chunk byte-for-byte; generated changes only sutifinanzas-admin.jsx and sutifinanzas-repository.js. HTML/sw only cachebuster2026100404. test-pages-deployment PASS and no private files. Real local and public browser verification PASS; final evidence below.


## H-SUTIFINANZAS-PIVOT-002 RESULT

Status: PASS.
Files changed: report UI/model, additional exact expense-type projection, existing contract tests, two focal generated bundle chunks, HTML/sw cache versions, this audit and existing governance/registry. No shared shell/auth/storage or unrelated module changes.
Source-of-truth verdict: SAFE. Same dedicated Google read-only source. No persistence or fallback added; TIPO DE GASTOS mapped by exact header.
Invariant verdict: PASS. Arbitrary unique field order partitions source rows; requisition/product identities preserved. Subtotals and grand total are independently derived from original records without double-counting. Amount precision retained; missing values explicit.
Build: PASS (31 public files; no private files), syntax and Pages guard PASS. Only two report bundle chunks changed; hash 16325215d9a2ab1fd8b27000e4f32f738d414d119d634f75b60a4fabae8a69b6 verified in local browser and both public domains, cache version2026100404.
Tests: contractual parser/model/security PASS; 258 independently checked hierarchy/rowspan states; synthetic browser expansion/subtotals/detail, drag and keyboard reorder, field add/remove, columns, zero dimensions, focus retained through expansion/collapse, mobile containment/touch targets and fail-closed states PASS. Real local and sutiapp.com browser PASS on1224 rows: five expanded levels, source expense type connected, totals invariant under reordering, year/month/total columns, explicit refresh retains layout. Initial source reads1; pivot interactions0; refresh1. No business writes. Global image regression NOT APPLICABLE for this focal UI-only bundle plus additive report projection: no shared surface/helper/storage change, per explicit AGENTS generated-artifact rule.
Security: backend Auth+permission+module boundary unchanged; anonymous401, authorized200. No credential or legacy changes.
Legacy impact: zero Google writes, no Apps Script changes, SutiApp Final unchanged. Membership Google contract workflow SUCCESS.
Unexpected files changed: none in isolated release; existing root dirty changes preserved.
Known limitations: horizontal table scrolling is intentional on narrow displays; layout exists only in the current module session (retained by Refresh). Source missing values stay explicit. Month columns use actual expense date/year, while A?O filter and annual columns use authoritative source A?O.
Evidence: release a48caa5564b374c25d036dfb50ad4eeae7950074, Edge v14; Pages workflow37250009331 SUCCESS (Auth and request compatibility included), Membership workflow37250009275 SUCCESS; scripts/test-sutifinanzas.js; ignored pivot-browser.cjs and pivot-live.cjs. No production row fixtures or screenshots saved.

## SUTIAPP ARCHITECT REVIEW

Task: H-SUTIFINANZAS-PIVOT-002.
Verdict: APPROVED.
Critical findings: independent reviewer identified keyboard focus loss from remounting expanded rows. Fixed by stable node identity and restoring focus after expansion/collapse; both independent probe and regression test PASS. No remaining concrete defect. Model/header/security review approved, and live release checks now complete.
Source of truth: unchanged Google authority. Architecture: configurable in-memory pivot scoped to report. Security: unchanged server gate/dedicated account. Data: no mutation or double-counting. Legacy: untouched.
Owner decision: NO.
Next action: close this H and explain row-field drag/buttons, +/-, and month/year/total selectors.
Response generated for Codex: YES.

### RESPONSE TO CODEX

Close H-SUTIFINANZAS-PIVOT-002 with PASS. Provide the existing public route and the newly supported configurable grouping. Preserve source-only reading and the isolated SutiApp Final boundary. Do not advance to unrelated work.
