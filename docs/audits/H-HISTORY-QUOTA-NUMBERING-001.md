# H-HISTORY-QUOTA-NUMBERING-001

PRE-CHANGE AUDIT - 2026-10-26

Objective: correct repeated/reset installment labels and replace the requested explanatory paragraph with the exact text "Historial". The owner explicitly requests this correction to the published screen.

Baseline: isolated checkout of current main, following reviewed release abc89e3 / PR #4. Earlier workspace changes and snapshot closure records are preserved separately. Architecture lookup "Amortizacion de pagos" was FRESH in the preceding release checkout and identified the focal detail, statement and repository; source inspection confirms these paths in the published code.

Declared files: app/history-loans.jsx; app/history-statement.js; scripts/test-history-snapshot-browser.js; this audit and its sanitized evidence under docs/qa/evidence/history-quota-numbering; append-only docs/AGENT_CHANGELOG.md; generated app/bundle.js and matching SutiApp.html/sw.js version references. Private test/packaging artifacts remain under .tmp/history-numbering. No backend/schema/Google/source-reader or shared infrastructure edits.

Finding: both visible badge/title and PDF use row.number. The read-only source maps that field from PV2 column S; its repeated/reset values are preserved by the backend. The received schedule is already sorted by date, then raw number, then source row. This raw value is not a reliable ordinal of all displayed quota rows. Correct only the display ordinal using each row's existing array position plus one in both consumers; do not rewrite source number, dates, order, amounts, source-row identity, status, counts, totals or approval clocks. Include zero-value and future rows. Restart at one independently for each loan. The final row keeps the contract closure/date.

Authority: Google remains the financial authority; the private Supabase observation and existing own-context backend remain the only read transport. A presentation ordinal is derived from the authorized ordered schedule and is not a financial value or new stored authority. Readers affected: LoanHistoryDetail and local statement generator. Writers: frontend build only; no business-data writer or external system call. No new cache, fallback, polling or network read. Source-of-truth verdict: SAFE. Legacy classification: SAFE CHANGE confined to presentation; zero source/Sheet writes. Database migration guardian: NOT APPLICABLE.

UI preservation: keep header/back/download, summary/progress/source timestamp, quota cards/status/date/amount, closure, support, scrolling, refresh retention and navigation. Only the two ordinal labels and requested paragraph change. Global Auth/routing/assets/viewer/Storage/service-worker logic remain unchanged; generated bundle/cache references are GENERATED_ARTIFACT, so global image regression is NOT APPLICABLE.

Risk: UI/PDF disagreement, dropped zero quotas, accidental renumbering across loans or changes to source data. Verify adversarial repeated/reset/null source numbers in the actual browser/PDF paths; require consecutive full sequences, unchanged row order/values, new copy, stable refresh and no extra reads. Run existing focal browser/PDF checks plus bundle/Pages/PWA checks and diff review. No production data mutations are required to reproduce or verify this bug.

Recovery: restore the prior two frontend modules and regenerate/version the focal bundle. No data recovery or source synchronization is needed. Registry structure/authority/dependencies do not change; any resulting checksum staleness is documented as focal presentation/test/doc changes, not falsely marked FRESH.

Status: PASS for audited scope; implementation/verification follows.


H-HISTORY-QUOTA-NUMBERING-001 RESULT

Status: PASS for implementation and local verification; public release verification follows.
Files changed: the two declared display/export modules, the existing focused browser regression suite, generated bundle/HTML/SW version references, this audit, changelog and sanitized evidence only.
Source-of-truth verdict: PASS. Original ordered schedules and every raw number/date/amount/status/source-row value remain unchanged; each visible/exported row receives its position-based ordinal independently per loan.
Invariant verdict: PASS. Zero and future installments included; final closure/date retained; no extra reads, financial recalculation or cache.
Build: PASS. Syntax and Pages/PWA checks; exactly two changed bundle chunks and 161 byte-identical unrelated chunks. Version 2026102603, bundle SHA256 d07286278b659ede83c3019f3be3abc1cdf855d221a3911efd3e06420c9076b9.
Tests: PASS browser widths390/320/1440 with all-one/reset/mixed-missing raw numbers, consecutive badge/title/downloaded PDF, all210 PDF rows, independent loan sequences, equal/missing dates, immutable source rows, existing filter/clock/zero/progress/refresh/scroll/security/no-polling behavior. The same regression test against the two old modules fails on repeated Cuota1, proving coverage of the reported bug. An initial test-only PDF text concatenation issue was corrected to separate page boundaries; product PDF generation was unchanged by that test fix.
Security: PASS unchanged backend/authorization/identity boundaries and existing isolated negative UI tests; no production credentials or customer records in evidence.
Legacy impact: zero Google or database writes; no source-reader/backend/schema deployment. Google financial authority and original contract terms preserved.
UI preservation: PASS. All existing sections/interactions remain; only ordinal labels and requested paragraph change. Mobile screenshot reviewed against the user examples.
Unexpected files changed: none within isolated checkout; other workspace and prior task records untouched.
Known limitations: checks use isolated fixtures, including actual Chrome and PDF.js; no new production impersonation or financial-source reads. Source sorting is intentionally unchanged. Registry structure/dependencies/authority remain identical; presentation/test/document checksum staleness is documented and no false freshness is claimed. Global image regression NOT APPLICABLE under the generated-artifact exception.
Evidence: docs/qa/evidence/history-quota-numbering/{build,browser,old-source-negative}.json. Independent architecture review and publication follow.


Independent architecture/UI review: APPROVED by /root/snapshot_architect after direct source/bundle diff, actual mobile screenshot, positive browser/PDF evidence and old-source negative reproduction. No blocking finding. Source hash evidence explicitly distinguishes LF-normalized build hashes from raw Windows checkout bytes; equivalence verified. Publication remains the final acceptance step.
