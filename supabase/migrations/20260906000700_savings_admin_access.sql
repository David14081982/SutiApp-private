begin;
create table public.savings_access_definition_backup(name text primary key,definition text not null,applied_definition text);
alter table public.savings_access_definition_backup enable row level security;
alter table public.savings_access_definition_backup force row level security;
revoke all on public.savings_access_definition_backup from public,anon,authenticated,service_role;
insert into public.savings_access_definition_backup(name,definition)
 select proname,pg_get_functiondef(oid) from pg_proc where pronamespace='public'::regnamespace
 and proname in ('has_admin_permission','get_admin_access_context','get_admin_savings_review','admin_save_savings_review');
do $$ declare definition text; begin
 if (select count(*) from public.savings_access_definition_backup)<>4 or exists(select 1 from public.admin_section_definitions where section_key='savings') then raise exception 'SAVINGS_ACCESS_PREREQUISITE_CHANGED'; end if;
 select b.definition into definition from public.savings_access_definition_backup b where name='has_admin_permission';
 execute replace(definition,'public.has_admin_permission(', 'public.savings_permission_before_20260906(');
 select b.definition into definition from public.savings_access_definition_backup b where name='get_admin_access_context';
 execute replace(definition,'public.get_admin_access_context(', 'public.savings_context_before_20260906(');
end $$;
revoke all on function public.savings_permission_before_20260906(text),public.savings_context_before_20260906() from public,anon,authenticated,service_role;

create table public.savings_admin_access_mode (
 id boolean primary key default true check(id), mode text not null check(mode in ('OPEN','RESTRICTED')),
 version integer not null default 0, updated_at timestamptz not null default now()
);
insert into public.savings_admin_access_mode(id,mode) values(true,'OPEN');
create table public.savings_admin_access_events (
 id uuid primary key default extensions.gen_random_uuid(),actor_auth_user_id uuid not null,
 created_at timestamptz not null default clock_timestamp(),before_mode text not null,after_mode text not null,
 before_version integer not null,after_version integer not null,client_action_id uuid not null unique
);
alter table public.savings_admin_access_mode enable row level security;
alter table public.savings_admin_access_mode force row level security;
alter table public.savings_admin_access_events enable row level security;
alter table public.savings_admin_access_events force row level security;
revoke all on public.savings_admin_access_mode,public.savings_admin_access_events from public,anon,authenticated,service_role;
create function public.savings_access_history_guard() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'SAVINGS_ACCESS_HISTORY_IMMUTABLE'; end $$;
create trigger savings_access_history_guard before update or delete on public.savings_admin_access_events for each row execute function public.savings_access_history_guard();
insert into public.admin_section_definitions(section_key,display_name,data_boundary,allowed_actions,enforcement_status)
 values('savings','Ahorro · Revisión privada','Private savings review; no financial posting or publication',array['read','update'],'ENFORCED');

create function public.savings_admin_access_allowed() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (
  public.savings_permission_before_20260906('authorization.write') or
  public.has_section_action('savings','read') or
  ((select mode from public.savings_admin_access_mode where id)='OPEN' and public.savings_permission_before_20260906('savings.read'))
 );
$$;
create or replace function public.has_admin_permission(required_permission text) returns boolean language sql stable security definer set search_path='' as $$
 select case when required_permission like 'savings.%' then
  public.savings_admin_access_allowed() and (public.savings_permission_before_20260906(required_permission)
   or (required_permission='savings.read' and public.has_section_action('savings','read')))
 else public.savings_permission_before_20260906(required_permission) end;
$$;
create function public.savings_review_edit_allowed() returns boolean language sql stable security definer set search_path='' as $$
 select public.savings_admin_access_allowed() and (public.savings_permission_before_20260906('savings.write') or public.has_section_action('savings','update'));
$$;
create function public.savings_review_identity_allowed() returns boolean language sql stable security definer set search_path='' as $$
 select public.savings_admin_access_allowed() and (public.savings_permission_before_20260906('savings.identity_review') or public.has_section_action('savings','update'));
$$;
create or replace function public.get_admin_access_context() returns jsonb language sql stable security definer set search_path='' as $$
 select original || jsonb_build_object('technical_permissions',coalesce((
  select jsonb_agg(permission order by permission) from (
   select value as permission from jsonb_array_elements_text(original->'technical_permissions')
    where value not like 'savings.%' or public.has_admin_permission(value)
   union select 'savings.read' where public.has_section_action('savings','read') and public.savings_admin_access_allowed()
  ) permissions),'[]'::jsonb))
 from (select public.savings_context_before_20260906() original) context;
$$;
do $rewrite$ declare original text; changed text; begin
 for original in select definition from public.savings_access_definition_backup where name in ('get_admin_savings_review','admin_save_savings_review') loop
  changed:=replace(replace(original, $$public.has_admin_permission('savings.write')$$,$$public.savings_review_edit_allowed()$$),
   $$public.has_admin_permission('savings.identity_review')$$,$$public.savings_review_identity_allowed()$$);
  if changed=original then raise exception 'SAVINGS_REVIEW_PERMISSION_CONTRACT_CHANGED'; end if;
  execute changed;
 end loop;
end $rewrite$;

create function public.get_savings_admin_access() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; manager boolean:=public.has_admin_permission('authorization.write'); begin
 if auth.uid() is null or not(manager or public.savings_admin_access_allowed()) then raise exception 'SAVINGS_ACCESS_DENIED' using errcode='42501'; end if;
 select to_jsonb(m)||jsonb_build_object('can_manage',manager,'members',case when manager then coalesce((
  select jsonb_agg(to_jsonb(x) order by x.email) from (select r.auth_user_id,u.email,array_agg(r.action order by r.action) actions,
   max(r.assigned_at) assigned_at from public.admin_section_responsibilities r join auth.users u on u.id=r.auth_user_id
   where r.section_key='savings' and r.enabled group by r.auth_user_id,u.email) x),'[]'::jsonb) else '[]'::jsonb end,
  'history',case when manager then coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from public.savings_admin_access_events e),'[]'::jsonb) else '[]'::jsonb end)
 into result from public.savings_admin_access_mode m where m.id;
 return result;
end $$;
create function public.set_savings_admin_access_mode(p_mode text,p_version integer,p_client_action_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare prior public.savings_admin_access_events; current_mode public.savings_admin_access_mode;
begin
 if auth.uid() is null or not public.has_admin_permission('authorization.write') then raise exception 'SAVINGS_ACCESS_DENIED' using errcode='42501'; end if;
 if p_mode is null or p_mode not in ('OPEN','RESTRICTED') or p_version is null or p_client_action_id is null then raise exception 'SAVINGS_ACCESS_INVALID'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_client_action_id::text,607));
 select * into prior from public.savings_admin_access_events where client_action_id=p_client_action_id;
 if found then
  if prior.actor_auth_user_id<>auth.uid() or prior.after_mode<>p_mode or prior.before_version<>p_version then raise exception 'SAVINGS_ACCESS_RETRY_CONFLICT'; end if;
  return jsonb_build_object('mode',prior.after_mode,'version',prior.after_version);
 end if;
 select * into current_mode from public.savings_admin_access_mode where id for update;
 if current_mode.version<>p_version then raise exception 'SAVINGS_ACCESS_CHANGED'; end if;
 update public.savings_admin_access_mode set mode=p_mode,version=version+1,updated_at=clock_timestamp() where id;
 insert into public.savings_admin_access_events(actor_auth_user_id,before_mode,after_mode,before_version,after_version,client_action_id)
 values(auth.uid(),current_mode.mode,p_mode,p_version,p_version+1,p_client_action_id);
 return jsonb_build_object('mode',p_mode,'version',p_version+1);
end $$;
revoke all on function public.savings_access_history_guard(),public.savings_admin_access_allowed(),public.savings_review_edit_allowed(),public.savings_review_identity_allowed(),public.get_savings_admin_access(),public.set_savings_admin_access_mode(text,integer,uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_savings_admin_access(),public.set_savings_admin_access_mode(text,integer,uuid) to authenticated;
update public.savings_access_definition_backup b set applied_definition=pg_get_functiondef(p.oid) from pg_proc p where p.pronamespace='public'::regnamespace and p.proname=b.name;
create trigger savings_access_backup_guard before update or delete on public.savings_access_definition_backup for each row execute function public.savings_access_history_guard();
notify pgrst,'reload schema';
commit;
