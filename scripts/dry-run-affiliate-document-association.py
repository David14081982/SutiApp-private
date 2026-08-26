#!/usr/bin/env python3
"""Read-only Phase 2 affiliate document association classifier.

The script reads the private historical inventory, Supabase registries and
Storage listings. It emits aggregate evidence only: no URL, email, UUID, token
or row-level PII is printed or written.
"""
from __future__ import annotations

import hashlib
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW_INVENTORY = Path(r"C:\tmp\master-asset-inventory.json")
PAGE = 1000


def load_env() -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in (ROOT / "supabase.env").read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def request(method: str, url: str, key: str, payload=None, extra=None):
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    if extra:
        headers.update(extra)
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=90) as response:
            raw = response.read().decode("utf-8")
            return response.status, json.loads(raw) if raw else None, dict(response.headers)
    except urllib.error.HTTPError as error:
        raw = error.read().decode("utf-8", errors="replace")
        try:
            body = json.loads(raw) if raw else None
        except json.JSONDecodeError:
            body = None
        return error.code, body, dict(error.headers)


def require(condition: bool, message: str):
    if not condition:
        raise RuntimeError(message)


def rest_all(base: str, key: str, table: str, fields: str, order: str | None = None):
    rows = []
    start = 0
    query = {"select": fields}
    if order:
        query["order"] = order
    url = f"{base}/rest/v1/{table}?{urllib.parse.urlencode(query, safe=',.*()!:_')}"
    while True:
        status, batch, _ = request("GET", url, key, extra={"Range": f"{start}-{start + PAGE - 1}"})
        require(status in (200, 206) and isinstance(batch, list), f"REST_READ_FAILED:{table}:{status}")
        rows.extend(batch)
        if len(batch) < PAGE:
            break
        start += len(batch)
        require(start < 200000, f"REST_PAGINATION_BOUND:{table}")
    return rows


def storage_objects(base: str, key: str, bucket: str):
    files: set[str] = set()
    pending = [""]
    visited = set()
    while pending:
        prefix = pending.pop()
        if prefix in visited:
            continue
        visited.add(prefix)
        offset = 0
        while True:
            status, items, _ = request(
                "POST", f"{base}/storage/v1/object/list/{bucket}", key,
                {"prefix": prefix, "limit": PAGE, "offset": offset,
                 "sortBy": {"column": "name", "order": "asc"}},
            )
            require(status == 200 and isinstance(items, list), f"STORAGE_LIST_FAILED:{bucket}:{status}")
            for item in items:
                name = str(item.get("name") or "")
                if not name:
                    continue
                full = f"{prefix}/{name}" if prefix else name
                if item.get("id") is None and item.get("metadata") is None:
                    pending.append(full)
                else:
                    files.add(full)
            if len(items) < PAGE:
                break
            offset += len(items)
            require(offset < 200000, f"STORAGE_PAGINATION_BOUND:{bucket}:{prefix}")
    return files


def source_key(row: dict):
    return (
        row.get("source_file_hash"), int(row.get("source_row_ordinal") or row.get("source_row") or 0),
        row.get("source_column_letter"), int(row.get("url_order") or 0),
        row.get("source_url_sha256"),
    )


def relation_key(row: dict):
    return (
        row.get("source_file_hash"), int(row.get("source_row_ordinal") or 0),
        row.get("source_column_letter"), int(row.get("url_order") or 0),
    )


def sha256(path: Path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest().upper()


def main() -> int:
    require(RAW_INVENTORY.is_file(), "PRIVATE_RAW_INVENTORY_MISSING")
    env = load_env()
    for name in ("SUPABASE_URL", "SUPABASE_SECRET_KEY"):
        require(env.get(name), f"MISSING_ENV:{name}")
    base = env["SUPABASE_URL"].rstrip("/")
    secret = env["SUPABASE_SECRET_KEY"]

    raw_payload = json.loads(RAW_INVENTORY.read_text(encoding="utf-8"))
    raw_records = raw_payload.get("records")
    require(raw_payload.get("schema_version") == 1 and isinstance(raw_records, list), "RAW_INVENTORY_CONTRACT")
    owner_records = [row for row in raw_records if row.get("source_system") == "owner_master_excel"]

    affiliates = rest_all(base, secret, "affiliates",
        "id,numero_control,historical_email_normalized,source_file_hash,source_row_ordinal")
    affiliate_files = rest_all(base, secret, "affiliate_files",
        "id,affiliate_id,numero_control,public_asset_id,private_asset_id,classification,file_key,file_type,source_column,source_column_letter,storage_bucket,storage_path,mime_type,sha256,file_size,source_row_ordinal,source_file_hash,url_order,status")
    private_assets = rest_all(base, secret, "private_assets",
        "id,storage_bucket,storage_path,mime_type,file_size,content_sha256,status")
    public_assets = rest_all(base, secret, "app_assets",
        "id,storage_bucket,storage_path,mime_type,file_size,content_sha256,status")
    sources = rest_all(base, secret, "historical_asset_sources",
        "id,public_asset_id,private_asset_id,source_system,source_file_hash,source_sheet,source_row_ordinal,source_column_letter,file_key,source_url_sha256,url_order,classification,target_domain,target_relation,expected_owner,ownership_status,linked_entity_table,linked_entity_id,migration_status,failure_code")

    relevant_buckets = sorted(
        {"private-assets", "public-assets"}
        | {str(row.get("storage_bucket")) for row in affiliate_files if row.get("storage_bucket")}
    )
    storage_by_bucket = {bucket: storage_objects(base, secret, bucket) for bucket in relevant_buckets}
    private_storage = storage_by_bucket["private-assets"]
    public_storage = storage_by_bucket["public-assets"]

    affiliate_by_id = {row["id"]: row for row in affiliates}
    affiliate_by_coordinate = {
        (row.get("source_file_hash"), int(row.get("source_row_ordinal") or 0)): row
        for row in affiliates
    }
    affiliates_by_control: dict[str, list[dict]] = defaultdict(list)
    for row in affiliates:
        if row.get("numero_control") is not None:
            affiliates_by_control[str(row["numero_control"])].append(row)

    source_by_key = {source_key(row): row for row in sources}
    af_by_key = {relation_key(row): row for row in affiliate_files}
    private_by_id = {row["id"]: row for row in private_assets}
    public_by_id = {row["id"]: row for row in public_assets}
    sources_by_private: dict[str, list[dict]] = defaultdict(list)
    sources_by_public: dict[str, list[dict]] = defaultdict(list)
    files_by_private: dict[str, list[dict]] = defaultdict(list)
    files_by_public: dict[str, list[dict]] = defaultdict(list)
    for row in sources:
        if row.get("private_asset_id"):
            sources_by_private[row["private_asset_id"]].append(row)
        if row.get("public_asset_id"):
            sources_by_public[row["public_asset_id"]].append(row)
    for row in affiliate_files:
        if row.get("private_asset_id"):
            files_by_private[row["private_asset_id"]].append(row)
        if row.get("public_asset_id"):
            files_by_public[row["public_asset_id"]].append(row)

    classifications = Counter({
        "ALREADY_CORRECTLY_LINKED": 0, "EXACT_MATCH": 0, "AMBIGUOUS_MATCH": 0,
        "NO_MATCH": 0, "WRONG_EXISTING_LINK": 0,
    })
    resolution_basis = Counter()
    reasons = Counter()
    by_file_key: dict[str, Counter] = defaultdict(Counter)
    duplicate_control_records = Counter()
    evaluated_relation_keys = set()

    for raw in owner_records:
        key = source_key(raw)
        rkey = key[:4]
        source = source_by_key.get(key)
        existing = af_by_key.get(rkey)
        evaluated_relation_keys.add(rkey)
        raw_control = raw.get("numero_control_raw")
        raw_control = None if raw_control is None else str(raw_control)
        control_candidates = affiliates_by_control.get(raw_control, []) if raw_control is not None else []

        uuid_candidate = None
        if source and source.get("linked_entity_table") == "affiliates":
            uuid_candidate = affiliate_by_id.get(source.get("linked_entity_id"))
        coordinate_candidate = affiliate_by_coordinate.get((raw.get("source_file_hash"), int(raw.get("source_row") or 0) - 1))
        if coordinate_candidate and coordinate_candidate.get("numero_control") != raw_control:
            coordinate_candidate = None

        candidate = None
        basis = None
        if uuid_candidate:
            candidate, basis = uuid_candidate, "EXISTING_AFFILIATE_UUID"
        elif len(control_candidates) == 1:
            candidate, basis = control_candidates[0], "UNIQUE_EXACT_NUMERO_CONTROL"
        elif coordinate_candidate:
            candidate, basis = coordinate_candidate, "UNIQUE_HISTORICAL_SOURCE_COORDINATE"
        elif len(control_candidates) > 1:
            basis = "AMBIGUOUS_NUMERO_CONTROL_ONLY"
        else:
            basis = "NO_STRONG_IDENTITY"

        if len(control_candidates) > 1:
            duplicate_control_records[basis] += 1

        classification = None
        if existing:
            asset = private_by_id.get(existing.get("private_asset_id")) if existing.get("private_asset_id") else public_by_id.get(existing.get("public_asset_id"))
            expected_asset_id = source.get("private_asset_id") if source and source.get("private_asset_id") else (source.get("public_asset_id") if source else None)
            object_set = storage_by_bucket.get(existing.get("storage_bucket"), set())
            correct = bool(
                candidate and existing.get("affiliate_id") == candidate.get("id")
                and existing.get("numero_control") == candidate.get("numero_control")
                and source and source.get("linked_entity_id") == candidate.get("id")
                and expected_asset_id in (existing.get("private_asset_id"), existing.get("public_asset_id"))
                and asset and asset.get("storage_bucket") == existing.get("storage_bucket")
                and asset.get("storage_path") == existing.get("storage_path")
                and asset.get("content_sha256") == existing.get("sha256")
                and int(asset.get("file_size") or 0) == int(existing.get("file_size") or -1)
                and existing.get("storage_path") in object_set
            )
            classification = "ALREADY_CORRECTLY_LINKED" if correct else "WRONG_EXISTING_LINK"
            if not correct:
                if not candidate:
                    reasons["EXISTING_LINK_WITHOUT_STRONG_IDENTITY"] += 1
                if candidate and existing.get("affiliate_id") != candidate.get("id"):
                    reasons["AFFILIATE_UUID_MISMATCH"] += 1
                if not source or source.get("linked_entity_id") != (candidate or {}).get("id"):
                    reasons["PROVENANCE_LINK_MISMATCH"] += 1
                if not asset:
                    reasons["ASSET_REGISTRY_REFERENCE_MISSING"] += 1
                elif existing.get("storage_path") not in object_set:
                    reasons["STORAGE_OBJECT_MISSING"] += 1
        elif candidate:
            classification = "EXACT_MATCH"
        elif len(control_candidates) > 1:
            classification = "AMBIGUOUS_MATCH"
        else:
            classification = "NO_MATCH"

        classifications[classification] += 1
        resolution_basis[basis] += 1
        by_file_key[str(raw.get("file_key") or "UNKNOWN")][classification] += 1

    extra_existing = [row for row in affiliate_files if relation_key(row) not in evaluated_relation_keys]
    if extra_existing:
        classifications["WRONG_EXISTING_LINK"] += len(extra_existing)
        reasons["EXISTING_RELATION_WITHOUT_OWNER_INVENTORY_RECORD"] += len(extra_existing)

    orphan_asset_reasons = Counter()
    for asset in private_assets:
        asset_id = asset["id"]
        if not sources_by_private[asset_id] and not files_by_private[asset_id]:
            orphan_asset_reasons["PRIVATE_REGISTRY_WITHOUT_SOURCE_OR_RELATION"] += 1
        if asset.get("storage_path") not in private_storage:
            orphan_asset_reasons["PRIVATE_REGISTRY_WITHOUT_STORAGE_OBJECT"] += 1
    for asset in public_assets:
        if asset.get("storage_bucket") != "public-assets":
            continue
        asset_id = asset["id"]
        if not sources_by_public[asset_id] and not files_by_public[asset_id]:
            orphan_asset_reasons["PUBLIC_REGISTRY_WITHOUT_SOURCE_OR_RELATION"] += 1
        if asset.get("storage_path") not in public_storage:
            orphan_asset_reasons["PUBLIC_REGISTRY_WITHOUT_STORAGE_OBJECT"] += 1

    registered_paths_by_bucket: dict[str, set[str]] = defaultdict(set)
    for row in private_assets + public_assets:
        if row.get("storage_bucket") and row.get("storage_path"):
            registered_paths_by_bucket[row["storage_bucket"]].add(row["storage_path"])
    orphan_storage = Counter({
        bucket: len(objects - registered_paths_by_bucket[bucket])
        for bucket, objects in storage_by_bucket.items()
    })
    orphan_storage_fingerprints = {
        bucket: sorted(
            hashlib.sha256(f"{bucket}:{path}".encode("utf-8")).hexdigest().upper()
            for path in (objects - registered_paths_by_bucket[bucket])
        )
        for bucket, objects in storage_by_bucket.items()
        if objects - registered_paths_by_bucket[bucket]
    }

    control_counts = Counter(row.get("numero_control") for row in affiliates if row.get("numero_control") is not None)
    email_counts = Counter(row.get("historical_email_normalized") for row in affiliates if row.get("historical_email_normalized"))
    duplicate_census = {
        "numero_control_groups": sum(1 for count in control_counts.values() if count > 1),
        "numero_control_rows": sum(count for count in control_counts.values() if count > 1),
        "normalized_email_groups": sum(1 for count in email_counts.values() if count > 1),
        "normalized_email_rows": sum(count for count in email_counts.values() if count > 1),
    }

    profile_authority = [
        row for row in affiliate_files
        if row.get("file_key") == "profile_photo" and row.get("source_column") == "Photo"
        and row.get("source_column_letter") == "DK" and row.get("classification") == "PRIVATE"
        and row.get("status") == "READY"
    ]
    profile_by_affiliate = Counter(row["affiliate_id"] for row in profile_authority)
    profile_authority_summary = {
        "rows": len(profile_authority),
        "affiliates": len(profile_by_affiliate),
        "affiliates_with_multiple_authority_rows": sum(1 for count in profile_by_affiliate.values() if count > 1),
    }

    source_status = Counter(row.get("migration_status") for row in sources)
    non_affiliate_private_sources = sum(
        1 for row in sources
        if row.get("classification") == "PRIVATE" and row.get("expected_owner") != "affiliate"
    )
    owner_source_live = sum(1 for row in sources if row.get("source_system") == "owner_master_excel")
    require(owner_source_live == len(owner_records), "OWNER_INVENTORY_LIVE_SOURCE_COUNT_MISMATCH")
    require(sum(classifications.values()) == len(owner_records) + len(extra_existing), "CLASSIFICATION_TOTAL_MISMATCH")

    result = {
        "status": "DRY_RUN_PASS",
        "mutation_counts": {"database_writes": 0, "storage_writes": 0, "auth_writes": 0, "google_writes": 0},
        "inputs": {
            "private_inventory_sha256": sha256(RAW_INVENTORY),
            "private_inventory_records": len(raw_records),
            "affiliate_candidate_records": len(owner_records),
            "live_affiliates": len(affiliates),
            "live_affiliate_files": len(affiliate_files),
            "live_private_assets": len(private_assets),
            "live_historical_sources": len(sources),
            "storage_objects_by_bucket": {bucket: len(objects) for bucket, objects in storage_by_bucket.items()},
        },
        "association_classification": dict(sorted(classifications.items())),
        "resolution_basis": dict(sorted(resolution_basis.items())),
        "duplicate_numero_control_records": dict(sorted(duplicate_control_records.items())),
        "duplicate_census": duplicate_census,
        "matching_prohibitions": {"name_used": 0, "email_used": 0, "heuristic_merge": 0},
        "wrong_link_reasons": dict(sorted(reasons.items())),
        "orphan_asset_reasons": dict(sorted(orphan_asset_reasons.items())),
        "orphan_storage_objects": dict(sorted(orphan_storage.items())),
        "orphan_storage_fingerprints": orphan_storage_fingerprints,
        "profile_photo_authority": profile_authority_summary,
        "source_migration_status": dict(sorted(source_status.items(), key=lambda item: str(item[0]))),
        "protected_non_affiliate_private_sources": non_affiliate_private_sources,
        "classification_by_file_key": {
            key: dict(sorted(value.items())) for key, value in sorted(by_file_key.items())
        },
    }
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(json.dumps({"status": "DRY_RUN_FAIL", "error": str(error)}), file=sys.stderr)
        raise SystemExit(1)
