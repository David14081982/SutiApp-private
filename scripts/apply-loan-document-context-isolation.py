#!/usr/bin/env python3
"""Dry-run, apply, inspect, or recover document-context isolation."""
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / 'supabase/migrations/20260830000100_loan_document_context_isolation.sql'
RECOVERY = ROOT / 'supabase/recovery/20260830000100_loan_document_context_isolation_recovery.sql'


def env():
    values = {}
    for raw in (ROOT / 'supabase.env').read_text(encoding='utf-8-sig').splitlines():
        if raw.strip() and not raw.lstrip().startswith('#') and '=' in raw:
            key, value = raw.split('=', 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def query(values, sql):
    ref = urllib.parse.urlsplit(values['SUPABASE_URL']).hostname.split('.')[0]
    request = urllib.request.Request(
        f'https://api.supabase.com/v1/projects/{ref}/database/query',
        data=json.dumps({'query': sql}).encode(),
        headers={'Authorization': 'Bearer ' + values['SUPABASE_ACCESS_TOKEN'],
                 'Content-Type': 'application/json', 'Accept': 'application/json',
                 'User-Agent': 'SutiApp-Document-Context-Isolation/1.0'}, method='POST')
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            return json.loads(response.read())
    except urllib.error.HTTPError as error:
        detail = error.read().decode('utf-8', 'replace')
        raise RuntimeError(f'MANAGEMENT_SQL_{error.code}:{detail[:2000]}') from None


def transaction_body(path):
    sql = path.read_text(encoding='utf-8').strip()
    if not sql.lower().startswith('begin;') or not sql.lower().endswith('commit;'):
        raise RuntimeError('TRANSACTION_BOUNDARY_MISSING')
    return sql[len('begin;'):len(sql) - len('commit;')]


def status(values):
    rows = query(values, """select
      to_regclass('public.document_access_audit_log') is not null as audit_table,
      to_regprocedure('public.list_effective_affiliate_documents(text)') is not null as self_list_rpc,
      to_regprocedure('public.list_admin_affiliate_documents(uuid,text)') is not null as admin_list_rpc,
      to_regprocedure('public.authorize_self_document_preview(uuid,text)') is not null as self_preview_rpc,
      to_regprocedure('public.authorize_admin_document_preview(uuid,uuid,text)') is not null as admin_preview_rpc,
      (select count(*) from public.affiliates) as affiliates,
      (select count(*) from public.affiliate_documents) as affiliate_documents,
      (select count(*) from public.request_documents) as request_documents,
      (select count(*) from public.financial_rules) as financial_rules,
      (select count(*) from public.financial_funds) as financial_funds,
      (select count(*) from public.financial_programs) as financial_programs;""")
    result = rows[0] if isinstance(rows, list) and rows else rows
    if result.get('audit_table'):
        detail = query(values, """select
          (select relrowsecurity and relforcerowsecurity from pg_class where oid=to_regclass('public.document_access_audit_log')) as audit_rls_forced,
          not has_table_privilege('authenticated','public.document_access_audit_log','insert,update,delete') as audit_browser_writes_denied,
          has_function_privilege('authenticated','public.list_effective_affiliate_documents(text)','execute') as self_authenticated,
          not has_function_privilege('anon','public.list_effective_affiliate_documents(text)','execute') as self_anon_denied,
          (select count(*) from public.document_access_audit_log) as audit_events;""")
        result.update(detail[0])
    else:
        result.update({'audit_rls_forced': None, 'audit_browser_writes_denied': None,
                       'self_authenticated': None, 'self_anon_denied': None, 'audit_events': None})
    return result


def run(values, path, commit):
    body = transaction_body(path)
    sql = 'begin;' + body + ('commit;' if commit else 'rollback; select true as dry_run;')
    return query(values, sql)


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else '--status'
    values = env()
    if mode == '--status':
        print(json.dumps({'mode': mode, 'status': status(values)}, indent=2))
        return
    if mode in ('--dry-run', '--apply'):
        before = status(values)
        result = run(values, MIGRATION, mode == '--apply')
        after = status(values)
        print(json.dumps({'mode': mode, 'before': before, 'result': result, 'after': after}, indent=2))
        return
    if mode in ('--recovery-dry-run', '--recover'):
        before = status(values)
        result = run(values, RECOVERY, mode == '--recover')
        after = status(values)
        print(json.dumps({'mode': mode, 'before': before, 'result': result, 'after': after}, indent=2))
        return
    raise SystemExit('UNKNOWN_MODE: ' + mode)


if __name__ == '__main__':
    main()
