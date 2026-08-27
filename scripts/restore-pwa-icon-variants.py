#!/usr/bin/env python3
"""Restore the pre-H-BRANDING-UPLOAD-001 PWA asset metadata and settings links."""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATE = ROOT / "supabase/recovery/20260827001100_pwa_variant_previous_state.json"


def env_file() -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in (ROOT / "supabase.env").read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def request(url: str, key: str, method: str, payload: object, token: str | None = None) -> tuple[int, bytes]:
    headers = {"apikey": key, "Accept": "application/json", "Content-Type": "application/json", "User-Agent": "SutiApp-PWA-Recovery/1.0"}
    if token:
        headers["Authorization"] = "Bearer " + token
    try:
        with urllib.request.urlopen(urllib.request.Request(url, data=json.dumps(payload).encode(), headers=headers, method=method), timeout=60) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as error:
        return error.code, error.read()


def main() -> int:
    env = env_file()
    base = env["SUPABASE_URL"].rstrip("/")
    public = env["SUPABASE_PUBLISHABLE_KEY"]
    login_status, login_raw = request(
        base + "/auth/v1/token?grant_type=password", public, "POST",
        {"email": env["H005_TEST_EMAIL"], "password": env["H005_TEST_PASSWORD"]},
    )
    if login_status != 200:
        raise RuntimeError("Controlled admin login failed")
    token = json.loads(login_raw)["access_token"]
    state = json.loads(STATE.read_text(encoding="utf-8"))
    assets = [{
        "asset_key": item["asset_key"], "storage_path": item["storage_path"],
        "mime_type": item["mime_type"], "file_size": item["file_size"],
        "content_sha256": item["content_sha256"],
    } for item in state["assets"]]
    status, raw = request(
        base + "/rest/v1/rpc/register_branding_assets", public, "POST",
        {"p_assets": assets}, token,
    )
    if status != 200 or len(json.loads(raw)) != 4:
        raise RuntimeError(f"PWA recovery failed: HTTP {status}")
    print(json.dumps({"status": "RESTORED", "assets": 4, "old_storage_objects_retained": True}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
