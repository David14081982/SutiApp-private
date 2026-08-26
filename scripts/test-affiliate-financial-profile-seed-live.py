"""Reversible Admin edit + current eligibility-context + RLS test after seed."""
from pathlib import Path
import json, urllib.error, urllib.request
ROOT=Path(__file__).resolve().parents[1]
def env():
    out={}
    for raw in (ROOT/'supabase.env').read_text(encoding='utf-8-sig').splitlines():
        if raw.strip() and not raw.lstrip().startswith('#') and '=' in raw:
            k,v=raw.split('=',1);out[k.strip()]=v.strip().strip('"').strip("'")
    return out
def req(url,key,method='GET',body=None,token=None):
    h={'apikey':key,'Accept':'application/json'}
    if token:h['Authorization']='Bearer '+token
    if body is not None:h['Content-Type']='application/json'
    try:
        with urllib.request.urlopen(urllib.request.Request(url,data=None if body is None else json.dumps(body).encode(),headers=h,method=method),timeout=60) as r:return r.status,json.loads(r.read() or b'[]')
    except urllib.error.HTTPError as e:
        raw=e.read();return e.code,json.loads(raw) if raw else {}
def login(base,key,email,password):
    s,d=req(base+'/auth/v1/token?grant_type=password',key,'POST',{'email':email,'password':password})
    if s!=200:raise RuntimeError('login failed')
    return d['access_token']
def rpc(base,key,name,token,body):return req(base+'/rest/v1/rpc/'+name,key,'POST',body,token)
def main():
    e=env();base=e['SUPABASE_URL'].rstrip('/');key=e['SUPABASE_PUBLISHABLE_KEY'];tokens={n:login(base,key,e[n+'_EMAIL'],e[n+'_PASSWORD']) for n in ('H005_TEST','H005_TEST2','H005_TEST3')};admin=tokens['H005_TEST']
    s,affiliate_id=rpc(base,key,'get_effective_affiliate_id',admin,{})
    if s!=200 or not affiliate_id:raise RuntimeError('effective affiliate missing')
    s,data=rpc(base,key,'get_affiliate_admin_profile',admin,{'p_affiliate_id':affiliate_id})
    if s!=200:raise RuntimeError('profile read failed')
    profile=data['profile'];options=data['options'];old_category=profile.get('financial_employee_category_code');old_union=profile.get('financial_union_code');version=profile['financial_profile_version']
    new_category=next(x['code'] for x in options['employment_category'] if x['code']!=old_category);new_union=next(x['code'] for x in options['union'] if x['code']!=old_union)
    for alias in ('H005_TEST2','H005_TEST3'):
        s,_=rpc(base,key,'update_affiliate_admin_profile',tokens[alias],{'p_affiliate_id':affiliate_id,'p_expected_version':version,'p_patch':{'financial_employee_category_code':new_category,'financial_union_code':new_union},'p_reason':'Prueba RLS reversible'})
        if s not in (401,403):raise RuntimeError(alias+' write allowed')
    s,changed=rpc(base,key,'update_affiliate_admin_profile',admin,{'p_affiliate_id':affiliate_id,'p_expected_version':version,'p_patch':{'financial_employee_category_code':new_category,'financial_union_code':new_union},'p_reason':'Prueba elegibilidad reversible'})
    if s!=200:raise RuntimeError('admin edit failed '+str(changed))
    s,context=rpc(base,key,'get_current_affiliate_financial_context',admin,{})
    if s!=200 or context.get('financial_employee_category_code')!=new_category or context.get('financial_union_code')!=new_union:raise RuntimeError('eligibility context did not refresh')
    s,restored=rpc(base,key,'update_affiliate_admin_profile',admin,{'p_affiliate_id':affiliate_id,'p_expected_version':version+1,'p_patch':{'financial_employee_category_code':old_category,'financial_union_code':old_union},'p_reason':'Restauración prueba elegibilidad'})
    if s!=200:raise RuntimeError('restore failed '+str(restored))
    s,context=rpc(base,key,'get_current_affiliate_financial_context',admin,{})
    if s!=200 or context.get('financial_employee_category_code')!=old_category or context.get('financial_union_code')!=old_union:raise RuntimeError('context was not restored')
    print(json.dumps({'status':'PASS','admin_edit':True,'eligibility_context_refresh':True,'restored':True,'normal_users_denied':2,'affiliate_id':affiliate_id}))
if __name__=='__main__':main()
