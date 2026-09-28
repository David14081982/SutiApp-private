# H-SUTIFARMA-DONATIONS-001

## PRE-CHANGE AUDIT — 2026-09-28

Owner authorizes implementation: retain Claude UI; current Farma quantities become opening inventory immediately, no confirmation workflow; stock visible only in administration; Mariana (`marianafrancoq32@gmail.com`) operates catalog and requests; contact comes from affiliates; submit celebration and push to manager.

Scope: Farma products, private inventory, donation requests and immutable operational events, scoped administration, push transport integration, self history. Existing catalog remains product authority; affiliates remains identity/contact authority. Dedicated donation records must not enter financial/Google request writers. Existing imported source fields remain provenance.

Files allowed: this audit; app/farma-repository.js; app/screens-farma.jsx; app/screens-catalogo.jsx; app/screens-admin-program-products.jsx; app/screens-admin-fincat.jsx; app/screens-admin.jsx; app/screens-historial.jsx; app/request-submission-success.jsx; app/request-push.js; app/app.jsx; app/program-catalog-repository.js; app/program-catalog-admin-store.jsx; app/program-general-info.jsx; sw.js; scripts/build-bundle.js; scripts/build-pages-site.js; SutiApp.html; app/bundle.js (generated); supabase/migrations/20260928000600_sutifarma_donations.sql; matching supabase/recovery; supabase/functions/request-push/index.ts; scripts/sutifarma-*.js; scripts/test-sutifarma*.js; scripts/screen-permission-surfaces.json if required; docs/SOURCE_OF_TRUTH.md; docs/DECISIONS.md; docs/AGENT_CHANGELOG.md; docs/architecture generated registry; docs/qa/evidence/sutifarma-20260928.

Out of scope: loan/savings calculations, Google/Apps Script, historical deletion, unrelated working tree changes. Baseline already dirty (product editor release, image cache artifacts, loan repair, registry, assisted context migration); preserve those changes.

Registry: STALE; Farma missing. Directed code/schema inspection required, no reliance on index as runtime authority.

Risk: stock delivery concurrency, double submit, unauthorized contact access, manager push permissions, shared catalog/images and service worker. Backend identity/RLS and atomic idempotent writes required. Global legitimate-assets regression against local build and Pages is applicable.

Plan: inspect exact live schema and backup definitions; additive domain and permission module; reuse existing gallery/editor appearance and success component; atomic submit/fulfill with server contact; authorized manager assignment preserving other grants; push with current subscription consent; focused isolated database/browser tests; build; required global regression; production apply only after recovery/verification; evidence and architecture review.

Recovery: preserve imported catalog fields and immutable opening stock; exact definition backup; disable new entry points and module without erasing requests/events; revert deployment to preceding artifact. No historical DELETE.

Preflight: live read-only found exactly one Auth account and one affiliate for named manager; 50 catalog rows; latest migration 20260928000500. Quantity labels include singular `caja` and `caja con 4 sobres`, interpreted as one package, not four packages. Other rows use explicit leading package counts. Units retained (caja/frasco).

Status: audit complete; implementation and verification pending.

Scope update: `docs/qa/evidence/screen-permissions-20260924/production-metadata.json` must be refreshed read-only after registration; the build guard requires actual backend module evidence. `admin_support_private.module_visible` receives the Farma mapping, with exact definition backup and drift guard. Shared storage boundary extends only actor-owned `program-products/` uploads to the Farma module. No global admin grant.

Authority decision implemented: `farma_private.requests` owns the new nonfinancial donation domain; `program_requests` retains all existing financial/general requests. They do not mirror each other. Farma history projects the donation authority into the existing history screen. Private inventory owns current counts; imported `quantity_raw` remains immutable provenance, never a runtime stock fallback.

Test fixture scope addition: `scripts/fixtures/sutifarma-schema-20260928.json` contains only the exact technical definitions/column contracts required for reproducible isolated PostgreSQL tests; no affiliate rows, Auth values, tokens or production product data.

Verification environment correction: first local global image run used `127.0.0.1:8769`, which document-access rejects. Existing repository evidence `screen-permission-fix-20260924/local-environment-corrections.json` identifies `http://localhost:8080` as authorized. Retest uses that origin; no CORS/backend permission changed.

## Implementation and verification

- Migration 20260928000600 APPLIED; 50 products, 377 opening packages. `requests_hash`, `affiliates_hash`, `other_catalog_hash`, `catalog_assets_hash` unchanged. Zero synthetic production requests.
- Seven private tables force RLS; browser tables/worker and anon RPC denied. Existing module writer assigned Mariana exactly `farma`; live read-only role matrix verifies no finance or authorization permission and no other product administration module.
- Twelve isolated PostgreSQL scenarios pass: exact current-definition guards, initialization, RLS/anon, server identity/contact, duplicates/idempotency, financial boundary, delivery/stock/version, product edit/archive/create, catalog scope, push retries/revocation, immutable history and recovery.
- Desktop 1280×900 and mobile 390×844: stock/editor, no financial fields, public quantities absent, submit/confetti, self history, manager transition/quantity all pass. Synthetic submissions intercepted; zero production business writes.
- Push: encrypted payload, no medicine/contact data, existing request payloads preserved, subscription identity binding, duplicate suppression and deep link pass with isolated transport. Edge request-push v10 deployed. No external test notifications sent.
- Global image regression: GitHub Pages baseline PASS; local build with live assets PASS (194 public assets, 226 catalog assets, profile, Admin affiliates, image/PDF documents, loan, membership, marketplace, gallery/fullscreen, refresh and with/without service worker). Later Farma-only identity-state and text-wrapping refinements are covered by focal final browser checks; final publication is also checked globally.
- UI contract: existing grid, galleries, favorites, detail, program editor, navigation and success/confetti preserved. Farma adds stock fields and donation actions; its unused financial controls are replaced according to the owner's donation requirement. Finance Catalog retains information editor in its Información general tab and adds Medicamentos/Solicitudes.
- Runtime build preserves 130 unrelated published chunks byte-for-byte. Isolated release starts from 9a0ac6c, excluding unpublished local document commit 91a6d6f and unrelated dirty files.

## Known operational condition

Mariana has no active device subscription at application time. She must choose Activar notificaciones and grant browser/device consent. This cannot be performed remotely on her behalf. Requests remain in her durable panel independently. No real medicine request/delivery or notification to her device was fabricated for verification.

## Pre-publication result

```text
H-SUTIFARMA-DONATIONS-001 RESULT
Status: PASS (implementation/backend); publication acceptance pending
Files changed: focal Farma UI/repository, catalog/editor integration, history/success, admin menu, push Edge/SW, migration/recovery, tests, build/registry and governance; manifest in scripts/sutifarma-package.js
Source-of-truth verdict: PASS — one authority per product, inventory, donation, identity and device domain
Invariant verdict: PASS — preserved identifiers/history; no financial or Google writer
Build: PASS — focal bundle and public artifact
Tests: PASS — isolated PostgreSQL, desktop/mobile, encrypted push/worker, live permission matrix, global local + Pages baseline
Security: PASS — forced RLS, backend scope, self-only reads, actor/context, idempotent delivery
Legacy impact: READ ONLY audit; no Google/Apps Script/calculation changes
Unexpected files changed: none in isolated release; pre-existing workspace edits retained
Known limitations: manager device consent and genuine delivery remain real operational actions, not synthetic production tests
Evidence: docs/qa/evidence/sutifarma-20260928
```

## Architect review — pre-publication

Reconstructed from owner messages, real migration, scoped diff, canonical authorities and test results. WORK_QUEUE is unrelated financial handoff; WORK_QUEUE_HISTORY does not exist. No continuation of that queue is authorized or attempted. Historical unresolved asset recovery is outside this H.

Verdict: APPROVED for completing this H's isolated publication and final readback. Source-of-truth/architecture/security/data/legacy boundaries are demonstrated above. No new owner decision required.

RESPONSE TO CODEX: Publish only the reviewed Farma release based on current remote main. Verify deployed bytes, direct Farma route and the global legitimate-image regression. Preserve local document work; do not generate productive donation/financial test requests or send external synthetic messages. Complete final evidence and stop within this H.
