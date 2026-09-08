'use strict';
const fs=require('fs'),a=require('./audit.cjs');
const setup=fs.readFileSync(a.dir+'/matrix-setup.sql','utf8'),candidate=fs.readFileSync(a.dir+'/candidate-split.sql','utf8');
function configuration(mode){
 const permissions=mode==='assets_admin'?['assets.read']:mode==='documents_admin'?['documents.read']:mode==='program_admin'?['program_catalog.read']:mode.startsWith('impersonation')?['affiliates.impersonate']:['news.read'];
 let sql='';
 if(!['owner','other','principal','anon'].includes(mode)){
  sql+=`insert into h04_ids select 'role',extensions.gen_random_uuid();
   insert into public.admin_roles(id,code,name) select id,'h04_probe_'||replace(id::text,'-',''),'H04 rollback-only' from h04_ids where label='role';
   insert into public.admin_role_permissions(role_id,permission) select id,p from h04_ids cross join unnest(array[${permissions.map(x=>"'"+x+"'").join(',')}]) p where label='role';
   insert into public.admin_assignments(auth_user_id,role,permissions,role_id,assigned_by_auth_user_id)
    select auth_id,'visual_admin',array[]::text[],(select id from h04_ids where label='role'),(select auth_id from h04_actors where label='principal') from h04_actors where label='other';`;
 }
 const actor=['owner','principal'].includes(mode)?mode:'other';
 sql+=`select set_config('request.jwt.claims',${mode==='anon'?"'{}'":`(select jsonb_build_object('sub',auth_id,'role','authenticated','session_id','h04-matrix-session')::text from h04_actors where label='${actor}')`},true);`;
 if(mode.startsWith('impersonation')){
  sql+=`set local role authenticated;insert into h04_results values('impersonation_start',jsonb_build_object('started',exists(select 1 from public.start_affiliate_impersonation((select affiliate_id from h04_actors where label='owner'),'H04 rollback-only security matrix'))));set local role postgres;`;
  if(mode==='impersonation_expired')sql+=`update public.impersonation_sessions set started_at=now()-interval '31 minutes',expires_at=now()-interval '1 minute' where actor_real_auth_user_id=(select auth_id from h04_actors where label='other') and actor_auth_session_id='h04-matrix-session' and ended_at is null;`;
  if(mode==='impersonation_revoked')sql+=`delete from public.admin_role_permissions where role_id=(select id from h04_ids where label='role');`;
  if(mode==='impersonation_wrong_session')sql+=`select set_config('request.jwt.claims',(select jsonb_build_object('sub',auth_id,'role','authenticated','session_id','h04-different-session')::text from h04_actors where label='other'),true);`;
 }
 return sql;
}
async function run(mode,live=false){
 const role=mode==='anon'?'anon':'authenticated';
 const q="begin;set local statement_timeout='45s';set local lock_timeout='2s';"+setup+configuration(mode)+
  `set local role ${role};insert into h04_results values('before',pg_temp.h04_evaluate());set local role postgres;`+(live?'':candidate)+
  `set local statement_timeout='10s';set local role ${role};insert into h04_results values('after',pg_temp.h04_evaluate());set local role postgres;`+
  `do $$ begin if (select value from h04_results where label='before') is distinct from (select value from h04_results where label='after') then raise exception 'H04_AUTHORIZATION_CHANGED';end if;end $$;
   select jsonb_object_agg(label,value) result from h04_results;rollback;`;
 const started=Date.now(),data=await a.raw(q),result=data[0].result;
 if(mode==='owner'&&(!result.before._owner_context||!result.before.photo_current||result.before.direct_rejected))throw Error('OWNER_BASELINE_INVALID');
 if(mode==='other'&&(result.before._owner_context||result.before.direct_ine_verified))throw Error('OTHER_BASELINE_INVALID');
 if(mode==='impersonation'&&!result.before._owner_context)throw Error('IMPERSONATION_NOT_ACTIVE');
 if(mode.startsWith('impersonation_')&&result.before._owner_context)throw Error('IMPERSONATION_NOT_REJECTED');
 if(live)require('assert').strict.deepEqual(result.before,require('./matrix-'+mode+'.json').before,'DEPLOYED_AUTHORIZATION_CHANGED');
 a.save('matrix-'+(live?'live-':'')+mode,{at:new Date().toISOString(),status:'PASS',mode,cases:16,equal:true,http_ms:Date.now()-started,persistent_fixture_rows:0,...result});
 console.log(JSON.stringify({mode,status:'PASS',cases:16,http_ms:Date.now()-started,before:result.before}));
}
if(require.main===module)(async()=>{for(const mode of process.argv.slice(2).filter(x=>x!=='--live'))await run(mode,process.argv.includes('--live'));})().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={run,configuration};
