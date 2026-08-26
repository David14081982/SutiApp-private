#!/usr/bin/env python3
"""Reversible live permission/CRUD/asset matrix for the union canonical cutover."""
import hashlib,json,urllib.error,urllib.parse,urllib.request,uuid
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

def env():
    out={}
    for raw in (ROOT/'supabase.env').read_text(encoding='utf-8-sig').splitlines():
        if raw.strip() and not raw.lstrip().startswith('#') and '=' in raw:
            key,value=raw.split('=',1);out[key.strip()]=value.strip().strip('"').strip("'")
    return out

def call(url,key,method='GET',body=None,token=None,prefer=None,content_type='application/json'):
    headers={'apikey':key,'Accept':'application/json','User-Agent':'SutiApp-UnionMatrix/1.0'}
    if token:headers['Authorization']='Bearer '+token
    if prefer:headers['Prefer']=prefer
    data=body
    if body is not None and not isinstance(body,(bytes,bytearray)):
        data=json.dumps(body,separators=(',',':')).encode();headers['Content-Type']='application/json'
    elif body is not None:headers['Content-Type']=content_type
    try:
        with urllib.request.urlopen(urllib.request.Request(url,data=data,headers=headers,method=method),timeout=60) as response:
            raw=response.read()
            try:return response.status,json.loads(raw) if raw else []
            except:return response.status,raw.decode(errors='replace')
    except urllib.error.HTTPError as error:
        raw=error.read()
        try:return error.code,json.loads(raw) if raw else []
        except:return error.code,raw.decode(errors='replace')

def login(base,key,email,password):
    status,data=call(base+'/auth/v1/token?grant_type=password',key,'POST',{'email':email,'password':password})
    if status!=200:raise RuntimeError('LOGIN_FAILED')
    return data['access_token'],data['user']['id']

def denied(status,data):
    if status in (400,401,403,404,409):return True
    if status in (200,201,204) and data==[]:return True
    return isinstance(data,dict) and str(data.get('code','')) in ('42501','P0001')

def main():
    values=env();base=values['SUPABASE_URL'].rstrip('/');key=values['SUPABASE_PUBLISHABLE_KEY'];secret=values['SUPABASE_SECRET_KEY'];rest=base+'/rest/v1'
    admin,admin_id=login(base,key,values['H005_TEST_EMAIL'],values['H005_TEST_PASSWORD'])
    normal,_=login(base,key,values['H005_TEST3_EMAIL'],values['H005_TEST3_PASSWORD'])
    marker='UNION_MATRIX_'+uuid.uuid4().hex[:10];png=b'\x89PNG\r\n\x1a\n'+b'cutover-reversible-fixture';digest=hashlib.sha256(png).hexdigest().upper()
    directory_id=None;directory_asset_id=None;directory_path=f'directory/{admin_id}/{digest.lower()}.png'
    union_asset_id=None;union_path=f'sindicato/{admin_id}/{uuid.uuid4().hex}.png';union_screen_existed=False;old_header_id=None
    checks={}
    try:
        status,history=call(rest+'/directory_members?select=id,record_origin&record_origin=eq.HISTORICAL_IMPORT&limit=1',secret,token=secret)
        if status!=200 or len(history)!=1:raise RuntimeError('HISTORICAL_DIRECTORY_ROW_MISSING')
        status,data=call(rest+f'/directory_members?id=eq.{history[0]["id"]}',key,'DELETE',{},admin,'return=representation')
        checks['historical_delete_denied']=denied(status,data)

        directory_payload={'name':marker,'role':'Prueba reversible','sort_order':990001,'image_asset_id':None,'enabled':False,'record_origin':'ADMIN_SECTION_ROLLOUT'}
        status,data=call(rest+'/directory_members',key,'POST',directory_payload,normal,'return=representation')
        checks['normal_directory_create_denied']=denied(status,data)
        status,data=call(rest+'/directory_members',key,'POST',directory_payload,prefer='return=representation')
        checks['anon_directory_create_denied']=denied(status,data)

        status,_=call(base+'/storage/v1/object/app-assets/'+directory_path,key,'POST',png,admin,content_type='image/png')
        checks['directory_storage_upload']=status in (200,201)
        asset={'asset_key':'admin.section.directory.'+uuid.uuid4().hex,'asset_type':'DIRECTORY_MEMBER_IMAGE','title':marker,'alt_text':marker,'storage_bucket':'app-assets','storage_path':directory_path,'mime_type':'image/png','file_size':len(png),'content_sha256':digest,'status':'READY'}
        status,data=call(rest+'/app_assets',key,'POST',asset,admin,'return=representation')
        checks['directory_asset_row']=status==201 and len(data)==1
        if checks['directory_asset_row']:
            directory_asset_id=data[0]['id']
            source={'asset_id':directory_asset_id,'source_sheet':'ADMIN_SECTION_OWNER','source_column':'directory.image_asset_id','source_snapshot_hash':digest}
            status,_=call(rest+'/asset_sources',key,'POST',source,admin,'return=minimal')
            verify_status,verify_data=call(rest+f'/asset_sources?select=asset_id&asset_id=eq.{directory_asset_id}',secret,token=secret)
            checks['directory_asset_provenance']=status==201 and verify_status==200 and len(verify_data)==1
        else:checks['directory_asset_provenance']=False

        directory_payload['image_asset_id']=directory_asset_id
        status,data=call(rest+'/directory_members',key,'POST',directory_payload,admin,'return=representation')
        checks['admin_directory_create']=status==201 and len(data)==1
        if not checks['admin_directory_create']:raise RuntimeError('ADMIN_DIRECTORY_CREATE_FAILED:'+str(data))
        directory_id=data[0]['id']
        status,data=call(rest+f'/directory_members?id=eq.{directory_id}',key,'PATCH',{'role':'Prueba reversible editada','sort_order':990002},admin,'return=representation')
        checks['admin_directory_update_order']=status==200 and len(data)==1 and data[0]['sort_order']==990002
        status,data=call(rest+f'/directory_members?id=eq.{directory_id}&select=id',key,token=normal)
        checks['inactive_hidden_from_normal']=status==200 and data==[]
        status,data=call(rest+f'/directory_members?id=eq.{directory_id}',key,'PATCH',{'enabled':True},admin,'return=representation')
        checks['admin_directory_publish']=status==200 and len(data)==1 and data[0]['enabled'] is True
        status,data=call(rest+f'/directory_members?id=eq.{directory_id}&select=id,name,image_asset_id',key,token=normal)
        checks['published_reflects_to_frontend_reader']=status==200 and len(data)==1 and data[0]['image_asset_id']==directory_asset_id

        status,data=call(rest+'/union_screen_content?select=screen_key,header_asset_id&screen_key=eq.categoria&limit=1',key,token=admin)
        if status!=200:raise RuntimeError('UNION_SCREEN_READ_FAILED')
        union_screen_existed=len(data)==1;old_header_id=data[0].get('header_asset_id') if union_screen_existed else None
        status,_=call(base+'/storage/v1/object/app-assets/'+union_path,key,'POST',png,admin,content_type='image/png')
        checks['union_storage_upload']=status in (200,201)
        union_asset={'asset_key':'admin.section.sindicato.'+uuid.uuid4().hex,'asset_type':'UNION_HEADER_IMAGE','title':marker,'alt_text':marker,'storage_bucket':'app-assets','storage_path':union_path,'mime_type':'image/png','file_size':len(png),'content_sha256':digest,'status':'READY'}
        status,data=call(rest+'/app_assets',key,'POST',union_asset,admin,'return=representation')
        checks['union_asset_row']=status==201 and len(data)==1
        if checks['union_asset_row']:
            union_asset_id=data[0]['id'];source={'asset_id':union_asset_id,'source_sheet':'ADMIN_SECTION_OWNER','source_column':'sindicato.header','source_snapshot_hash':digest}
            status,_=call(rest+'/asset_sources',key,'POST',source,admin,'return=minimal')
            verify_status,verify_data=call(rest+f'/asset_sources?select=asset_id&asset_id=eq.{union_asset_id}',secret,token=secret)
            checks['union_asset_provenance']=status==201 and verify_status==200 and len(verify_data)==1
        else:checks['union_asset_provenance']=False
        if union_screen_existed:
            status,_=call(rest+'/union_screen_content?screen_key=eq.categoria',key,'PATCH',{'header_asset_id':union_asset_id},admin,'return=minimal')
        else:
            status,_=call(rest+'/union_screen_content',key,'POST',{'screen_key':'categoria','title':'','description':'','published':False,'header_asset_id':union_asset_id},admin,'return=minimal')
        verify_status,verify_data=call(rest+'/union_screen_content?select=header_asset_id&screen_key=eq.categoria',secret,token=secret)
        checks['union_header_attach']=status in (200,201,204) and verify_status==200 and len(verify_data)==1 and verify_data[0]['header_asset_id']==union_asset_id
        status,data=call(rest+'/app_assets',key,'POST',union_asset,normal,'return=representation')
        checks['normal_union_asset_denied']=denied(status,data)
    finally:
        if union_screen_existed:
            call(rest+'/union_screen_content?screen_key=eq.categoria',secret,'PATCH',{'header_asset_id':old_header_id},secret,'return=minimal')
        elif union_asset_id:
            call(rest+'/union_screen_content?screen_key=eq.categoria',secret,'DELETE',{},secret,'return=minimal')
        if directory_id:
            call(rest+f'/directory_members?id=eq.{directory_id}',key,'DELETE',{},admin,'return=minimal')
        if directory_asset_id:
            call(rest+f'/asset_sources?asset_id=eq.{directory_asset_id}',secret,'DELETE',{},secret,'return=minimal')
            call(rest+f'/app_assets?id=eq.{directory_asset_id}',key,'DELETE',{},admin,'return=minimal')
        if union_asset_id:
            call(rest+f'/asset_sources?asset_id=eq.{union_asset_id}',secret,'DELETE',{},secret,'return=minimal')
            call(rest+f'/app_assets?id=eq.{union_asset_id}',key,'DELETE',{},admin,'return=minimal')
        call(base+'/storage/v1/object/app-assets/'+directory_path,key,'DELETE',token=admin)
        call(base+'/storage/v1/object/app-assets/'+union_path,key,'DELETE',token=admin)

    status,residue=call(rest+f'/directory_members?select=id&name=eq.{urllib.parse.quote(marker)}',secret,token=secret)
    status2,residue_assets=call(rest+f'/app_assets?select=id&title=eq.{urllib.parse.quote(marker)}',secret,token=secret)
    checks['cleanup_no_rows']=status==200 and status2==200 and residue==[] and residue_assets==[]
    status,counts=call(rest+'/directory_members?select=id,record_origin,enabled',secret,token=secret)
    checks['historical_30_preserved']=status==200 and len(counts)==30 and all(row['record_origin']=='HISTORICAL_IMPORT' and row['enabled'] for row in counts)
    failed=[name for name,value in checks.items() if not value]
    if failed:raise RuntimeError('UNION_MATRIX_FAILED:'+json.dumps({'failed':failed,'checks':checks},sort_keys=True))
    print(json.dumps({'status':'PASS','checks':checks,'fixtures_removed':True,'directory_rows':len(counts),'credentials_exposed':False},sort_keys=True))

if __name__=='__main__':main()
