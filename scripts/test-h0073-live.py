#!/usr/bin/env python3
"""Read-only remote reconciliation and RLS checks for H-007.3."""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT_HASH = "41871AE58415B5654F37058BF361350E598B93DD8AFF9EF3BA07BC94ECA4718F"


def env_file() -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in (ROOT / "supabase.env").read_text(encoding="utf-8-sig").splitlines():
        if raw.strip() and not raw.lstrip().startswith("#") and "=" in raw:
            key, value = raw.split("=", 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def request(url: str, key: str, method: str = "GET", body: bytes | None = None,
            bearer: bool = False) -> tuple[int, bytes]:
    headers = {"Accept": "application/json", "User-Agent": "SutiApp-H0073-Live/1.0"}
    headers["Authorization" if bearer else "apikey"] = ("Bearer " + key) if bearer else key
    if body is not None:
        headers["Content-Type"] = "application/json"
    try:
        with urllib.request.urlopen(urllib.request.Request(url, data=body, headers=headers, method=method), timeout=60) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as error:
        return error.code, error.read()


def rows(base: str, key: str, path: str) -> list[dict[str, object]]:
    status, raw = request(base.rstrip("/") + "/rest/v1/" + path, key)
    if status != 200:
        raise RuntimeError(f"REST read failed: HTTP {status}")
    return json.loads(raw)


def main() -> int:
    env = env_file()
    base = env["SUPABASE_URL"]
    public = env["SUPABASE_PUBLISHABLE_KEY"]
    token = env["SUPABASE_ACCESS_TOKEN"]
    ref = urllib.parse.urlsplit(base).hostname.split(".")[0]
    sql = f"""
      select
        (select count(*) from public.companies where source_snapshot_hash = '{SNAPSHOT_HASH}') companies,
        (select count(*) from public.company_assets ca join public.companies c on c.id=ca.company_id where c.source_snapshot_hash = '{SNAPSHOT_HASH}') links,
        (select count(*) from public.company_assets ca join public.companies c on c.id=ca.company_id where c.source_snapshot_hash = '{SNAPSHOT_HASH}' and ca.role='cover') covers,
        (select count(*) from public.company_assets ca join public.companies c on c.id=ca.company_id where c.source_snapshot_hash = '{SNAPSHOT_HASH}' and ca.role='gallery') gallery,
        (select count(*) from public.popups where enabled) enabled_popups,
        (select count(*) from auth.users) auth_users,
        (select count(*) from pg_class where oid in ('public.companies'::regclass,'public.company_assets'::regclass,'public.popups'::regclass) and relrowsecurity and relforcerowsecurity) forced_rls,
        (select count(*) from information_schema.role_table_grants where table_schema='public' and table_name in ('companies','company_assets','popups') and grantee in ('anon','authenticated') and privilege_type in ('INSERT','UPDATE','DELETE')) client_write_grants
    """
    status, raw = request(f"https://api.supabase.com/v1/projects/{ref}/database/query", token, "POST", json.dumps({"query": sql}).encode(), True)
    if status != 201:
        raise RuntimeError(f"Metadata query failed: HTTP {status}")
    metadata = json.loads(raw)[0]
    # H-009 subsequently enabled the two approved historical popups.
    expected = {"companies": 33, "links": 35, "covers": 33, "gallery": 2, "enabled_popups": 2, "auth_users": 3, "forced_rls": 3, "client_write_grants": 3}
    for name, value in expected.items():
        if int(metadata[name]) != value:
            raise RuntimeError(f"{name} mismatch: {metadata[name]}/{value}")

    public_companies = rows(base, public, "companies?select=id,display_name,description,sort_order,company_assets(role,sort_order,asset:app_assets!asset_id(id,storage_bucket,storage_path,status))&order=sort_order.asc&limit=100")
    public_popups = rows(base, public, "popups?select=id&limit=10")
    if len(public_companies) != 33 or len(public_popups) != 2:
        raise RuntimeError("Public RLS projection mismatch")
    if any(len(company.get("company_assets") or []) < 1 for company in public_companies):
        raise RuntimeError("Company without a public Storage asset link")
    if any(asset["asset"]["storage_bucket"] != "company-assets" for company in public_companies for asset in company["company_assets"]):
        raise RuntimeError("Company relation escaped company-assets bucket")
    print(json.dumps({"status": "PASS", "snapshot_hash": SNAPSHOT_HASH, **metadata,
                      "public_companies": len(public_companies), "public_popups": len(public_popups),
                      "repository_relation_query": "PASS"}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
