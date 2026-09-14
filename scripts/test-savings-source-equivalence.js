'use strict';

// Read-only evidence. Source captures stay private in ignored tmp; no network or writes.
const fs = require('fs');
const crypto = require('crypto');
const assert = require('assert/strict');

const col = name => [...name].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
const label = index => {
  let n = index + 1, out = '';
  while (n) { n--; out = String.fromCharCode(65 + n % 26) + out; n = Math.floor(n / 26); }
  return out;
};
const cents = value => typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 100) : null;
const optionalCents = value => value == null || value === '' ? 0 : cents(value);
const day = value => typeof value === 'number' ? new Date((Math.floor(value) - 25569) * 86400000).toISOString().slice(0, 10) : null;
const read = file => { const bytes = fs.readFileSync(file); return { data: JSON.parse(bytes), sha256: crypto.createHash('sha256').update(bytes).digest('hex') }; };
const captures = source => {
  const items = source.savings.filter(item => item.sheet === 'Ahorro');
  const ids = items.find(item => /!A1:A\d+$/.test(item.range));
  const money = items.find(item => /!D1:DW\d+$/.test(item.range));
  assert.ok(ids && money, 'Exact A and D:DW captures required');
  assert.equal(ids.mode, 'FORMATTED_VALUE', 'Identity must retain original displayed text');
  return { ids: ids.values, rows: money.values };
};

function compare(previous, current) {
  assert.equal(current.workbook_id, previous.workbook_id, 'Workbook identity changed');
  assert.match(current.as_of, /^\d{4}-\d{2}-\d{2}$/);
  const before = captures(previous), live = captures(current);
  assert.deepEqual(live.ids, before.ids, 'Original Folio sequence changed: reconcile identity before refresh');
  assert.equal(live.rows.length, before.rows.length);
  assert.deepEqual(live.rows[0], before.rows[0], 'Header/date calendar changed');
  const headers = live.rows[0], changes = [], invalidQ = [], invalidG = [], projectionDifferences = [];
  let futureCells = 0, oldTotal = 0, newTotal = 0, approvedAmountDiffers = 0;
  const sourceField = (row, name) => row[col(name) - col('D')];
  for (let rowIndex = 1; rowIndex < live.rows.length; rowIndex++) {
    const row = live.rows[rowIndex], old = before.rows[rowIndex];
    const get = name => sourceField(row, name), changed = [];
    for (let c = 0; c < headers.length; c++) {
      if (JSON.stringify(row[c] ?? null) === JSON.stringify(old[c] ?? null)) continue;
      const column = label(c + col('D'));
      changed.push({ column, date: c >= col('AA') - col('D') && c <= col('DO') - col('D') ? day(headers[c]) : undefined, before: old[c] ?? null, after: row[c] ?? null });
    }
    if (changed.length) changes.push({ source_row: rowIndex + 1, cells: changed });
    const q = cents(get('Q')), oq = cents(sourceField(old, 'Q'));
    assert.notEqual(q, null, 'Current Q missing/non-numeric');
    assert.notEqual(oq, null, 'Prior Q missing/non-numeric');
    oldTotal += oq; newTotal += q;
    const parts = ['G', 'O', 'H', 'I', 'J'].map(name => optionalCents(get(name)));
    if (parts.includes(null) || parts[0] + parts[1] - parts[2] - parts[3] - parts[4] !== q) invalidQ.push(rowIndex + 1);
    if (get('W') === 'Ahorrando' && get('R') !== get('S')) approvedAmountDiffers++;
    let historical = 0, invalidHistorical = false;
    for (let c = col('AA') - col('D'); c <= col('DO') - col('D'); c++) {
      const date = day(headers[c]), value = optionalCents(row[c]);
      if (get('W') === 'Ahorrando' && date >= day(get('X')) && date <= current.as_of) {
        if (value === null) invalidHistorical = true; else historical += value;
      }
      if (date <= current.as_of || typeof row[c] !== 'number') continue;
      futureCells++;
      const d = new Date(date + 'T00:00:00Z'), monthly = String(get('D')).toUpperCase() === 'JUB';
      const allowed = monthly ? d.getUTCDate() === 5 : d.getUTCDate() === 15 || d.getUTCDate() === 30 || d.getUTCMonth() === 1 && d.getUTCDate() === 28;
      const within = headers[c] >= get('F') && headers[c] <= get('Z');
      const expected = within && allowed ? cents(get('S')) : 0;
      if (value !== expected) projectionDifferences.push({ source_row: rowIndex + 1, column: label(c + col('D')), date });
    }
    if (invalidHistorical || historical !== cents(get('G'))) invalidG.push(rowIndex + 1);
  }
  assert.deepEqual(invalidQ, [], 'Q arithmetic differs');
  assert.deepEqual(invalidG, [], 'G dated matrix reconstruction differs');
  assert.deepEqual(projectionDifferences, [], 'Future matrix differs from demonstrated calendar/S amount');
  return {
    status: 'PASS', workbook_id: current.workbook_id, previous_as_of: previous.as_of, as_of: current.as_of,
    observed_at: current.observed_at, original_folio_sequence_unchanged: true,
    source_rows: live.rows.length - 1, previous_q: oldTotal / 100, current_q: newTotal / 100,
    q_difference: (newTotal - oldTotal) / 100, q_equations_pass: live.rows.length - 1,
    g_equations_pass: live.rows.length - 1, numeric_future_cells: futureCells,
    numeric_future_differences: projectionDifferences.length,
    active_rows_with_approved_s_different_from_original_r: approvedAmountDiffers,
    changed_source_rows: changes,
    semantics: ['Q_REFERENCE_ALREADY_INCLUDES_HISTORICAL_YIELD_AND_WITHDRAWALS', 'FUTURE_S_USES_APPROVED_CHANGE_AMOUNT', 'JUB_TEXT_COMPARISON_MATCHES_LOWERCASE_IN_LIVE_GOOGLE', 'FUTURE_IS_EXPECTED_NOT_RECEIVED'],
    limitations: ['NO_BANK_RECEIPT_CERTIFICATION', 'NO_SUPABASE_PROPOSAL_CONFLICT_CHECK', 'NO_SOURCE_OR_DATABASE_WRITES']
  };
}

if (require.main === module) {
  const [previousPath, currentPath] = process.argv.slice(2);
  assert.ok(previousPath && currentPath, 'Usage: node scripts/test-savings-source-equivalence.js <previous-private-snapshot> <current-private-snapshot>');
  const previous = read(previousPath), current = read(currentPath);
  console.log(JSON.stringify({ ...compare(previous.data, current.data), previous_sha256: previous.sha256, current_sha256: current.sha256 }, null, 2));
}
module.exports = { compare, captures, day };
