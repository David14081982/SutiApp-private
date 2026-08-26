"""Apply the exact criterion-identity audit constraint correction."""
import json, pathlib, urllib.parse, urllib.request

ROOT=pathlib.Path(__file__).resolve().parents[1]
MIGRATION=ROOT/'supabase/migrations/20260824000231_fix_financial_criteria_identity_constraint.sql'
RECOVERY=ROOT/'supabase/recovery/20260824000231_fix_financial_criteria_identity_constraint_recovery.sql'

def env():
    values={}
    for line in (ROOT/'supabase.env').read_text(encoding='utf-8').splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            key,value=line.split('=',1);values[key.strip()]=value.strip().strip('"').strip("'")
    return values

def query(values,sql):
    ref=urllib.parse.urlsplit(values['SUPABASE_URL']).hostname.split('.')[0]
    request=urllib.request.Request(f'https://api.supabase.com/v1/projects/{ref}/database/query',data=json.dumps({'query':sql}).encode(),
        headers={'Authorization':'Bearer '+values['SUPABASE_ACCESS_TOKEN'],'Content-Type':'application/json','User-Agent':'SutiApp-FinancialVisibilityIdentityFix/1.0'},method='POST')
    with urllib.request.urlopen(request,timeout=45) as response:return json.loads(response.read())

def body(path):
    text=path.read_text(encoding='utf-8').strip()
    if text.lower().startswith('begin;'):text=text[6:]
    if text.lower().endswith('commit;'):text=text[:-7]
    return text

if __name__=='__main__':
    values=env()
    before=query(values,"select pg_get_constraintdef(oid) definition,(select count(*) from public.financial_criteria_visibility_audit) rows from pg_constraint where conrelid='public.financial_criteria_visibility_audit'::regclass and conname='financial_criteria_visibility_audit_criterion_identity_check';")[0]
    expected="criterion_identity ~ '^CRITERIA_V1:[0-9]+:[A-F0-9]{64}$'::text"
    applied=expected not in before['definition']
    if applied:query(values,MIGRATION.read_text(encoding='utf-8'))
    after=query(values,"select pg_get_constraintdef(oid) definition,(select count(*) from public.financial_criteria_visibility_audit) rows from pg_constraint where conrelid='public.financial_criteria_visibility_audit'::regclass and conname='financial_criteria_visibility_audit_criterion_identity_check';")[0]
    if expected not in after['definition']:raise RuntimeError('IDENTITY_CONSTRAINT_NOT_RECONCILED')
    query(values,'begin;'+body(RECOVERY)+'\nrollback;')
    print(json.dumps({'status':'PASS','migration_applied':applied,'rows_before':before['rows'],'rows_after':after['rows'],'recovery_compiled':True,'constraint':'CRITERIA_V1_ROW_SHA256'},sort_keys=True))
