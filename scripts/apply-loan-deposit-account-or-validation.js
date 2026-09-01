'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
function env(){const out={};for(const line of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const match=line.match(/^([A-Z0-9_]+)=(.*)$/);if(match)out[match[1]]=match[2].trim().replace(/^['"]|['"]$/g,'');}return out;}
function body(sql){return sql.replace(/^\s*begin;\s*/i,'').replace(/\s*commit;\s*$/i,'');}
async function management(values,query){const ref=new URL(values.SUPABASE_URL).hostname.split('.')[0],response=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:'Bearer '+values.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json','User-Agent':'SutiApp-LoanDeposit-OR/1.0'},body:JSON.stringify({query})});const data=await response.json().catch(()=>null);if(!response.ok)throw new Error('MANAGEMENT_SQL_'+response.status+':'+JSON.stringify(data).slice(0,900));return data;}
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20260901000100_loan_deposit_account_or_validation.sql'),'utf8');
const recovery=fs.readFileSync(path.join(root,'supabase/recovery/20260901000100_loan_deposit_account_or_validation_recovery.sql'),'utf8');
const checks=`
do $verify$
declare v_definition text;v_constraint text;v_rls boolean;v_force boolean;
begin
  select pg_get_functiondef('public.save_affiliate_deposit_account(uuid,text,text,text)'::regprocedure) into v_definition;
  if v_definition not like '%INVALID_DEPOSIT_CARD%' or v_definition not like '%INVALID_DEPOSIT_CLABE%'
     or v_definition not like '%DEPOSIT_INSTRUMENT_REQUIRED%' then raise exception 'DEPOSIT_OR_WRITER_MISSING'; end if;
  select pg_get_constraintdef(oid,true) into v_constraint from pg_constraint
   where conrelid='public.affiliate_bank_accounts'::regclass and conname='affiliate_bank_complete_check';
  if v_constraint not like '%account_number IS NOT NULL OR card_number IS NOT NULL OR clabe IS NOT NULL%' then
    raise exception 'DEPOSIT_OR_CONSTRAINT_MISSING';
  end if;
  select relrowsecurity,relforcerowsecurity into v_rls,v_force from pg_class where oid='public.loan_deposit_validation_migration_backup'::regclass;
  if not v_rls or not v_force then raise exception 'DEPOSIT_BACKUP_RLS_MISSING'; end if;
  if has_table_privilege('anon','public.loan_deposit_validation_migration_backup','select')
     or has_table_privilege('authenticated','public.loan_deposit_validation_migration_backup','select') then raise exception 'DEPOSIT_BACKUP_EXPOSED'; end if;
  if has_function_privilege('anon','public.save_affiliate_deposit_account(uuid,text,text,text)','execute') then raise exception 'ANON_DEPOSIT_WRITER_EXECUTE'; end if;
  if not has_function_privilege('authenticated','public.save_affiliate_deposit_account(uuid,text,text,text)','execute') then raise exception 'AUTH_DEPOSIT_WRITER_DENIED'; end if;
  if not has_function_privilege('authenticated','public.list_current_deposit_accounts()','execute') then raise exception 'AUTH_DEPOSIT_READER_DENIED'; end if;
  if has_function_privilege('anon','public.list_current_deposit_accounts()','execute') then raise exception 'ANON_DEPOSIT_READER_EXECUTE'; end if;
  if not public.is_valid_clabe('032180000118359719') or public.is_valid_clabe('032180000118359718') then raise exception 'CLABE_CHECKSUM_REGRESSION'; end if;
end $verify$;`;
const recoveryChecks=`
do $verify$
declare v_definition text;v_constraint text;
begin
  if to_regclass('public.loan_deposit_validation_migration_backup') is not null then raise exception 'DEPOSIT_BACKUP_RECOVERY_FAILED'; end if;
  select pg_get_functiondef('public.save_affiliate_deposit_account(uuid,text,text,text)'::regprocedure) into v_definition;
  if v_definition like '%INVALID_DEPOSIT_CARD%' or v_definition not like '%INVALID_DEPOSIT_ACCOUNT%' then raise exception 'DEPOSIT_WRITER_RECOVERY_FAILED'; end if;
  select pg_get_constraintdef(oid,true) into v_constraint from pg_constraint
   where conrelid='public.affiliate_bank_accounts'::regclass and conname='affiliate_bank_complete_check';
  if v_constraint like '%account_number IS NOT NULL OR card_number IS NOT NULL OR clabe IS NOT NULL%' then raise exception 'DEPOSIT_CONSTRAINT_RECOVERY_FAILED'; end if;
end $verify$;`;
function checkDigit(prefix){const weights=[3,7,1];let sum=0;for(let i=0;i<17;i++)sum+=Number(prefix[i])*weights[i%3];return String((10-(sum%10))%10);}
function matrixSql(values){const stamp=String(Date.now()),card='9'+stamp.padStart(15,'0').slice(-15),prefix='646180'+stamp.padStart(11,'0').slice(-11),clabe=prefix+checkDigit(prefix);return `
begin;
select set_config('request.jwt.claim.sub',(select auth_user_id::text from public.affiliates where id='${values.H005_TEST_AFFILIATE_ID}'::uuid),true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims',(select jsonb_build_object('sub',auth_user_id::text,'role','authenticated')::text from public.affiliates where id='${values.H005_TEST_AFFILIATE_ID}'::uuid),true);
set local role authenticated;
do $matrix$
declare v_card public.affiliate_bank_accounts%rowtype;v_clabe public.affiliate_bank_accounts%rowtype;v_both public.affiliate_bank_accounts%rowtype;
begin
 begin
  select * into v_card from public.save_affiliate_deposit_account(null,'Banco QA Card','${card}',null);
  if v_card.card_number is null or v_card.clabe is not null then raise exception 'CARD_ONLY_MATRIX_FAILED'; end if;
  select * into v_clabe from public.save_affiliate_deposit_account(null,'Banco QA CLABE',null,'${clabe}');
  if v_clabe.card_number is not null or v_clabe.clabe is null then raise exception 'CLABE_ONLY_MATRIX_FAILED'; end if;
  select * into v_both from public.save_affiliate_deposit_account(null,'Banco QA Both','${card.slice(0,15)}8','032180000118359719');
  if v_both.card_number is null or v_both.clabe is null then raise exception 'BOTH_MATRIX_FAILED'; end if;
  begin perform public.save_affiliate_deposit_account(null,'Banco QA',null,null);raise exception 'BANK_ONLY_ACCEPTED';exception when sqlstate '22023' then if sqlerrm<>'DEPOSIT_INSTRUMENT_REQUIRED' then raise;end if;end;
  begin perform public.save_affiliate_deposit_account(null,'Banco QA','123','${clabe}');raise exception 'INVALID_CARD_ACCEPTED';exception when sqlstate '22023' then if sqlerrm<>'INVALID_DEPOSIT_CARD' then raise;end if;end;
  begin perform public.save_affiliate_deposit_account(null,'Banco QA','${card}','032180000118359718');raise exception 'INVALID_CLABE_ACCEPTED';exception when sqlstate '22023' then if sqlerrm<>'INVALID_DEPOSIT_CLABE' then raise;end if;end;
  raise exception 'LOAN_DEPOSIT_MATRIX_ROLLBACK';
 exception when raise_exception then
  if sqlerrm<>'LOAN_DEPOSIT_MATRIX_ROLLBACK' then raise; end if;
 end;
end $matrix$;
reset role;
rollback;`;}
const aggregateSql=`select
  count(*)::integer total,
  count(*) filter(where data_status='COMPLETE')::integer complete,
  count(*) filter(where data_status='INCOMPLETE_HISTORICAL_DATA')::integer historical_incomplete,
  count(*) filter(where length(btrim(coalesce(bank_name,'')))>=2 and (card_number~'^[0-9]{16}$' or public.is_valid_clabe(clabe)))::integer deposit_eligible,
  count(*) filter(where card_number~'^[0-9]{16}$' and public.is_valid_clabe(clabe))::integer both_valid,
  count(*) filter(where card_number~'^[0-9]{16}$' and not coalesce(public.is_valid_clabe(clabe),false))::integer card_only_valid,
  count(*) filter(where not coalesce(card_number~'^[0-9]{16}$',false) and public.is_valid_clabe(clabe))::integer clabe_only_valid,
  count(*) filter(where not coalesce(card_number~'^[0-9]{16}$',false) and not coalesce(public.is_valid_clabe(clabe),false))::integer neither_valid
from public.affiliate_bank_accounts`;
async function main(){
  const values=env();assert(values.SUPABASE_URL&&values.SUPABASE_ACCESS_TOKEN&&values.H005_TEST_AFFILIATE_ID,'Supabase/test configuration missing');
  const state=(await management(values,"select to_regclass('public.loan_deposit_validation_migration_backup') is not null applied"))[0];
  if(process.argv.includes('--apply')){
    if(!state.applied)await management(values,migration);
    await management(values,'begin;'+checks+'rollback;');
    await management(values,matrixSql(values));
    const aggregate=(await management(values,aggregateSql))[0];
    console.log(JSON.stringify({status:'PASS',mode:state.applied?'ALREADY_APPLIED':'APPLIED',migration:'20260901000100',matrix:{cardOnly:'PASS',clabeOnly:'PASS',both:'PASS',bankOnly:'REJECTED',invalidCard:'REJECTED',invalidClabe:'REJECTED'},aggregate,dataRowsChanged:0}));return;
  }
  if(process.argv.includes('--recovery-dry-run')){
    assert(state.applied,'migration must be applied before recovery dry-run');
    await management(values,'begin;'+body(recovery)+recoveryChecks+'rollback;');
    console.log(JSON.stringify({status:'PASS',mode:'RECOVERY_DRY_RUN',migration:'20260901000100',persistentWrites:0}));return;
  }
  if(state.applied){
    await management(values,'begin;'+checks+'rollback;');await management(values,matrixSql(values));
    const aggregate=(await management(values,aggregateSql))[0];
    console.log(JSON.stringify({status:'PASS',mode:'VERIFY_APPLIED',migration:'20260901000100',aggregate,persistentWrites:0}));return;
  }
  await management(values,'begin;'+body(migration)+checks+matrixSql(values).replace(/^\s*begin;|rollback;\s*$/g,'')+body(recovery)+recoveryChecks+'rollback;');
  const aggregate=(await management(values,aggregateSql))[0];
  console.log(JSON.stringify({status:'PASS',mode:'DRY_RUN_FORWARD_RECOVERY',migration:'20260901000100',aggregate,persistentWrites:0}));
}
main().catch((error)=>{console.error(JSON.stringify({status:'FAIL',error:error.message}));process.exitCode=1;});
