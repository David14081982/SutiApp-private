'use strict';
const {query,forward,body}=require('./savings-runtime-db'),input=require('./savings-source-observation-input'),assert=require('assert/strict');
async function main(){
 const data=input(),literal=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb";
 const fp=()=>query("select (select md5(string_agg(to_jsonb(r)::text,'' order by id)) from savings_review_records r) reviews,(select count(*) from savings_review_events) events,(select count(*) from savings_transactions) money");
 const before=await fp(),migration=body('supabase/migrations/20260913000400_savings_source_refresh.sql');
 await query('begin;'+forward()+migration+body('supabase/recovery/20260913000400_savings_source_refresh_recovery.sql')+'rollback;');
 await query('begin;'+forward()+migration+`
 select set_config('request.jwt.claims','{"role":"service_role"}',true);
 select public.import_savings_source_observations('${data.sha}','${data.observed_at}',${literal(data.rows)});
 select public.import_savings_source_observations('${data.sha}','${data.observed_at}',${literal(data.rows)});
 do $t$ declare actor uuid;obs public.savings_source_observations;r public.savings_review_records;ctx jsonb;k uuid;before_events int;begin
  if (select count(*) from public.savings_source_observations)<>3 then raise exception 'SOURCE_RETRY_DUPLICATED';end if;
  select auth_user_id into actor from public.admin_assignments where enabled and 'savings.approve'=any(permissions) limit 1;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
  for obs in select * from public.savings_source_observations loop
   select * into r from public.savings_review_records where id=obs.record_id;
   ctx:=public.savings_certification_context(r.id);
   if ctx#>>'{source_update,pending}'<>'true' then raise exception 'SOURCE_NOT_PENDING';end if;
   select count(*) into before_events from public.savings_review_events;
   k:=extensions.gen_random_uuid();
   perform public.admin_accept_savings_source(r.id,obs.id,r.version,k);
   perform public.admin_accept_savings_source(r.id,obs.id,r.version,k);
   ctx:=public.savings_certification_context(r.id);
   if ctx#>>'{source_update,pending}'<>'false' or (ctx#>>'{person,saldo_revision}')::numeric<>obs.source_total then raise exception 'CURRENT_Q_NOT_ACCEPTED';end if;
   if (select count(*) from public.savings_review_events)<>before_events+1 then raise exception 'REVIEW_HISTORY_RETRY';end if;
   if (select source_data from public.savings_review_records where id=r.id) is distinct from r.source_data then raise exception 'SOURCE_OVERWRITTEN';end if;
  end loop;
  if (select count(*) from public.savings_transactions)<>0 then raise exception 'SOURCE_CREATED_MONEY';end if;
  perform set_config('request.jwt.claims','{"role":"anon"}',true);
  begin perform public.admin_accept_savings_source(r.id,obs.id,r.version,extensions.gen_random_uuid());raise exception 'ANON_SOURCE_WRITE';exception when insufficient_privilege then null;end;
 end $t$;rollback;`);
 assert.deepEqual(await fp(),before);console.log('PASS source refresh: 3 observations, 6 dated cells, current Q, original preserved, actor history, retry, security, recovery, persistent writes 0');
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
