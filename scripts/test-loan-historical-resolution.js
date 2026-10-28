'use strict';
// H-LOAN-HISTORICAL-FUND-RESOLUTION-COMPLETE-001: isolated synthetic contracts.
// No private captures, network, credentials, production data or filesystem writes.
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const now = '2026-10-27T19:00:00Z';
const identity = Object.freeze({ affiliate_id: 'synthetic-affiliate', numero_control: 'TEST-001' });
const checks = [];
const crossProgramNames = ['Vales y membresias', 'Seguro Colectivo Suti', 'Suti Terrenos',
  'Suti Auto', 'Panel Solar', 'Suti Cirugias', 'Suti Tours'];

function base() {
  return { source: { folio: identity.numero_control, loans: [], requests: [] }, runtime: {
    funds: [
      { id: 'cash', name: 'Caja Chica', program_id: 'caja' },
      { id: 'savings', name: 'Caja de Ahorro', program_id: 'prestamo' },
      { id: 'payroll', name: 'Sutiexpress', program_id: 'nomina' },
    ],
    rules: [
      { id: 'cash-rule', fund_id: 'cash', criterion_identity: 'SUPABASE_RULE:cash-rule' },
      { id: 'savings-rule', fund_id: 'savings', criterion_identity: 'SUPABASE_RULE:savings-rule' },
      { id: 'payroll-rule', fund_id: 'payroll', criterion_identity: 'SUPABASE_RULE:payroll-rule' },
    ], requests: [],
  } };
}

function addLoan(fixture, id = '900001', fund = 'Caja Chica') {
  const first = { id, owner: identity.numero_control, source_row: 2 + fixture.source.loans.length,
    date: '2026-10-15', number: 1, amount: 600, scheduled: 600, fund, total: 1200,
    principal: 1000, term: 2, status: 'AL CORRIENTE', authorized: '2026-10-01',
    paid_to_date: 600, expected_to_date: 600 };
  fixture.source.loans.push(first, { ...first, source_row: first.source_row + 1,
    date: '2026-11-15', number: 2 });
  fixture.source.requests.push({ id, owner: identity.numero_control, fund, total: 1200,
    principal: 1000, term: 2, status: 'Iniciado', date: '2026-10-01', receipt: null });
  return fixture;
}

function linkRequest(fixture, options = {}) {
  const id = options.loanId || fixture.source.loans[0].id;
  const request = { id: 'request-' + id, folio: 'SR-2099-' + id, status: 'approved',
    program_id: 'prestamo', financial: true, criterion_identity: 'SUPABASE_RULE:cash-rule',
    approved_at: '2026-10-01T12:00:00Z', ...options };
  delete request.loanId;
  fixture.runtime.requests.push(request);
  fixture.source.requests.find(row => row.id === id).receipt = {
    id: Number(id), identity: request.folio, sourceHash: 'a'.repeat(64),
  };
  return fixture;
}

function membership() {
  return linkRequest(addLoan(base(), '900001', 'Vales y membresias'), {
    program_id: 'membership', financial: false, criterion_identity: null,
  });
}

function futureBlank() {
  const fixture = addLoan(base());
  fixture.source.loans.forEach((row, index) => Object.assign(row, {
    status: '', date: index ? '2026-12-15' : '2026-11-15', paid_to_date: null,
    expected_to_date: null, authorized: '2026-10-27',
  }));
  fixture.source.requests[0].date = '2026-10-27';
  return fixture;
}

function freezeDeep(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freezeDeep);
    Object.freeze(value);
  }
  return value;
}

function check(name, run) {
  try { run(); checks.push({ name, status: 'PASS' }); }
  catch (error) { checks.push({ name, status: 'FAIL', error: error.stack || error.message }); }
}

async function main() {
  const { projectLoanCapacity } = await import(pathToFileURL(path.join(root,
    'supabase/functions/financial-legacy/loan-capacity.mjs')));
  const { projectHistory } = await import(pathToFileURL(path.join(root,
    'supabase/functions/loan-history/history.mjs')));
  const calculate = (fixture, context = identity) => projectLoanCapacity(
    freezeDeep(fixture.source), freezeDeep(fixture.runtime), now, context);
  const balance = (result, id = 'cash') => result.funds.find(row => row.fund_id === id);
  const assertMapping = (fixture, id = '900001') => assert.throws(() => calculate(fixture), error => {
    assert.equal(error.message, 'HISTORICAL_LOAN_MAPPING_REQUIRED');
    assert.equal(typeof error.reason, 'string');
    assert.ok(error.reason.length > 0);
    assert.equal(error.obligation_id, id);
    return true;
  });
  const assertDataReview = (fixture, id = '900001') => assert.throws(() => calculate(fixture), error => {
    assert.equal(error.message, 'HISTORICAL_LOAN_DATA_REVIEW_REQUIRED');
    assert.equal(typeof error.reason, 'string');
    assert.ok(error.reason.length > 0);
    assert.equal(error.obligation_id, id);
    return true;
  });

  check('empty owned history retains every catalog fund and original output contract', () => {
    const result = calculate(base());
    assert.deepEqual(Object.keys(result).sort(), ['affiliate_id', 'business_day', 'funds',
      'numero_control', 'observed_at', 'represented_request_ids', 'version'].sort());
    assert.equal(result.affiliate_id, identity.affiliate_id);
    assert.equal(result.numero_control, identity.numero_control);
    assert.equal(result.business_day, '2026-10-27');
    assert.deepEqual(result.funds, ['cash', 'savings', 'payroll'].map(fund_id => ({
      fund_id, pending_amount: 0, active_loans: 0,
    })));
  });
  check('legacy loan uses exact catalog fund and preserves K minus paidThrough', () => {
    assert.deepEqual(balance(calculate(addLoan(base()))), { fund_id: 'cash', pending_amount: 600, active_loans: 1 });
  });
  check('two real loans in the same fund preserve both debts', () => {
    assert.deepEqual(balance(calculate(addLoan(addLoan(base()), '900002'))), {
      fund_id: 'cash', pending_amount: 1200, active_loans: 2,
    });
  });
  check('nomina remains a loan program and preserves its Sutiexpress debt', () => {
    assert.equal(balance(calculate(addLoan(base(), '900001', 'Sutiexpress')), 'payroll').pending_amount, 600);
  });
  check('past zero deduction does not release capacity', () => {
    const fixture = addLoan(base()); fixture.source.loans[0].amount = 0;
    assert.equal(balance(calculate(fixture)).pending_amount, 1200);
  });
  check('paid historical unknown fund retains the preexisting zero-debt result', () => {
    const fixture = addLoan(base(), '900001', 'Retired unknown fund');
    fixture.source.loans[1].date = '2026-10-20';
    assert.deepEqual(calculate(fixture), calculate(base()));
  });
  check('unknown positive debt produces an actionable mapping error', () => {
    assertMapping(addLoan(base(), '900001', 'Unmapped historical loan'));
  });
  check('plural Descuentos is not guessed to be singular Descuento', () => {
    const fixture = addLoan(base(), '900001', 'Descuentos');
    fixture.runtime.funds.push({ id: 'discount', name: 'Descuento', program_id: 'prestamo' });
    assertMapping(fixture);
  });
  check('historical dated fund is not reassigned to a different year', () => {
    const fixture = addLoan(base(), '900001', '30/11/2025 — Aguinaldos');
    fixture.runtime.funds.push({ id: 'bonus', name: '30/11/2026 — Aguinaldos', program_id: 'prestamo' });
    assertMapping(fixture);
  });
  check('similar wording does not create an undocumented cross-program alias', () => {
    assertMapping(addLoan(base(), '900001', 'Vales membresias'));
  });
  check('two catalog funds with the same normalized historical name remain ambiguous', () => {
    const fixture = addLoan(base());
    fixture.runtime.funds.push({ id: 'other-cash', name: '  CAJA  CHICA ', program_id: 'caja' });
    assertMapping(fixture);
  });

  for (const name of crossProgramNames) {
    check('historical ' + name + ' stays in its own program', () => {
      const fixture = addLoan(base(), '900001', name);
      const before = structuredClone(fixture);
      assert.deepEqual(calculate(fixture), calculate(base()));
      assert.deepEqual(fixture, before);
    });
  }
  check('historical cross-program aliases tolerate accents, case and repeated whitespace only', () => {
    assert.deepEqual(calculate(addLoan(base(), '900001', '  VALES   Y MEMBRESÍAS  ')), calculate(base()));
  });
  check('membership and real loan coexist without losing real debt', () => {
    const fixture = addLoan(membership(), '900002');
    assert.equal(balance(calculate(fixture)).pending_amount, 600);
    assert.equal(balance(calculate(fixture)).active_loans, 1);
    assert.deepEqual(calculate(fixture).represented_request_ids, []);
  });
  check('canonical membership has no loan reservation representation', () => {
    assert.deepEqual(calculate(membership()).represented_request_ids, []);
  });
  check('proven membership data is not validated as loan debt and remains unchanged', () => {
    const fixture = membership();
    fixture.source.loans[0].amount = null;
    fixture.source.loans.forEach(row => { row.status = 'PROGRAM-SPECIFIC-STATE'; });
    const before = structuredClone(fixture);
    assert.deepEqual(calculate(fixture), calculate(base()));
    assert.deepEqual(fixture, before);
  });
  check('canonical membership conflicting with an actual loan fund fails closed', () => {
    const fixture = membership();
    fixture.source.loans.forEach(row => { row.fund = 'Caja Chica'; });
    fixture.source.requests[0].fund = 'Caja Chica';
    assertMapping(fixture);
  });
  check('canonical membership source request cannot contradict its amortization program', () => {
    const fixture = membership(); fixture.source.requests[0].fund = 'Caja Chica';
    assertMapping(fixture);
  });
  check('legacy cross-program alias cannot override a source request for a real loan fund', () => {
    const fixture = addLoan(base(), '900001', 'Vales y membresias');
    fixture.source.requests[0].fund = 'Caja Chica';
    assertMapping(fixture);
  });
  check('legacy duplicate source origins with the same proven program preserve all rows', () => {
    const fixture = addLoan(base(), '900001', 'Vales y membresias');
    fixture.source.requests.push({ ...fixture.source.requests[0], total: 1300, principal: 1100 });
    const before = structuredClone(fixture);
    assert.deepEqual(calculate(fixture), calculate(base()));
    assert.deepEqual(fixture, before);
  });
  check('legacy duplicate origins with conflicting or unknown programs require mapping review', () => {
    for (const fund of ['Caja Chica', 'Suti Tours', 'Unknown historical program']) {
      const fixture = addLoan(base(), '900001', 'Vales y membresias');
      fixture.source.requests.push({ ...fixture.source.requests[0], fund });
      assertMapping(fixture);
    }
  });
  check('nonfinancial canonical membership with a financial criterion is contradictory', () => {
    const fixture = membership(); fixture.runtime.requests[0].criterion_identity = 'SUPABASE_RULE:cash-rule';
    assertMapping(fixture);
  });
  check('canonical criterion resolves a renamed loan ahead of historical text', () => {
    const fixture = linkRequest(addLoan(base(), '900001', 'Former undocumented loan title'));
    assert.equal(balance(calculate(fixture)).pending_amount, 600);
    assert.deepEqual(calculate(fixture).represented_request_ids, ['request-900001']);
  });
  check('canonical financial Tours contract keeps its real loan funding', () => {
    const fixture = linkRequest(addLoan(base(), '900001', 'Suti Tours'), { program_id: 'tours' });
    assert.equal(balance(calculate(fixture)).pending_amount, 600);
    assert.deepEqual(calculate(fixture).represented_request_ids, ['request-900001']);
  });
  check('canonical loan missing criterion is not repaired from a catalog-name fallback', () => {
    assertMapping(linkRequest(addLoan(base()), { criterion_identity: null }));
  });
  check('canonical unknown criterion is not repaired from historical aliases', () => {
    assertMapping(linkRequest(addLoan(base(), '900001', 'Suti Tours'), { criterion_identity: 'missing' }));
  });
  check('missing canonical request is not replaced by a historical cross-program alias', () => {
    const fixture = membership(); fixture.runtime.requests = [];
    assertMapping(fixture);
  });
  check('unapproved membership does not authorize exclusion', () => {
    const fixture = membership(); fixture.runtime.requests[0].status = 'rejected';
    assertMapping(fixture);
  });
  check('canonical criterion matching more than one fund remains ambiguous', () => {
    const fixture = linkRequest(addLoan(base()));
    fixture.runtime.rules.push({ id: 'conflict', fund_id: 'savings', criterion_identity: 'SUPABASE_RULE:cash-rule' });
    assertMapping(fixture);
  });
  check('amortized canonical loan is represented once so reservation is not also charged', () => {
    const fixture = linkRequest(addLoan(base()));
    const result = calculate(fixture);
    assert.deepEqual(result.represented_request_ids, [fixture.runtime.requests[0].id]);
    assert.equal(result.funds.reduce((total, fund) => total + fund.pending_amount, 0), 600);
    assert.equal(result.funds.reduce((total, fund) => total + fund.active_loans, 0), 1);
  });
  check('paid canonical loan remains represented to avoid resurrecting its reservation', () => {
    const fixture = linkRequest(addLoan(base())); fixture.source.loans[1].date = '2026-10-20';
    assert.deepEqual(calculate(fixture).represented_request_ids, ['request-900001']);
    assert.equal(balance(calculate(fixture)).pending_amount, 0);
  });

  check('missing business identity remains a context error', () => {
    assert.throws(() => calculate(base(), { affiliate_id: 'synthetic-affiliate', numero_control: null }), /LOAN_CAPACITY_CONTEXT_INVALID/);
  });
  check('source cannot substitute a different control', () => {
    const fixture = addLoan(base()); fixture.source.folio = 'TEST-002';
    assert.throws(() => calculate(fixture), /LOAN_CAPACITY_CONTEXT_INVALID/);
  });
  for (const surface of ['loans', 'requests']) {
    check('cross-program ' + surface + ' cannot escape exact owner validation', () => {
      const fixture = membership(); fixture.source[surface][0].owner = 'TEST-002';
      assert.throws(() => calculate(fixture), /HISTORY_SOURCE_IDENTITY_MISMATCH/);
    });
  }
  check('canonical membership receipt with wrong loan id fails identity validation', () => {
    const fixture = membership(); fixture.source.requests[0].receipt.id = 900002;
    assert.throws(() => calculate(fixture), /HISTORY_TRANSFER_IDENTITY_INVALID/);
  });
  check('canonical membership receipt with invalid integrity hash is rejected', () => {
    const fixture = membership(); fixture.source.requests[0].receipt.sourceHash = 'invalid';
    assert.throws(() => calculate(fixture), /HISTORY_TRANSFER_IDENTITY_INVALID/);
  });
  check('duplicate canonical folio remains an identity error', () => {
    const fixture = membership(); fixture.runtime.requests.push({ ...fixture.runtime.requests[0], id: 'different-request' });
    assert.throws(() => calculate(fixture), /REQUEST_IDENTITY_AMBIGUOUS/);
  });
  check('duplicate canonical request id remains an identity error', () => {
    const fixture = membership(); fixture.runtime.requests.push({ ...fixture.runtime.requests[0], folio: 'SR-2099-900002' });
    assert.throws(() => calculate(fixture), /REQUEST_IDENTITY_INVALID/);
  });
  check('duplicate source receipt cannot authorize exclusion or double charging', () => {
    const fixture = membership(); fixture.source.requests.push(structuredClone(fixture.source.requests[0]));
    assert.throws(() => calculate(fixture), /REQUEST_IDENTITY_AMBIGUOUS/);
  });
  check('one canonical membership cannot authorize exclusions for two amortization identities', () => {
    const fixture = addLoan(membership(), '900002', 'Vales y membresias');
    fixture.source.requests[1].receipt = { ...fixture.source.requests[0].receipt, id: 900002 };
    assert.throws(() => calculate(fixture), /REQUEST_IDENTITY_AMBIGUOUS/);
  });

  for (const [label, patch] of [
    ['null amount', { amount: null }], ['negative amount', { amount: -1 }],
    ['nonfinite amount', { amount: Infinity }], ['invalid calendar date', { date: '2026-02-30' }],
    ['missing total', { total: null }], ['unknown status', { status: 'UNKNOWN' }],
    ['invalid source row', { source_row: 1 }],
  ]) {
    check('real loan ' + label + ' requires historical data review', () => {
      const fixture = addLoan(base()); Object.assign(fixture.source.loans[0], patch);
      assertDataReview(fixture);
    });
  }
  check('duplicate installment does not silently double or erase debt', () => {
    const fixture = addLoan(base()); fixture.source.loans.push(structuredClone(fixture.source.loans[0]));
    assertDataReview(fixture);
  });

  check('newly initiated future blank-state loan retains the full contract total', () => {
    const fixture = futureBlank(); const before = structuredClone(fixture);
    assert.equal(balance(calculate(fixture)).pending_amount, 1200);
    assert.deepEqual(fixture, before);
    assert.ok(fixture.source.loans.every(row => row.status === '' && row.paid_to_date === null));
  });
  check('future blank-state acceptance preserves K when future deductions differ', () => {
    const fixture = futureBlank(); fixture.source.loans[0].amount = 1206.75; fixture.source.loans[1].amount = 0;
    assert.equal(balance(calculate(fixture)).pending_amount, 1200);
  });
  check('future blank-state numeric legacy transfer retains its own exact fund', () => {
    const fixture = futureBlank();
    fixture.source.loans.forEach(row => { row.fund = 'Caja de Ahorro'; });
    Object.assign(fixture.source.requests[0], { fund: 'Caja de Ahorro', total: '1200', principal: '1000', term: '2',
      receipt: { id: 900001, identity: '899999', sourceHash: 'b'.repeat(64) } });
    assert.equal(balance(calculate(fixture), 'savings').pending_amount, 1200);
    assert.deepEqual(calculate(fixture).represented_request_ids, []);
  });
  check('future blank-state canonical loan replaces its reservation with full amortization debt', () => {
    const fixture = linkRequest(futureBlank(), { approved_at: '2026-10-27T12:00:00Z' });
    assert.equal(balance(calculate(fixture)).pending_amount, 1200);
    assert.deepEqual(calculate(fixture).represented_request_ids, ['request-900001']);
  });
  const invalidBlankCases = [
    ['no source request', fixture => { fixture.source.requests = []; }],
    ['source not initiated', fixture => { fixture.source.requests[0].status = 'Pendiente'; }],
    ['past installment', fixture => { fixture.source.loans[0].date = '2026-10-15'; }],
    ['installment due today', fixture => { fixture.source.loans[0].date = '2026-10-27'; }],
    ['mixed blank and recognized states', fixture => { fixture.source.loans[1].status = 'AL CORRIENTE'; }],
    ['null status', fixture => { fixture.source.loans.forEach(row => { row.status = null; }); }],
    ['future authorization', fixture => { fixture.source.loans.forEach(row => { row.authorized = '2026-10-28'; }); }],
    ['absent authorization', fixture => { fixture.source.loans.forEach(row => { row.authorized = null; }); }],
    ['different source total', fixture => { fixture.source.requests[0].total = 1300; }],
    ['different source principal', fixture => { fixture.source.requests[0].principal = 1100; }],
    ['different source term', fixture => { fixture.source.requests[0].term = 3; }],
    ['different source authorization date', fixture => { fixture.source.requests[0].date = '2026-10-26'; }],
    ['invalid future amount', fixture => { fixture.source.loans[0].amount = null; }],
  ];
  for (const [label, change] of invalidBlankCases) {
    check('blank-state exception rejects ' + label, () => {
      const fixture = futureBlank(); change(fixture); assertDataReview(fixture);
    });
  }
  check('capacity projection preserves original history, obligations and schedules', () => {
    const fixture = addLoan(membership(), '900002');
    const context = { folio: identity.numero_control, requests: fixture.runtime.requests };
    const history = projectHistory(fixture.source, context, now);
    const before = structuredClone(fixture);
    calculate(fixture);
    assert.deepEqual(projectHistory(fixture.source, context, now), history);
    assert.deepEqual(fixture, before);
    assert.equal(history.entries.length, 2);
    assert.equal(history.entries.reduce((total, loan) => total + loan.schedule.length, 0), 4);
  });

  const failures = checks.filter(check => check.status === 'FAIL');
  console.log(JSON.stringify({ status: failures.length ? 'FAIL' : 'PASS',
    scope: 'Synthetic focused loan historical resolution contracts',
    productionReads: 0, productionWrites: 0, historicalRowsModified: 0,
    passed: checks.length - failures.length, failed: failures.length, checks }, null, 2));
  if (failures.length) process.exitCode = 1;
}

main().catch(error => { console.error(error); process.exitCode = 1; });
