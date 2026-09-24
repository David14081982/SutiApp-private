'use strict';
// Read-only schema and aggregates. No business rows, credentials or user identities.
const fs=require('fs'),path=require('path');
const {query}=require('./savings-admin-review-db');
const root=path.resolve(__dirname,'..');
async function read(sql){return query("begin read only;set local statement_timeout='30s';"+sql+';commit;');}
async function main(){
 const result={capturedAt:new Date().toISOString(),productionWrites:0};
 result.tables=await read("select c.relname name,c.relrowsecurity rls,c.relforcerowsecurity force_rls from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname~'(compan|content|form|menu|section|layout|editorial)' order by 1");
 result.functions=await read("select n.nspname schema,p.proname name,p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition,md5(pg_get_functiondef(p.oid)) hash,p.proacl::text acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','admin_support_private') and (p.proname~'(company|agreement|section_row|module_visible)' or p.proname in ('has_admin_permission','has_admin_module','has_section_action','admin_module_boundary','get_admin_access_context','matches_current_affiliate_audience','can_access_app_screen')) order by 1,2");
 result.businessSummary=await read("select (select count(*) from public.marketplace_company_memberships where enabled) enabled_memberships,(select count(distinct company_id) from public.marketplace_company_memberships where enabled) member_companies,(select count(*) from public.admin_assignments where enabled) enabled_assignments,(select md5(jsonb_agg(to_jsonb(a) order by a.id)::text) from public.admin_assignments a) assignments_hash,(select md5(jsonb_agg(to_jsonb(a) order by a.id)::text) from public.admin_section_responsibilities a) responsibilities_hash");
 result.versions=await read("select version,name from supabase_migrations.schema_migrations order by version desc limit 8");
 const tables="'companies','company_assets','company_audience_rules','company_benefit_profiles','company_benefits','marketplace_company_memberships','company_portal_plans','company_portal_subscriptions','marketplace_products','marketplace_promotions','company_popup_proposals'";
 result.columns=await read(`select c.relname table_name,a.attname name,format_type(a.atttypid,a.atttypmod) type,a.attnotnull not_null,pg_get_expr(d.adbin,d.adrelid) default_expr from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum where n.nspname='public' and c.relname in (${tables}) order by c.relname,a.attnum`);
 result.constraints=await read(`select c.relname table_name,k.conname name,k.contype type,pg_get_constraintdef(k.oid) definition from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in (${tables}) order by c.relname,k.conname`);
 result.grants=await read(`select table_name,grantee,privilege_type from information_schema.role_table_grants where table_schema='public' and table_name in (${tables}) and grantee in ('anon','authenticated','service_role') order by table_name,grantee,privilege_type`);
 result.triggers=await read(`select c.relname table_name,t.tgname name,pg_get_triggerdef(t.oid) definition,p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) function_definition from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace join pg_proc p on p.oid=t.tgfoid where not t.tgisinternal and n.nspname='public' and c.relname in (${tables}) order by c.relname,t.tgname`);
 result.policies=await read(`select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies where (schemaname='public' and tablename in (${tables})) or (schemaname='storage' and (qual like '%company%' or with_check like '%company%')) order by schemaname,tablename,policyname`);
 const dir=path.join(root,'docs/qa/evidence/screen-permission-fix-20260924');fs.mkdirSync(dir,{recursive:true});
 if(process.argv.includes('--verify')){
  const prior=JSON.parse(fs.readFileSync(path.join(dir,'production-metadata.json'),'utf8'));
  const since=new Date(prior.capturedAt).toISOString();
  result.concurrentAuthorizationEvents=await read(`select resource,action,result,count(*) events,min(created_at) first_at,max(created_at) last_at from public.admin_audit_log where created_at>='${since}'::timestamptz and resource like 'admin_%' group by resource,action,result order by last_at desc limit 30`);
  result.verification={assignmentsUnchanged:prior.businessSummary[0].assignments_hash===result.businessSummary[0].assignments_hash,responsibilitiesUnchanged:prior.businessSummary[0].responsibilities_hash===result.businessSummary[0].responsibilities_hash,functionsUnchanged:JSON.stringify(prior.functions.map(f=>[f.signature,f.hash,f.acl]))===JSON.stringify(result.functions.map(f=>[f.signature,f.hash,f.acl])),editorialInstalled:result.tables.some(t=>t.name==='app_editorial_screens')};
 }
 fs.writeFileSync(path.join(dir,process.argv.includes('--verify')?'production-verification.json':'production-metadata.json'),JSON.stringify(result,null,2)+'\n');
 if(result.verification)console.log(JSON.stringify({verification:result.verification,authorizationEvents:result.concurrentAuthorizationEvents}));
 console.log(JSON.stringify({tables:result.tables,functions:result.functions.length,triggers:result.triggers.length,summary:result.businessSummary,versions:result.versions}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
