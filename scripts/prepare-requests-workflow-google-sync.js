'use strict';
// Preserve the live function bodies and make only the documented projection/transition edits.
const fs=require('fs'),path=require('path'),assert=require('assert').strict;
const root=path.resolve(__dirname,'..'),ep=path.join(root,'docs/qa/evidence/requests-workflow-google-sync-20260908');
const definitions=JSON.parse(fs.readFileSync(path.join(ep,'before-functions.json'),'utf8')).concat(JSON.parse(fs.readFileSync(path.join(ep,'before-quote-functions.json'),'utf8')));
const get=name=>{const d=definitions.find(d=>d.proname===name);assert(d,name);return d.definition.trimEnd()+';\n';};
function replace(source,before,after){assert(source.includes(before),'Missing exact SQL anchor: '+before);return source.replace(before,after);}
const changed=[];
let source=get('sync_program_request_tracking_from_status');
source=replace(source,"begin\n  select s into v_stage", "begin\n  if tg_op='UPDATE' and (new.status is not distinct from old.status or current_setting('app.workflow_transition_request',true)=new.id::text) then return new; end if;\n  select s into v_stage");changed.push(source);
source=get('resolve_program_request_workflow_state');
source=replace(source,"if auth.role()<>'service_role'", "if coalesce(auth.role(),'')<>'service_role'");
source=replace(source,"and not(\n    auth.uid()", "and not coalesce(\n    auth.uid()");
source=replace(source,") then raise exception 'REQUEST_WORKFLOW_DENIED'",",false) then raise exception 'REQUEST_WORKFLOW_DENIED'");
source=replace(source,"'state',case when (stage->>'sort_order')::integer<v_current_order then 'done' when stage->>'id'=v_current then 'current' else 'upcoming' end,",`'state',case
        when stage->>'id'=v_current and r.status in('approved','rejected','cancelled') and stage->>'outcome' in('success','failure') then 'done'
        when (stage->>'sort_order')::integer<v_current_order and (r.status not in('rejected','cancelled') or t.stage_dates?(stage->>'id') or exists(select 1 from public.program_request_admin_events e where e.request_id=r.id and e.action<>'COMMENT' and (e.from_stage_id::text=stage->>'id' or e.to_stage_id::text=stage->>'id'))) then 'done'
        when stage->>'id'=v_current then 'current' else 'upcoming' end,`);
source=replace(source,"'date',t.stage_dates->>(stage->>'id')",`'date',coalesce((select min(e.created_at)::text from public.program_request_admin_events e
        where e.request_id=r.id and e.action='MARK_IN_REVIEW' and e.to_stage_id::text=stage->>'id'),t.stage_dates->>(stage->>'id'))`);
source=replace(source,"'request_status',r.status,'current_stage_id'",`'can_reject',r.status not in('approved','rejected','cancelled') and exists(select 1 from jsonb_array_elements(r.workflow_snapshot->'stages') s where s->>'outcome'='failure' and s->'status_references'?'rejected'),
    'can_quote',r.request_type='quote' and r.program_id<>'prestamo' and r.financial_submission_snapshot is null and r.requested_amount is null and r.financial_approval_snapshot is null,
    'request_status',r.status,'current_stage_id'`);changed.push(source);
source=get('transition_program_request_workflow');
source=replace(source,"if v_request.financial_processing_status is not null then", "if v_request.financial_processing_status is not null and not (v_request.request_type='quote' and v_request.program_id<>'prestamo' and v_request.financial_submission_snapshot is null and v_request.requested_amount is null and v_request.financial_approval_snapshot is null) then");
source=replace(source,"set status='approved',quoted_amount=", "set status='approved',financial_processing_status=null,quoted_amount=");
source=replace(source,"  if v_to_status is distinct from v_request.status then", "  perform set_config('app.workflow_transition_request',v_request.id::text,true);\n  if v_to_status is distinct from v_request.status then");
source=replace(source,"  else\n    select coalesce(stage_dates,'{}'::jsonb) into v_dates", "  end if;\n  perform set_config('app.workflow_transition_request','',true);\n  -- Persist the exact snapshot target even when several stages share a status.\n    select coalesce(stage_dates,'{}'::jsonb) into v_dates");
source=replace(source,"  end if;\n\n  insert into public.program_request_admin_events(","  update public.program_requests set updated_at=now() where id=v_request.id;\n\n  insert into public.program_request_admin_events(");changed.push(source);
source=get('list_self_program_request_history');
source=replace(source,"'workflow_state',public.resolve_program_request_workflow_state(r.id),",`'workflow_state',public.resolve_program_request_workflow_state(r.id),
    'decision_comment',(select e.comment from public.program_request_admin_events e where e.request_id=r.id and e.action in('REJECT','CANCEL') order by e.created_at desc,e.id desc limit 1),
    'google_sync',public.get_program_request_google_sync(r.id),`);changed.push(source);
source=get('create_program_request');
source=replace(source,"v_status:=case when v_item.legacy_boundary then", "v_status:=case when v_item.legacy_boundary and v_item.program_key='prestamo' then");
source=replace(source,"v_financial_status:=case when v_item.legacy_boundary then", "v_financial_status:=case when v_item.legacy_boundary and v_item.program_key='prestamo' then");changed.push(source);
const migration=path.join(root,'supabase/migrations/20260908000100_requests_workflow_google_sync.sql');
const base=fs.readFileSync(migration,'utf8').split('-- Existing workflow functions are updated below')[0];
fs.writeFileSync(migration,base+'-- Existing workflow functions are updated below without replacing their business rules.\n'+changed.join('\n')+"\nnotify pgrst,'reload schema';\ncommit;\n");
const recovery=`begin;
select cron.unschedule(jobid) from cron.job where jobname='program-request-google-sync';
drop trigger if exists program_requests_google_sync on public.program_requests;
alter publication supabase_realtime drop table public.program_requests;
${['sync_program_request_tracking_from_status','resolve_program_request_workflow_state','transition_program_request_workflow','list_self_program_request_history','create_program_request'].map(get).join('\n')}
-- Retain transport rows as audit evidence; recovery never deletes request/Google history.
revoke all on public.program_request_google_sync from authenticated,service_role;
revoke all on function public.request_program_request_google_sync(uuid),public.claim_program_request_google_sync(uuid),public.finish_program_request_google_sync(uuid,bigint,jsonb,integer,text) from authenticated,service_role;
notify pgrst,'reload schema';
commit;
`;
fs.writeFileSync(path.join(root,'supabase/recovery/20260908000100_requests_workflow_google_sync_recovery.sql'),recovery);
console.log(JSON.stringify({status:'PASS',liveBodiesPreserved:changed.length,historicalDataRewrites:0}));
