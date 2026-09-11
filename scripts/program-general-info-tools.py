"""Scoped metadata audit, SQL verification and release support. Secrets stay private."""
import hashlib, importlib.util, json, pathlib, subprocess, sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
PRIVATE=pathlib.Path('C:/tmp/sutiapp-program-general-info-20260910')
OUT=ROOT/'docs/qa/evidence/program-general-info-20260910'
VERSION='20260910000200_program_general_info.sql'
spec=importlib.util.spec_from_file_location('db',ROOT/'scripts/apply-document-requirements-platform.py')
db=importlib.util.module_from_spec(spec);spec.loader.exec_module(db)
def query(sql):return db.query(db.env(),sql)
def save(name,data,private=False):
    p=PRIVATE if private else OUT;p.mkdir(parents=True,exist_ok=True)
    (p/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
def inventory():return query("select program_key,count(*)::int count,md5(string_agg(to_jsonb(t)::text,'' order by id)) hash from public.program_catalog_items t group by program_key order by program_key")
def main():
    mode=sys.argv[1]
    if mode=='audit':
        rows=query('select * from public.finance_catalog_presentation order by item_key')
        save('presentation-before.json',rows,True)
        save('institutional-before.json',query('select * from public.institutional_programs order by sort_order'),True)
        save('inventory-before.json',inventory(),True)
        save('audit.json',{'status':'PASS','productInventory':inventory(),'presentationRows':len(rows),'businessWrites':0})
    elif mode in ('test','apply','verify'):
        migration=ROOT/'supabase/migrations'/VERSION;recovery=ROOT/'supabase/recovery'/VERSION
        sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
        before=inventory()
        if mode=='apply':
            tested=json.loads((OUT/'sql-test.json').read_text())
            assert tested['status']=='PASS' and tested['migrationSha256']==sha(migration)
            assert query('select * from public.finance_catalog_presentation order by item_key')==json.loads((PRIVATE/'presentation-before.json').read_text(encoding='utf8')),'METADATA_DRIFT'
            query(migration.read_text(encoding='utf8'));matrix=[]
        else:
            env=db.env();actor=query("select id from auth.users where email='"+env['H005_TEST_EMAIL'].replace("'","''")+"'")[0]['id']
            body=db.transaction_body(migration) if mode=='test' else ''
            tests=(ROOT/'scripts/test-program-general-info.sql').read_text(encoding='utf8')
            matrix=query("begin;"+body+"select set_config('test.program_actor','"+actor+"',true);"+tests+'rollback;')
            if mode=='test':query('begin;'+body+db.transaction_body(recovery)+'rollback;')
        assert inventory()==before,'PRODUCT_MUTATION'
        save('sql-'+mode+'.json',{'status':'PASS','migrationSha256':sha(migration),'recoverySha256':sha(recovery),'matrix':matrix,'productsIntact':True})
    elif mode=='build':
        import os
        env=db.env();target=PRIVATE/'site'
        subprocess.run(['node','scripts/build-pages-site.js',str(target)],cwd=ROOT,env=dict(os.environ,SUTIAPP_SUPABASE_URL=env['SUPABASE_URL'],SUTIAPP_SUPABASE_PUBLISHABLE_KEY=env['SUPABASE_PUBLISHABLE_KEY']),check=True)
        save('build.json',{'status':'PASS','directory':str(target)})
    elif mode=='security':
        result=query('begin;'+(ROOT/'scripts/test-program-general-info-security.sql').read_text(encoding='utf8')+'rollback;')
        save('security.json',{'status':'PASS','matrix':result})
    else:raise ValueError(mode)
if __name__=='__main__':main()
