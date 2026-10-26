# H-RENTACAR-DETAIL-UI-002

## PRE-CHANGE AUDIT

Status: PASS. Baseline: 481a4bf. Authorized by the owner's latest screenshots and request.
Objective: remove the large catalog presentation, restore the original program landing,
automatically open the first available vehicle fully expanded on entry, and improve only
the vehicle information above the existing calendar.

Scope: app/screens-marketplace.jsx, app/screens-catalogo.jsx, app/renta-car-catalog.jsx;
generated app/bundle.js; version tokens in SutiApp.html and sw.js (no SW logic changes);
focal scripts/test-rentacar-detail-browser.js, scripts/verify-rentacar-detail-live.js;
this audit, docs/qa/evidence/rentacar-detail/* and docs/AGENT_CHANGELOG.md.
No backend, Admin, calendar, financial rules, requests, document workflow, global routing,
shared media or other program behavior changes. No production data writes.

Authority: program_catalog_items and its existing media relations, read through
ProgramCatalogRepository/useCatalogStore. Existing Admin remains the sole writer.
No new data cache or fallback. An ephemeral per-route visit marker only prevents reopening
the sheet after closing; it stores no vehicle or availability data.

Navigation: ProductScreen → app.push('catitem', {item,ctx}) → app.back().
Gallery, viewer, favorites, DirectContactPanel and RentaCarFlow remain in place.
Original HeroShell/PublicHeader/CatalogGrid restore hero, contact, benefits and small cards.
Sheet starts expanded; grip/drag/X/Escape/device Back preserve navigation.
Empty/error/loading states use the original catalog presentation; no invented vehicle.

Risk: reopening loop on Back, stale availability, presentation leakage to other programs.
Mitigation: per-route identity, fresh existing catalog read, rental-only branches and selectors.
Verification: focal browser checks at 390/430, real images/data and read-only rental flow,
bundle module parity, source/calendar hash parity, production bundle verification.
No global suites. Recovery: revert this isolated commit and regenerate/publish the bundle.

Navigator: registry STALE; direct inspection confirms current mappings and contracts.
Only presentation/microinteraction changes, no new authority/schema/route dependency.
Source-of-truth verdict: SAFE. Legacy impact: none.

## VERIFY / EVIDENCE

- Build: PASS, 159 modules; only renta-car-catalog.jsx, screens-catalogo.jsx and
  screens-marketplace.jsx changed in the compiled bundle (156 unchanged).
- Calendar source and its existing scoped styles: byte/line parity PASS.
- Pages artifact: PASS, 31 public files, cache 2026102503.
- Focal isolated navigation test: PASS, original landing after X/Escape, new entry
  refreshes availability/price, inactive/sold excluded from automatic selection,
  empty and failed reads do not open stale vehicles, direct contact preserved,
  non-rental landing/detail retain their presentation. Zero backend writes.
- Live local build: PASS at 390/430 with real authenticated data and media,
  automatic full-height detail, drag/collapse/expand/X/device Back, reentry,
  original contact/benefits/small card, gallery viewer, dates → documents → summary
  and signature. Existing Admin values/fields read back unchanged.
- Existing test-renta-car-documents.js: PASS (real components, isolated transport),
  upload completion, preview, replacement, latest document IDs and signature.
- Visual inspection: .tmp/rental-detail/local-{390,430}-sheet.png and
  local-390-landing.png. Price appears once, year remains in the real vehicle name,
  specifications use a two-column grid; minimum information font size 14px.

Commands: node scripts/build-bundle.js C:/tmp/babel-standalone-7.29.0.min.js;
node scripts/test-rentacar-detail-browser.js; node scripts/test-renta-car-documents.js;
node scripts/verify-rentacar-detail-live.js local [ignored environment file].
Evidence: docs/qa/evidence/rentacar-detail/{isolated-browser,local-live,bundle-parity}.json.
An initial isolated harness lacked useBtnConfirm and attempted to replace a frozen
repository method. The harness was corrected; no production source change was needed.

## CLAUDE UI PRESERVATION REVIEW

Screen: Renta Car landing and vehicle information. Verdict: PASS.
Original hero, title, contact, favorite, benefits and compact catalog restored by
reusing their original components. Only the requested large-card presentation is
removed. Gallery, calendar, documents, signature, contact handlers and IDs remain.
Navigation: first real available vehicle opens fully expanded once per program
entry; X/Back reveal the original landing; each compact card opens its own item.
No unauthorized redesign. Admin and other programs unchanged.

## ARCHITECT REVIEW

Verdict: APPROVED for the already authorized publication, subject to public readback.
Evidence reviewed: actual diff, 156 unchanged compiled modules, original calendar
and styles, real mobile checks, source of truth and isolated error/unavailable paths.
No new data authority, schema, routing API or financial behavior. The WeakSet contains
route identities only; no vehicle data or persistent state. Missing engine/type/tank
remain explicitly unregistered rather than invented. WORK_QUEUE_HISTORY.md absent;
the current explicit owner request supplies scope/authorization, not a new queue task.
Owner decision required: NO. No global suite run.

RESPONSE TO CODEX: publish this verified isolated change, verify the same bundle
and focal checks on production, record the result and stop. Do not begin another H.
