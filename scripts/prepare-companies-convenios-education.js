'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert').strict;
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/companies-convenios-education-20260908');
const env={};for(const line of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const at=line.indexOf('=');if(at>0&&!line.trim().startsWith('#'))env[line.slice(0,at).trim()]=line.slice(at+1).trim().replace(/^['"]|['"]$/g,'');}
const quote=s=>"'"+String(s).replace(/'/g,"''")+"'",sha=s=>crypto.createHash('sha256').update(s).digest('hex');
async function sql(query){const r=await fetch('https://api.supabase.com/v1/projects/'+new URL(env.SUPABASE_URL).hostname.split('.')[0]+'/database/query',{method:'POST',headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query}),signal:AbortSignal.timeout(60000)});const d=await r.json();if(!r.ok)throw Error('SQL '+r.status+' '+JSON.stringify(d));return d;}
function proof(name,data){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(data,null,2)+'\n');console.log(name+': '+data.status);}
const tables=['companies','company_assets','company_benefit_profiles','company_benefits','company_audience_rules','educational_resources','marketplace_products','marketplace_promotions','company_portal_plans','company_portal_subscriptions','marketplace_company_memberships'];
async function inventory(){return sql(tables.map(t=>`select '${t}' as domain,count(*)::int as count,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) as hash from public.${t} t`).join(' union all '));}
async function originalInventory(){const added={companies:['public_details'],educational_resources:['public_details','cover_asset_id'],company_benefit_profiles:['description','conditions'],company_portal_subscriptions:['payment_reference','payment_amount','accredited_by','accredited_at']};return sql(tables.map(t=>{const expr='to_jsonb(t)'+(added[t]?'-array['+added[t].map(quote).join(',')+']':'');return `select '${t}' as domain,count(*)::int as count,md5(coalesce(string_agg((${expr})::text,'' order by (${expr})::text),'')) as hash from public.${t} t`+(t==='company_portal_plans'?" where id not in ('cc000000-0000-4000-8000-000000000001','cc000000-0000-4000-8000-000000000002','cc000000-0000-4000-8000-000000000003')":'');}).join(' union all '));}
async function main(){
 const mode=process.argv[2],version='20260908000900',name='companies_convenios_education',file=path.join(root,'supabase/migrations/'+version+'_'+name+'.sql');
 if(mode==='audit'){
  const counts=await inventory(),functions=await sql("select p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition,p.proacl::text acl from pg_proc p where p.pronamespace='public'::regnamespace and (p.proname like '%company%' or p.proname='enforce_section_row_action')"),triggers=await sql("select tgrelid::regclass::text table_name,tgname,pg_get_triggerdef(oid) definition from pg_trigger where tgrelid in ('companies'::regclass,'company_assets'::regclass,'marketplace_products'::regclass,'marketplace_product_assets'::regclass,'educational_resources'::regclass) and not tgisinternal"),policies=await sql("select policyname,qual,with_check from pg_policies where schemaname='public' and tablename='company_portal_plans'");
  const privateDir='C:/tmp/sutiapp-companies-convenios-education-20260908';fs.mkdirSync(privateDir,{recursive:true});fs.writeFileSync(path.join(privateDir,'schema-before.json'),JSON.stringify({counts,functions,triggers,policies},null,2));proof('before',{status:'PASS',counts,functions,triggers,policies});return;
 }
 const source=fs.readFileSync(file,'utf8'),strip=s=>s.replace(/^begin;\s*/i,'').replace(/commit;\s*$/i,''),body=strip(source);
 if(mode==='recovery'){
  const before=JSON.parse(fs.readFileSync('C:/tmp/sutiapp-companies-convenios-education-20260908/schema-before.json'));
  const subtract={companies:['public_details'],educational_resources:['public_details','cover_asset_id'],company_benefit_profiles:['description','conditions'],company_portal_subscriptions:['payment_reference','payment_amount','accredited_by','accredited_at']};
  let recovery="begin;\n-- Refuse recovery after business activity; never erase history.\ndo $$ begin\n";
  for(const row of before.counts){if(row.domain==='company_portal_plans')continue;const cols=subtract[row.domain],expr='to_jsonb(t)'+(cols?'-array['+cols.map(quote).join(',')+']':'');recovery+=` if (select md5(coalesce(string_agg((${expr})::text,'' order by (${expr})::text),'')) from public.${row.domain} t)<>'${row.hash}' then raise exception 'RECOVERY_BLOCKED_${row.domain}_CHANGED';end if;\n`;}
  recovery+=" if exists(select 1 from public.companies where public_details<>'{}') or exists(select 1 from public.educational_resources where public_details<>'{}' or cover_asset_id is not null) or exists(select 1 from public.company_benefit_profiles where description<>'' or conditions<>'') or exists(select 1 from public.educational_resource_favorites) or exists(select 1 from public.company_portal_plans where id::text like 'cc000000%' and updated_at<>created_at) then raise exception 'RECOVERY_BLOCKED_NEW_HISTORY';end if;\nend $$;\n";
  for(const m of source.matchAll(/create policy (\w+) on ([\w.]+)/g))recovery+=`drop policy ${m[1]} on ${m[2]};\n`;
  recovery+=`create policy company_portal_plans_read on public.company_portal_plans for select to authenticated using(${before.policies.find(x=>x.policyname==='company_portal_plans_read').qual});\n`;
  for(const m of source.matchAll(/create trigger (\w+) (?:before|after)[^;]+? on ([\w.]+) for each row/g)){recovery+=`drop trigger ${m[1]} on ${m[2]};\n`;const old=before.triggers.find(t=>t.tgname===m[1]);if(old)recovery+=old.definition+';\n';}
  recovery+='drop table public.educational_resource_favorites;\n';
  for(const m of [...source.matchAll(/create function public\.(\w+)\(([^)]*)\) returns/g)].reverse()){const types=m[2].trim()?m[2].split(',').map(x=>x.trim().split(/\s+/)[1]).join(','):'';recovery+=`drop function public.${m[1]}(${types});\n`;}
  recovery+="delete from public.company_portal_plans where id in ('cc000000-0000-4000-8000-000000000001','cc000000-0000-4000-8000-000000000002','cc000000-0000-4000-8000-000000000003');\n";
  for(const [table,columns] of Object.entries(subtract))for(const column of columns)recovery+=`alter table public.${table} drop column ${column};\n`;
  recovery+='commit;\n';fs.writeFileSync(path.join(root,'supabase/recovery/'+version+'_'+name+'.sql'),recovery);
  const initial=await inventory();await sql('begin;'+body+strip(recovery)+'rollback;');assert.deepEqual(await inventory(),initial);
  proof('recovery-dry-run',{status:'PASS',migrationSha256:sha(source),recoverySha256:sha(recovery),persistentBusinessWrites:0});return;
 }
 if(mode==='test'||mode==='verify'){
  const admin=(await sql('select id from auth.users where email='+quote(env.H005_TEST_EMAIL)))[0].id;
  const users=await sql('select u.id from auth.users u where u.id<>'+quote(admin)+" and not exists(select 1 from public.admin_assignments a where a.auth_user_id=u.id and a.enabled) order by u.id limit 2");assert.equal(users.length,2);
  const tests=fs.readFileSync(path.join(root,'scripts/test-companies-convenios-education.sql'),'utf8');
  const settings="select set_config('test.co_admin',"+quote(admin)+",true),set_config('test.co_user_a',"+quote(users.filter(u=>u.id!==admin)[0].id)+",true),set_config('test.co_user_b',"+quote(users.filter(u=>u.id!==admin)[1].id)+",true);";
  const before=await inventory();await sql('begin;'+(mode==='test'?body:'')+settings+tests+'rollback;');assert.deepEqual(await inventory(),before);proof(mode==='test'?'sql-dry-run':'sql-live',{status:'PASS',migrationSha256:sha(source),persistentBusinessWrites:0});return;
 }
 if(mode==='apply'){
  assert.equal(JSON.parse(fs.readFileSync(path.join(out,'sql-dry-run.json'))).migrationSha256,sha(source));assert.equal(JSON.parse(fs.readFileSync(path.join(out,'recovery-dry-run.json'))).migrationSha256,sha(source));const before=await inventory();assert.deepEqual(before,JSON.parse(fs.readFileSync(path.join(out,'before.json'))).counts);
  await sql('begin;'+body+`insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',array[${quote(source)}]);commit;`);
  const preserved=await originalInventory();assert.deepEqual(preserved,before);proof('sql-apply',{status:'PASS',version,migrationSha256:sha(source),before,after:await inventory(),originalBusinessRows:'UNCHANGED',authorizedPlansCreated:3});return;
 }
 throw Error('Unknown mode');
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={sql,env,quote,proof,inventory,out};
