#!/usr/bin/env python3
"""Capture the financial authority + security surface as a deterministic JSON.

Read-only. Used to prove an infrastructure change touched nothing but the one
thing it declared: counts, RLS, grants, policies, constraints and the source of
every financial function are captured before and after and diffed.

Usage: capture-financial-security-surface.py <output.json>
"""
import hashlib, json, sys, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


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
                 'User-Agent': 'SutiApp-Financial-Security-Surface/1.0'}, method='POST')
    with urllib.request.urlopen(request, timeout=180) as response:
        return json.loads(response.read())


COUNTS = """select
  (select count(*) from public.financial_rules) as financial_rules,
  (select count(*) from public.financial_funds) as financial_funds,
  (select count(*) from public.financial_programs) as financial_programs,
  (select count(*) from public.loan_term_policy where enabled) as enabled_term_policies,
  (select count(*) from public.financial_rules where lifecycle_status='PUBLISHED') as published_rules;"""

RULE_DIGEST = """select md5(string_agg(row_value,'|' order by row_value)) as rules_digest
from (select concat_ws('~',id,lineage_id,version,program_id,fund_id,
  financial_union_code,financial_union_label,
  financial_employee_category_code,financial_employee_category_label,
  max_amount,raw_rate,rate_factor,rate_percent,term_label,payment_count,max_term,
  payment_period,available_on,visibility_mode,lifecycle_status,enabled,
  source_snapshot_hash) as row_value
  from public.financial_rules) as source;"""

FUNCTIONS = """select p.proname, md5(p.prosrc) as src_md5, p.provolatile, p.prosecdef,
  pg_get_function_identity_arguments(p.oid) as args
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in (
  'resolve_current_loan_snapshot_quote','resolve_suti_loan_quote_contract',
  'normalize_suti_financial_key','get_current_declared_payroll_impact',
  'get_current_loan_term_policy','get_financial_runtime_rules',
  'create_validated_financial_program_request','get_effective_affiliate_id')
order by p.proname, args;"""

GRANTS = """select grantee, table_name, string_agg(privilege_type,',' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema='public' and table_name in
  ('financial_rules','financial_funds','financial_programs','financial_session_snapshots',
   'loan_term_policy','affiliate_payroll_declarations','program_requests')
group by grantee, table_name order by table_name, grantee;"""

FUNCTION_ACL = """select p.proname, r.rolname,
  has_function_privilege(r.rolname, p.oid, 'execute') as can_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
cross join (select unnest(array['anon','authenticated','service_role']) as rolname) r
where n.nspname='public' and p.proname in
  ('resolve_current_loan_snapshot_quote','resolve_suti_loan_quote_contract','get_financial_runtime_rules')
order by p.proname, r.rolname;"""

RLS = """select c.relname, c.relrowsecurity, c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in
  ('financial_rules','financial_funds','financial_programs','financial_session_snapshots',
   'loan_term_policy','affiliate_payroll_declarations','program_requests')
order by c.relname;"""

POLICIES = """select schemaname, tablename, policyname, permissive, roles::text, cmd,
  md5(coalesce(qual,'')) as qual_md5, md5(coalesce(with_check,'')) as with_check_md5
from pg_policies where schemaname='public' and tablename in
  ('financial_rules','financial_funds','financial_programs','financial_session_snapshots',
   'loan_term_policy','affiliate_payroll_declarations','program_requests')
order by tablename, policyname;"""

CONSTRAINTS = """select rel.relname, con.conname, pg_get_constraintdef(con.oid) as definition
from pg_constraint con join pg_class rel on rel.oid=con.conrelid
join pg_namespace n on n.oid=rel.relnamespace
where n.nspname='public' and rel.relname in
  ('financial_session_snapshots','affiliate_payroll_declarations','financial_rules','loan_term_policy')
order by rel.relname, con.conname;"""


def main():
    out_path = sys.argv[1] if len(sys.argv) > 1 else None
    if not out_path:
        raise SystemExit('USAGE: capture-financial-security-surface.py <output.json>')
    values = env()
    payload = {
        'counts': query(values, COUNTS),
        'rules_digest': query(values, RULE_DIGEST),
        'functions': query(values, FUNCTIONS),
        'table_grants': query(values, GRANTS),
        'function_acl': query(values, FUNCTION_ACL),
        'rls': query(values, RLS),
        'policies': query(values, POLICIES),
        'constraints': query(values, CONSTRAINTS),
    }
    text = json.dumps(payload, indent=1, sort_keys=True, ensure_ascii=False)
    Path(out_path).write_text(text, encoding='utf-8')
    print(json.dumps({'status': 'PASS', 'output': out_path,
                      'digest': hashlib.sha256(text.encode()).hexdigest()[:16],
                      'counts': payload['counts']}))


if __name__ == '__main__':
    main()
