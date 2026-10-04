# H-SICOF-INSTANT-FILTERS-001

Internal change control; the requested deliverable is the functioning correction, not another audit proposal.

AUDIT / AUTHORITY / PLAN / RISK: PASS. Baseline 2bd633718bc26008b805ae4658cc35db15d8b4de, clean isolated release, Navigator FRESH. Owner requires immediate filter changes and existing deployment/commit/push authorization persists. Current UI deliberately leaves input changes unapplied, then reloads the full remote workspace on Apply. The five-minute Google observation removed upstream latency but not live context reads, repeated transport or the draft-only interaction.

Scope: automatic in-memory simulation using the identical server engine and authenticated source observation for supported equivalent context ranges. Specifically July 1 through December 4 versus December 31 with the same start and both cutoffs on/after today's as_of requires no different savings context. Historic cutoff or changed start requires a fresh authorized context; do not infer missing eligibility. No rule change or historical write. Expiry/day/context changes invalidate local inputs. Backend must still revalidate source, savings context, permissions and fingerprints before export/save.

Declared files: app/sicof-admin.jsx; new focal simulation client/worker generated assets; supabase/functions/sicof/handler.mjs and new simulation.mjs; focal build generator; scripts/build-pages-site.js allowlist only; focused simulation, Edge and UI tests, scripts/test-pages-deployment.js if its contract requires; app/bundle.js, SutiApp.html and sw.js generated bundle URL only; this audit, aggregate evidence, changelog, SOURCE_OF_TRUTH.md, DATA_GOVERNANCE.md, SECURITY_RULES.md, DECISIONS.md, LEGACY_GOOGLE_SYSTEMS.md and derived architecture registry. Financial engine/loan arithmetic/projection code must remain identical unless a separately declared equivalent extraction is necessary. Shared browser repositories, Auth, Finance behavior and global SW logic are outside scope.

Sources: Google fixed loan observation and canonical Supabase savings remain authoritative. A context-bound, five-minute in-memory simulation input is an authorized UI read derivative, never a ledger/cache fallback or writer. No localStorage/IndexedDB, no new source polling, no copied browser secret. No database migration planned. Preserve all eight tabs, original controls/charts/reports and withdrawal/history behavior. Make local input effects automatic and visibly fail for invalid policies instead of leaving an indefinite draft/loading state.

Verification: independent exact equivalence with current server computation, inclusive December 4 and all fund modes, no additional network calls for supported filters, rapid changes/latest result wins, source expiry and context/day reset, forbidden source/client tampering on export/save, real-size offline browser timing and existing focal integration tests. Avoid repeated live business probes: use existing private recordings, then at most one authenticated verification of the new contract if necessary. Recovery is prior focal commit and Edge package; there are no financial data writes to reverse.

Global image regression: NOT APPLICABLE for focal UI/worker/public allowlist and SICOF Edge; reassess if any shared repository/Auth/assets/routing/SW logic is changed.

Exact new asset/build scope: app/sicof-simulation-client.js, generated app/sicof-simulation-worker.js, scripts/build-sicof-simulation-worker.js; scripts/build-bundle.js adds only that focal client to its input list. The worker contains the unchanged engine and pure simulation adapter, never the Google reader, backend entrypoint or credentials. Backend simulation_basis revalidation reads the original authorized range; saves additionally revalidate the effective range before invoking the unchanged scenario writer.

IMPLEMENT / VERIFY / EVIDENCE: PASS. Local filter changes apply automatically after a 60 ms debounce, preserve the latest draft, and restore the last valid result after an invalid policy is undone. The exact financial engine runs in a disposable Worker. Unchanged payments and loans cross the Worker boundary as checked indexes; period flags reconstruct the identical workspace without repeatedly copying loan graphs. Matrix/payment/arrears presentation totals execute only when their existing tab is opened; formulas, components and tab order remain intact.

Independent browser verification compared complete financial results AND reconstructed workspaces against the original server pipeline. Inclusive December 4, all fund modes, rapid changes, late responses, invalid-policy recovery, reexpansion to December 31, eight tabs, expiry and session cleanup PASS. Protected engine/loan/projection/source/export modules and shared repositories remain byte-equivalent. No SQL, balances, history, Google formulas or financial writes changed.

Real-size offline browser observation: 354 participants, 2,373 loans, 5,656 period payments and 18,534 installments. December 31 to December 4 displayed in 839.8 ms; restoration in 782.5 ms. One initial fixture load, zero subsequent source requests, no profiler, no browser errors. These are local observations, not a guaranteed latency or p95. A single authorized live contract check on Edge v12 returned the initial full workspace in 8,014 ms, local calculation in 225.67 ms (Node), and the server-validated XLSX in 7,189 ms. XLSX: one HISTORIAL P V2 sheet, 15 columns, 1,397 Caja rows, every date within July 1–December 4. No direct Google reads or financial writes in that verification.

H-SICOF-INSTANT-FILTERS-001 RESULT
Status: PASS
Files changed: focal UI/client/Worker/build inputs/handler/simulation; focused tests; generated v321 bundle and cachebuster; governance adenda, this audit, aggregate evidence and derived registry.
Source-of-truth verdict: PASS; Google observation and Supabase savings authorities unchanged.
Invariant verdict: PASS; same engine, original records and historic values preserved.
Build: PASS; unchanged unrelated bundle chunks, exact Worker generator, Pages allowlist.
Tests: PASS; pure equivalence, handler authorization/fingerprints, independent real Worker browser, original UI, deadlines and Pages.
Security: PASS; memory-only context-bound derivative; backend revalidates exports/save; no new browser credentials or persistence.
Legacy impact: read-only derivative, no formula or writer change.
Unexpected files changed: none in isolated release; unrelated root changes preserved.
Known limitations: initial load/export still require server reads; unsupported/expired contexts require refresh; partial-semester contribution policy unchanged.
Evidence: docs/qa/evidence/sicof-instant-filters.json. Recovery: prior v320 focal release and saved Edge v11 package; no data rollback required.
