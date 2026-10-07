# H-DOCUMENT-PREVIEW-RENDER-001

## PRE-CHANGE AUDIT

Owner reports the generated-document preview shows a native PDF placeholder with “Abrir”, instead of document pages. This continues the authorized surgical correction. The previous assignment fix established correct PDF bytes and assignment, but its browser evidence did not prove visible pages. That visual claim is superseded by this audit.

Navigator: FRESH on main 0625dbbc26162d3a2915a854fa7d0d8a430a1746; directed lookup document generation preview. Evidence: screens-admin-document-generation.jsx mounts a native iframe for modal preview; document-layout-designer.jsx already contains a private PDF.js canvas renderer. Shared image-viewer.jsx also uses native PDF; it does not solve this issue and is outside this scope.

Objective: show the actual generated PDF pages in the existing preview modal, independent of native browser PDF support, with pagination and explicit loading/error/retry states. Reuse the already published PDF.js renderer/dependency within Documentos y Firmas. Preserve source bytes and existing assignment behavior.

Allowed files: this audit; docs/AGENT_CHANGELOG.md; docs/qa/evidence/document-preview-render/; app/document-layout-designer.jsx and app/screens-admin-document-generation.jsx; scripts/test-document-preview-render.js, scripts/verify-document-preview-render-live.js, scripts/document-preview-release.js; necessary focused test adapter scripts/test-document-assignment-fix-browser.js; architecture-overrides and five derived Registry files only for the confirmed component dependency; generated app/bundle.js, SutiApp.html and sw.js cachebusters. Temporary fixtures, browser profiles, captured synthetic previews and build files under .tmp/document-preview-render/. Existing unrelated root changes remain untouched; implementation stays in isolated release checkout.

Data/authority: document-generation Edge remains the authority producing synthetic preview PDF. PDF.js reads only its already authorized Blob URL into memory and draws it; no alternate business authority or persistent cache. Existing repositories retain Auth/context checking. No configuration, signature, template, layout, issued record, Storage policy, URL signing, schema, Edge, finance or Google change.

UI contract: retain modal title/subtitle, dimensions, header close, footer close, Configurar draft/return, tabs/cards/form controls and responsive structure. Replace the native preview content with page canvas and the existing designer's previous/next/download controls; errors are visible and recoverable. Issued-document viewers, template thumbnails and shared viewer remain unchanged. Canvas content comes from the real PDF, never a DOM approximation or mock.

Scope classification: renderer is internal to the single Documentos y Firmas feature (Designer child and its preview modal), not the shared asset viewer. No shared repositories/helpers used by other program surfaces are changed. Global image regression is NOT APPLICABLE unless implementation scope expands into shared viewer/assets/auth/routing/SW logic. Focal tests include the reused designer renderer and current assignment interactions.

Risk: PDF worker loading, cancellation on close/retry/page changes, stale page/errors after changing source, mobile overflow, native-viewer assumptions, and false-positive validation using PDF bytes without pixels. Use local published PDF.js/worker; do not add a CDN or browser-setting requirement.

Tests: actual two-page synthetic PDF with distinct colored markers; Chrome with native PDF viewer disabled and verified; canvas pixels/page changes, invalid PDF visible error/retry, close during load/render, responsive 390/1440, preserved assignment UI, build with only two changed chunks. Authenticated local/published test uses the controlled QA account with direct configured-origin authentication, blocks business writes, and verifies actual rendered pixels and cropped synthetic preview screenshots. No real-data screenshots or reissues.

Recovery: revert the two focal frontend chunks/cachebusters using their committed baseline; no data recovery needed because no business data writes are authorized. Preserve all preexisting local work.

Status: PASS for scoped implementation. Final verification is recorded below.

## Candidate verification

Implementation exports the existing renderer as DocumentLayoutDesigner.PDFPreview and uses it only for modal preview. Actual canvas rendering is tied to the current source URL, retry attempt and page number; fetch, PDF worker and page rendering are cancelled on cleanup. CSS is contained in the renderer and preserves the original modal.

Local renderer tests PASS with Chrome's native PDF viewer verifiably disabled: real PDF.js/worker, red/blue page markers, page navigation, URL reset, invalid PDF/retry, closing during load/render, designer reuse and draft preservation at 390/1440. Both synthetic screenshots were visually inspected. Existing assignment screen suite: 20 checks PASS; its historical evidence was preserved. The corrected verifier now checks pixels; an HTTP success, PDF header, Blob or empty iframe is insufficient.

Build v2026100417 SHA256 d7777ed889f12c75e83a9b6bf7a64eac5e25c66552a66724544a28e5a07277b6; exactly two focal chunks regenerated, 154 unrelated chunks identical. Pages allowlist/PWA test PASS with zero forbidden files. No backend/data/configuration files changed.

Authenticated candidate boundary: login, configured project, native viewer disabled, effective card and configuration succeed on loopback. The PDF endpoint correctly rejects Origin http://127.0.0.1:4178. A separate unauthenticated OPTIONS request proves HTTP 403 DOCUMENT_ORIGIN_DENIED without Access-Control-Allow-Origin. The complete local integration attempt is not a PASS and is retained as such. This is a deliberate backend origin restriction, not a renderer failure. No CORS setting, origin header or security control is changed; final authenticated visual verification will run on the authorized published sutiapp.com origin. Isolated renderer/page/pixel tests and the public build remain PASS.


## Published closure

Runtime commit 2b5e3d03929ea53c4b5e621688f75392005bd742 published by Pages run 37665165970 (SUCCESS). Public HTML, bundle, service worker and both local PDF.js modules match the tested candidate byte-for-byte. Version 2026100417 remains unchanged during evidence-only completion.

Authenticated live verification PASS at 390 and 1440 with native PDF support verifiably disabled. The actual Membership synthetic preview is a two-page PDF. Both pages display real content, the previous/next controls return to the correct page, close preserves configuration, refresh preserves the effective assignment, and browser errors/document mutation attempts are zero. Screenshots contain only the visible synthetic canvas; the surrounding live UI and issued documents were not captured. Both viewport/page captures were inspected visually.

The first live attempt used whole-image hash equality and reported FAIL when returning to page 1. The diagnostic attempt measured exactly two of 1,090,584 pixels differing by only one RGB level, with identical geometry, ink mask, alpha, ink/color counts and visible screenshot. Both failed reports and their captures are preserved. The verifier now permits at most eight such one-level pixel differences while requiring exact dimensions, ink mask, alpha and content counts, and a distinct second page. This is a QA precision correction, not a runtime change; the independent reviewer approved the measured tolerance. The complete subsequent live run passes.

The loopback integration failure remains in local-browser.json and is NOT APPLICABLE for acceptance because the unchanged backend rejects that origin with DOCUMENT_ORIGIN_DENIED. The authorized production origin supplies the complete integration evidence. Global image regression is NOT APPLICABLE under AGENTS.md: no shared viewer, asset repository, authentication, backend, routing or service-worker logic changed. No historical PDF was regenerated.

H-DOCUMENT-PREVIEW-RENDER-001 RESULT
Status: PASS
Files changed: two focal frontend sources; generated bundle and cachebusters; focused QA/release scripts; audit/changelog, evidence and derived Architecture Registry. Full runtime inventory: scope.json.
Source-of-truth verdict: PASS. Existing document-generation Edge remains the PDF authority; PDF.js displays its authorized Blob in memory. No alternate authority, productive mock, fallback or persistent business cache added.
Invariant verdict: PASS. Assignment rules, templates, signer order, sealed history and program boundaries preserved.
Build: PASS. v2026100417; exactly two chunks regenerated and 154 unrelated chunks preserved. Public bytes match candidate; Pages allowlist/PWA check passes.
Tests: PASS. Real renderer pixel/navigation/error/cancellation tests at 390/1440; 20 assignment checks; authenticated live actual-canvas verification at 390/1440.
Security: PASS. Existing backend authorization unchanged. QA uses the exact configured Supabase origin; zero business writes, document mutation attempts, issued-document access or private-data screenshots.
Legacy impact: NOT APPLICABLE. No Supabase, financial or Google legacy code/data modified.
Unexpected files changed: none in the isolated release checkout; unrelated root work preserved.
Known limitations: the intentional local-origin denial is preserved as raw FAIL and classified NOT APPLICABLE. Issued-document and shared asset viewers are outside this focal preview fix.
Evidence: docs/qa/evidence/document-preview-render/ (browser, assignment-browser, build, pages-build, deployment, published, live-browser, preserved attempts, local-origin, scope, synthetic screenshots); final independent architect review recorded alongside evidence.
