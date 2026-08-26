#!/usr/bin/env python3
"""Preflight, transaction-dry-run, apply and reconcile the completion queue schema."""
import argparse,json,urllib.error,urllib.parse,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
MIGRATION=ROOT/'supabase/migrations/20260825000100_complete_documents_credentials_membership_requests.sql'
def env():
    values={}
    for raw in (ROOT/'supabase.env').read_text(encoding='utf-8-sig').splitlines():
        if raw.strip() and not raw.lstrip().startswith('#') and '=' in raw:
            key,value=raw.split('=',1);values[key.strip()]=value.strip().strip('"').strip("'")
    return values
def query(endpoint,token,sql):
    request=urllib.request.Request(endpoint,data=json.dumps({'query':sql}).encode(),headers={'Authorization':'Bearer '+token,'Content-Type':'application/json','Accept':'application/json','User-Agent':'SutiApp-CompletionQueue/1.0'},method='POST')
    try:
        with urllib.request.urlopen(request,timeout=180) as response:return json.loads(response.read())
    except urllib.error.HTTPError as error:
        detail=error.read().decode('utf-8','replace')
        raise RuntimeError('DATABASE_QUERY_FAILED: '+detail[:3000]) from error
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--apply',action='store_true');args=parser.parse_args()
    values=env();ref=urllib.parse.urlsplit(values['SUPABASE_URL']).hostname.split('.')[0];endpoint=f'https://api.supabase.com/v1/projects/{ref}/database/query';token=values['SUPABASE_ACCESS_TOKEN']
    pre=query(endpoint,token,"""select
      to_regclass('public.affiliate_files') is not null affiliate_files,
      to_regclass('public.private_assets') is not null private_assets,
      to_regclass('public.program_requests') is not null program_requests,
      to_regclass('public.membership_offerings') is not null memberships,
      (select count(*) from public.affiliates) affiliates,
      (select count(*) from public.affiliate_files) historical_files,
      (select count(*) from public.program_requests) requests""")[0]
    if not all(pre[k] for k in ('affiliate_files','private_assets','program_requests','memberships')):raise RuntimeError('PREFLIGHT_SCHEMA_MISSING')
    sql=MIGRATION.read_text(encoding='utf-8')
    if not args.apply:
        dry=sql.rstrip();dry=dry[:-len('commit;')].rstrip()+'\nrollback;' if dry.lower().endswith('commit;') else dry+'\nrollback;'
        query(endpoint,token,dry);print(json.dumps({'status':'DRY_RUN_PASS','preflight':pre},sort_keys=True));return
    exists=query(endpoint,token,"select to_regclass('public.document_types') is not null applied")[0]['applied']
    if not exists:query(endpoint,token,sql)
    row=query(endpoint,token,"""select
      (select count(*) from public.document_types) document_types,
      (select count(*) from public.affiliate_documents) affiliate_documents,
      (select count(*) from public.program_document_requirements) requirements,
      (select count(*) from public.affiliate_bank_accounts) bank_accounts,
      (select count(*) from public.program_terms_versions) terms,
      (select count(*) from public.program_requests) requests,
      (select count(*) from public.affiliates) affiliates,
      (select count(*) from public.affiliate_files) historical_files,
      (select relrowsecurity and relforcerowsecurity from pg_class where oid='public.affiliate_documents'::regclass) documents_rls,
      (select relrowsecurity and relforcerowsecurity from pg_class where oid='public.affiliate_bank_accounts'::regclass) bank_rls""")[0]
    if int(row['document_types'])<12 or int(row['requirements'])<5 or not row['documents_rls'] or not row['bank_rls']:raise RuntimeError('RECONCILIATION_FAILED')
    for key in ('affiliates','historical_files','requests'):
        if int(row[key])!=int(pre[key]):raise RuntimeError('PROTECTED_COUNT_CHANGED:'+key)
    print(json.dumps({'status':'PASS','already_applied':exists,'preflight':pre,'reconciliation':row},sort_keys=True))
if __name__=='__main__':main()
