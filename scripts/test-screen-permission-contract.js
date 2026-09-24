'use strict';
// Isolated PostgreSQL and synthetic accounts only. No HTTP and no production RPCs.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),cp=require('child_process');
const {sourceInventory,inspect,root,read}=require('./screen-permission-contract');
const {compile}=require('./register-admin-screen');
const {PGlite}=require(path.join(root,'.tmp/savings-loan-eligibility/node_modules/@electric-sql/pglite'));
const metadata=JSON.parse(read('docs/qa/evidence/screen-permissions-20260924/production-metadata.json'));
const baseline=JSON.parse(read('scripts/fixtures/admin-revocation-20260924.json'));
const surfaces=JSON.parse(read('scripts/screen-permission-surfaces.json'));
const clone=x=>JSON.parse(JSON.stringify(x)),qid=s=>'"'+s.replaceAll('"','""')+'"';
const checks=[];
async function main(){
 const db=new PGlite(),inventory=sourceInventory();
 const q=async(sql,args=[])=>(await db.query(sql,args)).rows;
 const scalar=async(sql,args=[])=>(await q(sql,args))[0]?.value;
 const test=async(name,fn)=>{await fn();checks.push(name);console.log('PASS '+name);};
 const owner='00000000-0000-4000-8000-000000000001',target='00000000-0000-4000-8000-000000000002';
 const auth=async id=>{await db.exec('reset role');await q("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id,role:'authenticated',session_id:'preexisting-session'})]);await db.exec('set role authenticated');};
 try{
  await test('every current menu, route, union editor and company view has an explicit classification',()=>assert.equal(inspect(inventory,metadata,surfaces).status,'PASS'));
  await test('new affiliate and company routes block publication until classified',()=>{
   const i=clone(inventory);i.routes.push('future_route');i.companyRoutes.push('future_company');const r=inspect(i,metadata,surfaces);assert(r.errors.includes('UNCLASSIFIED_AFFILIATE_ROUTE:future_route'));assert(r.errors.includes('UNCLASSIFIED_COMPANY_ROUTE:future_company'));
  });
  await test('unregistered menu and sidebar omissions block publication',()=>{
   const i=clone(inventory);i.modules.push({id:'future_panel',label:'Future'});const r=inspect(i,metadata,surfaces);assert(r.errors.includes('MISSING_BACKEND_REGISTRATION:future_panel'));assert(r.errors.includes('MISSING_OR_DUPLICATE_SIDEBAR_GROUP:future_panel'));
  });
  const future=clone(inventory);future.modules.push({id:'future_panel',label:'Synthetic future panel',ready:true,registration:{readPermissions:['news.read'],writePermissions:['news.write'],sections:[],totalOnly:false,boundary:'Isolated test future backend only',backendEvidence:'supabase/migrations/isolated_future.sql',isolatedTest:'scripts/test-isolated-future.js'}});future.permissions.future_panel='news.read';future.groups[0].modules.push('future_panel');
  await test('registered future module also requires assisted visibility, not just its catalog row',()=>{
   const m=clone(metadata);m.sections.push({module_key:'future_panel',enforcement_status:'ENFORCED'});
   assert(inspect(future,m,surfaces).errors.includes('MISSING_ASSISTED_VISIBILITY:future_panel'));
  });
  await test('generator refuses missing security metadata and unknown technical permissions',()=>{
   const no=clone(future);delete no.modules.at(-1).registration;assert.throws(()=>compile(no,metadata,'20260924000200'),/EXPLICIT_BACKEND/);
   const bad=clone(future);bad.modules.at(-1).registration.writePermissions.push('invented.superuser');assert.throws(()=>compile(bad,metadata,'20260924000200'),/UNREGISTERED_TECHNICAL_PERMISSION/);
  });
  await test('build automatically prepares a declared future screen and blocks release until registered',()=>{
   const base=path.join(root,'tmp/screen-permission-tests');fs.mkdirSync(base,{recursive:true});const scratch=fs.mkdtempSync(path.join(base,'future-'));
   for(const p of ['scripts/screen-permission-contract.js','scripts/register-admin-screen.js','scripts/screen-permission-surfaces.json','docs/qa/evidence/screen-permissions-20260924/production-metadata.json','app/screens-admin.jsx','app/screens-company.jsx','app/app.jsx','app/admin-store.jsx','app/union-screen-registry.js']){const dest=path.join(scratch,p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,p),dest);}
   const item=clone(future.modules.at(-1));item.registration.version='20260924000200';
   const admin=read('app/screens-admin.jsx').replace('  const MODULES = [','  const MODULES = ['+JSON.stringify(item)+',').replace('  const MODULE_PERMISSION = Object.freeze({',"  const MODULE_PERMISSION = Object.freeze({future_panel:'news.read',").replace("modules:['administrators'","modules:['future_panel','administrators'");
   fs.writeFileSync(path.join(scratch,'app/screens-admin.jsx'),admin);
   fs.mkdirSync(path.join(scratch,'supabase/migrations'),{recursive:true});fs.writeFileSync(path.join(scratch,item.registration.backendEvidence),"-- ISOLATED ONLY: select admin_module_boundary(array['future_panel'],'update');");fs.writeFileSync(path.join(scratch,item.registration.isolatedTest),'// ISOLATED proof of generation only; not a business writer test.');
   const run=cp.spawnSync(process.execPath,['scripts/screen-permission-contract.js'],{cwd:scratch,encoding:'utf8'});assert.equal(run.status,1);assert.match(run.stderr,/REGISTRATION_SQL_PREPARED_NOT_APPLIED/);
   assert(fs.existsSync(path.join(scratch,'tmp/screen-permission-registration/20260924000200/forward.sql')));
  });
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create role supabase_admin;create schema auth;create schema extensions;create schema admin_support_private;
   create function extensions.gen_random_uuid() returns uuid language sql as $$select gen_random_uuid()$$;
   create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
   create function auth.uid() returns uuid language sql stable as $$select nullif(auth.jwt()->>'sub','')::uuid$$;
   create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
   create table public.affiliates(id uuid primary key,auth_user_id uuid,numero_control text,full_name text,is_archived boolean default false);
   create table public.savings_admin_access_mode(id boolean primary key,mode text);insert into public.savings_admin_access_mode values(true,'OPEN');
   grant usage on schema public,auth to anon,authenticated,service_role;set check_function_bodies=off;`);
  for(const table of [...new Set(baseline.columns.map(c=>c.table_name))]){
   const cols=baseline.columns.filter(c=>c.table_name===table).map(c=>`${qid(c.name)} ${c.type}${c.name==='id'&&c.type==='bigint'&&!c.default_expr?' generated by default as identity':c.default_expr?' default '+c.default_expr:''}${c.not_null?' not null':''}`);
   await db.exec(`create table public.${qid(table)}(${cols.join(',')})`);
  }
  for(const type of [false,true])for(const c of baseline.constraints.filter(c=>(c.type==='f')===type))await db.exec(`alter table public.${qid(c.table_name)} add constraint ${qid(c.name)} ${c.definition}`);
  for(const f of baseline.functions)await db.exec(f.definition);
  for(const t of baseline.triggers){await db.exec(t.function_definition);await db.exec(t.definition);}
  await db.exec('revoke all on all functions in schema public,admin_support_private from public,anon,authenticated,service_role');
  for(const f of baseline.functions)for(const role of ['anon','authenticated','service_role'])if(f.acl===null||f.acl.includes(role+'=X')||/[{,]=X/.test(f.acl))await db.exec(`grant execute on function ${f.signature} to ${role}`);
  for(const s of baseline.security){if(s.rls)await db.exec(`alter table ${qid(s.table_name)} enable row level security`);if(s.force_rls)await db.exec(`alter table ${qid(s.table_name)} force row level security`);}
  for(const p of baseline.policies){const roles=Array.isArray(p.roles)?p.roles:p.roles.slice(1,-1).split(',');await db.exec(`create policy ${qid(p.policyname)} on ${qid(p.tablename)} as ${p.permissive} for ${p.cmd} to ${roles.map(qid).join(',')}${p.qual?' using ('+p.qual+')':''}${p.with_check?' with check ('+p.with_check+')':''}`);}
  for(const g of baseline.grants)await db.exec(`grant ${g.privilege_type} on ${qid(g.table_name)} to ${qid(g.grantee)}`);
  for(const [id,email] of [[owner,'owner@example.invalid'],[target,'target@example.invalid']])await q('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,email]);
  for(const r of baseline.roles)await q('insert into admin_roles(code,name,enabled,system_role) values($1,$2,$3,$4)',[r.code,r.name,r.enabled,r.system_role]);
  for(const p of metadata.rolePermissions)await q('insert into admin_role_permissions select id,$2 from admin_roles where code=$1',[p.code,p.permission]);
  for(const s of metadata.sections){const keys=Object.keys(s);await q(`insert into admin_section_definitions(${keys.map(qid)}) values(${keys.map((_,i)=>'$'+(i+1))})`,Object.values(s));}
  await q("insert into admin_assignments(auth_user_id,role,role_id,permissions,enabled,protected_assignment) select $1,'visual_admin',id,array['authorization.read','authorization.write'],true,true from admin_roles where code='principal_admin'",[owner]);
  await db.exec(read('supabase/migrations/20260924000100_admin_assignment_voting_permissions.sql'));
  await test('production assisted visibility defect reproduced for four registered modules',async()=>{
   for(const id of inspect(inventory,metadata,surfaces).assistedVisibilityMissing)assert.equal(await scalar('select admin_support_private.module_visible($1,$2) value',[owner,id]),false,id);
  });
  const currentCorrection=compile(inventory,metadata,'20260924000200');
  await test('current visibility-only candidate restores all 37 modules and recovers without data changes',async()=>{
   await db.exec(currentCorrection.forward);
   for(const m of inventory.modules)assert.equal(await scalar('select admin_support_private.module_visible($1,$2) value',[owner,m.id]),true,m.id);
   await assert.rejects(()=>db.exec(currentCorrection.forward),/MODULE_VISIBILITY_BASELINE_CHANGED|already exists/);await db.exec('rollback');
   await db.exec(currentCorrection.recovery);
   assert.equal(await scalar('select count(*)::int value from admin_section_definitions where module_key is not null'),39);
   assert.equal(await scalar('select count(*)::int value from admin_assignments'),1);
  });
  const generated=compile(future,metadata,'20260924000200');
  await test('generated SQL refuses technical permission removed after metadata capture',async()=>{
   await db.exec("begin;delete from admin_role_permissions where permission='news.write'");
   await assert.rejects(()=>db.exec(generated.forward),/ROLE_PERMISSION_CHANGED/);await db.exec('rollback');
   assert.equal(await scalar("select count(*)::int value from admin_section_definitions where module_key='future_panel'"),0);
  });
  const priorAcl=await scalar("select proacl::text value from pg_proc where oid='admin_support_private.module_visible(uuid,text)'::regprocedure");
  await test('generated registration applies atomically and preserves function ACL',async()=>{
   await db.exec(generated.forward);assert.equal(await scalar("select proacl::text value from pg_proc where oid='admin_support_private.module_visible(uuid,text)'::regprocedure"),priorAcl);
   assert.equal(await scalar('select count(*)::int value from admin_assignments'),1);
   assert.equal(await scalar('select count(*)::int value from admin_section_responsibilities'),0);
  });
  await test('all current modules plus a future module visible to total admin, unknown still denied',async()=>{
   for(const m of future.modules)assert.equal(await scalar('select admin_support_private.module_visible($1,$2) value',[owner,m.id]),true,m.id);
   assert.equal(await scalar('select admin_support_private.module_visible($1,$2) value',[owner,'unregistered']),false);
  });
  await test('no-use recovery restores exact function and removes only the added module',async()=>{
   await db.exec(generated.recovery);assert.equal(await scalar("select pg_get_functiondef('admin_support_private.module_visible(uuid,text)'::regprocedure) value"),metadata.functions.find(f=>f.name==='module_visible').definition);
   assert.equal(await scalar("select count(*)::int value from admin_section_definitions where module_key='future_panel'"),0);
   await db.exec(generated.forward);
  });
  await test('catalog RPC automatically includes new screen without frontend catalog edits',async()=>{
   await auth(owner);const catalog=await scalar('select list_admin_module_catalog() value');assert(catalog.some(m=>m.key==='future_panel'&&!m.total_only));
  });
  await test('future module can be individually assigned and grants no other module',async()=>{
   const current=await scalar("select get_admin_user_modules('target@example.invalid') value");
   await q("select save_admin_user_modules('target@example.invalid','limited',array['future_panel'],$1)",[current.version]);
   await auth(target);assert.equal(await scalar("select has_admin_module('future_panel') value"),true);
   assert.equal(await scalar("select has_admin_module('companies_admin') value"),false);
   assert.equal(await scalar("select has_admin_module('noticias') value"),false);
   assert.equal(await scalar("select admin_module_boundary(array['noticias'],'update') value"),false);
   await assert.rejects(()=>q("select save_admin_user_modules('owner@example.invalid','total',array[]::text[],null)"),/AUTHORIZATION_DENIED/);
  });
  await test('used registration recovery refuses to erase grants/history',async()=>{
   await db.exec('reset role');await assert.rejects(()=>db.exec(generated.recovery),/RECOVERY_BLOCKED_AUTHORIZATION_USE/);await db.exec('rollback');assert.equal(await scalar("select count(*)::int value from admin_section_definitions where module_key='future_panel'"),1);
  });
  await test('revocation immediately removes new module on an already-open session',async()=>{
   await auth(owner);await q('select revoke_admin_assignment($1)',[target]);await auth(target);
   assert.equal(await scalar("select has_admin_module('future_panel') value"),false);
   assert.equal(await scalar("select has_admin_permission('news.write') value"),false);
   await db.exec('reset role');assert.equal(await scalar('select count(*)::int value from auth.users'),2);
  });
  await test('protected owner remains protected',async()=>{await auth(owner);await assert.rejects(()=>q('select revoke_admin_assignment($1)',[owner]),/SELF_ASSIGNMENT|PROTECTED/);await db.exec('reset role');});
  await test('every delegable catalog module can be assigned alone; total-only modules refuse limited assignment',async()=>{
   for(const row of metadata.sections.filter(s=>s.module_key)){
    await auth(owner);const current=await scalar("select get_admin_user_modules('target@example.invalid') value");
    const save=()=>q("select save_admin_user_modules('target@example.invalid','limited',array[$1],$2)",[row.module_key,current.version]);
    if(row.module_total_only){await assert.rejects(save,/INVALID_ADMIN_MODULE/);continue;}
    await save();await auth(target);const c=await scalar('select get_admin_access_context() value');assert.deepEqual(c.module_keys,[row.module_key]);
   }
  });
  await test('company administration is selectable but Convenios shares companies.write capability',async()=>{
   await auth(owner);const current=await scalar("select get_admin_user_modules('target@example.invalid') value");
   await q("select save_admin_user_modules('target@example.invalid','limited',array['convenios'],$1)",[current.version]);
   await auth(target);assert.equal(await scalar("select has_admin_module('companies_admin') value"),false);
   assert.equal(await scalar("select has_admin_permission('companies.write') value"),true);
   assert.equal(await scalar("select has_admin_permission('company_portal.write') value"),false);
  });
  await test('company member helper isolates organizations and quote-only role',async()=>{
   await db.exec('reset role');
   await db.exec('create table marketplace_company_memberships(auth_user_id uuid,company_id uuid,enabled boolean,role text)');
   await db.exec(metadata.functions.find(f=>f.name==='is_marketplace_company_member').definition);
   const a='00000000-0000-4000-8000-000000000010',b='00000000-0000-4000-8000-000000000011';
   await q("insert into marketplace_company_memberships values($1,$2,true,'quotes')",[target,a]);await auth(target);
   assert.equal(await scalar("select is_marketplace_company_member($1,'quotes') value",[a]),true);
   assert.equal(await scalar("select is_marketplace_company_member($1,'write') value",[a]),false);
   assert.equal(await scalar("select is_marketplace_company_member($1,'read') value",[b]),false);
  });
  const result={status:'PASS',productionWrites:0,checks,coverage:inspect(inventory,metadata,surfaces),generated:{forwardSha256:generated.forwardSha256,recoverySha256:generated.recoverySha256},limits:['Company test exercises installed membership helper, not every business RPC or Storage policy.','Synthetic new module has no real business writer; boundary denial tested directly.','Recovery refuses any subsequent authorization/audit changes; read-only function usage is not observable.','Current production visibility defect is reproduced; generated correction is not deployed.']};
  result.currentCorrection={forwardSha256:currentCorrection.forwardSha256,recoverySha256:currentCorrection.recoverySha256,status:'ISOLATED_PASS_NOT_APPLIED'};
  const output=path.resolve(root,process.env.SUTIAPP_PERMISSION_TEST_EVIDENCE||'docs/qa/evidence/screen-permissions-20260924/isolated.json');
  assert(output.startsWith(root+path.sep),'EVIDENCE_OUTSIDE_WORKSPACE');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
 }finally{await db.close();}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
