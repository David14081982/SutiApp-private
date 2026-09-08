'use strict';
// Targeted read-only backend audit; secrets and applicant fields never printed.
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'docs/qa/evidence/requests-workflow-google-sync-20260908');
const envFile = process.env.SUTIAPP_TEST_ENV_FILE || 'C:/Users/david/OneDrive/Documentos/Sutiapp 20082026/supabase.env';
const values = {};
for (const line of fs.readFileSync(envFile, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) { const at = line.indexOf('='); if (at > 0) values[line.slice(0, at).trim()] = line.slice(at + 1).trim().replace(/^['"]|['"]$/g, ''); }
async function query(sql) {
  const ref = new URL(values.SUPABASE_URL).hostname.split('.')[0];
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, { method: 'POST', headers: { Authorization: 'Bearer ' + values.SUPABASE_ACCESS_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql }) });
  const data = await response.json(); if (!response.ok) throw Error('AUDIT_SQL_' + response.status + ': ' + (data.message || '')); return data;
}
async function main() {
  fs.mkdirSync(out, { recursive: true });
  const definitions = await query(`select p.proname,pg_get_function_identity_arguments(p.oid) args,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('sync_program_request_tracking_from_status','validate_operational_request_tracking','resolve_program_request_workflow_state','record_program_request_admin_action','transition_program_request_workflow','approve_financial_program_request','list_self_program_request_history','create_validated_financial_program_request','create_membership_request','create_validated_program_product_payment_request','create_program_request_with_documents') order by p.proname,args`);
  fs.writeFileSync(path.join(out, 'before-functions.json'), JSON.stringify(definitions, null, 2) + '\n');
  const proof = await query(`begin read only;
    select set_config('request.jwt.claim.role','service_role',true);
    select jsonb_build_object(
      'request',(select jsonb_build_object('id',r.id,'folio',r.folio,'status',r.status,'processing',r.financial_processing_status,'snapshot_version',r.workflow_version,'workflow_state',public.resolve_program_request_workflow_state(r.id),'tracking',(select jsonb_build_object('current_stage_id',t.current_stage_id,'stage_dates',t.stage_dates) from public.operational_request_tracking t where t.request_id=r.id),'events',(select coalesce(jsonb_agg(jsonb_build_object('action',e.action,'from_status',e.from_status,'to_status',e.to_status,'created_at',e.created_at,'from_stage_id',e.from_stage_id,'to_stage_id',e.to_stage_id)),'[]'::jsonb) from public.program_request_admin_events e where e.request_id=r.id),'request_documents',(select count(*) from public.request_documents d where d.request_id=r.id),'legacy_ready_files',(select count(*) from public.affiliate_files f where f.affiliate_id=r.affiliate_id and f.status='READY' and f.classification='PRIVATE'),'submission_keys',(select jsonb_agg(k) from jsonb_object_keys(r.financial_submission_snapshot) k)) from public.program_requests r where folio='SR-2026-000121'),
      'families',(select jsonb_agg(q) from (select program_id,request_type,membership_offering_id is not null membership,count(*) from public.program_requests group by 1,2,3) q),
      'triggers',(select jsonb_agg(jsonb_build_object('name',tgname,'enabled',tgenabled,'definition',pg_get_triggerdef(oid))) from pg_trigger where tgrelid='public.program_requests'::regclass and not tgisinternal),
      'extensions',(select jsonb_agg(extname) from pg_extension where extname in('pg_net','pg_cron','supabase_vault')),
      'realtime_tables',(select jsonb_agg(tablename) from pg_publication_tables where pubname='supabase_realtime' and tablename in('program_requests','operational_request_tracking'))
    ) proof;
    commit;`);
  fs.writeFileSync(path.join(out, 'before-audit.json'), JSON.stringify(proof, null, 2) + '\n');
  console.log(JSON.stringify({ definitions: definitions.length, proof, status: 'PASS', dataWrites: 0 }));
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
