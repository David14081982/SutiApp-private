begin;

-- Operational exports are derived, short-lived files. They never become a
-- database backup or a second source of truth.
create table public.data_export_audit_log (
  export_id uuid primary key default extensions.gen_random_uuid(),
  actor_id uuid not null references auth.users(id) on delete restrict,
  domain text not null check (domain ~ '^[a-z][a-z0-9_]{2,63}$'),
  filters jsonb not null default '{}'::jsonb check (jsonb_typeof(filters)='object'),
  row_count integer not null check (row_count >= 0),
  format text not null check (format in ('xlsx','csv')),
  status text not null default 'SUCCESS' check (status in ('SUCCESS','FAILURE')),
  column_set text[] not null check (cardinality(column_set) > 0),
  created_at timestamptz not null default now()
);
create index data_export_audit_actor_created_idx on public.data_export_audit_log(actor_id,created_at desc);
create index data_export_audit_domain_created_idx on public.data_export_audit_log(domain,created_at desc);

alter table public.data_export_audit_log enable row level security;
alter table public.data_export_audit_log force row level security;
revoke all on public.data_export_audit_log from public,anon,authenticated;
grant select on public.data_export_audit_log to authenticated;
create policy data_export_audit_authorized_read on public.data_export_audit_log
for select to authenticated using(public.has_admin_permission('data_exports.read'));

-- Technical global permission. It is intentionally granted only to the
-- protected principal role; custom roles may receive it through save_admin_role.
alter table public.admin_assignments drop constraint admin_assignments_permissions_check;
alter table public.admin_assignments add constraint admin_assignments_permissions_check check (permissions <@ array[
  'assets.read','assets.write','companies.read','companies.write','popups.read','popups.write',
  'banners.read','banners.write','documents.read','documents.write','affiliates.read','affiliates.write','affiliates.impersonate',
  'news.read','news.write','content.read','content.write','marketplace.read','marketplace.write',
  'marketplace.quotes.read','marketplace.quotes.write','memberships.read','memberships.write',
  'company_portal.read','company_portal.write','program_requests.read','program_requests.write',
  'authorization.read','authorization.write','segmentation.read','segmentation.write',
  'workflow.read','workflow.write','union_content.read','union_content.write','data_exports.read'
]::text[]);
insert into public.admin_role_permissions(role_id,permission)
select id,'data_exports.read' from public.admin_roles where code='principal_admin'
on conflict do nothing;
update public.admin_assignments a
set permissions=(select array_agg(permission order by permission) from public.admin_role_permissions where role_id=a.role_id),updated_at=now()
where a.enabled;

create or replace function public.save_admin_role(p_role_id uuid,p_name text,p_description text,p_permissions text[])
returns uuid language plpgsql security definer set search_path=''
as $$ declare v_id uuid; v_allowed text[]:=array[
  'assets.read','assets.write','companies.read','companies.write','popups.read','popups.write','banners.read','banners.write',
  'documents.read','documents.write','affiliates.read','affiliates.write','affiliates.impersonate','news.read','news.write','content.read','content.write',
  'marketplace.read','marketplace.write','marketplace.quotes.read','marketplace.quotes.write','memberships.read','memberships.write',
  'company_portal.read','company_portal.write','program_requests.read','program_requests.write','authorization.read','authorization.write',
  'segmentation.read','segmentation.write','workflow.read','workflow.write','union_content.read','union_content.write','data_exports.read'];
begin
  if not public.has_admin_permission('authorization.write') then raise exception 'AUTHORIZATION_DENIED' using errcode='42501'; end if;
  if p_permissions is null or exists(select 1 from unnest(p_permissions) p where not(p=any(v_allowed))) then raise exception 'INVALID_PERMISSION' using errcode='22023'; end if;
  if p_role_id is null then
    insert into public.admin_roles(code,name,description) values('role_'||replace(extensions.gen_random_uuid()::text,'-',''),btrim(p_name),coalesce(p_description,'')) returning id into v_id;
  else
    if exists(select 1 from public.admin_roles where id=p_role_id and system_role) then raise exception 'SYSTEM_ROLE_IMMUTABLE' using errcode='P0001'; end if;
    update public.admin_roles set name=btrim(p_name),description=coalesce(p_description,''),updated_at=now() where id=p_role_id returning id into v_id;
    if v_id is null then raise exception 'ROLE_NOT_FOUND' using errcode='P0001'; end if;
    delete from public.admin_role_permissions where role_id=v_id;
  end if;
  insert into public.admin_role_permissions(role_id,permission) select v_id,p from (select distinct unnest(p_permissions) p) q;
  update public.admin_assignments a set permissions=(select array_agg(permission order by permission) from public.admin_role_permissions where role_id=v_id),updated_at=now() where role_id=v_id;
  insert into public.admin_audit_log(actor_auth_user_id,resource,action,target_id,result) values(auth.uid(),'admin_roles',case when p_role_id is null then 'INSERT' else 'UPDATE' end,v_id::text,'SUCCESS');
  return v_id;
end $$;

-- Export is independent from read/edit/publish. Section owners receive it only
-- when an authorization administrator grants this exact action.
alter table public.admin_section_definitions drop constraint admin_section_definitions_allowed_actions_check;
alter table public.admin_section_definitions add constraint admin_section_definitions_allowed_actions_check check (
  allowed_actions <@ array['read','create','update','delete','publish','order','assets','export']::text[]
  and cardinality(allowed_actions)>0
);
alter table public.admin_section_responsibilities drop constraint admin_section_responsibilities_action_check;
alter table public.admin_section_responsibilities add constraint admin_section_responsibilities_action_check
  check(action in ('read','create','update','delete','publish','order','assets','export'));
update public.admin_section_definitions
set allowed_actions=array(select distinct action from unnest(allowed_actions||array['export']) action),updated_at=now()
where enforcement_status='ENFORCED';

comment on table public.data_export_audit_log is
  'Metadata-only audit for authorized operational exports; exported rows and generated files are never persisted here.';
comment on column public.data_export_audit_log.filters is
  'Validated filters only; never exported row content, credentials, tokens, or private document URLs.';
comment on column public.data_export_audit_log.column_set is
  'Immutable export profile columns selected by the server-side domain allowlist.';

commit;
