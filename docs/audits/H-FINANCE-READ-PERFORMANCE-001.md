# H-FINANCE-READ-PERFORMANCE-001

## PRE-CHANGE AUDIT

Status: PASS for bounded implementation after owner instruction HAZLO.
Navigator: FRESH on published d533607; SICOF and Ahorro lookup confirmed.
Objective: accelerate existing readers without changing financial rules or introducing
a persistent mirror. Prior owner authorization to commit, push and publish applies.
The separate proposal for a persistent SICOF dataset is not part of this stage.

Declared files: supabase/functions/sicof/loan-source.mjs, index.ts, handler.mjs,
projection.mjs; app/sicof-admin.jsx only if required to preserve its existing contract;
scripts/test-sicof-loans.js, test-sicof-edge.js, test-sicof-ui-browser.js,
test-sicof-integration-browser.js and new test-sicof-direct-source.js,
test-sicof-read-performance.js; supabase/migrations and recovery/
20261003000500_savings_read_performance.sql, scripts/test-savings-read-performance.js
and scripts/fixtures/savings-read-performance-schema.json; this audit,
docs/qa/evidence/finance-read-performance.json and governance source/migration/legacy/
security/changelog entries as necessary; derived architecture Registry.
Generated bundle/SutiApp.html/sw.js version only if focal frontend changes.
Private preparation/metadata/benchmark/release artifacts live under
.tmp/finance-read-performance and are not committed.

Source authorities: fixed SutiApp Final / HISTORIAL P V2 for loans; existing canonical
Supabase savings transactions and accepted historical evidence for savings.
Readers: authenticated SICOF Edge and existing savings RPCs. Financial writers,
Google sheet/formulas/Apps Script writers, policies, ledger and history stay intact.
No new Google writer, persisted financial cache, automatic fallback or periodic sync.
Conditional savings reads may reuse only session-bound in-memory data after a current
backend authorization and complete canonical dependency-version check.

Plan: prove direct Sheets transport equivalence with raw/display/date identity and
source consistency; activate only after bounded verification. Defer ExcelJS loading
until an authorized export. Remove only demonstrated unused/duplicated work from
WORKSPACE while retaining previous LOAD compatibility and all UI interactions.
Optimize the savings summary and compare canonical dependency versions before DTO
generation; do not enable caching until invalidation is proven for all dependencies.

Migration guard: same reader signatures/OIDs/ACL/owners, exact baseline guard,
private definition backup, tested exact recovery. No financial rows or writer bodies
may change. Current catalog metadata is read once in a batch; no data dump is needed.
Any newly discovered dependency must be included in the audit before modification.

Risk: lost Folio zeros/date semantics; mixed source observations; missed canonical
dependency invalidation; invisible changes at business-day/period boundaries;
global rate effects when one saver changes; altered authorization or missing UI detail.
Tests: old/new equality on complete source, engine, source fingerprints and XLSX;
isolated SQL equality/invalidation/denial/recovery; unchanged amounts/policies/history;
isolated browser original sections and downloads; payload/time/read-count measurements.

Production verification: reuse existing local evidence first. At most one planned
paired Google source comparison and bounded SQL read/performance comparisons;
record request counts and timings, no polling benchmarks or synthetic money writes.
Deployment uses exact package hashes and metadata verification, existing permissions.
Recovery: prior Edge v6; guarded reader recovery; previous focal frontend if changed.
Security: JWT, actor/session/effective affiliate and permission checks before reads;
no credentials or row data in public evidence, logs or frontend.
UI: all tabs, metrics, selectors, reports, dialogs and charts remain. No redesign.
Global image regression: conditional on actual changes; backend-only focal readers
do not modify shared assets/Auth/Storage/routing or service-worker logic.

## Implementation decisions and verified limitations

The direct Sheets API comparison failed with SERVICE_DISABLED for the existing
clasp OAuth project. The prior Google OAuth repair records the same limitation;
no reusable dedicated credential remains locally. Shared receiver credentials,
Google project APIs, scopes, GAS source and deployment are unchanged. The direct
reader experiment and isolated parity test remain private, outside the release.
Production loan-source.mjs is byte-identical to the baseline: Apps Script only.

WORKSPACE opts into a compact transport. Unused participants are not transmitted;
repeated report detail and borrower loan arrays use references. Payment and
schedule tables can transmit column names once and reconstruct the original
objects before the existing UI consumes them. No data is persisted, no subsequent
source query is required for these details, and financial computation is unchanged.
Old full responses and clients remain supported. Invalid references fail visibly.
ExcelJS loads only after authorization and source verification for an actual export.
The established export/save contract still reads current authority and rejects drift.

Savings uses the existing in-memory, session-bound conditional-reader contract.
The backend checks current identity/context, all canonical row dependencies,
business date, timed action windows and audited reader definitions before returning
an unchanged version. It does not reconstruct the DTO on a valid match. Corrected
or deleted rows invalidate the version; reader drift disables reuse and returns a
fresh canonical response. No scheduled polling, trigger, mirror or ledger is added.
The summary retains its exact KPI/attention contract without constructing the full
legacy panel. The reversal relation lacks a dedicated index in the current catalog;
selected row hashing does not imply every physical query uses an index.

Measurements distinguish uncompressed JSON bytes, local computation and actual
network latency. A single legacy WORKSPACE capture took 36,794 ms and 28,126,924
bytes including its envelope; it is not a latency distribution. Further transport
parity/size tests reuse that private capture offline. No guarantee of instant Google
responses or a billing reduction is inferred from reduced JSON payload alone.

## Verification and activation

Migration 005 is APPLIED. One real-admin login and one guarded REPEATABLE READ
transaction verified exact before/after summary and self DTO equality. No financial
rows changed in 23 protected tables; 185 existing function OIDs/owners/ACLs were
preserved, with only the two declared reader bodies replaced. Table RLS, constraints,
indexes and triggers also remained identical. Self full response: 10,729 bytes;
conditional response: 312 bytes, with no DTO. The sample SQL times were 27.869 ms
for the previous self read, 32.279 ms for the new full read and 7.214 ms for a known
version. The initial read now pays version-check overhead; reuse avoids the full DTO.
Summary sample: 2,580.854 to 2,487.084 ms. A separate canonical account in the same
transaction took 20.537 ms to project and 5.796 ms to hash its dependencies. These
are single SQL samples, not end-to-end timings or representative load distributions.

Edge SICOF v7 is ACTIVE with verify_jwt=true. One authenticated compact WORKSPACE
returned HTTP 200 and exactly the previous financial observation; only its source
observation timestamp changed. Anonymous access returned HTTP 401. The response
took 30,239 ms, of which 29,872 ms preceded headers. Decoded JSON was 10,907,937
bytes including its envelope, compared with 28,126,924 in the prior sample.
The gateway sent gzip (Content-Length 1,128,368); the prior compressed length was
not recorded, so no billed-egress ratio is asserted. Remaining latency is substantial
and its individual upstream stages were not measured in this bounded verification.
This stage is a verified reduction in repeated work and payload, not instant loading.

Offline transport replay reconstructs exactly 28,126,746 bytes of prior workspace
content from 10,907,759 bytes (61.22% reduction), excluding only the unused participant
field. It preserves all original UI data, financial results, source/calculation hashes
and typed values. CPU overhead measured locally in Node/VM is recorded separately.
Columnar malformed keys/references/row lengths are rejected. No extra source calls
are introduced. Old full responses remain supported. Actual Edge verification passed
with the final encoder, without CPU-limit errors.

Tests PASS: 16 isolated SQL groups including recovery and all dependency changes;
19 existing client conditional/invalidation cases; SICOF transport/Edge/engine,
XLSX and selected-source backing, continuous handler and SQL workspace tests;
UI/browser integration including eight tabs, filters, modals, chart/payment details,
exports, withdrawals, errors, context clearing and responsive 320/430/1440 layouts.
The browser tests use the actual compact encoder/decoder over JSON transport.
Pages allowlist test PASS: no private files. Focal build v317 replaces only the
SICOF admin chunk; other bundle chunks are byte-identical to published baseline.
Service-worker changes are generated bundle URL only, with no logic change.

Independent architect review: APPROVED for SQL, recovery, compact transport and
UI contract. Direct Sheets code was explicitly excluded; its activation was not
approved. No owner decision was needed for the bounded implementation.

```text
H-FINANCE-READ-PERFORMANCE-001 RESULT
Status: PASS for reader/transport stage; latency limitation retained explicitly
Files changed: focal SICOF decoder/Edge/projection, tests, migration/recovery005,
 metadata-only fixture, governance/evidence, derived Registry, generated v317
Source-of-truth verdict: SAFE; original authorities and writers preserved
Invariant verdict: PASS; exact calculation/report/self/summary equivalence
Build: PASS; isolated baseline plus focal SICOF chunk, Pages public allowlist
Tests: PASS; SQL, conditional client, transport, Edge, exports and browser
Security: PASS; live anonymous401, current auth/context, RLS/ACL/OID preservation
Legacy impact: financial writers and Google source/credentials unchanged
Unexpected files changed: 0 in release; unrelated root worktree preserved
Known limitations: live full SICOF still30.2s in one sample; not instant or p95;
 version checks add initial-read work; no direct Sheets connection installed
Evidence: docs/qa/evidence/finance-read-performance.json
```
