'use strict';
// Developer-side registration compiler. Never connects to or mutates a database.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const {sourceInventory,root,read}=require('./screen-permission-contract');
const quote=s=>"'"+String(s).replaceAll("'","''")+"'";
const array=xs=>'array['+xs.map(quote).join(',')+']::text[]';
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
function compile(inventory,metadata,version){
 assert(/^\d{14}$/.test(version),'MIGRATION_VERSION_REQUIRED');
 const known=new Set(metadata.sections.filter(s=>s.module_key).map(s=>s.module_key));
 const additions=inventory.modules.filter(m=>!known.has(m.id));
 const rows=additions.map(m=>{
  assert(/^[a-z][a-z0-9_]{1,50}$/.test(m.id),'INVALID_MODULE_KEY');
  const r=m.registration;
  assert(r&&typeof r.totalOnly==='boolean'&&r.boundary?.length>10,'EXPLICIT_BACKEND_REGISTRATION_REQUIRED:'+m.id);
  for(const key of ['readPermissions','writePermissions','sections'])assert(Array.isArray(r[key])&&r[key].every(s=>typeof s==='string'&&/^[a-z][a-z0-9_.]*$/.test(s)),'INVALID_REGISTRATION:'+key);
  const allowed=new Set([...(metadata.permissionConstraint?.[0]?.definition||'').matchAll(/'([^']+)'::text/g)].map(m=>m[1]));
  const principal=new Set((metadata.rolePermissions||[]).filter(p=>p.code==='principal_admin').map(p=>p.permission));
  for(const p of r.readPermissions.concat(r.writePermissions))assert(allowed.has(p)&&principal.has(p),'UNREGISTERED_TECHNICAL_PERMISSION:'+p);
  for(const s of r.sections)assert(metadata.sections.some(x=>x.section_key===s&&!x.module_key&&x.enforcement_status==='ENFORCED'),'UNKNOWN_ENFORCED_SECTION:'+s);
  assert(r.readPermissions.includes(inventory.permissions[m.id])||r.writePermissions.includes(inventory.permissions[m.id])||r.totalOnly,'MENU_PERMISSION_NOT_REGISTERED:'+m.id);
  assert(typeof r.backendEvidence==='string'&&r.backendEvidence.startsWith('supabase/')&&!r.backendEvidence.includes('..'),'BACKEND_EVIDENCE_REQUIRED:'+m.id);
  assert(typeof r.isolatedTest==='string'&&r.isolatedTest.startsWith('scripts/test-')&&!r.isolatedTest.includes('..'),'ISOLATED_TEST_REQUIRED:'+m.id);
  return {section_key:'admin_'+m.id,display_name:m.label,data_boundary:r.boundary,allowed_actions:['read','update'],enforcement_status:'ENFORCED',module_key:m.id,module_read_permissions:r.readPermissions,module_write_permissions:r.writePermissions,module_sections:r.sections,module_total_only:r.totalOnly,module_order:100+inventory.modules.findIndex(x=>x.id===m.id)};
 });
 const previous=metadata.functions.find(f=>f.schema==='admin_support_private'&&f.name==='module_visible');assert(previous,'MODULE_VISIBILITY_BASELINE_REQUIRED');
 const mappings=inventory.modules.map(m=>{
  assert(inventory.permissions[m.id],'MENU_PERMISSION_REQUIRED:'+m.id);
  return '('+[quote(m.id),quote(inventory.permissions[m.id]),array([].concat(inventory.sections[m.id]||[]))].join(',')+')';
 });
 const definition=previous.definition.replace(/from \(values [\s\S]*?\) modules\(key,permission,section_keys\)/,'from (values '+mappings.join(',')+') modules(key,permission,section_keys)');
 assert(definition.includes(mappings.join(',')),'VISIBILITY_SOURCE_STRUCTURE_CHANGED');
 const table='admin_screen_registration_recovery_'+version;
 const digest=tableName=>`md5(coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text from public.${tableName} t),'[]'))`;
 const stateHash=`md5(concat_ws('|',${['admin_assignments','admin_section_responsibilities','admin_roles','admin_role_permissions','admin_audit_log'].map(digest).join(',')}))`;
 const insertRows=rows.map(r=>`insert into public.admin_section_definitions(section_key,display_name,data_boundary,allowed_actions,enforcement_status,module_key,module_read_permissions,module_write_permissions,module_sections,module_total_only,module_order) values (${[quote(r.section_key),quote(r.display_name),quote(r.data_boundary),array(r.allowed_actions),quote(r.enforcement_status),quote(r.module_key),array(r.module_read_permissions),array(r.module_write_permissions),array(r.module_sections),r.module_total_only?'true':'false',r.module_order].join(',')});`).join('\n');
 const priorMd5=crypto.createHash('md5').update(previous.definition).digest('hex');
 const constraintMd5=crypto.createHash('md5').update(metadata.permissionConstraint[0].definition).digest('hex');
 const forward=`begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
lock table public.admin_section_definitions,public.admin_section_responsibilities,public.admin_assignments,public.admin_roles,public.admin_role_permissions,public.admin_audit_log in share row exclusive mode;
do $guard$ begin
 if md5(pg_get_functiondef('admin_support_private.module_visible(uuid,text)'::regprocedure))<>${quote(priorMd5)} then raise exception 'MODULE_VISIBILITY_BASELINE_CHANGED'; end if;
 if (select md5(pg_get_constraintdef(oid)) from pg_constraint where conrelid='public.admin_assignments'::regclass and conname='admin_assignments_permissions_check') is distinct from ${quote(constraintMd5)} then raise exception 'PERMISSION_CONSTRAINT_CHANGED'; end if;
 if exists(select 1 from unnest(${array([...new Set(rows.flatMap(r=>r.module_read_permissions.concat(r.module_write_permissions)))])}) requested(permission) where not exists(select 1 from public.admin_role_permissions p join public.admin_roles r on r.id=p.role_id where r.code='principal_admin' and r.enabled and p.permission=requested.permission)) then raise exception 'ROLE_PERMISSION_CHANGED'; end if;
 if exists(select 1 from unnest(${array([...new Set(rows.flatMap(r=>r.module_sections))])}) requested(section_key) where not exists(select 1 from public.admin_section_definitions d where d.section_key=requested.section_key and d.module_key is null and d.enforcement_status='ENFORCED')) then raise exception 'SECTION_ENFORCEMENT_CHANGED'; end if;
end $guard$;
create table public.${table}(singleton boolean primary key check(singleton),previous_definition text not null,applied_hash text,section_hash text,authorization_hash text not null);
alter table public.${table} enable row level security;
alter table public.${table} force row level security;
revoke all on public.${table} from public,anon,authenticated,service_role;
insert into public.${table}(singleton,previous_definition,authorization_hash) select true,pg_get_functiondef('admin_support_private.module_visible(uuid,text)'::regprocedure),${stateHash};
${insertRows}
${definition};
update public.${table} set applied_hash=md5(pg_get_functiondef('admin_support_private.module_visible(uuid,text)'::regprocedure)),section_hash=${digest('admin_section_definitions')};
commit;
`;
 const recovery=`begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
lock table public.admin_section_definitions,public.admin_section_responsibilities,public.admin_assignments,public.admin_roles,public.admin_role_permissions,public.admin_audit_log in share row exclusive mode;
do $recovery$ declare saved public.${table}%rowtype; begin
 select * into strict saved from public.${table} where singleton;
 if saved.applied_hash<>md5(pg_get_functiondef('admin_support_private.module_visible(uuid,text)'::regprocedure)) or saved.section_hash<>${digest('admin_section_definitions')} then raise exception 'RECOVERY_BLOCKED_DEFINITION_DRIFT'; end if;
 if saved.authorization_hash<>${stateHash} then raise exception 'RECOVERY_BLOCKED_AUTHORIZATION_USE'; end if;
 execute saved.previous_definition;
end $recovery$;
${rows.length?'delete from public.admin_section_definitions where section_key=any('+array(rows.map(r=>r.section_key))+');':''}
drop table public.${table};
commit;
`;
 return {forward,recovery,rows,definition,version,forwardSha256:sha(forward),recoverySha256:sha(recovery)};
}
function prepare(inventory,metadata,version){
 const result=compile(inventory,metadata,version);
 for(const m of inventory.modules.filter(m=>result.rows.some(r=>r.module_key===m.id))){
  const r=m.registration,backend=read(r.backendEvidence);
  assert(backend.includes("'"+m.id+"'")&&/admin_module_boundary|has_admin_module/.test(backend),'MODULE_BACKEND_BOUNDARY_NOT_FOUND:'+m.id);
  assert(fs.existsSync(path.join(root,r.isolatedTest)),'ISOLATED_TEST_MISSING:'+m.id);
 }
 const dir=path.join(root,'tmp/screen-permission-registration',version);fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(dir,'forward.sql'),result.forward);fs.writeFileSync(path.join(dir,'recovery.sql'),result.recovery);
 return {status:'PREPARED_NOT_APPLIED',version,registeredModules:result.rows.map(r=>r.module_key),forwardSha256:result.forwardSha256,recoverySha256:result.recoverySha256,output:dir,required:'Run isolated backend tests and review SQL before release. No permissions have been assigned.'};
}
function main(){console.log(JSON.stringify(prepare(sourceInventory(),JSON.parse(read('docs/qa/evidence/screen-permissions-20260924/production-metadata.json')),process.argv[2]),null,2));}
module.exports={compile,prepare};
if(require.main===module){try{main();}catch(e){console.error(e.message);process.exitCode=1;}}
