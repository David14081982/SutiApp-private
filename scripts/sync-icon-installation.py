#!/usr/bin/env python3
"""Server-only branding authority, static PWA sync, and reversible write test."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import struct
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data/icon-installation-source.json"
MIGRATION = ROOT / "supabase/migrations/20260821000400_create_app_settings.sql"
EXPECTED_SOURCE_HASH = "62C384D8E78D02181CCC52D22F812EF612A193D74B7784182EEBB8126A8473D4"
NS = uuid.UUID("9d6065ce-0274-4fe5-aacf-12aaf5d53522")
ASSET_FIELDS = {
    "app_icon": ("app_icon_asset_id", "brand.pwa.512"),
    "institutional_seal": ("institutional_seal_asset_id", "brand.institutional-seal"),
    "favicon": ("favicon_asset_id", "brand.favicon-pwa-192"),
    "apple_touch": ("apple_touch_asset_id", "brand.pwa.apple-touch"),
    "pwa_192": ("pwa_icon_192_asset_id", "brand.favicon-pwa-192"),
    "pwa_512": ("pwa_icon_512_asset_id", "brand.pwa.512"),
    "pwa_maskable_512": ("pwa_maskable_512_asset_id", "brand.pwa.maskable-512"),
    "install_1": ("install_screen_1_asset_id", "pwa.install-screen-1"),
    "install_2": ("install_screen_2_asset_id", "pwa.install-screen-2"),
    "install_3": ("install_screen_3_asset_id", "pwa.install-screen-3"),
}
STATIC_ASSETS = {
    "favicon": "icon-192.png", "apple_touch": "icon-180.png",
    "pwa_192": "icon-192.png", "pwa_512": "icon-512.png",
    "pwa_maskable_512": "icon-maskable-512.png",
}
REQUIRED_ASSET_COLUMNS = (
    "app_icon_asset_id", "favicon_asset_id", "apple_touch_asset_id",
    "pwa_icon_192_asset_id", "pwa_icon_512_asset_id", "pwa_maskable_512_asset_id",
)
STATIC_DIMENSIONS = {
    "icon-180.png": (180, 180), "icon-192.png": (192, 192),
    "icon-512.png": (512, 512), "icon-maskable-512.png": (512, 512),
}


class SyncFailure(RuntimeError):
    pass


def read_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def call(url: str, key: str, method: str = "GET", body: bytes | None = None,
         *, bearer: bool = False, content_type: str = "application/json",
         prefer: str | None = None, extra: dict[str, str] | None = None) -> bytes:
    headers = {"Accept": "application/json", "User-Agent": "SutiApp-IconInstall/1.0"}
    headers["Authorization" if bearer else "apikey"] = ("Bearer " + key) if bearer else key
    if body is not None:
        headers["Content-Type"] = content_type
    if prefer:
        headers["Prefer"] = prefer
    if extra:
        headers.update(extra)
    try:
        with urllib.request.urlopen(urllib.request.Request(url, data=body, headers=headers, method=method), timeout=90) as response:
            return response.read()
    except urllib.error.HTTPError as error:
        detail = error.read(1024).decode("utf-8", "replace")
        raise SyncFailure(f"Remote request failed: HTTP {error.code} {detail[:300]}") from None
    except urllib.error.URLError as error:
        raise SyncFailure(f"Remote request failed: {error.reason}") from None


def rest(base: str, key: str, path: str) -> object:
    return json.loads(call(base.rstrip("/") + "/rest/v1/" + path, key))


def json_write(base: str, key: str, table: str, method: str, query: str,
               value: object, prefer: str = "return=minimal") -> None:
    payload = json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode()
    call(f"{base}/rest/v1/{table}?{query}", key, method, payload, prefer=prefer)


def stable_id(value: str) -> str:
    return str(uuid.uuid5(NS, value))


def detect(path: Path) -> tuple[bytes, str, str]:
    data = path.read_bytes()
    if not data or len(data) > 10_485_760:
        raise SyncFailure("Asset is empty or exceeds 10 MiB")
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return data, "image/png", "png"
    if data.startswith(b"\xff\xd8\xff"):
        return data, "image/jpeg", "jpg"
    if data.startswith((b"GIF87a", b"GIF89a")):
        return data, "image/gif", "gif"
    if data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return data, "image/webp", "webp"
    sample = data[:512].lstrip().lower()
    if sample.startswith(b"<svg") or (sample.startswith(b"<?xml") and b"<svg" in sample):
        return data, "image/svg+xml", "svg"
    raise SyncFailure("Unsupported image signature")


def apply_schema(env: dict[str, str]) -> None:
    ref = urllib.parse.urlsplit(env["SUPABASE_URL"]).hostname.split(".")[0]
    payload = json.dumps({"query": MIGRATION.read_text(encoding="utf-8")}).encode()
    call(f"https://api.supabase.com/v1/projects/{ref}/database/query",
         env["SUPABASE_ACCESS_TOKEN"], "POST", payload, bearer=True)


def asset_by_key(base: str, key: str, asset_key: str) -> dict[str, object] | None:
    encoded = urllib.parse.quote(asset_key, safe="")
    rows = rest(base, key, f"app_assets?select=*&asset_key=eq.{encoded}&limit=1")
    return rows[0] if rows else None


def upload_bytes(base: str, key: str, logical_key: str, data: bytes, mime: str, ext: str,
                 source_hash: str, source_column: str) -> dict[str, object]:
    digest = hashlib.sha256(data).hexdigest().upper()
    storage_path = f"branding/{digest[:2].lower()}/{digest.lower()}.{ext}"
    encoded_path = "/".join(urllib.parse.quote(part, safe="") for part in storage_path.split("/"))
    call(f"{base}/storage/v1/object/app-assets/{encoded_path}", key, "POST", data,
         content_type=mime, extra={"x-upsert": "true"})
    existing = asset_by_key(base, key, logical_key)
    asset_id = str(existing["id"]) if existing else stable_id("asset:" + logical_key)
    row = {
        "id": asset_id, "asset_key": logical_key, "asset_type": "BRANDING",
        "title": logical_key, "alt_text": logical_key.replace(".", " "),
        "storage_bucket": "app-assets", "storage_path": storage_path,
        "mime_type": mime, "file_size": len(data), "content_sha256": digest, "status": "READY",
    }
    json_write(base, key, "app_assets", "POST", "on_conflict=id", [row],
               "resolution=merge-duplicates,return=minimal")
    source = {
        "id": stable_id(f"source:{logical_key}:{digest}:{source_column}"),
        "asset_id": asset_id, "source_url": None, "source_sheet": "LOCAL_ADMIN",
        "source_row_ordinal": None, "source_column": source_column,
        "source_snapshot_hash": source_hash,
    }
    json_write(base, key, "asset_sources", "POST", "on_conflict=id", [source],
               "resolution=merge-duplicates,return=minimal")
    return row


def upload_asset(base: str, key: str, logical_key: str, path: Path,
                 source_hash: str, source_column: str) -> dict[str, object]:
    data, mime, ext = detect(path)
    return upload_bytes(base, key, logical_key, data, mime, ext, source_hash, source_column)


def patch_settings(base: str, key: str, values: dict[str, object]) -> None:
    json_write(base, key, "app_settings", "PATCH", "id=eq.primary", values)


def bootstrap(env: dict[str, str]) -> dict[str, object]:
    base = env["SUPABASE_URL"].rstrip("/")
    key = env.get("SUPABASE_SECRET_KEY", "") or env.get("SUPABASE_SERVICE_ROLE_KEY", "")
    seal = upload_asset(base, key, "brand.institutional-seal",
                        ROOT / "assets/branding/institutional-seal.svg",
                        EXPECTED_SOURCE_HASH, "institutional_seal")
    patch_settings(base, key, {"institutional_seal_asset_id": seal["id"]})
    return {"seal_asset_key": seal["asset_key"], "seal_hash": seal["content_sha256"]}


def settings(base: str, key: str) -> dict[str, object]:
    rows = rest(base, key, "app_settings?select=*&id=eq.primary&limit=1")
    if len(rows) != 1:
        raise SyncFailure(f"Expected one app_settings row, found {len(rows)}")
    return rows[0]


def png_dimensions(data: bytes) -> tuple[int, int] | None:
    if len(data) < 24 or not data.startswith(b"\x89PNG\r\n\x1a\n") or data[12:16] != b"IHDR":
        return None
    return struct.unpack(">II", data[16:24])


def verify(env: dict[str, str]) -> dict[str, object]:
    base = env["SUPABASE_URL"].rstrip("/")
    secret = env.get("SUPABASE_SECRET_KEY", "") or env.get("SUPABASE_SERVICE_ROLE_KEY", "")
    public = env["SUPABASE_PUBLISHABLE_KEY"]
    admin = settings(base, secret)
    public_row = settings(base, public)
    if admin != public_row:
        raise SyncFailure("Public settings projection differs from administrative read")
    if any(not admin.get(column) for column in REQUIRED_ASSET_COLUMNS):
        raise SyncFailure("Required branding asset relationship is missing")
    ids = {str(value) for name, value in admin.items() if name.endswith("_asset_id") and value}
    encoded = ",".join(ids)
    assets = rest(base, public, f"app_assets?select=id,asset_key,storage_bucket,storage_path,content_sha256,status&id=in.({encoded})&limit=50")
    if len({str(row["id"]) for row in assets}) != len(ids):
        raise SyncFailure("A configured asset is not publicly readable")
    for row in assets:
        path = "/".join(urllib.parse.quote(part, safe="") for part in str(row["storage_path"]).split("/"))
        data = call(f"{base}/storage/v1/object/public/{row['storage_bucket']}/{path}", "")
        if hashlib.sha256(data).hexdigest().upper() != row["content_sha256"]:
            raise SyncFailure("Storage object hash mismatch")
    return {"settings_rows": 1, "configured_assets": len(ids),
            "install_screens_configured": sum(bool(admin.get(f"install_screen_{i}_asset_id")) for i in (1, 2, 3)),
            "public_read": True, "storage_hashes": "PASS"}


def sync_static(env: dict[str, str], apply: bool) -> dict[str, object]:
    base = env["SUPABASE_URL"].rstrip("/")
    key = env.get("SUPABASE_SECRET_KEY", "") or env.get("SUPABASE_SERVICE_ROLE_KEY", "")
    row = settings(base, key)
    changed: list[str] = []
    for logical, filename in STATIC_ASSETS.items():
        column, _ = ASSET_FIELDS[logical]
        asset_rows = rest(base, key, f"app_assets?select=storage_bucket,storage_path,content_sha256,mime_type&id=eq.{row[column]}&limit=1")
        asset = asset_rows[0]
        encoded = "/".join(urllib.parse.quote(part, safe="") for part in asset["storage_path"].split("/"))
        data = call(f"{base}/storage/v1/object/{asset['storage_bucket']}/{encoded}", key)
        if asset.get("mime_type") != "image/png" or png_dimensions(data) != STATIC_DIMENSIONS[filename]:
            raise SyncFailure(f"Static PWA source must be an exact PNG {STATIC_DIMENSIONS[filename][0]}x{STATIC_DIMENSIONS[filename][1]}: {logical}")
        target = ROOT / filename
        if not target.exists() or hashlib.sha256(target.read_bytes()).hexdigest().upper() != asset["content_sha256"]:
            if filename not in changed:
                changed.append(filename)
            if apply:
                target.write_bytes(data)
    manifest_path = ROOT / "manifest.webmanifest"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    expected_text = {"name": row["app_name"], "short_name": row["short_name"], "description": row["description"]}
    if any(manifest.get(k) != v for k, v in expected_text.items()):
        changed.append("manifest.webmanifest")
        if apply:
            manifest.update(expected_text)
            manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    html_path = ROOT / "SutiApp.html"
    html = html_path.read_text(encoding="utf-8")
    next_html = re.sub(r"<title>.*?</title>", f"<title>{row['app_name']}</title>", html, count=1)
    if next_html != html:
        changed.append("SutiApp.html")
        if apply:
            html_path.write_text(next_html, encoding="utf-8")
    return {"mode": "apply" if apply else "verify", "changed": changed,
            "in_sync": not changed}


def test_write_restore(env: dict[str, str]) -> dict[str, object]:
    base = env["SUPABASE_URL"].rstrip("/")
    secret = env.get("SUPABASE_SECRET_KEY", "") or env.get("SUPABASE_SERVICE_ROLE_KEY", "")
    public = env["SUPABASE_PUBLISHABLE_KEY"]
    original = settings(base, secret)
    test_key = "test.icon-installation.write-restore"
    test_svg = (b'<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2" '
                b'viewBox="0 0 2 2"><rect width="2" height="2" fill="#910022"/></svg>')
    test_asset = upload_bytes(base, secret, test_key, test_svg, "image/svg+xml", "svg",
                              EXPECTED_SOURCE_HASH, "reversible_write_test")
    tested: list[str] = []
    try:
        for logical in ("app_icon", "institutional_seal", "install_1", "install_2", "install_3", "favicon"):
            column, _ = ASSET_FIELDS[logical]
            patch_settings(base, secret, {column: test_asset["id"]})
            first = settings(base, public)
            second = settings(base, public)
            if first.get(column) != test_asset["id"] or second.get(column) != test_asset["id"]:
                raise SyncFailure(f"Public persistence test failed for {logical}")
            tested.append(logical)
    finally:
        restore = {column: original.get(column) for column, _ in ASSET_FIELDS.values()}
        patch_settings(base, secret, restore)
        asset = asset_by_key(base, secret, test_key)
        if asset:
            encoded = "/".join(urllib.parse.quote(part, safe="") for part in str(asset["storage_path"]).split("/"))
            call(f"{base}/storage/v1/object/{asset['storage_bucket']}/{encoded}", secret, "DELETE")
            json_write(base, secret, "app_assets", "DELETE", f"id=eq.{asset['id']}", {})
    restored = settings(base, secret)
    original_business = {name: value for name, value in original.items() if name != "updated_at"}
    restored_business = {name: value for name, value in restored.items() if name != "updated_at"}
    if restored_business != original_business:
        raise SyncFailure("Original app_settings business values were not restored exactly")
    if asset_by_key(base, secret, test_key):
        raise SyncFailure("Temporary test asset row was not removed")
    return {"tested": tested, "storage_upload": "PASS", "public_clients": 2,
            "original_restored": True, "test_asset_removed": True}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--env-file", type=Path, default=ROOT / "supabase.env")
    parser.add_argument("--apply-schema", action="store_true")
    parser.add_argument("--bootstrap", action="store_true")
    parser.add_argument("--verify", action="store_true")
    parser.add_argument("--verify-static", action="store_true")
    parser.add_argument("--sync-static", action="store_true")
    parser.add_argument("--test-write-restore", action="store_true")
    args = parser.parse_args()
    try:
        source_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest().upper()
        if source_hash != EXPECTED_SOURCE_HASH:
            raise SyncFailure(f"Source snapshot hash mismatch: {source_hash}")
        env = read_env(args.env_file)
        results: dict[str, object] = {"source_snapshot_hash": source_hash}
        if args.apply_schema:
            apply_schema(env)
            results["schema_applied"] = True
        if args.bootstrap:
            results["bootstrap"] = bootstrap(env)
        if args.verify:
            results["remote"] = verify(env)
        if args.verify_static or args.sync_static:
            results["static"] = sync_static(env, args.sync_static)
        if args.test_write_restore:
            results["write_restore"] = test_write_restore(env)
        if len(results) == 1:
            results["mode"] = "dry-run"
        print(json.dumps(results, ensure_ascii=False, sort_keys=True))
        return 0
    except (SyncFailure, OSError, KeyError, json.JSONDecodeError) as error:
        print(f"SYNC FAILED: {error}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
