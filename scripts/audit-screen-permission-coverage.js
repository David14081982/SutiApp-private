'use strict';
// Schema/catalog metadata only. Never calls a mutating production RPC.
const fs=require('fs'),path=require('path');
const {query}=require('./savings-admin-review-db');
const root=path.resolve(__dirname,'..');
async function read(sql){return query("begin read only; set local statement_timeout='30s'; "+sql+'; commit;');}
async function main(){
 const result={capturedAt:new Date().toISOString(),productionWrites:0};
 result.permissionConstraint=await read("select pg_get_constraintdef(oid) definition from pg_constraint where conrelid='public.admin_assignments'::regclass and conname='admin_assignments_permissions_check'");
 result.rolePermissions=await read('select r.code,p.permission from public.admin_roles r join public.admin_role_permissions p on p.role_id=r.id order by r.code,p.permission');
 result.audienceScreens=await read('select screen_id from public.screen_access_policies order by screen_id');
 result.sections=await read('select section_key,display_name,data_boundary,allowed_actions,enforcement_status,module_key,module_read_permissions,module_write_permissions,module_sections,module_total_only,module_order from public.admin_section_definitions order by module_order,section_key');
 result.functions=await read(`select n.nspname schema,p.proname name,p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition,p.proacl::text acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','admin_support_private') and (p.proname in ('module_visible','admin_module_boundary','has_admin_module','has_section_action','has_admin_permission','get_admin_access_context','list_admin_module_catalog','save_admin_user_modules','is_company_member','can_manage_company','company_context','can_access_app_screen') or p.proname like '%company%' or p.proname like '%portal%') order by 1,2`);
 result.policies=await read(`select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies where schemaname='public' and (tablename like '%compan%' or tablename like '%marketplace%' or tablename like '%screen%' or tablename in ('admin_section_definitions','admin_section_responsibilities','company_popup_proposals')) order by tablename,policyname`);
 result.tables=await read(`select c.relname name,c.relrowsecurity rls,c.relforcerowsecurity force_rls from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and (c.relname like '%compan%' or c.relname like '%screen%') order by c.relname`);
 const dir=path.join(root,'docs/qa/evidence/screen-permissions-20260924');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'production-metadata.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({productionWrites:0,modules:result.sections.filter(s=>s.module_key).map(s=>s.module_key),functions:result.functions.length,policies:result.policies.length,tables:result.tables}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
