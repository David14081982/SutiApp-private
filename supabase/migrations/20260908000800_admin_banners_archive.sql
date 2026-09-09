begin;

-- Lifecycle metadata only: original banner, provenance and shared assets remain intact.
create table public.banner_deletions (
  banner_id uuid primary key references public.banners(id) on delete restrict,
  actor_auth_user_id uuid not null references auth.users(id) on delete restrict,
  deleted_at timestamptz not null default clock_timestamp()
);
alter table public.banner_deletions enable row level security;
alter table public.banner_deletions force row level security;
revoke all on public.banner_deletions from public, anon, authenticated;
grant select on public.banner_deletions to service_role;

create function public.is_banner_archived(p_banner_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.banner_deletions where banner_id=p_banner_id) $$;
revoke all on function public.is_banner_archived(uuid) from public;
grant execute on function public.is_banner_archived(uuid) to anon, authenticated;

-- Restrictive AND filters never grant access. All existing permission policies remain.
create policy banners_not_archived_read on public.banners as restrictive
  for select to anon, authenticated using(not public.is_banner_archived(id));
create policy banners_not_archived_update on public.banners as restrictive
  for update to authenticated using(not public.is_banner_archived(id)) with check(not public.is_banner_archived(id));
create policy banners_not_archived_delete on public.banners as restrictive
  for delete to authenticated using(not public.is_banner_archived(id));

create function public.archive_admin_banner(p_banner_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid();v_archive public.banner_deletions;v_inserted boolean;
begin
  if v_actor is null or not (public.has_admin_permission('banners.write') or public.has_section_action('banners','delete')) then
    raise exception 'BANNERS_DELETE_DENIED' using errcode='42501';
  end if;
  -- Serialize retries and conflicting ordinary banner writes using the master row.
  perform 1 from public.banners where id=p_banner_id for update;
  if not found then raise exception 'BANNER_NOT_FOUND' using errcode='P0002';end if;
  insert into public.banner_deletions(banner_id,actor_auth_user_id)
    values(p_banner_id,v_actor) on conflict(banner_id) do nothing returning * into v_archive;
  v_inserted:=found;
  if v_inserted then
    insert into public.admin_audit_log(actor_auth_user_id,resource,action,target_id,result,details)
      values(v_actor,'banners','BANNERS_DELETE',p_banner_id::text,'SUCCESS',
        jsonb_build_object('section_key','banners','section_action','delete','deletion_mode','ARCHIVE','deleted_at',v_archive.deleted_at));
  else select * into v_archive from public.banner_deletions where banner_id=p_banner_id;
  end if;
  return jsonb_build_object('id',p_banner_id,'deleted',true,'deleted_at',v_archive.deleted_at);
end $$;
revoke all on function public.archive_admin_banner(uuid) from public, anon;
grant execute on function public.archive_admin_banner(uuid) to authenticated;
comment on table public.banner_deletions is 'H-ADMIN-BANNERS-DELETE-001: durable private archive metadata, never a content copy or fallback. Preserve original banners and assets. No browser DML or automatic purge.';
notify pgrst,'reload schema';
commit;
