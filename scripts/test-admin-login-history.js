'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),vm=require('vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const {PGlite}=require(path.join(root,'.tmp/savings-loan-eligibility/node_modules/@electric-sql/pglite'));
const out=path.join(root,'docs/qa/evidence/admin-login-history-20260923');
async function main(){
 const db=new PGlite(),checks=[];
 const query=async(sql,args=[])=>(await db.query(sql,args)).rows;
 const rpc=async(mode='users',q=null,from=null,to=null,page=1,size=25)=>(await query('select list_admin_login_history($1,$2,$3,$4,$5,$6) value',[mode,q,from,to,page,size]))[0].value;
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
   create table auth.users(id uuid primary key,email text,last_sign_in_at timestamptz);
   create table auth.audit_log_entries(id uuid primary key,payload json,created_at timestamptz);
   create table public.affiliates(id uuid primary key,auth_user_id uuid,numero_control text,full_name text,notification_phone text,phone_raw text);
   create table public.admin_section_definitions(section_key text primary key,display_name text,data_boundary text,allowed_actions text[],enforcement_status text,module_key text unique,module_read_permissions text[],module_write_permissions text[],module_sections text[],module_total_only boolean,module_order integer);
   create table public.admin_section_responsibilities(section_key text);
   create table public.test_admin_assignments(id uuid,enabled boolean,can_authorize boolean,module_limited boolean);
   create function public.has_admin_permission(text) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.test_admin_assignments where id=auth.uid() and enabled and can_authorize)$$;
   create function public.admin_module_boundary(text[]) returns boolean language sql stable security definer set search_path='' as $$select not exists(select 1 from public.test_admin_assignments where id=auth.uid() and module_limited)$$;
   grant usage on schema public,auth to authenticated,anon;
   insert into test_admin_assignments values ('00000000-0000-0000-0000-000000000001',true,true,false),('00000000-0000-0000-0000-000000000002',false,true,false),('00000000-0000-0000-0000-000000000003',true,true,true);
   insert into auth.users select md5(i::text)::uuid,'user'||i||'@example.invalid','2026-09-23 08:00Z'::timestamptz + i*interval '1 second' from generate_series(1,131)i;
   insert into affiliates select id,id,'000'||row_number() over(order by id),'Persona prueba',case when email='user1@example.invalid' then '6621234567' end,'6627654321' from auth.users;
   insert into auth.audit_log_entries select md5(('event'||i)::text)::uuid,json_build_object('actor_id',md5((1+i%131)::text),'action','login'),'2026-09-23 06:59Z'::timestamptz+i*interval '1 second' from generate_series(1,151)i;
   insert into auth.audit_log_entries values(gen_random_uuid(),'{"action":"login","actor_id":"malformed"}','2026-09-23 08:01Z'),(gen_random_uuid(),'{"action":"token_refreshed","actor_id":"malformed"}','2026-09-23 08:02Z');
  `);
  const migration=read('supabase/migrations/20260923000100_admin_login_history.sql');
  await db.exec(migration);
  for(const [actor,role] of [['','anon'],['00000000-0000-0000-0000-000000000099','authenticated'],['00000000-0000-0000-0000-000000000002','authenticated'],['00000000-0000-0000-0000-000000000003','authenticated']]){
   await query("select set_config('test.uid',$1,false)",[actor]);await db.exec('set role '+role);
   await assert.rejects(rpc(),/permission denied|ADMIN_LOGIN_HISTORY_DENIED/);await db.exec('reset role');
  }
  checks.push('anon/non-admin/revoked/module-limited denied');
  await query("select set_config('test.uid','00000000-0000-0000-0000-000000000001',false)");await db.exec('set role authenticated');
  await assert.rejects(query('select * from auth.users'),/permission denied/);
  await assert.rejects(query('select * from auth.audit_log_entries'),/permission denied/);
  checks.push('no direct Auth reads');
  let data=await rpc();assert.equal(data.total,131);assert.equal(data.items.length,25);assert.equal(data.total_users_signed_in,131);
  const ids=[];for(let page=1;page<=6;page++)ids.push(...(await rpc('users',null,null,null,page)).items.map(r=>r.id));assert.equal(ids.length,131);assert.equal(new Set(ids).size,131);
  checks.push('131 accounts paginated once without 100-row ceiling');
  data=await rpc('users','user1@example.invalid');assert.equal(data.total,1);assert.equal(data.items[0].phone,'6621234567');assert.equal(data.items[0].historical_phone,'6627654321');assert.match(data.items[0].numero_control,/^000/);
  assert.equal((await rpc('users','user2@example.invalid')).items[0].phone,null);
  assert.equal((await rpc('users','%')).total,0);checks.push('literal search/text control/confirmed vs historical phone');
  data=await rpc('history');assert.equal(data.total,152);assert.equal(data.items[0].full_name,null);assert.equal(data.items[0].email,null);
  assert.equal((await rpc('history',null,'2026-09-22','2026-09-22')).total,59);
  assert.equal((await rpc('history',null,'2026-09-23','2026-09-23')).total,93);
  assert.equal((await rpc('history',null,null,null,100)).items.length,0);
  checks.push('native login-only events/malformed actor safe/Sonora inclusive dates/empty page');
  for(const args of [['bad'],['users',null,'2026-09-24','2026-09-23'],['users',null,null,null,0],['users',null,null,null,1,101]])await assert.rejects(rpc(...args),/INVALID_LOGIN_HISTORY_FILTERS/);
  checks.push('invalid filters rejected');
  await db.exec('reset role');const before=(await query('select count(*) n from auth.audit_log_entries'))[0].n;
  await db.exec(read('supabase/recovery/20260923000100_admin_login_history.sql'));
  assert.equal((await query('select count(*) n from auth.audit_log_entries'))[0].n,before);
  await db.exec(migration);checks.push('recovery preserves every Auth event and reapply succeeds');
  let called=0;const window={AdminRepository:{has:()=>false},SutiSupabase:{getClient:()=>({rpc:async()=>{called++;return {error:new Error('backend denied')};}})}};
  vm.runInNewContext(read('app/login-history-repository.js'),{window});
  await assert.rejects(window.LoginHistoryRepository.list(),/DENIED/);assert.equal(called,0);window.AdminRepository.has=()=>true;
  await assert.rejects(window.LoginHistoryRepository.list(),/backend denied/);checks.push('repository fail-closed, no mock/cache');
  fs.mkdirSync(out,{recursive:true});const result={status:'PASS',migrationSha256:require('crypto').createHash('sha256').update(migration).digest('hex'),environment:'isolated PostgreSQL (PGlite), synthetic fixtures only',checks,productionMutations:0};fs.writeFileSync(path.join(out,'isolated.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await db.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
