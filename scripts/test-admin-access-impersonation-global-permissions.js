'use strict';
const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const migration=read('supabase/migrations/20260903000120_admin_access_impersonation_global_permissions.sql');
const recovery=read('supabase/recovery/20260903000120_admin_access_impersonation_global_permissions_recovery.sql');
const metadataFix=read('supabase/migrations/20260903000121_admin_assignment_revocation_metadata_fix.sql');
const metadataRecovery=read('supabase/recovery/20260903000121_admin_assignment_revocation_metadata_fix_recovery.sql');
const stopFix=read('supabase/migrations/20260903000122_impersonation_stop_permission_binding.sql');
const stopRecovery=read('supabase/recovery/20260903000122_impersonation_stop_permission_binding_recovery.sql');
const admin=read('app/screens-admin.jsx'),screen=read('app/screens-admin-access.jsx'),repo=read('app/admin-repository.js');
const roles=read('app/screens-admin-roles.jsx'),adapter=read('app/admin-cutover-store.jsx'),banner=read('app/app.jsx');
const builder=read('scripts/build-bundle.js'),html=read('SutiApp.html'),sw=read('sw.js');
function must(value,label){if(!value)throw new Error(label);}
function has(source,value,label){must(source.includes(value),label||('missing '+value));}

[
  'set_total_admin_by_email','list_admin_assignments','revoke_admin_assignment',
  'list_admin_section_definitions','list_section_responsibility_groups',
  "has_admin_permission('affiliates.impersonate')",'actor_auth_session_id',
  "auth.jwt()->>'session_id'",'PROTECTED_SUPERADMIN','LAST_PRINCIPAL_ADMIN_REQUIRED'
].forEach(value=>has(migration,value));
has(recovery,'RECOVERY_BLOCKED_POST_MIGRATION_ACTIVITY');
has(metadataFix,'case when excluded.enabled then now() else admin_assignments.assigned_at end');
has(metadataFix,'admin_assignments.assigned_by_auth_user_id end');
has(metadataRecovery,'RECOVERY_BLOCKED_POST_MIGRATION_ACTIVITY');
has(stopFix,"has_admin_permission('affiliates.impersonate')");
has(stopFix,"actor_auth_session_id=nullif(auth.jwt()->>'session_id','')");
has(stopRecovery,'RECOVERY_BLOCKED_POST_MIGRATION_ACTIVITY');
has(migration,"revoke all on function public.list_admin_assignments()");
must(!/grant execute[\s\S]{0,900}\bto\s+(?:public|anon)\b/i.test(migration),'critical RPC granted to public/anon');

['administrators','screen_permissions','impersonation'].forEach(value=>has(admin,value));
has(admin,'candidates.filter((m)=>stateFor(m).canView)','mobile menu is not filtered');
has(admin,'activeModule&&!access.stateFor(activeModule).canView','internal view guard missing');
has(screen,"data-admin-assignment-form':'total'");
has(screen,"data-admin-screen-permissions':'backend-registry'");
has(screen,"data-admin-impersonation':'explicit-permission'");
has(repo,"requirePermission('affiliates.impersonate')");
has(roles,'data-role-impersonation-permission');
has(adapter,"p.includes('affiliates.impersonate')");
has(banner,'Estás viendo SutiApp como');
has(banner,'Salir de tomar control');
has(builder,"'screens-admin-access.jsx'");
has(html,'app/bundle.js?v=198');has(sw,"sutiapp-v142");has(sw,'app/bundle.js?v=198');

const forbidden=[/service_role/i,/localStorage/i,/DATA\./,/google/i,/apps script/i];
forbidden.forEach(pattern=>must(!pattern.test(screen),'forbidden frontend authority: '+pattern));
console.log(JSON.stringify({status:'PASS',contracts:38,global_suite:'NOT_APPLICABLE',legacy:'NO_INTERACTION'}));
