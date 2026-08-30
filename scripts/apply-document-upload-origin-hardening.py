#!/usr/bin/env python3
"""Dry-run/apply/recovery helper for mandatory document upload origin."""
import importlib.util,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('platform_apply',ROOT/'scripts/apply-document-requirements-platform.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
MIGRATION=ROOT/'supabase/migrations/20260830000210_enforce_document_upload_origin.sql'
RECOVERY=ROOT/'supabase/recovery/20260830000210_enforce_document_upload_origin_recovery.sql'
def status(values):
    row=module.query(values,"""select
      to_regprocedure('public.register_affiliate_document(uuid,text,text,bigint,text)') is null as legacy_overload_absent,
      to_regprocedure('public.register_affiliate_document(uuid,text,text,bigint,text,text)') is not null as origin_overload_present,
      (select count(*) from public.affiliate_documents) as affiliate_documents,
      (select count(*) from public.sensitive_change_audit) as document_audit,
      (select count(*) from public.financial_rules) as financial_rules,
      (select count(*) from public.financial_funds) as financial_funds,
      (select count(*) from public.financial_programs) as financial_programs;""")[0]
    return row
def main():
    mode=sys.argv[1] if len(sys.argv)>1 else '--status';values=module.env()
    if mode=='--status': print(json.dumps({'mode':mode,'status':status(values)},indent=2));return
    mapping={'--dry-run':(MIGRATION,False),'--apply':(MIGRATION,True),'--recovery-dry-run':(RECOVERY,False),'--recover':(RECOVERY,True)}
    if mode not in mapping: raise SystemExit('UNKNOWN_MODE')
    path,commit=mapping[mode];before=status(values);result=module.run(values,path,commit);after=status(values)
    print(json.dumps({'mode':mode,'before':before,'result':result,'after':after},indent=2))
if __name__=='__main__': main()
