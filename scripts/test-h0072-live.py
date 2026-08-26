#!/usr/bin/env python3
"""Read-only/live security verification for H-007.2 Supabase content and Storage."""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT_HASH = "A677797640D181E42770204A5E1249D77CE6270989AEFCD8FC25644188ED56D3"


def env_file() -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in (ROOT / "supabase.env").read_text(encoding="utf-8-sig").splitlines():
        if raw.strip() and not raw.lstrip().startswith("#") and "=" in raw:
            key, value = raw.split("=", 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def request(url: str, key: str, method: str = "GET", body: bytes | None = None,
            bearer: bool = False, content_type: str = "application/json") -> tuple[int, bytes]:
    headers = {"Accept": "application/json", "User-Agent": "SutiApp-H0072-Live/1.0"}
    headers["Authorization" if bearer else "apikey"] = ("Bearer " + key) if bearer else key
    if body is not None:
        headers["Content-Type"] = content_type
    try:
        with urllib.request.urlopen(urllib.request.Request(url, data=body, headers=headers, method=method), timeout=60) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as error:
        return error.code, error.read()


def rest(base: str, key: str, path: str) -> list[dict[str, object]]:
    status, raw = request(base.rstrip("/") + "/rest/v1/" + path, key)
    if status != 200:
        raise RuntimeError(f"REST read failed: HTTP {status}")
    return json.loads(raw)


def main() -> int:
    env = env_file()
    base = env["SUPABASE_URL"]
    secret = env["SUPABASE_SECRET_KEY"]
    public = env["SUPABASE_PUBLISHABLE_KEY"]
    ref = urllib.parse.urlsplit(base).hostname.split(".")[0]
    token = env["SUPABASE_ACCESS_TOKEN"]

    sql = """
      select
        (select count(*) from public.app_assets) assets,
        (select count(*) from public.asset_sources) sources,
        (select count(*) from public.banners) banners,
        (select count(*) from public.popups) popups,
        (select count(*) from public.companies) companies,
        (select count(*) from storage.objects where bucket_id in ('app-assets','company-assets','documents')) objects,
        (select count(*) from storage.buckets where id in ('app-assets','company-assets','documents') and public) public_buckets,
        (select count(*) from pg_class where oid in ('public.app_assets'::regclass,'public.asset_sources'::regclass,'public.companies'::regclass,'public.company_assets'::regclass,'public.banners'::regclass,'public.popups'::regclass) and relrowsecurity and relforcerowsecurity) forced_rls,
        (select count(*) from public.directory_members where image_asset_id is not null) directory_images,
        (select count(*) from public.minutes where document_asset_id is not null) minute_files,
        (select count(*) from public.institutional_documents where document_asset_id is not null) institutional_files,
        (select count(*) from public.institutional_programs where primary_image_asset_id is not null) program_images,
        (select count(*) from public.app_assets where asset_type = 'INSTITUTIONAL_IMAGE' and status = 'READY') institutional_images,
        (select count(*) from public.app_assets where asset_type = 'DOCUMENT' and status = 'READY') pdf_assets,
        (select count(*) from public.app_assets where asset_type = 'BRANDING' and status = 'READY') branding_assets,
        (select count(*) from storage.objects where bucket_id = 'app-assets') app_asset_objects,
        (select count(*) from storage.objects where bucket_id = 'company-assets') company_asset_objects,
        (select count(*) from storage.objects where bucket_id = 'documents') document_objects,
        (select count(*) from information_schema.role_table_grants where table_schema = 'public' and table_name in ('app_assets','asset_sources','companies','company_assets','banners','popups') and grantee in ('anon','authenticated') and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE','TRIGGER','REFERENCES')) client_write_grants,
        (select count(*) from pg_policies where schemaname = 'public' and tablename in ('app_assets','asset_sources','companies','company_assets','banners','popups') and cmd in ('INSERT','UPDATE','DELETE','ALL')) client_write_policies,
        (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'h0072_storage_public_read' and cmd = 'SELECT') storage_read_policies,
        (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'h0072%' and cmd in ('INSERT','UPDATE','DELETE','ALL')) storage_write_policies
    """
    body = json.dumps({"query": sql}, separators=(",", ":")).encode()
    status, raw = request(f"https://api.supabase.com/v1/projects/{ref}/database/query", token, "POST", body, bearer=True)
    if status != 201:
        raise RuntimeError(f"Metadata query failed: HTTP {status}")
    metadata = json.loads(raw)[0]
    print(json.dumps({"h0072_metadata": metadata}, sort_keys=True))
    # Cumulative authorized state after H-009 and MASTER ASSET EVACUATION.
    # Write grants/policies are admin-scoped and are exercised by H-009's
    # multi-user test; normal-user denial must not be inferred from a zero count.
    expected = {"assets": 154, "sources": 162, "banners": 23, "popups": 3, "companies": 33, "objects": 153, "public_buckets": 3, "forced_rls": 6, "client_write_grants": 7, "client_write_policies": 12, "storage_read_policies": 1, "storage_write_policies": 0}
    for name, value in expected.items():
        if int(metadata[name]) != value:
            raise RuntimeError(f"{name} mismatch: {metadata[name]}/{value}")
    for name in ("directory_images", "minute_files", "institutional_files", "program_images"):
        if int(metadata[name]) <= 0:
            raise RuntimeError(f"Missing institutional asset links: {name}")
    if int(metadata["pdf_assets"]) != int(metadata["document_objects"]):
        raise RuntimeError("PDF registry/object count mismatch")

    public_assets = rest(base, public, "app_assets?select=id,asset_key,status&limit=1000")
    public_banners = rest(base, public, "banners?select=id,placement,enabled&order=sort_order.asc&limit=1000")
    public_popups = rest(base, public, "popups?select=id&limit=1000")
    if len(public_assets) != 154 or len(public_banners) != 10 or len(public_popups) != 2:
        raise RuntimeError("Public RLS projection mismatch")
    if any(row["placement"] != "home" or not row["enabled"] for row in public_banners):
        raise RuntimeError("Disabled/non-home banner leaked through RLS")

    select = urllib.parse.quote("id,title,description,sort_order,image_asset:app_assets!image_asset_id(id,asset_key,storage_bucket,storage_path,mime_type,alt_text,status)", safe=",():!_")
    status, _ = request(base.rstrip("/") + f"/rest/v1/banners?select={select}&placement=eq.home&enabled=eq.true&limit=1", public)
    if status != 200:
        raise RuntimeError(f"Repository relation query failed: HTTP {status}")

    repository_selects = {
        "directory_members": "id,name,role,sort_order,source_row_ordinal,image_asset:app_assets!image_asset_id(id,asset_key,storage_bucket,storage_path,mime_type,alt_text,status)",
        "minutes": "id,title,description,source_date_raw,published_on,sort_order,source_row_ordinal,image_asset:app_assets!minutes_image_asset_id_fkey(id,asset_key,storage_bucket,storage_path,mime_type,alt_text,status),document_asset:app_assets!minutes_document_asset_id_fkey(id,asset_key,storage_bucket,storage_path,mime_type,alt_text,status)",
        "institutional_documents": "id,kind,title,description,sort_order,source_sheet,source_row_ordinal,image_asset:app_assets!institutional_documents_image_asset_id_fkey(id,asset_key,storage_bucket,storage_path,mime_type,alt_text,status),document_asset:app_assets!institutional_documents_document_asset_id_fkey(id,asset_key,storage_bucket,storage_path,mime_type,alt_text,status)",
        "institutional_programs": "id,category,description,sort_order,source_row_ordinal,primary_image_asset:app_assets!primary_image_asset_id(id,asset_key,storage_bucket,storage_path,mime_type,alt_text,status)",
    }
    for table, fields in repository_selects.items():
        encoded = urllib.parse.quote(fields, safe=",():!_")
        status, _ = request(base.rstrip("/") + f"/rest/v1/{table}?select={encoded}&limit=1", public)
        if status != 200:
            raise RuntimeError(f"{table} asset relation query failed: HTTP {status}")

    denied_status, _ = request(base.rstrip("/") + "/rest/v1/asset_sources?select=id&limit=1", public)
    if denied_status not in (401, 403):
        raise RuntimeError("asset_sources provenance is browser-readable")
    print(json.dumps({
        "status": "PASS", "snapshot_hash": SNAPSHOT_HASH, **metadata,
        "public_assets": len(public_assets), "public_home_banners": len(public_banners),
        "public_popups": len(public_popups), "asset_sources_denied": True,
        "client_table_writes_configured": False, "client_storage_writes_configured": False,
        "repository_relation_queries": len(repository_selects) + 1,
    }, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
