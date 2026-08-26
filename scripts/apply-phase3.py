#!/usr/bin/env python3
"""Apply the owner-authorized Phase 3 commercial authority and reconcile its empty cutover."""
import json, urllib.error, urllib.parse, urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
MIGRATION=ROOT/'supabase/migrations/20260821000900_complete_phase3_marketplace.sql'
def env():
    out={}
    for raw in (ROOT/'supabase.env').read_text(encoding='utf-8-sig').splitlines():
        if raw.strip() and not raw.lstrip().startswith('#') and '=' in raw:
            key,value=raw.split('=',1);out[key.strip()]=value.strip().strip('"').strip("'")
    return out
def query(endpoint,token,sql):
    req=urllib.request.Request(endpoint,data=json.dumps({'query':sql}).encode(),headers={'Authorization':'Bearer '+token,'Content-Type':'application/json','Accept':'application/json','User-Agent':'SutiApp-Phase3/1.0'},method='POST')
    try:
        with urllib.request.urlopen(req,timeout=120) as response:
            raw=response.read();return json.loads(raw) if raw else None
    except urllib.error.HTTPError as error:
        detail=error.read(1200).decode('utf-8','replace');raise RuntimeError(f'Phase 3 database request failed HTTP {error.code}: {detail}') from None
def main():
    values=env();ref=urllib.parse.urlsplit(values['SUPABASE_URL']).hostname.split('.')[0];endpoint=f'https://api.supabase.com/v1/projects/{ref}/database/query';token=values['SUPABASE_ACCESS_TOKEN']
    applied=query(endpoint,token,"select to_regclass('public.marketplace_products') is not null as applied")[0]['applied']
    if not applied:query(endpoint,token,MIGRATION.read_text(encoding='utf-8'))
    uniqueness=query(endpoint,token,"select to_regclass('public.marketplace_products_historical_source_idx') is not null as applied")[0]['applied']
    if not uniqueness:query(endpoint,token,(ROOT/'supabase/migrations/20260821000901_fix_phase3_admin_uniqueness.sql').read_text(encoding='utf-8'))
    hardened=query(endpoint,token,"select to_regprocedure('public.mark_marketplace_quote_seen(uuid)') is not null as applied")[0]['applied']
    if not hardened:query(endpoint,token,(ROOT/'supabase/migrations/20260821000902_harden_phase3_request_boundary.sql').read_text(encoding='utf-8'))
    row=query(endpoint,token,"""
      select
        (select count(*) from public.marketplace_categories) categories,
        (select count(*) from public.marketplace_products) products,
        (select count(*) from public.marketplace_quote_requests) quotes,
        (select count(*) from public.marketplace_benefit_requests) requests,
        (select count(*) from public.marketplace_company_memberships) memberships,
        (select count(*) from public.admin_assignments where enabled and permissions @> array['marketplace.read','marketplace.write','marketplace.quotes.read','marketplace.quotes.write']) enabled_admins,
        (select bool_and(c.relrowsecurity and c.relforcerowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('marketplace_categories','marketplace_products','marketplace_product_assets','marketplace_promotions','marketplace_favorites','marketplace_company_favorites','marketplace_quote_requests','marketplace_benefit_requests','marketplace_company_memberships')) rls_forced
    """)[0]
    expected={'categories':3,'products':0,'quotes':0,'requests':0,'memberships':0,'enabled_admins':1}
    if any(int(row[key])!=value for key,value in expected.items()) or not row['rls_forced']:raise RuntimeError('Phase 3 reconciliation failed')
    print(json.dumps({'status':'PASS',**expected,'rls_forced':True,'migrations':['20260821000900','20260821000901','20260821000902']},sort_keys=True))
if __name__=='__main__':main()
