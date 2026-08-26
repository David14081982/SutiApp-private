#!/usr/bin/env python3
"""Reversible live proof for 20260823000300. Never prints credentials or PII."""
from __future__ import annotations
import json, urllib.error, urllib.parse, urllib.request, uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def env():
    values = {}
    for raw in (ROOT / 'supabase.env').read_text(encoding='utf-8-sig').splitlines():
        if raw.strip() and not raw.lstrip().startswith('#') and '=' in raw:
            key, value = raw.split('=', 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    return values

def request(url, key, method='GET', payload=None, token=None, returning=True):
    headers = {'apikey': key, 'Accept': 'application/json', 'User-Agent': 'SutiApp-MasterDelete/1.0'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    data = None
    if payload is not None:
        data = json.dumps(payload, separators=(',', ':')).encode()
        headers['Content-Type'] = 'application/json'
    if method in ('POST', 'PATCH', 'DELETE'):
        headers['Prefer'] = 'return=representation' if returning else 'return=minimal'
    try:
        with urllib.request.urlopen(urllib.request.Request(url, data=data, headers=headers, method=method), timeout=60) as response:
            raw = response.read()
            return response.status, json.loads(raw) if raw else []
    except urllib.error.HTTPError as error:
        raw = error.read()
        try:
            body = json.loads(raw) if raw else []
        except json.JSONDecodeError:
            body = []
        return error.code, body

def login(base, key, email, password):
    status, body = request(base + '/auth/v1/token?grant_type=password', key, 'POST', {'email': email, 'password': password})
    if status != 200:
        raise RuntimeError('LOGIN_FAILED')
    return body['access_token']

def rest(base, key, path, token=None):
    return request(base + '/rest/v1/' + path, key, token=token)

def delete(base, key, table, row_id, token=None):
    return request(base + f'/rest/v1/{table}?id=eq.{urllib.parse.quote(row_id)}', key, 'DELETE', {}, token)

def denied(status, rows):
    return status in (401, 403) or (status == 200 and rows == [])

def main():
    values = env()
    base = values['SUPABASE_URL'].rstrip('/')
    public = values['SUPABASE_PUBLISHABLE_KEY']
    secret = values['SUPABASE_SECRET_KEY']
    admin = login(base, public, values['H005_TEST_EMAIL'], values['H005_TEST_PASSWORD'])
    normals = [login(base, public, values[f'H005_TEST{i}_EMAIL'], values[f'H005_TEST{i}_PASSWORD']) for i in (2, 3)]
    before_status, before_rows = rest(base, secret, 'popups?select=id,record_origin')
    if before_status != 200:
        raise RuntimeError('BASELINE_READ_FAILED')
    before_count = len(before_rows)
    historical = next((row for row in before_rows if row['record_origin'] == 'HISTORICAL_IMPORT'), None)
    if not historical:
        raise RuntimeError('HISTORICAL_FIXTURE_MISSING')
    marker = 'MASTER_DELETE_' + uuid.uuid4().hex
    created_id = None
    results = {}
    try:
        status, rows = request(base + '/rest/v1/popups', public, 'POST', {
            'title': marker, 'body': 'reversible security proof', 'enabled': False,
            'sort_order': 99001, 'record_origin': 'ADMIN_H009'
        }, admin)
        if status != 201 or len(rows) != 1:
            raise RuntimeError('ADMIN_CREATE_FAILED')
        created_id = rows[0]['id']

        status, rows = delete(base, public, 'popups', created_id)
        results['anonymous_delete_denied'] = denied(status, rows)
        for index, token in enumerate(normals, 2):
            status, rows = delete(base, public, 'popups', created_id, token)
            results[f'normal_{index}_delete_denied'] = denied(status, rows)

        status, rows = delete(base, public, 'popups', historical['id'], admin)
        results['historical_delete_denied'] = denied(status, rows)
        historical_status, historical_rows = rest(base, secret, f"popups?select=id&id=eq.{historical['id']}")
        results['historical_preserved'] = historical_status == 200 and len(historical_rows) == 1

        status, rows = delete(base, public, 'popups', created_id, admin)
        results['admin_origin_delete'] = status == 200 and len(rows) == 1 and rows[0]['id'] == created_id
        after_delete_status, after_delete_rows = rest(base, secret, f'popups?select=id&id=eq.{created_id}')
        results['authority_reflects_delete'] = after_delete_status == 200 and after_delete_rows == []
        created_id = None

        audit_status, audit_rows = rest(base, public, 'admin_audit_log?select=resource,action,result&resource=eq.popups&action=eq.DELETE&result=eq.SUCCESS&order=created_at.desc&limit=1', admin)
        results['audit_log'] = audit_status == 200 and len(audit_rows) == 1
    finally:
        if created_id:
            delete(base, secret, 'popups', created_id)

    final_status, final_rows = rest(base, secret, 'popups?select=id,record_origin')
    results['fixture_cleanup'] = final_status == 200 and len(final_rows) == before_count
    if not all(results.values()):
        raise RuntimeError('DELETE_SECURITY_ASSERT_FAILED:' + ','.join(key for key, value in results.items() if not value))
    print(json.dumps({'status': 'PASS', **results, 'historical_count': sum(1 for row in final_rows if row['record_origin'] == 'HISTORICAL_IMPORT'), 'credentials_exposed': False}, sort_keys=True))

if __name__ == '__main__':
    main()
