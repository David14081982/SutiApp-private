-- H-007 recovery. Run only after stopping the four H-007 readers.
-- Reimport is reproducible from data/h007-supabase-now-source.json.
begin;

drop table if exists public.institutional_programs;
drop table if exists public.institutional_documents;
drop table if exists public.minutes;
drop table if exists public.directory_members;
drop function if exists public.set_h007_content_updated_at();

commit;
