'use strict';
// Management reads only; do not add mutating RPC calls or production test DDL here.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {query}=require('./savings-admin-review-db');
const root=path.resolve(__dirname,'..'),privateDir=path.join(root,'tmp/admin-revocation');
const evidenceDir=path.join(root,'docs/qa/evidence/admin-revocation-20260924');
const tables=['admin_assignments','admin_roles','admin_role_permissions','admin_section_definitions','admin_section_responsibilities','admin_audit_log','identity_audit_log','impersonation_sessions'];
const names=['assign_admin_role','revoke_admin_assignment','set_total_admin_by_email','set_section_responsibilities','get_admin_access_context','has_admin_permission','has_section_action','is_module_admin','has_admin_module','module_effective_permissions','module_prior_has_section_action','module_prior_has_admin_permission','module_prior_get_admin_access_context','savings_permission_before_20260906','savings_admin_access_allowed','savings_context_before_20260906','is_active_admin','admin_actor_can_impersonate','get_impersonation_context','start_affiliate_impersonation','stop_affiliate_impersonation','get_admin_user_modules','save_admin_user_modules','admin_user_module_version','get_effective_affiliate_id','admin_module_boundary'];
names.push('list_admin_assignments','list_admin_module_catalog');
const list=xs=>xs.map(s=>"'"+s+"'").join(',');
async function read(sql){return query('begin read only; set local statement_timeout=\'20s\'; '+sql+'; commit;');}
async function main(){
 fs.mkdirSync(privateDir,{recursive:true});fs.mkdirSync(evidenceDir,{recursive:true});
 if(process.argv.includes('--logs')){
  const env={};for(const line of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)env[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}
  const legacy=process.argv.includes('--legacy-logs');
  const url=new URL(`https://api.supabase.com/v1/projects/${new URL(env.SUPABASE_URL).hostname.split('.')[0]}/analytics/endpoints/${legacy?'logs.all':'logs'}`);
  const end=new Date(),start=new Date(end.getTime()-(process.argv.includes('--hour')?1:24)*60*60*1000);
  url.searchParams.set('iso_timestamp_start',start.toISOString());url.searchParams.set('iso_timestamp_end',end.toISOString());
  url.searchParams.set('sql',legacy?"select timestamp,event_message,p.sql_state_code,p.context from postgres_logs cross join unnest(metadata) m cross join unnest(m.parsed) p where regexp_contains(event_message, 'violates check constraint.*admin_assignments_permissions_check') order by timestamp desc limit 30":"select timestamp,event_message,mapKeys(log_attributes) as attribute_keys,arrayExists(x -> position(x,'revoke_admin_assignment') > 0,mapValues(log_attributes)) as revocation_context,arrayExists(x -> position(x,'assign_admin_role') > 0,mapValues(log_attributes)) as assignment_context,log_attributes['parsed.sql_state_code'] as sql_state_code from logs where source = 'postgres_logs' and event_message ilike '%violates check constraint%admin_assignments_permissions_check%' order by timestamp desc limit 30");
  const response=await fetch(url,{headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN}});const payload=await response.json();
  // Preserve only the exact constraint error sentence, never failed rows, SQL, UUIDs or JWTs.
  const rows=payload.result||payload.data||[];
  const errors=Array.isArray(rows)?rows.map(r=>({timestamp:r.timestamp,message:String(r.event_message||'').match(/new row for relation "admin_assignments" violates check constraint "admin_assignments_permissions_check"/)?.[0],sqlstate:r.sql_state_code,revocationContext:Boolean(r.revocation_context)||/revoke_admin_assignment/.test(r.context||''),assignmentContext:Boolean(r.assignment_context)||/assign_admin_role/.test(r.context||''),attributeKeys:r.attribute_keys})).filter(r=>r.message):[];
  const result={endpoint:legacy?'logs.all':'logs',status:response.status,window:{start:start.toISOString(),end:end.toISOString()},errors,queryError:payload.error||null,productionWrites:0};
  fs.writeFileSync(path.join(evidenceDir,legacy?'production-error-logs-legacy.json':'production-error-logs.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));return;
 }
 const snapshot={capturedAt:new Date().toISOString()};
 snapshot.constraint=await read("select pg_get_constraintdef(oid) definition,md5(pg_get_constraintdef(oid)) hash from pg_constraint where conrelid='public.admin_assignments'::regclass and conname='admin_assignments_permissions_check'");
 snapshot.functions=await read(`select n.nspname schema,p.proname name,p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition,md5(pg_get_functiondef(p.oid)) hash,p.proacl::text acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='public' and p.proname in (${list(names)})) or (n.nspname='admin_support_private' and p.proname<>'resolve_current_loan_snapshot_quote') order by n.nspname,p.proname`);
 snapshot.columns=await read(`select c.relname table_name,a.attname name,format_type(a.atttypid,a.atttypmod) type,a.attnotnull not_null,pg_get_expr(d.adbin,d.adrelid) default_expr from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum where n.nspname='public' and c.relname in (${list(tables)}) order by c.relname,a.attnum`);
 snapshot.constraints=await read(`select c.relname table_name,k.conname name,k.contype type,pg_get_constraintdef(k.oid) definition from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in (${list(tables)}) order by c.relname,k.conname`);
 snapshot.triggers=await read(`select c.relname table_name,t.tgname name,pg_get_triggerdef(t.oid) definition,p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) function_definition from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace join pg_proc p on p.oid=t.tgfoid where not t.tgisinternal and n.nspname='public' and c.relname in (${list(tables)}) order by c.relname,t.tgname`);
 snapshot.roles=await read('select code,name,enabled,system_role from public.admin_roles order by code');
 snapshot.security=await read(`select c.relname table_name,c.relrowsecurity rls,c.relforcerowsecurity force_rls from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in (${list(tables)})`);
 snapshot.policies=await read(`select tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies where schemaname='public' and tablename in (${list(tables)})`);
 snapshot.grants=await read(`select table_name,grantee,privilege_type from information_schema.role_table_grants where table_schema='public' and table_name in (${list(tables)}) and grantee in ('anon','authenticated','service_role')`);
 snapshot.rolePermissions=await read('select r.code,p.permission from public.admin_roles r join public.admin_role_permissions p on p.role_id=r.id order by r.code,p.permission');
 snapshot.sections=await read('select * from public.admin_section_definitions order by section_key');
 snapshot.summary=await read(`select (select count(*) from public.admin_assignments) assignments,(select count(*) from public.admin_assignments where protected_assignment) protected_assignments,(select count(*) from public.admin_assignments a where a.enabled and exists(select 1 from public.admin_section_responsibilities g where g.auth_user_id=a.auth_user_id and g.enabled)) active_assignments_with_section_grants,(select count(*) from public.admin_assignments a where not a.enabled and exists(select 1 from public.admin_section_responsibilities g where g.auth_user_id=a.auth_user_id and g.enabled)) revoked_assignments_with_section_grants,to_regclass('public.admin_assignment_voting_permissions_state_20260924000100')::text candidate_state,(select count(*) from supabase_migrations.schema_migrations where version='20260924000100') tracked_candidate`);
 fs.writeFileSync(path.join(privateDir,'baseline.json'),JSON.stringify(snapshot,null,2));
 const fixture={purpose:'ISOLATED_TEST_ONLY: schema and permission catalog; no production accounts or business rows'};
 for(const key of ['constraint','functions','columns','constraints','triggers','security','policies','grants','rolePermissions'])fixture[key]=snapshot[key];
 fixture.roles=snapshot.roles.map(r=>({...r,name:'Fixture '+r.code}));
 fixture.sections=snapshot.sections.map(({created_at,updated_at,...section})=>section);
 fs.mkdirSync(path.join(root,'scripts/fixtures'),{recursive:true});
 fs.writeFileSync(path.join(root,'scripts/fixtures/admin-revocation-20260924.json'),JSON.stringify(fixture,null,2));
 const allowed=[...snapshot.constraint[0].definition.matchAll(/'([^']+)'::text/g)].map(m=>m[1]);
 const missing=snapshot.rolePermissions.filter(p=>!allowed.includes(p.permission));
 const proof={capturedAt:snapshot.capturedAt,productionMode:'READ ONLY',productionWrites:0,constraint:snapshot.constraint,missingRolePermissions:missing,summary:snapshot.summary,functions:snapshot.functions.map(({signature,hash})=>({signature,hash})),privateBaselineSha256:crypto.createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')};
 fs.writeFileSync(path.join(evidenceDir,'production-readonly.json'),JSON.stringify(proof,null,2));
 console.log(JSON.stringify({productionWrites:0,missing,summary:snapshot.summary,functions:snapshot.functions.length,tables:tables.length}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
