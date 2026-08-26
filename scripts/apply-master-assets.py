#!/usr/bin/env python3
"""Strict, resumable MASTER ASSET EVACUATION importer.

The importer never writes Google/Excel sources, never logs URLs or PII, and
never stores downloaded bytes on disk.  It validates bytes, uploads by SHA-256,
then writes provenance and semantic relations.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import mimetypes
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import zipfile
from collections import Counter, defaultdict
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "supabase/migrations/20260821001200_create_master_asset_evacuation.sql"
CATALOG = ROOT / "data/master-asset-column-catalog.json"
DEFAULT_RAW = Path(r"C:\tmp\master-asset-inventory.json")
DEFAULT_CHECKPOINT = Path(r"C:\tmp\master-asset-checkpoint.json")
NS = uuid.UUID("07df6a79-1af4-4ba9-a04f-3b43978c7f18")
MAX_FILE_SIZE = 104_857_600

EXPECTED_TABLES = {
    "historical_file_columns": {
        "id","source_system","source_file","source_file_hash","source_sheet","source_column",
        "source_column_letter","semantic_name","classification","target_domain","target_relation",
        "ownership_status","rows_with_files","urls_parsed","status","created_at","updated_at",
    },
    "private_assets": {
        "id","asset_key","asset_type","title","storage_bucket","storage_path","mime_type",
        "file_size","content_sha256","status","created_at","updated_at",
    },
    "historical_asset_sources": {
        "id","public_asset_id","private_asset_id","source_system","source_file","source_file_hash",
        "source_sheet","source_row_ordinal","source_column","source_column_letter","semantic_name",
        "file_key","title","source_url","source_url_sha256","url_order","classification","domain_raw",
        "target_domain","target_relation","expected_owner","ownership_status","linked_entity_table","linked_entity_id","migration_status",
        "failure_code","created_at","updated_at",
    },
    "affiliate_files": {
        "id","affiliate_id","numero_control","public_asset_id","private_asset_id","classification",
        "file_key","file_type","source_column","title","storage_bucket","storage_path","mime_type",
        "source_column_letter",
        "sha256","file_size","source_url","source_row_ordinal","source_file_hash","url_order","status",
        "sort_order","created_at","updated_at",
    },
}
EXPECTED_POLICIES = {
    "historical_file_columns_admin_read",
    "historical_asset_sources_admin_read",
    "private_assets_authorized_read",
    "affiliate_files_authorized_read",
    "master_private_storage_authorized_read",
    "master_public_storage_read",
}
EXPECTED_TRIGGERS = {
    "historical_file_columns_updated_at","private_assets_updated_at",
    "historical_asset_sources_updated_at","affiliate_files_updated_at",
}


class AssetFailure(RuntimeError):
    pass


def stable_id(value: str) -> str:
    return str(uuid.uuid5(NS, value))


def file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def read_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def http(url: str, key: str = "", method: str = "GET", body: bytes | None = None,
         content_type: str | None = None, headers: dict[str, str] | None = None,
         timeout: int = 120) -> tuple[bytes, dict[str, str], int]:
    request_headers = {"Accept": "application/json", "User-Agent": "SutiApp-MasterAssets/1.0"}
    if key:
        request_headers["apikey"] = key
        request_headers["Authorization"] = f"Bearer {key}"
    if body is not None:
        request_headers["Content-Type"] = content_type or "application/json"
    if headers:
        request_headers.update(headers)
    request = urllib.request.Request(url, data=body, headers=request_headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.read(MAX_FILE_SIZE + 1), dict(response.headers.items()), response.status
    except urllib.error.HTTPError as error:
        detail = error.read(1024).decode("utf-8", "replace")
        raise AssetFailure(f"HTTP_{error.code}:{detail[:200]}") from None
    except (urllib.error.URLError, TimeoutError) as error:
        raise AssetFailure(f"NETWORK_{type(error).__name__}") from None


def management_sql(env: dict[str, str], query: str) -> object:
    base = env["SUPABASE_URL"]
    ref = urllib.parse.urlsplit(base).hostname.split(".")[0]
    token = env.get("SUPABASE_ACCESS_TOKEN", "")
    if not token:
        raise AssetFailure("MISSING_SUPABASE_ACCESS_TOKEN")
    payload = json.dumps({"query": query}, separators=(",", ":")).encode()
    raw, _, _ = http(f"https://api.supabase.com/v1/projects/{ref}/database/query", token, "POST", payload)
    return json.loads(raw)


def schema_snapshot(env: dict[str, str]) -> dict:
    query = """
    select json_build_object(
      'dependencies', json_build_object(
        'affiliates', to_regclass('public.affiliates') is not null,
        'app_assets', to_regclass('public.app_assets') is not null,
        'asset_sources', to_regclass('public.asset_sources') is not null,
        'has_admin_permission', to_regprocedure('public.has_admin_permission(text)') is not null,
        'get_effective_affiliate_id', to_regprocedure('public.get_effective_affiliate_id()') is not null
      ),
      'tables', coalesce((select json_object_agg(t.table_name,t.columns) from (
        select c.table_name, json_agg(c.column_name order by c.ordinal_position) columns
        from information_schema.columns c
        where c.table_schema='public' and c.table_name in
          ('historical_file_columns','private_assets','historical_asset_sources','affiliate_files')
        group by c.table_name
      ) t),'{}'::json),
      'rls', coalesce((select json_object_agg(c.relname,json_build_object('enabled',c.relrowsecurity,'forced',c.relforcerowsecurity))
        from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public' and c.relname in
          ('historical_file_columns','private_assets','historical_asset_sources','affiliate_files')),'{}'::json),
      'policies', coalesce((select json_agg(policyname order by policyname) from pg_policies
        where (schemaname='public' and tablename in ('historical_file_columns','private_assets','historical_asset_sources','affiliate_files'))
           or (schemaname='storage' and tablename='objects' and policyname in ('master_private_storage_authorized_read','master_public_storage_read'))),'[]'::json),
      'triggers', coalesce((select json_agg(t.tgname order by t.tgname)
        from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
        where not t.tgisinternal and n.nspname='public' and c.relname in
          ('historical_file_columns','private_assets','historical_asset_sources','affiliate_files')),'[]'::json),
      'buckets', coalesce((select json_object_agg(id,json_build_object('public',public,'limit',file_size_limit))
        from storage.buckets where id in ('private-assets','public-assets')),'{}'::json),
      'counts', json_build_object(
        'affiliates',(select count(*) from public.affiliates),
        'auth_users',(select count(*) from auth.users),
        'companies',(select count(*) from public.companies),
        'app_assets',(select count(*) from public.app_assets),
        'asset_sources',(select count(*) from public.asset_sources)
      )
    ) result;
    """
    rows = management_sql(env, query)
    return rows[0]["result"]


def verify_schema(snapshot: dict, allow_absent: bool) -> str:
    if not all(snapshot["dependencies"].values()):
        raise AssetFailure("REMOTE_DEPENDENCY_MISMATCH")
    present = set(snapshot["tables"])
    if not present:
        if allow_absent:
            if snapshot["buckets"]:
                raise AssetFailure("REMOTE_BUCKET_COLLISION_WITHOUT_SCHEMA")
            return "ABSENT"
        raise AssetFailure("MASTER_ASSET_SCHEMA_ABSENT")
    if present != set(EXPECTED_TABLES):
        raise AssetFailure("PARTIAL_OR_COLLIDING_MASTER_ASSET_SCHEMA")
    for table, columns in EXPECTED_TABLES.items():
        if set(snapshot["tables"][table]) != columns:
            raise AssetFailure(f"REMOTE_COLUMN_SIGNATURE_MISMATCH:{table}")
        if snapshot["rls"].get(table) != {"enabled": True, "forced": True}:
            raise AssetFailure(f"REMOTE_RLS_MISMATCH:{table}")
    if set(snapshot["policies"]) != EXPECTED_POLICIES:
        raise AssetFailure("REMOTE_POLICY_SIGNATURE_MISMATCH")
    if set(snapshot["triggers"]) != EXPECTED_TRIGGERS:
        raise AssetFailure("REMOTE_TRIGGER_SIGNATURE_MISMATCH")
    buckets = snapshot["buckets"]
    if buckets.get("private-assets") != {"public": False, "limit": MAX_FILE_SIZE}:
        raise AssetFailure("PRIVATE_BUCKET_SIGNATURE_MISMATCH")
    if buckets.get("public-assets") != {"public": True, "limit": MAX_FILE_SIZE}:
        raise AssetFailure("PUBLIC_BUCKET_SIGNATURE_MISMATCH")
    return "EXACT"


def apply_schema(env: dict[str, str]) -> None:
    management_sql(env, MIGRATION.read_text(encoding="utf-8"))


def rest_rows(base: str, key: str, table: str, select: str, query: str = "") -> list[dict]:
    result: list[dict] = []
    offset = 0
    while True:
        suffix = f"&{query}" if query else ""
        url = f"{base}/rest/v1/{table}?select={urllib.parse.quote(select, safe=',()*')}&limit=1000&offset={offset}{suffix}"
        raw, _, _ = http(url, key)
        page = json.loads(raw)
        result.extend(page)
        if len(page) < 1000:
            return result
        offset += 1000


def upsert(base: str, key: str, table: str, rows: list[dict]) -> None:
    if not rows:
        return
    payload = json.dumps(rows, ensure_ascii=False, separators=(",", ":")).encode()
    http(f"{base}/rest/v1/{table}?on_conflict=id", key, "POST", payload, "application/json", {
        "Prefer": "resolution=merge-duplicates,return=minimal"
    })


def detect_file(data: bytes, advertised: str | None) -> tuple[str, str]:
    if not data or len(data) > MAX_FILE_SIZE:
        raise AssetFailure("EMPTY_OR_OVERSIZE")
    sample = data[:1024].lstrip().lower()
    if sample.startswith((b"<!doctype html", b"<html", b"<head", b"<body")):
        raise AssetFailure("HTML_PAYLOAD_REJECTED")
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png", "png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg", "jpg"
    if data.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif", "gif"
    if data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return "image/webp", "webp"
    if data.startswith(b"%PDF-"):
        return "application/pdf", "pdf"
    if sample.startswith(b"<svg") or (sample.startswith(b"<?xml") and b"<svg" in sample):
        return "image/svg+xml", "svg"
    if len(data) > 12 and data[4:8] == b"ftyp":
        brand = data[8:12]
        if brand in {b"heic", b"heix", b"hevc", b"hevx", b"mif1"}:
            return "image/heic", "heic"
        if brand in {b"heif", b"heim", b"heis"}:
            return "image/heif", "heif"
    if data.startswith(b"PK\x03\x04"):
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                names = set(archive.namelist())
            if "[Content_Types].xml" in names and any(name.startswith("word/") for name in names):
                return "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"
            if "[Content_Types].xml" in names and any(name.startswith("xl/") for name in names):
                return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"
            if "[Content_Types].xml" in names and any(name.startswith("ppt/") for name in names):
                return "application/vnd.openxmlformats-officedocument.presentationml.presentation", "pptx"
            return "application/zip", "zip"
        except zipfile.BadZipFile:
            raise AssetFailure("INVALID_ZIP_SIGNATURE") from None
    advertised = (advertised or "").split(";", 1)[0].strip().lower()
    if advertised in {"text/csv", "application/csv"}:
        if b"\x00" in data[:4096]:
            raise AssetFailure("INVALID_CSV_BINARY_PAYLOAD")
        try:
            sample_text = data[:65536].decode("utf-8-sig")
        except UnicodeDecodeError:
            raise AssetFailure("INVALID_CSV_ENCODING") from None
        if not sample_text.strip() or not any(separator in sample_text for separator in (",", ";", "\t")):
            raise AssetFailure("INVALID_CSV_STRUCTURE")
        return "text/csv", "csv"
    if data.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1") and advertised in {
        "application/msword", "application/vnd.ms-excel", "application/vnd.ms-powerpoint"
    }:
        return advertised, {"application/msword":"doc","application/vnd.ms-excel":"xls","application/vnd.ms-powerpoint":"ppt"}[advertised]
    raise AssetFailure("UNSUPPORTED_OR_INVALID_MIME")


def download(url: str) -> tuple[bytes, str, str, str]:
    last: AssetFailure | None = None
    for attempt in range(3):
        try:
            raw, headers, status = http(url, timeout=90)
            if status < 200 or status >= 300:
                raise AssetFailure(f"HTTP_STATUS_{status}")
            mime, ext = detect_file(raw, headers.get("Content-Type"))
            digest = hashlib.sha256(raw).hexdigest().upper()
            return raw, mime, ext, digest
        except AssetFailure as error:
            last = error
            if attempt < 2:
                time.sleep(1 + attempt * 2)
    raise last or AssetFailure("DOWNLOAD_FAILED")


def upload(base: str, key: str, bucket: str, path: str, data: bytes, mime: str) -> None:
    encoded = "/".join(urllib.parse.quote(part, safe="") for part in path.split("/"))
    url = f"{base}/storage/v1/object/{bucket}/{encoded}"
    try:
        http(url, key, "POST", data, mime, {"x-upsert": "false"})
    except AssetFailure as error:
        if not str(error).startswith(("HTTP_400", "HTTP_409")):
            raise
        existing, _, _ = http(f"{base}/storage/v1/object/authenticated/{bucket}/{encoded}", key)
        if hashlib.sha256(existing).digest() != hashlib.sha256(data).digest():
            raise AssetFailure("STORAGE_PATH_COLLISION") from None


def transfer(url: str, refs: list[dict], base: str, key: str,
             public_by_url: dict[str, dict], public_by_hash: dict[str, dict],
             private_by_hash: dict[str, dict]) -> dict:
    data, mime, ext, digest = download(url)
    existing_public = public_by_url.get(url)
    restrictive = "PRIVATE" if any(ref["classification"] == "PRIVATE" for ref in refs) else "PUBLIC"
    asset_row = None
    asset_table = None
    if existing_public:
        if existing_public.get("content_sha256") != digest:
            raise AssetFailure("EXISTING_PUBLIC_SOURCE_CONTENT_CHANGED")
        physical = existing_public
        classification = "PUBLIC"
        bucket, path, asset_id = physical["storage_bucket"], physical["storage_path"], physical["id"]
    elif restrictive == "PUBLIC" and digest in public_by_hash:
        physical = public_by_hash[digest]
        classification = "PUBLIC"
        bucket, path, asset_id = physical["storage_bucket"], physical["storage_path"], physical["id"]
    elif restrictive == "PRIVATE" and digest in private_by_hash:
        physical = private_by_hash[digest]
        classification = "PRIVATE"
        bucket, path, asset_id = physical["storage_bucket"], physical["storage_path"], physical["id"]
    else:
        classification = restrictive
        bucket = "private-assets" if classification == "PRIVATE" else "public-assets"
        prefix = "sha256" if classification == "PRIVATE" else "evacuated"
        path = f"{prefix}/{digest[:2].lower()}/{digest.lower()}.{ext}"
        asset_id = stable_id(f"asset:{bucket}:{digest}")
        upload(base, key, bucket, path, data, mime)
        asset_row = {
            "id": asset_id, "asset_key": f"master.{classification.lower()}.{digest.lower()}",
            "asset_type": "HISTORICAL_FILE", "title": None,
            "storage_bucket": bucket, "storage_path": path, "mime_type": mime,
            "file_size": len(data), "content_sha256": digest, "status": "READY",
        }
        if classification == "PUBLIC":
            asset_row["alt_text"] = None
            asset_table = "app_assets"
        else:
            asset_table = "private_assets"
    return {
        "status": "READY", "classification": classification, "asset_id": asset_id,
        "bucket": bucket, "path": path, "mime_type": mime, "file_size": len(data),
        "sha256": digest, "existing_public": bool(existing_public),
        "asset_row": asset_row, "asset_table": asset_table,
    }


def load_checkpoint(path: Path, raw_hash: str, migration_hash: str) -> dict:
    if not path.exists():
        return {"raw_hash": raw_hash, "migration_hash": migration_hash, "results": {}}
    checkpoint = json.loads(path.read_text(encoding="utf-8"))
    if checkpoint.get("raw_hash") != raw_hash or checkpoint.get("migration_hash") != migration_hash:
        raise AssetFailure("CHECKPOINT_INPUT_HASH_MISMATCH")
    return checkpoint


def save_checkpoint(path: Path, checkpoint: dict) -> None:
    temp = path.with_suffix(path.suffix + f".tmp.{os.getpid()}")
    temp.write_text(json.dumps(checkpoint, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    for attempt in range(20):
        try:
            os.replace(temp, path)
            return
        except PermissionError:
            if attempt == 19:
                raise
            time.sleep(0.1)


def column_rows(catalog: dict) -> list[dict]:
    rows = []
    for item in catalog["columns"]:
        key = f"column:{item['source_system']}:{item['source_file_hash']}:{item['sheet']}:{item['column']}"
        rows.append({
            "id": stable_id(key), "source_system": item["source_system"], "source_file": item["source_file"],
            "source_file_hash": item["source_file_hash"], "source_sheet": item["sheet"],
            "source_column": item["semantic_name"], "source_column_letter": item["column"],
            "semantic_name": item["semantic_name"], "classification": item["classification"],
            "target_domain": item["target_domain"], "target_relation": item["target_relation"],
            "ownership_status": item["ownership_status"], "rows_with_files": item["rows_with_files"],
            "urls_parsed": item["urls_parsed"], "status": "IN_PROGRESS",
        })
    return rows


def make_source(ref: dict, result: dict, affiliate_id: str | None) -> dict:
    failed = result["status"] == "FAILED"
    if failed:
        migration_status = "FAILED"
    elif ref["source_system"] == "owner_master_excel":
        migration_status = "LINKED" if affiliate_id else "PENDING_AFFILIATE_LINK"
    elif result.get("existing_public") and ref["ownership_status"] == "DOMAIN_LINK_CANDIDATE":
        migration_status = "LINKED"
    else:
        migration_status = "PENDING_DOMAIN_LINK"
    public_id = result.get("asset_id") if result.get("classification") == "PUBLIC" else None
    private_id = result.get("asset_id") if result.get("classification") == "PRIVATE" else None
    return {
        "id": stable_id(f"source:{ref['source_system']}:{ref['source_file_hash']}:{ref['source_sheet']}:{ref['source_row']}:{ref['source_column_letter']}:{ref['url_order']}:{ref['source_url_sha256']}"),
        "public_asset_id": None if failed else public_id,
        "private_asset_id": None if failed else private_id,
        "source_system": ref["source_system"], "source_file": ref["source_file"],
        "source_file_hash": ref["source_file_hash"], "source_sheet": ref["source_sheet"],
        "source_row_ordinal": ref["source_row"], "source_column": ref["source_column"],
        "source_column_letter": ref["source_column_letter"], "semantic_name": ref["source_column"],
        "file_key": ref["file_key"], "title": None, "source_url": ref["source_url"],
        "source_url_sha256": ref["source_url_sha256"], "url_order": ref["url_order"],
        "classification": result.get("classification") or ref["classification"],
        "domain_raw": ref["domain"], "target_domain": ref["target_domain"],
        "target_relation": ref["target_relation"], "expected_owner": ref["expected_owner"],
        "ownership_status": "AFFILIATE_LINKED" if affiliate_id else ref["ownership_status"],
        "linked_entity_table": "affiliates" if affiliate_id else (ref["target_relation"] if migration_status == "LINKED" else None),
        "linked_entity_id": affiliate_id,
        "migration_status": migration_status,
        "failure_code": result.get("failure_code") if failed else None,
    }


def make_affiliate_file(ref: dict, result: dict, affiliate: dict) -> dict:
    classification = result["classification"]
    return {
        "id": stable_id(f"affiliate-file:{ref['source_file_hash']}:{ref['source_row']}:{ref['source_column_letter']}:{ref['url_order']}"),
        "affiliate_id": affiliate["id"], "numero_control": affiliate["numero_control"],
        "public_asset_id": result["asset_id"] if classification == "PUBLIC" else None,
        "private_asset_id": result["asset_id"] if classification == "PRIVATE" else None,
        "classification": classification, "file_key": ref["file_key"],
        "file_type": "image" if result["mime_type"].startswith("image/") else "document",
        "source_column": ref["source_column"], "source_column_letter": ref["source_column_letter"], "title": None,
        "storage_bucket": result["bucket"], "storage_path": result["path"],
        "mime_type": result["mime_type"], "sha256": result["sha256"], "file_size": result["file_size"],
        "source_url": ref["source_url"], "source_row_ordinal": ref["source_row"],
        "source_file_hash": ref["source_file_hash"], "url_order": ref["url_order"],
        "status": "READY", "sort_order": ref["url_order"],
    }


def chunks(rows: list[dict], size: int = 100):
    for index in range(0, len(rows), size):
        yield rows[index:index + size]


def flush_import_buffer(base: str, key: str, buffer: list[dict], checkpoint: dict, checkpoint_path: Path) -> None:
    public_assets = {item["result"]["asset_row"]["id"]: item["result"]["asset_row"]
                     for item in buffer if item["result"].get("asset_table") == "app_assets"}
    private_assets = {item["result"]["asset_row"]["id"]: item["result"]["asset_row"]
                      for item in buffer if item["result"].get("asset_table") == "private_assets"}
    for batch in chunks(list(public_assets.values())):
        upsert(base, key, "app_assets", batch)
    for batch in chunks(list(private_assets.values())):
        upsert(base, key, "private_assets", batch)
    source_rows = [row for item in buffer for row in item["source_rows"]]
    affiliate_rows = [row for item in buffer for row in item["affiliate_rows"]]
    for batch in chunks(source_rows):
        upsert(base, key, "historical_asset_sources", batch)
    for batch in chunks(affiliate_rows):
        upsert(base, key, "affiliate_files", batch)
    for item in buffer:
        stored = {name: value for name, value in item["result"].items() if name not in {"asset_row", "asset_table"}}
        checkpoint["results"][item["url_hash"]] = stored
    save_checkpoint(checkpoint_path, checkpoint)
    buffer.clear()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--env-file", type=Path, default=ROOT / "supabase.env")
    parser.add_argument("--raw-inventory", type=Path, default=DEFAULT_RAW)
    parser.add_argument("--checkpoint", type=Path, default=DEFAULT_CHECKPOINT)
    parser.add_argument("--schema-only", action="store_true")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--retry-failed", action="store_true")
    args = parser.parse_args()
    try:
        env = read_env(args.env_file)
        for required in ("SUPABASE_URL", "SUPABASE_ACCESS_TOKEN", "SUPABASE_SECRET_KEY"):
            if not env.get(required):
                raise AssetFailure(f"MISSING_{required}")
        raw_hash = file_hash(args.raw_inventory)
        migration_hash = file_hash(MIGRATION)
        print(json.dumps({"stage": "inputs_verified", "raw_inventory_sha256": raw_hash}, sort_keys=True), flush=True)
        catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
        if catalog["raw_inventory_sha256"] != raw_hash:
            raise AssetFailure("RAW_INVENTORY_HASH_MISMATCH")
        inventory = json.loads(args.raw_inventory.read_text(encoding="utf-8"))["records"]
        print(json.dumps({"stage": "remote_preflight"}, sort_keys=True), flush=True)
        before = schema_snapshot(env)
        state = verify_schema(before, allow_absent=True)
        protected = before["counts"]
        if state == "ABSENT":
            apply_schema(env)
        after_schema = schema_snapshot(env)
        verify_schema(after_schema, allow_absent=False)
        if after_schema["counts"] != protected:
            raise AssetFailure("PROTECTED_COUNTS_CHANGED_BY_SCHEMA")
        print(json.dumps({"schema": "EXACT", "protected_counts": protected}, sort_keys=True), flush=True)
        if args.schema_only:
            return 0

        base = env["SUPABASE_URL"].rstrip("/")
        key = env["SUPABASE_SECRET_KEY"]
        columns = column_rows(catalog)
        print(json.dumps({"stage": "column_catalog", "columns": len(columns)}, sort_keys=True), flush=True)
        for batch in chunks(columns):
            upsert(base, key, "historical_file_columns", batch)

        affiliates = rest_rows(base, key, "affiliates", "id,numero_control,source_row_ordinal,source_file_hash")
        print(json.dumps({"stage": "affiliate_reconciliation", "rows": len(affiliates)}, sort_keys=True), flush=True)
        affiliate_by_source = {(row["source_file_hash"], row["source_row_ordinal"]): row for row in affiliates}
        if len(affiliate_by_source) != 947:
            raise AssetFailure("AFFILIATE_SOURCE_COORDINATE_RECONCILIATION_FAILED")

        app_assets = rest_rows(base, key, "app_assets", "id,storage_bucket,storage_path,mime_type,file_size,content_sha256,status")
        private_assets = rest_rows(base, key, "private_assets", "id,storage_bucket,storage_path,mime_type,file_size,content_sha256,status")
        old_sources = rest_rows(base, key, "asset_sources", "source_url,asset_id")
        print(json.dumps({"stage": "existing_asset_maps", "public_assets": len(app_assets), "private_assets": len(private_assets), "provenance": len(old_sources)}, sort_keys=True), flush=True)
        app_by_id = {row["id"]: row for row in app_assets}
        public_by_url = {row["source_url"]: app_by_id.get(row["asset_id"]) for row in old_sources if row.get("source_url") and app_by_id.get(row["asset_id"])}
        public_by_hash = {row["content_sha256"]: row for row in app_assets if row.get("content_sha256") and row["status"] == "READY"}
        private_by_hash = {row["content_sha256"]: row for row in private_assets if row.get("content_sha256") and row["status"] == "READY"}

        refs_by_url: dict[str, list[dict]] = defaultdict(list)
        for ref in inventory:
            refs_by_url[ref["source_url"]].append(ref)
        urls = sorted(refs_by_url, key=lambda url: hashlib.sha256(url.encode()).hexdigest())
        checkpoint = load_checkpoint(args.checkpoint, raw_hash, migration_hash)
        if args.retry_failed:
            checkpoint["results"] = {name: value for name, value in checkpoint["results"].items()
                                     if value.get("status") != "FAILED"}
            save_checkpoint(args.checkpoint, checkpoint)
        remaining = [url for url in urls if hashlib.sha256(url.encode()).hexdigest().upper() not in checkpoint["results"]]
        if args.limit is not None:
            remaining = remaining[:args.limit]
        print(json.dumps({"unique_urls": len(urls), "completed": len(checkpoint["results"]), "remaining_this_run": len(remaining)}, sort_keys=True), flush=True)

        processed = 0
        import_buffer: list[dict] = []
        with ThreadPoolExecutor(max_workers=max(1, min(args.workers, 16))) as pool:
            iterator = iter(remaining)
            pending = {}
            for _ in range(max(1, min(args.workers, 16)) * 2):
                try:
                    url = next(iterator)
                except StopIteration:
                    break
                pending[pool.submit(transfer, url, refs_by_url[url], base, key,
                                    public_by_url, public_by_hash, private_by_hash)] = url
            while pending:
                done, _ = wait(pending, return_when=FIRST_COMPLETED)
                for future in done:
                    url = pending.pop(future)
                    url_hash = hashlib.sha256(url.encode()).hexdigest().upper()
                    refs = refs_by_url[url]
                    result: dict
                    try:
                        result = future.result()
                    except (AssetFailure, OSError, zipfile.BadZipFile) as error:
                        code = re.sub(r"[^A-Z0-9_:-]", "_", str(error).upper())[:120]
                        result = {"status": "FAILED", "failure_code": code}

                    source_rows: list[dict] = []
                    affiliate_rows: list[dict] = []
                    for ref in refs:
                        affiliate = None
                        if ref["source_system"] == "owner_master_excel":
                            candidate = affiliate_by_source.get((ref["source_file_hash"], ref["source_row"] - 1))
                            if candidate and candidate["numero_control"] == ref.get("numero_control_raw"):
                                affiliate = candidate
                        source_rows.append(make_source(ref, result, affiliate["id"] if affiliate and result["status"] == "READY" else None))
                        if affiliate and result["status"] == "READY":
                            affiliate_rows.append(make_affiliate_file(ref, result, affiliate))
                    import_buffer.append({"url_hash": url_hash, "result": result,
                                          "source_rows": source_rows, "affiliate_rows": affiliate_rows})
                    processed += 1
                    if len(import_buffer) >= 25 or processed == len(remaining):
                        flush_import_buffer(base, key, import_buffer, checkpoint, args.checkpoint)
                        statuses = Counter(row["status"] for row in checkpoint["results"].values())
                        print(json.dumps({"processed_this_run": processed, "checkpoint_total": len(checkpoint["results"]), "ready": statuses["READY"], "failed": statuses["FAILED"]}, sort_keys=True), flush=True)
                    try:
                        next_url = next(iterator)
                    except StopIteration:
                        continue
                    pending[pool.submit(transfer, next_url, refs_by_url[next_url], base, key,
                                        public_by_url, public_by_hash, private_by_hash)] = next_url

        complete = len(checkpoint["results"]) == len(urls)
        result_by_hash = checkpoint["results"]

        affiliate_source_rows: list[dict] = []
        affiliate_relation_rows: list[dict] = []
        affiliate_unresolved = 0
        for ref in inventory:
            if ref["source_system"] != "owner_master_excel":
                continue
            url_hash = hashlib.sha256(ref["source_url"].encode()).hexdigest().upper()
            outcome = result_by_hash.get(url_hash)
            if not outcome:
                continue
            candidate = affiliate_by_source.get((ref["source_file_hash"], ref["source_row"] - 1))
            affiliate = candidate if candidate and candidate["numero_control"] == ref.get("numero_control_raw") else None
            if not affiliate:
                affiliate_unresolved += 1
            affiliate_source_rows.append(make_source(ref, outcome, affiliate["id"] if affiliate and outcome["status"] == "READY" else None))
            if affiliate and outcome["status"] == "READY":
                affiliate_relation_rows.append(make_affiliate_file(ref, outcome, affiliate))
        for batch in chunks(affiliate_source_rows):
            upsert(base, key, "historical_asset_sources", batch)
        for batch in chunks(affiliate_relation_rows):
            upsert(base, key, "affiliate_files", batch)
        print(json.dumps({"stage": "affiliate_relation_reconciliation", "linked": len(affiliate_relation_rows),
                          "unresolved": affiliate_unresolved}, sort_keys=True), flush=True)

        column_outcomes: dict[tuple[str,str,str,str], Counter] = defaultdict(Counter)
        for ref in inventory:
            url_hash = hashlib.sha256(ref["source_url"].encode()).hexdigest().upper()
            outcome = result_by_hash.get(url_hash)
            key_col = (ref["source_system"], ref["source_file_hash"], ref["source_sheet"], ref["source_column_letter"])
            column_outcomes[key_col][outcome["status"] if outcome else "PENDING"] += 1
        final_columns = column_rows(catalog)
        for row in final_columns:
            outcomes = column_outcomes[(row["source_system"],row["source_file_hash"],row["source_sheet"],row["source_column_letter"])]
            row["status"] = "RECONCILED" if outcomes["READY"] == row["urls_parsed"] else ("PARTIAL" if outcomes["READY"] else ("FAILED" if outcomes["FAILED"] == row["urls_parsed"] else "IN_PROGRESS"))
        for batch in chunks(final_columns):
            upsert(base, key, "historical_file_columns", batch)

        final_schema = schema_snapshot(env)
        verify_schema(final_schema, allow_absent=False)
        protected_keys = {"affiliates", "auth_users", "companies", "asset_sources"}
        if any(final_schema["counts"][name] != protected[name] for name in protected_keys):
            raise AssetFailure("PROTECTED_COUNTS_CHANGED_BY_IMPORT")
        statuses = Counter(row["status"] for row in checkpoint["results"].values())
        print(json.dumps({
            "complete": complete, "urls_discovered": len(urls), "unique_files_processed": len(checkpoint["results"]),
            "ready": statuses["READY"], "failed": statuses["FAILED"],
            "operational_status": "OPERATIONALLY_COMPLETE" if complete else "IN_PROGRESS",
            "historical_asset_recovery_pending": statuses["FAILED"],
            "retry_failed_requested": bool(args.retry_failed),
            "protected_counts": final_schema["counts"], "raw_inventory_sha256": raw_hash,
        }, sort_keys=True), flush=True)
        return 0 if complete else 2
    except (AssetFailure, OSError, KeyError, ValueError, json.JSONDecodeError) as error:
        print(f"MASTER ASSET EVACUATION ABORTED: {error}", flush=True)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
