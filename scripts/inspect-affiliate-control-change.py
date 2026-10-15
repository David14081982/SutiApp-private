"""Read-only installed catalog. Never logs credentials or business records."""
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('database', ROOT / 'scripts/test-admin-affiliates-migration-live.py')
database = importlib.util.module_from_spec(spec)
spec.loader.exec_module(database)
sql = """
begin read only;
set local statement_timeout='45s';
select jsonb_build_object(
 'migrations',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations where version>='20261007000000'),
 'recent_migrations',(select jsonb_agg(jsonb_build_object('version',version,'name',name) order by version) from supabase_migrations.schema_migrations where version>='20261014000000'),
 'enums',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',t.typname,'labels',e.labels)) from pg_type t join pg_namespace n on n.oid=t.typnamespace join lateral (select jsonb_agg(enumlabel order by enumsortorder) labels from pg_enum where enumtypid=t.oid) e on e.labels is not null),
 'functions',(select jsonb_agg(jsonb_build_object('name',p.proname,'signature',p.oid::regprocedure::text,
   'definition',pg_get_functiondef(p.oid),'hash',md5(pg_get_functiondef(p.oid))))
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
   and p.proname in ('update_admin_affiliate','create_admin_affiliate','get_admin_affiliate_workbench',
   'has_admin_permission','admin_module_boundary','get_current_affiliate_access_state','has_certified_affiliate_auth_link','get_effective_affiliate_id')),
 'columns',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',a.attname,
  'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)))
  from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid
  left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
  where c.relkind in ('r','p') and a.attnum>0 and not a.attisdropped
  and (n.nspname='public' or n.nspname like '%\\_private' escape '\\')),
 'constraints',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',k.conname,
   'type',k.contype,'definition',pg_get_constraintdef(k.oid)))
   from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' or n.nspname like '%\\_private' escape '\\'),
 'affiliate_triggers',(select jsonb_agg(jsonb_build_object('name',t.tgname,'definition',pg_get_triggerdef(t.oid),
   'function',pg_get_functiondef(t.tgfoid))) from pg_trigger t where t.tgrelid='public.affiliates'::regclass and not t.tgisinternal),
 'affiliate_indexes',(select jsonb_agg(indexdef) from pg_indexes where schemaname='public' and tablename='affiliates'),
 'direct_writes',(select count(*) from information_schema.role_table_grants where table_schema='public'
   and table_name='affiliates' and grantee in ('anon','authenticated') and privilege_type in ('INSERT','UPDATE','DELETE'))
) result;
rollback;
"""
catalog = database.query(database.load_env(), sql)[0]['result']
assert catalog['direct_writes'] == 0
target = ROOT / 'scripts/fixtures/affiliate-control-change-schema.json'
target.write_text(json.dumps(catalog, indent=2, ensure_ascii=False)+'\n', encoding='utf-8')
print(json.dumps({'readOnly':True,'businessRowsRead':False,'functions':[f['name'] for f in catalog['functions']],
                  'migrations':catalog['recent_migrations'],'columns':len(catalog['columns']), 'directWrites':catalog['direct_writes']}))
