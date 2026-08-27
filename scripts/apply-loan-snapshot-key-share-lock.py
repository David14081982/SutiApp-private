#!/usr/bin/env python3
"""Apply, dry-run or recover the owner-authorized FOR KEY SHARE lock change.

The quote resolver only READS the snapshot row. FOR SHARE conflicted with the
FOR NO KEY UPDATE lock taken by the session-invalidation UPDATE, serializing
"open a session" against "quote". FOR KEY SHARE still pins the row against
deletion (DELETE takes FOR UPDATE) without that conflict.

Usage:
  apply-loan-snapshot-key-share-lock.py --status
  apply-loan-snapshot-key-share-lock.py --dry-run
  apply-loan-snapshot-key-share-lock.py --apply
  apply-loan-snapshot-key-share-lock.py --recovery-dry-run
  apply-loan-snapshot-key-share-lock.py --recover
"""
import json, sys, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / 'supabase/migrations/20260827001000_loan_snapshot_quote_key_share_lock.sql'
RECOVERY = ROOT / 'supabase/recovery/20260827001000_loan_snapshot_quote_key_share_lock_recovery.sql'


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
                 'User-Agent': 'SutiApp-Loan-Snapshot-Key-Share-Lock/1.0'}, method='POST')
    with urllib.request.urlopen(request, timeout=120) as response:
        return json.loads(response.read())


def transaction_body(path):
    sql = path.read_text(encoding='utf-8').strip()
    if not sql.lower().startswith('begin;') or not sql.lower().endswith('commit;'):
        raise RuntimeError('TRANSACTION_BOUNDARY_MISSING')
    return sql[len('begin;'):len(sql) - len('commit;')]


def status(values):
    rows = query(values, """select
      to_regprocedure('public.resolve_current_loan_snapshot_quote(uuid,text,numeric,integer)') is not null as rpc_present,
      has_function_privilege('authenticated','public.resolve_current_loan_snapshot_quote(uuid,text,numeric,integer)','execute') as authenticated_execute,
      not has_function_privilege('anon','public.resolve_current_loan_snapshot_quote(uuid,text,numeric,integer)','execute') as anonymous_denied,
      not has_table_privilege('authenticated','public.financial_session_snapshots','select,insert,update,delete') as direct_snapshot_access_denied,
      (select p.prosrc like '%for key share%' from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname='resolve_current_loan_snapshot_quote') as key_share_lock,
      (select p.prosrc like '%p_snapshot_id for share;%' from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname='resolve_current_loan_snapshot_quote') as legacy_share_lock,
      (select count(*) from public.financial_rules) as financial_rules,
      (select count(*) from public.financial_funds) as financial_funds,
      (select count(*) from public.financial_programs) as financial_programs;""")
    return rows[0] if isinstance(rows, list) and rows else rows


def run(values, path, commit):
    body = transaction_body(path)
    sql = 'begin;' + body + ('commit;' if commit else "rollback; select true as dry_run;")
    return query(values, sql)


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else '--status'
    values = env()
    if mode == '--status':
        print(json.dumps({'mode': 'status', 'status': status(values)}, indent=2))
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
