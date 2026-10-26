# H-RENTACAR-CATALOG-UI-ADMIN-001

## AUDIT / AUTHORITY / PLAN / RISK

Status: PASS for scoped discovery/implementation. Owner requests presentation and administrable vehicle specifications only, preserving existing IDs, selection/navigation, contacts, rental calendar, requests, financial rules and backend. Explicitly prohibits global suites; run focal checks only, including rental-conditional integration boundaries.

Baseline: isolated clean release a55bee734ed215926a853e40c120bd1aa0df264d equals origin/main. Original workspace contains unrelated changes and is not a publication source. Registry check STALE from previous rental copy/CSS/evidence; lookup renta followed by direct inspection of screens-marketplace, screens-catalogo, renta-car, catalog-store, program-catalog-repository, program-catalog-admin-store and screens-admin-program-products.

Current contracts: ProductScreen consumes useCatalogStore({programKey:'renta'}), live('fin','renta'); card invokes app.push('catitem',{item,ctx}) retaining the catalog UUID. CatalogItemScreen consumes the same store, ProgramCatalogImage, Gallery/ImageViewer, favorite handler and DirectContactPanel; eligible rental renders RentaCarFlow. That unchanged flow owns context/quote/submit and document/signature handling. Device Back pops catitem via the existing app stack. Admin Programas · Productos → Renta de vehículos uses the same catalog, assets and save/reorder RPCs with program_catalog.write. First ordered asset is the principal image.

Authority: program_catalog_items owns vehicle/name/price/description/enabled/sold/order; program_catalog_item_assets owns ordered media links. No duplicate products, Marketplace authority, fake availability, seed or browser persistence. Missing technical specs must be explicit, never inferred from example vehicles. Determine real existing source fields before deciding additive schema. Rental metadata belongs to that same catalog row. No Google/financial calculations or request mutations.

Allowed files: new app/renta-car-catalog.jsx and rental-only presentation/admin integration branches in app/screens-marketplace.jsx, app/screens-catalogo.jsx, app/screens-admin-program-products.jsx, app/program-catalog-repository.js; app/renta-car.jsx only if scoped legibility requires it (preserve functional handlers); script/build source manifest only if needed; generated app/bundle.js and cache tokens SutiApp.html/sw.js; focal test/operation scripts; this audit, docs/AGENT_CHANGELOG.md, docs/SOURCE_OF_TRUTH.md and architecture derived registry; docs/qa/evidence/rentacar-catalog/; ignored .tmp/renta-car inspection/build/browser scripts. If needed, additive rental-only metadata migration and recovery 20261025000100_renta_car_catalog.sql. No modifications to other catalog rows, shared viewer, Auth, Storage policies or routing.

UI: large dynamic cards immediately after compact title; ordered Motor/Tipo/Asientos/Tanque specs; visible daily price/year; expandible bottom sheet wraps current detail/handlers, preserving gallery, zoom, favorite, contact, calendar and request. Existing program information/contact controls remain available below catalog. Minimum meaningful text 14px, 390/430 widths, keyboard/drag/close/device Back verified. Admin reuses current editor/media/order/availability controls plus rental-specific metadata fields.

Risk/recovery: scoped guards must leave non-rental branches unchanged; additive schema cannot rewrite histories. SQL permission, validation, audit, concurrency and recovery must be demonstrated before application. Revert UI to baseline to recover presentation; leave metadata preserved if already edited. Rollback-only backend tests protect other programs/requests. Publication follows successful focal checks, exact bundle hash and real production verification. No global suites per explicit owner instruction.


## Directed discovery and migration gate

Production read-only inspection found one rental UUID (unchanged), six existing images, price_cash 2500, enabled=true, sold=false, and historical source_payload with year 2023 and seats "14 pasajeros". Motor/type/tank are absent; owner was asked asynchronously for real values. No example specs may be installed. Add nullable rental_specs JSON to the same canonical row, populated only from explicit source year/seats; original source payload, rates, modes, IDs and history stay intact. Non-rental rows retain NULL and cannot acquire rental metadata by the scope constraint.

Source-of-truth verdict SAFE: same catalog/master media links; new metadata is editable current catalog data, not an ongoing fallback to source_payload. New rental-only RPC wraps unchanged canonical save_program_catalog_item and adds permission check, locked rental scope, optimistic updated_at, field allowlist/types/lengths and real-actor audit. Existing shared reads add only the new nullable column. Rental-only save branch cannot edit financing_config. No shared Auth, Storage, asset resolution, app navigation or viewer changes. Explicit owner instruction restricts verification to focal tests even though repository integration is shared; rental guards and non-rental unchanged branches are inspected/tested.

Migration gate PASS: rollback-only install/security/recovery test in backend-preflight.json. 459 requests, 269 asset links and 5103 affiliate documents unchanged; all non-rental catalog rows identical excluding new NULL field. Rental preexisting values identical excluding updated_at. All existing rental RPC and canonical catalog writer definitions unchanged. New API denies anonymous/non-admin/direct DML/foreign program or ID/unknown fields/invalid year/stale version. Recovery removes new writer while preserving new metadata and audit history; revert frontend first. Synthetic test edits rolled back; no added products or requests. Transaction failed on an initial validation-expression syntax error and rolled back entirely; corrected SQL passed all checks before application.


## H-RENTACAR-CATALOG-UI-ADMIN-001 RESULT (candidate)

Status: PASS for scoped implementation; public verification follows deployment.
Files changed: four rental-conditional integration files, new rental presentation module, bundle/build manifest/cache tokens, additive rental catalog migration/recovery/operation, focal tests, authority/audit/changelog and derived architecture index. No unrelated runtime module modified. 154 preexisting bundle modules byte-identical, including renta-car.jsx, shared viewer, Auth, document workflow, media resolution and app navigation. SW changes are cache tokens only.
Source-of-truth verdict: SAFE. Same canonical catalog and ordered media links; explicit absence for unknown specs. New nullable field on other catalog rows is not populated. No runtime seed/fallback/localStorage.
Invariant verdict: PASS. IDs, contacts, favorites, canonical order/enabled/sold, original rental workflow, quotes, calendar, document gate and signature preserved. No financial or historical updates. New catalog UI is conditional on renta only.
Build: PASS, 159 modules, 31 Pages files, cache 2026102501. Bundle parity evidence lists the four guarded existing modules and one added module.
Tests: backend rollback install/permissions/recovery and applied invariants PASS. Isolated real-component Admin edit changes metadata/name/description/price/order, reorders principal image, toggles availability and refreshes user cards. Sold and inactive states respected; contact mode and catitem UUID/handler preserved. Existing rental document upload/signature/submission regression PASS (synthetic transport only). Authenticated mobile local build PASS at 390/430 with actual images and unchanged calendar/Documents/summary/signature; zero requests/uploads/writes. No global suites by explicit owner instruction.
Security: permission enforced in SQL; anon/non-admin/foreign scope/stale write/direct DML denied. No Storage/Auth/RLS relaxation. No secret/PII in committed evidence; real screenshots retained only in ignored .tmp.
Legacy impact: NOT APPLICABLE; Google and financial calculations untouched.
Unexpected files changed: none in isolated release; original dirty workspace preserved.
Known limitations: actual Motor, Tipo, Tanque values were not present in backend; they show No registrado and remain fully editable. Owner was asked for real values; no examples were installed. Pending metadata is not a disabled control or unconnected component.
Evidence: docs/qa/evidence/rentacar-catalog/{backend-preflight,backend-applied,isolated-browser,local-live,bundle-parity}.json. Existing document regression in docs/qa/evidence/renta-car-documents/isolated-browser.json.

## Focal acceptance matrix

| Check | Result |
|---|---|
| Renta Car opens | PASS |
| Actual available vehicles / real states | PASS |
| Dynamic cards | PASS |
| Principal image | PASS |
| Motor | PASS - backend field editable; absent real value explicit |
| Tipo | PASS - backend field editable; absent real value explicit |
| Asientos | PASS - existing 14 pasajeros retained |
| Tanque | PASS - backend field editable; absent real value explicit |
| Daily price | PASS |
| Whole card click | PASS |
| Bottom sheet | PASS |
| Expand / drag / close / device Back | PASS |
| Previous functionality retained | PASS |
| Admin editing | PASS |
| Admin change to user catalog | PASS - isolated UI transport + real SQL transaction rollback |
| 390px | PASS |
| 430px | PASS |

## CLAUDE UI PRESERVATION REVIEW

Screen: rental catalog and current product detail. Catalog redesigned as explicitly requested; previous program information/contact/favorite retained below immediate vehicle cards. Detail retains all existing content/handlers inside the expandable wrapper, adds real specs/year/daily suffix and rental-appropriate cash explanation. Existing request module unchanged. Admin media, order, activity, sold and description remain; rental-specific fields added, irrelevant financing editor omitted only for rental without changing stored configuration. Unauthorized redesign: NO. Verdict: PASS.

## ARCHITECT REVIEW

Verdict: APPROVED for publication after exact candidate checks. Review of actual diff, backend fingerprints, new writer validation/grants/audit, bundle parity and browser evidence supports the scoped result. No duplicated authority or other product modification. The work queue's historical financial phase restriction does not apply to the owner's explicit current rental catalog task; no financial test requests were created. WORK_QUEUE_HISTORY.md absent. No new owner decision required. Next action already authorized: publish, verify exact production bundle and the same rental-only mobile checks, record result, stop. Do not start another task.
