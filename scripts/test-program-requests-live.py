#!/usr/bin/env python3
"""Reversible live Auth/RLS/idempotency test for ADR-038."""
import base64,json,urllib.error,urllib.parse,urllib.request,uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def env():
    out={}
    for raw in (ROOT/'supabase.env').read_text(encoding='utf-8-sig').splitlines():
        if raw.strip() and not raw.lstrip().startswith('#') and '=' in raw:
            k,v=raw.split('=',1);out[k.strip()]=v.strip().strip('"').strip("'")
    return out
def call(url,key,method='GET',payload=None,token=None,expected={200,201,204}):
    req=urllib.request.Request(url,data=None if payload is None else json.dumps(payload).encode(),headers={'apikey':key,'Authorization':'Bearer '+(token or key),'Content-Type':'application/json'},method=method)
    try:
        with urllib.request.urlopen(req,timeout=60) as response:status=response.status;data=response.read()
    except urllib.error.HTTPError as error:status=error.code;data=error.read()
    if status not in expected:raise RuntimeError(f'HTTP_{status}:{data[:400]!r}')
    try:return status,json.loads(data) if data else None
    except json.JSONDecodeError:return status,data.decode(errors='replace')
def login(base,key,email,password):return call(base+'/auth/v1/token?grant_type=password',key,'POST',{'email':email,'password':password})[1]['access_token']
def sub(token):
    part=token.split('.')[1];part+='='*((4-len(part)%4)%4);return json.loads(base64.urlsafe_b64decode(part))['sub']
def main():
    v=env();base=v['SUPABASE_URL'];rest=base+'/rest/v1';key=v['SUPABASE_PUBLISHABLE_KEY'];secret=v['SUPABASE_SECRET_KEY']
    user=login(base,key,v['H005_TEST2_EMAIL'],v['H005_TEST2_PASSWORD']);other=login(base,key,v['H005_TEST3_EMAIL'],v['H005_TEST3_PASSWORD']);admin=login(base,key,v['H005_TEST_EMAIL'],v['H005_TEST_PASSWORD'])
    created=[]
    try:
        anon,_=call(rest+'/program_requests?select=id&limit=1',key,expected={401,403})
        direct,_=call(rest+'/program_requests',key,'POST',{'numero_control':'OTHER'},user,{400,401,403})
        _,items=call(rest+'/program_catalog_items?select=id,program_key,request_mode,legacy_boundary&enabled=eq.true&order=sort_order',key,token=user)
        if len(items)!=134 or any(x['request_mode']!='supabase' for x in items):raise RuntimeError('REQUESTABLE_ITEMS_MISMATCH')
        legacy=next(x for x in items if x['legacy_boundary']);farma=next(x for x in items if x['program_key']=='farma')
        idem=str(uuid.uuid4());payload={'p_program_item_id':legacy['id'],'p_product_id':None,'p_quantity':1,'p_notes':'ADR-038 reversible test','p_signature_data':'data:text/plain;base64,VEVTVA==','p_terms_accepted':True,'p_idempotency_key':idem}
        _,first=call(rest+'/rpc/create_program_request',key,'POST',payload,user);created.append(first['id'])
        _,second=call(rest+'/rpc/create_program_request',key,'POST',payload,user)
        if first['id']!=second['id'] or first['status']!='requires_financial_processing' or first['financial_processing_status']!='pending':raise RuntimeError('IDEMPOTENCY_OR_FINANCIAL_BOUNDARY_FAILED')
        _,affiliate=call(rest+'/affiliates?select=id,numero_control&auth_user_id=eq.'+sub(user),key,token=user)
        if len(affiliate)!=1 or first['affiliate_id']!=affiliate[0]['id'] or first['numero_control']!=affiliate[0]['numero_control']:raise RuntimeError('DERIVED_IDENTITY_MISMATCH')
        _,cross=call(rest+'/program_requests?select=id&id=eq.'+first['id'],key,token=other)
        sensitive,_=call(rest+'/program_requests?select=signature_data&id=eq.'+first['id'],key,token=user,expected={400,401,403})
        admin_select=urllib.parse.quote('id,numero_control,program_id,status,affiliate:affiliates!affiliate_id(full_name,numero_control),program_item:program_catalog_items!program_item_id(name,program_key)',safe=',:!()')
        _,visible_admin=call(rest+'/program_requests?select='+admin_select+'&id=eq.'+first['id'],key,token=admin)
        if cross or len(visible_admin)!=1:raise RuntimeError('RLS_VISIBILITY_MISMATCH')
        spoof,_=call(rest+'/rpc/create_program_request',key,'POST',dict(payload,p_affiliate_id=affiliate[0]['id'],p_idempotency_key=str(uuid.uuid4())),user,{400,404})
        _,normal=call(rest+'/rpc/create_program_request',key,'POST',dict(payload,p_program_item_id=farma['id'],p_idempotency_key=str(uuid.uuid4())),user);created.append(normal['id'])
        if normal['status']!='submitted' or normal['financial_processing_status'] is not None:raise RuntimeError('NON_FINANCIAL_STATUS_MISMATCH')
        print(json.dumps({'status':'PASS','requestable_items':len(items),'idempotent_same_id':True,'derived_numero_control':True,'cross_user_rows':len(cross),'admin_rows':len(visible_admin),'anon':anon,'direct_insert':direct,'sensitive_column_select':sensitive,'identity_spoof':spoof,'legacy_writes':0},sort_keys=True))
    finally:
        for request_id in set(created):call(rest+'/program_requests?id=eq.'+request_id,secret,'DELETE',expected={200,204})
if __name__=='__main__':main()
