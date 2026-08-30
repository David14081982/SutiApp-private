#!/usr/bin/env python3
"""Live adversarial matrix for context-bound affiliate-document access."""
import datetime
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ALIASES = ('H005_TEST', 'H005_TEST2', 'H005_TEST3')


def env():
    values = {}
    for raw in (ROOT / 'supabase.env').read_text(encoding='utf-8-sig').splitlines():
        if raw.strip() and not raw.lstrip().startswith('#') and '=' in raw:
            key, value = raw.split('=', 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def request(url, key, method='GET', payload=None, token=None, extra=None, raw=False):
    headers = {'apikey': key, 'Accept': 'application/json', 'User-Agent': 'SutiApp-Document-Isolation-Test/1.0'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    if payload is not None:
        headers['Content-Type'] = 'application/json'
    if extra:
        headers.update(extra)
    data = None if payload is None else json.dumps(payload).encode()
    try:
        with urllib.request.urlopen(urllib.request.Request(url, data=data, headers=headers, method=method), timeout=60) as response:
            body = response.read()
            return response.status, body if raw else (json.loads(body) if body else None), dict(response.headers)
    except urllib.error.HTTPError as error:
        body = error.read()
        try:
            decoded = json.loads(body)
        except Exception:
            decoded = None
        return error.code, body if raw else decoded, dict(error.headers)


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def rpc(base, key, token, name, payload=None):
    return request(base + '/rest/v1/rpc/' + name, key, 'POST', payload or {}, token)[:2]


def login(values, alias):
    status, body, _ = request(values['SUPABASE_URL'].rstrip('/') + '/auth/v1/token?grant_type=password',
                              values['SUPABASE_PUBLISHABLE_KEY'], 'POST',
                              {'email': values[alias + '_EMAIL'], 'password': values[alias + '_PASSWORD']})
    require(status == 200 and body.get('access_token') and body.get('user', {}).get('id'), alias + '_LOGIN_FAILED')
    return {'token': body['access_token'], 'user_id': body['user']['id'],
            'affiliate_id': values[alias + '_AFFILIATE_ID']}


def edge(base, key, token, body):
    return request(base + '/functions/v1/document-access', key, 'POST', body, token)[:2]


def management(values, sql):
    ref = urllib.parse.urlsplit(values['SUPABASE_URL']).hostname.split('.')[0]
    req = urllib.request.Request(
        'https://api.supabase.com/v1/projects/' + ref + '/database/query',
        data=json.dumps({'query': sql}).encode(), method='POST',
        headers={'Authorization': 'Bearer ' + values['SUPABASE_ACCESS_TOKEN'],
                 'Content-Type': 'application/json', 'User-Agent': 'SutiApp-Document-Isolation-Test/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            return json.loads(response.read())
    except urllib.error.HTTPError as error:
        raise RuntimeError('MANAGEMENT_SQL_' + str(error.code) + ':' + error.read().decode('utf-8', 'replace')[:600]) from None


def assert_projection(rows, affiliate_id, label):
    require(isinstance(rows, list), label + '_NOT_LIST')
    forbidden = {'signedUrl', 'signed_url', 'storage_path', 'storage_bucket', 'token', 'url'}
    for row in rows:
        require(row.get('affiliate_id') == affiliate_id, label + '_CROSS_OWNER')
        require(not forbidden.intersection(row), label + '_SENSITIVE_METADATA')


def main():
    values = env()
    base = values['SUPABASE_URL'].rstrip('/')
    key = values['SUPABASE_PUBLISHABLE_KEY']
    actors = {alias: login(values, alias) for alias in ALIASES}
    admin = actors['H005_TEST']
    normal = actors['H005_TEST2']
    third = actors['H005_TEST3']
    started = False
    signed = 0
    started_at = datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00', 'Z')
    try:
        rpc(base, key, admin['token'], 'stop_affiliate_impersonation')

        self_rows = {}
        for alias, actor in actors.items():
            status, effective = rpc(base, key, actor['token'], 'get_effective_affiliate_id')
            require(status == 200 and effective == actor['affiliate_id'], alias + '_EFFECTIVE_MISMATCH')
            status, rows = rpc(base, key, actor['token'], 'list_effective_affiliate_documents',
                               {'p_purpose': 'SELF_SERVICE_LOAN'})
            require(status == 200, alias + '_SELF_LIST_FAILED')
            assert_projection(rows, actor['affiliate_id'], alias + '_SELF')
            self_rows[alias] = rows

        status, _ = rpc(base, key, None, 'list_effective_affiliate_documents', {'p_purpose': 'SELF_SERVICE_LOAN'})
        require(status in (401, 403), 'ANONYMOUS_SELF_LIST_ALLOWED')

        status, target_rows = rpc(base, key, admin['token'], 'list_admin_affiliate_documents',
                                  {'p_target_affiliate_id': normal['affiliate_id'], 'p_purpose': 'ADMIN_DOCUMENT_REVIEW'})
        require(status == 200, 'ADMIN_EXPLICIT_LIST_FAILED')
        assert_projection(target_rows, normal['affiliate_id'], 'ADMIN_EXPLICIT')
        status, _ = rpc(base, key, admin['token'], 'list_admin_affiliate_documents',
                        {'p_purpose': 'ADMIN_DOCUMENT_REVIEW'})
        require(status >= 400, 'ADMIN_TARGET_OPTIONAL')

        admin_doc = next((row for row in self_rows['H005_TEST'] if row.get('available') is True), None)
        normal_doc = next((row for row in target_rows if row.get('available') is True), None)
        third_doc = next((row for row in self_rows['H005_TEST3'] if row.get('available') is True), None)
        require(admin_doc and normal_doc and third_doc, 'AVAILABLE_DOCUMENT_FIXTURE_REQUIRED')

        status, body = edge(base, key, normal['token'], {'mode': 'SELF_SERVICE', 'purpose': 'SELF_SERVICE_LOAN',
                                                         'document_id': normal_doc['document_id']})
        require(status == 200 and body.get('signedUrl') and body.get('expiresIn') == 300, 'NORMAL_SELF_PREVIEW_FAILED')
        signed += 1
        download_status, content, _ = request(body['signedUrl'], key, raw=True)
        require(download_status == 200 and len(content) > 0, 'SIGNED_URL_NOT_READABLE')

        status, _ = edge(base, key, normal['token'], {'mode': 'SELF_SERVICE', 'purpose': 'SELF_SERVICE_LOAN',
                                                      'document_id': admin_doc['document_id']})
        require(status == 403, 'NORMAL_FOREIGN_PREVIEW_ALLOWED')
        status, _ = edge(base, key, admin['token'], {'mode': 'SELF_SERVICE', 'purpose': 'SELF_SERVICE_LOAN',
                                                     'document_id': normal_doc['document_id']})
        require(status == 403, 'ADMIN_PERMISSION_WIDENED_SELF_PREVIEW')

        status, body = edge(base, key, admin['token'], {'mode': 'ADMIN', 'purpose': 'ADMIN_DOCUMENT_REVIEW',
                                                        'document_id': normal_doc['document_id'],
                                                        'target_affiliate_id': normal['affiliate_id']})
        require(status == 200 and body.get('signedUrl') and body.get('expiresIn') == 300, 'ADMIN_PREVIEW_FAILED')
        signed += 1
        status, _ = edge(base, key, admin['token'], {'mode': 'ADMIN', 'purpose': 'ADMIN_DOCUMENT_REVIEW',
                                                     'document_id': normal_doc['document_id']})
        require(status == 400, 'ADMIN_EDGE_TARGET_OPTIONAL')
        status, _ = edge(base, key, None, {'mode': 'SELF_SERVICE', 'purpose': 'SELF_SERVICE_LOAN',
                                           'document_id': normal_doc['document_id']})
        require(status in (401, 403), 'ANONYMOUS_EDGE_ALLOWED')

        status, start = rpc(base, key, admin['token'], 'start_affiliate_impersonation',
                            {'p_affiliate_id': third['affiliate_id'], 'p_reason': 'Auditoria aislamiento documental'})
        require(status == 200 and isinstance(start, list) and start, 'IMPERSONATION_START_FAILED')
        started = True
        session_id = start[0]['session_id']
        status, effective = rpc(base, key, admin['token'], 'get_effective_affiliate_id')
        require(status == 200 and effective == third['affiliate_id'], 'IMPERSONATED_EFFECTIVE_MISMATCH')
        status, impersonated_rows = rpc(base, key, admin['token'], 'list_effective_affiliate_documents',
                                        {'p_purpose': 'SELF_SERVICE_LOAN'})
        require(status == 200, 'IMPERSONATED_SELF_LIST_FAILED')
        assert_projection(impersonated_rows, third['affiliate_id'], 'IMPERSONATED_SELF')
        status, body = edge(base, key, admin['token'], {'mode': 'SELF_SERVICE', 'purpose': 'SELF_SERVICE_LOAN',
                                                        'document_id': third_doc['document_id']})
        require(status == 200 and body.get('signedUrl'), 'IMPERSONATED_SELF_PREVIEW_FAILED')
        signed += 1
        status, _ = edge(base, key, admin['token'], {'mode': 'SELF_SERVICE', 'purpose': 'SELF_SERVICE_LOAN',
                                                     'document_id': admin_doc['document_id']})
        require(status == 403, 'IMPERSONATION_LEAKED_ACTOR_DOCUMENTS')
        status, stopped = rpc(base, key, admin['token'], 'stop_affiliate_impersonation')
        require(status == 200 and stopped is True, 'IMPERSONATION_STOP_FAILED')
        started = False

        query = urllib.parse.urlencode({'select': 'actor_auth_user_id,effective_affiliate_id,target_affiliate_id,document_id,action,purpose,context_mode,impersonation_session_id,access_context,created_at',
                                        'created_at': 'gte.' + started_at, 'order': 'created_at.asc'})
        status, events, _ = request(base + '/rest/v1/document_access_audit_log?' + query, key, token=admin['token'])
        require(status == 200 and isinstance(events, list), 'AUDIT_READ_FAILED')
        relevant = [event for event in events if event.get('actor_auth_user_id') in {a['user_id'] for a in actors.values()}]
        sign_events = [event for event in relevant if event.get('action') == 'SIGN_PREVIEW']
        require(len(sign_events) == signed == 3, 'SIGN_AUDIT_CARDINALITY_MISMATCH')
        require(any(event.get('context_mode') == 'ADMIN' and event.get('target_affiliate_id') == normal['affiliate_id'] for event in sign_events), 'ADMIN_AUDIT_TARGET_MISSING')
        require(any(event.get('impersonation_session_id') == session_id and event.get('effective_affiliate_id') == third['affiliate_id'] for event in sign_events), 'IMPERSONATION_AUDIT_CONTEXT_MISSING')
        require(any(event.get('action') == 'LIST_METADATA' and event.get('context_mode') == 'SELF_SERVICE' for event in relevant), 'SELF_LIST_AUDIT_MISSING')
        require(any(event.get('action') == 'LIST_METADATA' and event.get('context_mode') == 'ADMIN' for event in relevant), 'ADMIN_LIST_AUDIT_MISSING')
        for event in relevant:
            serialized = json.dumps(event.get('access_context') or {}).lower()
            require('signedurl' not in serialized and 'storage_path' not in serialized and 'token' not in serialized,
                    'AUDIT_SECRET_LEAK')

        actor_literal = admin['user_id'].replace("'", "''")
        target_literal = normal['affiliate_id'].replace("'", "''")
        proof = management(values, """begin;
do $$ declare v_actor uuid:='%s'::uuid; v_target uuid:='%s'::uuid; v_count integer;
begin
  if not exists(select 1 from public.admin_assignments a join public.admin_role_permissions p on p.role_id=a.role_id
    where a.auth_user_id=v_actor and a.enabled and p.permission='documents.read') then raise exception 'ADMIN_FIXTURE_INVALID'; end if;
  update public.affiliates set auth_user_id=null where auth_user_id=v_actor;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_actor,'role','authenticated')::text,true);
  set local role authenticated;
  if public.get_effective_affiliate_id() is not null then raise exception 'ADMIN_STILL_HAS_AFFILIATE'; end if;
  select count(*) into v_count from public.list_admin_affiliate_documents(v_target,'ADMIN_AFFILIATE_PROFILE');
  if v_count<0 then raise exception 'UNREACHABLE'; end if;
end $$;
rollback; select true as admin_without_affiliate_pass;""" % (actor_literal, target_literal))
        require(proof and proof[0].get('admin_without_affiliate_pass') is True, 'ADMIN_WITHOUT_AFFILIATE_FAILED')

        print(json.dumps({'status': 'PASS', 'cases': 8, 'accounts': 3, 'self_owner_isolation': True,
                          'admin_explicit_target': True, 'admin_without_affiliate': True,
                          'impersonation_actor_context': True, 'anonymous_denied': True,
                          'foreign_preview_denied': True, 'signed_previews': signed,
                          'signed_url_ttl_seconds': 300, 'metadata_signed_urls': 0,
                          'audit_events_checked': len(relevant), 'secrets_logged': False}, sort_keys=True))
    finally:
        if started:
            rpc(base, key, admin['token'], 'stop_affiliate_impersonation')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'status': 'FAIL', 'error': str(error), 'secrets_logged': False}, sort_keys=True), file=sys.stderr)
        sys.exit(1)
