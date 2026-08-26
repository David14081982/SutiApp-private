#!/usr/bin/env python3
"""Apply or transactionally verify the owner-authorized loan snapshot RPC."""
import json, sys, urllib.parse, urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
MIGRATION=ROOT/'supabase/migrations/20260826000100_authenticated_loan_snapshot_quote_rpc.sql'
RECOVERY=ROOT/'supabase/recovery/20260826000100_authenticated_loan_snapshot_quote_rpc_recovery.sql'

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
                 'Accept':'application/json','User-Agent':'SutiApp-Authenticated-Loan-Snapshot-RPC/1.0'},method='POST')
    with urllib.request.urlopen(request,timeout=120) as response:return json.loads(response.read())

def transaction_body(path):
    sql=path.read_text(encoding='utf-8').strip()
    if not sql.lower().startswith('begin;') or not sql.lower().endswith('commit;'):
        raise RuntimeError('TRANSACTION_BOUNDARY_MISSING')
    return sql[len('begin;'):len(sql)-len('commit;')]

def status(values):
    rows=query(values,"""select
      to_regprocedure('public.resolve_current_loan_snapshot_quote(uuid,text,numeric,integer)') is not null as authenticated_rpc,
      to_regprocedure('public.resolve_suti_loan_quote_contract(jsonb,text,text,text,numeric,integer,jsonb)') is not null as certified_resolver,
      has_function_privilege('authenticated','public.resolve_current_loan_snapshot_quote(uuid,text,numeric,integer)','execute') as authenticated_execute,
      not has_function_privilege('anon','public.resolve_current_loan_snapshot_quote(uuid,text,numeric,integer)','execute') as anonymous_denied,
      not has_function_privilege('authenticated','public.resolve_suti_loan_quote_contract(jsonb,text,text,text,numeric,integer,jsonb)','execute') as browser_core_denied,
      has_function_privilege('service_role','public.resolve_suti_loan_quote_contract(jsonb,text,text,text,numeric,integer,jsonb)','execute') as service_core_execute,
      not has_table_privilege('authenticated','public.financial_session_snapshots','select,insert,update,delete') as direct_snapshot_access_denied,
      (select count(*) from pg_policies where schemaname='public' and tablename='financial_session_snapshots')::integer as snapshot_browser_policies""")
    if len(rows)!=1 or not all(rows[0][key] for key in ['authenticated_rpc','certified_resolver','authenticated_execute','anonymous_denied','browser_core_denied','service_core_execute','direct_snapshot_access_denied']) or int(rows[0]['snapshot_browser_policies'])!=0:
        raise RuntimeError('RPC_SECURITY_STATUS_FAILED:'+json.dumps(rows,sort_keys=True))
    return rows[0]

def main():
    values=env()
    if '--dry-run' in sys.argv:
        rows=query(values,'begin;'+transaction_body(MIGRATION)+'rollback; select true as dry_run;')
        if len(rows)!=1 or rows[0].get('dry_run') is not True:raise RuntimeError('DRY_RUN_FAILED')
        print(json.dumps({'status':'PASS','migration_dry_run':True,'persistent_changes':0},sort_keys=True));return
    if '--recovery-dry-run' in sys.argv:
        applied=query(values,"select to_regprocedure('public.resolve_current_loan_snapshot_quote(uuid,text,numeric,integer)') is not null as applied")[0]['applied']
        forward='' if applied else transaction_body(MIGRATION)
        rows=query(values,'begin;'+forward+transaction_body(RECOVERY)+'rollback; select true as recovery_dry_run;')
        if len(rows)!=1 or rows[0].get('recovery_dry_run') is not True:raise RuntimeError('RECOVERY_DRY_RUN_FAILED')
        print(json.dumps({'status':'PASS','recovery_dry_run':True,'persistent_changes':0},sort_keys=True));return
    if '--status' in sys.argv:
        print(json.dumps({'status':'PASS',**status(values)},sort_keys=True));return
    before=query(values,"""select
      to_regprocedure('public.resolve_current_loan_snapshot_quote(uuid,text,numeric,integer)') is not null as applied,
      (select count(*) from public.financial_session_snapshots)::integer snapshot_rows,
      (select count(*) from public.program_requests)::integer request_rows,
      (select count(*) from public.affiliates)::integer affiliate_rows""")[0]
    if not before['applied']:query(values,MIGRATION.read_text(encoding='utf-8'))
    after=status(values)
    counts=query(values,"""select
      (select count(*) from public.financial_session_snapshots)::integer snapshot_rows,
      (select count(*) from public.program_requests)::integer request_rows,
      (select count(*) from public.affiliates)::integer affiliate_rows""")[0]
    for key in ['snapshot_rows','request_rows','affiliate_rows']:
        if int(counts[key])!=int(before[key]):raise RuntimeError('PROTECTED_DATA_CHANGED:'+key)
    print(json.dumps({'status':'PASS','applied':not before['applied'],'protected_rows_changed':0,**after},sort_keys=True))

if __name__=='__main__':main()
