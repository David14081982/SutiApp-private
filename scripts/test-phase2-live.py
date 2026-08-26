#!/usr/bin/env python3
"""Reversible live Phase 2 Auth/RLS/CRUD verification without printing secrets."""
import json, urllib.error, urllib.parse, urllib.request, uuid
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
def env():
    out={}
    for raw in (ROOT/'supabase.env').read_text(encoding='utf-8-sig').splitlines():
        if raw.strip() and not raw.lstrip().startswith('#') and '=' in raw:
            key,value=raw.split('=',1);out[key.strip()]=value.strip().strip('"').strip("'")
    return out
def call(url,key,method='GET',body=None,token=None,prefer=None,expected=None):
    headers={'apikey':key,'Accept':'application/json','User-Agent':'SutiApp-Phase2-Test/1.0'}
    if token:headers['Authorization']='Bearer '+token
    if body is not None:headers['Content-Type']='application/json';body=json.dumps(body).encode()
    if prefer:headers['Prefer']=prefer
    req=urllib.request.Request(url,data=body,headers=headers,method=method)
    try:
        with urllib.request.urlopen(req,timeout=60) as response:
            raw=response.read();return response.status,(json.loads(raw) if raw else None)
    except urllib.error.HTTPError as error:
        if expected and error.code in expected:return error.code,None
        raise RuntimeError(f'Unexpected Phase 2 HTTP {error.code}') from None
def login(base,key,email,password):
    status,data=call(base+'/auth/v1/token?grant_type=password',key,'POST',{'email':email,'password':password})
    if status!=200 or not data.get('access_token'):raise RuntimeError('Phase 2 login failed')
    return data['access_token']
def main():
    values=env();base=values['SUPABASE_URL'];key=values['SUPABASE_PUBLISHABLE_KEY']
    admin=login(base,key,values['H005_TEST_EMAIL'],values['H005_TEST_PASSWORD'])
    normal=login(base,key,values['H005_TEST2_EMAIL'],values['H005_TEST2_PASSWORD'])
    marker='PHASE2_TEST_'+uuid.uuid4().hex[:10];rest=base+'/rest/v1';created=[]
    try:
        status,data=call(rest+'/news_articles',key,'POST',{'title':marker,'body':'reversible','published':False,'sort_order':999999},admin,'return=representation')
        news_id=data[0]['id'];created.append(('news_articles',news_id))
        denied,_=call(rest+'/news_articles',key,'POST',{'title':marker+'_DENIED','published':False,'sort_order':999998},normal,expected={401,403})
        if denied not in {401,403}:raise RuntimeError('normal news write was not denied')
        call(rest+'/news_articles?id=eq.'+news_id,key,'PATCH',{'published':True},admin,'return=minimal')
        _,visible=call(rest+'/news_articles?select=id&title=eq.'+urllib.parse.quote(marker),key,token=normal)
        if len(visible or [])!=1:raise RuntimeError('published news not visible to authenticated reader')
        status,data=call(rest+'/educational_resources',key,'POST',{'resource_kind':'education','title':marker,'published':False,'sort_order':999999},admin,'return=representation')
        education_id=data[0]['id'];created.append(('educational_resources',education_id))
        _,hidden=call(rest+'/educational_resources?select=id&id=eq.'+education_id,key,token=normal)
        if hidden:raise RuntimeError('unpublished education leaked')
        call(rest+'/managed_copy_overrides',key,'POST',{'scope':'phase2-test','source_text':marker,'replacement_text':marker+' OK','enabled':True},admin,'return=minimal')
        created.append(('managed_copy_overrides',('phase2-test',marker)))
        denied,_=call(rest+'/managed_copy_overrides',key,'POST',{'scope':'phase2-test','source_text':marker+'X','replacement_text':'DENIED'},normal,expected={401,403})
        if denied not in {401,403}:raise RuntimeError('normal copy write was not denied')
    finally:
        for table,identity in reversed(created):
            if table=='managed_copy_overrides':
                scope,source=identity;url=rest+f'/{table}?scope=eq.{urllib.parse.quote(scope)}&source_text=eq.{urllib.parse.quote(source)}'
            else:url=rest+f'/{table}?id=eq.{identity}'
            call(url,key,'DELETE',token=admin,prefer='return=minimal')
    print(json.dumps({'status':'PASS','admin_crud':True,'normal_write_denied':True,'published_read':True,'unpublished_hidden':True,'cleanup':True},sort_keys=True))
if __name__=='__main__':main()
