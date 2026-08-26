"""Apply the owner-approved flexible-term and assisted-admin migration."""
from pathlib import Path
import json, urllib.parse, urllib.request

ROOT=Path(__file__).resolve().parents[1]
MIGRATION=ROOT/'supabase/migrations/20260824000200_flexible_loan_terms_and_assisted_impersonation.sql'
REQUEST_TARGET=ROOT/'supabase/migrations/20260824000210_create_suti_loan_request_target.sql'
CUSTOM_MINIMUM=ROOT/'supabase/migrations/20260824000220_set_custom_loan_minimum_one_payment.sql'

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
        headers={'Authorization':'Bearer '+values['SUPABASE_ACCESS_TOKEN'],'Content-Type':'application/json','User-Agent':'SutiApp-FlexibleLoan/1.0'},
        method='POST')
    with urllib.request.urlopen(request,timeout=120) as response:return json.loads(response.read().decode())

def main():
    values=env()
    applied=query(values,"select to_regclass('public.loan_term_policy') is not null applied")[0]['applied']
    if not applied: query(values,MIGRATION.read_text(encoding='utf-8'))
    target_applied=query(values,"select exists(select 1 from public.program_catalog_items where id='7e8c1f55-a5e3-4e5f-9f3b-6d9524725bc3') applied")[0]['applied']
    if not target_applied: query(values,REQUEST_TARGET.read_text(encoding='utf-8'))
    custom_minimum_applied=query(values,"select exists(select 1 from public.loan_term_policy where id='primary' and custom_min_term=1 and decision_reference='OWNER_DECISION_2026-08-24_CUSTOM_MIN_1') applied")[0]['applied']
    if not custom_minimum_applied: query(values,CUSTOM_MINIMUM.read_text(encoding='utf-8'))
    result=query(values,"""
      select
        to_regclass('public.loan_term_policy') is not null as policy_table,
        (select relrowsecurity and relforcerowsecurity from pg_class where oid='public.loan_term_policy'::regclass) as policy_rls,
        not has_table_privilege('authenticated','public.loan_term_policy','select') as direct_policy_denied,
        has_function_privilege('authenticated','public.get_current_loan_term_policy()','execute') as policy_rpc,
        not has_function_privilege('anon','public.get_current_loan_term_policy()','execute') as anon_policy_denied,
        has_function_privilege('authenticated','public.is_active_admin()','execute') as active_admin_rpc,
        exists(select 1 from information_schema.columns where table_schema='public' and table_name='program_requests' and column_name='impersonation_session_id') as request_audit_columns,
        exists(select 1 from pg_trigger where tgrelid='public.program_requests'::regclass and tgname='program_requests_capture_impersonation' and not tgisinternal) as request_audit_trigger,
        (select standard_terms=array[6,12,18,24] and custom_min_term=1 and custom_step=1 from public.loan_term_policy where id='primary') as owner_policy,
        exists(select 1 from public.program_catalog_items where id='7e8c1f55-a5e3-4e5f-9f3b-6d9524725bc3' and program_key='prestamo' and request_mode='supabase' and legacy_boundary) as loan_request_target;
    """)[0]
    if not all(result.values()): raise RuntimeError('FLEXIBLE_LOAN_VERIFICATION_FAILED: '+json.dumps(result))
    print(json.dumps({'status':'PASS','migration_applied':not applied,'request_target_applied':not target_applied,'custom_minimum_applied':not custom_minimum_applied,**result}))

if __name__=='__main__': main()
