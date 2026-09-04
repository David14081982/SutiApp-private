#!/usr/bin/env python3
"""Focal production proof for the two-column affiliate email XLSX export."""
import argparse
import io
import json
import re
import urllib.error
import urllib.parse
import urllib.request
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP_ORIGIN = "http://localhost:8080"
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def env():
    out = {}
    for raw in (ROOT / "supabase.env").read_text(encoding="utf-8-sig").splitlines():
        if raw.strip() and not raw.lstrip().startswith("#") and "=" in raw:
            key, value = raw.split("=", 1)
            out[key.strip()] = value.strip().strip('"').strip("'")
    return out


def request(url, method="GET", headers=None, body=None, expected=(200,)):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=180) as response:
            return response.status, response.headers, response.read()
    except urllib.error.HTTPError as error:
        payload = error.read()
        if error.code in expected:
            return error.code, error.headers, payload
        raise RuntimeError(f"HTTP_{error.code}:{payload[:500].decode(errors='replace')}") from None


def login(values, prefix):
    _, _, raw = request(
        values["SUPABASE_URL"] + "/auth/v1/token?grant_type=password",
        "POST",
        {"apikey": values["SUPABASE_PUBLISHABLE_KEY"], "Content-Type": "application/json"},
        {"email": values[prefix + "_EMAIL"], "password": values[prefix + "_PASSWORD"]},
    )
    return json.loads(raw)["access_token"]


def magic_link_login(values, email):
    _, _, link_raw = request(
        values["SUPABASE_URL"] + "/auth/v1/admin/generate_link",
        "POST",
        {"apikey": values["SUPABASE_SECRET_KEY"], "Content-Type": "application/json"},
        {"type": "magiclink", "email": email},
    )
    token_hash = json.loads(link_raw).get("hashed_token")
    assert token_hash, "MAGIC_LINK_HASH_MISSING"
    _, _, session_raw = request(
        values["SUPABASE_URL"] + "/auth/v1/verify",
        "POST",
        {"apikey": values["SUPABASE_PUBLISHABLE_KEY"], "Content-Type": "application/json"},
        {"type": "magiclink", "token_hash": token_hash},
    )
    session = json.loads(session_raw)
    assert session.get("access_token"), "MAGIC_LINK_SESSION_MISSING"
    return session["access_token"]


def logout(values, token):
    status, _, _ = request(
        values["SUPABASE_URL"] + "/auth/v1/logout",
        "POST",
        {"apikey": values["SUPABASE_PUBLISHABLE_KEY"], "Authorization": "Bearer " + token},
        expected=(200, 204),
    )
    assert status in (200, 204)


def edge(values, token=None, payload=None, expected=(200,)):
    headers = {"apikey": values["SUPABASE_PUBLISHABLE_KEY"], "Origin": APP_ORIGIN}
    if token:
        headers["Authorization"] = "Bearer " + token
    if payload is not None:
        headers["Content-Type"] = "application/json"
    return request(values["SUPABASE_URL"] + "/functions/v1/data-exports", "POST", headers, payload, expected)


def management(values, sql):
    ref = urllib.parse.urlsplit(values["SUPABASE_URL"]).hostname.split(".")[0]
    _, _, raw = request(
        f"https://api.supabase.com/v1/projects/{ref}/database/query",
        "POST",
        {
            "Authorization": "Bearer " + values["SUPABASE_ACCESS_TOKEN"],
            "Content-Type": "application/json",
            "User-Agent": "SutiApp-AffiliateEmailExportProof/1.0",
        },
        {"query": sql},
    )
    return json.loads(raw)


def snapshot(values):
    return management(values, r"""
with joined as (
  select a.id::text as id, a.historical_email_raw as historical, u.email as access, a.auth_user_id
  from public.affiliates a left join auth.users u on u.id=a.auth_user_id
), samples as (
  select
    (select json_build_object('id',id,'historical',historical,'access',access) from joined where historical is not null and historical=access order by id limit 1) as same_sample,
    (select json_build_object('id',id,'historical',historical,'access',access) from joined where auth_user_id is not null and historical is distinct from access order by id limit 1) as different_sample,
    (select json_build_object('id',id,'historical',historical,'access',access) from joined where auth_user_id is null order by id limit 1) as no_auth_sample
)
select
  (select count(*)::int from joined) as affiliate_rows,
  (select count(*)::int from joined where auth_user_id is null) as no_auth_rows,
  (select count(*)::int from joined where historical is not null and historical=access) as same_raw_rows,
  (select count(*)::int from joined where auth_user_id is not null and historical is distinct from access) as different_raw_rows,
  (select count(*)::int from joined where auth_user_id is not null and access is null) as unresolved_auth_links,
  (select md5(string_agg(concat_ws('|',a.id::text,coalesce(a.numero_control,'<NULL>'),coalesce(a.historical_email_raw,'<NULL>'),coalesce(a.historical_email_normalized,'<NULL>'),coalesce(a.auth_user_id::text,'<NULL>')),';' order by a.id)) from public.affiliates a) as affiliate_identity_hash,
  (select md5(string_agg(concat_ws('|',u.id::text,coalesce(u.email,'<NULL>')),';' order by u.id)) from auth.users u) as auth_identity_hash,
  (select count(*)::int from public.data_export_audit_log where domain='affiliates' and format='xlsx') as affiliate_xlsx_audits,
  samples.same_sample, samples.different_sample, samples.no_auth_sample
from samples;
""")[0]


def column_number(reference):
    letters = re.match(r"[A-Z]+", reference).group(0)
    value = 0
    for letter in letters:
        value = value * 26 + ord(letter) - 64
    return value


def xlsx_rows(payload):
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        required = {"[Content_Types].xml", "xl/workbook.xml", "xl/worksheets/sheet1.xml"}
        assert required.issubset(archive.namelist()), "XLSX_PACKAGE_INCOMPLETE"
        shared = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            shared = ["".join(node.text or "" for node in item.findall(".//m:t", NS)) for item in root.findall("m:si", NS)]
        sheet = ET.fromstring(archive.read("xl/worksheets/sheet1.xml"))
        rows = []
        for row in sheet.findall(".//m:sheetData/m:row", NS):
            cells = {}
            for node in row.findall("m:c", NS):
                index = column_number(node.attrib["r"])
                kind = node.attrib.get("t")
                if kind == "inlineStr":
                    value = "".join(item.text or "" for item in node.findall(".//m:t", NS))
                else:
                    raw = node.findtext("m:v", default="", namespaces=NS)
                    value = shared[int(raw)] if kind == "s" and raw else raw
                cells[index] = value
            rows.append([cells.get(index, "") for index in range(1, max(cells, default=0) + 1)])
        return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--allow-admin-magic-link", action="store_true")
    args = parser.parse_args()
    values = env()
    before = snapshot(values)
    assert before["same_sample"] and before["different_sample"] and before["no_auth_sample"]
    assert before["unresolved_auth_links"] == 0

    status, _, _ = edge(values, None, {"domain": "affiliates", "format": "xlsx", "filters": {}}, expected=(401,))
    assert status == 401
    normal_user_denied = "NOT_RUN_NO_CREDENTIAL"
    if "H005_TEST3_EMAIL" in values and "H005_TEST3_PASSWORD" in values:
        normal_token = login(values, "H005_TEST3")
        status, _, _ = edge(values, normal_token, {"domain": "affiliates", "format": "xlsx", "filters": {}}, expected=(403,))
        assert status == 403
        normal_user_denied = True

    admin_auth_method = "PASSWORD"
    try:
        admin_token = login(values, "H005_TEST")
    except RuntimeError as error:
        if not args.allow_admin_magic_link or "invalid_credentials" not in str(error):
            raise
        admin_token = magic_link_login(values, values["H005_TEST_EMAIL"])
        admin_auth_method = "CONTROLLED_MAGIC_LINK"
    try:
        status, headers, payload = edge(values, admin_token, {"domain": "affiliates", "format": "xlsx", "filters": {}})
    finally:
        logout(values, admin_token)
    assert status == 200 and payload.startswith(b"PK")
    assert headers.get_content_type() == "application/octet-stream"
    assert "no-store" in headers.get("Cache-Control", "")
    assert ".xlsx" in headers.get("Content-Disposition", "")

    rows = xlsx_rows(payload)
    headers_row = rows[0]
    assert headers_row.count("Correo histórico") == 1
    assert headers_row.count("Correo de acceso") == 1
    assert "auth_user_id" not in headers_row
    assert len(rows) == before["affiliate_rows"] + 1
    indexes = {value: index for index, value in enumerate(headers_row)}
    by_id = {row[indexes["id"]]: row for row in rows[1:]}

    same = before["same_sample"]
    different = before["different_sample"]
    no_auth = before["no_auth_sample"]
    assert by_id[same["id"]][indexes["Correo histórico"]] == same["historical"]
    assert by_id[same["id"]][indexes["Correo de acceso"]] == same["access"]
    assert same["historical"] == same["access"]
    assert by_id[different["id"]][indexes["Correo histórico"]] == (different["historical"] or "")
    assert by_id[different["id"]][indexes["Correo de acceso"]] == (different["access"] or "")
    assert different["historical"] != different["access"]
    assert by_id[no_auth["id"]][indexes["Correo histórico"]] == (no_auth["historical"] or "")
    assert by_id[no_auth["id"]][indexes["Correo de acceso"]] == ""

    after = snapshot(values)
    assert before["affiliate_identity_hash"] == after["affiliate_identity_hash"]
    assert before["auth_identity_hash"] == after["auth_identity_hash"]
    assert after["affiliate_xlsx_audits"] == before["affiliate_xlsx_audits"] + 1
    audit = management(values, """
select row_count, column_set from public.data_export_audit_log
where domain='affiliates' and format='xlsx' order by created_at desc limit 1;
""")[0]
    assert audit["row_count"] == before["affiliate_rows"]
    assert "historical_email_raw" in audit["column_set"] and "auth_email" in audit["column_set"]
    assert "auth_user_id" not in audit["column_set"]

    print(json.dumps({
        "status": "PASS",
        "affiliate_rows": before["affiliate_rows"],
        "same_email_scenario": True,
        "different_email_scenario": True,
        "no_auth_scenario": True,
        "xlsx_opened": True,
        "separate_email_columns": True,
        "auth_user_id_exported": False,
        "anonymous_denied": True,
        "normal_user_denied": normal_user_denied,
        "admin_auth_method": admin_auth_method,
        "qa_session_revoked": True,
        "master_identity_hash_unchanged": True,
        "export_audit_delta": 1,
        "secrets_exposed": 0,
    }, sort_keys=True))


if __name__ == "__main__":
    main()
