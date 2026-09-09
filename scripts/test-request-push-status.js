'use strict';
const fs=require('fs'),assert=require('assert').strict,t=require('./request-push-tools');
const migration=fs.readFileSync(t.root+'/supabase/migrations/20260908000710_request_web_push_device_status.sql','utf8'),recovery=fs.readFileSync(t.root+'/supabase/recovery/20260908000710_request_web_push_device_status.sql','utf8');
const check=`do $$declare own_user uuid;own_affiliate uuid;other_user uuid;device uuid;begin
 select auth_user_id,id into own_user,own_affiliate from public.affiliates where auth_user_id is not null and public.request_push_affiliate(auth_user_id)=id limit 1;
 select auth_user_id into other_user from public.affiliates where auth_user_id is not null and auth_user_id<>own_user limit 1;
 perform set_config('request.jwt.claim.sub',own_user::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',own_user,'role','authenticated')::text,true);
 device:=public.register_self_request_push('https://fcm.googleapis.com/test/isolated-status',repeat('A',87),repeat('B',22));
 if not public.get_self_request_push_status(device) then raise exception 'OWN_STATUS';end if;
 perform set_config('request.jwt.claim.sub',other_user::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',other_user,'role','authenticated')::text,true);
 if public.get_self_request_push_status(device) then raise exception 'CROSS_USER_STATUS';end if;
 perform set_config('request.jwt.claim.sub',own_user::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',own_user,'role','authenticated')::text,true);
 update public.request_push_subscriptions set expiration_at=now()-interval '1 second' where id=device;
 if public.get_self_request_push_status(device) then raise exception 'EXPIRED_STATUS';end if;
 update public.request_push_config set enabled=false;perform public.wake_request_push();
 if exists(select 1 from public.request_push_subscriptions where id=device and (revoked_at is null or endpoint is not null or auth_key is not null)) then raise exception 'EXPIRED_NOT_CLEANED';end if;
 if has_function_privilege('anon','public.get_self_request_push_status(uuid)','execute') then raise exception 'ANON_STATUS';end if;
end $$;`;
(async()=>{
 if(process.argv[2]==='apply'){
  const p=JSON.parse(fs.readFileSync(t.out+'/device-status-sql.json'));assert.equal(p.status,'PASS');assert.equal(p.migrationSha256,t.sha(migration));
  await t.sql('begin;create temporary table push_before as '+t.business+';'+t.body(migration)+"do $$begin if (select row_to_json(b)::text from push_before b)<>(select row_to_json(a)::text from ("+t.business+") a) then raise exception 'BUSINESS_MUTATED';end if;end $$;insert into supabase_migrations.schema_migrations(version,name,statements) values('20260908000710','request_web_push_device_status',array["+t.quote(migration)+']);commit;');
  t.proof('device-status-applied',{status:'PASS',migrationSha256:t.sha(migration),businessUnchanged:true});return;
 }
 const before=await t.sql(t.business);await t.sql('begin;'+t.body(migration)+check+t.body(recovery)+'rollback;');assert.deepEqual(await t.sql(t.business),before);
 t.proof('device-status-sql',{status:'PASS',migrationSha256:t.sha(migration),selfStatus:'PASS',crossUserStatus:'PASS',expiredCleanupWithoutEvents:'PASS',recovery:'PASS',transaction:'ROLLBACK',businessUnchanged:true});
})().catch(e=>{console.error(e.message);process.exitCode=1;});
