'use strict';
// Candidate migration and recovery always run inside one rolled-back transaction.
const fs=require('fs'),path=require('path'),assert=require('assert').strict;
const root=path.resolve(__dirname,'..'),env={},installed=process.argv.includes('--installed');
for(const line of fs.readFileSync(process.env.SUTIAPP_TEST_ENV_FILE||'C:/Users/david/OneDrive/Documentos/Sutiapp 20082026/supabase.env','utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const at=line.indexOf('=');if(at>0)env[line.slice(0,at).trim()]=line.slice(at+1).trim().replace(/^['"]|['"]$/g,'');}
const quote=s=>"'"+String(s).replace(/'/g,"''")+"'";
const body=file=>fs.readFileSync(path.join(root,file),'utf8').replace(/^begin;\s*/i,'').replace(/commit;\s*$/i,'');
async function main(){
  const login=await fetch(env.SUPABASE_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:env.H005_TEST_EMAIL,password:env.H005_TEST_PASSWORD})});
  const session=await login.json();assert(login.ok,'QA_LOGIN_FAILED');
  const sql=`begin;
    ${installed?'':body('supabase/migrations/20260908000100_requests_workflow_google_sync.sql')}
    select set_config('request.jwt.claim.role','authenticated',true);
    select set_config('request.jwt.claim.sub',${quote(session.user.id)},true);
    create temporary table sync_test_results(test text primary key,result text not null);
    do $families$ declare
      loan public.program_requests%rowtype;member public.program_requests%rowtype;r public.program_requests%rowtype;again public.program_requests%rowtype;
      docs uuid[];product uuid;family text;branch text;request_key uuid;v jsonb;before_hash text;submission jsonb;phone text;count_steps integer;
    begin
      select * into loan from public.program_requests where id='5cd836ad-3681-40c8-8cfc-803ac1af2e34';
      select * into member from public.program_requests where affiliate_id=loan.affiliate_id and program_id='membership' and applicant_profile_snapshot is not null order by created_at desc limit 1;
      select id into loan.terms_version_id from public.program_terms_versions where program_id='prestamo' and membership_offering_id is null and published order by version desc limit 1;
      select id into member.terms_version_id from public.program_terms_versions where membership_offering_id=member.membership_offering_id and published order by version desc limit 1;
      select array_agg(id) into docs from (select distinct on(document_type_id) id from public.affiliate_documents where affiliate_id=loan.affiliate_id and status in('PENDING_REVIEW','UNDER_REVIEW','VERIFIED') order by document_type_id,created_at desc,id desc) d;
      select id into product from public.program_catalog_items where enabled and not sold and request_mode='supabase' and commercial_mode='PAYROLL_QUOTE' and program_key<>'prestamo' order by id limit 1;
      select notification_phone into phone from public.loan_request_deposit_snapshots where request_id=loan.id;
      if member.id is null or product is null or phone is null then raise exception 'QA_FAMILY_SOURCE_MISSING';end if;
      submission:=(loan.financial_submission_snapshot-'deposit')||jsonb_build_object('deposit_selection',jsonb_build_object('bank_account_id',null,'notification_phone',phone));
      foreach family in array array['prestamo','membership','product'] loop
        foreach branch in array array['advance','reject','cancel'] loop
          request_key:=gen_random_uuid();
          if family='prestamo' then
            perform set_config('request.jwt.claim.role','service_role',true);
            r:=public.create_validated_financial_program_request(loan.actor_real_auth_user_id,loan.affiliate_id,null,loan.program_item_id,'QA transaction only',loan.signature_data,loan.terms_version_id,docs,request_key,loan.requested_amount,loan.requested_term::integer,loan.requested_term_semantics,(submission->>'profile_version')::int,submission);
            again:=public.create_validated_financial_program_request(loan.actor_real_auth_user_id,loan.affiliate_id,null,loan.program_item_id,'QA transaction only',loan.signature_data,loan.terms_version_id,docs,request_key,loan.requested_amount,loan.requested_term::integer,loan.requested_term_semantics,(submission->>'profile_version')::int,submission);
          elsif family='membership' then
            perform set_config('request.jwt.claim.role','authenticated',true);
            r:=public.create_membership_request(member.membership_offering_id,docs,member.applicant_profile_snapshot->>'phone',member.applicant_profile_snapshot->>'rfc',member.applicant_profile_snapshot->>'curp',member.terms_version_id,request_key);
            again:=public.create_membership_request(member.membership_offering_id,docs,member.applicant_profile_snapshot->>'phone',member.applicant_profile_snapshot->>'rfc',member.applicant_profile_snapshot->>'curp',member.terms_version_id,request_key);
          else
            perform set_config('request.jwt.claim.role','authenticated',true);
            r:=public.create_program_request_with_documents(product,null,1,'QA transaction only',loan.signature_data,true,request_key,docs);
            again:=public.create_program_request_with_documents(product,null,1,'QA transaction only',loan.signature_data,true,request_key,docs);
          end if;
          if r.id is null or r.id<>again.id then raise exception 'CREATION_NOT_IDEMPOTENT';end if;
          if (select count(*) from public.program_request_google_sync where request_id=r.id and revision=1 and desired_status='PENDIENTE')<>1 then raise exception 'CREATION_QUEUE_MISSING';end if;
          before_hash:=md5(r.workflow_snapshot::text);
          if family='product' and r.workflow_id=loan.workflow_id then raise exception 'PRODUCT_REQUIRES_DISTINCT_REAL_WORKFLOW';end if;
          perform set_config('request.jwt.claim.role','authenticated',true);
          perform public.record_program_request_admin_action(r.id,'MARK_IN_REVIEW','QA transaction only',gen_random_uuid());
          v:=public.resolve_program_request_workflow_state(r.id);
          if v->>'request_status'<>'in_review' or not exists(select 1 from public.program_request_admin_events where request_id=r.id and action='MARK_IN_REVIEW' and actor_auth_user_id=auth.uid()) then raise exception 'REVIEW_OR_ACTOR_NOT_PERSISTED';end if;
          if not exists(select 1 from public.list_self_program_request_history() h where h->>'id'=r.id::text and h->>'status'='in_review') then raise exception 'SELF_REVIEW_MISSING';end if;
          if branch='cancel' then
            perform public.record_program_request_admin_action(r.id,'CANCEL','QA cancellation reason',gen_random_uuid());
          elsif branch='reject' then
            perform public.transition_program_request_workflow(r.id,'REJECT','QA rejection reason',gen_random_uuid());
          elsif family<>'prestamo' then
            count_steps:=0;
            while (select status from public.program_requests where id=r.id)<>'approved' loop
              perform public.transition_program_request_workflow(r.id,'ADVANCE','QA approval stage',gen_random_uuid(),case when r.request_type='quote' then 100 else null end,null);
              count_steps:=count_steps+1;if count_steps>12 then raise exception 'FLOW_DID_NOT_COMPLETE';end if;
            end loop;
          else
            -- Loan final approval is exercised by the actual Edge + writer audit, not a bypass RPC.
            begin
              perform public.transition_program_request_workflow(r.id,'ADVANCE','QA cannot bypass loan approval',gen_random_uuid());
              raise exception 'FINANCIAL_APPROVAL_BYPASS';
            exception when raise_exception then if sqlerrm<>'SPECIALIZED_FINANCIAL_APPROVAL_REQUIRED' then raise;end if;end;
          end if;
          if before_hash<>(select md5(workflow_snapshot::text) from public.program_requests where id=r.id) then raise exception 'FAMILY_SNAPSHOT_CHANGED';end if;
          if branch in('cancel','reject') and not exists(select 1 from public.list_self_program_request_history() h where h->>'id'=r.id::text and h->>'decision_comment'=case when branch='cancel' then 'QA cancellation reason' else 'QA rejection reason' end) then raise exception 'SELF_DECISION_REASON_MISSING';end if;
          if branch in('cancel','reject') and not exists(select 1 from public.program_request_google_sync where request_id=r.id and desired_status='Rechazado') then raise exception 'TERMINAL_GOOGLE_MAPPING_FAILED';end if;
          if branch='advance' and family<>'prestamo' and not exists(select 1 from public.program_request_google_sync where request_id=r.id and desired_status='APROBADO') then raise exception 'APPROVAL_GOOGLE_MAPPING_FAILED';end if;
          insert into sync_test_results values(family||': create idempotency review self timeline '||branch,'PASS');
        end loop;
      end loop;
    end $families$;
    do $test$ declare r uuid:='5cd836ad-3681-40c8-8cfc-803ac1af2e34';before_hash text;v jsonb;job jsonb;row jsonb;event_id uuid:=gen_random_uuid();
    begin
      if not public.has_admin_permission('program_requests.write') then raise exception 'QA_ADMIN_REQUIRED';end if;
      select md5(workflow_snapshot::text) into before_hash from public.program_requests where id=r;
      v:=public.resolve_program_request_workflow_state(r);
      if v->>'request_status'<>'in_review' or not (v->>'can_reject')::boolean then raise exception 'REVIEW_PROJECTION_FAILED';end if;
      if not exists(select 1 from jsonb_array_elements(v->'stages') s where s->>'state'='current' and (s->>'date')::timestamptz='2026-09-08T16:00:29.297674+00:00'::timestamptz) then raise exception 'PERSISTED_REVIEW_DATE_FAILED';end if;
      insert into sync_test_results values('persisted review and rejection availability','PASS');
      begin
        perform public.claim_program_request_google_sync(r);
        raise exception 'BROWSER_CLAIM_ALLOWED';
      exception when insufficient_privilege then null;end;
      if has_table_privilege('authenticated','public.program_request_google_sync','SELECT') or has_function_privilege('authenticated','public.finish_program_request_google_sync(uuid,bigint,jsonb,integer,text)','EXECUTE') then raise exception 'TRANSPORT_PRIVILEGE_EXPOSED';end if;
      insert into sync_test_results values('transport service-only grants','PASS');
      perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
      begin perform public.get_program_request_google_sync(r);raise exception 'UNLINKED_USER_READ_ALLOWED';exception when insufficient_privilege then null;end;
      begin perform public.request_program_request_google_sync(r);raise exception 'UNLINKED_USER_WRITE_ALLOWED';exception when insufficient_privilege then null;end;
      begin perform public.resolve_program_request_workflow_state(r);raise exception 'UNLINKED_USER_WORKFLOW_ALLOWED';exception when insufficient_privilege then null;end;
      perform set_config('request.jwt.claim.sub',${quote(session.user.id)},true);
      insert into sync_test_results values('unlinked authenticated identity denied without nullable permission bypass','PASS');
      v:=public.request_program_request_google_sync(r);
      perform set_config('request.jwt.claim.role','service_role',true);
      job:=public.claim_program_request_google_sync(r);
      if (job->>'revision')::integer<>1 or job->>'desired_status'<>'PENDIENTE' then raise exception 'INITIAL_QUEUE_FAILED';end if;
      if public.claim_program_request_google_sync(r) is not null then raise exception 'DOUBLE_LEASE';end if;
      row:=to_jsonb(array_fill(''::text,array[33]));row:=jsonb_set(row,'{0}',to_jsonb(r::text));row:=jsonb_set(row,'{24}','"PENDIENTE"');
      perform public.finish_program_request_google_sync(r,1,row,2,null);
      perform public.finish_program_request_google_sync(r,1,row,null,'LATE_FAILURE');
      if public.get_program_request_google_sync(r)->>'phase'<>'synced' then raise exception 'LATE_FAILURE_REGRESSED_SUCCESS';end if;
      insert into sync_test_results values('initial queue lease and late-response idempotency','PASS');
      perform set_config('request.jwt.claim.role','authenticated',true);
      v:=public.transition_program_request_workflow(r,'REJECT','QA transactional rejection only',event_id);
      if v->'workflow_state'->>'request_status'<>'rejected' then raise exception 'REJECTION_NOT_PERSISTED';end if;
      if not exists(select 1 from jsonb_array_elements(v->'workflow_state'->'stages') s where s->>'outcome'='failure' and s->>'state'='done') then raise exception 'FAILURE_TIMELINE_INCOMPLETE';end if;
      if not (public.transition_program_request_workflow(r,'REJECT','QA transactional rejection only',event_id)->>'idempotent')::boolean then raise exception 'ACTION_NOT_IDEMPOTENT';end if;
      if (select count(*) from public.program_request_admin_events where client_action_id=event_id)<>1 then raise exception 'DUPLICATE_ACTION';end if;
      if before_hash<>(select md5(workflow_snapshot::text) from public.program_requests where id=r) then raise exception 'SNAPSHOT_CHANGED';end if;
      insert into sync_test_results values('rejection audit timeline snapshot and duplicate action','PASS');
      perform set_config('request.jwt.claim.role','service_role',true);
      job:=public.claim_program_request_google_sync(r);
      if job->>'desired_status'<>'Rechazado' or (job->>'revision')::int<>2 then raise exception 'REJECTION_QUEUE_FAILED';end if;
      perform public.finish_program_request_google_sync(r,1,row,2,null);
      if public.get_program_request_google_sync(r)->>'phase'<>'processing' then raise exception 'OLD_FINISH_STOLE_LEASE';end if;
      perform public.finish_program_request_google_sync(r,2,row,2,null);
      if public.get_program_request_google_sync(r)->>'phase'<>'synced' then raise exception 'REJECTION_SYNC_FAILED';end if;
      insert into sync_test_results values('same row rejection monotonic delivery','PASS');
      perform set_config('request.jwt.claim.role','authenticated',true);
      perform public.list_self_program_request_history();
      insert into sync_test_results values('self history RPC candidate compatibility','PASS');
    end $test$;
    ${body('supabase/recovery/20260908000100_requests_workflow_google_sync_recovery.sql')}
    do $test$ begin
      if exists(select 1 from pg_trigger where tgrelid='public.program_requests'::regclass and tgname='program_requests_google_sync') or exists(select 1 from cron.job where jobname='program-request-google-sync') then raise exception 'RECOVERY_TRANSPORT_ACTIVE';end if;
      insert into sync_test_results values('recovery disables delivery and restores workflow','PASS');
    end $test$;
    select jsonb_agg(to_jsonb(t) order by test) results from sync_test_results t;
    rollback;`;
  const ref=new URL(env.SUPABASE_URL).hostname.split('.')[0];
  const response=await fetch('https://api.supabase.com/v1/projects/'+ref+'/database/query',{method:'POST',headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query:sql})});
  const data=await response.json();
  if(!response.ok){const message=String(data.message||'');console.error(JSON.stringify({status:'FAIL',http:response.status,error:message.split('\nCONTEXT:')[0].slice(0,1500),functions:message.match(/function [^\n]+/g)}));process.exitCode=1;return;}
  const proof={status:'PASS',environment:installed?'installed backend':'candidate migration',transaction:'ROLLBACK',committedRequestWrites:0,results:data};
  fs.writeFileSync(path.join(root,'docs/qa/evidence/requests-workflow-google-sync-20260908/'+(installed?'installed-sql.json':'candidate-sql.json')),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
