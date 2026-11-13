/* Read-only identity projection for Admin Finance / Requests. */
(function () {
  'use strict';
  async function enrich(rows) {
    const loanIds = rows.filter(row => row.program_id === 'prestamo').map(row => row.id);
    const funds = new Map(), payments = new Map();
    if (loanIds.length) {
      // Existing permission-gated financial projection; one read, no per-row detail hydration.
      const financialRows = await window.ProgramRequestRepository.listFinancialMobile();
      for (const row of financialRows) {
        const snapshot = row.financial_submission_snapshot;
        funds.set(row.id, snapshot && snapshot.financialResult && snapshot.financialResult.fund);
        const result = snapshot && snapshot.financialResult;
        payments.set(row.id, result && typeof result.paymentPerPeriod === 'number' ? result.paymentPerPeriod : null);
      }
      if (loanIds.some(id => !funds.has(id))) throw new Error('FINANCE_QUEUE_FUND_READ_INCOMPLETE');
    }
    const reviews = new Map((await window.FinancialDocumentReviewRepository.list(loanIds)).map(review => [review.request_id, review]));
    return Object.freeze(rows.map(row => Object.freeze(Object.assign({}, row, {
      nombre: String(row.affiliate && row.affiliate.full_name || '').trim() || 'Nombre completo no registrado',
      requested_fund: funds.get(row.id) || null,
      payment_per_period: payments.get(row.id) ?? null,
      documentary_review: !['submitted','in_review','requires_financial_processing'].includes(row.status) && reviews.get(row.id)?.phase !== 'COMPLETE' ? { phase: 'CLOSED', result: null } : reviews.get(row.id) || null,
    }))));
  }
  async function historicalReviews(affiliateId) {
    const result = await window.SutiSupabase.getClient().rpc('list_admin_loan_historical_reviews', { p_affiliate_id: affiliateId || null });
    if (result.error || !Array.isArray(result.data)) throw new Error('HISTORICAL_REVIEW_READ_UNAVAILABLE');
    return result.data;
  }
  window.AdminFinanceQueueRepository = Object.freeze({ enrich, historicalReviews });
})();
