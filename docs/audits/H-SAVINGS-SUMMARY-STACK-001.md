# H-SAVINGS-SUMMARY-STACK-001

## PRE-CHANGE AUDIT

Status: PASS.
Authorization: owner's three screenshots require the complete savings summary above Cobranza / Ahorradores / Retiros y cambios / Revisión, on mobile and desktop; fix the squeezed right-hand content in the phone frame.

Cause confirmed by directed inspection: SutiApp.html uses a 430px phone frame on a larger viewport; savings-panel-admin.jsx applies a viewport min-width:850px two-column grid with a fixed 340px summary column. The remaining content can shrink to a few pixels. Existing browser tests checked viewport widths but did not check a narrow frame inside a wide viewport.

Navigator: main registry is stale due retained earlier work. Delivery registry at commit 370b9c515898a008395f37238da9e603bc9107f5 is FRESH. The existing route exports SavingsPanelAdmin and consumes SavingsPanelRepository. Confirmed against actual source. No architecture dependency changes are needed for this CSS-only fix; do not regenerate the main pending registry.

Scope/files: CSS string only in app/savings-panel-admin.jsx; layout regression mode in scripts/test-savings-reference-panel-browser.js; this audit and docs/qa/evidence/savings-summary-stack-20260907; generated app/bundle.js and cache identifiers in SutiApp.html/sw.js for isolated release. Preserve all unrelated pending changes and vendor bytes. Evidence scripts in tmp are local orchestration only.

Plan: keep the existing DOM summary-first order, use a single column at every size, remove the sticky sidebar, use the savings container width for detail and small-screen adjustments, and keep correction sheets within that width. Retain cards, typography, amounts, tab behavior, histories, filters, corrections, optional observations, and navigation. Compare the narrow frame on a wide viewport before/after and test mobile/desktop, resize, detail and sheets.

Data: none changed. Tables/APIs/writers/permissions/calculations: unchanged. No external Supabase or Google read/write is needed. No repository/store/fallback/identity changes. Legacy classification: SAFE CHANGE, visual-only equivalence established by an identical non-CSS source body. No financial SQL tests or migrations are justified for this fix.

Risk: responsive rules affect lists/detail/sheets within this module; mitigate by container tests at 320/375/390/430 inside a 1440px viewport, native mobile widths and full desktop, plus existing interaction checks. This is a bounded correction to the current screen, not a claim to complete the previously disclosed financial operation gaps.

Recovery: restore the prior module CSS and regenerate bundle/cache identifiers. No data recovery required. Global image regression NOT APPLICABLE: no global shell/Auth/Storage/repository/SW logic changes; cache identifiers are generated artifacts only.

UI contract: complete summary precedes all four tab capsules. Same sections and controls remain. Desktop no longer has a savings sidebar; this change is explicitly requested by the owner. No additional data or authority. No unrelated redesign.
