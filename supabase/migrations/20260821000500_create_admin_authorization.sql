begin;

create table public.admin_assignments (
  id uuid primary key default extensions.gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  role text not null default 'visual_admin',
  permissions text[] not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_assignments_role_check check (role = 'visual_admin'),
  constraint admin_assignments_permissions_check check (permissions <@ array[
    'assets.read','assets.write','companies.read','companies.write','popups.read','popups.write',
    'banners.read','banners.write','documents.read','documents.write'
  ]::text[])
);

create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_auth_user_id uuid not null references auth.users(id) on delete restrict,
  resource text not null,
  action text not null,
  target_id text null,
  result text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint admin_audit_result_check check (result in ('SUCCESS','DENIED','FAILURE'))
);

create index admin_audit_actor_created_idx on public.admin_audit_log(actor_auth_user_id, created_at desc);

create function public.has_admin_permission(required_permission text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.admin_assignments a
    where a.auth_user_id = (select auth.uid()) and a.enabled
      and required_permission = any(a.permissions)
  );
$$;

create function public.audit_admin_write()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare row_data jsonb; target text;
begin
  if (select auth.uid()) is null then return coalesce(new, old); end if;
  row_data := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  target := coalesce(row_data->>'id', row_data->>'company_id', row_data->>'asset_id', row_data->>'asset_key');
  insert into public.admin_audit_log(actor_auth_user_id, resource, action, target_id, result)
  values ((select auth.uid()), tg_table_name, tg_op, target, 'SUCCESS');
  return coalesce(new, old);
end;
$$;

create trigger admin_assignments_updated_at before update on public.admin_assignments
for each row execute function public.set_h0072_updated_at();

alter table public.admin_assignments enable row level security;
alter table public.admin_assignments force row level security;
alter table public.admin_audit_log enable row level security;
alter table public.admin_audit_log force row level security;
revoke all on public.admin_assignments, public.admin_audit_log from public, anon, authenticated;
grant select on public.admin_assignments, public.admin_audit_log to authenticated;
create policy admin_assignments_read_self on public.admin_assignments for select to authenticated
using (auth_user_id = (select auth.uid()));
create policy admin_audit_read_authorized on public.admin_audit_log for select to authenticated
using (public.has_admin_permission('assets.read'));

grant execute on function public.has_admin_permission(text) to authenticated;
revoke execute on function public.has_admin_permission(text) from public, anon;

grant insert, update, delete on public.app_assets, public.asset_sources to authenticated;
grant update on public.app_settings to authenticated;
grant insert, update, delete on public.companies, public.company_assets to authenticated;
grant insert, update, delete on public.banners, public.popups to authenticated;
grant update on public.directory_members, public.minutes, public.institutional_documents, public.institutional_programs to authenticated;

create policy app_assets_admin_insert on public.app_assets for insert to authenticated with check (public.has_admin_permission('assets.write'));
create policy app_assets_admin_update on public.app_assets for update to authenticated using (public.has_admin_permission('assets.write')) with check (public.has_admin_permission('assets.write'));
create policy app_assets_admin_delete on public.app_assets for delete to authenticated using (public.has_admin_permission('assets.write'));
create policy asset_sources_admin_all on public.asset_sources for all to authenticated using (public.has_admin_permission('assets.write')) with check (public.has_admin_permission('assets.write'));
create policy app_settings_admin_update on public.app_settings for update to authenticated using (public.has_admin_permission('assets.write')) with check (public.has_admin_permission('assets.write'));
create policy companies_admin_all on public.companies for all to authenticated using (public.has_admin_permission('companies.write')) with check (public.has_admin_permission('companies.write'));
create policy company_assets_admin_all on public.company_assets for all to authenticated using (public.has_admin_permission('companies.write')) with check (public.has_admin_permission('companies.write'));
create policy banners_admin_all on public.banners for all to authenticated using (public.has_admin_permission('banners.write')) with check (public.has_admin_permission('banners.write'));
create policy popups_admin_all on public.popups for all to authenticated using (public.has_admin_permission('popups.write')) with check (public.has_admin_permission('popups.write'));
create policy directory_assets_admin_update on public.directory_members for update to authenticated using (public.has_admin_permission('documents.write')) with check (public.has_admin_permission('documents.write'));
create policy minutes_assets_admin_update on public.minutes for update to authenticated using (public.has_admin_permission('documents.write')) with check (public.has_admin_permission('documents.write'));
create policy documents_assets_admin_update on public.institutional_documents for update to authenticated using (public.has_admin_permission('documents.write')) with check (public.has_admin_permission('documents.write'));
create policy programs_assets_admin_update on public.institutional_programs for update to authenticated using (public.has_admin_permission('documents.write')) with check (public.has_admin_permission('documents.write'));

create policy h008_storage_admin_insert on storage.objects for insert to authenticated with check (
  (bucket_id='app-assets' and public.has_admin_permission('assets.write')) or
  (bucket_id='company-assets' and public.has_admin_permission('companies.write')) or
  (bucket_id='documents' and public.has_admin_permission('documents.write'))
);
create policy h008_storage_admin_update on storage.objects for update to authenticated using (
  (bucket_id='app-assets' and public.has_admin_permission('assets.write')) or
  (bucket_id='company-assets' and public.has_admin_permission('companies.write')) or
  (bucket_id='documents' and public.has_admin_permission('documents.write'))
) with check (
  (bucket_id='app-assets' and public.has_admin_permission('assets.write')) or
  (bucket_id='company-assets' and public.has_admin_permission('companies.write')) or
  (bucket_id='documents' and public.has_admin_permission('documents.write'))
);
create policy h008_storage_admin_delete on storage.objects for delete to authenticated using (
  (bucket_id='app-assets' and public.has_admin_permission('assets.write')) or
  (bucket_id='company-assets' and public.has_admin_permission('companies.write')) or
  (bucket_id='documents' and public.has_admin_permission('documents.write'))
);

do $$ declare table_name text;
begin
  foreach table_name in array array['app_assets','asset_sources','app_settings','companies','company_assets','banners','popups','directory_members','minutes','institutional_documents','institutional_programs']
  loop
    execute format('create trigger %I_admin_audit after insert or update or delete on public.%I for each row execute function public.audit_admin_write()', table_name, table_name);
  end loop;
end $$;

comment on table public.admin_assignments is 'Technical authorization only; never derived from affiliate, cargo, sindicato, puesto or numero_control.';
comment on table public.admin_audit_log is 'Durable backend audit of successful administrative writes; actor is always auth.uid().';
commit;
