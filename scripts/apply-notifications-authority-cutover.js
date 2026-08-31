'use strict';
const assert=require('assert').strict,fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20260830000520_notifications_authority_cutover.sql'),'utf8');
const recovery=fs.readFileSync(path.join(root,'supabase/recovery/20260830000520_notifications_authority_cutover_recovery.sql'),'utf8');
const projection=fs.readFileSync(path.join(root,'supabase/migrations/20260831000100_notifications_self_projection.sql'),'utf8');
const projectionRecovery=fs.readFileSync(path.join(root,'supabase/recovery/20260831000100_notifications_self_projection_recovery.sql'),'utf8');
function env(){const out={};for(const raw of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const line=raw.trim(),at=line.indexOf('=');if(at>0&&!line.startsWith('#'))out[line.slice(0,at).trim()]=line.slice(at+1).trim().replace(/^['"]|['"]$/g,'');}return out;}
async function management(values,query){const ref=new URL(values.SUPABASE_URL).hostname.split('.')[0],response=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:'Bearer '+values.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json','User-Agent':'SutiApp-NotificationsCutover/1.0'},body:JSON.stringify({query})});const data=await response.json().catch(()=>null);if(!response.ok)throw new Error('MANAGEMENT_SQL_'+response.status+':'+JSON.stringify(data).slice(0,700));return data;}
function body(sql){return sql.replace(/^\s*begin;\s*/i,'').replace(/\s*commit;\s*$/i,'');}
const checks=`
do $verify$
declare v_definition text;
begin
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='program_requests' and column_name='seen_at' and data_type='timestamp with time zone' and is_nullable='YES') then raise exception 'SEEN_COLUMN_MISSING'; end if;
  if to_regclass('public.program_requests_affiliate_unseen_quote_idx') is null then raise exception 'UNREAD_INDEX_MISSING'; end if;
  select pg_get_functiondef('public.mark_marketplace_quote_seen(uuid)'::regprocedure) into v_definition;
  if position('update public.program_requests' in lower(v_definition))=0 or position('get_effective_affiliate_id' in lower(v_definition))=0 then raise exception 'CURRENT_SEEN_WRITER_MISSING'; end if;
  if has_function_privilege('anon','public.mark_marketplace_quote_seen(uuid)','execute') then raise exception 'ANON_SEEN_EXECUTE'; end if;
  if not has_function_privilege('authenticated','public.mark_marketplace_quote_seen(uuid)','execute') then raise exception 'AUTH_SEEN_EXECUTE_MISSING'; end if;
  if to_regprocedure('public.list_self_marketplace_quote_notifications()') is null then raise exception 'SELF_PROJECTION_MISSING'; end if;
  if has_function_privilege('anon','public.list_self_marketplace_quote_notifications()','execute') then raise exception 'ANON_PROJECTION_EXECUTE'; end if;
  if not has_function_privilege('authenticated','public.list_self_marketplace_quote_notifications()','execute') then raise exception 'AUTH_PROJECTION_EXECUTE_MISSING'; end if;
  if has_table_privilege('authenticated','public.program_requests','select') then raise exception 'DIRECT_PROGRAM_REQUEST_SELECT_REOPENED'; end if;
  if not (select relrowsecurity and relforcerowsecurity from pg_class where oid='public.program_requests'::regclass) then raise exception 'PROGRAM_REQUEST_RLS_REGRESSION'; end if;
end $verify$;`;
const recoveryChecks=`
do $verify$
declare v_definition text;
begin
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='program_requests' and column_name='seen_at') then raise exception 'SEEN_RECOVERY_FAILED'; end if;
  if to_regclass('public.program_requests_affiliate_unseen_quote_idx') is not null then raise exception 'INDEX_RECOVERY_FAILED'; end if;
  if to_regprocedure('public.list_self_marketplace_quote_notifications()') is not null then raise exception 'PROJECTION_RECOVERY_FAILED'; end if;
  select pg_get_functiondef('public.mark_marketplace_quote_seen(uuid)'::regprocedure) into v_definition;
  if position('marketplace_quote_requests' in v_definition)=0 or position('program_requests' in v_definition)>0 then raise exception 'WRITER_RECOVERY_FAILED'; end if;
end $verify$;`;
async function main(){const values=env();assert(values.SUPABASE_URL&&values.SUPABASE_ACCESS_TOKEN,'Supabase management configuration missing');const before=(await management(values,"select count(*)::int request_count,count(*) filter(where request_type='quote')::int quote_count from public.program_requests"))[0];const state=(await management(values,"select exists(select 1 from information_schema.columns where table_schema='public' and table_name='program_requests' and column_name='seen_at') seen_applied,to_regprocedure('public.list_self_marketplace_quote_notifications()') is not null projection_applied"))[0],seenApplied=state.seen_applied===true,projectionApplied=state.projection_applied===true;if(process.argv.includes('--apply')){if(!seenApplied)await management(values,migration);if(!projectionApplied)await management(values,projection);await management(values,'begin;'+checks+'rollback;');const after=(await management(values,"select count(*)::int request_count,count(*) filter(where request_type='quote')::int quote_count from public.program_requests"))[0];assert.deepEqual(after,before,'schema cutover changed request rows');console.log(JSON.stringify({status:'PASS',mode:seenApplied&&projectionApplied?'ALREADY_APPLIED':'APPLIED',migrations:['20260830000520','20260831000100'],rowsChanged:0,before,after}));return;}if(seenApplied&&projectionApplied){await management(values,'begin;'+checks+'rollback;');console.log(JSON.stringify({status:'PASS',mode:'VERIFY_APPLIED',migrations:['20260830000520','20260831000100'],rowsChanged:0,before}));return;}if(seenApplied){await management(values,'begin;'+body(projection)+checks+body(projectionRecovery)+"do $v$ begin if to_regprocedure('public.list_self_marketplace_quote_notifications()') is not null then raise exception 'PROJECTION_RECOVERY_FAILED'; end if; end $v$;rollback;");console.log(JSON.stringify({status:'PASS',mode:'DRY_RUN_PROJECTION_RECOVERY',migration:'20260831000100',rowsChanged:0,before}));return;}await management(values,'begin;'+body(migration)+body(projection)+checks+body(projectionRecovery)+body(recovery)+recoveryChecks+'rollback;');console.log(JSON.stringify({status:'PASS',mode:'DRY_RUN_FORWARD_RECOVERY',migrations:['20260830000520','20260831000100'],rowsChanged:0,before}));}
main().catch((error)=>{console.error(JSON.stringify({status:'FAIL',error:error.message}));process.exitCode=1;});
