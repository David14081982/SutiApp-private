#!/usr/bin/env python3
"""Read-only remote verification for H-007. Never prints credentials or row content."""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from pathlib import Path

TABLES = {
    "directory_members": 30,
    "minutes": 5,
    "institutional_documents": 8,
    "institutional_programs": 17,
}


def env_values() -> dict[str, str]:
    result: dict[str, str] = {}
    for raw in Path("supabase.env").read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            result[key.strip()] = value.strip().strip('"').strip("'")
    return result


def anon_count(base: str, key: str, table: str) -> int:
    request = urllib.request.Request(
        f"{base.rstrip('/')}/rest/v1/{table}?select=id",
        headers={"apikey": key, "Authorization": f"Bearer {key}", "Prefer": "count=exact", "Range": "0-0"},
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            content_range = response.headers.get("Content-Range", "")
            response.read()
    except urllib.error.HTTPError as error:
        error.read()
        raise RuntimeError(f"anonymous read failed for {table} with HTTP {error.code}") from None
    try:
        return int(content_range.rsplit("/", 1)[1])
    except (IndexError, ValueError) as error:
        raise RuntimeError(f"missing exact count for {table}") from error


def main() -> int:
    env = env_values()
    base = env["SUPABASE_URL"]
    publishable = env["SUPABASE_PUBLISHABLE_KEY"]
    anon_counts = {table: anon_count(base, publishable, table) for table in TABLES}
    if anon_counts != TABLES:
        raise RuntimeError(f"anonymous count mismatch: {anon_counts}")
    print(json.dumps({
        "status": "PASS", "tables": 4, "destination_rows": sum(anon_counts.values()),
        "public_read_tables": 4,
        "anonymous_counts": anon_counts,
    }, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
