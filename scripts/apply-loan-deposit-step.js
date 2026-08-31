'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
function env(){const out={};for(const line of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const match=line.match(/^([A-Z0-9_]+)=(.*)$/);if(match)out[match[1]]=match[2].trim().replace(/^['"]|['"]$/g,'');}return out;}
function body(sql){return sql.replace(/^\s*begin;\s*/i,'').replace(/\s*commit;\s*$/i,'');}
async function management(values,query){const ref=new URL(values.SUPABASE_URL).hostname.split('.')[0],response=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:'Bearer '+values.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json','User-Agent':'SutiApp-LoanDeposit/1.0'},body:JSON.stringify({query})});const data=await response.json().catch(()=>null);if(!response.ok)throw new Error('MANAGEMENT_SQL_'+response.status+':'+JSON.stringify(data).slice(0,700));return data;}
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20260830000500_loan_deposit_step.sql'),'utf8');
const recovery=fs.readFileSync(path.join(root,'supabase/recovery/20260830000500_loan_deposit_step_recovery.sql'),'utf8');
const checks=`
do $verify$
declare v_rls boolean;v_force boolean;
begin
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='affiliate_bank_accounts' and column_name='card_number') then raise exception 'CARD_COLUMN_MISSING'; end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='affiliates' and column_name='notification_phone') then raise exception 'PHONE_COLUMN_MISSING'; end if;
  select relrowsecurity,relforcerowsecurity into v_rls,v_force from pg_class where oid='public.loan_request_deposit_snapshots'::regclass;
  if not v_rls or not v_force then raise exception 'DEPOSIT_SNAPSHOT_RLS_MISSING'; end if;
  if has_table_privilege('anon','public.loan_request_deposit_snapshots','select') or has_table_privilege('authenticated','public.loan_request_deposit_snapshots','select') then raise exception 'DEPOSIT_SNAPSHOT_BROWSER_EXPOSED'; end if;
  if has_function_privilege('anon','public.save_affiliate_deposit_account(uuid,text,text,text)','execute') then raise exception 'ANON_BANK_WRITER_EXECUTE'; end if;
  if not has_function_privilege('authenticated','public.save_affiliate_deposit_account(uuid,text,text,text)','execute') then raise exception 'AUTH_BANK_WRITER_DENIED'; end if;
  if has_function_privilege('authenticated','public.create_validated_financial_program_request(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,text,integer,jsonb)','execute') then raise exception 'BROWSER_REQUEST_WRITER_EXPOSED'; end if;
  if not public.is_valid_clabe('032180000118359719') or public.is_valid_clabe('032180000118359718') then raise exception 'CLABE_CHECKSUM_INVALID'; end if;
end $verify$;`;
const recoveryChecks=`
do $verify$
begin
  if to_regclass('public.loan_request_deposit_snapshots') is not null then raise exception 'SNAPSHOT_RECOVERY_FAILED'; end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='affiliate_bank_accounts' and column_name='card_number') then raise exception 'CARD_RECOVERY_FAILED'; end if;
  if to_regprocedure('public.create_validated_financial_program_request_pre_deposit(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,text,integer,jsonb)') is not null then raise exception 'WRITER_RECOVERY_FAILED'; end if;
end $verify$;`;
async function main(){const values=env();assert(values.SUPABASE_URL&&values.SUPABASE_ACCESS_TOKEN,'Supabase management configuration missing');const state=await management(values,"select exists(select 1 from information_schema.columns where table_schema='public' and table_name='affiliate_bank_accounts' and column_name='card_number') applied");const applied=state[0]&&state[0].applied===true;if(process.argv.includes('--apply')){if(!applied)await management(values,migration);await management(values,'begin;'+checks+'rollback;');console.log(JSON.stringify({status:'PASS',mode:applied?'ALREADY_APPLIED':'APPLIED',migration:'20260830000500',dataRowsChanged:0}));return;}if(applied){await management(values,'begin;'+checks+'rollback;');console.log(JSON.stringify({status:'PASS',mode:'VERIFY_APPLIED',migration:'20260830000500',dataRowsChanged:0}));return;}await management(values,'begin;'+body(migration)+checks+body(recovery)+recoveryChecks+'rollback;');console.log(JSON.stringify({status:'PASS',mode:'DRY_RUN_FORWARD_RECOVERY',migration:'20260830000500',dataRowsChanged:0}));}
main().catch((error)=>{console.error(JSON.stringify({status:'FAIL',error:error.message}));process.exitCode=1;});
