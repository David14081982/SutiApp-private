#!/usr/bin/env python3
"""Validate, import and reconcile the bounded H-007 public-content snapshot."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, timedelta
from pathlib import Path

EXPECTED_SNAPSHOT_HASH = "80910E831B93C324B55B3E10A225999B122EB6FBC1826F83FD8BA49A8D4ED915"
EXPECTED_COUNTS = {
    "directory_members": 30,
    "minutes": 5,
    "institutional_documents": 8,
    "institutional_programs": 17,
}
TABLE_FIELDS = {
    "directory_members": ["name", "role", "image_url", "legacy_row_id", "sort_order", "source_sheet", "source_row_ordinal", "source_snapshot_hash"],
    "minutes": ["title", "description", "document_url", "image_url", "source_date_raw", "published_on", "sort_order", "source_sheet", "source_row_ordinal", "source_snapshot_hash"],
    "institutional_documents": ["kind", "title", "description", "document_url", "image_url", "sort_order", "source_sheet", "source_row_ordinal", "source_snapshot_hash"],
    "institutional_programs": ["category", "description", "primary_image_url", "gallery_image_urls", "phone_raw", "whatsapp_raw", "facebook_url", "instagram_url", "share_url", "location_raw", "whatsapp_url", "tiktok_url", "sort_order", "source_sheet", "source_row_ordinal", "source_snapshot_hash"],
}


class ImportFailure(RuntimeError):
    pass


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def read_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        values[name.strip()] = value.strip().strip('"').strip("'")
    return values


def excel_date(raw: object) -> str | None:
    if raw is None:
        return None
    try:
        return (date(1899, 12, 30) + timedelta(days=int(raw))).isoformat()
    except (TypeError, ValueError, OverflowError) as error:
        raise ImportFailure("Unexpected minute date serial") from error


def project(snapshot: dict[str, object], snapshot_hash: str) -> dict[str, list[dict[str, object]]]:
    domains = snapshot["domains"]
    if snapshot["source"].get("excluded_financial_range") != "'Secretaría de finanzas'!T:V":
        raise ImportFailure("Financial exclusion contract is missing")

    directory = []
    for order, row in enumerate(domains["directory"]["rows"], start=1):
        directory.append({
            "name": row.get("name"), "role": row.get("role"), "image_url": row.get("image_url"),
            "legacy_row_id": row.get("legacy_row_id"), "sort_order": order,
            "source_sheet": "Directorio", "source_row_ordinal": row["source_row_ordinal"],
            "source_snapshot_hash": snapshot_hash,
        })

    minutes = []
    for order, row in enumerate(domains["minutes"]["rows"], start=1):
        minutes.append({
            "title": row.get("title"), "description": row.get("description"),
            "document_url": row.get("document_url"), "image_url": row.get("image_url"),
            "source_date_raw": None if row.get("date_serial") is None else str(row["date_serial"]),
            "published_on": excel_date(row.get("date_serial")), "sort_order": order,
            "source_sheet": "Minutas de acuerdos", "source_row_ordinal": row["source_row_ordinal"],
            "source_snapshot_hash": snapshot_hash,
        })

    documents = []
    for order, row in enumerate(domains["institutional_documents"]["rows"], start=1):
        documents.append({
            "kind": row["kind"], "title": row.get("title"), "description": row.get("description"),
            "document_url": row.get("document_url"), "image_url": row.get("image_url"),
            "sort_order": order, "source_sheet": row["source_sheet"],
            "source_row_ordinal": row["source_row_ordinal"], "source_snapshot_hash": snapshot_hash,
        })

    programs = []
    forbidden = {"investment", "yield", "return", "rendimiento", "inversion", "inversión"}
    for order, row in enumerate(domains["institutional_programs"]["rows"], start=1):
        if forbidden.intersection(key.casefold() for key in row):
            raise ImportFailure("Financial field leaked into institutional program snapshot")
        programs.append({
            "category": row.get("category"), "description": row.get("description"),
            "primary_image_url": row.get("primary_image_url"),
            "gallery_image_urls": row.get("gallery_image_urls") or [],
            "phone_raw": row.get("phone_raw"), "whatsapp_raw": row.get("whatsapp_raw"),
            "facebook_url": row.get("facebook_url"), "instagram_url": row.get("instagram_url"),
            "share_url": row.get("share_url"), "location_raw": row.get("location_raw"),
            "whatsapp_url": row.get("whatsapp_url"), "tiktok_url": row.get("tiktok_url"),
            "sort_order": order, "source_sheet": "Secretaría de finanzas",
            "source_row_ordinal": row["source_row_ordinal"], "source_snapshot_hash": snapshot_hash,
        })

    result = {
        "directory_members": directory,
        "minutes": minutes,
        "institutional_documents": documents,
        "institutional_programs": programs,
    }
    actual = {table: len(rows) for table, rows in result.items()}
    if actual != EXPECTED_COUNTS:
        raise ImportFailure(f"Source count mismatch: {json.dumps(actual, sort_keys=True)}")
    for table, rows in result.items():
        required = set(TABLE_FIELDS[table])
        if any(set(row) != required for row in rows):
            raise ImportFailure(f"Unexpected import shape for {table}")
    return result


def api_request(url: str, key: str, method: str = "GET", body: bytes | None = None, prefer: str | None = None) -> bytes:
    headers = {"apikey": key, "Accept": "application/json"}
    if not key.startswith("sb_secret_"):
        headers["Authorization"] = f"Bearer {key}"
    if body is not None:
        headers["Content-Type"] = "application/json"
    if prefer:
        headers["Prefer"] = prefer
    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return response.read()
    except urllib.error.HTTPError as error:
        error.read()
        raise ImportFailure(f"Supabase request failed with HTTP {error.code}") from None
    except urllib.error.URLError as error:
        raise ImportFailure(f"Supabase connection failed: {error.reason}") from None


def remote_rows(base: str, key: str, table: str, snapshot_hash: str) -> list[dict[str, object]]:
    fields = ",".join(TABLE_FIELDS[table])
    query = urllib.parse.urlencode({"select": fields, "source_snapshot_hash": f"eq.{snapshot_hash}", "order": "sort_order.asc", "limit": "1000"})
    value = json.loads(api_request(f"{base.rstrip('/')}/rest/v1/{table}?{query}", key))
    if not isinstance(value, list):
        raise ImportFailure(f"Unexpected response for {table}")
    return value


def fingerprint(table: str, rows: list[dict[str, object]]) -> str:
    fields = TABLE_FIELDS[table]
    projected = [{field: row.get(field) for field in fields} for row in rows]
    projected.sort(key=lambda row: int(row["sort_order"]))
    raw = json.dumps(projected, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest().upper()


def apply_import(data: dict[str, list[dict[str, object]]], base: str, key: str, snapshot_hash: str) -> dict[str, object]:
    existing = {table: remote_rows(base, key, table, snapshot_hash) for table in EXPECTED_COUNTS}
    for table, rows in existing.items():
        if len(rows) not in (0, EXPECTED_COUNTS[table]):
            raise ImportFailure(f"Partial destination state for {table}: {len(rows)}/{EXPECTED_COUNTS[table]}")
        if rows and fingerprint(table, rows) != fingerprint(table, data[table]):
            raise ImportFailure(f"Existing destination fingerprint mismatch for {table}")

    inserted: dict[str, int] = {}
    for table, rows in data.items():
        inserted[table] = 0
        if existing[table]:
            continue
        payload = json.dumps(rows, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        api_request(f"{base.rstrip('/')}/rest/v1/{table}", key, method="POST", body=payload, prefer="return=minimal")
        inserted[table] = len(rows)

    reconciled = {table: remote_rows(base, key, table, snapshot_hash) for table in EXPECTED_COUNTS}
    for table, rows in reconciled.items():
        if len(rows) != EXPECTED_COUNTS[table] or fingerprint(table, rows) != fingerprint(table, data[table]):
            raise ImportFailure(f"Destination reconciliation failed for {table}")
    return {
        "inserted_rows": inserted,
        "destination_rows": {table: len(rows) for table, rows in reconciled.items()},
        "destination_total": sum(len(rows) for rows in reconciled.values()),
        "fingerprints_match": True,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=Path("data/h007-supabase-now-source.json"))
    parser.add_argument("--env-file", type=Path, default=Path("supabase.env"))
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    try:
        actual_hash = sha256(args.source)
        if actual_hash != EXPECTED_SNAPSHOT_HASH:
            raise ImportFailure(f"Snapshot hash mismatch: expected {EXPECTED_SNAPSHOT_HASH}, got {actual_hash}")
        snapshot = json.loads(args.source.read_text(encoding="utf-8"))
        data = project(snapshot, actual_hash)
        result: dict[str, object] = {
            "mode": "apply" if args.apply else "dry-run",
            "source_rows": EXPECTED_COUNTS,
            "source_total": sum(EXPECTED_COUNTS.values()),
            "processed_total": sum(EXPECTED_COUNTS.values()),
            "blank_source_rows": 12,
            "rejected_rows": 0,
            "lost_rows": 0,
            "snapshot_hash": actual_hash,
        }
        if args.apply:
            env = read_env(args.env_file)
            base = env.get("SUPABASE_URL", "")
            key = env.get("SUPABASE_SECRET_KEY", "") or env.get("SUPABASE_SERVICE_ROLE_KEY", "")
            if not base or not key:
                raise ImportFailure("Apply requires SUPABASE_URL and a server-only SUPABASE_SECRET_KEY")
            result.update(apply_import(data, base, key, actual_hash))
        print(json.dumps(result, ensure_ascii=False, sort_keys=True))
        return 0
    except (ImportFailure, KeyError, json.JSONDecodeError) as error:
        print(f"IMPORT FAILED: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
