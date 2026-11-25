# H-FINANCE-HISTORY-ACCORDION-001

## PRE-CHANGE AUDIT - 2026-11-25

Status: PASS. Owner explicitly approved a default-collapsed accordion for Revision de historial requerida, then commit, push and publication.

Scope: presentation only in HistoricalReviewQueue, app/screens-admin-finanzas.jsx. Match the adjacent SavingsLoanAccessAdmin and LoanAvailabilityAdmin cards: surface, 14px radius/padding/margin, existing shadow, bold title and directional arrow. Preserve all copy, counts, individual details/evidence/events, loading/error/empty/retry states, surrounding sections, tab controls and navigation. Keep the existing repository read and authority/context invalidation unchanged. The body remains mounted while hidden so individual expanded cases survive collapse/reopen.

Authority: existing AdminFinanceQueueRepository.historicalReviews and backend list_admin_loan_historical_reviews. No data, SQL, financial formula, historical resolution, Google, Storage, permission or repository changes. Legacy READ ONLY; source-of-truth SAFE. Screenshot and existing two neighboring cards define the authorized visual change. No additional visible information or actions.

Files: app/screens-admin-finanzas.jsx; generated app/bundle.js; only bundle cachebuster in SutiApp.html; existing scripts/test-loan-manual-review-ui.js and scripts/test-loan-manual-review-production.js adapted to open the new accordion; this audit; docs/AGENT_CHANGELOG.md; sanitized docs/qa/evidence/finance-history-accordion/. Temporary scoped build, baseline and read-only production verification helpers under .tmp/finance-history-accordion/.

Release: isolated .tmp/finance-history-accordion/release-local based on main bf4308a7ccf816091d4956bd46e1edca892fa85b, confirmed through GitHub. Root workspace has extensive unrelated/preexisting changes and an older Finance source, so no wholesale source or bundle copy from root. Original .tmp/history-debt/release checkout is read-only. Interrupted network clone is left untouched; no deletion.

Plan: edit only this component; adapt existing focal browser verification for collapsed/expanded/keyboard/retained nested details and unchanged surrounding controls; regenerate only its bundle chunk using the existing Babel configuration; verify all other chunks unchanged; run standard Pages build; inspect diff; commit/push only scoped files; observe successful Pages deployment and compare public artifact hash; verify actual production accordion without financial writes.

Risk/recovery: simple reversible view state. Preserve original component body and mounted children. Restore only this feature commit if a regression appears, without replacing unrelated remote changes. No data recovery needed. No global image regression: shared repositories, assets, Storage, viewers, routing/Auth and sw.js logic stay unchanged. Bundle/cachebuster are GENERATED_ARTIFACT only. No structural architecture mapping changes; registry update NOT APPLICABLE. Navigator root registry is stale due prior task evidence; directed inspection verified the actual deployed component in the newer checkout.

Verification: existing focal UI suite with real Chromium and isolated fixtures, desktop/mobile, Enter/Space, toggle/reopen, no extra data reads, states and neighboring controls; local public artifact; live read-only DOM and deployed hash; post-change-verification and architect review before closure. Build/test failure is not PASS.

## Pre-publication verification

Build PASS: standard scripts/build-pages-site.js; evidence build.json includes artifact SHA256. The focal compiled chunk is the only changed chunk; 178 other chunks are byte-identical after line-ending normalization. sw.js and public data configuration unchanged.

Tests PASS: SUTIAPP_EVIDENCE_DIR=docs/qa/evidence/finance-history-accordion node scripts/test-loan-manual-review-ui.js --queue-only. Chromium with real adjacent card components, 12 isolated synthetic cases, 390/1280 widths, initial collapsed state, Enter/Space, nested detail retention, single initial read/no toggle reads, evidence/event details and no browser errors/network calls. Synthetic screenshots inspected. Production contract test adapted to explicitly expand the panel; its impersonation/borrower scenarios were not executed for this visual task.

Limitation: the initial broad test invocation timed out in its preexisting borrower HISTORICAL_LOAN_MAPPING_REQUIRED fixture before reaching the modified component. It is not reported as PASS. The added queue-only mode executes the actual focal component and neighboring accordions independently. The unchanged loading/error/empty/retry branch and all body content were checked directly against the baseline source.

CLAUDE UI PRESERVATION REVIEW
Screen: Admin / Finanzas / Solicitudes.
Original sections: Savings eligibility, loan availability, historical review list, existing Finance controls.
Current sections: identical; authorized historical review wrapper becomes a compact accordion.
Missing sections: none.
Added sections: none.
Interactions preserved: nested details, original repository/context refresh and retry. Button includes aria-expanded/aria-controls and native keyboard behavior.
Navigation preserved: source outside HistoricalReviewQueue unchanged.
Visual structure preserved: neighboring card surface/radius/padding/margin/shadow adopted as requested; content retained.
Unauthorized redesign: NO.
Verdict: PASS.

Publication and live verification remain required before final closure.
