#!/usr/bin/env python3
"""Transactional dry run for the branding asset RPC and its recovery."""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FORWARD = ROOT / "supabase/migrations/20260827001100_transactional_branding_asset_registration.sql"
RECOVERY = ROOT / "supabase/recovery/20260827001100_transactional_branding_asset_registration_recovery.sql"


def env_file() -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in (ROOT / "supabase.env").read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def body(path: Path) -> str:
    return "\n".join(
        line for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip().lower() not in {"begin;", "commit;"}
    )


def main() -> int:
    env = env_file()
    project = urllib.parse.urlsplit(env["SUPABASE_URL"]).hostname.split(".")[0]
    sql = f"""
begin;
{body(FORWARD)}
do $$
begin
  if to_regprocedure('public.register_branding_assets(jsonb)') is null then
    raise exception 'forward function missing';
  end if;
  if has_function_privilege('anon','public.register_branding_assets(jsonb)','EXECUTE') then
    raise exception 'anonymous execute leaked';
  end if;
  if not has_function_privilege('authenticated','public.register_branding_assets(jsonb)','EXECUTE') then
    raise exception 'authenticated execute missing';
  end if;
  if not exists(
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='register_branding_assets'
      and p.prosecdef and 'search_path=\"\"' = any(p.proconfig)
  ) then
    raise exception 'security definer/search_path contract missing';
  end if;
end;
$$;
{body(RECOVERY)}
do $$
begin
  if to_regprocedure('public.register_branding_assets(jsonb)') is not null then
    raise exception 'recovery did not remove function';
  end if;
end;
$$;
rollback;
"""
    payload = json.dumps({"query": sql}).encode()
    request = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{project}/database/query",
        data=payload,
        headers={
            "Authorization": "Bearer " + env["SUPABASE_ACCESS_TOKEN"],
            "Content-Type": "application/json",
            "User-Agent": "SutiApp-Branding-Migration-DryRun/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            response.read()
    except urllib.error.HTTPError as error:
        detail = error.read(800).decode("utf-8", "replace")
        raise RuntimeError(f"Migration dry run failed: HTTP {error.code} {detail}") from None
    print(json.dumps({"status": "PASS", "forward": "ROLLBACK", "recovery": "ROLLBACK", "persistent_writes": 0}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
