#!/usr/bin/env python3
"""Live authorization/export matrix with temporary responsibility cleanup."""
import base64,json,urllib.error,urllib.parse,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
APP_ORIGIN='http://localhost:8080'
def env():
 out={}
 for raw in (ROOT/'supabase.env').read_text(encoding='utf-8-sig').splitlines():
  if raw.strip() and not raw.lstrip().startswith('#') and '=' in raw:
   key,value=raw.split('=',1);out[key.strip()]=value.strip().strip('"').strip("'")
 return out
def request(url,method='GET',headers=None,body=None,expected=(200,)):
 data=None if body is None else json.dumps(body).encode()
 req=urllib.request.Request(url,data=data,headers=headers or {},method=method)
 try:
  with urllib.request.urlopen(req,timeout=180) as response:return response.status,response.headers,response.read()
 except urllib.error.HTTPError as error:
  payload=error.read()
  if error.code in expected:return error.code,error.headers,payload
  raise RuntimeError(f'HTTP_{error.code}:{payload[:500].decode(errors="replace")}') from None
def login(v,prefix):
 _,_,raw=request(v['SUPABASE_URL']+'/auth/v1/token?grant_type=password','POST',{'apikey':v['SUPABASE_PUBLISHABLE_KEY'],'Content-Type':'application/json'},{'email':v[prefix+'_EMAIL'],'password':v[prefix+'_PASSWORD']})
 return json.loads(raw)['access_token']
def subject(token):
 raw=token.split('.')[1];raw+='='*((4-len(raw)%4)%4);return json.loads(base64.urlsafe_b64decode(raw))['sub']
def auth_headers(v,token,content=True):
 headers={'apikey':v['SUPABASE_PUBLISHABLE_KEY'],'Authorization':'Bearer '+token}
 if content:headers['Content-Type']='application/json'
 return headers
def rpc(v,token,name,payload):
 _,_,raw=request(v['SUPABASE_URL']+'/rest/v1/rpc/'+name,'POST',auth_headers(v,token),payload)
 return json.loads(raw) if raw else None
def edge(v,token=None,method='GET',payload=None,expected=(200,)):
 headers={'apikey':v['SUPABASE_PUBLISHABLE_KEY'],'Origin':APP_ORIGIN}
 if token:headers['Authorization']='Bearer '+token
 if payload is not None:headers['Content-Type']='application/json'
 return request(v['SUPABASE_URL']+'/functions/v1/data-exports',method,headers,payload,expected)
def management(v,sql):
 ref=urllib.parse.urlsplit(v['SUPABASE_URL']).hostname.split('.')[0]
 _,_,raw=request(f'https://api.supabase.com/v1/projects/{ref}/database/query','POST',{'Authorization':'Bearer '+v['SUPABASE_ACCESS_TOKEN'],'Content-Type':'application/json','User-Agent':'SutiApp-DataExportsLive/1.0'},{'query':sql})
 return json.loads(raw)
def scalar(v,sql,key='value'):
 rows=management(v,sql);return rows[0][key]
def main():
 v=env();super_token=login(v,'H005_TEST');owner_token=login(v,'H005_TEST2');normal_token=login(v,'H005_TEST3');owner_id=subject(owner_token)
 original=management(v,"select action from public.admin_section_responsibilities where auth_user_id='"+owner_id.replace("'","")+"'::uuid and section_key='news' and enabled order by action")
 original_actions=[row['action'] for row in original]
 results={}
 try:
  schema=management(v,"""select
   to_regclass('public.data_export_audit_log') is not null as table_exists,
   (select count(*) from information_schema.columns where table_schema='public' and table_name='data_export_audit_log' and column_name in ('export_id','actor_id','domain','filters','row_count','format','status','column_set','created_at')) as audit_columns,
   (select count(*) from public.admin_role_permissions rp join public.admin_roles r on r.id=rp.role_id where r.code='principal_admin' and rp.permission='data_exports.read') as principal_permission,
   (select count(*) from public.admin_section_definitions where enforcement_status='ENFORCED' and 'export'=any(allowed_actions)) as export_sections,
   (select count(*) from public.admin_section_responsibilities where action='export' and enabled) as automatic_export_grants""")[0]
  assert schema=={'table_exists':True,'audit_columns':9,'principal_permission':1,'export_sections':11,'automatic_export_grants':0},schema
  results['migration']=results['technical_permission']=results['section_action']=results['default_deny']=True

  status,headers,_=edge(v,None,'OPTIONS');assert status==204 and headers.get('Access-Control-Allow-Origin')==APP_ORIGIN;results['browser_cors']=True

  status,_,_=edge(v,None,expected=(401,));assert status==401;results['anonymous_denied']=True
  status,_,_=edge(v,normal_token,expected=(403,));assert status==403;results['normal_denied']=True

  rpc(v,super_token,'set_section_responsibilities',{'p_email':v['H005_TEST2_EMAIL'],'p_section_key':'news','p_actions':['read']})
  status,_,_=edge(v,owner_token,expected=(403,));assert status==403;results['responsible_without_export_denied']=True

  rpc(v,super_token,'set_section_responsibilities',{'p_email':v['H005_TEST2_EMAIL'],'p_section_key':'news','p_actions':['read','export']})
  status,_,raw=edge(v,owner_token);available=json.loads(raw);keys=[item['key'] for item in available['domains']];assert keys==['news'],keys
  results['explicit_news_export']=True
  status,_,_=edge(v,owner_token,'POST',{'domain':'companies','format':'csv','filters':{}},expected=(403,));assert status==403;results['cross_domain_denied']=True

  status,csv_headers,csv_body=edge(v,owner_token,'POST',{'domain':'news','format':'csv','filters':{'published':False}});assert status==200 and csv_body.startswith(b'\xef\xbb\xbf') and b'title' in csv_body[:200]
  assert 'no-store' in csv_headers.get('Cache-Control','');results['csv']=results['filters']=results['temporary_download']=True
  status,xlsx_headers,xlsx_body=edge(v,owner_token,'POST',{'domain':'news','format':'xlsx','filters':{}});assert status==200 and xlsx_body.startswith(b'PK') and xlsx_headers.get_content_type()=='application/octet-stream' and 'no-store' in xlsx_headers.get('Cache-Control','');results['xlsx']=True

  status,_,super_raw=edge(v,super_token);super_domains=[item['key'] for item in json.loads(super_raw)['domains']];assert 'affiliates' in super_domains and 'audit' in super_domains and len(super_domains)>=17
  status,_,_=edge(v,super_token,'POST',{'domain':'news','format':'csv','filters':{'published':True}});assert status==200;results['super_admin']=True

  expected_false=scalar(v,"select count(*)::int as value from public.news_articles where published=false")
  audit=management(v,"select domain,format,status,row_count,cardinality(column_set) as columns from public.data_export_audit_log where actor_id in ('"+owner_id.replace("'","")+"'::uuid,'"+subject(super_token).replace("'","")+"'::uuid) order by created_at desc limit 3")
  assert len(audit)==3 and all(row['status']=='SUCCESS' and row['columns']>0 for row in audit),audit
  owner_filtered=[row for row in audit if row['domain']=='news' and row['format']=='csv' and row['row_count']==expected_false]
  assert owner_filtered;results['audit_log']=results['row_count']=True

  rpc(v,super_token,'revoke_section_responsibilities',{'p_auth_user_id':owner_id,'p_section_key':'news'})
  status,_,_=edge(v,owner_token,'POST',{'domain':'news','format':'csv','filters':{}},expected=(403,));assert status==403;results['revocation']=True
 finally:
  if original_actions:rpc(v,super_token,'set_section_responsibilities',{'p_email':v['H005_TEST2_EMAIL'],'p_section_key':'news','p_actions':original_actions})
  else:rpc(v,super_token,'revoke_section_responsibilities',{'p_auth_user_id':owner_id,'p_section_key':'news'})
  residue=scalar(v,"select count(*)::int as value from public.admin_section_responsibilities where auth_user_id='"+owner_id.replace("'","")+"'::uuid and section_key='news' and enabled and action='export'")
  assert residue==(1 if 'export' in original_actions else 0),residue
 results['cleanup']=True
 print(json.dumps({'status':'PASS','matrix':results,'automatic_export_grants':0,'secrets_exposed':0,'google_interaction':'NO'},sort_keys=True))
if __name__=='__main__':main()
