"""Focal backend release. Never changes an affiliate or financial business row."""
import importlib.util
import json
import sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
VERSION='20261015000100'
NAME='affiliate_control_change'
MIGRATION=ROOT/f'supabase/migrations/{VERSION}_{NAME}.sql'
WORK=ROOT/'.tmp/affiliate-control-change'
OUT=ROOT/'docs/qa/evidence/affiliate-control-change'
spec=importlib.util.spec_from_file_location('database',ROOT/'scripts/test-admin-affiliates-migration-live.py')
database=importlib.util.module_from_spec(spec)
spec.loader.exec_module(database)
def query(sql):
    return database.query(database.load_env(),sql)
def lit(s):
    return "'"+s.replace("'","''")+"'"
def prepare():
    catalog=json.loads((ROOT/'scripts/fixtures/affiliate-control-change-schema.json').read_text(encoding='utf-8'))
    assert VERSION not in catalog['migrations']
    for name in ['database','catalog-test','concurrency','browser']:
        assert json.loads((OUT/(name+'.json')).read_text(encoding='utf-8'))['status']=='PASS',name
    body=database.transaction_body(MIGRATION)
    guards='\n'.join("if md5(pg_get_functiondef("+lit(f['signature'])+"::regprocedure))<>"+lit(f['hash'])+" then raise exception 'CATALOG_DRIFT';end if;" for f in catalog['functions'])
    sql="""begin isolation level repeatable read;
set local lock_timeout='2s';set local statement_timeout='60s';
do $guard$ begin if exists(select 1 from supabase_migrations.schema_migrations where version='"""+VERSION+"""') then raise exception 'MIGRATION_ALREADY_EXISTS'; end if;
"""+guards+"""
end $guard$;
create temp table control_release_before(name text primary key,row_count bigint,digest text) on commit drop;
do $hash$ declare t record;n bigint;d text;begin
for t in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where c.relkind in ('r','p') and not c.relispartition and (n.nspname='public' or right(n.nspname,8)='_private') order by 1,2 loop
 execute format('select count(*),md5(coalesce(string_agg(h,'''' order by h),'''')) from (select md5(to_jsonb(r)::text) h from %I.%I r) s',t.nspname,t.relname) into n,d;
 insert into control_release_before values(t.nspname||'.'||t.relname,n,d);
end loop;end $hash$;
"""+body+"""
do $after$ declare t record;n bigint;d text;begin
for t in select * from control_release_before loop
 execute format('select count(*),md5(coalesce(string_agg(h,'''' order by h),'''')) from (select md5(to_jsonb(r)::text) h from %s r) s',t.name::regclass) into n,d;
 if n<>t.row_count or d<>t.digest then raise exception 'BUSINESS_ROW_CHANGED_IN_RELEASE';end if;
end loop;
if (select count(*) from public.affiliate_control_changes)<>0 then raise exception 'UNEXPECTED_CHANGE_EVENT';end if;
end $after$;
insert into supabase_migrations.schema_migrations(version,name,statements) values("""+lit(VERSION)+","+lit(NAME)+",array["+lit(body)+"""]);
select jsonb_build_object('status','PASS','version','"""+VERSION+"""','existingTablesUnchanged',(select count(*) from control_release_before),
 'businessRowsChanged',0,'realControlChanges',0,'schemaApplied',true) result;
commit;
"""
    WORK.mkdir(parents=True,exist_ok=True)
    (WORK/'apply.sql').write_text(sql,encoding='utf-8')
    return sql
def verify():
    sql="""begin read only;
set local statement_timeout='45s';
do $verify$ declare actor uuid;ordinary uuid;target uuid;r jsonb;start_time timestamptz;begin
 if has_function_privilege('anon','public.preview_admin_affiliate_control(uuid,text)','execute')
 or has_function_privilege('anon','public.change_admin_affiliate_control(uuid,text,timestamptz,text,text,uuid)','execute')
 or has_table_privilege('authenticated','public.affiliate_control_changes','SELECT')
 or has_column_privilege('authenticated','public.affiliates','numero_control','UPDATE')
 then raise exception 'GRANTS_UNSAFE';end if;
 select a.auth_user_id into actor from public.admin_assignments a where a.enabled
 and admin_support_private.has_admin_permission(a.auth_user_id,'affiliates.read')
 and admin_support_private.has_admin_permission(a.auth_user_id,'affiliates.write') limit 1;
 if actor is null then raise exception 'NO_AUTHORIZED_ADMIN';end if;
 select u.id into ordinary from auth.users u where not admin_support_private.has_admin_permission(u.id,'affiliates.write') limit 1;
 if ordinary is null then raise exception 'NO_ORDINARY_PRINCIPAL';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',ordinary,'role','authenticated')::text,true);
 perform set_config('request.jwt.claim.sub',ordinary::text,true);
 set local role authenticated;
 begin perform public.preview_admin_affiliate_control(null,'READ_ONLY_CHECK');raise exception 'ORDINARY_PREVIEW_ALLOWED';exception when insufficient_privilege then null;end;
 begin perform public.change_admin_affiliate_control(null,'READ_ONLY_CHECK',null,null,'',gen_random_uuid());raise exception 'ORDINARY_WRITE_ALLOWED';exception when insufficient_privilege then null;end;
 begin perform public.list_admin_affiliate_control_changes(null);raise exception 'ORDINARY_HISTORY_ALLOWED';exception when insufficient_privilege then null;end;
 reset role;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 perform set_config('request.jwt.claim.sub',actor::text,true);
 select a.id into target from public.affiliates a left join public.program_requests p on p.affiliate_id=a.id
 where not a.is_archived and a.numero_control is not null group by a.id order by count(p.id) desc,a.id limit 1;
 start_time:=clock_timestamp();
 set local role authenticated;
 r:=public.preview_admin_affiliate_control(target,'READ_ONLY_CHECK_NO_CHANGE');
 if r->>'affiliate_id' is distinct from target::text or jsonb_typeof(r->'groups')<>'array'
 or not (r ? 'fingerprint') or jsonb_array_length(r->'excluded')<>4 then raise exception 'PREVIEW_CONTRACT_FAILED';end if;
 perform public.list_admin_affiliate_control_changes(target);
 reset role;
 perform set_config('release.control_verify',jsonb_build_object('status','PASS','adminPreview',true,'ordinaryDenied',true,
 'anonDenied',true,'directWritesDenied',true,'tablesInspected',r->'tables_checked','groupsFound',jsonb_array_length(r->'groups'),
 'previewMs',round(extract(epoch from clock_timestamp()-start_time)*1000),'businessWrites',0)::text,true);
end $verify$;
select current_setting('release.control_verify')::jsonb result;
rollback;"""
    result=query(sql)[0]['result']
    assert result['previewMs']<15000,result
    (OUT/'backend-verified.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(result))
mode=sys.argv[1] if len(sys.argv)>1 else '--prepare'
if mode=='--prepare':
    prepare()
    print(json.dumps({'prepared':True,'productionWrites':0,'version':VERSION}))
elif mode=='--apply':
    assert json.loads((OUT/'envelope-test.json').read_text(encoding='utf-8'))['status']=='PASS'
    sql=prepare()
    before=query("begin read only;select jsonb_build_object('versionAvailable',not exists(select 1 from supabase_migrations.schema_migrations where version='"+VERSION+"'),'tableAbsent',to_regclass('public.affiliate_control_changes') is null) result;rollback;")[0]['result']
    assert before['versionAvailable'] and before['tableAbsent'],before
    result=query(sql)[0]['result']
    (OUT/'backend-applied.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(result))
elif mode=='--verify':
    verify()
else:
    raise SystemExit('Expected --prepare, --apply or --verify')
