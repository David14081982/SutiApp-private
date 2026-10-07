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

Status: PASS for scoped implementation. Final verification pending.

## Candidate verification

Implementation exports the existing renderer as DocumentLayoutDesigner.PDFPreview and uses it only for modal preview. Actual canvas rendering is tied to the current source URL, retry attempt and page number; fetch, PDF worker and page rendering are cancelled on cleanup. CSS is contained in the renderer and preserves the original modal.

Local renderer tests PASS with Chrome's native PDF viewer verifiably disabled: real PDF.js/worker, red/blue page markers, page navigation, URL reset, invalid PDF/retry, closing during load/render, designer reuse and draft preservation at 390/1440. Both synthetic screenshots were visually inspected. Existing assignment screen suite: 20 checks PASS; its historical evidence was preserved. The corrected verifier now checks pixels; an HTTP success, PDF header, Blob or empty iframe is insufficient.

Build v2026100417 SHA256 d7777ed889f12c75e83a9b6bf7a64eac5e25c66552a66724544a28e5a07277b6; exactly two focal chunks regenerated, 154 unrelated chunks identical. Pages allowlist/PWA test PASS with zero forbidden files. No backend/data/configuration files changed.

Authenticated candidate boundary: login, configured project, native viewer disabled, effective card and configuration succeed on loopback. The PDF endpoint correctly rejects Origin http://127.0.0.1:4178. A separate unauthenticated OPTIONS request proves HTTP 403 DOCUMENT_ORIGIN_DENIED without Access-Control-Allow-Origin. The complete local integration attempt is not a PASS and is retained as such. This is a deliberate backend origin restriction, not a renderer failure. No CORS setting, origin header or security control is changed; final authenticated visual verification will run on the authorized published sutiapp.com origin. Isolated renderer/page/pixel tests and the public build remain PASS.
