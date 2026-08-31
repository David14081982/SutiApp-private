'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
function env(){const out={};for(const line of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const match=line.match(/^([A-Z0-9_]+)=(.*)$/);if(match)out[match[1]]=match[2].trim().replace(/^['"]|['"]$/g,'');}return out;}
function body(sql){return sql.replace(/^\s*begin;\s*/i,'').replace(/\s*commit;\s*$/i,'');}
async function management(values,query){const ref=new URL(values.SUPABASE_URL).hostname.split('.')[0],response=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:'Bearer '+values.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json','User-Agent':'SutiApp-OptionalLoanDeposit/1.0'},body:JSON.stringify({query})});const data=await response.json().catch(()=>null);if(!response.ok)throw new Error('MANAGEMENT_SQL_'+response.status+':'+JSON.stringify(data).slice(0,900));return data;}
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20260831000300_optional_loan_deposit_account.sql'),'utf8');
const recovery=fs.readFileSync(path.join(root,'supabase/recovery/20260831000300_optional_loan_deposit_account_recovery.sql'),'utf8');
const signature='uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,text,integer,jsonb';
const checks=`
do $verify$
declare v_before bigint;v_after bigint;
begin
  if not exists(select 1 from pg_constraint where conrelid='public.loan_request_deposit_snapshots'::regclass and conname='loan_deposit_optional_bank_coherence') then raise exception 'OPTIONAL_BANK_CONSTRAINT_MISSING'; end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='loan_request_deposit_snapshots' and column_name in('source_bank_account_id','bank_name','account_holder','card_number','clabe') and is_nullable<>'YES') then raise exception 'OPTIONAL_BANK_COLUMN_REQUIRED'; end if;
  if to_regprocedure('public.create_validated_financial_program_request_bank_required(${signature})') is null then raise exception 'BANK_REQUIRED_HELPER_MISSING'; end if;
  if has_function_privilege('anon','public.create_validated_financial_program_request(${signature})','execute') or has_function_privilege('authenticated','public.create_validated_financial_program_request(${signature})','execute') then raise exception 'REQUEST_WRITER_BROWSER_EXPOSED'; end if;
  if not has_function_privilege('service_role','public.create_validated_financial_program_request(${signature})','execute') then raise exception 'REQUEST_WRITER_SERVICE_DENIED'; end if;
  if has_function_privilege('service_role','public.create_validated_financial_program_request_bank_required(${signature})','execute') then raise exception 'BANK_REQUIRED_HELPER_EXPOSED'; end if;
  select count(*) into v_before from public.loan_request_deposit_snapshots;
  select count(*) into v_after from public.loan_request_deposit_snapshots where notification_phone ~ '^[0-9]{10}$';
  if v_before<>v_after then raise exception 'HISTORICAL_PHONE_INTEGRITY_FAILED'; end if;
end $verify$;`;
const recoveryChecks=`
do $verify$
begin
  if exists(select 1 from pg_constraint where conrelid='public.loan_request_deposit_snapshots'::regclass and conname='loan_deposit_optional_bank_coherence') then raise exception 'OPTIONAL_CONSTRAINT_RECOVERY_FAILED'; end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='loan_request_deposit_snapshots' and column_name in('source_bank_account_id','bank_name','account_holder','card_number','clabe') and is_nullable<>'NO') then raise exception 'NOT_NULL_RECOVERY_FAILED'; end if;
  if to_regprocedure('public.create_validated_financial_program_request_bank_required(${signature})') is not null then raise exception 'HELPER_RECOVERY_FAILED'; end if;
end $verify$;`;
async function main(){const values=env();assert(values.SUPABASE_URL&&values.SUPABASE_ACCESS_TOKEN,'Supabase management configuration missing');const state=await management(values,"select exists(select 1 from pg_constraint where conrelid='public.loan_request_deposit_snapshots'::regclass and conname='loan_deposit_optional_bank_coherence') applied,(select count(*) from public.loan_request_deposit_snapshots) snapshot_count,(select count(*) from public.program_requests) request_count");const current=state[0];if(process.argv.includes('--apply')){if(!current.applied)await management(values,migration);await management(values,'begin;'+checks+'rollback;');console.log(JSON.stringify({status:'PASS',mode:current.applied?'ALREADY_APPLIED':'APPLIED',migration:'20260831000300',snapshotCount:Number(current.snapshot_count),requestCount:Number(current.request_count),dataRowsChanged:0}));return;}if(current.applied){await management(values,'begin;'+checks+'rollback;');console.log(JSON.stringify({status:'PASS',mode:'VERIFY_APPLIED',migration:'20260831000300',snapshotCount:Number(current.snapshot_count),requestCount:Number(current.request_count),dataRowsChanged:0}));return;}await management(values,'begin;'+body(migration)+checks+body(recovery)+recoveryChecks+'rollback;');console.log(JSON.stringify({status:'PASS',mode:'DRY_RUN_FORWARD_RECOVERY',migration:'20260831000300',snapshotCount:Number(current.snapshot_count),requestCount:Number(current.request_count),dataRowsChanged:0}));}
main().catch((error)=>{console.error(JSON.stringify({status:'FAIL',error:error.message}));process.exitCode=1;});
