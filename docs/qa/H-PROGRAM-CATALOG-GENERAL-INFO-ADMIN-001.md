# H-PROGRAM-CATALOG-GENERAL-INFO-ADMIN-001

## PRE-CHANGE AUDIT — 2026-09-10

Status: PASS (implementation authorized by owner request).
Objective: edit existing program headers, with preview, from Programas · Productos and Catálogo de Finanzas.
Authority: reuse finance_catalog_presentation (item_key = program_key); program_catalog_items and their commercial fields remain untouched. institutional_programs is the separate institutional directory, not the public catalog header. Existing historical public assets may be referenced, never copied per product.
Scope: app/program-general-info.jsx (new focused repository/hook/editor/preview), app/screens-marketplace.jsx (ProductScreen), app/screens-admin-program-products.jsx, app/screens-admin-fincat.jsx, app/screens-terreno.jsx only if its actual header requires metadata; scripts/build-bundle.js, generated app/bundle.js and SutiApp.html cachebuster; one additive migration/recovery; focused scripts/program-general-info-* and scripts/test-program-general-info-*; this report/evidence directory, SOURCE_OF_TRUTH, DECISIONS, AGENT_CHANGELOG, architecture registry derived files; isolated release preparation script.
Excluded: product DML, prices, modes, ordering, requests, financing, Google, historical institutional rows, shared authentication/router/viewer/asset implementations.
UI contract: hero image/gradient/large icon/back/heart, overlapping icon/title/breadcrumb, description, existing quote status, Call/WhatsApp/Save, benefit title and icon/title/subtitle cards, available heading and original product grid, scrolling/navigation/modal behavior. Admin adds metadata, preview, products, Add product in that order. No new public visual fields.
Finding: current header descriptions/benefits are code constants; image-slot uses localStorage and cannot be retained as a productive metadata fallback. The legacy finance editor also calls saveItem with the wrong signature and exposes unsaved fields. Replace its program editor with the same authoritative editor.
Risk: migration compatibility, unauthorized writes, stale editors, failed image upload/save, visual regressions. Existing workspace changes are baseline, not part of this H. Release must be scoped over current origin/main.
Tests: SQL transaction/rollback, RLS and validation, optimistic conflict, five requested programs edit/save/refresh/public reflect, product hashes before/after, responsive visual contract, relevant existing focal tests, build. Global image regression only if actual shared dependency changes require it.
Recovery: exact private pre-change files and live presentation snapshot; additive schema with rollback tested transactionally before application; never delete edited business metadata for rollback.

## SOURCE OF TRUTH AUDIT

Domain: program catalog general information. Reader: new focused repository and existing finance presentation list. Writers: existing presentation writer and a permission-checked program metadata RPC. Authority: finance_catalog_presentation only. No runtime seed, browser storage or product-row metadata. Historical institutional content remains a distinct surface; initial phone/cover references can use its verified program mapping without copying its records. Verdict: PASS, verified with live persistence and role checks.

## DATABASE / SECURITY / LEGACY

Additive nullable program metadata and cover FK, validated shape/length/type, version conflict detection, existing admin audit trigger, authenticated read and permission-checked RPC. Existing table policies preserved. No service secret in frontend. No financial tables, formulas or Google reads/writes. Legacy classification: READ ONLY boundary inspection; operational impact NOT APPLICABLE.

## Results

Scope update: app/fincat-store.jsx must also project the already edited detail, icon and POPULAR flag from the same row, so Finance cards actually reflect these controls. This is a shared finance presentation dependency; execute the required global image regression against local build and published site. No shared AssetRepository implementation changes. Terrenos has a distinct map screen; owner preference requested while generic program work continues.

Verification scope update: synchronize only generated cache version strings in sw.js/SutiApp.html (baseline was already inconsistent: bundle 239 vs worker 237); no service worker logic change. Update the focal catalog test's static assertion to accept the authoritative catalog heading. Terrenos retains its map, geometry, lots and prices; extract only its exact header component for a shared preview and replace its four existing text values/icon with metadata. Scope includes app_assets registration through a new focused cover RPC and an insert-only Storage policy for program-general/<actor>/ paths, allowing the two existing editorial permissions; no product asset sharing or cleanup.

Implementation and final local verification: PASS. Publication and production verification are the remaining authorized steps.

| Program | Admin loads | Description / cover / advantages saved | Refresh | Public screen | Products / prices / modes |
|---|---|---|---|---|---|
| Autos | PASS | PASS | PASS | PASS | PASS |
| Aires acondicionados | PASS | PASS | PASS | PASS | PASS |
| Casa | PASS | PASS | PASS | PASS | PASS |
| Paneles solares | PASS | PASS | PASS | PASS | PASS |
| Cómputo | PASS | PASS | PASS | PASS | PASS |

Evidence: `evidence/program-general-info-20260910/browser.json` and `local-*-admin.png` / `local-*-public.png`. Browser tests use the actual Admin module and actual public screen, mounted in an isolated host for inspection; no request/financing CTA is invoked. The editor also preserves unsaved text across focus events and the public favorite indicator responds. Both Admin entrances use the same editor. All 14 metadata records load; Terrenos retains its exact header component and map. Test edits were restored using the same version-checked RPC; legitimate uploaded covers remain retained, without deleting historical assets.

Backend migration applied after transactional tests and recovery verification. `sql-apply.json`, `sql-verify.json`, `sql-test.json`, `security.json` certify persisted schema, validation, stale writer rejection, actual authenticated/anonymous roles, denied affiliate updates/RPC/Storage writes and untouched product hashes. No Google, financial tables, requests or product writes.

Release source is an isolated clone of published `f244fea14930028133e39c6a3bbe2c17abfed04a`. Five existing catalog modules change, plus one new focused module; all other 110 compiled modules remain byte-identical (`release-module-parity.json`). Published typography tokens are preserved during the three-way merge. Vendor files are the exact Git blobs matching existing SRI, with no semantic vendor change. Generated bundle/cache versions are synchronized.

`global-production-before.json`: PASS with legitimate public/private images, document PDF, profile/Login seal, Admin Afiliados, Membership, Préstamo, Marketplace, galleries, fullscreen, refresh, and service-worker comparison. Local attempts on arbitrary ports were rejected by the existing document-access CORS policy. The complete local suite is run on the previously authorized `http://localhost:8080/`, without altering that policy. A subsequent transient image timeout concerned historical Rifas GIF `3bcd4aa5-67b5-588a-a236-619f5163c0b6`; direct verification returned HTTP 200 / image/gif / 9,144,768 bytes in 1.5 seconds (`historical-image-check.json`). The subsequent complete run passed, and global-final-local.json confirms PASS again after the final Terrenos correction.

## CLAUDE UI PRESERVATION REVIEW

Original/current sections: hero, back/favorite, overlapping icon/title/breadcrumb, description, quote state where applicable, Call/WhatsApp/Save, benefit cards, available heading, catalog grid and existing product navigation. No missing public section or unauthorized redesign. Initial header content comes from the audited public implementation, and covers reference existing legitimate institutional assets. Terrenos retains map, filters, lots, geometry, controls, prices and financing code; only its existing header texts/icon are connected. Added Admin sections: general information and preview, then products and Add product. Verdict: PASS.

## H-PROGRAM-CATALOG-GENERAL-INFO-ADMIN-001 RESULT

Status: local acceptance PASS; publication and production verification pending.
Files changed: five focal screens/stores, new program-general-info.jsx, build module list, generated bundle/cachebusters, additive migration/recovery, focal verification/release scripts, authority/decision/changelog/report and derived architecture registry.
Source-of-truth verdict: PASS — existing finance_catalog_presentation; no per-product metadata or new product authority.
Invariant verdict: PASS — full product hash unchanged; no requests, prices, modes, historical institutional rows or financial calculations modified.
Build: PASS — candidate syntax, SRI and public artifact; 110 unrelated compiled modules identical.
Tests: focal browser / SQL / recovery / permissions PASS; complete final local image regression PASS.
Security: PASS — existing editorial permissions, backend checks, RLS and dedicated cover path; no frontend secrets.
Legacy impact: NOT APPLICABLE — no operational Google/financial changes.
Unexpected files changed: none in release; preexisting workspace modifications excluded.
Known limitations: Terrenos intentionally retains its distinct map; Préstamo/Ahorro remain their protected dedicated modules. Cover upload failures retain assets for recovery rather than risk deleting a committed cover.
Evidence: `docs/qa/evidence/program-general-info-20260910/`.

## Final review correction

Direct source inspection caught two remaining fixed Terrenos header texts and damaged accent labels in its Admin editor. Connected both existing metadata fields and corrected the labels, without any map or financial change. Added a focused assertion exercising all four header fields with distinct values. Final artifact is release-site-6; module parity remains 110 untouched modules. The complete image suite is repeated for this final artifact. Test runtime now uses installed Playwright Chromium 1228 because the previous Chrome executable is no longer present; only executable selection changes, all regression assertions remain identical.

## Pre-publication architect review

Task reviewed: H-PROGRAM-CATALOG-GENERAL-INFO-ADMIN-001 release candidate. Verdict: APPROVED for the already authorized publication step. Direct source/diff review found and resolved the two Terrenos bindings; final browser verifies all four dynamic texts. SQL role tests, rollback, existing focal scripts, final local browser and full final image regression PASS. Product hash unchanged; 110 unrelated compiled modules identical. SOURCE_OF_TRUTH, schema and readers agree; no productive metadata fallback or second product authority. WORK_QUEUE concerns an unrelated financial master plan; WORK_QUEUE_HISTORY is absent. Current owner request authorizes this H and publication; no subsequent H is authorized. Owner decision required: NO. Next action: publish this exact isolated candidate, verify deployed hash, five programs and complete image regression, then stop. Final H acceptance awaits that production evidence.
