'use strict';
// Node-only diagnostics regression: synthetic RPC/Storage transport, real byte verifier.
// No database, network, credentials, lab, business writes or new dependencies.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { stripTypeScriptTypes } = require('node:module');
const { pathToFileURL } = require('node:url');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const baseline = process.argv.includes('--baseline');
const baselineRef = 'f6cfae303ce32c6d2102fce5a664f4292f596118';
const read = file => baseline
  ? execFileSync('git', ['show', baselineRef + ':' + file], { cwd: root, encoding: 'utf8' })
  : fs.readFileSync(path.join(root, file), 'utf8');
const entry = read('supabase/functions/financial-legacy/index.ts');
const shared = read('supabase/functions/_shared/document-integration.mjs');
const logs = [];
const classifier = {};
const snippet = entry.slice(entry.indexOf('const FINANCIAL_WRITER_CODES'), entry.indexOf('function allowedOrigin'));
assert(snippet.includes('function logFinancialSubmissionFailure'), 'CLASSIFIER_SOURCE_BOUNDARY');
vm.runInNewContext(stripTypeScriptTypes(snippet, { mode: 'strip' }) +
  '\nthis.classify=classifyFinancialWriterError;this.log=logFinancialSubmissionFailure;',
  Object.assign(classifier, { console: { error: line => logs.push(JSON.parse(line)) } }));
const sensitive = 'SYNTHETIC_PRIVATE_SENTINEL';
const codes = ['DOCUMENT_NOT_CURRENT', 'DOCUMENT_CONTEXT_DENIED', 'DOCUMENT_OPERATION_CHANGED',
  'DOCUMENT_BYTES_UNAVAILABLE', 'PHYSICAL_ASSET_NOT_VERIFIED', 'BYTE_INTEGRITY_MISMATCH'];
const results = [];
async function test(name, run) {
  try { await run(); results.push({ name, status: 'PASS' }); }
  catch (error) { results.push({ name, status: 'FAIL', error: error.message }); }
}
function classified(error, code, phase) {
  logs.length = 0;
  const result = classifier.log('SYNTHETIC-CORRELATION', 'request_writer', error);
  assert.equal(result.internalCode, code);
  assert.equal(result.publicCode, code);
  assert.equal(result.documentPhase, phase);
  assert.equal(logs[0].document_phase, phase);
  assert.deepEqual(Object.keys(logs[0]).sort(), ['correlation_id', 'document_phase', 'event', 'internal_code', 'postgres_code', 'stage']);
  assert(!JSON.stringify({ result, logs }).includes(sensitive), 'PRIVATE_ERROR_TEXT_EXPOSED');
  return result;
}
const originalFetch = globalThis.fetch;
(async () => {
  const moduleSource = shared.replace("'./document-stream.mjs'", JSON.stringify(pathToFileURL(path.join(root, 'supabase/functions/_shared/document-stream.mjs')).href));
  const { verifiedFinancialDocumentRpc: send } = await import('data:text/javascript;base64,' + Buffer.from(moduleSource).toString('base64'));
  for (const code of codes) {
    await test('Preserve safe code ' + code, () => classified({ code: code === 'DOCUMENT_NOT_CURRENT' ? '42501' : 'P0001', message: code + ' ' + sensitive, details: sensitive, hint: sensitive, documentPhase: 'COMPLETE' }, code, 'COMPLETE'));
  }
  await test('Unknown error text and untrusted phase remain private', () => {
    const result = classifier.log('SYNTHETIC-CORRELATION', 'request_writer', { message: sensitive, details: sensitive, hint: sensitive, code: sensitive, documentPhase: sensitive });
    assert.equal(result.internalCode, 'UNCLASSIFIED_WRITER_FAILURE');
    assert.equal(result.publicCode, 'FINANCIAL_REQUEST_CREATE_FAILED');
    assert.equal(result.postgresCode, 'UNKNOWN');
    assert.equal(result.documentPhase, 'UNKNOWN');
    assert.equal(logs.at(-1).document_phase, 'UNKNOWN');
    assert(!JSON.stringify({ result, log: logs.at(-1) }).includes(sensitive));
  });
  await test('Existing financial error contracts remain unchanged', () => {
    for (const code of ['CONDITIONS_CHANGED', 'LOAN_CAPACITY_EXCEEDED', 'DEPOSIT_ACCOUNT_UNAVAILABLE', 'IDEMPOTENCY_CONTRACT_MISMATCH']) {
      const result = classifier.classify({ message: code, code: 'PT409' });
      assert.equal(result.internalCode, code); assert.equal(result.publicCode, code); assert.equal(result.postgresCode, 'PT409');
    }
  });
  const bytes = Buffer.from('SYNTHETIC ORIGINAL DOCUMENT BYTES');
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  function harness(options = {}) {
    const calls = [], documents = [{ document_id: '00000000-0000-4000-8000-000000000001', asset: '00000000-0000-4000-8000-000000000002', bucket: 'private-assets', path: 'synthetic/document', mime: 'application/pdf', size: bytes.length, sha256: hash }];
    const prepared = { id: '00000000-0000-4000-8000-000000000003', documents, completed: false };
    const args = Object.freeze({ p_document_ids: [documents[0].document_id], p_idempotency_key: 'synthetic-idempotency' });
    const success = Object.freeze({ id: 'synthetic-request', status: 'SUBMITTED' });
    let reads = 0, prepares = 0;
    const user = { rpc: async (name, payload) => {
      calls.push(name); assert.equal(name, 'prepare_document_submission'); assert.equal(payload.p_arguments, args);
      prepares++;
      if (options.prepareError && prepares === (options.prepareFailureAt || 1)) return { data: null, error: options.prepareError };
      return { data: options.descriptorChanged && prepares === 2 ? { ...prepared, changed: true } : prepared, error: null };
    } };
    const service = {
      storage: { from: bucket => {
        assert.equal(bucket, 'private-assets');
        return { createSignedUrl: async (object, ttl) => {
          calls.push('signed-read'); assert.equal(object, 'synthetic/document'); assert.equal(ttl, 180);
          if (options.missing) return { data: null, error: Error(sensitive) };
          return { data: { signedUrl: 'https://synthetic.invalid/document' }, error: null };
        } };
      } },
      rpc: async (name, payload) => {
        calls.push(name); assert.equal(name, 'complete_document_financial_submission');
        assert.equal(payload.p_receipts.length, 1);
        const receipt = payload.p_receipts[0];
        assert.equal(receipt.verified, true); assert.equal(receipt.integrityVerified, true);
        assert.equal(receipt.sha256, hash); assert.equal(receipt.size, bytes.length); assert.equal(receipt.document_id, documents[0].document_id);
        return options.completeError ? { data: null, error: options.completeError } : { data: success, error: null };
      },
    };
    globalThis.fetch = async url => {
      assert.equal(url, 'https://synthetic.invalid/document', 'NETWORK_DISABLED');
      reads++; calls.push('bytes-read');
      return new Response(options.corrupt ? Buffer.alloc(bytes.length, 0) : bytes, { status: 200 });
    };
    return { run: (name = 'create_validated_financial_program_request') => send(user, service, name, args, null), calls, success, reads: () => reads };
  }
  for (const failureAt of [1, 2]) {
    await test('Prepare failure is attributed before/after byte verification: ' + failureAt, async () => {
      const error = Object.freeze({ message: 'DOCUMENT_CONTEXT_DENIED ' + sensitive, code: '42501', documentPhase: 'COMPLETE' });
      const h = harness({ prepareError: error, prepareFailureAt: failureAt });
      const result = await h.run(); assert.equal(result.data, null);
      classified(result.error, 'DOCUMENT_CONTEXT_DENIED', 'PREPARE');
      assert.equal(h.reads(), failureAt - 1); assert(!h.calls.includes('complete_document_financial_submission'));
      assert.equal(error.documentPhase, 'COMPLETE', 'ORIGINAL_ERROR_MUTATED');
    });
  }
  await test('Missing bytes stop completion and report VERIFY', async () => {
    const h = harness({ missing: true }), result = await h.run();
    classified(result.error, 'DOCUMENT_BYTES_UNAVAILABLE', 'VERIFY');
    assert.equal(h.reads(), 0); assert(!h.calls.includes('complete_document_financial_submission'));
  });
  await test('Real stream hash mismatch stops completion and reports VERIFY', async () => {
    const h = harness({ corrupt: true }), result = await h.run();
    classified(result.error, 'BYTE_INTEGRITY_MISMATCH', 'VERIFY');
    assert.equal(h.reads(), 1); assert(!h.calls.includes('complete_document_financial_submission'));
  });
  await test('Descriptor recheck mismatch is PREPARE and still fails closed', async () => {
    const h = harness({ descriptorChanged: true }), result = await h.run();
    classified(result.error, 'DOCUMENT_OPERATION_CHANGED', 'PREPARE');
    assert.equal(h.reads(), 1); assert(!h.calls.includes('complete_document_financial_submission'));
  });
  for (const code of ['DOCUMENT_NOT_CURRENT', 'PHYSICAL_ASSET_NOT_VERIFIED']) {
    await test('Finalizer rejection keeps code and COMPLETE phase: ' + code, async () => {
      const h = harness({ completeError: { message: code + ' ' + sensitive, code: code === 'DOCUMENT_NOT_CURRENT' ? '42501' : 'P0001' } });
      const result = await h.run(); classified(result.error, code, 'COMPLETE');
      assert.equal(h.reads(), 1); assert.equal(h.calls.at(-1), 'complete_document_financial_submission');
    });
  }
  await test('Success retains exact order, verified receipt and result identity', async () => {
    const h = harness(), result = await h.run();
    assert.equal(result.error, null); assert.equal(result.data, h.success); assert.equal(h.reads(), 1);
    assert.deepEqual(h.calls, ['prepare_document_submission', 'signed-read', 'bytes-read', 'prepare_document_submission', 'complete_document_financial_submission']);
  });
  await test('Product financing keeps the same verified writer contract', async () => {
    const h = harness(), result = await h.run('confirm_program_product_financing');
    assert.equal(result.error, null); assert.equal(result.data, h.success); assert.equal(h.reads(), 1);
    assert.equal(h.calls.at(-1), 'complete_document_financial_submission');
  });
  await test('Non-allowlisted writer cannot prepare, read bytes or dispatch', async () => {
    const h = harness(), result = await h.run('untrusted_writer');
    assert.equal(result.data, null); assert.equal(result.error.message, 'FINANCIAL_WRITER_REQUIRED');
    assert.equal(h.calls.length, 0); assert.equal(h.reads(), 0);
  });
  const result = { status: results.every(x => x.status === 'PASS') ? 'PASS' : 'FAIL', baseline, baselineRef, recordedAt: new Date().toISOString(), tests: results,
    passed: results.filter(x => x.status === 'PASS').length, failed: results.filter(x => x.status === 'FAIL').length,
    sourceHashes: { financial: crypto.createHash('sha256').update(entry).digest('hex'), integration: crypto.createHash('sha256').update(shared).digest('hex') },
    constraints: { networkRequests: 0, databaseCalls: 0, businessWrites: 0, realStreamVerifier: true, syntheticRpcTransport: true } };
  console.log(JSON.stringify(result, null, 2));
  if (result.failed) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { globalThis.fetch = originalFetch; });
