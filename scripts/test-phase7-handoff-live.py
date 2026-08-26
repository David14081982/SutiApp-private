#!/usr/bin/env python3
"""Read-only Auth test for the admin-approved export boundary."""
import json, urllib.error, urllib.request, uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
def env():
    result = {}
    for raw in (ROOT / 'supabase.env').read_text(encoding='utf-8-sig').splitlines():
        if raw.strip() and not raw.lstrip().startswith('#') and '=' in raw:
            key, value = raw.split('=', 1); result[key.strip()] = value.strip().strip('"').strip("'")
    return result
def call(url, key, method='GET', payload=None, token=None, expected={200, 201, 204}):
    headers = {'apikey': key, 'Content-Type': 'application/json'}
    if token: headers['Authorization'] = 'Bearer ' + token
    request = urllib.request.Request(url, data=None if payload is None else json.dumps(payload).encode(), headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=60) as response: status, data = response.status, response.read()
    except urllib.error.HTTPError as error: status, data = error.code, error.read()
    try: body = json.loads(data) if data else None
    except json.JSONDecodeError: body = data.decode(errors='replace')
    if status not in expected: raise RuntimeError(f'HTTP_{status}:{str(body)[:400]}')
    return status, body
def login(base, key, email, password):
    return call(base + '/auth/v1/token?grant_type=password', key, 'POST', {'email': email, 'password': password})[1]['access_token']

def main():
    values = env(); base = values['SUPABASE_URL']; key = values['SUPABASE_PUBLISHABLE_KEY']
    edge = base + '/functions/v1/financial-legacy'
    admin = login(base, key, values['H005_TEST_EMAIL'], values['H005_TEST_PASSWORD'])
    normal = login(base, key, values['H005_TEST2_EMAIL'], values['H005_TEST2_PASSWORD'])
    request_id = str(uuid.uuid4())
    unauth, _ = call(edge, key, 'POST', {'action': 'handoff', 'request_id': request_id}, expected={401})
    denied, body = call(edge, key, 'POST', {'action': 'handoff', 'request_id': request_id}, normal, {403})
    if body.get('error') != 'ADMIN_APPROVAL_REQUIRED': raise RuntimeError('ADMIN_GATE_MISSING')
    admin_handoff, handoff_body = call(edge, key, 'POST', {'action': 'handoff', 'request_id': request_id}, admin, {404})
    admin_approve, approve_body = call(edge, key, 'POST', {'action': 'approve', 'request_id': request_id}, admin, {404})
    if handoff_body.get('error') != 'REQUEST_NOT_FOUND' or approve_body.get('error') != 'FINANCIAL_REQUEST_NOT_FOUND': raise RuntimeError('ADMIN_FAIL_CLOSED_MISSING')
    rest = base + '/rest/v1/financial_request_export_audit?select=program_request_id&limit=1'
    _, normal_audit = call(rest, key, token=normal)
    _, admin_audit = call(rest, key, token=admin)
    if normal_audit or admin_audit: raise RuntimeError('UNEXPECTED_EXPORT_AUDIT_ROW')
    admin_projection_url = base + '/rest/v1/program_requests?select=id,financial_export:financial_request_export_audit(export_status,attempt_count,error_code,updated_at)&limit=1'
    _, admin_projection = call(admin_projection_url, key, token=admin)
    if admin_projection: raise RuntimeError('UNEXPECTED_PROGRAM_REQUEST_ROW')
    print(json.dumps({'status': 'PASS', 'writes': 0, 'unauthenticated': unauth, 'normal_user': denied,
      'admin_handoff_missing': admin_handoff, 'admin_approve_missing': admin_approve,
      'normal_audit_rows': len(normal_audit), 'admin_audit_rows': len(admin_audit),
      'admin_projection_contract': 'PASS', 'error': body['error']}, sort_keys=True))
if __name__ == '__main__': main()
