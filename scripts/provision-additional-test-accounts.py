"""Provision only additional H005_TEST<n> accounts declared in supabase.env.

Credential values never leave process memory and are never included in output.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid
from dataclasses import dataclass
from pathlib import Path


class ProvisionFailure(RuntimeError):
    pass


@dataclass(frozen=True)
class LocalAccount:
    alias: str
    affiliate_id: str
    email: str
    password: str


def load_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        values[name.strip()] = value.strip().strip('"').strip("'")
    return values


def discover_accounts(values: dict[str, str]) -> tuple[list[LocalAccount], dict[str, str]]:
    aliases = sorted({
        match.group(1)
        for name in values
        if (match := re.fullmatch(r"(H005_TEST[2-9][0-9]*)_(?:AFFILIATE_ID|EMAIL|PASSWORD)", name))
    }, key=lambda alias: int(alias.removeprefix("H005_TEST")))
    accounts: list[LocalAccount] = []
    conflicts: dict[str, str] = {}
    for alias in aliases:
        names = [f"{alias}_AFFILIATE_ID", f"{alias}_EMAIL", f"{alias}_PASSWORD"]
        if any(not values.get(name) for name in names):
            conflicts[alias] = "INCOMPLETE_LOCAL_VARIABLE_SET"
            continue
        accounts.append(LocalAccount(alias, values[names[0]], values[names[1]], values[names[2]]))

    by_affiliate: dict[str, list[str]] = {}
    by_email: dict[str, list[str]] = {}
    for account in accounts:
        by_affiliate.setdefault(account.affiliate_id, []).append(account.alias)
        by_email.setdefault(account.email.strip().casefold(), []).append(account.alias)
    for aliases_for_value in list(by_affiliate.values()) + list(by_email.values()):
        if len(aliases_for_value) > 1:
            for alias in aliases_for_value:
                conflicts[alias] = "DUPLICATE_LOCAL_ACCOUNT_TARGET"
    return accounts, conflicts


def request(method: str, url: str, api_key: str, payload: object | None = None,
            access_token: str | None = None, prefer: str | None = None) -> tuple[int, object | None]:
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    headers = {
        "apikey": api_key,
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "SutiApp-Additional-Test-Provisioner/1.0",
    }
    if access_token:
        headers["Authorization"] = f"Bearer {access_token}"
    if prefer:
        headers["Prefer"] = prefer
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=45) as response:
            raw = response.read().decode("utf-8")
            return response.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as error:
        raw = error.read().decode("utf-8", errors="replace")
        try:
            detail = json.loads(raw)
        except json.JSONDecodeError:
            detail = {}
        return error.code, {"_error_code": detail.get("code", "REMOTE_REJECTED")}


def require_success(status: int, expected: tuple[int, ...], operation: str) -> None:
    if status not in expected:
        raise ProvisionFailure(f"{operation}_HTTP_{status}")


def query_rows(base: str, secret: str, table: str, query: dict[str, str]) -> list[dict[str, object]]:
    status, body = request("GET", f"{base}/rest/v1/{table}?{urllib.parse.urlencode(query)}", secret)
    if status != 200:
        code = body.get("_error_code", "REMOTE_REJECTED") if isinstance(body, dict) else "REMOTE_REJECTED"
        raise ProvisionFailure(f"DATABASE_READ_FAILED_{code}_HTTP_{status}")
    if not isinstance(body, list):
        raise ProvisionFailure("DATABASE_RESPONSE_INVALID")
    return body


def fetch_affiliate(base: str, secret: str, affiliate_id: str) -> list[dict[str, object]]:
    return query_rows(base, secret, "affiliates", {
        "select": "id,historical_email_normalized,auth_eligibility,auth_user_id",
        "id": f"eq.{affiliate_id}",
        "limit": "2",
    })


def all_affiliate_links(base: str, secret: str) -> dict[str, object | None]:
    rows = query_rows(base, secret, "affiliates", {
        "select": "id,auth_user_id", "limit": "1000",
    })
    if len(rows) != 947:
        raise ProvisionFailure("AFFILIATE_BASELINE_COUNT_MISMATCH")
    return {str(row["id"]): row.get("auth_user_id") for row in rows}


def list_auth_users(base: str, secret: str) -> list[dict[str, object]]:
    status, body = request("GET", f"{base}/auth/v1/admin/users?page=1&per_page=1000", secret)
    require_success(status, (200,), "AUTH_LIST_FAILED")
    users = body.get("users") if isinstance(body, dict) else body
    if not isinstance(users, list):
        raise ProvisionFailure("AUTH_LIST_RESPONSE_INVALID")
    return users


def auth_users_for_email(users: list[dict[str, object]], email: str) -> list[dict[str, object]]:
    normalized = email.strip().casefold()
    return [user for user in users if str(user.get("email") or "").strip().casefold() == normalized]


def login(base: str, public: str, email: str, password: str) -> dict[str, object] | None:
    status, body = request("POST", f"{base}/auth/v1/token?grant_type=password", public,
                           {"email": email, "password": password})
    if status != 200 or not isinstance(body, dict) or not body.get("access_token") or not body.get("refresh_token"):
        return None
    return body


def unlink(base: str, secret: str, affiliate_id: str, auth_user_id: str) -> None:
    query = urllib.parse.urlencode({"id": f"eq.{affiliate_id}", "auth_user_id": f"eq.{auth_user_id}"})
    status, _ = request("PATCH", f"{base}/rest/v1/affiliates?{query}", secret,
                        {"auth_user_id": None}, prefer="return=minimal")
    require_success(status, (200, 204,), "RECOVERY_UNLINK_FAILED")


def delete_auth_user(base: str, secret: str, auth_user_id: str) -> None:
    status, _ = request("DELETE", f"{base}/auth/v1/admin/users/{auth_user_id}", secret)
    require_success(status, (200, 204,), "RECOVERY_AUTH_DELETE_FAILED")


def result(alias: str, *, found: bool = False, created: bool = False, linked: bool = False,
           login_ok: bool = False, current_ok: bool = False, logout_ok: bool = False,
           conflict: str = "NONE") -> dict[str, object]:
    return {
        "account_alias": alias,
        "affiliate_found": found,
        "auth_account_created": created,
        "affiliate_linked": linked,
        "login_test": login_ok,
        "current_affiliate_verified": current_ok,
        "logout": logout_ok,
        "conflict": conflict,
    }


def precheck_account(base: str, secret: str, account: LocalAccount,
                     users: list[dict[str, object]]) -> tuple[dict[str, object], dict[str, object] | None]:
    try:
        if str(uuid.UUID(account.affiliate_id)) != account.affiliate_id.lower():
            raise ValueError
    except (ValueError, AttributeError):
        return result(account.alias, conflict="AFFILIATE_ID_NOT_UUID"), None
    rows = fetch_affiliate(base, secret, account.affiliate_id)
    if len(rows) != 1:
        return result(account.alias, conflict="AFFILIATE_NOT_EXACTLY_ONE_ROW"), None
    affiliate = rows[0]
    if affiliate.get("auth_eligibility") != "eligible":
        return result(account.alias, found=True, conflict="AFFILIATE_NOT_AUTH_ELIGIBLE"), None
    historical = str(affiliate.get("historical_email_normalized") or "").strip().casefold()
    if not historical or historical != account.email.strip().casefold():
        return result(account.alias, found=True, conflict="LOCAL_EMAIL_DOES_NOT_MATCH_HISTORICAL_EMAIL"), None

    matches = auth_users_for_email(users, account.email)
    if len(matches) > 1:
        return result(account.alias, found=True, conflict="MULTIPLE_AUTH_ACCOUNTS_FOR_EMAIL"), None
    linked_id = affiliate.get("auth_user_id")
    email_user = matches[0] if matches else None
    if linked_id:
        linked_users = [user for user in users if user.get("id") == linked_id]
        if len(linked_users) != 1:
            return result(account.alias, found=True, conflict="LINKED_AUTH_ACCOUNT_NOT_FOUND"), None
        if str(linked_users[0].get("email") or "").strip().casefold() != account.email.strip().casefold():
            return result(account.alias, found=True, conflict="INCOMPATIBLE_EXISTING_AUTH_LINK"), None
        if email_user and email_user.get("id") != linked_id:
            return result(account.alias, found=True, conflict="EMAIL_BELONGS_TO_DIFFERENT_AUTH_ACCOUNT"), None
        email_user = linked_users[0]
    if email_user:
        owners = query_rows(base, secret, "affiliates", {
            "select": "id", "auth_user_id": f"eq.{email_user['id']}", "limit": "2",
        })
        if owners and (len(owners) != 1 or owners[0].get("id") != account.affiliate_id):
            return result(account.alias, found=True, conflict="AUTH_ACCOUNT_LINKED_TO_DIFFERENT_AFFILIATE"), None
    return result(account.alias, found=True), affiliate


def apply_account(base: str, public: str, secret: str, account: LocalAccount,
                  affiliate: dict[str, object], users: list[dict[str, object]]) -> dict[str, object]:
    existing = auth_users_for_email(users, account.email)
    auth_user_id = str(existing[0]["id"]) if existing else ""
    created = False
    linked_now = False
    try:
        if not auth_user_id:
            status, body = request("POST", f"{base}/auth/v1/admin/users", secret, {
                "email": account.email, "password": account.password, "email_confirm": True,
            })
            require_success(status, (200,), "AUTH_CREATE_FAILED")
            if not isinstance(body, dict) or not body.get("id"):
                raise ProvisionFailure("AUTH_CREATE_RESPONSE_INVALID")
            auth_user_id = str(body["id"])
            created = True

        session = login(base, public, account.email, account.password)
        if not session:
            raise ProvisionFailure("LOCAL_CREDENTIALS_DO_NOT_AUTHENTICATE")
        session_user_id = str((session.get("user") or {}).get("id") or "")
        if session_user_id != auth_user_id:
            raise ProvisionFailure("AUTH_PRINCIPAL_MISMATCH")

        current_link = affiliate.get("auth_user_id")
        if current_link and str(current_link) != auth_user_id:
            raise ProvisionFailure("INCOMPATIBLE_EXISTING_AUTH_LINK")
        if not current_link:
            query = urllib.parse.urlencode({
                "id": f"eq.{account.affiliate_id}", "auth_user_id": "is.null",
                "select": "id,auth_user_id",
            })
            status, body = request("PATCH", f"{base}/rest/v1/affiliates?{query}", secret,
                                   {"auth_user_id": auth_user_id}, prefer="return=representation")
            require_success(status, (200,), "AFFILIATE_LINK_FAILED")
            if not isinstance(body, list) or len(body) != 1 or body[0].get("auth_user_id") != auth_user_id:
                raise ProvisionFailure("AFFILIATE_LINK_NOT_EXACTLY_ONE_ROW")
            linked_now = True

        repo_query = urllib.parse.urlencode({
            "select": "id,auth_user_id,auth_eligibility",
            "auth_user_id": f"eq.{auth_user_id}",
        })
        status, rows = request("GET", f"{base}/rest/v1/affiliates?{repo_query}", public,
                               access_token=str(session["access_token"]))
        current_ok = (status == 200 and isinstance(rows, list) and len(rows) == 1
                      and rows[0].get("id") == account.affiliate_id
                      and rows[0].get("auth_user_id") == auth_user_id
                      and rows[0].get("auth_eligibility") == "eligible")
        if not current_ok:
            raise ProvisionFailure("CURRENT_AFFILIATE_VERIFICATION_FAILED")

        status, _ = request("POST", f"{base}/auth/v1/logout", public,
                            access_token=str(session["access_token"]))
        require_success(status, (200, 204), "LOGOUT_FAILED")
        refresh_status, refresh_body = request("POST", f"{base}/auth/v1/token?grant_type=refresh_token",
                                               public, {"refresh_token": session["refresh_token"]})
        logout_ok = refresh_status in (400, 401) and not (
            isinstance(refresh_body, dict) and refresh_body.get("access_token"))
        if not logout_ok:
            raise ProvisionFailure("LOGOUT_REFRESH_NOT_REVOKED")
        return result(account.alias, found=True, created=created, linked=True,
                      login_ok=True, current_ok=True, logout_ok=True)
    except ProvisionFailure as error:
        recovery_error = None
        try:
            if linked_now:
                unlink(base, secret, account.affiliate_id, auth_user_id)
            if created and auth_user_id:
                delete_auth_user(base, secret, auth_user_id)
        except ProvisionFailure as recovery:
            recovery_error = recovery
        conflict = str(error) if recovery_error is None else f"{error};{recovery_error}"
        return result(account.alias, found=True, conflict=conflict)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--env-file", default="supabase.env")
    parser.add_argument("--mode", choices=("precheck", "apply"), required=True)
    args = parser.parse_args()
    values = load_env(Path(args.env_file))
    required = ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY"]
    missing = [name for name in required if not values.get(name)]
    if missing:
        raise ProvisionFailure("MISSING_ADMINISTRATIVE_CONFIGURATION")
    accounts, local_conflicts = discover_accounts(values)
    if not accounts and not local_conflicts:
        raise ProvisionFailure("NO_ADDITIONAL_TEST_ACCOUNTS_DECLARED")

    base = values["SUPABASE_URL"].rstrip("/")
    public = values["SUPABASE_PUBLISHABLE_KEY"]
    secret = values["SUPABASE_SECRET_KEY"]
    before_links = all_affiliate_links(base, secret)
    users = list_auth_users(base, secret)
    results: list[dict[str, object]] = []
    ready: dict[str, dict[str, object]] = {}
    for account in accounts:
        if account.alias in local_conflicts:
            results.append(result(account.alias, conflict=local_conflicts[account.alias]))
            continue
        checked, affiliate = precheck_account(base, secret, account, users)
        if affiliate is None:
            results.append(checked)
        else:
            ready[account.alias] = affiliate
            results.append(checked if args.mode == "precheck" else apply_account(
                base, public, secret, account, affiliate, users))
            users = list_auth_users(base, secret)
    for alias, conflict in local_conflicts.items():
        if not any(item["account_alias"] == alias for item in results):
            results.append(result(alias, conflict=conflict))

    after_links = all_affiliate_links(base, secret)
    allowed = {account.affiliate_id for account in accounts}
    unexpected = [affiliate_id for affiliate_id in before_links
                  if before_links[affiliate_id] != after_links[affiliate_id] and affiliate_id not in allowed]
    if unexpected:
        raise ProvisionFailure("NON_TARGET_AFFILIATE_WAS_MODIFIED")
    print(json.dumps({"mode": args.mode, "accounts": results}, sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ProvisionFailure as error:
        print(json.dumps({"status": "FAIL", "error": str(error)}, sort_keys=True), file=sys.stderr)
        raise SystemExit(1)
