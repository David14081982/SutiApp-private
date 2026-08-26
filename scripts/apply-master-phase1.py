#!/usr/bin/env python3
"""Apply Phase 1 identity migration through Supabase management API. No secrets printed."""
import json,urllib.error,urllib.parse,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def env():
 out={}
 for raw in (ROOT/'supabase.env').read_text(encoding='utf-8-sig').splitlines():
  if raw.strip() and not raw.lstrip().startswith('#') and '=' in raw:
   k,v=raw.split('=',1);out[k.strip()]=v.strip().strip('"').strip("'")
 return out
def query(endpoint,token,sql):
 req=urllib.request.Request(endpoint,data=json.dumps({'query':sql}).encode(),headers={'Authorization':'Bearer '+token,'Content-Type':'application/json','User-Agent':'SutiApp-Master-Phase1/1.0'},method='POST')
 try:
  with urllib.request.urlopen(req,timeout=90) as response:return json.loads(response.read() or b'null')
 except urllib.error.HTTPError as e:raise RuntimeError(f'Phase 1 database request failed HTTP {e.code}: '+e.read(500).decode('utf-8','replace')) from None
def main():
 values=env();ref=urllib.parse.urlsplit(values['SUPABASE_URL']).hostname.split('.')[0];endpoint=f'https://api.supabase.com/v1/projects/{ref}/database/query';token=values['SUPABASE_ACCESS_TOKEN'];approved_affiliate=values['H005_TEST_AFFILIATE_ID'].replace("'",'')
 applied=query(endpoint,token,"select to_regclass('public.impersonation_sessions') is not null as applied")[0]['applied']
 if not applied:query(endpoint,token,(ROOT/'supabase/migrations/20260821000700_complete_identity_access.sql').read_text(encoding='utf-8'))
 query(endpoint,token,(ROOT/'supabase/migrations/20260821000701_fix_impersonation_ambiguity.sql').read_text(encoding='utf-8'))
 row=query(endpoint,token,"""select
  (select count(*) from public.affiliates) affiliates,
  (select count(*) from public.admin_assignments where enabled and 'affiliates.impersonate'=any(permissions)) identity_admins,
  (select count(*) from public.admin_assignments where enabled and auth_user_id not in (select auth_user_id from public.affiliates where id='"""+approved_affiliate+"""'::uuid) and ('affiliates.read'=any(permissions) or 'affiliates.impersonate'=any(permissions))) unexpected_promotions,
  (select bool_and(c.relrowsecurity and c.relforcerowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('affiliates','identity_audit_log','impersonation_sessions')) rls_forced,
  (select count(*) from auth.users) auth_users,
  (select count(*) from public.impersonation_sessions where ended_at is null and expires_at>now()) open_impersonations,
  (select count(*) from public.identity_audit_log) identity_audit_events,
  (select count(*) from public.identity_audit_log where actor_real_auth_user_id is null or usuario_contexto_affiliate_id is null) invalid_audit_events""")[0]
 if int(row['affiliates'])!=947 or int(row['identity_admins'])!=1 or int(row['unexpected_promotions'])!=0 or not row['rls_forced'] or int(row['auth_users'])!=3 or int(row['open_impersonations'])!=0 or int(row['identity_audit_events'])<5 or int(row['invalid_audit_events'])!=0:raise RuntimeError('Phase 1 migration reconciliation failed')
 print(json.dumps({'status':'PASS','affiliates':947,'identity_admins':1,'unexpected_promotions':0,'rls_forced':True,'auth_users':3,'open_impersonations':0,'identity_audit_events':int(row['identity_audit_events']),'invalid_audit_events':0,'migration':'20260821000700'},sort_keys=True))
if __name__=='__main__':main()
