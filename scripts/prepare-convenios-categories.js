'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert').strict;
const {sql,env,quote}=require('./prepare-companies-convenios-education');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/categories-20260909'),version='20260909000200_marketplace_category_admin_creation.sql';
const read=p=>fs.readFileSync(path.join(root,p),'utf8'),strip=s=>s.replace(/^begin;\s*/i,'').replace(/commit;\s*$/i,''),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
async function inventory(){return sql("select count(*)::int as count,md5(string_agg(to_jsonb(c)::text,'' order by id)) as hash from public.marketplace_categories c");}
async function schema(){return sql("select conname name,pg_get_constraintdef(oid) definition from pg_constraint where conrelid='public.marketplace_categories'::regclass union all select indexname,indexdef from pg_indexes where schemaname='public' and tablename='marketplace_categories' order by name,definition");}
function proof(name,j){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(j,null,2)+'\n');console.log(name+': '+j.status);}
async function main(){const mode=process.argv[2],migration=read('supabase/migrations/'+version),recovery=read('supabase/recovery/'+version),before=await inventory(),previous=await schema();
 if(mode==='test'){
  const admin=(await sql('select id from auth.users where email='+quote(env.H005_TEST_EMAIL)))[0].id;
  const user=(await sql('select u.id from auth.users u where u.id<>'+quote(admin)+' and not exists(select 1 from public.admin_assignments a where a.auth_user_id=u.id and a.enabled) order by u.id limit 1'))[0].id;
  const settings="select set_config('test.category_admin',"+quote(admin)+",true),set_config('test.category_user',"+quote(user)+",true);";
  const snapshot=await sql('begin;'+strip(migration)+'savepoint category_tests;'+settings+read('scripts/test-convenios-categories.sql')+'rollback to savepoint category_tests;'+strip(recovery)+"select conname name,pg_get_constraintdef(oid) definition from pg_constraint where conrelid='public.marketplace_categories'::regclass union all select indexname,indexdef from pg_indexes where schemaname='public' and tablename='marketplace_categories' order by name,definition;rollback;");
  assert.deepEqual(snapshot,previous);assert.deepEqual(await inventory(),before);assert.deepEqual(await schema(),previous);
  fs.mkdirSync('C:/tmp/sutiapp-categories-20260909',{recursive:true});fs.writeFileSync('C:/tmp/sutiapp-categories-20260909/schema-before.json',JSON.stringify({before,previous,migrationSha256:sha(migration)},null,2));
  proof('migration-dry-run',{status:'PASS',forward:true,rls:true,recoveryExact:true,before,migrationSha256:sha(migration),recoverySha256:sha(recovery),persistentBusinessWrites:0});
 }else if(mode==='apply'){
  const checked=JSON.parse(read('docs/qa/evidence/categories-20260909/migration-dry-run.json'));assert.equal(checked.status,'PASS');assert.equal(checked.migrationSha256,sha(migration));
  const backup=JSON.parse(fs.readFileSync('C:/tmp/sutiapp-categories-20260909/schema-before.json','utf8'));assert.deepEqual(previous,backup.previous);await sql(migration);assert.deepEqual(await inventory(),before);
  proof('migration-apply',{status:'PASS',migrationSha256:sha(migration),before,after:await inventory(),schema:await schema(),persistentBusinessWrites:0});
 }else throw Error('Use test or apply');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
