# H-SUTIAPP-DOCUMENT-LAYOUT-DESIGNER-002

## Audit / authority / plan

Owner requests removal of authorization-scope field, freedom outside margin guides,
legible field identification, additional affiliate bindings, actionable fit errors and
working preview. Base 32cce76. Prior dirty files remain excluded.

Scope: focal layout designer/repository, layout contract/service/render strategy, Edge
error envelope, synthetic snapshot examples; existing core QA/release scripts; new
additive migration and recovery; bundle/cache versions and derived registry/authority
documentation. No shared asset repository, Storage policy, signed URL, auth or viewer changes.

Authority: public.affiliates remains master; a bounded allowlist of optional affiliate
fields is frozen for new documentary records only, with catalog identity labels where
available. No live lookup when rendering an already sealed document. No financial write,
Google read/write, bank unmasking or arbitrary SQL binding. Existing layouts and documents
are immutable: edited layouts use schema v2; v1 issued rendering remains supported.

Guides reflect the chosen immutable template version exactly and do not restrict v2
coordinates inside the physical page. The editor identifies bindings independently from
synthetic values; preview uses the real renderer and local PDF.js, not a screenshot.

Risk/validation: source schema, cross-contract isolation, sealed historical bytes, optional
fields, point/mm fit errors, old-layout adaptation without overwriting, blank/browser PDF
preview, actual margins and out-of-guide placement. Extend the existing isolated suite;
zero new QA scripts or persisted fixtures. Recovery preserves layouts and snapshots.
Guardians: pre-change/source-of-truth/migration/security/UI/post-change applicable; legacy
READ ONLY of sealed financial inputs. Registry working copy STALE from unrelated prior work;
code/schema are authoritative. Status: PASS to implement, release remains subject to checks.

## Verification and release

LOCAL / BACKEND: PASS. Frontend candidate v296; service-worker cache v230.

- `node scripts/test-document-generation-core.js --browser`: 17 PASS. Actual synthetic PDF
  pages decoded and drawn by PDF.js in Chrome, including next-page navigation; structured
  overflow error selects Beneficiario and adjusts height; selected template switches to exact
  10 mm guides without losing element positions; x=1/y=1 outside guides saves and activates.
  Contract allowlists, additional affiliate fields, frozen identity after master edits, v1
  compatibility, historical immutable versions, scoped permissions, retry, pagination, all
  seven contracts, desktop/mobile containment and recovery passed. Browser page errors: 0.
- `node scripts/test-pages-deployment.js`: PASS (PWA; forbidden files 0).
- Babel build + `node --check app/bundle.js`: PASS. 139 chunks; all 138 unrelated chunks
  preserved byte-for-byte from HEAD. Only document-layout-designer.jsx chunk changed.
- Bundle SHA256: `5a2a0fd9c30bc957cad612787958547b5f1cbae9bf21c3c57021014dc4d5ee4f`.
- Backend bundle/deploy/verify: PASS; document-generation version 7 ACTIVE.
- Migration 20260928000400 APPLIED / tracked; SHA256
  `906201d38810f26862fc1eef55f1b193f04e7b9e25bad260833557ba4f7d5079`.
- Live metadata postflight: 10 forced-RLS tables; anon command/context and browser worker,
  persistence and capture function denied; unauthenticated Edge HTTP 401; cron 1, original
  approval triggers 2, new documentary capture trigger enabled. Layouts 0, documents 0,
  templates 2; no product document/signature copied and no production QA data created.
- The owner margin mismatch was verified using metadata only: v2 held 10 mm while program
  configuration referenced v1. The designer now exposes an explicit version selector; saving
  a new layout pins that selected version. No productive configuration changed by this H.

### Source, security, UI and architecture verdict

Source of truth PASS: optional identity projection reads public.affiliates once at the final
business event. Registered email is business data, not Auth. Raw legacy dates remain text.
No arbitrary field bindings, bank unmasking, full affiliate rows or browser persistence.
Security PASS: existing scoped user gate/service persistence, RLS and private storage retained.
Legacy impact: none; only previously sealed financial inputs are read. No Google requests,
financial calculations, request status updates or financial trigger changes.

UI preservation PASS: all three Admin tabs, cards, filters, configuration, margins, firmants,
ordering and document lists preserved. Only the requested designer interactions changed.
The layout v2 uses the physical page as its bound; margins are guides and no hidden 7 mm
footer reservation/forced system footer overlays owner content. Historical v1 rendering stays
supported. Canvas labels are editing aids; the preview/issued PDF uses bound values only.
Draft preview can show an incomplete layout; save/activation still require valid contracts.
Fit errors identify the element/page and offer selection/height adjustment. Optional fields
use explicit missing-value behavior; existing sealed records are never enriched retroactively.

Global image regression NOT APPLICABLE: no shared AssetRepository, DocumentWorkflowRepository,
viewer, shell, signing URL logic, Auth or Storage policies changed. Bundle and cachebusters
are GENERATED_ARTIFACT only. No new QA scripts, screenshots, fixture rows or permanent PDFs.
Prior unrelated working files (including five Registry files) are preserved and excluded.

Architect review: APPROVED for the corrective scope after inspecting code, SQL, diffs and
actual browser/contract results. WORK_QUEUE_HISTORY.md absent; master queue is unrelated to
this explicit owner request. No further business decision required. Next instruction:
verify the published Pages/custom-domain artifact against the bundle hash, then stop.
The registry is generated from the clean release candidate to exclude unrelated dirty files.
Publication is the workflow for the commit containing this report; production closure requires
that workflow and the served artifact to pass, reported in the closing message.

Known limit: standard PDF fonts remain Helvetica/Times/Courier; unavailable optional affiliate
values follow the chosen missing-value setting. No historical PDF regeneration/backfill.
