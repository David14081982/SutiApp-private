'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const {query,environment,root,privateDir}=require('./investors-db');
const out=path.join(root,'docs/qa/evidence/investors'),version='20261029000100',file='supabase/migrations/'+version+'_investors.sql';
const hash=x=>crypto.createHash('sha256').update(x).digest('hex'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const quote=s=>"'"+String(s).replace(/'/g,"''")+"'";
const snapshot=`select jsonb_build_object('schema_exists',exists(select 1 from pg_namespace where nspname='investors_private'),'version_exists',exists(select 1 from supabase_migrations.schema_migrations where version='${version}'),'dependencies',(select jsonb_object_agg(n.nspname||'.'||p.proname,md5(pg_get_functiondef(p.oid))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='public' and p.proname in('has_admin_permission','admin_module_boundary','get_effective_affiliate_id','has_admin_module')) or (n.nspname='admin_support_private' and p.proname='module_visible')),'authorization_hash',md5(concat_ws('|',(select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text)::text,'[]')) from public.admin_roles r),(select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text)::text,'[]')) from public.admin_role_permissions r),(select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text)::text,'[]')) from public.admin_assignments r)))) state`;
function proof(name,value){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(value,null,2)+'\n');console.log(JSON.stringify(value));}
function tests(){for(const name of ['sql','import','browser','scope','build'])assert.equal(JSON.parse(read('docs/qa/evidence/investors/'+name+'.json')).status,'PASS',name.toUpperCase()+'_REQUIRED');}
async function main(){
 const mode=process.argv[2],forward=read(file),body=forward.replace(/^begin;\s*/,'').replace(/commit;\s*$/,''),recovery=read('supabase/recovery/'+version+'_investors.sql').replace(/^.*?begin;\s*/s,'').replace(/commit;\s*$/,'');
 assert(!/create\s+or\s+replace|drop\s|truncate\s|delete\s+from\s+public\./i.test(forward),'ADDITIVE_ONLY');
 if(mode==='prepare'){
  tests();const state=(await query(snapshot))[0].state;assert(!state.schema_exists&&!state.version_exists,'ALREADY_INSTALLED');
  const env=environment(),identities=await query(`select id,public.has_admin_permission('program_requests.write') from auth.users where email=${quote(env.H005_TEST_EMAIL)} limit 1`);
  assert.equal(identities.length,1,'EXISTING_TEST_ADMIN_REQUIRED');
  const ordinary=await query(`select u.id from auth.users u where not exists(select 1 from public.admin_assignments a where a.auth_user_id=u.id) and u.id<>${quote(identities[0].id)}::uuid limit 1`);
  fs.writeFileSync(path.join(privateDir,'backend-release-before.json'),JSON.stringify({state,admin:identities[0].id,ordinary:ordinary[0]?.id||'00000000-0000-4000-8000-000000000099',sha256:hash(forward)},null,2));
  proof('backend-prepare',{status:'PASS',sourceSha256:hash(forward),dependencyDefinitionsPreserved:true,authorizationHash:state.authorization_hash});return;
 }
 const before=JSON.parse(fs.readFileSync(path.join(privateDir,'backend-release-before.json'),'utf8'));assert.equal(hash(forward),before.sha256,'MIGRATION_CHANGED');
 const claims=id=>`select set_config('request.jwt.claims',${quote(JSON.stringify({sub:id,role:'authenticated',session_id:'inversores-transactional-verification'}))},true);`;
 if(mode==='dry-run'){
  tests();assert.deepEqual((await query(snapshot))[0].state,before.state,'LIVE_DRIFT');
  const sql=`begin;${body}
   ${claims(before.ordinary)}set local role authenticated;
   do $test$ begin begin perform public.get_admin_investors();raise exception 'ORDINARY_READ_ALLOWED';exception when insufficient_privilege then null;end;begin perform public.save_admin_investors('investor','{"name":"Synthetic denied","reason":"transactional"}',gen_random_uuid());raise exception 'ORDINARY_WRITE_ALLOWED';exception when insufficient_privilege then null;end;end $test$;
   reset role;${claims(before.admin)}set local role authenticated;
   do $test$ declare v jsonb; i uuid; begin
    v:=public.get_admin_investors();if v#>>'{data,can_write}'<>'true' then raise exception 'ADMIN_WRITE_NOT_AVAILABLE';end if;
    v:=public.save_admin_investors('investor','{"name":"Synthetic rollback only","reason":"H-ADMIN-INVERSIONISTAS-001 focal verification"}',gen_random_uuid());i:=(v#>>'{data,id}')::uuid;
    if i is null then raise exception 'CREATE_FAILED';end if;
    begin execute 'select * from investors_private.investors';raise exception 'DIRECT_TABLE_ALLOWED';exception when insufficient_privilege then null;end;
   end $test$;
   reset role;set local role anon;
   do $test$ begin begin perform public.get_admin_investors();raise exception 'ANON_ALLOWED';exception when insufficient_privilege then null;end;end $test$;
   reset role;${recovery}
   select jsonb_build_object('status','PASS','real_admin_helper',true,'ordinary_denied',true,'anon_denied',true,'direct_table_denied',true,'recovery_compiled',true,'synthetic_rows_persisted',0) receipt;
   rollback;`;
  const results=await query(sql,true);assert.deepEqual((await query(snapshot))[0].state,before.state);
  proof('backend-dry-run',{status:'PASS',sourceSha256:hash(forward),receipt:results.filter(x=>x.receipt).map(x=>x.receipt),existingAuthorizationUnchanged:true});return;
 }
 if(mode==='apply'){
  tests();assert.equal(JSON.parse(read('docs/qa/evidence/investors/backend-dry-run.json')).sourceSha256,hash(forward));assert.deepEqual((await query(snapshot))[0].state,before.state,'LIVE_DRIFT');
  const result=await query(`begin;${body}insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','investors',array[${quote(body)}]);select 'INSTALLED' receipt;commit;`,true);
  proof('backend-applied',{status:'PASS',migration:version,sourceSha256:hash(forward),result});return;
 }
 if(mode==='verify'){
  const state=(await query(snapshot))[0].state;assert(state.schema_exists&&state.version_exists);assert.deepEqual(state.dependencies,before.state.dependencies);assert.equal(state.authorization_hash,before.state.authorization_hash);
  const acl=await query(`select c.relname name,c.relrowsecurity rls,c.relforcerowsecurity forced,has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') anon,has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') authenticated from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='investors_private' and c.relkind='r'`);
  assert.equal(acl.length,11);assert(acl.every(r=>r.rls&&r.forced&&!r.anon&&!r.authenticated));
  proof('backend-verified',{status:'PASS',migration:version,privateTables:acl.length,forcedRls:true,directAccessDenied:true,existingAuthorizationUnchanged:true});return;
 }
 throw Error('MODE prepare|dry-run|apply|verify');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
