"""Live reversible authorization/RLS/audit test for ADR-043."""
from pathlib import Path
import json, urllib.error, urllib.parse, urllib.request
ROOT=Path(__file__).resolve().parents[1]

def env():
    out={}
    for raw in (ROOT/'supabase.env').read_text(encoding='utf-8-sig').splitlines():
        if raw.strip() and not raw.lstrip().startswith('#') and '=' in raw:
            k,v=raw.split('=',1);out[k.strip()]=v.strip().strip('"').strip("'")
    return out
def req(url,key,method='GET',body=None,token=None,prefer=None):
    headers={'apikey':key,'Accept':'application/json','User-Agent':'SutiApp-Affiliate-Profile-Test/1.0'}
    if token:headers['Authorization']='Bearer '+token
    if body is not None:headers['Content-Type']='application/json'
    if prefer:headers['Prefer']=prefer
    try:
        with urllib.request.urlopen(urllib.request.Request(url,data=None if body is None else json.dumps(body).encode(),headers=headers,method=method),timeout=60) as response:return response.status,json.loads(response.read() or b'[]')
    except urllib.error.HTTPError as error:
        raw=error.read();return error.code,json.loads(raw) if raw else {}
def login(base,key,email,password):
    status,data=req(base+'/auth/v1/token?grant_type=password',key,'POST',{'email':email,'password':password})
    if status!=200:raise RuntimeError('login failed')
    return data['access_token']
def rest(base,key,path,token,method='GET',body=None,prefer=None):return req(base+'/rest/v1/'+path,key,method,body,token,prefer)
def db_query(values,sql):
    ref=urllib.parse.urlsplit(values['SUPABASE_URL']).hostname.split('.')[0]
    request=urllib.request.Request(f'https://api.supabase.com/v1/projects/{ref}/database/query',data=json.dumps({'query':sql}).encode(),headers={'Authorization':'Bearer '+values['SUPABASE_ACCESS_TOKEN'],'Content-Type':'application/json'},method='POST')
    try:
        with urllib.request.urlopen(request,timeout=90) as response:return json.loads(response.read())
    except urllib.error.HTTPError as error:
        raise RuntimeError('database query failed: '+error.read().decode(errors='replace')) from error

def main():
    values=env();base=values['SUPABASE_URL'].rstrip('/');key=values['SUPABASE_PUBLISHABLE_KEY']
    tokens={name:login(base,key,values[name+'_EMAIL'],values[name+'_PASSWORD']) for name in ('H005_TEST','H005_TEST2','H005_TEST3')}
    status,effective_id=rest(base,key,'rpc/get_effective_affiliate_id',tokens['H005_TEST'],'POST',{})
    if status!=200 or not effective_id:raise RuntimeError('admin effective affiliate missing')
    status,rows=rest(base,key,'affiliates?select=id,display_name,financial_profile_version&id=eq.'+effective_id,tokens['H005_TEST'])
    if status!=200 or len(rows)!=1:raise RuntimeError('admin affiliate lookup failed')
    profile=rows[0];affiliate_id=profile['id']
    status,data=rest(base,key,'rpc/get_affiliate_admin_profile',tokens['H005_TEST'],'POST',{'p_affiliate_id':affiliate_id})
    if status!=200 or data.get('profile',{}).get('id')!=affiliate_id:raise RuntimeError('admin profile read RPC failed')
    denied=0
    for alias in ('H005_TEST2','H005_TEST3'):
        status,_=rest(base,key,'rpc/get_affiliate_admin_profile',tokens[alias],'POST',{'p_affiliate_id':affiliate_id})
        if status not in (401,403):raise RuntimeError(alias+' profile read allowed')
        status,_=rest(base,key,'rpc/update_affiliate_admin_profile',tokens[alias],'POST',{'p_affiliate_id':affiliate_id,'p_expected_version':profile['financial_profile_version'],'p_patch':{'display_name':profile['display_name']},'p_reason':'Prueba reversible'})
        if status not in (401,403):raise RuntimeError(alias+' profile write allowed')
        denied+=1
    status,data=rest(base,key,'rpc/update_affiliate_admin_profile',tokens['H005_TEST'],'POST',{'p_affiliate_id':affiliate_id,'p_expected_version':profile['financial_profile_version'],'p_patch':{'display_name':profile['display_name']},'p_reason':'Prueba reversible'})
    if status!=400 or 'PROFILE_NO_CHANGE' not in str(data):raise RuntimeError('admin RPC did not reject no-op atomically')
    status,data=rest(base,key,'affiliates?id=eq.'+affiliate_id,tokens['H005_TEST'],'PATCH',{'display_name':'DIRECT_WRITE_MUST_FAIL'},'return=representation')
    if status not in (401,403) and data:raise RuntimeError('direct browser affiliate write allowed')
    original_name=profile['display_name'];temporary=(original_name or 'Afiliado')+' [AUDIT TEST]'
    status,changed=rest(base,key,'rpc/update_affiliate_admin_profile',tokens['H005_TEST'],'POST',{'p_affiliate_id':affiliate_id,'p_expected_version':profile['financial_profile_version'],'p_patch':{'display_name':temporary},'p_reason':'Prueba auditada reversible'})
    if status!=200 or changed.get('profile',{}).get('display_name')!=temporary:raise RuntimeError('audited profile change failed')
    status,restored=rest(base,key,'rpc/update_affiliate_admin_profile',tokens['H005_TEST'],'POST',{'p_affiliate_id':affiliate_id,'p_expected_version':profile['financial_profile_version']+1,'p_patch':{'display_name':original_name},'p_reason':'Restauración prueba auditada'})
    if status!=200 or restored.get('profile',{}).get('display_name')!=original_name:raise RuntimeError('profile restoration failed')
    status,audit=rest(base,key,f'affiliate_profile_audit_log?select=field_name,old_value,new_value,changed_by,profile_version&affiliate_id=eq.{affiliate_id}&profile_version=gte.{profile["financial_profile_version"]+1}&order=profile_version.asc',tokens['H005_TEST'])
    if status!=200 or len(audit)<2 or audit[-2]['field_name']!='display_name' or audit[-1]['field_name']!='display_name':raise RuntimeError('durable audit verification failed')
    status,after=rest(base,key,'affiliates?select=display_name,financial_profile_version&id=eq.'+affiliate_id,tokens['H005_TEST'])
    if status!=200 or after[0]['display_name']!=original_name or after[0]['financial_profile_version']!=profile['financial_profile_version']+2:raise RuntimeError('profile value was not restored')
    print(json.dumps({'status':'PASS','admin_profile_read':True,'normal_profiles_denied':denied,'direct_browser_write_denied':True,'optimistic_noop_rolled_back':True,'audited_change_restored':True,'durable_audit_rows':2}))

if __name__=='__main__':main()
