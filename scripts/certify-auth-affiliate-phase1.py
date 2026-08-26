#!/usr/bin/env python3
"""Credential-safe live certification for Auth <-> Affiliate phase 1.

Reads the productive census with the local Supabase secret, exercises RLS with
three owner-authorized test accounts, and opens/closes one audited admin
impersonation. It never creates, deletes, relinks, or edits an affiliate/Auth
identity and never prints credentials, emails, tokens, UUIDs, or PII.
"""
from __future__ import annotations

import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_env() -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in (ROOT / "supabase.env").read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        values[name.strip()] = value.strip().strip('"').strip("'")
    return values


def request(method: str, url: str, key: str, payload=None, token: str | None = None,
            prefer: str | None = None, extra: dict[str, str] | None = None):
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    headers = {"apikey": key, "Accept": "application/json", "Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if prefer:
        headers["Prefer"] = prefer
    if extra:
        headers.update(extra)
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            raw = response.read().decode("utf-8")
            try:
                body = json.loads(raw) if raw else None
            except json.JSONDecodeError:
                body = raw
            return response.status, body, dict(response.headers)
    except urllib.error.HTTPError as error:
        raw = error.read().decode("utf-8", errors="replace")
        try:
            body = json.loads(raw) if raw else None
        except json.JSONDecodeError:
            body = raw
        return error.code, body, dict(error.headers)


def require(condition: bool, message: str):
    if not condition:
        raise RuntimeError(message)


def rest(base: str, key: str, path: str, token: str | None = None):
    status, body, _ = request("GET", f"{base}/rest/v1/{path}", key, token=token,
                              extra={"Range": "0-9999"})
    require(status == 200 and isinstance(body, list), f"REST read failed: {path} ({status})")
    return body


def rpc(base: str, key: str, name: str, payload: dict, token: str | None = None):
    return request("POST", f"{base}/rest/v1/rpc/{name}", key, payload, token)


def login(base: str, key: str, email: str, password: str):
    status, body, _ = request("POST", f"{base}/auth/v1/token?grant_type=password", key,
                              {"email": email, "password": password})
    require(status == 200 and isinstance(body, dict) and body.get("access_token")
            and body.get("refresh_token") and body.get("user", {}).get("id"), "Controlled login failed")
    return body


def normalized(value: str | None) -> str | None:
    text = str(value or "").strip().lower()
    return text or None


def duplicate_stats(values):
    counts = Counter(value for value in values if value is not None)
    groups = {value: count for value, count in counts.items() if count > 1}
    return len(groups), sum(groups.values())


def main() -> int:
    env = load_env()
    required = [
        "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY",
        "H005_TEST_AFFILIATE_ID", "H005_TEST_EMAIL", "H005_TEST_PASSWORD",
        "H005_TEST2_AFFILIATE_ID", "H005_TEST2_EMAIL", "H005_TEST2_PASSWORD",
        "H005_TEST3_AFFILIATE_ID", "H005_TEST3_EMAIL", "H005_TEST3_PASSWORD",
    ]
    require(not [name for name in required if not env.get(name)], "Missing controlled certification variables")
    base = env["SUPABASE_URL"].rstrip("/")
    public = env["SUPABASE_PUBLISHABLE_KEY"]
    secret = env["SUPABASE_SECRET_KEY"]

    affiliate_fields = urllib.parse.quote(
        "id,numero_control,historical_email_raw,historical_email_normalized,auth_user_id,auth_eligibility,source_row_ordinal",
        safe=",",
    )
    affiliates = rest(base, secret, f"affiliates?select={affiliate_fields}&order=source_row_ordinal.asc")
    require(len(affiliates) < 10000, "Affiliate census may be truncated")

    users = []
    page = 1
    while True:
        status, body, _ = request("GET", f"{base}/auth/v1/admin/users?page={page}&per_page=1000", secret)
        require(status == 200 and isinstance(body, dict) and isinstance(body.get("users"), list), "Auth census failed")
        batch = body["users"]
        users.extend(batch)
        if len(batch) < 1000:
            break
        page += 1
        require(page <= 100, "Auth census pagination exceeded safety bound")

    by_affiliate_id = {row["id"]: row for row in affiliates}
    auth_ids = {user["id"] for user in users}
    auth_by_id = {user["id"]: user for user in users}
    linked = [row for row in affiliates if row.get("auth_user_id")]
    linked_auth_ids = {row["auth_user_id"] for row in linked if row["auth_user_id"] in auth_ids}
    dangling_fk = [row for row in linked if row["auth_user_id"] not in auth_ids]
    auth_link_counts = Counter(row["auth_user_id"] for row in linked)
    multiple_affiliates_to_auth = sum(1 for count in auth_link_counts.values() if count > 1)
    numero_groups, numero_rows = duplicate_stats(row.get("numero_control") for row in affiliates)
    email_groups, email_rows = duplicate_stats(normalized(row.get("historical_email_normalized")) for row in affiliates)
    eligible_email_groups, eligible_email_rows = duplicate_stats(
        normalized(row.get("historical_email_normalized"))
        for row in affiliates if row.get("auth_eligibility") == "eligible"
    )
    wrong_bindings = []
    for row in linked:
        user = auth_by_id.get(row["auth_user_id"])
        if not user:
            continue
        if normalized(user.get("email")) != normalized(row.get("historical_email_normalized")):
            wrong_bindings.append(row)
    ambiguous_bindings = [
        row for row in linked
        if normalized(row.get("historical_email_normalized"))
        and sum(1 for candidate in affiliates
                if normalized(candidate.get("historical_email_normalized"))
                == normalized(row.get("historical_email_normalized"))) > 1
    ]

    control_aliases = ("H005_TEST", "H005_TEST2", "H005_TEST3")
    sessions = {
        alias: login(base, public, env[f"{alias}_EMAIL"], env[f"{alias}_PASSWORD"])
        for alias in control_aliases
    }
    for alias, session in sessions.items():
        expected_affiliate = env[f"{alias}_AFFILIATE_ID"]
        require(expected_affiliate in by_affiliate_id, "Controlled affiliate missing from census")
        require(by_affiliate_id[expected_affiliate].get("auth_user_id") == session["user"]["id"],
                "Controlled Auth binding mismatch")

    # Wrong password and nonexistent account have the same controlled boundary.
    status, body, _ = request("POST", f"{base}/auth/v1/token?grant_type=password", public,
                              {"email": env["H005_TEST_EMAIL"], "password": env["H005_TEST_PASSWORD"] + "-wrong"})
    require(status in (400, 401) and not (isinstance(body, dict) and body.get("access_token")),
            "Wrong password was accepted")
    status, body, _ = request("POST", f"{base}/auth/v1/token?grant_type=password", public,
                              {"email": "nonexistent-phase1-certification@example.invalid", "password": "not-a-real-password"})
    require(status in (400, 401) and not (isinstance(body, dict) and body.get("access_token")),
            "Nonexistent account was not rejected")

    isolation = {}
    for alias in control_aliases:
        token = sessions[alias]["access_token"]
        own_id = env[f"{alias}_AFFILIATE_ID"]
        own = rest(base, public, f"affiliates?select=id,auth_user_id,numero_control&id=eq.{own_id}", token)
        all_visible = rest(base, public, "affiliates?select=id,auth_user_id,numero_control", token)
        require(len(own) == 1 and len(all_visible) == 1 and own[0]["id"] == all_visible[0]["id"],
                "Self read or single-context isolation failed")
        for other_alias in control_aliases:
            if other_alias == alias:
                continue
            other_id = env[f"{other_alias}_AFFILIATE_ID"]
            denied = rest(base, public, f"affiliates?select=id&id=eq.{other_id}", token)
            require(denied == [], "Cross-user affiliate read was visible")
            status, patched, _ = request(
                "PATCH", f"{base}/rest/v1/affiliates?id=eq.{other_id}", public,
                {"display_name": "PHASE1_DENIED_NO_WRITE"}, token, "return=representation"
            )
            require(status in (401, 403) or (status in (200, 204) and (patched in (None, []) or patched == "")),
                    "Cross-user affiliate write was not denied")
        isolation[alias] = True

    own_id = env["H005_TEST_AFFILIATE_ID"]
    status, anon_rows, _ = request("GET", f"{base}/rest/v1/affiliates?select=id&id=eq.{own_id}", public)
    require(status in (401, 403) or anon_rows == [], "Anonymous affiliate read was visible")
    status, anon_write, _ = request("PATCH", f"{base}/rest/v1/affiliates?id=eq.{own_id}", public,
                                    {"display_name": "PHASE1_ANON_DENIED"}, prefer="return=representation")
    require(status in (401, 403) or anon_write in (None, [], ""), "Anonymous affiliate write was accepted")

    # The claim RPC has no affiliate selector: attempts to nominate B are rejected.
    status, _, _ = rpc(base, public, "claim_affiliate_identity",
                        {"p_affiliate_id": env["H005_TEST2_AFFILIATE_ID"]}, sessions["H005_TEST"]["access_token"])
    require(status >= 400, "Claim RPC unexpectedly accepted a caller-selected affiliate")

    # Admin/normal permission boundary and lookup.
    admin_token = sessions["H005_TEST"]["access_token"]
    normal_token = sessions["H005_TEST2"]["access_token"]
    for alias, token, expected_admin in (
        ("H005_TEST", admin_token, True), ("H005_TEST2", normal_token, False),
        ("H005_TEST3", sessions["H005_TEST3"]["access_token"], False),
    ):
        status, context, _ = rpc(base, public, "get_admin_access_context", {}, token)
        require(status == 200 and isinstance(context, dict), "Admin context RPC failed")
        actual = bool(context.get("technical_permissions") or context.get("section_actions"))
        require(actual is expected_admin, "Technical admin classification mismatch")
    target_row = by_affiliate_id[env["H005_TEST2_AFFILIATE_ID"]]
    search_term = str(target_row.get("numero_control") or "").strip()
    if len(search_term) < 2:
        search_term = "__phase1_no_match__"
    status, found, _ = rpc(base, public, "search_affiliates_for_impersonation", {"p_query": search_term}, admin_token)
    require(status == 200 and isinstance(found, list), "Authorized admin affiliate lookup failed")
    if target_row.get("numero_control") and len(str(target_row["numero_control"]).strip()) >= 2:
        require(any(item.get("id") == target_row["id"] for item in found), "Admin lookup did not return target affiliate")
    status, _, _ = rpc(base, public, "search_affiliates_for_impersonation", {"p_query": search_term}, normal_token)
    require(status >= 400, "Normal user executed admin affiliate lookup")

    # Audited, reversible impersonation: actor remains Auth admin; context becomes B.
    rpc(base, public, "stop_affiliate_impersonation", {}, admin_token)
    status, started, _ = rpc(base, public, "start_affiliate_impersonation", {
        "p_affiliate_id": env["H005_TEST2_AFFILIATE_ID"],
        "p_reason": "FASE 1 certificacion controlada de identidad",
    }, admin_token)
    require(status == 200 and isinstance(started, list) and len(started) == 1, "Admin impersonation did not start")
    try:
        status, user_body, _ = request("GET", f"{base}/auth/v1/user", public, token=admin_token)
        require(status == 200 and user_body.get("id") == sessions["H005_TEST"]["user"]["id"],
                "Impersonation replaced real Auth principal")
        status, effective, _ = rpc(base, public, "get_effective_affiliate_id", {}, admin_token)
        require(status == 200 and effective == env["H005_TEST2_AFFILIATE_ID"], "Impersonated context mismatch")
        visible = rest(base, public, "affiliates?select=id", admin_token)
        require(visible == [{"id": env["H005_TEST2_AFFILIATE_ID"]}], "Impersonation RLS context mismatch")

        refresh_status, refreshed, _ = request(
            "POST", f"{base}/auth/v1/token?grant_type=refresh_token", public,
            {"refresh_token": sessions["H005_TEST"]["refresh_token"]},
        )
        require(refresh_status == 200 and refreshed.get("user", {}).get("id") == sessions["H005_TEST"]["user"]["id"],
                "Admin refresh changed actor_real")
        admin_token = refreshed["access_token"]
        status, effective_after_refresh, _ = rpc(base, public, "get_effective_affiliate_id", {}, admin_token)
        require(status == 200 and effective_after_refresh == env["H005_TEST2_AFFILIATE_ID"],
                "Refresh lost or corrupted active impersonation context")
    finally:
        stop_status, stopped, _ = rpc(base, public, "stop_affiliate_impersonation", {}, admin_token)
        require(stop_status == 200 and stopped is True, "Impersonation cleanup failed")
    status, restored, _ = rpc(base, public, "get_effective_affiliate_id", {}, admin_token)
    require(status == 200 and restored == env["H005_TEST_AFFILIATE_ID"], "Real affiliate context was not restored")
    status, _, _ = rpc(base, public, "start_affiliate_impersonation", {
        "p_affiliate_id": env["H005_TEST_AFFILIATE_ID"], "p_reason": "FASE 1 intento normal denegado",
    }, normal_token)
    require(status >= 400, "Normal user started impersonation")

    # Private relation isolation, where productive rows exist for controlled A/B.
    private_matrix = {}
    for owner_alias in ("H005_TEST2", "H005_TEST3"):
        owner_id = env[f"{owner_alias}_AFFILIATE_ID"]
        service_rows = rest(base, secret, f"affiliate_files?select=id,affiliate_id,private_asset_id&affiliate_id=eq.{owner_id}")
        requester_alias = "H005_TEST3" if owner_alias == "H005_TEST2" else "H005_TEST2"
        requester_token = sessions[requester_alias]["access_token"]
        denied_rows = rest(base, public, f"affiliate_files?select=id&affiliate_id=eq.{owner_id}", requester_token)
        require(denied_rows == [], "Cross-user private relation was visible")
        private_matrix[f"{requester_alias}_to_{owner_alias}"] = "DENIED_WITH_FIXTURE" if service_rows else "DENIED_NO_OWNER_FIXTURE"

    # Logout every controlled session used by the test and prove refresh revocation.
    logout_results = {}
    sessions["H005_TEST"]["access_token"] = admin_token
    for alias, session in sessions.items():
        status, _, _ = request("POST", f"{base}/auth/v1/logout", public, token=session["access_token"])
        require(status in (200, 204), "Controlled logout failed")
        status, revoked, _ = request("POST", f"{base}/auth/v1/token?grant_type=refresh_token", public,
                                     {"refresh_token": session["refresh_token"]})
        # The admin token was rotated during impersonation; its original refresh token is necessarily invalid.
        require(status in (400, 401) and not (isinstance(revoked, dict) and revoked.get("access_token")),
                "Refresh survived logout or token rotation")
        logout_results[alias] = True

    leading_zero = sum(1 for row in affiliates if isinstance(row.get("numero_control"), str)
                       and len(row["numero_control"]) > 1 and row["numero_control"].startswith("0"))
    non_numeric = sum(1 for row in affiliates if isinstance(row.get("numero_control"), str)
                      and row["numero_control"] and not re.fullmatch(r"\d+", row["numero_control"]))
    non_string = sum(1 for row in affiliates if row.get("numero_control") is not None
                     and not isinstance(row.get("numero_control"), str))

    result = {
        "status": "PASS",
        "census": {
            "affiliates": len(affiliates),
            "auth_users": len(users),
            "linked_affiliates": len(linked),
            "auth_users_linked_to_affiliate": len(linked_auth_ids),
            "affiliates_without_auth": len(affiliates) - len(linked),
            "auth_without_affiliate": len(auth_ids - linked_auth_ids),
            "dangling_auth_fk": len(dangling_fk),
            "multiple_auth_to_affiliate": 0,
            "multiple_affiliates_to_auth": multiple_affiliates_to_auth,
            "duplicate_numero_control_groups": numero_groups,
            "duplicate_numero_control_rows": numero_rows,
            "duplicate_normalized_email_groups": email_groups,
            "duplicate_normalized_email_rows": email_rows,
            "duplicate_eligible_email_groups": eligible_email_groups,
            "duplicate_eligible_email_rows": eligible_email_rows,
            "wrong_bindings": len(wrong_bindings),
            "ambiguous_bindings": len(ambiguous_bindings),
        },
        "numero_control": {
            "all_non_null_values_are_strings": non_string == 0,
            "leading_zero_values_preserved": leading_zero,
            "non_numeric_values_preserved": non_numeric,
        },
        "auth_matrix": {
            "controlled_bindings": 3,
            "wrong_password": "DENIED",
            "nonexistent_account": "DENIED",
            "self_read": "PASS",
            "cross_user_read": "DENIED",
            "cross_user_write": "DENIED",
            "anonymous_read": "DENIED",
            "anonymous_write": "DENIED",
            "caller_selected_claim": "DENIED",
            "admin_lookup": "PASS",
            "normal_admin_lookup": "DENIED",
            "admin_impersonation": "PASS",
            "normal_impersonation": "DENIED",
            "actor_real_preserved": "PASS",
            "context_restored": "PASS",
            "refresh_during_impersonation": "PASS",
            "logout_and_refresh_revocation": "PASS",
            "private_relation_isolation": private_matrix,
        },
    }
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(json.dumps({"status": "FAIL", "error": str(error)}, ensure_ascii=False), file=sys.stderr)
        raise SystemExit(1)
