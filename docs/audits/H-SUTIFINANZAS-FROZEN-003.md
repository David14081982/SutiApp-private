# H-SUTIFINANZAS-FROZEN-003

## PRE-CHANGE AUDIT

Status: PASS for implementation; verification pending.
Owner requests fixed identification columns through Producto while months remain visible and scroll horizontally.
Scope: app/sutifinanzas-admin.jsx only; focal generated bundle chunk, HTML/sw version only in isolated release, this audit and existing changelog/derived registry. No model/backend/Google/credentials/schema changes.
Contract: retain configurable hierarchy, inline expansion, merged parent/subtotal cells, detail, filtering, monetary precision, refresh and memory-only operation. Freeze the active row-dimension area, calculate offsets in current field order, and reserve visible monetary space. On narrow containers use one fixed compact hierarchy column retaining every configured field, control and expanded branch; never let fixed fields cover all month columns.
Plan: measured container width, deterministic colgroup and fixed table layout, sticky offsets on header/body/subtotal/footer cells, opaque backgrounds, month header alignment, responsive total pinning. One semantic table; no duplicated hidden controls or synchronized copy of data.
Risk/tests: colSpan/rowSpan width drift, overlap with total/months, sticky header stacking, arbitrary field order, empty fields, viewport/sidebar resize, keyboard focus and detail, horizontal+vertical scrolling. Synthetic geometry and existing functional browser suite plus live published check. No new low-value permanent tests; ignored focused QA helper exercises actual layout.
Authority/security/legacy: unchanged Google-only in-memory source, dedicated reader and admin backend gate. Zero data writes; SutiApp Final intact. Existing non-focal dirty files preserved. Global-image regression NOT APPLICABLE under focal-generated-artifact rule: no shared logic changed.
Recovery: revert one UI source/generated chunk and cache versions. No data recovery needed.
Guardians: Navigator FRESH, pre-change, source-of-truth unchanged SAFE, UI preservation, post-change verification and independent review.


## Verification before publication

Focal implementation complete. All configured row fields are frozen with deterministic colgroup widths and offsets based on their current order. The actual container is measured, including sidebar width. A full monetary column remains visible; on desktop Total stays on the right. Compact layout keeps all configured hierarchy levels and controls in one fixed column when six separate columns would cover the months. Single semantic table, original row/colspans retained on desktop.

Synthetic Chrome checks PASS: 36 geometry cases covering start/middle/end horizontal scroll, vertical scroll, collapsed/expanded rowspans/subtotals/footer, Producto first/middle, zero/one/nine fields and widths1440/1024/768/390. Fixed cells drift less than1px, monetary columns132px and header/body alignment match; no page overflow. Available month area at default desktop1440=428px,1024=262px, compact768=336px,390=210px. Resize of the report itself preserves expansions without reading Google. Existing functional suite PASS including keyboard focus, drag and keyboard reorder, field add/remove, detail, filters, zero dimensions, refresh and fail-closed missing-header display.

Independent reviewer caught overlap in Solo total header. Resolved with visible label Importe / MXN and full descriptive title; first header is38px at all four widths after vertical scroll. Independent recheck APPROVED. No extra financial calculation introduced. scripts/test-sutifinanzas.js and test-pages-deployment.js PASS; static build31 files, no private files. Generated bundle changes only sutifinanzas-admin.jsx, preserving153 other chunks; SHA256 38b685dfe948bcf2188d2676de25311994a5863c6128ae000446650045a197eb. Release cache2026100405; no service-worker logic changes.

Existing app-shell breakpoint behavior: changing between desktop/mobile remounts the report and causes its normal initial read. This predates and is outside the focal layout change. Browser live suites therefore test widths within each existing shell mode; local component resize retains state without remount. No shared-shell changes authorized or required for fixed columns.

Publication/live checks pending. No backend deployment, credentials, source data or legacy files changed.
