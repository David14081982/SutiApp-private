'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const envPath=path.join(root,'supabase.env');
function env(){const out={};for(const line of fs.readFileSync(envPath,'utf8').split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)out[m[1]]=m[2].replace(/^['"]|['"]$/g,'');}return out;}
function body(sql){return sql.replace(/^\s*begin;\s*/i,'').replace(/\s*commit;\s*$/i,'');}
async function management(values,query){const ref=new URL(values.SUPABASE_URL).hostname.split('.')[0];const response=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:'Bearer '+values.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json','User-Agent':'SutiApp-Request-E2E-Remediation/1.0'},body:JSON.stringify({query})});const data=await response.json().catch(()=>null);if(!response.ok)throw new Error('MANAGEMENT_SQL_'+response.status);return data;}
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20260830000300_request_submission_e2e_remediation.sql'),'utf8');
const recovery=fs.readFileSync(path.join(root,'supabase/recovery/20260830000300_request_submission_e2e_remediation_recovery.sql'),'utf8');
const checks=`
do $verify$
begin
  if to_regprocedure('public.list_self_program_request_history()') is null then raise exception 'HISTORY_RPC_MISSING'; end if;
  if has_function_privilege('anon','public.list_self_program_request_history()','execute') then raise exception 'ANON_HISTORY_EXECUTE'; end if;
  if not has_function_privilege('authenticated','public.list_self_program_request_history()','execute') then raise exception 'AUTH_HISTORY_DENIED'; end if;
  if has_function_privilege('service_role','public.list_self_program_request_history()','execute') then raise exception 'SERVICE_HISTORY_EXECUTE'; end if;
  perform set_config('request.jwt.claim.role','service_role',true);
  perform public.assert_document_requirement_scope('PROGRAM','prestamo');
  perform set_config('request.jwt.claim.role','anon',true);
  begin
    perform public.assert_document_requirement_scope('PROGRAM','prestamo');
    raise exception 'ANON_SCOPE_ALLOWED';
  exception when sqlstate '42501' then
    if sqlerrm<>'AUTH_REQUIRED' then raise; end if;
  end;
end $verify$;`;
const recoveryChecks=`
do $verify$
begin
  if to_regprocedure('public.list_self_program_request_history()') is not null then raise exception 'HISTORY_RPC_RECOVERY_FAILED'; end if;
  perform set_config('request.jwt.claim.role','service_role',true);
  begin
    perform public.assert_document_requirement_scope('PROGRAM','prestamo');
    raise exception 'PREDECESSOR_NOT_RESTORED';
  exception when sqlstate '42501' then
    if sqlerrm<>'AUTH_REQUIRED' then raise; end if;
  end;
end $verify$;`;
async function main(){const values=env();assert(values.SUPABASE_URL&&values.SUPABASE_ACCESS_TOKEN,'Supabase management configuration missing');const apply=process.argv.includes('--apply');if(apply){await management(values,migration);await management(values,'begin;'+checks+' rollback;');console.log(JSON.stringify({status:'PASS',mode:'APPLIED',migration:'20260830000300',dataRowsChanged:0}));return;}await management(values,'begin;'+body(migration)+checks+body(recovery)+recoveryChecks+'rollback;');console.log(JSON.stringify({status:'PASS',mode:'DRY_RUN_FORWARD_RECOVERY',dataRowsChanged:0}));}
main().catch((error)=>{console.error(JSON.stringify({status:'FAIL',error:error.message}));process.exitCode=1;});
