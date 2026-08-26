#!/usr/bin/env python3
"""Apply the owner-authorized, non-destructive expediente classification migration."""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "supabase" / "migrations" / "20260825000300_expediente_document_hygiene.sql"


def load_master():
    path = ROOT / "scripts" / "apply-master-assets.py"
    spec = importlib.util.spec_from_file_location("sutiapp_master_assets", path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def snapshot(master, env):
    query = """
select json_build_object(
  'affiliate_files', (select count(*) from public.affiliate_files),
  'private_assets', (select count(*) from public.private_assets),
  'historical_sources', (select count(*) from public.historical_asset_sources),
  'private_storage_objects', (select count(*) from storage.objects where bucket_id='private-assets'),
  'column_exists', exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='affiliate_files'
      and column_name='expediente_classification'
  ),
  'rls_forced', (select relrowsecurity and relforcerowsecurity from pg_class where oid='public.affiliate_files'::regclass)
) result
"""
    return master.management_sql(env, query)[0]["result"]


def verify(master, env):
    query = """
select json_build_object(
  'classification_counts', (
    select json_object_agg(expediente_classification,total)
    from (select expediente_classification,count(*)::int total from public.affiliate_files group by expediente_classification order by expediente_classification) x
  ),
  'null_classifications', (select count(*) from public.affiliate_files where expediente_classification is null),
  'invalid_current_links', (
    select count(*) from public.affiliate_files af
    where af.expediente_classification='CURRENT_DOCUMENT'
      and not exists(select 1 from public.affiliate_documents d where d.affiliate_file_id=af.id)
  ),
  'non_document_current_links', (
    select count(*) from public.affiliate_files af
    where af.expediente_classification='HISTORICAL_NON_DOCUMENT'
      and exists(select 1 from public.affiliate_documents d where d.affiliate_file_id=af.id)
  ),
  'affiliates_with_only_hidden_profile_photo', (
    select count(distinct af.affiliate_id)
    from public.affiliate_files af
    where af.file_key='profile_photo'
      and af.expediente_classification<>'CURRENT_DOCUMENT'
      and not exists (
        select 1 from public.affiliate_files current_photo
        where current_photo.affiliate_id=af.affiliate_id
          and current_photo.file_key='profile_photo'
          and current_photo.expediente_classification='CURRENT_DOCUMENT'
      )
  ),
  'sync_trigger_present', exists(select 1 from pg_trigger where tgname='affiliate_documents_sync_expediente_classification' and not tgisinternal),
  'affiliate_policy_closed', position('expediente_classification' in (select pg_get_expr(polqual,polrelid) from pg_policy where polname='affiliate_files_authorized_read'))>0,
  'asset_policy_closed', position('expediente_classification' in (select pg_get_expr(polqual,polrelid) from pg_policy where polname='private_assets_authorized_read'))>0,
  'storage_policy_closed', position('expediente_classification' in (select pg_get_expr(polqual,polrelid) from pg_policy where polname='master_private_storage_authorized_read'))>0
) result
"""
    return master.management_sql(env, query)[0]["result"]


def main() -> int:
    master = load_master()
    env = master.read_env(ROOT / "supabase.env")
    before = snapshot(master, env)
    if not before["column_exists"]:
        master.management_sql(env, MIGRATION.read_text(encoding="utf-8"))
    after = snapshot(master, env)
    checks = verify(master, env)
    preserved = all(before[key] == after[key] for key in (
        "affiliate_files", "private_assets", "historical_sources", "private_storage_objects"
    ))
    passed = bool(
        after["column_exists"] and after["rls_forced"] and preserved
        and checks["null_classifications"] == 0
        and checks["invalid_current_links"] == 0
        and checks["non_document_current_links"] == 0
        and checks["affiliates_with_only_hidden_profile_photo"] == 0
        and checks["sync_trigger_present"]
        and checks["affiliate_policy_closed"]
        and checks["asset_policy_closed"]
        and checks["storage_policy_closed"]
    )
    print(json.dumps({
        "status": "PASS" if passed else "FAIL",
        "mutation_counts": {"relations_deleted": 0, "storage_objects_deleted": 0},
        "before": before, "after": after, "checks": checks,
    }, ensure_ascii=False, indent=2, sort_keys=True))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
