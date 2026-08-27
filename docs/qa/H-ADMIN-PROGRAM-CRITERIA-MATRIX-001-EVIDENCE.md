# H-ADMIN-PROGRAM-CRITERIA-MATRIX-001 — Evidence

Date: 2026-08-26
Status: **PASS_WITH_CLARIFICATIONS**

## Scope and authority

- Scope: `Admin → Finanzas → Fondos y reglas`, with a Desktop-only analysis matrix at `>=1024px`.
- Authority: Google Sheet `Criterios de fondos` remains the sole business authority. The existing `financial-legacy` catalog read model remains the only productive reader used by this screen.
- Backend, Edge Functions, RLS, migrations, Apps Script, formulas, rates, amounts, terms, dates, eligibility and visibility rules: unchanged.
- Desktop is strictly read-only. The pre-existing, separately authorized mobile visibility editor remains present only below 1024px; it was not exercised and no writer endpoint was called.
- No mock, `DATA`, JSON, local/session storage, cache or alternate business source was introduced.

## Proven field mapping

| Human concept | Read-model field | Proven origin/meaning |
|---|---|---|
| Program | `program_id` | Existing derived family: Suti Préstamo, Caja de ahorro or Financiamiento vía nómina |
| Fund | `fund` | Google column C, `Fondo` |
| Union condition | `union` | Google column B, `Sindicato`; eligibility condition |
| Category condition | `category` | Google column A, `CATEGORIAS`; eligibility condition |
| Maximum amount | `max_amount` | Google column D, `Monto Maximo`; display formatting only |
| Rate | `rate` | Google column E normalized by the existing Edge contract and returned as display percent; no frontend conversion |
| Term | `term_label`, `payment_count`, `payment_period` | Google column F parsed by the existing Edge contract; raw human label retained |
| Validity | `permanent`, `available_on` | Existing permanent/date classification; no invented validity calculation |
| Visibility | `visibility_mode`, `automatic_visibility`, `effective_visibility` | Google P plus existing Hermosillo visibility policy |
| Status | `status` | Existing `AVAILABLE/SCHEDULED/UNAVAILABLE`, rendered as Disponible/Programado/No disponible |

Eligibility and visibility are presented separately: union/category state who a rule applies to, while mode/date/policy determine whether it is visible in SutiApp. The matrix never evaluates an individual affiliate.

The following Google headers are not exposed by the authorized catalog read model and their business semantics remain unclear: `Concatenado`, `Ícono`, `Beneficiario`, `Simulación Interés a pagar total`, `Plazo para cálculo AD. NÓMINA`, `MOSTRAR PROGRAMA`, `FECHA AÑO`. Each is `OWNER_CLARIFICATION_REQUIRED`; none was guessed or added to the UI.

## Data summary

Live read-only catalog result:

```text
PROGRAM CRITERIA DATA SUMMARY

Total criteria: 146
Distinct programs / funds: 3 / 35
Distinct unions: 4
Distinct categories: 6
Available: 57
Scheduled: 42
Unavailable: 47
Visibility modes: AUTO (146)
Potential duplicate groups: 2
Potential conflict groups: 1
Condition-difference fund groups: 35
Unknown semantic fields: 7
```

Detection is conservative and presentation-only:

- `Potential duplicate`: same program, fund, union, category, amount, rate, payment count, term label, date and visibility mode across more than one source row.
- `Potential conflict`: same program, fund, union, category and date, with different amount/rate/term/visibility values.
- `Condition difference`: same program/fund with multiple union/category/date/term conditions.

These signals do not declare source errors and perform no write.

## Browser and responsive evidence

Real Chrome verified:

- 1024×768: compact matrix + persistent detail, internal horizontal scrolling, sticky header/fund, no page overflow.
- 1280×900 and 1440×1000: expanded Desktop matrix + detail, same containment and sticky behavior.
- Search and combined filters for program, fund, union, category, validity, visibility and status.
- Presentation-only sorting by program, union, category, amount, rate, date and status.
- Grouping by the existing `program_id` hierarchy.
- Row selection, persistent detail, keyboard up/down navigation and comparison of two rules (hard limit four).
- Human labels; technical identity remains closed under `Información técnica`.
- Explicit fail-closed Google/read-model error, no fallback and successful retry.
- Refresh returns all 146 live criteria.
- 430×932 keeps the prior mobile cards, filters, title and authorized visibility controls; Desktop matrix is absent and page overflow is zero.

Machine evidence: `docs/qa/evidence/admin-program-criteria-matrix-20260826/playwright-result.json` and four masked PNG screenshots.

## Security and mutation audit

```text
Authorized Admin with financial_criteria.visibility.read: ALLOWED
Unauthorized responsible test identity: DENIED
Normal authenticated user: DENIED
Anonymous: DENIED
Desktop writer controls: 0
financial-criteria-admin browser calls: 0
Google direct browser calls: 0
Google writes: 0
Supabase financial writes: 0
Apps Script writes: 0
Business rows changed: 0
Browser criteria storage writes: 0
```

The `financial-legacy` browser POST is an allowlisted `catalog` read action. No approve, handoff, quote, criteria writer or financial REST mutation occurred.

## Verification

```text
Bundle build: PASS — 90 sources; syntax validated
Program criteria static contract: PASS
Live catalog/security/data summary: PASS
Program criteria Chrome: PASS
Admin Desktop Shell Chrome regression: PASS — productive writes 0; exceptions 0
Static suite: PASS — 48/48
Documents Workbench regression: PASS — static contract
Requests Workbench regression: PASS — static contract
Financial Requests Workbench regression: PASS — static contract
Loan Simulator regression: PASS — static contract
Personalized Financial Snapshot regression: PASS — static contract
Architecture Registry: UPDATED / FRESH
```

## Final result

```text
H-ADMIN-PROGRAM-CRITERIA-MATRIX-001 RESULT

Google authority: PRESERVED
Google writes: 0
Supabase financial writes: 0
Desktop matrix: PASS
Total criteria: 146
Programs / funds: 3 / 35
Unions: 4
Categories: 6
Search: PASS
Filters: PASS
Sorting: PASS
Grouping: PASS
Detail panel: PASS
Comparison: PASS
Human labels: PASS
Technical IDs primary: 0
Visibility vs eligibility: CLEAR
Status clarity: PASS
Potential duplicate groups: 2
Potential conflict groups: 1
Unknown semantic fields: 7 — OWNER_CLARIFICATION_REQUIRED, excluded
Mobile preserved: PASS
1024: PASS
1280: PASS
1440: PASS
Browser productive writes: 0
Playwright: PASS
Static suite: PASS — 48/48
Regression suite: PASS
Architecture Registry: UPDATED / FRESH
Final verdict: PASS_WITH_CLARIFICATIONS
```
