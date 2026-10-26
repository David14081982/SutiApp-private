# H-HISTORY-LOAN-PAYMENTS-001

Status: PASS (verified local candidate). Not installed or published in production.

## AUDIT / AUTHORITY / PLAN / RISK

Owner requested six history filters, all own historical financings, amortization
on card click, and a 24-hour approval window measured from Finance approval.
Subsequent explicit clarification authorizes this self-service interpretation:
A <= the current America/Hermosillo day means paid; future A means outstanding.
X owns loan classification; LIQUIDADO and PAGÓ DE MÁS both display Liquidada.
Initial financial requests use Historial de solicitudes A (SR identity), B (owner),
Y (Pendiente/Rechazado). Existing unrelated application histories stay intact.
This does not change SICOF, accounting, interest allocation or any financial writer.

Authority: Google HISTORIAL P V2 owns installments/status; Historial de solicitudes
owns its displayed request projection. Supabase affiliates owns authenticated
identity; program_requests.financial_approved_at and existing approval events own
the actual Finance approval instant. The 24-hour window is derived, not a mutable
browser counter. The existing Google A-cell SUTI_LOAN_TRANSFER_V1 receipt is the
only permitted SR-to-numeric linkage; never match by amount/name/date alone.
No synthetic timestamps, historical rewrites or new balance authority.

Navigator check: STALE (8 changed / 28 added), inspected focal runtime files and
current source directly. Existing unrelated working-tree changes are preserved.
Primary runtime: screens-historial.jsx -> operations-store/ProgramRequestRepository
(unchanged) plus new focal loan history reader -> authenticated Edge -> own-context
SQL and fixed read-only Google receiver. No direct browser Google access.

Declared edit scope:
- app/history-loans-repository.js, app/history-loans.jsx, app/screens-historial.jsx
- scripts/build-bundle.js, generated app/bundle.js, SutiApp.html cachebuster only
- supabase/functions/loan-history/{index.ts,history.mjs,source.mjs}
- additive supabase/migrations/*_self_loan_history.sql and matching recovery
- google-apps-script/financial-handoff/Code.gs (additive read-only action only)
- focal scripts for catalog inspection, tests, packaging and release verification
- this audit, sanitized docs/qa/evidence/history-loan-payments/*, governance append
  in SOURCE_OF_TRUTH, DECISIONS, INVARIANTS, SECURITY_RULES, LEGACY_GOOGLE_SYSTEMS,
  MIGRATION_RULES, AGENT_CHANGELOG; derived architecture registry files.
- private .tmp/history-loan-payments baseline, backups, build and test artifacts.

Risks: exact identity/duplicate controls, stale auth responses, absent historical
approval timestamps, incomplete transfer receipts, partial source failure, exact
24h boundary/day rollover. Fail visibly; never replace Google with mock/cache or
borrow another user's rows. New endpoint accepts no target Folio or affiliate.
Recheck context after the source read; no anonymous or administrative bypass.

Recovery: additive SQL reader can be revoked/dropped without touching history;
new Edge/reader can be disabled and focal frontend reverted. Preserve existing
approval events and Google receipts. Back up source files before edits. Any remote
installation requires baseline drift checks and readback, with no test loans.

Verification planned: synthetic loan grouping, date interpretation, four statuses,
approval 24h boundary, missing timestamps, altered target and cross-user requests,
logout/context races, PostgreSQL grants/identity/recovery, GAS read-only contract,
mobile UI cards/detail/filters and existing timeline preservation, build/parity.
Production checks are read-only. Shared Auth, routing, Storage/viewer and existing
repositories remain untouched; bundle regeneration is GENERATED_ARTIFACT.

Scope expansion during verification: scripts/test-sicof-loan-receiver.js must
exclude the separately tested additive self-history reader from its historical
writer digest. The old expected digest remains unchanged; focal inverse equality
also compares the complete pre-change receiver, including the SICOF reader.

## IMPLEMENT / VERIFY / EVIDENCE

The live catalog contains 267 approved financial requests and 267 approval
timestamps. The existing approval writer returns the saved row on retry, before
assigning a timestamp; the counter therefore reuses its durable initial instant.
No timestamp writer or backfill was added. The 24-hour category is evaluated with
server time; the mounted browser display advances from a monotonic clock and
refreshes source/context while foregrounded. Logout/context changes discard data
and ignore outstanding responses. No persistent client storage is used.

Google returns only the exact Folio's requested fields. Backend independently
checks ownership and revalidates identity after the read. A-cell transfer receipts
connect numerical loans to the original approval without fuzzy joins. Unknown
dates, amounts or quota ordinals stay explicit. Paid/pending dates follow the
owner's rule only in this reader; SICOF and all writers are byte-preserved.

The existing cash-rental/native nonfinancial workflows retain their own history.
The financial entries have one card per loan and include the approved clock,
status-specific capsule and a read-only amortization detail. Existing history
header, active tracker, chips, card anatomy, support CTA and native tracking remain.
The detail shows the original installment amounts, not a synthetic schedule.
The displayed number of payments comes from Q (# de pagos); S is each quota's
ordinal. I (Plazo) is not silently relabeled as an installment count.

Verified commands:
- `node scripts/test-loan-history.js`: seven groups covering 24h boundaries,
  exact identity, server authorization/revalidation, leading zeroes, grouping,
  source exceptions, clock projection and isolated PostgreSQL grants/recovery.
- `node scripts/test-loan-history-receiver.js`: fixed reader/secret/identity,
  quota serial/date interpretation, mutation rejection and exact inverse baseline.
- `node scripts/test-sicof-loan-receiver.js`: existing receiver tests PASS.
- `node scripts/test-loan-history-browser.js`: actual Chrome, 320/390/1440,
  all filters, approved detail, payment capsules, timeline, live clock expiry,
  source failures, logout and delayed cross-context responses; zero browser errors.
- `node scripts/build-bundle.js C:/tmp/sutiapp-babel-7.28.4.min.js`: compilation PASS.
  Full regeneration surfaced a pre-existing unbuilt Renta Car source change; its
  original compiled chunk was retained to keep this candidate focal. The only
  changed bundle chunks are history-loans-repository, history-loans and screens-historial.
- `node scripts/package-loan-history.js --build`: source/bundle parity and actual
  Pages build PASS. Built and candidate bundle SHA-256 are identical.
- `node scripts/preflight-loan-history.js`: read-only live baseline PASS, Google
  version 19 matches the private original, migration number free, cloud Edge
  bundleOnly compilation PASS, new Edge confirmed not installed afterward.
- Focused `git diff --check`: PASS.

Screenshot inspection: history and amortization at 390px; no clipped amounts or
horizontal overflow. Additional 320/1440 automated layout checks passed.

### Known limitations and activation boundary

This is a local candidate, not a productive release. No SQL migration, Google
deployment, Edge deployment, commit, push or site publication was performed.
Before activation, recheck the recorded baselines and follow candidate.json's
ordered deployment/readback and recovery plan. No synthetic production loan is
authorized or necessary for this release.

Legacy records lacking a verified approval instant do not receive an invented
24-hour window. A request still awaiting the legacy amortization generator keeps
its approved card and an explicit preparation/retry state until the authoritative
rows exist; it does not fabricate installments from a second source. This window
is a real source dependency, not a completed-payment claim. Unknown/uniformity
conflicts remain visible for review. Loan data is refreshed every 60 seconds while
visible and on focus; the countdown itself updates each second.

### Authorized activation — 2026-10-25

Owner explicitly authorized surgical publication: "si hazlo de forma quirurgica".
The previous candidate-only boundary is superseded for this feature only.
Scope extension: scripts/release-loan-history.js and scripts/verify-loan-history-live.js,
their release evidence, isolated .tmp/history-loan-payments/release checkout and
the same focal files there. Remote main baseline is 6c9fdb5; its history screen
and Google Code match the audited originals, while its generated bundle/build
list include newer unrelated work. Preserve the remote baseline, insert only the
two new module entries and replace exactly the three focal compiled chunks.
No remote business records, Google cells/properties/triggers or approval writers
are authorized to change. Apply only the additive RPC and Edge reader, version
the additive Google reader with existing deployment settings, then publish UI.
SQL integrity is checked within one repeatable-read transaction; remote source
hashes and migration collisions are checked before writes. Private backup,
prior deployment version 19 and additive SQL recovery remain available.
Tests: source readback, legacy reader, actual authenticated self-read, anonymous
and forged target denial, focal browser suite, release build and live bundle hash.
Risk: protected receiver deployment; mitigated by exact inverse and rollback.
Release cache version: 2026102506, advancing published 2026102505. Include only
the associated cache literals in release/SutiApp.html and release/sw.js; worker
logic is byte-preserved after inverse version replacement. These are generated
artifact cachebusters under AGENTS.md, so no global image regression is triggered.
The isolated release also adds two focal .gitattributes entries to preserve the
exact applied SQL/recovery bytes; existing attributes remain unchanged.
The controlled account has no own historical loans. Automatic approval review
rejected the proposed two-subject assisted-context probe as outside publication
scope. That probe was NOT executed and was removed. No identity sessions/audit
records were changed. Live verification uses the authorized account; populated
amortization and cross-user race tests use isolated fixtures. This is an explicit
verification limit, not a claim of two-real-user production coverage.
Independent source comparison reads the owner's shared workbook export in memory;
it is not a production fallback. Save only counts and test outcomes publicly.
Status: PASS for authorized activation plan; live results recorded separately.

### H-HISTORY-LOAN-PAYMENTS-001 RESULT

Status: PASS — LOCAL CANDIDATE ONLY
Files changed: focal files in docs/qa/evidence/history-loan-payments/candidate.json;
  this audit; governance append-only sections; derived architecture registry.
Source-of-truth verdict: PASS; separate authoritative domains, no fallback.
Invariant verdict: PASS in isolated tests; existing approval/history untouched.
Build: PASS; packaged site and focal bundle parity verified.
Tests: PASS; core PostgreSQL/JS, receiver, existing SICOF receiver, mobile/desktop UI.
Security: PASS isolated; live backend enforcement NOT APPLICABLE before deployment.
Legacy impact: additive read-only candidate; zero live writes/deployments.
Unexpected files changed: none intentionally; pre-existing working-tree changes retained.
Known limitations: not published; historical missing clock/link and generation latency as above.
Evidence: docs/qa/evidence/history-loan-payments/{core,receiver,browser,build,catalog,preflight,candidate}.json
