"""Read installed catalog only; no business rows, DDL or DML, no credentials in output."""
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('database', ROOT / 'scripts/test-admin-affiliates-migration-live.py')
database = importlib.util.module_from_spec(spec)
spec.loader.exec_module(database)
sql = """
begin read only;
select jsonb_build_object(
 'functions',(select jsonb_agg(jsonb_build_object('name',p.proname,'signature',p.oid::regprocedure::text,
   'definition',pg_get_functiondef(p.oid),'hash',md5(pg_get_functiondef(p.oid)),
   'acl',p.proacl::text,'security_definer',p.prosecdef,'config',p.proconfig,
   'anon_execute',has_function_privilege('anon',p.oid,'execute'),
   'authenticated_execute',has_function_privilege('authenticated',p.oid,'execute')))
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
   and p.proname in ('create_admin_affiliate','update_admin_affiliate','get_admin_affiliate_workbench')),
 'columns',(select jsonb_agg(jsonb_build_object('name',column_name,'type',data_type,'nullable',is_nullable))
   from information_schema.columns where table_schema='public' and table_name='affiliates'
   and column_name in ('gender_raw','marital_status_raw','children_count_raw')),
 'rls',(select relrowsecurity from pg_class where oid='public.affiliates'::regclass),
 'direct_writes',(select count(*) from information_schema.role_table_grants where table_schema='public'
   and table_name='affiliates' and grantee in ('anon','authenticated') and privilege_type in ('INSERT','UPDATE','DELETE'))
) result;
rollback;
"""
catalog = database.query(database.load_env(), sql)[0]['result']
assert len(catalog['functions']) == 3 and len(catalog['columns']) == 3
assert catalog['rls'] and catalog['direct_writes'] == 0
for f in catalog['functions']:
    assert f['security_definer'] and not f['anon_execute'] and f['authenticated_execute']
    assert any('search_path=' in setting for setting in f['config'])
    if f['name'] != 'get_admin_affiliate_workbench':
        assert all(field in f['definition'] for field in ['gender_raw','marital_status_raw','children_count_raw'])
        assert "has_admin_permission('affiliates.write'" in f['definition']
        assert 'affiliate_admin_events' in f['definition']
    else:
        assert 'to_jsonb(a)' in f['definition'] and "has_admin_permission('affiliates.read'" in f['definition']
out = ROOT / '.tmp/affiliates-demographics/catalog.json'
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps(catalog,indent=2),encoding='utf-8')
report = {'status':'PASS','readOnly':True,'productionWrites':0,'columns':catalog['columns'],
          'rls':catalog['rls'],'directWrites':catalog['direct_writes'],
          'functions':[{k:v for k,v in f.items() if k not in ['definition','acl']} for f in catalog['functions']]}
evidence = ROOT / 'docs/qa/evidence/affiliates-demographics'
evidence.mkdir(parents=True,exist_ok=True)
(evidence/'supabase-readonly.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report))
