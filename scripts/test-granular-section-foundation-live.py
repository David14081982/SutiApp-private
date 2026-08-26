#!/usr/bin/env python3
"""Compile migration + recovery against live schema in one rolled-back transaction."""
import json
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / 'supabase/migrations/20260823000400_granular_section_capability_foundation.sql'
RECOVERY = ROOT / 'supabase/recovery/20260823000400_granular_section_capability_foundation_recovery.sql'


def load_env():
    values = {}
    for raw in (ROOT / 'supabase.env').read_text(encoding='utf-8-sig').splitlines():
        if raw.strip() and not raw.lstrip().startswith('#') and '=' in raw:
            key, value = raw.split('=', 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def body(path):
    sql = path.read_text(encoding='utf-8').strip()
    if not sql.lower().startswith('begin;') or not sql.lower().endswith('commit;'):
        raise RuntimeError('TRANSACTION_BOUNDARY_REQUIRED: ' + path.name)
    return sql[len('begin;'):-len('commit;')]


def main():
    values = load_env()
    ref = urllib.parse.urlsplit(values['SUPABASE_URL']).hostname.split('.')[0]
    endpoint = f'https://api.supabase.com/v1/projects/{ref}/database/query'
    migration = body(MIGRATION)
    recovery = body(RECOVERY)
    sql = f"""
begin;
{migration}
do $$
begin
  if (select count(*) from public.admin_section_definitions) <> 10 then
    raise exception 'SECTION_COUNT_MISMATCH';
  end if;
  if exists(select 1 from public.admin_section_definitions where enforcement_status <> 'DESIGN_ONLY') then
    raise exception 'SECTION_NOT_FAIL_CLOSED';
  end if;
  if (select count(*) from public.admin_section_responsibilities) <> 0 then
    raise exception 'UNEXPECTED_ASSIGNMENTS';
  end if;
  if (select count(*) from pg_policies where schemaname='public'
      and tablename in ('admin_section_definitions','admin_section_responsibilities')) <> 2 then
    raise exception 'FOUNDATION_POLICY_MISMATCH';
  end if;
  if exists(select 1 from information_schema.role_table_grants
      where table_schema='public'
        and table_name in ('admin_section_definitions','admin_section_responsibilities')
        and grantee in ('anon','authenticated') and privilege_type in ('INSERT','UPDATE','DELETE')) then
    raise exception 'DIRECT_WRITE_GRANT_DETECTED';
  end if;
end $$;
{recovery}
do $$
begin
  if to_regclass('public.admin_section_definitions') is not null
     or to_regclass('public.admin_section_responsibilities') is not null then
    raise exception 'RECOVERY_TABLE_RESIDUE';
  end if;
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname in (
        'has_section_action','get_admin_access_context',
        'set_section_responsibilities','revoke_section_responsibilities')) then
    raise exception 'RECOVERY_FUNCTION_RESIDUE';
  end if;
end $$;
rollback;
"""
    request = urllib.request.Request(
        endpoint,
        data=json.dumps({'query': sql}).encode(),
        headers={
            'Authorization': 'Bearer ' + values['SUPABASE_ACCESS_TOKEN'],
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'SutiApp-GranularFoundationTest/1.0',
        },
        method='POST',
    )
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            response.read()
    except urllib.error.HTTPError as error:
        detail = error.read(1600).decode('utf-8', 'replace')
        raise RuntimeError(f'Database request failed HTTP {error.code}: {detail}') from None
    print(json.dumps({
        'status': 'PASS',
        'migration_compiled': True,
        'recovery_compiled': True,
        'transaction_rolled_back': True,
        'persistent_writes': 0,
        'credentials_exposed': False,
    }, sort_keys=True))


if __name__ == '__main__':
    main()
