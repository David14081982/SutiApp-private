#!/usr/bin/env python3
"""Preflight/apply the owner-authorized affiliate email CSV update."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = Path(r"C:\Users\david\Downloads\Usuarios (8).csv")
EXPECTED_SOURCE_HASH = "3AB97E9F16951E523301E1A080A1DB965F12739207798490022308FCF1F28E29"
EXPECTED_ROWS = 947
H_CODE = "H-AFFILIATES-CSV-UPDATE-APPLY-001"
MIGRATION = ROOT / "supabase/migrations/20260904000200_affiliate_csv_email_update_batch.sql"
RECOVERY = ROOT / "supabase/recovery/20260904000200_affiliate_csv_email_update_batch_recovery.sql"
DEFAULT_RESULT = Path(r"C:\Users\david\Downloads\H-AFFILIATES-CSV-UPDATE-APPLY-001-RESULT.csv")


class ApplyFailure(RuntimeError):
    pass


def read_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        values[name.strip()] = value.strip().strip('"').strip("'")
    return values


def source_rows(path: Path) -> tuple[list[dict[str, object]], str]:
    digest = hashlib.sha256(path.read_bytes()).hexdigest().upper()
    if digest != EXPECTED_SOURCE_HASH:
        raise ApplyFailure(f"SOURCE_HASH_MISMATCH:{digest}")
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != ["N\u00famero de control", "NOMBRE", "Email"]:
            raise ApplyFailure("SOURCE_HEADERS_MISMATCH")
        rows = list(reader)
    if len(rows) != EXPECTED_ROWS:
        raise ApplyFailure(f"SOURCE_ROW_COUNT_MISMATCH:{len(rows)}")
    projected = []
    for ordinal, row in enumerate(rows, 1):
        control = row["N\u00famero de control"]
        if re.fullmatch(r"[+-]?\d+\.0+", control or ""):
            control = control.rsplit(".", 1)[0]
        raw = row["Email"].strip() or None
        projected.append({"ordinal": ordinal, "numero_control": control, "email_raw": raw})
    return projected, digest


def management_query(values: dict[str, str], sql: str) -> list[dict[str, object]]:
    url = values.get("SUPABASE_URL", "")
    token = values.get("SUPABASE_ACCESS_TOKEN", "")
    if not url or not token:
        raise ApplyFailure("SUPABASE_MANAGEMENT_CONFIGURATION_MISSING")
    project_ref = urllib.parse.urlsplit(url).hostname.split(".")[0]
    request = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{project_ref}/database/query",
        data=json.dumps({"query": sql}).encode(),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "SutiApp-Affiliate-Csv-Update/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            result = json.load(response)
    except urllib.error.HTTPError as error:
        payload = error.read().decode("utf-8", errors="replace")
        raise ApplyFailure(f"SUPABASE_QUERY_FAILED:{error.code}:{payload[:500]}") from None
    if not isinstance(result, list):
        raise ApplyFailure("SUPABASE_QUERY_RESPONSE_INVALID")
    return result


def rest_rpc(values: dict[str, str], name: str, payload: dict[str, object]) -> dict[str, object]:
    base = values.get("SUPABASE_URL", "").rstrip("/")
    key = values.get("SUPABASE_SECRET_KEY", "")
    if not base or not key:
        raise ApplyFailure("SUPABASE_SERVICE_CONFIGURATION_MISSING")
    result: object = None
    for attempt in range(6):
        request = urllib.request.Request(
            f"{base}/rest/v1/rpc/{name}",
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "SutiApp-Affiliate-Csv-Update/1.0",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                result = json.load(response)
            break
        except urllib.error.HTTPError as error:
            body = error.read().decode("utf-8", errors="replace")
            if error.code == 404 and "PGRST202" in body and attempt < 5:
                time.sleep(0.5)
                continue
            raise ApplyFailure(f"SUPABASE_RPC_FAILED:{error.code}:{body[:1000]}") from None
    if not isinstance(result, dict):
        raise ApplyFailure("SUPABASE_RPC_RESPONSE_INVALID")
    return result


def sql_body(sql: str) -> str:
    body = re.sub(r"^\s*begin\s*;", "", sql, count=1, flags=re.IGNORECASE)
    return re.sub(r"commit\s*;\s*$", "", body, count=1, flags=re.IGNORECASE)


def sql_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def fetch_affiliates(values: dict[str, str]) -> list[dict[str, object]]:
    return management_query(values, """
      select a.id::text,a.numero_control,a.historical_email_raw,a.historical_email_normalized,
             a.auth_eligibility,a.auth_ineligibility_reason,a.auth_user_id::text,
             u.email::text auth_email,(u.email_confirmed_at is not null) auth_email_confirmed,
             a.record_origin,a.is_archived,a.updated_at::text
      from public.affiliates a left join auth.users u on u.id=a.auth_user_id order by a.id
    """)


def schema_present(values: dict[str, str]) -> bool:
    rows = management_query(values, """
      select to_regprocedure(
        'public.apply_affiliate_csv_email_update(uuid,text,text,text,integer,jsonb)'
      ) is not null as present
    """)
    return bool(rows and rows[0]["present"])


def identity_mapping(affiliates: list[dict[str, object]]) -> list[tuple[str, str]]:
    return sorted(
        (str(row["auth_user_id"]), str(row["id"]))
        for row in affiliates
        if row["auth_user_id"]
    )


def verify_identity_resolver(values: dict[str, str]) -> int:
    rows = management_query(values, r"""
      do $probe$
      declare
        r record;
        resolved uuid;
        access_state text;
      begin
        for r in
          select id, auth_user_id, is_archived
          from public.affiliates
          where auth_user_id is not null
          order by id
        loop
          perform set_config('request.jwt.claim.sub', r.auth_user_id::text, true);
          perform set_config(
            'request.jwt.claims',
            jsonb_build_object('sub', r.auth_user_id, 'role', 'authenticated')::text,
            true
          );
          execute 'select public.get_effective_affiliate_id(), public.get_current_affiliate_access_state()'
            into resolved, access_state;
          if not r.is_archived and (resolved is distinct from r.id or access_state <> 'ACTIVE') then
            raise exception 'AFFILIATE_RESOLVER_CHANGED:%:%:%', r.auth_user_id, resolved, access_state;
          end if;
          if r.is_archived and (resolved is not null or access_state <> 'ARCHIVED') then
            raise exception 'ARCHIVED_AFFILIATE_RESOLVER_CHANGED:%:%:%', r.auth_user_id, resolved, access_state;
          end if;
        end loop;
      end
      $probe$;
      select count(*)::integer as verified
      from public.affiliates
      where auth_user_id is not null;
    """)
    if not rows or int(rows[0]["verified"]) < 1:
        raise ApplyFailure("AUTH_IDENTITY_RESOLVER_VERIFICATION_EMPTY")
    return int(rows[0]["verified"])


def normalize_email(value: object) -> str | None:
    if value is None or not str(value).strip():
        return None
    return str(value).strip().lower()


def classify(rows: list[dict[str, object]], affiliates: list[dict[str, object]]) -> tuple[dict[str, object], list[dict[str, object]]]:
    csv_by: dict[str, list[dict[str, object]]] = defaultdict(list)
    db_by: dict[str, list[dict[str, object]]] = defaultdict(list)
    for row in rows:
        csv_by[str(row["numero_control"] or "")].append(row)
    for row in affiliates:
        db_by[str(row["numero_control"] or "")].append(row)

    report: list[dict[str, object]] = []
    candidates: list[dict[str, object]] = []
    for row in rows:
        control = str(row["numero_control"] or "")
        matches = db_by.get(control, [])
        if not control:
            status = "SKIPPED_AMBIGUOUS_CONTROL"
            detail = "EMPTY_NUMERO_CONTROL"
        elif len(csv_by[control]) != 1 or len(matches) > 1:
            status = "SKIPPED_AMBIGUOUS_CONTROL"
            detail = "DUPLICATE_NUMERO_CONTROL_CSV" if len(csv_by[control]) != 1 else "DUPLICATE_NUMERO_CONTROL_SUPABASE"
        elif not matches:
            status = "CSV_ONLY"
            detail = "NUMERO_CONTROL_MISSING_IN_SUPABASE"
        else:
            affiliate = matches[0]
            proposed_normalized = normalize_email(row["email_raw"])
            if row["email_raw"] == affiliate["historical_email_raw"] and proposed_normalized == affiliate["historical_email_normalized"]:
                status = "UNCHANGED"
                detail = "EMAIL_ALREADY_EQUAL"
            else:
                candidate = {**row, "affiliate": affiliate, "proposed_normalized": proposed_normalized}
                candidates.append(candidate)
                status = "NEEDS_AUTH_SYNC" if affiliate["auth_user_id"] else "PENDING_SAFE_CHECK"
                detail = "LINKED_AUTH_EMAIL_CHANGE_REQUIRES_EXPLICIT_SYNC" if affiliate["auth_user_id"] else "PENDING_COLLISION_CHECK"
        report.append({"ordinal": row["ordinal"], "numero_control": control, "email_csv": row["email_raw"], "affiliate_id": matches[0]["id"] if len(matches) == 1 else None, "email_before": matches[0]["historical_email_raw"] if len(matches) == 1 else None, "auth_user_id": matches[0]["auth_user_id"] if len(matches) == 1 else None, "status": status, "detail": detail})

    proposal_counts = Counter(c["proposed_normalized"] for c in candidates if not c["affiliate"]["auth_user_id"] and c["proposed_normalized"] is not None)
    current_email_owners: dict[str, set[str]] = defaultdict(set)
    for affiliate in affiliates:
        if affiliate["historical_email_normalized"]:
            current_email_owners[str(affiliate["historical_email_normalized"])].add(str(affiliate["id"]))
    by_ordinal = {int(row["ordinal"]): row for row in report}
    for candidate in candidates:
        if candidate["affiliate"]["auth_user_id"]:
            continue
        normalized = candidate["proposed_normalized"]
        foreign_owner = normalized is not None and any(owner != candidate["affiliate"]["id"] for owner in current_email_owners.get(normalized, set()))
        duplicate_proposal = normalized is not None and proposal_counts[normalized] > 1
        by_ordinal[int(candidate["ordinal"])]["status"] = "SKIPPED_AMBIGUOUS_EMAIL" if foreign_owner or duplicate_proposal else "UPDATED_EMAIL"
        by_ordinal[int(candidate["ordinal"])]["detail"] = (
            "PROPOSED_EMAIL_OWNED_BY_OTHER_AFFILIATE" if foreign_owner
            else "DUPLICATE_PROPOSED_EMAIL" if duplicate_proposal
            else "UNIQUE_CONTROL_UNLINKED_AND_EMAIL_UNAMBIGUOUS"
        )

    extras = [row for row in affiliates if row["numero_control"] and str(row["numero_control"]) not in csv_by]
    preexisting_identity_mismatch = sum(
        bool(row["auth_user_id"])
        and (
            not row["auth_email_confirmed"]
            or normalize_email(row["auth_email"]) != row["historical_email_normalized"]
            or sum(other["historical_email_normalized"] == row["historical_email_normalized"] for other in affiliates) != 1
        )
        for row in affiliates
    )
    counts = Counter(str(row["status"]) for row in report)
    summary = {
        "mode": "preflight",
        "source_sha256": EXPECTED_SOURCE_HASH,
        "csv_rows": len(rows),
        "supabase_rows": len(affiliates),
        "updated_emails": counts["UPDATED_EMAIL"],
        "needs_auth_sync": counts["NEEDS_AUTH_SYNC"],
        "skipped_ambiguous": counts["SKIPPED_AMBIGUOUS_CONTROL"] + counts["SKIPPED_AMBIGUOUS_EMAIL"],
        "skipped_ambiguous_control": counts["SKIPPED_AMBIGUOUS_CONTROL"],
        "skipped_ambiguous_email": counts["SKIPPED_AMBIGUOUS_EMAIL"],
        "csv_only": counts["CSV_ONLY"],
        "unchanged": counts["UNCHANGED"],
        "extra_supabase_rows_preserved": len(extras),
        "qa_fixtures_preserved": sum(str(row["numero_control"]).startswith("AUTHCERT-") for row in extras),
        "preexisting_auth_identity_mismatch": preexisting_identity_mismatch,
    }
    return summary, report


def write_result(path: Path, report: list[dict[str, object]], after: list[dict[str, object]]) -> str:
    after_by_id = {str(row["id"]): row for row in after}
    path.parent.mkdir(parents=True, exist_ok=True)
    fields = [
        "source_row_ordinal", "numero_control", "email_csv", "affiliate_id",
        "email_before", "email_after", "status", "detail", "auth_user_id_unchanged",
    ]
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for row in report:
            target = after_by_id.get(str(row["affiliate_id"])) if row["affiliate_id"] else None
            status = "SKIPPED_AMBIGUOUS" if str(row["status"]).startswith("SKIPPED_AMBIGUOUS") else row["status"]
            writer.writerow({
                "source_row_ordinal": row["ordinal"],
                "numero_control": row["numero_control"],
                "email_csv": row["email_csv"],
                "affiliate_id": row["affiliate_id"],
                "email_before": row["email_before"],
                "email_after": target["historical_email_raw"] if target else None,
                "status": status,
                "detail": row["detail"],
                "auth_user_id_unchanged": (
                    str(row["auth_user_id"] or "") == str(target["auth_user_id"] or "")
                    if target else True
                ),
            })
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def verify_rows(
    before: list[dict[str, object]],
    after: list[dict[str, object]],
    report: list[dict[str, object]],
) -> None:
    if len(before) != 954 or len(after) != 954:
        raise ApplyFailure("AFFILIATE_ROW_COUNT_CHANGED")
    if identity_mapping(before) != identity_mapping(after):
        raise ApplyFailure("AUTH_IDENTITY_MAPPING_CHANGED")
    before_by_id = {str(row["id"]): row for row in before}
    after_by_id = {str(row["id"]): row for row in after}
    changed_ids = {str(row["affiliate_id"]): row for row in report if row["status"] == "UPDATED_EMAIL"}
    email_fields = ("historical_email_raw", "historical_email_normalized", "auth_eligibility", "auth_ineligibility_reason")
    for affiliate_id, old in before_by_id.items():
        current = after_by_id.get(affiliate_id)
        if current is None:
            raise ApplyFailure(f"AFFILIATE_REMOVED:{affiliate_id}")
        if affiliate_id in changed_ids:
            source = changed_ids[affiliate_id]
            expected_raw = source["email_csv"]
            expected_normalized = normalize_email(expected_raw)
            if current["historical_email_raw"] != expected_raw or current["historical_email_normalized"] != expected_normalized:
                raise ApplyFailure(f"UPDATED_EMAIL_READBACK_FAILED:{affiliate_id}")
            if current["auth_user_id"] is not None:
                raise ApplyFailure(f"UPDATED_EMAIL_LINKED_TO_AUTH:{affiliate_id}")
        elif any(current[field] != old[field] for field in email_fields):
            raise ApplyFailure(f"UNEXPECTED_AFFILIATE_EMAIL_CHANGE:{affiliate_id}")


def apply_or_verify_schema(values: dict[str, str]) -> str:
    if schema_present(values):
        return "ALREADY_APPLIED"
    management_query(values, MIGRATION.read_text(encoding="utf-8"))
    if not schema_present(values):
        raise ApplyFailure("CSV_UPDATE_SCHEMA_APPLY_FAILED")
    return "APPLIED"


def dry_run(values: dict[str, str], rows: list[dict[str, object]]) -> None:
    if schema_present(values):
        raise ApplyFailure("DRY_RUN_REQUIRES_SCHEMA_NOT_YET_APPLIED")
    payload = json.dumps(rows, ensure_ascii=False, separators=(",", ":"))
    batch_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"sutiapp:{H_CODE}:{EXPECTED_SOURCE_HASH}"))
    sql = f"""
      begin;
      {sql_body(MIGRATION.read_text(encoding='utf-8'))}
      select set_config('request.jwt.claim.role', 'service_role', true);
      select set_config('request.jwt.claims', '{{"role":"service_role"}}', true);
      select public.apply_affiliate_csv_email_update(
        {sql_literal(batch_id)}::uuid,
        {sql_literal(H_CODE)},
        'Usuarios (8).csv',
        {sql_literal(EXPECTED_SOURCE_HASH)},
        947,
        {sql_literal(payload)}::jsonb
      );
      select public.recover_affiliate_csv_email_update({sql_literal(batch_id)}::uuid);
      {sql_body(RECOVERY.read_text(encoding='utf-8'))}
      rollback;
    """
    management_query(values, sql)


def persisted_batch(values: dict[str, str], batch_id: str) -> dict[str, object]:
    literal = sql_literal(batch_id)
    rows = management_query(values, f"""
      select b.id::text,b.status,b.source_sha256,b.source_rows,b.result,
             (select count(*)::integer from public.affiliate_csv_email_update_snapshot s where s.batch_id=b.id) snapshot_rows,
             (select count(*)::integer from public.affiliate_csv_email_update_snapshot s where s.batch_id=b.id and s.outcome='UPDATED_EMAIL') updated_snapshot_rows,
             (select count(*)::integer from public.affiliate_csv_email_update_snapshot s where s.batch_id=b.id and s.outcome='NEEDS_AUTH_SYNC') needs_auth_snapshot_rows,
             (select count(*)::integer from public.affiliate_csv_email_update_snapshot s where s.batch_id=b.id and s.outcome='SKIPPED_AMBIGUOUS_EMAIL') ambiguous_email_snapshot_rows
      from public.affiliate_csv_email_update_batches b
      where b.id={literal}::uuid
    """)
    if len(rows) != 1:
        raise ApplyFailure("CSV_UPDATE_BATCH_AUDIT_MISSING")
    return rows[0]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--env-file", type=Path, default=ROOT / "supabase.env")
    parser.add_argument("--result", type=Path, default=DEFAULT_RESULT)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--status", action="store_true")
    args = parser.parse_args()
    try:
        if sum((args.dry_run, args.apply, args.status)) > 1:
            raise ApplyFailure("CHOOSE_ONE_MODE")
        rows, _ = source_rows(args.source)
        values = read_env(args.env_file)
        affiliates = fetch_affiliates(values)
        summary, report = classify(rows, affiliates)
        batch_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"sutiapp:{H_CODE}:{EXPECTED_SOURCE_HASH}"))
        if args.dry_run:
            dry_run(values, rows)
            print(json.dumps({**summary, "mode": "dry_run", "status": "PASS", "writes_persisted": 0}, ensure_ascii=False, sort_keys=True))
            return 0
        if args.status:
            if not schema_present(values):
                print(json.dumps({**summary, "mode": "status", "batch_status": "NOT_APPLIED"}, ensure_ascii=False, sort_keys=True))
                return 0
            batch = persisted_batch(values, batch_id)
            print(json.dumps({"mode": "status", "batch": batch}, ensure_ascii=False, sort_keys=True))
            return 0
        if args.apply:
            if summary["preexisting_auth_identity_mismatch"] != 0:
                raise ApplyFailure("PREEXISTING_AUTH_IDENTITY_MISMATCH")
            expected = {
                "updated_emails": 1,
                "needs_auth_sync": 8,
                "skipped_ambiguous": 145,
                "csv_only": 7,
                "unchanged": 786,
                "extra_supabase_rows_preserved": 10,
                "qa_fixtures_preserved": 7,
            }
            if any(summary[key] != value for key, value in expected.items()):
                raise ApplyFailure(f"PREFLIGHT_COUNTS_CHANGED:{json.dumps(summary, sort_keys=True)}")
            resolver_before = verify_identity_resolver(values)
            schema_action = apply_or_verify_schema(values)
            applied = False
            try:
                result = rest_rpc(values, "apply_affiliate_csv_email_update", {
                    "p_batch_id": batch_id,
                    "p_h_code": H_CODE,
                    "p_source_filename": "Usuarios (8).csv",
                    "p_source_sha256": EXPECTED_SOURCE_HASH,
                    "p_source_rows": EXPECTED_ROWS,
                    "p_rows": rows,
                })
                applied = result.get("status") == "APPLIED"
                if not applied or any(int(result.get(key, -1)) != value for key, value in expected.items()):
                    raise ApplyFailure(f"APPLY_RESULT_INVALID:{json.dumps(result, sort_keys=True)}")
                if int(result.get("auth_identity_mismatch_created", -1)) != 0:
                    raise ApplyFailure("AUTH_IDENTITY_MISMATCH_CREATED")
                after = fetch_affiliates(values)
                verify_rows(affiliates, after, report)
                resolver_after = verify_identity_resolver(values)
                if resolver_after != resolver_before:
                    raise ApplyFailure("AUTH_RESOLVER_COUNT_CHANGED")
                batch = persisted_batch(values, batch_id)
                if int(batch["snapshot_rows"]) != 121 or int(batch["updated_snapshot_rows"]) != 1 or int(batch["needs_auth_snapshot_rows"]) != 8 or int(batch["ambiguous_email_snapshot_rows"]) != 112:
                    raise ApplyFailure("BATCH_SNAPSHOT_COUNTS_INVALID")
                result_sha = write_result(args.result, report, after)
                print(json.dumps({
                    **result,
                    "mode": "apply",
                    "schema_action": schema_action,
                    "auth_resolvers_verified": resolver_after,
                    "result_csv": str(args.result),
                    "result_csv_sha256": result_sha,
                }, ensure_ascii=False, sort_keys=True))
                return 0
            except Exception as error:
                if applied:
                    try:
                        recovery = rest_rpc(values, "recover_affiliate_csv_email_update", {"p_batch_id": batch_id})
                        restored = fetch_affiliates(values)
                        if identity_mapping(affiliates) != identity_mapping(restored):
                            raise ApplyFailure("ROLLBACK_IDENTITY_MAPPING_FAILED")
                        raise ApplyFailure(f"POST_APPLY_VERIFICATION_FAILED_ROLLED_BACK:{error}:{json.dumps(recovery, sort_keys=True)}")
                    except ApplyFailure as recovery_error:
                        if str(recovery_error).startswith("POST_APPLY_VERIFICATION_FAILED_ROLLED_BACK"):
                            raise
                        raise ApplyFailure(f"POST_APPLY_VERIFICATION_FAILED_ROLLBACK_FAILED:{error}:{recovery_error}") from None
                raise
        print(json.dumps(summary, ensure_ascii=False, sort_keys=True))
        return 0
    except ApplyFailure as error:
        print(f"AFFILIATE CSV UPDATE FAILED: {error}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
