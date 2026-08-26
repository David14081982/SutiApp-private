begin;

-- Visibility is a presentation policy stored only in Google
-- `Criterios de fondos!P`. Supabase stores authorization and audit, never an
-- override or a copy of the effective value.
create table public.financial_criteria_visibility_audit (
  operation_id uuid primary key,
  actor_id uuid not null references auth.users(id) on delete restrict,
  criterion_identity text not null check(length(criterion_identity) between 80 and 160),
  fund text not null check(length(btrim(fund)) between 1 and 240),
  sheet_row integer not null check(sheet_row >= 2),
  previous_visibility text null check(previous_visibility is null or previous_visibility in('AUTO','MOSTRAR','OCULTAR')),
  new_visibility text not null check(new_visibility in('AUTO','MOSTRAR','OCULTAR')),
  reason text not null default '' check(length(reason) <= 500),
  source text not null default 'SUTIAPP_ADMIN' check(source='SUTIAPP_ADMIN'),
  status text not null check(status in('PENDING','CONFIRMED','FAILED')),
  error_code text null,
  details jsonb not null default '{}'::jsonb check(jsonb_typeof(details)='object'),
  created_at timestamptz not null default now(),
  changed_at timestamptz null
);
create index financial_criteria_visibility_audit_actor_created_idx
  on public.financial_criteria_visibility_audit(actor_id,created_at desc);
create index financial_criteria_visibility_audit_criterion_created_idx
  on public.financial_criteria_visibility_audit(criterion_identity,created_at desc);

alter table public.financial_criteria_visibility_audit enable row level security;
alter table public.financial_criteria_visibility_audit force row level security;
revoke all on public.financial_criteria_visibility_audit from public,anon,authenticated;
grant select on public.financial_criteria_visibility_audit to authenticated;
create policy financial_criteria_visibility_audit_read on public.financial_criteria_visibility_audit
for select to authenticated using(public.has_admin_permission('financial_criteria.visibility.read'));

alter table public.admin_assignments drop constraint admin_assignments_permissions_check;
alter table public.admin_assignments add constraint admin_assignments_permissions_check check (permissions <@ array[
  'assets.read','assets.write','companies.read','companies.write','popups.read','popups.write',
  'banners.read','banners.write','documents.read','documents.write','affiliates.read','affiliates.write','affiliates.impersonate',
  'news.read','news.write','content.read','content.write','marketplace.read','marketplace.write',
  'marketplace.quotes.read','marketplace.quotes.write','memberships.read','memberships.write',
  'company_portal.read','company_portal.write','program_requests.read','program_requests.write',
  'authorization.read','authorization.write','segmentation.read','segmentation.write',
  'workflow.read','workflow.write','union_content.read','union_content.write','data_exports.read',
  'financial_criteria.visibility.read','financial_criteria.visibility.write'
]::text[]);

insert into public.admin_role_permissions(role_id,permission)
select id,permission from public.admin_roles
cross join unnest(array['financial_criteria.visibility.read','financial_criteria.visibility.write']::text[]) permission
where code='principal_admin'
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
  'segmentation.read','segmentation.write','workflow.read','workflow.write','union_content.read','union_content.write','data_exports.read',
  'financial_criteria.visibility.read','financial_criteria.visibility.write'];
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

comment on table public.financial_criteria_visibility_audit is
  'Durable audit of SutiApp Admin writes confirmed against Google Criterios de fondos!P; never a visibility authority or fallback.';

commit;
