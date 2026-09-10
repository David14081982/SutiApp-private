# H-POPUP-DOTS-SINGLE-ROW-001 (text-size follow-up C2)

## PRE-CHANGE AUDIT

- Request: correct the two rows of popup pagination dots in the owner's screenshot. Keep all indicators small, in one row, with the selected image highlighted.
- Base: production `908846db7a31e2de660e71003bbcf0be8ccb1145`, branch `h-popup-dots-single-row-001`. The cancelled/unpublished BottomNav work remains on its separate branch and is excluded.
- Navigator: AdminPopup lookup + freshness check; STALE presentation/evidence files, so inspected actual `app/admin-store.jsx` and CSS directly. No architecture mapping changes.
- Cause: C1 gives each dot a separate 48px-wide button and flex-wrap. Seven controls require 336px before arrows/padding; the 320px popup has only 232px inside its footer. All separate 48px targets cannot fit simultaneously on one line.
- Plan: use one native discrete range control (at least 48px high and wide) with a decorative row of all image markers. Keep direct selection, keyboard selection and full accessible current image/count. Keep arrow targets independent. Markers are not separate overlapping hit targets. The selected marker retains guinda color and a wider pill where space permits. No font reduction, truncation or horizontal scroll.
- Files: `app/admin-store.jsx` AdminPopup only; popup-specific rules in `app/text-size.css`; generated bundle and HTML/SW cache references; `scripts/test-popup-dots-single-row.js` and `scripts/test-popup-dots-live.js`; this H, AGENT_CHANGELOG and `docs/qa/evidence/popup-dots-single-row-20260909/*`. Temporary private artifacts may use `C:/tmp/sutiapp-text-size-private`.
- Data/authority/API/tables/writers: unchanged. Items continue to arrive from the same caller. Slider position is existing component state, not a new preference or authority. No Supabase or business writes.
- Preserve: image, title/body, slide motion/direction, next/previous wraparound, 5.2s autoplay, hover pause, CTA/navigation, dismissal and custom-content behavior. Pause autoplay while the new native selector has keyboard focus. Admin preview uses the same focal component.
- Risk: small-width fit, marker/input alignment, touch and keyboard selection, autoplay/focus interaction. Verify production component isolated in Chromium/WebKit at 320/390/430, Normal/Grande/Muy grande, counts 1/2/5/7/10; actual deployed popup after publication.
- Global image regression: NOT APPLICABLE; no shared image helper, repository, viewer, Auth, routing/shell geometry or SW logic change. Generated bundle alone does not widen scope. Build + focal component/dependencies + post-change verification apply.
- Recovery: revert this H and redeploy; no data rollback.
- Audit: PASS. Publication is authorized by the original text-size/popup request and this requested correction; do not include the abandoned BottomNav branch.

## Visual contract

AdminPopup: header image, close button, promotional copy, arrows, position indicators, primary CTA and dismissal remain. Only pagination arrangement/accessible selection control changes. All images remain directly selectable; the native control exposes current image number/title. No screen sections removed or unrelated UI redesign.

## Implementation and verification

- Reproduced the published defect: seven dots occupy two rows at 390px. The footer combines `flex-wrap` with a separate 48px minimum width for each marker. Root cause is proven in `focal.json` against production base `908846d`.
- The footer now has one discrete native slider with small decorative markers on a single flex row. Pointer coordinates select the corresponding equal-width marker slot; native thumb geometry differs across engines and cannot define those slots reliably. Touch, mouse and keyboard all update the same existing image index.
- The selector and both arrow controls retain at least 48px touch targets without overlap. Focus pauses autoplay and has a visible keyboard outline. Blur resumes the original timer. Vertical touch scrolling remains allowed.
- `node scripts/build-bundle.js C:/tmp/babel-standalone-7.28.4.min.js`: PASS, 114 source modules and syntax validation.
- `node scripts/test-popup-dots-live.js`: PASS, 24 allowlisted build files; real seven-image popup at 320/390/430 and Normal/Grande/Muy grande. Nine scenarios, loaded image, direct touch selection of every image, arrows/wraparound, keyboard, accessible count/title and dismissal. Zero popup/document horizontal overflow and zero attempted persistent REST/preference mutations.
- `node C:/tmp/sutiapp-text-size-private/check-single-row-scope.js`: PASS. 113 of 114 generated bundle modules identical. `admin-store.jsx` outside AdminPopup, CSS outside pagination, BottomNav, app shell, image viewer, preference authority and all HTML/SW logic identical. Only cache references change to bundle241/CSS242/worker189. `scope.json` records hashes and file inventory.
- Real account screenshots remain private outside Git. Committed screenshots use isolated synthetic content with all network requests aborted; that fixture is never part of the published site.
- The cancelled BottomNav commits `3062121` and `87a8c83` are excluded. No viewport, safe-area or navigation geometry change is included.
- Physical iPhone/Android and VoiceOver/TalkBack are not claimed as tested. Browser-engine coverage is Chromium and Playwright WebKit; production runtime is additionally verified after deployment.
- `node scripts/test-popup-dots-single-row.js`: PASS, 90 scenarios (2 engines x 3 widths x 3 text sizes x 5 image counts). Seven published markers previously occupied two rows; every corrected set occupies one. Mouse/touch/direct selection, pointer drag, keyboard Home/End/arrows, visible keyboard focus, autoplay pause/resume, arrow wraparound and CTA/dismissal pass. Zero browser errors; isolated backend requests/writes: 0.

## Local result

```text
H-POPUP-DOTS-SINGLE-ROW-001 RESULT
Status: PASS (local implementation; publication verification follows)
Files changed: AdminPopup, popup pagination CSS, generated bundle/cache references, two focal test scripts, H/changelog/evidence.
Source-of-truth verdict: PASS - unchanged callers, authorities, preference persistence and writers.
Invariant verdict: PASS - one row, 48px selector/arrows, no overlapping targets or horizontal overflow; existing popup structure/actions preserved.
Build: PASS - 114 modules; 24-file public allowlist.
Tests: PASS - 90 isolated Chromium/WebKit scenarios plus 9 real-popup local scenarios.
Security: PASS for unchanged frontend scope; backend/RLS review NOT APPLICABLE.
Legacy impact: NONE; financial calculations and protected systems identical.
Unexpected files changed: NONE.
Known limitations: no physical devices or assistive-technology session claimed; cancelled BottomNav task excluded.
Evidence: evidence/popup-dots-single-row-20260909/{focal,local,scope}.json and synthetic screenshots.
```

## CLAUDE UI PRESERVATION REVIEW

- Screen: AdminPopup (affiliate and same-component admin preview).
- Original/current sections: image, optional badge/subtitle, heading, body, pagination/arrows, CTA, dismissal, custom screen.
- Missing/added sections: none. Native accessible pagination replaces separate marker targets within the same footer.
- Interactions preserved: slide selection, direction, arrows/wraparound, 5.2s autoplay, hover pause, CTA and close. Keyboard focus also pauses autoplay.
- Navigation preserved: YES; `act`, `close`, `navBtn` and custom-screen behavior unchanged.
- Visual structure preserved: YES; diff and browser screenshots confirm only the requested pagination arrangement changed.
- Unauthorized redesign: NO.
- Verdict: PASS.

## SUTIAPP ARCHITECT REVIEW

Task: H-POPUP-DOTS-SINGLE-ROW-001, local release candidate.

Verdict: APPROVED. Read-only review of actual diff, regenerated module comparison, test assertions/results and screenshots. No delegation or next-H implementation.

Critical findings: the previous 48px-per-dot layout forces wrapping; the corrected single 48px-high range exposes image count/title and retains small one-row markers. Direct slot mapping avoids browser-specific native-thumb offsets. All 90 isolated and nine real-popup cases pass. Exactly one bundle module changes; HTML/SW changes are cache references only. The unrelated BottomNav commits are excluded.

Source of truth: unchanged. Architecture: focal presentation and local selection state only; Registry structural update NOT APPLICABLE. Security/data/legacy: no new writer, authority, permission, schema or financial change.

Governance: current explicit popup correction and original publication instruction authorize this release. `WORK_QUEUE.md` concerns a separate protected financial task and is not advanced. `WORK_QUEUE_HISTORY.md` is absent; no historical queue authorization is inferred. No next-H continuation is authorized.

Owner decision: NO.

Next action / RESPONSE TO CODEX: Publish this isolated correction under the existing user authorization, verify deployed file hashes and the real popup, record evidence, then stop. Do not publish the cancelled BottomNav work or start another H.
