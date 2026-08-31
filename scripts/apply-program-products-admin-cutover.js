'use strict';
const assert=require('assert').strict,fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),id='20260831000400_program_products_admin_cutover',hardeningId='20260831000401_program_catalog_asset_owner_guard';
const migration=fs.readFileSync(path.join(root,'supabase/migrations/'+id+'.sql'),'utf8');
const hardening=fs.readFileSync(path.join(root,'supabase/migrations/'+hardeningId+'.sql'),'utf8');
const recovery=fs.readFileSync(path.join(root,'supabase/recovery/'+id+'_recovery.sql'),'utf8');
const body=(text)=>text.replace(/^\s*begin;\s*/i,'').replace(/\s*commit;\s*$/i,'');
function env(){const out={};for(const raw of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const line=raw.trim(),at=line.indexOf('=');if(at>0&&!line.startsWith('#'))out[line.slice(0,at).trim()]=line.slice(at+1).trim().replace(/^['"]|['"]$/g,'');}return out;}
async function sql(values,query){const ref=new URL(values.SUPABASE_URL).hostname.split('.')[0],response=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:'Bearer '+values.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json','User-Agent':'SutiApp-ProgramProducts-Cutover/1.0'},body:JSON.stringify({query})});const data=await response.json().catch(()=>null);if(!response.ok)throw new Error('MANAGEMENT_SQL_'+response.status+':'+JSON.stringify(data).slice(0,1000));return data;}
const checks=`do $verify$
declare v_items integer;v_assets integer;v_conflicts integer;v_fixed integer;v_audit integer;
begin
  select count(*) into v_items from public.program_catalog_items;
  select count(*) into v_assets from public.program_catalog_item_assets where enabled;
  select count(*) into v_conflicts from public.program_catalog_items where price_cash is not null and requires_quote;
  select count(*) into v_fixed from public.program_catalog_items where price_cash is not null and not requires_quote;
  select count(*) into v_audit from public.program_catalog_price_mode_reconciliation;
  if v_items<>135 or v_assets<>268 or v_conflicts<>0 or v_fixed<>65 or v_audit<>65 then raise exception 'PROGRAM_CATALOG_RECONCILIATION_FAILED:%/%/%/%/%',v_items,v_assets,v_conflicts,v_fixed,v_audit; end if;
  if (select count(*) from public.program_catalog_items where program_key='aires')<>16 or (select count(*) from public.program_catalog_items where program_key='aires' and price_cash is not null and not requires_quote)<>16 then raise exception 'AIRES_RECONCILIATION_FAILED'; end if;
  if (select count(*) from public.program_catalog_items where program_key='puertas' and price_cash is not null and not requires_quote)<>3 then raise exception 'PUERTAS_RECONCILIATION_FAILED'; end if;
  if exists(select 1 from public.program_catalog_price_mode_reconciliation r join public.program_catalog_items i on i.id=r.item_id where i.price_cash<>r.price_cash) then raise exception 'PROGRAM_PRICE_CHANGED'; end if;
  if to_regprocedure('public.save_program_catalog_item(uuid,jsonb,jsonb)') is null or to_regprocedure('public.register_program_catalog_asset(text,text,bigint,text,text)') is null or to_regprocedure('public.reorder_program_catalog_items(text,uuid[])') is null then raise exception 'PROGRAM_CATALOG_RPC_MISSING'; end if;
  if to_regprocedure('public.enforce_program_catalog_asset_owner()') is null or not exists(select 1 from pg_trigger where tgname='program_catalog_asset_owner_guard' and not tgisinternal) then raise exception 'PROGRAM_CATALOG_ASSET_OWNER_GUARD_MISSING'; end if;
  if has_table_privilege('authenticated','public.program_catalog_items','insert') or has_table_privilege('authenticated','public.program_catalog_items','update') or has_table_privilege('authenticated','public.program_catalog_items','delete') then raise exception 'PROGRAM_CATALOG_DIRECT_DML_EXPOSED'; end if;
  if has_function_privilege('anon','public.save_program_catalog_item(uuid,jsonb,jsonb)','execute') or not has_function_privilege('authenticated','public.save_program_catalog_item(uuid,jsonb,jsonb)','execute') then raise exception 'PROGRAM_CATALOG_RPC_GRANT_INVALID'; end if;
  if not exists(select 1 from public.admin_role_permissions rp join public.admin_roles r on r.id=rp.role_id where r.code='principal_admin' and rp.permission='program_catalog.write') then raise exception 'PROGRAM_CATALOG_PERMISSION_MISSING'; end if;
  if exists(select 1 from public.program_catalog_items where record_origin='HISTORICAL_IMPORT' and (source_sheet is null or source_row_ordinal is null or source_snapshot_hash is null)) then raise exception 'HISTORICAL_PROVENANCE_LOST'; end if;
end $verify$;`;
const recoveryChecks=`do $verify$ begin
  if to_regclass('public.program_catalog_price_mode_reconciliation') is not null then raise exception 'RECONCILIATION_AUDIT_RECOVERY_FAILED'; end if;
  if to_regprocedure('public.save_program_catalog_item(uuid,jsonb,jsonb)') is not null then raise exception 'PROGRAM_CATALOG_RPC_RECOVERY_FAILED'; end if;
  if (select count(*) from public.program_catalog_items where price_cash is not null and requires_quote)<>65 then raise exception 'PROGRAM_PRICE_MODE_RECOVERY_FAILED'; end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='program_catalog_item_assets' and column_name in('id','enabled')) then raise exception 'PROGRAM_ASSET_SCHEMA_RECOVERY_FAILED'; end if;
end $verify$;`;
async function snapshot(values){return (await sql(values,`select
  (select count(*)::int from public.program_catalog_items) item_count,
  (select count(*)::int from public.program_catalog_item_assets) asset_count,
  (select count(*)::int from public.marketplace_products) marketplace_count,
  (select count(*)::int from public.program_catalog_items where price_cash is not null and requires_quote) conflict_count,
  (select coalesce(md5(string_agg(id::text||'|'||program_key||'|'||name||'|'||coalesce(price_cash::text,'')||'|'||requires_quote::text||'|'||enabled::text||'|'||sort_order::text||'|'||updated_at::text,';' order by id)),md5('')) from public.program_catalog_items) item_hash,
  (select coalesce(md5(string_agg(item_id::text||'|'||coalesce(public_asset_id::text,'')||'|'||coalesce(private_asset_id::text,'')||'|'||role||'|'||sort_order::text||'|'||source_column||'|'||source_column_letter,';' order by item_id,source_column_letter,sort_order)),md5('')) from public.program_catalog_item_assets) asset_hash`))[0];}
async function main(){const values=env();assert(values.SUPABASE_URL&&values.SUPABASE_ACCESS_TOKEN,'Supabase management configuration missing');const before=await snapshot(values);assert.equal(Number(before.item_count),135);assert.equal(Number(before.asset_count),268);assert.equal(Number(before.marketplace_count),0);const applied=(await sql(values,"select to_regclass('public.program_catalog_price_mode_reconciliation') is not null applied"))[0].applied===true;
  if(process.argv.includes('--audit-storage-policies')){const policies=await sql(values,"select policyname,cmd,roles,qual,with_check from pg_policies where schemaname='storage' and tablename='objects' and cmd in('INSERT','UPDATE','DELETE','ALL') order by policyname");console.log(JSON.stringify({status:'PASS',mode:'STORAGE_POLICY_AUDIT',policies}));return;}
  if(process.argv.includes('--recovery-dry-run')){assert(applied,'PROGRAM_CATALOG_CUTOVER_NOT_APPLIED');await sql(values,'begin;'+body(recovery)+recoveryChecks+'rollback;');await sql(values,'begin;'+checks+'rollback;');const after=await snapshot(values);assert.deepEqual(after,before,'recovery dry-run changed persistent catalog state');console.log(JSON.stringify({status:'PASS',mode:'RECOVERY_DRY_RUN_APPLIED',migration:id,items:Number(after.item_count),assets:Number(after.asset_count),conflicts:Number(after.conflict_count),persistentWrites:0}));return;}
  if(process.argv.includes('--apply')){if(!applied)await sql(values,migration);const guarded=(await sql(values,"select exists(select 1 from pg_trigger where tgname='program_catalog_asset_owner_guard' and not tgisinternal) guarded"))[0].guarded===true;if(!guarded)await sql(values,hardening);await sql(values,'begin;'+checks+'rollback;');const after=await snapshot(values);assert.equal(Number(after.item_count),135);assert.equal(Number(after.asset_count),268);assert.equal(Number(after.marketplace_count),0);assert.equal(Number(after.conflict_count),0);console.log(JSON.stringify({status:'PASS',mode:applied?'VERIFY_APPLIED':'APPLIED',migration:id,hardening:hardeningId,items:Number(after.item_count),assets:Number(after.asset_count),marketplaceTouched:0,conflictsBefore:Number(before.conflict_count),conflictsAfter:Number(after.conflict_count)}));return;}
  if(applied){await sql(values,'begin;'+checks+'rollback;');console.log(JSON.stringify({status:'PASS',mode:'VERIFY_APPLIED',migration:id,items:Number(before.item_count),assets:Number(before.asset_count),conflicts:Number(before.conflict_count)}));return;}
  await sql(values,'begin;'+body(migration)+checks+body(recovery)+recoveryChecks+'rollback;');const after=await snapshot(values);assert.deepEqual(after,before,'dry-run forward/recovery changed persistent catalog state');console.log(JSON.stringify({status:'PASS',mode:'DRY_RUN_FORWARD_RECOVERY',migration:id,items:Number(before.item_count),assets:Number(before.asset_count),marketplaceCount:Number(before.marketplace_count),conflictsBefore:Number(before.conflict_count),persistentWrites:0}));}
main().catch((error)=>{console.error(JSON.stringify({status:'FAIL',error:error.message}));process.exitCode=1;});
