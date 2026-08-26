#!/usr/bin/env python3
"""Controlled CRUD, audit and RLS matrix for private banking accounts."""
import importlib.util,json,urllib.error,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('master',ROOT/'scripts/test-master-assets-live.py');master=importlib.util.module_from_spec(spec);spec.loader.exec_module(master)
def raw(url,key,method='GET',body=None,token=None,expected=None):
    headers={'apikey':key,'Accept':'application/json','Content-Type':'application/json'}
    if token:headers['Authorization']='Bearer '+token
    request=urllib.request.Request(url,data=json.dumps(body).encode() if body is not None else None,headers=headers,method=method)
    try:
        with urllib.request.urlopen(request,timeout=90) as response:
            data=response.read();return response.status,json.loads(data) if data else None
    except urllib.error.HTTPError as error:
        if expected and error.code in expected:return error.code,None
        raise RuntimeError(f'HTTP {error.code}:'+error.read().decode('utf-8','replace')[:500])
def main():
    e=master.read_env();base=e['SUPABASE_URL'].rstrip('/');rest=base+'/rest/v1';key=e['SUPABASE_PUBLISHABLE_KEY']
    admin=master.login(base,key,e['H005_TEST_EMAIL'],e['H005_TEST_PASSWORD']);a=master.login(base,key,e['H005_TEST2_EMAIL'],e['H005_TEST2_PASSWORD']);b=master.login(base,key,e['H005_TEST3_EMAIL'],e['H005_TEST3_PASSWORD'])
    aggregate=master.management_sql(e,"""select json_build_object('total',count(*),'historical',count(*) filter(where source_kind='HISTORICAL_SEED'),'incomplete',count(*) filter(where data_status='INCOMPLETE_HISTORICAL_DATA'),'bad_provenance',count(*) filter(where source_kind='HISTORICAL_SEED' and (source_file_hash is null or source_row_ordinal is null or seeded_at is null)),'reconstructed_holder',count(*) filter(where source_kind='HISTORICAL_SEED' and account_holder is not null)) result from public.affiliate_bank_accounts""")[0]['result']
    if aggregate!={'total':504,'historical':504,'incomplete':504,'bad_provenance':0,'reconstructed_holder':0}:raise RuntimeError('SEED_RECONCILIATION_FAILED:'+json.dumps(aggregate))
    anon,_=raw(rest+'/affiliate_bank_accounts?select=id&limit=1',key,expected={401,403})
    invalid,_=raw(rest+'/rpc/save_affiliate_bank_account',key,'POST',{'p_id':None,'p_holder':'Persona Prueba','p_bank':'Banco Prueba','p_clabe':'1e17','p_account':'12345678','p_primary':False},a,{400})
    ids=[]
    try:
        for account in ('987654321001','987654321002'):
            _,row=raw(rest+'/rpc/save_affiliate_bank_account',key,'POST',{'p_id':None,'p_holder':'Persona Prueba','p_bank':'Banco Prueba','p_clabe':None,'p_account':account,'p_primary':False},a);ids.append(row['id'])
        _,own=raw(rest+'/affiliate_bank_accounts?select=id,affiliate_id&affiliate_id=eq.'+e['H005_TEST2_AFFILIATE_ID'],key,token=a)
        _,cross=raw(rest+'/affiliate_bank_accounts?select=id&id=eq.'+ids[0],key,token=b)
        denied,_=raw(rest+'/rpc/delete_affiliate_bank_account',key,'POST',{'p_id':ids[0]},b,{400})
        _,primary=raw(rest+'/rpc/set_primary_affiliate_bank_account',key,'POST',{'p_id':ids[0]},a)
        _,updated=raw(rest+'/rpc/save_affiliate_bank_account',key,'POST',{'p_id':ids[0],'p_holder':'Persona Prueba','p_bank':'Banco Editado','p_clabe':None,'p_account':'987654321003','p_primary':False},a)
        _,admin_rows=raw(rest+'/affiliate_bank_accounts?select=id&id=eq.'+ids[0],key,token=admin)
        if len(own)<2 or cross or denied!=400 or not primary['is_primary'] or updated['bank_name']!='Banco Editado' or len(admin_rows)!=1 or anon not in(401,403) or invalid!=400:raise RuntimeError('BANKING_RLS_OR_CRUD_FAILED')
    finally:
        for account_id in ids:
            raw(rest+'/rpc/delete_affiliate_bank_account',key,'POST',{'p_id':account_id},a,{400})
    quoted=','.join("'"+x+"'" for x in ids)
    audit=master.management_sql(e,f"select action,metadata from public.sensitive_change_audit where target_id in ({quoted}) order by created_at")
    actions={r['action'] for r in audit};required={'BANK_ACCOUNT_CREATED','BANK_ACCOUNT_UPDATED','BANK_ACCOUNT_DELETED','BANK_ACCOUNT_SET_PRIMARY'}
    if not required.issubset(actions) or any('987654' in json.dumps(r['metadata'] or {}) for r in audit):raise RuntimeError('BANKING_AUDIT_FAILED:'+json.dumps(sorted(actions)))
    final=master.management_sql(e,"select count(*)::int total from public.affiliate_bank_accounts")[0]['total']
    if final!=504:raise RuntimeError('FIXTURE_CLEANUP_FAILED')
    print(json.dumps({'status':'PASS','seed_records':504,'user_self_management':True,'multiple_accounts':True,'anonymous_denied':True,'cross_user_isolation':True,'admin_specific_capability':True,'scientific_notation_denied':True,'audit_actions':sorted(actions),'fixture_cleanup':True},sort_keys=True))
if __name__=='__main__':main()
