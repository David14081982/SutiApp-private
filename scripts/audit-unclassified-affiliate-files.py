#!/usr/bin/env python3
"""Read-only aggregate audit for historical affiliate files outside the canonical expediente."""
from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path
from uuid import UUID


ROOT = Path(__file__).resolve().parents[1]


def load_master_assets_module():
    path = ROOT / "scripts" / "apply-master-assets.py"
    spec = importlib.util.spec_from_file_location("sutiapp_master_assets", path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--env", default=str(ROOT / "supabase.env"))
    parser.add_argument("--affiliate-env-key", default="H005_TEST2_AFFILIATE_ID")
    parser.add_argument("--affiliate-id")
    args = parser.parse_args()
    master = load_master_assets_module()
    env = master.read_env(Path(args.env))
    affiliate_id = str(UUID(args.affiliate_id or env[args.affiliate_env_key]))
    query = f"""
with extras as (
  select af.file_key, af.mime_type, af.sha256
  from public.affiliate_files af
  where af.affiliate_id = '{affiliate_id}'::uuid
    and af.status = 'READY'
    and not exists (
      select 1 from public.affiliate_documents d
      where d.affiliate_id = af.affiliate_id and d.affiliate_file_id = af.id
    )
), grouped as (
  select file_key, mime_type, count(*)::int count
  from extras group by file_key, mime_type order by count(*) desc, file_key
), duplicate_hashes as (
  select sha256, count(*)::int count
  from extras where sha256 is not null group by sha256 having count(*) > 1
)
select json_build_object(
  'status', 'READ_ONLY_PASS',
  'mutation_counts', json_build_object('database_writes',0,'storage_writes',0),
  'total', (select count(*) from extras),
  'groups', coalesce((select json_agg(grouped) from grouped), '[]'::json),
  'duplicate_hash_groups', (select count(*) from duplicate_hashes),
  'duplicate_relations', coalesce((select sum(count) from duplicate_hashes), 0)
) result
"""
    result = master.management_sql(env, query)[0]["result"]
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
