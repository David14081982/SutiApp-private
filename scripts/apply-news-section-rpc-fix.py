#!/usr/bin/env python3
"""Dry-run/apply the narrow 00501 RPC type correction."""
import argparse,json,urllib.error,urllib.parse,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
FILES={
 '00501':(ROOT/'supabase/migrations/20260823000501_fix_news_responsibility_rpc_types.sql',ROOT/'supabase/recovery/20260823000501_fix_news_responsibility_rpc_types_recovery.sql'),
 '00502':(ROOT/'supabase/migrations/20260823000502_fix_news_resolution_and_service_boundary.sql',ROOT/'supabase/recovery/20260823000502_fix_news_resolution_and_service_boundary_recovery.sql'),
}
def env():
    out={}
    for raw in (ROOT/'supabase.env').read_text(encoding='utf-8-sig').splitlines():
        if raw.strip() and not raw.lstrip().startswith('#') and '=' in raw:
            k,v=raw.split('=',1);out[k.strip()]=v.strip().strip('"').strip("'")
    return out
def body(path):
    sql=path.read_text(encoding='utf-8').strip()
    if not sql.lower().startswith('begin;') or not sql.lower().endswith('commit;'):raise RuntimeError('TRANSACTION_BOUNDARY_REQUIRED')
    return sql[6:-7]
def query(v,sql):
    ref=urllib.parse.urlsplit(v['SUPABASE_URL']).hostname.split('.')[0]
    req=urllib.request.Request(f'https://api.supabase.com/v1/projects/{ref}/database/query',data=json.dumps({'query':sql}).encode(),headers={'Authorization':'Bearer '+v['SUPABASE_ACCESS_TOKEN'],'Content-Type':'application/json','User-Agent':'SutiApp-NewsRpcFix/1.0'},method='POST')
    try:
        with urllib.request.urlopen(req,timeout=120) as response:response.read()
    except urllib.error.HTTPError as error:raise RuntimeError(f'RPC_FIX_HTTP_{error.code}') from None
def main():
    p=argparse.ArgumentParser();p.add_argument('--dry-run',action='store_true');p.add_argument('--migration',choices=FILES,default='00501');a=p.parse_args();v=env();migration,recovery=FILES[a.migration]
    sql='begin;\n'+body(migration)
    if a.dry_run:sql+='\n'+body(recovery)+'\nrollback;'
    else:sql+='\ncommit;'
    query(v,sql);print(json.dumps({'status':'PASS','mode':'DRY_RUN' if a.dry_run else 'APPLY','migration':a.migration,'persistent_writes':0 if a.dry_run else 'SCHEMA_ONLY','credentials_exposed':False},sort_keys=True))
if __name__=='__main__':main()
