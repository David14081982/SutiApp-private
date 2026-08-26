#!/usr/bin/env python3
"""Reversible H-009 CRUD/RLS/Storage/audit test. Never prints credentials or user data."""
from __future__ import annotations
import hashlib,json,urllib.error,urllib.parse,urllib.request,uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
ALIASES=('H005_TEST','H005_TEST2','H005_TEST3')
def env():
    out={}
    for raw in (ROOT/'supabase.env').read_text(encoding='utf-8-sig').splitlines():
        if raw.strip() and not raw.lstrip().startswith('#') and '=' in raw:
            key,value=raw.split('=',1);out[key.strip()]=value.strip().strip('"').strip("'")
    return out
def req(url,key,method='GET',body=None,token=None,content='application/json',prefer=None,extra=None):
    headers={'apikey':key,'Accept':'application/json','User-Agent':'SutiApp-H009-Test/1.0'}
    if token:headers['Authorization']='Bearer '+token
    if body is not None:headers['Content-Type']=content
    if prefer:headers['Prefer']=prefer
    if extra:headers.update(extra)
    try:
        with urllib.request.urlopen(urllib.request.Request(url,data=body,headers=headers,method=method),timeout=60) as response:return response.status,response.read()
    except urllib.error.HTTPError as error:return error.code,error.read()
def login(base,key,email,password):
    status,raw=req(base+'/auth/v1/token?grant_type=password',key,'POST',json.dumps({'email':email,'password':password}).encode())
    if status!=200:raise RuntimeError('H-009 login failed')
    return json.loads(raw)['access_token']
def rest(base,key,path,token=None):
    status,raw=req(base+'/rest/v1/'+path,key,token=token)
    if status!=200:raise RuntimeError(f'H-009 read failed {status}')
    return json.loads(raw)
def write(base,key,table,method,payload,token=None,query='',returning=True):
    status,raw=req(f'{base}/rest/v1/{table}?{query}',key,method,json.dumps(payload,separators=(',',':')).encode(),token,prefer='return=representation' if returning else 'return=minimal')
    return status,json.loads(raw) if raw else []
def upload(base,key,token,bucket,path,data,mime):
    return req(f'{base}/storage/v1/object/{bucket}/{path}',key,'POST',data,token,mime,extra={'x-upsert':'false'})[0]
def create_asset(base,key,token,bucket,purpose,data,mime,ext):
    digest=hashlib.sha256(data).hexdigest();path=f'admin-test-h009/{uuid.uuid4().hex}-{digest}.{ext}';asset_id=str(uuid.uuid4())
    if upload(base,key,token,bucket,path,data,mime) not in (200,201):raise RuntimeError('Admin Storage upload failed')
    row={'id':asset_id,'asset_key':f'test.h009.{purpose}.{uuid.uuid4()}','asset_type':'H009_TEST','title':'H009 reversible test','storage_bucket':bucket,'storage_path':path,'mime_type':mime,'file_size':len(data),'content_sha256':digest.upper(),'status':'READY'}
    status,rows=write(base,key,'app_assets','POST',row,token)
    if status!=201 or len(rows)!=1:raise RuntimeError('Admin asset registry insert failed')
    status,_=write(base,key,'asset_sources','POST',{'asset_id':asset_id,'source_sheet':'ADMIN_H009','source_column':purpose,'source_snapshot_hash':digest.upper()},token,returning=False)
    if status!=201:raise RuntimeError('Admin asset provenance insert failed')
    return {'id':asset_id,'bucket':bucket,'path':path}
def denied_write(base,key,token,table,payload):
    status,rows=write(base,key,table,'POST',payload,token)
    return status in (401,403) or (status in (200,201) and not rows)
def main():
    values=env();base=values['SUPABASE_URL'].rstrip('/');public=values['SUPABASE_PUBLISHABLE_KEY'];secret=values['SUPABASE_SECRET_KEY']
    tokens={alias:login(base,public,values[alias+'_EMAIL'],values[alias+'_PASSWORD']) for alias in ALIASES};admin=tokens['H005_TEST']
    svg1=b'<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#7b1734"/></svg>'
    svg2=b'<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><circle cx="4" cy="4" r="4" fill="#13794a"/></svg>'
    pdf1=b'%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n';pdf2=b'%PDF-1.4\n% H009 replacement\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n'
    assets=[];created=[]
    stale=rest(base,secret,'app_assets?select=id,storage_bucket,storage_path&asset_key=like.test.h009.*')
    for asset in stale:
        write(base,secret,'app_assets','DELETE',{},query=f'id=eq.{asset["id"]}')
        req(f'{base}/storage/v1/object/{asset["storage_bucket"]}/{asset["storage_path"]}',secret,'DELETE')
    try:
        banner_a=create_asset(base,public,admin,'app-assets','banner-original',svg1,'image/svg+xml','svg');assets.append(banner_a)
        banner_b=create_asset(base,public,admin,'app-assets','banner-replacement',svg2,'image/svg+xml','svg');assets.append(banner_b)
        company_logo=create_asset(base,public,admin,'company-assets','company-logo',svg1,'image/svg+xml','svg');assets.append(company_logo)
        company_cover=create_asset(base,public,admin,'company-assets','company-cover',svg2,'image/svg+xml','svg');assets.append(company_cover)
        document_a=create_asset(base,public,admin,'documents','document-original',pdf1,'application/pdf','pdf');assets.append(document_a)
        document_b=create_asset(base,public,admin,'documents','document-replacement',pdf2,'application/pdf','pdf');assets.append(document_b)

        rowspec={
          'banners':{'placement':'home','title':'H009 reversible banner','description':'initial','image_asset_id':banner_a['id'],'enabled':False,'sort_order':90001,'record_origin':'ADMIN_H009'},
          'popups':{'title':'H009 reversible popup','body':'controlled content','enabled':False,'sort_order':90001,'record_origin':'ADMIN_H009'},
          'companies':{'display_name':'H009 reversible company','description':'initial','logo_asset_id':company_logo['id'],'enabled':False,'sort_order':90001,'record_origin':'ADMIN_H009'},
          'institutional_documents':{'kind':'download','title':'H009 reversible document','description':'initial','document_asset_id':document_a['id'],'enabled':False,'sort_order':90001,'record_origin':'ADMIN_H009'},
        }
        for table,payload in rowspec.items():
            status,rows=write(base,public,table,'POST',payload,admin)
            if status!=201 or len(rows)!=1:raise RuntimeError(f'Admin create failed for {table}')
            created.append((table,rows[0]['id']))
        ids=dict(created)
        status,_=write(base,public,'company_assets','POST',{'company_id':ids['companies'],'asset_id':company_cover['id'],'role':'cover','sort_order':1},admin)
        if status!=201:raise RuntimeError('Company cover link failed')

        updates={
          'banners':{'title':'H009 edited banner','image_asset_id':banner_b['id'],'enabled':True},
          'popups':{'title':'H009 edited popup','image_asset_id':banner_b['id'],'enabled':True},
          'companies':{'display_name':'H009 edited company','logo_asset_id':company_cover['id'],'enabled':True},
          'institutional_documents':{'title':'H009 edited document','document_asset_id':document_b['id'],'enabled':True},
        }
        for table,payload in updates.items():
            status,rows=write(base,public,table,'PATCH',payload,admin,f'id=eq.{ids[table]}')
            if status!=200 or len(rows)!=1:raise RuntimeError(f'Admin edit/activate failed for {table}')

        for alias in ('H005_TEST2','H005_TEST3'):
            token=tokens[alias]
            for table in updates:
                visible=rest(base,public,f'{table}?select=id&id=eq.{ids[table]}',token)
                if len(visible)!=1:raise RuntimeError(f'Cross-device enabled read failed for {table}')
            for table,payload in rowspec.items():
                attempt=dict(payload);attempt['sort_order']=90002
                if not denied_write(base,public,token,table,attempt):raise RuntimeError(f'Normal write was not denied for {table}')

        status=upload(base,public,tokens['H005_TEST2'],'app-assets',f'admin-test-h009/denied-{uuid.uuid4().hex}.svg',svg1,'image/svg+xml')
        if status not in (400,401,403):raise RuntimeError('Normal Storage write was not denied')

        for table,row_id in created:
            status,rows=write(base,public,table,'PATCH',{'enabled':False},admin,f'id=eq.{row_id}')
            if status!=200 or len(rows)!=1:raise RuntimeError(f'Admin deactivate failed for {table}')
            for alias in ('H005_TEST2','H005_TEST3'):
                if rest(base,public,f'{table}?select=id&id=eq.{row_id}',tokens[alias]):raise RuntimeError(f'Disabled row leaked for {table}')

        audit=rest(base,public,'admin_audit_log?select=resource,action,result&order=created_at.desc&limit=200',admin)
        for table in ('banners','popups','companies','institutional_documents','app_assets'):
            events=[x for x in audit if x['resource']==table and x['result']=='SUCCESS']
            if not any(x['action']=='INSERT' for x in events) or (table!='app_assets' and not any(x['action']=='UPDATE' for x in events)):
                raise RuntimeError(f'Audit evidence missing for {table}')
    finally:
        # Administrative cleanup restores exact pre-test authority state; audit evidence remains durable.
        for table,row_id in reversed(created):write(base,secret,table,'DELETE',{},query=f'id=eq.{row_id}')
        for asset in reversed(assets):
            write(base,secret,'app_assets','DELETE',{},query=f'id=eq.{asset["id"]}')
            req(f'{base}/storage/v1/object/{asset["bucket"]}/{asset["path"]}',secret,'DELETE')
    counts={table:len(rest(base,secret,f'{table}?select=id')) for table in ('companies','banners','popups','institutional_documents')}
    if counts!={'companies':33,'banners':23,'popups':3,'institutional_documents':8}:raise RuntimeError('H-009 cleanup reconciliation failed')
    print(json.dumps({'status':'PASS','admin_create_edit_replace_deactivate':4,'normal_aliases_denied':2,'cross_device_clients':2,'storage_denied':'PASS','audit_resources':5,'historical_counts_restored':counts,'credentials_exposed':False},sort_keys=True))
if __name__=='__main__':main()
