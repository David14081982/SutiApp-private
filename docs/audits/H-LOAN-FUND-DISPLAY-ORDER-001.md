# H-LOAN-FUND-DISPLAY-ORDER-001

PRE-CHANGE AUDIT
Owner requests Caja de Ahorro immediately after Caja Chica in the available-fund carousel.
Cause: FundPicker renders programs.map in received runtime rule order (historical criterion row order), without presentation priority.
Scope: app/screens-loan.jsx FundPicker only; generated app/bundle.js and SutiApp.html; this audit and own changelog entry. Existing unrelated audit/changelog edits preserved.
Implementation: stable presentation ordering by immutable fund code in runtime id; Caja Chica first, Caja de Ahorro second, other funds keep relative order. Copy the array, preserve objects and selected id/click behavior. No extra fund, fallback, repository or shared helper.
Authority/source/legacy/security: unchanged backend eligibility, amount/rate/term/quote writers and Google. Visual order only. No financial/business mutations.
Visual preservation: same cards, labels, rates, amounts, carousel, focus, selection and four-step flow; only requested order changes.
Navigator stale only documentary evidence; directed source inspection confirms focal render. No structural registry update needed.
Tests: isolated browser actual FundPicker source/bundle at 390/768/1440, reversed/missing/renamed funds, stable other order, immutable inputs, selected card/click; existing loan UI static contracts. Build chunk equivalence.
Recovery: revert focal source and regenerate bundle; no data recovery.
Status: PASS before implementation.


Scope update before edit: sw.js CACHE name and CORE bundle query only are GENERATED_ARTIFACT for this focal release. Existing HTML v282 / worker v278 drift trips assertPwaVersionSync. Align to v283 and rotate cache v216->v217; no service-worker logic, shared helper or runtime behavior edited. Global regression NOT APPLICABLE under generated cachebuster exception; focal bundle and version contract verified.


## Verification

TEMP isolated Playwright harness executes the actual FundPicker source and compiled bundle at 390/768/1440: correct priority, stable remaining order, immutable input, renamed fund identified by code, missing-priority funds, selected id preserved, clicking Savings selects its original id, no overflow or browser errors. No production writes and no permanent QA file.
Existing test-loan-simulator-ui-cutover.js PASS including the complete static four-step/quote contract and HTML/worker bundle synchronization.
Build:132 current source modules; only screens-loan.jsx changed; 131 unrelated chunks byte-identical. Two historical precompiled modules emitted directly from current source to preserve their representation. git diff --check PASS.
UI preservation: same cards/data/controls/carousel; only requested ordering. No selection/default/rate/eligibility modifications.

H-LOAN-FUND-DISPLAY-ORDER-001 RESULT
Status: PASS local; publication recorded below.
Files: screens-loan.jsx, bundle, HTML, worker cache version/query, audit and own changelog entry.
Source-of-truth / invariants / security: PASS, unchanged backend and financial authorities.
Build/tests: PASS source/bundle browser and existing static contract.
Legacy impact: NONE. Unexpected files changed: 0. Preexisting unrelated edits preserved.
Known limitations: browser viewport emulation, no physical device or real loan submitted.
Registry: presentation and generated cachebusters only; no dependency or authority change, no structural regeneration required.

SUTIAPP ARCHITECT REVIEW
Task: H-LOAN-FUND-DISPLAY-ORDER-001
Verdict: APPROVED
Critical findings: runtime array order was rendered directly; now stable code-based display priority on copied array.
Source / architecture / security / data / legacy: unchanged; two worker constants only, no worker logic.
Owner decision: NO
Next action: publish verified artifact and close, no next H.
Response generated for Codex: YES

### RESPONSE TO CODEX
Approve focal restoration of requested order. Publish and verify HTML/worker/bundle version and hash; preserve unrelated work.
