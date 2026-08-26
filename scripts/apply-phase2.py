#!/usr/bin/env python3
"""Apply and reconcile the owner-authorized empty Phase 2 content authority."""
import json, urllib.error, urllib.parse, urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
MIGRATION=ROOT/'supabase/migrations/20260821000800_complete_phase2_content.sql'
def env():
    out={}
    for raw in (ROOT/'supabase.env').read_text(encoding='utf-8-sig').splitlines():
        if raw.strip() and not raw.lstrip().startswith('#') and '=' in raw:
            key,value=raw.split('=',1);out[key.strip()]=value.strip().strip('"').strip("'")
    return out
def query(endpoint,token,sql):
    req=urllib.request.Request(endpoint,data=json.dumps({'query':sql}).encode(),headers={'Authorization':'Bearer '+token,'Content-Type':'application/json','Accept':'application/json','User-Agent':'SutiApp-Phase2/1.0'},method='POST')
    try:
        with urllib.request.urlopen(req,timeout=90) as response:
            raw=response.read();return json.loads(raw) if raw else None
    except urllib.error.HTTPError as error:
        detail=error.read(800).decode('utf-8','replace');raise RuntimeError(f'Phase 2 database request failed HTTP {error.code}: {detail}') from None
def main():
    values=env();ref=urllib.parse.urlsplit(values['SUPABASE_URL']).hostname.split('.')[0]
    endpoint=f'https://api.supabase.com/v1/projects/{ref}/database/query';token=values['SUPABASE_ACCESS_TOKEN']
    exists=query(endpoint,token,"select to_regclass('public.news_articles') is not null as applied")[0]['applied']
    if not exists:query(endpoint,token,MIGRATION.read_text(encoding='utf-8'))
    provenance=query(endpoint,token,"select exists(select 1 from information_schema.columns where table_schema='public' and table_name='educational_resources' and column_name='source_payload') as applied")[0]['applied']
    if not provenance:query(endpoint,token,(ROOT/'supabase/migrations/20260821000801_phase2_education_provenance.sql').read_text(encoding='utf-8'))
    row=query(endpoint,token,"""
      select
        (select count(*) from public.news_articles) news,
        (select count(*) from public.news_settings) news_settings,
        (select count(*) from public.educational_resources) education,
        (select count(*) from public.educational_resources where published) education_published,
        (select count(*) from public.managed_copy_overrides) copy,
        (select count(*) from public.admin_assignments where enabled and permissions @> array['news.read','news.write','content.read','content.write']) enabled_admins,
        (select bool_and(c.relrowsecurity and c.relforcerowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('news_articles','news_settings','educational_resources','managed_copy_overrides')) rls_forced
    """)[0]
    expected={'news':0,'news_settings':1,'education':32,'education_published':0,'copy':0,'enabled_admins':1}
    if any(int(row[key])!=value for key,value in expected.items()) or not row['rls_forced']:
        raise RuntimeError('Phase 2 empty-authority reconciliation failed')
    print(json.dumps({'status':'PASS','news':0,'education':32,'education_published':0,'copy':0,'enabled_admins':1,'rls_forced':True,'migration':'20260821000800/801'},sort_keys=True))
if __name__=='__main__':main()
