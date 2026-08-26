#!/usr/bin/env python3
"""Assign exactly the owner-authorized H005_TEST Auth principal as H-008 visual admin."""
import argparse, json, urllib.error, urllib.parse, urllib.request
from pathlib import Path

PERMISSIONS = ['assets.read','assets.write','companies.read','companies.write','popups.read','popups.write','banners.read','banners.write','documents.read','documents.write']

def env():
    out={}
    for raw in Path('supabase.env').read_text(encoding='utf-8-sig').splitlines():
        if raw.strip() and not raw.lstrip().startswith('#') and '=' in raw:
            k,v=raw.split('=',1); out[k.strip()]=v.strip().strip('"').strip("'")
    return out

def call(url,key,method='GET',body=None,prefer=None):
    headers={'apikey':key,'Content-Type':'application/json','Accept':'application/json','User-Agent':'SutiApp-H008/1.0'}
    if prefer: headers['Prefer']=prefer
    data=None if body is None else json.dumps(body,separators=(',',':')).encode()
    with urllib.request.urlopen(urllib.request.Request(url,data=data,headers=headers,method=method),timeout=60) as r:
        raw=r.read(); return json.loads(raw) if raw else None

def apply_schema(e):
    ref=urllib.parse.urlsplit(e['SUPABASE_URL']).hostname.split('.')[0]
    sql=Path('supabase/migrations/20260821000500_create_admin_authorization.sql').read_text(encoding='utf-8')
    body=json.dumps({'query':sql}).encode()
    req=urllib.request.Request(f'https://api.supabase.com/v1/projects/{ref}/database/query',data=body,headers={'Authorization':'Bearer '+e['SUPABASE_ACCESS_TOKEN'],'Content-Type':'application/json','Accept':'application/json','User-Agent':'SutiApp-H008/1.0'},method='POST')
    try:
        with urllib.request.urlopen(req,timeout=90) as response:
            if response.status != 201: raise RuntimeError('Schema application returned unexpected status')
    except urllib.error.HTTPError as error:
        detail=error.read(600).decode('utf-8','replace')
        raise RuntimeError(f'Schema application failed HTTP {error.code}: {detail}') from None

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--apply-schema',action='store_true'); args=parser.parse_args()
    e=env(); base=e['SUPABASE_URL'].rstrip('/'); key=e['SUPABASE_SECRET_KEY']; affiliate=e['H005_TEST_AFFILIATE_ID']
    if args.apply_schema: apply_schema(e)
    q=urllib.parse.urlencode({'select':'id,auth_user_id','id':f'eq.{affiliate}'})
    rows=call(f'{base}/rest/v1/affiliates?{q}',key)
    if len(rows)!=1 or not rows[0]['auth_user_id']: raise RuntimeError('H005_TEST is not linked to exactly one Auth principal')
    auth_id=rows[0]['auth_user_id']
    current=call(f'{base}/rest/v1/admin_assignments?select=id,auth_user_id,enabled',key)
    foreign=[x for x in current if x['auth_user_id']!=auth_id and x['enabled']]
    if foreign: raise RuntimeError('An unauthorized enabled admin assignment already exists')
    payload={'auth_user_id':auth_id,'role':'visual_admin','permissions':PERMISSIONS,'enabled':True}
    call(f'{base}/rest/v1/admin_assignments?on_conflict=auth_user_id',key,'POST',payload,'resolution=merge-duplicates,return=minimal')
    final=call(f'{base}/rest/v1/admin_assignments?select=auth_user_id,role,permissions,enabled',key)
    if len(final)!=1 or final[0]['auth_user_id']!=auth_id or set(final[0]['permissions'])!=set(PERMISSIONS): raise RuntimeError('Admin assignment reconciliation failed')
    print(json.dumps({'status':'PASS','authorized_alias':'H005_TEST','enabled_admin_assignments':1,'permissions':len(PERMISSIONS),'other_accounts_promoted':0},sort_keys=True))

if __name__=='__main__': main()
