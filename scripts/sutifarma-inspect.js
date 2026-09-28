'use strict';
const fs=require('fs'),path=require('path');
const {query}=require('./savings-admin-review-db');
const dir=path.resolve(__dirname,'../.tmp/sutifarma');
async function main(){
 fs.mkdirSync(dir,{recursive:true});
 const definitions=await query(`select n.nspname schema,p.proname name,pg_get_function_identity_arguments(p.oid) args,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='public' and p.proname in ('save_program_catalog_item','register_program_catalog_asset','discard_unlinked_program_catalog_asset','admin_asset_module_boundary','get_current_notification_phone','save_current_notification_phone','get_admin_access_context','has_admin_permission','has_admin_module','admin_module_boundary','assign_admin_role')) or n.nspname='admin_support_private'`);
 const columns=await query(`select table_schema,table_name,column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema='public' and table_name in ('program_catalog_items','program_catalog_item_assets','admin_section_definitions','admin_assignments','admin_section_responsibilities','admin_roles','request_push_subscriptions') order by table_name,ordinal_position`);
 const constraints=await query(`select c.conname,cl.relname,pg_get_constraintdef(c.oid) definition from pg_constraint c join pg_class cl on cl.oid=c.conrelid where cl.relname in ('program_catalog_items','program_catalog_item_assets','admin_assignments','admin_section_definitions')`);
 const triggers=await query(`select c.relname,t.tgname,pg_get_triggerdef(t.oid) definition,p.proname,pg_get_functiondef(p.oid) function from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_proc p on p.oid=t.tgfoid where not t.tgisinternal and c.relname in ('program_catalog_items','program_catalog_item_assets')`);
 const policies=await query(`select * from pg_policies where tablename in ('program_catalog_items','program_catalog_item_assets','objects')`);
 const manager=await query(`select coalesce(r.code,'none') role,a.enabled,a.protected_assignment,(select jsonb_agg(distinct d.module_key) from admin_section_responsibilities s join admin_section_definitions d using(section_key) where s.auth_user_id=u.id and s.enabled) modules from auth.users u left join admin_assignments a on a.auth_user_id=u.id left join admin_roles r on r.id=a.role_id where lower(u.email)='marianafrancoq32@gmail.com'`);
 fs.writeFileSync(path.join(dir,'schema.json'),JSON.stringify({definitions,columns,constraints,triggers,policies,manager},null,2));
 console.log(JSON.stringify({status:'PASS',functions:definitions.length,columns:columns.length,manager}));
}
main().catch(()=>{console.error('FARMA_SCHEMA_INSPECTION_FAILED');process.exitCode=1;});
