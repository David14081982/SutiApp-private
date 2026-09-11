'use strict';
const fs = require('fs'), vm = require('vm'), assert = require('assert').strict;
const source = fs.readFileSync('app/admin-finance-queue-repository.js', 'utf8');
async function main() {
  let calls = [], result;
  const window = { ProgramRequestRepository: { listFinancialMobile: async () => { calls.push('listFinancialMobile'); if (result.error) throw result.error; return result.data; } } };
  vm.runInNewContext(source, { window });
  const rows = Array.from({ length: 100 }, (_, i) => ({ id: 'r' + i, affiliate_id: 'a' + i, numero_control: '000' + i, program_id: 'prestamo', nombre: 'Corto', affiliate: { full_name: 'Nombre Completo ' + i, display_name: 'Corto' } }));
  result = { data: rows.slice().reverse().map(row => ({ id: row.id, financial_submission_snapshot: { financialResult: { fund: 'Fondo ' + row.id } } })) };
  const enriched = await window.AdminFinanceQueueRepository.enrich(rows);
  assert.equal(calls.length, 1); assert.equal(calls[0], 'listFinancialMobile');
  enriched.forEach((row, i) => { assert.equal(row.nombre, 'Nombre Completo ' + i); assert.equal(row.requested_fund, 'Fondo r' + i); assert.equal(row.numero_control, '000' + i); assert(Object.isFrozen(row)); });
  assert.equal(rows[0].nombre, 'Corto');
  result = { error: new Error('DENIED') }; await assert.rejects(() => window.AdminFinanceQueueRepository.enrich(rows), /DENIED/);
  result = { data: [] }; await assert.rejects(() => window.AdminFinanceQueueRepository.enrich(rows), /INCOMPLETE/);
  calls = []; const other = await window.AdminFinanceQueueRepository.enrich([{ id: 'p', program_id: 'casa', nombre: 'Alias', affiliate: { display_name: 'Alias' } }]);
  assert.equal(calls.length, 0); assert.equal(other[0].nombre, 'Nombre completo no registrado');
  console.log(JSON.stringify({ status: 'PASS', checks: ['full_name', 'fund keyed by request ID', 'one existing authorized RPC for 100 loans', 'no per-row detail hydration', 'RLS error visible', 'incomplete read fails closed', 'no mutation', 'raw control preserved', 'no display_name fallback'] }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
