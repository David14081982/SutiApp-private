'use strict';
const assert=require('assert').strict,fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
function env(){const out={};for(const raw of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const line=raw.trim(),at=line.indexOf('=');if(at>0&&!line.startsWith('#'))out[line.slice(0,at).trim()]=line.slice(at+1).trim().replace(/^['"]|['"]$/g,'');}return out;}
function body(sql){return sql.replace(/^\s*begin;\s*/i,'').replace(/\s*commit;\s*$/i,'');}
async function management(v,query){const ref=new URL(v.SUPABASE_URL).hostname.split('.')[0],response=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:'Bearer '+v.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json','User-Agent':'SutiApp-Request-Submission-Critical/1.0'},body:JSON.stringify({query})}),data=await response.json().catch(()=>null);if(!response.ok)throw new Error('MANAGEMENT_SQL_'+response.status+':'+JSON.stringify(data).slice(0,900));return data;}
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20260903000100_request_submission_deposit_contract.sql'),'utf8');
const recovery=fs.readFileSync(path.join(root,'supabase/recovery/20260903000100_request_submission_deposit_contract_recovery.sql'),'utf8');
const probeMigration=fs.readFileSync(path.join(root,'supabase/migrations/20260903000110_request_submission_contract_probe.sql'),'utf8');
const probeRecovery=fs.readFileSync(path.join(root,'supabase/recovery/20260903000110_request_submission_contract_probe_recovery.sql'),'utf8');
const checks=`
do $verify$
declare v_writer text;v_constraint text;v_rls boolean;v_force boolean;
begin
  select pg_get_functiondef('public.create_validated_financial_program_request_bank_required(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,text,integer,jsonb)'::regprocedure) into v_writer;
  if v_writer not like '%card_number is null or card_number ~%'
     or v_writer not like '%clabe is null or public.is_valid_clabe(clabe)%' then
    raise exception 'REQUEST_WRITER_OR_CONTRACT_MISSING';
  end if;
  select pg_get_constraintdef(oid,true) into v_constraint from pg_constraint
   where conrelid='public.loan_request_deposit_snapshots'::regclass and conname='loan_deposit_optional_bank_coherence';
  if v_constraint not like '%card_number IS NULL OR card_number ~%'
     or v_constraint not like '%clabe IS NULL OR is_valid_clabe(clabe)%' then
    raise exception 'REQUEST_SNAPSHOT_OR_CONTRACT_MISSING';
  end if;
  select relrowsecurity,relforcerowsecurity into v_rls,v_force from pg_class
   where oid='public.request_submission_deposit_contract_backup'::regclass;
  if not v_rls or not v_force then raise exception 'REQUEST_BACKUP_RLS_MISSING'; end if;
  if has_table_privilege('anon','public.request_submission_deposit_contract_backup','select')
     or has_table_privilege('authenticated','public.request_submission_deposit_contract_backup','select') then
    raise exception 'REQUEST_BACKUP_EXPOSED';
  end if;
  if has_function_privilege('anon','public.create_validated_financial_program_request(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,text,integer,jsonb)','execute')
     or has_function_privilege('authenticated','public.create_validated_financial_program_request(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,text,integer,jsonb)','execute') then
    raise exception 'REQUEST_WRITER_BROWSER_EXPOSED';
  end if;
  if not has_function_privilege('service_role','public.create_validated_financial_program_request(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,text,integer,jsonb)','execute') then
    raise exception 'REQUEST_WRITER_SERVICE_DENIED';
  end if;
end $verify$;`;
const recoveryChecks=`
do $verify$
declare v_writer text;v_constraint text;
begin
  if to_regclass('public.request_submission_deposit_contract_backup') is not null
     or to_regprocedure('public.get_request_submission_backend_contract()') is not null then
    raise exception 'REQUEST_RECOVERY_OBJECTS_REMAIN';
  end if;
  select pg_get_functiondef('public.create_validated_financial_program_request_bank_required(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,text,integer,jsonb)'::regprocedure) into v_writer;
  if v_writer not like '%card_number ~ ''^[0-9]{16}$'' and public.is_valid_clabe(clabe)%' then
    raise exception 'REQUEST_WRITER_RECOVERY_FAILED';
  end if;
  select pg_get_constraintdef(oid,true) into v_constraint from pg_constraint
   where conrelid='public.loan_request_deposit_snapshots'::regclass and conname='loan_deposit_optional_bank_coherence';
  if v_constraint like '%card_number IS NULL OR card_number ~%' then raise exception 'REQUEST_CONSTRAINT_RECOVERY_FAILED'; end if;
end $verify$;`;
async function main(){const v=env();assert(v.SUPABASE_URL&&v.SUPABASE_ACCESS_TOKEN,'Supabase management configuration missing');const state=(await management(v,"select to_regclass('public.request_submission_deposit_contract_backup') is not null applied,to_regclass('public.request_submission_contract_probe_backup') is not null probe_applied"))[0];
  if(process.argv.includes('--apply')){if(!state.applied)await management(v,migration);if(!state.probe_applied)await management(v,probeMigration);await management(v,'begin;'+checks+'rollback;');console.log(JSON.stringify({status:'PASS',mode:state.applied?'UPDATED':'APPLIED',migrations:['20260903000100','20260903000110'],businessRowsChanged:0}));return;}
  if(process.argv.includes('--recovery-dry-run')){assert(state.applied&&state.probe_applied,'migrations must be applied');await management(v,'begin;'+body(probeRecovery)+body(recovery)+recoveryChecks+'rollback;');console.log(JSON.stringify({status:'PASS',mode:'RECOVERY_DRY_RUN',migrations:['20260903000110','20260903000100'],persistentWrites:0}));return;}
  if(state.applied){assert(state.probe_applied,'probe patch missing');await management(v,'begin;'+checks+'rollback;');console.log(JSON.stringify({status:'PASS',mode:'VERIFY_APPLIED',migrations:['20260903000100','20260903000110'],persistentWrites:0}));return;}
  await management(v,'begin;'+body(migration)+body(probeMigration)+checks+body(probeRecovery)+body(recovery)+recoveryChecks+'rollback;');console.log(JSON.stringify({status:'PASS',mode:'DRY_RUN_FORWARD_RECOVERY',migrations:['20260903000100','20260903000110'],persistentWrites:0}));}
main().catch((error)=>{console.error(JSON.stringify({status:'FAIL',error:error.message}));process.exitCode=1;});
