begin;

drop table if exists public.app_settings;

commit;

-- The server-side branding synchronizer owns removal of the optional
-- brand.institutional-seal Storage object and registry row after this SQL.
