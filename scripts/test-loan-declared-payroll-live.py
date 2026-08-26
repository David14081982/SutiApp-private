"""Live owner/cross-user/anonymous verification with exact declaration restoration."""
from pathlib import Path
import json, urllib.error, urllib.parse, urllib.request
ROOT=Path(__file__).resolve().parents[1]

def env():
    out={}
    for raw in (ROOT/'supabase.env').read_text(encoding='utf-8-sig').splitlines():
        if raw.strip() and not raw.lstrip().startswith('#') and '=' in raw:
            key,value=raw.split('=',1);out[key.strip()]=value.strip().strip('"').strip("'")
    return out

def request(url,method='GET',headers=None,payload=None):
    data=None if payload is None else json.dumps(payload).encode()
    req=urllib.request.Request(url,data=data,headers=headers or {},method=method)
    try:
        with urllib.request.urlopen(req,timeout=60) as response:
            raw=response.read().decode();return response.status,json.loads(raw) if raw else None
    except urllib.error.HTTPError as error:
        raw=error.read().decode()
        try: body=json.loads(raw) if raw else None
        except json.JSONDecodeError: body={'error':'NON_JSON_RESPONSE'}
        return error.code,body

def management(values,sql):
    ref=urllib.parse.urlsplit(values['SUPABASE_URL']).hostname.split('.')[0]
    status,data=request(f'https://api.supabase.com/v1/projects/{ref}/database/query','POST',{
        'Authorization':'Bearer '+values['SUPABASE_ACCESS_TOKEN'],'Content-Type':'application/json','User-Agent':'SutiApp-Declared-Payroll-Live/1.0'
    },{'query':sql})
    if status!=201 and status!=200: raise RuntimeError('MANAGEMENT_QUERY_FAILED_'+str(status)+'_'+str(data))
    return data

def login(values,email,password):
    api_key=values.get('SUPABASE_ANON_KEY') or values['SUPABASE_PUBLISHABLE_KEY']
    status,data=request(values['SUPABASE_URL']+'/auth/v1/token?grant_type=password','POST',{
        'apikey':api_key,'Content-Type':'application/json'
    },{'email':email,'password':password})
    if status!=200: raise RuntimeError('LOGIN_FAILED')
    return data['access_token']

def rpc(values,token,name,payload=None):
    api_key=values.get('SUPABASE_ANON_KEY') or values['SUPABASE_PUBLISHABLE_KEY']
    return request(values['SUPABASE_URL']+'/rest/v1/rpc/'+name,'POST',{
        'apikey':api_key,'Authorization':'Bearer '+token,'Content-Type':'application/json'
    },payload or {})

def sql_literal(value):
    if value is None:return 'null'
    if isinstance(value,(int,float)):return str(value)
    return "'"+str(value).replace("'","''")+"'"

def main():
    values=env(); email=values['H005_TEST2_EMAIL'].replace("'","''")
    rows=management(values,f"""select d.* from auth.users u join public.affiliates a on a.auth_user_id=u.id
      left join public.affiliate_payroll_declarations d on d.affiliate_id=a.id where lower(u.email)=lower('{email}')""")
    if not rows: raise RuntimeError('TEST_AFFILIATE_NOT_FOUND')
    original=rows[0] if rows[0].get('affiliate_id') else None
    affiliate=management(values,f"select a.id from auth.users u join public.affiliates a on a.auth_user_id=u.id where lower(u.email)=lower('{email}')")[0]['id']
    try:
        admin=login(values,values['H005_TEST_EMAIL'],values['H005_TEST_PASSWORD'])
        owner=login(values,values['H005_TEST2_EMAIL'],values['H005_TEST2_PASSWORD'])
        other=login(values,values['H005_TEST3_EMAIL'],values['H005_TEST3_PASSWORD'])
        started=False
        try:
            start_status,_=rpc(values,admin,'start_affiliate_impersonation',{'p_affiliate_id':affiliate,'p_reason':'QA payroll declaration denial'})
            if start_status!=200: raise RuntimeError('IMPERSONATION_START_FAILED')
            started=True
            denied_status,denied=rpc(values,admin,'save_current_declared_payroll',{
              'p_gross_pay_per_fortnight':10903,'p_deductions_per_fortnight':5051,'p_expected_version':0})
            if denied_status<400 or 'PAYROLL_DECLARATION_IMPERSONATION_DENIED' not in str(denied): raise RuntimeError('IMPERSONATED_WRITE_NOT_DENIED')
        finally:
            if started:
                stop_status,_=rpc(values,admin,'stop_affiliate_impersonation')
                if stop_status!=200: raise RuntimeError('IMPERSONATION_STOP_FAILED')
        status,current=rpc(values,owner,'get_current_declared_payroll')
        if status!=200: raise RuntimeError('OWNER_READ_FAILED')
        expected=current.get('version',0) if current.get('status')=='READY' else 0
        status,saved=rpc(values,owner,'save_current_declared_payroll',{
          'p_gross_pay_per_fortnight':10903,'p_deductions_per_fortnight':5051,'p_expected_version':expected})
        if status!=200 or saved.get('status')!='READY' or saved.get('netPayPerFortnight')!=5852: raise RuntimeError('OWNER_SAVE_FAILED')
        status,impact=rpc(values,owner,'get_current_declared_payroll_impact',{'p_payment_per_period':1048})
        if status!=200 or impact.get('remainingNetPay')!=4804 or impact.get('guidelinePercent')!=30 or impact.get('withinGuideline') is not True: raise RuntimeError('IMPACT_FAILED')
        other_status,other_data=rpc(values,other,'get_current_declared_payroll')
        if other_status!=200 or (other_data.get('status')=='READY' and other_data.get('netPayPerFortnight')==5852): raise RuntimeError('CROSS_USER_READ_LEAK')
        api_key=values.get('SUPABASE_ANON_KEY') or values['SUPABASE_PUBLISHABLE_KEY']
        anon_status,_=request(values['SUPABASE_URL']+'/rest/v1/rpc/get_current_declared_payroll','POST',{'apikey':api_key,'Content-Type':'application/json'}, {})
        table_status,_=request(values['SUPABASE_URL']+'/rest/v1/affiliate_payroll_declarations?select=*','GET',{'apikey':api_key,'Authorization':'Bearer '+owner})
        if anon_status<400 or table_status<400: raise RuntimeError('BACKEND_DENIAL_FAILED')
        print(json.dumps({'status':'PASS','owner_read':True,'owner_write':True,'server_impact':True,'cross_user_isolated':True,'anonymous_denied':True,'direct_table_denied':True,'impersonated_write_denied':True,'guideline_informational':30}))
    finally:
        if original:
            management(values,"""update public.affiliate_payroll_declarations set
              gross_pay_per_fortnight={gross},deductions_per_fortnight={deductions},payment_period={period},version={version},
              created_at={created},updated_at={updated},updated_by_auth_user_id={actor}
              where affiliate_id={affiliate}""".format(
                gross=sql_literal(original['gross_pay_per_fortnight']),deductions=sql_literal(original['deductions_per_fortnight']),
                period=sql_literal(original['payment_period']),version=sql_literal(original['version']),created=sql_literal(original['created_at']),
                updated=sql_literal(original['updated_at']),actor=sql_literal(original['updated_by_auth_user_id']),affiliate=sql_literal(affiliate)))
        else:
            management(values,'delete from public.affiliate_payroll_declarations where affiliate_id='+sql_literal(affiliate))

if __name__=='__main__': main()
