#!/usr/bin/env python3
"""Apply Phase 6 only when the remote schema is exactly at the expected boundary."""
import json,urllib.parse,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def env():
    out={}
    for raw in (ROOT/'supabase.env').read_text(encoding='utf-8-sig').splitlines():
        if raw.strip() and not raw.lstrip().startswith('#') and '=' in raw:
            k,v=raw.split('=',1);out[k.strip()]=v.strip().strip('"').strip("'")
    return out
def query(endpoint,token,sql):
    req=urllib.request.Request(endpoint,data=json.dumps({'query':sql}).encode(),headers={'Authorization':'Bearer '+token,'Content-Type':'application/json','Accept':'application/json','User-Agent':'SutiApp-Phase6/1.0'},method='POST')
    with urllib.request.urlopen(req,timeout=120) as r:return json.loads(r.read())
def one(endpoint,token,sql):
    rows=query(endpoint,token,sql)
    if len(rows)!=1:raise RuntimeError('Phase 6 catalog query returned an unexpected row count')
    return rows[0]
def require(condition,message):
    if not condition:raise RuntimeError(message)
def catalog(endpoint,token):
    return one(endpoint,token,"""
select
  to_regclass('public.company_portal_plans') is not null plans_table,
  to_regclass('public.company_portal_subscriptions') is not null subscriptions_table,
  (select count(*) from pg_policies where schemaname='public' and policyname like 'company_portal_%') portal_policies,
  (select count(*) from pg_policies where schemaname='public' and policyname like 'marketplace_memberships_admin_%') membership_admin_policies,
  (select count(*) from pg_trigger where not tgisinternal and tgname like 'company_portal_%') portal_triggers,
  (select count(*) from pg_class where relkind='i' and relname like 'company_portal_%_idx') portal_indexes,
  to_regclass('public.companies') is not null companies_table,
  to_regclass('public.marketplace_company_memberships') is not null memberships_table,
  to_regclass('public.admin_assignments') is not null admin_table,
  to_regprocedure('public.has_admin_permission(text)') is not null has_admin_permission,
  to_regprocedure('public.is_marketplace_company_member(uuid,text)') is not null is_company_member,
  to_regprocedure('public.set_h0072_updated_at()') is not null updated_at_function,
  to_regprocedure('public.audit_admin_write()') is not null audit_function,
  (select count(*) from public.admin_assignments where enabled) enabled_admins,
  (select count(*) from public.admin_assignments where enabled and permissions && array['company_portal.read','company_portal.write']) phase6_admins,
  (select count(*) from public.companies) companies,
  (select count(*) from public.marketplace_company_memberships) memberships,
  (select count(*) from public.affiliates) affiliates,
  (select count(*) from auth.users) auth_users
""")
def verify_absent(row):
    require(not row['plans_table'] and not row['subscriptions_table'],'PHASE6_SCHEMA_DIFFERENCE: portal table collision')
    require(int(row['portal_policies'])==0 and int(row['membership_admin_policies'])==0,'PHASE6_SCHEMA_DIFFERENCE: policy collision')
    require(int(row['portal_triggers'])==0 and int(row['portal_indexes'])==0,'PHASE6_SCHEMA_DIFFERENCE: trigger/index collision')
    for key in ('companies_table','memberships_table','admin_table','has_admin_permission','is_company_member','updated_at_function','audit_function'):
        require(row[key],f'PHASE6_SCHEMA_DIFFERENCE: missing dependency {key}')
    require(int(row['enabled_admins'])==1 and int(row['phase6_admins'])==0,'PHASE6_SCHEMA_DIFFERENCE: admin baseline mismatch')
def verify_applied(endpoint,token,before):
    row=one(endpoint,token,"""
select
 (select count(*) from information_schema.columns where table_schema='public' and table_name='company_portal_plans') plan_columns,
 (select count(*) from information_schema.columns where table_schema='public' and table_name='company_portal_subscriptions') subscription_columns,
 (select string_agg(column_name||':'||udt_name||':'||is_nullable,',' order by ordinal_position) from information_schema.columns where table_schema='public' and table_name='company_portal_plans') plan_column_signature,
 (select string_agg(column_name||':'||udt_name||':'||is_nullable,',' order by ordinal_position) from information_schema.columns where table_schema='public' and table_name='company_portal_subscriptions') subscription_column_signature,
 (select count(*) from pg_constraint where conrelid='public.company_portal_plans'::regclass and contype in ('p','c','f','u')) plan_constraints,
 (select count(*) from pg_constraint where conrelid='public.company_portal_subscriptions'::regclass and contype in ('p','c','f','u')) subscription_constraints,
 (select string_agg(conname,',' order by conname) from pg_constraint where conrelid='public.company_portal_plans'::regclass and contype in ('p','c','f','u')) plan_constraint_signature,
 (select string_agg(conname,',' order by conname) from pg_constraint where conrelid='public.company_portal_subscriptions'::regclass and contype in ('p','c','f','u')) subscription_constraint_signature,
 (select count(*) from pg_policies where schemaname='public' and tablename in ('company_portal_plans','company_portal_subscriptions')) portal_policies,
 (select count(*) from pg_policies where schemaname='public' and tablename='marketplace_company_memberships' and policyname like 'marketplace_memberships_admin_%') membership_admin_policies,
 (select string_agg(tablename||':'||policyname||':'||cmd,',' order by tablename,policyname) from pg_policies where schemaname='public' and (tablename in ('company_portal_plans','company_portal_subscriptions') or policyname like 'marketplace_memberships_admin_%')) policy_signature,
 (select count(*) from pg_trigger where not tgisinternal and tgrelid in ('public.company_portal_plans'::regclass,'public.company_portal_subscriptions'::regclass)) portal_triggers,
 (select string_agg(tgname,',' order by tgname) from pg_trigger where not tgisinternal and tgrelid in ('public.company_portal_plans'::regclass,'public.company_portal_subscriptions'::regclass)) trigger_signature,
 (select count(*) from pg_class where relkind='i' and relname in ('company_portal_plans_sort_idx','company_portal_subscriptions_plan_idx')) portal_indexes,
 (select bool_and(relrowsecurity and relforcerowsecurity) from pg_class where oid in ('public.company_portal_plans'::regclass,'public.company_portal_subscriptions'::regclass)) rls,
 (select count(*) from information_schema.role_table_grants where table_schema='public' and table_name in ('company_portal_plans','company_portal_subscriptions') and grantee='authenticated' and privilege_type in ('SELECT','INSERT','UPDATE','DELETE')) authenticated_grants,
 (select count(*) from public.company_portal_plans) plans,
 (select count(*) from public.company_portal_subscriptions) subscriptions,
 (select count(*) from public.admin_assignments where enabled and permissions @> array['company_portal.read','company_portal.write']) admins,
 (select count(*) from public.companies) companies,
 (select count(*) from public.marketplace_company_memberships) memberships,
 (select count(*) from public.affiliates) affiliates,
 (select count(*) from auth.users) auth_users
""")
    expected={'plan_columns':14,'subscription_columns':10,'plan_constraints':9,'subscription_constraints':8,'portal_policies':4,'membership_admin_policies':3,'portal_triggers':4,'portal_indexes':2,'authenticated_grants':8,'plans':0,'subscriptions':0,'admins':1}
    for key,value in expected.items():require(int(row[key])==value,f'PHASE6_RECONCILIATION_FAILED: {key}={row[key]} expected {value}')
    signatures={
      'plan_column_signature':'id:uuid:NO,name:text:NO,description:text:YES,monthly_price:numeric:NO,annual_price:numeric:NO,max_products:int4:NO,allows_popups:bool:NO,allows_stats_history:bool:NO,benefits:jsonb:NO,enabled:bool:NO,sort_order:int4:NO,record_origin:text:NO,created_at:timestamptz:NO,updated_at:timestamptz:NO',
      'subscription_column_signature':'id:uuid:NO,company_id:uuid:NO,plan_id:uuid:YES,billing_cycle:text:YES,status:text:NO,starts_on:date:YES,ends_on:date:YES,record_origin:text:NO,created_at:timestamptz:NO,updated_at:timestamptz:NO',
      'plan_constraint_signature':'company_portal_plans_annual_price_check,company_portal_plans_benefits_check,company_portal_plans_description_check,company_portal_plans_max_products_check,company_portal_plans_monthly_price_check,company_portal_plans_name_check,company_portal_plans_pkey,company_portal_plans_record_origin_check,company_portal_plans_sort_order_check',
      'subscription_constraint_signature':'company_portal_subscription_dates,company_portal_subscriptions_billing_cycle_check,company_portal_subscriptions_company_id_fkey,company_portal_subscriptions_company_id_key,company_portal_subscriptions_pkey,company_portal_subscriptions_plan_id_fkey,company_portal_subscriptions_record_origin_check,company_portal_subscriptions_status_check',
      'policy_signature':'company_portal_plans:company_portal_plans_admin_write:ALL,company_portal_plans:company_portal_plans_read:SELECT,company_portal_subscriptions:company_portal_subscriptions_admin_write:ALL,company_portal_subscriptions:company_portal_subscriptions_read:SELECT,marketplace_company_memberships:marketplace_memberships_admin_delete:DELETE,marketplace_company_memberships:marketplace_memberships_admin_insert:INSERT,marketplace_company_memberships:marketplace_memberships_admin_update:UPDATE',
      'trigger_signature':'company_portal_plans_admin_audit,company_portal_plans_updated_at,company_portal_subscriptions_admin_audit,company_portal_subscriptions_updated_at'}
    for key,value in signatures.items():require(row[key]==value,f'PHASE6_SCHEMA_DIFFERENCE: {key}={row[key]!r}')
    require(row['rls'],'PHASE6_RECONCILIATION_FAILED: RLS is not enabled and forced')
    for key in ('companies','memberships','affiliates','auth_users'):
        require(int(row[key])==int(before[key]),f'PHASE6_PROTECTED_DATA_CHANGED: {key}')
    return row
def main():
    v=env();ref=urllib.parse.urlsplit(v['SUPABASE_URL']).hostname.split('.')[0];endpoint=f'https://api.supabase.com/v1/projects/{ref}/database/query';token=v['SUPABASE_ACCESS_TOKEN']
    before=catalog(endpoint,token)
    if before['plans_table'] or before['subscriptions_table']:
        require(before['plans_table'] and before['subscriptions_table'],'PHASE6_SCHEMA_DIFFERENCE: partial portal schema')
        row=verify_applied(endpoint,token,before)
        print(json.dumps({'status':'PASS','applied':False,'already_exact':True,**row},sort_keys=True));return
    verify_absent(before)
    query(endpoint,token,(ROOT/'supabase/migrations/20260821001100_create_phase6_company_portal.sql').read_text(encoding='utf-8'))
    row=verify_applied(endpoint,token,before)
    print(json.dumps({'status':'PASS','applied':True,'already_exact':False,**row},sort_keys=True))
if __name__=='__main__':main()
