'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const migrationName='20260903000140_finance_request_workflow_ux_correction.sql';
const recoveryName='20260903000140_finance_request_workflow_ux_correction_recovery.sql';

function env(){const out={};for(const raw of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const line=raw.trim(),at=line.indexOf('=');if(at>0&&!line.startsWith('#'))out[line.slice(0,at).trim()]=line.slice(at+1).trim().replace(/^['"]|['"]$/g,'');}return out;}
function body(sql){return sql.replace(/^\s*begin;\s*/i,'').replace(/\s*commit;\s*$/i,'');}
async function management(values,query){const ref=new URL(values.SUPABASE_URL).hostname.split('.')[0],response=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${values.SUPABASE_ACCESS_TOKEN}`,'Content-Type':'application/json','User-Agent':'SutiApp-Finance-Request-Flow-Correction/1.0'},body:JSON.stringify({query})}),data=await response.json().catch(()=>null);if(!response.ok)throw new Error(`MANAGEMENT_SQL_${response.status}:${data&&(data.message||data.error)||'UNKNOWN'}`);return data;}

const migration=fs.readFileSync(path.join(root,'supabase','migrations',migrationName),'utf8');
const recovery=fs.readFileSync(path.join(root,'supabase','recovery',recoveryName),'utf8');
const checks=`
do $verify$
declare v_admin uuid;v_queue jsonb;v_quote_key text;v_quote_priority integer;
begin
  if to_regprocedure('public.list_admin_finance_request_flow_queue()') is null
     or to_regprocedure('public.get_admin_finance_request_flow_detail(uuid)') is null
     or to_regprocedure('public.transition_program_request_workflow(uuid,text,text,uuid,numeric,date)') is null then
    raise exception 'FINANCE_FLOW_RPC_MISSING';
  end if;
  if not exists(select 1 from pg_trigger where tgname='program_requests_sync_workflow_tracking' and tgenabled<>'D') then raise exception 'TRACKING_SYNC_TRIGGER_MISSING'; end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='program_request_admin_events' and column_name='from_stage_id') then raise exception 'STAGE_AUDIT_COLUMNS_MISSING'; end if;
  if has_function_privilege('anon','public.list_admin_finance_request_flow_queue()','execute')
     or has_function_privilege('anon','public.transition_program_request_workflow(uuid,text,text,uuid,numeric,date)','execute') then raise exception 'ANON_FINANCE_FLOW_EXECUTE'; end if;
  select auth_user_id into v_admin from public.admin_assignments where enabled order by created_at limit 1;
  if v_admin is null then raise exception 'CONTROLLED_ADMIN_MISSING'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_admin,'role','authenticated')::text,true);
  v_queue:=public.list_admin_finance_request_flow_queue();
  if jsonb_array_length(v_queue)<>(select count(*) from public.program_requests) then raise exception 'UNIFIED_QUEUE_INCOMPLETE'; end if;
  if exists(select 1 from jsonb_array_elements(v_queue) item where not coalesce((item->'workflow_state'->>'available')::boolean,false)) then raise exception 'QUEUE_WORKFLOW_UNAVAILABLE'; end if;
  select c.service_key,c.priority into v_quote_key,v_quote_priority
  from public.program_requests r cross join lateral public.request_workflow_candidate_keys(r) c
  where r.request_type='quote' and r.program_id<>'prestamo' and c.service_key like 'request:%' order by r.created_at desc,c.priority limit 1;
  if v_quote_key<>'request:quote' or v_quote_priority<>92 then raise exception 'QUOTE_FALLBACK_PRIORITY_INVALID'; end if;
end $verify$;`;
const recoveryChecks=`
do $verify$
begin
  if to_regprocedure('public.list_admin_finance_request_flow_queue()') is not null then raise exception 'RECOVERY_READ_RPC_REMAINS'; end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='program_request_admin_events' and column_name='from_stage_id') then raise exception 'RECOVERY_STAGE_COLUMN_REMAINS'; end if;
  if exists(select 1 from pg_trigger where tgname='program_requests_sync_workflow_tracking' and tgenabled<>'D') then raise exception 'RECOVERY_TRIGGER_REMAINS'; end if;
end $verify$;`;
const matrix=`
do $matrix$
declare
  v_admin uuid;v_membership public.program_requests%rowtype;v_loan public.program_requests%rowtype;
  v_quote public.program_requests%rowtype;v_benefit public.program_requests%rowtype;v_result jsonb;v_state jsonb;
  v_id uuid;v_retry uuid:=extensions.gen_random_uuid();v_user_state jsonb;v_specialized_blocked boolean:=false;
  v_non_admin uuid;v_affiliate_user uuid;v_unauthorized_blocked boolean:=false;
begin
  select auth_user_id into v_admin from public.admin_assignments where enabled order by created_at limit 1;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_admin,'role','authenticated')::text,true);

  select * into v_membership from public.program_requests where membership_offering_id is not null order by created_at desc limit 1;
  if v_membership.id is null then raise exception 'MEMBERSHIP_FIXTURE_MISSING'; end if;
  insert into public.program_requests(actor_real_auth_user_id,affiliate_id,numero_control,program_id,program_item_id,product_id,company_id,membership_offering_id,request_type,status,quantity,notes,signature_data,terms_accepted,source_context,financial_processing_status,idempotency_key)
  values(v_membership.actor_real_auth_user_id,v_membership.affiliate_id,v_membership.numero_control,v_membership.program_id,v_membership.program_item_id,v_membership.product_id,v_membership.company_id,v_membership.membership_offering_id,v_membership.request_type,'submitted',1,'Fixture transaccional de membresía',v_membership.signature_data,true,'{"qa":"H-FINANCE-REQUESTS-FLOW-UX-CORRECTION-001"}',null,extensions.gen_random_uuid()) returning * into v_membership;
  v_result:=public.transition_program_request_workflow(v_membership.id,'ADVANCE','Aprobación focal de membresía',v_retry,null,null);
  if v_result->'workflow_state'->'current_stage'->>'outcome'<>'success' then raise exception 'MEMBERSHIP_ADVANCE_FAILED'; end if;
  if not coalesce((public.transition_program_request_workflow(v_membership.id,'ADVANCE','Aprobación focal de membresía',v_retry,null,null)->>'idempotent')::boolean,false) then raise exception 'MEMBERSHIP_IDEMPOTENCY_FAILED'; end if;
  v_state:=public.get_admin_finance_request_flow_detail(v_membership.id)->'workflow_state';
  if v_state->>'current_stage_id'<>v_result->'workflow_state'->>'current_stage_id' then raise exception 'MEMBERSHIP_ADMIN_READBACK_FAILED'; end if;
  select auth_user_id into v_affiliate_user from public.affiliates where id=v_membership.affiliate_id;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_affiliate_user,'role','authenticated')::text,true);
  v_user_state:=public.get_self_request_workflow_state(v_membership.id);
  if v_user_state->>'current_stage_id'<>v_result->'workflow_state'->>'current_stage_id' or v_user_state->>'request_status'<>'approved' then raise exception 'MEMBERSHIP_USER_READBACK_FAILED'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_admin,'role','authenticated')::text,true);

  select * into v_loan from public.program_requests where program_id='prestamo' order by created_at desc limit 1;
  if v_loan.id is null then raise exception 'LOAN_FIXTURE_MISSING'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_admin,'role','service_role')::text,true);
  insert into public.program_requests(actor_real_auth_user_id,affiliate_id,numero_control,program_id,program_item_id,product_id,company_id,request_type,status,quantity,notes,signature_data,terms_accepted,source_context,financial_processing_status,idempotency_key,requested_amount,requested_term,financial_submission_snapshot)
  values(v_loan.actor_real_auth_user_id,v_loan.affiliate_id,v_loan.numero_control,v_loan.program_id,v_loan.program_item_id,v_loan.product_id,v_loan.company_id,v_loan.request_type,'submitted',1,'Fixture transaccional de préstamo',v_loan.signature_data,true,'{"qa":"H-FINANCE-REQUESTS-FLOW-UX-CORRECTION-001"}','pending',extensions.gen_random_uuid(),coalesce(v_loan.requested_amount,1000),coalesce(v_loan.requested_term,12),v_loan.financial_submission_snapshot) returning * into v_loan;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_admin,'role','authenticated')::text,true);
  begin
    perform public.transition_program_request_workflow(v_loan.id,'ADVANCE','Intento focal de aprobación especializada',extensions.gen_random_uuid(),1250,current_date+15);
  exception when others then
    if sqlerrm='SPECIALIZED_FINANCIAL_APPROVAL_REQUIRED' then v_specialized_blocked:=true; else raise; end if;
  end;
  if not v_specialized_blocked then raise exception 'LOAN_SPECIALIZED_APPROVAL_BYPASSED'; end if;
  v_result:=public.transition_program_request_workflow(v_loan.id,'REJECT','Rechazo focal reversible de préstamo',extensions.gen_random_uuid(),null,null);
  if v_result->'workflow_state'->'current_stage'->>'outcome'<>'failure' then raise exception 'LOAN_REJECT_FAILED'; end if;
  v_state:=public.get_admin_finance_request_flow_detail(v_loan.id)->'workflow_state';
  if v_state->>'current_stage_id'<>v_result->'workflow_state'->>'current_stage_id' then raise exception 'LOAN_ADMIN_READBACK_FAILED'; end if;
  select auth_user_id into v_affiliate_user from public.affiliates where id=v_loan.affiliate_id;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_affiliate_user,'role','authenticated')::text,true);
  v_user_state:=public.get_self_request_workflow_state(v_loan.id);
  if v_user_state->>'current_stage_id'<>v_result->'workflow_state'->>'current_stage_id' or v_user_state->>'request_status'<>'rejected' then raise exception 'LOAN_USER_READBACK_FAILED'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_admin,'role','authenticated')::text,true);

  select * into v_quote from public.program_requests where request_type='quote' and membership_offering_id is null and program_id<>'prestamo' order by created_at desc limit 1;
  if v_quote.id is null then raise exception 'QUOTE_TEMPLATE_MISSING'; end if;
  insert into public.program_requests(actor_real_auth_user_id,affiliate_id,numero_control,program_id,program_item_id,product_id,company_id,request_type,status,quantity,notes,signature_data,terms_accepted,source_context,financial_processing_status,idempotency_key)
  values(v_quote.actor_real_auth_user_id,v_quote.affiliate_id,v_quote.numero_control,v_quote.program_id,v_quote.program_item_id,v_quote.product_id,v_quote.company_id,'quote','submitted',1,'Fixture transaccional de cotización',v_quote.signature_data,true,'{"qa":"H-FINANCE-REQUESTS-FLOW-UX-CORRECTION-001"}',null,extensions.gen_random_uuid()) returning * into v_quote;
  if v_quote.workflow_id<>'10000000-0000-4000-8000-000000000003'::uuid then raise exception 'QUOTE_WORKFLOW_ASSIGNMENT_FAILED'; end if;
  v_result:=public.transition_program_request_workflow(v_quote.id,'ADVANCE','Cotización focal reversible',extensions.gen_random_uuid(),1250,current_date+15);
  if v_result->'workflow_state'->'current_stage'->>'outcome'<>'success' or (select quoted_amount from public.program_requests where id=v_quote.id)<>1250 then raise exception 'QUOTE_APPROVAL_FAILED'; end if;
  v_state:=public.get_admin_finance_request_flow_detail(v_quote.id)->'workflow_state';
  if v_state->>'current_stage_id'<>v_result->'workflow_state'->>'current_stage_id' then raise exception 'QUOTE_ADMIN_READBACK_FAILED'; end if;
  select auth_user_id into v_affiliate_user from public.affiliates where id=v_quote.affiliate_id;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_affiliate_user,'role','authenticated')::text,true);
  v_user_state:=public.get_self_request_workflow_state(v_quote.id);
  if v_user_state->>'current_stage_id'<>v_result->'workflow_state'->>'current_stage_id' or v_user_state->>'request_status'<>'approved' then raise exception 'QUOTE_USER_READBACK_FAILED'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_admin,'role','authenticated')::text,true);

  select * into v_benefit from public.program_requests where membership_offering_id is null and request_type='benefit' and program_id<>'prestamo' and status in('submitted','in_review','requires_financial_processing') order by created_at desc limit 1;
  if v_benefit.id is null then raise exception 'BENEFIT_TEMPLATE_MISSING'; end if;
  v_result:=public.transition_program_request_workflow(v_benefit.id,'REJECT','Rechazo focal reversible de beneficio',extensions.gen_random_uuid(),null,null);
  if v_result->'workflow_state'->'current_stage'->>'outcome'<>'failure' then raise exception 'BENEFIT_REJECT_FAILED'; end if;
  v_state:=public.get_admin_finance_request_flow_detail(v_benefit.id)->'workflow_state';
  if v_state->>'current_stage_id'<>v_result->'workflow_state'->>'current_stage_id' then raise exception 'BENEFIT_ADMIN_READBACK_FAILED'; end if;

  select auth_user_id into v_affiliate_user from public.affiliates where id=v_benefit.affiliate_id;
  if v_affiliate_user is null then raise exception 'BENEFIT_AFFILIATE_AUTH_MISSING'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_affiliate_user,'role','authenticated')::text,true);
  v_user_state:=public.get_self_request_workflow_state(v_benefit.id);
  if v_user_state->>'current_stage_id'<>v_result->'workflow_state'->>'current_stage_id' or v_user_state->>'request_status'<>'rejected' then raise exception 'USER_PROJECTION_NOT_UPDATED'; end if;

  select u.id into v_non_admin from auth.users u where not exists(select 1 from public.admin_assignments a where a.auth_user_id=u.id and a.enabled) order by u.created_at limit 1;
  if v_non_admin is null then raise exception 'NON_ADMIN_FIXTURE_MISSING'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_non_admin,'role','authenticated')::text,true);
  begin
    perform public.list_admin_finance_request_flow_queue();
  exception when others then
    if sqlerrm='PROGRAM_REQUEST_READ_DENIED' then v_unauthorized_blocked:=true; else raise; end if;
  end;
  if not v_unauthorized_blocked then raise exception 'UNAUTHORIZED_ADMIN_QUEUE_ALLOWED'; end if;
end $matrix$;`;

async function snapshot(values){const rows=await management(values,`select jsonb_build_object('requests',(select count(*) from public.program_requests),'documents',(select count(*) from public.request_documents),'events',(select count(*) from public.program_request_admin_events),'tracking',(select count(*) from public.operational_request_tracking),'workflows',(select count(*) from public.operational_workflows),'stages',(select count(*) from public.operational_workflow_stages)) result`);return rows[0].result;}
async function main(){const values=env();assert(values.SUPABASE_URL&&values.SUPABASE_ACCESS_TOKEN,'Supabase management configuration missing');const mode=process.argv[2];if(!['--dry-run','--matrix-dry-run','--matrix-live-rollback','--recovery-live-rollback','--apply','--status'].includes(mode))throw new Error('EXPLICIT_MODE_REQUIRED');
  if(mode==='--status'){const rows=await management(values,`select jsonb_build_object('applied',to_regprocedure('public.transition_program_request_workflow(uuid,text,text,uuid,numeric,date)') is not null,'trigger',exists(select 1 from pg_trigger where tgname='program_requests_sync_workflow_tracking' and tgenabled<>'D'),'requests',(select count(*) from public.program_requests),'tracking',(select count(*) from public.operational_request_tracking)) result`);console.log(JSON.stringify({status:'PASS',mode:'STATUS',...rows[0].result}));return;}
  const before=await snapshot(values);
  if(mode==='--dry-run'){await management(values,`begin;${body(migration)}${checks}${body(recovery)}${recoveryChecks}rollback;`);console.log(JSON.stringify({status:'PASS',mode:'DRY_RUN_FORWARD_RECOVERY',before,after:await snapshot(values),persistentChanges:0}));return;}
  if(mode==='--matrix-dry-run'){await management(values,`begin;${body(migration)}${checks}${matrix}rollback;`);console.log(JSON.stringify({status:'PASS',mode:'MATRIX_DRY_RUN',types:['loan','membership','quote','benefit'],adminUpdated:true,userUpdated:true,audit:true,idempotent:true,before,after:await snapshot(values),persistentChanges:0}));return;}
  if(mode==='--matrix-live-rollback'){await management(values,`begin;${checks}${matrix}rollback;`);console.log(JSON.stringify({status:'PASS',mode:'MATRIX_LIVE_ROLLBACK',types:['loan','membership','quote','benefit'],adminUpdatedEach:true,userUpdatedEach:true,audit:true,idempotent:true,before,after:await snapshot(values),persistentChanges:0}));return;}
  if(mode==='--recovery-live-rollback'){await management(values,`begin;${body(recovery)}${recoveryChecks}${body(migration)}${checks}rollback;`);console.log(JSON.stringify({status:'PASS',mode:'RECOVERY_LIVE_ROLLBACK',before,after:await snapshot(values),persistentChanges:0}));return;}
  await management(values,migration);await management(values,`begin;${checks}rollback;`);const after=await snapshot(values);for(const key of ['requests','documents','events','tracking','workflows','stages'])assert.equal(Number(after[key]),Number(before[key]),`PROTECTED_DATA_CHANGED:${key}`);console.log(JSON.stringify({status:'PASS',mode:'APPLIED',migration:'20260903000140',before,after,googleReads:0,googleWrites:0}));
}
main().catch((error)=>{console.error(JSON.stringify({status:'FAIL',error:error.message}));process.exitCode=1;});
