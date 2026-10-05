'use strict';
// Explicit owner-authorized additive release. No business rows are inserted/updated/deleted.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'.tmp/finance-blocks'),out=path.join(root,'docs/qa/evidence/finance-blocks');
const version='20261004000300',read=f=>fs.readFileSync(path.join(root,f),'utf8'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const forward=read('supabase/migrations/'+version+'_finance_blocks.sql'),recovery=read('supabase/recovery/'+version+'_finance_blocks.sql');
const env={};for(const line of read('supabase.env').replace(/^\uFEFF/,'').split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)env[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}
const url='https://api.supabase.com/v1/projects/'+new URL(env.SUPABASE_URL).hostname.split('.')[0]+'/database/query';
async function query(sql,write=false){const r=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query:sql,read_only:!write}),signal:AbortSignal.timeout(90000)});if(!r.ok){fs.writeFileSync(path.join(dir,'release-error-private.json'),await r.text());throw Error('SQL_HTTP_'+r.status);}return r.json();}
function proof(name,value){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'release-'+name+'.json'),JSON.stringify(value,null,2)+'\n');console.log(JSON.stringify(value));}
const objects=`select jsonb_build_object('version_exists',exists(select 1 from supabase_migrations.schema_migrations where version='${version}'),'table_exists',to_regclass('public.finance_blocks') is not null,'events_exist',to_regclass('public.finance_block_events') is not null,'latest',(select max(version) from supabase_migrations.schema_migrations),'dependencies',(select jsonb_object_agg(n.nspname||'.'||p.proname,md5(pg_get_functiondef(p.oid))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='public' and p.proname in ('get_effective_affiliate_id','has_admin_permission','admin_module_boundary')) or (n.nspname='admin_support_private' and p.proname='module_visible')),'columns',(select md5(jsonb_agg(jsonb_build_array(table_name,column_name,data_type,is_nullable) order by table_name,ordinal_position)::text) from information_schema.columns where table_schema='public' and table_name in ('program_requests','affiliates')),'triggers',(select md5(coalesce(jsonb_agg(pg_get_triggerdef(oid) order by tgname)::text,'[]')) from pg_trigger where tgrelid='public.program_requests'::regclass and not tgisinternal)) state`;
const acl=`select jsonb_build_object('tables',(select jsonb_agg(jsonb_build_object('name',relname,'rls',relrowsecurity,'forced',relforcerowsecurity,'anon_select',has_table_privilege('anon',oid,'SELECT'),'authenticated_select',has_table_privilege('authenticated',oid,'SELECT'),'authenticated_insert',has_table_privilege('authenticated',oid,'INSERT'),'service_select',has_table_privilege('service_role',oid,'SELECT'))) from pg_class where oid in ('public.finance_blocks'::regclass,'public.finance_block_events'::regclass)),'functions',(select jsonb_agg(jsonb_build_object('name',p.proname,'hash',md5(pg_get_functiondef(p.oid)),'definer',p.prosecdef,'config',p.proconfig,'anon',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated',has_function_privilege('authenticated',p.oid,'EXECUTE'),'service',has_function_privilege('service_role',p.oid,'EXECUTE'))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('get_self_finance_block','list_admin_finance_blocks','save_admin_finance_block','revoke_admin_finance_block','enforce_finance_request_block')),'trigger',exists(select 1 from pg_trigger where tgrelid='public.program_requests'::regclass and tgname='zz_finance_request_block' and tgenabled='O'),'blocks',(select count(*) from public.finance_blocks),'events',(select count(*) from public.finance_block_events)) state`;
function verifyAcl(s){assert.equal(s.tables.length,2);for(const t of s.tables)assert(t.rls&&t.forced&&!t.anon_select&&!t.authenticated_select&&!t.authenticated_insert&&!t.service_select,'TABLE_ACL');assert.equal(s.functions.length,5);for(const f of s.functions){assert(f.definer&&!f.anon&&!f.service,'FUNCTION_ACL');assert.equal(f.authenticated,f.name!=='enforce_finance_request_block');assert(f.config.some(x=>/^search_path=/.test(x)),'SEARCH_PATH');}assert(s.trigger,'TRIGGER_MISSING');}
async function main(){
 const mode=process.argv[2];
 if(mode==='prepare'){
  for(const f of ['sql.json','browser.json'])assert.equal(JSON.parse(read('docs/qa/evidence/finance-blocks/'+f)).status,'PASS','ISOLATED_TEST_REQUIRED');
  const state=(await query(objects))[0].state;assert(!state.version_exists&&!state.table_exists&&!state.events_exist,'VERSION_OR_OBJECT_ALREADY_PRESENT');
  const saved={state,forwardSha256:sha(forward),recoverySha256:sha(recovery),preparedAt:new Date().toISOString()};fs.writeFileSync(path.join(dir,'release-before.json'),JSON.stringify(saved,null,2));
  proof('prepare',{status:'PASS',migration:version,latest:state.latest,forwardSha256:saved.forwardSha256,recoverySha256:saved.recoverySha256,existingBusinessWrites:0});return;
 }
 if(mode==='apply'){
  const before=JSON.parse(fs.readFileSync(path.join(dir,'release-before.json'),'utf8'));assert.equal(sha(forward),before.forwardSha256);assert.equal(sha(recovery),before.recoverySha256);assert.deepEqual((await query(objects))[0].state,before.state,'LIVE_CATALOG_DRIFT');
  const body=forward.replace(/^begin;\s*/i,'').replace(/commit;\s*$/i,'');assert(!body.includes('$finance_release$'));
  const fingerprint=`do $fp$ declare t text; v text; n bigint; begin foreach t in array array['affiliates','program_requests','financial_programs','financial_funds','financial_rules','savings_participants','savings_enrollments','savings_transactions','savings_movements','savings_contributions'] loop if to_regclass('public.'||t) is not null then execute format('select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text)::text,''[]'')),count(*) from public.%I r',t) into v,n; insert into finance_release_fingerprints values(t,v,n);end if;end loop;end $fp$;`;
  const baselineSql=JSON.stringify(before.state).replace(/'/g,"''");
  const sql=`begin isolation level repeatable read; set local lock_timeout='2s';set local statement_timeout='60s';
   lock table public.affiliates,public.program_requests in share row exclusive mode;
   do $guard$ declare s jsonb; begin select state into s from (${objects}) q; if s is distinct from '${baselineSql}'::jsonb then raise exception 'LIVE_CATALOG_DRIFT';end if;end $guard$;
   create temporary table finance_release_fingerprints(name text primary key,hash text,n bigint) on commit drop;
   ${fingerprint}
   create temporary table finance_release_before on commit drop as select * from finance_release_fingerprints;
   create temporary table finance_release_functions on commit drop as select p.oid,md5(pg_get_functiondef(p.oid)) hash,p.proacl::text acl,p.proowner from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','admin_support_private') and p.prokind in ('f','p');
   ${body}
   truncate finance_release_fingerprints;
   ${fingerprint}
   do $verify$ begin
    if exists(select 1 from finance_release_before b full join finance_release_fingerprints a using(name) where b.hash is distinct from a.hash or b.n is distinct from a.n) then raise exception 'BUSINESS_FINGERPRINT_CHANGED';end if;
    if exists(select 1 from finance_release_functions b left join pg_proc p on p.oid=b.oid where p.oid is null or b.hash is distinct from md5(pg_get_functiondef(p.oid)) or b.acl is distinct from p.proacl::text or b.proowner is distinct from p.proowner) then raise exception 'EXISTING_FUNCTION_CHANGED';end if;
    if exists(select 1 from public.finance_blocks) or exists(select 1 from public.finance_block_events) then raise exception 'UNEXPECTED_BUSINESS_ROWS';end if;
    if exists(select 1 from pg_class where oid in ('public.finance_blocks'::regclass,'public.finance_block_events'::regclass) and (not relrowsecurity or not relforcerowsecurity or has_table_privilege('authenticated',oid,'SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('anon',oid,'SELECT,INSERT,UPDATE,DELETE'))) then raise exception 'TABLE_ACL_FAILED';end if;
   end $verify$;
   insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','finance_blocks',array[$finance_release$${body}$finance_release$]);
   select jsonb_build_object('preserved_tables',count(*),'existing_functions_preserved',(select count(*) from finance_release_functions),'business_writes',0) receipt from finance_release_before;
   commit;`;
  const receipt=await query(sql,true);const state=(await query(acl))[0].state;verifyAcl(state);assert.equal(Number(state.blocks),0);assert.equal(Number(state.events),0);
  fs.writeFileSync(path.join(dir,'release-after.json'),JSON.stringify(state,null,2));
  proof('apply',{status:'PASS',migration:version,forwardSha256:sha(forward),receipt,rlsAclVerified:true,newBlocks:0,newEvents:0,existingBusinessWrites:0});return;
 }
 if(mode==='verify'){
  assert.equal((await query(objects))[0].state.version_exists,true);const state=(await query(acl))[0].state;verifyAcl(state);
  proof('backend',{status:'PASS',migration:version,rlsAclVerified:true,triggerEnabled:state.trigger,blocks:Number(state.blocks),events:Number(state.events),functions:state.functions.map(({name,hash})=>({name,hash})),businessWrites:0});return;
 }
 throw Error('MODE prepare|apply|verify');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
