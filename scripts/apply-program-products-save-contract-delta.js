'use strict';
const assert=require('assert').strict,fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),id='20260831000800_program_products_save_contract_delta';
const migration=fs.readFileSync(path.join(root,'supabase/migrations/'+id+'.sql'),'utf8');
const recovery=fs.readFileSync(path.join(root,'supabase/recovery/'+id+'_recovery.sql'),'utf8');
const body=(text)=>text.replace(/^\s*begin;\s*/i,'').replace(/\s*commit;\s*$/i,'');
function env(){const out={};for(const raw of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const line=raw.trim(),at=line.indexOf('=');if(at>0&&!line.startsWith('#'))out[line.slice(0,at).trim()]=line.slice(at+1).trim().replace(/^['"]|['"]$/g,'');}return out;}
async function sql(values,query){const ref=new URL(values.SUPABASE_URL).hostname.split('.')[0],response=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:'Bearer '+values.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json','User-Agent':'SutiApp-Program-Save-Contract/1.0'},body:JSON.stringify({query})});const data=await response.json().catch(()=>null);if(!response.ok)throw new Error('MANAGEMENT_SQL_'+response.status+':'+JSON.stringify(data).slice(0,1800));return data;}
async function snapshot(values){return (await sql(values,`select
  (select count(*)::int from public.program_catalog_items) item_count,
  (select count(*)::int from public.program_catalog_item_assets) asset_count,
  (select count(*)::int from public.marketplace_products) marketplace_count,
  (select count(*)::int from public.program_requests) request_count,
  (select count(*)::int from public.admin_audit_log) audit_count,
  (select count(*)::int from public.program_catalog_items where price_cash is not null) priced_count,
  (select md5(coalesce(string_agg(to_jsonb(i)::text,';' order by i.id),'')) from public.program_catalog_items i) item_hash,
  (select md5(coalesce(string_agg(to_jsonb(a)::text,';' order by a.id),'')) from public.program_catalog_item_assets a) asset_hash,
  to_regclass('public.program_catalog_save_contract_migration_backup') is not null backup_exists,
  pg_get_functiondef('public.save_program_catalog_item(uuid,jsonb,jsonb)'::regprocedure) like '%v_allowed_asset_count%' delta_writer_active`))[0];}
const appliedChecks=`do $verify$ begin
  if not exists(select 1 from pg_constraint where conrelid='public.program_catalog_items'::regclass and conname='program_catalog_items_program_check' and pg_get_constraintdef(oid) like '%cirugias%') then raise exception 'CIRUGIAS_CONSTRAINT_NOT_FIXED'; end if;
  if not exists(select 1 from public.program_catalog_save_contract_migration_backup) then raise exception 'SAVE_CONTRACT_BACKUP_MISSING'; end if;
  if has_table_privilege('authenticated','public.program_catalog_items','insert') or has_table_privilege('authenticated','public.program_catalog_items','update') or has_table_privilege('authenticated','public.program_catalog_items','delete') then raise exception 'DIRECT_DML_EXPOSED'; end if;
  if has_table_privilege('anon','public.program_catalog_save_contract_migration_backup','select') or has_table_privilege('authenticated','public.program_catalog_save_contract_migration_backup','select') then raise exception 'BACKUP_EXPOSED'; end if;
  if not has_function_privilege('authenticated','public.save_program_catalog_item(uuid,jsonb,jsonb)','execute') or has_function_privilege('anon','public.save_program_catalog_item(uuid,jsonb,jsonb)','execute') then raise exception 'WRITER_GRANTS_INVALID'; end if;
  if exists(select 1 from pg_class where oid in('public.program_catalog_items'::regclass,'public.program_catalog_item_assets'::regclass,'public.program_catalog_save_contract_migration_backup'::regclass) and (not relrowsecurity or not relforcerowsecurity)) then raise exception 'PROGRAM_CATALOG_RLS_NOT_FORCED'; end if;
  if not exists(select 1 from pg_trigger where tgrelid='public.program_catalog_item_assets'::regclass and tgname='program_catalog_asset_owner_guard' and not tgisinternal) then raise exception 'ASSET_OWNER_GUARD_MISSING'; end if;
  if (select count(*) from pg_policies where schemaname='storage' and tablename='objects' and policyname in('program_catalog_storage_admin_insert','program_catalog_storage_admin_update','program_catalog_storage_admin_delete'))<>3 then raise exception 'PROGRAM_CATALOG_STORAGE_POLICIES_MISSING'; end if;
end $verify$;`;
const recoveryChecks=`do $verify$ begin
  if to_regclass('public.program_catalog_save_contract_migration_backup') is not null then raise exception 'RECOVERY_BACKUP_REMAINS'; end if;
  if pg_get_functiondef('public.save_program_catalog_item(uuid,jsonb,jsonb)'::regprocedure) like '%v_allowed_asset_count%' then raise exception 'RECOVERY_WRITER_REMAINS'; end if;
  if exists(select 1 from pg_constraint where conrelid='public.program_catalog_items'::regclass and conname='program_catalog_items_program_check' and pg_get_constraintdef(oid) like '%cirugias%') then raise exception 'RECOVERY_CONSTRAINT_REMAINS'; end if;
end $verify$;`;
const runtimeChecks=`do $runtime$
declare
  v_admin uuid;v_auto public.program_catalog_items%rowtype;v_farma public.program_catalog_items%rowtype;v_loan public.program_catalog_items%rowtype;v_regular public.program_catalog_items%rowtype;
  v_payload jsonb;v_links jsonb;v_eight jsonb;v_nine jsonb;v_result jsonb;
begin
  select a.auth_user_id into v_admin from public.admin_assignments a join public.admin_roles r on r.id=a.role_id join public.admin_role_permissions rp on rp.role_id=r.id and rp.permission='program_catalog.write' where a.enabled and r.enabled order by a.created_at limit 1;
  select i.* into v_auto from public.program_catalog_items i where i.program_key='auto' and (select count(*) from public.program_catalog_item_assets a where a.item_id=i.id and a.enabled)=9 order by i.sort_order limit 1;
  select * into v_farma from public.program_catalog_items where program_key='farma' and commercial_mode='PAYROLL_FIXED' and price_cash is null order by sort_order limit 1;
  select * into v_loan from public.program_catalog_items where program_key='prestamo' and sort_order=0 limit 1;
  select * into v_regular from public.program_catalog_items where price_cash>0 and commercial_mode='PAYROLL_FIXED' and sort_order between 1 and 9999 order by program_key,sort_order limit 1;
  if v_admin is null or v_auto.id is null or v_farma.id is null or v_loan.id is null or v_regular.id is null then raise exception 'SAVE_CONTRACT_FIXTURE_MISSING'; end if;
  select jsonb_agg(jsonb_build_object('link_id',id) order by sort_order),jsonb_agg(jsonb_build_object('link_id',id) order by sort_order) filter(where sort_order<=8) into v_nine,v_eight from public.program_catalog_item_assets where item_id=v_auto.id and enabled;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_admin,'role','authenticated')::text,true);

  v_payload:=jsonb_build_object('program_key',v_auto.program_key,'name',v_auto.name,'description',v_auto.description,'category_raw',v_auto.category_raw,'price_cash',v_auto.price_cash,'requires_quote',v_auto.requires_quote,'commercial_mode',v_auto.commercial_mode,'sold',true,'enabled',v_auto.enabled,'sort_order',v_auto.sort_order);
  v_result:=public.save_program_catalog_item(v_auto.id,v_payload,v_nine);
  if not (v_result->>'sold')::boolean then raise exception 'AUTO_9_TO_9_UNRELATED_EDIT_FAILED'; end if;
  begin perform public.save_program_catalog_item(v_auto.id,v_payload,v_nine||(v_nine->0));raise exception 'NINE_TO_TEN_ALLOWED';exception when others then if sqlerrm<>'PROGRAM_CATALOG_IMAGE_LIMIT_EXCEEDED' then raise;end if;end;
  perform public.save_program_catalog_item(v_auto.id,v_payload,v_eight);
  begin perform public.save_program_catalog_item(v_auto.id,v_payload,v_nine);raise exception 'EIGHT_TO_NINE_ALLOWED';exception when others then if sqlerrm<>'PROGRAM_CATALOG_IMAGE_LIMIT_EXCEEDED' then raise;end if;end;
  perform public.save_program_catalog_item(v_auto.id,v_payload,v_eight);

  v_payload:=jsonb_build_object('program_key',v_farma.program_key,'name',v_farma.name,'description',v_farma.description,'category_raw',v_farma.category_raw,'price_cash',v_farma.price_cash,'requires_quote',v_farma.requires_quote,'commercial_mode',v_farma.commercial_mode,'sold',true,'enabled',v_farma.enabled,'sort_order',v_farma.sort_order);
  v_result:=public.save_program_catalog_item(v_farma.id,v_payload,'[]'::jsonb);
  if (v_result->'price_cash')<>'null'::jsonb then raise exception 'FARMA_NULL_PRICE_NOT_PRESERVED'; end if;
  v_result:=public.save_program_catalog_item(v_farma.id,v_payload||jsonb_build_object('price_cash',100),'[]'::jsonb);
  if (v_result->>'price_cash')::numeric<>100 then raise exception 'FARMA_POSITIVE_PRICE_EDIT_FAILED'; end if;

  v_payload:=jsonb_build_object('program_key',v_loan.program_key,'name',v_loan.name,'description',coalesce(v_loan.description,'')||' ','category_raw',v_loan.category_raw,'price_cash',v_loan.price_cash,'requires_quote',v_loan.requires_quote,'commercial_mode',v_loan.commercial_mode,'sold',v_loan.sold,'enabled',v_loan.enabled,'sort_order',v_loan.sort_order);
  v_result:=public.save_program_catalog_item(v_loan.id,v_payload,'[]'::jsonb);
  if (v_result->>'sort_order')::int<>0 then raise exception 'LEGACY_ORDER_NOT_PRESERVED'; end if;

  select coalesce(jsonb_agg(jsonb_build_object('link_id',id) order by sort_order),'[]'::jsonb) into v_links from public.program_catalog_item_assets where item_id=v_regular.id and enabled;
  v_payload:=jsonb_build_object('program_key',v_regular.program_key,'name',v_regular.name||' T','description',coalesce(v_regular.description,'')||' T','category_raw',coalesce(v_regular.category_raw,'')||' T','price_cash',v_regular.price_cash+1,'requires_quote',false,'commercial_mode','PAYROLL_FIXED','sold',true,'enabled',false,'sort_order',v_regular.sort_order+1);
  v_result:=public.save_program_catalog_item(v_regular.id,v_payload,v_links);
  if v_result->>'name'<>v_regular.name||' T' or (v_result->>'price_cash')::numeric<>v_regular.price_cash+1 or (v_result->>'enabled')::boolean or not (v_result->>'sold')::boolean then raise exception 'GLOBAL_FIELD_EDIT_FAILED'; end if;
  v_result:=public.save_program_catalog_item(v_regular.id,v_payload||jsonb_build_object('commercial_mode','PAYROLL_QUOTE','requires_quote',true),v_links);
  if v_result->>'commercial_mode'<>'PAYROLL_QUOTE' then raise exception 'MODE_EDIT_FAILED'; end if;
  begin perform public.save_program_catalog_item(v_regular.id,v_payload||jsonb_build_object('commercial_mode','PAYROLL_QUOTE','requires_quote',false),v_links);raise exception 'MODE_MISMATCH_ALLOWED';exception when others then if sqlerrm<>'PROGRAM_CATALOG_MODE_QUOTE_MISMATCH' then raise;end if;end;

  begin perform public.create_first_cirugias_program_catalog_item(jsonb_build_object('program_key','cirugias','name','Prueba transaccional','description',null,'category_raw',null,'price_cash',null,'requires_quote',false,'commercial_mode','PAYROLL_FIXED','sold',false,'enabled',true,'sort_order',1),'[]'::jsonb);raise exception 'INVALID_NEW_FIXED_PRICE_ALLOWED';exception when others then if sqlerrm<>'PROGRAM_CATALOG_PRICE_REQUIRED' then raise;end if;end;
  v_result:=public.create_first_cirugias_program_catalog_item(jsonb_build_object('program_key','cirugias','name','Prueba transaccional','description','Sólo rollback','category_raw','Prueba','price_cash',100,'requires_quote',false,'commercial_mode','PAYROLL_FIXED','sold',false,'enabled',true,'sort_order',1),'[]'::jsonb);
  if v_result->>'program_key'<>'cirugias' or v_result->>'record_origin'<>'ADMIN_PROGRAM_CATALOG' then raise exception 'CIRUGIAS_CREATE_CONTRACT_FAILED'; end if;

  perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated')::text,true);
  begin perform public.save_program_catalog_item(v_regular.id,v_payload,v_links);raise exception 'UNAUTHORIZED_WRITER_ALLOWED';exception when others then if sqlerrm<>'PROGRAM_CATALOG_WRITE_REQUIRED' then raise;end if;end;
end $runtime$;`;
const postApplyRuntimeChecks=`do $runtime$
declare
  v_admin uuid;v_item public.program_catalog_items%rowtype;v_payload jsonb;v_links jsonb;v_nine jsonb;v_eight jsonb;v_result jsonb;v_checked integer:=0;
begin
  select a.auth_user_id into v_admin from public.admin_assignments a join public.admin_roles r on r.id=a.role_id join public.admin_role_permissions rp on rp.role_id=r.id and rp.permission='program_catalog.write' where a.enabled and r.enabled order by a.created_at limit 1;
  if v_admin is null then raise exception 'SAVE_CONTRACT_ADMIN_MISSING'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_admin,'role','authenticated')::text,true);
  for v_item in
    select i.* from public.program_catalog_items i where
      (i.commercial_mode='PAYROLL_FIXED' and i.price_cash is null)
      or i.sort_order not between 1 and 10000
      or (select count(*) from public.program_catalog_item_assets a where a.item_id=i.id and a.enabled)>8
    order by i.program_key,i.sort_order,i.id
  loop
    select coalesce(jsonb_agg(jsonb_build_object('link_id',id) order by sort_order),'[]'::jsonb) into v_links from public.program_catalog_item_assets where item_id=v_item.id and enabled;
    v_payload:=jsonb_build_object('program_key',v_item.program_key,'name',v_item.name,'description',coalesce(v_item.description,'')||' [transactional validation]','category_raw',v_item.category_raw,'price_cash',v_item.price_cash,'requires_quote',v_item.requires_quote,'commercial_mode',v_item.commercial_mode,'sold',v_item.sold,'enabled',v_item.enabled,'sort_order',v_item.sort_order);
    v_result:=public.save_program_catalog_item(v_item.id,v_payload,v_links);
    if v_result->>'program_key'<>v_item.program_key or (v_result->>'sold')::boolean<>v_item.sold or (v_result->>'enabled')::boolean<>v_item.enabled or v_result->>'commercial_mode'<>v_item.commercial_mode or (v_result->>'price_cash')::numeric is distinct from v_item.price_cash then raise exception 'HISTORICAL_UNRELATED_EDIT_CHANGED_PROTECTED_VALUE'; end if;
    v_checked:=v_checked+1;
  end loop;
  if v_checked<>54 then raise exception 'HISTORICAL_CASE_COUNT_INVALID:%',v_checked; end if;

  select i.* into v_item from public.program_catalog_items i where i.program_key='auto' and (select count(*) from public.program_catalog_item_assets a where a.item_id=i.id and a.enabled)=9 order by i.sort_order limit 1;
  select jsonb_agg(jsonb_build_object('link_id',id) order by sort_order),jsonb_agg(jsonb_build_object('link_id',id) order by sort_order) filter(where sort_order<=8) into v_nine,v_eight from public.program_catalog_item_assets where item_id=v_item.id and enabled;
  v_payload:=jsonb_build_object('program_key',v_item.program_key,'name',v_item.name,'description',v_item.description,'category_raw',v_item.category_raw,'price_cash',v_item.price_cash,'requires_quote',v_item.requires_quote,'commercial_mode',v_item.commercial_mode,'sold',v_item.sold,'enabled',v_item.enabled,'sort_order',v_item.sort_order);
  perform public.save_program_catalog_item(v_item.id,v_payload,v_nine);
  begin perform public.save_program_catalog_item(v_item.id,v_payload,v_nine||(v_nine->0));raise exception 'NINE_TO_TEN_ALLOWED';exception when others then if sqlerrm<>'PROGRAM_CATALOG_IMAGE_LIMIT_EXCEEDED' then raise;end if;end;
  perform public.save_program_catalog_item(v_item.id,v_payload,v_eight);
  perform public.save_program_catalog_item(v_item.id,v_payload,v_eight);
  begin perform public.save_program_catalog_item(v_item.id,v_payload,v_nine);raise exception 'EIGHT_TO_NINE_ALLOWED';exception when others then if sqlerrm<>'PROGRAM_CATALOG_IMAGE_LIMIT_EXCEEDED' then raise;end if;end;

  perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated')::text,true);
  begin perform public.save_program_catalog_item(v_item.id,v_payload,v_nine);raise exception 'UNAUTHORIZED_WRITER_ALLOWED';exception when others then if sqlerrm<>'PROGRAM_CATALOG_WRITE_REQUIRED' then raise;end if;end;
end $runtime$;`;
async function main(){
  const values=env();assert(values.SUPABASE_URL&&values.SUPABASE_ACCESS_TOKEN,'Supabase management configuration missing');
  const before=await snapshot(values);assert.equal(Number(before.item_count),135);assert.equal(Number(before.priced_count),65);
  const already=(await sql(values,"select to_regclass('public.program_catalog_save_contract_migration_backup') is not null applied"))[0].applied===true;
  if(process.argv.includes('--apply')){
    assert(process.argv.includes('--confirm-production'),'PRODUCTION_CONFIRMATION_REQUIRED');assert(!already,'MIGRATION_ALREADY_APPLIED');
    await sql(values,migration);await sql(values,'begin;'+appliedChecks+postApplyRuntimeChecks+'rollback;');
    const after=await snapshot(values);for(const key of ['item_count','asset_count','marketplace_count','request_count','audit_count','priced_count','item_hash','asset_hash'])assert.equal(after[key],before[key],key+' changed during migration');assert.equal(after.backup_exists,true);assert.equal(after.delta_writer_active,true);
    console.log(JSON.stringify({status:'PASS',mode:'APPLIED_AND_VERIFIED',migration:id,items:Number(after.item_count),affectedHistorical:54,priced:Number(after.priced_count),businessRowsChanged:0,assetsChanged:0,auditsCreated:0,marketplaceChanged:0,requestsChanged:0}));return;
  }
  if(process.argv.includes('--recovery-dry-run')){
    assert(already,'MIGRATION_NOT_APPLIED');await sql(values,'begin;'+body(recovery)+recoveryChecks+body(migration)+appliedChecks+'rollback;');const after=await snapshot(values);assert.deepEqual(after,before,'recovery dry-run changed persistent state');console.log(JSON.stringify({status:'PASS',mode:'RECOVERY_DRY_RUN_APPLIED',migration:id,persistentWrites:0}));return;
  }
  if(process.argv.includes('--verify-applied')){
    assert(already,'MIGRATION_NOT_APPLIED');assert.equal(before.backup_exists,true);assert.equal(before.delta_writer_active,true);await sql(values,'begin;'+appliedChecks+postApplyRuntimeChecks+'rollback;');const after=await snapshot(values);assert.deepEqual(after,before,'applied verification changed persistent state');console.log(JSON.stringify({status:'PASS',mode:'VERIFY_APPLIED',migration:id,items:Number(after.item_count),affectedHistorical:54,priced:Number(after.priced_count),persistentWrites:0}));return;
  }
  if(process.argv.includes('--audit')){const audit=(await sql(values,`select count(*) filter(where conflict_count>0)::int affected_count,count(*)::int item_count,(select count(*)::int from public.admin_audit_log l join public.program_catalog_save_contract_migration_backup b on b.singleton where l.resource='program_catalog_items' and l.created_at>=b.applied_at) recovery_blocking_audits,(select count(*)::int from public.program_catalog_item_assets where enabled) enabled_assets,(select max(c) from(select count(*) c from public.program_catalog_item_assets where enabled group by item_id)x) max_images,(select count(*)::int from public.program_catalog_items where commercial_mode='PAYROLL_FIXED') fixed_count,(select count(*)::int from public.program_catalog_items where commercial_mode='PAYROLL_QUOTE') quote_count,(select count(*)::int from public.program_catalog_items where commercial_mode='DIRECT_CONTACT') direct_count,(select count(*)::int from public.program_catalog_items where sold) sold_count,(select count(*)::int from public.program_catalog_items where enabled) enabled_count,(select count(*)::int from public.program_catalog_items where record_origin='HISTORICAL_IMPORT') historical_origin_count,(select md5(string_agg(id::text||'|'||coalesce(price_cash::text,'')||'|'||requires_quote::text,';' order by id)) from public.program_catalog_items) price_quote_hash from(select i.id,(case when i.commercial_mode='PAYROLL_FIXED' and i.price_cash is null then 1 else 0 end)+(case when i.sort_order not between 1 and 10000 then 1 else 0 end)+(case when (select count(*) from public.program_catalog_item_assets a where a.item_id=i.id and a.enabled)>8 then 1 else 0 end) conflict_count from public.program_catalog_items i)s`))[0];console.log(JSON.stringify({status:'PASS_AUDIT',mode:'READ_ONLY',items:Number(audit.item_count),historicalCases:Number(audit.affected_count),priced:Number(before.priced_count),enabledAssets:Number(audit.enabled_assets),maxImages:Number(audit.max_images),modes:{fixed:Number(audit.fixed_count),quote:Number(audit.quote_count),direct:Number(audit.direct_count)},sold:Number(audit.sold_count),enabled:Number(audit.enabled_count),historicalOrigin:Number(audit.historical_origin_count),priceQuoteHash:audit.price_quote_hash,recoveryBlockingAudits:Number(audit.recovery_blocking_audits),persistentWrites:0}));return;}
  assert(!already,'MIGRATION_ALREADY_APPLIED_USE_VERIFY');
  await sql(values,'begin;'+body(migration)+appliedChecks+runtimeChecks+'rollback;');
  const afterForward=await snapshot(values);assert.deepEqual(afterForward,before,'forward dry-run changed persistent state');
  await sql(values,'begin;'+body(migration)+appliedChecks+body(recovery)+'rollback;');
  const afterRecovery=await snapshot(values);assert.deepEqual(afterRecovery,before,'recovery dry-run changed persistent state');
  console.log(JSON.stringify({status:'PASS',mode:'DRY_RUN_FORWARD_RECOVERY',migration:id,items:135,affectedHistorical:54,priced:65,imageTransitions:{allowed:['9→9','9→8','8→8'],denied:['8→9','9→10']},fieldEdits:true,specificDenials:true,security:true,persistentWrites:0}));
}
main().catch((error)=>{console.error(JSON.stringify({status:'FAIL',error:error.message}));process.exitCode=1;});
