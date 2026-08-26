#!/usr/bin/env python3
"""Read-only remote reconciliation/security verification for icon and installation settings."""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT_HASH = "62C384D8E78D02181CCC52D22F812EF612A193D74B7784182EEBB8126A8473D4"


def env_file() -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in (ROOT / "supabase.env").read_text(encoding="utf-8-sig").splitlines():
        if raw.strip() and not raw.lstrip().startswith("#") and "=" in raw:
            key, value = raw.split("=", 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def request(url: str, key: str, method: str = "GET", body: bytes | None = None,
            bearer: bool = False) -> tuple[int, bytes]:
    headers = {"Accept": "application/json", "User-Agent": "SutiApp-IconInstall-Live/1.0"}
    headers["Authorization" if bearer else "apikey"] = ("Bearer " + key) if bearer else key
    if body is not None:
        headers["Content-Type"] = "application/json"
    try:
        with urllib.request.urlopen(urllib.request.Request(url, data=body, headers=headers, method=method), timeout=60) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as error:
        return error.code, error.read()


def main() -> int:
    env = env_file()
    base = env["SUPABASE_URL"].rstrip("/")
    public = env["SUPABASE_PUBLISHABLE_KEY"]
    token = env["SUPABASE_ACCESS_TOKEN"]
    ref = urllib.parse.urlsplit(base).hostname.split(".")[0]
    sql = f"""
      select
        (select count(*) from public.app_settings) settings_rows,
        (select count(*) from public.app_settings where source_snapshot_hash='{SNAPSHOT_HASH}') matching_snapshot,
        (select count(*) from public.app_assets where asset_key='brand.institutional-seal' and status='READY') seal_assets,
        (select count(*) from public.app_settings where install_screen_1_asset_id is null and install_screen_2_asset_id is null and install_screen_3_asset_id is null) empty_install_positions,
        (select count(*) from auth.users) auth_users,
        (select count(*) from pg_class where oid='public.app_settings'::regclass and relrowsecurity and relforcerowsecurity) forced_rls,
        (select count(*) from information_schema.role_table_grants where table_schema='public' and table_name='app_settings' and grantee in ('anon','authenticated') and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE','TRIGGER','REFERENCES')) client_write_grants,
        (select count(*) from pg_policies where schemaname='public' and tablename='app_settings' and cmd in ('INSERT','UPDATE','DELETE','ALL')) client_write_policies,
        (select count(*) from pg_policies where schemaname='public' and tablename='app_settings' and policyname='app_settings_public_read' and cmd='SELECT') public_read_policy,
        (select count(*) from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'h0072%' and cmd in ('INSERT','UPDATE','DELETE','ALL')) storage_write_policies
    """
    status, raw = request(f"https://api.supabase.com/v1/projects/{ref}/database/query", token, "POST", json.dumps({"query": sql}).encode(), True)
    if status != 201:
        raise RuntimeError(f"Metadata query failed: HTTP {status}")
    metadata = json.loads(raw)[0]
    print(json.dumps({"icon_metadata": metadata}, sort_keys=True))
    expected = {"settings_rows": 1, "matching_snapshot": 1, "seal_assets": 1,
                "empty_install_positions": 1, "auth_users": 3, "forced_rls": 1,
                "client_write_grants": 0, "client_write_policies": 1,
                "public_read_policy": 1, "storage_write_policies": 0}
    for name, value in expected.items():
        if int(metadata[name]) != value:
            raise RuntimeError(f"{name} mismatch: {metadata[name]}/{value}")

    fields = "id,app_name,short_name,description,app_icon_asset:app_assets!app_settings_app_icon_asset_id_fkey(asset_key,storage_bucket,storage_path,status),institutional_seal_asset:app_assets!app_settings_institutional_seal_asset_id_fkey(asset_key,storage_bucket,storage_path,status),install_screen_1_asset:app_assets!app_settings_install_screen_1_asset_id_fkey(asset_key,storage_bucket,storage_path,status),install_screen_2_asset:app_assets!app_settings_install_screen_2_asset_id_fkey(asset_key,storage_bucket,storage_path,status),install_screen_3_asset:app_assets!app_settings_install_screen_3_asset_id_fkey(asset_key,storage_bucket,storage_path,status)"
    encoded = urllib.parse.quote(fields, safe=",():!_")
    status, raw = request(f"{base}/rest/v1/app_settings?select={encoded}&id=eq.primary", public)
    if status != 200:
        raise RuntimeError(f"Public repository query failed: HTTP {status}")
    rows = json.loads(raw)
    if len(rows) != 1 or not rows[0]["app_icon_asset"] or not rows[0]["institutional_seal_asset"]:
        raise RuntimeError("Public branding projection mismatch")
    if any(rows[0][f"install_screen_{index}_asset"] is not None for index in (1, 2, 3)):
        raise RuntimeError("An install screen was invented")

    print(json.dumps({"status": "PASS", **metadata, "repository_relation_query": "PASS",
                      "install_positions": [None, None, None], "browser_writes_configured": False}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
