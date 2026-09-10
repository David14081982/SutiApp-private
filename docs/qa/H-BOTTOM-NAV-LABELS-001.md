# H-BOTTOM-NAV-LABELS-001

## Pre-change audit

- Request: one-line BottomNav labels; largest uses Inic/Fina/Conv/Hist/Cred/Admi, large retains full names while they fit, normal retains full names. Full accessible names/title, equal centered tabs, unchanged typography size and navigation. Validate 320/360/375/390/430px in all three sizes.
- Base: `b9f8bc923cdc489810e4118a34799cdd751ff859`, isolated branch `h-bottom-nav-labels-001`. Original dirty workspace and cancelled safe-area branch remain untouched.
- Navigator: check STALE (16 changed/17 added); BottomNav lookup leads to `app/app.jsx`. Directed inspection confirms component and `app/text-size.css`, not the legacy financial domain suggested by broad registry aliases. No architecture mapping changes intended.
- Scope/files: BottomNav presentation/TABS and its text-size prop in `app/app.jsx`; BottomNav-only CSS in `app/text-size.css`; regenerated `app/bundle.js`; HTML/SW cache references only; `scripts/test-bottom-nav-labels.js`, `scripts/test-bottom-nav-labels-live.js`, and the reproducible global-test launcher `scripts/test-bottom-nav-labels-global.js`; this H, `docs/AGENT_CHANGELOG.md`, `docs/qa/evidence/bottom-nav-labels-20260909/*`. Private scripts/screenshots/builds may use `C:/tmp/sutiapp-text-size-private`.
- Excluded: safe-area, viewport, shell/scroll geometry outside label row, navigation/filter/permission logic, screen names/titles/routes, other surfaces, popup, images, repositories, Auth, Supabase, data/business/financial rules and protected legacy.
- Authority: existing `data-text-size`/React projection from Auth metadata; no new authority, persistence, preference writer or backend access. Label fit is ephemeral presentation only.
- Observed cause: generic accessibility CSS permits wrapping everywhere and BottomNav explicitly reserves `2.8em` (two lines), while retaining complete long names at every scale.
- Plan: full and abbreviated presentation labels with unchanged full accessible names; one-line label CSS; detect available tab width at actual font metrics and reserve active weight. Largest always abbreviated, large abbreviates only when necessary. Measure normal at narrow widths before claiming all its requirements simultaneously fit.
- Invariants: same tab IDs/order/filter/callbacks, active indicator/icons/colors, touch targets >=48px, uniform width, centered labels, no clipping/overlap/horizontal overflow or font reduction.
- Tests: baseline reproduction/measurement, focused actual component in Chromium/WebKit for requested matrix including active/inactive and five/six tabs, live app and bundle equivalence; production after publication under existing authorization. New account preference writes are not needed for layout tests.
- Verification scope: focused labels remain the implementation scope. Because BottomNav is in shared `app.jsx`, also run the existing required global image regression against the final local build and GitHub Pages. It reads legitimate assets/documents and does not change business data; no image/legacy fixes are authorized by this H.
- Live label matrix may override only `sutiapp_text_size` in the controlled browser's fetched Auth response to exercise all scales without persisting account changes. Original identity, permissions and all other response fields remain unchanged; persistent REST/preference mutations are rejected. This is a private test-page fixture, never productive code or authority. Global regression uses original unmodified responses.
- Recovery: revert this isolated change and redeploy; no data rollback.
- Baseline measurement: at 320px with six tabs, each has 50px; Nunito Normal 14px requires 68.96px for Credencial at active weight. Four full names occupy two lines (`baseline.json`).
- Owner clarification: explicitly approved abbreviating in Normal only when a full name does not fit (response to the measured width conflict). Final Normal/Grande rule: full while it fits, abbreviated only when necessary; largest always uses all six requested abbreviations.
- Directed inspection also found Admin removes the affiliate typography root. BottomNav will therefore carry `data-nav-text-size` using the existing central typography tokens, keeping its labels consistent when Admin is active without applying affiliate typography to Admin content or creating another modal portal root.
- Audit status: PASS. No unresolved owner decision.

## Visual contract

BottomNav keeps its ordered permitted tabs, uniform touch areas, centered icons/labels, traveling guinda active indicator, inactive treatment and original callbacks. No sections/controls/routes are added or removed. Only visible label text, one-line fit and full accessible names change. Safe-area/viewport work from the cancelled H is excluded.

## Implementation and focused verification

- Largest always renders Inic/Fina/Conv/Hist/Cred/Admi. Normal and large retain each full name when it fits at active font weight; narrow-width abbreviation in Normal was explicitly approved by the owner.
- ResizeObserver and font-loading notifications update ephemeral label-fit state. Switching tabs cannot cause the active bold name to overflow. No font reduction, scale transform, ellipsis or clipping workaround is used.
- `aria-label` and `title` always contain the complete original screen name; `aria-current=page` identifies the active tab. IDs, filtering, permissions, callback bodies, routes and titles remain unchanged.
- The original central 1/1.15/1.35 typography variables also apply through `data-nav-text-size`. This attribute stays distinct from the affiliate content/modal root, so Admin content does not inherit the preference. Only the nav's labels carry it across Admin navigation.
- Build: `node scripts/build-bundle.js C:/tmp/babel-standalone-7.28.4.min.js` PASS, 114 modules. Local Pages build: PASS, 24 allowlisted files.
- `node scripts/test-bottom-nav-labels.js`: PASS, 60 combinations / 396 checks in Chromium and WebKit. Widths 320/360/375/390/430, all three scales, five/six tabs, all active states, one-tab Admin and hidden-tab distribution, resize/preference updates and system-font availability. Full names survive whenever they fit; font sizes remain 14/16.1/18.9px. One line, centered icons/text, uniform >=48px targets, zero clipping/overlap/horizontal overflow.
- `node scripts/test-bottom-nav-labels-live.js`: PASS, 15 local full-app scenarios, all six navigation callbacks/destinations and refresh. Original authoritative preference first verified unchanged; the remaining size matrix uses only the documented isolated browser response override. Identity/permissions unchanged; persistent preference/REST mutations rejected and zero attempts observed. Real account screenshots remain private; committed screenshots contain synthetic presentation content only.
- `node C:/tmp/sutiapp-text-size-private/check-nav-label-scope.js`: PASS. 113/114 generated modules are identical; only `app.jsx` changes. Everything outside BottomNav is identical except passing the existing text-size projection. Tab names/IDs/icons/filtering, indicator code, outer nav/safe-area styles and every other source module (including popup, preferences and repositories) remain identical. HTML/SW differ only in cache references: bundle242/CSS243/worker190. CSS changes are nav rules and aliases to unchanged central token values.
- `git diff --check`: PASS. Actual files match the declared scope; no unexpected files or backend/legacy changes. Structural Registry update is NOT APPLICABLE for presentation-only changes to an existing dependency.

## Authority, security and legacy verdicts

Source-of-truth audit: SAFE. Domain is navigation label presentation. Existing Auth metadata remains the single personal preference authority; the same React projection is passed to BottomNav. Label-fit state is disposable geometry, not durable business/preference data. No new reader/writer, storage, cache authority, fallback, seed or productive mock.

Supabase security: no runtime Auth, identity, permission, RLS/grant or API change. Test-only response override changes one presentation field, preserving all identity/permission values; account writes are blocked. Global image verification uses original responses and legitimate assets. No secrets, signed URLs or account screenshots enter committed evidence.

Legacy audit: READ ONLY for required regression/navigation checks, no direct Google call or business mutation introduced. All financial/savings/loan calculations, Apps Script, histories, APIs and repository modules remain byte-identical. No financial equivalence migration or owner decision is needed.

## CLAUDE UI PRESERVATION REVIEW

Screen: BottomNav.
Original/current sections: same ordered permitted tabs and active indicator.
Missing/added sections: none.
Interactions preserved: same callbacks, selection, indicator motion and icons; complete accessible names retained.
Navigation preserved: YES (six full-app destinations verified).
Visual structure preserved: YES, one requested label row; unchanged icons, colors, radii, outer safe-area styling and ordering.
Unauthorized redesign: NO.
Verdict: PASS.

## Verification transport incident

The first default-concurrency global run produced repeated `IMAGE_TIMEOUT` results (61/156 public assets and 17/29 affiliate files passed before inspection) and was interrupted once failure was established. All three sampled public assets that timed out returned HTTP 200 in 259-487ms outside that busy browser and loaded in the unchanged production browser within 4.1-5.9s (`network-probe.json`). No source/asset/data correction was made.

Retry the same global script via a private copy with only its test concurrency reduced from 12 to 3 and its repository root resolved explicitly. Asset corpus, original 20-second timeouts, retries, assertions, backend, credentials and checked surfaces remain identical. The checked-in global harness is not modified. This is transport pacing of verification, not an exemption or a PASS for the interrupted attempt.

The concurrency-3 diagnostic also encountered image timeouts and was interrupted after four confirmed failures. A controlled fresh-browser probe of the same three assets then completed in 230-460ms with Chromium launch flags `--disable-http2 --disable-quic`, versus 4.1-5.9s with default transport (`network-http1-probe.json`). This points to a host/browser transport issue; it does not prove its underlying external cause. Final verification restores original concurrency 12 and 20-second timeouts, changing only those test-browser launch flags and the private copy's explicit repository root. Every original assertion/corpus/surface remains; an inverse text comparison proves no other harness changes. No productive browser flag, service worker logic or application code is changed for this incident.

## Local result and architect review

The full local global regression now passes (`global-local.json`): 156/156 public assets, 29/29 affiliate files, 248/248 program images, profile/seal, Admin photos/document thumbnails, Membership/Loan documents, Marketplace, gallery/fullscreen, a legitimate protected PDF, refresh and with/without service worker. Zero browser errors or business data mutations. The test launcher is reproducible as `node scripts/test-bottom-nav-labels-global.js`; the original global script's hash, unchanged assertion/corpus contract and transport flags are recorded in the result.

```text
H-BOTTOM-NAV-LABELS-001 RESULT
Status: PASS - local candidate; production verification follows publication.
Files changed: audited BottomNav presentation/CSS, generated bundle/cache references, test launchers, H/changelog/evidence.
Source-of-truth verdict: PASS - existing personal preference authority and writers unchanged.
Invariant verdict: PASS - requested abbreviations, full accessible names, one centered label line, uniform touch areas, no overflow/clipping/overlap or font reduction.
Build: PASS - 114 modules, 24 public files.
Tests: PASS - 60 engine combinations/396 checks; 15 full-app cases; six destinations; refresh; full global image regression.
Security: PASS for unchanged runtime scope; no new Auth/RLS/backend behavior.
Legacy impact: READ ONLY verification; no data or calculation changes.
Unexpected files changed: NONE.
Known limitations: physical devices/assistive-technology sessions not claimed; host global transport workaround applies only to the test browser. Earlier failed attempts remain documented.
Evidence: baseline.json, focal.json, local.json, scope.json, global-local.json, network probes and synthetic screenshots.
```

SUTIAPP ARCHITECT REVIEW

Task: H-BOTTOM-NAV-LABELS-001 local release candidate.
Verdict: APPROVED after read-only review of the actual diff, module equivalence, DOM measurements, screenshots and complete regression outputs.
Critical findings: Normal's geometric conflict was measured and resolved by explicit owner clarification; only labels that cannot fit are abbreviated. Largest uses all six exact abbreviations. Admin preserves its original content typography while the navigation keeps the personal scale. IDs/callbacks/permission filters, shell/safe-area styles and original popup are unchanged. Full global regression passes using the original assertions and timeouts with documented test-only transport configuration.
Source of truth: unchanged. Architecture: existing presentation dependency, no new authority or structural registry mapping. Security/data/legacy: unchanged, read-only test activity only.
Owner decision: NO. `WORK_QUEUE.md` is an unrelated protected financial queue and is not advanced; `WORK_QUEUE_HISTORY.md` is absent. This release follows the current explicit correction/clarification and the existing publication instruction, not inferred queue authorization.
Next action / RESPONSE TO CODEX: publish only this audited label correction, verify the deployed bytes, label matrix and required global images against GitHub Pages, record results and STOP. Do not publish the cancelled viewport/safe-area changes or begin another H.
