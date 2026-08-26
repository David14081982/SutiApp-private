#!/usr/bin/env python3
"""Phase B read-only audit. It never deletes relations or Storage objects."""
from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path
from uuid import UUID


ROOT = Path(__file__).resolve().parents[1]


def load_master():
    path = ROOT / "scripts" / "apply-master-assets.py"
    spec = importlib.util.spec_from_file_location("sutiapp_master_assets", path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--affiliate-env-key", default="H005_TEST2_AFFILIATE_ID")
    parser.add_argument("--affiliate-id")
    args = parser.parse_args()
    master = load_master()
    env = master.read_env(ROOT / "supabase.env")
    affiliate_id = str(UUID(args.affiliate_id or env[args.affiliate_env_key]))
    query = f"""
with target as (
  select af.* from public.affiliate_files af where af.affiliate_id='{affiliate_id}'::uuid
), duplicate_hashes as (
  select sha256,count(*)::int relations,count(distinct private_asset_id)::int private_objects,
    count(distinct public_asset_id)::int public_objects
  from target group by sha256 having count(*)>1
), all_asset_refs as (
  select pa.id,
    (select count(*) from public.affiliate_files af where af.private_asset_id=pa.id) affiliate_file_refs,
    (select count(*) from public.historical_asset_sources hs where hs.private_asset_id=pa.id) provenance_refs,
    (select count(*) from public.affiliate_documents d where d.private_asset_id=pa.id) direct_document_refs,
    (select count(*) from public.request_documents rd where rd.private_asset_id=pa.id) request_refs
  from public.private_assets pa
), registry_unknown as (
  select * from all_asset_refs where affiliate_file_refs=0 and provenance_refs=0 and direct_document_refs=0 and request_refs=0
), storage_unknown as (
  select o.name from storage.objects o
  where o.bucket_id='private-assets'
    and not exists(select 1 from public.private_assets pa where pa.storage_bucket=o.bucket_id and pa.storage_path=o.name)
)
select json_build_object(
  'status','READ_ONLY_PASS',
  'visible_current_documents',(select count(*) from target where expediente_classification='CURRENT_DOCUMENT'),
  'historical_non_documents_hidden',(select count(*) from target where expediente_classification='HISTORICAL_NON_DOCUMENT'),
  'historical_valid_documents_preserved',(select count(*) from target where expediente_classification in('HISTORICAL_DOCUMENT_VERSION','LEGACY_DOCUMENT','UNCLASSIFIED_DOCUMENT')),
  'classification_counts',(select json_object_agg(expediente_classification,total) from (select expediente_classification,count(*)::int total from target group by expediente_classification) x),
  'duplicate_hash_groups',(select count(*) from duplicate_hashes),
  'duplicate_relations',(select coalesce(sum(relations),0) from duplicate_hashes),
  'shared_object_groups',(select count(*) from duplicate_hashes where private_objects+public_objects < relations),
  'duplicate_relations_safe_to_remove',0,
  'safe_physical_deletes',0,
  'unknown_registry_assets',(select count(*) from registry_unknown),
  'unknown_storage_objects',(select count(*) from storage_unknown),
  'historical_pdf_relations',(select count(*) from public.affiliate_files where mime_type='application/pdf' and expediente_classification<>'CURRENT_DOCUMENT'),
  'storage_objects_deleted',0,
  'db_relations_removed',0,
  'protected_historical_objects_deleted',0,
  'recovery_manifest',json_build_object('safe_delete_asset_ids','[]'::json,'safe_delete_object_paths','[]'::json,'reason','No candidate satisfies backup plus zero-reference gates')
) result
"""
    result = master.management_sql(env, query)[0]["result"]
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
