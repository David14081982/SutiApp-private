'use strict';
const assert = require('assert/strict');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const source = fs.readFileSync(path.join(__dirname, '../app/screens-loan.jsx'), 'utf8');
const normalize = source.slice(source.indexOf('  const DIACRITICS'), source.indexOf('  const programsForFund'));
const selection = source.slice(source.indexOf('  const hasShortTerms'), source.indexOf('  const sameSelection'));
const context = vm.createContext({});
vm.runInContext(normalize + selection + '\nthis.api={allowedTermsOf,deriveSelection,customTermAccepts};', context);
const { allowedTermsOf, deriveSelection, customTermAccepts } = context.api;
const base = { id: 'isolated', min_amount: 1, max_amount: 40000, suggested_amount: 5000, allowed_terms: [6, 12, 18, 24], custom_term: { min: 1, max: 24, step: 1 } };
for (const fund of ['Caja Chica', 'Caja de Ahorro', 'Sutiexpress', '  CÁJA  CHICA ']) {
  const program = { ...base, fund };
  assert.deepEqual(Array.from(allowedTermsOf(program)), [6, 12]);
  for (const term of [1, 7, 18, 24]) {
    assert.equal(deriveSelection(program, { amount: 5000, term }).term, 6);
    assert.equal(customTermAccepts(program, term), false);
  }
  for (const term of [6, 12]) assert.equal(deriveSelection(program, { amount: 5000, term }).term, term);
  assert.equal(deriveSelection(program, { amount: 90000, term: 12 }).amount, 40000);
  assert.deepEqual(Array.from(allowedTermsOf({ ...program, allowed_terms: [6] })), [6]);
  assert.equal(deriveSelection({ ...program, allowed_terms: [] }, null).term, 0);
}
const other = { ...base, fund: 'Otro fondo' };
assert.deepEqual(Array.from(allowedTermsOf(other)), [6, 12, 18, 24]);
assert.equal(deriveSelection(other, { amount: 3000, term: 7 }).term, 7);
const advance = { ...other, allowed_terms: [], custom_term: { min: 1, max: 1, step: 1 } };
assert.equal(deriveSelection(advance, null).term, 1);
assert(!source.includes('data-loan-quick-amount'));
assert(source.includes('presetsOnly ? []'));
assert(source.includes('!presetsOnly && free'));
console.log('PASS: three funds limited to authoritative 6/12; switching rejects hidden terms; other funds, amounts and one-payment advances preserved.');
