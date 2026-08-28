#!/usr/bin/env python3
"""Exercise Admin Affiliates CRUD in one rolled-back database transaction."""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def env() -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in (ROOT / "supabase.env").read_text(encoding="utf-8-sig").splitlines():
        if raw.strip() and not raw.lstrip().startswith("#") and "=" in raw:
            key, value = raw.split("=", 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def query(values: dict[str, str], sql: str) -> object:
    ref = urllib.parse.urlsplit(values["SUPABASE_URL"]).hostname.split(".")[0]
    request = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{ref}/database/query",
        data=json.dumps({"query": sql}).encode(),
        headers={
            "Authorization": "Bearer " + values["SUPABASE_ACCESS_TOKEN"],
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "SutiApp-Admin-Affiliates-Live/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            raw = response.read()
    except urllib.error.HTTPError as error:
        raise RuntimeError(f"HTTP {error.code}: {error.read(2000).decode('utf-8', 'replace')}") from None
    return json.loads(raw) if raw else []


def main() -> int:
    values = env()
    marker = "QA_AFF_TX_" + str(int(time.time() * 1000))
    email = values["H005_TEST_EMAIL"].replace("'", "''")
    safe_marker = marker.replace("'", "''")
    sql = f"""
begin;
do $test$
declare
  v_actor uuid; v_list jsonb; v_workbench jsonb; v_duplicates jsonb; v_id uuid;
  v_initial_status text; v_other_status text; v_updated_at timestamptz;
begin
  select id into strict v_actor from auth.users where lower(email)=lower('{email}');
  perform set_config('request.jwt.claim.sub',v_actor::text,true);
  if not public.has_admin_permission('affiliates.read') or not public.has_admin_permission('affiliates.write') then raise exception 'ADMIN_FIXTURE_PERMISSION_MISSING'; end if;

  v_list:=public.list_admin_affiliates(null,null,null,null,null,null,null,1,25,'name');
  if (v_list->>'total')::integer<>947 or jsonb_array_length(v_list->'items') not between 1 and 25 then raise exception 'SERVER_PAGINATION_FAILED'; end if;
  v_initial_status:=v_list->'filter_options'->'statuses'->>0;
  select value into v_other_status from jsonb_array_elements_text(v_list->'filter_options'->'statuses') value where value<>v_initial_status limit 1;
  if v_initial_status is null or v_other_status is null then raise exception 'REAL_STATUS_OPTIONS_REQUIRED'; end if;

  v_workbench:=public.create_admin_affiliate(jsonb_build_object(
    'numero_control','{safe_marker}','full_name','Afiliado {safe_marker}',
    'historical_email_raw',lower('{safe_marker}')||'@example.test','phone_raw','6620000000',
    'affiliate_status_raw',v_initial_status
  ),'Alta reversible dentro de transaccion');
  v_id:=(v_workbench->'profile'->>'id')::uuid;
  if v_workbench->'profile'->>'record_origin'<>'ADMIN_AFFILIATES' then raise exception 'ADMIN_ORIGIN_FAILED'; end if;
  if exists(select 1 from public.affiliates where id=v_id and (source_row_ordinal is not null or source_file_hash is not null)) then raise exception 'FABRICATED_PROVENANCE'; end if;

  v_duplicates:=public.find_admin_affiliate_duplicates(jsonb_build_object('numero_control','{safe_marker}'),null);
  if jsonb_array_length(v_duplicates)<>1 or not ((v_duplicates->0->'matches') ? 'numero_control') then raise exception 'DUPLICATE_REVIEW_FAILED'; end if;

  v_updated_at:=(v_workbench->'profile'->>'updated_at')::timestamptz;
  v_workbench:=public.update_admin_affiliate(v_id,v_updated_at,jsonb_build_object('display_name','Visible {safe_marker}','phone_raw','6621111111'),'Edicion reversible dentro de transaccion');
  if v_workbench->'profile'->>'display_name'<>'Visible {safe_marker}' then raise exception 'UPDATE_READBACK_FAILED'; end if;
  v_updated_at:=(v_workbench->'profile'->>'updated_at')::timestamptz;
  v_workbench:=public.change_admin_affiliate_status(v_id,v_updated_at,v_other_status,'Baja reversible dentro de transaccion');
  if v_workbench->'profile'->>'affiliate_status_raw'<>v_other_status then raise exception 'STATUS_READBACK_FAILED'; end if;
  v_updated_at:=(v_workbench->'profile'->>'updated_at')::timestamptz;
  v_workbench:=public.change_admin_affiliate_status(v_id,v_updated_at,v_initial_status,'Reactivacion reversible dentro de transaccion');
  if v_workbench->'profile'->>'affiliate_status_raw'<>v_initial_status then raise exception 'REACTIVATION_READBACK_FAILED'; end if;

  if (select count(*) from public.affiliate_admin_events where affiliate_id=v_id)<>4 then raise exception 'AUDIT_EVENT_COUNT_FAILED'; end if;
  if (select count(*) from public.affiliate_profile_audit_log where affiliate_id=v_id)<>2 then raise exception 'PROFILE_AUDIT_FAILED'; end if;
  if (select count(*) from public.affiliates)<>948 then raise exception 'TRANSACTION_FIXTURE_COUNT_FAILED'; end if;
end $test$;
rollback;
"""
    before = query(values, "select count(*)::int affiliates,(select count(*)::int from public.affiliates where record_origin='ADMIN_AFFILIATES') admin_rows from public.affiliates;")[0]
    query(values, sql)
    after = query(values, "select count(*)::int affiliates,(select count(*)::int from public.affiliates where record_origin='ADMIN_AFFILIATES') admin_rows from public.affiliates;")[0]
    if before != after or after != {"affiliates": 947, "admin_rows": 0}:
        raise RuntimeError("ROLLBACK_RECONCILIATION_FAILED: " + json.dumps({"before": before, "after": after}))
    print(json.dumps({"status": "PASS", "server_pagination": True, "create": True, "duplicate_review": True, "update": True, "status_change": True, "reactivation": True, "audit_events": 4, "persistent_writes": 0, "affiliates_after": 947, "credentials_exposed": False}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
