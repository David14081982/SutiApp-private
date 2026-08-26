#!/usr/bin/env python3
"""Import the immutable H-007.3 company projection using existing H-007.2 assets."""

from __future__ import annotations

import argparse
import hashlib
import json
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data/h0073-companies-source.json"
EXPECTED_HASH = "41871AE58415B5654F37058BF361350E598B93DD8AFF9EF3BA07BC94ECA4718F"
NS = uuid.UUID("77414130-eaf8-4313-9241-362cc6955f5a")


class ImportFailure(RuntimeError):
    pass


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


def request(url: str, key: str, method: str = "GET", body: bytes | None = None,
            prefer: str | None = None) -> bytes:
    headers = {"Accept": "application/json", "apikey": key,
               "User-Agent": "SutiApp-H0073/1.0"}
    if body is not None:
        headers["Content-Type"] = "application/json"
    if prefer:
        headers["Prefer"] = prefer
    try:
        with urllib.request.urlopen(
            urllib.request.Request(url, data=body, headers=headers, method=method), timeout=60
        ) as response:
            return response.read()
    except urllib.error.HTTPError as error:
        detail = error.read(1024).decode("utf-8", "replace")
        raise ImportFailure(f"Remote request failed: HTTP {error.code} {detail[:300]}") from None
    except urllib.error.URLError as error:
        raise ImportFailure(f"Remote request failed: {error.reason}") from None


def get_rows(base: str, key: str, table: str, query: str) -> list[dict[str, object]]:
    raw = request(f"{base}/rest/v1/{table}?{query}", key)
    return json.loads(raw)


def upsert(base: str, key: str, table: str, rows: list[dict[str, object]],
           conflict: str = "id") -> None:
    payload = json.dumps(rows, ensure_ascii=False, separators=(",", ":")).encode()
    encoded_conflict = urllib.parse.quote(conflict, safe=",")
    request(f"{base}/rest/v1/{table}?on_conflict={encoded_conflict}", key, "POST", payload,
            "resolution=merge-duplicates,return=minimal")


def load_source() -> tuple[dict[str, object], str]:
    source_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest().upper()
    if source_hash != EXPECTED_HASH:
        raise ImportFailure(f"Snapshot hash mismatch: {source_hash}")
    source = json.loads(SOURCE.read_text(encoding="utf-8"))
    rows = source.get("rows") or []
    if len(rows) != 33 or len({row["source_row_ordinal"] for row in rows}) != 33:
        raise ImportFailure("Expected exactly 33 unique company source rows")
    return source, source_hash


def build_projection(source: dict[str, object], source_hash: str, base: str,
                     key: str) -> tuple[list[dict[str, object]], list[dict[str, object]]]:
    refs = get_rows(
        base, key, "asset_sources",
        "select=asset_id,source_row_ordinal,source_column"
        "&source_sheet=eq.Convenios2&order=source_row_ordinal.asc&limit=100",
    )
    assets_by_coordinate: dict[tuple[int, str], set[str]] = {}
    for ref in refs:
        coordinate = (int(ref["source_row_ordinal"]), str(ref["source_column"]))
        assets_by_coordinate.setdefault(coordinate, set()).add(str(ref["asset_id"]))

    companies: list[dict[str, object]] = []
    relations: list[dict[str, object]] = []
    for sort_order, row in enumerate(source["rows"], start=1):
        source_row = int(row["source_row_ordinal"])
        company_id = stable_id(f"company:Convenios2:{source_row}")
        companies.append({
            "id": company_id,
            "legal_name": None,
            "display_name": row["name_raw"],
            "description": row.get("description_raw"),
            "category_raw": row.get("category_raw"),
            "contact_name": None,
            "phone_raw": row.get("phone_raw"),
            "whatsapp_raw": None,
            "email_raw": None,
            "website_url": None,
            "address_raw": None,
            "location_raw": None,
            "social_links": {},
            "status_raw": None,
            "logo_asset_id": None,
            "sort_order": sort_order,
            "source_sheet": "Convenios2",
            "source_row_ordinal": source_row,
            "source_snapshot_hash": source_hash,
        })
        for asset_order, column in enumerate(row["asset_columns"], start=1):
            candidates = assets_by_coordinate.get((source_row, column), set())
            if len(candidates) != 1:
                raise ImportFailure(
                    f"Asset coordinate Convenios2!{column}{source_row} resolved {len(candidates)} rows"
                )
            relations.append({
                "company_id": company_id,
                "asset_id": next(iter(candidates)),
                "role": "cover" if column == "E" else "gallery",
                "sort_order": asset_order,
            })
    if len(relations) != 35:
        raise ImportFailure(f"Expected 35 company asset links, found {len(relations)}")
    return companies, relations


def verify(base: str, key: str, source_hash: str) -> dict[str, object]:
    encoded_hash = urllib.parse.quote(source_hash, safe="")
    companies = get_rows(base, key, "companies",
                         f"select=id,source_row_ordinal&source_snapshot_hash=eq.{encoded_hash}&limit=100")
    company_ids = {str(row["id"]) for row in companies}
    relations = get_rows(base, key, "company_assets", "select=company_id,asset_id,role&limit=200")
    scoped_relations = [row for row in relations if str(row["company_id"]) in company_ids]
    if len(companies) != 33 or len(company_ids) != 33:
        raise ImportFailure(f"Company reconciliation failed: {len(companies)}/33")
    if len(scoped_relations) != 35:
        raise ImportFailure(f"Company asset reconciliation failed: {len(scoped_relations)}/35")
    if sum(row["role"] == "cover" for row in scoped_relations) != 33:
        raise ImportFailure("Primary cover reconciliation failed")
    return {
        "companies": len(companies),
        "company_asset_links": len(scoped_relations),
        "covers": sum(row["role"] == "cover" for row in scoped_relations),
        "gallery": sum(row["role"] == "gallery" for row in scoped_relations),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--env-file", type=Path, default=ROOT / "supabase.env")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    try:
        source, source_hash = load_source()
        env = read_env(args.env_file)
        base = env.get("SUPABASE_URL", "").rstrip("/")
        key = env.get("SUPABASE_SECRET_KEY", "") or env.get("SUPABASE_SERVICE_ROLE_KEY", "")
        if not base or not key:
            raise ImportFailure("SUPABASE_URL and server-only SUPABASE_SECRET_KEY are required")
        companies, relations = build_projection(source, source_hash, base, key)
        result: dict[str, object] = {
            "mode": "apply" if args.apply else "dry-run",
            "source_snapshot_hash": source_hash,
            "companies": len(companies),
            "company_asset_links": len(relations),
            "data_modified": bool(args.apply),
        }
        if args.apply:
            upsert(base, key, "companies", companies)
            upsert(base, key, "company_assets", relations, "company_id,asset_id,role")
            result["remote"] = verify(base, key, source_hash)
        print(json.dumps(result, ensure_ascii=False, sort_keys=True))
        return 0
    except (ImportFailure, OSError, KeyError, json.JSONDecodeError) as error:
        print(f"IMPORT FAILED: {error}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
