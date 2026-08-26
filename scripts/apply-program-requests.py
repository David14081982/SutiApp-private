#!/usr/bin/env python3
"""Apply ADR-038 unified initial-request boundary and reconcile its schema."""
import argparse,json,sys,urllib.error,urllib.parse,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def env():
    out={}
    for raw in (ROOT/'supabase.env').read_text(encoding='utf-8-sig').splitlines():
        if raw.strip() and not raw.lstrip().startswith('#') and '=' in raw:
            k,v=raw.split('=',1);out[k.strip()]=v.strip().strip('"').strip("'")
    return out
def call(url,key):
    req=urllib.request.Request(url,headers={'apikey':key,'Authorization':'Bearer '+key})
    with urllib.request.urlopen(req,timeout=60) as response:return json.loads(response.read())
def query(values,sql):
    ref=urllib.parse.urlsplit(values['SUPABASE_URL']).hostname.split('.')[0]
    req=urllib.request.Request(f'https://api.supabase.com/v1/projects/{ref}/database/query',data=json.dumps({'query':sql}).encode(),headers={'Authorization':'Bearer '+values['SUPABASE_ACCESS_TOKEN'],'Content-Type':'application/json'},method='POST')
    with urllib.request.urlopen(req,timeout=180) as response:return json.loads(response.read())
def direct_query(values,sql):
    sys.path.insert(0,r'C:\tmp\sutiapp-psycopg')
    import psycopg
    ref=urllib.parse.urlsplit(values['SUPABASE_URL']).hostname.split('.')[0]
    with psycopg.connect(host='db.'+ref+'.supabase.co',port=5432,dbname='postgres',user='postgres',password=values['SUPABASE_DB_PASSWORD'],sslmode='require',connect_timeout=30) as connection:
        with connection.cursor() as cursor:cursor.execute(sql)
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--apply',action='store_true');parser.add_argument('--direct',action='store_true');parser.add_argument('--harden-select',action='store_true');args=parser.parse_args();values=env();base=values['SUPABASE_URL'];secret=values['SUPABASE_SECRET_KEY'];ready=True
    try:call(base+'/rest/v1/program_requests?select=id&limit=1',secret)
    except urllib.error.HTTPError as error:
        if error.code not in (400,404):raise
        ready=False
    if args.apply and not ready:
        sql=(ROOT/'supabase/migrations/20260822000200_create_unified_program_requests.sql').read_text(encoding='utf-8')
        direct_query(values,sql) if args.direct else query(values,sql);ready=True
    if args.apply and args.harden_select:
        sql=(ROOT/'supabase/migrations/20260822000201_harden_program_request_select.sql').read_text(encoding='utf-8')
        direct_query(values,sql) if args.direct else query(values,sql)
    if not args.apply:
        print(json.dumps({'status':'PASS','mode':'dry-run','schema_ready':ready},sort_keys=True));return
    rows=call(base+'/rest/v1/program_catalog_items?select=id,request_mode&enabled=eq.true',secret)
    requests=call(base+'/rest/v1/program_requests?select=id&limit=1',secret)
    if len(rows)!=134 or any(row['request_mode']!='supabase' for row in rows):raise RuntimeError('REQUEST_MODE_RECONCILIATION_FAILED')
    print(json.dumps({'status':'PASS','mode':'apply','schema_ready':ready,'requestable_items':len(rows),'existing_requests_checked':len(requests)},sort_keys=True))
if __name__=='__main__':main()
