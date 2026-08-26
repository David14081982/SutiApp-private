#!/usr/bin/env python3
"""Reversible live RLS/reconciliation test for H-DATA-CUTOVER-001."""
import base64
import json
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

def env():
    out={}
    for raw in (ROOT/'supabase.env').read_text(encoding='utf-8-sig').splitlines():
        if raw.strip() and not raw.lstrip().startswith('#') and '=' in raw:
            key,value=raw.split('=',1);out[key.strip()]=value.strip().strip('"').strip("'")
    return out

def call(url,key,method='GET',payload=None,token=None,expected={200,201,204}):
    headers={'apikey':key,'Authorization':'Bearer '+(token or key),'Content-Type':'application/json'}
    body=None if payload is None else json.dumps(payload).encode()
    req=urllib.request.Request(url,data=body,headers=headers,method=method)
    try:
        with urllib.request.urlopen(req,timeout=60) as response:
            status=response.status;data=response.read()
    except urllib.error.HTTPError as error:
        status=error.code;data=error.read()
    if status not in expected:
        raise RuntimeError(f'HTTP_{status}:{data[:300]!r}')
    try:return status,json.loads(data) if data else None
    except json.JSONDecodeError:return status,data.decode(errors='replace')

def login(base,key,email,password):
    _,data=call(base+'/auth/v1/token?grant_type=password',key,'POST',{'email':email,'password':password})
    return data['access_token']

def subject(token):
    part=token.split('.')[1];part+='='*((4-len(part)%4)%4)
    return json.loads(base64.urlsafe_b64decode(part))['sub']

def main():
    values=env();base=values['SUPABASE_URL'];rest=base+'/rest/v1';key=values['SUPABASE_PUBLISHABLE_KEY'];secret=values['SUPABASE_SECRET_KEY']
    user_a=login(base,key,values['H005_TEST2_EMAIL'],values['H005_TEST2_PASSWORD'])
    user_b=login(base,key,values['H005_TEST3_EMAIL'],values['H005_TEST3_PASSWORD'])
    created=None;favorite_item=None
    try:
        anon_status,_=call(rest+'/program_catalog_items?select=id&limit=1',key,expected={401,403})
        _,rows=call(rest+'/program_catalog_items?select=id,program_key,name,quantity_raw,presentation_raw,price_cash,request_mode,source_sheet,source_row_ordinal,source_snapshot_hash&order=sort_order',key,token=user_a)
        if len(rows)!=134 or sum(row['program_key']=='farma' for row in rows)!=50:raise RuntimeError('CATALOG_COUNT_MISMATCH')
        if sum(row['price_cash'] is not None for row in rows)!=65:raise RuntimeError('CATALOG_PRICE_COUNT_MISMATCH')
        casa_price=next(row for row in rows if row['source_sheet']=='Suti Casa' and row['source_row_ordinal']==2)
        if float(casa_price['price_cash'])!=1600000 or casa_price['source_snapshot_hash']!='37FA2B489B0E33E56E833FD0854AF87FE542705BB739228E27DF7946ACC43D00':raise RuntimeError('CATALOG_PRICE_OR_SNAPSHOT_MISMATCH')
        restricted_status,_=call(rest+'/program_catalog_items?select=id,source_payload&limit=1',key,token=user_a,expected={400,401,403})
        write_status,_=call(rest+'/program_catalog_items',key,'POST',{'program_key':'farma','name':'NOPE'},user_a,{400,401,403})
        farma=next(row for row in rows if row['program_key']=='farma')
        favorite_item=farma['id']
        call(rest+'/program_catalog_favorites?on_conflict=auth_user_id,item_id',key,'POST',{'auth_user_id':subject(user_a),'item_id':favorite_item},user_a,{200,201})
        _,favorite_cross=call(rest+'/program_catalog_favorites?select=item_id&item_id=eq.'+favorite_item,key,token=user_b)
        if favorite_cross:raise RuntimeError('FAVORITE_CROSS_USER_VISIBLE')
        _,created=call(rest+'/rpc/create_program_benefit_request',key,'POST',{'p_item_id':farma['id'],'p_quantity':1,'p_message':'H-DATA-CUTOVER-001 reversible test','p_signature_data':'data:text/plain;base64,VEVTVA==','p_terms_accepted':True},user_a)
        created_id=created['id'] if isinstance(created,dict) else created[0]['id']
        _,mine=call(rest+'/program_benefit_requests?select=id,affiliate_id,actor_real_auth_user_id&id=eq.'+created_id,key,token=user_a)
        _,cross=call(rest+'/program_benefit_requests?select=id&id=eq.'+created_id,key,token=user_b)
        if len(mine)!=1 or cross:raise RuntimeError('REQUEST_RLS_MISMATCH')
        legacy=next(row for row in rows if row['request_mode']=='legacy_pending')
        legacy_status,_=call(rest+'/rpc/create_program_benefit_request',key,'POST',{'p_item_id':legacy['id'],'p_quantity':1,'p_message':'blocked','p_signature_data':'data:text/plain;base64,VEVTVA==','p_terms_accepted':True},user_a,{400})
        _,asset_rows=call(rest+'/private_assets?select=id,storage_bucket,storage_path&limit=500',key,token=user_a)
        if not asset_rows:raise RuntimeError('LINKED_PRIVATE_ASSETS_NOT_READABLE')
        link_select='item_id,private_asset:private_assets!private_asset_id(id,storage_bucket,storage_path)'
        _,asset_links=call(rest+'/program_catalog_item_assets?select='+urllib.parse.quote(link_select,safe=',:!()')+'&limit=500',key,token=user_a)
        private_link=next(row['private_asset'] for row in asset_links if row.get('private_asset'))
        _,signed=call(base+'/storage/v1/object/sign/'+private_link['storage_bucket']+'/'+private_link['storage_path'],key,'POST',{'expiresIn':300},user_a)
        if not (signed.get('signedURL') or signed.get('signedUrl')):raise RuntimeError('PROGRAM_ASSET_SIGN_FAILED')
        batch_paths=list(dict.fromkeys(row['private_asset']['storage_path'] for row in asset_links if row.get('private_asset') and row['private_asset']['storage_bucket']==private_link['storage_bucket']))[:2]
        _,signed_batch=call(base+'/storage/v1/object/sign/'+private_link['storage_bucket'],key,'POST',{'expiresIn':300,'paths':batch_paths},user_a)
        if len(signed_batch)!=len(batch_paths) or not all(row.get('signedURL') or row.get('signedUrl') for row in signed_batch):raise RuntimeError('PROGRAM_ASSET_BATCH_SIGN_FAILED')
        _,sources=call(rest+'/historical_asset_sources?select=id&source_sheet=eq.'+urllib.parse.quote('8 Suti Farma'),key,token=user_a)
        if sources:raise RuntimeError('PROVENANCE_EXPOSED')
        print(json.dumps({'status':'PASS','items':len(rows),'farma':sum(row['program_key']=='farma' for row in rows),'catalog_prices':sum(row['price_cash'] is not None for row in rows),'asset_links':len(asset_links),'signed_asset':True,'signed_asset_batch':len(signed_batch),'linked_private_assets_visible':len(asset_rows),'anon':anon_status,'restricted_column':restricted_status,'direct_write':write_status,'cross_user_rows':len(cross),'cross_user_favorites':len(favorite_cross),'legacy_request':legacy_status},sort_keys=True))
    finally:
        if created:
            created_id=created['id'] if isinstance(created,dict) else created[0]['id']
            call(rest+'/program_benefit_requests?id=eq.'+created_id,secret,'DELETE',expected={200,204})
        if favorite_item:
            call(rest+'/program_catalog_favorites?item_id=eq.'+favorite_item,secret,'DELETE',expected={200,204})

if __name__=='__main__':main()
