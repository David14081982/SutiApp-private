/* Read-only identity projection for Admin Finance / Requests. */
(function () {
  'use strict';
  async function enrich(rows) {
    const loanIds = rows.filter(row => row.program_id === 'prestamo').map(row => row.id);
    const funds = new Map();
    if (loanIds.length) {
      // Existing permission-gated financial projection; one read, no per-row detail hydration.
      const financialRows = await window.ProgramRequestRepository.listFinancialMobile();
      for (const row of financialRows) {
        const snapshot = row.financial_submission_snapshot;
        funds.set(row.id, snapshot && snapshot.financialResult && snapshot.financialResult.fund);
      }
      if (loanIds.some(id => !funds.has(id))) throw new Error('FINANCE_QUEUE_FUND_READ_INCOMPLETE');
    }
    return Object.freeze(rows.map(row => Object.freeze(Object.assign({}, row, {
      nombre: String(row.affiliate && row.affiliate.full_name || '').trim() || 'Nombre completo no registrado',
      requested_fund: funds.get(row.id) || null,
    }))));
  }
  window.AdminFinanceQueueRepository = Object.freeze({ enrich });
})();
