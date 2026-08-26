#!/usr/bin/env python3
"""Apply H-007.2 schema, copy validated public assets, and reconcile Supabase."""

from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data/h0072-visual-source.json"
H007_SOURCE = ROOT / "data/h007-supabase-now-source.json"
MIGRATION = ROOT / "supabase/migrations/20260821000300_create_visual_content_storage.sql"
EXPECTED_SOURCE_HASH = "A677797640D181E42770204A5E1249D77CE6270989AEFCD8FC25644188ED56D3"
EXPECTED_H007_HASH = "80910E831B93C324B55B3E10A225999B122EB6FBC1826F83FD8BA49A8D4ED915"
NS = uuid.UUID("334a7280-c857-48e6-b7f8-4458c62e2f18")


class ImportFailure(RuntimeError):
    pass


def file_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def read_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def stable_id(value: str) -> str:
    return str(uuid.uuid5(NS, value))


def api(url: str, key: str, method: str = "GET", body: bytes | None = None,
        content_type: str | None = None, prefer: str | None = None,
        bearer: bool = False, extra_headers: dict[str, str] | None = None) -> bytes:
    headers = {"Accept": "application/json", "User-Agent": "SutiApp-H0072/1.0"}
    if bearer:
        headers["Authorization"] = f"Bearer {key}"
    elif key:
        headers["apikey"] = key
    if body is not None:
        headers["Content-Type"] = content_type or "application/json"
    if prefer:
        headers["Prefer"] = prefer
    if extra_headers:
        headers.update(extra_headers)
    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            return response.read()
    except urllib.error.HTTPError as error:
        raw = error.read(2048)
        detail = ""
        try:
            parsed = json.loads(raw.decode("utf-8", "replace"))
            detail = str(parsed.get("message") or parsed.get("error") or "")[:500]
        except (json.JSONDecodeError, UnicodeDecodeError, AttributeError):
            pass
        suffix = f" ({detail})" if detail else ""
        raise ImportFailure(f"Remote request failed: HTTP {error.code}{suffix}") from None
    except urllib.error.URLError as error:
        raise ImportFailure(f"Remote request failed: {error.reason}") from None


def upsert(base: str, key: str, table: str, rows: list[dict[str, object]]) -> None:
    if not rows:
        return
    url = f"{base}/rest/v1/{table}?on_conflict=id"
    payload = json.dumps(rows, ensure_ascii=False, separators=(",", ":")).encode()
    api(url, key, "POST", payload, prefer="resolution=merge-duplicates,return=minimal")


def patch(base: str, key: str, table: str, filters: dict[str, object], values: dict[str, object]) -> None:
    query = urllib.parse.urlencode({name: f"eq.{value}" for name, value in filters.items()})
    payload = json.dumps(values, separators=(",", ":")).encode()
    api(f"{base}/rest/v1/{table}?{query}", key, "PATCH", payload, prefer="return=minimal")


def detect(data: bytes, advertised: str | None, url: str) -> tuple[str, str]:
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
    sample = data[:512].lstrip().lower()
    if sample.startswith(b"<svg") or (sample.startswith(b"<?xml") and b"<svg" in sample):
        return "image/svg+xml", "svg"
    guessed = (advertised or "").split(";", 1)[0].strip().lower()
    if guessed == "image/x-icon" and data:
        return guessed, "ico"
    raise ImportFailure(f"Unsupported or invalid asset payload from {urllib.parse.urlsplit(url).hostname or 'local'}")


def direct_url(url: str) -> str:
    parsed = urllib.parse.urlsplit(url)
    if parsed.hostname in {"drive.google.com", "docs.google.com"}:
        parts = parsed.path.split("/")
        if "d" in parts and parts.index("d") + 1 < len(parts):
            file_id = parts[parts.index("d") + 1]
            return "https://drive.usercontent.google.com/download?" + urllib.parse.urlencode({"id": file_id, "export": "download", "confirm": "t"})
        query = urllib.parse.parse_qs(parsed.query)
        if query.get("id"):
            return "https://drive.usercontent.google.com/download?" + urllib.parse.urlencode({"id": query["id"][0], "export": "download", "confirm": "t"})
    return url


def download(spec: dict[str, object]) -> tuple[bytes, str, str]:
    if spec.get("local_path"):
        path = ROOT / str(spec["local_path"])
        data = path.read_bytes()
        mime, ext = detect(data, mimetypes.guess_type(path.name)[0], path.name)
        return data, mime, ext
    url = direct_url(str(spec["source_url"]))
    request = urllib.request.Request(url, headers={"User-Agent": "SutiApp-H0072/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            data = response.read(52_428_801)
            advertised = response.headers.get("Content-Type")
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as error:
        raise ImportFailure(f"Download failed from {urllib.parse.urlsplit(url).hostname}: {type(error).__name__}") from None
    if not data or len(data) > 52_428_800:
        raise ImportFailure("Downloaded asset is empty or exceeds 50 MiB")
    mime, ext = detect(data, advertised, url)
    return data, mime, ext


def add(specs: list[dict[str, object]], *, key: str, asset_type: str, bucket: str,
        prefix: str, snapshot_hash: str, source_sheet: str, source_row: int | None,
        source_url: str | None = None, source_column: str | None = None,
        local_path: str | None = None, title: str | None = None,
        relation: dict[str, object] | None = None) -> None:
    if not source_url and not local_path:
        return
    specs.append({
        "desired_key": key, "asset_type": asset_type, "bucket": bucket, "prefix": prefix,
        "snapshot_hash": snapshot_hash, "source_sheet": source_sheet,
        "source_row": source_row, "source_column": source_column, "source_url": source_url,
        "local_path": local_path, "title": title, "relation": relation,
    })


def collect(source: dict[str, object], h007: dict[str, object], source_hash: str) -> list[dict[str, object]]:
    specs: list[dict[str, object]] = []
    for row in source["local_branding"]:
        add(specs, key=row["asset_key"], asset_type="BRANDING", bucket="app-assets", prefix="branding",
            snapshot_hash=source_hash, source_sheet="LOCAL_BUILD", source_row=None,
            local_path=row["path"], title=row["purpose"])
    for row in source["home_banners"]["rows"]:
        relation = {"kind": "banner", "placement": "home", "row": row}
        add(specs, key=f"home.banner.{row['sort_order']}", asset_type="BANNER", bucket="app-assets", prefix="banners/home",
            snapshot_hash=source_hash, source_sheet="Anuncio principal", source_row=row["source_row_ordinal"],
            source_column=row["source_column"], source_url=row["source_url"], relation=relation)
    for order, row in enumerate(source["marketplace_banners"]["rows"], start=1):
        relation = {"kind": "banner", "placement": "marketplace", "row": dict(row, sort_order=order)}
        add(specs, key=f"marketplace.banner.source-{row['source_row_ordinal']}", asset_type="BANNER", bucket="app-assets", prefix="banners/marketplace",
            snapshot_hash=source_hash, source_sheet="Banner SutiCompras", source_row=row["source_row_ordinal"],
            source_url=row["source_url"], relation=relation)
    for row in source["convenio_assets"]["rows"]:
        add(specs, key=f"convenio.source-{row['source_row_ordinal']}.{row['source_column'].lower()}",
            asset_type="COMPANY_IMAGE_CANDIDATE", bucket="company-assets", prefix="unlinked/convenios",
            snapshot_hash=source_hash, source_sheet="Convenios2", source_row=row["source_row_ordinal"],
            source_column=row["source_column"], source_url=row["source_url"])
    for order, row in enumerate(source["popup_candidates"]["rows"], start=1):
        relation = {"kind": "popup", "row": dict(row, sort_order=order)}
        add(specs, key=f"popup.promotion.source-{row['source_row_ordinal']}", asset_type="POPUP", bucket="app-assets", prefix="popups",
            snapshot_hash=source_hash, source_sheet="Promociones", source_row=row["source_row_ordinal"],
            source_url=row["source_url"], relation=relation)

    domains = h007["domains"]
    for row in domains["directory"]["rows"]:
        add(specs, key=f"directory.member.{row['source_row_ordinal']}.photo", asset_type="INSTITUTIONAL_IMAGE",
            bucket="app-assets", prefix="institutional/directory", snapshot_hash=EXPECTED_H007_HASH,
            source_sheet="Directorio", source_row=row["source_row_ordinal"], source_url=row.get("image_url"),
            relation={"kind": "fk", "table": "directory_members", "column": "image_asset_id", "row": row})
    for row in domains["minutes"]["rows"]:
        base = f"minute.source-{row['source_row_ordinal']}"
        add(specs, key=base + ".image", asset_type="INSTITUTIONAL_IMAGE", bucket="app-assets", prefix="institutional/minutes",
            snapshot_hash=EXPECTED_H007_HASH, source_sheet="Minutas de acuerdos", source_row=row["source_row_ordinal"],
            source_url=row.get("image_url"), relation={"kind": "fk", "table": "minutes", "column": "image_asset_id", "row": row})
        add(specs, key=base + ".document", asset_type="DOCUMENT", bucket="documents", prefix="minutes",
            snapshot_hash=EXPECTED_H007_HASH, source_sheet="Minutas de acuerdos", source_row=row["source_row_ordinal"],
            source_url=row.get("document_url"), relation={"kind": "fk", "table": "minutes", "column": "document_asset_id", "row": row})
    for row in domains["institutional_documents"]["rows"]:
        base = f"document.{row['kind']}.source-{row['source_row_ordinal']}"
        add(specs, key=base + ".image", asset_type="INSTITUTIONAL_IMAGE", bucket="app-assets", prefix="institutional/documents",
            snapshot_hash=EXPECTED_H007_HASH, source_sheet=row["source_sheet"], source_row=row["source_row_ordinal"],
            source_url=row.get("image_url"), relation={"kind": "fk", "table": "institutional_documents", "column": "image_asset_id", "row": row})
        add(specs, key=base + ".file", asset_type="DOCUMENT", bucket="documents", prefix="institutional",
            snapshot_hash=EXPECTED_H007_HASH, source_sheet=row["source_sheet"], source_row=row["source_row_ordinal"],
            source_url=row.get("document_url"), relation={"kind": "fk", "table": "institutional_documents", "column": "document_asset_id", "row": row})
    for row in domains["institutional_programs"]["rows"]:
        base = f"program.source-{row['source_row_ordinal']}"
        add(specs, key=base + ".primary", asset_type="INSTITUTIONAL_IMAGE", bucket="app-assets", prefix="institutional/programs",
            snapshot_hash=EXPECTED_H007_HASH, source_sheet="Secretaría de finanzas", source_row=row["source_row_ordinal"],
            source_url=row.get("primary_image_url"), relation={"kind": "fk", "table": "institutional_programs", "column": "primary_image_asset_id", "row": row})
        for index, url in enumerate(row.get("gallery_image_urls") or [], start=1):
            add(specs, key=f"{base}.gallery.{index}", asset_type="INSTITUTIONAL_IMAGE", bucket="app-assets", prefix="institutional/programs",
                snapshot_hash=EXPECTED_H007_HASH, source_sheet="Secretaría de finanzas", source_row=row["source_row_ordinal"], source_url=url)
    return specs


def process(specs: list[dict[str, object]]) -> tuple[list[dict[str, object]], list[dict[str, object]], dict[str, str], dict[str, bytes], dict[str, int]]:
    assets: list[dict[str, object]] = []
    sources: list[dict[str, object]] = []
    spec_asset: dict[str, str] = {}
    uploads: dict[str, bytes] = {}
    canonical_by_content: dict[tuple[str, str], dict[str, object]] = {}
    metrics = {"discovered": len(specs), "downloaded": 0, "uploaded": 0, "deduplicated": 0, "failed": 0}
    for spec in specs:
        desired = str(spec["desired_key"])
        try:
            data, mime, ext = download(spec)
            if spec["bucket"] == "documents" and mime != "application/pdf":
                raise ImportFailure("Document source is not a PDF")
            if spec["bucket"] != "documents" and not mime.startswith("image/"):
                raise ImportFailure("Visual source is not an image")
            digest = hashlib.sha256(data).hexdigest().upper()
            content_key = (str(spec["bucket"]), digest)
            canonical = canonical_by_content.get(content_key)
            if canonical is None:
                path = f"{spec['prefix']}/{digest[:2].lower()}/{digest.lower()}.{ext}"
                asset_id = stable_id(f"asset:{spec['bucket']}:{digest}")
                canonical = {"id": asset_id, "path": path}
                canonical_by_content[content_key] = canonical
                assets.append({
                    "id": asset_id, "asset_key": desired, "asset_type": spec["asset_type"],
                    "title": spec.get("title"), "alt_text": spec.get("title"),
                    "storage_bucket": spec["bucket"], "storage_path": path, "mime_type": mime,
                    "file_size": len(data), "content_sha256": digest, "status": "READY",
                })
                uploads[f"{spec['bucket']}/{path}"] = data
            else:
                asset_id = str(canonical["id"])
                metrics["deduplicated"] += 1
            metrics["downloaded"] += 1
        except (ImportFailure, OSError) as error:
            asset_id = stable_id(f"failed:{desired}")
            assets.append({
                "id": asset_id, "asset_key": desired, "asset_type": spec["asset_type"],
                "title": spec.get("title"), "alt_text": spec.get("title"),
                "storage_bucket": None, "storage_path": None, "mime_type": None,
                "file_size": None, "content_sha256": None, "status": "IMPORT_FAILED",
            })
            metrics["failed"] += 1
        spec_asset[desired] = asset_id
        sources.append({
            "id": stable_id(f"source:{desired}:{spec.get('source_sheet')}:{spec.get('source_row')}:{spec.get('source_column')}:{spec.get('source_url')}"),
            "asset_id": asset_id, "source_url": spec.get("source_url"),
            "source_sheet": spec.get("source_sheet"), "source_row_ordinal": spec.get("source_row"),
            "source_column": spec.get("source_column"), "source_snapshot_hash": spec["snapshot_hash"],
        })
    metrics["uploaded"] = len(uploads)
    return assets, sources, spec_asset, uploads, metrics


def apply_schema(env: dict[str, str]) -> None:
    base = env["SUPABASE_URL"]
    ref = urllib.parse.urlsplit(base).hostname.split(".")[0]
    token = env.get("SUPABASE_ACCESS_TOKEN", "")
    if not token:
        raise ImportFailure("Schema apply requires SUPABASE_ACCESS_TOKEN")
    query = MIGRATION.read_text(encoding="utf-8")
    body = json.dumps({"query": query}, separators=(",", ":")).encode()
    api(f"https://api.supabase.com/v1/projects/{ref}/database/query", token, "POST", body, bearer=True)


def apply_data(env: dict[str, str], specs: list[dict[str, object]], assets: list[dict[str, object]],
               sources: list[dict[str, object]], spec_asset: dict[str, str], uploads: dict[str, bytes],
               source_hash: str) -> None:
    base = env["SUPABASE_URL"].rstrip("/")
    key = env.get("SUPABASE_SECRET_KEY", "") or env.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not key:
        raise ImportFailure("Data apply requires server-only SUPABASE_SECRET_KEY")
    existing_rows = remote_json(base, key, "/rest/v1/app_assets?select=storage_bucket,storage_path,content_sha256,status&status=eq.READY&limit=1000")
    existing = {(row["storage_bucket"], row["storage_path"], row["content_sha256"]) for row in existing_rows}
    for full, data in uploads.items():
        bucket, path = full.split("/", 1)
        asset = next(row for row in assets if row.get("storage_bucket") == bucket and row.get("storage_path") == path)
        if (bucket, path, asset["content_sha256"]) in existing:
            continue
        encoded = "/".join(urllib.parse.quote(part, safe="") for part in path.split("/"))
        api(f"{base}/storage/v1/object/{bucket}/{encoded}", key, "POST", data,
            content_type=str(asset["mime_type"]), prefer=None, extra_headers={"x-upsert": "true"})
    upsert(base, key, "app_assets", assets)
    upsert(base, key, "asset_sources", sources)

    banners: list[dict[str, object]] = []
    popups: list[dict[str, object]] = []
    status_by_id = {row["id"]: row["status"] for row in assets}
    for spec in specs:
        relation = spec.get("relation") or {}
        asset_id = spec_asset[str(spec["desired_key"])]
        ready = status_by_id[asset_id] == "READY"
        if relation.get("kind") == "banner":
            row = relation["row"]
            placement = relation["placement"]
            banners.append({
                "id": stable_id(f"banner:{placement}:{spec['source_sheet']}:{spec['source_row']}:{spec.get('source_column')}"),
                "placement": placement, "title": None, "description": None,
                "action_label": None, "action_url": None, "company_raw": row.get("company_raw"),
                "category_raw": row.get("category_raw"), "image_asset_id": asset_id,
                "enabled": bool(ready and placement == "home"), "start_at": None, "end_at": None,
                "sort_order": row["sort_order"], "source_sheet": spec["source_sheet"],
                "source_row_ordinal": spec["source_row"], "source_column": spec.get("source_column"),
                "source_snapshot_hash": source_hash,
            })
        elif relation.get("kind") == "popup":
            row = relation["row"]
            popups.append({
                "id": stable_id(f"popup:{spec['source_sheet']}:{spec['source_row']}"),
                "title": None, "body": None, "image_asset_id": asset_id,
                "action_label": None, "action_url": None, "audience_raw": None,
                "enabled": False, "start_at": None, "end_at": None,
                "sort_order": row["sort_order"], "source_sheet": spec["source_sheet"],
                "source_row_ordinal": spec["source_row"], "source_snapshot_hash": source_hash,
            })
        elif relation.get("kind") == "fk" and ready:
            row = relation["row"]
            patch(base, key, relation["table"], {
                "source_snapshot_hash": EXPECTED_H007_HASH,
                "source_sheet": spec["source_sheet"],
                "source_row_ordinal": row["source_row_ordinal"],
            }, {relation["column"]: asset_id})
    upsert(base, key, "banners", banners)
    upsert(base, key, "popups", popups)


def remote_json(base: str, key: str, path: str) -> object:
    return json.loads(api(f"{base.rstrip('/')}{path}", key))


def verify(env: dict[str, str], assets: list[dict[str, object]], source_hash: str) -> dict[str, object]:
    base = env["SUPABASE_URL"].rstrip("/")
    key = env.get("SUPABASE_SECRET_KEY", "") or env.get("SUPABASE_SERVICE_ROLE_KEY", "")
    ready = [row for row in assets if row["status"] == "READY"]
    remote_assets = remote_json(base, key, "/rest/v1/app_assets?select=id,status,storage_bucket,storage_path,content_sha256&limit=1000")
    remote_banners = remote_json(base, key, f"/rest/v1/banners?select=id,placement,enabled&source_snapshot_hash=eq.{source_hash}&limit=1000")
    remote_popups = remote_json(base, key, f"/rest/v1/popups?select=id,enabled&source_snapshot_hash=eq.{source_hash}&limit=1000")
    remote_companies = remote_json(base, key, f"/rest/v1/companies?select=id&source_snapshot_hash=eq.{source_hash}&limit=1000")
    by_id = {row["id"]: row for row in remote_assets}
    if any(row["id"] not in by_id or by_id[row["id"]]["status"] != row["status"] for row in assets):
        raise ImportFailure("Remote asset registry reconciliation failed")
    verified_objects = 0
    seen: set[tuple[str, str]] = set()
    for row in ready:
        pair = (row["storage_bucket"], row["storage_path"])
        if pair in seen:
            continue
        seen.add(pair)
        encoded = "/".join(urllib.parse.quote(part, safe="") for part in str(row["storage_path"]).split("/"))
        data = api(f"{base}/storage/v1/object/public/{row['storage_bucket']}/{encoded}", "", "GET")
        if hashlib.sha256(data).hexdigest().upper() != row["content_sha256"]:
            raise ImportFailure("Stored object hash mismatch")
        verified_objects += 1
    return {
        "registry_rows": len(assets), "ready_assets": len(ready),
        "failed_assets": len(assets) - len(ready), "stored_objects_verified": verified_objects,
        "banners": len(remote_banners), "enabled_home_banners": sum(1 for row in remote_banners if row["placement"] == "home" and row["enabled"]),
        "popups": len(remote_popups), "enabled_popups": sum(1 for row in remote_popups if row["enabled"]),
        "companies": len(remote_companies),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--env-file", type=Path, default=ROOT / "supabase.env")
    parser.add_argument("--apply-schema", action="store_true")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    try:
        source_hash = file_hash(SOURCE)
        h007_hash = file_hash(H007_SOURCE)
        if source_hash != EXPECTED_SOURCE_HASH:
            raise ImportFailure(f"H-007.2 snapshot hash mismatch: {source_hash}")
        if h007_hash != EXPECTED_H007_HASH:
            raise ImportFailure("H-007 snapshot hash mismatch")
        source = json.loads(SOURCE.read_text(encoding="utf-8"))
        h007 = json.loads(H007_SOURCE.read_text(encoding="utf-8"))
        if args.apply_schema and not args.apply:
            env = read_env(args.env_file)
            for required in ("SUPABASE_URL", "SUPABASE_ACCESS_TOKEN"):
                if not env.get(required):
                    raise ImportFailure(f"Missing {required}")
            apply_schema(env)
            print(json.dumps({"mode": "schema-only", "source_snapshot_hash": source_hash, "schema_applied": True}, sort_keys=True))
            return 0
        specs = collect(source, h007, source_hash)
        assets, sources, spec_asset, uploads, metrics = process(specs)
        result: dict[str, object] = {
            "mode": "apply" if args.apply else "dry-run", "source_snapshot_hash": source_hash,
            "companies_source_rows": source["companies"]["physical_rows"],
            "companies_migrable_rows": source["companies"]["migrable_rows"], **metrics,
        }
        if args.apply_schema or args.apply:
            env = read_env(args.env_file)
            for required in ("SUPABASE_URL", "SUPABASE_ACCESS_TOKEN"):
                if not env.get(required):
                    raise ImportFailure(f"Missing {required}")
            if args.apply_schema:
                apply_schema(env)
            if args.apply:
                apply_data(env, specs, assets, sources, spec_asset, uploads, source_hash)
                result["remote"] = verify(env, assets, source_hash)
        print(json.dumps(result, ensure_ascii=False, sort_keys=True))
        return 0
    except (ImportFailure, OSError, KeyError, json.JSONDecodeError) as error:
        print(f"IMPORT FAILED: {error}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
