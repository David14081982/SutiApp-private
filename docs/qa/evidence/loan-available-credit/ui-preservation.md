# H-LOAN-AVAILABLE-CREDIT-001 — UI verification

Scope: candidate based on production commit `dad2cdf`, isolated tests only. This
record does not assert deployment or backend authorization verification.

CLAUDE UI PRESERVATION REVIEW

Screen: Inicio, Finanzas, Suti Préstamo, Admin Finanzas.
Original sections: Inicio financial chips; Finanzas summary/actions; loan header,
four-step progress, result, fund carousel, amount editor, terms, breakdown, deposit,
documents, summary and footer; Admin savings access, Solicitudes/Cotizaciones and
request workbench.
Current sections: same sections; new collapsed authorization panel in Admin.
Missing sections: none removed in source diff. No previously available control is
removed. Exhausted/unknown fund keeps its card and controls, with an explicit state.
Added sections: requested global/individual loan capacity authorization panel;
exhausted-balance notice.
Interactions preserved: fund switching, amount clamp, 6/12 term rules, debounced
quote, continuation only with a current valid quote; existing deposit/documents/
summary functions unchanged. Admin existing tabs/workbench unchanged.
Navigation preserved: static four-step/navigation contract passes. Isolated browser
checks simulator continuation eligibility; full production navigation is outside
this isolated harness.
Visual structure preserved: inspected screenshots at 430×920; all existing style
values retained except numeric precision where the available balance has cents.
Unauthorized redesign: NO.

Verdict: PASS for source structure and isolated component behavior. Production
integration/global image regression remains a separate required verification.

Evidence:

- `node scripts/test-loan-available-credit-ui.js`: PASS; normal/zero/cents,
  missing-source fail closed, profile maximum retained, RPC exact control/version,
  global/individual contract, invalid responses, denied write, publication signal,
  focus validation, stale response race, impersonation isolation and unsubscribe.
- `node scripts/test-loan-available-credit-ui-browser.js`: PASS; real Chrome,
  synthetic fixtures, zero external requests and zero production writes.
- `node scripts/test-loan-amount-term-ui.js`: PASS.
- `node scripts/test-finance-credit-consistency.js`: PASS.
- `node scripts/test-loan-simulator-ui-cutover.js`: PASS.
- `isolated-ui-browser.json` and `isolated-*.png`: component evidence; synthetic
  identity clearly marked, no production PII.

The browser publication subscription reads only metadata from the existing
`loan_history_publication` channel. Backend sessions remain the sole source of
available amounts. Signals discard cached amounts; they never calculate debt in
the browser. Channels/listeners are removed when there are no consumers, and
actor/session/affiliate/impersonation changes clear prior state. No polling added.
