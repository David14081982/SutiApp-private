"""Apply the owner-authorized declared-payroll authority and verify fail-closed security."""
from pathlib import Path
import json, urllib.parse, urllib.request
ROOT=Path(__file__).resolve().parents[1]
MIGRATION=ROOT/'supabase/migrations/20260824000100_create_declared_payroll_authority.sql'

def env():
    out={}
    for raw in (ROOT/'supabase.env').read_text(encoding='utf-8-sig').splitlines():
        if raw.strip() and not raw.lstrip().startswith('#') and '=' in raw:
            key,value=raw.split('=',1);out[key.strip()]=value.strip().strip('"').strip("'")
    return out

def query(values,sql):
    ref=urllib.parse.urlsplit(values['SUPABASE_URL']).hostname.split('.')[0]
    request=urllib.request.Request(f'https://api.supabase.com/v1/projects/{ref}/database/query',data=json.dumps({'query':sql}).encode(),headers={'Authorization':'Bearer '+values['SUPABASE_ACCESS_TOKEN'],'Content-Type':'application/json','User-Agent':'SutiApp-Declared-Payroll/1.0'},method='POST')
    with urllib.request.urlopen(request,timeout=120) as response:return json.loads(response.read().decode())

def main():
    values=env()
    applied=query(values,"select to_regclass('public.affiliate_payroll_declarations') is not null applied")[0]['applied']
    if not applied: query(values,MIGRATION.read_text(encoding='utf-8'))
    result=query(values,"""
      select
        to_regclass('public.affiliate_payroll_declarations') is not null as declaration_table,
        to_regclass('public.affiliate_payroll_declaration_audit') is not null as audit_table,
        (select relrowsecurity and relforcerowsecurity from pg_class where oid='public.affiliate_payroll_declarations'::regclass) as declaration_rls,
        (select relrowsecurity and relforcerowsecurity from pg_class where oid='public.affiliate_payroll_declaration_audit'::regclass) as audit_rls,
        not has_table_privilege('authenticated','public.affiliate_payroll_declarations','select') as direct_read_denied,
        not has_table_privilege('authenticated','public.affiliate_payroll_declarations','insert') as direct_insert_denied,
        not has_table_privilege('authenticated','public.affiliate_payroll_declarations','update') as direct_update_denied,
        has_function_privilege('authenticated','public.get_current_declared_payroll()','execute') as read_rpc,
        has_function_privilege('authenticated','public.save_current_declared_payroll(numeric,numeric,integer)','execute') as write_rpc,
        has_function_privilege('authenticated','public.get_current_declared_payroll_impact(numeric)','execute') as impact_rpc,
        not has_function_privilege('anon','public.save_current_declared_payroll(numeric,numeric,integer)','execute') as anon_write_denied,
        (select count(*) from public.affiliates)=947 as affiliate_count_preserved;
    """)[0]
    if not all(result.values()): raise RuntimeError('DECLARED_PAYROLL_VERIFICATION_FAILED: '+json.dumps(result))
    counts=query(values,"""select
      (select count(*) from public.affiliate_payroll_declarations) as declaration_count,
      (select count(*) from public.affiliate_payroll_declarations where affiliate_id='"""+values['H005_TEST2_AFFILIATE_ID']+"""'::uuid) as qa_fixture_count""")[0]
    if counts['qa_fixture_count'] != 0: raise RuntimeError('QA_FIXTURE_RESIDUE')
    print(json.dumps({'status':'PASS','migration_applied':not applied,**result,**counts}))

if __name__=='__main__': main()
