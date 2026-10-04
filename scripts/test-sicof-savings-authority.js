'use strict';
// Synthetic, isolated calculations only. No production rows, credentials or writers.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const { calculateSicof, createPreparedCalculator, ENGINE_VERSION } = await import('../supabase/functions/sicof/engine.mjs');
  const settings = {
    src: 'caja', selFunds: [], pay: 90, method: 'end',
    periodIni: '2026-07-01', periodFin: '2026-10-30', minm: 6,
    exterm: true, exmin: true, warn: 20, exConsec: false, consecN: 4,
    loanEffect: 'retiro', retScope: 'todo', anchorOn: false,
    capitalBasis: 'all', yieldMode: 'none', yieldPeriods: []
  };
  const transaction = (id, amount, effective_date, overrides = {}) => ({
    id, amount, effective_date, contribution_date: effective_date,
    component: 'CAPITAL', direction: 'CREDIT', transaction_type: 'CONTRIBUTION', ...overrides
  });
  const recorded = (amount, overrides = {}) => ({
    id: 'certified:synthetic:AS', date: '2026-07-15', amount, expected: null,
    source: 'CERTIFIED_HISTORY', status: amount === 0 ? 'NO_DEDUCTION' : 'RECEIVED',
    data_conflict: false, includes_yield: false, ...overrides
  });
  const person = (id = '001') => ({
    id, folio: id, name: 'Synthetic saver ' + id, identity_resolved: true, certified: true,
    enrollment: { enrollment_started_at: '2025-01-01', status: 'ACTIVE', frequency: 'TWICE_MONTHLY' },
    transactions: [transaction(id + '-capital', 1000, '2025-01-01')],
    composition: { balances: { capital: 1000, yield_amount: 50, available: 1050 }, movements: [], periods: [] },
    history: [recorded(500)],
    eligibility: { complete: false, reasons: ['HISTORICAL_EXPECTATION_UNVERIFIED'], policy_reasons: [] }
  });
  const analysis = {
    loans: [], funds: [], payments: [{
      fund: 'Caja de Ahorro', date: '2026-07-15', audit: 'RECONCILED_SOURCE_PAYMENT',
      paid: 110, interest: 10, fee: 1
    }]
  };
  const freeze = value => {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  };
  const checks = [];
  const test = (name, run) => { run(); checks.push(name); };
  function calculate(people, overrides = {}, loans = analysis) {
    const context = freeze({ today: '2026-10-04', participants: people });
    const input = freeze({ settings: { ...settings, ...overrides } });
    freeze(loans);
    const before = structuredClone({ context, input, loans });
    const actual = calculateSicof(context, loans, input);
    const prepared = createPreparedCalculator(context, loans);
    assert.deepEqual(prepared.calculate(input), actual, 'prepared and ordinary calculations must match');
    assert.deepEqual(prepared.calculate(input), actual, 'repeated prepared calculation must match');
    assert.deepEqual({ context, input, loans }, before, 'source amounts, expected values and ledger stay unchanged');
    assert.equal(actual.certification.can_post, false);
    return actual;
  }

  test('positive and zero certified amounts are accepted without inventing expected amounts', () => {
    for (const amount of [500, 0]) {
      const p = person(); p.history = [recorded(amount)];
      const r = calculate([p]);
      assert.equal(r.nqual, 1); assert.equal(r.reviewCount, 0);
      assert.equal(r.base, 1000); assert(Math.abs(r.rate - 0.9) < 1e-12);
      assert.equal(r.rows[0].rend, 9); assert.equal(r.rows[0].maxMissQ, 0);
      assert.equal(p.history[0].amount, amount); assert.equal(p.history[0].expected, null);
      assert.equal(r.rows[0].motivo, '');
    }
  });

  test('pending source observations preserve the accepted current capital and yield', () => {
    const p = person();
    p.eligibility.reasons.push('SOURCE_REVIEW_REQUIRED');
    const r = calculate([p]);
    assert.equal(r.nqual, 1); assert.equal(r.reviewCount, 0);
    assert.equal(r.rows[0].capital, 1000); assert.equal(r.rows[0].previous_yield, 50);
    assert.equal(r.rows[0].total, 1059); assert.equal(r.rows[0].entregable, 1059);
    assert.equal(r.pool, 9); assert.equal(r.reserve, 1); assert.equal(r.collected, 10);
  });

  test('independent review reasons and genuine historical conflicts remain pending', () => {
    for (const reason of ['HOLD_REVIEW_REQUIRED', 'ENROLLMENT_UNVERIFIED', 'CONTRIBUTION_CONFLICT', 'MIXED_CAPITAL_YIELD_HISTORY', 'CONTRIBUTION_EVIDENCE_INCOMPLETE']) {
      const p = person();
      p.eligibility.reasons.push('SOURCE_REVIEW_REQUIRED', reason);
      const r = calculate([p]);
      assert.equal(r.reviewCount, 1); assert.equal(r.rows[0].rend, null);
      assert.equal(r.rows[0].motivo, reason);
      assert.equal(r.rate, null); assert.equal(r.basisPending, true);
    }
  });

  test('missing or nonnumeric history is never created or accepted as recorded money', () => {
    for (const history of [[], [recorded(null)], [recorded(undefined)], [recorded(NaN)], [recorded(Infinity)], [recorded(500, { source: 'PENDING_SOURCE' })]]) {
      const p = person(); p.history = history;
      const r = calculate([p]);
      assert.equal(r.reviewCount, 1); assert.equal(r.rows[0].rend, null);
      assert.match(r.rows[0].motivo, /HISTORICAL_EXPECTATION_UNVERIFIED/);
    }
  });

  test('identity, certification and missing canonical components remain required', () => {
    for (const key of ['identity_resolved', 'certified']) {
      const p = person(); p[key] = false; p.eligibility.reasons.push('SOURCE_REVIEW_REQUIRED');
      const r = calculate([p]);
      assert.equal(r.reviewCount, 1); assert.equal(r.nqual, 0);
      assert.match(r.rows[0].motivo, /HISTORICAL_EXPECTATION_UNVERIFIED/);
      assert.match(r.rows[0].motivo, /SOURCE_REVIEW_REQUIRED/);
    }
    for (const key of ['capital', 'yield_amount']) {
      const p = person(); p.composition.balances[key] = null; p.eligibility.reasons.push('SOURCE_REVIEW_REQUIRED');
      const r = calculate([p]);
      assert.equal(r.reviewCount, 1); assert.equal(r.rows[0].rend, null);
      assert.match(r.rows[0].motivo, /SOURCE_REVIEW_REQUIRED/);
    }
    const p = person(); p.composition.as_of_balance = { capital: null, yield_amount: null };
    p.eligibility.reasons.push('SOURCE_REVIEW_REQUIRED');
    assert.match(calculate([p]).rows[0].motivo, /SOURCE_REVIEW_REQUIRED/, 'a current balance cannot replace missing as-of components');
  });

  test('minimum tenure, termination, short contribution and overdue rules remain effective', () => {
    const minimum = person(); minimum.enrollment.enrollment_started_at = '2026-09-01';
    const terminated = person(); terminated.enrollment.terminated_at = '2026-09-01';
    const short = person(); short.eligibility.policy_reasons = ['SHORT_CONTRIBUTION'];
    for (const p of [minimum, terminated, short]) {
      const r = calculate([p]);
      assert.equal(r.nqual, 0); assert.equal(r.nexcl, 1); assert.equal(r.reviewCount, 0);
      assert.equal(r.rows[0].rend, 0); assert.notEqual(r.rows[0].motivo, '');
    }
    const overdue = { ...analysis, loans: [{
      folio: '001', fund: 'Caja de Ahorro', status: 'SALDO ATRASADO', behavior: 'OVERDUE',
      arrears: 20, paid: 40, total: 100,
      savings_evidence: { version: 'SICOF_CURRENT_LOAN_EVIDENCE_V1', verified: true, as_of: '2026-10-04' }
    }] };
    const excluded = calculate([person()], { loanEffect: 'rendimiento' }, overdue);
    assert.equal(excluded.nexcl, 1); assert.equal(excluded.rows[0].rend, 0);
    const held = calculate([person()], { loanEffect: 'retiro', retScope: 'adeudo' }, overdue);
    assert.equal(held.nqual, 1); assert.equal(held.rows[0].retenido, 20);
    assert.equal(held.rows[0].entregable, 1039);
  });

  test('known dated movements retain the same average and withdrawal day calculation', () => {
    const p = person();
    p.transactions = [transaction('deposit', 1000, '2026-07-01'), transaction('withdrawal', 100, '2026-08-01', { direction: 'DEBIT', transaction_type: 'WITHDRAWAL' })];
    p.composition.balances.capital = 900;
    const expected = (1000 * 31 + 900 * 91) / 122;
    const r = calculate([p], { method: 'avg' });
    assert.equal(r.nqual, 1); assert(Math.abs(r.rows[0].avgbal - expected) < 1e-10);
    assert.equal(r.rows[0].endbal, 900); assert.equal(r.totals.withdrawals, 100);
    const ready = structuredClone(p); ready.eligibility = { complete: true, policy_reasons: [] };
    assert.deepEqual(calculate([ready], { method: 'avg' }), r, 'accepting the certified value is equivalent to an already-ready participant');
  });

  test('a certified closing balance supports end method without inventing a prior daily history', () => {
    const p = person(); p.certified_as_of = '2026-09-06';
    p.transactions = [transaction('certified-capital', 1000, p.certified_as_of, { transaction_type: 'REGULARIZATION', contribution_date: null })];
    const average = calculate([p], { method: 'avg' });
    assert.equal(average.reviewCount, 1); assert.equal(average.rows[0].rend, null);
    assert.equal(average.rows[0].motivo, 'HISTORICAL_DAILY_BALANCE_UNPROVEN');
    assert.deepEqual(average.rows[0].calculation_steps, []);
    const end = calculate([p]);
    assert.equal(end.nqual, 1); assert.equal(end.rows[0].endbal, 1000); assert(Math.abs(end.rate - 0.9) < 1e-12);
    const earlier = calculate([p], { periodFin: '2026-08-30' });
    assert.equal(earlier.reviewCount, 1); assert.match(earlier.rows[0].motivo, /HISTORICAL_CUTOFF_UNPROVEN/);
  });

  test('cent allocations conserve the distributable pool with deterministic remainders', () => {
    const people = ['003', '001', '002'].map(id => {
      const p = person(id); p.transactions = [transaction(id + '-capital', 1, '2025-01-01')];
      p.composition.balances = { capital: 1, yield_amount: 0, available: 1 };
      return p;
    });
    const tiny = { ...analysis, payments: [{ ...analysis.payments[0], interest: 0.02, fee: 0 }] };
    const r = calculate(people, { pay: 100 }, tiny);
    assert.deepEqual(r.rows.map(row => row.rend), [0, 0.01, 0.01]);
    assert.equal(r.distributed, 0.02); assert.equal(r.pool, r.distributed);
    assert.equal(r.rows.reduce((sum, row) => sum + Math.round(row.rend * 100), 0), 2);
  });

  assert.equal(ENGINE_VERSION, 'SICOF_2026_10_04_V4');
  const evidence = { status: 'PASS', engine_version: ENGINE_VERSION, synthetic_only: true, financial_writes: 0, checks };
  const output = path.resolve(__dirname, '../docs/qa/evidence/sicof-savings-authority/engine.json');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify(evidence));
})().catch(error => { console.error(error); process.exitCode = 1; });
