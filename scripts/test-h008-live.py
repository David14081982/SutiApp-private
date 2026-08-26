#!/usr/bin/env python3
"""H-008 real-session authorization, write, Storage, audit and restoration test."""
from __future__ import annotations
import hashlib, json, urllib.error, urllib.parse, urllib.request, uuid
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
def env():
    out={}
    for raw in (ROOT/'supabase.env').read_text(encoding='utf-8-sig').splitlines():
        if raw.strip() and not raw.lstrip().startswith('#') and '=' in raw:
            k,v=raw.split('=',1); out[k.strip()]=v.strip().strip('"').strip("'")
    return out
def req(url,key,method='GET',body=None,token=None,content='application/json',prefer=None,extra=None):
    h={'apikey':key,'Accept':'application/json','User-Agent':'SutiApp-H008-Test/1.0'}
    if token:h['Authorization']='Bearer '+token
    if body is not None:h['Content-Type']=content
    if prefer:h['Prefer']=prefer
    if extra:h.update(extra)
    try:
        with urllib.request.urlopen(urllib.request.Request(url,data=body,headers=h,method=method),timeout=60) as r:return r.status,r.read()
    except urllib.error.HTTPError as e:return e.code,e.read()
def login(base,key,email,password):
    status,raw=req(base+'/auth/v1/token?grant_type=password',key,'POST',json.dumps({'email':email,'password':password}).encode())
    if status!=200:raise RuntimeError('Login failed')
    return json.loads(raw)['access_token']
def rest(base,key,path,token):
    status,raw=req(base+'/rest/v1/'+path,key,token=token)
    if status!=200:raise RuntimeError(f'REST read failed {status}')
    return json.loads(raw)
def write(base,key,table,query,method,payload,token):
    return req(f'{base}/rest/v1/{table}?{query}',key,method,json.dumps(payload,separators=(',',':')).encode(),token,prefer='return=representation')
def main():
    e=env(); base=e['SUPABASE_URL'].rstrip('/'); key=e['SUPABASE_PUBLISHABLE_KEY']
    tokens={a:login(base,key,e[a+'_EMAIL'],e[a+'_PASSWORD']) for a in ('H005_TEST','H005_TEST2','H005_TEST3')}
    assignments={a:rest(base,key,'admin_assignments?select=role,permissions,enabled',t) for a,t in tokens.items()}
    if len(assignments['H005_TEST'])!=1 or assignments['H005_TEST'][0]['role']!='visual_admin':raise RuntimeError('Admin assignment missing')
    if assignments['H005_TEST2'] or assignments['H005_TEST3']:raise RuntimeError('Normal account promoted')
    original=rest(base,key,'app_settings?select=*&id=eq.primary',tokens['H005_TEST'])[0]
    test_name=str(original['app_name'])+' · H008'
    status,raw=write(base,key,'app_settings','id=eq.primary','PATCH',{'app_name':test_name},tokens['H005_TEST'])
    if status!=200 or len(json.loads(raw))!=1:raise RuntimeError(f'Admin settings write failed {status}')
    for alias in ('H005_TEST2','H005_TEST3'):
        status,raw=write(base,key,'app_settings','id=eq.primary','PATCH',{'app_name':'DENIED'},tokens[alias])
        if status not in (200,204) or (raw and json.loads(raw)):raise RuntimeError(f'{alias} write was not denied')
    status,raw=req(base+'/rest/v1/app_settings?id=eq.primary',key,'PATCH',json.dumps({'app_name':'DENIED'}).encode(),prefer='return=representation')
    if status not in (401,403):raise RuntimeError('Anonymous write was not denied')
    public1=rest(base,key,'app_settings?select=app_name&id=eq.primary',tokens['H005_TEST2'])[0]['app_name']
    public2=rest(base,key,'app_settings?select=app_name&id=eq.primary',tokens['H005_TEST3'])[0]['app_name']
    if public1!=test_name or public2!=test_name:raise RuntimeError('Cross-device settings persistence failed')
    svg=b'<svg xmlns="http://www.w3.org/2000/svg" width="3" height="3"><rect width="3" height="3" fill="#910022"/></svg>'
    digest=hashlib.sha256(svg).hexdigest(); path=f'branding/admin-test/{digest}.svg'; asset_id=str(uuid.uuid4()); asset_key='test.h008.install-screen'
    status,_=req(base+'/storage/v1/object/app-assets/'+path,key,'POST',svg,tokens['H005_TEST'],'image/svg+xml',extra={'x-upsert':'false'})
    if status not in (200,201):raise RuntimeError(f'Admin Storage upload failed {status}')
    try:
        row={'id':asset_id,'asset_key':asset_key,'asset_type':'BRANDING','title':'H008 reversible test','storage_bucket':'app-assets','storage_path':path,'mime_type':'image/svg+xml','file_size':len(svg),'content_sha256':digest.upper(),'status':'READY'}
        status,raw=write(base,key,'app_assets','','POST',row,tokens['H005_TEST'])
        if status!=201 or len(json.loads(raw))!=1:raise RuntimeError(f'Asset registry write failed {status}: {raw[:300]!r}')
        status,raw=write(base,key,'app_settings','id=eq.primary','PATCH',{'install_screen_1_asset_id':asset_id},tokens['H005_TEST'])
        if status!=200 or len(json.loads(raw))!=1:raise RuntimeError('Install link write failed')
        check1=rest(base,key,'app_settings?select=install_screen_1_asset_id&id=eq.primary',tokens['H005_TEST2'])[0]
        check2=rest(base,key,'app_settings?select=install_screen_1_asset_id&id=eq.primary',tokens['H005_TEST3'])[0]
        if check1['install_screen_1_asset_id']!=asset_id or check2['install_screen_1_asset_id']!=asset_id:raise RuntimeError('Install cross-device persistence failed')
    finally:
        write(base,key,'app_settings','id=eq.primary','PATCH',{'app_name':original['app_name'],'install_screen_1_asset_id':original['install_screen_1_asset_id']},tokens['H005_TEST'])
        write(base,key,'app_assets',f'id=eq.{asset_id}','DELETE',{},tokens['H005_TEST'])
        req(base+'/storage/v1/object/app-assets/'+path,key,'DELETE',token=tokens['H005_TEST'])
    status,_=req(base+'/storage/v1/object/app-assets/branding/admin-test/normal-denied.svg',key,'POST',svg,tokens['H005_TEST2'],'image/svg+xml')
    if status not in (400,401,403):raise RuntimeError('Normal Storage write was not denied')
    restored=rest(base,key,'app_settings?select=app_name,install_screen_1_asset_id&id=eq.primary',tokens['H005_TEST'])[0]
    if restored['app_name']!=original['app_name'] or restored['install_screen_1_asset_id']!=original['install_screen_1_asset_id']:raise RuntimeError('Original settings not restored')
    audit=rest(base,key,'admin_audit_log?select=resource,action,result&order=created_at.desc&limit=50',tokens['H005_TEST'])
    if not any(x['resource']=='app_settings' and x['result']=='SUCCESS' for x in audit):raise RuntimeError('Audit log missing settings write')
    print(json.dumps({'status':'PASS','admin_alias':'H005_TEST','normal_aliases_denied':2,'admin_settings_write':'PASS','admin_storage_upload':'PASS','install_upload':'PASS','cross_device_clients':2,'anonymous_write':'DENIED','normal_table_write':'DENIED','normal_storage_write':'DENIED','original_restored':True,'audit_log':'PASS'},sort_keys=True))
if __name__=='__main__':main()
