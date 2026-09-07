# H-SAVINGS-NAVIGATION-001

PRE-CHANGE AUDIT
Status: PASS
Owner requests plain Spanish throughout Savings Admin and direct person navigation without scrolling past the list. Explicit UI redesign authorization supersedes preservation of the problematic stacking/copy; existing sections, filters, actions and permissions remain.

Scope: app/screens-admin-savings.jsx and app/savings-review-admin.jsx; generated bundle, SutiApp.html/sw.js version only; focused navigation/browser tests including existing review and dependent operations/identity fixtures; audit, evidence and changelog. Apply equivalent focal changes in main and isolated delivery based on bcdbd96, preserving unpublished operations 001-004 and unrelated Auth work. Delivery receives only the existing safe participant request sequencing needed to prevent stale-person display, with unchanged Repository calls.

UI contract: 18 published tabs (19 in pending main), participant list/search/selector, person summary and existing actions, private review filters/pages/source/proposals/optional observations/preview/history/read-only/error states. Preserve them. Review opens a native accessible dialog immediately with loading/error/retry, fixed person header, previous/next filtered record, return to list, unsaved-change protection, focus restoration and native keyboard containment. Administrative participant selection opens a dedicated in-screen view, hides global list/metrics while selected, and restores the prior list position. No silent save or financial recalculation.

Authority: Savings existing read RPCs and private review proposal writer unchanged. No Supabase SQL/RLS/Auth/access changes, no financial data edits, no Google reads/writes/scripts/formula changes, no public saver screen edits. Exact Folio and immutable source field keys retained; friendly labels are display only. Recorded versus original balance remain distinct and retain the same amounts. No mocks/fallback/browser persistence introduced; fixtures isolated.

Risks: stale response showing another person, hidden validation errors in dialogs, lost unsaved proposal, lost list position, technical enum leakage and small-screen overflow. Verify these with browser fixtures, existing review save/retry/optional-note tests, dependent Admin tests and exact bundle chunk comparison. Public smoke with/without SW; global image matrix NOT APPLICABLE because no shared shell/Auth/asset/repository logic changes and SW change is version only.

Recovery: revert only this frontend delivery; no data recovery needed. Registry lookup FRESH at start; copy/CSS/microinteraction and local request sequencing introduce no route/repository/RPC/table/permission/authority dependency. Document hash staleness rather than claiming structural regeneration if only these change.
