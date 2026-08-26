#!/usr/bin/env python3
"""Read-only live RLS matrix for completion queue resources."""
import importlib.util,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('master',ROOT/'scripts/test-master-assets-live.py');master=importlib.util.module_from_spec(spec);spec.loader.exec_module(master)
def main():
    env=master.read_env();base=env['SUPABASE_URL'].rstrip('/');rest=base+'/rest/v1';key=env['SUPABASE_PUBLISHABLE_KEY']
    admin=master.login(base,key,env['H005_TEST_EMAIL'],env['H005_TEST_PASSWORD']);user=master.login(base,key,env['H005_TEST2_EMAIL'],env['H005_TEST2_PASSWORD']);other=master.login(base,key,env['H005_TEST3_EMAIL'],env['H005_TEST3_PASSWORD'])
    anon,_,_=master.call(rest+'/document_types?select=id&limit=1',key,expected={401,403})
    _,types,_=master.call(rest+'/document_types?select=id,code,label&order=sort_order',key,token=user)
    own_id=env['H005_TEST2_AFFILIATE_ID'];other_id=env['H005_TEST3_AFFILIATE_ID']
    _,own_docs,_=master.call(rest+'/affiliate_documents?select=id,affiliate_id,status&affiliate_id=eq.'+own_id,key,token=user)
    _,cross_docs,_=master.call(rest+'/affiliate_documents?select=id&affiliate_id=eq.'+other_id,key,token=user)
    _,admin_docs,_=master.call(rest+'/affiliate_documents?select=id&limit=1',key,token=admin)
    _,other_own_docs,_=master.call(rest+'/affiliate_documents?select=id&affiliate_id=eq.'+other_id,key,token=other)
    _,user_bank,_=master.call(rest+'/affiliate_bank_accounts?select=id,affiliate_id',key,token=user)
    _,other_bank,_=master.call(rest+'/affiliate_bank_accounts?select=id,affiliate_id',key,token=other)
    _,admin_bank,_=master.call(rest+'/affiliate_bank_accounts?select=id,affiliate_id',key,token=admin)
    _,settings,_=master.call(rest+'/credential_qr_settings?select=destination_path,ttl_seconds',key,token=user)
    hidden,_,_=master.call(rest+'/credential_qr_tokens?select=id&limit=1',key,token=user,expected={401,403})
    bank_isolated=all(row['affiliate_id']==own_id for row in user_bank) and all(row['affiliate_id']==other_id for row in other_bank)
    if len(types)!=12 or cross_docs or not admin_docs or len(settings)!=1 or not bank_isolated or len(admin_bank)!=504:raise RuntimeError('READ_ONLY_RLS_MATRIX_FAILED')
    print(json.dumps({'status':'PASS','read_only':True,'document_types':len(types),'user_a_documents':len(own_docs),'user_b_documents':len(other_own_docs),'cross_documents':0,'admin_documents_authorized':True,'anonymous_denied':anon,'bank_rows_a':len(user_bank),'bank_rows_b':len(other_bank),'bank_rows_admin_with_specific_capability':len(admin_bank),'bank_cross_user_rows':0,'qr_settings_rows':len(settings),'qr_token_table_hidden':hidden,'writes':0,'fixtures':0},sort_keys=True))
if __name__=='__main__':main()
