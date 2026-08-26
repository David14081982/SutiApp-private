#!/usr/bin/env python3
"""Reversible multi-user Phase 3 RLS/CRUD/request verification."""
import json,urllib.error,urllib.parse,urllib.request,uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def env():
    out={}
    for raw in (ROOT/'supabase.env').read_text(encoding='utf-8-sig').splitlines():
        if raw.strip() and not raw.lstrip().startswith('#') and '=' in raw:
            k,v=raw.split('=',1);out[k.strip()]=v.strip().strip('"').strip("'")
    return out
def call(url,key,method='GET',body=None,token=None,prefer=None,expected=None):
    h={'apikey':key,'Accept':'application/json','User-Agent':'SutiApp-Phase3-Test/1.0'}
    if token:h['Authorization']='Bearer '+token
    if body is not None:h['Content-Type']='application/json';body=json.dumps(body).encode()
    if prefer:h['Prefer']=prefer
    try:
        with urllib.request.urlopen(urllib.request.Request(url,data=body,headers=h,method=method),timeout=60) as r:
            raw=r.read();return r.status,(json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        if expected and e.code in expected:return e.code,None
        raise RuntimeError(f'unexpected Phase 3 HTTP {e.code}: '+e.read(300).decode('utf-8','replace')) from None
def login(base,key,email,password):
    _,data=call(base+'/auth/v1/token?grant_type=password',key,'POST',{'email':email,'password':password});return data['access_token']
def main():
    v=env();base=v['SUPABASE_URL'].rstrip('/');key=v['SUPABASE_PUBLISHABLE_KEY'];secret=v['SUPABASE_SECRET_KEY'];rest=base+'/rest/v1';admin=login(base,key,v['H005_TEST_EMAIL'],v['H005_TEST_PASSWORD']);u2=login(base,key,v['H005_TEST2_EMAIL'],v['H005_TEST2_PASSWORD']);u3=login(base,key,v['H005_TEST3_EMAIL'],v['H005_TEST3_PASSWORD']);_,u2_user=call(base+'/auth/v1/user',key,token=u2);_,u3_user=call(base+'/auth/v1/user',key,token=u3);_,u2_affiliates=call(rest+'/affiliates?select=id',key,token=u2);u2_affiliate_id=u2_affiliates[0]['id'];marker='P3_'+uuid.uuid4().hex[:8];created=[]
    try:
        _,companies=call(rest+'/companies?select=id&enabled=eq.true&limit=2',key,token=admin)
        if len(companies)<2:raise RuntimeError('two companies required for tenant isolation test')
        company_id,other_company_id=companies[0]['id'],companies[1]['id']
        _,membership=call(rest+'/marketplace_company_memberships',secret,'POST',{'auth_user_id':u3_user['id'],'company_id':company_id,'role':'editor','enabled':True},secret,'return=representation');membership_id=membership[0]['id'];created.append(('marketplace_company_memberships',membership_id))
        slug=marker.lower().replace('_','-');_,cat=call(rest+'/marketplace_categories',key,'POST',{'name':marker,'slug':slug,'enabled':True,'sort_order':9999,'record_origin':'ADMIN_PHASE3'},admin,'return=representation');cat_id=cat[0]['id'];created.append(('marketplace_categories',cat_id))
        denied,_=call(rest+'/marketplace_categories',key,'POST',{'name':marker+'X','slug':slug+'x','sort_order':9998},u2,expected={401,403});
        if denied not in {401,403}:raise RuntimeError('normal category write not denied')
        _,fixed=call(rest+'/marketplace_products',key,'POST',{'company_id':company_id,'category_id':cat_id,'name':marker+' fixed','price':125.5,'requires_quote':False,'enabled':True,'sort_order':1},admin,'return=representation');fixed_id=fixed[0]['id'];created.append(('marketplace_products',fixed_id))
        _,quotable=call(rest+'/marketplace_products',key,'POST',{'company_id':company_id,'category_id':cat_id,'name':marker+' quote','requires_quote':True,'enabled':True,'sort_order':2},admin,'return=representation');quote_product_id=quotable[0]['id'];created.append(('marketplace_products',quote_product_id))
        _,tenant_product=call(rest+'/marketplace_products',key,'POST',{'company_id':company_id,'category_id':cat_id,'name':marker+' tenant','price':25,'requires_quote':False,'enabled':True,'sort_order':3},u3,'return=representation');tenant_product_id=tenant_product[0]['id'];created.append(('marketplace_products',tenant_product_id))
        tenant_denied,_=call(rest+'/marketplace_products',key,'POST',{'company_id':other_company_id,'category_id':cat_id,'name':marker+' cross tenant','price':25,'requires_quote':False,'enabled':True,'sort_order':4},u3,expected={401,403})
        if tenant_denied not in {401,403}:raise RuntimeError('cross-company product write not denied')
        _,promotion=call(rest+'/marketplace_promotions',key,'POST',{'company_id':company_id,'product_id':tenant_product_id,'title':marker+' promotion','description':'reversible','approval_status':'pending','enabled':True,'sort_order':9999},u3,'return=representation');promotion_id=promotion[0]['id'];created.append(('marketplace_promotions',promotion_id))
        promotion_denied,_=call(rest+'/marketplace_promotions',key,'POST',{'company_id':other_company_id,'title':marker+' cross promotion','description':'reversible','approval_status':'pending','enabled':True,'sort_order':9999},u3,expected={401,403})
        if promotion_denied not in {401,403}:raise RuntimeError('cross-company promotion write not denied')
        _,visible=call(rest+'/marketplace_products?select=id&category_id=eq.'+cat_id,key,token=u2)
        if len(visible or [])!=3:raise RuntimeError('public product read failed')
        direct_quote,_=call(rest+'/marketplace_quote_requests',key,'POST',{'actor_real_auth_user_id':u2_user['id'],'affiliate_id':u2_affiliate_id,'product_id':quote_product_id,'company_id':company_id,'message':marker,'signature_data':'test-signature','terms_accepted':True,'status':'quoted','quoted_amount':1,'quoted_by_auth_user_id':u2_user['id'],'quoted_at':'2026-08-21T00:00:00Z'},u2,expected={401,403})
        if direct_quote not in {401,403}:raise RuntimeError('direct quote insert not denied')
        invalid_terms,_=call(rest+'/rpc/create_marketplace_quote',key,'POST',{'p_product_id':quote_product_id,'p_message':marker,'p_signature_data':'','p_terms_accepted':False},u2,expected={400})
        if invalid_terms!=400:raise RuntimeError('backend signature/terms validation missing')
        call(rest+'/marketplace_favorites',key,'POST',{'auth_user_id':u2_user['id'],'product_id':fixed_id},u2,'return=minimal');created.append(('marketplace_favorites',fixed_id))
        _,cross=call(rest+'/marketplace_favorites?select=product_id&product_id=eq.'+fixed_id,key,token=u3)
        if cross:raise RuntimeError('favorite leaked cross-user')
        _,req=call(rest+'/rpc/create_marketplace_benefit_request',key,'POST',{'p_product_id':fixed_id,'p_quantity':2,'p_message':marker,'p_signature_data':'test-signature','p_terms_accepted':True},u2);request_id=req['id'];created.append(('marketplace_benefit_requests',request_id))
        _,cross_req=call(rest+'/marketplace_benefit_requests?select=id&id=eq.'+request_id,key,token=u3)
        if len(cross_req or [])!=1:raise RuntimeError('company member cannot read incoming request')
        _,quote=call(rest+'/rpc/create_marketplace_quote',key,'POST',{'p_product_id':quote_product_id,'p_message':marker,'p_signature_data':'test-signature','p_terms_accepted':True},u2);quote_id=quote['id'];created.append(('marketplace_quote_requests',quote_id))
        _,cross_quote=call(rest+'/marketplace_quote_requests?select=id&id=eq.'+quote_id,key,token=u3)
        if len(cross_quote or [])!=1:raise RuntimeError('company member cannot read incoming quote')
        _,responded=call(rest+'/rpc/respond_marketplace_quote',key,'POST',{'p_quote_id':quote_id,'p_amount':456.78,'p_note':'reversible','p_valid_until':None},u3)
        if responded['status']!='quoted':raise RuntimeError('company quote response failed')
        direct_update,_=call(rest+'/marketplace_quote_requests?id=eq.'+quote_id,key,'PATCH',{'status':'cancelled'},u3,expected={401,403})
        if direct_update not in {401,403}:raise RuntimeError('direct quote update not denied')
        call(rest+'/rpc/mark_marketplace_quote_seen',key,'POST',{'p_quote_id':quote_id},u2)
        _,seen=call(rest+'/marketplace_quote_requests?select=seen_at&id=eq.'+quote_id,key,token=u2)
        if not seen or not seen[0]['seen_at']:raise RuntimeError('affiliate seen RPC failed')
    finally:
        for table,identity in reversed(created):call(rest+f'/{table}?'+('product_id' if table=='marketplace_favorites' else 'id')+'=eq.'+identity,secret,'DELETE',token=secret,prefer='return=minimal')
    print(json.dumps({'status':'PASS','admin_crud':True,'company_tenant_crud':True,'company_inbox_visibility':True,'cross_company_write_denied':True,'direct_request_mutation_denied':True,'signature_terms_backend':True,'normal_write_denied':True,'multiuser_isolation':True,'favorite':True,'benefit_request':True,'quote_roundtrip':True,'seen_rpc':True,'cleanup':True},sort_keys=True))
if __name__=='__main__':main()
