#!/usr/bin/env python3
"""Dry-run, apply, inspect or recover the unified document requirements platform."""
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / 'supabase/migrations/20260830000200_document_requirements_platform_unified_ui.sql'
RECOVERY = ROOT / 'supabase/recovery/20260830000200_document_requirements_platform_unified_ui_recovery.sql'
RECOVERY_STACK = (
    ROOT / 'supabase/recovery/20260830000220_fix_membership_document_scope_recovery.sql',
    ROOT / 'supabase/recovery/20260830000210_enforce_document_upload_origin_recovery.sql',
    RECOVERY,
)


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
                 'User-Agent': 'SutiApp-Document-Requirements-Platform/1.0'}, method='POST')
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            return json.loads(response.read())
    except urllib.error.HTTPError as error:
        detail = error.read().decode('utf-8', 'replace')
        raise RuntimeError(f'MANAGEMENT_SQL_{error.code}:{detail[:3000]}') from None


def transaction_body(path):
    sql = path.read_text(encoding='utf-8').strip()
    if not sql.lower().startswith('begin;') or not sql.lower().endswith('commit;'):
        raise RuntimeError('TRANSACTION_BOUNDARY_MISSING')
    return sql[len('begin;'):len(sql) - len('commit;')]


def status(values):
    rows = query(values, """select
      exists(select 1 from information_schema.columns where table_schema='public' and table_name='program_document_requirements' and column_name='scope_type') as generic_scope,
      exists(select 1 from information_schema.columns where table_schema='public' and table_name='document_types' and column_name='camera_allowed') as upload_capabilities,
      exists(select 1 from information_schema.columns where table_schema='public' and table_name='program_requests' and column_name='document_requirements_snapshot') as request_snapshot,
      to_regclass('public.document_configuration_audit_log') is not null as configuration_audit,
      to_regprocedure('public.resolve_effective_document_requirements(text,text)') is not null as resolver_rpc,
      to_regprocedure('public.create_program_request_with_documents(uuid,uuid,integer,text,text,boolean,uuid,uuid[])') is not null as request_rpc,
      (select count(*) from public.program_document_requirements) as requirement_rows,
      (select count(*) from public.document_types) as document_types,
      (select count(*) from public.program_requests) as program_requests,
      (select count(*) from public.request_documents) as request_documents,
      (select count(*) from public.financial_rules) as financial_rules,
      (select count(*) from public.financial_funds) as financial_funds,
      (select count(*) from public.financial_programs) as financial_programs;""")
    result = rows[0]
    if result['generic_scope']:
        detail = query(values, """select
          (select count(*) from public.program_document_requirements where scope_type is null or scope_key is null) as invalid_scope_rows,
          (select count(*) from public.program_document_requirements where program_id='prestamo') as loan_requirements,
          (select count(*) from public.program_document_requirements where program_id='membership') as membership_requirements,
          not has_table_privilege('authenticated','public.document_types','insert,update,delete') as type_direct_writes_denied,
          not has_table_privilege('authenticated','public.program_document_requirements','insert,update,delete') as requirement_direct_writes_denied,
          has_function_privilege('authenticated','public.resolve_effective_document_requirements(text,text)','execute') as resolver_authenticated,
          not has_function_privilege('anon','public.resolve_effective_document_requirements(text,text)','execute') as resolver_anon_denied,
          not has_function_privilege('authenticated','public.create_program_request(uuid,uuid,integer,text,text,boolean,uuid)','execute') as legacy_request_bypass_denied,
          (select count(*) from public.document_configuration_audit_log) as configuration_audit_events;""")
        result.update(detail[0])
    return result


def run(values, path, commit):
    body = transaction_body(path)
    return query(values, 'begin;' + body + ('commit;' if commit else 'rollback; select true as dry_run;'))


def run_stack(values, paths, commit):
    body = '\n'.join(transaction_body(path) for path in paths)
    return query(values, 'begin;' + body + ('commit;' if commit else 'rollback; select true as dry_run;'))


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else '--status'
    values = env()
    if mode == '--inspect-constraints':
        print(json.dumps(query(values, "select conname from pg_constraint where conrelid='public.program_document_requirements'::regclass order by conname"), indent=2)); return
    if mode == '--status':
        print(json.dumps({'mode': mode, 'status': status(values)}, indent=2)); return
    if mode in ('--dry-run', '--apply'):
        before = status(values); result = run(values, MIGRATION, mode == '--apply'); after = status(values)
        print(json.dumps({'mode': mode, 'before': before, 'result': result, 'after': after}, indent=2)); return
    if mode in ('--recovery-dry-run', '--recover'):
        before = status(values); result = run_stack(values, RECOVERY_STACK, mode == '--recover'); after = status(values)
        print(json.dumps({'mode': mode, 'recovery_order': [path.name for path in RECOVERY_STACK], 'before': before, 'result': result, 'after': after}, indent=2)); return
    raise SystemExit('UNKNOWN_MODE: ' + mode)


if __name__ == '__main__':
    main()
