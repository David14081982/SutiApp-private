// Derived analysis of the sole Google authority, with no cash-date or allocation
// assumptions. A reconciled scheduled charge is not an independent bank receipt.
const normalize = value => String(value ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
const cents = value => Math.round((value + Number.EPSILON) * 100);
const amount = value => value / 100;
const numeric = value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1e12 ? value : null;
const statusValues = new Set(['LIQUIDADO','PAGO DE MAS','LIQUIDADO O PAGO DE MAS','AL CORRIENTE','SALDO ATRASADO']);
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(value+'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === value ? value : null;
}
const exactText = value => typeof value === 'string' && value.length > 0 && value === value.trim();
const emptyTotals = () => ({recorded_paid:0,reconciled_paid:0,unallocated_paid:0,reconciled_capital:0,reconciled_interest:0,reconciled_admin_fee:0,projected_interest:0,projected_admin_fee:0,projected_capital:0,expected:0,rows:0,unresolved_rows:0});
const moneyKeys = Object.keys(emptyTotals()).filter(key => !['rows','unresolved_rows'].includes(key));

// All equalities tolerate at most half a cent per original scheduled installment,
// plus one cent for the comparison. This handles 370/12 without hiding $1 errors.
function componentContract(row) {
  const required = ['paid','expected','term','principal','total_due','loan_charges','scheduled_charges','scheduled_admin_fee','admin_fee_total','interest_total','principal_interest_total','scheduled_capital'];
  if (required.some(key => numeric(row[key]) === null)) return {reason:'MISSING_OR_INVALID_COMPONENT'};
  if (!Number.isInteger(row.term) || row.term < 1 || row.term > 1000) return {reason:'INVALID_TERM'};
  if (required.some(key => row[key] < 0)) return {reason:'NEGATIVE_COMPONENT'};
  const near = (a,b,tolerance = 0.010001) => Math.abs(a-b) <= tolerance;
  const installmentTolerance = row.term * 0.005 + 0.010001;
  if (!near(row.total_due,row.principal+row.loan_charges) || !near(row.loan_charges,row.interest_total+row.admin_fee_total) ||
      !near(row.principal_interest_total,row.principal+row.interest_total) ||
      !near(row.scheduled_charges*row.term,row.loan_charges,installmentTolerance) ||
      !near(row.scheduled_admin_fee*row.term,row.admin_fee_total,installmentTolerance) ||
      !near(row.scheduled_capital+row.scheduled_charges,row.expected) ||
      !near(row.expected*row.term,row.total_due,installmentTolerance) ||
      row.scheduled_admin_fee > row.scheduled_charges + 0.010001) return {reason:'COMPONENTS_DO_NOT_RECONCILE'};
  const principal = cents(row.scheduled_capital), fee = cents(row.scheduled_admin_fee);
  // N includes Z. Allocate rounding remainder within the validated interest
  // component so each displayed row conserves its exact original payment cents.
  const interest = cents(row.expected)-principal-fee;
  if (interest < 0 || Math.abs(interest-cents(row.scheduled_charges-row.scheduled_admin_fee)) > 1) return {reason:'COMPONENTS_DO_NOT_RECONCILE'};
  return {principal,fee,interest};
}

export function analyzeSicofLoans(source, options = {}) {
  if (!source || !Array.isArray(source.rows) || source.date_semantics !== 'AMORTIZATION_DATE_NOT_RECEIPT_DATE') throw Error('SICOF_LOAN_SOURCE_INVALID');
  const asOf = date(options.as_of || new Date().toISOString().slice(0,10)), from = date(options.from || '1900-01-01'), to = date(options.to || asOf);
  if (!asOf || !from || !to || from > to || (options.funds !== undefined && (!Array.isArray(options.funds) || options.funds.some(f => !exactText(f))))) throw Error('SICOF_LOAN_FILTER_INVALID');
  const fundFilter = options.funds ? new Set(options.funds) : null;
  const issues = [], prepared = [], groups = new Map(), duplicates = new Map();
  const issue = (row,code) => { if (!row.issues.includes(code)) {row.issues.push(code);issues.push({source_row:row.raw.source_row,loan_id:row.raw.loan_id,folio:row.raw.folio,code});} };
  for (const raw of source.rows) {
    // An invalid/unknown fund cannot be silently hidden by a fund selector.
    if (fundFilter && exactText(raw.fund) && !fundFilter.has(raw.fund)) continue;
    const row = {raw, date:date(raw.date), paid:numeric(raw.paid), expected:numeric(raw.expected), issues:[]};
    prepared.push(row);
    if (!exactText(raw.folio) || !exactText(raw.loan_id) || !exactText(raw.fund)) issue(row,'EXACT_IDENTITY_OR_FUND_REQUIRED');
    if (!row.date) issue(row,'INVALID_AMORTIZATION_DATE');
    if (row.paid === null || row.paid < 0) issue(row,'INVALID_RECORDED_PAYMENT');
    if (row.expected === null || row.expected < 0) issue(row,'INVALID_EXPECTED_PAYMENT');
    if (['paid_to_date','expected_to_date'].some(key=>numeric(raw[key])===null||raw[key]<0)) issue(row,'INVALID_CURRENT_AGGREGATE');
    if (!statusValues.has(normalize(raw.status))) issue(row,'INVALID_CURRENT_STATUS');
    const key = JSON.stringify([raw.folio,raw.loan_id]);
    if (!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(row);
    if (row.date) {
      const duplicateKey = JSON.stringify([raw.folio,raw.loan_id,row.date]);
      if (!duplicates.has(duplicateKey)) duplicates.set(duplicateKey,[]);
      duplicates.get(duplicateKey).push(row);
    }
  }
  for (const rows of duplicates.values()) if (rows.length > 1) rows.forEach(row => issue(row,'AMBIGUOUS_LOAN_DATE_ROWS'));
  const headerKeys = ['fund','status','principal','total_due','term','loan_charges','admin_fee_total','interest_total','principal_interest_total','paid_to_date','expected_to_date',
    'process','rate','discount_start','discount_end','transfer_date','discount_date','request_date'];
  for (const rows of groups.values()) if (headerKeys.some(key => rows.some(row => (key==='status'?normalize(row.raw[key]):row.raw[key]) !== (key==='status'?normalize(rows[0].raw[key]):rows[0].raw[key])))) rows.forEach(row => issue(row,'INCONSISTENT_LOAN_HEADER'));

  const totals = emptyTotals(), funds = new Map(), payments = [];
  for (const row of prepared) {
    const raw = row.raw, inRange = !row.date || (row.date >= from && row.date <= to);
    // Keep whole-loan context for behavior, but range limits every financial total.
    const future = row.date ? row.date > asOf : null;
    const components = componentContract(raw);
    if (components.reason) issue(row,components.reason);
    const validPaid = row.paid !== null && row.paid >= 0;
    const duplicate = row.issues.includes('AMBIGUOUS_LOAN_DATE_ROWS');
    let recognized = false;
    if (!row.issues.length && validPaid && row.paid > 0) {
      if (future) issue(row,'PAYMENT_ON_FUTURE_AMORTIZATION_DATE');
      else if (cents(row.paid) !== cents(row.expected)) issue(row,row.paid < row.expected ? 'PARTIAL_PAYMENT_ALLOCATION_REQUIRED' : 'OVERPAYMENT_ALLOCATION_REQUIRED');
      else recognized = true;
    }
    const projected = !row.issues.length && future && row.paid === 0;
    const noPayment = !row.issues.length && !future && row.paid === 0;
    const kind = recognized ? 'RECONCILED_SOURCE_PAYMENT' : projected ? 'PROJECTED' : noPayment ? 'NO_RECORDED_PAYMENT' : 'REVIEW_REQUIRED';
    const payment = {source_row:raw.source_row,date:row.date,date_semantics:source.date_semantics,folio:raw.folio,loan_id:raw.loan_id,name:raw.name,fund:raw.fund,
      paid:validPaid ? row.paid : null,expected:row.expected,capital:recognized ? amount(components.principal) : noPayment ? 0 : null,
      interest:recognized ? amount(components.interest) : noPayment ? 0 : null,fee:recognized ? amount(components.fee) : noPayment ? 0 : null,
      projected_capital:projected ? amount(components.principal) : null,projected_interest:projected ? amount(components.interest) : null,projected_fee:projected ? amount(components.fee) : null,
      audit:kind,issues:row.issues.slice(),future,in_period:inRange};
    row.payment = payment;
    if (!inRange) continue;
    payments.push(payment);
    const fundKey = exactText(raw.fund) ? raw.fund : '(SOURCE_FUND_UNRESOLVED)';
    if (!funds.has(fundKey)) funds.set(fundKey,emptyTotals());
    for (const total of [totals,funds.get(fundKey)]) {
      total.rows++;
      if (row.issues.length) total.unresolved_rows++;
      // Neither of two ambiguous duplicate rows can be selected as the truth.
      if (validPaid && !duplicate) total.recorded_paid += cents(row.paid);
      if (row.expected !== null && row.expected >= 0 && !duplicate) total.expected += cents(row.expected);
      if (recognized) {
        total.reconciled_paid += cents(row.paid);total.reconciled_capital += components.principal;
        total.reconciled_interest += components.interest;total.reconciled_admin_fee += components.fee;
      } else if (validPaid && !duplicate) total.unallocated_paid += cents(row.paid);
      if (projected) {total.projected_interest+=components.interest;total.projected_admin_fee+=components.fee;total.projected_capital+=components.principal;}
    }
  }
  const convert = total => Object.fromEntries(Object.entries(total).map(([key,value]) => [key,moneyKeys.includes(key)?amount(value):value]));
  const loans = [...groups.values()].map(rows => {
    const raw = rows[0].raw, distinct = key => new Set(rows.map(r=>r.raw[key])).size===1 && numeric(raw[key])!==null && raw[key]>=0 ? numeric(raw[key]) : null;
    const uniform = key => new Set(rows.map(r=>r.raw[key])).size===1 ? raw[key]??null : null;
    const metadataIssues=headerKeys.filter(key=>new Set(rows.map(r=>key==='status'?normalize(r.raw[key]):r.raw[key])).size>1).map(field=>({field,code:'INCONSISTENT_LOAN_METADATA'}));
    const paid = distinct('paid_to_date'), expected = distinct('expected_to_date');
    const currentStatus = rows.every(r => normalize(r.raw.status) === normalize(raw.status)) && statusValues.has(normalize(raw.status)) ? normalize(raw.status) : null;
    const review = rows.some(row=>row.issues.some(code=>!['PARTIAL_PAYMENT_ALLOCATION_REQUIRED','OVERPAYMENT_ALLOCATION_REQUIRED','PAYMENT_ON_FUTURE_AMORTIZATION_DATE'].includes(code)));
    return {id:raw.loan_id,folio:raw.folio,name:raw.name,fund:uniform('fund'),capital:distinct('principal'),total:distinct('total_due'),paid,expected,
      process:uniform('process'),rate:distinct('rate'),rate_percent:distinct('rate')==null?null:distinct('rate')*100,term:distinct('term'),
      admin_fee_total:distinct('admin_fee_total'),interest_total:distinct('interest_total'),loan_charges:distinct('loan_charges'),principal_interest_total:distinct('principal_interest_total'),
      discount_start:date(uniform('discount_start')),discount_end:date(uniform('discount_end')),transfer_date:date(uniform('transfer_date')),
      discount_date:date(uniform('discount_date')),request_date:date(uniform('request_date')),metadata_issues:metadataIssues,
      arrears:paid!==null && expected!==null ? Math.max(0,amount(cents(expected)-cents(paid))) : null,status:currentStatus,
      behavior:review || !currentStatus ? 'REVIEW_REQUIRED' : currentStatus==='SALDO ATRASADO' ? 'OVERDUE' : 'CURRENT',
      punctuality_score:null,score_reason:'ORIGINAL_DUE_AND_RECEIPT_DATES_UNAVAILABLE',
      schedule:rows.map(r=>r.payment).sort((a,b)=>String(a.date).localeCompare(String(b.date)) || a.source_row-b.source_row)};
  });
  const blockedReasons = [...new Set(payments.flatMap(row=>row.issues))];
  return {contract_version:'SICOF_LOAN_ANALYSIS_V1',source:source.source,source_fingerprint:source.source_fingerprint,observed_at:source.observed_at,
    date_semantics:source.date_semantics,period:{from,to,as_of:asOf},loans,payments,funds:[...funds].map(([fund,total])=>({fund,...convert(total)})),
    totals:{...convert(totals),complete:totals.unresolved_rows===0},issues,
    certification:{status:totals.unresolved_rows ? 'REVIEW_REQUIRED' : 'RECONCILED_SOURCE_AMOUNTS',blocked_reasons:blockedReasons,
      receipt_date_verified:false,scope:'SOURCE_AMORTIZATION_PERIOD',can_certify_cash_income:false}};
}
