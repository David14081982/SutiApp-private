"""Read-only catalog capture; never prints credentials or business rows."""
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('database', ROOT / 'scripts/test-admin-affiliates-migration-live.py')
database = importlib.util.module_from_spec(spec)
spec.loader.exec_module(database)
names = ['create_admin_affiliate', 'update_admin_affiliate', 'change_admin_affiliate_status',
         'archive_admin_affiliate', 'restore_admin_affiliate', 'register_admin_affiliate_document',
         'start_affiliate_impersonation']
tables = ['affiliates', 'affiliate_admin_events', 'affiliate_profile_audit_log', 'impersonation_sessions',
          'identity_audit_log', 'sensitive_change_audit', 'affiliate_documents', 'private_assets',
          'segmentation_catalog_entries', 'document_types']
quoted = lambda values: ','.join("'" + value + "'" for value in values)
env = database.load_env()
queries = {
 'functions': f"select p.oid::regprocedure::text signature,p.proname name,pg_get_functiondef(p.oid) definition,md5(pg_get_functiondef(p.oid)) hash,p.proacl::text acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ({quoted(names)}) order by p.proname",
 'columns': f"select c.relname table_name,a.attname name,format_type(a.atttypid,a.atttypmod) type,a.attnotnull not_null,pg_get_expr(d.adbin,d.adrelid) default_expr from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum where n.nspname='public' and c.relname in ({quoted(tables)}) order by c.relname,a.attnum",
 'constraints': f"select c.relname table_name,k.conname name,k.contype type,pg_get_constraintdef(k.oid) definition,md5(pg_get_constraintdef(k.oid)) hash from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ({quoted(tables)}) order by c.relname,k.conname",
 'triggers': f"select c.relname table_name,t.tgname name,pg_get_triggerdef(t.oid) definition,pg_get_functiondef(t.tgfoid) function_definition from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and n.nspname='public' and c.relname in ({quoted(tables)}) order by c.relname,t.tgname",
 'security': f"select c.relname table_name,c.relrowsecurity rls,c.relforcerowsecurity force_rls from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ({quoted(tables)})",
 'policies': f"select * from pg_policies where schemaname='public' and tablename in ({quoted(tables)})",
 'grants': f"select table_name,grantee,privilege_type from information_schema.role_table_grants where table_schema='public' and table_name in ({quoted(tables)}) and grantee in ('anon','authenticated','service_role')",
 'versions': 'select version from supabase_migrations.schema_migrations order by version desc limit 8'
}
result = {key: database.query(env, sql) for key, sql in queries.items()}
destination = ROOT / '.tmp/affiliates-optional-reason/baseline.json'
destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding='utf-8')
print(json.dumps({'captured': str(destination.relative_to(ROOT)), 'counts': {k: len(v) for k,v in result.items()}}))
