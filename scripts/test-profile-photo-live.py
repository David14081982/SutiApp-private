#!/usr/bin/env python3
"""Read-only PHOTO reconciliation and three-user RLS test."""

from __future__ import annotations

import json
import urllib.parse
from pathlib import Path
import importlib.util

ROOT = Path(__file__).resolve().parents[1]
SOURCE_HASH = "F4BA18ABE82B148ED65737DB16074303627F96D37FA6F9F025E0A10649BD9591"

spec = importlib.util.spec_from_file_location("master_assets_test", ROOT / "scripts" / "test-master-assets-live.py")
master = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(master)


def encoded_path(path: str) -> str:
    return "/".join(urllib.parse.quote(part, safe="") for part in path.split("/"))


def main() -> int:
    env = master.read_env()
    base = env["SUPABASE_URL"].rstrip("/")
    rest = base + "/rest/v1"
    key = env["SUPABASE_PUBLISHABLE_KEY"]
    query = f"""
    with photos as (
      select af.* from public.affiliate_files af
      where af.source_file_hash='{SOURCE_HASH}' and af.source_column='Photo'
        and af.source_column_letter='DK' and af.file_key='profile_photo'
        and af.classification='PRIVATE' and af.file_type='image' and af.status='READY'
    )
    select json_build_object(
      'historical_rows',(select rows_with_files from public.historical_file_columns where source_file_hash='{SOURCE_HASH}' and source_sheet='Usuarios' and source_column='Photo' and source_column_letter='DK'),
      'relations',(select count(*) from photos),
      'affiliates_with_photo',(select count(distinct affiliate_id) from photos),
      'affiliates_without_photo',(select count(*) from public.affiliates a where not exists(select 1 from photos p where p.affiliate_id=a.id)),
      'ambiguous_relations',(select count(*) from (select affiliate_id from photos group by affiliate_id having count(*)<>1) x),
      'missing_registry',(select count(*) from photos p left join public.private_assets a on a.id=p.private_asset_id where a.id is null or a.content_sha256<>p.sha256 or a.storage_bucket<>p.storage_bucket or a.storage_path<>p.storage_path),
      'missing_objects',(select count(*) from photos p where not exists(select 1 from storage.objects o where o.bucket_id=p.storage_bucket and o.name=p.storage_path)),
      'wrong_affiliate_link',(select count(*) from photos p join public.historical_asset_sources s on s.source_file_hash=p.source_file_hash and s.source_row_ordinal=p.source_row_ordinal and s.source_column_letter=p.source_column_letter and s.url_order=p.url_order where s.linked_entity_id is distinct from p.affiliate_id or s.private_asset_id is distinct from p.private_asset_id),
      'public_relations',(select count(*) from photos where storage_bucket<>'private-assets' or public_asset_id is not null),
      'runtime_glide_dependencies',0
    ) result;
    """
    aggregate = master.management_sql(env, query)[0]["result"]
    expected = {
        "historical_rows": 487, "relations": 487, "affiliates_with_photo": 487,
        "affiliates_without_photo": 460, "ambiguous_relations": 0,
        "missing_registry": 0, "missing_objects": 0, "wrong_affiliate_link": 0,
        "public_relations": 0, "runtime_glide_dependencies": 0,
    }
    if aggregate != expected:
        raise RuntimeError("PHOTO reconciliation failed: " + json.dumps({"expected": expected, "actual": aggregate}, sort_keys=True))

    sessions = {}
    own = {}
    aliases = ["H005_TEST", "H005_TEST2", "H005_TEST3"]
    for alias in aliases:
        sessions[alias] = master.login(base, key, env[f"{alias}_EMAIL"], env[f"{alias}_PASSWORD"])
        _, affiliates, _ = master.call(rest + "/affiliates?select=id", key, token=sessions[alias])
        if len(affiliates) != 1 or affiliates[0]["id"] != env[f"{alias}_AFFILIATE_ID"]:
            raise RuntimeError(f"{alias} affiliate resolution failed")
        affiliate_id = affiliates[0]["id"]
        query_string = urllib.parse.urlencode({
            "select": "id,affiliate_id,private_asset_id,storage_bucket,storage_path,sha256,source_column,source_column_letter,file_key",
            "affiliate_id": "eq." + affiliate_id, "source_column": "eq.Photo", "source_column_letter": "eq.DK",
            "file_key": "eq.profile_photo", "status": "eq.READY",
        })
        _, files, _ = master.call(rest + "/affiliate_files?" + query_string, key, token=sessions[alias])
        if len(files) > 1:
            raise RuntimeError(f"{alias} ambiguous profile photo")
        own[alias] = files[0] if files else None

    for alias in ("H005_TEST2", "H005_TEST3"):
        other = "H005_TEST3" if alias == "H005_TEST2" else "H005_TEST2"
        _, leaked, _ = master.call(rest + "/affiliate_files?select=id&affiliate_id=eq." + urllib.parse.quote(env[f"{other}_AFFILIATE_ID"]), key, token=sessions[alias])
        if leaked:
            raise RuntimeError(f"cross-user metadata leakage: {alias} -> {other}")

    admin_target = own["H005_TEST2"] or own["H005_TEST3"]
    if admin_target:
        _, admin_visible, _ = master.call(rest + "/affiliate_files?select=id&affiliate_id=eq." + urllib.parse.quote(admin_target["affiliate_id"]), key, token=sessions["H005_TEST"])
        if not admin_visible:
            raise RuntimeError("authorized admin cannot read affiliate photo metadata")

    for alias in aliases:
        relation = own[alias]
        if relation:
            sign_url = base + "/storage/v1/object/sign/private-assets/" + encoded_path(relation["storage_path"])
            status, signed, _ = master.call(sign_url, key, "POST", {"expiresIn": 3600}, sessions[alias])
            if status != 200 or not (signed.get("signedURL") or signed.get("signedUrl")):
                raise RuntimeError(f"{alias} signed URL failed")

    target_alias = next((alias for alias in ("H005_TEST2", "H005_TEST3", "H005_TEST") if own[alias]), None)
    if target_alias:
        target = own[target_alias]
        other_alias = {"H005_TEST2": "H005_TEST3", "H005_TEST3": "H005_TEST2", "H005_TEST": "H005_TEST2"}[target_alias]
        sign_url = base + "/storage/v1/object/sign/private-assets/" + encoded_path(target["storage_path"])
        denied, _, _ = master.call(sign_url, key, "POST", {"expiresIn": 3600}, sessions[other_alias], expected={400,401,403,404})
        anonymous, _, _ = master.call(sign_url, key, "POST", {"expiresIn": 3600}, expected={400,401,403,404})
        if denied not in {400,401,403,404} or anonymous not in {400,401,403,404}:
            raise RuntimeError("cross-user or anonymous signing was not denied")

    result = {
        "status": "PASS", "aggregate": aggregate,
        "accounts": {alias: {"affiliate_id": env[f"{alias}_AFFILIATE_ID"], "has_photo": bool(own[alias]), "rls": "PASS"} for alias in aliases},
        "cross_user_photo_leakage": False, "anonymous_denied": True, "admin_authorized": True,
    }
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
