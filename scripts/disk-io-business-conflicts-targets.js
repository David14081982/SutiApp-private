'use strict';
// Derive isolated-test inputs from versioned SQL; no private snapshot or database access.
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const root = path.resolve(__dirname, '..');
function readTargets(file) {
  const sql = fs.readFileSync(path.join(root, file), 'utf8');
  const match = sql.match(/\$h01_targets\$([\s\S]*?)\$h01_targets\$/);
  assert(match, 'H01_TARGET_PAYLOAD_MISSING');
  return JSON.parse(match[1]);
}
const forward = readTargets('supabase/migrations/20260907000200_disk_io_business_conflicts.sql');
const recovery = readTargets('supabase/recovery/20260907000200_disk_io_business_conflicts_recovery.sql');
const targets = forward.map(after => {
  const before = recovery.find(row => row.signature === after.signature);
  assert(before, 'H01_RECOVERY_TARGET_MISSING');
  assert.equal(after.expected, before.result);
  assert.equal(after.result, before.expected);
  return { ...after, schema: 'public', proname: after.signature.split('(')[0].split('.').pop(),
    signature: after.signature.replace(/^public\./, ''),
    before: before.definition, after: after.definition,
    before_md5: after.expected, after_md5: after.result };
});
assert.equal(targets.length, 10);
module.exports = { targets };
