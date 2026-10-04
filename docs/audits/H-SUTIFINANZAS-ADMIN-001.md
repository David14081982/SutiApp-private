# H-SUTIFINANZAS-ADMIN-001

## PRE-CHANGE AUDIT — 2026-10-04

Status: PASS (authorization to implement and publish supplied by owner; verification pending).
Objective: native Admin / SUTIFINANZAS / Gasto por Secretaría, Nunito, Google direct read once on opening and once on explicit refresh; drill-down in memory.
Authority: spreadsheet `1-ijVLS90bCtFN6bFW5gEs1Geo2sKri88ER94dH42n60`, exact tab `Gasto por secretaría` (sheetId 1978255622). Supabase only identity, existing screen permissions and server execution; no report tables, financial copies or persistent cache.
Readers: new dedicated Edge reader, repository and report UI. Writers: existing external sheet owners only; this H performs zero Google writes and zero financial business writes.
Scope/files: this audit; `app/sutifinanzas-repository.js`, `app/sutifinanzas-admin.jsx`; `supabase/functions/sutifinanzas/{index.ts,report.mjs}`; `app/screens-admin.jsx` (additive registration/sidebar/controller only); `scripts/build-bundle.js`; generated `app/bundle.js`, HTML/service-worker cachebusters only; minimal permission registration migration/recovery; existing screen-permission production metadata; one shared contractual test `scripts/test-sutifinanzas.js`; authority/decision/changelog appendices; architecture overrides and generated registry. Temporary discovery, isolated tests, packaging and evidence only under ignored `.tmp/sutifinanzas/`.
Excluded: existing financial modules, Savings, Loans, SICOF, amounts, rates, formulas, Apps Script, Google structure and values. Existing dirty workspace preserved; release must isolate this H from unrelated modifications.
APIs: existing Supabase Auth / admin permission RPCs and Google OAuth / Sheets API read-only. Credentials remain server-side.
Risk: report interpretation, missing values, column drift, delegated authorization, existing Admin navigation and release isolation. Exact header mapping; duplicate required headers fail closed; no positional fallback. Blank dimensions remain explicit. No silent invalid amount coercion, subtotal aggregation or duplicate product IDs.
Tests: meaningful parser/aggregation/security contract, browser filters/drill-down/refresh/error/keyboard/responsive, live Google/backend read and denial, existing permission coverage, build, mandatory global image regression local and GitHub Pages because shared Admin routing changes. No financial test writes or versioned real financial rows.
Recovery: additive source rollback; permission recovery restricted to new module metadata; backend rollback/remove new function. Preserve unrelated code and all historical/business rows.
Guardians: architecture navigator (STALE; feature absent, directed discovery), pre-change audit, source of truth, legacy Google READ ONLY, Supabase security, migration guardian for permission metadata only, Claude UI preservation, post-change verification, architect review.

## Real sheet mapping (live read, no sheet writes)

Header row 1; 89 columns; 1,224 product rows at inspection. `ID Producto` is unique across inspected rows. No detected subtotal records. Positions below are evidence only, never runtime selectors.

| Field | Exact header | Observed column |
|---|---|---|
| Product identity | ID Producto | B |
| Requisition identity when label missing | 🔒 Row ID Requisición | A |
| Requisition | REQUISICIÓN | D |
| Secretariat | Secretaría | H |
| Concept | Concepto | J |
| Amount | Gran total Comprobado | O |
| Expense date | FECHA DEL GASTO | AC |
| Project | Nombre del proyecto | AP |
| Budget item | Partida presupuestal | AQ |
| Budget code | Clave presupuestal | AR |
| Status | Estatus | BE |
| Payment method | Forma de pago | BH |
| Year | AÑO | BP |

Year authority is explicitly `AÑO` (2025/2026 observed), never a date fallback. Status raw values Aprobado/Rechazado; comparison normalizes casing and whitespace without changing source. `FECHA DEL GASTO` contains numeric Google date serials; separate `Fecha del gasto` is empty and must not be selected by case-insensitive header matching. Google locale es_ES; serial dates avoid locale ambiguity.
Missing values: 253 rows in 2025 have no Secretariat/Requisition label; 18 lack AÑO, 22 lack expense date, 10 lack status. Display missing buckets and quality counts; do not infer dimensions or omit amounts silently. All 1,224 amounts are numeric; all product IDs distinct. Requisition labels repeat across product lines, so requisition count uses actual requisition identity and amount sums product rows once.

Hierarchy: Secretaría → Nombre del proyecto → Partida presupuestal → REQUISICIÓN → product line details. Missing requisition labels remain labeled as missing with source identity used only for grouping.

Precision discovery: 64 source amounts have fractional cents. Preserve numeric source values; sum their decimal representations before formatting currency. Never round individual rows. The production parser was evaluated in memory against all 1,224 connector-read rows: PASS, no persisted rows.

## Implementation and external access evidence

Local implementation complete; not yet released to the public Admin. Edge `sutifinanzas` v3 deployed using existing `GOOGLE_VISIBILITY_OAUTH_*` credentials. A real authenticated call returns HTTP 409 / `GOOGLE_ACCESS_DENIED` (Google underlying HTTP 403); anonymous call returns HTTP 401 / `AUTH_REQUIRED`. Existing local request OAuth also returns Google 403. Connector access in this conversation succeeds but is a separate credential and is not a runtime fallback.

External prerequisite: grant this exact workbook to the existing SutiApp Google OAuth integration. Owner already authorizes the read; the missing condition is Google's actual access grant. Do not create another OAuth system, migrate data, use the conversation connector as a runtime service, or treat sharing alone as proof that a file-scoped OAuth client can read it.

Permission SQL `20261004000200_sutifinanzas_screen.sql` is PREPARED, NOT APPLIED. It adds a read-only catalog entry, reuses `program_requests.read` plus the existing module boundary, adds only this module to assisted visibility, and stores permission-definition recovery metadata only (no financial data). Existing user grants are untouched. Version collision check against cloud: none at preparation time. Isolated PostgreSQL tests prove assignability, no access to Finanzas from SUTIFINANZAS alone, no financial write permission, revocation on the same session, exact no-use recovery and refusal to erase subsequent authorization history.

## Verification evidence

- `node scripts/test-sutifinanzas.js`: PASS (header reordering/absence/ambiguity, exact expense date, duplicate IDs, invalid amounts, missing dimensions, decimal precision, filtering, totals, drill-down, authorization before Google, one values GET, no persistence).
- `node .tmp/sutifinanzas/sql-test.cjs`: PASS (reuses existing PostgreSQL permission fixture; exact new forward/recovery; production writes 0).
- `node .tmp/sutifinanzas/browser.cjs`: PASS in Chrome (1440/1280/1024/768/390, keyboard, 44px targets, no horizontal overflow, four drill levels, breadcrumb, filter retention, no requests per click, refresh, missing-header message, stale totals removed on error).
- `node scripts/build-bundle.js C:/tmp/babel-standalone-7.29.0.min.js`: PASS, 152 source files. Existing dirty workspace modules remain; this is a local bundle, not a publication package.
- Google requests by contract: initial = one Sheets values GET (plus OAuth token exchange); per drill-down/filter/search = 0; explicit refresh = one new values GET. Positive production read cannot be asserted while OAuth returns 403.
- Permanent QA files added: 1 (`scripts/test-sutifinanzas.js`); other probes/synthetic harnesses/logs are ignored `.tmp/sutifinanzas/`. No real financial rows, Google dump, snapshots, screenshots or JSON evidence added to versioned files.

## Review status

Source-of-truth: SAFE / Google Sheets only. Legacy: READ ONLY, writes 0. Supabase financial copy/report tables: 0. Persistent report cache: 0. Auth and assigned module checks run server-side, before OAuth or Sheets. No secrets/service-role in new browser code. No changes to protected financial calculations, Google formulas or Apps Script.

Known release limitation: do not declare PRODUCTION/CLOSED or publish an unavailable report as a completed feature. Finish live allowed/denied reads after the Google grant, apply tested screen registration only after fresh baseline checks, refresh existing production permission metadata, isolate this H from pre-existing dirty changes, run release checks, commit/push and validate sutiapp.com.

## Final verification and isolated delivery

The isolated candidate is based on current main `8cd11a3` under ignored `.tmp/sutifinanzas/release`. Its Admin integration diff is four additive lines; bundle changes are limited to `sutifinanzas-repository.js`, `sutifinanzas-admin.jsx`, `screens-admin.jsx`. Published chunks from all other modules are byte-preserved. Regenerating the entire older dirty workspace is not a safe release package.

Global regression: GitHub Pages PASS; exact isolated local candidate PASS with SHA-256 `185dfc7dc8dd8b969d7f29dd8e8d8bed7743abe6527307b5f71fc743c75109cd`. Login/seal, profile, Admin photos and image documents, Membership, loan, programs/gallery, Marketplace, fullscreen, legitimate PDF, refresh and service-worker/no-service-worker comparison passed; 0 browser errors, 0 business mutations. Temporary logs: `.tmp/sutifinanzas/global-production.txt`, `.tmp/sutifinanzas/global-candidate-allowed.txt`.

Earlier local runs on 8097/8098 failed document preview because those origins are not in the existing backend allowlist; OPTIONS confirmed only localhost:8080 among tested ports is allowed. Final run serves the candidate at 127.0.0.2:8080 and maps localhost only inside its isolated Chrome process, preserving the user's existing 127.0.0.1:8080 preview. No CORS configuration/security bypass, mocks or production row changes.

`python scripts/test-architecture-registry.py`: PASS (freshness, lookup, fallbacks, incremental, secrets scan, deterministic generation). Existing Work Queue concerns an unrelated legacy writer and does not authorize new work; this H is explicitly owner-authorized. WORK_QUEUE_HISTORY.md is absent.

`node .tmp/sutifinanzas/live-ui.cjs`: PASS for real Admin navigation into the new native report, computed Nunito, exactly one initial backend call, visible Google permission error and zero mock/stale KPIs. Positive Google read remains BLOCKED. Local candidate branch: `feat/sutifinanzas-google-report`; no push/publication performed while that prerequisite fails.

```text
H-SUTIFINANZAS-ADMIN-001 RESULT
Status: BLOCKED — existing Google OAuth lacks workbook access
Files changed: new report UI/repository/Edge, one contract test, permission forward/recovery,
  four Admin integration lines, bundle build list/generated bundle, this audit,
  authority/decision/changelog appendices, architecture overrides/derived registry
Source-of-truth verdict: PASS — GOOGLE SHEETS ONLY
Invariant verdict: PASS — no financial copy, no persistent cache, no Google/financial writes
Build: PASS — bundle; Pages release remains blocked until actual permission registration
Tests: PASS — contract, isolated PostgreSQL, responsive Chrome, global local/Pages, Registry
Security: anonymous DENIED live; unassigned module DENIED isolated; positive source read BLOCKED
Legacy impact: READ ONLY; existing financial calculations/formulas/Apps Script unchanged
Unexpected files changed: none in isolated candidate; pre-existing workspace changes preserved
Known limitations: Google OAuth 403; screen migration not applied; no frontend publication
Evidence: commands and isolated results above
```

| Requested result | Result |
|---|---|
| Admin module / sidebar / Nunito | PASS, local candidate |
| Assignable/revocable screen permission | PASS isolated; deployment BLOCKED |
| Google connection / positive production read | BLOCKED, existing OAuth 403 |
| Google read-only implementation | PASS; writes 0 |
| Header-based mapping | PASS on real headers and 1,224 rows in memory |
| Year / status / month / approved default | PASS isolated |
| Total / secretariat / project / budget item / requisition detail | PASS isolated |
| Drill-down / breadcrumb / context / responsive / keyboard | PASS isolated |
| Initial / per-drill / refresh values reads | 1 / 0 / 1, contractual and browser evidence |
| Data refresh against Google production | BLOCKED; synthetic refresh PASS |
| Supabase financial copy / report tables / persistent cache | 0 / 0 / 0 |
| Permanent QA files / residual business QA data | 1 / 0 |
| Push / frontend deployment / sutiapp.com new report | BLOCKED; not performed |
| Existing production global surfaces | PASS |
| SUTIFINANZAS production closed | BLOCKED; not claimed |

## CLAUDE UI PRESERVATION REVIEW

Screen: Admin; new SUTIFINANZAS report.
Original/current sections: existing gate, header, sidebar groups, cards, modules and routes retained.
Missing sections: none. Added: SUTIFINANZAS entry/group/controller and report.
Interactions/navigation/visual structure preserved: PASS by additive diff and global browser regression.
Unauthorized redesign: NO. Verdict: PASS.

## SUTIAPP ARCHITECT REVIEW

Task: H-SUTIFINANZAS-ADMIN-001.
Verdict: BLOCKED.
Critical finding: productive OAuth returns 403 for the fixed workbook; connector permission is distinct. No successful production report read exists.
Source of truth: Google Sheets only; no alternative authority.
Architecture: dedicated report boundary, existing OAuth and screen permissions; additive registration prepared and tested.
Security: server-side Auth + capability + module boundary; secrets backend-only; fail closed.
Data: numeric values preserved, decimal aggregation before display rounding, explicit missing dimensions; no copied financial rows.
Legacy: zero Google writes; no changes to financial operations.
Owner decision: NO new business or architecture decision; external Google access grant required.
Next action: obtain actual authorization of the exact workbook for the existing SutiApp OAuth integration, then repeat live reads and complete release of this same H.
Response generated for Codex: YES.

### RESPONSE TO CODEX

No cierres H-SUTIFINANZAS-ADMIN-001. Concedido el acceso real al archivo autorizado en el OAuth existente, comprobar LOAD en vivo y denegaciones sin escrituras financieras; revalidar/applicar únicamente la migración de pantalla preparada y su recovery; refrescar metadata productiva; finalizar cachebusters y build del candidato aislado, commit/push, validar sutiapp.com y documentar evidencia. No migrar datos, crear otro OAuth, reutilizar el conector como fallback, escribir en Google ni publicar cambios previos ajenos. No avances a otra H.

## UI preservation contract

Existing Admin gate, header, sidebar groups, modules, mobile cards, permission management, assisted-context behavior and navigation remain structurally intact. Add one distinct SUTIFINANZAS entry/group and report controller. Report: title/subtitle, year/status/month/search, up to four contextual KPIs, source consultation timestamp, refresh, amount-sorted accessible rows with percentage bars, clickable breadcrumbs, explicit loading/error/empty and source-quality notices; responsive without required horizontal scrolling.
