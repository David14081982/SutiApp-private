#!/usr/bin/env python3
"""Atomically dry-run or apply the Noticias section-ownership pilot."""
import argparse
import json
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
MIGRATIONS=[
    ROOT/'supabase/migrations/20260823000400_granular_section_capability_foundation.sql',
    ROOT/'supabase/migrations/20260823000500_enforce_news_section_ownership.sql',
]
RECOVERIES=[
    ROOT/'supabase/recovery/20260823000500_enforce_news_section_ownership_recovery.sql',
    ROOT/'supabase/recovery/20260823000400_granular_section_capability_foundation_recovery.sql',
]

def env():
    values={}
    for raw in (ROOT/'supabase.env').read_text(encoding='utf-8-sig').splitlines():
        if raw.strip() and not raw.lstrip().startswith('#') and '=' in raw:
            key,value=raw.split('=',1);values[key.strip()]=value.strip().strip('"').strip("'")
    return values

def body(path):
    sql=path.read_text(encoding='utf-8').strip()
    if not sql.lower().startswith('begin;') or not sql.lower().endswith('commit;'):
        raise RuntimeError('TRANSACTION_BOUNDARY_REQUIRED:'+path.name)
    return sql[len('begin;'):-len('commit;')]

def query(endpoint,token,sql):
    request=urllib.request.Request(endpoint,data=json.dumps({'query':sql}).encode(),headers={
        'Authorization':'Bearer '+token,'Content-Type':'application/json','Accept':'application/json',
        'User-Agent':'SutiApp-NewsOwnershipApply/1.0'},method='POST')
    try:
        with urllib.request.urlopen(request,timeout=180) as response:
            raw=response.read();return json.loads(raw) if raw else None
    except urllib.error.HTTPError as error:
        detail=error.read(1600).decode('utf-8','replace')
        raise RuntimeError(f'Database request failed HTTP {error.code}: {detail}') from None

def assertions():
    return """
do $$ begin
  if (select count(*) from public.admin_section_definitions)<>10 then raise exception 'SECTION_COUNT_MISMATCH'; end if;
  if (select count(*) from public.admin_section_definitions where enforcement_status='ENFORCED')<>1
     or not exists(select 1 from public.admin_section_definitions where section_key='news' and enforcement_status='ENFORCED') then raise exception 'PILOT_STATE_MISMATCH'; end if;
  if exists(select 1 from public.admin_section_definitions where section_key<>'news' and enforcement_status<>'DESIGN_ONLY') then raise exception 'NON_PILOT_SECTION_ENABLED'; end if;
  if (select count(*) from pg_policies where schemaname='public' and tablename='news_articles'
       and policyname in('news_admin_read','news_admin_insert','news_admin_update','news_admin_delete'))<>4 then raise exception 'NEWS_POLICY_MISMATCH'; end if;
  if exists(select 1 from pg_policies where schemaname='public' and tablename='news_articles' and policyname='news_admin_write') then raise exception 'BROAD_NEWS_POLICY_REMAINS'; end if;
  if (select count(*) from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'news_section_storage_%')<>3 then raise exception 'NEWS_STORAGE_POLICY_MISMATCH'; end if;
  if not exists(select 1 from pg_trigger where tgrelid='public.news_articles'::regclass and tgname='news_articles_action_guard' and tgenabled='O') then raise exception 'NEWS_GUARD_MISSING'; end if;
  if (select count(*) from public.admin_section_responsibilities)<>0 then raise exception 'UNEXPECTED_INITIAL_ASSIGNMENTS'; end if;
end $$;
"""

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--dry-run',action='store_true');args=parser.parse_args()
    values=env();ref=urllib.parse.urlsplit(values['SUPABASE_URL']).hostname.split('.')[0]
    endpoint=f'https://api.supabase.com/v1/projects/{ref}/database/query'
    migration_sql='\n'.join(body(path) for path in MIGRATIONS)
    sql='begin;\n'+migration_sql+'\n'+assertions()
    if args.dry_run:
        sql+='\n'+'\n'.join(body(path) for path in RECOVERIES)+"""
do $$ begin
  if to_regclass('public.admin_section_definitions') is not null
     or to_regclass('public.admin_section_responsibilities') is not null then raise exception 'FOUNDATION_RECOVERY_RESIDUE'; end if;
  if exists(select 1 from pg_policies where schemaname='public' and tablename='news_articles'
      and policyname in('news_admin_insert','news_admin_update','news_admin_delete')) then raise exception 'ENFORCEMENT_RECOVERY_RESIDUE'; end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='news_articles' and policyname='news_admin_write') then raise exception 'ORIGINAL_NEWS_POLICY_NOT_RESTORED'; end if;
end $$;
rollback;
"""
    else: sql+='\ncommit;'
    query(endpoint,values['SUPABASE_ACCESS_TOKEN'],sql)
    print(json.dumps({'status':'PASS','mode':'DRY_RUN' if args.dry_run else 'APPLY','atomic':True,
      'foundation':True,'pilot_section':'news','persistent_writes':0 if args.dry_run else 'SCHEMA_ONLY',
      'credentials_exposed':False},sort_keys=True))

if __name__=='__main__':main()
