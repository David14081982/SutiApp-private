#!/usr/bin/env python3
"""Preflight and apply the owner-authorized CSV/Auth affiliate link repair."""

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
DEFAULT_RESULT = Path(r"C:\Users\david\Downloads\H-AFFILIATES-CSV-AUTH-LINK-REPAIR-001-RESULT.csv")
EXPECTED_SOURCE_HASH = "3AB97E9F16951E523301E1A080A1DB965F12739207798490022308FCF1F28E29"
EXPECTED_SOURCE_ROWS = 947
H_CODE = "H-AFFILIATES-CSV-AUTH-LINK-REPAIR-001"
CONFIRM = "APPLY-H-AFFILIATES-CSV-AUTH-LINK-REPAIR-001"
MIGRATION = ROOT / "supabase/migrations/20260904000300_affiliate_csv_auth_link_repair.sql"
RECOVERY = ROOT / "supabase/recovery/20260904000300_affiliate_csv_auth_link_repair_recovery.sql"
BATCH_ID = str(uuid.uuid5(uuid.NAMESPACE_URL, f"sutiapp:{H_CODE}:{EXPECTED_SOURCE_HASH}"))


class RepairFailure(RuntimeError):
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
        raise RepairFailure(f"SOURCE_HASH_MISMATCH:{digest}")
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != ["N\u00famero de control", "NOMBRE", "Email"]:
            raise RepairFailure("SOURCE_HEADERS_MISMATCH")
        raw_rows = list(reader)
    if len(raw_rows) != EXPECTED_SOURCE_ROWS:
        raise RepairFailure(f"SOURCE_ROW_COUNT_MISMATCH:{len(raw_rows)}")

    projected: list[dict[str, object]] = []
    for ordinal, row in enumerate(raw_rows, 1):
        control = row["N\u00famero de control"]
        if re.fullmatch(r"[+-]?\d+\.0+", control or ""):
            control = control.rsplit(".", 1)[0]
        projected.append(
            {
                "ordinal": ordinal,
                "numero_control": control,
                "email_raw": row["Email"].strip() or None,
            }
        )
    return projected, digest


def normalize_email(value: object) -> str | None:
    if value is None or not str(value).strip():
        return None
    return str(value).strip().lower()


def management_query(values: dict[str, str], sql: str) -> list[dict[str, object]]:
    url = values.get("SUPABASE_URL", "")
    token = values.get("SUPABASE_ACCESS_TOKEN", "")
    if not url or not token:
        raise RepairFailure("SUPABASE_MANAGEMENT_CONFIGURATION_MISSING")
    project_ref = urllib.parse.urlsplit(url).hostname.split(".")[0]
    request = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{project_ref}/database/query",
        data=json.dumps({"query": sql}).encode(),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "SutiApp-Affiliate-Csv-Auth-Link-Repair/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            result = json.load(response)
    except urllib.error.HTTPError as error:
        payload = error.read().decode("utf-8", errors="replace")
        raise RepairFailure(f"SUPABASE_QUERY_FAILED:{error.code}:{payload[:1500]}") from None
    if not isinstance(result, list):
        raise RepairFailure("SUPABASE_QUERY_RESPONSE_INVALID")
    return result


def rest_rpc(values: dict[str, str], name: str, payload: dict[str, object]) -> dict[str, object]:
    base = values.get("SUPABASE_URL", "").rstrip("/")
    key = values.get("SUPABASE_SECRET_KEY", "")
    if not base or not key:
        raise RepairFailure("SUPABASE_SERVICE_CONFIGURATION_MISSING")
    result: object = None
    for attempt in range(8):
        request = urllib.request.Request(
            f"{base}/rest/v1/rpc/{name}",
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "SutiApp-Affiliate-Csv-Auth-Link-Repair/1.0",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                result = json.load(response)
            break
        except urllib.error.HTTPError as error:
            body = error.read().decode("utf-8", errors="replace")
            if error.code == 404 and "PGRST202" in body and attempt < 7:
                time.sleep(0.75)
                continue
            raise RepairFailure(f"SUPABASE_RPC_FAILED:{error.code}:{body[:2000]}") from None
    if not isinstance(result, dict):
        raise RepairFailure("SUPABASE_RPC_RESPONSE_INVALID")
    return result


def sql_body(sql: str) -> str:
    body = re.sub(r"^\s*begin\s*;", "", sql, count=1, flags=re.IGNORECASE)
    return re.sub(r"commit\s*;\s*$", "", body, count=1, flags=re.IGNORECASE)


def fetch_affiliates(values: dict[str, str]) -> list[dict[str, object]]:
    return management_query(
        values,
        """
        select a.id::text, a.numero_control, a.full_name,
               a.historical_email_raw, a.historical_email_normalized,
               a.auth_user_id::text, a.auth_eligibility,
               a.auth_ineligibility_reason, a.is_archived,
               a.record_origin, a.updated_at::text,
               u.email::text as auth_email,
               (u.email_confirmed_at is not null) as auth_email_confirmed
        from public.affiliates a
        left join auth.users u on u.id = a.auth_user_id
        order by a.id
        """,
    )


def classify(
    rows: list[dict[str, object]], affiliates: list[dict[str, object]]
) -> dict[str, object]:
    csv_control_counts = Counter(str(row["numero_control"] or "") for row in rows)
    csv_email_counts = Counter(
        normalize_email(row["email_raw"])
        for row in rows
        if normalize_email(row["email_raw"])
    )
    csv_by_email: dict[str | None, list[dict[str, object]]] = defaultdict(list)
    csv_by_control: dict[str, list[dict[str, object]]] = defaultdict(list)
    db_by_control: dict[str, list[dict[str, object]]] = defaultdict(list)
    for row in rows:
        csv_by_email[normalize_email(row["email_raw"])].append(row)
        csv_by_control[str(row["numero_control"] or "")].append(row)
    for affiliate in affiliates:
        db_by_control[str(affiliate["numero_control"] or "")].append(affiliate)

    checked = 0
    correct: list[dict[str, object]] = []
    wrong: list[dict[str, object]] = []
    repairs: list[dict[str, object]] = []
    ambiguous: list[dict[str, object]] = []

    for affiliate in affiliates:
        if not affiliate["auth_user_id"]:
            continue
        checked += 1
        auth_email = normalize_email(affiliate["auth_email"])
        email_rows = csv_by_email.get(auth_email, [])
        current_control = str(affiliate["numero_control"] or "")
        target: dict[str, object] | None = None
        target_row: dict[str, object] | None = None
        reasons: list[str] = []

        if len(email_rows) != 1:
            reasons.append("CSV_EMAIL_MISSING" if not email_rows else "CSV_EMAIL_DUPLICATE")
        else:
            target_row = email_rows[0]
            target_control = str(target_row["numero_control"] or "")
            if not target_control:
                reasons.append("TARGET_CONTROL_EMPTY")
            elif csv_control_counts[target_control] != 1:
                reasons.append("TARGET_CONTROL_DUPLICATE_CSV")
            elif len(db_by_control.get(target_control, [])) != 1:
                reasons.append("TARGET_CONTROL_MISSING_OR_DUPLICATE_DB")
            else:
                target = db_by_control[target_control][0]

        base = {
            "auth_user_id": affiliate["auth_user_id"],
            "auth_email": affiliate["auth_email"],
            "current_affiliate_id": affiliate["id"],
            "current_numero_control": affiliate["numero_control"],
        }
        if target is not None:
            base.update(
                {
                    "source_row_ordinal": target_row["ordinal"],
                    "target_affiliate_id": target["id"],
                    "target_numero_control": target["numero_control"],
                    "target_full_name": target["full_name"],
                    "target_auth_user_id": target["auth_user_id"],
                }
            )
            if target["id"] == affiliate["id"]:
                correct.append(base)
                continue
            wrong.append(base)

        if not current_control:
            reasons.append("CURRENT_CONTROL_EMPTY")
        elif csv_control_counts[current_control] != 1:
            reasons.append("CURRENT_CONTROL_DUPLICATE_CSV")
        elif len(db_by_control.get(current_control, [])) != 1:
            reasons.append("CURRENT_CONTROL_MISSING_OR_DUPLICATE_DB")
        elif not normalize_email(csv_by_control[current_control][0]["email_raw"]):
            reasons.append("CURRENT_EMAIL_EMPTY_CSV")
        elif csv_email_counts[normalize_email(csv_by_control[current_control][0]["email_raw"])] != 1:
            reasons.append("CURRENT_EMAIL_DUPLICATE_CSV")

        repairable = (
            target is not None
            and target["id"] != affiliate["id"]
            and not reasons
            and bool(affiliate["auth_email_confirmed"])
            and not bool(affiliate["is_archived"])
            and not bool(target["is_archived"])
            and target["auth_eligibility"] == "eligible"
        )
        if not affiliate["auth_email_confirmed"]:
            reasons.append("AUTH_EMAIL_NOT_CONFIRMED")
        if affiliate["is_archived"]:
            reasons.append("CURRENT_AFFILIATE_ARCHIVED")
        if target is not None and target["is_archived"]:
            reasons.append("TARGET_AFFILIATE_ARCHIVED")
        if target is not None and target["auth_eligibility"] != "eligible":
            reasons.append("TARGET_NOT_ELIGIBLE")

        if repairable:
            repairs.append(base)
        else:
            base["detail"] = "|".join(dict.fromkeys(reasons)) or "NOT_DETERMINISTIC"
            ambiguous.append(base)

    repair_auth_ids = {str(row["auth_user_id"]) for row in repairs}
    target_conflicts = [
        row
        for row in repairs
        if row["target_auth_user_id"]
        and str(row["target_auth_user_id"]) not in repair_auth_ids
    ]
    if target_conflicts:
        raise RepairFailure("TARGET_OCCUPIED_OUTSIDE_DETERMINISTIC_REPAIR_SET")
    if len({str(row["target_affiliate_id"]) for row in repairs}) != len(repairs):
        raise RepairFailure("DUPLICATE_REPAIR_TARGET")

    return {
        "auth_links_checked": checked,
        "correct": correct,
        "correct_count": len(correct),
        "wrong": wrong,
        "wrong_control_links_found": len(wrong),
        "repairs": repairs,
        "repaired_count": len(repairs),
        "ambiguous": ambiguous,
        "ambiguous_skipped": len(ambiguous),
        "csv_duplicate_control_values": sum(
            1 for key, count in csv_control_counts.items() if key and count > 1
        ),
        "csv_duplicate_email_values": sum(
            1 for count in csv_email_counts.values() if count > 1
        ),
    }


def schema_present(values: dict[str, str]) -> bool:
    rows = management_query(
        values,
        """
        select to_regprocedure(
          'public.apply_affiliate_csv_auth_link_repair(uuid,text,text,integer,integer,integer,integer,integer,integer,jsonb)'
        ) is not null as present
        """,
    )
    return bool(rows and rows[0]["present"])


def schema_dry_run(values: dict[str, str]) -> None:
    forward = sql_body(MIGRATION.read_text(encoding="utf-8"))
    recovery = sql_body(RECOVERY.read_text(encoding="utf-8"))
    rows = management_query(
        values,
        f"begin;\n{forward}\n{recovery}\nrollback;\nselect 'PASS'::text as schema_dry_run;",
    )
    if not rows or rows[0].get("schema_dry_run") != "PASS":
        raise RepairFailure("SCHEMA_DRY_RUN_FAILED")


def apply_schema(values: dict[str, str]) -> None:
    management_query(values, MIGRATION.read_text(encoding="utf-8"))
    if not schema_present(values):
        raise RepairFailure("SCHEMA_APPLY_NOT_VISIBLE")


def apply_payload(
    rows: list[dict[str, object]], digest: str, preflight: dict[str, object]
) -> dict[str, object]:
    return {
        "p_batch_id": BATCH_ID,
        "p_source_name": "Usuarios (8).csv",
        "p_source_sha256": digest,
        "p_source_row_count": len(rows),
        "p_expected_auth_links_checked": preflight["auth_links_checked"],
        "p_expected_correct_before": preflight["correct_count"],
        "p_expected_wrong_control_links_found": preflight["wrong_control_links_found"],
        "p_expected_repaired_count": preflight["repaired_count"],
        "p_expected_ambiguous_skipped": preflight["ambiguous_skipped"],
        "p_source_rows": rows,
    }


def verify_resolvers(values: dict[str, str]) -> int:
    rows = management_query(
        values,
        r"""
        do $probe$
        declare
          r record;
          v_effective uuid;
          v_state text;
          v_claimed uuid;
        begin
          for r in
            select a.id, a.auth_user_id, a.is_archived,
                   exists(
                     select 1
                     from public.affiliate_csv_auth_link_repairs repair
                     join public.affiliate_csv_auth_link_repair_batches batch
                       on batch.id = repair.batch_id and batch.status = 'APPLIED'
                     where repair.recovered_at is null
                       and repair.auth_user_id = a.auth_user_id
                       and repair.to_affiliate_id = a.id
                   ) as is_repaired
            from public.affiliates a
            where a.auth_user_id is not null
            order by a.id
          loop
            perform set_config('request.jwt.claim.sub', r.auth_user_id::text, true);
            perform set_config(
              'request.jwt.claims',
              jsonb_build_object('sub', r.auth_user_id, 'role', 'authenticated')::text,
              true
            );
            select public.get_effective_affiliate_id(), public.get_current_affiliate_access_state()
              into v_effective, v_state;
            if not r.is_archived and (v_effective is distinct from r.id or v_state <> 'ACTIVE') then
              raise exception 'AFFILIATE_RESOLVER_MISMATCH:%:%:%', r.auth_user_id, v_effective, v_state;
            end if;
            if r.is_archived and (v_effective is not null or v_state <> 'ARCHIVED') then
              raise exception 'ARCHIVED_AFFILIATE_RESOLVER_MISMATCH:%:%:%', r.auth_user_id, v_effective, v_state;
            end if;
            if r.is_repaired then
              select public.claim_affiliate_identity() into v_claimed;
              if v_claimed is distinct from r.id then
                raise exception 'REPAIRED_CLAIM_MISMATCH:%:%', r.auth_user_id, v_claimed;
              end if;
            end if;
          end loop;
        end
        $probe$;
        select count(*)::integer as verified
        from public.affiliates
        where auth_user_id is not null;
        """,
    )
    return int(rows[0]["verified"])


def verify_security(values: dict[str, str]) -> None:
    rows = management_query(
        values,
        """
        select
          not has_table_privilege('anon','public.affiliate_csv_auth_link_repair_batches','SELECT')
          and not has_table_privilege('authenticated','public.affiliate_csv_auth_link_repair_batches','SELECT')
          and not has_table_privilege('anon','public.affiliate_csv_auth_link_repairs','SELECT')
          and not has_table_privilege('authenticated','public.affiliate_csv_auth_link_repairs','SELECT')
          and not has_function_privilege('anon',
            'public.apply_affiliate_csv_auth_link_repair(uuid,text,text,integer,integer,integer,integer,integer,integer,jsonb)','EXECUTE')
          and not has_function_privilege('authenticated',
            'public.apply_affiliate_csv_auth_link_repair(uuid,text,text,integer,integer,integer,integer,integer,integer,jsonb)','EXECUTE')
          and has_function_privilege('service_role',
            'public.apply_affiliate_csv_auth_link_repair(uuid,text,text,integer,integer,integer,integer,integer,integer,jsonb)','EXECUTE')
          and not has_function_privilege('anon',
            'public.has_certified_affiliate_auth_link(uuid,uuid,text)','EXECUTE')
          and not has_function_privilege('authenticated',
            'public.has_certified_affiliate_auth_link(uuid,uuid,text)','EXECUTE')
          as secure
        """,
    )
    if not rows or not rows[0]["secure"]:
        raise RepairFailure("SECURITY_BOUNDARY_FAILED")


def recovery_dry_run(values: dict[str, str]) -> None:
    batch = BATCH_ID.replace("'", "''")
    rows = management_query(
        values,
        f"""
        begin;
        select set_config('request.jwt.claims', '{{"role":"service_role"}}', true);
        select public.recover_affiliate_csv_auth_link_repair('{batch}'::uuid);
        do $verify$
        begin
          if exists(
            select 1
            from public.affiliate_csv_auth_link_repair_snapshot s
            join public.affiliates a on a.id = s.affiliate_id
            where s.batch_id = '{batch}'::uuid
              and a.auth_user_id is distinct from s.old_auth_user_id
          ) then
            raise exception 'RECOVERY_DRY_RUN_MAPPING_MISMATCH';
          end if;
        end
        $verify$;
        rollback;
        select 'PASS'::text as recovery_dry_run;
        """,
    )
    if not rows or rows[0].get("recovery_dry_run") != "PASS":
        raise RepairFailure("RECOVERY_DRY_RUN_FAILED")


def fetch_repair_evidence(values: dict[str, str]) -> list[dict[str, object]]:
    batch = BATCH_ID.replace("'", "''")
    return management_query(
        values,
        f"""
        select r.source_row_ordinal, r.auth_user_id::text, r.auth_email_normalized,
               r.from_affiliate_id::text, r.from_numero_control,
               r.to_affiliate_id::text, r.to_numero_control,
               a.full_name as target_full_name
        from public.affiliate_csv_auth_link_repairs r
        join public.affiliates a on a.id = r.to_affiliate_id
        where r.batch_id = '{batch}'::uuid and r.recovered_at is null
        order by r.source_row_ordinal
        """,
    )


def write_result(path: Path, repairs: list[dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fields = [
        "source_row_ordinal",
        "auth_user_id",
        "auth_email_normalized",
        "from_affiliate_id",
        "from_numero_control",
        "to_affiliate_id",
        "to_numero_control",
        "target_full_name",
        "status",
    ]
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for repair in repairs:
            writer.writerow({**repair, "status": "REPAIRED"})


def recover_after_failure(values: dict[str, str]) -> dict[str, object]:
    return rest_rpc(
        values,
        "recover_affiliate_csv_auth_link_repair",
        {"p_batch_id": BATCH_ID},
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--env-file", type=Path, default=ROOT / "supabase.env")
    parser.add_argument("--result", type=Path, default=DEFAULT_RESULT)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--confirm", default="")
    args = parser.parse_args()

    rows, digest = source_rows(args.source)
    values = read_env(args.env_file)
    preflight = classify(rows, fetch_affiliates(values))
    summary = {
        "mode": "APPLY" if args.apply else "DRY_RUN",
        "source_sha256": digest,
        "source_rows": len(rows),
        "auth_links_checked": preflight["auth_links_checked"],
        "correct_before": preflight["correct_count"],
        "wrong_control_links_found": preflight["wrong_control_links_found"],
        "repairable": preflight["repaired_count"],
        "ambiguous_skipped": preflight["ambiguous_skipped"],
        "csv_duplicate_control_values": preflight["csv_duplicate_control_values"],
        "csv_duplicate_email_values": preflight["csv_duplicate_email_values"],
        "cosaf_repair_present": any(
            normalize_email(row["auth_email"]) == "cosaf@hotmail.com"
            and row["target_numero_control"] == "1536"
            for row in preflight["repairs"]
        ),
        "cosaf_correct_present": any(
            normalize_email(row["auth_email"]) == "cosaf@hotmail.com"
            and row["current_numero_control"] == "1536"
            for row in preflight["correct"]
        ),
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))

    if not summary["cosaf_repair_present"] and not summary["cosaf_correct_present"]:
        raise RepairFailure("CONFIRMED_COSAF_RELATION_NOT_PRESENT")
    if not args.apply:
        return 0
    if args.confirm != CONFIRM:
        raise RepairFailure(f"CONFIRMATION_REQUIRED:{CONFIRM}")

    if not schema_present(values):
        schema_dry_run(values)
        apply_schema(values)

    result: dict[str, object] | None = None
    for attempt in range(3):
        live_preflight = classify(rows, fetch_affiliates(values))
        try:
            result = rest_rpc(
                values,
                "apply_affiliate_csv_auth_link_repair",
                apply_payload(rows, digest, live_preflight),
            )
            preflight = live_preflight
            break
        except RepairFailure as error:
            if "LIVE_PREFLIGHT_CHANGED" not in str(error) or attempt == 2:
                raise
            time.sleep(0.5)
    if result is None or result.get("status") != "APPLIED":
        raise RepairFailure("APPLY_RESULT_INVALID")

    try:
        after = classify(rows, fetch_affiliates(values))
        expected_correct = int(result["correct_after"])
        if (
            after["auth_links_checked"] != int(result["auth_links_checked"])
            or after["correct_count"] != expected_correct
            or after["repaired_count"] != 0
            or int(result["deterministic_cross_links_after"]) != 0
        ):
            raise RepairFailure("POST_APPLY_CLASSIFICATION_MISMATCH")
        verified = verify_resolvers(values)
        if verified != after["auth_links_checked"]:
            raise RepairFailure("RESOLVER_VERIFIED_COUNT_MISMATCH")
        verify_security(values)
        recovery_dry_run(values)
        evidence = fetch_repair_evidence(values)
        if len(evidence) != int(result["repaired"]):
            raise RepairFailure("REPAIR_EVIDENCE_COUNT_MISMATCH")
        cosaf = [
            row
            for row in evidence
            if normalize_email(row["auth_email_normalized"]) == "cosaf@hotmail.com"
            and row["to_numero_control"] == "1536"
            and row["target_full_name"] == "PRECIADO RAMIREZ XOCHITL NOHEMI"
        ]
        if len(cosaf) != 1:
            raise RepairFailure("COSAF_FINAL_VALIDATION_FAILED")
    except Exception as error:
        recovery = recover_after_failure(values)
        raise RepairFailure(f"POST_VERIFY_FAILED_ROLLED_BACK:{error}:recovery={recovery}") from None

    write_result(args.result, evidence)
    final = {
        **result,
        "auth_links_verified": verified,
        "ambiguous_remaining": after["ambiguous_skipped"],
        "cosaf_to_1536": "PASS",
        "result_csv": str(args.result),
        "batch_id": BATCH_ID,
        "repaired_rows": evidence,
    }
    print(json.dumps(final, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RepairFailure as error:
        print(json.dumps({"status": "FAIL", "error": str(error)}, ensure_ascii=False, indent=2))
        raise SystemExit(1)
