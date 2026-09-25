"""Read-only installed-definition verification; no affiliate mutations."""
import hashlib
import importlib.util
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('database', ROOT / 'scripts/test-admin-affiliates-migration-live.py')
database = importlib.util.module_from_spec(spec)
spec.loader.exec_module(database)
baseline = json.loads((ROOT / 'scripts/fixtures/affiliates-optional-reason-20260924.json').read_text(encoding='utf-8'))
names = ','.join("'"+f['name']+"'" for f in baseline['functions'])
live = database.query(database.load_env(), f"select p.proname name,pg_get_functiondef(p.oid) definition,p.proacl::text acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ({names})")
assert len(live) == 7
checks = []
for old in baseline['functions']:
    expected = old['definition']
    if old['name'] == 'start_affiliate_impersonation':
        expected = expected.replace("char_length(btrim(coalesce(p_reason,'')))<8", "char_length(btrim(coalesce(p_reason,'')))>500")
        expected = expected.replace("btrim(p_reason),now()+interval", "btrim(coalesce(p_reason,'')),now()+interval")
    else:
        expected = expected.replace('length(v_reason) not between 8 and 500', 'length(v_reason)>500')
    expected = re.sub(r"'([A-Z_]*REASON)_REQUIRED'", r"'\1_TOO_LONG'", expected)
    actual = next(f for f in live if f['name'] == old['name'])
    assert actual['definition'] == expected, old['name']
    assert actual['acl'] == old['acl'], old['name']
    checks.append({'rpc': old['name'], 'exactExpectedDefinition': True, 'aclUnchanged': True, 'sha256': hashlib.sha256(actual['definition'].encode()).hexdigest()})
constraints = database.query(database.load_env(), "select c.relname table_name,k.conname name,pg_get_constraintdef(k.oid) definition from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and k.conname in ('affiliate_admin_events_reason_check','affiliate_profile_audit_log_reason_check','affiliates_archive_state_check','affiliates_restore_state_check','impersonation_reason_check')")
assert len(constraints) == 5
for actual in constraints:
    old = next(c for c in baseline['constraints'] if c['name'] == actual['name'])
    assert actual['definition'] == old['definition'].replace('>= 8', '>= 0'), actual['name']
result = {'status':'PASS','readOnly':True,'functions':checks,'optionalReasonConstraints':5,'businessWrites':0}
(ROOT / 'docs/qa/evidence/affiliates-optional-reason-20260924/backend-readback.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'status':'PASS','exactFunctions':7,'constraints':5,'aclUnchanged':True,'businessWrites':0}))
