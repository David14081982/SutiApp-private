// Derived borrowing capacity. The existing history projector owns installment
// dates/amounts; this module never writes Google or changes financial formulas.
import { projectHistory, businessDay } from '../loan-history/history.mjs';

const normalized = value => String(value ?? '').trim().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').toUpperCase();
const fail = code => { throw Error('LOAN_CAPACITY_' + code); };
const cents = value => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1e12) fail('AMOUNT_INVALID');
  return Math.round((value + Number.EPSILON) * 100);
};

export function projectLoanCapacity(source, runtime, now, identity) {
  if (!identity?.affiliate_id || !identity.numero_control || source?.folio !== identity.numero_control ||
      !Array.isArray(runtime?.funds) || !Array.isArray(runtime.rules) || !Array.isArray(runtime.requests)) fail('CONTEXT_INVALID');
  const funds = new Map(), byName = new Map(), ruleFunds = new Map(), requests = new Map();
  for (const fund of runtime.funds) {
    if (!fund.id || funds.has(fund.id) || !normalized(fund.name)) fail('FUND_INVALID');
    funds.set(fund.id, { fund_id: fund.id, pending_amount: 0, active_loans: 0 });
    const name = normalized(fund.name);
    if (!byName.has(name)) byName.set(name, new Set());
    byName.get(name).add(fund.id);
  }
  for (const rule of runtime.rules) {
    if (!funds.has(rule.fund_id)) fail('FUND_INVALID');
    if (rule.criterion_identity) {
      if (!ruleFunds.has(rule.criterion_identity)) ruleFunds.set(rule.criterion_identity, new Set());
      ruleFunds.get(rule.criterion_identity).add(rule.fund_id);
    }
  }
  for (const request of runtime.requests) {
    if (!request.id || requests.has(request.id)) fail('REQUEST_IDENTITY_INVALID');
    requests.set(request.id, request);
  }
  const history = projectHistory(source, { folio: identity.numero_control, requests: runtime.requests }, now);
  const represented = new Set();
  for (const loan of history.entries) {
    if (loan.kind !== 'loan' || !loan.schedule.length) continue;
    if (loan.sourceId) {
      if (represented.has(loan.sourceId)) fail('REQUEST_IDENTITY_AMBIGUOUS');
      represented.add(loan.sourceId);
    }
    const state = normalized(loan.status);
    if (!['AL CORRIENTE', 'SALDO ATRASADO', 'LIQUIDADO', 'PAGO DE MAS'].includes(state)) fail('LOAN_STATUS_UNRESOLVED');
    const installmentKeys = new Set();
    for (const installment of loan.schedule) {
      if (!installment.date || !['Pagada', 'Pendiente', 'No se descontó'].includes(installment.state)) fail('INSTALLMENT_UNRESOLVED');
      // Distinct source rows may legitimately share date, number and amount.
      const key = installment.source_row;
      if (!Number.isInteger(key) || key < 2) fail('INSTALLMENT_UNRESOLVED');
      if (installmentKeys.has(key)) fail('INSTALLMENT_DUPLICATE');
      installmentKeys.add(key);
      cents(installment.amount);
    }
    // Identical to Amortización's balance: K minus paidThrough(A/B). A past
    // zero deduction cannot release capacity; do not round individual quotas.
    cents(loan.total); cents(loan.paid_to_date);
    const pending = cents(Math.max(0, loan.total - loan.paid_to_date));
    if (pending === 0) continue;
    const request = requests.get(loan.sourceId);
    const candidates = request
      ? ruleFunds.get(request.criterion_identity)
      : byName.get(normalized(loan.fund));
    if (!candidates || candidates.size !== 1) fail('FUND_UNRESOLVED');
    const fund = funds.get([...candidates][0]);
    fund.active_loans++;
    fund.pending_amount = (cents(fund.pending_amount) + pending) / 100;
  }
  return { version: 1, affiliate_id: identity.affiliate_id, numero_control: identity.numero_control,
    observed_at: now, business_day: businessDay(now), funds: [...funds.values()],
    represented_request_ids: [...represented].sort() };
}

export function applyLoanCapacity(overview, resolved) {
  if (!Array.isArray(overview?.programs) || !Array.isArray(resolved?.funds)) fail('RESPONSE_INVALID');
  const byRule = new Map();
  for (const row of resolved.funds) {
    if (!row.rule_id || byRule.has(row.rule_id)) fail('RESPONSE_INVALID');
    cents(row.available_amount); cents(row.max_amount); cents(row.pending_amount); cents(row.reserved_amount);
    if (row.available_amount > row.max_amount) fail('RESPONSE_INVALID');
    byRule.set(row.rule_id, row);
  }
  const decorate = program => {
    const capacity = byRule.get(program.rule_id);
    if (!capacity || capacity.max_amount !== program.max_amount) fail('RESPONSE_INVALID');
    return { ...program, available_amount: capacity.available_amount,
      suggested_amount: Math.min(program.suggested_amount, capacity.available_amount),
      pending_amount: capacity.pending_amount, reserved_amount: capacity.reserved_amount,
      active_loans: capacity.active_loans, capacity_exemption: capacity.exemption,
      capacity_observed_at: resolved.observed_at };
  };
  const programs = overview.programs.map(decorate);
  return { ...overview, programs, available_funds: programs,
    available_credit: programs.reduce((sum, p) => sum + cents(p.available_amount), 0) / 100,
    capacity_observed_at: resolved.observed_at, capacity_business_day: resolved.business_day,
    capacity_policy_version: resolved.policy_version,
    capacity_source_version: resolved.source_version,
    capacity_source_updated_at: resolved.source_updated_at };
}
