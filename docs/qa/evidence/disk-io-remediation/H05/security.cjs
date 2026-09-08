'use strict';
const a=require('./audit.cjs'),b=require('./benchmark.cjs'),c=require('./conditional-tests.cjs');
async function main(live=false){
 const sql="begin;set local statement_timeout='35s';set local lock_timeout='2s';"+b.setup+(live?'':c.ddl())+c.helper+`
 create function pg_temp.h05_outcome(conditional boolean,known text default null) returns jsonb language plpgsql security invoker as $$
 declare v jsonb;begin
  if conditional then v:=public.get_self_savings_if_changed(known)->'data';else v:=public.get_self_savings_live_readonly();end if;
  return jsonb_build_object('data',v);
 exception when others then return jsonb_build_object('error',SQLSTATE);end;$$;
 select set_config('request.jwt.claims','{"role":"anon"}',true);set local role anon;
 insert into h05_checks values('anon',pg_temp.h05_outcome(true)=pg_temp.h05_outcome(false) and pg_temp.h05_outcome(true)->>'error'='42501');reset role;
 select set_config('request.jwt.claims','{"role":"authenticated"}',true);set local role authenticated;
 insert into h05_checks values('missing_actor',pg_temp.h05_outcome(true)=pg_temp.h05_outcome(false) and pg_temp.h05_outcome(true)->>'error'='42501');reset role;
 select set_config('request.jwt.claims',(select jsonb_build_object('sub',auth_id,'role','authenticated','session_id','h05-security')::text from h05_cases where label='PROCESS_1_1'),true);
 insert into h05_versions values('owner',pg_temp.h05_read());
 select set_config('request.jwt.claims',(select jsonb_build_object('sub',auth_id,'role','authenticated','session_id','h05-security')::text from h05_cases where label='PROCESS_1_2'),true);
 insert into h05_versions values('other',pg_temp.h05_read((select value->>'version' from h05_versions where label='owner')));
 set local role authenticated;
 insert into h05_checks select 'other_cannot_reuse_owner',o.value->>'modified'='true' and o.value->'data'=public.get_self_savings_live_readonly() and o.value#>'{context,effective_affiliate_id}'<>v.value#>'{context,effective_affiliate_id}' from h05_versions o,h05_versions v where o.label='other' and v.label='owner';reset role;
 create temporary table h05_principal as select x.auth_user_id from public.admin_assignments x join public.admin_roles r on r.id=x.role_id
 where x.enabled and r.enabled and r.code='principal_admin' and not exists(select 1 from public.impersonation_sessions s where s.actor_real_auth_user_id=x.auth_user_id and s.ended_at is null) limit 1;
 do $$begin if (select count(*) from h05_principal)<>1 then raise exception 'H05_PRINCIPAL_WITHOUT_ACTIVE_IMPERSONATION_REQUIRED';end if;end;$$;
 select set_config('request.jwt.claims',(select jsonb_build_object('sub',auth_user_id,'role','authenticated','session_id','h05-imp-rollback')::text from h05_principal),true);
 set local role authenticated;
 insert into h05_checks values('admin_original_equivalence',pg_temp.h05_outcome(true)=pg_temp.h05_outcome(false));
 select public.start_affiliate_impersonation((select affiliate_id from h05_cases where label='PROCESS_1_1'),'H05 rollback-only security test');reset role;
 insert into h05_versions values('imp',pg_temp.h05_read((select value->>'version' from h05_versions where label='owner')));
 set local role authenticated;
 insert into h05_checks select 'impersonation',value->>'modified'='true' and value->'data'=public.get_self_savings_live_readonly() and value#>>'{context,impersonation_id}' is not null and value#>>'{context,effective_affiliate_id}'=(select affiliate_id::text from h05_cases where label='PROCESS_1_1') from h05_versions where label='imp';reset role;
 select set_config('request.jwt.claims',(select jsonb_build_object('sub',auth_user_id,'role','authenticated','session_id','h05-imp-other-session')::text from h05_principal),true);
 set local role authenticated;
 insert into h05_checks values('impersonation_wrong_session',pg_temp.h05_outcome(true,(select value->>'version' from h05_versions where label='imp'))=pg_temp.h05_outcome(false) and not exists(select 1 from public.get_impersonation_context()));reset role;
 select label,pass from h05_checks order by label;rollback;`;
 // Anonymous may write only our test results, never financial relations.
 const rows=await a.raw(sql.replace('grant select,insert on h05_versions,h05_checks to authenticated;','grant select,insert on h05_versions,h05_checks to authenticated,anon;'));
 const pass=rows.length===6&&rows.every(x=>x.pass===true);a.save('security'+(live?'-live':''),{at:new Date().toISOString(),status:pass?'PASS':'FAIL',rows,notes:'No target parameter. Existing actor/effective affiliate and impersonation authorization used; real principals, new impersonation session and audit rolled back. Existing sessions/roles/affiliates unchanged.'});console.log(JSON.stringify({status:pass?'PASS':'FAIL',rows}));if(!pass)throw Error('SECURITY_FAILED');
}
if(require.main===module)main(process.argv.includes('--live')).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={main};
