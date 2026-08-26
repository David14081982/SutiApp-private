#!/usr/bin/env python3
"""Apply and reconcile H-DATA-CUTOVER-001 without downloading assets again."""
from __future__ import annotations

import argparse
import json
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXPECTED_ITEMS = 134


def environment():
    values = {}
    for raw in (ROOT / "supabase.env").read_text(encoding="utf-8-sig").splitlines():
        if raw.strip() and not raw.lstrip().startswith("#") and "=" in raw:
            key, value = raw.split("=", 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def request(url, token, method="GET", payload=None, prefer=None):
    headers = {"apikey": token, "Authorization": "Bearer " + token, "Content-Type": "application/json"}
    if prefer:
        headers["Prefer"] = prefer
    body = None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=120) as response:
        data = response.read()
        return json.loads(data) if data else None


def management_query(env, sql):
    ref = urllib.parse.urlsplit(env["SUPABASE_URL"]).hostname.split(".")[0]
    url = f"https://api.supabase.com/v1/projects/{ref}/database/query"
    req = urllib.request.Request(url, data=json.dumps({"query": sql}).encode(), headers={"Authorization": "Bearer " + env["SUPABASE_ACCESS_TOKEN"], "Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=180) as response:
        return json.loads(response.read())


def chunks(rows, size=100):
    for index in range(0, len(rows), size):
        yield rows[index:index + size]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    env = environment()
    base = env["SUPABASE_URL"]
    secret = env["SUPABASE_SECRET_KEY"]
    snapshot = json.loads((ROOT / "data/program-catalog-source.json").read_text(encoding="utf-8"))
    if len(snapshot["items"]) != EXPECTED_ITEMS:
        raise RuntimeError("SOURCE_ITEM_COUNT_MISMATCH")

    table_url = base + "/rest/v1/program_catalog_items?select=id&limit=1"
    schema_ready = True
    try:
        request(table_url, secret)
    except urllib.error.HTTPError as error:
        if error.code not in (404, 400):
            raise
        schema_ready = False
    if args.apply and not schema_ready:
        management_query(env, (ROOT / "supabase/migrations/20260822000100_create_program_catalog_cutover.sql").read_text(encoding="utf-8"))
        schema_ready = True
    if not args.apply:
        print(json.dumps({"status": "PASS", "mode": "dry-run", "schema_ready": schema_ready, "source_items": len(snapshot["items"]), "counts": snapshot["counts"]}, ensure_ascii=False, sort_keys=True))
        return
    if not schema_ready:
        raise RuntimeError("PROGRAM_CATALOG_SCHEMA_MISSING")

    item_rows = []
    for item in snapshot["items"]:
        item_rows.append({key: item[key] for key in ("id", "program_key", "name", "description", "category_raw", "quantity_raw", "presentation_raw", "contact_url_raw", "price_cash", "requires_quote", "request_mode", "legacy_boundary", "enabled", "sort_order", "source_sheet", "source_row_ordinal", "source_payload")} | {"source_snapshot_hash": snapshot["source_snapshot_hash"]})
    for batch in chunks(item_rows):
        request(base + "/rest/v1/program_catalog_items?on_conflict=id", secret, "POST", batch, "resolution=merge-duplicates,return=minimal")

    links = []
    for item in snapshot["items"]:
        for order, asset in enumerate(item["assets"], start=1):
            filters = "&".join((
                "source_sheet=eq." + urllib.parse.quote(item["source_sheet"]),
                "source_row_ordinal=eq." + str(item["source_row_ordinal"]),
                "source_column_letter=eq." + urllib.parse.quote(asset["source_column_letter"]),
                "source_url_sha256=eq." + asset["source_url_sha256"],
            ))
            found = request(base + "/rest/v1/historical_asset_sources?select=id,public_asset_id,private_asset_id,migration_status&" + filters, secret)
            if len(found) != 1 or found[0]["migration_status"] == "FAILED":
                continue
            source = found[0]
            links.append({"item_id": item["id"], "public_asset_id": source["public_asset_id"], "private_asset_id": source["private_asset_id"], "role": "cover" if order == 1 else "gallery", "sort_order": order, "source_column": asset["source_column"], "source_column_letter": asset["source_column_letter"]})
            request(base + "/rest/v1/historical_asset_sources?id=eq." + source["id"], secret, "PATCH", {"linked_entity_table": "program_catalog_items", "linked_entity_id": item["id"], "ownership_status": "RESOLVED_PROGRAM_CATALOG", "migration_status": "LINKED"}, "return=minimal")
    for batch in chunks(links):
        request(base + "/rest/v1/program_catalog_item_assets?on_conflict=item_id,source_column_letter,sort_order", secret, "POST", batch, "resolution=merge-duplicates,return=minimal")

    rows = request(base + "/rest/v1/program_catalog_items?select=id,program_key,request_mode,source_sheet,source_row_ordinal", secret)
    linked = request(base + "/rest/v1/program_catalog_item_assets?select=item_id,public_asset_id,private_asset_id", secret)
    farma = [row for row in rows if row["program_key"] == "farma"]
    if len(rows) != EXPECTED_ITEMS or len(farma) != 50 or any(row["request_mode"] != "supabase" for row in farma):
        raise RuntimeError("PROGRAM_CATALOG_RECONCILIATION_FAILED")
    print(json.dumps({"status": "PASS", "mode": "apply", "items": len(rows), "assets_linked": len(linked), "counts": snapshot["counts"]}, ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()
