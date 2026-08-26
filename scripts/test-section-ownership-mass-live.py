#!/usr/bin/env python3
"""Reversible multi-user SECTION/ACTION matrix for every rollout domain."""
import hashlib,json,urllib.error,urllib.parse,urllib.request,uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def env():
 out={}
 for raw in (ROOT/'supabase.env').read_text(encoding='utf-8-sig').splitlines():
  if raw.strip() and not raw.lstrip().startswith('#') and '=' in raw:k,v=raw.split('=',1);out[k.strip()]=v.strip().strip('"').strip("'")
 return out
def call(url,key,method='GET',body=None,token=None,prefer=None):
 h={'apikey':key,'Accept':'application/json','User-Agent':'SutiApp-OwnershipMatrix/1.0'};data=None
 if token:h['Authorization']='Bearer '+token
 if body is not None:data=json.dumps(body,separators=(',',':')).encode();h['Content-Type']='application/json'
 if prefer:h['Prefer']=prefer
 try:
  with urllib.request.urlopen(urllib.request.Request(url,data=data,headers=h,method=method),timeout=60) as r:
   raw=r.read();return r.status,json.loads(raw) if raw else []
 except urllib.error.HTTPError as e:
  raw=e.read()
  try:return e.code,json.loads(raw) if raw else []
  except:return e.code,[]
def login(base,key,email,password):
 s,d=call(base+'/auth/v1/token?grant_type=password',key,'POST',{'email':email,'password':password})
 if s!=200:raise RuntimeError('LOGIN_FAILED')
 return d['access_token'],d['user']['id']
def rpc(base,key,name,payload,token):return call(base+'/rest/v1/rpc/'+name,key,'POST',payload,token)
def denied(s,d):
 if s in(401,403) or (s in(200,201,204) and d==[]):return True
 if not isinstance(d,dict):return False
 code=str(d.get('code',''));message=str(d.get('message','')).upper()
 return code in('42501','P0001') and ('DENIED' in message or 'ROW-LEVEL SECURITY' in message or code=='42501')
def management(v,sql):
 ref=urllib.parse.urlsplit(v['SUPABASE_URL']).hostname.split('.')[0];req=urllib.request.Request(f'https://api.supabase.com/v1/projects/{ref}/database/query',data=json.dumps({'query':sql}).encode(),headers={'Authorization':'Bearer '+v['SUPABASE_ACCESS_TOKEN'],'Content-Type':'application/json'},method='POST')
 with urllib.request.urlopen(req,timeout=120) as r:return json.loads(r.read())
def main():
 v=env();base=v['SUPABASE_URL'].rstrip('/');key=v['SUPABASE_PUBLISHABLE_KEY'];secret=v['SUPABASE_SECRET_KEY'];rest=base+'/rest/v1'
 admin,_=login(base,key,v['H005_TEST_EMAIL'],v['H005_TEST_PASSWORD']);owner,owner_id=login(base,key,v['H005_TEST2_EMAIL'],v['H005_TEST2_PASSWORD']);normal,_=login(base,key,v['H005_TEST3_EMAIL'],v['H005_TEST3_PASSWORD'])
 company=call(rest+'/companies?select=id&limit=1',secret,token=secret)[1][0]['id'];app_asset=call(rest+'/app_assets?select=id&storage_bucket=eq.app-assets&limit=1',secret,token=secret)[1][0]['id'];document_asset=call(rest+'/app_assets?select=id&storage_bucket=eq.documents&limit=1',secret,token=secret)[1][0]['id'];marker='MASS_'+uuid.uuid4().hex[:10];created=[];assets=[];matrix={}
 seven=['read','create','update','delete','publish','order','assets']
 cases={
  'education':('educational_resources',{'resource_kind':'education','title':marker,'description':'matrix','published':False,'sort_order':910001,'provenance':'ADMIN_PHASE2'},'title'),
  'tutorials':('educational_resources',{'resource_kind':'tutorial','title':marker,'description':'matrix','published':False,'sort_order':910001,'provenance':'ADMIN_PHASE2'},'title'),
  'companies':('companies',{'display_name':marker,'description':'matrix','enabled':False,'sort_order':910001,'record_origin':'ADMIN_H009'},'display_name'),
  'agreements':('company_benefits',{'company_id':company,'label':marker,'description':'matrix','enabled':False,'sort_order':910001,'record_origin':'ADMIN_SECTION_ROLLOUT'},'label'),
  'banners':('banners',{'placement':'home','title':marker,'description':'matrix','image_asset_id':app_asset,'enabled':False,'sort_order':910001,'record_origin':'ADMIN_H009'},'title'),
  'popups':('popups',{'title':marker,'body':'matrix','enabled':False,'sort_order':910001,'record_origin':'ADMIN_H009'},'title'),
  'documents':('institutional_documents',{'kind':'download','title':marker,'description':'matrix','document_asset_id':document_asset,'enabled':False,'sort_order':910001,'record_origin':'ADMIN_H009'},'title'),
  'minutes':('minutes',{'title':marker,'description':'matrix','enabled':False,'sort_order':910001,'record_origin':'ADMIN_SECTION_ROLLOUT'},'title'),
  'programs':('institutional_programs',{'category':marker,'description':'matrix','enabled':False,'sort_order':910001,'record_origin':'ADMIN_SECTION_ROLLOUT'},'category'),
  'marketplace':('marketplace_categories',{'name':marker,'slug':marker.lower().replace('_','-'),'description':'matrix','enabled':False,'sort_order':910001,'record_origin':'ADMIN_PHASE3'},'name')}
 try:
  s,_=rpc(base,key,'set_section_responsibilities',{'p_email':v['H005_TEST2_EMAIL'],'p_section_key':'news','p_actions':['read']},owner);self_denied=denied(s,_)
  for section,(table,payload,titlecol) in cases.items():
   actions=seven if section!='agreements' else seven[:-1]
   rpc(base,key,'revoke_section_responsibilities',{'p_auth_user_id':owner_id,'p_section_key':section},admin)
   s,_=rpc(base,key,'set_section_responsibilities',{'p_email':v['H005_TEST2_EMAIL'],'p_section_key':section,'p_actions':actions},admin);checks={'ADMIN_ASSIGN':s==200}
   s,c=rpc(base,key,'get_admin_access_context',{},owner);mine=[x for x in c.get('section_actions',[]) if x['section_key']==section];checks['UUID_ACTIONS']=s==200 and {x['action'] for x in mine}==set(actions)
   cross_section=next(x for x in cases if x!=section);ct,cp,_=cases[cross_section];s,d=call(rest+'/'+ct,key,'POST',cp,owner,'return=representation');checks['CROSS_DOMAIN_DENIAL']=denied(s,d)
   s,d=call(rest+'/'+table,key,'POST',payload,normal,'return=representation');checks['NORMAL_DENIAL']=denied(s,d);s,d=call(rest+'/'+table,key,'POST',payload,prefer='return=representation');checks['ANON_DENIAL']=denied(s,d)
   s,d=call(rest+'/'+table,key,'POST',payload,owner,'return=representation');checks['CREATE']=s==201 and len(d)==1
   if not checks['CREATE']:raise RuntimeError(f'{section}_CREATE_{s}:{d}')
   rid=d[0]['id'];created.append((table,rid));s,d=call(rest+f'/{table}?id=eq.{rid}',key,'PATCH',{titlecol:marker+'_EDIT'},owner,'return=representation');checks['UPDATE']=s==200 and d and d[0][titlecol].endswith('_EDIT')
   s,d=call(rest+f'/{table}?id=eq.{rid}',key,'PATCH',{'sort_order':910002},owner,'return=representation');checks['ORDER']=s==200 and d and d[0]['sort_order']==910002
   s,d=call(rest+f'/{table}?id=eq.{rid}',key,'PATCH',{'enabled' if section not in('education','tutorials') else 'published':True},owner,'return=representation');checks['PUBLISH']=s==200
   s,d=call(rest+f'/{table}?id=eq.{rid}&select=id,{titlecol}',key,token=normal);checks['FRONTEND_REFLECTION']=s==200 and len(d)==1 and d[0][titlecol].endswith('_EDIT')
   if 'assets' in actions:
    bucket='company-assets' if section=='companies' else 'documents' if section in('documents','minutes') else 'app-assets';path=f'{section}/{owner_id}/{marker.lower()}.png';digest=hashlib.sha256((section+marker).encode()).hexdigest().upper()
    row={'asset_key':f'admin.section.{section}.{uuid.uuid4().hex}','asset_type':'SECTION_TEST','title':'matrix','alt_text':'matrix','storage_bucket':bucket,'storage_path':path,'mime_type':'image/png','file_size':1,'content_sha256':digest,'status':'READY'}
    s,d=call(rest+'/app_assets',key,'POST',row,owner,'return=representation');checks['ASSETS']=s==201 and len(d)==1
    if checks['ASSETS']:assets.append(d[0]['id']);call(rest+f'/app_assets?id=eq.{d[0]["id"]}',key,'DELETE',{},owner,'return=representation');assets.remove(d[0]['id'])
   else:checks['ASSETS']=True
   s,d=call(rest+f'/{table}?id=eq.{rid}',key,'DELETE',{},owner,'return=representation');checks['DELETE']=s==200 and len(d)==1
   if checks['DELETE']:created.remove((table,rid))
   s,_=rpc(base,key,'revoke_section_responsibilities',{'p_auth_user_id':owner_id,'p_section_key':section},admin);s2,c2=rpc(base,key,'get_admin_access_context',{},owner);fresh,_=login(base,key,v['H005_TEST2_EMAIL'],v['H005_TEST2_PASSWORD']);s3,c3=rpc(base,key,'get_admin_access_context',{},fresh)
   checks['REVOCATION']=s in(200,204) and not [x for x in c2.get('section_actions',[]) if x['section_key']==section];checks['REFRESH_REVOCATION']=s3==200 and not [x for x in c3.get('section_actions',[]) if x['section_key']==section];checks['STATUS']='PASS' if all(checks.values()) else 'FAIL';matrix[section]=checks
  sd=call(rest+'/admin_section_definitions?select=section_key,enforcement_status',secret,token=secret)[1];protected=sum(call(rest+f'/{table}?select=record_origin&limit=0',secret,token=secret)[0]==200 for table in('company_assets','company_benefit_profiles','company_benefits','company_audience_rules','marketplace_product_assets','marketplace_promotions'));audit=call(rest+'/admin_audit_log?select=id&details=not.is.null&limit=1',secret,token=secret)[1]
  structural={'enforced':sum(x['enforcement_status']=='ENFORCED' for x in sd),'design_only':sum(x['enforcement_status']=='DESIGN_ONLY' for x in sd),'protected_relations':protected,'audit_rows':len(audit)}
 finally:
  for section in cases:rpc(base,key,'revoke_section_responsibilities',{'p_auth_user_id':owner_id,'p_section_key':section},admin)
  for table,rid in created:call(rest+f'/{table}?id=eq.{rid}',secret,'DELETE',{},secret,'return=minimal')
  for aid in assets:call(rest+f'/app_assets?id=eq.{aid}',secret,'DELETE',{},secret,'return=minimal')
 failed=[s for s,c in matrix.items() if c.get('STATUS')!='PASS'];ok=not failed and self_denied and structural['enforced']==11 and structural['design_only']==0 and structural['protected_relations']==6 and structural['audit_rows']>0
 if not ok:raise RuntimeError('MASS_MATRIX_FAILED:'+json.dumps({'failed':failed,'matrix':matrix,'structural':structural},sort_keys=True))
 print(json.dumps({'status':'PASS','sections':matrix,'self_escalation_denied':self_denied,'structural':structural,'credentials_exposed':False},sort_keys=True))
if __name__=='__main__':main()
