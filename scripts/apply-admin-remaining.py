"""Apply and verify the non-financial company popup proposal authority."""
from pathlib import Path
import json, urllib.parse, urllib.request

ROOT=Path(__file__).resolve().parents[1]
MIGRATION=ROOT/'supabase/migrations/20260822000300_create_company_popup_proposals.sql'

def env():
    values={}
    for raw in (ROOT/'supabase.env').read_text(encoding='utf-8-sig').splitlines():
        line=raw.strip()
        if not line or line.startswith('#') or '=' not in line: continue
        key,value=line.split('=',1);values[key.strip()]=value.strip().strip('"').strip("'")
    return values

def query(values,sql):
    ref=urllib.parse.urlsplit(values['SUPABASE_URL']).hostname.split('.')[0]
    req=urllib.request.Request(
        f'https://api.supabase.com/v1/projects/{ref}/database/query',
        data=json.dumps({'query':sql}).encode(),
        headers={'Authorization':'Bearer '+values['SUPABASE_ACCESS_TOKEN'],'Content-Type':'application/json','User-Agent':'SutiApp-Admin-Remaining/1.0'},method='POST')
    with urllib.request.urlopen(req,timeout=60) as response:return json.loads(response.read().decode())

def main():
    values=env()
    exists=query(values,"select to_regclass('public.company_popup_proposals') is not null as applied")[0]['applied']
    if not exists: query(values,MIGRATION.read_text(encoding='utf-8'))
    result=query(values,"""
      select
        to_regclass('public.company_popup_proposals') is not null as table_ready,
        (select relrowsecurity and relforcerowsecurity from pg_class where oid='public.company_popup_proposals'::regclass) as rls_forced,
        (select count(*) from pg_policies where schemaname='public' and tablename='company_popup_proposals') as policies,
        has_function_privilege('authenticated','public.review_company_popup_proposal(uuid,boolean,text)','execute') as review_rpc;
    """)[0]
    if not result['table_ready'] or not result['rls_forced'] or int(result['policies'])<2 or not result['review_rpc']:
        raise RuntimeError('COMPANY_POPUP_PROPOSAL_VERIFICATION_FAILED')
    print(json.dumps({'status':'PASS','table':'company_popup_proposals','rls':'FORCED','policies':int(result['policies']),'review_rpc':True}))

if __name__=='__main__': main()
