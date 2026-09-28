# H-SUTIAPP-DOCUMENT-LAYOUT-DESIGNER-001

## Pre-change audit — 2026-09-28

Status: PASS for implementation. Owner attachment authorizes implementation, release and publication.
Base: 7e5a1f9. Existing dirty registry, loan-transfer and assisted-context work is excluded.
Navigator: working registry STALE; targeted discovery confirms document-generation core files.

Scope: a visual layout editor inside the existing configuration dialog; versioned physical-mm
presentation, contract field manifest, custom-layout interpretation in the existing renderer,
private layout versions/activation history and authenticated Edge actions. No financial writers.

Files: new app/document-layout-designer.jsx and app/document-layout-repository.js;
app/screens-admin-document-generation.jsx; document-generation/{index.ts,renderer.mjs,layout.mjs,
render-layout.mjs,layout-service.mjs}; one additive layout migration and recovery; existing core test/release script;
build-bundle/build-pages-site and focal generated bundle/cachebuster artifacts; pinned PDF.js
browser/worker/license assets for rendering the actual PDF background; .gitattributes pins their
bytes and the tested SQL/recovery against line-ending conversion; this audit, authority,
changelog and derived architecture registry. No changes to shared asset/auth/viewer repositories.

Authority: document_private remains the sole document authority. New immutable layout versions
and append-only activations store bindings/presentation only. Existing snapshot, template, signer,
record, worker, lease and Storage mechanisms remain authoritative. Browser state is transient.
Readers: document renderer and authorized layout editor. Writers: authenticated Edge, private
service-only persistence RPC after effective config.write validation. No browser table grants.

Migration: FK template version; per-program/type unique revision; forced RLS; immutable triggers;
event-time activation selection; snapshot captures entire layout. Recovery disables new layout
writes and restores system resolution for future events, preserving all history and sealed PDFs.

Risk: field isolation, coordinates, overflow/pagination, stale responses and immutable history.
Validation: extend the existing in-memory PostgreSQL/PDF/browser suite; synthetic data only,
zero new QA files/PDFs; preview uses the production renderer. Build and published artifact checks.
Legacy classification: READ ONLY of already sealed data; no Google/financial computations.
UI baseline: three tabs, KPIs, alerts, template history/margins, signer management, assignments,
ordering, preview and recent documents are preserved. Add only designer entry and editor.
Global image regression: NOT APPLICABLE while changes remain inside the document-layout module;
no shared AssetRepository, DocumentWorkflowRepository, signed URL or Storage policy changes.

## Verification

LOCAL IMPLEMENTATION: PASS. Backend APPLIED / ACTIVE. Frontend candidate v295, SW v229.

- `node scripts/test-document-generation-core.js --browser`: 15 PASS. Existing suite extended;
  zero new QA files. Seven palettes/default layouts, required bindings, formatting, overlap/bounds,
  invalid cross-contract binding, physical coordinates in PDF operators, 120 frozen payments and
  12 synthetic signers, deterministic bytes, private RPC permissions, scope isolation, event-time
  versions, old snapshots, recovery, drag/drop, pointer resize, static text, real PDF preview,
  save/activate/reload and desktop/mobile containment. Browser errors: 0.
- `node scripts/test-pages-deployment.js`: PASS. PDF.js browser/worker/license explicitly published;
  vendor bytes match the pinned npm 5.4.149 SHA512 tarball. No runtime third-party document service.
- `node --check app/bundle.js`: PASS. Babel builds 139 chunks; all 136 unrelated published chunks
  retained byte-for-byte. Only existing Admin document configuration chunk plus two new focal chunks.
- Bundle SHA256: `c4ffbdb764a24875b7a1dc33d4ace702f9f1a0bfd95ef692048dcedd7159bab3`.
- Migration `20260928000300` applied, tracking/readback PASS; SHA256
  `df487293a6af39b45a36f72345b9c7cecc79a1cf10b3c93a7075f6968f90bbc8`.
- Edge `document-generation` version 5 ACTIVE; 10 forced-RLS tables, browser persistence/worker
  denied, both new anonymous RPC calls return HTTP 401 / SQLSTATE 42501. Original cron and two
  approval triggers preserved. Layouts 0 / activations 0 / documents 0 at postflight; existing
  templates 2 retained. No production synthetic configuration or PDF created.
- One temporary synthetic editor screenshot reviewed and removed. No real user/signature QA data.

Publication is the Pages workflow for the commit containing this report; verify custom domain
and Pages bundle SHA256 against the value above before declaring PRODUCTION / CLOSED.

### Architectural and UI review

Source of truth SAFE; invariants PASS; security PASS; legacy READ ONLY of sealed snapshots.
No request, Auth, shared viewer, AssetRepository, DocumentWorkflowRepository, Storage policy or
signed-URL logic changed. Global image suite NOT APPLICABLE for this focal extension.
UI preservation PASS: original tabs/cards/dialogs remain; designer opens from configuration.
Static labels and dynamic values are separate elements. Grid snaps to 0.5 mm; keyboard movement,
alignment, duplication/deletion and explicit properties supplement drag/drop. The real PDF canvas
uses the existing private template access. Server preview uses synthetic identities/signatures and
the production renderer; no screenshot-based PDFs. Existing automatic flow remains SYSTEM.

Fonts use PDF standard Helvetica/Times/Courier; semibold maps explicitly to the corresponding
standard bold face (shown in the selector). No uploaded font execution or arbitrary formatters.
Oversized real text fails document generation visibly rather than clipping or inventing values;
existing idempotent document retry remains independent from the financial operation.

Recovery was exercised in isolated PostgreSQL and preserves layouts/activations/documents.
Definition hash guard prevents overwriting a later resolver during recovery.
Architect verdict for implementation: APPROVED. Owner decision: NO. Next action after verified
publication: stop; do not configure real layouts or generate product documents on the owner's behalf.

Scope refinement: layout-service.mjs extracts only the new Edge action orchestration so isolated
tests call the actual production validation/permission sequence rather than a duplicate test router.
