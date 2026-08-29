#!/usr/bin/env python3
"""Dry-run/apply the reversible loan document availability and replacement contract."""
from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "supabase" / "migrations" / "20260829000100_loan_document_flow_recovery.sql"
RECOVERY = ROOT / "supabase" / "recovery" / "20260829000100_loan_document_flow_recovery_recovery.sql"


def load_master():
    path = ROOT / "scripts" / "apply-master-assets.py"
    spec = importlib.util.spec_from_file_location("sutiapp_master_assets", path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def transaction_body(path: Path) -> str:
    sql = path.read_text(encoding="utf-8").strip()
    if not sql.lower().startswith("begin;") or not sql.lower().endswith("commit;"):
        raise RuntimeError("TRANSACTION_BOUNDARY_REQUIRED: " + path.name)
    return sql[len("begin;"):-len("commit;")]


def snapshot(master, env):
    return master.management_sql(env, """
select json_build_object(
  'affiliates',(select count(*) from public.affiliates),
  'documents',(select count(*) from public.affiliate_documents),
  'request_documents',(select count(*) from public.request_documents),
  'private_assets',(select count(*) from public.private_assets),
  'storage_objects',(select count(*) from storage.objects where bucket_id='private-assets'),
  'audit',(select count(*) from public.sensitive_change_audit),
  'replacement_column',exists(select 1 from information_schema.columns where table_schema='public' and table_name='affiliate_documents' and column_name='replaces_document_id'),
  'availability_rpc',to_regprocedure('public.get_affiliate_document_availability(uuid[])') is not null,
  'attachment_trigger',exists(select 1 from pg_trigger where tgname='request_documents_require_available_object' and not tgisinternal)
) result
""")[0]["result"]


def checks() -> str:
    return r"""
do $$
declare v_predicate text;
begin
  if to_regprocedure('public.get_affiliate_document_availability(uuid[])') is null then raise exception 'AVAILABILITY_RPC_MISSING'; end if;
  if has_function_privilege('anon',to_regprocedure('public.get_affiliate_document_availability(uuid[])'),'EXECUTE') then raise exception 'ANON_AVAILABILITY_EXECUTE'; end if;
  if not has_function_privilege('authenticated',to_regprocedure('public.get_affiliate_document_availability(uuid[])'),'EXECUTE') then raise exception 'AUTH_AVAILABILITY_GRANT_MISSING'; end if;
  if not exists(select 1 from pg_trigger where tgname='request_documents_require_available_object' and not tgisinternal) then raise exception 'ATTACHMENT_TRIGGER_MISSING'; end if;
  select pg_get_expr(indpred,indrelid) into v_predicate from pg_index where indexrelid='public.affiliate_documents_current_review_idx'::regclass;
  if position('VERIFIED' in coalesce(v_predicate,''))>0 then raise exception 'VERIFIED_STILL_BLOCKS_REPLACEMENT'; end if;
  if position('PENDING_REVIEW' in coalesce(v_predicate,''))=0 or position('UNDER_REVIEW' in coalesce(v_predicate,''))=0 then raise exception 'CURRENT_REVIEW_INDEX_INVALID'; end if;
end $$;
"""


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    master = load_master()
    env = master.read_env(ROOT / "supabase.env")
    before = snapshot(master, env)
    protected = ("affiliates", "documents", "request_documents", "private_assets", "storage_objects", "audit")
    if args.apply:
        if not before["replacement_column"]:
            master.management_sql(env, MIGRATION.read_text(encoding="utf-8"))
        master.management_sql(env, "begin;" + checks() + "rollback;")
        after = snapshot(master, env)
        if not all(after[key] == before[key] for key in protected):
            raise RuntimeError("APPLY_RECONCILIATION_FAILED: " + json.dumps({"before": before, "after": after}))
        if not (after["replacement_column"] and after["availability_rpc"] and after["attachment_trigger"]):
            raise RuntimeError("APPLY_CONTRACT_MISSING")
        print(json.dumps({"status": "PASS", "mode": "APPLY", "before": before, "after": after, "business_rows_changed": 0, "credentials_exposed": False}, sort_keys=True))
        return 0
    sql = "begin;" + transaction_body(MIGRATION) + checks() + transaction_body(RECOVERY) + "rollback;"
    master.management_sql(env, sql)
    after = snapshot(master, env)
    if before != after:
        raise RuntimeError("DRY_RUN_PERSISTED_CHANGE")
    print(json.dumps({"status": "PASS", "mode": "DRY_RUN", "migration_compiled": True, "recovery_compiled": True, "before": before, "after": after, "persistent_writes": 0, "credentials_exposed": False}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
