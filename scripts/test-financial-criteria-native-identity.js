'use strict';
// Exercise the actual Edge validator without loading Deno, Auth or any network client.
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripTypeScriptTypes } = require('module');

const source = fs.readFileSync(path.join(__dirname, '../supabase/functions/financial-criteria-admin/index.ts'), 'utf8');
const modes = source.match(/^const MODES = .+;$/m);
const start = source.indexOf('function validBody(');
const end = source.indexOf('\nDeno.serve(', start);
assert(modes && start >= 0 && end > start, 'actual Edge validator must be present');
const context = vm.createContext({});
vm.runInContext(stripTypeScriptTypes(modes[0] + '\n' + source.slice(start, end)) + '\nthis.validate = validBody;', context);
const validate = context.validate;
const legacy = 'CRITERIA_V1:102:' + 'ABCDEF0123456789'.repeat(4);
const native = 'SUPABASE_RULE:1a2b3c4d-1234-4abc-8def-0123456789ab';
const payload = (identity) => ({ action: 'setVisibility', criterion_identity: identity, visibility_mode: 'AUTO', reason: 'Cambio autorizado' });
let checks = 0;
function check(body, expected, label) {
  assert.equal(validate(body), expected, label);
  checks++;
}

for (const identity of [legacy, native]) {
  for (const mode of ['AUTO', 'MOSTRAR', 'OCULTAR']) {
    check({ ...payload(identity), visibility_mode: mode }, true, 'accepted identity and visibility mode');
  }
  for (const mode of ['', 'auto', 'SHOW', null, 1]) {
    check({ ...payload(identity), visibility_mode: mode }, false, 'invalid mode');
  }
  for (const reason of ['', '1234567', '        ', '  1234567  ', 'x'.repeat(501), null, 12345678]) {
    check({ ...payload(identity), reason }, false, 'invalid reason');
  }
  check({ ...payload(identity), reason: '12345678' }, true, 'minimum reason length');
  check({ ...payload(identity), reason: 'x'.repeat(500) }, true, 'maximum reason length');
  check({ ...payload(identity), fund_id: 'unexpected' }, false, 'unknown body field denied');
  check({ ...payload(identity), action: 'delete' }, false, 'unknown action denied');
  for (const field of ['criterion_identity', 'visibility_mode', 'reason']) {
    const body = payload(identity);
    delete body[field];
    check(body, false, 'missing required field ' + field);
  }
}

for (const identity of [
  '', null, 123, {}, [],
  'SUPABASE_RULE:',
  native.slice(0, -1), native + '0', native + '\n', ' ' + native, native + ' ',
  native.replace('1a2b3c4d-', '1a2b3c4d'),
  native.replace('1a2b3c4d', 'ga2b3c4d'),
  native.replace('SUPABASE_RULE:', 'SUPABASE_RULE:{') + '}',
  native.replace('SUPABASE_RULE:', 'OTHER_RULE:'),
  native + "'; select 1; --",
  legacy.slice(0, -1), legacy + '0', legacy.replace(':102:', ':-102:'),
  legacy.replace(':102:', ':1.2:'), legacy.replace('ABCDEF', 'GBCDEF'),
]) check(payload(identity), false, 'malformed identity denied');

check(payload(legacy.toLowerCase()), true, 'legacy case compatibility retained');
check(payload(native.toUpperCase()), true, 'UUID hexadecimal case accepted');
check({ action: 'initialize' }, true, 'initialization contract retained');
check({ action: 'initialize', reason: 'unexpected' }, false, 'initialization extra fields denied');
check({}, false, 'missing action denied');

console.log(JSON.stringify({ status: 'PASS', checks, actualEdgeValidator: true, legacyIdentity: true, nativeUuidIdentity: true, productionCalls: 0, filesWritten: 0 }));
