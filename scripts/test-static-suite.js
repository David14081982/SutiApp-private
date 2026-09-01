'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const excluded = new Set([
  'test-static-suite.js',
  'test-google-service-account-webapp-auth.js',
  'test-google-user-oauth-webapp-scope.js',
  // Productive Admin-resume verification performs authenticated network/RPC calls.
  'test-universal-program-product-payment-simulator-admin-resume.js',
]);
const tests = fs.readdirSync(__dirname)
  .filter((name) => /^test-.*\.js$/.test(name))
  .filter((name) => !excluded.has(name) && !/(?:browser|live)\.js$/.test(name))
  .sort();
const failures = [];

for (const test of tests) {
  const result = spawnSync(process.execPath, [path.join('scripts', test)], { cwd: root, encoding: 'utf8' });
  if (result.status === 0) console.log(`PASS ${test}`);
  else {
    failures.push(test);
    console.error(`FAIL ${test}`);
    if (result.stdout) process.stderr.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
  }
}

console.log(JSON.stringify({ status: failures.length ? 'FAIL' : 'PASS', total: tests.length, failures }));
if (failures.length) process.exitCode = 1;
