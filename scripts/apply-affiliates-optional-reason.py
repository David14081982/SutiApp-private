"""Apply only this authorized, isolated-tested migration; never send test DML."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERSION = '20260924000400'
spec = importlib.util.spec_from_file_location('database', ROOT / 'scripts/test-admin-affiliates-migration-live.py')
database = importlib.util.module_from_spec(spec)
spec.loader.exec_module(database)
parser = argparse.ArgumentParser()
parser.add_argument('--apply', action='store_true')
parser.add_argument('--prepare', action='store_true', help='Write the exact transaction locally; no network or credentials')
args = parser.parse_args()
baseline = json.loads((ROOT / 'scripts/fixtures/affiliates-optional-reason-20260924.json').read_text(encoding='utf-8'))
path = ROOT / f'supabase/migrations/{VERSION}_affiliates_optional_reason.sql'
# Exact byte preservation matters for captured function body guards.
sql = path.read_bytes().decode('utf-8')
quote = lambda value: "'" + value.replace("'", "''") + "'"
signatures = ','.join(quote('public.' + f['signature']) for f in baseline['functions'])
tables = ['public.' + t for t in sorted({c['table_name'] for c in baseline['columns']})]
tables += ['auth.users', 'public.program_requests', 'public.admin_audit_log']
digest = ' union all '.join(
    f"select {quote(table)} name,count(*)::bigint rows,md5(coalesce(string_agg(row_hash,'' order by row_hash),'')) hash from (select md5(to_jsonb(t)::text) row_hash from {table} t) s"
    for table in tables)
acl = f"select oid,proowner,proacl,prosecdef,proconfig from pg_proc where oid in (select s::regprocedure from unnest(array[{signatures}]) s)"
security = "select c.oid,c.relrowsecurity,c.relforcerowsecurity,c.relacl from pg_class c where c.oid in (select s::regclass from unnest(array[" + ','.join(quote(t) for t in tables) + "]) s)"
if not args.apply and not args.prepare:
    result = database.query(database.load_env(), f"select version from supabase_migrations.schema_migrations where version={quote(VERSION)}")
    print(json.dumps({'version': VERSION, 'installed': bool(result), 'migrationSha256': hashlib.sha256(path.read_bytes()).hexdigest()}))
else:
    evidence = ROOT / 'docs/qa/evidence/affiliates-optional-reason-20260924'
    if args.apply:
        for name in ['postgres-isolated.json', 'browser-result.json', 'build.json', 'global-local.json', 'global-pages.json']:
            report = json.loads((evidence / name).read_text(encoding='utf-8-sig'))
            if report.get('status') != 'PASS':
                raise RuntimeError('REQUIRED_CHECK_NOT_PASS:' + name)
    body = sql.strip().removeprefix('begin;').removesuffix('commit;')
    transaction = "begin isolation level repeatable read; set local lock_timeout='2s'; set local statement_timeout='60s';\n"
    transaction += f"create temporary table optional_reason_before on commit drop as {digest};\n"
    transaction += f"create temporary table optional_reason_acl on commit drop as {acl};\n"
    transaction += f"create temporary table optional_reason_security on commit drop as {security};\n"
    transaction += body
    transaction += f"""
do $verify$ begin
 if exists((select * from optional_reason_before except select * from ({digest}) current_state) union all (select * from ({digest}) current_state except select * from optional_reason_before)) then raise exception 'OPTIONAL_REASON_BUSINESS_DATA_CHANGED'; end if;
 if exists((select * from optional_reason_acl except {acl}) union all ({acl} except select * from optional_reason_acl)) then raise exception 'OPTIONAL_REASON_FUNCTION_SECURITY_CHANGED'; end if;
 if exists((select * from optional_reason_security except {security}) union all ({security} except select * from optional_reason_security)) then raise exception 'OPTIONAL_REASON_TABLE_SECURITY_CHANGED'; end if;
end $verify$;
insert into supabase_migrations.schema_migrations(version,name,statements)
values ({quote(VERSION)},'affiliates_optional_reason',array[{quote(sql)}]);
select jsonb_build_object('status','PASS','applied',true,'version',{quote(VERSION)},'businessDataChanged',false,'functionSecurityChanged',false,'tableSecurityChanged',false,'tables',(select jsonb_agg(to_jsonb(b) order by name) from optional_reason_before b)) result;
commit;
"""
    if args.prepare:
        destination = ROOT / '.tmp/affiliates-optional-reason/apply.sql'
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(transaction, encoding='utf-8', newline='\n')
        print('Prepared exact deployment transaction; no network or business rows accessed.')
        raise SystemExit(0)
    result = database.query(database.load_env(), transaction)
    receipt = {'status': 'PASS', 'version': VERSION, 'migrationSha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'result': result, 'syntheticProductionWrites': 0}
    (evidence / 'apply.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'status':'PASS','applied':True,'version':VERSION,'businessDataChanged':False}))
