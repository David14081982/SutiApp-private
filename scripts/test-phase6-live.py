#!/usr/bin/env python3
"""Non-seeding multi-user Phase 6 RLS and reconciliation verification."""
import json,urllib.error,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def env():
    out={}
    for raw in (ROOT/'supabase.env').read_text(encoding='utf-8-sig').splitlines():
        if raw.strip() and not raw.lstrip().startswith('#') and '=' in raw:
            k,v=raw.split('=',1);out[k.strip()]=v.strip().strip('"').strip("'")
    return out
def call(url,key,method='GET',body=None,token=None,expected=None):
    headers={'apikey':key,'Accept':'application/json','User-Agent':'SutiApp-Phase6-Test/1.0'}
    if token:headers['Authorization']='Bearer '+token
    if body is not None:headers['Content-Type']='application/json';body=json.dumps(body).encode()
    try:
        with urllib.request.urlopen(urllib.request.Request(url,data=body,headers=headers,method=method),timeout=60) as response:
            raw=response.read();return response.status,(json.loads(raw) if raw else None)
    except urllib.error.HTTPError as error:
        if expected and error.code in expected:return error.code,None
        raise RuntimeError(f'unexpected Phase 6 HTTP {error.code}: '+error.read(300).decode('utf-8','replace')) from None
def login(base,key,email,password):
    _,data=call(base+'/auth/v1/token?grant_type=password',key,'POST',{'email':email,'password':password});return data['access_token']
def main():
    v=env();base=v['SUPABASE_URL'].rstrip('/');rest=base+'/rest/v1';key=v['SUPABASE_PUBLISHABLE_KEY']
    admin=login(base,key,v['H005_TEST_EMAIL'],v['H005_TEST_PASSWORD']);normal2=login(base,key,v['H005_TEST2_EMAIL'],v['H005_TEST2_PASSWORD']);normal3=login(base,key,v['H005_TEST3_EMAIL'],v['H005_TEST3_PASSWORD'])
    for token in (admin,normal2,normal3):
        _,plans=call(rest+'/company_portal_plans?select=id',key,token=token);_,subscriptions=call(rest+'/company_portal_subscriptions?select=id',key,token=token)
        if plans or subscriptions:raise RuntimeError('Phase 6 tables must remain empty')
    valid={'name':'MUST_NOT_EXIST','monthly_price':0,'annual_price':0,'max_products':1,'sort_order':999}
    for token in (normal2,normal3):
        status,_=call(rest+'/company_portal_plans',key,'POST',valid,token,expected={401,403})
        if status not in {401,403}:raise RuntimeError('normal user write was not denied')
    invalid=dict(valid,max_products=0)
    status,_=call(rest+'/company_portal_plans',key,'POST',invalid,admin,expected={400,409,422})
    if status not in {400,409,422}:raise RuntimeError('admin path did not reach database validation')
    print(json.dumps({'status':'PASS','users':3,'admin_read':True,'normal_reads_empty':True,'normal_writes_denied':True,'admin_policy_reached_constraint':True,'invented_rows':0},sort_keys=True))
if __name__=='__main__':main()
