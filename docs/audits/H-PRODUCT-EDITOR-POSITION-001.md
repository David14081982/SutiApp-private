# H-PRODUCT-EDITOR-POSITION-001

## PRE-CHANGE AUDIT — 2026-09-28

Status: PASS. OWNER explicitly restricts the correction to the editor's position.
Objective: opening a product after scrolling the catalog must show the editor at
the top; closing it must return to the previous catalog position.

Scope: ProductEditor mount/unmount scroll handling only. Files authorized for this
H: app/screens-admin-program-products.jsx; generated app/bundle.js; SutiApp.html
and sw.js cachebuster values only; scripts/test-product-editor-position.js;
this audit; docs/AGENT_CHANGELOG.md; docs/qa/evidence/product-editor-position-20260928/*.
No rates, down payments, audience/visibility rules, business data, repositories,
shared shell/routing, Auth, SQL, images/viewer or worker behavior changes.

Architecture Navigator: lookup confirms ProductEditor in the focal module. Registry
is already STALE with unrelated existing changes; direct source and published
browser inspection establish the current container hierarchy. This scroll-only
correction adds no architecture or data authority; do not regenerate the Registry.

Authority: program_catalog_items remains unchanged. No business-data writers will
be invoked. Existing authenticated browser reads are allowed for focal verification.
Legacy: READ ONLY / no financial computation, Google, formula or trigger changes.
Risk: accidentally losing list scroll on close or affecting mobile. Verify both.
Recovery: revert only this H's source/generated patch and cachebuster values.

UI contract: preserve images/gallery, all fields, financing section, active/sold,
provenance, save/cancel, preview and current styles. Only initial scroll position
and restoration on dismissal may change. No redesign or new controls.

Baseline reproduced against sutiapp.com: opening the final Tours item with desktop
workspace scrollTop=4228 renders the editor at y=-4228. Manually setting the
workspace scrollTop=0 reveals Editar producto. Zero page errors and business writes.

Verification: browser opening existing and new products after scrolling, desktop
and mobile, close/cancel restoration, editor content reachable, no page errors;
bundle syntax, focal module parity and unchanged unrelated chunks. Global image
regression NOT APPLICABLE under AGENTS.md GENERATED_ARTIFACT exception: no shared
runtime source or worker logic changes. Build/test evidence remains local.

## Verification and UI preservation

Implementation: an editor-local ref/useLayoutEffect captures scrolled ancestor
positions, sets them to zero before paint and restores them on unmount. All JSX
controls, styles, data operations and financial behavior are preserved.

- Published baseline: `node scripts/test-product-editor-position.js --baseline`.
  BUG_REPRODUCED at 1600x900 (header y=-4228) and 1280x720 (y=-4408).
  Mobile 390x844 already displayed the editor at y=0.
- Candidate: `node scripts/test-product-editor-position.js`. PASS for existing
  product and new product at all three viewports (six cases). Header y=0, complete
  controls present, footer reachable and Cancel restores the exact list scroll.
  Zero page errors and zero catalog mutation requests. Tests use a local bundle
  intercepted in the browser with live read-only catalog data; nothing deployed.
- Build: replace only the plain-JS focal module in the existing bundle and parse
  with vm.Script. PASS. Comparison against HEAD: one changed chunk, 138 unchanged.
- Source/bundle parity PASS. HTML and worker differ solely in version values:
  bundle 298 / worker 232. Worker logic byte-identical after version normalization.
- Scoped `git diff --check` PASS. Whole-worktree check reports pre-existing
  whitespace in the unrelated admin_assisted_context migration; not edited here.

CLAUDE UI PRESERVATION REVIEW: PASS. Existing sections, controls, navigation,
gallery, financing, provenance, save/cancel and styling retained. Only initial
scroll and dismissal restoration changed. No unauthorized redesign.

## H-PRODUCT-EDITOR-POSITION-001 RESULT

Status: PASS — local correction verified; not published.
Files changed: focal editor, generated bundle, HTML/worker cachebuster values,
focal browser check, this audit, changelog and scoped JSON evidence.
Source-of-truth verdict: PASS — no data authority, readers or writers changed.
Invariant verdict: PASS — diff limited to requested positioning behavior.
Build: PASS — one module changed, 138 preserved; JS syntax and parity verified.
Tests: PASS — six browser cases, controls/footer and scroll restoration.
Security: NOT APPLICABLE to implementation; no Auth/backend/permissions change.
Legacy impact: none; no rates, down payments, visibility or business-data changes.
Unexpected files changed: none attributable to this H; baseline dirty files retained.
Known limitations: local candidate only; service worker logic not changed/tested.
Evidence: docs/qa/evidence/product-editor-position-20260928/{baseline,browser,build,verification}.json.

## SUTIAPP ARCHITECT REVIEW

Task: H-PRODUCT-EDITOR-POSITION-001.
Verdict: APPROVED for the requested local position correction.
Critical findings: real published reproduction and candidate checks agree with the
source diff. No financial or visibility work was introduced. Local artifact status
is explicit; no production deployment is claimed.
Source of truth: unchanged. Architecture: local scroll effect only.
Security: unchanged. Data: no catalog writes. Legacy: no impact.
Owner decision: NO for this completed local correction.
Next action: report the verified position fix and its local publication status.
Response generated for Codex: YES.

### RESPONSE TO CODEX

Approve H-PRODUCT-EDITOR-POSITION-001 as a local, verified positioning correction.
Report that the editor opens visibly and restores list position on dismissal.
Do not expand into rates, down payments, visibility rules or production business
data. No automatic next H or deployment is authorized by this review.

## Publication authorization — 2026-09-28

OWNER explicitly authorized publication with "publicalo" after the verified local
result. Publish only this H's reviewed files; preserve unrelated worktree changes.
Extend the existing focal browser check with --published (no bundle interception),
then verify public artifact parity and all six position/restore cases. This
supersedes the prior local-only boundary. No business-data writes are authorized.

Release isolation: local HEAD 91a6d6f contains an unpublished document change;
origin/main is 19e9951. Publishing local main would exceed OWNER's position-only
scope. Create .tmp/product-editor-position-release as a worktree from origin/main;
copy only this H's source, focal test/audit/evidence, rebuild its single module on
the remote bundle and apply cachebusters there. Changelog receives only this H's
entry. Verify this isolated candidate before pushing it to main. The existing
local document commit and all other worktree edits are retained unchanged.
