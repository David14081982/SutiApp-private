/** Isolated PV2 preview. All amounts, including B/Z/AB/AC/AD, are integer cents.
 * No I/O, clock, persistence, triggers, credentials or production write adapter.
 * Research contracts and explicit capture provenance are mandatory inputs.
 */
export const MODE = 'ISOLATED_PREVIEW_ONLY';
export const GENERAL_TARIFF_START = '2026-03-30';
const EVIDENCE = new Set(['original_document_reconstruction', 'explicit_approved_snapshot']);
const STATES = new Set(['CONFIRMED', 'SCHEDULED', 'UNKNOWN']);
function fail(code) { throw new Error(code); }
function integer(n, code = 'INVALID_CENTS') {
  if (!Number.isSafeInteger(n) || n < 0) fail(code);
  return n;
}
function identity(value) {
  if (typeof value !== 'string' || !value || value !== value.trim()) fail('INVALID_IDENTITY');
  return value; // Preserve text and leading zeros; never resolve by numeric coercion.
}
export function loanKey(C, D) { return JSON.stringify([identity(C), identity(D)]); }
function roundedRatio(a, b, denominator) {
  if (!denominator) return 0;
  return Number((BigInt(a) * BigInt(b) * 2n + BigInt(denominator)) / (2n * BigInt(denominator)));
}
function sum(values) {
  const result = values.reduce((a, b) => a + BigInt(b), 0n);
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) fail('AMOUNT_OVERFLOW');
  return Number(result);
}
const zero = () => ({ B: 0, Z: 0, AB: 0, AC: 0, AD: 0 });

export function validateContract(contract) {
  if (!contract || contract.tariff === null || contract.tariff === undefined) fail('TARIFF_UNKNOWN');
  loanKey(contract.C, contract.D);
  if (![0, 1000, 1500].includes(contract.tariff)) fail('UNSUPPORTED_TARIFF');
  if (!EVIDENCE.has(contract.evidence?.kind) || !contract.evidence?.reference) fail('CONTRACT_EVIDENCE_REQUIRED');
  for (const field of ['principal', 'interest', 'administration', 'total']) integer(contract[field]);
  if (!contract.total || sum([contract.principal, contract.interest, contract.administration]) !== contract.total) fail('CONTRACT_TOTAL_MISMATCH');
  if (!Array.isArray(contract.schedule) || !contract.schedule.length) fail('CONTRACT_SCHEDULE_REQUIRED');
  let previous = 0;
  const schedule = contract.schedule.map(s => {
    if (!Number.isSafeInteger(s.S) || s.S !== ++previous) fail('CONTRACT_INSTALLMENT_IDENTITY');
    integer(s.amount); integer(s.adminUnits, 'ADMIN_PERIODS_REQUIRED');
    const product = BigInt(contract.tariff) * BigInt(s.adminUnits);
    if (product > BigInt(Number.MAX_SAFE_INTEGER)) fail('AMOUNT_OVERFLOW');
    const administration = Number(product);
    if (!s.amount || administration > s.amount) fail('INVALID_INSTALLMENT');
    return { S: s.S, amount: s.amount, administration };
  });
  if (sum(schedule.map(s => s.amount)) !== contract.total || sum(schedule.map(s => s.administration)) !== contract.administration) fail('SCHEDULE_TOTAL_MISMATCH');
  // Allocate original interest across the ORIGINAL schedule, never from mutable B.
  // Cumulative rounding guarantees exact contractual totals, including final cents.
  let cumulativeNet = 0, previousInterest = 0;
  return schedule.map(s => {
    const net = s.amount - s.administration;
    cumulativeNet += net;
    const cumulativeInterest = roundedRatio(cumulativeNet, contract.interest, contract.principal + contract.interest);
    const interest = cumulativeInterest - previousInterest;
    previousInterest = cumulativeInterest;
    return { ...s, interest, principal: net - interest };
  });
}

/** Recompute from current values. No new transaction is created for an edit.
 * correction.origin must be FINANCE. Engine-origin edits are never new receipts.
 * Rows from other loans are ignored and never returned as proposed changes.
 */
export function previewCorrection({ contract, rows, correction = null }) {
  const original = validateContract(contract);
  if (!Array.isArray(rows)) fail('ROWS_REQUIRED');
  const key = loanKey(contract.C, contract.D);
  if (correction && (loanKey(correction.C, correction.D) !== key || correction.origin !== 'FINANCE')) fail('CORRECTION_NOT_FINANCE_OR_WRONG_LOAN');
  const selected = rows.filter(r => r.C === contract.C && r.D === contract.D).map(r => ({ ...r }));
  const seen = new Set();
  for (const row of selected) {
    if (!Number.isSafeInteger(row.S) || row.S < 1 || row.S > original.length || seen.has(row.S)) fail('DUPLICATE_OR_INVALID_CDS');
    seen.add(row.S);
    if (!STATES.has(row.capture)) fail('CAPTURE_PROVENANCE_REQUIRED');
    if (correction?.S === row.S) {
      row.B = integer(correction.B); row.capture = 'CONFIRMED';
    }
    if (row.capture === 'UNKNOWN') fail('CAPTURE_PROVENANCE_UNKNOWN');
    integer(row.B);
  }
  if (selected.length !== original.length || (correction && !seen.has(correction.S))) fail('INCOMPLETE_CDS_SCHEDULE');
  selected.sort((a, b) => a.S - b.S);
  const states = original.map(s => ({ ...s, applied: 0, recovered: zero() }));
  const payments = [];
  for (const row of selected) {
    if (row.capture !== 'CONFIRMED') continue;
    let remaining = row.B;
    const result = { C: row.C, D: row.D, S: row.S, ...zero(), B: row.B, allocations: [] };
    for (const period of states) {
      if (!remaining) break;
      const amount = Math.min(remaining, period.amount - period.applied);
      if (!amount) continue;
      // FIFO across obligations, including arrears, partial and advance coverage.
      const applied = period.applied + amount;
      const Z = Math.min(applied, period.administration);
      const AC = applied - Z;
      const AB = roundedRatio(AC, period.interest, period.principal + period.interest);
      const AD = AC - AB;
      const allocation = { S: period.S, B: amount, Z: Z - period.recovered.Z, AB: AB - period.recovered.AB, AC: AC - period.recovered.AC, AD: AD - period.recovered.AD };
      for (const column of ['Z', 'AB', 'AC', 'AD']) result[column] += allocation[column];
      result.allocations.push(allocation);
      period.applied = applied;
      period.recovered = { B: applied, Z, AB, AC, AD };
      remaining -= amount;
    }
    // Do not silently forgive, create a credit or alter original totals.
    if (remaining) fail('PAYMENTS_EXCEED_CONTRACT');
    if (result.B !== result.Z + result.AB + result.AD || result.AC !== result.AB + result.AD) fail('UNBALANCED_PAYMENT');
    payments.push(result);
  }
  const recovered = Object.fromEntries(['B', 'Z', 'AB', 'AC', 'AD'].map(k => [k, sum(payments.map(p => p[k]))]));
  const pending = {
    total: contract.total - recovered.B,
    principal: contract.principal - recovered.AD,
    interest: contract.interest - recovered.AB,
    administration: contract.administration - recovered.Z,
  };
  if (Object.values(pending).some(n => n < 0) || pending.total !== pending.principal + pending.interest + pending.administration) fail('CONSERVATION_FAILED');
  const schedule = states.map(s => ({
    S: s.S, original: s.amount, applied: s.applied, pending: s.amount - s.applied,
    status: s.applied === s.amount ? 'COVERED' : s.applied ? 'PARTIAL' : 'PENDING',
    administrationOriginal: s.administration, administrationRecovered: s.recovered.Z,
    principalPending: s.principal - s.recovered.AD, interestPending: s.interest - s.recovered.AB,
  }));
  const paymentMap = new Map(payments.map(p => [p.S, p]));
  const cutoff = Math.max(0, ...payments.map(p => p.S));
  // Past/recorded rows keep the captured value. Show their unpaid obligations in
  // the next FUTURE collection forecast, without changing original due periods.
  let carry = sum(schedule.filter(s => s.S <= cutoff).map(s => s.pending));
  const forecast = new Map();
  for (const row of selected) {
    if (row.capture === 'SCHEDULED' && row.S > cutoff) {
      forecast.set(row.S, sum([carry, schedule[row.S - 1].pending]));
      carry = 0;
    }
  }
  const rowPreview = selected.map(row => {
    const recorded = row.capture === 'CONFIRMED';
    const applied = paymentMap.get(row.S);
    const due = schedule[row.S - 1].pending;
    // B in a scheduled row is forecast, never cash. Null recovery columns are
    // deliberate: B=Z+AB+AD applies to recorded payments, not future forecasts.
    return { C: row.C, D: row.D, S: row.S, recorded, capture: row.capture,
      sourceB: row.B, B: recorded ? row.B : forecast.get(row.S) ?? row.B,
      Z: applied?.Z ?? null, AB: applied?.AB ?? null, AC: applied?.AC ?? null, AD: applied?.AD ?? null,
      futureBChanged: forecast.has(row.S) && row.B !== forecast.get(row.S),
      pending: due,
    };
  });
  if (sum([...forecast.values(), carry]) !== pending.total) fail('FORECAST_CONSERVATION_FAILED');
  return { mode: MODE, key, writeAllowed: false, payments, recovered, pending, schedule, rowPreview,
    unassignedPending: carry,
    forecast: [...forecast].map(([S, B]) => ({ C: contract.C, D: contract.D, S, B, capture: 'SCHEDULED' })),
    futureB: rowPreview.filter(r => r.futureBChanged).map(r => ({ C: r.C, D: r.D, S: r.S, before: r.sourceB, after: r.B, capture: 'SCHEDULED' })),
  };
}

export function contractFromClassification(classification, C, D) {
  const matches = classification.filter(c => c.C === C && c.D === D);
  if (matches.length !== 1) fail('CLASSIFICATION_IDENTITY_UNRESOLVED');
  validateContract(matches[0]);
  return structuredClone(matches[0]);
}

/** Fixed safety boundary; no parameter can authorize writes in this module. */
export function productionCompatibility() {
  return { status: 'FAIL', writeAllowed: false, reasons: [
    'LEGACY_AB_AC_AA_Z_AD_OVERWRITE_RECOVERY_COLUMNS',
    'B_SCHEDULED_VS_RECORDED_PROVENANCE_NOT_CERTIFIED',
    'LEGACY_READERS_USE_EXISTING_COLUMN_MEANINGS',
  ] };
}
