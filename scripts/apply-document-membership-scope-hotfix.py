#!/usr/bin/env python3
"""Dry-run/apply/safety-recovery helper for the membership document scope fix."""
import importlib.util,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('platform_apply',ROOT/'scripts/apply-document-requirements-platform.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
MIGRATION=ROOT/'supabase/migrations/20260830000220_fix_membership_document_scope.sql'
RECOVERY=ROOT/'supabase/recovery/20260830000220_fix_membership_document_scope_recovery.sql'
def status(values):
    return module.query(values,"""select
      exists(select 1 from information_schema.columns where table_schema='public' and table_name='membership_offerings' and column_name='concept') as canonical_concept,
      not exists(select 1 from information_schema.columns where table_schema='public' and table_name='membership_offerings' and column_name='concept_raw') as invalid_concept_absent,
      (select count(*) from public.program_document_requirements) as requirement_rows,
      (select count(*) from public.program_requests) as program_requests,
      (select count(*) from public.financial_rules) as financial_rules,
      (select count(*) from public.financial_funds) as financial_funds,
      (select count(*) from public.financial_programs) as financial_programs;""")[0]
def main():
    mode=sys.argv[1] if len(sys.argv)>1 else '--status';values=module.env()
    if mode=='--status': print(json.dumps({'mode':mode,'status':status(values)},indent=2));return
    mapping={'--dry-run':(MIGRATION,False),'--apply':(MIGRATION,True),'--recovery-dry-run':(RECOVERY,False),'--recover':(RECOVERY,True)}
    if mode not in mapping: raise SystemExit('UNKNOWN_MODE')
    path,commit=mapping[mode];before=status(values);result=module.run(values,path,commit);after=status(values)
    print(json.dumps({'mode':mode,'before':before,'result':result,'after':after},indent=2))
if __name__=='__main__': main()
