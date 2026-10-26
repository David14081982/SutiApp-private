# H-HISTORY-TOTAL-PAID-001

## Pre-change audit

Owner explicitly approves the Total pagado rule and commit/push/publication: within the exact authenticated Folio D and loan ID C, sum column B only for valid dates A on or before the current Hermosillo calendar day. Future-only complete loans have zero paid. Zero past/today cuotas remain No se descontó. Missing/invalid dates or amounts remain explicit rather than zero. This supersedes V as the source for this own-history display total only; it does not change financial records, Google formulas, loan workflows or other consumers.

Baseline: published main 360a1e965a14eb946cd3aa962c1e2f98646200ca, isolated fix/history-total-paid checkout. Navigator check/lookup on the equivalent published tree is FRESH and identifies the history projector/repository/detail and snapshot boundary. Root worktree has unrelated work and is preserved.

Authority: published Google A/B/C/D rows remain authoritative; paid total is a disposable derived presentation. Principal J and total K remain the same single-loan values. V/W are retained in observations for existing consumers, but V no longer determines Total pagado here. No persisted derived total, fallback, new source, schema, migration, RPC, request or cache is introduced. Server and browser must agree; the browser uses the existing server-anchored clock to cross Hermosillo midnight without refetching schedules.

Declared product scope: supabase/functions/loan-history/history.mjs; app/history-loans-repository.js; copy only in app/history-loans.jsx and app/history-statement.js. Generated app/bundle.js and SutiApp.html/sw.js version references only. Existing request/approval/status/ownership, cuota numbering/state/order, PDF pagination/download, manual/daily sync, Google/Apps Script, database, shared Auth/routing/assets and other financial modules are out of scope.

Declared verification/governance scope: scripts/test-history-total-paid*.js; targeted existing history browser/runtime/core tests only to align obsolete V-based fixtures; docs/audits/H-HISTORY-TOTAL-PAID-001.md; append-only SOURCE_OF_TRUTH, INVARIANTS, DECISIONS, LEGACY_GOOGLE_SYSTEMS and AGENT_CHANGELOG; derived architecture registry/overrides for this authorized authority mapping; sanitized docs/qa/evidence/history-total-paid. Private live receipts/backups/scripts under .tmp/history-total-paid. No customer identifiers/records in public tests/evidence.

Plan: validate each complete schedule, sum qualifying amounts once per source row without rounding/changing individual values, reject invalid/negative/non-finite amounts and invalid dates as unavailable; preserve overflow handling. Do not convert unavailable/preparing/empty schedules to zero. Keep existing balance/progress/excess formulas using the new derived paid amount. Rename the label to Total pagado in detail and statement only; preserve UI structure/styles and PDF design.

Risk/verification: server-browser parity, exact-day/Hermosillo midnight boundary, past/today/future/zero, decimals, multiple loans and exact owner isolation, deliberately conflicting V ignored, malformed dates/amounts, source immutability, no duplicate summation, aggregate overflow, preparing state, approval update/24h independence, open detail/scroll, PDF consistency, unchanged network cadence and sync. Run focal regressions, build and Pages/PWA; compare bundle chunks/protected paths; review mobile 320/390 and desktop. Independent review before release.

Recovery: privately back up active loan-history Edge v6 and exact three modules; deploy only the same authenticated reader after parity tests, then reviewed frontend. Revert Edge/frontend to the prior version if needed; no financial data or database rollback is required. Global image regression NOT APPLICABLE: no shared assets/Auth/routing/SW logic change; generated bundle/cachebuster only.

Status: PASS for this owner-authorized focused implementation. Legacy classification READ ONLY for all source systems; SAFE CHANGE for the explicitly approved presentation calculation after verification.

Implementation review refinement: the reviewer reproduced a false zero-valued excess-payment notice from naive binary addition (0.1+0.2 against total 0.3). The scoped sum therefore accumulates the literal decimal representations exactly, including exponents, with conversion to Number once at the final boundary. Individual source amounts and existing metrics remain unchanged. Tests must assert the expected decimal sum and absence of a false excess, not compare against the same naive addition.

Navigator checkout note: the new Windows checkout initially reports prior committed documentation/test/migration hashes stale due to LF/CRLF conversion, plus this added audit. Directed inspection confirms the same published source tree; final Registry regeneration/check will use the final checkout bytes. No stale metadata is used as runtime authority.

## Verified implementation and release candidate

The final backend/browser helpers use identical decimal coefficient/scale accumulation. Existing balance/progress/excess formulas consume that total unchanged. The only detail/PDF edits are the requested label replacement; inverse replacement reproduces both baseline files exactly. Source arrays, J/K/X, quota numbering/state/order, approvals and synchronization retain their contracts.

Verification commands passed: `node scripts/test-history-total-paid-runtime.js`; `node scripts/test-loan-history.js` (including isolated PGlite); `node scripts/test-history-snapshot-runtime.js`; `node scripts/test-history-immediate-approval-runtime.js`; `node scripts/test-history-total-paid-browser.js`; `node scripts/test-history-snapshot-browser.js`; `node scripts/test-history-immediate-approval-browser.js`; `node scripts/test-history-pending-requests.js`; `node scripts/build-bundle.js C:/tmp/babel-standalone-7.28.4.min.js`; `node scripts/test-pages-deployment.js`; `git diff --check`. Environment-specific tool paths and credentials remain outside public source. The Registry suite/final freshness receipt is produced after freezing these sources and evidence, before commit.

Runtime covers 15 groups. Browser checks at 320/390/1440 preserve detail/scroll, existing approvals and PDF downloads; midnight and approval reanchoring require no schedule fetch. Both actual UI and PDF reject the earlier false zero-valued excess. Source decimals, exponents, invalid input and overflow are exercised. Independent review adds seven explicit arithmetic cases and 100 generated schedules. Root visually inspected the final 320/390 screenshots: label/values fit without overlap or horizontal clipping. Physical device or latency-SLA claims are not made.

Read-only replay of the affected production observation confirms the complete future-only loan displays zero paid, zero progress and balance equal to its original total. Every other projected field and all source rows are identical to baseline. The public receipt contains no employee, control, loan, source row or customer amount. No impersonation, test approval, Google access or database write was used.

Build proof: 163 modules, exactly three focal chunks changed and 160 identical. SutiApp.html/sw.js change version references only (2026102607). Protected Finance, Historial, auth, request, synchronization, source reader, RPC transport, migrations and Google paths are unchanged.

Production backend: existing `loan-history` reader v7 ACTIVE, JWT enabled, three-module AST parity against final sources, anonymous request rejected with HTTP401. Prior v6 bundle/modules are privately backed up. No schema, financial record, source observation, Google Sheet, trigger or synchronization configuration was changed. Frontend commit/push/merge/Pages and served-artifact hashes are completed and recorded separately after this candidate commit; this document does not claim they occurred before commit.

```text
H-HISTORY-TOTAL-PAID-001 RESULT
Status: PASS for reviewed implementation and installed backend; frontend publication verified separately after commit
Files changed: declared projection/label/test/governance files; generated bundle/version and Registry artifacts
Source-of-truth verdict: PASS; owner-authorized own A/B/C/D aggregate, original source values and other authorities retained
Invariant verdict: PASS; isolation, source immutability, approval/sync independence and view continuity
Build: PASS; 163 modules, 160 unchanged
Tests: PASS; focal runtime/browser/core/snapshot/pending/approval/PDF and Pages/PWA; final Registry receipt in registry.json
Security: PASS; unchanged exact ownership, denial regressions, deployed JWT and anonymous401
Legacy impact: READ ONLY; no Google, formula, trigger, Apps Script, source or history mutation
Unexpected files changed: NONE; isolated checkout preserves unrelated root work
Known limitations: browser tests use synthetic isolated fixtures; final result retains the existing finite Number interface; physical-device/latency SLA not claimed
Evidence: docs/qa/evidence/history-total-paid; private deployment/commit/publication receipts in .tmp/history-total-paid
```
