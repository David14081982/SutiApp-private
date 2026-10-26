# H-HISTORY-FAST-READ-001

PRE-CHANGE AUDIT — 2026-10-26

- Objective: implement the owner's accepted first-stage performance recommendation: batch the authoritative Google reads and avoid another Google/API read when opening an already-loaded own amortization. Measure cold Historial and detail against the requested three-second target; never claim the target without populated live evidence.
- Authority: owner says "hazlo de forma quirurgica" after the concrete proposal. No Google Sheet contents/metadata/formulas/triggers, financial writers, workflow semantics, permissions, migrations, periodic synchronization or persistent financial replica may change. Existing authorized Tomar control verification covers the original account and four named affiliates, with normal start/stop and cleanup.
- Baseline: published frontend 2026102507, loan-history Edge v2, Google reader v21; isolated clean release commit 80c9708. Root checkout contains substantial unrelated changes and must not be staged wholesale.
- Navigator: STALE solely for three diagnostic artifacts, no runtime changes. Directed scope: app/history-loans-repository.js, app/history-loans.jsx and screens-historial.jsx consumers; private-resource-demand.js context contract (read only); loan-history/index.ts,source.mjs,history.mjs; financial-handoff/readSelfHistory_ and its deployment manifest (read only unless equivalence plan is amended).
- Allowed candidate files: app/history-loans-repository.js; supabase/functions/loan-history/source.mjs and optional focused sheets-reader.mjs; Google Code.gs only readSelfHistory_ if necessary and validated; focal scripts/test-history-fast-read*.js or .mjs; existing history test updates whose old loading/cache expectations are superseded; scripts/build-bundle.js version and generated app/bundle.js/SutiApp.html/sw.js version references only (no service worker logic changes); this audit, docs/AGENT_CHANGELOG.md, SOURCE_OF_TRUTH.md, SECURITY_RULES.md, relevant derived architecture index entries, sanitized docs/qa/evidence/history-fast-read/. Private scripts/backups/candidates under .tmp/history-fast-read/.
- Sources: Google HISTORIAL P V2 owns loan IDs/Folios/quotas/X; Historial de solicitudes owns SR statuses and transfer receipts; Supabase owns effective identity, native requests and persisted approval timestamp. All exact Folio and before/after context checks remain.
- Memory copy: owner-authorized per-session/context dataset in browser memory only, derived from a successful authenticated LOAD. No localStorage/sessionStorage/IndexedDB/CacheStorage, write authority, source-error fallback or cross-account reuse. Invalidate on effective context/logout/token context, exact local control change, explicit retry, relevant request mutation, full page refresh, and source error. Retain the original server_now anchor for countdown/date projection. Reuse lasts at most five minutes from the original successful LOAD, checked on a new access/mount or foreground visibility intention; navigation never extends that age. No background fetch timer or polling: an already-open view remains its observation until a new intention, without a claim of automatic five-minute updates. An expired next access requires a new successful read and cannot fall back to the expired copy.
- Reader plan: verify existing OAuth capability with a bounded read-only metadata/header request; prefer typed/formatted/notes batch reads that preserve exact ownership and consistency. Do not silently broaden OAuth permissions. Keep LOAD/SUMMARY/DETAIL contracts backward compatible. Candidate transport must validate source IDs/headers, owned rows and source changes, with no foreign rows in responses or logs.
- Allowed validation APIs: read-only Google Script content/deployment and Google Sheets metadata/ranges; Supabase management read-only metadata/SQL, compilation and a temporary authenticated loan-history-fast-preview function if needed to verify the same runtime credentials. The preview must enforce the same effective identity checks, no new grants/secrets, no business writes, and be removed after validation. Production replacement only after equivalence, security, rollback and populated timing evidence are reviewable.
- Risk: increasing initial payload versus SUMMARY; cold source latency may remain above three seconds. Measure raw and compressed representative sizes, API counts and live times. Invalidated in-flight requests must not restore old data. Existing screen/UI contracts remain unchanged.
- Tests: typed source/receipt/date equivalence, source changes and ownership attacks, context/logout races, request invalidation, detail navigation without second request, failures without stale fallback, native operations/filter/countdown preservation, populated same-account coverage and timing. Focused build and dependency tests; no global-image trigger unless a shared asset/auth/shell/helper actually changes.
- Recovery: preserve exact Google deployed content/version and Edge bodies/versions before any release; revert only focal source and generated artifacts to baseline. No data recovery is needed because no financial writes occur. Stop/verify every assistance session.
- Status: PASS for scoped implementation and read-only capability discovery. Persistent server copy and new permissions are outside this first-stage authorization.

## Explicit temporary-header-probe approval

The first management deployment request was rejected by automatic approval review because a new production function was not explicitly authorized. No deployment occurred on that attempt. The owner then explicitly replied "Sí, autorizo esa prueba temporal" to the described JWT-protected loan-history-fast-preview header-only probe, same effective-identity checks, no active-endpoint replacement, no financial/Sheet/permission writes, and mandatory removal. This authorizes that bounded probe; it does not authorize adding a persistent service or expanding its data response.

## Capability finding and release boundary

The runtime header probe returned HISTORY_PROBE_SERVICE_DISABLED for Google consumer project 1072944905499, matching the existing clasp OAuth client. Google's clasp source identifies this as its shared CLI OAuth project, not an application-owned Sheets API client. The temporary preview was removed successfully. No attempt was made to enable a service in that shared project or acquire broader OAuth grants.

The batched REST reader remains a disconnected local candidate until a dedicated, authorized read-only Google connection is available and real equivalence/performance can be verified. Do not replace the working production transport with the blocked API. Independently build and verify the frontend reuse change against the existing production LOAD, including populated initial latency, immediate detail transitions, total own source rows and measured payload sizes. Its release cannot be described as achieving the cold-load three-second objective.

SOURCE OF TRUTH AUDIT: SAFE for a single Google authority with explicit nonpersistent own-session copy; invalidation/freshness must be verified before release.

LEGACY GOOGLE AUDIT: read adapter only, READ ONLY for workbook and business state. Financial writers/formulas/triggers remain byte-equivalent if any script code is changed.

SUPABASE SECURITY REVIEW: maintain JWT, effective Folio before/after read, no client target, no exposed secret/service_role, existing audited assistance only. No schema/RLS/auth changes.

## Verified frontend candidate boundary

Independent architect review: APPROVED for the focal frontend candidate, not a claim of publication or complete performance acceptance. Exact bundle SHA-256: 6a1080bf6656647ae6bd40d7b319d7638d5f4e5e3a69b15f6a785aef73c22189, version 2026102601. Other 160 compiled modules are byte-identical. Existing shared Auth, routing, private-resource-demand, Storage, viewers and SW logic are unchanged; the global-image suite is NOT APPLICABLE under the repository generated-artifact exception. History/Amortization structure, colors, cards, filters, timeline and native request behavior passed focused UI tests at 320/390/1440.

The all-four populated candidate test checked 19 own loans and 208 quota rows with one LOAD per account, all details 13–321 ms, exact filters/ownership, no page errors, and normal assistance cleanup. Those four timings precede the final A→B→A revision-key fix. The final exact bundle was separately checked against live backend data for one account: four loans/38 rows, details 17–48 ms, one LOAD, source coverage and cleanup PASS. See populated-candidate.json and final-candidate.json. Initial cards still take 27–40 s, including 30.685 s in the final smoke.

Measured initial decoded JSON is 5,304–9,566 bytes in these accounts; response Content-Length headers report 1,130–1,821 bytes with gzip. These are response observations, not total Supabase billing. SUMMARY alone was smaller. LOAD eliminates repeated detail transfers; modeled list-only/list-plus-one/list-plus-all comparisons are recorded without claiming universal savings. No source polling occurs every five minutes; the five-minute limit is only reuse-on-demand.

Capability readback confirms the authorized temporary preview is absent and active loan-history version/hash/JWT metadata are unchanged. The current direct API transport cannot be activated with the shared clasp OAuth project. Alternative source transports require separate real capability/equivalence/timing verification; none is installed by this frontend package.

## H-HISTORY-FAST-READ-001 RESULT — prepublication

Status: BLOCKED for complete cold-load-under-three-seconds objective; PASS for verified frontend reuse sub-scope.
Files changed: app/history-loans-repository.js; focal browser tests; generated bundle, HTML/SW version references; scoped audit/authority/security/changelog/evidence and derived index if required. Disconnected sheets-reader.mjs and its test are excluded from publication.
Source-of-truth verdict: PASS — same Google authority; nonpersistent own-context observation only.
Invariant verdict: PASS — exact own Folio, approval clock, quota-date interpretation, statuses and existing workflows preserved.
Build: PASS — public artifact generated, syntax valid, exact source/bundle parity;160 unrelated modules unchanged.
Tests: PASS — focused browser, compatibility and populated live-backend candidate checks.
Security: PASS — context/revision invalidation incl A→B→A, foreign key narrowing, no target selector/secrets/permission changes; all assistance sessions closed.
Legacy impact: READ ONLY; active backend unchanged; zero Sheet or financial writes.
Unexpected files changed: historical core.json emitted by a test restored to HEAD; unrelated root work excluded through isolated clone.
Known limitations: no publication at this checkpoint; initial load remains above requirement, direct API capability blocked; bounded reuse means source edits become visible on next successful refresh/invalidated or expired access.
Evidence: docs/qa/evidence/history-fast-read/{build,populated-candidate,final-candidate,runtime-capability,compat-loan-browser,compat-efficiency-browser}.json plus final focal test and independent review.

## Isolated-release Registry freshness

The isolated release inherits a preexisting stale derived Registry from main, including the previous History efficiency release. Its source files remain unchanged by this H. Refresh the exact check-reported file set, including the current repository memory implementation/tests/docs; only docs/architecture derived artifacts change. Do not index the disconnected direct reader prototype. This updates the derived index, not authority, runtime, backend or historical evidence.
