'use strict';
const fs=require('fs'),assert=require('assert').strict,t=require('./request-push-tools');
const migration=fs.readFileSync(t.root+'/supabase/migrations/20260908000700_request_web_push.sql','utf8'),recovery=fs.readFileSync(t.root+'/supabase/recovery/20260908000700_request_web_push.sql','utf8');
const checks=`
insert into public.request_push_config(public_key,enabled) values(repeat('A',87),true);
do $test$
declare sample record; other_user uuid; device1 uuid;device2 uuid;event1 uuid;event2 uuid;job jsonb; n integer;
begin
 select r.id request_id,r.affiliate_id,a.auth_user_id into sample from public.program_requests r join public.affiliates a on a.id=r.affiliate_id where a.auth_user_id is not null and public.request_push_affiliate(a.auth_user_id)=a.id limit 1;
 if sample.request_id is null then raise exception 'NO_VALID_REQUEST_FOR_ROLLBACK'; end if;
 select auth_user_id into other_user from public.affiliates where auth_user_id is not null and auth_user_id<>sample.auth_user_id and public.request_push_affiliate(auth_user_id)=id limit 1;
 if other_user is null then raise exception 'NO_SECOND_IDENTITY'; end if;
 perform set_config('request.jwt.claim.sub',sample.auth_user_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',sample.auth_user_id,'role','authenticated')::text,true);
 device1:=public.register_self_request_push('https://fcm.googleapis.com/test/isolated-one',repeat('A',87),repeat('B',22));
 device2:=public.register_self_request_push('https://fcm.googleapis.com/test/isolated-two',repeat('A',87),repeat('B',22));
 if device1=device2 or device1<>public.register_self_request_push('https://fcm.googleapis.com/test/isolated-one',repeat('A',87),repeat('B',22)) then raise exception 'DEVICE_IDEMPOTENCY'; end if;
 begin perform public.register_self_request_push('http://127.0.0.1/private',repeat('A',87),repeat('B',22));raise exception 'SSRF_ACCEPTED';exception when invalid_parameter_value then null;end;
 begin perform public.register_self_request_push('https://fcm.googleapis.com@evil.test/push',repeat('A',87),repeat('B',22));raise exception 'SSRF_USERINFO_ACCEPTED';exception when invalid_parameter_value then null;end;
 perform set_config('request.jwt.claim.sub',other_user::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',other_user,'role','authenticated')::text,true);
 if public.revoke_self_request_push(device1) then raise exception 'CROSS_USER_REVOKE'; end if;
 begin perform public.register_self_request_push('https://fcm.googleapis.com/test/isolated-one',repeat('A',87),repeat('B',22));raise exception 'CROSS_USER_TAKEOVER';exception when insufficient_privilege then null;end;
 if exists(select 1 from public.request_push_deliveries) then raise exception 'HISTORICAL_BACKFILL'; end if;
 -- Synthetic events only inside this rolled-back transaction; no production transition.
 insert into public.program_request_admin_events(request_id,actor_auth_user_id,actor_label,action,from_status,to_status,client_action_id)
 values(sample.request_id,sample.auth_user_id,'Isolated SQL QA','ADVANCE_STAGE','in_review','approved',gen_random_uuid()) returning id into event1;
 if (select count(*) from public.request_push_deliveries where event_id=event1)<>2 then raise exception 'MULTI_DEVICE_ENQUEUE'; end if;
 insert into public.program_request_admin_events(request_id,actor_auth_user_id,actor_label,action,from_status,to_status,client_action_id)
 values(sample.request_id,sample.auth_user_id,'Isolated SQL QA','COMMENT','in_review','in_review',gen_random_uuid()) returning id into event2;
 if exists(select 1 from public.request_push_deliveries where event_id=event2) then raise exception 'COMMENT_PUSH'; end if;
 begin
   insert into public.program_request_admin_events(request_id,actor_auth_user_id,actor_label,action,from_status,to_status,client_action_id)
   values(sample.request_id,sample.auth_user_id,'Isolated SQL QA','REJECT','in_review','rejected',gen_random_uuid());
   raise exception 'ROLLBACK_EVENT' using errcode='P0002';
 exception when no_data_found then null;end;
 if (select count(*) from public.request_push_deliveries)<>2 then raise exception 'FAILED_ATTEMPT_PUSH'; end if;
 select q into job from public.claim_request_push_batch() q limit 1;
 if job is null or not(job->>'authorized')::boolean then raise exception 'AUTHORIZED_PROJECTION'; end if;
 select count(*) into n from public.claim_request_push_batch();if n<>0 then raise exception 'LEASE_DUPLICATE'; end if;
 if not public.finish_request_push((job->>'id')::uuid,(job->>'lease_token')::uuid,503) then raise exception 'RETRY_RECEIPT'; end if;
 if public.finish_request_push((job->>'id')::uuid,(job->>'lease_token')::uuid,201) then raise exception 'STALE_LEASE_ACCEPTED'; end if;
 update public.request_push_deliveries set next_attempt_at=now()-interval '1 second' where id=(job->>'id')::uuid;
 select q into job from public.claim_request_push_batch() q limit 1;
 perform public.finish_request_push((job->>'id')::uuid,(job->>'lease_token')::uuid,410);
 if exists(select 1 from public.request_push_subscriptions where id=(job->>'subscription_id')::uuid and (endpoint is not null or auth_key is not null or revoked_at is null)) then raise exception 'EXPIRED_KEYS_RETAINED'; end if;
 perform set_config('request.jwt.claim.sub',sample.auth_user_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',sample.auth_user_id,'role','authenticated')::text,true);
 if not public.revoke_self_request_push(device1) or not public.revoke_self_request_push(device2) then raise exception 'OWN_REVOKE'; end if;
 if exists(select 1 from public.request_push_deliveries where status in('pending','sending')) then raise exception 'REVOKED_JOB_SENDABLE'; end if;
 if exists(select 1 from public.request_push_deliveries d join public.request_push_subscriptions s on s.id=d.subscription_id join public.program_request_admin_events e on e.id=d.event_id join public.program_requests r on r.id=e.request_id where r.affiliate_id<>s.affiliate_id) then raise exception 'CROSS_USER_DELIVERY'; end if;
 if exists(select 1 from (values('request_push_config'),('request_push_subscriptions'),('request_push_deliveries'),('request_push_attempts')) t(name) where has_table_privilege('authenticated','public.'||name,'select') or has_table_privilege('anon','public.'||name,'select') or not(select relrowsecurity and relforcerowsecurity from pg_class where oid=('public.'||name)::regclass)) then raise exception 'RLS_OR_EXPOSURE'; end if;
 if has_function_privilege('authenticated','public.claim_request_push_batch()','execute') or has_function_privilege('anon','public.register_self_request_push(text,text,text,timestamptz)','execute') or has_function_privilege('authenticated','public.request_push_affiliate(uuid)','execute') then raise exception 'PRIVILEGED_RPC_EXPOSED'; end if;
end $test$;
`;
async function main(){
 const installed=await t.sql("select to_regclass('public.request_push_subscriptions') is not null installed");assert.equal(installed[0].installed,false,'Installation test requires absent migration');
 const before=await t.sql(t.business);
 await t.sql('begin;'+t.body(migration)+checks+t.body(recovery)+'rollback;');
 const after=await t.sql(t.business);assert.deepEqual(after,before);
 t.proof('sql',{status:'PASS',migrationSha256:t.sha(migration),recoverySha256:t.sha(recovery),transaction:'ROLLBACK',multipleDevices:'PASS',selfRevoke:'PASS',crossUser:'PASS',expiredCleanup:'PASS',leasesRetries:'PASS',rollbackNoPush:'PASS',rls:'PASS',duplicates:0,crossUserDelivery:0,businessUnchanged:true});
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
