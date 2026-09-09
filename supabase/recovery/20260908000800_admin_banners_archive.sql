begin;
-- Never restore archived banners by merely rolling back application infrastructure.
do $$ begin
  if exists(select 1 from public.banner_deletions) then raise exception 'BANNER_ARCHIVE_HISTORY_MUST_BE_PRESERVED';end if;
end $$;
drop policy banners_not_archived_read on public.banners;
drop policy banners_not_archived_update on public.banners;
drop policy banners_not_archived_delete on public.banners;
drop function public.archive_admin_banner(uuid);
drop function public.is_banner_archived(uuid);
drop table public.banner_deletions;
notify pgrst,'reload schema';
commit;
