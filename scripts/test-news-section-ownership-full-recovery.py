#!/usr/bin/env python3
"""Validate the complete Noticias pilot recovery chain without persisting changes."""
import json
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RECOVERIES = [
    ROOT / 'supabase/recovery/20260823000502_fix_news_resolution_and_service_boundary_recovery.sql',
    ROOT / 'supabase/recovery/20260823000501_fix_news_responsibility_rpc_types_recovery.sql',
    ROOT / 'supabase/recovery/20260823000500_enforce_news_section_ownership_recovery.sql',
    ROOT / 'supabase/recovery/20260823000400_granular_section_capability_foundation_recovery.sql',
]


def env():
    values = {}
    for raw in (ROOT / 'supabase.env').read_text(encoding='utf-8-sig').splitlines():
        if raw.strip() and not raw.lstrip().startswith('#') and '=' in raw:
            key, value = raw.split('=', 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def body(path):
    sql = path.read_text(encoding='utf-8').strip()
    if not sql.lower().startswith('begin;') or not sql.lower().endswith('commit;'):
        raise RuntimeError('TRANSACTION_BOUNDARY_REQUIRED:' + path.name)
    return sql[len('begin;'):-len('commit;')]


def main():
    values = env()
    project_ref = urllib.parse.urlsplit(values['SUPABASE_URL']).hostname.split('.')[0]
    endpoint = f'https://api.supabase.com/v1/projects/{project_ref}/database/query'
    sql = 'begin;\n' + '\n'.join(body(path) for path in RECOVERIES) + """
do $$ begin
  if to_regclass('public.admin_section_definitions') is not null
     or to_regclass('public.admin_section_responsibilities') is not null
     or to_regclass('public.admin_section_responsibility_audit') is not null then
    raise exception 'FOUNDATION_RECOVERY_RESIDUE';
  end if;
  if exists(select 1 from pg_trigger where tgrelid='public.news_articles'::regclass
      and tgname in ('news_articles_action_guard','news_articles_section_action_audit')) then
    raise exception 'NEWS_TRIGGER_RECOVERY_RESIDUE';
  end if;
  if exists(select 1 from pg_policies where schemaname='public' and tablename='news_articles'
      and policyname in ('news_admin_insert','news_admin_update','news_admin_delete')) then
    raise exception 'GRANULAR_NEWS_POLICY_RECOVERY_RESIDUE';
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='news_articles'
      and policyname='news_admin_write') then
    raise exception 'ORIGINAL_NEWS_POLICY_NOT_RESTORED';
  end if;
  if exists(select 1 from pg_policies where schemaname='storage' and tablename='objects'
      and policyname like 'news_section_storage_%') then
    raise exception 'NEWS_STORAGE_RECOVERY_RESIDUE';
  end if;
end $$;
rollback;
"""
    request = urllib.request.Request(endpoint, data=json.dumps({'query': sql}).encode(), headers={
        'Authorization': 'Bearer ' + values['SUPABASE_ACCESS_TOKEN'],
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'SutiApp-NewsOwnershipRecoveryTest/1.0',
    }, method='POST')
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            response.read()
    except urllib.error.HTTPError as error:
        detail = error.read(1600).decode('utf-8', 'replace')
        raise RuntimeError(f'RECOVERY_TEST_HTTP_{error.code}:{detail}') from None
    print(json.dumps({'status': 'PASS', 'full_recovery_chain': True,
                      'persistent_writes': 0, 'credentials_exposed': False}, sort_keys=True))


if __name__ == '__main__':
    main()
