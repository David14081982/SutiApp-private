"""Apply the approved Admin decisions migration and verify its invariants."""
from pathlib import Path
import json, urllib.parse, urllib.request

ROOT=Path(__file__).resolve().parents[1]
MIGRATION=ROOT/'supabase/migrations/20260822000400_admin_decisions_cutover.sql'
BENEFITS_MIGRATION=ROOT/'supabase/migrations/20260822000410_admin_company_benefits.sql'
HARDEN_MIGRATION=ROOT/'supabase/migrations/20260822000411_harden_admin_cutover_visibility.sql'

def env():
    values={}
    for raw in (ROOT/'supabase.env').read_text(encoding='utf-8-sig').splitlines():
        line=raw.strip()
        if line and not line.startswith('#') and '=' in line:
            key,value=line.split('=',1);values[key.strip()]=value.strip().strip('"').strip("'")
    return values

def query(values,sql):
    ref=urllib.parse.urlsplit(values['SUPABASE_URL']).hostname.split('.')[0]
    request=urllib.request.Request(f'https://api.supabase.com/v1/projects/{ref}/database/query',data=json.dumps({'query':sql}).encode(),headers={'Authorization':'Bearer '+values['SUPABASE_ACCESS_TOKEN'],'Content-Type':'application/json','User-Agent':'SutiApp-Admin-Cutover/1.0'},method='POST')
    with urllib.request.urlopen(request,timeout=90) as response:return json.loads(response.read().decode())

def main():
    values=env()
    if not query(values,"select to_regclass('public.admin_roles') is not null applied")[0]['applied']:
        query(values,MIGRATION.read_text(encoding='utf-8'))
    if not query(values,"select to_regclass('public.company_benefit_profiles') is not null applied")[0]['applied']:
        query(values,BENEFITS_MIGRATION.read_text(encoding='utf-8'))
    policy=query(values,"select pg_get_expr(polqual,polrelid) definition from pg_policy where polrelid='public.company_benefit_profiles'::regclass and polname='company_profiles_read'")[0]['definition']
    if 'c.enabled' not in policy:
        query(values,HARDEN_MIGRATION.read_text(encoding='utf-8'))
    result=query(values,"""
      select
        (select count(*) from public.segmentation_catalog_entries)=20 as exact_segments,
        (select count(*) from public.admin_roles where code='principal_admin' and system_role)=1 as principal_role,
        (select count(*) from public.admin_assignments a join public.admin_roles r on r.id=a.role_id where a.enabled and r.code='principal_admin')=1 as one_principal,
        (select count(*) from public.admin_assignments a join auth.users u on u.id=a.auth_user_id where upper(coalesce(u.raw_user_meta_data->>'name','')) in('H005_TEST2','H005_TEST3') or upper(coalesce(u.email,'')) like '%H005_TEST2%' or upper(coalesce(u.email,'')) like '%H005_TEST3%')=0 as normal_users_unassigned,
        (select bool_and(c.relrowsecurity and c.relforcerowsecurity) from pg_class c where c.oid=any(array['public.admin_roles'::regclass,'public.admin_role_permissions'::regclass,'public.segmentation_catalog_entries'::regclass,'public.affiliate_segment_tags'::regclass,'public.screen_access_policies'::regclass,'public.company_audience_rules'::regclass,'public.finance_catalog_presentation'::regclass,'public.operational_workflows'::regclass,'public.operational_workflow_stages'::regclass,'public.operational_request_tracking'::regclass,'public.union_screen_content'::regclass,'public.union_content_blocks'::regclass,'public.company_benefit_profiles'::regclass,'public.company_benefits'::regclass])) as rls_forced,
        has_function_privilege('authenticated','public.save_admin_role(uuid,text,text,text[])','execute') as role_rpc,
        (select relrowsecurity and relforcerowsecurity from pg_class where oid='public.company_benefit_profiles'::regclass) as company_benefits_rls,
        (select pg_get_expr(polqual,polrelid) like '%c.enabled%' from pg_policy where polrelid='public.company_benefit_profiles'::regclass and polname='company_profiles_read') as disabled_company_hidden,
        (select pg_get_expr(polqual,polrelid) like '%s.published%' from pg_policy where polrelid='public.union_content_blocks'::regclass and polname='union_blocks_public') as unpublished_union_hidden;
    """)[0]
    if not all(result.values()): raise RuntimeError('ADMIN_DECISIONS_CUTOVER_VERIFICATION_FAILED: '+json.dumps(result))
    print(json.dumps({'status':'PASS',**result}))

if __name__=='__main__': main()
