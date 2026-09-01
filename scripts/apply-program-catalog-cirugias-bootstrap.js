'use strict';
const assert=require('assert').strict,fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),id='20260831000600_program_catalog_cirugias_bootstrap';
const migration=fs.readFileSync(path.join(root,'supabase/migrations/'+id+'.sql'),'utf8');
const recovery=fs.readFileSync(path.join(root,'supabase/recovery/'+id+'_recovery.sql'),'utf8');
const body=(text)=>text.replace(/^\s*begin;\s*/i,'').replace(/\s*commit;\s*$/i,'');
function env(){const out={};for(const raw of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const line=raw.trim(),at=line.indexOf('=');if(at>0&&!line.startsWith('#'))out[line.slice(0,at).trim()]=line.slice(at+1).trim().replace(/^['"]|['"]$/g,'');}return out;}
async function sql(values,query){const ref=new URL(values.SUPABASE_URL).hostname.split('.')[0],response=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:'Bearer '+values.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json','User-Agent':'SutiApp-Cirugias-Bootstrap/1.0'},body:JSON.stringify({query})});const data=await response.json().catch(()=>null);if(!response.ok)throw new Error('MANAGEMENT_SQL_'+response.status+':'+JSON.stringify(data).slice(0,1000));return data;}
const appliedChecks=`do $verify$ begin
  if to_regprocedure('public.create_first_cirugias_program_catalog_item(jsonb,jsonb)') is null then raise exception 'CIRUGIAS_BOOTSTRAP_MISSING'; end if;
  if has_table_privilege('authenticated','public.program_catalog_items','insert') or has_table_privilege('authenticated','public.program_catalog_items','update') or has_table_privilege('authenticated','public.program_catalog_items','delete') then raise exception 'PROGRAM_CATALOG_DIRECT_DML_EXPOSED'; end if;
  if has_function_privilege('anon','public.create_first_cirugias_program_catalog_item(jsonb,jsonb)','execute') or not has_function_privilege('authenticated','public.create_first_cirugias_program_catalog_item(jsonb,jsonb)','execute') then raise exception 'CIRUGIAS_BOOTSTRAP_RPC_GRANT_INVALID'; end if;
  if not exists(select 1 from public.admin_role_permissions rp join public.admin_roles r on r.id=rp.role_id where r.code='principal_admin' and rp.permission='program_catalog.write') then raise exception 'PROGRAM_CATALOG_PERMISSION_MISSING'; end if;
  if exists(select 1 from public.program_catalog_items where program_key in('market','rifas')) then raise exception 'OUT_OF_SCOPE_PROGRAM_KEY_ADDED'; end if;
end $verify$;`;
const recoveryChecks=`do $verify$ begin
  if to_regprocedure('public.create_first_cirugias_program_catalog_item(jsonb,jsonb)') is not null then raise exception 'CIRUGIAS_BOOTSTRAP_RECOVERY_FAILED'; end if;
  if to_regprocedure('public.save_program_catalog_item(uuid,jsonb,jsonb)') is null then raise exception 'GENERAL_PROGRAM_CATALOG_WRITER_LOST'; end if;
end $verify$;`;
async function snapshot(values){return (await sql(values,`select
  (select count(*)::int from public.program_catalog_items) item_count,
  (select count(*)::int from public.program_catalog_items where program_key='cirugias') cirugias_count,
  (select count(*)::int from public.program_catalog_items where program_key='terrenos') terrenos_count,
  (select count(*)::int from public.marketplace_products) marketplace_count,
  (select count(*)::int from public.admin_audit_log where resource='program_catalog_items' and details->>'program_key'='cirugias') cirugias_audit_count,
  md5(pg_get_functiondef('public.save_program_catalog_item(uuid,jsonb,jsonb)'::regprocedure)) general_writer_hash,
  (select coalesce(md5(string_agg(id::text||'|'||program_key||'|'||name||'|'||coalesce(price_cash::text,'')||'|'||requires_quote::text||'|'||enabled::text||'|'||sort_order::text||'|'||updated_at::text,';' order by id)),md5('')) from public.program_catalog_items) item_hash,
  (select coalesce(md5(string_agg(item_id::text||'|'||coalesce(public_asset_id::text,'')||'|'||coalesce(private_asset_id::text,'')||'|'||role||'|'||sort_order::text||'|'||enabled::text,';' order by item_id,id)),md5('')) from public.program_catalog_item_assets) asset_hash`))[0];}
async function main(){const values=env();assert(values.SUPABASE_URL&&values.SUPABASE_ACCESS_TOKEN,'Supabase management configuration missing');const before=await snapshot(values);assert.equal(Number(before.cirugias_count),0,'CIRUGIAS_PRODUCT_ALREADY_EXISTS');assert.equal(Number(before.cirugias_audit_count),0,'CIRUGIAS_ADMIN_HISTORY_ALREADY_EXISTS');assert.equal(Number(before.terrenos_count),3,'TERRENOS_BASELINE_CHANGED');const applied=(await sql(values,"select to_regprocedure('public.create_first_cirugias_program_catalog_item(jsonb,jsonb)') is not null applied"))[0].applied===true;
  if(process.argv.includes('--recovery-dry-run')){assert(applied,'CIRUGIAS_BOOTSTRAP_NOT_APPLIED');await sql(values,'begin;'+body(recovery)+recoveryChecks+body(migration)+appliedChecks+'rollback;');const after=await snapshot(values);assert.deepEqual(after,before,'recovery dry-run changed persistent state');console.log(JSON.stringify({status:'PASS',mode:'RECOVERY_DRY_RUN_APPLIED',migration:id,cirugiasProducts:0,terrenos:Number(after.terrenos_count),persistentWrites:0}));return;}
  if(process.argv.includes('--apply')){if(!applied)await sql(values,migration);await sql(values,'begin;'+appliedChecks+'rollback;');const after=await snapshot(values);assert.deepEqual(after,before,'migration changed catalog rows or audit history');console.log(JSON.stringify({status:'PASS',mode:applied?'VERIFY_APPLIED':'APPLIED',migration:id,items:Number(after.item_count),cirugiasProducts:0,terrenos:Number(after.terrenos_count),marketplaceTouched:0,persistentRowWrites:0}));return;}
  if(applied){await sql(values,'begin;'+appliedChecks+'rollback;');console.log(JSON.stringify({status:'PASS',mode:'VERIFY_APPLIED',migration:id,cirugiasProducts:0,terrenos:Number(before.terrenos_count)}));return;}
  await sql(values,'begin;'+body(migration)+appliedChecks+body(recovery)+recoveryChecks+'rollback;');const after=await snapshot(values);assert.deepEqual(after,before,'forward/recovery dry-run changed persistent state');console.log(JSON.stringify({status:'PASS',mode:'DRY_RUN_FORWARD_RECOVERY',migration:id,cirugiasProducts:0,terrenos:Number(before.terrenos_count),marketplaceCount:Number(before.marketplace_count),persistentWrites:0}));}
main().catch((error)=>{console.error(JSON.stringify({status:'FAIL',error:error.message}));process.exitCode=1;});
