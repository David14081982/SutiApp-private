'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
function env(){const out={};for(const line of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const match=line.match(/^([A-Z0-9_]+)=(.*)$/);if(match)out[match[1]]=match[2].trim().replace(/^['"]|['"]$/g,'');}return out;}
function body(sql){return sql.replace(/^\s*begin;\s*/i,'').replace(/\s*commit;\s*$/i,'');}
async function management(values,query){const ref=new URL(values.SUPABASE_URL).hostname.split('.')[0],response=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:'Bearer '+values.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json','User-Agent':'SutiApp-AffiliateArchive-Test/1.0'},body:JSON.stringify({query})});const data=await response.json().catch(()=>null);if(!response.ok)throw new Error('MANAGEMENT_SQL_'+response.status+':'+JSON.stringify(data).slice(0,1600));return data;}
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20260901000200_admin_affiliate_archive_and_digital_file.sql'),'utf8');
const recovery=fs.readFileSync(path.join(root,'supabase/recovery/20260901000200_admin_affiliate_archive_and_digital_file_recovery.sql'),'utf8');
const checks=`
do $verify$
declare v_definition text;v_count integer;
begin
  if (select count(*) from public.affiliates)<>947 then raise exception 'AFFILIATE_COUNT_CHANGED'; end if;
  if exists(select 1 from public.affiliates where is_archived) then raise exception 'UNEXPECTED_ARCHIVED_BASELINE'; end if;
  if not exists(select 1 from pg_class where oid='public.admin_affiliate_archive_migration_state_20260901000200'::regclass and relrowsecurity and relforcerowsecurity) then raise exception 'RECOVERY_STATE_RLS_INVALID'; end if;
  if has_table_privilege('anon','public.admin_affiliate_archive_migration_state_20260901000200','select') or has_table_privilege('authenticated','public.admin_affiliate_archive_migration_state_20260901000200','select') then raise exception 'RECOVERY_STATE_EXPOSED'; end if;
  if has_function_privilege('anon','public.archive_admin_affiliate(uuid,timestamptz,text)','execute') or has_function_privilege('anon','public.restore_admin_affiliate(uuid,timestamptz,text)','execute') then raise exception 'ANON_LIFECYCLE_EXECUTE'; end if;
  if not has_function_privilege('authenticated','public.archive_admin_affiliate(uuid,timestamptz,text)','execute') or not has_function_privilege('authenticated','public.restore_admin_affiliate(uuid,timestamptz,text)','execute') then raise exception 'AUTH_LIFECYCLE_EXECUTE_MISSING'; end if;
  select pg_get_functiondef('public.get_effective_affiliate_id()'::regprocedure) into v_definition;
  if v_definition not like '%not a.is_archived%' then raise exception 'EFFECTIVE_ID_ARCHIVE_GUARD_MISSING'; end if;
  select pg_get_functiondef('public.register_admin_affiliate_document(uuid,uuid,text,text,bigint,text,text)'::regprocedure) into v_definition;
  if v_definition not like '%replaces_document_id%' or v_definition not like '%ADMIN_REPLACEMENT_UPLOAD%' then raise exception 'DOCUMENT_VERSION_WRITER_MISSING'; end if;
  if not exists(select 1 from pg_trigger where tgrelid='public.program_requests'::regclass and tgname='program_requests_guard_archived_affiliate' and not tgisinternal) then raise exception 'REQUEST_ARCHIVE_GUARD_MISSING'; end if;
  select count(*) into v_count from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('archive_admin_affiliate','restore_admin_affiliate','list_admin_archived_affiliates','get_current_affiliate_access_state');
  if v_count<>4 then raise exception 'ARCHIVE_RPC_COUNT_INVALID'; end if;
end $verify$;`;
const recoveryChecks=`
do $verify$
begin
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='affiliates' and column_name='is_archived') then raise exception 'ARCHIVE_COLUMN_RECOVERY_FAILED'; end if;
  if to_regclass('public.admin_affiliate_archive_migration_state_20260901000200') is not null then raise exception 'ARCHIVE_STATE_RECOVERY_FAILED'; end if;
  if to_regprocedure('public.archive_admin_affiliate(uuid,timestamptz,text)') is not null or to_regprocedure('public.list_admin_archived_affiliates(text,integer,integer,text)') is not null then raise exception 'ARCHIVE_RPC_RECOVERY_FAILED'; end if;
  if exists(select 1 from pg_trigger where tgrelid='public.program_requests'::regclass and tgname='program_requests_guard_archived_affiliate' and not tgisinternal) then raise exception 'ARCHIVE_TRIGGER_RECOVERY_FAILED'; end if;
end $verify$;`;
const lifecycleMatrix=`
do $matrix$
declare v_admin uuid;v_target public.affiliates%rowtype;v_result jsonb;v_duplicates jsonb;v_control text;v_target_id uuid;
begin
  select aa.auth_user_id into v_admin from public.admin_assignments aa where aa.enabled and exists(select 1 from public.admin_role_permissions rp where rp.role_id=aa.role_id and rp.permission='affiliates.write') limit 1;
  if v_admin is null then raise exception 'ARCHIVE_MATRIX_ADMIN_MISSING'; end if;
  select * into v_target from public.affiliates where not is_archived order by source_row_ordinal nulls last limit 1;
  v_control:=v_target.numero_control;v_target_id:=v_target.id;
  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_admin::text,'role','authenticated')::text,true);
  set local role authenticated;
  v_result:=public.archive_admin_affiliate(v_target_id,v_target.updated_at,'Prueba transaccional de archivo reversible');
  if not coalesce((v_result->'profile'->>'is_archived')::boolean,false) then raise exception 'ARCHIVE_MATRIX_ARCHIVE_FAILED'; end if;
  if v_result->'profile'->>'numero_control' is distinct from v_control then raise exception 'ARCHIVE_MATRIX_CONTROL_CHANGED'; end if;
  if exists(select 1 from jsonb_array_elements(public.list_admin_affiliates(v_control,null,null,null,null,null,null,1,25,'name')->'items') x where x->>'id'=v_target_id::text) then raise exception 'ARCHIVE_MATRIX_NORMAL_LIST_LEAK'; end if;
  if not exists(select 1 from jsonb_array_elements(public.list_admin_archived_affiliates(v_control,1,25,'recent')->'items') x where x->>'id'=v_target_id::text) then raise exception 'ARCHIVE_MATRIX_ARCHIVED_LIST_MISSING'; end if;
  v_duplicates:=public.find_admin_affiliate_duplicates(jsonb_build_object('numero_control',v_control),null);
  if not exists(select 1 from jsonb_array_elements(v_duplicates) x where x->>'id'=v_target_id::text and x->>'match_state'='ARCHIVED_MATCH') then raise exception 'ARCHIVE_MATRIX_DUPLICATE_CLASS_FAILED'; end if;
  begin perform * from public.start_affiliate_impersonation(v_target_id,'Prueba de bloqueo de archivado');raise exception 'ARCHIVE_MATRIX_IMPERSONATION_ACCEPTED';exception when sqlstate '42501' then if sqlerrm<>'AFFILIATE_ARCHIVED' then raise;end if;end;
  v_result:=public.restore_admin_affiliate(v_target_id,(v_result->'profile'->>'updated_at')::timestamptz,'Prueba transaccional de restauración reversible');
  if coalesce((v_result->'profile'->>'is_archived')::boolean,true) then raise exception 'ARCHIVE_MATRIX_RESTORE_FAILED'; end if;
  if v_result->'profile'->>'numero_control' is distinct from v_control then raise exception 'ARCHIVE_MATRIX_RESTORE_CONTROL_CHANGED'; end if;
  reset role;
end $matrix$;`;
async function state(values){return (await management(values,`select json_build_object('applied',exists(select 1 from information_schema.columns where table_schema='public' and table_name='affiliates' and column_name='is_archived'),'affiliates',(select count(*) from public.affiliates),'documents',(select count(*) from public.affiliate_documents),'requests',(select count(*) from public.program_requests),'events',(select count(*) from public.affiliate_admin_events),'archived',(select count(*) from public.affiliates a where coalesce((to_jsonb(a)->>'is_archived')::boolean,false))) result`))[0].result;}
async function main(){const values=env();assert(values.SUPABASE_URL&&values.SUPABASE_ACCESS_TOKEN,'Supabase configuration missing');const before=await state(values);
  if(process.argv.includes('--recovery-dry-run')){assert(before.applied,'Migration must be applied before recovery dry-run');await management(values,'begin;'+body(recovery)+recoveryChecks+'rollback;');const after=await state(values);assert.deepEqual(after,before,'recovery dry-run persisted a change');console.log(JSON.stringify({status:'PASS',mode:'RECOVERY_DRY_RUN_APPLIED_STATE_PRESERVED',migration:'20260901000200',before,after,persistentWrites:0}));return;}
  if(process.argv.includes('--apply')){if(!before.applied)await management(values,migration);await management(values,'begin;'+checks+lifecycleMatrix+'rollback;');const after=await state(values);console.log(JSON.stringify({status:'PASS',mode:before.applied?'VERIFY_APPLIED':'APPLIED',migration:'20260901000200',before,after,persistentTestWrites:0}));return;}
  if(before.applied){await management(values,'begin;'+checks+lifecycleMatrix+'rollback;');console.log(JSON.stringify({status:'PASS',mode:'VERIFY_APPLIED',migration:'20260901000200',state:await state(values),persistentTestWrites:0}));return;}
  await management(values,'begin;'+body(migration)+checks+body(recovery)+recoveryChecks+'rollback;');
  await management(values,'begin;'+body(migration)+checks+lifecycleMatrix+'rollback;');
  const after=await state(values);assert.deepEqual(after,before,'dry-run persisted a change');
  console.log(JSON.stringify({status:'PASS',mode:'DRY_RUN_FORWARD_RECOVERY_AND_LIFECYCLE',migration:'20260901000200',before,after,persistentWrites:0}));
}
main().catch((error)=>{console.error(JSON.stringify({status:'FAIL',error:error.message}));process.exitCode=1;});
