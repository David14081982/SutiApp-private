#!/usr/bin/env python3
"""Reversible real-session verification for transactional branding uploads."""

from __future__ import annotations

import hashlib
import json
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def env_file() -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in (ROOT / "supabase.env").read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def request(url: str, key: str, method: str = "GET", body: bytes | None = None,
            token: str | None = None, content_type: str = "application/json",
            prefer: str | None = None, extra: dict[str, str] | None = None) -> tuple[int, bytes]:
    headers = {"apikey": key, "Accept": "application/json", "User-Agent": "SutiApp-Branding-Live/1.0"}
    if token:
        headers["Authorization"] = "Bearer " + token
    if body is not None:
        headers["Content-Type"] = content_type
    if prefer:
        headers["Prefer"] = prefer
    if extra:
        headers.update(extra)
    try:
        with urllib.request.urlopen(urllib.request.Request(url, data=body, headers=headers, method=method), timeout=60) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as error:
        return error.code, error.read()


def login(base: str, key: str, email: str, password: str) -> str:
    status, raw = request(
        base + "/auth/v1/token?grant_type=password", key, "POST",
        json.dumps({"email": email, "password": password}).encode(),
    )
    if status != 200:
        raise RuntimeError("Controlled login failed")
    return json.loads(raw)["access_token"]


def rows(base: str, key: str, path: str, token: str | None = None) -> list[dict[str, object]]:
    status, raw = request(base + "/rest/v1/" + path, key, token=token)
    if status != 200:
        raise RuntimeError(f"Read failed: HTTP {status}")
    return json.loads(raw)


def write(base: str, key: str, table: str, method: str, payload: object,
          *, query: str = "", token: str | None = None, returning: bool = False) -> tuple[int, bytes]:
    return request(
        f"{base}/rest/v1/{table}?{query}", key, method,
        json.dumps(payload, separators=(",", ":")).encode(), token,
        prefer="return=representation" if returning else "return=minimal",
    )


def main() -> int:
    env = env_file()
    base = env["SUPABASE_URL"].rstrip("/")
    public = env["SUPABASE_PUBLISHABLE_KEY"]
    secret = env["SUPABASE_SECRET_KEY"]
    tokens = {
        alias: login(base, public, env[alias + "_EMAIL"], env[alias + "_PASSWORD"])
        for alias in ("H005_TEST", "H005_TEST2")
    }
    original = rows(base, secret, "app_settings?select=install_screen_3_asset_id&id=eq.primary")[0]
    existing = rows(base, secret, "app_assets?select=id&asset_key=eq.pwa.install-screen-3")
    if original["install_screen_3_asset_id"] is not None or existing:
        raise RuntimeError("Install screen 3 is configured; reversible fixture refuses to overwrite it")

    marker = uuid.uuid4().hex
    data = f'<svg xmlns="http://www.w3.org/2000/svg" width="9" height="16"><!--{marker}--><rect width="9" height="16" fill="#910022"/></svg>'.encode()
    digest = hashlib.sha256(data).hexdigest()
    path = f"branding/admin/pwa.install-screen-3/{digest}.svg"
    payload = {"p_assets": [{
        "asset_key": "pwa.install-screen-3",
        "storage_path": path,
        "mime_type": "image/svg+xml",
        "file_size": len(data),
        "content_sha256": digest.upper(),
    }]}
    created_id: str | None = None
    try:
        status, _ = request(
            base + "/storage/v1/object/app-assets/" + path,
            public, "POST", data, tokens["H005_TEST"], "image/svg+xml",
            extra={"x-upsert": "false"},
        )
        if status not in (200, 201):
            raise RuntimeError(f"Storage fixture upload failed: HTTP {status}")

        status, raw = request(
            base + "/rest/v1/rpc/register_branding_assets", public, "POST",
            json.dumps(payload, separators=(",", ":")).encode(), tokens["H005_TEST"],
        )
        if status != 200:
            raise RuntimeError(f"Transactional RPC failed: HTTP {status} {raw[:300]!r}")
        result = json.loads(raw)
        if len(result) != 1:
            raise RuntimeError("Transactional RPC returned an unexpected row count")
        created_id = result[0]["asset_id"]

        linked = rows(base, public, "app_settings?select=install_screen_3_asset_id&id=eq.primary", tokens["H005_TEST2"])[0]
        if linked["install_screen_3_asset_id"] != created_id:
            raise RuntimeError("Cross-client settings link is missing")
        provenance = rows(base, secret, f"asset_sources?select=id&asset_id=eq.{created_id}&source_sheet=eq.ADMIN_H009")
        if len(provenance) != 1:
            raise RuntimeError("Transactional provenance is missing")

        denied_status, _ = request(
            base + "/rest/v1/rpc/register_branding_assets", public, "POST",
            json.dumps(payload, separators=(",", ":")).encode(), tokens["H005_TEST2"],
        )
        if denied_status not in (401, 403):
            raise RuntimeError(f"Normal user RPC was not denied: HTTP {denied_status}")
        anonymous_status, _ = request(
            base + "/rest/v1/rpc/register_branding_assets", public, "POST",
            json.dumps(payload, separators=(",", ":")).encode(),
        )
        if anonymous_status not in (401, 403):
            raise RuntimeError(f"Anonymous RPC was not denied: HTTP {anonymous_status}")
    finally:
        write(base, secret, "app_settings", "PATCH", {"install_screen_3_asset_id": original["install_screen_3_asset_id"]}, query="id=eq.primary")
        if created_id:
            write(base, secret, "app_assets", "DELETE", {}, query=f"id=eq.{created_id}")
        request(base + "/storage/v1/object/app-assets/" + path, secret, "DELETE")

    restored = rows(base, secret, "app_settings?select=install_screen_3_asset_id&id=eq.primary")[0]
    if restored != original or rows(base, secret, "app_assets?select=id&asset_key=eq.pwa.install-screen-3"):
        raise RuntimeError("Reversible fixture did not restore the original authority state")
    print(json.dumps({
        "status": "PASS", "transactional_link": "PASS", "provenance": "PASS",
        "cross_client": "PASS", "normal_user": "DENIED", "anonymous": "DENIED",
        "fixture_restored": True, "credentials_exposed": False,
    }, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
