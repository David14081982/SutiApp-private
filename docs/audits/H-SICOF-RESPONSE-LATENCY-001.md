# H-SICOF-RESPONSE-LATENCY-001

## PRE-CHANGE AUDIT

Status: PASS. Owner subsequently selected a private copy with maximum age five minutes, explicitly authorizing the freshness contract below.

Objective: diagnose multi-minute loading/download complaint and reduce unnecessary processing while preserving data freshness, exact dates/funds and financial rules.
Baseline: bbc0ba263fc246f7d0c441189d0c4d0c29f95a3c; isolated clean release. Navigator FRESH, sicof lookup verified.
Authority: current user requires fast, updated values and functioning XLSX. Existing deployment/commit/push authorization persists. Google HISTORIAL P V2 remains loan authority; canonical Supabase remains savings authority.
Evidence: one bounded read of existing technical logs (not business data) shows v9 POST 200 at 27659 and 29392ms; no memory/CPU errors in that sampled window. Request action is absent from logs, so these timings are not attributed specifically to export. Prior capture remains available for offline browser reproduction.

Declared phase-one files: supabase/functions/sicof/engine.mjs (extract existing input validation only), handler.mjs (base A:O fast path retaining same canonical input fingerprint), scripts/test-sicof-edge.js and new focal export performance test if necessary; this audit, docs/qa/evidence/sicof-response-latency.json, docs/AGENT_CHANGELOG.md and derived architecture registry. Private probes/receipts remain in .tmp/sicof-latency.
Additional frontend or mirror files require this scope to be updated before editing.

Plan: independently reproduce UI using existing private capture offline; compare existing versus optimized export validation/fingerprints, avoiding full loan/repartition construction for raw A:O; measure rather than infer bottlenecks; define maximum permitted data age before any durable mirror. Do not claim reduced CPU alone makes Google immediate.
Invariants: no financial arithmetic, policy, posting, withdrawal, source identity, source date, raw values, permission or source-change protection changes. Original scalar A:O, one sheet, applied inclusive period and funds. Raw export has no second authority.
Readers/writers: existing authenticated SICOF Edge; no new financial writer, browser persistence, cache, scheduled queries or financial testing writes.
Security: same JWT, current actor/session/effective affiliate, can_export and canonical source/context/settings fingerprint. No private captures committed or printed.
Risk: bypassing normalization/validation could alter fingerprint or weaken current-source checks. Extract exactly the current rules; prove equal valid outputs and reject invalid inputs.
Tests: existing Edge/engine/XLSX regressions, focused input/fingerprint equivalence, bounded offline browser replay. Production technical metadata only until a single planned final verification is justified.
Recovery: previous Edge v9 and focal commit revert; no data migration/recovery in phase one.
Legacy classification: SAFE CHANGE only after equivalent input validation/export tests; no Google/Apps Script or ledger edits.
Global image regression: NOT APPLICABLE for declared backend-only focal phase.

## Authorized scope expansion: private source observation, 300 seconds

Owner response: "Hasta 5 minutos: menos consultas." This replaces the previous direct-Google-every-read performance scope for SICOF consultation; Google remains the authority. The copy never accepts independent financial edits.

- Additional files: supabase/migrations/20261003000600_sicof_source_cache.sql; matching recovery; scripts/test-sicof-source-cache.js and metadata-only fixture if needed; supabase/functions/sicof/source-cache.mjs, index.ts; focused source-cache worker/handler tests; app/sicof-admin.jsx; scripts/test-sicof-ui-browser.js; generated app/bundle.js, SutiApp.html and sw.js bundle URL only; docs/SOURCE_OF_TRUTH.md, DATA_GOVERNANCE.md, LEGACY_GOOGLE_SYSTEMS.md, SECURITY_RULES.md, MIGRATION_RULES.md, DECISIONS.md; evidence/changelog/registry already declared. The shared browser repository and behavior component stay unchanged.
- Private preparation helpers under .tmp/sicof-latency implement metadata inspection, guarded apply/recovery verification, deployment and bounded live verification. No private payload, credential or row is committed.
- Data: exactly the validated existing Google loan observation (fixed workbook/sheet, original normalized typed source). Savings/context remain live Supabase reads; no saved balances, no copied ledger.
- Storage: separate private schema/table, FORCE RLS, no browser or direct service table grants. Service-only RPCs expose read/claim/finish; no financial writers or existing readers are replaced. A fixed singleton bounds storage; old source copies are superseded, not used as fallbacks.
- Refresh: one shared job every four minutes (at most 360 scheduled source reads/day, independent of user count) leaves margin under the 300-second maximum age. Atomic lease/claim, token-checked publish/fail, no database lock held during Google HTTP. Concurrent manual/automatic triggers share the claim and cooldown. Scheduled refresh is read-only against Google. Failed updates keep the prior private observation without renewing its validity.
- Freshness: measured from source observed_at, not last attempt/publication. Source READY only through observed_at+300s; after that state STALE, no new calculation/export uses it. Source changes atomically replace active copy, including deletions; same fingerprint may renew observation metadata without duplicating financial content. No claim of zero latency or instant external-change detection.
- Reads: existing JWT and live SICOF context/capability checks precede service-only source read. WORKSPACE/CALCULATE/EXPORT reuse active valid observation; no per-click Google query. Applied financial input fingerprints remain mandatory. Explicit manual refresh uses fresh SICOF authorization and the same shared lease.
- Worker: scheduled path requires the configured private refresh secret and gateway credentials. Secrets remain server/Vault only; no global credential changes. Worker validates original source through the existing reader before publish.
- UI: preserve all eight tabs/controls/reports and layout. Show source verification timestamp, source status and refresh operation. Expired copies are identified, never silently labelled current. Reusing data does not post financial movements.
- Recovery: unschedule job, restore previous Edge before removing additive RPCs/schema; no ledger/history restoration needed. Guard protected financial table hashes, existing function OIDs/ACLs/bodies, table RLS/triggers/indexes before/after installation. New cache records are disposable derived data only.
- Verification: isolated SQL role denial, stale/future source, deletion replacement, same-hash renewal, claims/lease races/failure/cooldown and recovery; source reader call counts; raw XLSX period/fund invariants; current auth/fingerprint preservation; browser states plus previous UI suite. At most one source priming read and bounded cached workspace/export verification; no repeated Google benchmarks.
- Global image regression: NOT APPLICABLE for focal SICOF Edge/UI and additive private read cache, with no shared repository, assets, Auth, routing or SW logic modification. Reassess if actual scope changes.

## Corrective cadence scope: 20261003000700

Status: PASS for local implementation and isolated verification. Migration 006 has been applied with 23 protected tables and 182 existing function contracts preserved, per the root application evidence; cron, secrets and deployment are still pending.

Finding: a 180-second normal-claim freshness/cooldown combined with a four-minute cron can skip the first tick after an out-of-phase manual refresh/prime and leave the copy expired until the next tick. Example: observed 01:01, tick 04:00 rejected at age 179 seconds, next tick 08:00 at age 419 seconds. Expired reads already fail closed, but this unnecessarily reduces availability.

Additional declared files: supabase/migrations/20261003000700_sicof_source_refresh_cadence.sql, matching recovery, and scripts/test-sicof-source-cache.js. The six normative addenda already declared above may identify 006 as applied and final cadence/activation as pending. Migration 006 remains immutable.

Plan: replace only public.service_sicof_source_claim(boolean), preserving signature/OID/owner/ACL/search_path and atomic 90-second lease. Normal claims originate only from the secret-protected shared periodic job and have no age skip; the four-minute scheduler controls their cadence. Manual force=true retains the 60-second cooldown from last_attempt_at. Source freshness remains strictly 300 seconds and finish/read are unchanged. Guard the exact installed 006 definition; recovery restores that exact definition and grants without changing observations or leases.

Tests: execute real 006 then 007 in isolated PostgreSQL; compare unrelated function definitions, financial sentinel data and cache rows across correction; test out-of-phase normal claim with source still READY, both lease contenders, manual cooldown, expired-token rejection and exact recovery. Security reviewer confirms normal claims are service-only and Edge reserves force=false for the private job. No application, cron activation, network query or financial write is authorized to this subtask.


## VERIFY / EVIDENCE

The frontend scope includes scripts/test-sicof-read-deadline.js for the explicitly declared wait-state change. Normal read wait is bounded at 25 seconds; explicit Google refresh at 75 seconds. These are UI wait deadlines, not server cancellation; there is no automatic retry or polling. Original source/calculation controls and all eight tabs remain. The existing Finance BEHAVIOR reader remains untouched.

006 and corrective 007 were each applied under a REPEATABLE READ transaction comparing 23 financial tables and 182 existing function contracts, plus table RLS/constraints/indexes/triggers. All remained identical. Only additive private source objects and 007's guarded private-cache claim were installed. No financial/historical rows were written. The 006/007 isolated suite passed 19 groups, including 18,000 rows, exact recovery, strict 300-second TTL, delayed workers, manual/normal claim contention and out-of-phase refresh.

Private refresh secret and three scoped Vault entries were configured without altering existing credentials. Remote function metadata was version 10 at activation; its downloaded package contained the exact baseline six .mjs modules, with the previous TypeScript entrypoint inspected. The new exact package is SICOF v11 ACTIVE, JWT verification retained. One actual pg_net/Vault/Edge job primed the source successfully; one shared cron job is active at */4 * * * *. Normal consultations never call the Google reader. Expired observations are rejected after processing as well as before it.

One live authenticated compact WORKSPACE took 8.368 seconds, one base_calculo XLSX took 7.774 seconds. The latter contained one HISTORIAL P V2 worksheet, 15 columns and 1,684 Caja de Ahorro records, all within the applied 2026-07-01 through 2026-12-31 interval. Actual included dates were July 5 through December 30; no outside-period row or extra worksheet appeared. These are individual end-to-end measurements, not a p95 or an instant-loading guarantee. Prior version-9 technical logs showed two POST 200s at 27.659/29.392 seconds, with their actions unknown.

Isolated frontend, integration, compact encoder/decoder, deadline and Pages allowlist checks passed. The previous private real response was also replayed offline with all network blocked: ready after 648 ms once settled (2.219 s at 4x CPU throttle). That replay excludes server/transfer/auth latency. Code-path equivalence/fingerprint tests preserve financial settings and results while raw A:O export skips unrelated financial recomputation. Protected source decoder, loan arithmetic, projections, XLSX writer, shared repositories and Finance behavior are unchanged.

Focal v320 build changes only the sicof-admin.jsx bundle chunk and existing bundle-version URLs. The architecture index is refreshed after the new private source dependency. Global image regression: NOT APPLICABLE under the repository's focal generated-artifact exception; no shared Auth, routing, assets, repository or SW logic changed. Private captures, credentials and row-level data are excluded from Git.

H-SICOF-RESPONSE-LATENCY-001 RESULT
Status: PASS
Files changed: focal SICOF UI/Edge, isolated tests, additive source-cache migrations/recovery 006/007, v320 generated artifact/URLs, six governance addenda, this audit, changelog, aggregate evidence and derived registry.
Source-of-truth verdict: PASS; Google loan authority with explicitly authorized private five-minute observation; Supabase savings read live.
Invariant verdict: PASS; financial policies/arithmetic/history unchanged; original A:O/fund/inclusive-period contract preserved.
Build: PASS; focal v320 bundle and Pages public artifact allowlist.
Tests: PASS; commands/checks recorded in aggregate evidence.
Security: PASS; live actor/module/export checks, service-only RPCs, FORCE RLS, secret-protected job, JWT, no browser financial persistence or stale fallback.
Legacy impact: Equivalent read/export optimization; Google/Apps Script unchanged; no loan, savings, withdrawal or yield writer changes.
Unexpected files changed: None in isolated release allowlist. Unrelated root work preserved.
Known limitations: 8.4/7.8-second measured operations are faster, not immediate; manual refresh still waits for Google. External failure or lease overlap can delay a tick; expired data remain explicitly unavailable. UI deadlines do not abort server work. SQL contention tested in serialized PGlite plus row-lock/token inspection, not a multi-connection production race. Finance BEHAVIOR retains direct Google read. Final publication is checked after push using CI and static bundle hashes, with private receipts.
Evidence: docs/qa/evidence/sicof-response-latency.json and private .tmp/sicof-latency receipts. Independent post-close reviewer APPROVED, including source/package hashes and absence of private rows or credentials in aggregate evidence.

Final operational check: exactly one active */4 job, first automatic execution succeeded and advanced the source observation beyond the initial prime (03:52:27 UTC), state READY, no refresh error. This check only read operational metadata; it did not trigger another Google query. Full architecture-registry acceptance passed freshness, lookup, incremental add/remove, secrets and deterministic generation. The final evidence/audit receipt is followed by an incremental index refresh.
