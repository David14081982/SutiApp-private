#!/usr/bin/env python3
"""Reversible Phase 4 membership CRUD/RLS verification."""
import json,urllib.error,urllib.request,uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def env():
    out={}
    for raw in (ROOT/'supabase.env').read_text(encoding='utf-8-sig').splitlines():
        if raw.strip() and not raw.lstrip().startswith('#') and '=' in raw:
            k,v=raw.split('=',1);out[k.strip()]=v.strip().strip('"').strip("'")
    return out
def call(url,key,method='GET',body=None,token=None,prefer=None,expected=None):
    h={'apikey':key,'Accept':'application/json','User-Agent':'SutiApp-Phase4-Test/1.0'}
    if token:h['Authorization']='Bearer '+token
    if body is not None:h['Content-Type']='application/json';body=json.dumps(body).encode()
    if prefer:h['Prefer']=prefer
    try:
        with urllib.request.urlopen(urllib.request.Request(url,data=body,headers=h,method=method),timeout=60) as r:
            raw=r.read();return r.status,(json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        if expected and e.code in expected:return e.code,None
        raise RuntimeError(f'Phase 4 HTTP {e.code}: '+e.read(300).decode('utf-8','replace')) from None
def login(base,key,email,password):
    _,d=call(base+'/auth/v1/token?grant_type=password',key,'POST',{'email':email,'password':password});return d['access_token']
def main():
    v=env();base=v['SUPABASE_URL'].rstrip('/');rest=base+'/rest/v1';key=v['SUPABASE_PUBLISHABLE_KEY'];secret=v['SUPABASE_SECRET_KEY'];admin=login(base,key,v['H005_TEST_EMAIL'],v['H005_TEST_PASSWORD']);normal=login(base,key,v['H005_TEST2_EMAIL'],v['H005_TEST2_PASSWORD']);marker='P4_'+uuid.uuid4().hex[:8];created=None
    try:
        _,public=call(rest+'/membership_offerings?select=id,logo_asset:app_assets!logo_asset_id(storage_bucket,storage_path)&enabled=eq.true',key,token=normal)
        if len(public)!=6 or any(not x.get('logo_asset') or x['logo_asset']['storage_bucket']!='app-assets' for x in public):raise RuntimeError('public catalog/assets failed')
        historical_id=public[0]['id']
        provenance_denied,_=call(rest+'/membership_offerings?id=eq.'+historical_id,key,'PATCH',{'source_sheet':'tampered'},admin,expected={401,403})
        if provenance_denied not in {401,403}:raise RuntimeError('historical provenance update not denied')
        _,historical_delete=call(rest+'/membership_offerings?id=eq.'+historical_id,key,'DELETE',token=admin,prefer='return=representation')
        if historical_delete:raise RuntimeError('historical row delete allowed')
        _,historical_still=call(rest+'/membership_offerings?select=id&id=eq.'+historical_id,key,token=admin)
        if len(historical_still)!=1:raise RuntimeError('historical row not preserved')
        denied,_=call(rest+'/membership_offerings',key,'POST',{'company_raw':marker,'concept':'denied','amount':1,'installments':1,'sort_order':999},normal,expected={401,403})
        if denied not in {401,403}:raise RuntimeError('normal write not denied')
        _,saved=call(rest+'/membership_offerings',key,'POST',{'company_raw':marker,'concept':'reversible','amount':321.45,'installments':3,'enabled':True,'sort_order':999,'record_origin':'ADMIN_PHASE4'},admin,'return=representation');created=saved[0]['id']
        _,updated=call(rest+'/membership_offerings?id=eq.'+created,key,'PATCH',{'enabled':False,'concept':'reversible updated'},admin,'return=representation')
        if not updated or updated[0]['enabled']:raise RuntimeError('admin update failed')
        _,hidden=call(rest+'/membership_offerings?select=id&id=eq.'+created,key,token=normal)
        if hidden:raise RuntimeError('disabled membership leaked')
        _,admin_visible=call(rest+'/membership_offerings?select=id&id=eq.'+created,key,token=admin)
        if len(admin_visible)!=1:raise RuntimeError('admin disabled read failed')
    finally:
        if created:call(rest+'/membership_offerings?id=eq.'+created,secret,'DELETE',token=secret,prefer='return=minimal')
    print(json.dumps({'status':'PASS','historical_read':6,'historical_immutable':True,'storage_assets':6,'normal_write_denied':True,'admin_crud':True,'disabled_hidden':True,'cleanup':True},sort_keys=True))
if __name__=='__main__':main()
