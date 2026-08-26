"""Live, credential-safe H-005 Auth and RLS verification."""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


def load_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        values[name.strip()] = value.strip().strip('"').strip("'")
    return values


def request(method: str, url: str, api_key: str, payload=None, access_token: str | None = None):
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    headers = {"apikey": api_key, "Content-Type": "application/json"}
    if access_token:
        headers["Authorization"] = f"Bearer {access_token}"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            raw = response.read().decode("utf-8")
            return response.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as error:
        raw = error.read().decode("utf-8", errors="replace")
        try:
            body = json.loads(raw)
        except json.JSONDecodeError:
            body = None
        return error.code, body


def require(condition: bool, message: str):
    if not condition:
        raise RuntimeError(message)


def main() -> int:
    values = load_env(Path("supabase.env"))
    required = [
        "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY",
        "H005_TEST_AFFILIATE_ID", "H005_TEST_EMAIL", "H005_TEST_PASSWORD",
    ]
    missing = [name for name in required if not values.get(name)]
    require(not missing, f"Missing local variables: {', '.join(missing)}")

    base = values["SUPABASE_URL"].rstrip("/")
    public_key = values["SUPABASE_PUBLISHABLE_KEY"]
    secret_key = values["SUPABASE_SECRET_KEY"]
    affiliate_id = values["H005_TEST_AFFILIATE_ID"]
    email = values["H005_TEST_EMAIL"]
    password = values["H005_TEST_PASSWORD"]

    other_query = urllib.parse.urlencode({"select": "id", "id": f"neq.{affiliate_id}", "limit": "1"})
    status, other_rows = request("GET", f"{base}/rest/v1/affiliates?{other_query}", secret_key)
    require(status == 200 and isinstance(other_rows, list) and len(other_rows) == 1, "Could not select an RLS control row")
    other_id = other_rows[0]["id"]

    token_url = f"{base}/auth/v1/token?grant_type=password"
    wrong_status, wrong_body = request("POST", token_url, public_key, {"email": email, "password": password + "-incorrect"})
    require(wrong_status in (400, 401) and not (isinstance(wrong_body, dict) and wrong_body.get("access_token")), "Incorrect password was not rejected")

    login_status, login = request("POST", token_url, public_key, {"email": email, "password": password})
    require(login_status == 200 and isinstance(login, dict) and login.get("access_token") and login.get("refresh_token"), "Real login failed")
    user_id = login.get("user", {}).get("id")
    require(bool(user_id), "Login returned no Auth user id")

    own_query = urllib.parse.urlencode({"select": "id,auth_user_id,auth_eligibility", "id": f"eq.{affiliate_id}"})
    own_status, own_rows = request("GET", f"{base}/rest/v1/affiliates?{own_query}", public_key, access_token=login["access_token"])
    require(own_status == 200 and isinstance(own_rows, list) and len(own_rows) == 1, "Own affiliate was not readable")
    require(own_rows[0].get("auth_user_id") == user_id and own_rows[0].get("auth_eligibility") == "eligible", "Auth-to-affiliate linkage mismatch")

    other_rls_query = urllib.parse.urlencode({"select": "id", "id": f"eq.{other_id}"})
    other_status, denied_rows = request("GET", f"{base}/rest/v1/affiliates?{other_rls_query}", public_key, access_token=login["access_token"])
    require(other_status == 200 and denied_rows == [], "Authenticated user could read another affiliate")

    anon_status, anon_rows = request("GET", f"{base}/rest/v1/affiliates?{own_query}", public_key)
    require(anon_status in (401, 403) or anon_rows == [], "Anonymous access was not denied")

    refresh_url = f"{base}/auth/v1/token?grant_type=refresh_token"
    refresh_status, refreshed = request("POST", refresh_url, public_key, {"refresh_token": login["refresh_token"]})
    require(refresh_status == 200 and isinstance(refreshed, dict) and refreshed.get("access_token") and refreshed.get("refresh_token"), "Session refresh failed")
    require(refreshed.get("user", {}).get("id") == user_id, "Session refresh changed the authenticated principal")

    logout_status, _ = request("POST", f"{base}/auth/v1/logout", public_key, access_token=refreshed["access_token"])
    require(logout_status in (200, 204), "Real logout failed")
    revoked_status, revoked = request("POST", refresh_url, public_key, {"refresh_token": refreshed["refresh_token"]})
    require(revoked_status in (400, 401) and not (isinstance(revoked, dict) and revoked.get("access_token")), "Logout did not revoke session refresh")

    print(json.dumps({
        "real_login": True,
        "incorrect_password_rejected": True,
        "affiliate_linked": True,
        "own_affiliate_readable": True,
        "other_affiliate_denied": True,
        "anonymous_denied": True,
        "session_refresh": True,
        "logout": True,
        "refresh_after_logout_denied": True,
    }, sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(json.dumps({"status": "FAIL", "error": str(error)}, sort_keys=True), file=sys.stderr)
        raise SystemExit(1)

