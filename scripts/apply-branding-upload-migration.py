#!/usr/bin/env python3
"""Apply or inspect the allowlisted transactional branding RPC migration."""

from __future__ import annotations

import argparse
import json
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "supabase/migrations/20260827001100_transactional_branding_asset_registration.sql"


def env_file() -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in (ROOT / "supabase.env").read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def query(env: dict[str, str], sql: str) -> object:
    project = urllib.parse.urlsplit(env["SUPABASE_URL"]).hostname.split(".")[0]
    request = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{project}/database/query",
        data=json.dumps({"query": sql}).encode(),
        headers={
            "Authorization": "Bearer " + env["SUPABASE_ACCESS_TOKEN"],
            "Content-Type": "application/json",
            "User-Agent": "SutiApp-Branding-Migration/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            raw = response.read()
    except urllib.error.HTTPError as error:
        detail = error.read(800).decode("utf-8", "replace")
        raise RuntimeError(f"Migration request failed: HTTP {error.code} {detail}") from None
    return json.loads(raw) if raw else []


def status(env: dict[str, str]) -> dict[str, object]:
    rows = query(env, """
      select count(*)::integer function_count,
             coalesce(bool_and(p.prosecdef),false) security_definer,
             case when to_regprocedure('public.register_branding_assets(jsonb)') is null then false
               else has_function_privilege('authenticated',to_regprocedure('public.register_branding_assets(jsonb)'),'EXECUTE') end authenticated_execute,
             case when to_regprocedure('public.register_branding_assets(jsonb)') is null then false
               else has_function_privilege('anon',to_regprocedure('public.register_branding_assets(jsonb)'),'EXECUTE') end anonymous_execute
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='register_branding_assets';
    """)[0]
    return rows


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("apply", "status"))
    args = parser.parse_args()
    env = env_file()
    if args.mode == "apply":
        before = status(env)
        if before["function_count"] not in (0, 1):
            raise RuntimeError("Unexpected function count before apply")
        query(env, MIGRATION.read_text(encoding="utf-8"))
    after = status(env)
    expected = {
        "function_count": 1,
        "security_definer": True,
        "authenticated_execute": True,
        "anonymous_execute": False,
    }
    if after != expected:
        raise RuntimeError(f"Migration status mismatch: {after}")
    print(json.dumps({"status": "APPLIED" if args.mode == "apply" else "PASS", **after, "rows_changed": 0}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
