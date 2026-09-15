begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
create schema admin_support_private;
revoke all on schema admin_support_private from public,anon,authenticated,service_role;
create table admin_support_private.recovery(signature text primary key,definition text not null,applied_hash text);
alter table admin_support_private.recovery enable row level security;
alter table admin_support_private.recovery force row level security;
revoke all on admin_support_private.recovery from public,anon,authenticated,service_role;

do $guard$ begin if md5(pg_get_functiondef('public.assign_admin_role(uuid,uuid,boolean)'::regprocedure))<>'64549e3239044fa8fc9eb75db1a00cb6' then raise exception 'ASSISTED_BASELINE_CHANGED:assign_admin_role'; end if; end $guard$;

do $guard$ begin if md5(pg_get_functiondef('public.get_admin_access_context()'::regprocedure))<>'24e92a7b601ca2e6b630e38222dbe24b' then raise exception 'ASSISTED_BASELINE_CHANGED:get_admin_access_context'; end if; end $guard$;

do $guard$ begin if md5(pg_get_functiondef('public.get_admin_user_modules(text)'::regprocedure))<>'dd3459ea5bdef4990695306cd672963e' then raise exception 'ASSISTED_BASELINE_CHANGED:get_admin_user_modules'; end if; end $guard$;

do $guard$ begin if md5(pg_get_functiondef('public.get_current_affiliate_access_state()'::regprocedure))<>'efb57d261cb6bac808992e67862471d9' then raise exception 'ASSISTED_BASELINE_CHANGED:get_current_affiliate_access_state'; end if; end $guard$;

do $guard$ begin if md5(pg_get_functiondef('public.get_effective_affiliate_id()'::regprocedure))<>'61ae1db35088da20c59947c7692855cb' then raise exception 'ASSISTED_BASELINE_CHANGED:get_effective_affiliate_id'; end if; end $guard$;

do $guard$ begin if md5(pg_get_functiondef('public.get_impersonation_context()'::regprocedure))<>'151f652fbc20d17ed6477d4532734b9e' then raise exception 'ASSISTED_BASELINE_CHANGED:get_impersonation_context'; end if; end $guard$;

do $guard$ begin if md5(pg_get_functiondef('public.has_admin_module(text,text)'::regprocedure))<>'63dcd08b3a61e1fdf9c0475928301b51' then raise exception 'ASSISTED_BASELINE_CHANGED:has_admin_module'; end if; end $guard$;

do $guard$ begin if md5(pg_get_functiondef('public.has_admin_permission(text)'::regprocedure))<>'89bab1027b47ab3b506ee9d071a325a7' then raise exception 'ASSISTED_BASELINE_CHANGED:has_admin_permission'; end if; end $guard$;

do $guard$ begin if md5(pg_get_functiondef('public.has_section_action(text,text)'::regprocedure))<>'0ee3575a6fd44e717a4e8c327e9737d7' then raise exception 'ASSISTED_BASELINE_CHANGED:has_section_action'; end if; end $guard$;

do $guard$ begin if md5(pg_get_functiondef('public.is_active_admin()'::regprocedure))<>'97d19fc2dc02738551aee3990987ac40' then raise exception 'ASSISTED_BASELINE_CHANGED:is_active_admin'; end if; end $guard$;

do $guard$ begin if md5(pg_get_functiondef('public.is_module_admin()'::regprocedure))<>'bd1b944d3a5f9dc6a0d1528cb4118a47' then raise exception 'ASSISTED_BASELINE_CHANGED:is_module_admin'; end if; end $guard$;

do $guard$ begin if md5(pg_get_functiondef('public.list_admin_module_catalog()'::regprocedure))<>'c46cb6b4910f52a4255cf31b95d4a510' then raise exception 'ASSISTED_BASELINE_CHANGED:list_admin_module_catalog'; end if; end $guard$;

do $guard$ begin if md5(pg_get_functiondef('public.module_effective_permissions()'::regprocedure))<>'30506252a800651a4e5f94188ea46471' then raise exception 'ASSISTED_BASELINE_CHANGED:module_effective_permissions'; end if; end $guard$;

do $guard$ begin if md5(pg_get_functiondef('public.module_prior_get_admin_access_context()'::regprocedure))<>'770089bdbcb39c64d7b0bf8207362d9e' then raise exception 'ASSISTED_BASELINE_CHANGED:module_prior_get_admin_access_context'; end if; end $guard$;

do $guard$ begin if md5(pg_get_functiondef('public.module_prior_has_admin_permission(text)'::regprocedure))<>'6d4c90dea3a402709e7df1cb480e005e' then raise exception 'ASSISTED_BASELINE_CHANGED:module_prior_has_admin_permission'; end if; end $guard$;

do $guard$ begin if md5(pg_get_functiondef('public.module_prior_has_section_action(text,text)'::regprocedure))<>'eb91ca7917ff48d4bd486422cb81ae18' then raise exception 'ASSISTED_BASELINE_CHANGED:module_prior_has_section_action'; end if; end $guard$;

do $guard$ begin if md5(pg_get_functiondef('public.resolve_current_loan_snapshot_quote(uuid,text,numeric,integer)'::regprocedure))<>'25ebce43c0f9ebf946a66f4f10676e0e' then raise exception 'ASSISTED_BASELINE_CHANGED:resolve_current_loan_snapshot_quote'; end if; end $guard$;

do $guard$ begin if md5(pg_get_functiondef('public.save_admin_user_modules(text,text,text[],text)'::regprocedure))<>'8b2445a6a8226898feaf699c681b710d' then raise exception 'ASSISTED_BASELINE_CHANGED:save_admin_user_modules'; end if; end $guard$;

do $guard$ begin if md5(pg_get_functiondef('public.savings_admin_access_allowed()'::regprocedure))<>'119d25ec7190b4467d8c787d9250deb4' then raise exception 'ASSISTED_BASELINE_CHANGED:savings_admin_access_allowed'; end if; end $guard$;

do $guard$ begin if md5(pg_get_functiondef('public.savings_context_before_20260906()'::regprocedure))<>'80d14522535e0863397aa946256536bd' then raise exception 'ASSISTED_BASELINE_CHANGED:savings_context_before_20260906'; end if; end $guard$;

do $guard$ begin if md5(pg_get_functiondef('public.savings_permission_before_20260906(text)'::regprocedure))<>'7550385caccf2f04e6f66e4eece28030' then raise exception 'ASSISTED_BASELINE_CHANGED:savings_permission_before_20260906'; end if; end $guard$;

do $guard$ begin if md5(pg_get_functiondef('public.search_affiliates_for_impersonation(text)'::regprocedure))<>'688ae5ed64e455c59517c581a5d47ea7' then raise exception 'ASSISTED_BASELINE_CHANGED:search_affiliates_for_impersonation'; end if; end $guard$;

do $guard$ begin if md5(pg_get_functiondef('public.start_affiliate_impersonation(uuid,text)'::regprocedure))<>'94557a41ec7f21965ec843c3ff69e688' then raise exception 'ASSISTED_BASELINE_CHANGED:start_affiliate_impersonation'; end if; end $guard$;

do $guard$ begin if md5(pg_get_functiondef('public.stop_affiliate_impersonation()'::regprocedure))<>'e11cb799d3732d1529c23eab52b5fccd' then raise exception 'ASSISTED_BASELINE_CHANGED:stop_affiliate_impersonation'; end if; end $guard$;

CREATE OR REPLACE FUNCTION admin_support_private.is_module_admin(p_subject uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select exists(select 1 from public.admin_assignments a join public.admin_roles r on r.id=a.role_id
  where a.auth_user_id=p_subject and r.code='module_admin');
$function$;

CREATE OR REPLACE FUNCTION admin_support_private.has_admin_module(p_subject uuid,p_module text, p_action text DEFAULT 'read'::text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select exists(select 1 from public.admin_assignments a join public.admin_roles role on role.id=a.role_id and role.enabled
  join public.admin_section_responsibilities grant_row on grant_row.auth_user_id=a.auth_user_id and grant_row.enabled
  join public.admin_section_definitions d on d.section_key=grant_row.section_key and d.enforcement_status='ENFORCED'
  where a.auth_user_id=p_subject and a.enabled and role.code='module_admin'
   and d.module_key=p_module and not d.module_total_only and grant_row.action=p_action);
$function$;

CREATE OR REPLACE FUNCTION admin_support_private.module_effective_permissions(p_subject uuid)
 RETURNS text[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select coalesce(array_agg(distinct permission order by permission),'{}') from (
  select unnest(case when g.action='update' then d.module_write_permissions else d.module_read_permissions end) permission
  from public.admin_section_responsibilities g join public.admin_section_definitions d on d.section_key=g.section_key
  where g.auth_user_id=p_subject and g.enabled and d.module_key is not null
   and admin_support_private.has_admin_module(p_subject,d.module_key,g.action)
 ) permissions;
$function$;

CREATE OR REPLACE FUNCTION admin_support_private.module_prior_has_section_action(p_subject uuid,p_section_key text, p_action text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.admin_section_responsibilities r
    join public.admin_section_definitions d on d.section_key=r.section_key
    where r.auth_user_id=(select p_subject)
      and r.section_key=p_section_key
      and r.action=p_action
      and r.enabled
      and d.enforcement_status='ENFORCED'
      and p_action=any(d.allowed_actions)
  )
$function$;

CREATE OR REPLACE FUNCTION admin_support_private.has_section_action(p_subject uuid,p_section_key text, p_action text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select case when admin_support_private.is_module_admin(p_subject) then exists(
  select 1 from public.admin_section_definitions d
  where p_section_key=any(d.module_sections) and admin_support_private.has_admin_module(p_subject,d.module_key,case when p_action='read' then 'read' else 'update' end)
   and exists(select 1 from public.admin_section_definitions original where original.section_key=p_section_key
    and original.enforcement_status='ENFORCED' and p_action=any(original.allowed_actions))
 ) else not exists(select 1 from public.admin_section_definitions where section_key=p_section_key and module_key is not null)
 and admin_support_private.module_prior_has_section_action(p_subject,p_section_key,p_action) end;
$function$;

CREATE OR REPLACE FUNCTION admin_support_private.savings_permission_before_20260906(p_subject uuid,required_permission text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists(
    select 1
    from public.admin_assignments a
    join public.admin_roles r on r.id=a.role_id and r.enabled
    join public.admin_role_permissions rp on rp.role_id=r.id
    where a.auth_user_id=(select p_subject) and a.enabled and rp.permission=required_permission
  )
$function$;

CREATE OR REPLACE FUNCTION admin_support_private.savings_admin_access_allowed(p_subject uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select p_subject is not null and (
  admin_support_private.savings_permission_before_20260906(p_subject,'authorization.write') or
  admin_support_private.has_section_action(p_subject,'savings','read') or
  ((select mode from public.savings_admin_access_mode where id)='OPEN' and admin_support_private.savings_permission_before_20260906(p_subject,'savings.read'))
 );
$function$;

CREATE OR REPLACE FUNCTION admin_support_private.module_prior_has_admin_permission(p_subject uuid,required_permission text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select case when required_permission like 'savings.%' then
  admin_support_private.savings_admin_access_allowed(p_subject) and (admin_support_private.savings_permission_before_20260906(p_subject,required_permission)
   or (required_permission='savings.read' and admin_support_private.has_section_action(p_subject,'savings','read')))
 else admin_support_private.savings_permission_before_20260906(p_subject,required_permission) end;
$function$;

CREATE OR REPLACE FUNCTION admin_support_private.has_admin_permission(p_subject uuid,required_permission text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select case when admin_support_private.is_module_admin(p_subject) then required_permission=any(admin_support_private.module_effective_permissions(p_subject))
 else admin_support_private.module_prior_has_admin_permission(p_subject,required_permission) end;
$function$;

CREATE OR REPLACE FUNCTION admin_support_private.savings_context_before_20260906(p_subject uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'role_code',(
      select r.code from public.admin_assignments a join public.admin_roles r on r.id=a.role_id and r.enabled
      where a.auth_user_id=(select p_subject) and a.enabled limit 1
    ),
    'full_access',coalesce((
      select r.code='principal_admin' from public.admin_assignments a join public.admin_roles r on r.id=a.role_id and r.enabled
      where a.auth_user_id=(select p_subject) and a.enabled limit 1
    ),false),
    'technical_permissions',coalesce((
      select jsonb_agg(rp.permission order by rp.permission)
      from public.admin_assignments a
      join public.admin_roles ar on ar.id=a.role_id and ar.enabled
      join public.admin_role_permissions rp on rp.role_id=ar.id
      where a.auth_user_id=(select p_subject) and a.enabled
    ),'[]'::jsonb),
    'section_actions',coalesce((
      select jsonb_agg(jsonb_build_object('section_key',r.section_key,'action',r.action) order by r.section_key,r.action)
      from public.admin_section_responsibilities r
      join public.admin_section_definitions d on d.section_key=r.section_key
      where r.auth_user_id=(select p_subject) and r.enabled and d.enforcement_status='ENFORCED'
    ),'[]'::jsonb)
  )
$function$;

CREATE OR REPLACE FUNCTION admin_support_private.module_prior_get_admin_access_context(p_subject uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select original || jsonb_build_object('technical_permissions',coalesce((
  select jsonb_agg(permission order by permission) from (
   select value as permission from jsonb_array_elements_text(original->'technical_permissions')
    where value not like 'savings.%' or admin_support_private.has_admin_permission(p_subject,value)
   union select 'savings.read' where admin_support_private.has_section_action(p_subject,'savings','read') and admin_support_private.savings_admin_access_allowed(p_subject)
  ) permissions),'[]'::jsonb))
 from (select admin_support_private.savings_context_before_20260906(p_subject) original) context;
$function$;

CREATE OR REPLACE FUNCTION admin_support_private.get_admin_access_context(p_subject uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select original || case when admin_support_private.is_module_admin(p_subject) then jsonb_build_object(
  'module_access_version',1,
  'module_keys',coalesce((select jsonb_agg(d.module_key order by d.module_order) from public.admin_section_definitions d
    where d.module_key is not null and admin_support_private.has_admin_module(p_subject,d.module_key)),'[]'::jsonb),
  'technical_permissions',to_jsonb(admin_support_private.module_effective_permissions(p_subject)),
  'section_actions',coalesce((select jsonb_agg(jsonb_build_object('section_key',d.section_key,'action',a))
    from public.admin_section_definitions d cross join lateral unnest(d.allowed_actions) a
    where d.module_key is null and admin_support_private.has_section_action(p_subject,d.section_key,a)),'[]'::jsonb)
 ) else jsonb_build_object('module_access_version',1,'module_keys',null,'section_actions',coalesce((
  select jsonb_agg(entry) from jsonb_array_elements(original->'section_actions') entry
  where not exists(select 1 from public.admin_section_definitions d where d.section_key=entry->>'section_key' and d.module_key is not null)
 ),'[]'::jsonb)) end
 from (select admin_support_private.module_prior_get_admin_access_context(p_subject) original) context;
$function$;

CREATE OR REPLACE FUNCTION admin_support_private.is_active_admin(p_subject uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select exists(
  select 1 from public.admin_assignments a
  join public.admin_roles r on r.id=a.role_id and r.enabled
  where a.auth_user_id=(select p_subject) and a.enabled
) $function$;


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



create function admin_support_private.module_visible(p_subject uuid,p_module text) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare c jsonb:=admin_support_private.get_admin_access_context(p_subject); required text; sections text[]; begin
 if admin_support_private.is_module_admin(p_subject) then return admin_support_private.has_admin_module(p_subject,p_module); end if;
 select permission,section_keys into required,sections from (values ('administrators','authorization.read',array[]::text[]),('screen_permissions','authorization.read',array[]::text[]),('impersonation','affiliates.impersonate',array[]::text[]),('affiliates','affiliates.read',array[]::text[]),('data_exports','data_exports.read',array[]::text[]),('branding','assets.read',array[]::text[]),('banners','banners.read',array['banners']::text[]),('popups','popups.read',array['popups']::text[]),('companies_admin','companies.read',array['companies']::text[]),('documents_admin','documents.read',array['documents']::text[]),('minutes_admin','minutes.read',array['minutes']::text[]),('programs_admin','programs.read',array['programs']::text[]),('noticias','news.read',array['news']::text[]),('education','content.read',array['education','tutorials']::text[]),('marketplace','marketplace.read',array['marketplace']::text[]),('program_products','program_catalog.read',array[]::text[]),('membresias','memberships.read',array[]::text[]),('planes','company_portal.read',array[]::text[]),('requests','program_requests.read',array[]::text[]),('finanzas','program_requests.read',array[]::text[]),('savings','savings.read',array[]::text[]),('fondos','financial_criteria.visibility.read',array[]::text[]),('aprobaciones','popups.read',array[]::text[]),('sindicato','union_content.read',array[]::text[]),('fincat','workflow.read',array[]::text[]),('flujos','workflow.read',array[]::text[]),('convenios','companies.read',array['agreements']::text[]),('catalogos','segmentation.read',array[]::text[]),('roles','authorization.read',array[]::text[]),('pantallas','segmentation.read',array[]::text[]),('secciones','content.read',array[]::text[]),('menus','content.read',array[]::text[]),('formularios','content.read',array[]::text[])) modules(key,permission,section_keys) where key=p_module;
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


insert into admin_support_private.recovery(signature,definition) values ('has_admin_permission(text)',pg_get_functiondef('public.has_admin_permission(text)'::regprocedure));

CREATE OR REPLACE FUNCTION public.has_admin_permission(required_permission text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select admin_support_private.has_admin_permission(auth.uid(),required_permission)
 and case when exists(select 1 from admin_support_private.context()) then
 admin_support_private.has_admin_permission((select subject_auth_user_id from admin_support_private.context()),required_permission) else true end;
$function$;

insert into admin_support_private.recovery(signature,definition) values ('has_section_action(text,text)',pg_get_functiondef('public.has_section_action(text,text)'::regprocedure));

CREATE OR REPLACE FUNCTION public.has_section_action(p_section_key text, p_action text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select case when exists(select 1 from admin_support_private.context()) then
 admin_support_private.has_section_action((select subject_auth_user_id from admin_support_private.context()),p_section_key,p_action)
 and (coalesce((admin_support_private.get_admin_access_context(auth.uid())->>'full_access')::boolean,false)
 or admin_support_private.has_section_action(auth.uid(),p_section_key,p_action))
 else admin_support_private.has_section_action(auth.uid(),p_section_key,p_action) end;
$function$;

insert into admin_support_private.recovery(signature,definition) values ('get_admin_access_context()',pg_get_functiondef('public.get_admin_access_context()'::regprocedure));

CREATE OR REPLACE FUNCTION public.get_admin_access_context()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select admin_support_private.effective_context();
$function$;

insert into admin_support_private.recovery(signature,definition) values ('is_module_admin()',pg_get_functiondef('public.is_module_admin()'::regprocedure));

CREATE OR REPLACE FUNCTION public.is_module_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select admin_support_private.is_module_admin(auth.uid()) or
 (exists(select 1 from admin_support_private.context()) and admin_support_private.is_module_admin((select subject_auth_user_id from admin_support_private.context())));
$function$;

insert into admin_support_private.recovery(signature,definition) values ('has_admin_module(text,text)',pg_get_functiondef('public.has_admin_module(text,text)'::regprocedure));

CREATE OR REPLACE FUNCTION public.has_admin_module(p_module text, p_action text DEFAULT 'read'::text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select case when exists(select 1 from admin_support_private.context()) then
 admin_support_private.module_visible(auth.uid(),p_module)
 and admin_support_private.module_visible((select subject_auth_user_id from admin_support_private.context()),p_module)
 and (not admin_support_private.is_module_admin(auth.uid()) or admin_support_private.has_admin_module(auth.uid(),p_module,p_action))
 and (not admin_support_private.is_module_admin((select subject_auth_user_id from admin_support_private.context()))
 or admin_support_private.has_admin_module((select subject_auth_user_id from admin_support_private.context()),p_module,p_action))
 and (select subject_auth_user_id is not null from admin_support_private.context())
 else admin_support_private.has_admin_module(auth.uid(),p_module,p_action) end;
$function$;

insert into admin_support_private.recovery(signature,definition) values ('module_effective_permissions()',pg_get_functiondef('public.module_effective_permissions()'::regprocedure));

CREATE OR REPLACE FUNCTION public.module_effective_permissions()
 RETURNS text[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select case when exists(select 1 from admin_support_private.context()) then
 array(select jsonb_array_elements_text(admin_support_private.effective_context()->'technical_permissions'))
 else admin_support_private.module_effective_permissions(auth.uid()) end;
$function$;

insert into admin_support_private.recovery(signature,definition) values ('is_active_admin()',pg_get_functiondef('public.is_active_admin()'::regprocedure));

CREATE OR REPLACE FUNCTION public.is_active_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select admin_support_private.is_active_admin(auth.uid()) and case when exists(select 1 from admin_support_private.context()) then
 admin_support_private.is_active_admin((select subject_auth_user_id from admin_support_private.context())) else true end;
$function$;

insert into admin_support_private.recovery(signature,definition) values ('savings_admin_access_allowed()',pg_get_functiondef('public.savings_admin_access_allowed()'::regprocedure));

CREATE OR REPLACE FUNCTION public.savings_admin_access_allowed()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select admin_support_private.savings_admin_access_allowed(auth.uid()) and case when exists(select 1 from admin_support_private.context()) then
 admin_support_private.savings_admin_access_allowed((select subject_auth_user_id from admin_support_private.context())) else true end;
$function$;

insert into admin_support_private.recovery(signature,definition) values ('get_effective_affiliate_id()',pg_get_functiondef('public.get_effective_affiliate_id()'::regprocedure));

CREATE OR REPLACE FUNCTION public.get_effective_affiliate_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$

  select coalesce(
    (
      select s.usuario_contexto_affiliate_id
      from public.impersonation_sessions s
      join public.affiliates a
        on a.id = s.usuario_contexto_affiliate_id
       and not a.is_archived
      where s.actor_real_auth_user_id = (select auth.uid())
        and s.ended_at is null
        and s.expires_at > now()
        and s.actor_auth_session_id = nullif((select auth.jwt()->>'session_id'), '')
        and public.admin_actor_can_impersonate()
      limit 1
    ),
    (
      select a.id
      from public.affiliates a
      join auth.users u on u.id = (select auth.uid())
      where a.auth_user_id = u.id
        and not a.is_archived
        and u.email_confirmed_at is not null
        and lower(btrim(u.email)) <> ''
        and (
          (
            a.historical_email_normalized = lower(btrim(u.email))
            and (
              select count(*)
              from public.affiliates candidate
              where candidate.historical_email_normalized = lower(btrim(u.email))
            ) = 1
          )
          or public.has_certified_affiliate_auth_link(u.id, a.id, u.email)
        )
      limit 1
    )
  )

$function$;

insert into admin_support_private.recovery(signature,definition) values ('get_current_affiliate_access_state()',pg_get_functiondef('public.get_current_affiliate_access_state()'::regprocedure));

CREATE OR REPLACE FUNCTION public.get_current_affiliate_access_state()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$

  with principal as (
    select
      u.id,
      lower(btrim(u.email)) as email,
      u.email_confirmed_at
    from auth.users u
    where u.id = (select auth.uid())
  ),
  direct_link as (
    select a.*
    from public.affiliates a
    where a.auth_user_id = (select auth.uid())
  )
  select case
    when exists(
      select 1
      from public.impersonation_sessions s
      join public.affiliates a on a.id = s.usuario_contexto_affiliate_id
      where s.actor_real_auth_user_id = (select auth.uid())
        and s.ended_at is null
        and s.expires_at > now()
        and s.actor_auth_session_id = nullif((select auth.jwt()->>'session_id'), '')
        and public.admin_actor_can_impersonate()
        and a.is_archived
    ) then 'ARCHIVED'
    when exists(
      select 1
      from public.impersonation_sessions s
      join public.affiliates a on a.id = s.usuario_contexto_affiliate_id
      where s.actor_real_auth_user_id = (select auth.uid())
        and s.ended_at is null
        and s.expires_at > now()
        and s.actor_auth_session_id = nullif((select auth.jwt()->>'session_id'), '')
        and public.admin_actor_can_impersonate()
        and not a.is_archived
    ) then 'ACTIVE'
    when (select count(*) from direct_link) = 0 then 'UNLINKED'
    when (select count(*) from direct_link) <> 1 then 'IDENTITY_MISMATCH'
    when (select is_archived from direct_link limit 1) then 'ARCHIVED'
    when not exists(
      select 1
      from principal p
      where p.email is not null
        and p.email <> ''
        and p.email_confirmed_at is not null
    ) then 'IDENTITY_MISMATCH'
    when exists(
      select 1
      from principal p
      join direct_link a on a.auth_user_id = p.id
      where public.has_certified_affiliate_auth_link(p.id, a.id, p.email)
    ) then 'ACTIVE'
    when not exists(
      select 1
      from principal p
      join direct_link a
        on a.auth_user_id = p.id
       and a.historical_email_normalized = p.email
    ) then 'IDENTITY_MISMATCH'
    when (
      select count(*)
      from public.affiliates a
      join principal p on a.historical_email_normalized = p.email
    ) <> 1 then 'AMBIGUOUS_IDENTITY'
    else 'ACTIVE'
  end

$function$;

insert into admin_support_private.recovery(signature,definition) values ('get_impersonation_context()',pg_get_functiondef('public.get_impersonation_context()'::regprocedure));

CREATE OR REPLACE FUNCTION public.get_impersonation_context()
 RETURNS TABLE(session_id uuid, actor_real_auth_user_id uuid, usuario_contexto_affiliate_id uuid, reason text, expires_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select s.id,s.actor_real_auth_user_id,s.usuario_contexto_affiliate_id,s.reason,s.expires_at
 from public.impersonation_sessions s join public.affiliates a on a.id=s.usuario_contexto_affiliate_id and not a.is_archived
 where s.actor_real_auth_user_id=(select auth.uid()) and s.ended_at is null and s.expires_at>now()
   and s.actor_auth_session_id=nullif((select auth.jwt()->>'session_id'),'')
   and public.admin_actor_can_impersonate() limit 1 
$function$;

insert into admin_support_private.recovery(signature,definition) values ('start_affiliate_impersonation(uuid,text)',pg_get_functiondef('public.start_affiliate_impersonation(uuid,text)'::regprocedure));

CREATE OR REPLACE FUNCTION public.start_affiliate_impersonation(p_affiliate_id uuid, p_reason text)
 RETURNS TABLE(session_id uuid, affiliate_id uuid, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

declare
  v_actor uuid:=auth.uid();v_auth_session text:=nullif(auth.jwt()->>'session_id','');v_created public.impersonation_sessions%rowtype;v_archived boolean;
begin
  if v_actor is null or not public.admin_actor_can_impersonate() then raise exception 'IMPERSONATION_DENIED' using errcode='42501'; end if;
  if v_auth_session is null then raise exception 'AUTH_SESSION_REQUIRED' using errcode='42501'; end if;
  if char_length(btrim(coalesce(p_reason,'')))<8 then raise exception 'REASON_REQUIRED' using errcode='22023'; end if;
  select a.is_archived into v_archived from public.affiliates a where a.id=p_affiliate_id;
  if v_archived is null then raise exception 'AFFILIATE_NOT_FOUND' using errcode='P0001'; end if;
  if v_archived then raise exception 'AFFILIATE_ARCHIVED' using errcode='42501'; end if;
  with closed as (
    update public.impersonation_sessions s set ended_at=now(),ended_by_auth_user_id=v_actor
    where s.actor_real_auth_user_id=v_actor and s.ended_at is null
      and (s.expires_at<=now() or s.actor_auth_session_id is distinct from v_auth_session)
    returning s.*
  ) insert into public.identity_audit_log(actor_real_auth_user_id,usuario_contexto_affiliate_id,action,result,details)
    select v_actor,c.usuario_contexto_affiliate_id,'IMPERSONATION_STOPPED','SUCCESS',jsonb_build_object(
      'session_id',c.id,'reason',c.reason,'automatic',true,'cause','AUTH_SESSION_REPLACED_OR_EXPIRED') from closed c;
  if exists(select 1 from public.impersonation_sessions s where s.actor_real_auth_user_id=v_actor and s.ended_at is null) then
    raise exception 'IMPERSONATION_ALREADY_ACTIVE' using errcode='P0001';
  end if;
  insert into public.impersonation_sessions(actor_real_auth_user_id,usuario_contexto_affiliate_id,reason,expires_at,actor_auth_session_id)
  values(v_actor,p_affiliate_id,btrim(p_reason),now()+interval '30 minutes',v_auth_session) returning * into v_created;
  insert into public.identity_audit_log(actor_real_auth_user_id,usuario_contexto_affiliate_id,action,result,details)
  values(v_actor,p_affiliate_id,'IMPERSONATION_STARTED','SUCCESS',jsonb_build_object(
    'session_id',v_created.id,'expires_at',v_created.expires_at,'reason',v_created.reason,
    'actor_auth_session_id',v_auth_session,'scope','ASSISTED_AFFILIATE_SERVICE'));
  return query select v_created.id,v_created.usuario_contexto_affiliate_id,v_created.expires_at;
end 
$function$;

insert into admin_support_private.recovery(signature,definition) values ('stop_affiliate_impersonation()',pg_get_functiondef('public.stop_affiliate_impersonation()'::regprocedure));

CREATE OR REPLACE FUNCTION public.stop_affiliate_impersonation()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

declare v_actor uuid:=auth.uid();v_active public.impersonation_sessions%rowtype;
begin
  if v_actor is null or not public.admin_actor_can_impersonate() then
    raise exception 'IMPERSONATION_DENIED' using errcode='42501';
  end if;
  if nullif(auth.jwt()->>'session_id','') is null then raise exception 'AUTH_SESSION_REQUIRED' using errcode='42501'; end if;
  select * into v_active from public.impersonation_sessions
  where actor_real_auth_user_id=v_actor and ended_at is null
    and actor_auth_session_id=nullif(auth.jwt()->>'session_id','')
  order by started_at desc limit 1 for update;
  if v_active.id is null then return false; end if;
  update public.impersonation_sessions set ended_at=now(),ended_by_auth_user_id=v_actor where id=v_active.id;
  insert into public.identity_audit_log(actor_real_auth_user_id,usuario_contexto_affiliate_id,action,result,details)
  values(v_actor,v_active.usuario_contexto_affiliate_id,'IMPERSONATION_STOPPED','SUCCESS',jsonb_build_object(
    'session_id',v_active.id,'reason',v_active.reason,'manual',true,'actor_auth_session_id',v_active.actor_auth_session_id));
  return true;
end 
$function$;

insert into admin_support_private.recovery(signature,definition) values ('search_affiliates_for_impersonation(text)',pg_get_functiondef('public.search_affiliates_for_impersonation(text)'::regprocedure));

CREATE OR REPLACE FUNCTION public.search_affiliates_for_impersonation(p_query text)
 RETURNS TABLE(id uuid, numero_control text, display_name text, full_name text, auth_eligibility text, email text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 begin
  if not public.admin_actor_can_impersonate() then raise exception 'IMPERSONATION_DENIED' using errcode='42501'; end if;
  if char_length(btrim(coalesce(p_query,'')))<2 then return; end if;
  return query select a.id,a.numero_control,a.display_name,a.full_name,a.auth_eligibility,u.email::text
  from public.affiliates a left join auth.users u on u.id=a.auth_user_id
  where not a.is_archived and (
    a.numero_control ilike '%'||btrim(p_query)||'%' or a.display_name ilike '%'||btrim(p_query)||'%'
    or a.full_name ilike '%'||btrim(p_query)||'%' or u.email ilike '%'||btrim(p_query)||'%')
  order by a.source_row_ordinal limit 20;
end 
$function$;

insert into admin_support_private.recovery(signature,definition) values ('resolve_current_loan_snapshot_quote(uuid,text,numeric,integer)',pg_get_functiondef('public.resolve_current_loan_snapshot_quote(uuid,text,numeric,integer)'::regprocedure));

CREATE OR REPLACE FUNCTION public.resolve_current_loan_snapshot_quote(p_snapshot_id uuid, p_program_id text, p_amount numeric, p_term integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

declare
  v_actor uuid := auth.uid();
  v_affiliate_id uuid;
  v_impersonation_id uuid;
  v_snapshot public.financial_session_snapshots%rowtype;
  v_affiliate record;
  v_policy public.loan_term_policy%rowtype;
  v_policy_json jsonb;
  v_profile_canonical text;
  v_policy_canonical text;
  v_profile_fingerprint text;
  v_policy_fingerprint text;
  v_quote jsonb;
  v_payroll jsonb;
begin
  if v_actor is null or coalesce(auth.role(),'') <> 'authenticated' then
    raise exception 'AUTH_REQUIRED' using errcode='42501';
  end if;
  if p_snapshot_id is null or nullif(btrim(p_program_id),'') is null or p_amount is null or p_amount<=0 or p_term is null or p_term<=0 then
    raise exception 'INVALID_REQUEST' using errcode='22023';
  end if;

  v_affiliate_id := public.get_effective_affiliate_id();
  if v_affiliate_id is null then raise exception 'AFFILIATE_CONTEXT_UNAVAILABLE' using errcode='42501'; end if;
  select s.id into v_impersonation_id
  from public.impersonation_sessions s
  where s.actor_real_auth_user_id=v_actor and s.ended_at is null and s.expires_at>now()
    and public.admin_actor_can_impersonate()
  limit 1;

  select a.*,u.label as current_financial_union,c.label as current_financial_category
    into v_affiliate
  from public.affiliates a
  left join public.segmentation_catalog_entries u
    on u.catalog_type='union' and u.code=a.financial_union_code and u.enabled
  left join public.segmentation_catalog_entries c
    on c.catalog_type='employment_category' and c.code=a.financial_employee_category_code and c.enabled
  where a.id=v_affiliate_id;
  if v_affiliate.id is null or v_affiliate.current_financial_union is null or v_affiliate.current_financial_category is null then
    raise exception 'AFFILIATE_FINANCIAL_PROFILE_INCOMPLETE' using errcode='P0001';
  end if;

  select * into v_snapshot from public.financial_session_snapshots where id=p_snapshot_id for key share;
  if v_snapshot.id is null
     or v_snapshot.actor_real_auth_user_id<>v_actor
     or v_snapshot.affiliate_id<>v_affiliate_id
     or v_snapshot.impersonation_session_id is distinct from v_impersonation_id
     or v_snapshot.invalidated_at is not null
     or v_snapshot.expires_at<=now()
     or v_snapshot.financial_profile_version<>v_affiliate.financial_profile_version
     or v_snapshot.calculation_contract_version<>'SUTI_LOAN_QUOTE_V1' then
    raise exception 'SNAPSHOT_INVALID' using errcode='P0001';
  end if;

  v_profile_canonical := '{'
    ||'"actor_real_auth_user_id":'||to_jsonb(v_actor::text)::text
    ||',"affiliate_id":'||to_jsonb(v_affiliate_id::text)::text
    ||',"financial_affiliation_status":'||coalesce(to_jsonb(v_affiliate.financial_affiliation_status)::text,'null')
    ||',"financial_employee_category":'||coalesce(to_jsonb(v_affiliate.current_financial_category)::text,'null')
    ||',"financial_employee_category_code":'||coalesce(to_jsonb(v_affiliate.financial_employee_category_code)::text,'null')
    ||',"financial_employee_type":'||coalesce(to_jsonb(v_affiliate.financial_employee_type)::text,'null')
    ||',"financial_employment_status":'||coalesce(to_jsonb(v_affiliate.financial_employment_status)::text,'null')
    ||',"financial_profile_version":'||to_jsonb(v_affiliate.financial_profile_version)::text
    ||',"financial_union":'||coalesce(to_jsonb(v_affiliate.current_financial_union)::text,'null')
    ||',"financial_union_code":'||coalesce(to_jsonb(v_affiliate.financial_union_code)::text,'null')
    ||',"impersonation_session_id":'||coalesce(to_jsonb(v_impersonation_id::text)::text,'null')||'}';
  v_profile_fingerprint := upper(encode(extensions.digest(convert_to(v_profile_canonical,'UTF8'),'sha256'),'hex'));
  if v_snapshot.profile_fingerprint<>v_profile_fingerprint then
    raise exception 'SNAPSHOT_INVALID' using errcode='P0001';
  end if;
  if exists(
    select 1 from jsonb_array_elements(v_snapshot.eligible_rules) as candidate(value)
    where public.normalize_suti_financial_key(value->>'union')<>public.normalize_suti_financial_key(v_affiliate.current_financial_union)
       or public.normalize_suti_financial_key(value->>'category')<>public.normalize_suti_financial_key(v_affiliate.current_financial_category)
  ) then raise exception 'SNAPSHOT_INVALID' using errcode='P0001'; end if;

  select * into v_policy from public.loan_term_policy where id='primary' and enabled;
  if v_policy.id is null then raise exception 'LOAN_TERM_POLICY_UNAVAILABLE' using errcode='P0001'; end if;
  v_policy_json := jsonb_build_object(
    'source','SUPABASE_LOAN_TERM_POLICY','standardTerms',v_policy.standard_terms,
    'customMinTerm',v_policy.custom_min_term,'customStep',v_policy.custom_step,
    'decisionReference',v_policy.decision_reference
  );
  v_policy_canonical := '{'
    ||'"customMinTerm":'||v_policy.custom_min_term::text
    ||',"customStep":'||v_policy.custom_step::text
    ||',"decisionReference":'||to_jsonb(v_policy.decision_reference)::text
    ||',"source":"SUPABASE_LOAN_TERM_POLICY"'
    ||',"standardTerms":['||array_to_string(v_policy.standard_terms,',')||']}';
  v_policy_fingerprint := upper(encode(extensions.digest(convert_to(v_policy_canonical,'UTF8'),'sha256'),'hex'));
  if v_snapshot.term_policy_fingerprint<>v_policy_fingerprint then
    raise exception 'SNAPSHOT_INVALID' using errcode='P0001';
  end if;

  v_quote := public.resolve_suti_loan_quote_contract(
    v_snapshot.eligible_rules,v_affiliate.current_financial_union,v_affiliate.current_financial_category,
    p_program_id,p_amount,p_term,v_policy_json
  );
  begin
    v_payroll := public.get_current_declared_payroll_impact((v_quote->>'paymentPerPeriod')::numeric);
  exception when others then
    v_payroll := jsonb_build_object('status','ERROR','source','SUPABASE_DECLARED_PAYROLL','guidelinePercent',30);
  end;
  return v_quote || jsonb_build_object(
    'payrollImpact',v_payroll,
    'loanSession',jsonb_build_object('id',v_snapshot.id,'expires_at',v_snapshot.expires_at,
      'financial_profile_version',v_snapshot.financial_profile_version),
    'googleResolutionCount',0
  );
end 
$function$;

insert into admin_support_private.recovery(signature,definition) values ('list_admin_module_catalog()',pg_get_functiondef('public.list_admin_module_catalog()'::regprocedure));

CREATE OR REPLACE FUNCTION public.list_admin_module_catalog()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$

begin
 if not public.has_admin_permission('authorization.read') then raise exception 'AUTHORIZATION_DENIED' using errcode='42501'; end if;
 return (select jsonb_agg(jsonb_build_object('key',module_key,'label',display_name,'total_only',module_total_only) order by module_order)
 from public.admin_section_definitions where module_key is not null and enforcement_status='ENFORCED');
end 
$function$;

insert into admin_support_private.recovery(signature,definition) values ('get_admin_user_modules(text)',pg_get_functiondef('public.get_admin_user_modules(text)'::regprocedure));

CREATE OR REPLACE FUNCTION public.get_admin_user_modules(p_email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$

declare ids uuid[]; target uuid; result jsonb; begin
 if not public.has_admin_permission('authorization.write') then raise exception 'AUTHORIZATION_DENIED' using errcode='42501'; end if;
 select array_agg(id) into ids from auth.users where lower(email)=lower(btrim(p_email)) and email_confirmed_at is not null;
 if coalesce(cardinality(ids),0)<>1 then raise exception 'CONFIRMED_AUTH_USER_NOT_FOUND_OR_AMBIGUOUS'; end if;
 target:=ids[1];
 select jsonb_build_object('auth_user_id',target,'email',u.email,
  'mode',case when a.enabled and r.code='principal_admin' then 'total' when a.enabled and r.code='module_admin' then 'limited' else 'unassigned' end,
  'existing_role',case when a.enabled then r.name else null end,'protected',coalesce(a.protected_assignment,false),'self',(target=auth.uid() or coalesce(target=(select subject_auth_user_id from admin_support_private.context()),false)),
  'version',public.admin_user_module_version(target),
  'modules',coalesce((select jsonb_agg(d.module_key order by d.module_order) from public.admin_section_responsibilities g
   join public.admin_section_definitions d on d.section_key=g.section_key
   where g.auth_user_id=target and g.enabled and g.action='read' and d.module_key is not null),'[]'::jsonb)) into result
 from auth.users u left join public.admin_assignments a on a.auth_user_id=u.id left join public.admin_roles r on r.id=a.role_id where u.id=target;
 return result;
end 
$function$;

insert into admin_support_private.recovery(signature,definition) values ('save_admin_user_modules(text,text,text[],text)',pg_get_functiondef('public.save_admin_user_modules(text,text,text[],text)'::regprocedure));

CREATE OR REPLACE FUNCTION public.save_admin_user_modules(p_email text, p_mode text, p_modules text[], p_expected_version text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

declare target uuid; before_state jsonb; selected_role uuid; selected_modules text[]; begin
 if not public.has_admin_permission('authorization.write') then raise exception 'AUTHORIZATION_DENIED' using errcode='42501'; end if;
 before_state:=public.get_admin_user_modules(p_email);target:=(before_state->>'auth_user_id')::uuid;
 if target=auth.uid() or coalesce(target=(select subject_auth_user_id from admin_support_private.context()),false) then raise exception 'SELF_ASSIGNMENT_DENIED' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('admin-user-modules:'||target::text,0));
 perform 1 from public.admin_assignments where auth_user_id=target for update;
 if p_expected_version is null or p_expected_version<>public.admin_user_module_version(target) then raise exception 'ADMIN_ACCESS_CHANGED' using errcode='40001'; end if;
 if p_mode is null or p_mode not in ('limited','total') then raise exception 'INVALID_ACCESS_MODE'; end if;
 select coalesce(array_agg(distinct m order by m),'{}') into selected_modules from unnest(p_modules) m;
 if p_mode='limited' and (cardinality(selected_modules)=0 or exists(select 1 from unnest(selected_modules) m
  where not exists(select 1 from public.admin_section_definitions d where d.module_key=m and not d.module_total_only and d.enforcement_status='ENFORCED'))) then
  raise exception 'INVALID_ADMIN_MODULE'; end if;
 select id into selected_role from public.admin_roles where code=case when p_mode='total' then 'principal_admin' else 'module_admin' end and enabled;
 if selected_role is null then raise exception 'ADMIN_ROLE_UNAVAILABLE'; end if;
 -- Existing writer preserves protected/last-admin guards, actor metadata and session revocation.
 perform public.assign_admin_role(target,selected_role,true);
 update public.admin_section_responsibilities set enabled=false,revoked_at=now(),revoked_by_auth_user_id=auth.uid(),updated_at=now()
 where auth_user_id=target and enabled;
 if p_mode='limited' then
  insert into public.admin_section_responsibilities(auth_user_id,section_key,action,enabled,granted_by_auth_user_id)
  select target,d.section_key,a,true,auth.uid() from public.admin_section_definitions d cross join unnest(array['read','update']) a
  where d.module_key=any(selected_modules)
  on conflict(auth_user_id,section_key,action) do update set enabled=true,granted_by_auth_user_id=excluded.granted_by_auth_user_id,
   assigned_at=now(),updated_at=now(),revoked_at=null,revoked_by_auth_user_id=null;
 end if;
 insert into public.admin_audit_log(actor_auth_user_id,resource,action,target_id,result,details)
 values(auth.uid(),'admin_user_modules','SET',target::text,'SUCCESS',jsonb_build_object('before',before_state,'mode',p_mode,'modules',to_jsonb(selected_modules)));
 return public.get_admin_user_modules(p_email);
end 
$function$;

insert into admin_support_private.recovery(signature,definition) values ('assign_admin_role(uuid,uuid,boolean)',pg_get_functiondef('public.assign_admin_role(uuid,uuid,boolean)'::regprocedure));

CREATE OR REPLACE FUNCTION public.assign_admin_role(p_auth_user_id uuid, p_role_id uuid, p_enabled boolean DEFAULT true)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

declare
  v_actor uuid:=auth.uid();v_id uuid;v_permissions text[];v_before jsonb;v_after jsonb;
begin
  if v_actor is null or not public.has_admin_permission('authorization.write') then
    raise exception 'AUTHORIZATION_DENIED' using errcode='42501';
  end if;
  if p_auth_user_id=v_actor or coalesce(p_auth_user_id=(select subject_auth_user_id from admin_support_private.context()),false) then raise exception 'SELF_ASSIGNMENT_DENIED' using errcode='42501'; end if;
  if not exists(select 1 from auth.users where id=p_auth_user_id and email_confirmed_at is not null) then
    raise exception 'CONFIRMED_AUTH_USER_NOT_FOUND' using errcode='P0001';
  end if;
  if not exists(select 1 from public.admin_roles where id=p_role_id and enabled) then
    raise exception 'ROLE_NOT_FOUND' using errcode='P0001';
  end if;
  select to_jsonb(a) into v_before from public.admin_assignments a where a.auth_user_id=p_auth_user_id for update;
  if coalesce((v_before->>'protected_assignment')::boolean,false) and
     (not p_enabled or (v_before->>'role_id')::uuid is distinct from p_role_id) then
    raise exception 'PROTECTED_SUPERADMIN' using errcode='42501';
  end if;
  select array_agg(permission order by permission) into v_permissions
  from public.admin_role_permissions where role_id=p_role_id;
  insert into public.admin_assignments(
    auth_user_id,role,role_id,permissions,enabled,assigned_at,assigned_by_auth_user_id,
    revoked_at,revoked_by_auth_user_id,protected_assignment
  ) values(
    p_auth_user_id,'visual_admin',p_role_id,coalesce(v_permissions,'{}'),p_enabled,now(),v_actor,
    case when p_enabled then null else now() end,case when p_enabled then null else v_actor end,false
  )
  on conflict(auth_user_id) do update set
    role_id=excluded.role_id,permissions=excluded.permissions,enabled=excluded.enabled,
    assigned_at=case when excluded.enabled then now() else admin_assignments.assigned_at end,
    assigned_by_auth_user_id=case when excluded.enabled then v_actor else admin_assignments.assigned_by_auth_user_id end,
    revoked_at=excluded.revoked_at,revoked_by_auth_user_id=excluded.revoked_by_auth_user_id,updated_at=now()
  returning id into v_id;
  select to_jsonb(a) into v_after from public.admin_assignments a where a.id=v_id;
  if not exists(
    select 1 from public.admin_assignments a join public.admin_roles r on r.id=a.role_id
    where a.enabled and r.code='principal_admin'
  ) then raise exception 'LAST_PRINCIPAL_ADMIN_REQUIRED' using errcode='23514'; end if;
  if not p_enabled or not ('affiliates.impersonate'=any(coalesce(v_permissions,'{}'))) then
    with closed as (
      update public.impersonation_sessions s set ended_at=now(),ended_by_auth_user_id=v_actor
      where s.actor_real_auth_user_id=p_auth_user_id and s.ended_at is null returning s.*
    ) insert into public.identity_audit_log(actor_real_auth_user_id,usuario_contexto_affiliate_id,action,result,details)
      select v_actor,c.usuario_contexto_affiliate_id,'IMPERSONATION_STOPPED','SUCCESS',jsonb_build_object(
        'session_id',c.id,'reason',c.reason,'automatic',true,'cause','ADMIN_ASSIGNMENT_REVOKED','session_actor_auth_user_id',c.actor_real_auth_user_id)
      from closed c;
  end if;
  insert into public.admin_audit_log(actor_auth_user_id,resource,action,target_id,result,details)
  values(v_actor,'admin_assignments',case when p_enabled then 'UPSERT' else 'REVOKE' end,v_id::text,'SUCCESS',
    jsonb_build_object('subject_auth_user_id',p_auth_user_id,'before',v_before,'after',v_after,'assigned_by_auth_user_id',v_actor));
  return v_id;
end 
$function$;


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
