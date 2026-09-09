'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert').strict;
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/finance-request-confirmation-20260908');
const values={};
for(const line of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const at=line.indexOf('=');if(at>0&&!line.trim().startsWith('#'))values[line.slice(0,at).trim()]=line.slice(at+1).trim().replace(/^['"]|['"]$/g,'');}
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20260908000600_request_event_notifications.sql'),'utf8');
const recovery=fs.readFileSync(path.join(root,'supabase/recovery/20260908000600_request_event_notifications.sql'),'utf8');
const body=s=>s.replace(/^begin;\s*/i,'').replace(/commit;\s*$/i,'');
async function query(sql){const ref=new URL(values.SUPABASE_URL).hostname.split('.')[0];const response=await fetch('https://api.supabase.com/v1/projects/'+ref+'/database/query',{method:'POST',headers:{Authorization:'Bearer '+values.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query:sql})});const data=await response.json();if(!response.ok)throw Error('SQL '+response.status+' '+JSON.stringify(data).slice(0,500));return data;}
const checks=`
do $test$
declare sample record; first_claim boolean; second_claim boolean; n integer;
begin
 if has_table_privilege('authenticated','public.program_request_event_receipts','select') or has_table_privilege('authenticated','public.program_request_event_receipts','insert') then raise exception 'RECEIPT_TABLE_EXPOSED'; end if;
 if has_function_privilege('anon','public.list_self_request_event_notifications()','execute') or has_function_privilege('anon','public.mark_self_request_event_seen(uuid)','execute') then raise exception 'ANON_RPC_EXPOSED'; end if;
 if not(select relrowsecurity and relforcerowsecurity from pg_class where oid='public.program_request_event_receipts'::regclass) then raise exception 'RLS_MISSING'; end if;
 select e.id,e.request_id,r.affiliate_id,a.auth_user_id into sample
 from public.program_request_admin_events e join public.program_requests r on r.id=e.request_id join public.affiliates a on a.id=r.affiliate_id
 where a.auth_user_id is not null and e.action<>'COMMENT' and (e.from_status<>e.to_status or e.from_stage_id is distinct from e.to_stage_id)
 and not(r.program_id='marketplace' and r.request_type='quote' and e.to_status not in('rejected','cancelled')) limit 1;
 if sample.id is null then raise exception 'NO_LIVE_EVENT_FOR_ROLLBACK_TEST'; end if;
 perform set_config('request.jwt.claim.sub',sample.auth_user_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',sample.auth_user_id,'role','authenticated')::text,true);
 select count(*) into n from public.list_self_request_event_notifications() event where event->>'id'=sample.id::text;
 if n<>1 then raise exception 'OWN_EVENT_NOT_VISIBLE'; end if;
 if exists(select 1 from public.list_self_request_event_notifications() event join public.program_requests r on r.id=(event->>'request_id')::uuid where r.affiliate_id<>sample.affiliate_id) then raise exception 'CROSS_USER_READ'; end if;
 first_claim:=public.mark_self_request_event_seen(sample.id);second_claim:=public.mark_self_request_event_seen(sample.id);
 if not first_claim or second_claim then raise exception 'ATOMIC_CLAIM_FAILED'; end if;
 if (select count(*) from public.program_request_event_receipts where event_id=sample.id)<>1 then raise exception 'DUPLICATE_RECEIPT'; end if;
 begin perform public.mark_self_request_event_seen('00000000-0000-0000-0000-000000000000');raise exception 'UNKNOWN_EVENT_ACCEPTED';exception when insufficient_privilege then null;end;
 select a.auth_user_id,a.id into sample.auth_user_id,sample.affiliate_id from public.affiliates a where a.auth_user_id is not null and a.id<>sample.affiliate_id limit 1;
 perform set_config('request.jwt.claim.sub',sample.auth_user_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',sample.auth_user_id,'role','authenticated')::text,true);
 begin perform public.mark_self_request_event_seen(sample.id);raise exception 'CROSS_USER_WRITE';exception when insufficient_privilege then null;end;
end $test$;
`;
async function main(){
 fs.mkdirSync(out,{recursive:true});
 const before=await query("select count(*) requests,(select count(*) from public.program_request_admin_events) events,(select count(*) from public.operational_request_tracking) tracking from public.program_requests");
 const installed=await query("select to_regprocedure('public.list_self_request_event_notifications()') is not null installed");
 assert.equal(installed[0].installed,false,'Migration already present: do not rerun installation test');
 await query('begin;'+body(migration)+checks+body(recovery)+'rollback;');
 const after=await query("select count(*) requests,(select count(*) from public.program_request_admin_events) events,(select count(*) from public.operational_request_tracking) tracking from public.program_requests");assert.deepEqual(after,before);
 const proof={status:'PASS',migrationSha256:require('crypto').createHash('sha256').update(migration).digest('hex'),migrationCompile:'PASS',recoveryCompile:'PASS',selfRead:'PASS',crossUser:'PASS',atomicSeen:'PASS',duplicateReceipts:0,rls:'PASS',businessRowsUnchanged:true,transaction:'ROLLBACK',before,after};
 fs.writeFileSync(path.join(out,'sql.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
