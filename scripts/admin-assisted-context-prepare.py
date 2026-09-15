"""Prepare private subject readers and a session-bound, additive authorization extension."""
from pathlib import Path
import json,re,hashlib
root=Path(__file__).resolve().parents[1]
rows=json.loads((root/'tmp/admin-assisted-context/functions.json').read_text())
by={r['name']:r for r in rows}
ns='admin_support_private'
clones=['is_module_admin','has_admin_module','module_effective_permissions','module_prior_has_section_action','has_section_action','savings_permission_before_20260906','savings_admin_access_allowed','module_prior_has_admin_permission','has_admin_permission','savings_context_before_20260906','module_prior_get_admin_access_context','get_admin_access_context','is_active_admin']
sql=["begin;\nset local lock_timeout='5s';\nset local statement_timeout='120s';\ncreate schema admin_support_private;\nrevoke all on schema admin_support_private from public,anon,authenticated,service_role;\ncreate table admin_support_private.recovery(signature text primary key,definition text not null,applied_hash text);\nalter table admin_support_private.recovery enable row level security;\nalter table admin_support_private.recovery force row level security;\nrevoke all on admin_support_private.recovery from public,anon,authenticated,service_role;"]
for r in rows:
    sql.append(f"do $guard$ begin if md5(pg_get_functiondef('public.{r['signature']}'::regprocedure))<>'{r['hash']}' then raise exception 'ASSISTED_BASELINE_CHANGED:{r['name']}'; end if; end $guard$;")
for name in clones:
    definition=by[name]['definition']
    header,body=definition.split('AS $function$',1)
    header=header.replace('public.'+name+'(',ns+'.'+name+'(p_subject uuid'+(',' if not header.split('public.'+name+'(',1)[1].startswith(')') else ''))
    body=re.sub(r'auth\.uid\(\)', 'p_subject',body)
    for dep in sorted(clones,key=len,reverse=True):
        body=re.sub(r'public\.'+dep+r'\(\s*\)',ns+'.'+dep+'(p_subject)',body)
        body=re.sub(r'public\.'+dep+r'\(',ns+'.'+dep+'(p_subject,',body)
    assert not re.search(r'auth\.uid|public\.('+ '|'.join(clones)+r')\(',body)
    sql.append((header+'AS $function$'+body).rstrip().rstrip(';')+';')

sql.append('''
-- Only the server-owned session selects the context. Auth remains the real actor.
create function admin_support_private.context()
returns table(session_id uuid,actor_auth_user_id uuid,subject_auth_user_id uuid,affiliate_id uuid)
language sql stable security definer set search_path='' as $$
 select s.id,auth.uid(),case when u.email_confirmed_at is not null
  and (select count(*) from public.affiliates f where f.auth_user_id=u.id and not f.is_archived)=1 then u.id end,a.id
 from public.impersonation_sessions s join public.affiliates a on a.id=s.usuario_contexto_affiliate_id and not a.is_archived
 left join auth.users u on u.id=a.auth_user_id
 where s.actor_real_auth_user_id=auth.uid() and s.ended_at is null and s.expires_at>now()
 and s.actor_auth_session_id=nullif(auth.jwt()->>'session_id','')
 and admin_support_private.has_admin_permission(auth.uid(),'affiliates.impersonate')
 order by s.started_at desc limit 1;
$$;
create function public.admin_actor_can_impersonate() returns boolean
language sql stable security definer set search_path='' as $$
 select admin_support_private.has_admin_permission(auth.uid(),'affiliates.impersonate');
$$;
''')
# Navigation permission metadata is copied exactly from the published module registry.
source=Path('C:/tmp/sutiapp-admin-user-modules-release-20260914/app/screens-admin.jsx').read_text(encoding='utf8')
permission_block=source.split('const MODULE_PERMISSION = Object.freeze({',1)[1].split('});',1)[0]
permissions=dict(re.findall(r"(\w+):'([^']+)'",permission_block));assert len(permissions)==33
section_block=source.split('const SECTION_MODULE = Object.freeze({',1)[1].split('});',1)[0]
sections={k:re.findall(r"'([^']+)'",v) for k,v in re.findall(r"(\w+):(\[[^\]]+\]|'[^']+')",section_block)}
values=','.join("('%s','%s',array[%s]::text[])"%(k,p,','.join("'%s'"%s for s in sections.get(k,[]))) for k,p in permissions.items())
sql.append('''
create function admin_support_private.module_visible(p_subject uuid,p_module text) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare c jsonb:=admin_support_private.get_admin_access_context(p_subject); required text; sections text[]; begin
 if admin_support_private.is_module_admin(p_subject) then return admin_support_private.has_admin_module(p_subject,p_module); end if;
 select permission,section_keys into required,sections from (values '''+values+''') modules(key,permission,section_keys) where key=p_module;
 if required is null then return false; end if;
 return coalesce((c->>'full_access')::boolean,false)
  or exists(select 1 from jsonb_array_elements(c->'section_actions') entry where entry->>'section_key'=any(sections))
  or (p_module='data_exports' and exists(select 1 from jsonb_array_elements(c->'section_actions') entry where entry->>'action'='export'))
  or admin_support_private.has_admin_permission(p_subject,required)
  or (p_module='education' and exists(select 1 from jsonb_array_elements(c->'section_actions') entry where entry->>'section_key' in ('education','tutorials')));
end $$;

create function admin_support_private.effective_context() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare support record; actor jsonb; target jsonb; modules jsonb; permissions jsonb; sections jsonb; begin
 select * into support from admin_support_private.context();
 if not found then return admin_support_private.get_admin_access_context(auth.uid()); end if;
 actor:=admin_support_private.get_admin_access_context(auth.uid());
 target:=admin_support_private.get_admin_access_context(support.subject_auth_user_id);
 select coalesce(jsonb_agg(d.module_key order by d.module_order),'[]'::jsonb) into modules
 from public.admin_section_definitions d where d.module_key is not null
 and admin_support_private.module_visible(support.subject_auth_user_id,d.module_key)
 and admin_support_private.module_visible(auth.uid(),d.module_key);
 select coalesce(jsonb_agg(value order by value),'[]'::jsonb) into permissions
 from jsonb_array_elements_text(target->'technical_permissions') value
 where admin_support_private.has_admin_permission(auth.uid(),value);
 select coalesce(jsonb_agg(entry),'[]'::jsonb) into sections
 from jsonb_array_elements(target->'section_actions') entry
 where coalesce((actor->>'full_access')::boolean,false)
 or admin_support_private.has_section_action(auth.uid(),entry->>'section_key',entry->>'action');
 return target||jsonb_build_object('module_keys',modules,'technical_permissions',permissions,'section_actions',sections,
  'full_access',coalesce((actor->>'full_access')::boolean,false) and coalesce((target->>'full_access')::boolean,false),
  'role_code',case when jsonb_array_length(modules)>0 then coalesce(target->>'role_code','assisted_sections') else null end,
  'support_context',jsonb_build_object('session_id',support.session_id,'actor_auth_user_id',auth.uid(),
   'subject_auth_user_id',support.subject_auth_user_id,'affiliate_id',support.affiliate_id));
end $$;
''')
changed=[]
def replace_body(name,body):
    original=by[name]['definition'];header=original.split('AS $function$',1)[0]
    sql.append(f"insert into {ns}.recovery(signature,definition) values ('{by[name]['signature']}',pg_get_functiondef('public.{by[name]['signature']}'::regprocedure));")
    sql.append(header+'AS $function$\n'+body+'\n$function$;');changed.append(name)
replace_body('has_admin_permission', '''select admin_support_private.has_admin_permission(auth.uid(),required_permission)
 and case when exists(select 1 from admin_support_private.context()) then
 admin_support_private.has_admin_permission((select subject_auth_user_id from admin_support_private.context()),required_permission) else true end;''')
replace_body('has_section_action', '''select case when exists(select 1 from admin_support_private.context()) then
 admin_support_private.has_section_action((select subject_auth_user_id from admin_support_private.context()),p_section_key,p_action)
 and (coalesce((admin_support_private.get_admin_access_context(auth.uid())->>'full_access')::boolean,false)
 or admin_support_private.has_section_action(auth.uid(),p_section_key,p_action))
 else admin_support_private.has_section_action(auth.uid(),p_section_key,p_action) end;''')
replace_body('get_admin_access_context','select admin_support_private.effective_context();')
replace_body('is_module_admin', '''select admin_support_private.is_module_admin(auth.uid()) or
 (exists(select 1 from admin_support_private.context()) and admin_support_private.is_module_admin((select subject_auth_user_id from admin_support_private.context())));''')
replace_body('has_admin_module', '''select case when exists(select 1 from admin_support_private.context()) then
 admin_support_private.module_visible(auth.uid(),p_module)
 and admin_support_private.module_visible((select subject_auth_user_id from admin_support_private.context()),p_module)
 and (not admin_support_private.is_module_admin(auth.uid()) or admin_support_private.has_admin_module(auth.uid(),p_module,p_action))
 and (not admin_support_private.is_module_admin((select subject_auth_user_id from admin_support_private.context()))
 or admin_support_private.has_admin_module((select subject_auth_user_id from admin_support_private.context()),p_module,p_action))
 and (select subject_auth_user_id is not null from admin_support_private.context())
 else admin_support_private.has_admin_module(auth.uid(),p_module,p_action) end;''')
replace_body('module_effective_permissions', '''select case when exists(select 1 from admin_support_private.context()) then
 array(select jsonb_array_elements_text(admin_support_private.effective_context()->'technical_permissions'))
 else admin_support_private.module_effective_permissions(auth.uid()) end;''')
for name in ['is_active_admin','savings_admin_access_allowed']:
    replace_body(name,f'''select admin_support_private.{name}(auth.uid()) and case when exists(select 1 from admin_support_private.context()) then
 admin_support_private.{name}((select subject_auth_user_id from admin_support_private.context())) else true end;''')
identity=['get_effective_affiliate_id','get_current_affiliate_access_state','get_impersonation_context','start_affiliate_impersonation','stop_affiliate_impersonation','search_affiliates_for_impersonation','resolve_current_loan_snapshot_quote']
for name in identity+['list_admin_module_catalog','get_admin_user_modules','save_admin_user_modules','assign_admin_role']:
    original=by[name]['definition'];body=original.split('AS $function$',1)[1].rsplit('$function$',1)[0]
    if name in identity:
        body,count=re.subn(r"public\.has_admin_permission\(\s*'affiliates\.impersonate'(?:::text)?\s*\)",'public.admin_actor_can_impersonate()',body)
        assert count>0,name
    else:
        body=body.replace('public.module_prior_has_admin_permission(', 'public.has_admin_permission(')
        if name=='get_admin_user_modules':
            body=body.replace("'self',target=auth.uid()", "'self',(target=auth.uid() or coalesce(target=(select subject_auth_user_id from admin_support_private.context()),false))")
        if name=='save_admin_user_modules':
            body=body.replace('if target=auth.uid() then', 'if target=auth.uid() or coalesce(target=(select subject_auth_user_id from admin_support_private.context()),false) then')
        if name=='assign_admin_role':
            body=body.replace('if p_auth_user_id=v_actor then', 'if p_auth_user_id=v_actor or coalesce(p_auth_user_id=(select subject_auth_user_id from admin_support_private.context()),false) then')
        assert body!=original.split('AS $function$',1)[1].rsplit('$function$',1)[0],name
    replace_body(name,body)
sql.append('''
create function admin_support_private.audit_context() returns trigger
language plpgsql security definer set search_path='' as $$
declare support record; begin
 select * into support from admin_support_private.context();
 if found then new.details:=coalesce(new.details,'{}'::jsonb)||jsonb_build_object('admin_assistance',
  jsonb_build_object('session_id',support.session_id,'actor_real_auth_user_id',auth.uid(),
  'subject_auth_user_id',support.subject_auth_user_id,'usuario_contexto_affiliate_id',support.affiliate_id)); end if;
 return new;
end $$;
create trigger admin_assisted_context before insert on public.admin_audit_log for each row execute function admin_support_private.audit_context();
create trigger admin_assisted_context before insert on public.identity_audit_log for each row execute function admin_support_private.audit_context();
create function admin_support_private.audit_affiliate_write() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from admin_support_private.context()) then
  insert into public.admin_audit_log(actor_auth_user_id,resource,action,target_id,result,details)
  values(auth.uid(),'affiliate_admin_events',new.action,new.affiliate_id::text,'SUCCESS',jsonb_build_object('event_id',new.event_id));
 end if;
 return new;
end $$;
create trigger admin_assisted_context after insert on public.affiliate_admin_events for each row execute function admin_support_private.audit_affiliate_write();
revoke all on all functions in schema admin_support_private from public,anon,authenticated,service_role;
revoke all on function public.admin_actor_can_impersonate() from public,anon,authenticated,service_role;
grant execute on function public.admin_actor_can_impersonate() to authenticated;
update admin_support_private.recovery set applied_hash=md5(pg_get_functiondef(('public.'||signature)::regprocedure));
notify pgrst,'reload schema';
commit;
''')
name='20260915000100_admin_assisted_context.sql'
(root/'supabase/migrations'/name).write_text('\n\n'.join(sql),encoding='utf8')
recovery='''begin;
do $guard$ declare r record; begin
 if exists(select 1 from public.admin_audit_log where details ? 'admin_assistance')
 or exists(select 1 from public.identity_audit_log where details ? 'admin_assistance') then
 raise exception 'ASSISTED_HISTORY_EXISTS_FORWARD_RECOVERY_REQUIRED'; end if;
 for r in select * from admin_support_private.recovery loop
  if md5(pg_get_functiondef(('public.'||r.signature)::regprocedure))<>r.applied_hash then raise exception 'ASSISTED_RECOVERY_DEFINITION_DRIFT:%',r.signature; end if;
 end loop;
 for r in select * from admin_support_private.recovery loop execute r.definition; end loop;
end $guard$;
drop trigger admin_assisted_context on public.admin_audit_log;
drop trigger admin_assisted_context on public.identity_audit_log;
drop trigger admin_assisted_context on public.affiliate_admin_events;
drop function public.admin_actor_can_impersonate();
drop schema admin_support_private cascade;
notify pgrst,'reload schema';
commit;
'''
(root/'supabase/recovery'/name).write_text(recovery,encoding='utf8')
evidence={'status':'PREPARED','baselineFunctions':len(rows),'privateReaders':clones,'changedPublicFunctions':changed,'migrationSha256':hashlib.sha256((root/'supabase/migrations'/name).read_bytes()).hexdigest(),'businessWrites':0}
(root/'docs/qa/evidence/admin-assisted-context-20260915/prepared.json').write_text(json.dumps(evidence,indent=2),encoding='utf8')
print(json.dumps(evidence))
