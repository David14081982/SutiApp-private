'use strict';
const assert=require('assert').strict,fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),id='20260831000500_universal_program_product_payment_simulator',projectionId='20260831000501_universal_program_product_payment_admin_projection';
const migration=fs.readFileSync(path.join(root,'supabase/migrations/'+id+'.sql'),'utf8');
const recovery=fs.readFileSync(path.join(root,'supabase/recovery/'+id+'_recovery.sql'),'utf8');
const projectionMigration=fs.readFileSync(path.join(root,'supabase/migrations/'+projectionId+'.sql'),'utf8');
const projectionRecovery=fs.readFileSync(path.join(root,'supabase/recovery/'+projectionId+'_recovery.sql'),'utf8');
const body=(text)=>text.replace(/^\s*begin;\s*/i,'').replace(/\s*commit;\s*$/i,'');
function env(){const out={};for(const raw of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const line=raw.trim(),at=line.indexOf('=');if(at>0&&!line.startsWith('#'))out[line.slice(0,at).trim()]=line.slice(at+1).trim().replace(/^['"]|['"]$/g,'');}return out;}
async function sql(values,query){const ref=new URL(values.SUPABASE_URL).hostname.split('.')[0],response=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:'Bearer '+values.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json','User-Agent':'SutiApp-UniversalProgramPayment/1.0'},body:JSON.stringify({query})});const data=await response.json().catch(()=>null);if(!response.ok)throw new Error('MANAGEMENT_SQL_'+response.status+':'+JSON.stringify(data).slice(0,1200));return data;}
const checks=`do $verify$
declare v_jub jsonb;v_p1 jsonb;v_constraint text;
begin
  if to_regprocedure('public.generate_program_product_payment_schedule(date,text,integer,numeric,numeric)') is null
     or to_regprocedure('public.create_validated_program_product_payment_request(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,integer,date)') is null
     or to_regprocedure('public.approve_program_product_payment_request(uuid,text,uuid)') is null then
    raise exception 'PROGRAM_PRODUCT_PAYMENT_RPC_MISSING';
  end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='financial_session_snapshots' and column_name='session_purpose') then
    raise exception 'PROGRAM_PRODUCT_PAYMENT_SESSION_SCHEMA_MISSING';
  end if;
  v_jub:=public.generate_program_product_payment_schedule('2026-08-10','JUB',12,12000,1000);
  if v_jub->>'frequency'<>'mensual' or v_jub->>'first_payment_date'<>'2026-10-05'
     or v_jub->>'last_payment_date'<>'2027-09-05' or (v_jub->>'payment_count')::integer<>12
     or jsonb_array_length(v_jub->'rows')<>12 then raise exception 'JUB_MONTHLY_CALENDAR_FAILED:%',v_jub; end if;
  v_p1:=public.generate_program_product_payment_schedule('2026-01-01','1',4,4000,1000);
  if v_p1->>'first_payment_date'<>'2026-02-15' or v_p1->'rows'->1->>'date'<>'2026-02-28'
     or v_p1->'rows'->2->>'date'<>'2026-03-15' then raise exception 'PROCESS_1_CALENDAR_FAILED:%',v_p1; end if;
  if has_function_privilege('anon','public.generate_program_product_payment_schedule(date,text,integer,numeric,numeric)','execute')
     or has_function_privilege('authenticated','public.generate_program_product_payment_schedule(date,text,integer,numeric,numeric)','execute')
     or has_function_privilege('authenticated','public.create_validated_program_product_payment_request(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,integer,date)','execute')
     or not has_function_privilege('service_role','public.generate_program_product_payment_schedule(date,text,integer,numeric,numeric)','execute')
     or not has_function_privilege('authenticated','public.approve_program_product_payment_request(uuid,text,uuid)','execute')
     or has_function_privilege('anon','public.approve_program_product_payment_request(uuid,text,uuid)','execute') then
    raise exception 'PROGRAM_PRODUCT_PAYMENT_GRANT_INVALID';
  end if;
  if has_table_privilege('authenticated','public.financial_session_snapshots','select')
     or has_table_privilege('authenticated','public.financial_session_snapshots','insert') then
    raise exception 'PROGRAM_PRODUCT_PAYMENT_SESSION_EXPOSED';
  end if;
  if position('program_product_payment_v1' in lower(pg_get_functiondef('public.get_admin_financial_request_detail(uuid)'::regprocedure)))=0
     or position('payment_schedule' in lower(pg_get_functiondef('public.get_admin_financial_request_detail(uuid)'::regprocedure)))=0 then
    raise exception 'PROGRAM_PRODUCT_PAYMENT_ADMIN_PROJECTION_MISSING';
  end if;
  select pg_get_constraintdef(oid) into v_constraint from pg_constraint where conrelid='public.program_requests'::regclass and conname='program_requests_financial_status_check';
  if position('completed' in lower(v_constraint))=0 then raise exception 'PROGRAM_PRODUCT_PAYMENT_COMPLETED_STATUS_MISSING'; end if;
end $verify$;`;
const recoveryChecks=`do $verify$ begin
  if to_regprocedure('public.generate_program_product_payment_schedule(date,text,integer,numeric,numeric)') is not null
     or to_regprocedure('public.create_validated_program_product_payment_request(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,integer,date)') is not null
     or to_regprocedure('public.approve_program_product_payment_request(uuid,text,uuid)') is not null then raise exception 'PROGRAM_PRODUCT_PAYMENT_RPC_RECOVERY_FAILED'; end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='financial_session_snapshots' and column_name='session_purpose') then raise exception 'PROGRAM_PRODUCT_PAYMENT_SESSION_RECOVERY_FAILED'; end if;
  if position('completed' in lower((select pg_get_constraintdef(oid) from pg_constraint where conrelid='public.program_requests'::regclass and conname='program_requests_financial_status_check')))>0 then raise exception 'PROGRAM_PRODUCT_PAYMENT_STATUS_RECOVERY_FAILED'; end if;
  if position('program_product_payment_v1' in lower(pg_get_functiondef('public.get_admin_financial_request_detail(uuid)'::regprocedure)))>0 then raise exception 'PROGRAM_PRODUCT_PAYMENT_ADMIN_PROJECTION_RECOVERY_FAILED'; end if;
end $verify$;`;
async function snapshot(values){return (await sql(values,`select
  (select count(*)::int from public.program_catalog_items) item_count,
  (select count(*)::int from public.marketplace_products) marketplace_count,
  (select count(*)::int from public.program_catalog_items where price_cash is not null and not requires_quote) fixed_count,
  (select coalesce(md5(string_agg(id::text||'|'||coalesce(price_cash::text,'')||'|'||requires_quote::text||'|'||enabled::text||'|'||sort_order::text,';' order by id)),md5('')) from public.program_catalog_items) product_hash,
  (select coalesce(md5(string_agg(id::text||'|'||program_id||'|'||rate_factor::text||'|'||payment_count::text||'|'||max_amount::text,';' order by id)),md5('')) from public.financial_rules) rule_hash,
  (select count(*)::int from public.program_requests where financial_submission_snapshot->>'contract_version'='PROGRAM_PRODUCT_PAYMENT_V1') request_count`))[0];}
async function main(){const values=env();assert(values.SUPABASE_URL&&values.SUPABASE_ACCESS_TOKEN,'Supabase management configuration missing');const before=await snapshot(values);const state=(await sql(values,"select exists(select 1 from information_schema.columns where table_schema='public' and table_name='financial_session_snapshots' and column_name='session_purpose') applied,position('program_product_payment_v1' in lower(pg_get_functiondef('public.get_admin_financial_request_detail(uuid)'::regprocedure)))>0 projection_applied"))[0],applied=state.applied===true,projectionApplied=state.projection_applied===true;
  if(process.argv.includes('--projection-dry-run')){assert(applied,'PROGRAM_PRODUCT_PAYMENT_BASE_NOT_APPLIED');await sql(values,'begin;'+body(projectionMigration)+checks+body(projectionRecovery)+`do $verify$ begin if position('program_product_payment_v1' in lower(pg_get_functiondef('public.get_admin_financial_request_detail(uuid)'::regprocedure)))>0 then raise exception 'PROGRAM_PRODUCT_PAYMENT_ADMIN_PROJECTION_RECOVERY_FAILED'; end if; end $verify$;rollback;`);const after=await snapshot(values);assert.deepEqual(after,before,'projection dry-run changed persistent state');console.log(JSON.stringify({status:'PASS',mode:'ADMIN_PROJECTION_DRY_RUN',migration:projectionId,persistentWrites:0}));return;}
  if(process.argv.includes('--apply')){if(!applied)await sql(values,migration);if(!projectionApplied)await sql(values,projectionMigration);await sql(values,'begin;'+checks+'rollback;');const after=await snapshot(values);assert.equal(after.product_hash,before.product_hash,'program product authority changed');assert.equal(after.rule_hash,before.rule_hash,'financial rules changed');assert.equal(Number(after.marketplace_count),Number(before.marketplace_count));console.log(JSON.stringify({status:'PASS',mode:applied&&projectionApplied?'VERIFY_APPLIED':'APPLIED',migration:id,adminProjection:projectionId,items:Number(after.item_count),fixedPrices:Number(after.fixed_count),marketplaceTouched:0,productHash:after.product_hash,financialRuleHash:after.rule_hash}));return;}
  if(process.argv.includes('--recovery-dry-run')){assert(applied&&projectionApplied,'PROGRAM_PRODUCT_PAYMENT_MIGRATION_NOT_APPLIED');await sql(values,'begin;'+body(projectionRecovery)+body(recovery)+recoveryChecks+'rollback;');await sql(values,'begin;'+checks+'rollback;');const after=await snapshot(values);assert.deepEqual(after,before,'recovery dry-run changed persistent state');console.log(JSON.stringify({status:'PASS',mode:'RECOVERY_DRY_RUN',migration:id,adminProjection:projectionId,persistentWrites:0,requestHistory:Number(after.request_count)}));return;}
  if(applied){await sql(values,'begin;'+checks+'rollback;');console.log(JSON.stringify({status:'PASS',mode:'VERIFY_APPLIED',migration:id,items:Number(before.item_count),fixedPrices:Number(before.fixed_count),requestHistory:Number(before.request_count)}));return;}
  await sql(values,'begin;'+body(migration)+body(projectionMigration)+checks+body(projectionRecovery)+body(recovery)+recoveryChecks+'rollback;');const after=await snapshot(values);assert.deepEqual(after,before,'forward/recovery dry-run changed persistent state');console.log(JSON.stringify({status:'PASS',mode:'DRY_RUN_FORWARD_RECOVERY',migration:id,adminProjection:projectionId,items:Number(before.item_count),fixedPrices:Number(before.fixed_count),marketplaceCount:Number(before.marketplace_count),persistentWrites:0}));}
main().catch((error)=>{console.error(JSON.stringify({status:'FAIL',error:error.message}));process.exitCode=1;});
