"""Apply ADR-043 migration once and verify non-destructive authority/security invariants."""
from pathlib import Path
import json, urllib.parse, urllib.request
ROOT=Path(__file__).resolve().parents[1]
MIGRATION=ROOT/'supabase/migrations/20260822000420_affiliate_financial_profile_authority.sql'
SEED_MIGRATION=ROOT/'supabase/migrations/20260822000421_bulk_financial_profile_seed.sql'
RECOVERY_HARDENING=ROOT/'supabase/migrations/20260822000422_harden_financial_seed_recovery.sql'

def env():
    out={}
    for raw in (ROOT/'supabase.env').read_text(encoding='utf-8-sig').splitlines():
        if raw.strip() and not raw.lstrip().startswith('#') and '=' in raw:
            key,value=raw.split('=',1);out[key.strip()]=value.strip().strip('"').strip("'")
    return out

def query(values,sql):
    ref=urllib.parse.urlsplit(values['SUPABASE_URL']).hostname.split('.')[0]
    req=urllib.request.Request(f'https://api.supabase.com/v1/projects/{ref}/database/query',data=json.dumps({'query':sql}).encode(),headers={'Authorization':'Bearer '+values['SUPABASE_ACCESS_TOKEN'],'Content-Type':'application/json','User-Agent':'SutiApp-Affiliate-Profile/1.0'},method='POST')
    with urllib.request.urlopen(req,timeout=120) as response:return json.loads(response.read().decode())

def main():
    values=env()
    applied=query(values,"select exists(select 1 from information_schema.columns where table_schema='public' and table_name='affiliates' and column_name='financial_union_code') applied")[0]['applied']
    if not applied:query(values,MIGRATION.read_text(encoding='utf-8'))
    seed_schema_applied=query(values,"select to_regclass('public.affiliate_financial_profile_seed_batches') is not null applied")[0]['applied']
    if not seed_schema_applied:query(values,SEED_MIGRATION.read_text(encoding='utf-8'))
    recovery_hardened=query(values,"select position('RECOVERY_BLOCKED_BY_CURRENT_PROFILE_DIFFERENCE' in pg_get_functiondef('public.recover_affiliate_financial_profile_seed(uuid)'::regprocedure))>0 applied")[0]['applied']
    if not recovery_hardened:query(values,RECOVERY_HARDENING.read_text(encoding='utf-8'))
    result=query(values,"""
      select
        exists(select 1 from information_schema.columns where table_schema='public' and table_name='affiliates' and column_name='financial_union_code') as profile_columns,
        to_regclass('public.affiliate_profile_audit_log') is not null as audit_table,
        (select relrowsecurity and relforcerowsecurity from pg_class where oid='public.affiliate_profile_audit_log'::regclass) as audit_rls,
        has_function_privilege('authenticated','public.get_affiliate_admin_profile(uuid)','execute') as authenticated_read_rpc,
        has_function_privilege('authenticated','public.update_affiliate_admin_profile(uuid,integer,jsonb,text)','execute') as authenticated_update_rpc,
        not has_function_privilege('authenticated','public.approve_financial_program_request(uuid,jsonb,uuid)','execute') as browser_approval_denied,
        has_function_privilege('service_role','public.approve_financial_program_request(uuid,jsonb,uuid)','execute') as service_approval_rpc,
        exists(select 1 from public.admin_role_permissions rp join public.admin_roles r on r.id=rp.role_id where r.code='principal_admin' and rp.permission='affiliates.write') as principal_write_permission,
        (select count(*) from public.affiliates)=947 as affiliate_count_preserved,
        exists(select 1 from pg_constraint where conrelid='public.affiliate_profile_audit_log'::regclass and conname='affiliate_profile_audit_actor_source_check') as audit_actor_source_contract,
        exists(select 1 from pg_trigger where tgrelid='public.program_requests'::regclass and tgname='program_requests_00_financial_snapshot' and not tgisinternal) as snapshot_trigger;
    """)[0]
    if not all(result.values()):raise RuntimeError('AFFILIATE_PROFILE_VERIFICATION_FAILED: '+json.dumps(result))
    seed_security=query(values,"""
      select
        to_regclass('public.affiliate_financial_profile_seed_snapshot') is not null as recovery_snapshot_table,
        (select relrowsecurity and relforcerowsecurity from pg_class where oid='public.affiliate_financial_profile_seed_batches'::regclass) as batch_rls,
        (select relrowsecurity and relforcerowsecurity from pg_class where oid='public.affiliate_financial_profile_seed_snapshot'::regclass) as snapshot_rls,
        has_function_privilege('service_role','public.bulk_seed_affiliate_financial_profiles(uuid,text,jsonb)','execute') as service_seed_rpc,
        not has_function_privilege('authenticated','public.bulk_seed_affiliate_financial_profiles(uuid,text,jsonb)','execute') as browser_seed_denied,
        has_function_privilege('service_role','public.recover_affiliate_financial_profile_seed(uuid)','execute') as recovery_rpc;
    """)[0]
    if not all(seed_security.values()):raise RuntimeError('SEED_SCHEMA_SECURITY_FAILED: '+json.dumps(seed_security))
    print(json.dumps({'status':'PASS','migration_applied':not applied,'seed_schema_applied':not seed_schema_applied,'recovery_hardened':not recovery_hardened,**result,**seed_security}))

if __name__=='__main__':main()
