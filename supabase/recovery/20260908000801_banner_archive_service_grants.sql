begin;
-- Restore the observed installation ACL only before any archival history exists.
do $$ begin
  if exists(select 1 from public.banner_deletions) then raise exception 'BANNER_ARCHIVE_HISTORY_MUST_BE_PRESERVED';end if;
end $$;
grant all privileges on public.banner_deletions to service_role;
commit;
