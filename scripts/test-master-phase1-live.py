#!/usr/bin/env python3
"""Live multiuser Auth/RLS/impersonation regression. Never prints credentials or PII."""
import json,urllib.error,urllib.parse,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];ALIASES=('H005_TEST','H005_TEST2','H005_TEST3')
def env():
 out={}
 for raw in (ROOT/'supabase.env').read_text(encoding='utf-8-sig').splitlines():
  if raw.strip() and not raw.lstrip().startswith('#') and '=' in raw:
   k,v=raw.split('=',1);out[k.strip()]=v.strip().strip('"').strip("'")
 return out
def req(url,key,method='GET',body=None,token=None,prefer=None):
 h={'apikey':key,'Accept':'application/json','User-Agent':'SutiApp-Phase1-Test/1.0'}
 if token:h['Authorization']='Bearer '+token
 if body is not None:h['Content-Type']='application/json'
 if prefer:h['Prefer']=prefer
 try:
  with urllib.request.urlopen(urllib.request.Request(url,data=body,headers=h,method=method),timeout=60) as r:return r.status,json.loads(r.read() or b'null')
 except urllib.error.HTTPError as e:
  raw=e.read()
  try:data=json.loads(raw)
  except:data={}
  return e.code,data
def login(base,key,email,password):
 s,d=req(base+'/auth/v1/token?grant_type=password',key,'POST',json.dumps({'email':email,'password':password}).encode())
 if s!=200:raise RuntimeError('Phase 1 login failed')
 return d['access_token']
def rpc(base,key,token,name,payload=None):return req(base+'/rest/v1/rpc/'+name,key,'POST',json.dumps(payload or {}).encode(),token)
def get(base,key,token,path):return req(base+'/rest/v1/'+path,key,'GET',token=token)
def main():
 v=env();base=v['SUPABASE_URL'].rstrip('/');key=v['SUPABASE_PUBLISHABLE_KEY'];tokens={a:login(base,key,v[a+'_EMAIL'],v[a+'_PASSWORD']) for a in ALIASES}
 target=v['H005_TEST2_AFFILIATE_ID'];admin=tokens['H005_TEST'];started=False
 try:
  for alias in ALIASES:
   s,effective=rpc(base,key,tokens[alias],'get_effective_affiliate_id')
   if s!=200 or effective!=v[alias+'_AFFILIATE_ID']:raise RuntimeError('Effective affiliate mismatch')
   s,rows=get(base,key,tokens[alias],'affiliates?select=id,auth_eligibility')
   if s!=200 or len(rows)!=1 or rows[0]['id']!=effective or rows[0]['auth_eligibility']!='eligible':raise RuntimeError('Own-affiliate RLS regression')
  for alias in ('H005_TEST2','H005_TEST3'):
   if rpc(base,key,tokens[alias],'search_affiliates_for_impersonation',{'p_query':'11'})[0]<400:raise RuntimeError('Normal affiliate search was not denied')
   if rpc(base,key,tokens[alias],'start_affiliate_impersonation',{'p_affiliate_id':target,'p_reason':'Prueba denegada'})[0]<400:raise RuntimeError('Normal impersonation was not denied')
  start_status,start_body=rpc(base,key,admin,'start_affiliate_impersonation',{'p_affiliate_id':target,'p_reason':'Regresión multiusuario Phase 1'})
  if start_status!=200:raise RuntimeError('Admin impersonation start failed: '+str({'status':start_status,'code':start_body.get('code'),'message':start_body.get('message')}))
  started=True
  if rpc(base,key,admin,'start_affiliate_impersonation',{'p_affiliate_id':v['H005_TEST3_AFFILIATE_ID'],'p_reason':'Intento anidado denegado'})[0]<400:raise RuntimeError('Nested impersonation was not denied')
  s,ctx=rpc(base,key,admin,'get_impersonation_context')
  if s!=200 or len(ctx)!=1 or ctx[0]['actor_real_auth_user_id'] is None or ctx[0]['usuario_contexto_affiliate_id']!=target:raise RuntimeError('Actor/context audit contract failed')
  s,effective=rpc(base,key,admin,'get_effective_affiliate_id')
  if s!=200 or effective!=target:raise RuntimeError('Impersonated effective identity failed')
  s,rows=get(base,key,admin,'affiliates?select=id')
  if s!=200 or rows!=[{'id':target}]:raise RuntimeError('Impersonated RLS isolation failed')
  s,stopped=rpc(base,key,admin,'stop_affiliate_impersonation');started=False
  if s!=200 or stopped is not True:raise RuntimeError('Impersonation stop failed')
  s,effective=rpc(base,key,admin,'get_effective_affiliate_id')
  if s!=200 or effective!=v['H005_TEST_AFFILIATE_ID']:raise RuntimeError('Actor context was not restored')
  for alias in ALIASES:
   s,_=rpc(base,key,tokens[alias],'claim_affiliate_identity')
   if s!=200:raise RuntimeError('Verified eligible idempotent claim failed')
  print(json.dumps({'status':'PASS','accounts':3,'normal_admin_denied':2,'impersonation':'PASS','nested_denied':True,'actor_context':'PASS','rls':'PASS','idempotent_claims':3},sort_keys=True))
 finally:
  if started:rpc(base,key,admin,'stop_affiliate_impersonation')
if __name__=='__main__':main()
