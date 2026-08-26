# PERSONALIZED FINANCIAL SESSION SNAPSHOT IMPLEMENTATION RESULT

Date: 2026-08-25  
Scope: Suti Préstamo — owner-authorized temporary personalized financial session snapshot.

| Control | Result |
|---|---|
| ADR-043 | UPDATED |
| Migration | PASS |
| Snapshot global | 0 |
| Personalized snapshots | PASS |
| Snapshot per affiliate | PASS |
| Session binding | PASS |
| Impersonation binding | PASS |
| TTL | 15m |
| RLS | FORCED |
| Browser direct writes | 0 |
| Browser direct reads | 0 |
| Frontend financial calculations | 0 |
| Google authority | PRESERVED |
| Initial personalized Google load | PASS |
| Interactive amount Google calls | 0 |
| Interactive fund Google calls | 0 |
| Interactive term Google calls | 0 |
| Edge snapshot calculation | PASS |
| `financial_profile_version` invalidation | PASS |
| Expired snapshot rejected | PASS |
| Cross-user access | DENIED |
| Anonymous | DENIED |
| Latest-intent-wins | PASS — stale fetch cancelled |
| Stale render | 0 |
| Final Google validation | PASS |
| Atomic request creation | PASS |
| `CONDITIONS_CHANGED` | PASS |
| Duplicate requests | 0 |
| Odometer white flash | 0 |
| Interactive Google dependency | 0 |
| Google Sheet writes | 0 |
| Apps Script changes | 0 |
| Financial rule changes | 0 |
| Browser | PASS |
| Static suite | PASS — 42/42 |
| Architecture Registry | FRESH |
| Final verdict | PASS |

## Implemented boundary

```text
Auth → effective affiliate → current financial profile → Google read
     → category/union filter → loan_term_policy → personalized snapshot (15m)

amount/fund/term → Edge → context/TTL/version/fingerprint validation
                 → stored eligible rule → existing resolveQuote/quoteForTerm
                 → FinancialSimulationResult → 0 Google

confirm → current context/profile → current Google → current term policy
        → same calculation engine → compare → service-only atomic RPC
        → program_requests + immutable financial_submission_snapshot
```

The browser never supplies union, category, employee type, status, rate, maximum or eligibility as authority. The persisted cache omits name, CURP, RFC, control number, phone and documents. Source fingerprint includes every stored Google field that affects eligibility/calculation and effective visibility.

`loanSessionValidate` rechecks actor, effective affiliate, impersonation, profile version, TTL and policy without reading Google. This closes same-JWT context changes while allowing Home, Finanzas and Loan to reuse one valid initial resolution. Cross-user attempts are denied without invalidating the legitimate owner's snapshot.

## Confirmation and recovery

`loanSessionConfirm` performs the final Google read and recalculation. A mismatch returns `409 CONDITIONS_CHANGED`, invalidates the old snapshot and inserts nothing. Request creation and document attachment occur inside `create_validated_financial_program_request()`; the old browser sequence is revoked and blocked by trigger. Idempotency was verified with the same intent returning the same request inside a transaction.

The recovery script removes the temporary infrastructure only while no contractual `financial_submission_snapshot` history exists. Once such history exists it aborts before dropping the column. Expired rows are always invalid and are lazily deleted by Edge on session creation.

## Evidence

- Migration and recovery dry runs: full PostgreSQL transactions + `ROLLBACK`, persistent changes `0`.
- Migration apply: 947 affiliates, 3 requests, 3 financial requests and 0 request documents preserved; snapshot table initially empty; RLS forced and browser privileges zero.
- Atomic positive dry run: request + all required document links created, idempotent retry returned the same row, then `ROLLBACK`; duplicates `0`, persistent changes `0`.
- Live multiuser: two Auth users isolated; two distinct applicable profiles produced distinct personalized snapshots; A→B and B-owner denial-of-service attempt closed; Anonymous denied.
- Google call instrumentation: OPEN `1`; ten amount changes `0`; fund `0`; term `0`; CONFIRM `1`.
- Final controlled Edge latency after READY: median `678 ms`, max `736 ms`; Google latency removed from interactions.
- Chrome: initial automatic quote, 320 ms amount debounce, immediate fund/term, max in-flight `1`, latest selection only, assisted impersonation, visual fidelity and four-step flow passed.
- Adversarial Chrome: un cambio posterior aborta inmediatamente la cotización anterior. Si la última selección no alcanza el gateway, el cliente limita cada intento de transporte a 6 segundos y repite `loanSessionQuote` hasta cinco veces contra el mismo snapshot personalizado, con 500 ms entre intentos; no llama `loanSessionOpen` ni Google. Un error no-timeout o el quinto timeout conserva el estado manual controlado.
- Full Chrome session: login, Home, Finance, Loan, Admin, refresh, logout and return to login passed with zero application exceptions.
- Odometer Chrome matrix: previous value retained during recalculation, layout shift `0`, blank gap `0`, finite one-second animation, repeated digits restart, error/retry and reduced/frozen motion passed.
- Local checks: Deno type-check PASS; JS syntax PASS; static suite 42/42 PASS; Architecture Registry FRESH.

## Known operational prerequisite

There are currently zero published Suti Préstamo terms. The real browser therefore remains correctly fail-closed at confirmation and no production request was invented. The positive atomic path was proven against the real schema and real controlled document set inside a transaction that was fully rolled back. Publishing legal terms remains a separate owner/content action and was not inferred in this implementation.
