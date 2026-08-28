#!/usr/bin/env python3
"""Compile/apply the Admin Affiliates boundary without exposing credentials."""
from __future__ import annotations

import argparse
import json
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "supabase/migrations/20260827001200_admin_affiliates_workbench.sql"
RECOVERY = ROOT / "supabase/recovery/20260827001200_admin_affiliates_workbench_recovery.sql"


def load_env() -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in (ROOT / "supabase.env").read_text(encoding="utf-8-sig").splitlines():
        if raw.strip() and not raw.lstrip().startswith("#") and "=" in raw:
            key, value = raw.split("=", 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def transaction_body(path: Path) -> str:
    sql = path.read_text(encoding="utf-8").strip()
    if not sql.lower().startswith("begin;") or not sql.lower().endswith("commit;"):
        raise RuntimeError("TRANSACTION_BOUNDARY_REQUIRED: " + path.name)
    return sql[len("begin;") : -len("commit;")]


def query(values: dict[str, str], sql: str) -> object:
    ref = urllib.parse.urlsplit(values["SUPABASE_URL"]).hostname.split(".")[0]
    request = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{ref}/database/query",
        data=json.dumps({"query": sql}).encode(),
        headers={
            "Authorization": "Bearer " + values["SUPABASE_ACCESS_TOKEN"],
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "SutiApp-Admin-Affiliates-Test/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            raw = response.read()
    except urllib.error.HTTPError as error:
        detail = error.read(2000).decode("utf-8", "replace")
        raise RuntimeError(f"Database request failed HTTP {error.code}: {detail}") from None
    return json.loads(raw) if raw else []


def checks() -> str:
    return r"""
do $$
begin
  if (select count(*) from public.affiliates)<>947 then raise exception 'AFFILIATE_COUNT_CHANGED'; end if;
  if (select count(*) from public.affiliates where record_origin='HISTORICAL_IMPORT')<>947 then raise exception 'HISTORICAL_ORIGIN_CHANGED'; end if;
  if exists(select 1 from public.affiliates where record_origin='HISTORICAL_IMPORT' and (source_file_hash is null or source_row_ordinal is null)) then raise exception 'HISTORICAL_PROVENANCE_LOST'; end if;
  if exists(select 1 from public.affiliates where record_origin='ADMIN_AFFILIATES') then raise exception 'UNEXPECTED_ADMIN_AFFILIATE'; end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('list_admin_affiliates','find_admin_affiliate_duplicates','get_admin_affiliate_workbench','create_admin_affiliate','update_admin_affiliate','change_admin_affiliate_status'))<>6 then raise exception 'RPC_COUNT_MISMATCH'; end if;
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='affiliate_admin_events' and c.relrowsecurity and c.relforcerowsecurity) then raise exception 'AUDIT_RLS_NOT_FORCED'; end if;
  if exists(select 1 from information_schema.role_table_grants where table_schema='public' and table_name='affiliate_admin_events' and grantee in('anon','authenticated') and privilege_type in('INSERT','UPDATE','DELETE')) then raise exception 'AUDIT_DIRECT_WRITE_GRANT'; end if;
  if has_function_privilege('anon',to_regprocedure('public.list_admin_affiliates(text,text,boolean,text,boolean,text,text,integer,integer,text)'),'EXECUTE') then raise exception 'ANON_RPC_EXECUTE'; end if;
end $$;
"""


def status(values: dict[str, str]) -> dict[str, object]:
    return query(values, """
      select json_build_object(
        'applied',exists(select 1 from information_schema.columns where table_schema='public' and table_name='affiliates' and column_name='record_origin'),
        'affiliates',(select count(*) from public.affiliates),
        'auth_users',(select count(*) from auth.users),
        'admin_rows',(select count(*) from public.affiliates a where to_jsonb(a)->>'record_origin'='ADMIN_AFFILIATES')
      ) result;
    """)[0]["result"]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    values = load_env()
    before = status(values)
    if args.apply:
        if not before["applied"]:
            query(values, MIGRATION.read_text(encoding="utf-8"))
        query(values, "begin;" + checks() + "rollback;")
        after = status(values)
        if not after["applied"] or after["affiliates"] != before["affiliates"] or after["auth_users"] != before["auth_users"] or after["admin_rows"] != 0:
            raise RuntimeError("APPLY_RECONCILIATION_FAILED: " + json.dumps({"before": before, "after": after}))
        print(json.dumps({"status": "PASS", "mode": "APPLY", "before": before, "after": after, "business_rows_changed": 0, "credentials_exposed": False}, sort_keys=True))
        return 0
    sql = "begin;" + transaction_body(MIGRATION) + checks() + transaction_body(RECOVERY) + "rollback;"
    query(values, sql)
    after = status(values)
    if before != after:
        raise RuntimeError("DRY_RUN_PERSISTED_CHANGE")
    print(json.dumps({"status": "PASS", "mode": "DRY_RUN", "migration_compiled": True, "recovery_compiled": True, "before": before, "after": after, "persistent_writes": 0, "credentials_exposed": False}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
