#!/usr/bin/env python3
"""Apply or transactionally verify the Admin financial read model."""
import json, sys, urllib.parse, urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
MIGRATION=ROOT/'supabase/migrations/20260826000200_admin_financial_requests_read_model.sql'
RECOVERY=ROOT/'supabase/recovery/20260826000200_admin_financial_requests_read_model_recovery.sql'

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
                 'Accept':'application/json','User-Agent':'SutiApp-Admin-Financial-Read-Model/1.0'},method='POST')
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
      to_regprocedure('public.list_admin_financial_request_queue()') is not null as queue_rpc,
      to_regprocedure('public.get_admin_financial_request_detail(uuid)') is not null as detail_rpc,
      to_regprocedure('public.list_admin_financial_requests_mobile()') is not null as mobile_rpc,
      has_function_privilege('authenticated','public.list_admin_financial_request_queue()','execute') as authenticated_queue,
      has_function_privilege('authenticated','public.get_admin_financial_request_detail(uuid)','execute') as authenticated_detail,
      has_function_privilege('authenticated','public.list_admin_financial_requests_mobile()','execute') as authenticated_mobile,
      not has_function_privilege('anon','public.list_admin_financial_request_queue()','execute') as anonymous_queue_denied,
      not has_function_privilege('anon','public.get_admin_financial_request_detail(uuid)','execute') as anonymous_detail_denied,
      not has_function_privilege('anon','public.list_admin_financial_requests_mobile()','execute') as anonymous_mobile_denied,
      not has_column_privilege('authenticated','public.program_requests','requested_amount','select') as direct_amount_denied,
      not has_column_privilege('authenticated','public.program_requests','financial_submission_snapshot','select') as direct_submission_denied,
      not has_column_privilege('authenticated','public.program_requests','financial_approval_snapshot','select') as direct_approval_denied""")
    if not all(row.values()):raise RuntimeError('READ_MODEL_SECURITY_STATUS_FAILED:'+json.dumps(row,sort_keys=True))
    return row

def main():
    values=env()
    modes={'--dry-run','--recovery-dry-run','--status','--apply'}
    selected=[arg for arg in sys.argv[1:] if arg in modes]
    unknown=[arg for arg in sys.argv[1:] if arg not in modes]
    if unknown or len(selected)!=1:
        raise RuntimeError('EXPLICIT_MODE_REQUIRED: use exactly one of --dry-run, --recovery-dry-run, --status, --apply')
    if '--dry-run' in sys.argv:
        rows=query(values,'begin;'+transaction_body(MIGRATION)+'rollback; select true as dry_run;')
        if len(rows)!=1 or rows[0].get('dry_run') is not True:raise RuntimeError('DRY_RUN_FAILED')
        print(json.dumps({'status':'PASS','migration_dry_run':True,'persistent_changes':0},sort_keys=True));return
    if '--recovery-dry-run' in sys.argv:
        applied=one(values,"select to_regprocedure('public.list_admin_financial_request_queue()') is not null as applied")['applied']
        forward='' if applied else transaction_body(MIGRATION)
        rows=query(values,'begin;'+forward+transaction_body(RECOVERY)+'rollback; select true as recovery_dry_run;')
        if len(rows)!=1 or rows[0].get('recovery_dry_run') is not True:raise RuntimeError('RECOVERY_DRY_RUN_FAILED')
        print(json.dumps({'status':'PASS','recovery_dry_run':True,'persistent_changes':0},sort_keys=True));return
    if '--status' in sys.argv:
        print(json.dumps({'status':'PASS',**status(values)},sort_keys=True));return
    if '--apply' not in sys.argv:raise RuntimeError('EXPLICIT_APPLY_REQUIRED')
    before=one(values,"""select
      to_regprocedure('public.list_admin_financial_request_queue()') is not null as applied,
      (select count(*) from public.program_requests)::integer as requests,
      (select count(*) from public.program_requests where financial_processing_status is not null)::integer as financial_requests,
      (select count(*) from public.request_documents)::integer as request_documents,
      (select count(*) from public.financial_request_export_audit)::integer as export_audit""")
    if not before['applied']:query(values,MIGRATION.read_text(encoding='utf-8'))
    after=status(values)
    counts=one(values,"""select
      (select count(*) from public.program_requests)::integer as requests,
      (select count(*) from public.program_requests where financial_processing_status is not null)::integer as financial_requests,
      (select count(*) from public.request_documents)::integer as request_documents,
      (select count(*) from public.financial_request_export_audit)::integer as export_audit""")
    for key in ['requests','financial_requests','request_documents','export_audit']:
        if int(counts[key])!=int(before[key]):raise RuntimeError('PROTECTED_DATA_CHANGED:'+key)
    print(json.dumps({'status':'PASS','applied':not before['applied'],'protected_rows_changed':0,**after},sort_keys=True))

if __name__=='__main__':main()
