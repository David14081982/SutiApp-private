#!/usr/bin/env python3
"""Transactionally verify or apply the financial request admin event boundary."""
import json, sys, urllib.parse, urllib.request, uuid
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
MIGRATION=ROOT/'supabase/migrations/20260829000200_financial_request_admin_events.sql'
RECOVERY=ROOT/'supabase/recovery/20260829000200_financial_request_admin_events_recovery.sql'

def env():
    values={}
    for raw in (ROOT/'supabase.env').read_text(encoding='utf-8-sig').splitlines():
        if raw.strip() and not raw.lstrip().startswith('#') and '=' in raw:
            key,value=raw.split('=',1);values[key.strip()]=value.strip().strip('"').strip("'")
    return values

def query(values,sql):
    ref=urllib.parse.urlsplit(values['SUPABASE_URL']).hostname.split('.')[0]
    request=urllib.request.Request(
        f'https://api.supabase.com/v1/projects/{ref}/database/query',
        data=json.dumps({'query':sql}).encode(),
        headers={'Authorization':'Bearer '+values['SUPABASE_ACCESS_TOKEN'],'Content-Type':'application/json',
                 'Accept':'application/json','User-Agent':'SutiApp-Financial-Request-Admin-Events/1.0'},method='POST')
    with urllib.request.urlopen(request,timeout=120) as response:return json.loads(response.read())

def transaction_body(path):
    sql=path.read_text(encoding='utf-8').strip()
    if not sql.lower().startswith('begin;') or not sql.lower().endswith('commit;'):
        raise RuntimeError('TRANSACTION_BOUNDARY_MISSING')
    return sql[len('begin;'):len(sql)-len('commit;')]

def one(values,sql):
    rows=query(values,sql)
    if len(rows)!=1:raise RuntimeError('UNEXPECTED_QUERY_RESULT')
    return rows[0]

def status(values):
    row=one(values,"""select
      to_regclass('public.program_request_admin_events') is not null as event_table,
      to_regprocedure('public.get_program_request_admin_events(uuid)') is not null as read_rpc,
      to_regprocedure('public.record_program_request_admin_action(uuid,text,text,uuid)') is not null as write_rpc,
      to_regprocedure('public.approve_financial_program_request(uuid,jsonb,uuid,text)') is not null as approval_rpc,
      to_regprocedure('public.approve_financial_program_request(uuid,jsonb,uuid)') is not null as original_approval_rpc,
      has_function_privilege('authenticated','public.get_program_request_admin_events(uuid)','execute') as authenticated_read,
      has_function_privilege('authenticated','public.record_program_request_admin_action(uuid,text,text,uuid)','execute') as authenticated_write,
      has_function_privilege('service_role','public.approve_financial_program_request(uuid,jsonb,uuid,text)','execute') as service_approval,
      not has_function_privilege('anon','public.get_program_request_admin_events(uuid)','execute') as anonymous_read_denied,
      not has_function_privilege('anon','public.record_program_request_admin_action(uuid,text,text,uuid)','execute') as anonymous_write_denied,
      not has_table_privilege('authenticated','public.program_request_admin_events','select') as direct_select_denied,
      not has_table_privilege('authenticated','public.program_request_admin_events','insert') as direct_insert_denied,
      c.relrowsecurity as rls_enabled,c.relforcerowsecurity as rls_forced,
      (select count(*) from public.program_request_admin_events)::integer as event_count
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='program_request_admin_events'""")
    for key,value in row.items():
        if key!='event_count' and value is not True:raise RuntimeError('ADMIN_EVENT_SECURITY_STATUS_FAILED:'+json.dumps(row,sort_keys=True))
    return row

def protected_counts(values):
    return one(values,"""select
      (select count(*) from public.program_requests)::integer as requests,
      (select count(*) from public.program_requests where financial_processing_status is not null)::integer as financial_requests,
      (select count(*) from public.request_documents)::integer as request_documents,
      (select count(*) from public.financial_request_export_audit)::integer as export_audit""")

def main():
    values=env();modes={'--dry-run','--recovery-dry-run','--matrix-dry-run','--status','--apply'}
    selected=[arg for arg in sys.argv[1:] if arg in modes];unknown=[arg for arg in sys.argv[1:] if arg not in modes]
    if unknown or len(selected)!=1:
        raise RuntimeError('EXPLICIT_MODE_REQUIRED: use exactly one of --dry-run, --recovery-dry-run, --matrix-dry-run, --status, --apply')
    if '--dry-run' in selected:
        rows=query(values,'begin;'+transaction_body(MIGRATION)+'rollback; select true as dry_run;')
        if len(rows)!=1 or rows[0].get('dry_run') is not True:raise RuntimeError('DRY_RUN_FAILED')
        print(json.dumps({'status':'PASS','migration_dry_run':True,'persistent_changes':0},sort_keys=True));return
    if '--recovery-dry-run' in selected:
        applied=one(values,"select to_regclass('public.program_request_admin_events') is not null as applied")['applied']
        forward='' if applied else transaction_body(MIGRATION)
        rows=query(values,'begin;'+forward+transaction_body(RECOVERY)+'rollback; select true as recovery_dry_run;')
        if len(rows)!=1 or rows[0].get('recovery_dry_run') is not True:raise RuntimeError('RECOVERY_DRY_RUN_FAILED')
        print(json.dumps({'status':'PASS','recovery_dry_run':True,'persistent_changes':0},sort_keys=True));return
    if '--matrix-dry-run' in selected:
        email=values['H005_TEST_EMAIL'].replace("'","''");action_id=str(uuid.uuid4());review_id=str(uuid.uuid4());reject_id=str(uuid.uuid4());cancel_id=str(uuid.uuid4())
        rows=query(values,f"""begin;
          create temporary table qa_request_before on commit drop as
            select id,status,notes from public.program_requests
            where financial_processing_status is not null order by created_at limit 1;
          grant select on qa_request_before to authenticated;
          do $$ begin if not exists(select 1 from qa_request_before) then raise exception 'QA_FINANCIAL_REQUEST_REQUIRED'; end if; end $$;
          select set_config('request.jwt.claims',jsonb_build_object(
            'sub',(select id from auth.users where lower(email)=lower('{email}') limit 1),'role','authenticated'
          )::text,true);
          set local role authenticated;
          select public.record_program_request_admin_action((select id from qa_request_before),'COMMENT','Verificación transaccional sin persistencia','{action_id}'::uuid);
          select public.record_program_request_admin_action((select id from qa_request_before),'COMMENT','Verificación transaccional sin persistencia','{action_id}'::uuid);
          savepoint qa_reject_case;
          select public.record_program_request_admin_action((select id from qa_request_before),'MARK_IN_REVIEW','Revisión transaccional sin persistencia','{review_id}'::uuid);
          select public.record_program_request_admin_action((select id from qa_request_before),'REJECT','Rechazo transaccional sin persistencia','{reject_id}'::uuid);
          rollback to savepoint qa_reject_case;
          select public.record_program_request_admin_action((select id from qa_request_before),'CANCEL','Cancelación transaccional sin persistencia','{cancel_id}'::uuid);
          reset role;
          do $$ declare v_before qa_request_before%rowtype;v_after public.program_requests%rowtype;begin
            select * into v_before from qa_request_before;select * into v_after from public.program_requests where id=v_before.id;
            if v_after.status<>'cancelled' or v_after.notes is distinct from v_before.notes then raise exception 'REQUEST_AUTHORITY_CHANGED'; end if;
            if (select count(*) from public.program_request_admin_events where client_action_id='{action_id}'::uuid)<>1 then raise exception 'IDEMPOTENCY_FAILED'; end if;
            if (select count(*) from public.program_request_admin_events where client_action_id='{review_id}'::uuid)<>0 then raise exception 'SAVEPOINT_REVIEW_PERSISTED'; end if;
            if (select count(*) from public.program_request_admin_events where client_action_id='{reject_id}'::uuid)<>0 then raise exception 'SAVEPOINT_REJECT_PERSISTED'; end if;
            if (select count(*) from public.program_request_admin_events where client_action_id='{cancel_id}'::uuid)<>1 then raise exception 'CANCEL_TRANSITION_FAILED'; end if;
          end $$;
          rollback;select true as matrix_dry_run;""")
        if len(rows)!=1 or rows[0].get('matrix_dry_run') is not True:raise RuntimeError('MATRIX_DRY_RUN_FAILED')
        print(json.dumps({'status':'PASS','matrix_dry_run':True,'idempotency':True,'review_reject_transition':True,'cancel_transition':True,'request_notes_unchanged':True,'persistent_changes':0},sort_keys=True));return
    if '--status' in selected:
        print(json.dumps({'status':'PASS',**status(values)},sort_keys=True));return
    before=protected_counts(values)
    applied=one(values,"select to_regclass('public.program_request_admin_events') is not null as applied")['applied']
    if not applied:query(values,MIGRATION.read_text(encoding='utf-8'))
    after=status(values);counts=protected_counts(values)
    for key in before:
        if int(before[key])!=int(counts[key]):raise RuntimeError('PROTECTED_DATA_CHANGED:'+key)
    print(json.dumps({'status':'PASS','applied':not applied,'protected_rows_changed':0,**after},sort_keys=True))

if __name__=='__main__':main()
