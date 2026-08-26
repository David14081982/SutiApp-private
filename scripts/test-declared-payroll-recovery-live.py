"""Exercise declared-payroll recovery DDL inside a rolled-back production transaction."""
from pathlib import Path
import json, urllib.parse, urllib.request
ROOT=Path(__file__).resolve().parents[1]
values={}
for raw in (ROOT/'supabase.env').read_text(encoding='utf-8-sig').splitlines():
    if raw.strip() and not raw.lstrip().startswith('#') and '=' in raw:
        key,value=raw.split('=',1);values[key.strip()]=value.strip().strip('"').strip("'")
ref=urllib.parse.urlsplit(values['SUPABASE_URL']).hostname.split('.')[0]
endpoint=f'https://api.supabase.com/v1/projects/{ref}/database/query'
headers={'Authorization':'Bearer '+values['SUPABASE_ACCESS_TOKEN'],'Content-Type':'application/json','User-Agent':'SutiApp-Declared-Payroll-Recovery/1.0'}
def query(sql):
    request=urllib.request.Request(endpoint,data=json.dumps({'query':sql}).encode(),headers=headers,method='POST')
    with urllib.request.urlopen(request,timeout=120) as response:return json.loads(response.read().decode())
count=query('select count(*)::int count from public.affiliate_payroll_declarations')[0]['count']
if count!=0: raise RuntimeError('RECOVERY_TEST_REQUIRES_EMPTY_DECLARATION_TABLE')
recovery=(ROOT/'supabase/recovery/20260824000100_create_declared_payroll_authority_recovery.sql').read_text(encoding='utf-8').strip()
if not recovery.lower().startswith('begin;') or not recovery.lower().endswith('commit;'): raise RuntimeError('RECOVERY_TRANSACTION_CONTRACT_INVALID')
rolled_back=recovery[:-len('commit;')]+'rollback;'
query(rolled_back)
verified=query("""select
  to_regclass('public.affiliate_payroll_declarations') is not null as declaration_table,
  to_regclass('public.affiliate_payroll_declaration_audit') is not null as audit_table,
  to_regprocedure('public.get_current_declared_payroll()') is not null as read_rpc,
  to_regprocedure('public.save_current_declared_payroll(numeric,numeric,integer)') is not null as write_rpc,
  to_regprocedure('public.get_current_declared_payroll_impact(numeric)') is not null as impact_rpc""")[0]
if not all(verified.values()): raise RuntimeError('RECOVERY_ROLLBACK_FAILED_'+json.dumps(verified))
print(json.dumps({'status':'PASS','recovery_ddl_executed':True,'transaction_rolled_back':True,**verified}))
