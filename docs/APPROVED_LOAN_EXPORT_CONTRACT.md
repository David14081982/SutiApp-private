# APPROVED LOAN EXPORT CONTRACT

Date: 2026-08-22

Status: `PARTIAL — SAFE BOUNDARY ENFORCED / WRITER BLOCKED`

## Authority and boundary

- User submission writes only Supabase `public.program_requests`.
- Admin approval is the only event authorized to initiate a Google export.
- The only writable Google target is `SutiApp Final` → `Historial de solicitudes`.
- The only operation is `APPEND ONE NEW ROW AFTER ADMIN APPROVAL`.
- The writer must not edit or delete historical rows, insert columns, change headers/formulas, reorder content, touch another sheet, invoke amortization, or advance financial state after the append.
- Supabase keeps the request when Google fails. It is not marked exported until Google confirms the real row.

## Live read-only audit

Spreadsheet metadata resolved the exact target as sheet id `10616270`, title `Historial de solicitudes`, grid `2237 × 38`, with one frozen header row. The live header is A:AL and includes the candidate columns B:Y and AF:AG named in the owner correction.

The bounded read-only audit found:

- D Proceso contains three historical values: `1`, `3`, `JUB`.
- M contains `AFILIADO`, `NO AFILIADO`, several employer/member labels, and blanks.
- Y contains `Iniciado`, `Pendiente`, `Liquidado`, `Rechazado`, and blanks; most are downstream states and therefore do not establish the correct initial value by frequency.
- G contains multiple numeric values, anomalies and blanks; the sheet alone does not prove whether each program uses quincenas, meses or another period.
- O:W has multiple presence patterns. Historical frequency suggests different document sets by process/fund, but does not establish a business rule safe enough for a productive writer.

No live Google write was executed.

## Current Supabase coverage

`program_requests` preserves identity, target, type, quantity, notes, signature, terms, status, financial processing status and timestamps. It does not currently preserve a complete approved loan payload for B:AG: requested amount/term and applicable documents are absent from the initial request contract, while employee category, union and affiliation semantics are not mapped to the legacy columns.

Existing status pairs can represent the required phases conceptually:

| Contract state | Existing equivalent candidate |
|---|---|
| `PENDING_REVIEW` | request pending review + financial `pending` |
| `APPROVED_PENDING_EXPORT` | request `approved` + financial `ready_for_handoff` |
| `APPROVED_EXPORTED` | request `approved` + financial `handed_off` |
| `EXPORT_FAILED` | request `approved` + financial `failed` |

This mapping is not activated until a backend transition enforces it atomically and the payload gate passes.

## Safe correction implemented

The user submission screen no longer invokes `FinancialLegacyRepository.handoffRequest()` after creating a request. `operationsStore` no longer exports pending requests during Historial load, refresh or retry. The Edge Function now also rejects handoff unless the caller has backend `program_requests.write` permission and the request is exactly `approved + ready_for_handoff`. The visual Claude contract remains unchanged: same sheet, confirmation, folio, navigation and tracking states.

The previously deployed Apps Script and technical sheet were not modified or activated. The old endpoint must not receive a shared secret or be treated as the approved writer.

## Writer gate

Before implementation or activation, one authoritative contract must resolve:

1. exact D Proceso mapping;
2. exact M affiliation mapping;
3. exact Y initial state;
4. required O:W documents per request type and authoritative Storage references;
5. exact G term value and period per applicable program;
6. where the approved amount, rate, total and maximum originate without browser calculation or catalog fallback;
7. which `program_requests` are loans eligible for this sheet rather than other program requests.

Any `UNKNOWN` produces fail-closed behavior and no Google row.

## Required writer algorithm

```text
authorize Admin in backend
→ atomically mark approved/pending export in Supabase
→ call Google server-to-server
→ obtain LockService lock
→ validate exact spreadsheet + sheet + 38 headers
→ find program_request_id in technical export registry
→ if already exported, return the recorded row (no append)
→ validate complete payload and no unknown fields
→ determine append row while lock is held
→ write exactly one A:AL row using existing columns only
→ flush and verify the written row
→ record program_request_id, exported status, row and timestamp
→ release lock
→ only after confirmation mark Supabase exported
```

On Google error or ambiguous timeout, preserve Supabase and mark/recover as failed without another append until the registry check proves no row exists.

## Result

```text
User submission writes Google: NO
Admin approval writes Google: NOT ACTIVE — contract approved, writer blocked by required UNKNOWN fields
Target sheet: Historial de solicitudes
Operation: APPEND ONLY
Historical rows editable: NO
Other sheets writable: NO
Criterios de fondos writable: NO
Apps Script modified: NO
Automatic amortization triggered: NO
Idempotency: FAIL — final writer not implemented or proven end-to-end
Concurrency protection: FAIL — final writer LockService path not implemented or proven end-to-end
Supabase request preserved on Google failure: FAIL — required by design but final transition not implemented or proven end-to-end
Retry without duplicate: FAIL — required by design but final recovery path not implemented or proven end-to-end
Final verdict: PARTIAL
```

## H-APPROVED-LOAN-EXPORT-CONTRACT RESULT

```text
Status: BLOCKED — safe boundary correction PASS; final writer activation blocked by unresolved payload contract
Files changed: app/screens-catalogo.jsx; app/operations-store.jsx; app/bundle.js; supabase/functions/financial-legacy/index.ts; scripts/test-phase7.js; scripts/test-phase7-handoff-live.py; SutiApp.html; sw.js; version assertions in seven static tests; docs/APPROVED_LOAN_EXPORT_CONTRACT.md; docs/DECISIONS.md; docs/INVARIANTS.md; docs/SOURCE_OF_TRUTH.md; docs/ARCHITECTURE.md; docs/LEGACY_GOOGLE_SYSTEMS.md; docs/WORK_QUEUE.md; docs/AGENT_CHANGELOG.md
Source-of-truth verdict: SAFE for initial request and fail-closed export; writer remains BLOCKED
Invariant verdict: PASS for INV-063 through INV-074 applicable boundary checks
Build: PASS — bundle regenerated from 76 sources; node --check app/bundle.js and sw.js
Tests: PASS — 14-test static suite; Phase 7 rerun PASS. Deno check NOT AVAILABLE. Remote writer test NOT RUN because local Edge change is not deployed and activation is blocked.
Security: PASS local fail-closed boundary — backend Admin permission + approved/ready gate; no browser secret. Deployment NOT APPLICABLE in this blocked H.
Legacy impact: READ ONLY audit of metadata/header/bounded D:Y values; zero Google writes; Apps Script/formulas/triggers/sheets unchanged
Unexpected files changed: no Git metadata exists; recent-file inventory matches declared files, with pre-existing screens-loan/report files excluded
Known limitations: final loan writer, approval transition, export failure state, exact payload mapping and end-to-end concurrency/idempotency remain unimplemented/unproven
Evidence: live spreadsheet metadata and bounded reads; scripts/test-phase7.js; 14-test static suite; source/bundle scans; invariant ID uniqueness; secret scan
```
