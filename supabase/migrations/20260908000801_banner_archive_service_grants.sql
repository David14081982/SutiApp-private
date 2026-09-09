begin;
-- Supabase default privileges include service DML; this feature needs service read only.
revoke all on public.banner_deletions from service_role;
grant select on public.banner_deletions to service_role;
commit;
