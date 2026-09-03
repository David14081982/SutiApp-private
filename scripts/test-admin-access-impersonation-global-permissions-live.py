#!/usr/bin/env python3
"""Focused transactional compile and A-H authorization matrix."""
from __future__ import annotations
import argparse
import json
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
MIGRATION=ROOT/'supabase/migrations/20260903000120_admin_access_impersonation_global_permissions.sql'
RECOVERY=ROOT/'supabase/recovery/20260903000120_admin_access_impersonation_global_permissions_recovery.sql'
METADATA_FIX=ROOT/'supabase/migrations/20260903000121_admin_assignment_revocation_metadata_fix.sql'
METADATA_RECOVERY=ROOT/'supabase/recovery/20260903000121_admin_assignment_revocation_metadata_fix_recovery.sql'
STOP_FIX=ROOT/'supabase/migrations/20260903000122_impersonation_stop_permission_binding.sql'
STOP_RECOVERY=ROOT/'supabase/recovery/20260903000122_impersonation_stop_permission_binding_recovery.sql'

def env():
    out={}
    for raw in (ROOT/'supabase.env').read_text(encoding='utf-8-sig').splitlines():
        if raw.strip() and not raw.lstrip().startswith('#') and '=' in raw:
            key,value=raw.split('=',1);out[key.strip()]=value.strip().strip('"').strip("'")
    return out

def body(path):
    value=path.read_text(encoding='utf-8').strip()
    if not value.lower().startswith('begin;') or not value.lower().endswith('commit;'):
        raise RuntimeError('TRANSACTION_BOUNDARY_REQUIRED')
    return value[6:-7]

def query(values,sql):
    ref=urllib.parse.urlsplit(values['SUPABASE_URL']).hostname.split('.')[0]
    request=urllib.request.Request(
        f'https://api.supabase.com/v1/projects/{ref}/database/query',
        data=json.dumps({'query':sql}).encode(),
        headers={'Authorization':'Bearer '+values['SUPABASE_ACCESS_TOKEN'],'Content-Type':'application/json','User-Agent':'SutiApp-Admin-Access-Test/1.0'},method='POST')
    try:
        with urllib.request.urlopen(request,timeout=240) as response: raw=response.read()
    except urllib.error.HTTPError as error:
        raise RuntimeError(f'HTTP {error.code}: '+error.read(4000).decode('utf-8','replace')) from None
    return json.loads(raw) if raw else []

CHECKS=r"""
do $$
declare
  v_actor uuid;v_subject uuid;v_normal uuid;v_subject_email text;v_affiliate uuid;
  v_section text;v_other_section text;v_assignment uuid;v_imp_role uuid;
  v_session uuid;v_effective uuid;v_protected uuid;v_context jsonb;v_denied boolean:=false;
  v_assigned_at timestamptz;v_assigned_by uuid;v_principal_permission_count integer;
begin
  select a.auth_user_id into v_actor from public.admin_assignments a join public.admin_roles r on r.id=a.role_id
   where a.enabled and r.code='principal_admin' order by a.protected_assignment desc,a.created_at limit 1;
  select u.id,u.email into v_subject,v_subject_email from auth.users u
   where u.email_confirmed_at is not null and u.id<>v_actor
     and not exists(select 1 from public.admin_assignments a where a.auth_user_id=u.id and a.protected_assignment)
   order by u.created_at limit 1;
  select u.id into v_normal from auth.users u
   where u.email_confirmed_at is not null and u.id not in(v_actor,v_subject)
     and not exists(select 1 from public.admin_assignments a where a.auth_user_id=u.id and a.enabled)
     and not exists(select 1 from public.admin_section_responsibilities r where r.auth_user_id=u.id and r.enabled)
   order by u.created_at limit 1;
  select id into v_affiliate from public.affiliates where not is_archived order by source_row_ordinal limit 1;
  select section_key into v_section from public.admin_section_definitions where enforcement_status='ENFORCED' order by section_key limit 1;
  select section_key into v_other_section from public.admin_section_definitions where enforcement_status='ENFORCED' and section_key<>v_section order by section_key limit 1;
  if v_actor is null or v_subject is null or v_normal is null or v_affiliate is null or v_section is null or v_other_section is null then raise exception 'FOCUSED_FIXTURE_MISSING'; end if;

  perform set_config('request.jwt.claims',json_build_object('sub',v_actor,'role','authenticated','session_id','matrix-admin-session')::text,true);
  v_context:=public.get_admin_access_context();
  if coalesce((v_context->>'full_access')::boolean,false) is not true then raise exception 'A_SUPER_ADMIN_NOT_FULL'; end if;
  select count(*) into v_principal_permission_count from public.admin_role_permissions rp join public.admin_roles r on r.id=rp.role_id where r.code='principal_admin';
  if jsonb_array_length(v_context->'technical_permissions')<>v_principal_permission_count then raise exception 'A_SUPER_ADMIN_PERMISSION_GAP'; end if;
  v_assignment:=public.set_total_admin_by_email(v_subject_email);
  if not exists(select 1 from public.admin_assignments a join public.admin_roles r on r.id=a.role_id where a.id=v_assignment and a.enabled and r.code='principal_admin' and a.assigned_by_auth_user_id=v_actor) then raise exception 'A_TOTAL_ADMIN_FAILED'; end if;

  perform set_config('request.jwt.claims',json_build_object('sub',v_subject,'role','authenticated','session_id','matrix-subject-session')::text,true);
  v_context:=public.get_admin_access_context();
  if not public.has_admin_permission('authorization.write') or coalesce((v_context->>'full_access')::boolean,false) is not true then raise exception 'B_TOTAL_ADMIN_FAILED'; end if;
  v_denied:=false;
  begin perform public.revoke_admin_assignment(v_actor); exception when insufficient_privilege then v_denied:=true; end;
  if not v_denied then raise exception 'A_PROTECTED_SUPER_ADMIN_REVOKED'; end if;

  perform set_config('request.jwt.claims',json_build_object('sub',v_actor,'role','authenticated','session_id','matrix-admin-session')::text,true);
  v_imp_role:=public.save_admin_role(null,'Matrix impersonation role','Transactional focused test',array['affiliates.impersonate']);
  perform public.assign_admin_role(v_subject,v_imp_role,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_subject,'role','authenticated','session_id','matrix-subject-session')::text,true);
  select session_id into v_session from public.start_affiliate_impersonation(v_affiliate,'Matriz focal de autorización');
  select public.get_effective_affiliate_id() into v_effective;
  if v_session is null or v_effective is distinct from v_affiliate then raise exception 'D_IMPERSONATION_CONTEXT_FAILED'; end if;
  if not exists(select 1 from public.identity_audit_log where actor_real_auth_user_id=v_subject and usuario_contexto_affiliate_id=v_affiliate and action='IMPERSONATION_STARTED' and details->>'reason'='Matriz focal de autorización') then raise exception 'D_IDENTITY_AUDIT_FAILED'; end if;
  if not public.stop_affiliate_impersonation() then raise exception 'D_MANUAL_STOP_FAILED'; end if;
  if public.get_effective_affiliate_id() is not distinct from v_affiliate and not exists(select 1 from public.affiliates where id=v_affiliate and auth_user_id=v_subject) then raise exception 'D_CONTEXT_NOT_CLOSED'; end if;
  perform public.start_affiliate_impersonation(v_affiliate,'Revocación automática focal');

  perform set_config('request.jwt.claims',json_build_object('sub',v_actor,'role','authenticated','session_id','matrix-admin-session')::text,true);
  perform public.save_admin_role(v_imp_role,'Matrix section-only role','Transactional focused test',array[]::text[]);
  if exists(select 1 from public.impersonation_sessions where actor_real_auth_user_id=v_subject and ended_at is null) then raise exception 'H_ACTIVE_CONTEXT_SURVIVED_PERMISSION_REVOKE'; end if;
  perform public.set_section_responsibilities(v_subject_email,v_section,array['read']);
  perform set_config('request.jwt.claims',json_build_object('sub',v_subject,'role','authenticated','session_id','matrix-subject-session')::text,true);
  v_context:=public.get_admin_access_context();
  if jsonb_array_length(v_context->'technical_permissions')<>0 or jsonb_array_length(v_context->'section_actions')<>1 then raise exception 'C_SECTION_ONLY_CONTEXT_FAILED'; end if;
  if not public.has_section_action(v_section,'read') then raise exception 'C_SECTION_READ_FAILED'; end if;
  if public.has_section_action(v_section,'delete') or public.has_section_action(v_other_section,'read') then raise exception 'C_SECTION_ESCALATION'; end if;
  v_denied:=false;
  begin perform public.start_affiliate_impersonation(v_affiliate,'Debe fallar sin permiso'); exception when insufficient_privilege then v_denied:=true; end;
  if not v_denied then raise exception 'E_UNAUTHORIZED_IMPERSONATION_ALLOWED'; end if;
  v_denied:=false;
  begin perform public.stop_affiliate_impersonation(); exception when insufficient_privilege then v_denied:=true; end;
  if not v_denied then raise exception 'E_UNAUTHORIZED_IMPERSONATION_STOP_ALLOWED'; end if;

  perform set_config('request.jwt.claims',json_build_object('sub',v_actor,'role','authenticated','session_id','matrix-admin-session')::text,true);
  select assigned_at,assigned_by_auth_user_id into v_assigned_at,v_assigned_by from public.admin_assignments where id=v_assignment;
  perform public.revoke_admin_assignment(v_subject);
  if exists(
    select 1 from public.admin_assignments
    where id=v_assignment and (assigned_at is distinct from v_assigned_at or assigned_by_auth_user_id is distinct from v_assigned_by)
  ) then raise exception 'H_REVOCATION_OVERWROTE_ASSIGNMENT_METADATA'; end if;
  perform public.revoke_section_responsibilities(v_subject,v_section);
  perform set_config('request.jwt.claims',json_build_object('sub',v_subject,'role','authenticated','session_id','matrix-subject-session')::text,true);
  v_context:=public.get_admin_access_context();
  if public.has_admin_permission('authorization.read') or jsonb_array_length(v_context->'section_actions')<>0 then raise exception 'H_REVOKE_FAILED'; end if;

  perform set_config('request.jwt.claims',json_build_object('sub',v_normal,'role','authenticated','session_id','matrix-normal-session')::text,true);
  if public.has_admin_permission('authorization.read') or public.has_section_action(v_section,'read') then raise exception 'F_NORMAL_USER_ESCALATED'; end if;
  v_denied:=false;
  begin perform public.list_admin_assignments(); exception when insufficient_privilege then v_denied:=true; end;
  if not v_denied then raise exception 'F_NORMAL_ADMIN_RPC_ALLOWED'; end if;

  perform set_config('request.jwt.claims',json_build_object('role','anon','session_id','matrix-anon-session')::text,true);
  v_denied:=false;
  begin perform public.start_affiliate_impersonation(v_affiliate,'Debe fallar anónimo'); exception when insufficient_privilege then v_denied:=true; end;
  if not v_denied then raise exception 'G_ANONYMOUS_IMPERSONATION_ALLOWED'; end if;

  perform set_config('request.jwt.claims',json_build_object('sub',v_actor,'role','authenticated','session_id','matrix-admin-session')::text,true);
  select auth_user_id into v_protected from public.admin_assignments where protected_assignment;
  if v_protected is null then raise exception 'H_PROTECTED_ADMIN_MISSING'; end if;
  v_denied:=false;
  begin perform public.revoke_admin_assignment(v_protected); exception when insufficient_privilege then v_denied:=true; end;
  if not v_denied then raise exception 'H_SELF_REVOCATION_ALLOWED'; end if;
end $$;

do $$ begin
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='impersonation_sessions' and column_name='actor_auth_session_id') then raise exception 'SESSION_BINDING_COLUMN_MISSING'; end if;
  if has_function_privilege('anon',to_regprocedure('public.set_total_admin_by_email(text)'),'EXECUTE') then raise exception 'ANON_ADMIN_RPC_EXPOSED'; end if;
  if has_function_privilege('anon',to_regprocedure('public.get_admin_access_context()'),'EXECUTE') then raise exception 'ANON_ADMIN_CONTEXT_EXPOSED'; end if;
  if has_function_privilege('anon',to_regprocedure('public.has_admin_permission(text)'),'EXECUTE') then raise exception 'ANON_ADMIN_PERMISSION_EXPOSED'; end if;
  if has_function_privilege('anon',to_regprocedure('public.has_section_action(text,text)'),'EXECUTE') then raise exception 'ANON_SECTION_PERMISSION_EXPOSED'; end if;
  if has_function_privilege('anon',to_regprocedure('public.start_affiliate_impersonation(uuid,text)'),'EXECUTE') then raise exception 'ANON_IMPERSONATION_RPC_EXPOSED'; end if;
  if (select count(*) from public.admin_section_definitions where enforcement_status='ENFORCED')<>11 then raise exception 'ENFORCED_SECTION_COUNT_CHANGED'; end if;
end $$;
"""

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--apply',action='store_true');args=parser.parse_args()
    values=env();migration=body(MIGRATION);recovery=body(RECOVERY)
    metadata_fix=body(METADATA_FIX);metadata_recovery=body(METADATA_RECOVERY)
    stop_fix=body(STOP_FIX);stop_recovery=body(STOP_RECOVERY)
    if args.apply:
        applied=query(values,"select to_regclass('public.admin_access_migration_state_20260903000120') is not null as applied;")[0]['applied']
        if not applied: query(values,MIGRATION.read_text(encoding='utf-8'))
        metadata_applied=query(values,"select to_regclass('public.admin_assignment_metadata_fix_state_20260903000121') is not null as applied;")[0]['applied']
        if not metadata_applied: query(values,METADATA_FIX.read_text(encoding='utf-8'))
        stop_applied=query(values,"select to_regclass('public.impersonation_stop_binding_state_20260903000122') is not null as applied;")[0]['applied']
        if not stop_applied: query(values,STOP_FIX.read_text(encoding='utf-8'))
        result=query(values,"""
          select json_build_object(
            'state',to_regclass('public.admin_access_migration_state_20260903000120') is not null,
            'metadata_fix_state',to_regclass('public.admin_assignment_metadata_fix_state_20260903000121') is not null,
            'stop_binding_state',to_regclass('public.impersonation_stop_binding_state_20260903000122') is not null,
            'protected_admins',(select count(*) from public.admin_assignments where protected_assignment),
            'enforced_sections',(select count(*) from public.admin_section_definitions where enforcement_status='ENFORCED'),
            'anon_start',has_function_privilege('anon',to_regprocedure('public.start_affiliate_impersonation(uuid,text)'),'EXECUTE'),
            'anon_assign',has_function_privilege('anon',to_regprocedure('public.set_total_admin_by_email(text)'),'EXECUTE')
          ) result;
        """)[0]['result']
        if result!={'state':True,'metadata_fix_state':True,'stop_binding_state':True,'protected_admins':1,'enforced_sections':11,'anon_start':False,'anon_assign':False}:
            raise RuntimeError('APPLY_RECONCILIATION_FAILED: '+json.dumps(result,sort_keys=True))
        print(json.dumps({'status':'PASS','mode':'APPLY','result':result,'credentials_exposed':False},sort_keys=True));return 0
    main_applied=query(values,"select to_regclass('public.admin_access_migration_state_20260903000120') is not null as applied;")[0]['applied']
    metadata_applied=query(values,"select to_regclass('public.admin_assignment_metadata_fix_state_20260903000121') is not null as applied;")[0]['applied']
    stop_applied=query(values,"select to_regclass('public.impersonation_stop_binding_state_20260903000122') is not null as applied;")[0]['applied']
    recovery_guard='ROUNDTRIP'
    if main_applied and metadata_applied and stop_applied:
        try:
            query(values,'begin;'+stop_recovery+metadata_recovery+metadata_fix+stop_fix+'rollback;')
        except RuntimeError as error:
            if 'RECOVERY_BLOCKED_POST_MIGRATION_ACTIVITY' not in str(error): raise
            recovery_guard='POST_ACTIVITY_BLOCKED'
        query(values,'begin;'+CHECKS+'rollback;')
    elif main_applied and metadata_applied:
        query(values,'begin;'+stop_fix+stop_recovery+'rollback;')
        query(values,'begin;'+stop_fix+CHECKS+'rollback;')
    elif main_applied:
        query(values,'begin;'+metadata_fix+stop_fix+stop_recovery+metadata_recovery+'rollback;')
        query(values,'begin;'+metadata_fix+stop_fix+CHECKS+'rollback;')
    else:
        query(values,'begin;'+migration+metadata_fix+stop_fix+stop_recovery+metadata_recovery+recovery+'rollback;')
        query(values,'begin;'+migration+metadata_fix+stop_fix+CHECKS+'rollback;')
    print(json.dumps({'status':'PASS','migration_recovery_compile':True,'metadata_fix_compile':True,'stop_binding_compile':True,'recovery_guard':recovery_guard,'matrix':'A-H','persistent_writes':0,'credentials_exposed':False},sort_keys=True))
    return 0

if __name__=='__main__': raise SystemExit(main())
