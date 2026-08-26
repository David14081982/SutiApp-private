#!/usr/bin/env python3
"""Apply the final loan export schema once, with exact before/after verification."""
import json, urllib.parse, urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
MIGRATION=ROOT/'supabase/migrations/20260823000100_final_approved_loan_export_writer.sql'
HARDENING=ROOT/'supabase/migrations/20260823000101_harden_final_approved_loan_export_failure.sql'
def env():
    out={}
    for raw in (ROOT/'supabase.env').read_text(encoding='utf-8-sig').splitlines():
        if raw.strip() and not raw.lstrip().startswith('#') and '=' in raw:
            key,value=raw.split('=',1);out[key.strip()]=value.strip().strip('"').strip("'")
    return out
def query(values,sql):
    ref=urllib.parse.urlsplit(values['SUPABASE_URL']).hostname.split('.')[0]
    request=urllib.request.Request(f'https://api.supabase.com/v1/projects/{ref}/database/query',data=json.dumps({'query':sql}).encode(),headers={'Authorization':'Bearer '+values['SUPABASE_ACCESS_TOKEN'],'Content-Type':'application/json','Accept':'application/json','User-Agent':'SutiApp-Final-Loan-Writer/1.0'},method='POST')
    with urllib.request.urlopen(request,timeout=120) as response:return json.loads(response.read())
def one(values,sql):
    rows=query(values,sql)
    if len(rows)!=1:raise RuntimeError('UNEXPECTED_QUERY_RESULT')
    return rows[0]
def main():
    values=env()
    before=one(values,"""select
      to_regclass('public.financial_request_export_audit') is not null as applied,
      (select count(*) from public.program_requests) as requests,
      (select count(*) from public.program_requests where financial_processing_status is not null) as financial_requests,
      (select count(*) from public.affiliates) as affiliates,
      (select count(*) from public.program_requests where legacy_reference is not null) as legacy_references""")
    if not before['applied']:query(values,MIGRATION.read_text(encoding='utf-8'))
    hardened=one(values,"select position('EXPORT_FAILURE_STATE_INVALID' in pg_get_functiondef('public.fail_financial_request_export(uuid,text,text,text,uuid)'::regprocedure))>0 as applied")['applied']
    if not hardened:query(values,HARDENING.read_text(encoding='utf-8'))
    after=one(values,"""select
      to_regclass('public.financial_request_export_audit') is not null as audit_table,
      (select relrowsecurity and relforcerowsecurity from pg_class where oid='public.financial_request_export_audit'::regclass) as audit_rls,
      to_regprocedure('public.begin_financial_request_export(uuid,text,uuid)') is not null as begin_rpc,
      to_regprocedure('public.complete_financial_request_export(uuid,text,integer,text,uuid)') is not null as complete_rpc,
      to_regprocedure('public.fail_financial_request_export(uuid,text,text,text,uuid)') is not null as fail_rpc,
      has_function_privilege('service_role','public.begin_financial_request_export(uuid,text,uuid)','execute') as service_execute,
      not has_function_privilege('authenticated','public.begin_financial_request_export(uuid,text,uuid)','execute') as browser_denied,
      exists(select 1 from pg_trigger where tgrelid='public.program_requests'::regclass and tgname='program_requests_01_protect_approved_financial_state' and not tgisinternal) as immutable_trigger,
      position('ready_for_handoff' in pg_get_functiondef('public.approve_financial_program_request(uuid,jsonb,uuid)'::regprocedure))>0 as approval_ready,
      position('EXPORT_FAILURE_STATE_INVALID' in pg_get_functiondef('public.fail_financial_request_export(uuid,text,text,text,uuid)'::regprocedure))>0 as failure_hardened,
      (select count(*) from public.financial_request_export_audit) as audit_rows,
      (select count(*) from public.program_requests) as requests,
      (select count(*) from public.program_requests where financial_processing_status is not null) as financial_requests,
      (select count(*) from public.affiliates) as affiliates,
      (select count(*) from public.program_requests where legacy_reference is not null) as legacy_references""")
    required=['audit_table','audit_rls','begin_rpc','complete_rpc','fail_rpc','service_execute','browser_denied','immutable_trigger','approval_ready','failure_hardened']
    if not all(after[key] for key in required):raise RuntimeError('WRITER_SCHEMA_SECURITY_FAILED:'+json.dumps(after,sort_keys=True))
    for key in ['requests','financial_requests','affiliates','legacy_references']:
        if int(after[key])!=int(before[key]):raise RuntimeError(f'PROTECTED_DATA_CHANGED:{key}')
    if int(after['audit_rows'])!=0:raise RuntimeError('UNEXPECTED_AUDIT_ROWS')
    print(json.dumps({'status':'PASS','applied':not before['applied'],'hardening_applied':not hardened,'requests_preserved':int(after['requests']),'financial_requests':int(after['financial_requests']),'audit_rows':0,'legacy_references_preserved':int(after['legacy_references']),'affiliates_preserved':int(after['affiliates']),'rls':True,'browser_execute':'DENIED'},sort_keys=True))
if __name__=='__main__':main()
