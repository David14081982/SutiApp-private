#!/usr/bin/env python3
"""Apply and verify the owner-authorized H-009 migration without printing credentials."""
import json, urllib.error, urllib.parse, urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
def env():
    out={}
    for raw in (ROOT/'supabase.env').read_text(encoding='utf-8-sig').splitlines():
        if raw.strip() and not raw.lstrip().startswith('#') and '=' in raw:
            key,value=raw.split('=',1);out[key.strip()]=value.strip().strip('"').strip("'")
    return out
def query(endpoint,token,sql):
    request=urllib.request.Request(endpoint,data=json.dumps({'query':sql}).encode(),headers={'Authorization':'Bearer '+token,'Content-Type':'application/json','Accept':'application/json','User-Agent':'SutiApp-H009/1.0'},method='POST')
    try:
        with urllib.request.urlopen(request,timeout=90) as response:
            raw=response.read();return json.loads(raw) if raw else None
    except urllib.error.HTTPError as error:
        detail=error.read(800).decode('utf-8','replace');raise RuntimeError(f'H-009 database request failed HTTP {error.code}: {detail}') from None
def main():
    values=env();ref=urllib.parse.urlsplit(values['SUPABASE_URL']).hostname.split('.')[0]
    endpoint=f'https://api.supabase.com/v1/projects/{ref}/database/query';token=values['SUPABASE_ACCESS_TOKEN']
    exists=query(endpoint,token,"select exists(select 1 from information_schema.columns where table_schema='public' and table_name='companies' and column_name='record_origin') as applied")
    if not exists or not exists[0]['applied']:
        query(endpoint,token,(ROOT/'supabase/migrations/20260821000600_enable_visual_admin_crud.sql').read_text(encoding='utf-8'))
    checks=query(endpoint,token,"""
      select
        (select count(*) from public.companies) as companies,
        (select count(*) from public.banners) as banners,
        (select count(*) from public.popups) as popups,
        (select count(*) from public.institutional_documents) as documents,
        (select count(*) from public.companies where record_origin='HISTORICAL_IMPORT') as historical_companies,
        (select count(*) from public.banners where record_origin='HISTORICAL_IMPORT') as historical_banners,
        (select count(*) from public.popups where record_origin='HISTORICAL_IMPORT') as historical_popups,
        (select count(*) from public.institutional_documents where record_origin='HISTORICAL_IMPORT') as historical_documents,
        (select count(*) from public.admin_assignments where enabled) as enabled_admins,
        (select bool_and(c.relrowsecurity and c.relforcerowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('app_assets','app_settings','banners','popups','companies','company_assets','institutional_documents')) as rls_forced
    """)
    row=checks[0]
    expected={'companies':33,'banners':23,'popups':3,'documents':8,'historical_companies':33,'historical_banners':23,'historical_popups':3,'historical_documents':8,'enabled_admins':1}
    if any(int(row[key])!=value for key,value in expected.items()) or not row['rls_forced']:
        raise RuntimeError('H-009 migration reconciliation failed')
    print(json.dumps({'status':'PASS','historical_rows_preserved':67,'enabled_admins':1,'rls_forced':True,'migration':'20260821000600'},sort_keys=True))
if __name__=='__main__':main()
