'use strict';
const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');
const { stripTypeScriptTypes } = require('module');
const source = fs.readFileSync('supabase/functions/financial-legacy/index.ts', 'utf8');
const code = stripTypeScriptTypes(source.slice(source.indexOf('async function approveRequest('), source.indexOf('async function handoffRequest(')));
const requestId = '10000000-0000-4000-8000-000000000001';
async function run(options = {}) {
  const calls = [];
  const result = { amount: 50000, paymentCount: 12, interest: 9000, administrativeFeeTotal: 180, total: 59180, rate: 1.5, maxAmount: 50000, fund: 'Caja de Ahorro' };
  const request = { id: requestId, affiliate_id: 'affiliate', numero_control: 'TEST', program_id: 'prestamo', request_type: 'benefit', status: 'in_review', financial_processing_status: 'pending', requested_amount: 50000, requested_term: 12, requested_term_semantics: 'quincenal', terms_accepted: true, signature_data: 'synthetic-signature', created_at: '2026-09-28', financial_submission_snapshot: { criterion_identity: 'SUPABASE_RULE:old', financialResult: result }, ...options.request };
  const client = {
    from(table) { calls.push(table); const query = { select() { return query; }, eq() { return query; }, in() { return query; }, maybeSingle() { return Promise.resolve(reply()); }, then(a,b) { return Promise.resolve(reply()).then(a,b); } };
      function reply() {
        let data;
        if (table === 'program_requests') data = request;
        if (table === 'affiliates') data = { id: 'affiliate', numero_control: 'TEST', full_name: 'Synthetic', phone_raw: '0000000000', financial_union_code: 'U', financial_employee_category_code: 'C' };
        if (table === 'segmentation_catalog_entries') data = [{ catalog_type: 'union', code: 'U', label: 'Union' }, { catalog_type: 'employment_category', code: 'C', label: 'Base' }];
        if (table === 'financial_rules') data = calls.filter(x => x === table).length === 1 ? { lineage_id: 'lineage' } : [{ id: 'current' }];
        if (table === 'request_documents') data = [];
        return { data, error: options.historyError && table === 'financial_rules' ? Error('READ_FAILED') : null };
      }
      return query;
    },
    async rpc(name) { calls.push(name); if (name === 'required_guarantor_document_codes') return { data: [], error: null }; if (name === 'approve_financial_program_request') return { data: { status: 'approved' }, error: null }; throw Error('UNEXPECTED_RPC_' + name); },
  };
  const rule = { id: 'current', rule_id: 'current', criterion_identity: options.currentIdentity || 'SUPABASE_RULE:current', max_amount: 30000, rate: 1.5, max_term: 24, fund: 'Caja de Ahorro' };
  const context = { createClient: () => client, Deno: { env: { get: () => 'isolated' } }, requireExportPermission: async () => options.allowed !== false,
    processForCategory: () => '1', affiliationForUnion: () => '1', readCriteriaRules: async () => [rule], readTermPolicy: async () => ({}),
    capturedAdvanceApprovalResult: () => null, resolveQuote: async () => result, capturedDocumentReferences: () => options.missingDocs ? {} : Object.fromEntries(['profile_photo','ine_front','ine_back','payroll_previous','payroll_latest'].map(k => [k,'synthetic-ref'])),
    sha256: async () => 'synthetic-hash', EXPORT_CONTRACT_VERSION: 'FINAL_APPROVED_LOAN_EXPORT_V1' };
  vm.createContext(context); vm.runInContext(code + ';this.approve = approveRequest;', context);
  const outcome = await context.approve({ request_id: requestId }, 'https://isolated.invalid', 'Bearer isolated', 'actor', options.review !== false);
  return { outcome, calls };
}
(async () => {
  const checks = [];
  let test = await run(); assert.equal(test.outcome.body.data.phase, 'NEW_REQUEST_REQUIRED'); assert.equal(test.outcome.body.data.current.maxAmount, 30000); assert(!test.calls.includes('approve_financial_program_request')); checks.push('expired rule explains current limit without approving');
  test = await run({ review: false }); assert.equal(test.outcome.body.error, 'CONDITIONS_CHANGED'); checks.push('normal approval cannot bypass expired conditions');
  test = await run({ allowed: false }); assert.equal(test.outcome.status, 403); assert.equal(test.calls.length, 0); checks.push('permission denied before privileged reads');
  test = await run({ currentIdentity: 'SUPABASE_RULE:old' }); assert.equal(test.outcome.body.data.phase, 'READY'); assert(!test.calls.includes('approve_financial_program_request')); checks.push('ready preflight never writes');
  test = await run({ currentIdentity: 'SUPABASE_RULE:old', review: false }); assert(test.calls.includes('approve_financial_program_request')); checks.push('normal approval preserves existing writer');
  test = await run({ request: { terms_accepted: false } }); assert.equal(test.outcome.body.error, 'SIGNATURE_AND_TERMS_REQUIRED'); checks.push('signature guard preserved');
  test = await run({ currentIdentity: 'SUPABASE_RULE:old', missingDocs: true }); assert.equal(test.outcome.body.error, 'REQUIRED_PRIVATE_DOCUMENT_MISSING'); checks.push('documents never bypassed');
  test = await run({ request: { status: 'cancelled' } }); assert.equal(test.outcome.body.error, 'FINANCIAL_REQUEST_NOT_APPROVABLE'); checks.push('cancelled request cannot approve');
  test = await run({ request: { financial_approval_snapshot: {} } }); assert.equal(test.outcome.body.data.idempotent, true); checks.push('already-approved response is idempotent');
  test = await run({ historyError: true }); assert.equal(test.outcome.status, 503); assert(!test.outcome.body.data); checks.push('failed authority read never invents comparison');
  const keys = source.slice(source.indexOf('const ACTION_KEYS'), source.indexOf('function reply'));
  assert.match(keys, /approvalReview: new Set\(\["action", "request_id"\]\)/);
  const route = source.slice(source.indexOf('if (body.action === "approvalReview")'), source.indexOf('if (body.action === "approve")'));
  assert.doesNotMatch(route.replace(/\/\/[^\n]*/g,''), /attachRequestRegister|synchronizeRequestRegister/); checks.push('preflight excludes Google delivery');
  const evidence = { status: 'PASS', checks, productionWrites: 0 };
  fs.mkdirSync('docs/qa/evidence/loan-approval-resolution-20260928', { recursive: true });
  fs.writeFileSync('docs/qa/evidence/loan-approval-resolution-20260928/edge-tests.json', JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify(evidence));
})().catch(e => { console.error(e); process.exitCode = 1; });
