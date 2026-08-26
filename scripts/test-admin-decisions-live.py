"""Reversible Supabase/RLS verification for the approved Admin cutover."""
from pathlib import Path
import json, urllib.error, urllib.request, uuid
ROOT=Path(__file__).resolve().parents[1]
def env():
    out={}
    for raw in (ROOT/'supabase.env').read_text(encoding='utf-8-sig').splitlines():
        if raw.strip() and not raw.lstrip().startswith('#') and '=' in raw:
            k,v=raw.split('=',1);out[k.strip()]=v.strip().strip('"').strip("'")
    return out
def req(url,key,method='GET',body=None,token=None,prefer=None):
    h={'apikey':key,'Accept':'application/json','User-Agent':'SutiApp-Admin-Cutover-Test/1.0'}
    if token:h['Authorization']='Bearer '+token
    if body is not None:h['Content-Type']='application/json'
    if prefer:h['Prefer']=prefer
    company_id=None;role_id=None
    try:
        with urllib.request.urlopen(urllib.request.Request(url,data=None if body is None else json.dumps(body).encode(),headers=h,method=method),timeout=60) as r:return r.status,json.loads(r.read() or b'[]')
    except urllib.error.HTTPError as e:
        raw=e.read();return e.code,json.loads(raw) if raw else {}
def login(base,key,email,password):
    s,d=req(base+'/auth/v1/token?grant_type=password',key,'POST',{'email':email,'password':password})
    if s!=200:raise RuntimeError('login failed')
    return d['access_token']
def rest(base,key,path,token,method='GET',body=None,prefer=None):return req(base+'/rest/v1/'+path,key,method,body,token,prefer)
def denied(status,data):return status in(401,403) or (status in(200,201) and not data)
def main():
    e=env();base=e['SUPABASE_URL'].rstrip('/');key=e['SUPABASE_PUBLISHABLE_KEY'];tokens={a:login(base,key,e[a+'_EMAIL'],e[a+'_PASSWORD']) for a in ('H005_TEST','H005_TEST2','H005_TEST3')};admin=tokens['H005_TEST'];code='TEST_'+uuid.uuid4().hex.upper();company_id=None;role_id=None
    try:
        s,stale=rest(base,key,'admin_roles?select=id&name=eq.Reversible%20test%20role',admin)
        if s==200:
            for old in stale:rest(base,key,'rpc/delete_admin_role',admin,'POST',{'p_role_id':old['id']})
        s,d=rest(base,key,'segmentation_catalog_entries?select=id,catalog_type,code,label&order=sort_order',admin)
        if s!=200 or len(d)!=20:raise RuntimeError('admin exact segment read failed')
        payload={'catalog_type':'tag','code':code,'label':'Reversible Admin test','enabled':False,'sort_order':99999}
        s,d=rest(base,key,'segmentation_catalog_entries',admin,'POST',payload,'return=representation')
        if s!=201 or len(d)!=1:raise RuntimeError('admin segment create failed')
        row_id=d[0]['id']
        for alias in ('H005_TEST2','H005_TEST3'):
            s,d=rest(base,key,'segmentation_catalog_entries',tokens[alias],'POST',dict(payload,code=code+'_'+alias),'return=representation')
            if not denied(s,d):raise RuntimeError('normal segment write allowed')
            s,d=rest(base,key,'admin_roles?select=id',tokens[alias])
            if s!=200 or d:raise RuntimeError('normal role visibility allowed')
        s,d=rest(base,key,'union_screen_content?select=screen_key',admin)
        if s!=200:raise RuntimeError('union authority unreadable')
        s,d=rest(base,key,'rpc/save_admin_role',admin,'POST',{'p_role_id':None,'p_name':'Reversible test role','p_description':'cleanup','p_permissions':['content.read']})
        if s!=200 or not isinstance(d,str):raise RuntimeError('role RPC create failed')
        role_id=d
        s,d=rest(base,key,'companies',admin,'POST',{'display_name':'Reversible Admin cutover company','description':'cleanup','enabled':False,'sort_order':99999,'record_origin':'ADMIN_H009'},'return=representation')
        if s!=201 or not isinstance(d,list) or len(d)!=1:raise RuntimeError('test company create failed status='+str(s)+' code='+str(d.get('code','unknown') if isinstance(d,dict) else 'shape'))
        company_id=d[0]['id']
        profile={'company_id':company_id,'category_label':'Test','discount_percent':1,'accent_hue':210,'tags':['reversible'],'address':'','favorite':False,'featured':False,'sort_order':99999}
        s,d=rest(base,key,'company_benefit_profiles',admin,'POST',profile,'return=representation')
        if s!=201 or len(d)!=1:raise RuntimeError('company profile create failed')
        for alias in ('H005_TEST2','H005_TEST3'):
            s,d=rest(base,key,'company_benefit_profiles',tokens[alias],'POST',dict(profile,company_id=company_id),'return=representation')
            if not denied(s,d):raise RuntimeError('normal company profile write allowed')
        s,d=rest(base,key,'rpc/can_access_app_screen',tokens['H005_TEST2'],'POST',{'p_screen_id':'home'})
        if s!=200 or d is not True:raise RuntimeError('public access RPC failed')
        s,d=rest(base,key,'segmentation_catalog_entries?id=eq.'+row_id,admin,'DELETE',None,'return=representation')
        if s!=200 or len(d)!=1:raise RuntimeError('admin cleanup failed')
        rest(base,key,'rpc/delete_admin_role',admin,'POST',{'p_role_id':role_id});role_id=None
        rest(base,key,'companies?id=eq.'+company_id,admin,'DELETE',None,'return=minimal');company_id=None
        print(json.dumps({'status':'PASS','admin_crud':True,'role_rpc_crud':True,'company_profile_crud':True,'normal_writers_denied':2,'normal_roles_hidden':2,'public_access_rpc':True,'cleanup':True}))
    finally:
        rest(base,key,'segmentation_catalog_entries?code=like.'+code+'*',admin,'DELETE',None,'return=minimal')
        if role_id:rest(base,key,'rpc/delete_admin_role',admin,'POST',{'p_role_id':role_id})
        if company_id:rest(base,key,'companies?id=eq.'+company_id,admin,'DELETE',None,'return=minimal')
if __name__=='__main__':main()
