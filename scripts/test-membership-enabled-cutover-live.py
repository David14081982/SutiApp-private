#!/usr/bin/env python3
"""Live, reversible verification of membership enabled authority and RLS."""
import json
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def env():
    values = {}
    for raw in (ROOT / 'supabase.env').read_text(encoding='utf-8-sig').splitlines():
        if raw.strip() and not raw.lstrip().startswith('#') and '=' in raw:
            key, value = raw.split('=', 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def call(url, key, method='GET', body=None, token=None, prefer=None, expected=None):
    headers = {'apikey': key, 'Accept': 'application/json', 'User-Agent': 'SutiApp-Membership-Enabled-Test/1.0'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    if body is not None:
        headers['Content-Type'] = 'application/json'
        body = json.dumps(body).encode()
    if prefer:
        headers['Prefer'] = prefer
    try:
        request = urllib.request.Request(url, data=body, headers=headers, method=method)
        with urllib.request.urlopen(request, timeout=60) as response:
            raw = response.read()
            return response.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as error:
        if expected and error.code in expected:
            return error.code, None
        raise RuntimeError(f'Membership enabled HTTP {error.code}: ' + error.read(300).decode('utf-8', 'replace')) from None


def login(base, key, email, password):
    _, data = call(base + '/auth/v1/token?grant_type=password', key, 'POST', {'email': email, 'password': password})
    return data['access_token']


def main():
    values = env()
    base = values['SUPABASE_URL'].rstrip('/')
    rest = base + '/rest/v1'
    key = values['SUPABASE_PUBLISHABLE_KEY']
    admin = login(base, key, values['H005_TEST_EMAIL'], values['H005_TEST_PASSWORD'])
    normal = login(base, key, values['H005_TEST2_EMAIL'], values['H005_TEST2_PASSWORD'])
    _, rows = call(rest + '/membership_offerings?select=id,company_raw,enabled&order=sort_order.asc', key, token=admin)
    bud = next((row for row in rows if row['company_raw'] == 'Bud Tv Ultra'), None)
    if not bud or len(rows) != 6:
        raise RuntimeError('canonical Bud Tv Ultra row missing')
    target = rest + '/membership_offerings?id=eq.' + bud['id']
    try:
        call(target, key, 'PATCH', {'enabled': False}, admin, 'return=minimal')
        normal_status, normal_result = call(target, key, 'PATCH', {'enabled': True}, normal, 'return=representation', expected={401, 403})
        if normal_status not in {401, 403} and normal_result:
            raise RuntimeError('normal writer changed a protected row')
        _, unchanged = call(target + '&select=id,enabled', key, token=admin)
        if len(unchanged) != 1 or unchanged[0]['enabled'] is not False:
            raise RuntimeError('normal writer bypassed RLS')
        anon_status, anon_result = call(target, key, 'PATCH', {'enabled': True}, prefer='return=representation', expected={401, 403})
        if anon_status not in {401, 403} and anon_result:
            raise RuntimeError('anonymous writer changed a protected row')
        _, unchanged = call(target + '&select=id,enabled', key, token=admin)
        if len(unchanged) != 1 or unchanged[0]['enabled'] is not False:
            raise RuntimeError('anonymous writer bypassed RLS')

        _, disabled = call(target, key, 'PATCH', {'enabled': False}, admin, 'return=representation')
        if not disabled or disabled[0]['enabled'] is not False:
            raise RuntimeError('admin disable failed')
        _, hidden = call(rest + '/membership_offerings?select=id&id=eq.' + bud['id'], key, token=normal)
        if hidden:
            raise RuntimeError('disabled membership remained visible to user')

        _, enabled = call(target, key, 'PATCH', {'enabled': True}, admin, 'return=representation')
        if not enabled or enabled[0]['enabled'] is not True:
            raise RuntimeError('admin enable failed')
        _, visible = call(rest + '/membership_offerings?select=id&id=eq.' + bud['id'], key, token=normal)
        if len(visible) != 1:
            raise RuntimeError('enabled membership was not visible to user')
    finally:
        call(target, key, 'PATCH', {'enabled': True}, admin, 'return=minimal')

    print(json.dumps({
        'status': 'PASS',
        'authority': 'public.membership_offerings.enabled',
        'bud_tv_ultra_enabled': True,
        'normal_write': 'DENIED',
        'anon_write': 'DENIED',
        'disabled_hidden': True,
        'enabled_visible': True,
    }, sort_keys=True))


if __name__ == '__main__':
    main()
