"""Provision or roll back the single owner-authorized H-005 Auth test account."""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


class ProvisionFailure(RuntimeError):
    pass


def load_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        values[name.strip()] = value.strip().strip('"').strip("'")
    return values


def api_request(
    method: str,
    url: str,
    api_key: str,
    payload: object | None = None,
    prefer: str | None = None,
) -> tuple[int, object | None]:
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    headers = {"apikey": api_key, "Content-Type": "application/json"}
    if prefer:
        headers["Prefer"] = prefer
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            raw = response.read().decode("utf-8")
            return response.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as error:
        raw = error.read().decode("utf-8", errors="replace")
        try:
            detail = json.loads(raw)
        except json.JSONDecodeError:
            detail = {"message": "Remote administrative request failed"}
        raise ProvisionFailure(f"Remote request failed ({error.code}): {detail.get('message', 'request rejected')}") from error


def affiliate_url(base_url: str, affiliate_id: str, fields: str) -> str:
    query = urllib.parse.urlencode({"id": f"eq.{affiliate_id}", "select": fields})
    return f"{base_url}/rest/v1/affiliates?{query}"


def fetch_affiliate(base_url: str, secret_key: str, affiliate_id: str) -> dict[str, object]:
    _, rows = api_request(
        "GET",
        affiliate_url(
            base_url,
            affiliate_id,
            "id,numero_control,historical_email_raw,auth_eligibility,auth_user_id",
        ),
        secret_key,
    )
    if not isinstance(rows, list) or len(rows) != 1:
        raise ProvisionFailure("Authorized affiliate UUID does not resolve to exactly one row")
    return rows[0]


def rollback(base_url: str, secret_key: str, affiliate_id: str) -> dict[str, object]:
    affiliate = fetch_affiliate(base_url, secret_key, affiliate_id)
    auth_user_id = affiliate.get("auth_user_id")
    if not auth_user_id:
        return {"rolled_back": True, "auth_accounts_deleted": 0, "affiliate_unlinked": True}
    api_request("DELETE", f"{base_url}/auth/v1/admin/users/{auth_user_id}", secret_key)
    verified = fetch_affiliate(base_url, secret_key, affiliate_id)
    if verified.get("auth_user_id") is not None:
        raise ProvisionFailure("Rollback did not clear affiliate.auth_user_id")
    return {"rolled_back": True, "auth_accounts_deleted": 1, "affiliate_unlinked": True}


def provision(
    base_url: str,
    secret_key: str,
    affiliate_id: str,
    expected_numero_control: str,
    email: str,
    password: str,
) -> dict[str, object]:
    affiliate = fetch_affiliate(base_url, secret_key, affiliate_id)
    if affiliate.get("numero_control") != expected_numero_control:
        raise ProvisionFailure("Authorized UUID does not match the owner-approved numero_control")
    if affiliate.get("auth_eligibility") != "eligible":
        raise ProvisionFailure("Authorized affiliate is not Auth eligible")
    if affiliate.get("auth_user_id") is not None:
        raise ProvisionFailure("Authorized affiliate is already linked to Auth")
    if not str(affiliate.get("historical_email_raw") or "").strip():
        raise ProvisionFailure("Authorized affiliate has no historical email")

    _, created = api_request(
        "POST",
        f"{base_url}/auth/v1/admin/users",
        secret_key,
        {"email": email, "password": password, "email_confirm": True},
    )
    auth_user_id = created.get("id") if isinstance(created, dict) else None
    if not auth_user_id:
        raise ProvisionFailure("Auth account creation returned no user id")

    try:
        patch_url = affiliate_url(base_url, affiliate_id, "id,auth_user_id,auth_eligibility")
        _, linked = api_request(
            "PATCH",
            patch_url,
            secret_key,
            {"auth_user_id": auth_user_id},
            "return=representation",
        )
        if not isinstance(linked, list) or len(linked) != 1:
            raise ProvisionFailure("Affiliate linkage did not update exactly one row")
        if linked[0].get("auth_user_id") != auth_user_id:
            raise ProvisionFailure("Affiliate linkage returned an unexpected Auth id")
    except Exception:
        try:
            api_request("DELETE", f"{base_url}/auth/v1/admin/users/{auth_user_id}", secret_key)
        finally:
            raise

    verified = fetch_affiliate(base_url, secret_key, affiliate_id)
    if verified.get("auth_user_id") != auth_user_id:
        try:
            api_request("DELETE", f"{base_url}/auth/v1/admin/users/{auth_user_id}", secret_key)
        finally:
            raise ProvisionFailure("Post-provision reconciliation failed")

    return {
        "created_auth_accounts": 1,
        "affiliate_linked": True,
        "affiliate_id": affiliate_id,
        "auth_user_id": auth_user_id,
        "auth_eligibility": verified.get("auth_eligibility"),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--env-file", default="supabase.env")
    parser.add_argument("--expected-affiliate-id", required=True)
    parser.add_argument("--expected-numero-control", required=True)
    parser.add_argument("--rollback", action="store_true")
    args = parser.parse_args()

    values = load_env(Path(args.env_file))
    required = ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "H005_TEST_AFFILIATE_ID"]
    if not args.rollback:
        required.extend(["H005_TEST_EMAIL", "H005_TEST_PASSWORD"])
    missing = [name for name in required if not values.get(name)]
    if missing:
        raise ProvisionFailure(f"Missing required local variables: {', '.join(missing)}")
    if values["H005_TEST_AFFILIATE_ID"] != args.expected_affiliate_id:
        raise ProvisionFailure("Local H005_TEST_AFFILIATE_ID differs from the owner-authorized UUID")

    if args.rollback:
        result = rollback(values["SUPABASE_URL"].rstrip("/"), values["SUPABASE_SECRET_KEY"], args.expected_affiliate_id)
    else:
        result = provision(
            values["SUPABASE_URL"].rstrip("/"),
            values["SUPABASE_SECRET_KEY"],
            args.expected_affiliate_id,
            args.expected_numero_control,
            values["H005_TEST_EMAIL"],
            values["H005_TEST_PASSWORD"],
        )
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ProvisionFailure as error:
        print(json.dumps({"status": "FAIL", "error": str(error)}, sort_keys=True), file=sys.stderr)
        raise SystemExit(1)

