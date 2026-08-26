#!/usr/bin/env python3
"""Read-only reconciliation and multi-user RLS test for MASTER ASSET EVACUATION."""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read_env() -> dict[str, str]:
    out = {}
    for raw in (ROOT / "supabase.env").read_text(encoding="utf-8-sig").splitlines():
        if raw.strip() and not raw.lstrip().startswith("#") and "=" in raw:
            key, value = raw.split("=", 1)
            out[key.strip()] = value.strip().strip('"').strip("'")
    return out


def call(url: str, key: str, method: str = "GET", body=None, token: str | None = None,
         expected: set[int] | None = None, accept: str = "application/json"):
    headers = {"apikey": key, "Accept": accept, "User-Agent": "SutiApp-MasterAssets-Test/1.0"}
    if token:
        headers["Authorization"] = "Bearer " + token
    if body is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(body).encode()
    try:
        with urllib.request.urlopen(urllib.request.Request(url, data=body, headers=headers, method=method), timeout=90) as response:
            raw = response.read()
            return response.status, (json.loads(raw) if accept == "application/json" and raw else raw), dict(response.headers.items())
    except urllib.error.HTTPError as error:
        if expected and error.code in expected:
            return error.code, None, dict(error.headers.items())
        raise RuntimeError(f"unexpected HTTP {error.code}: " + error.read(300).decode("utf-8", "replace")) from None


def login(base: str, key: str, email: str, password: str) -> str:
    _, data, _ = call(base + "/auth/v1/token?grant_type=password", key, "POST", {"email": email, "password": password})
    return data["access_token"]


def management_sql(env: dict[str, str], query: str):
    ref = urllib.parse.urlsplit(env["SUPABASE_URL"]).hostname.split(".")[0]
    token = env["SUPABASE_ACCESS_TOKEN"]
    payload = json.dumps({"query": query}).encode()
    request = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{ref}/database/query", data=payload,
        headers={"Authorization": "Bearer " + token, "apikey": token,
                 "Content-Type": "application/json", "User-Agent": "SutiApp-MasterAssets-Test/1.0"}, method="POST"
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        return json.loads(response.read())


def main() -> int:
    env = read_env()
    base = env["SUPABASE_URL"].rstrip("/")
    rest = base + "/rest/v1"
    public_key = env["SUPABASE_PUBLISHABLE_KEY"]
    catalog = json.loads((ROOT / "data/master-asset-column-catalog.json").read_text(encoding="utf-8"))
    expected_columns = len(catalog["columns"])
    expected_references = sum(row["urls_parsed"] for row in catalog["columns"])
    expected_affiliate_references = sum(row["urls_parsed"] for row in catalog["columns"] if row["source_system"] == "owner_master_excel")

    query = """
    select json_build_object(
      'columns',(select count(*) from public.historical_file_columns),
      'columns_reconciled',(select count(*) from public.historical_file_columns where status='RECONCILED'),
      'columns_failed',(select count(*) from public.historical_file_columns where status='FAILED'),
      'columns_partial',(select count(*) from public.historical_file_columns where status='PARTIAL'),
      'usuarios_columns',(select count(*) from public.historical_file_columns where source_system='owner_master_excel'),
      'sutiapp_columns',(select count(*) from public.historical_file_columns where source_system='google_sheets_export'),
      'references',(select count(*) from public.historical_asset_sources),
      'failed_references',(select count(*) from public.historical_asset_sources where migration_status='FAILED'),
      'linked_references',(select count(*) from public.historical_asset_sources where migration_status='LINKED'),
      'pending_domain',(select count(*) from public.historical_asset_sources where migration_status='PENDING_DOMAIN_LINK'),
      'pending_affiliate',(select count(*) from public.historical_asset_sources where migration_status='PENDING_AFFILIATE_LINK'),
      'public_references',(select count(*) from public.historical_asset_sources where classification='PUBLIC'),
      'private_references',(select count(*) from public.historical_asset_sources where classification='PRIVATE'),
      'provenance_urls',(select count(*) from public.historical_asset_sources where source_url is not null),
      'distinct_physical_assets',(select count(distinct coalesce('P:'||public_asset_id::text,'R:'||private_asset_id::text)) from public.historical_asset_sources where migration_status<>'FAILED'),
      'affiliate_files',(select count(*) from public.affiliate_files),
      'affiliate_distinct',(select count(distinct affiliate_id) from public.affiliate_files),
      'private_assets',(select count(*) from public.private_assets),
      'new_public_assets',(select count(*) from public.app_assets where asset_key like 'master.public.%'),
      'private_objects',(select count(*) from storage.objects where bucket_id='private-assets'),
      'public_objects',(select count(*) from storage.objects where bucket_id='public-assets'),
      'missing_private_objects',(select count(*) from public.private_assets a where not exists (
        select 1 from storage.objects o where o.bucket_id=a.storage_bucket and o.name=a.storage_path)),
      'missing_public_objects',(select count(*) from public.app_assets a where a.asset_key like 'master.public.%' and not exists (
        select 1 from storage.objects o where o.bucket_id=a.storage_bucket and o.name=a.storage_path)),
      'orphan_private_objects',(select count(*) from storage.objects o where o.bucket_id='private-assets' and not exists (
        select 1 from public.private_assets a where a.storage_bucket=o.bucket_id and a.storage_path=o.name)),
      'orphan_public_objects',(select count(*) from storage.objects o where o.bucket_id='public-assets' and not exists (
        select 1 from public.app_assets a where a.storage_bucket=o.bucket_id and a.storage_path=o.name)),
      'affiliates',(select count(*) from public.affiliates),
      'auth_users',(select count(*) from auth.users),
      'companies',(select count(*) from public.companies),
      'asset_sources',(select count(*) from public.asset_sources),
      'private_bucket_public',(select public from storage.buckets where id='private-assets'),
      'public_bucket_public',(select public from storage.buckets where id='public-assets')
    ) result;
    """
    aggregate = management_sql(env, query)[0]["result"]
    checks = {
        "columns": aggregate["columns"] == expected_columns == 163,
        "references": aggregate["references"] == expected_references == 25358,
        "affiliate_files": aggregate["affiliate_files"] == expected_affiliate_references == 12901,
        "failures": aggregate["failed_references"] == 3 and aggregate["columns_failed"] == 1 and aggregate["columns_partial"] == 0,
        "column_reconciliation": aggregate["columns_reconciled"] == 162,
        "storage_registry": aggregate["missing_private_objects"] == aggregate["missing_public_objects"] == 0,
        "storage_orphans": aggregate["orphan_private_objects"] == aggregate["orphan_public_objects"] == 0,
        "bucket_privacy": aggregate["private_bucket_public"] is False and aggregate["public_bucket_public"] is True,
        "protected": aggregate["affiliates"] == 947 and aggregate["auth_users"] == 3 and aggregate["companies"] == 33 and aggregate["asset_sources"] == 162,
        "provenance": aggregate["provenance_urls"] == aggregate["references"],
        "affiliate_resolution": aggregate["pending_affiliate"] == 0,
    }
    if not all(checks.values()):
        raise RuntimeError("aggregate reconciliation failed: " + json.dumps({"failed_checks": {k:v for k,v in checks.items() if not v}, "aggregate": aggregate}, sort_keys=True))

    admin = login(base, public_key, env["H005_TEST_EMAIL"], env["H005_TEST_PASSWORD"])
    normal2 = login(base, public_key, env["H005_TEST2_EMAIL"], env["H005_TEST2_PASSWORD"])
    normal3 = login(base, public_key, env["H005_TEST3_EMAIL"], env["H005_TEST3_PASSWORD"])

    _, admin_columns, _ = call(rest + "/historical_file_columns?select=id&limit=1", public_key, token=admin)
    _, admin_sources, _ = call(rest + "/historical_asset_sources?select=id&limit=1", public_key, token=admin)
    if not admin_columns or not admin_sources:
        raise RuntimeError("admin provenance read failed")
    for token in (normal2, normal3):
        _, hidden_columns, _ = call(rest + "/historical_file_columns?select=id&limit=1", public_key, token=token)
        _, hidden_sources, _ = call(rest + "/historical_asset_sources?select=id&limit=1", public_key, token=token)
        if hidden_columns or hidden_sources:
            raise RuntimeError("normal user can read administrative provenance")

    _, affiliate2, _ = call(rest + "/affiliates?select=id", public_key, token=normal2)
    _, affiliate3, _ = call(rest + "/affiliates?select=id", public_key, token=normal3)
    if len(affiliate2) != 1 or len(affiliate3) != 1:
        raise RuntimeError("test affiliate identity resolution failed")
    id2, id3 = affiliate2[0]["id"], affiliate3[0]["id"]
    _, files2, _ = call(rest + "/affiliate_files?select=id,private_asset_id,classification,storage_bucket,storage_path&affiliate_id=eq." + id2 + "&classification=eq.PRIVATE&limit=1", public_key, token=normal2)
    if not files2:
        raise RuntimeError("normal user has no private file fixture from historical row")
    _, cross, _ = call(rest + "/affiliate_files?select=id&affiliate_id=eq." + id3 + "&limit=1", public_key, token=normal2)
    if cross:
        raise RuntimeError("cross-affiliate file metadata visible")
    status, _, _ = call(rest + "/affiliate_files?select=source_url&affiliate_id=eq." + id2 + "&limit=1", public_key, token=normal2, expected={401,403})
    if status not in {401,403}:
        raise RuntimeError("provenance URL column exposed to affiliate")

    path = "/".join(urllib.parse.quote(part, safe="") for part in files2[0]["storage_path"].split("/"))
    private_url = base + "/storage/v1/object/authenticated/private-assets/" + path
    allowed, payload, _ = call(private_url, public_key, token=normal2, accept="application/octet-stream")
    if allowed != 200 or not payload:
        raise RuntimeError("owner private object read failed")
    denied, _, _ = call(private_url, public_key, token=normal3, expected={400,401,403,404}, accept="application/octet-stream")
    anonymous, _, _ = call(private_url, public_key, expected={400,401,403,404}, accept="application/octet-stream")
    if denied not in {400,401,403,404} or anonymous not in {400,401,403,404}:
        raise RuntimeError("private object cross-user/anonymous denial failed")

    payload = {"asset_key":"MUST_NOT_EXIST","asset_type":"TEST","storage_bucket":"private-assets","storage_path":"nope","mime_type":"text/plain","file_size":1,"content_sha256":"A"*64}
    for token in (normal2, normal3):
        denied_write, _, _ = call(rest + "/private_assets", public_key, "POST", payload, token, expected={401,403})
        if denied_write not in {401,403}:
            raise RuntimeError("normal private asset write not denied")

    result = {
        "status": "PASS_OPERATIONALLY_COMPLETE",
        "historical_asset_recovery_pending": 3,
        "expected_columns": expected_columns,
        "expected_references": expected_references,
        "aggregate": aggregate,
        "rls": {"users":3,"admin_provenance":True,"normal_provenance_hidden":True,"owner_private_read":True,"cross_user_denied":True,"anonymous_denied":True,"normal_writes_denied":True},
    }
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
