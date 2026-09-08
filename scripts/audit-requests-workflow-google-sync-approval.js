'use strict';
// Execute the existing Edge approval against real READS, intercept its sole writer,
// then test the captured SQL approval in a transaction that always rolls back.
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(__dirname, '..'), values = {};
for (const line of fs.readFileSync('C:/Users/david/OneDrive/Documentos/Sutiapp 20082026/supabase.env', 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) { const at = line.indexOf('='); if (at > 0) values[line.slice(0, at).trim()] = line.slice(at + 1).trim().replace(/^['"]|['"]$/g, ''); }
async function main() {
  const supabase = new Function(fs.readFileSync(path.join(root, 'app/vendor/supabase-js-2.112.3/supabase.min.js'), 'utf8') + ';return supabase;')();
  const realCreate = supabase.createClient;
  const login = await fetch(values.SUPABASE_URL + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: values.SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: values.H005_TEST_EMAIL, password: values.H005_TEST_PASSWORD }) });
  const session = await login.json(); if (!login.ok) throw Error('QA_LOGIN_' + login.status);
  let captured; const reads = [];
  const createClient = (url, key, options) => {
    const client = realCreate(url, key, { ...options, global: { ...options?.global, fetch: async (url, init) => {
      const route = String(url).split('/rest/v1/')[1] || '', method = init?.method || 'GET';
      if (!['GET','HEAD'].includes(method) && !/^rpc\/(has_admin_permission|get_current_loan_term_policy|resolve_suti_loan_quote_contract|get_financial_criteria_rules|get_financial_runtime_rules)/.test(route)) throw Error('AUDIT_WRITE_BLOCKED');
      return fetch(url, init);
    } } });
    const rpc = client.rpc.bind(client);
    client.rpc = async (name, args) => {
      if (name === 'approve_financial_program_request') { captured = args; return { data: { status: 'approved', financial_processing_status: 'ready_for_handoff' }, error: null }; }
      reads.push(name); return rpc(name, args);
    }; return client;
  };
  const babel = require('C:/tmp/babel-standalone-7.28.4.min.js');
  const original = (process.argv.includes('--baseline') ? require('child_process').execFileSync('git',['show','435fc47:supabase/functions/financial-legacy/index.ts'],{cwd:root,encoding:'utf8'}) : fs.readFileSync(path.join(root, 'supabase/functions/financial-legacy/index.ts'), 'utf8')).replace(/^import[^\n]+\n/gm, '');
  const source = babel.transform(original, { filename: 'index.ts', presets: ['typescript'] }).code;
  const context = { createClient, Deno: { env: { get: name => name === 'SUPABASE_ANON_KEY' ? values.SUPABASE_PUBLISHABLE_KEY : values[name] }, serve: () => {} }, crypto: globalThis.crypto, TextEncoder, URL, AbortController, setTimeout, clearTimeout, console, ...require(path.join(root, 'supabase/functions/financial-legacy/visibility-policy.js')), ...require(path.join(root, 'supabase/functions/financial-legacy/request-google-sync.js')) };
  vm.createContext(context); vm.runInContext(source + '\nthis.auditApprove = approveRequest;', context);
  const focusedId=process.argv.includes('--controlled')?JSON.parse(fs.readFileSync(path.join(root,'docs/qa/evidence/requests-workflow-google-sync-20260908/live-requests.json'),'utf8')).find(r=>r.family==='loan'&&r.branch==='approve').id:'5cd836ad-3681-40c8-8cfc-803ac1af2e34';
  const outcome = await context.auditApprove({ request_id: focusedId, comment: '' }, values.SUPABASE_URL, 'Bearer ' + session.access_token, session.user.id);
  const proof = { status: 'PASS', edgeOutcome: outcome, reads, writerReached: !!captured, committedWrites: 0 };
  if (captured) {
    const ref = new URL(values.SUPABASE_URL).hostname.split('.')[0];
    const sqlString = text => "'" + String(text).replace(/'/g, "''") + "'";
    const candidate=process.argv.includes('--candidate-migration');
    const trackingMigration=process.argv.includes('--tracking-migration');proof.trackingMigration=trackingMigration;
    const migration=candidate||trackingMigration?fs.readFileSync(path.join(root,trackingMigration?'supabase/migrations/20260908000200_request_snapshot_status_validation.sql':'supabase/migrations/20260908000100_requests_workflow_google_sync.sql'),'utf8').replace(/^begin;\s*/i,'').replace(/commit;\s*$/i,''):'';
    const assertions=candidate?`do $test$ declare r uuid:=${sqlString(captured.p_request_id)};v jsonb;j jsonb;initial jsonb;begin
      v:=public.resolve_program_request_workflow_state(r);
      if v->>'request_status'<>'approved' or not exists(select 1 from jsonb_array_elements(v->'stages') s where s->>'id'=v->>'current_stage_id' and s->>'state'='done') then raise exception 'FINAL_APPROVAL_TIMELINE_FAILED';end if;
      if exists(select 1 from jsonb_array_elements(v->'stages') s where (s->>'sort_order')::int>30 and s->>'state'='done') then raise exception 'UNPERFORMED_DEPOSIT_COMPLETED';end if;
      j:=public.claim_program_request_google_sync(r);if j->>'desired_status'<>'APROBADO' then raise exception 'APPROVAL_NOT_QUEUED';end if;
      initial:=jsonb_set(jsonb_set(to_jsonb(array_fill(''::text,array[33])),'{0}',to_jsonb(r::text)),'{24}','"PENDIENTE"');
      perform public.finish_program_request_google_sync(r,(j->>'revision')::bigint,initial,2,null);
      if (select financial_processing_status from public.program_requests where id=r)<>'handed_off' then raise exception 'REGISTER_DELIVERY_NOT_RECORDED';end if;
    end $test$;`:'';
    const projectionCheck=process.argv.includes('--controlled')?`do $projection$ declare v jsonb;begin v:=public.resolve_program_request_workflow_state(${sqlString(captured.p_request_id)}::uuid);if not exists(select 1 from jsonb_array_elements(v->'stages') s where s->>'id'=v->>'current_stage_id' and s->>'state'='done') or exists(select 1 from jsonb_array_elements(v->'stages') s where (s->>'sort_order')::int>30 and s->>'state'='done') then raise exception 'APPROVAL_PROJECTION_INVALID';end if;end $projection$;`:'';
    const sql = `begin; ${migration} select set_config('request.jwt.claim.role','service_role',true); select status,financial_processing_status from public.approve_financial_program_request(${sqlString(captured.p_request_id)}::uuid,${sqlString(JSON.stringify(captured.p_snapshot))}::jsonb,${sqlString(captured.p_approved_by)}::uuid,''); ${assertions} ${projectionCheck} rollback;`;
    const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, { method: 'POST', headers: { Authorization: 'Bearer ' + values.SUPABASE_ACCESS_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql }) });
    const result = await response.json(); proof.transactionalApproval = { httpStatus: response.status, result:response.ok?result:{error:String(result.message||'').split(/\n(?:CONTEXT|DETAIL):/)[0]} };proof.candidateMigration=candidate;
    if(!response.ok){proof.status='FAIL';process.exitCode=1;}
  }
  fs.writeFileSync(path.join(root, 'docs/qa/evidence/requests-workflow-google-sync-20260908/'+(process.argv.includes('--controlled')?'controlled':process.argv.includes('--baseline')?'before':'candidate')+'-approval.json'), JSON.stringify(proof, null, 2) + '\n');
  console.log(JSON.stringify(proof));
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
