"""Scoped membership contract audit/test/apply. Never creates persistent test requests."""
import hashlib
import importlib.util
import json
import sys
import subprocess
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = Path('C:/tmp/sutiapp-membership-payment-20260910')
OUT = ROOT / 'docs/qa/evidence/membership-payment-contract-20260910'
VERSION = '20260910000100_membership_payment_contract.sql'
spec = importlib.util.spec_from_file_location('document_tools', ROOT / 'scripts/apply-document-requirements-platform.py')
db = importlib.util.module_from_spec(spec)
spec.loader.exec_module(db)
TABLES = ['affiliates','membership_offerings','program_requests','request_documents','program_request_admin_events',
          'operational_workflows','operational_workflow_stages','financial_rules','financial_funds','financial_programs',
          'program_catalog_items','marketplace_products','program_document_requirements']
INVENTORY = ' union all '.join("select '"+t+"' domain,count(*)::int count,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) hash from public."+t+' t' for t in TABLES)
FUNCTIONS = "select p.oid,p.proname name,pg_get_functiondef(p.oid) definition,p.proacl::text acl from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in ('create_membership_request','get_admin_finance_request_flow_detail','capture_financial_request_profile','enforce_personalized_financial_submission','transition_program_request_workflow','capture_program_request_workflow','get_effective_affiliate_id') order by name,p.oid"

def save(name, data, private=False):
    target = PRIVATE if private else OUT
    target.mkdir(parents=True, exist_ok=True)
    (target/name).write_text(json.dumps(data, indent=2)+'\n', encoding='utf8')

def main():
    mode = sys.argv[1] if len(sys.argv)>1 else 'audit'
    env = db.env()
    query = lambda sql: db.query(env, sql)
    if mode == 'audit':
        PRIVATE.mkdir(parents=True,exist_ok=True)
        paths = ['app/screens-membership-application.jsx','app/membership-repository.js','app/program-request-repository.js',
                 'app/bundle.js','SutiApp.html','sw.js','supabase/functions/financial-legacy/index.ts',
                 'supabase/functions/financial-legacy/request-google-sync.js','google-apps-script/financial-handoff/Code.gs']
        for name in paths:
            target=PRIVATE/'before'/name
            if not target.exists():
                target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes((ROOT/name).read_bytes())
        functions=query(FUNCTIONS)
        save('functions-before.json',functions,True)
        schema=query("select tgname,pg_get_triggerdef(oid) definition from pg_trigger where tgrelid='public.program_requests'::regclass and not tgisinternal order by tgname")
        save('triggers-before.json',schema,True)
        inventory=query(INVENTORY)
        save('inventory-before.json',inventory,True)
        categories=query("select financial_employee_category_code category,count(*)::int count from public.affiliates group by 1 order by 1")
        result={'status':'PASS','mode':mode,'inventory':inventory,'categories':categories,'functions':[{'name':r['name'],'oid':r['oid'],'sha256':hashlib.sha256(r['definition'].encode()).hexdigest()} for r in functions],'triggers':schema,'businessWrites':0}
        save('audit.json',result);print(json.dumps(result))
        return
    if mode=='inspect':
        definitions=query("select proname name,pg_get_functiondef(oid) definition from pg_proc where pronamespace='public'::regnamespace and proname in ('protect_financial_request_snapshots','capture_program_request_workflow_snapshot','enqueue_program_request_google_sync','get_admin_finance_request_flow_detail')")
        save('dependencies-before.json',definitions,True)
        print(json.dumps(definitions));return
    if mode=='periods':
        result=query("select financial_employee_category_code category,payment_period,count(*)::int rules from public.financial_rules where lifecycle_status in ('PUBLISHED','SCHEDULED') and enabled group by 1,2 order by 1,2")
        save('existing-category-periods.json',result);print(json.dumps(result));return
    if mode=='build':
        target=PRIVATE/'site'
        n=1
        while target.exists():
            n+=1;target=PRIVATE/('site'+str(n))
        build_env=dict(os.environ,SUTIAPP_SUPABASE_URL=env['SUPABASE_URL'],SUTIAPP_SUPABASE_PUBLISHABLE_KEY=env['SUPABASE_PUBLISHABLE_KEY'])
        subprocess.run(['node','scripts/build-pages-site.js',str(target)],cwd=ROOT,env=build_env,check=True)
        save('build.json',{'status':'PASS','directory':str(target)},True);return
    if mode in ('test','apply','verify'):
        migration=ROOT/'supabase/migrations'/VERSION
        recovery=ROOT/'supabase/recovery'/VERSION
        sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
        before=query(INVENTORY)
        previous=query(FUNCTIONS)
        if mode=='apply':
            tested=json.loads((OUT/'sql-test.json').read_text())
            assert tested['status']=='PASS' and tested['migrationSha256']==sha(migration)
            assert tested['recoverySha256']==sha(recovery)
            assert previous==json.loads((PRIVATE/'functions-before.json').read_text()),'PREEXISTING_FUNCTION_DRIFT'
            query(migration.read_text(encoding='utf8'))
            matrix=[]
        else:
            actor=query("select id from auth.users where email='"+env['H005_TEST_EMAIL'].replace("'","''")+"'")[0]['id']
            settings="select set_config('test.membership_actor','"+actor+"',true);"
            body=db.transaction_body(migration) if mode=='test' else ''
            tests=(ROOT/'scripts/test-membership-payment-contract.sql').read_text(encoding='utf8')
            matrix=query('begin;'+body+settings+tests+'rollback;')
            if mode=='test':
                restored=query('begin;'+body+db.transaction_body(recovery)+FUNCTIONS+';rollback;')
                assert restored==previous,'EXACT_RECOVERY_FAILED'
        after=query(INVENTORY)
        assert before==after,'BUSINESS_INVENTORY_CHANGED'
        current=query(FUNCTIONS)
        # The only additional overload is intentional. Existing OIDs/definitions/ACL remain exact.
        ids={r['oid'] for r in previous}
        assert [r for r in current if r['oid'] in ids]==previous,'EXISTING_FUNCTION_CHANGED'
        result={'status':'PASS','mode':mode,'matrix':matrix,'migrationSha256':sha(migration),
                'recoverySha256':sha(recovery),'inventoryBefore':before,'inventoryAfter':after,
                'existingFunctionsPreserved':True,'exactRecovery':mode=='test','persistentBusinessWrites':0}
        save('sql-'+mode+'.json',result)
        print(json.dumps({k:v for k,v in result.items() if not k.startswith('inventory')}));return
    raise SystemExit('MODE_NOT_IMPLEMENTED')

if __name__=='__main__':
    main()
