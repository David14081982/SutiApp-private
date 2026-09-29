'use strict';
// Read-only, fixed-request investigation. Never calls approval or delivery writers.
const fs = require('fs'), path = require('path'), assert = require('assert/strict'), crypto = require('crypto');
const root = path.resolve(__dirname, '..'), env = {};
for (const line of fs.readFileSync(path.join(root, 'supabase.env'), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
  const at = line.indexOf('=');
  if (at > 0 && !line.trim().startsWith('#')) env[line.slice(0, at).trim()] = line.slice(at + 1).trim().replace(/^['"]|['"]$/g, '');
}
const ref = new URL(env.SUPABASE_URL).hostname.split('.')[0];
const management = 'https://api.supabase.com/v1/projects/' + ref;
const headers = { Authorization: 'Bearer ' + env.SUPABASE_ACCESS_TOKEN, 'Content-Type': 'application/json' };
async function query(sql) {
  assert.match(sql.trim(), /^select\s/i);
  const response = await fetch(management + '/database/query', { method: 'POST', headers, body: JSON.stringify({ query: sql, read_only: true }) });
  if (!response.ok) throw Error('READ_QUERY_HTTP_' + response.status);
  return response.json();
}
async function main() {
  const requestSql = `select folio, created_at, status, financial_processing_status,
    requested_amount, requested_term, financial_approval_snapshot is not null as approved,
    financial_submission_snapshot->>'criterion_identity' as criterion_identity,
    financial_submission_snapshot->'financialResult' as financial_result,
    md5(to_jsonb(r)::text) as request_fingerprint
    from public.program_requests r where folio='SR-2026-000432'`;
  const before = await query(requestSql);
  assert.equal(before.length, 1);
  const request = before[0];
  const versions = await query(`select id,version,lifecycle_status,created_at,published_at,
    max_amount,rate_percent,max_term,payment_count,payment_period,supersedes_rule_id
    from public.financial_rules where lineage_id=(select lineage_id from public.financial_rules
    where id='4b1e26a7-727c-46dd-a347-279c69ea7c7c') order by version`);
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  const response = await fetch(env.SUPABASE_URL + '/rest/v1/rpc/get_financial_runtime_rules', {
    method: 'POST', headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: '{}',
  });
  assert.equal(response.status, 200);
  const runtime = await response.json();
  const selected = runtime.filter(rule => rule.criterion_identity === request.criterion_identity);
  const current = runtime.filter(rule => versions.some(version => version.id === rule.rule_id));
  const deployedResponse = await fetch(management + '/functions/financial-legacy/body', { headers });
  assert.equal(deployedResponse.status, 200);
  const deployed = Buffer.from(await deployedResponse.arrayBuffer());
  const deployedText = deployed.toString('utf8');
  const functionStart = deployedText.indexOf('async function approveRequest(');
  const guard = deployedText.indexOf('selectedRules.length !== 1', functionStart);
  const conditionsError = deployedText.indexOf('CONDITIONS_CHANGED', guard);
  const capturedAdvance = deployedText.indexOf('capturedAdvanceApprovalResult(selectedRules[0], request)', guard);
  const writer = deployedText.indexOf('"approve_financial_program_request"', guard);
  const checks = {
    requestHasNoApproval: request.approved === false,
    submittedRuleIsExpired: versions.some(v => 'SUPABASE_RULE:' + v.id === request.criterion_identity && v.lifecycle_status === 'EXPIRED'),
    exactRuntimeMatchCountIsZero: selected.length === 0,
    currentRuleIsDifferent: current.length === 1 && current[0].criterion_identity !== request.criterion_identity,
    currentLimitBelowRequestedAmount: current.length === 1 && Number(current[0].max_amount) < Number(request.requested_amount),
    deployedApprovalIdentityGuard: functionStart >= 0 && guard > functionStart && conditionsError > guard && conditionsError - guard < 150,
    deployedGuardBeforeAdvanceRepairAndWriter: capturedAdvance > conditionsError && writer > capturedAdvance,
    twelvePaymentsOutsideAdvanceRepair: Number(request.requested_term) === 12 && request.financial_result.paymentCount === 12,
  };
  const after = await query(requestSql);
  checks.requestUnchanged = after.length === 1 && after[0].request_fingerprint === request.request_fingerprint;
  const proof = { status: Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL', checkedAt: new Date().toISOString(),
    scope: 'DIAGNOSIS_ONLY', request, versions, currentRules: current, runtimeRuleCount: runtime.length,
    deployedBundleSha256: crypto.createHash('sha256').update(deployed).digest('hex'), checks,
    productionWrites: 0, approvalAttempts: 0, googleCalls: 0,
    limitations: ['No real approval attempted', 'Later approval gates not exercised', 'No production repair performed'] };
  const output = path.join(root, 'docs/qa/evidence/loan-approval-432-20260928/diagnosis.json');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(proof, null, 2) + '\n');
  console.log(JSON.stringify({ status: proof.status, checks, output: path.relative(root, output), productionWrites: 0 }, null, 2));
  assert.equal(proof.status, 'PASS');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
