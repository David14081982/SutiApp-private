'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert').strict;
const {sql,env,quote}=require('./prepare-companies-convenios-education');
const out=path.resolve(__dirname,'../docs/qa/evidence/categories-20260909');
async function inventory(){return sql(['marketplace_categories','companies','company_benefit_profiles','educational_resources','admin_assignments'].map(t=>`select '${t}' as domain,count(*)::int as count,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) as hash from public.${t} t`).join(' union all '));}
async function main(){
 const before=await inventory();
 const admin=(await sql('select id from auth.users where email='+quote(env.H005_TEST_EMAIL)))[0].id;
 const user=(await sql('select u.id from auth.users u where u.id<>'+quote(admin)+' and not exists(select 1 from public.admin_assignments a where a.auth_user_id=u.id and a.enabled) order by u.id limit 1'))[0].id;
 const setup="select set_config('test.category_admin',"+quote(admin)+",true),set_config('test.category_user',"+quote(user)+",true);";
 await sql('begin;'+setup+fs.readFileSync(path.join(__dirname,'test-convenios-categories.sql'),'utf8')+'rollback;');
 assert.deepEqual(await inventory(),before);
 const result={status:'PASS',schemaChanges:0,persistentBusinessWrites:0,checks:['admin create/read','duplicate slug rejected','agreement category public','education umbrella plus specific category','deactivation preserves assignments','member create/update denied'],inventory:before};
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'sql.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
