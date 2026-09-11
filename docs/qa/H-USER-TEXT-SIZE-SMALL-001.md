# H-USER-TEXT-SIZE-SMALL-001

Current status: **PASS - integrated into main and deployed to https://sutiapp.com/**.
Production commit: 54ef4026bb6d8203ea55cb731d3d2279ffa03680. Final release evidence:
`docs/qa/evidence/text-size-small-20260911/release/`. Earlier local-only statements
below are historical stages superseded by the later owner-authorized release.

## PRE-CHANGE AUDIT — 2026-09-11

- Objective: owner-authorized Small (0.875), preserving existing flows and typography in Normal/Large/Largest.
- Baseline: `2aa05b9`, clean checkout `C:/tmp/sutiapp-text-size-release`; branch `codex/user-text-size-small-001`. The primary workspace lacks this feature and is not modified.
- Scope: `app/text-size-preferences.js`, `app/text-size.css`; generated `app/bundle.js`; version references only in `SutiApp.html` and `sw.js`; `docs/DECISIONS.md`, `docs/SOURCE_OF_TRUTH.md`, `docs/AGENT_CHANGELOG.md`, this report and `docs/qa/evidence/text-size-small-20260911/`.
- Test scope: `scripts/test-text-size-preferences.js`, `scripts/test-text-size-helpers.js`, `scripts/test-text-size-fixtures.js`, `scripts/test-text-size-live.js`, `scripts/test-bottom-nav-labels.js`; new `scripts/test-text-size-small.js` and `scripts/test-text-size-small-live.js`.
- Authority: Supabase Auth `user_metadata.sutiapp_text_size`, real authenticated principal. Existing `getUser` / `updateUser` readers/writers; no new API/table/RPC, no browser authority. Isolated fixtures are test-only. Live preference test may write only the test principal's preference and must restore its original value.
- Protected boundaries: routes, app shell logic, repositories, identity, permissions, images, Storage, financial calculations, Google, historical/business records and existing flows. Legacy classification: READ ONLY; presentation inspection only.
- UI contract: all existing sections, controls, interactions, navigation, loading/empty/error states, icons, padding, radii and shadows survive. Four vertical radio rows; existing 48px targets retained. Small input/select/textarea text stays 16px. Normal/Large/Largest computed presentation must match baseline.
- Risks: unsupported metadata in old clients; selector leakage from large-only layouts; grid reflow; small secondary text; cache update. Recovery must keep a reader accepting `small`; never bulk-reset saved preferences.
- Verification: bundle + Pages build, four-value reading/writing/default/invalid/session/error/reversal tests, computed scale and baseline parity, Chromium/WebKit navigation, 72 screen/width/size captures, live refresh/readback and isolated network errors. Run global image regression against local build and current GitHub Pages, with legitimate assets and no business writes.
- Navigator: Registry STALE (16 changed / 32 added), lookup insufficient. Directed discovery verified the actual preference, CSS, app consumers, existing tests and source-of-truth docs. No route/schema/authority/dependency change; no structural Registry regeneration.
- Status: PASS for scoped implementation authorization. Publication is not part of this change.

## Verification

Implemented in two production sources only: preference allowlist/error copy and CSS.
`app/bundle.js` comparison confirms exactly `text-size-preferences.js` changed among
114 bundled modules. `SutiApp.html` and `sw.js` are byte-equivalent to baseline after
normalizing only the declared version strings. Business repositories, routes,
financial code, Auth/session logic, backend and Storage are unchanged.

| Check | Evidence | Result |
| --- | --- | --- |
| Four ordered values, absent/null, unknown types, principal isolation | `preferences-unit.json` | PASS |
| Immediate selection, pending choice serialization, 12 failure/reversal pairs | `preferences-unit.json` | PASS |
| Remote preference writes/readback and restoration | `preferences-live.json` | PASS |
| Normal/Large/Largest computed CSS baseline comparison at three widths | `scale-and-compatibility.json` | PASS |
| 168 isolated screen/modal scenarios, four sizes | `fixtures/fixture-result.json` | PASS |
| Chromium + WebKit bottom navigation: 80 scenarios, 526 checks | `navigation/focal.json` | PASS |
| Six screens ? three widths ? four sizes, 72 captures | `screen-matrix.json` | PASS (final CSS) |
| Old reader rejection, failed precache, automatic SW reload, offline cached reader | `cache-upgrade.json` | PASS (isolated lifecycle test) |
| Pages build, 24 allowlisted public files | `pages-build.json` | PASS |
| Global legitimate images/documents, local + GitHub Pages | `global-*.json` | PASS: local 8080 and GitHub Pages |

All evidence paths above are relative to `docs/qa/evidence/text-size-small-20260911/`.
Live captures remain private at `C:/tmp/sutiapp-text-size-private/small-001-captures/`;
they contain legitimate account/business data. Only preference GET responses in the
matrix browser are overridden, explicitly as an isolated fixture; no business data
or assets are rewritten. The separate live preference test writes only the existing
test account preference and restores its original value.

| Normal computed px | Small computed px | Rounded display |
| ---: | ---: | ---: |
| 14 | 12.25 | 12.25 |
| 15 | 13.125 | 13.13 |
| 16 | 14 | 14 |
| 18 | 15.75 | 15.75 |
| 25 | 21.875 | 21.88 |
| 32 | 28 | 28 |
| 44 | 38.5 | 38.5 |

Measured in Chromium at 320/390/430. Small form controls are 16px, buttons 14px,
line-height 1.45 and minimum tested hit target 48px. An inline-label box correction
is scoped to Small so radio/checkbox rows honor the existing 48px minimum; explicit
component layouts keep precedence. Settings preserves four vertical rows and all
labels fit at 320px. No icons, padding, radii or shadows were resized.

Commands: `node scripts/build-bundle.js C:/tmp/babel-standalone-7.28.4.min.js`;
`node scripts/test-text-size-preferences.js`; `node scripts/test-text-size-small.js`;
`node scripts/test-text-size-fixtures.js`; `node scripts/test-bottom-nav-labels.js`;
`node scripts/test-text-size-small-cache.js`; `node scripts/test-text-size-small-live.js`;
`node scripts/test-text-size-live.js http://localhost:8080/` (while global server runs);
`node scripts/test-text-size-small-live.js --global`; `git diff --check`.

Limits: no physical iPhone test. WebKit engine checks are not a physical iOS claim.
The isolated offline SW test proves code-cache compatibility, not offline Auth reads;
real preferences still require the existing authoritative Auth read and visible error
on failure. Current GitHub Pages is the pre-change production baseline, not a deployment
of Small. No publication, merge or push has occurred.

Test-only scope extension: `scripts/test-text-size-small-cache.js` exercises the
unchanged production SW lifecycle/bootstrap with isolated old/new preference
readers, failed precaching, automatic reload and offline reopen. No remote data.


Initial local global regression failed with `DOCUMENT_PREVIEW_UNAVAILABLE` during
PDF authorization; a directed repeat identified `FunctionsFetchError` without an
HTTP response. Current GitHub Pages passed the full unchanged regression. The
existing `scripts/test-bottom-nav-labels-global.js` documents this host's HTTP/2
transport issue. The local retry uses that same HTTP/1.1 browser-only configuration,
with an exact assertion that no corpus, assertions or timeouts changed. This does
not change application flags, backend behavior, documents or access permissions.
Initial failure remains in `global-local-first-attempt.json` and the private log.


Root cause of the local-only failure was established by a read-only CORS preflight:
`http://localhost:8080` returns HTTP 204 with matching allow-origin;
`http://localhost:8081` returns HTTP 403 `ORIGIN_DENIED` and allow-origin 8080.
The test driver had used 8081 to parallelize servers. Repeating with HTTP/1.1 on
8081 still failed, disproving transport as the fix. The driver now uses the existing
allowed origin 8080; no CORS, backend, document or application changes were needed.
See `local-origin-diagnostic.json`; both failed harness configurations remain recorded.


## Final verification and review

The unchanged global regression passed on allowed local origin 8080 with default
browser transport, and independently on current GitHub Pages. Seal/Login, profile,
Admin Afiliados, legitimate images and PDF, Membership, Loan, program catalog/gallery,
Marketplace, fullscreen, refresh and with/without SW all pass. No asset or document
substitution; `productionDataMutations=0`. Production is a baseline comparison only.

CLAUDE UI PRESERVATION REVIEW
- Screens: Inicio, Mi Financiera, Convenios, Historial, Credencial, Configuraci?n;
  direct dependencies include savings, bank form, catalog/detail and notifications.
- Original sections, order, states, interactions and navigation: preserved.
- Added: Peque?o as the first existing-style radio row; explicit unknown-version copy.
- Missing sections: none. Unauthorized redesign: NO. Verdict: PASS.
- Evidence: exact source/bundle diff, 168 fixtures, 72 live-data captures, navigation
  and global image/PDF tests. Manual screenshot inspection covered all six screens.

H-USER-TEXT-SIZE-SMALL-001 RESULT
Status: PASS (local implementation; not published)
Files changed: two production sources, generated bundle/version references,
  focused tests, governance and QA evidence; see scope.json for exact inventory.
Source-of-truth verdict: PASS ? same self-only Supabase Auth metadata; no fallback.
Invariant verdict: PASS ? existing sizes/flows, business identity and data unchanged.
Build: PASS ? 114 source modules, 24 public files, final served hashes match sources.
Tests: PASS ? 12 rollback pairs, 168 fixture surfaces, 526 navigation checks,
  72 live-data captures, scale/baseline parity, remote persistence and cache upgrade.
Security: PASS for scoped writer/identity tests; backend/RLS/CORS unchanged.
Legacy impact: none; no Google or financial calculations/writes.
Unexpected files changed: none against declared scope.
Known limitations: no physical iPhone test; no deployment/merge/push. A rollback
  must retain a reader compatible with small, as documented in DECISIONS.md.
Evidence: docs/qa/evidence/text-size-small-20260911/; private captures and gallery:
  C:/tmp/sutiapp-text-size-private/small-001-captures/index.html.


## Release authorization and pre-change audit ? 2026-09-11

The owner's subsequent ?hazlo? authorizes integration into main and deployment,
following the completed commit/push. Previous ?not published? statements describe
the earlier local stage, not a current restriction. Remote main has 11 later commits;
they are retained in full. The primary dirty workspace remains untouched.

Release scope: merge origin/main into the feature branch; resolve only version
references in SutiApp.html/sw.js and retain both changelog histories. Compare the
merged bundle against remote main: only text-size-preferences.js may differ.
Use bundle v250, CSS v244 and SW/cache v196, above remote main v249/v243/v195.
Test-only adjustments in test-text-size-small.js and test-text-size-small-cache.js
allow comparison against the actual release base and derive version assertions.
Release evidence goes to docs/qa/evidence/text-size-small-20260911/release/ and this
report/changelog. No new runtime architecture or authority. No schema/data migration.
Recheck focal tests, final merged build, backend deployment contracts and global
local assets. Push the integrated commit to main only after verification, then check
workflow, served hashes, preference persistence and global production assets.
Recovery must retain the small-compatible reader, never reset account preferences.

Release test environment update: the previous installed Chrome path no longer
exists. Use the existing Playwright Chromium executable via test-only
SUTIAPP_CHROMIUM_EXECUTABLE in preference, scale, cache, matrix/live tests and the
configured copy of the unchanged global regression. No app/browser-user settings,
assertions, corpus, timeouts or backend permissions change.


Release preflight: PASS. Base 18bb07c retained in full; 116 bundled modules, only
text-size-preferences.js differs from main. Final local build matches served assets;
72 captures, scale/baseline parity, 12 rollback pairs, cache update and global local
legitimate image/PDF regression PASS. Auth and request deployment contracts PASS.
Release reviewer: APPROVED_FOR_AUTHORIZED_DEPLOYMENT. Evidence under release/.
Publication and post-deployment verification follow under the owner's authorization.


## Production result and architect review

H-USER-TEXT-SIZE-SMALL-001 RESULT
Status: PASS - main integrated and production deployed
Files changed: original focal scope, version references, test harness and evidence;
  11 later main commits retained; no unrelated runtime modification.
Source-of-truth verdict: PASS - same self-only Auth metadata, no fallback.
Invariant verdict: PASS - one changed module among 116; business flows preserved.
Build: PASS - final served hashes match bundle v250 / CSS v244 / SW v196.
Tests: PASS - merged 72-case matrix, scale parity, 12 rollback pairs, cache upgrade,
  backend contracts, live production read/write/refresh/rollback, global local and
  production assets and legitimate PDF. Test account preference restored.
Security: existing self-only writer and cross-principal checks preserved; no backend,
  RLS, CORS or permission edits. No secrets in public files.
Legacy impact: none; no financial/Google changes or business writes.
Unexpected files changed: none beyond audited release/evidence scope.
Known limitations: no physical iPhone test. Recovery retains a small-compatible reader.
Evidence: release/deployment.json, preflight-review.json, bundle-and-scope.json,
  global-local.json, global-production.json, preferences-production.json,
  final-review.json and focused reports. Pages and Membership Google contract
  workflows completed successfully for commit 54ef4026bb6d8203ea55cb731d3d2279ffa03680.

SUTIAPP ARCHITECT REVIEW
Task: owner-authorized integration and production release of H-USER-TEXT-SIZE-SMALL-001
Verdict: APPROVED
Critical findings: resolved version/changelog merge conflicts without dropping main
  changes. Test-only Chrome path adjusted to installed Playwright Chromium; unchanged
  global assertions and corpus. Production hashes and functional checks pass.
Source of truth / Architecture / Security / Data / Legacy: preserved as above.
Owner decision: NO - merge/deployment authorization was supplied in the conversation.
Next action: close the H and report the live app. The final evidence-only follow-up
  retains byte-identical runtime and needs no repeat of already passed browser tests.
Response generated for Codex: YES - close PASS; do not start another H.
