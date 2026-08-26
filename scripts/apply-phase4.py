#!/usr/bin/env python3
"""Apply and reconcile the owner-authorized Phase 4 membership catalog."""
import json,urllib.parse,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def env():
    out={}
    for raw in (ROOT/'supabase.env').read_text(encoding='utf-8-sig').splitlines():
        if raw.strip() and not raw.lstrip().startswith('#') and '=' in raw:
            k,v=raw.split('=',1);out[k.strip()]=v.strip().strip('"').strip("'")
    return out
def query(endpoint,token,sql):
    req=urllib.request.Request(endpoint,data=json.dumps({'query':sql}).encode(),headers={'Authorization':'Bearer '+token,'Content-Type':'application/json','Accept':'application/json','User-Agent':'SutiApp-Phase4/1.0'},method='POST')
    with urllib.request.urlopen(req,timeout=120) as r:return json.loads(r.read())
def main():
    v=env();ref=urllib.parse.urlsplit(v['SUPABASE_URL']).hostname.split('.')[0];endpoint=f'https://api.supabase.com/v1/projects/{ref}/database/query';token=v['SUPABASE_ACCESS_TOKEN']
    applied=query(endpoint,token,"select to_regclass('public.membership_offerings') is not null applied")[0]['applied']
    if not applied:query(endpoint,token,(ROOT/'supabase/migrations/20260821001000_create_phase4_memberships.sql').read_text(encoding='utf-8'))
    protected=query(endpoint,token,"select exists(select 1 from pg_policies where schemaname='public' and tablename='membership_offerings' and policyname='membership_offerings_admin_delete') applied")[0]['applied']
    if not protected:query(endpoint,token,(ROOT/'supabase/migrations/20260821001001_protect_phase4_membership_history.sql').read_text(encoding='utf-8'))
    row=query(endpoint,token,"""select (select count(*) from membership_offerings) offerings,(select count(*) from membership_offerings where record_origin='HISTORICAL_IMPORT') historical,(select count(*) from membership_offerings where logo_asset_id is not null) logos,(select count(*) from admin_assignments where enabled and permissions @> array['memberships.read','memberships.write']) admins,(select relrowsecurity and relforcerowsecurity from pg_class where oid='public.membership_offerings'::regclass) rls""")[0]
    if int(row['offerings'])!=6 or int(row['historical'])!=6 or int(row['admins'])!=1 or not row['rls']:raise RuntimeError('Phase 4 reconciliation failed')
    print(json.dumps({'status':'PASS',**row},sort_keys=True))
if __name__=='__main__':main()
