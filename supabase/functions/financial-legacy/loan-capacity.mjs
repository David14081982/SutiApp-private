// Derived borrowing capacity. The existing history projector owns installment
// dates/amounts; this module never writes Google or changes financial formulas.
import { projectHistory, businessDay } from '../loan-history/history.mjs';
import { historicalObligation, NON_LOAN_PROGRAM_IDS, normalizeObligationName } from './historical-obligation-map.mjs';

const normalized = normalizeObligationName;
const fail = code => { throw Error('LOAN_CAPACITY_' + code); };
const review = (code, reason, loan) => {
  const error = Error(code);
  error.reason = reason;
  error.obligation_id = loan.id;
  throw error;
};
const mappingReview = (reason, loan) => review('HISTORICAL_LOAN_MAPPING_REQUIRED', reason, loan);
const dataReview = (reason, loan) => review('HISTORICAL_LOAN_DATA_REVIEW_REQUIRED', reason, loan);
export const publicLoanCapacityError = error =>
  ['HISTORICAL_LOAN_MAPPING_REQUIRED', 'HISTORICAL_LOAN_DATA_REVIEW_REQUIRED'].includes(error?.message)
    ? error.message : 'LOAN_CAPACITY_UNAVAILABLE';
const cents = value => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1e12) fail('AMOUNT_INVALID');
  return Math.round((value + Number.EPSILON) * 100);
};

export function projectLoanCapacity(source, runtime, now, identity, observe = () => {}) {
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
  const bySr = new Map(runtime.requests.map(request => [request.folio, request]));
  const classifiedRequests = new Set();
  const sourceRequests = new Map(), sourceRows = new Map();
  for (const row of source.requests) {
    if (!sourceRequests.has(row.id)) sourceRequests.set(row.id, []);
    sourceRequests.get(row.id).push(row);
  }
  for (const row of source.loans) {
    if (!sourceRows.has(row.id)) sourceRows.set(row.id, []);
    sourceRows.get(row.id).push(row);
  }
  // projectHistory already validates owner, unique SRs and transfer receipts.
  // Recover nonfinancial canonical links it intentionally omits from loan cards.
  const classify = loan => {
    const rows = sourceRequests.get(loan.id) || [];
    const sr = rows[0]?.receipt?.identity || (/^SR-/.test(loan.id) ? loan.id : null);
    const canonical = requests.get(loan.sourceId) || bySr.get(sr);
    const named = byName.get(normalized(loan.fund));
    const crossProgram = (programId, evidence, historicalValue) => {
      if (named?.size) mappingReview('PROGRAM_FUND_CONFLICT', loan);
      for (const row of rows) {
        if (byName.has(normalized(row.fund))) mappingReview('PROGRAM_FUND_CONFLICT', loan);
        const classification = historicalObligation(row.fund);
        if (rows.length > 1 && !classification) mappingReview('PROGRAM_SOURCE_AMBIGUOUS', loan);
        if (classification && classification.program_classification !== programId)
          mappingReview('PROGRAM_SOURCE_CONFLICT', loan);
      }
      return { classification: 'CROSS_PROGRAM', program_id: programId, evidence,
        ...(historicalValue ? { historical_value: historicalValue } : {}) };
    };
    if (canonical) {
      if (classifiedRequests.has(canonical.id)) fail('REQUEST_IDENTITY_AMBIGUOUS');
      classifiedRequests.add(canonical.id);
      if (rows.length !== 1) mappingReview('CANONICAL_SOURCE_AMBIGUOUS', loan);
      if (canonical.financial === false && NON_LOAN_PROGRAM_IDS.includes(canonical.program_id) &&
          !canonical.criterion_identity && canonical.status === 'approved') {
        return crossProgram(canonical.program_id, 'program_request:' + canonical.id);
      }
      const candidates = ruleFunds.get(canonical.criterion_identity);
      if (canonical.program_id === 'membership' || canonical.financial !== true || candidates?.size !== 1)
        mappingReview('CANONICAL_CONTRACT_UNRESOLVED', loan);
      // Includes product financing explicitly contracted to a real fund. The
      // commercial program is preserved; this is not a label-based conversion.
      return { classification: 'LOAN_CANONICAL', program_id: canonical.program_id,
        fund_id: [...candidates][0], evidence: 'program_request:' + canonical.id };
    }
    if (sr && /^SR-/.test(sr)) mappingReview('CANONICAL_REQUEST_MISSING', loan);
    const historical = historicalObligation(loan.fund);
    if (historical) {
      return crossProgram(historical.program_classification, historical.evidence, historical.historical_value);
    }
    if (named?.size === 1) return { classification: 'LOAN_LEGACY_RESOLVABLE', fund_id: [...named][0],
      evidence: 'Exact current financial_funds.name; no canonical request relationship.' };
    return { classification: 'AMBIGUOUS', evidence: 'No unique canonical relationship or proven historical mapping.' };
  };
  const today = businessDay(now);
  const represented = new Set();
  for (const loan of history.entries) {
    if (loan.kind !== 'loan' || !loan.schedule.length) continue;
    const classification = classify(loan);
    observe({ obligation_id: loan.id, ...classification });
    if (classification.classification === 'CROSS_PROGRAM') continue;
    if (loan.sourceId) {
      if (represented.has(loan.sourceId)) fail('REQUEST_IDENTITY_AMBIGUOUS');
      represented.add(loan.sourceId);
    }
    const state = normalized(loan.status);
    const rows = sourceRows.get(loan.id) || [], origins = sourceRequests.get(loan.id) || [];
    // Newly started loans may have no payroll status before their first quota.
    // Keep the supplied K total and paidThrough calculation; never synthesize a
    // paid/current status or replace missing amounts with zero.
    const awaitingFirstQuota = state === '' && loan.status !== null && rows.length > 0 &&
      rows.every(row => normalized(row.status) === '' && row.authorized === loan.date) &&
      loan.date <= today && origins.length === 1 && normalized(origins[0].status) === 'INICIADO' &&
      origins[0].date === loan.date && Number(origins[0].term) === loan.term &&
      normalized(origins[0].fund) === normalized(loan.fund) &&
      String(origins[0].total ?? '').trim() !== '' && String(origins[0].principal ?? '').trim() !== '' &&
      Number(origins[0].total) === loan.total && Number(origins[0].principal) === loan.principal &&
      loan.paid_to_date === 0 && loan.schedule.every(row => row.date && row.date > today && row.state === 'Pendiente');
    if (!['AL CORRIENTE', 'SALDO ATRASADO', 'LIQUIDADO', 'PAGO DE MAS'].includes(state) && !awaitingFirstQuota)
      dataReview('LOAN_STATUS_UNRESOLVED', loan);
    const installmentKeys = new Set();
    for (const installment of loan.schedule) {
      if (!installment.date || !['Pagada', 'Pendiente', 'No se descontó'].includes(installment.state)) dataReview('INSTALLMENT_UNRESOLVED', loan);
      // Distinct source rows may legitimately share date, number and amount.
      const key = installment.source_row;
      if (!Number.isInteger(key) || key < 2) dataReview('INSTALLMENT_UNRESOLVED', loan);
      if (installmentKeys.has(key)) dataReview('INSTALLMENT_DUPLICATE', loan);
      installmentKeys.add(key);
      try { cents(installment.amount); } catch { dataReview('AMOUNT_INVALID', loan); }
    }
    // Identical to Amortización's balance: K minus paidThrough(A/B). A past
    // zero deduction cannot release capacity; do not round individual quotas.
    try { cents(loan.total); cents(loan.paid_to_date); } catch { dataReview('AMOUNT_INVALID', loan); }
    const pending = cents(Math.max(0, loan.total - loan.paid_to_date));
    if (pending === 0) continue;
    if (!classification.fund_id) mappingReview('FUND_UNRESOLVED', loan);
    const fund = funds.get(classification.fund_id);
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
