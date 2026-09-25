"""Generate narrow, drift-guarded DDL from the read-only installed catalog capture."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
baseline = json.loads((ROOT / '.tmp/affiliates-optional-reason/baseline.json').read_text(encoding='utf-8'))
fixture = ROOT / 'scripts/fixtures/affiliates-optional-reason-20260924.json'
fixture.write_text(json.dumps(baseline, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
forward = ['begin;', "set local lock_timeout='2s';", "set local statement_timeout='60s';",
           '-- Owner instruction: optional reason in the six Afiliados forms; no business DML.']
recovery = ['begin;', "set local lock_timeout='2s';", "set local statement_timeout='60s';",
            '-- Restore only while all existing history satisfies the former constraints. Never rewrite history.']
quote = lambda text: "'" + text.replace("'", "''") + "'"
for f in baseline['functions']:
    old = f['definition']
    if f['name'] == 'start_affiliate_impersonation':
        new = old.replace("char_length(btrim(coalesce(p_reason,'')))<8", "char_length(btrim(coalesce(p_reason,'')))>500")
        new = new.replace("btrim(p_reason),now()+interval", "btrim(coalesce(p_reason,'')),now()+interval")
    else:
        new = old.replace('length(v_reason) not between 8 and 500', 'length(v_reason)>500')
    new = re.sub(r"'([A-Z_]*REASON)_REQUIRED'", r"'\1_TOO_LONG'", new)
    assert new != old
    guard = lambda expected: f"do $guard$ begin if pg_get_functiondef('public.{f['signature']}'::regprocedure) is distinct from {quote(expected)} then raise exception 'OPTIONAL_REASON_FUNCTION_DRIFT:{f['name']}'; end if; end $guard$;"
    forward += [guard(old), new + ';']
    recovery += [guard(new), old + ';']

affected = [c for c in baseline['constraints'] if c['name'] in [
    'affiliate_admin_events_reason_check', 'affiliate_profile_audit_log_reason_check',
    'affiliates_archive_state_check', 'affiliates_restore_state_check', 'impersonation_reason_check']]
assert len(affected) == 5
for c in affected:
    old = c['definition']
    new = old.replace('>= 8', '>= 0')
    table, name = c['table_name'], c['name']
    guard = lambda expected: f"do $guard$ begin if (select pg_get_constraintdef(oid) from pg_constraint where conrelid='public.{table}'::regclass and conname='{name}') is distinct from {quote(expected)} then raise exception 'OPTIONAL_REASON_CONSTRAINT_DRIFT:{name}'; end if; end $guard$;"
    forward += [guard(old), f'alter table public.{table} drop constraint {name};', f'alter table public.{table} add constraint {name} {new};']
    recovery += [guard(new), f'alter table public.{table} drop constraint {name};', f'alter table public.{table} add constraint {name} {old};']
forward += ["notify pgrst, 'reload schema';", 'commit;']
recovery += ["notify pgrst, 'reload schema';", 'commit;']
for folder, lines in [('migrations',forward), ('recovery',recovery)]:
    (ROOT / f'supabase/{folder}/20260924000400_affiliates_optional_reason.sql').write_text('\n\n'.join(lines)+'\n',encoding='utf-8',newline='\n')
print('Generated seven exact function replacements, five CHECK replacements and lossless guarded recovery.')
