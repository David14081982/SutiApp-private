"""Apply and reconcile the owner-approved visibility permission/audit migration."""
import json, pathlib, urllib.parse, urllib.request

ROOT=pathlib.Path(__file__).resolve().parents[1]
MIGRATION=ROOT/'supabase/migrations/20260824000230_financial_criteria_visibility_admin.sql'
RECOVERY=ROOT/'supabase/recovery/20260824000230_financial_criteria_visibility_admin_recovery.sql'

def env():
    values={}
    for line in (ROOT/'supabase.env').read_text(encoding='utf-8').splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            key,value=line.split('=',1);values[key.strip()]=value.strip().strip('"').strip("'")
    return values

def query(values,sql):
    ref=urllib.parse.urlsplit(values['SUPABASE_URL']).hostname.split('.')[0]
    request=urllib.request.Request(f'https://api.supabase.com/v1/projects/{ref}/database/query',
        data=json.dumps({'query':sql}).encode(),headers={'Authorization':'Bearer '+values['SUPABASE_ACCESS_TOKEN'],'Content-Type':'application/json','User-Agent':'SutiApp-FinancialVisibility/1.0'},method='POST')
    with urllib.request.urlopen(request,timeout=45) as response:return json.loads(response.read())

def body(path):
    text=path.read_text(encoding='utf-8').strip()
    if text.lower().startswith('begin;'):text=text[6:]
    if text.lower().endswith('commit;'):text=text[:-7]
    return text

def checks():
    return """
select
  to_regclass('public.financial_criteria_visibility_audit') is not null as audit_table,
  (select relrowsecurity and relforcerowsecurity from pg_class where oid='public.financial_criteria_visibility_audit'::regclass) as rls_forced,
  public.has_admin_permission('financial_criteria.visibility.read') as current_read,
  public.has_admin_permission('financial_criteria.visibility.write') as current_write,
  (select count(*) from public.admin_role_permissions rp join public.admin_roles r on r.id=rp.role_id where r.code='principal_admin' and rp.permission in('financial_criteria.visibility.read','financial_criteria.visibility.write')) as principal_permissions,
  (select count(*) from public.financial_criteria_visibility_audit) as audit_rows;
"""

if __name__=='__main__':
    values=env();exists=query(values,"select to_regclass('public.financial_criteria_visibility_audit') is not null as applied;")[0]['applied']
    if not exists:query(values,MIGRATION.read_text(encoding='utf-8'))
    result=query(values,checks())[0]
    if not result['audit_table'] or not result['rls_forced'] or int(result['principal_permissions'])!=2:
        raise RuntimeError('VISIBILITY_MIGRATION_RECONCILIATION_FAILED')
    query(values,'begin;'+body(RECOVERY)+'\nrollback;')
    print(json.dumps({'status':'PASS','migration_applied':not exists,'recovery_compiled':True,**result},sort_keys=True))
