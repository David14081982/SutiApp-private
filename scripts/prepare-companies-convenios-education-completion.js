'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert').strict,crypto=require('crypto');
const {sql,env,quote,proof,inventory,out}=require('./prepare-companies-convenios-education');
const root=path.resolve(__dirname,'..'),name='20260909000100_company_commercial_completion',read=f=>fs.readFileSync(path.join(root,f),'utf8'),strip=s=>s.replace(/^begin;\s*/i,'').replace(/commit;\s*$/i,''),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
async function main(){const mode=process.argv[2],source=read('supabase/migrations/'+name+'.sql'),recovery=read('supabase/recovery/'+name+'.sql'),before=await inventory();
 const extra=()=>sql("select 'requests' domain,count(*)::int count,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by id),'')) hash from public.program_requests t union all select 'popups',count(*)::int,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by id),'')) from public.company_popup_proposals t");const unchanged=await extra();
 if(mode==='test'||mode==='verify'){
  const admin=(await sql('select id from auth.users where email='+quote(env.H005_TEST_EMAIL)))[0].id,users=await sql('select u.id from auth.users u where u.id<>'+quote(admin)+" and not exists(select 1 from public.admin_assignments a where a.auth_user_id=u.id and a.enabled) order by u.id limit 2");
  const settings="select set_config('test.co_admin',"+quote(admin)+",true),set_config('test.co_user_a',"+quote(users[0].id)+",true),set_config('test.co_user_b',"+quote(users[1].id)+",true);";
  await sql('begin;'+(mode==='test'?strip(source):'')+settings+read('scripts/test-companies-convenios-education.sql')+read('scripts/test-companies-convenios-education-completion.sql')+'rollback;');
  if(mode==='test')await sql('begin;'+strip(source)+strip(recovery)+'rollback;');
  assert.deepEqual(await inventory(),before);assert.deepEqual(await extra(),unchanged);proof('completion-'+mode,{status:'PASS',migrationSha256:sha(source),recoverySha256:sha(recovery),persistentBusinessWrites:0});
 }else if(mode==='apply'){
  const tested=JSON.parse(fs.readFileSync(path.join(out,'completion-test.json'),'utf8'));assert.equal(tested.migrationSha256,sha(source));assert.equal(tested.recoverySha256,sha(recovery));
  await sql('begin;'+strip(source)+`insert into supabase_migrations.schema_migrations(version,name,statements)values('20260909000100','company_commercial_completion',array[${quote(source)}]);commit;`);
  assert.deepEqual(await inventory(),before);assert.deepEqual(await extra(),unchanged);proof('completion-apply',{status:'PASS',migrationSha256:sha(source),originalBusinessRows:'UNCHANGED'});
 }else throw Error('Unknown mode');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
