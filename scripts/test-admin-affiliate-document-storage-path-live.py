#!/usr/bin/env python3
"""Dry-run/apply the RLS-safe Admin affiliate Storage path guard."""
from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "supabase/migrations/20260827001310_admin_affiliate_document_storage_path.sql"
RECOVERY = ROOT / "supabase/recovery/20260827001310_admin_affiliate_document_storage_path_recovery.sql"


def load_master():
    path = ROOT / "scripts/apply-master-assets.py"
    spec = importlib.util.spec_from_file_location("sutiapp_master_assets", path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def body(path: Path) -> str:
    sql = path.read_text(encoding="utf-8").strip()
    if not sql.lower().startswith("begin;") or not sql.lower().endswith("commit;"):
        raise RuntimeError("TRANSACTION_BOUNDARY_REQUIRED")
    return sql[len("begin;"):-len("commit;")]


def snapshot(master, env):
    return master.management_sql(env, """
select json_build_object(
 'affiliates',(select count(*) from public.affiliates),
 'documents',(select count(*) from public.affiliate_documents),
 'assets',(select count(*) from public.private_assets),
 'objects',(select count(*) from storage.objects where bucket_id='private-assets'),
 'guard_present',to_regprocedure('public.can_admin_upload_affiliate_document_path(text)') is not null
) result
""")[0]["result"]


def checks():
    return r"""
do $$ declare v_insert text;v_delete text; begin
 if to_regprocedure('public.can_admin_upload_affiliate_document_path(text)') is null then raise exception 'PATH_GUARD_MISSING'; end if;
 if has_function_privilege('anon',to_regprocedure('public.can_admin_upload_affiliate_document_path(text)'),'EXECUTE') then raise exception 'ANON_PATH_GUARD_EXECUTE'; end if;
 select pg_get_expr(polwithcheck,polrelid) into v_insert from pg_policy where polname='affiliate_document_storage_insert';
 select pg_get_expr(polqual,polrelid) into v_delete from pg_policy where polname='affiliate_document_storage_cleanup';
 if position('can_admin_upload_affiliate_document_path' in coalesce(v_insert,''))=0 then raise exception 'INSERT_GUARD_MISSING'; end if;
 if position('can_admin_upload_affiliate_document_path' in coalesce(v_delete,''))=0 then raise exception 'DELETE_GUARD_MISSING'; end if;
end $$;
"""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    master = load_master();env = master.read_env(ROOT / "supabase.env");before = snapshot(master, env)
    if args.apply:
        if not before["guard_present"]:
            master.management_sql(env, MIGRATION.read_text(encoding="utf-8"))
        master.management_sql(env, "begin;" + checks() + "rollback;")
        after = snapshot(master, env)
        preserved = all(before[key] == after[key] for key in ("affiliates","documents","assets","objects"))
        if not after["guard_present"] or not preserved: raise RuntimeError("APPLY_RECONCILIATION_FAILED")
        print(json.dumps({"status":"PASS","mode":"APPLY","before":before,"after":after,"business_rows_changed":0},sort_keys=True));return 0
    master.management_sql(env, "begin;" + body(MIGRATION) + checks() + body(RECOVERY) + "rollback;")
    after = snapshot(master, env)
    if before != after: raise RuntimeError("DRY_RUN_PERSISTED_CHANGE")
    print(json.dumps({"status":"PASS","mode":"DRY_RUN","before":before,"after":after,"persistent_writes":0},sort_keys=True));return 0


if __name__ == "__main__": raise SystemExit(main())
